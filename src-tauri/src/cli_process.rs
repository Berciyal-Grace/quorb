//! Ejecución de procesos hijos para el instalador asistido.
//!
//! Este módulo aísla el único punto donde Quorb lanza procesos: el par
//! Node/npm y el binario nativo. Dos garantías importan aquí:
//!
//! 1. **Contención fail-closed**: cada hijo se crea dentro de un Job Object con
//!    `KILL_ON_JOB_CLOSE` (Windows) o de su propio grupo de procesos (Unix), de
//!    modo que al terminar el runner se mata el árbol COMPLETO, no solo el hijo
//!    directo. Sin esto, un nieto que herede `stdout`/`stderr` mantendría la
//!    tubería abierta y la lectura nunca vería EOF.
//! 2. **Captura acotada**: nunca se lee sin límite. Como mucho `MAX_CAPTURE_BYTES`
//!    por stream; el resto se drena y descarta, así una salida maliciosa no puede
//!    agotar la memoria. `npm` y `codex.exe` nunca vuelcan su stdout/stderr a la UI.
//!
//! La política del instalador (rutas, argumentos fijos, lista blanca de entorno)
//! vive en `codex_setup.rs`; aquí solo se ejecuta lo que ya se decidió.

use std::collections::BTreeMap;
use std::path::Path;
use std::time::{Duration, Instant};

/// Máximo de bytes capturados por stream. El resto se descarta tras drenarse.
pub const MAX_CAPTURE_BYTES: usize = 64 * 1024;
/// Cadencia del sondeo de espera/reap.
const POLL_INTERVAL: Duration = Duration::from_millis(10);
/// Margen acotado por fase (reap y drenaje) tras matar el árbol. La cota dura
/// total del runner es `timeout + 2 * DRAIN_GRACE`; nunca hay espera sin límite.
const DRAIN_GRACE: Duration = Duration::from_millis(200);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommandOutput {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RunError {
    Spawn,
    Io,
    Timeout,
}

pub trait CommandRunner: Send + Sync {
    fn run(
        &self,
        program: &Path,
        args: &[String],
        env: &BTreeMap<String, String>,
        cwd: &Path,
        timeout: Duration,
    ) -> Result<CommandOutput, RunError>;
}

pub struct ProcessRunner;

impl CommandRunner for ProcessRunner {
    fn run(
        &self,
        program: &Path,
        args: &[String],
        env: &BTreeMap<String, String>,
        cwd: &Path,
        timeout: Duration,
    ) -> Result<CommandOutput, RunError> {
        let mut child = spawn_child(program, args, env, cwd)?;

        // Contención antes de leer nada: si no se puede asignar, se mata al hijo y
        // se falla en cerrado (nunca se deja un proceso sin contención).
        let containment = match platform::Containment::attach(&child) {
            Ok(containment) => containment,
            Err(error) => {
                let _ = child.kill();
                let _ = reap(&mut child, Instant::now() + DRAIN_GRACE);
                return Err(error);
            }
        };

        let stdout = child.stdout.take().map(BoundedReader::spawn);
        let stderr = child.stderr.take().map(BoundedReader::spawn);

        let wait_deadline = Instant::now() + timeout;
        let mut timed_out = false;
        let mut wait_error = false;
        loop {
            match child.try_wait() {
                Ok(Some(_)) => break,
                Ok(None) => {
                    if Instant::now() >= wait_deadline {
                        timed_out = true;
                        break;
                    }
                    std::thread::sleep(POLL_INTERVAL);
                }
                Err(_) => {
                    wait_error = true;
                    break;
                }
            }
        }

        // Terminar SIEMPRE el árbol completo: en timeout y también en la salida
        // normal, para que ningún nieto que heredó las tuberías bloquee la lectura.
        containment.terminate();

        // Reap acotado del hijo directo (ya debería estar muerto o a punto de serlo).
        let status = reap(&mut child, Instant::now() + DRAIN_GRACE);
        drop(containment);

        // Drenaje acotado. Si un proceso escapado retuviera una tubería, no se
        // espera indefinidamente (el hilo lector queda desasociado como último recurso).
        let drain_deadline = Instant::now() + DRAIN_GRACE;
        let stdout = stdout.map(|reader| reader.finish(drain_deadline)).unwrap_or_default();
        let stderr = stderr.map(|reader| reader.finish(drain_deadline)).unwrap_or_default();

        if timed_out {
            return Err(RunError::Timeout);
        }
        if wait_error || status.is_none() {
            return Err(RunError::Io);
        }
        Ok(CommandOutput {
            code: status.and_then(|s| s.code()).unwrap_or(-1),
            stdout,
            stderr,
        })
    }
}

fn spawn_child(
    program: &Path,
    args: &[String],
    env: &BTreeMap<String, String>,
    cwd: &Path,
) -> Result<std::process::Child, RunError> {
    use std::process::{Command, Stdio};
    let mut cmd = Command::new(program);
    cmd.args(args)
        .current_dir(cwd)
        .env_clear()
        .envs(env)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    // Grupo propio en Unix para poder matar a todos los descendientes de una vez.
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    cmd.spawn().map_err(|_| RunError::Spawn)
}

fn reap(child: &mut std::process::Child, deadline: Instant) -> Option<std::process::ExitStatus> {
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Some(status),
            Ok(None) => {
                if Instant::now() >= deadline {
                    return None;
                }
                std::thread::sleep(POLL_INTERVAL);
            }
            Err(_) => return None,
        }
    }
}

/// Lector por stream con límite de bytes y sin `join` incondicional.
struct BoundedReader {
    rx: std::sync::mpsc::Receiver<Vec<u8>>,
    handle: Option<std::thread::JoinHandle<()>>,
}

impl BoundedReader {
    fn spawn<R: std::io::Read + Send + 'static>(reader: R) -> Self {
        let (tx, rx) = std::sync::mpsc::channel();
        let handle = std::thread::spawn(move || {
            let _ = tx.send(read_capped(reader));
        });
        Self {
            rx,
            handle: Some(handle),
        }
    }

    fn finish(mut self, deadline: Instant) -> String {
        let wait = deadline.saturating_duration_since(Instant::now());
        match self.rx.recv_timeout(wait) {
            Ok(bytes) => {
                // El hilo ya envió su resultado: el join es inmediato.
                if let Some(handle) = self.handle.take() {
                    let _ = handle.join();
                }
                String::from_utf8_lossy(&bytes).into_owned()
            }
            // No terminó dentro del límite (tubería retenida por un proceso
            // escapado): no se hace join para no colgarse.
            Err(_) => String::new(),
        }
    }
}

fn read_capped<R: std::io::Read>(mut reader: R) -> Vec<u8> {
    let mut out = Vec::new();
    let mut chunk = [0u8; 8192];
    loop {
        match reader.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                if out.len() < MAX_CAPTURE_BYTES {
                    let take = (MAX_CAPTURE_BYTES - out.len()).min(n);
                    out.extend_from_slice(&chunk[..take]);
                }
                // El resto se drena y descarta: acota la memoria sin bloquear al hijo.
            }
            Err(_) => break,
        }
    }
    out
}

/// Contención a nivel de SO del árbol de procesos.
mod platform {
    #[cfg(unix)]
    pub struct Containment {
        pgid: i32,
    }

    #[cfg(unix)]
    impl Containment {
        pub fn attach(child: &std::process::Child) -> Result<Self, super::RunError> {
            // `process_group(0)` ya puso al hijo al frente de su propio grupo.
            Ok(Self {
                pgid: child.id() as i32,
            })
        }

        pub fn terminate(&self) {
            // SIGKILL solo al grupo propio del hijo (creado con `process_group(0)`),
            // nunca a un grupo global ni al de la app. Un pid/un grupo <= 1 se ignora.
            if self.pgid > 1 {
                unsafe {
                    libc::kill(-self.pgid, libc::SIGKILL);
                }
            }
        }
    }

    #[cfg(windows)]
    pub struct Containment {
        job: JobObject,
    }

    #[cfg(windows)]
    impl Containment {
        pub fn attach(child: &std::process::Child) -> Result<Self, super::RunError> {
            JobObject::attach(child)
                .map(|job| Self { job })
                .ok_or(super::RunError::Spawn)
        }

        pub fn terminate(&self) {
            self.job.terminate();
        }
    }

    #[cfg(windows)]
    struct JobObject(windows_sys::Win32::Foundation::HANDLE);

    #[cfg(windows)]
    impl JobObject {
        fn attach(child: &std::process::Child) -> Option<Self> {
            use std::os::windows::io::AsRawHandle;
            use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
            use windows_sys::Win32::System::JobObjects::{
                AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
                SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            };
            // La asignación es posterior a `spawn` (`spawn_with_attributes` con job
            // list no es estable en el toolchain mínimo). Un descendiente creado en
            // esa ventana mínima podría escapar; por eso, si la asignación falla, el
            // llamador mata al hijo (fail-closed). No se finge propiedad atómica.
            unsafe {
                let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                // Robusto ante la definición de HANDLE (puntero o entero).
                if job as usize == 0 {
                    return None;
                }
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let size = std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32;
                if SetInformationJobObject(
                    job,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const core::ffi::c_void,
                    size,
                ) == 0
                {
                    CloseHandle(job);
                    return None;
                }
                if AssignProcessToJobObject(job, child.as_raw_handle() as HANDLE) == 0 {
                    CloseHandle(job);
                    return None;
                }
                Some(Self(job))
            }
        }

        fn terminate(&self) {
            unsafe {
                windows_sys::Win32::System::JobObjects::TerminateJobObject(self.0, 1);
            }
        }
    }

    #[cfg(windows)]
    impl Drop for JobObject {
        fn drop(&mut self) {
            // Cerrar el job con KILL_ON_JOB_CLOSE mata lo que quede dentro.
            unsafe {
                windows_sys::Win32::Foundation::CloseHandle(self.0);
            }
        }
    }

    #[cfg(not(any(unix, windows)))]
    pub struct Containment;

    #[cfg(not(any(unix, windows)))]
    impl Containment {
        pub fn attach(_child: &std::process::Child) -> Result<Self, super::RunError> {
            Ok(Self)
        }

        pub fn terminate(&self) {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};
    use std::time::{Instant, SystemTime, UNIX_EPOCH};

    /// Variable de entorno que activa un modo del proceso hijo fixture. Sin ella
    /// el binario de test se comporta como siempre (la suite normal no la define).
    const FIXTURE_MODE_ENV: &str = "QUORB_CLI_PROCESS_FIXTURE_MODE";
    /// Clave canaria (no debe heredarse) y clave explícita (sí debe llegar).
    const CANARY_ENV: &str = "QUORB_CLI_PROCESS_CANARY";
    const GIVEN_ENV: &str = "QUORB_CLI_PROCESS_GIVEN";
    /// Fichero-marca donde el nieto escribe latidos para probar que muere.
    const MARKER_ENV: &str = "QUORB_CLI_PROCESS_GRANDCHILD_MARKER";
    /// Framing explícito: separa el payload real del preámbulo/resumen de libtest.
    const FRAME_BEGIN: &str = "<quorb-fixture>";
    const FRAME_END: &str = "</quorb-fixture>";
    /// Gracia mínima (sólo fixture de test) para que Windows asigne el Job Object
    /// antes de que un hijo de vida muy corta termine; no toca producción.
    const FIXTURE_STARTUP_GRACE: Duration = Duration::from_millis(150);
    /// Número de latidos del nieto (300 * 100 ms = 30 s) que el runner debe cortar.
    const GRANDCHILD_HEARTBEATS: u32 = 300;

    /// Binario nativo actual: el propio binario de test, portable en cualquier SO.
    fn fixture_program() -> PathBuf {
        std::env::current_exe().expect("ruta del binario de test actual")
    }

    /// Directorio de trabajo portable (directorio temporal del SO, no `/tmp`).
    fn fixture_cwd() -> PathBuf {
        std::env::temp_dir()
    }

    /// Nombre con el que libtest registra el test fixture. `module_path!()` incluye
    /// el crate; libtest lista el nombre sin ese primer segmento.
    fn fixture_test_name() -> String {
        let full = concat!(module_path!(), "::", "fixture_entry");
        full.split_once("::")
            .map(|(_, rest)| rest.to_string())
            .unwrap_or_else(|| full.to_string())
    }

    /// Argumentos para invocar el binario de test como hijo fixture concreto.
    fn fixture_child_args() -> Vec<String> {
        vec![
            fixture_test_name(),
            "--exact".to_string(),
            "--nocapture".to_string(),
        ]
    }

    /// Entorno mínimo explícito. En Windows el cargador necesita `SystemRoot`
    /// (y PATH/TEMP); en Unix no se depende de `/bin/sh` ni de shell alguno.
    fn base_env() -> BTreeMap<String, String> {
        let mut env = BTreeMap::new();
        #[cfg(windows)]
        {
            for key in ["SystemRoot", "PATH", "TEMP", "TMP"] {
                if let Ok(value) = std::env::var(key) {
                    env.insert(key.to_string(), value);
                }
            }
        }
        #[cfg(unix)]
        {
            env.insert("PATH".into(), "/usr/bin:/bin".into());
        }
        env
    }

    fn fixture_env(mode: &str) -> BTreeMap<String, String> {
        let mut env = base_env();
        env.insert(FIXTURE_MODE_ENV.to_string(), mode.to_string());
        env
    }

    fn run_fixture(mode: &str, timeout: Duration) -> (Result<CommandOutput, RunError>, Duration) {
        run_fixture_with_env(&fixture_env(mode), timeout)
    }

    fn run_fixture_with_env(
        env: &BTreeMap<String, String>,
        timeout: Duration,
    ) -> (Result<CommandOutput, RunError>, Duration) {
        let started = Instant::now();
        let result = ProcessRunner.run(
            &fixture_program(),
            &fixture_child_args(),
            env,
            &fixture_cwd(),
            timeout,
        );
        (result, started.elapsed())
    }

    fn emit(bytes: &[u8], to_stderr: bool) {
        use std::io::Write;
        if to_stderr {
            let mut stream = std::io::stderr().lock();
            let _ = stream.write_all(bytes);
            let _ = stream.flush();
        } else {
            let mut stream = std::io::stdout().lock();
            let _ = stream.write_all(bytes);
            let _ = stream.flush();
        }
    }

    fn framed(payload: &str) -> Vec<u8> {
        format!("{FRAME_BEGIN}{payload}{FRAME_END}").into_bytes()
    }

    fn assert_framed(stream: &str, payload: &str) {
        let expected = format!("{FRAME_BEGIN}{payload}{FRAME_END}");
        assert!(
            stream.contains(&expected),
            "payload con framing ausente: esperaba {expected:?} en {stream:?}"
        );
    }

    /// Contrato de portabilidad: el fixture es el binario de test nativo actual y
    /// su cwd es el directorio temporal del SO, nunca `/bin/sh` ni `/tmp`.
    #[test]
    fn fixture_child_program_is_native_current_exe() {
        let program = fixture_program();
        assert_eq!(program, std::env::current_exe().expect("exe actual"));
        assert!(!program.to_string_lossy().contains("/bin/sh"));
        assert_eq!(fixture_cwd(), std::env::temp_dir());
        let (result, _) = run_fixture("success", Duration::from_secs(5));
        assert!(result.is_ok(), "fixture nativo ejecutable: {result:?}");
    }

    /// Hijo controlado. Con `FIXTURE_MODE_ENV` ausente es NOOP (suite normal): no se
    /// hereda entorno ni argumentos más allá del mapa explícito del runner.
    #[test]
    fn fixture_entry() {
        let mode = match std::env::var(FIXTURE_MODE_ENV) {
            Ok(mode) => mode,
            Err(_) => return,
        };

        std::thread::sleep(FIXTURE_STARTUP_GRACE);

        match mode.as_str() {
            "success" => emit(&framed("hello"), false),
            "exit3" => {
                emit(&framed("boom"), true);
                std::process::exit(3);
            }
            "sleep" => std::thread::sleep(Duration::from_secs(30)),
            "flood" => {
                // > MAX_CAPTURE_BYTES en ambos streams: el runner debe acotar cada uno.
                let chunk = vec![b'a'; 64 * 1024];
                for _ in 0..4 {
                    emit(&chunk, false);
                    emit(&chunk, true);
                }
            }
            "grandchild" => fixture_spawn_grandchild(),
            "grandchild_writer" => fixture_grandchild_heartbeat(),
            "env_canary" => {
                let canary = std::env::var(CANARY_ENV).unwrap_or_else(|_| "<absent>".to_string());
                let given = std::env::var(GIVEN_ENV).unwrap_or_else(|_| "<absent>".to_string());
                emit(&framed(&format!("canary={canary};given={given}")), false);
            }
            other => panic!("modo fixture desconocido: {other}"),
        }
    }

    /// Lanza un nieto real (mismo binario, StdIO heredado) que retiene las tuberías,
    /// y no sale hasta comprobar que el nieto existe. No lo mata ni lo espera: el
    /// runner debe matar el árbol completo.
    fn fixture_spawn_grandchild() {
        let marker = std::env::var(MARKER_ENV).expect("marca del nieto");
        let mut cmd = std::process::Command::new(fixture_program());
        cmd.args(fixture_child_args())
            .env_clear()
            .envs(std::env::vars())
            .env(FIXTURE_MODE_ENV, "grandchild_writer")
            .env(MARKER_ENV, &marker);
        let child = cmd.spawn().expect("nieto lanzado");

        let deadline = Instant::now() + Duration::from_secs(5);
        while !Path::new(&marker).exists() {
            assert!(
                Instant::now() < deadline,
                "el nieto no llegó a arrancar de verdad"
            );
            std::thread::sleep(Duration::from_millis(5));
        }

        emit(&framed("done"), false);
        drop(child);
    }

    /// El nieto late cada 100 ms. Si el runner lo mata, los latidos cesan.
    fn fixture_grandchild_heartbeat() {
        use std::io::Write;
        let marker = std::env::var(MARKER_ENV).expect("marca del nieto");
        for _ in 0..GRANDCHILD_HEARTBEATS {
            if let Ok(mut file) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(&marker)
            {
                let _ = file.write_all(b".");
                let _ = file.flush();
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    }

    #[test]
    fn real_runner_captures_success_output() {
        let (result, elapsed) = run_fixture("success", Duration::from_secs(5));
        let out = result.expect("salida correcta");
        assert_eq!(out.code, 0);
        assert_framed(&out.stdout, "hello");
        assert!(elapsed < Duration::from_secs(3), "sin demora: {elapsed:?}");
    }

    #[test]
    fn real_runner_reports_nonzero_exit_and_stderr() {
        let (result, _) = run_fixture("exit3", Duration::from_secs(5));
        let out = result.expect("proceso terminado");
        assert_eq!(out.code, 3);
        assert_framed(&out.stderr, "boom");
    }

    #[test]
    fn real_runner_times_out_and_returns_within_bound() {
        let (result, elapsed) = run_fixture("sleep", Duration::from_millis(100));
        assert_eq!(result, Err(RunError::Timeout));
        assert!(
            elapsed < Duration::from_secs(2),
            "timeout acotado: {elapsed:?}"
        );
    }

    #[test]
    fn real_runner_caps_output_instead_of_growing_unbounded() {
        let (result, _) = run_fixture("flood", Duration::from_secs(10));
        let out = result.expect("proceso terminado");
        assert_eq!(out.stdout.len(), MAX_CAPTURE_BYTES, "stdout acotado");
        assert_eq!(out.stderr.len(), MAX_CAPTURE_BYTES, "stderr acotado");
    }

    #[test]
    fn real_runner_kills_the_tree_so_a_grandchild_cannot_hold_the_pipe() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("reloj")
            .as_nanos();
        let marker = std::env::temp_dir().join(format!(
            "quorb-fixture-grandchild-{}-{unique}",
            std::process::id()
        ));

        let mut env = fixture_env("grandchild");
        env.insert(MARKER_ENV.to_string(), marker.to_string_lossy().into_owned());

        let started = Instant::now();
        let result = ProcessRunner.run(
            &fixture_program(),
            &fixture_child_args(),
            &env,
            &fixture_cwd(),
            Duration::from_secs(10),
        );
        let elapsed = started.elapsed();
        let out = result.expect("proceso terminado");

        assert_eq!(out.code, 0);
        assert_framed(&out.stdout, "done");
        assert!(marker.exists(), "el nieto debió crearse de verdad");
        assert!(
            elapsed < Duration::from_secs(3),
            "sin cuelgue por el nieto: {elapsed:?}"
        );

        // Prueba de muerte real: si el nieto siguiera vivo escribiría más latidos
        // tras volver el runner (no basta con que el lector se desasocie).
        let before = std::fs::metadata(&marker).map(|m| m.len()).unwrap_or(0);
        std::thread::sleep(Duration::from_millis(500));
        let after = std::fs::metadata(&marker).map(|m| m.len()).unwrap_or(0);
        assert_eq!(after, before, "el nieto sigue vivo y escribiendo latidos");
    }

    #[test]
    fn real_runner_passes_only_the_given_environment() {
        std::env::set_var(CANARY_ENV, "leak");
        let mut env = fixture_env("env_canary");
        env.insert(GIVEN_ENV.to_string(), "explicit-ok".to_string());
        let result = ProcessRunner.run(
            &fixture_program(),
            &fixture_child_args(),
            &env,
            &fixture_cwd(),
            Duration::from_secs(5),
        );
        std::env::remove_var(CANARY_ENV);
        let out = result.expect("proceso terminado");
        assert_framed(&out.stdout, "canary=<absent>;given=explicit-ok");
        assert!(
            !out.stdout.contains("leak"),
            "no debe heredar el entorno del proceso: {:?}",
            out.stdout
        );
    }
}
