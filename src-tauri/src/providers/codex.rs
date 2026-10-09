//! ChatGPT Plus / Pro (Codex) — límites de sesión (5 h) y semanales.
//!
//! Igual que con Claude: no hay API pública. Se reutiliza la sesión OAuth que
//! guarda `codex login` (`~/.codex/auth.json`, o `$CODEX_HOME/auth.json`) y se
//! consulta el endpoint que usa `/status` de Codex. NO OFICIAL.
//! La app no refresca tokens: si caducan, basta con ejecutar `codex`.

use super::{home, net_error, read_json, resolve_path, unix_to_rfc3339, Who};
use crate::config::SubscriptionConfig;
use crate::model::{Kind, Meter, Status, UsageReport};
use serde_json::Value;
use std::path::PathBuf;

const USAGE_URL: &str = "https://chatgpt.com/backend-api/wham/usage";

pub async fn fetch(cfg: &SubscriptionConfig, who: Who<'_>, http: &reqwest::Client) -> UsageReport {
    let report = who.report("ChatGPT · Codex", Kind::Subscription);

    let mut candidates: Vec<PathBuf> = vec![];
    if let Ok(dir) = std::env::var("CODEX_HOME") {
        candidates.push(PathBuf::from(dir).join("auth.json"));
    }
    candidates.push(home().join(".codex").join("auth.json"));

    let path = match resolve_path(cfg.credentials_path.as_deref(), &candidates) {
        Ok(p) => p,
        Err(e) => return report.fail(Status::NeedsLogin, format!("{e}. Ejecuta «codex login».")),
    };
    let auth = match read_json(&path).and_then(|v| Auth::parse(&v)) {
        Ok(a) => a,
        Err(e) => return report.fail(Status::NeedsLogin, e),
    };

    let mut req = http
        .get(USAGE_URL)
        .bearer_auth(&auth.access_token)
        .header("Accept", "application/json");
    if let Some(acc) = &auth.account_id {
        req = req.header("chatgpt-account-id", acc);
    }
    let res = match req.send().await {
        Ok(r) => r,
        Err(e) => return report.fail(Status::Error, net_error(e)),
    };
    match res.status().as_u16() {
        200 => {}
        401 | 403 => return report.fail(Status::NeedsLogin, "Sesión caducada. Ejecuta «codex» para renovarla."),
        429 => return report.fail(Status::Warning, "El endpoint de uso está limitando peticiones."),
        code => return report.fail(Status::Error, format!("HTTP {code} en el endpoint de uso")),
    }
    let body: Value = match res.json().await {
        Ok(v) => v,
        Err(e) => return report.fail(Status::Error, format!("Respuesta inesperada: {e}")),
    };
    let (plan, meters) = parse_usage(&body);
    let mut report = report;
    report.plan = plan;
    report.meters = meters;
    if report.meters.is_empty() {
        return report.fail(Status::Warning, "Respuesta sin datos de uso (¿ha cambiado el formato?)");
    }
    report
}

#[derive(Debug, PartialEq)]
pub(crate) struct Auth {
    pub access_token: String,
    pub account_id: Option<String>,
}

impl Auth {
    pub fn parse(v: &Value) -> Result<Self, String> {
        let tokens = v.get("tokens").filter(|t| t.is_object());
        let Some(tokens) = tokens else {
            return Err(if v.get("OPENAI_API_KEY").and_then(Value::as_str).is_some() {
                "Codex está autenticado con API key, no con tu cuenta de ChatGPT. Ejecuta «codex login».".into()
            } else {
                "auth.json sin tokens. Ejecuta «codex login».".into()
            });
        };
        let access_token = tokens
            .get("access_token")
            .and_then(Value::as_str)
            .filter(|s| !s.is_empty())
            .ok_or("auth.json sin access_token")?
            .to_string();
        Ok(Self {
            access_token,
            account_id: tokens.get("account_id").and_then(Value::as_str).map(str::to_string),
        })
    }
}

fn window_label(seconds: Option<i64>, fallback: &str) -> String {
    match seconds {
        Some(s) if s > 0 && s <= 6 * 3600 => format!("Sesión · {} h", (s as f64 / 3600.0).round() as i64),
        Some(s) if (6 * 86400..=8 * 86400).contains(&s) => "Semana".into(),
        Some(s) if s > 0 && s % 86400 == 0 => format!("{} días", s / 86400),
        _ => fallback.into(),
    }
}

fn parse_window(w: &Value, fallback: &str) -> Option<Meter> {
    let pct = w.get("used_percent").and_then(Value::as_f64)?;
    let secs = w.get("limit_window_seconds").and_then(Value::as_i64);
    Some(Meter {
        label: window_label(secs, fallback),
        window_seconds: secs.filter(|s| *s > 0),
        percent: Some(pct),
        resets_at: w.get("reset_at").and_then(Value::as_i64).and_then(unix_to_rfc3339),
        ..Default::default()
    })
}

pub(crate) fn parse_usage(v: &Value) -> (Option<String>, Vec<Meter>) {
    let plan = v.get("plan_type").and_then(Value::as_str).map(|p| {
        let mut c = p.chars();
        c.next().map(|f| f.to_uppercase().collect::<String>() + c.as_str()).unwrap_or_default()
    });
    let mut meters = vec![];
    if let Some(rl) = v.get("rate_limit") {
        if let Some(m) = rl.get("primary_window").and_then(|w| parse_window(w, "Ventana corta")) {
            meters.push(m);
        }
        if let Some(m) = rl.get("secondary_window").and_then(|w| parse_window(w, "Ventana larga")) {
            meters.push(m);
        }
    }
    if let Some(c) = v.get("credits").filter(|c| c.get("has_credits").and_then(Value::as_bool) == Some(true)) {
        let unlimited = c.get("unlimited").and_then(Value::as_bool).unwrap_or(false);
        let balance = c
            .get("balance")
            .and_then(|b| b.as_f64().or_else(|| b.as_str().and_then(|s| s.parse().ok())));
        if !unlimited {
            if let Some(b) = balance {
                meters.push(Meter {
                    label: "Créditos disponibles".into(),
                    used: Some(b),
                    unit: Some("créditos".into()),
                    ..Default::default()
                });
            }
        }
    }
    (plan, meters)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_auth() {
        let v = json!({"OPENAI_API_KEY": null, "tokens": {"id_token": "a", "access_token": "b", "refresh_token": "c", "account_id": "acc"}});
        assert_eq!(Auth::parse(&v).unwrap(), Auth { access_token: "b".into(), account_id: Some("acc".into()) });
        assert!(Auth::parse(&json!({"OPENAI_API_KEY": "sk-..."})).unwrap_err().contains("API key"));
    }

    #[test]
    fn parses_windows() {
        let v = json!({
            "plan_type": "plus",
            "rate_limit": {
                "allowed": true,
                "primary_window": {"used_percent": 20, "limit_window_seconds": 18000, "reset_after_seconds": 14400, "reset_at": 1704081600},
                "secondary_window": {"used_percent": 50, "limit_window_seconds": 604800, "reset_at": 1704499200}
            },
            "credits": {"has_credits": true, "unlimited": false, "balance": "15.0"}
        });
        let (plan, m) = parse_usage(&v);
        assert_eq!(plan.as_deref(), Some("Plus"));
        assert_eq!(m.len(), 3);
        assert_eq!(m[0].label, "Sesión · 5 h");
        assert_eq!(m[0].percent, Some(20.0));
        assert_eq!(m[0].resets_at.as_deref(), Some("2024-01-01T04:00:00+00:00"));
        assert_eq!(m[1].label, "Semana");
        assert_eq!(m[1].window_seconds, Some(604800));
        assert_eq!(m[2].used, Some(15.0));
    }
}
