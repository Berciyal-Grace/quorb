//! API keys guardadas en el almacén seguro del sistema
//! (Windows Credential Manager). Nunca se devuelven al frontend.

use std::collections::BTreeMap;

const SERVICE: &str = "es.egdev.quorb";
/// Nombre anterior de la app: se leen sus secretos una vez y se copian al nuevo.
const LEGACY_SERVICE: &str = "es.egdev.ai-usage";

pub const ANTHROPIC_ADMIN_KEY: &str = "anthropic_admin_key";
pub const OPENAI_ADMIN_KEY: &str = "openai_admin_key";
pub const NAN_API_KEY: &str = "nan_api_key";
/// Cookies de sesión de cloud.nan.builders (login por enlace de email, como la CLI oficial).
pub const NAN_SESSION: &str = "nan_session";

pub const OPENROUTER_API_KEY: &str = "openrouter_api_key";
/// Token fine-grained de GitHub con permiso «Plan» (lectura) para la facturación de Copilot.
pub const GITHUB_TOKEN: &str = "github_token";
/// Token de Cursor pegado a mano (si no, se lee de la app).
pub const CURSOR_TOKEN: &str = "cursor_token";

pub const ALL: [&str; 7] = [
    ANTHROPIC_ADMIN_KEY,
    OPENAI_ADMIN_KEY,
    NAN_API_KEY,
    NAN_SESSION,
    OPENROUTER_API_KEY,
    GITHUB_TOKEN,
    CURSOR_TOKEN,
];

fn entry(key: &str) -> Result<keyring::Entry, String> {
    if !ALL.contains(&key) {
        return Err(format!("Clave desconocida: {key}"));
    }
    keyring::Entry::new(SERVICE, key).map_err(|e| e.to_string())
}

pub fn get(key: &str) -> Option<String> {
    let current = entry(key)
        .ok()?
        .get_password()
        .ok()
        .filter(|s| !s.trim().is_empty());
    current.or_else(|| migrate_legacy(key))
}

/// Si el secreto estaba guardado con el nombre anterior, lo copia al nuevo y lo devuelve.
fn migrate_legacy(key: &str) -> Option<String> {
    let old = keyring::Entry::new(LEGACY_SERVICE, key).ok()?;
    let value = old.get_password().ok().filter(|s| !s.trim().is_empty())?;
    if set(key, &value).is_ok() {
        let _ = old.delete_credential();
    }
    Some(value)
}

/// Guarda el secreto; si `value` está vacío lo borra.
pub fn set(key: &str, value: &str) -> Result<(), String> {
    let e = entry(key)?;
    let value = value.trim();
    if value.is_empty() {
        return match e.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(err) => Err(err.to_string()),
        };
    }
    e.set_password(value).map_err(|err| err.to_string())
}

/// Qué secretos hay configurados (sin revelar su valor).
pub fn status() -> BTreeMap<String, bool> {
    ALL.iter().map(|k| (k.to_string(), get(k).is_some())).collect()
}
