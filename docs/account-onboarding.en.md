# Connect and check accounts

[Español](./account-onboarding.md)

Button and status labels below use the app's current Spanish wording.

## Add another account

Quorb can check several accounts for the same provider. CLI accounts (Claude,
Codex and Gemini) use a separate session folder by default. If you choose a
custom folder, check that it does not point to your primary account's folder.

## Steps

1. Select the provider and click **+ Añadir cuenta** (add account).
2. Give the account a **name** to distinguish it in the widget.
3. Click **Guardar e iniciar sesión** (save and sign in), or **Iniciar sesión**
   (sign in) if it is already saved. Whenever saving is required, Quorb saves
   configuration **before** opening the CLI. If saving does not confirm that
   the account was persisted, login does not open; the save error is shown.
4. Sign in through the browser with the account you want to add, not your
   primary account. Use a private window if the primary account is already
   signed in.

## Check a primary or additional account

1. Open **Ajustes** (Settings), then select the provider and account to check.
2. In **Comprobación** (connection check), click **Guardar y comprobar** (save
   and check) if changes are pending, or **Comprobar ahora** (check now) if the
   configuration is already saved.
3. Read the account's result: **Funciona** (working), **Sin sesión** (no session)
   or the error message. A failed request does not prove that credentials are
   invalid; review the message and try again.

You can check an account even when it is hidden from the widget. You do not
need to show it to diagnose its connection in Settings; the request uses saved
configuration and does not change its visibility.

## CLI requirements

For Claude, Codex and Gemini, Quorb uses the official CLI login. If a CLI is
missing, Settings shows its installation command, but **Quorb does not install
anything for you**: copy the command and run it yourself.

- Claude Code (`claude`), Codex CLI (`codex`) and Gemini CLI (`gemini`).
- Quorb checks for them periodically and when the window regains focus.
- To connect Gemini in Quorb, choose **Login with Google** when prompted by the
  CLI: this integration reads the OAuth credentials saved by that flow.

## How the connection check works

The request uses **saved configuration**, not the form. Pending changes show a
warning and **Guardar y comprobar**; CLI login also needs pending configuration
to be saved first, because the CLI reads persisted settings. This includes
provider settings inherited by an additional account, such as its login command
or request URL.

- **Funciona** / **Sin sesión** comes from the provider usage request, not from
  the presence of a session file.
- OAuth handling and refresh depend on the provider. If the check asks you to
  renew the session, use **Volver a abrir el login** (reopen login); finding the
  file does not guarantee that access remains valid.

## If saving only partly succeeds

Configuration and **Arrancar con Windows** (start with Windows) are saved
separately:

| Message or situation | Meaning and next action |
| --- | --- |
| **Configuración no guardada: …** | Login requiring those changes does not open. Review the error and save again before connecting. The check does not validate the failed draft; it uses previously saved settings. |
| **Configuración guardada · Inicio con Windows no guardado: …** | Account configuration was saved, so login may open. Handle the Windows startup failure separately; that option was not confirmed. |
| **Inicio con Windows guardado · Configuración no guardada: …** | Startup was confirmed, but account settings were not updated. Login requiring that configuration remains blocked. |
| Save in progress | Wait for it to finish. Connect and save-to-check buttons are disabled meanwhile; a busy save is not confirmation. |

## What “Fichero de sesión encontrado” means

It only means Quorb sees the CLI's session file in the account folder
(`.credentials.json`, `auth.json` or `.gemini/oauth_creds.json`).

- It does **not** confirm valid authentication or a connected account.
- Check the actual status in **Comprobación** in Settings, or in the **widget**
  if the account is shown there; an expired session may still have its file.
- You can sign in again without deleting files.

## Session folder

Under **Avanzado · carpeta de sesión** (advanced session folder), you can choose
a custom folder. Quorb reads the session file inside it. If the widget asks for
renewal, use **Renovar sesión** (renew session) to open CLI login. A file being
present does not confirm valid access or the OAuth refresh state of each
provider.
