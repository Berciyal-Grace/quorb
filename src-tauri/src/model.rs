//! Modelo común que reciben las vistas, sea cual sea el proveedor.

use serde::Serialize;

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    Ok,
    /// Hay datos pero algo merece atención (rate limit del endpoint, etc.).
    Warning,
    Error,
    /// No hay sesión o ha caducado: hay que pasar por el login oficial.
    NeedsLogin,
    /// Falta configurar una key.
    Unconfigured,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    Subscription,
    Api,
}

#[derive(Serialize, Clone, Debug, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Meter {
    pub label: String,
    /// 0–100
    pub percent: Option<f64>,
    pub used: Option<f64>,
    pub limit: Option<f64>,
    pub unit: Option<String>,
    /// RFC 3339
    pub resets_at: Option<String>,
    /// Duración de la ventana en segundos (5 h, 7 días, mes…), para calcular el ritmo de consumo.
    pub window_seconds: Option<i64>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Spend {
    pub amount: f64,
    pub currency: String,
    pub period_label: String,
    pub budget: Option<f64>,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Daily {
    /// YYYY-MM-DD
    pub date: String,
    pub value: f64,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UsageReport {
    pub id: String,
    pub name: String,
    pub kind: Kind,
    pub status: Status,
    pub plan: Option<String>,
    pub meters: Vec<Meter>,
    pub spend: Option<Spend>,
    pub message: Option<String>,
    /// `login` | `settings`
    pub action: Option<String>,
    /// Tokens por día (si el proveedor los da), para el historial del panel.
    pub daily: Vec<Daily>,
    pub fetched_at: String,
}

impl UsageReport {
    pub fn new(id: &str, name: &str, kind: Kind) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            kind,
            status: Status::Ok,
            plan: None,
            meters: vec![],
            spend: None,
            message: None,
            action: None,
            daily: vec![],
            fetched_at: chrono::Utc::now().to_rfc3339(),
        }
    }

    pub fn fail(mut self, status: Status, message: impl Into<String>) -> Self {
        self.action = match status {
            Status::NeedsLogin => Some("login".into()),
            Status::Unconfigured => Some("settings".into()),
            _ => self.action,
        };
        self.status = status;
        self.message = Some(message.into());
        self
    }
}
