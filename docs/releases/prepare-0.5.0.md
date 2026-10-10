# Preparación de Quorb 0.5.0

## Estado

**Preparación local; no lista para ejecutar el workflow.**

- Repositorio: `egdev6/quorb`.
- Última estable observada: `v0.4.0`; fuente de esa release:
  `20ef9f407d09aa732328d16721ca1044401ec9ec`.
- Base de esta preparación: `fe52b9de5e107be6024e83dcaf54682d0c8b2f4a`,
  merge del PR #59 en `main`.
- El árbol de la base coincide con el código Codex completo revisado:
  `f7a2d9630b3dfbd9d15cbc5c74799f6822e87aee`.
- Rama de preparación: `chore/release-0.5.0`. El SHA final de publicación
  solo se obtendrá tras entregar y fusionar su preparación.
- Notas: [v0.5.0.md](./v0.5.0.md), español e inglés.

## Alcance

Esta preparación actualiza únicamente las versiones acopladas y las notas.
No modifica el instalador de Codex, los workflows, la firma, las credenciales,
el actualizador ni los README. No incorpora limpieza al desinstalar.

| Fuente | Versión preparada |
| --- | --- |
| `package.json` | `0.5.0` |
| `package-lock.json`, raíz y paquete raíz | `0.5.0` |
| `src-tauri/Cargo.toml`, `[package]` | `0.5.0` |
| `src-tauri/Cargo.lock`, paquete `quorb` | `0.5.0` |
| `src-tauri/tauri.conf.json` | Hereda `../package.json`; no se modifica |

No se renuevan dependencias: se utiliza `node scripts/bump.mjs 0.5.0`.
Para metadatos y notas no hay un cambio de comportamiento que requiera RED;
se utilizan los tests existentes y comprobaciones estructurales.

## Requisitos e infraestructura

| Requisito | Ámbito | Evidencia / estado |
| --- | --- | --- |
| Herramientas de preparación | Local | Se reutilizan dependencias y caché existentes; sin instalaciones ni sondas de Node/npm/Codex |
| Pruebas y build | Local Linux | 198 Vitest + 46 Node + 94 Rust aprobados; build con TypeScript y Vite aprobado |
| Workflow `Release` | GitHub / Windows | Activo en `.github/workflows/release.yml`; solo `workflow_dispatch` desde `main` |
| Node / Rust del runner | Windows CI | Node 22 y Rust estable declarados; su ejecución futura no está acreditada aquí |
| Firma del updater | GitHub | Nombres `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` presentes; no se leen valores ni se acredita la firma futura |
| Clave pública y artefactos | Repositorio | Clave pública configurada; overlay de release habilita artefactos del updater |
| Colisión de versión | GitHub | Sin tag ni release `v0.5.0` en la consulta de preparación; revalidar antes de entrega/ejecución |
| Issue/PR de preparación | GitHub | No se encontraron duplicados de 0.5.0; creación y etiquetas protegidas pendientes de autorización |
| Instalación y login reales | Windows del propietario | Pendientes de confirmación; no sustituidos por tests de código |

No se modifica la infraestructura existente ni se configuran secretos,
certificados, herramientas globales o permisos. La firma del updater no es
Authenticode. El repositorio privado no permite prometer descarga anónima del
manifest de actualización.

## Comprobaciones

- [x] 338 tests: 198 Vitest, 46 Node y 94 Rust; build aprobado (86 módulos).
- [x] Cinco valores de versión coherentes, sin cambios de dependencias.
- [x] Runtime, workflows y README intactos frente a la base.
- [x] Tres enlaces locales verificados; notas bilingües sin acreditar pruebas Windows.
- [ ] Revisión humana del PR de preparación terminada.
- [ ] Issue aprobada y PR de preparación entregados y fusionados.
- [ ] Preflight real sobre el SHA final ya perteneciente a `origin/main`.

Una simulación del preflight sobre el árbol de trabajo no acredita la pertenencia
al historial de `main`, ni permite utilizar el SHA base con la versión 0.5.0.

## Próximo paso manual

Antes de ejecutar nada, entregar y fusionar la preparación con autorización,
confirmar el SHA final, los requisitos y las comprobaciones pendientes.

El workflow existente es **Actions → Release**, ref **`main`**, con inputs
`version=0.5.0` y `source_sha=<SHA completo de la preparación fusionada>`.
No se proporciona un SHA ejecutable hasta verificar ese merge.
El workflow compila y firma en Windows y crea un **borrador** de release;
la publicación posterior corresponde al propietario.

No se ha ejecutado ningún workflow, creado tag ni publicado release.
