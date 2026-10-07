//! Configuración persistente (sin secretos). Los tokens/keys viven en `secrets`.

use serde::{Deserialize, Serialize};
use std::path::Path;

pub const ORB_SIZE_MIN: u32 = 32;
pub const ORB_SIZE_MAX: u32 = 80;
pub const ORB_SIZE_DEFAULT: u32 = 48;
pub const ACCENT_DEFAULT: &str = "#ff0036";

/// Acepta `#rgb` o `#rrggbb` (con o sin `#`) y lo devuelve como `#rrggbb` en minúsculas.
fn normalize_hex(s: &str) -> Option<String> {
    let h = s.trim().trim_start_matches('#');
    if !h.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    match h.len() {
        6 => Some(format!("#{}", h.to_ascii_lowercase())),
        3 => Some(format!("#{}", h.chars().flat_map(|c| [c, c]).collect::<String>().to_ascii_lowercase())),
        _ => None,
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct AppConfig {
    /// Cada cuántos minutos se refrescan los datos (mínimo 1).
    pub refresh_minutes: u32,
    /// Opacidad del widget (0.3 – 1.0).
    pub opacity: f32,
    /// Círculos pequeños: un solo anillo por proveedor.
    pub compact: bool,
    /// Diámetro de los círculos de la tira, en px (ORB_SIZE_MIN–ORB_SIZE_MAX).
    pub orb_size: u32,
    /// Color base (#rrggbb) de anillos y barras; los otros dos tonos se derivan en el frontend.
    pub accent_color: String,
    pub always_on_top: bool,
    /// Borde de la pantalla al que va pegada la tira: top | bottom | left | right
    pub dock_edge: String,
    /// Posición a lo largo del borde (0 = inicio, 1 = final).
    pub dock_offset: f64,
    /// Nombre del monitor (None = el actual / principal).
    pub dock_monitor: Option<String>,
    /// Ocultar la tira dejando solo una franja en el borde; aparece al acercar el ratón.
    pub auto_hide: bool,
    /// Buscar actualizaciones en GitHub Releases al arrancar y cada pocas horas.
    pub auto_update: bool,
    /// Orden de los círculos (ids de proveedor). Los que falten van al final.
    pub provider_order: Vec<String>,
    /// Círculos ocultos en la tira (se siguen consultando y avisando).
    pub hidden_providers: Vec<String>,
    pub alerts: AlertsConfig,
    pub shortcuts: ShortcutsConfig,
    pub claude: SubscriptionConfig,
    pub codex: SubscriptionConfig,
    pub gemini: SubscriptionConfig,
    pub cursor: SubscriptionConfig,
    pub copilot: CopilotConfig,
    pub openrouter: OpenRouterConfig,
    pub anthropic_api: ApiCostConfig,
    pub openai_api: ApiCostConfig,
    pub nan: NanConfig,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            refresh_minutes: 5,
            opacity: 0.94,
            compact: false,
            orb_size: ORB_SIZE_DEFAULT,
            accent_color: ACCENT_DEFAULT.into(),
            always_on_top: true,
            dock_edge: "top".into(),
            dock_offset: 0.5,
            dock_monitor: None,
            auto_hide: false,
            auto_update: true,
            provider_order: vec![],
            hidden_providers: vec![],
            alerts: AlertsConfig::default(),
            claude: SubscriptionConfig {
                enabled: true,
                credentials_path: None,
                login_command: "claude".into(),
            },
            codex: SubscriptionConfig {
                enabled: true,
                credentials_path: None,
                login_command: "codex login".into(),
            },
            gemini: SubscriptionConfig {
                enabled: false,
                credentials_path: None,
                login_command: "gemini".into(),
            },
            cursor: SubscriptionConfig {
                enabled: false,
                credentials_path: None,
                login_command: "cursor".into(),
            },
            copilot: CopilotConfig::default(),
            openrouter: OpenRouterConfig::default(),
            shortcuts: ShortcutsConfig::default(),
            anthropic_api: ApiCostConfig::default(),
            openai_api: ApiCostConfig::default(),
            nan: NanConfig::default(),
        }
    }
}

/// Atajos de teclado globales (formato «Ctrl+Alt+U»). Vacío = sin atajo.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct ShortcutsConfig {
    pub enabled: bool,
    /// Mostrar / ocultar la tira.
    pub toggle: String,
    /// Abrir el detalle de la suscripción más cargada.
    pub open_peak: String,
    /// Actualizar ahora.
    pub refresh: String,
}

impl Default for ShortcutsConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            toggle: "Ctrl+Alt+U".into(),
            open_peak: "Ctrl+Alt+I".into(),
            refresh: "Ctrl+Alt+R".into(),
        }
    }
}

/// GitHub Copilot: API oficial de facturación (peticiones premium del mes).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct CopilotConfig {
    pub enabled: bool,
    /// Usuario de GitHub.
    pub username: String,
    /// free | pro | pro_plus | business | enterprise | custom
    pub plan: String,
    /// Peticiones premium incluidas si el plan es «custom» (o para sobrescribir).
    pub custom_allowance: Option<u32>,
}

impl Default for CopilotConfig {
    fn default() -> Self {
        Self { enabled: false, username: String::new(), plan: "pro".into(), custom_allowance: None }
    }
}

/// OpenRouter: API oficial (uso y saldo de la key).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct OpenRouterConfig {
    pub enabled: bool,
}

/// Suscripciones de consumo (Claude Pro/Max, ChatGPT Plus/Pro) leídas
/// a partir de la sesión OAuth que ya guarda el CLI oficial.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct SubscriptionConfig {
    pub enabled: bool,
    /// Ruta explícita al fichero de credenciales. `None` = autodetectar.
    /// Útil para WSL: `\\wsl.localhost\Ubuntu\home\<user>\.claude\.credentials.json`
    pub credentials_path: Option<String>,
    /// Comando que abre el login oficial (OAuth) en una terminal nueva.
    pub login_command: String,
}

pub const EFFECTS: [&str; 4] = ["confetti", "glow", "custom", "none"];
pub const MEDIA_SIZES: [&str; 3] = ["small", "medium", "full"];

/// Avisos en dos momentos: al superar el límite y cuando ese límite se reinicia.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct AlertsConfig {
    pub enabled: bool,
    /// Notificación nativa de Windows además del efecto.
    pub native: bool,
    /// % a partir del cual se considera superado el límite.
    pub threshold: f64,
    /// Efecto al superar el límite: confetti | glow | custom | none
    pub exceeded_effect: String,
    /// Avisar cuando un límite que se había superado se reinicia.
    pub on_reset: bool,
    pub reset_effect: String,
    /// Archivo del efecto propio para cada momento (vídeo WebM con alfa, GIF, WebP o APNG animado).
    pub exceeded_media: Option<String>,
    pub reset_media: Option<String>,
    /// Tamaño del efecto propio: small | medium | full
    pub media_size: String,
    pub media_sound: bool,
}

impl Default for AlertsConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            native: true,
            threshold: 90.0,
            exceeded_effect: "confetti".into(),
            on_reset: true,
            reset_effect: "confetti".into(),
            exceeded_media: None,
            reset_media: None,
            media_size: "medium".into(),
            media_sound: false,
        }
    }
}

impl AlertsConfig {
    /// Archivo del efecto propio para un momento (`exceeded` | `reset`).
    pub fn media_for(&self, moment: &str) -> Option<&str> {
        match moment {
            "reset" => self.reset_media.as_deref(),
            _ => self.exceeded_media.as_deref(),
        }
    }
}

/// Gasto de API de pago por uso (Admin API key).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
#[serde(default, rename_all = "camelCase")]
pub struct ApiCostConfig {
    pub enabled: bool,
    /// Presupuesto mensual en USD para pintar la barra (opcional).
    pub monthly_budget_usd: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct NanConfig {
    pub enabled: bool,
    pub base_url: String,
    /// `community` | `member` | `premium`
    pub plan: String,
    /// Endpoint opcional que devuelva JSON con el consumo (cuando NaN lo publique).
    pub usage_url: Option<String>,
    /// JSON Pointer (RFC 6901) al valor consumido, p. ej. `/data/used_tokens`.
    pub used_pointer: Option<String>,
    /// JSON Pointer al límite, p. ej. `/data/quota_tokens`.
    pub limit_pointer: Option<String>,
    pub usage_label: Option<String>,
    /// Día del mes en que empieza tu periodo de facturación (Stripe); solo afecta a glm5.3.
    pub billing_day: u32,
}

impl Default for NanConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            base_url: "https://api.nan.builders/v1".into(),
            plan: "member".into(),
            usage_url: None,
            used_pointer: None,
            limit_pointer: None,
            usage_label: None,
            billing_day: 1,
        }
    }
}

impl AppConfig {
    /// Corrige valores fuera de rango.
    pub fn sanitized(mut self) -> Self {
        self.refresh_minutes = self.refresh_minutes.clamp(1, 120);
        self.orb_size = self.orb_size.clamp(ORB_SIZE_MIN, ORB_SIZE_MAX);
        self.accent_color = normalize_hex(&self.accent_color).unwrap_or_else(|| ACCENT_DEFAULT.into());
        if !self.opacity.is_finite() {
            self.opacity = 0.94;
        }
        self.opacity = self.opacity.clamp(0.3, 1.0);
        if !matches!(self.dock_edge.as_str(), "top" | "bottom" | "left" | "right") {
            self.dock_edge = "top".into();
        }
        self.dock_offset = if self.dock_offset.is_finite() { self.dock_offset.clamp(0.0, 1.0) } else { 0.5 };
        for p in [
            &mut self.claude.credentials_path,
            &mut self.codex.credentials_path,
            &mut self.gemini.credentials_path,
            &mut self.cursor.credentials_path,
        ] {
            if p.as_deref().map(str::trim).unwrap_or("").is_empty() {
                *p = None;
            }
        }
        if self.nan.base_url.trim().is_empty() {
            self.nan.base_url = NanConfig::default().base_url;
        }
        self.nan.base_url = self.nan.base_url.trim().trim_end_matches('/').to_string();
        self.nan.billing_day = self.nan.billing_day.clamp(1, 28);
        let a = &mut self.alerts;
        a.threshold = if a.threshold.is_finite() { a.threshold.clamp(1.0, 100.0) } else { 90.0 };
        for e in [&mut a.exceeded_effect, &mut a.reset_effect] {
            if e.as_str() == "video" {
                *e = "custom".into();
            }
            if !EFFECTS.contains(&e.as_str()) {
                *e = "confetti".into();
            }
        }
        for m in [&mut a.exceeded_media, &mut a.reset_media] {
            if m.as_deref().map(str::trim).unwrap_or("").is_empty() {
                *m = None;
            }
        }
        if !MEDIA_SIZES.contains(&a.media_size.as_str()) {
            a.media_size = "medium".into();
        }
        self.copilot.username = self.copilot.username.trim().trim_start_matches('@').to_string();
        for sc in [&mut self.shortcuts.toggle, &mut self.shortcuts.open_peak, &mut self.shortcuts.refresh] {
            *sc = sc.trim().to_string();
        }
        for list in [&mut self.provider_order, &mut self.hidden_providers] {
            let mut seen = std::collections::HashSet::new();
            list.retain(|id| seen.insert(id.clone()));
        }
        self
    }
}

pub fn load(path: &Path) -> AppConfig {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str::<AppConfig>(&s).ok())
        .unwrap_or_default()
        .sanitized()
}

pub fn save(path: &Path, cfg: &AppConfig) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn partial_json_fills_defaults() {
        let cfg: AppConfig = serde_json::from_str(r#"{"refreshMinutes": 0, "nan": {"enabled": true}}"#).unwrap();
        let cfg = cfg.sanitized();
        assert_eq!(cfg.refresh_minutes, 1);
        assert!(cfg.nan.enabled);
        assert_eq!(cfg.nan.base_url, "https://api.nan.builders/v1");
        assert_eq!(cfg.codex.login_command, "codex login");
        assert_eq!(cfg.dock_edge, "top");
    }

    #[test]
    fn invalid_dock_is_fixed() {
        let cfg: AppConfig = serde_json::from_str(r#"{"dockEdge": "middle", "dockOffset": 3.0}"#).unwrap();
        let cfg = cfg.sanitized();
        assert_eq!(cfg.dock_edge, "top");
        assert_eq!(cfg.dock_offset, 1.0);
    }

    #[test]
    fn orb_size_is_clamped() {
        let small: AppConfig = serde_json::from_str(r#"{"orbSize": 4}"#).unwrap();
        let big: AppConfig = serde_json::from_str(r#"{"orbSize": 500}"#).unwrap();
        assert_eq!(small.sanitized().orb_size, ORB_SIZE_MIN);
        assert_eq!(big.sanitized().orb_size, ORB_SIZE_MAX);
        assert_eq!(AppConfig::default().orb_size, ORB_SIZE_DEFAULT);
    }

    #[test]
    fn alerts_are_sanitized() {
        let cfg: AppConfig = serde_json::from_str(
            r#"{"alerts": {"threshold": 250, "exceededEffect": "video", "resetEffect": "boom", "resetMedia": "  ", "mediaSize": "xl"}}"#,
        )
        .unwrap();
        let a = cfg.sanitized().alerts;
        assert_eq!(a.threshold, 100.0);
        assert_eq!(a.exceeded_effect, "custom");
        assert_eq!(a.reset_effect, "confetti");
        assert_eq!(a.reset_media, None);
        assert_eq!(a.media_size, "medium");
        let d = AppConfig::default().alerts;
        assert_eq!((d.exceeded_effect.as_str(), d.reset_effect.as_str(), d.threshold), ("confetti", "confetti", 90.0));
        assert!(!AppConfig::default().auto_hide);
        assert!(AppConfig::default().auto_update);
    }

    #[test]
    fn new_providers_default_off_and_shortcuts_on() {
        let cfg = AppConfig::default();
        assert!(!cfg.gemini.enabled && !cfg.cursor.enabled && !cfg.copilot.enabled && !cfg.openrouter.enabled);
        assert_eq!(cfg.gemini.login_command, "gemini");
        assert_eq!(cfg.shortcuts.toggle, "Ctrl+Alt+U");
        let c: AppConfig = serde_json::from_str(r#"{"copilot": {"username": " @egdev6 "}}"#).unwrap();
        assert_eq!(c.sanitized().copilot.username, "egdev6");
    }

    #[test]
    fn accent_color_is_normalized() {
        let ok: AppConfig = serde_json::from_str(r##"{"accentColor": "0F0"}"##).unwrap();
        let bad: AppConfig = serde_json::from_str(r##"{"accentColor": "rojo"}"##).unwrap();
        assert_eq!(ok.sanitized().accent_color, "#00ff00");
        assert_eq!(bad.sanitized().accent_color, ACCENT_DEFAULT);
    }

    #[test]
    fn blank_paths_become_none() {
        let mut cfg = AppConfig::default();
        cfg.claude.credentials_path = Some("  ".into());
        assert_eq!(cfg.sanitized().claude.credentials_path, None);
    }
}
