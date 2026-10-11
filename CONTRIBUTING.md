# Contributing / Contribuir

**English** · [Español](#español)

---

## English

Thanks for taking the time to improve Quorb. Issues and pull requests are welcome, especially new provider integrations.

### Before you start

Quorb currently targets Windows. You need Node 22+, Rust with the MSVC toolchain, Microsoft C++ Build Tools and WebView2. See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```powershell
git clone https://github.com/egdev6/quorb
cd quorb
npm install
npm run app:dev
```

The repository is private today, so cloning requires access.

### Commands

These are the scripts declared in `package.json`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Frontend development server |
| `npm run build` | Type-check and build the frontend |
| `npm run typecheck` | TypeScript checks |
| `npm test` | Vitest tests plus the release scripts' Node tests |
| `cd src-tauri; cargo test` | Rust tests |
| `npm run app:dev` | Run the desktop app with hot reload |
| `npm run app:build` | Build a local (unsigned) installer |

### Contributing with ODD

ODD work follows a maintainer-approved GitHub roadmap: milestones describe outcomes,
issues define accepted work, and the index links the current approved scope.
The official index has not been published/configured yet; ask the maintainer for
its link before choosing ODD work. README ideas are not an approved order.

1. Read the index, issue and current accepted revision. Check dependencies and readiness.
2. Choose open, unassigned work without overlapping PR or claim comments.
   Tasks assigned only to you are resumable, not free work. Check both issues and PR.
3. Communicate a clear start request. The assistant verifies your GitHub identity,
   adds you as assignee and checks the result before implementation. If you do not
   use an assistant, request assignment from the maintainer before starting.
4. If another contributor owns the work or assignment fails, coordinate explicitly.
   Do not remove others or assume reservation: GitHub assignments are not locks.
5. Follow accepted ODD phases and criteria. Propose scope changes for approval;
   changes to existing tasks are recorded as revision comments linked from the index.
6. Recheck scope, ownership and related PR before submitting. Include acceptance
   and real validation evidence in the PR template; merge is a separate decision.

Independent lower-priority work is allowed with a warning; blocked work needs
coordination. Bugs and small tasks without ODD use the usual contribution flow.
Browsing, planning or reviewing a PR does not assign it to you.

#### Optional assistant skill

The portable skill lives in [`.agents/skills/odd-contribute/`](./.agents/skills/odd-contribute/SKILL.md).
In Pi, open the checkout containing it, review/trust the project resources when
requested, then run `/reload` and `/skill:odd-contribute`. A natural-language
request such as “I want to contribute to an ODD issue in Quorb” can also select it.
Explicit invocation is more reliable; other agents can read the same contract.
No global skills are required for contributors. Without an assistant, follow the
steps above; the skill is guidance, not enforcement.

Maintainers can use their global `odd-roadmap-plan` and `odd-roadmap-continue`
skills to publish/review the roadmap. After publishing, replace the “not yet
published” status in both language sections with the canonical index link.
Refresh `/skill-registry:refresh` when available after changing project skills.
The `.atl/` skill index/cache is local and ignored by Git; it is not the official roadmap.

### Adding a provider

Each provider is a single Rust file in `src-tauri/src/providers/<name>.rs` that returns a `UsageReport` through `pub async fn fetch(<config>, http) -> UsageReport`. It never returns `Err`: report a failure on the report itself.

1. Create `src-tauri/src/providers/<name>.rs` with `pub async fn fetch(...) -> UsageReport`.
2. Add its configuration in `src-tauri/src/config.rs` and its branch in `providers::fetch_all`.
3. Mirror the fields in `src/lib/types.ts` and add its section in `src/Settings.tsx`.

### Pull requests

Run the checks that cover your change before opening a PR: `npm test`, `npm run typecheck` and `cd src-tauri; cargo test`. Keep the change focused on the provider or fix you are contributing.

### Installed Dev channel

**Quorb Dev is a separate installed app**, not `npm run app:dev` (hot reload).
Every push to `main` runs `.github/workflows/dev.yml`; a successful signed build
publishes a **prerelease** in this same repository. Production releases remain manual.

| | Quorb (stable) | Quorb Dev |
| --- | --- | --- |
| App / executable | `Quorb` / `quorb.exe` | `Quorb Dev` / `quorb-dev.exe` |
| App identifier / credential service | `es.egdev.quorb` | `es.egdev.quorb.dev` |
| App data on Windows | `%APPDATA%\es.egdev.quorb` | `%APPDATA%\es.egdev.quorb.dev` |
| Managed accounts and CLI tools | `%USERPROFILE%\.quorb` | `%USERPROFILE%\.quorb-dev` |
| Update feed | Latest stable release | `dev-latest/latest.json` |

**To install:** open [Releases](https://github.com/egdev6/quorb/releases), choose
an immutable `dev-<run-id>-<attempt>` prerelease and install its **Quorb Dev**
`.exe` (NSIS) or `.msi`. Both apps can coexist. The `dev-latest` release contains
only the rolling update manifest, not an installer. Dev shows its own name in
Settings and the tray. Its global shortcuts and default Claude/Codex providers
start disabled; configure accounts separately. Additional CLI accounts and
managed Codex installations use Dev's own folder. Explicit custom session folders
and primary providers' external CLI/app sessions can still be shared by choice;
use additional accounts with the default Dev folder to keep logins separate.

**Private-repository limitation:** you can download the first installer while
signed into GitHub, but the installed updater cannot authenticate to a private
repository. Automatic checks/downloads become usable only after the owner makes
the repository public. This change does not change visibility or embed a token.
With public access, checks run on startup and every six hours, or through
Settings → Updates → Check now; install the offered update through the existing UI.
It does not silently install every commit.

Maintainers: Dev reuses the existing updater public key and the repository's
`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Without a
valid signing key, publication fails; signatures are never bypassed. Installer
Authenticode signing is still not configured (Windows may show SmartScreen).
Versions are derived from the workflow build number as `0.<n / 65536 floor>.<n % 65536>`
(with Windows version bounds); they are independent of stable version bumps.
The overlay is generated in ignored `.dev-build/`, never committed into the
production manifests. Do not reset the workflow's build-number history.

Each build uses an immutable tag and asset URLs. Only feed publication is
serialized; older/rerun builds cannot move it backwards. Pending feed jobs may be
superseded by GitHub's concurrency queue, while each push keeps its build job.
A failed build does not advance the feed. Tests run on Linux (including the
POSIX-only signing-setup fixtures), with frontend/Dev helper tests and both Rust
identities also checked on Windows. Stable `release.yml` is unchanged.

Merging enables this workflow on subsequent `main` pushes. Before relying on it,
check a successful Windows run and test coexistence, separate autostart entries,
uninstall, and a signed update between two Dev builds on a real PC. No remote
workflow, release, secret or visibility change is performed by local preparation.

### Releasing (maintainers)

Version bumping uses the existing script:

```powershell
npm run bump 0.2.0
```

That updates `package.json`, `package-lock.json`, `src-tauri/Cargo.toml` and the
`quorb` entry in `src-tauri/Cargo.lock`. It does not create tags: review the diff,
open the preparation PR and release through the manual workflow.

Builds:

- `npm run app:build` builds an unsigned local installer and needs no keys.
- `npm run app:release` builds a signed update and needs signing credentials.

**Sensitive operation — code signing.** Signing keys must never be committed or shared. The one-time setup is:

```powershell
npm run setup:signing
```

That script generates the signing key in `%USERPROFILE%\.tauri\quorb.key` (it never overwrites an existing key), writes the public key to `src-tauri/tauri.conf.json` and, if GitHub CLI is authenticated, uploads `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as repository secrets. Keep a backup of the private key and its password: if they are lost, installed versions will not accept updates signed with a different key.

**Production release workflow status.** The production workflow is `.github/workflows/release.yml`. It never triggers on tags or pushes: a maintainer starts it manually from the Actions tab on `main`, passing the stable `version` and the full 40-character `source_sha` of an already-merged commit. It validates the inputs, manifest versions, notes file, tag collision and updater public key, then runs the tests, builds on Windows and creates a **draft** release that you publish yourself. Signing secrets are only exposed in the signing/bundle step. Until the owner provisions the updater key and the repository secrets, treat the release as blocked, not automated.

---

## Español

Gracias por dedicar tiempo a mejorar Quorb. Se aceptan issues y pull requests, especialmente nuevas integraciones de proveedores.

### Antes de empezar

Quorb está dirigido actualmente a Windows. Necesitáis Node 22+, Rust con el toolchain MSVC, Microsoft C++ Build Tools y WebView2. Consultad los [requisitos de Tauri](https://v2.tauri.app/start/prerequisites/).

```powershell
git clone https://github.com/egdev6/quorb
cd quorb
npm install
npm run app:dev
```

El repositorio es privado actualmente, así que clonarlo requiere acceso.

### Comandos

Estos son los scripts declarados en `package.json`:

| Comando | Función |
| --- | --- |
| `npm run dev` | Servidor de desarrollo del frontend |
| `npm run build` | Comprobar tipos y compilar el frontend |
| `npm run typecheck` | Comprobar TypeScript |
| `npm test` | Tests de Vitest y tests Node de los scripts de release |
| `cd src-tauri; cargo test` | Tests de Rust |
| `npm run app:dev` | Ejecutar la app de escritorio con hot reload |
| `npm run app:build` | Compilar un instalador local (sin firma) |

### Contribuir con ODD

El trabajo ODD sigue un roadmap aprobado por el mantenedor en GitHub: los
milestones describen resultados, las issues definen trabajo aceptado y el índice
enlaza el alcance vigente. El índice oficial aún no se ha publicado/configurado;
pide su enlace antes de elegir trabajo ODD. Las ideas del README no son un orden aprobado.

1. Lee el índice, la issue y su revisión aceptada. Comprueba dependencias y preparación.
2. Elige trabajo abierto, sin asignar y sin PR o comentarios de toma solapados.
   Lo asignado solo a ti se puede retomar, pero no está libre. Revisa issues y PR.
3. Comunica claramente que empiezas. El asistente verifica tu identidad de GitHub,
   te añade como assignee y comprueba el resultado antes de implementar. Si no
   usas asistente, solicita la asignación al mantenedor antes de empezar.
4. Si otra persona lo lleva o falla la asignación, coordina explícitamente.
   No retires responsables ni supongas reserva: las asignaciones no son bloqueos.
5. Sigue fases y criterios ODD aceptados. Propón cambios de alcance para aprobación;
   los de tareas existentes quedan como comentarios de revisión enlazados desde el índice.
6. Revisa alcance, responsables y PR relacionadas antes de entregar. Incluye aceptación
   y evidencia real de validación en la plantilla de PR; el merge es otra decisión.

Se permite trabajo independiente de menor prioridad con un aviso; lo bloqueado
requiere coordinación. Los bugs y tareas pequeñas sin ODD siguen el flujo habitual.
Consultar, planificar o revisar una PR no te la asigna.

#### Skill opcional para asistentes

La skill portable vive en [`.agents/skills/odd-contribute/`](./.agents/skills/odd-contribute/SKILL.md).
En Pi, abre el checkout que la contiene, revisa/acepta los recursos del proyecto
cuando lo solicite y ejecuta `/reload` y `/skill:odd-contribute`. También puede
activarse con «quiero contribuir a una issue ODD en Quorb».
El comando explícito es más fiable; otros agentes pueden leer el mismo contrato.
Los colaboradores no necesitan skills globales. Sin asistente, sigue los pasos
anteriores; la skill orienta, no garantiza cumplimiento.

El mantenedor puede usar sus globales `odd-roadmap-plan` y `odd-roadmap-continue`
para publicar/revisar el roadmap. Después de publicarlo, sustituye el estado
«aún no publicado» de ambos idiomas por el enlace canónico del índice.
Refresca `/skill-registry:refresh` cuando esté disponible tras cambiar las skills.
El índice/caché de skills en `.atl/` es local y Git lo ignora; no es el roadmap oficial.

### Añadir un proveedor

Cada proveedor es un solo archivo Rust en `src-tauri/src/providers/<nombre>.rs` que devuelve un `UsageReport` mediante `pub async fn fetch(<config>, http) -> UsageReport`. Nunca devuelve `Err`: el fallo se refleja en el propio informe.

1. Cread `src-tauri/src/providers/<nombre>.rs` con `pub async fn fetch(...) -> UsageReport`.
2. Añadid su configuración en `src-tauri/src/config.rs` y su rama en `providers::fetch_all`.
3. Reflejad los campos en `src/lib/types.ts` y añadid su sección en `src/Settings.tsx`.

### Pull requests

Ejecutad las comprobaciones que cubran vuestro cambio antes de abrir una PR: `npm test`, `npm run typecheck` y `cd src-tauri; cargo test`. Mantened el cambio centrado en el proveedor o la corrección que aportáis.

### Canal Dev instalado

**Quorb Dev es una app instalada independiente**, no `npm run app:dev` (hot reload).
Cada push a `main` ejecuta `.github/workflows/dev.yml`; una build firmada correcta
publica una **prerelease** en este mismo repositorio. Producción sigue siendo manual.

| | Quorb (estable) | Quorb Dev |
| --- | --- | --- |
| App / ejecutable | `Quorb` / `quorb.exe` | `Quorb Dev` / `quorb-dev.exe` |
| Identificador / servicio de credenciales | `es.egdev.quorb` | `es.egdev.quorb.dev` |
| Datos en Windows | `%APPDATA%\es.egdev.quorb` | `%APPDATA%\es.egdev.quorb.dev` |
| Cuentas y CLI gestionados | `%USERPROFILE%\.quorb` | `%USERPROFILE%\.quorb-dev` |
| Feed de actualizaciones | Última release estable | `dev-latest/latest.json` |

**Para instalar:** abre [Releases](https://github.com/egdev6/quorb/releases), elige
una prerelease inmutable `dev-<run-id>-<intento>` e instala su **Quorb Dev**
`.exe` (NSIS) o `.msi`. Ambas apps pueden convivir. La release `dev-latest`
contiene solo el manifiesto de actualización, no un instalador. Dev muestra su
nombre en Ajustes y la bandeja. Sus atajos globales y proveedores principales
Claude/Codex empiezan desactivados; configura las cuentas por separado. Las cuentas
CLI adicionales y la instalación gestionada de Codex usan la carpeta propia de Dev.
Las carpetas de sesión personalizadas y las sesiones externas de los CLI/apps de
las cuentas principales pueden compartirse por elección; usa cuentas adicionales
con la carpeta Dev por defecto si quieres separar también los logins.

**Limitación del repositorio privado:** puedes descargar el primer instalador
con tu sesión de GitHub, pero el updater instalado no se autentica en repositorios
privados. Las comprobaciones/descargas automáticas funcionarán cuando el owner
haga público el repositorio. Este cambio no modifica la visibilidad ni incluye tokens.
Con acceso público, busca al arrancar y cada seis horas, o mediante
Ajustes → Actualizaciones → Buscar ahora; instala la actualización ofrecida desde
la interfaz existente. No instala silenciosamente cada commit.

Mantenedores: Dev reutiliza la clave pública del updater y los secretos existentes
`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Sin una clave
válida falla la publicación; nunca se omite la firma. La firma Authenticode del
instalador sigue sin configurar (Windows puede mostrar SmartScreen).
Las versiones salen del número de build del workflow: `0.<n / 65536 entero>.<n % 65536>`
(con límites de Windows), independientes de los bumps estables. El overlay se
genera en `.dev-build/`, ignorado por Git; no se sube a los manifiestos de producción.
No reinicies el historial de números de build del workflow.

Cada build tiene tag y URLs de assets inmutables. Solo se serializa la publicación
del feed; builds antiguas/reintentos no pueden retrocederlo. GitHub puede sustituir
jobs de feed pendientes en su cola, pero cada push conserva su job de compilación.
Una build fallida no avanza el feed. Los tests completos corren en Linux (incluidos
los fixtures POSIX de preparación de firma); frontend/helpers Dev y ambas identidades
Rust se comprueban también en Windows. `release.yml` estable queda intacto.

Al integrar esto, los siguientes pushes a `main` activan el workflow. Antes de
fiarte del canal, comprueba una ejecución Windows correcta y prueba convivencia,
autoarranque independiente, desinstalación y actualización firmada entre dos
builds Dev en un PC real. La preparación local no ejecuta workflows ni cambia
releases, secretos o visibilidad remotos.

### Publicar (mantenedores)

El cambio de versión usa el script existente:

```powershell
npm run bump 0.2.0
```

Actualiza `package.json`, `package-lock.json`, `src-tauri/Cargo.toml` y la entrada
`quorb` de `src-tauri/Cargo.lock`. No crea tags: revisa el diff, abre la PR de
preparación y publica con el workflow manual.

Compilaciones:

- `npm run app:build` compila un instalador local sin firma y no necesita claves.
- `npm run app:release` compila una actualización firmada y necesita credenciales de firma.

**Operación sensible — firma de código.** Las claves de firma nunca deben subirse al repositorio ni compartirse. La preparación (una sola vez) es:

```powershell
npm run setup:signing
```

Ese script genera la clave de firma en `%USERPROFILE%\.tauri\quorb.key` (nunca sobrescribe una clave existente), escribe la clave pública en `src-tauri/tauri.conf.json` y, si GitHub CLI tiene sesión iniciada, sube `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` como secretos del repositorio. Guardad una copia de la clave privada y su contraseña: si se pierden, las versiones instaladas no aceptarán actualizaciones firmadas con otra clave.

**Estado del workflow de producción.** El workflow de producción es `.github/workflows/release.yml`. No se dispara con tags ni pushes: un mantenedor lo inicia a mano desde la pestaña Actions sobre `main`, indicando la `version` estable y el `source_sha` completo de 40 caracteres de un commit ya fusionado. Valida los inputs, las versiones de los manifiestos, las notas, la colisión de tag y la clave pública del updater; después pasa los tests, compila en Windows y crea un **borrador** de release que publicas tú. Los secretos de firma solo se exponen en el paso de firma/empaquetado. Hasta que el owner aprovisione la clave y los secretos del repositorio, considera la release bloqueada, no automática.

<!-- egdev:contact:start -->
## Contact

<div align="center">

[![Web](https://img.shields.io/badge/egdev.es-FF0036?style=for-the-badge&logo=googlechrome&logoColor=white)](https://egdev.es)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/egdev6)
[![Gmail](https://img.shields.io/badge/Gmail-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:egdev6@gmail.com)

</div>
<!-- egdev:contact:end -->
