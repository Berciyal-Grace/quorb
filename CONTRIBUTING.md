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
| `npm test` | Vitest tests |
| `cd src-tauri; cargo test` | Rust tests |
| `npm run app:dev` | Run the desktop app with hot reload |
| `npm run app:build` | Build a local (unsigned) installer |

### Adding a provider

Each provider is a single Rust file in `src-tauri/src/providers/<name>.rs` that returns a `UsageReport` through `pub async fn fetch(<config>, http) -> UsageReport`. It never returns `Err`: report a failure on the report itself.

1. Create `src-tauri/src/providers/<name>.rs` with `pub async fn fetch(...) -> UsageReport`.
2. Add its configuration in `src-tauri/src/config.rs` and its branch in `providers::fetch_all`.
3. Mirror the fields in `src/lib/types.ts` and add its section in `src/Settings.tsx`.

### Pull requests

Run the checks that cover your change before opening a PR: `npm test`, `npm run typecheck` and `cd src-tauri; cargo test`. Keep the change focused on the provider or fix you are contributing.

### Releasing (maintainers)

Version bumping uses the existing script:

```powershell
npm run bump 0.2.0
```

Builds:

- `npm run app:build` builds an unsigned local installer and needs no keys.
- `npm run app:release` builds a signed update and needs signing credentials.

**Sensitive operation — code signing.** Signing keys must never be committed or shared. The one-time setup is:

```powershell
npm run setup:signing
```

That script generates the signing key in `%USERPROFILE%\.tauri\quorb.key` (it never overwrites an existing key), writes the public key to `src-tauri/tauri.conf.json` and, if GitHub CLI is authenticated, uploads `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as repository secrets. Keep a backup of the private key and its password: if they are lost, installed versions will not accept updates signed with a different key.

**Release workflow status.** The release workflow lives at `docs/mover-a-.github/workflows/release.yml` in this repository, together with the issue templates. It is not active in that location: it only runs once that folder is moved to `.github`. Do not assume automated releases are active today. When active, it runs on a `v*` tag, runs the tests, builds on Windows, signs the update and publishes the installers with `latest.json`.

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
| `npm test` | Tests de Vitest |
| `cd src-tauri; cargo test` | Tests de Rust |
| `npm run app:dev` | Ejecutar la app de escritorio con hot reload |
| `npm run app:build` | Compilar un instalador local (sin firma) |

### Añadir un proveedor

Cada proveedor es un solo archivo Rust en `src-tauri/src/providers/<nombre>.rs` que devuelve un `UsageReport` mediante `pub async fn fetch(<config>, http) -> UsageReport`. Nunca devuelve `Err`: el fallo se refleja en el propio informe.

1. Cread `src-tauri/src/providers/<nombre>.rs` con `pub async fn fetch(...) -> UsageReport`.
2. Añadid su configuración en `src-tauri/src/config.rs` y su rama en `providers::fetch_all`.
3. Reflejad los campos en `src/lib/types.ts` y añadid su sección en `src/Settings.tsx`.

### Pull requests

Ejecutad las comprobaciones que cubran vuestro cambio antes de abrir una PR: `npm test`, `npm run typecheck` y `cd src-tauri; cargo test`. Mantened el cambio centrado en el proveedor o la corrección que aportáis.

### Publicar (mantenedores)

El cambio de versión usa el script existente:

```powershell
npm run bump 0.2.0
```

Compilaciones:

- `npm run app:build` compila un instalador local sin firma y no necesita claves.
- `npm run app:release` compila una actualización firmada y necesita credenciales de firma.

**Operación sensible — firma de código.** Las claves de firma nunca deben subirse al repositorio ni compartirse. La preparación (una sola vez) es:

```powershell
npm run setup:signing
```

Ese script genera la clave de firma en `%USERPROFILE%\.tauri\quorb.key` (nunca sobrescribe una clave existente), escribe la clave pública en `src-tauri/tauri.conf.json` y, si GitHub CLI tiene sesión iniciada, sube `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` como secretos del repositorio. Guardad una copia de la clave privada y su contraseña: si se pierden, las versiones instaladas no aceptarán actualizaciones firmadas con otra clave.

**Estado del workflow de release.** El workflow de release está en `docs/mover-a-.github/workflows/release.yml` en este repositorio, junto con las plantillas de issues. No está activo en esa ubicación: solo se ejecuta cuando se mueve esa carpeta a `.github`. No presupongáis que las releases automáticas están activas hoy. Cuando esté activo, se ejecuta con un tag `v*`, pasa los tests, compila en Windows, firma la actualización y publica los instaladores con `latest.json`.

<!-- egdev:contact:start -->
## Contact

<div align="center">

[![Web](https://img.shields.io/badge/egdev.es-FF0036?style=for-the-badge&logo=googlechrome&logoColor=white)](https://egdev.es)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/egdev6)
[![Gmail](https://img.shields.io/badge/Gmail-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:egdev6@gmail.com)

</div>
<!-- egdev:contact:end -->
