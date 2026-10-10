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

#[derive(Debug, PartialEq)]
enum Found {
    OnPath,
    /// No está en el PATH de Quorb, pero sí en una carpeta de instalación conocida
    /// (p. ej. se instaló con Quorb abierto y su PATH aún es el viejo).
    In(PathBuf),
    Missing,
}

/// Busca `program` inyectando PATH, carpetas conocidas, plataforma y PATHEXT para
/// poder probarlo sin tocar el entorno real.
fn find_program_in(program: &str, path_dirs: &[PathBuf], known_dirs: &[PathBuf], windows: bool, pathext: &str) -> Found {
    if program.is_empty() {
        return Found::Missing;
    }
    let p = Path::new(program);
    if p.is_absolute() || program.contains(['\\', '/']) {
        return if p.is_file() { Found::OnPath } else { Found::Missing };
    }
    if path_dirs.iter().any(|d| dir_has_program(d, program, windows, pathext)) {
        return Found::OnPath;
    }
    known_dirs
        .iter()
        .find(|d| dir_has_program(d, program, windows, pathext))
        .cloned()
        .map_or(Found::Missing, Found::In)
}

fn find_program(program: &str) -> Found {
    let path_dirs: Vec<PathBuf> = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    find_program_in(program, &path_dirs, &known_dirs(), cfg!(windows), &pathext_env())
}

/// PATHEXT del sistema; vacío fuera de Windows (allí no aplica).
fn pathext_env() -> String {
    if cfg!(windows) {
        std::env::var("PATHEXT").unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".into())
    } else {
        String::new()
    }
}

/// Nombres de fichero que puede tener un programa: en Windows cada extensión de
/// PATHEXT y, al final, el nombre tal cual; en el resto, solo el nombre.
fn program_candidates(program: &str, windows: bool, pathext: &str) -> Vec<String> {
    let mut names = vec![];
    if windows {
        names.extend(pathext.split(';').filter(|e| !e.is_empty()).map(|e| format!("{program}{e}")));
    }
    names.push(program.to_string());
    names
}

fn dir_has_program(dir: &Path, program: &str, windows: bool, pathext: &str) -> bool {
    program_candidates(program, windows, pathext).iter().any(|name| dir.join(name).is_file())
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
    path_with_current(extra, std::env::var_os("PATH"))
}

/// Antepone `extra` a `current` (el PATH actual) sin tocar el entorno real.
fn path_with_current(extra: Option<PathBuf>, current: Option<std::ffi::OsString>) -> Option<std::ffi::OsString> {
    let dir = extra?;
    let mut all = vec![dir];
    if let Some(p) = current {
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

#[cfg(test)]
mod tests {
    use super::*;

    /// Carpeta temporal propia de cada prueba, borrada al terminar.
    struct TempDir(PathBuf);

    impl TempDir {
        fn new(tag: &str) -> Self {
            let dir = std::env::temp_dir().join(format!("quorb-login-{}-{tag}", std::process::id()));
            let _ = std::fs::remove_dir_all(&dir);
            std::fs::create_dir_all(&dir).unwrap();
            Self(dir)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn program_of_keeps_quoted_paths_with_spaces() {
        assert_eq!(program_of("codex login"), "codex");
        assert_eq!(program_of("  gemini   --foo"), "gemini");
        assert_eq!(program_of("\"/opt/mis herramientas/claude\" login"), "/opt/mis herramientas/claude");
        assert_eq!(program_of("\"C:\\Program Files\\nodejs\\codex.cmd\""), "C:\\Program Files\\nodejs\\codex.cmd");
        assert_eq!(program_of(""), "");
    }

    #[test]
    fn windows_candidates_append_pathext_before_the_bare_name() {
        assert_eq!(
            program_candidates("codex", true, ".COM;.EXE;.BAT;.CMD"),
            vec!["codex.COM", "codex.EXE", "codex.BAT", "codex.CMD", "codex"]
        );
        // PATHEXT vacío (o solo separadores): solo el nombre tal cual.
        assert_eq!(program_candidates("codex", true, ""), vec!["codex"]);
        assert_eq!(program_candidates("codex", true, ";;"), vec!["codex"]);
    }

    #[test]
    fn non_windows_candidates_ignore_pathext() {
        assert_eq!(program_candidates("codex", false, ".EXE"), vec!["codex"]);
    }

    #[test]
    fn dir_has_program_accepts_files_and_rejects_directories() {
        let dir = TempDir::new("candidates");
        std::fs::create_dir(dir.path().join("claude")).unwrap();
        assert!(!dir_has_program(dir.path(), "claude", false, ""));
        std::fs::write(dir.path().join("codex"), b"#!/bin/sh\n").unwrap();
        assert!(dir_has_program(dir.path(), "codex", false, ""));
        // La lógica de Windows se prueba en Linux inyectando la plataforma.
        std::fs::write(dir.path().join("gemini.EXE"), b"").unwrap();
        assert!(dir_has_program(dir.path(), "gemini", true, ".EXE"));
        assert!(!dir_has_program(dir.path(), "gemini", false, ""));
    }

    #[test]
    fn absolute_directory_is_not_a_program() {
        let dir = TempDir::new("absdir");
        assert_eq!(find_program_in(dir.path().to_str().unwrap(), &[], &[], false, ""), Found::Missing);
    }

    #[test]
    fn program_is_found_on_the_injected_path_then_in_known_dirs() {
        let path_dir = TempDir::new("path");
        std::fs::write(path_dir.path().join("codex"), b"").unwrap();
        assert_eq!(find_program_in("codex", &[path_dir.path().to_path_buf()], &[], false, ""), Found::OnPath);

        let known = TempDir::new("known");
        std::fs::write(known.path().join("gemini"), b"").unwrap();
        assert_eq!(
            find_program_in("gemini", &[path_dir.path().to_path_buf()], &[known.path().to_path_buf()], false, ""),
            Found::In(known.path().to_path_buf())
        );

        assert_eq!(find_program_in("codex", &[], &[], false, ""), Found::Missing);
        assert_eq!(find_program_in("", &[path_dir.path().to_path_buf()], &[], false, ""), Found::Missing);
    }

    #[test]
    fn joined_path_prepends_the_extra_dir_and_keeps_the_rest() {
        let extra = PathBuf::from("/opt/mis herramientas/bin");
        let current = std::env::join_paths([PathBuf::from("/usr/bin"), PathBuf::from("/bin")]).unwrap();
        let joined = path_with_current(Some(extra.clone()), Some(current)).unwrap();
        let parts: Vec<PathBuf> = std::env::split_paths(&joined).collect();
        assert_eq!(parts, vec![extra, PathBuf::from("/usr/bin"), PathBuf::from("/bin")]);
        assert!(path_with_current(None, None).is_none());
    }
}
