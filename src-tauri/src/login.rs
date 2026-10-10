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
use std::path::{Path, PathBuf};

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
    // Antes de abrir la terminal se comprueba que el CLI está instalado: si no, la
    // consola solo diría «no se reconoce como un comando» y no sabrías qué hacer.
    let program = program_of(command);
    let extra_dir = match find_program(&program) {
        Found::OnPath => None,
        Found::In(dir) => Some(dir),
        Found::Missing => return Err(not_installed(provider, &program)),
    };
    spawn_terminal(command, env, extra_dir)
}

/// ¿Está instalado el CLI de login de cada proveedor que lo usa? Para avisar en
/// Ajustes antes de que pulses «Iniciar sesión».
pub fn cli_status(cfg: &AppConfig) -> std::collections::BTreeMap<String, bool> {
    [("claude", &cfg.claude.login_command), ("codex", &cfg.codex.login_command), ("gemini", &cfg.gemini.login_command)]
        .into_iter()
        .map(|(p, c)| (p.to_string(), !matches!(find_program(&program_of(c)), Found::Missing)))
        .collect()
}

/// Primer elemento del comando (`codex login` → `codex`), sin comillas.
fn program_of(command: &str) -> String {
    let c = command.trim();
    if let Some(rest) = c.strip_prefix('"') {
        return rest.split('"').next().unwrap_or("").to_string();
    }
    c.split_whitespace().next().unwrap_or("").to_string()
}

enum Found {
    OnPath,
    /// No está en el PATH de Quorb, pero sí en una carpeta de instalación conocida
    /// (p. ej. se instaló con Quorb abierto y su PATH aún es el viejo).
    In(PathBuf),
    Missing,
}

fn find_program(program: &str) -> Found {
    if program.is_empty() {
        return Found::Missing;
    }
    let p = Path::new(program);
    if p.is_absolute() || program.contains(['\\', '/']) {
        return if p.exists() { Found::OnPath } else { Found::Missing };
    }
    if let Some(paths) = std::env::var_os("PATH") {
        if std::env::split_paths(&paths).any(|d| has_program(&d, program)) {
            return Found::OnPath;
        }
    }
    known_dirs().into_iter().find(|d| has_program(d, program)).map_or(Found::Missing, Found::In)
}

/// Carpetas donde suelen quedar los CLIs: npm global y el instalador nativo de Claude Code.
fn known_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![];
    if let Some(appdata) = std::env::var_os("APPDATA") {
        dirs.push(PathBuf::from(appdata).join("npm"));
    }
    let home = crate::providers::home();
    dirs.push(home.join(".local").join("bin"));
    dirs.push(home.join(".npm-global").join("bin"));
    dirs
}

fn has_program(dir: &Path, program: &str) -> bool {
    if cfg!(windows) {
        let exts = std::env::var("PATHEXT").unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".into());
        exts.split(';').filter(|e| !e.is_empty()).any(|e| dir.join(format!("{program}{e}")).is_file()) || dir.join(program).is_file()
    } else {
        dir.join(program).is_file()
    }
}

fn not_installed(provider: &str, program: &str) -> String {
    let how = match provider {
        "claude" => "Instala Claude Code (en PowerShell: irm https://claude.ai/install.ps1 | iex)",
        "codex" => "Instala el CLI de Codex con: npm install -g @openai/codex (necesita Node.js)",
        "gemini" => "Instala Gemini CLI con: npm install -g @google/gemini-cli (necesita Node.js)",
        _ => "Instala su CLI o cambia el comando de login en la cuenta principal",
    };
    format!("No encuentro «{program}» en este equipo. {how} y vuelve a pulsar «Iniciar sesión».")
}

/// Variable de entorno con la carpeta de sesión de una cuenta adicional.
type SessionEnv = Option<(&'static str, std::path::PathBuf)>;

/// Antepone al PATH la carpeta donde se encontró el CLI (si no estaba en el PATH).
fn path_with(extra: Option<PathBuf>) -> Option<std::ffi::OsString> {
    let dir = extra?;
    let mut all = vec![dir];
    if let Some(p) = std::env::var_os("PATH") {
        all.extend(std::env::split_paths(&p));
    }
    std::env::join_paths(all).ok()
}

#[cfg(windows)]
fn spawn_terminal(command: &str, env: SessionEnv, extra_dir: Option<PathBuf>) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let mut cmd = std::process::Command::new("cmd");
    if let Some(path) = path_with(extra_dir) {
        cmd.env("PATH", path);
    }
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
fn spawn_terminal(command: &str, env: SessionEnv, extra_dir: Option<PathBuf>) -> Result<(), String> {
    let mut cmd = std::process::Command::new("x-terminal-emulator");
    if let Some(path) = path_with(extra_dir) {
        cmd.env("PATH", path);
    }
    if let Some((var, dir)) = env {
        cmd.env(var, dir);
    }
    cmd.args(["-e", "sh", "-c", &format!("{command}; exec $SHELL")])
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("No pude abrir la terminal: {e}"))
}
