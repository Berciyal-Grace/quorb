# Quorb

[English](README.md) · **Español**

Tira de anillos pegada al borde de la pantalla de Windows con el consumo de tus suscripciones de IA: **Claude (Pro/Max)**, **ChatGPT (Plus/Pro · Codex)**, **Gemini**, **Cursor**, **GitHub Copilot**, **NaN Builders**, **OpenRouter** y el gasto de las APIs de pago por uso de **Anthropic** y **OpenAI**.

Tauri 2 + React 19 + TypeScript. Ventana sin bordes, transparente, siempre encima y con icono en la bandeja.

## Requisitos (Windows)

1. **Rust**: <https://rustup.rs> (toolchain `stable-x86_64-pc-windows-msvc`)
2. **Microsoft C++ Build Tools** con «Desarrollo para escritorio con C++»
3. **WebView2** (ya viene con Windows 10/11)
4. **Node 22+**

Guía oficial: <https://v2.tauri.app/start/prerequisites/>

## Arrancar

```powershell
git clone https://github.com/egdev6/quorb
cd quorb
npm install
npm run app:dev      # desarrollo con hot reload
npm run app:build    # instalador .msi / .exe en src-tauri\target\release\bundle
```

Otros scripts: `npm test` (vitest), `npm run typecheck`, `cd src-tauri && cargo test`, `npm run bump x.y.z`.

## Uso

- **Actualizaciones automáticas** (Ajustes › Actualizaciones, activadas por defecto): al arrancar y cada 6 h se consulta la última release de GitHub. Si hay versión nueva, llega una notificación (una vez por versión) y aparece un icono de descarga en la tira; al pulsarlo se descarga, se verifica la firma, se instala y Quorb se reinicia. En Ajustes verás la versión actual, «Buscar ahora» y las notas de la versión.

- El widget es una **tira pegada a un borde de la pantalla** (arriba, abajo, izquierda o derecha) con un círculo por suscripción: solo anillos y logo, sin textos. En los laterales se pone en vertical. Anillo exterior (rojo) = ventana corta (sesión de 5 h); interiores (blanco y rosa) = semanales o por modelo. Un punto rojo avisa de que algo pasa del 90 %; uno ámbar, de que falta iniciar sesión o configurar.
- **Moverla**: arrastra desde el asa ⋮⋮. Mientras la arrastras flota; al soltar se pega al borde más cercano al punto donde la sueltas y recuerda borde, posición y monitor. También puedes elegir borde y posición en Ajustes. Respeta la barra de tareas.
- **Pasa el ratón por un círculo** y se despliega el panel con el detalle hacia el interior de la pantalla, alineado con ese círculo: barras del mismo color que cada anillo, porcentaje, hora de reinicio, gasto y avisos.
- A la derecha (o abajo, en vertical) de la tira: actualizar y ajustes.
- **Ritmo e historial** (desplegable dentro del panel): para cada límite, cuánto llevas frente al tiempo que ha pasado de la ventana (marca blanca), el ritmo (×) y la proyección o cuándo se agotaría. Debajo, el historial de los últimos 24 h / 7 / 30 días guardado en local y, en NaN, los tokens por día de tu dashboard.
- **Acciones del panel**: abrir la página de uso oficial, copiar un resumen y ocultar ese círculo (sigue consultándose y avisando; se recupera en Ajustes).
- **Reordenar**: arrastra un círculo a lo largo de la tira.
- **Atajos globales** (Ajustes › Atajos, funcionan sin foco): `Ctrl+Alt+U` mostrar/ocultar la tira, `Ctrl+Alt+I` abrir el detalle de la suscripción más cargada, `Ctrl+Alt+R` actualizar. Se cambian haciendo clic en el campo y pulsando la combinación; si otra app ya la usa, Ajustes te lo dice.
- **Ocultar automáticamente** (Ajustes, por defecto desactivado): queda una franja de 5 px en el borde; aparece al acercar el ratón o cuando hay un aviso.
- **Avisos en dos momentos**: (1) **al superar el límite** (umbral configurable, 90 % por defecto; una vez por ventana) y (2) **al reiniciarse** ese límite superado. Cada momento lanza notificación de Windows + un efecto a pantalla completa en una capa transparente que no captura el ratón: **confeti** (por defecto), **glow de peligro** en los bordes o un **efecto propio**: un vídeo WebM (VP9) con alfa o una imagen animada GIF/WebP/APNG, distinto para cada momento, en tamaño pequeño, mediano o pantalla completa y con sonido opcional. Botón «Probar» en Ajustes.
- **Bandeja**: clic izquierdo muestra u oculta; menú con «Actualizar ahora», «Ajustes…» y «Salir». El tooltip resume el % más alto de cada proveedor.
- **Tamaño** (Ajustes › General): deslizador de 32 a 80 px (por defecto 48). Se aplica al momento; la tira (asa, iconos, bordes) y el panel de detalle (ancho, textos, barras y padding) escalan con él. Por debajo de 40 px se muestran como mucho dos anillos para que el logo se siga viendo.
- **Color** (Ajustes › General): eliges el color base con las muestras o con el selector RGB libre; es el del anillo exterior y la primera barra. Los otros dos tonos (casi blanco y uno intermedio) se calculan solos, y si eliges un color demasiado oscuro para verse sobre negro se aclara lo justo. Afecta a anillos, barras, sus marcas de color y los brillos (glow de anillos y barras al 90 %, halo del círculo activo y borde al arrastrar); los avisos (porcentajes ≥ 70 %, punto rojo) siguen en rojo para que no pierdan su significado. Por defecto, el rojo egdev.
- **Círculos pequeños** (Ajustes): un solo anillo por suscripción, con el límite más cercano.
- **Logos** en `src/assets/logos/`: `claude.svg`, `openai.svg`, `nan.svg`, `gemini.svg`, `cursor.svg`, `microsoft-copilot.svg` (Copilot) y `openrouter.svg`. Claude y OpenAI se reutilizan para sus APIs, que llevan una etiqueta «API» bajo el logo. Cada SVG se inserta con sus `id` y clases prefijados para que no choquen entre sí. Si falta alguno, se muestra un monograma.
- **Ajustes › Proveedores en pestañas**: una rejilla de pestañas con logo, nombre y un punto de estado (verde = activo, ámbar = falta configurar o iniciar sesión, gris = desactivado). Al pulsar una se abre solo la configuración de ese proveedor; Ajustes recuerda la última pestaña abierta.
- Si un ciclo falla (red, 429…), se mantienen los últimos datos con la etiqueta `caché`.

## Cómo obtiene los datos cada proveedor

| Proveedor | Login | Fuente | Oficial |
|---|---|---|---|
| Claude Pro/Max | OAuth del CLI oficial (`claude` → `/login`) | `GET api.anthropic.com/api/oauth/usage` con la sesión de `~/.claude/.credentials.json` | ❌ No documentado |
| ChatGPT · Codex | OAuth del CLI oficial (`codex login`) | `GET chatgpt.com/backend-api/wham/usage` con la sesión de `~/.codex/auth.json` | ❌ No documentado |
| NaN Builders | Cuenta (enlace por correo, como `nan auth login --email`) o API key | Con cuenta: `cloud-api.nan.builders/api/usage/quota` y `/api/metrics/usage`, lo mismo que el dashboard. Con key: `/v1/usage` + cuotas publicadas | ⚠️ Panel no documentado / API oficial |
| Gemini (AI Pro / Code Assist) | Login de Google de Gemini CLI (`gemini`) | `cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota` con la sesión de `~/.gemini/oauth_creds.json` (cuotas diarias por modelo) | ❌ No documentado |
| Cursor | Sesión de la app de Cursor | `cursor.com/api/usage-summary` con el token de `state.vscdb` (solo lectura) | ❌ No documentado |
| GitHub Copilot | Token fine-grained (permiso «Plan»: lectura) | `GET /users/{usuario}/settings/billing/premium_request/usage` (peticiones premium del mes frente a la cuota de tu plan) | ✅ |
| OpenRouter | API key | `GET /api/v1/key` y `/api/v1/credits` (gasto del mes/día, límite de la key, saldo) | ✅ |
| Anthropic API | Admin API key | `GET /v1/organizations/cost_report` (gasto del mes) | ✅ |
| OpenAI API | Admin key | `GET /v1/organization/costs` (gasto del mes) | ✅ |

### Por qué no hay un «Login con Claude/OpenAI» propio

- **Anthropic** no permite registrar clientes OAuth de terceros: desde febrero de 2026 sus condiciones dicen que el OAuth de los planes Free/Pro/Max es exclusivo de Claude Code y Claude.ai. Por eso la app **no** se hace pasar por Claude Code: el login lo hace el CLI oficial y la app solo **lee** la sesión que este guarda para consultar el porcentaje de uso. Es una zona gris (lo mismo que hacen herramientas como `ccusage`), así que úsalo sabiendo que el endpoint puede cambiar o dejar de estar permitido.
- **OpenAI** tampoco ofrece OAuth público para Codex; mismo enfoque con `codex login`.
- Las **APIs de coste** (Anthropic y OpenAI) solo aceptan Admin keys, no OAuth.
- **Gemini**: el token de Google dura ~1 h. Si ha caducado, la app lo renueva **en memoria** con el refresh token y el cliente OAuth público de Gemini CLI (app instalada); no escribe en los ficheros de la CLI. Es la misma zona gris que con Claude.
- **Cursor**: se lee el token de la app de Cursor en solo lectura (o uno pegado a mano en Ajustes) y se consulta su endpoint interno.
- **NaN Builders**: la forma más completa es conectar la cuenta en Ajustes › NaN. Se usa el mismo acceso que la CLI oficial: NaN te manda un enlace de un solo uso, lo pegas (sin abrirlo) y la app guarda la cookie de sesión en el Administrador de credenciales. Con ella lee los mismos endpoints que tu dashboard (no documentados: pueden cambiar). Como alternativa, la API key usa el `/v1/usage` oficial; «Probar la API» enseña la respuesta en crudo.

### Tokens

- La app **nunca refresca** los tokens OAuth: hacerlo rotaría el refresh token y podría cerrar la sesión del CLI. Si caduca, el widget muestra «Iniciar sesión», que abre el CLI y este la renueva solo.
- Las API keys se guardan en el **Administrador de credenciales de Windows** (servicio `es.egdev.quorb`), nunca en disco ni en el frontend.
- La configuración (sin secretos) está en `%APPDATA%\es.egdev.quorb\config.json`.

### WSL

Si usas Claude Code o Codex dentro de WSL, pon la ruta en Ajustes, por ejemplo:

```
\\wsl.localhost\Ubuntu\home\TU_USUARIO\.claude\.credentials.json
\\wsl.localhost\Ubuntu\home\TU_USUARIO\.codex\auth.json
```

Y cambia el comando de login a `wsl claude` / `wsl codex login`.

> Si Codex está configurado para guardar credenciales en el llavero del sistema (`cli_auth_credentials_store = "keyring"`), no habrá `auth.json`: vuelve al modo fichero para que el widget pueda leerlo.

## Publicar una versión y actualizaciones automáticas

### Preparación (una sola vez)

Crea el repo en GitHub (`egdev6/quorb`) y, si tienes [GitHub CLI](https://cli.github.com/), inicia sesión con `gh auth login`. Después:

```powershell
npm install
npm run setup:signing
```

El script:

1. Genera la clave de firma en `%USERPROFILE%\.tauri\quorb.key` (te pide una contraseña; si ya existe, la reutiliza y nunca la sobrescribe). **Guarda una copia de la clave y su contraseña**: si la pierdes, las versiones instaladas no aceptarán actualizaciones firmadas con otra.
2. Pega la clave pública en `src-tauri/tauri.conf.json`.
3. Sube `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` como secretos del repo con `gh`. Sin `gh`, te dice dónde pegarlos a mano.
4. Mueve `docs/mover-a-.github` a `.github` (workflow de releases y plantillas de issues).

### Compilar el instalador en local

- `npm run app:build`: instalador `-setup.exe` y `.msi` **sin** los ficheros del updater. No necesita claves; sirve para probar.
- `npm run app:release`: igual, pero firma la actualización (necesita las dos variables `TAURI_SIGNING_PRIVATE_KEY*`). Es lo que hace el workflow de GitHub.

Los instaladores quedan en `src-tauri\target\release\bundle\nsis` y `\msi`.

### Cada versión

```powershell
npm run bump 0.2.0          # package.json (lo lee Tauri) y Cargo.toml
git commit -am "release v0.2.0"
git tag v0.2.0
git push --follow-tags
```

El workflow `.github/workflows/release.yml` pasa los tests, compila en Windows, firma, crea la release con el `-setup.exe`, el `.msi` y `latest.json`. Las apps instaladas leen `https://github.com/egdev6/quorb/releases/latest/download/latest.json` y se actualizan solas. Las notas de la release salen en Ajustes.

## Estructura

```
src/                       React (una build; cada ventana pinta su vista según su label)
  Widget.tsx               tira pegada al borde + panel al hover + arrastre con imán + avisos + auto-ocultar + reordenar
  Overlay.tsx              efectos a pantalla completa (confeti, glow, vídeo) en una ventana transparente
  Settings.tsx             ventana de ajustes
  components/              ProviderGauge + RingGauge (círculos de la tira), ProviderLogo, ProviderCard + MeterBar (panel al pasar el ratón)
  assets/logos/            logos de cada suscripción (los pones tú)
  lib/                     api, tipos, formato, dock, paleta, avisos (alerts.ts), ritmo (pace.ts), orden (order.ts), actualizaciones (updater.ts) + tests
src-tauri/
  src/lib.rs               ventanas, bandeja, comandos Tauri
  src/providers/           claude, codex, gemini, cursor, copilot, nan (+ nan_cloud), openrouter, anthropic_api, openai_api
  src/history.rs           historial local para gráficas y ritmo
  src/secrets.rs           Windows Credential Manager (keyring)
  src/config.rs            config persistente
  src/login.rs             abre el login OAuth del CLI en una terminal
  capabilities/default.json
```

### Añadir un proveedor

1. Crea `src-tauri/src/providers/<nombre>.rs` con `pub async fn fetch(...) -> UsageReport` (nunca devuelve `Err`: usa `report.fail(status, msg)`).
2. Añade su config en `config.rs` y su rama en `providers::fetch_all`.
3. Refleja los campos en `src/lib/types.ts` y añade la sección en `Settings.tsx`.

## Datos locales

- `%APPDATA%\es.egdev.quorb\config.json`: configuración.
- `%APPDATA%\es.egdev.quorb\history.json`: historial (30 días, un punto cada ~10 min por medidor).
- Administrador de credenciales de Windows: API keys y sesión de NaN.
- Si vienes de la versión llamada «egdev AI Usage» (`es.egdev.ai-usage`), la configuración, el historial y las claves se copian solos al nuevo nombre la primera vez que se abre.

## Pendiente / ideas

- Ventana de 4 h de GLM 5.3 (el panel de NaN expone `windowHours`, pero no el consumo dentro de la ventana).
- Modo «click-through» (que los clics atraviesen el widget).

## Licencia

[MIT](LICENSE) © Enrique Gómez Navarro ([@egdev6](https://github.com/egdev6))
