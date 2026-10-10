# Añadir una cuenta adicional

Quorb puede consultar varias cuentas del mismo proveedor. Para las cuentas CLI
(Claude, Codex y Gemini), la sesión usa una carpeta independiente por defecto.
Comprueba la ruta si eliges una carpeta personalizada para no compartirla con la principal.

## Pasos

1. Elige el proveedor y pulsa **+ Añadir cuenta**.
2. Ponle un **nombre**: es el que verás en la tira junto al proveedor.
3. Pulsa **Guardar e iniciar sesión** (o **Iniciar sesión** si ya está guardada).
   Quorb guarda la config **antes** de abrir el CLI. Si el guardado no confirma
   que la cuenta quedó persistida, no abre el login; verás el error del guardado.
4. Entra en el navegador con la cuenta que quieres añadir, no con la principal.
   Si ya tienes la principal abierta, usa una ventana privada.

## Qué significa «Fichero de sesión encontrado»

Es solo eso: Quorb ve el fichero que deja el CLI en la carpeta de la cuenta
(`.credentials.json`, `auth.json` o `.gemini/oauth_creds.json`).

- **No** confirma que la sesión sea válida ni que la cuenta esté «conectada».
- Comprueba el estado real en el **widget**; una sesión caducada sigue teniendo
  su fichero.
- Puedes volver a iniciar sesión sin borrar nada.

## Carpeta de sesión

En **Avanzado · carpeta de sesión** puedes fijar una carpeta propia. Quorb lee el
fichero de sesión que haya dentro. Si el widget pide renovar la sesión, usa
**Renovar sesión** para abrir el login del CLI. La presencia del fichero no
confirma la validez del acceso ni el estado del refresco OAuth de cada proveedor.
