# EGDEV Foundation (copia temporal)

`egdev/tokens.css` y `egdev/components.css` son una copia del design system tal como sale del rediseño de Quorb en Claude Design (7 de octubre de 2026). Es el rediseño «en crudo»: la app ya usa las clases del DS (`eg-gauge`, `eg-module-card`, `eg-progress`, `eg-btn`, `eg-field`, `eg-menu`…), pero sin depender todavía del paquete.

Cuando exista el paquete de `egdev-design-system`:

1. Instálalo y cambia las dos importaciones de `src/main.tsx` por las del paquete (tokens y ui).
2. Borra esta carpeta.
3. En `src/theme.css` deja solo el acento del usuario y el layout propio; lo que el DS ya cubra, fuera.

No edites estos ficheros a mano: cualquier cambio de diseño va al DS.
