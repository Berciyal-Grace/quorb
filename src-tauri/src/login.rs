//! Login OAuth delegado en los CLIs oficiales.
//!
//! Anthropic y OpenAI no permiten registrar clientes OAuth de terceros para
//! las suscripciones de consumo, así que la app abre el flujo oficial
//! (`claude` / `codex login`) en una terminal nueva: el navegador hace el
//! OAuth con el proveedor y el CLI guarda la sesión, que luego leemos.
//!
//! Las cuentas adicionales usan el mismo comando con su propia carpeta de sesión
//! (`CLAUDE_CONFIG_DIR`, `CODEX_HOME` o `GEMINI_CLI_HOME`), así no pisan la principal.

use crate::config::AppConfig;

/// `id`: el proveedor (cuenta principal) o el id de una cuenta adicional.
pub fn open(id: &str, cfg: &AppConfig) -> Result<(), String> {
    let mut env = None;
    let provider = match cfg.accounts.iter().find(|a| a.id == id) {
        Some(a) => {
            let var = a.session_env().ok_or_else(|| format!("La cuenta «{}» no tiene login por CLI", a.label))?;
            let dir = a.session_dir(&crate::providers::home());
            std::fs::create_dir_all(&dir).map_err(|e| format!("No pude crear {}: {e}", dir.display()))?;
            env = Some((var, dir));
            a.provider.as_str()
        }
        None => id,
    };
    let command = match provider {
        "claude" => cfg.claude.login_command.trim(),
        "codex" => cfg.codex.login_command.trim(),
        "gemini" => cfg.gemini.login_command.trim(),
        "cursor" => cfg.cursor.login_command.trim(),
        other => return Err(format!("El proveedor {other} no tiene login por CLI")),
    };
    if command.is_empty() {
        return Err("Comando de login vacío (revísalo en Ajustes)".into());
    }
    spawn_terminal(command, env)
}

/// Variable de entorno con la carpeta de sesión de una cuenta adicional.
type SessionEnv = Option<(&'static str, std::path::PathBuf)>;

#[cfg(windows)]
fn spawn_terminal(command: &str, env: SessionEnv) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut cmd = std::process::Command::new("cmd");
    // La consola nueva hereda el entorno, y con él la carpeta de sesión de la cuenta.
    if let Some((var, dir)) = env {
        cmd.env(var, dir);
    }
    // `start` abre una consola nueva; `/K` la deja abierta al terminar.
    cmd.current_dir(dirs::home_dir().unwrap_or_else(|| ".".into()))
        .raw_arg(format!("/C start \"Quorb · login\" cmd /K {command}"))
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No pude abrir la terminal: {e}"))
}

#[cfg(not(windows))]
fn spawn_terminal(command: &str, env: SessionEnv) -> Result<(), String> {
    let mut cmd = std::process::Command::new("x-terminal-emulator");
    if let Some((var, dir)) = env {
        cmd.env(var, dir);
    }
    cmd.args(["-e", "sh", "-c", &format!("{command}; exec $SHELL")])
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No pude abrir la terminal: {e}"))
}
