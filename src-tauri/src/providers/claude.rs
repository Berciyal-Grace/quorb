//! Claude Pro / Max — límites de sesión (5 h) y semanales.
//!
//! No hay API pública para esto. Se reutiliza la sesión OAuth que ya guarda
//! Claude Code (`~/.claude/.credentials.json`) y se consulta el mismo endpoint
//! que usa `/usage`. Es NO OFICIAL: puede cambiar o romperse.
//!
//! Importante: la app NO refresca el token por su cuenta (rotaría el refresh
//! token y podría cerrar la sesión del CLI). Si caduca, se abre Claude Code,
//! que lo renueva solo.

use super::{home, net_error, read_json, resolve_path};
use crate::config::SubscriptionConfig;
use crate::model::{Kind, Meter, Status, UsageReport};
use serde_json::Value;

const USAGE_URL: &str = "https://api.anthropic.com/api/oauth/usage";

pub async fn fetch(cfg: &SubscriptionConfig, http: &reqwest::Client) -> UsageReport {
    let report = UsageReport::new("claude", "Claude", Kind::Subscription);

    let candidates = vec![home().join(".claude").join(".credentials.json")];
    let path = match resolve_path(cfg.credentials_path.as_deref(), &candidates) {
        Ok(p) => p,
        Err(e) => return report.fail(Status::NeedsLogin, format!("{e}. Inicia sesión en Claude Code.")),
    };
    let creds = match read_json(&path).and_then(|v| Credentials::parse(&v)) {
        Ok(c) => c,
        Err(e) => return report.fail(Status::Error, e),
    };

    let mut report = report;
    report.plan = creds.plan.clone();

    if creds.is_expired(chrono::Utc::now().timestamp_millis()) {
        return report.fail(
            Status::NeedsLogin,
            "La sesión ha caducado. Abre Claude Code para renovarla.",
        );
    }

    let res = http
        .get(USAGE_URL)
        .bearer_auth(&creds.access_token)
        .header("anthropic-beta", "oauth-2025-04-20")
        .header("anthropic-version", "2023-06-01")
        .send()
        .await;
    let res = match res {
        Ok(r) => r,
        Err(e) => return report.fail(Status::Error, net_error(e)),
    };
    match res.status().as_u16() {
        200 => {}
        401 | 403 => return report.fail(Status::NeedsLogin, "Token rechazado. Abre Claude Code para renovarlo."),
        429 => return report.fail(Status::Warning, "El endpoint de uso está limitando peticiones; reintento en el próximo ciclo."),
        code => return report.fail(Status::Error, format!("HTTP {code} en el endpoint de uso")),
    }
    let body: Value = match res.json().await {
        Ok(v) => v,
        Err(e) => return report.fail(Status::Error, format!("Respuesta inesperada: {e}")),
    };
    report.meters = parse_usage(&body);
    if report.meters.is_empty() {
        return report.fail(Status::Warning, "Respuesta sin datos de uso (¿ha cambiado el formato?)");
    }
    report
}

#[derive(Debug, PartialEq)]
pub(crate) struct Credentials {
    pub access_token: String,
    pub expires_at_ms: Option<i64>,
    pub plan: Option<String>,
}

impl Credentials {
    pub fn parse(v: &Value) -> Result<Self, String> {
        let o = v.get("claudeAiOauth").ok_or("Credenciales sin «claudeAiOauth» (¿login con API key?)")?;
        let access_token = o
            .get("accessToken")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .ok_or("Credenciales sin accessToken")?
            .to_string();
        Ok(Self {
            access_token,
            expires_at_ms: o.get("expiresAt").and_then(Value::as_i64),
            plan: o
                .get("subscriptionType")
                .and_then(Value::as_str)
                .map(pretty_plan),
        })
    }

    pub fn is_expired(&self, now_ms: i64) -> bool {
        // 60 s de margen
        self.expires_at_ms.map(|e| e - 60_000 <= now_ms).unwrap_or(false)
    }
}

fn pretty_plan(s: &str) -> String {
    match s.to_ascii_lowercase().as_str() {
        "max" => "Max".into(),
        "pro" => "Pro".into(),
        "team" => "Team".into(),
        "enterprise" => "Enterprise".into(),
        other => other.to_string(),
    }
}

pub(crate) fn parse_usage(v: &Value) -> Vec<Meter> {
    const H5: i64 = 5 * 3600;
    const D7: i64 = 7 * 86400;
    const WINDOWS: [(&str, &str, i64); 5] = [
        ("five_hour", "Sesión · 5 h", H5),
        ("seven_day", "Semana · todos", D7),
        ("seven_day_opus", "Semana · Opus", D7),
        ("seven_day_sonnet", "Semana · Sonnet", D7),
        ("seven_day_oauth_apps", "Semana · apps", D7),
    ];
    let mut out = vec![];
    for (key, label, secs) in WINDOWS {
        let Some(w) = v.get(key).filter(|w| w.is_object()) else { continue };
        let Some(pct) = w.get("utilization").and_then(Value::as_f64) else { continue };
        out.push(Meter {
            label: label.into(),
            percent: Some(pct),
            resets_at: w.get("resets_at").and_then(Value::as_str).map(str::to_string),
            window_seconds: Some(secs),
            ..Default::default()
        });
    }
    if let Some(extra) = v.get("extra_usage").filter(|e| e.get("is_enabled").and_then(Value::as_bool) == Some(true)) {
        out.push(Meter {
            label: "Uso extra (mes)".into(),
            percent: extra.get("utilization").and_then(Value::as_f64),
            used: extra.get("used_credits").and_then(Value::as_f64),
            limit: extra.get("monthly_limit").and_then(Value::as_f64),
            unit: Some("créditos".into()),
            resets_at: None,
            window_seconds: None,
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_credentials() {
        let v = json!({"claudeAiOauth": {"accessToken": "sk-ant-oat01-x", "refreshToken": "r", "expiresAt": 1_900_000_000_000_i64, "subscriptionType": "max"}});
        let c = Credentials::parse(&v).unwrap();
        assert_eq!(c.plan.as_deref(), Some("Max"));
        assert!(!c.is_expired(1_800_000_000_000));
        assert!(c.is_expired(1_900_000_000_000));
    }

    #[test]
    fn rejects_missing_oauth() {
        assert!(Credentials::parse(&json!({})).is_err());
    }

    #[test]
    fn parses_usage_windows_and_skips_nulls() {
        let v = json!({
            "five_hour": {"utilization": 37.0, "resets_at": "2026-10-06T18:00:00+00:00"},
            "seven_day": {"utilization": 12.5, "resets_at": "2026-10-10T07:00:00+00:00"},
            "seven_day_opus": null,
            "seven_day_sonnet": {"utilization": 3.0, "resets_at": null},
            "extra_usage": {"is_enabled": false}
        });
        let m = parse_usage(&v);
        assert_eq!(m.len(), 3);
        assert_eq!(m[0].label, "Sesión · 5 h");
        assert_eq!(m[0].percent, Some(37.0));
        assert_eq!(m[2].resets_at, None);
        assert_eq!(m[0].window_seconds, Some(5 * 3600));
    }
}
