---
name: odd-contribute
description: "Trigger: contribuir con ODD en Quorb, quiero contribuir, trabajar en una issue ODD, retomar una PR ODD. Consulta el roadmap, verifica disponibilidad y coordina asignación, ejecución y entrega."
license: MIT
metadata:
  author: egdev6
  version: "1.0"
---

## Activation Contract

Actívate para contribuir a Quorb mediante ODD. Lee el workflow y CONTRIBUTING antes de actuar. Aclara peticiones ambiguas; deja bugs y tareas sin ODD en el flujo habitual.

## Hard Rules

- Consulta GitHub vigente; no inventes roadmap, prioridades, aceptación ni identidad.
- Recomienda nuevas issues/PR sin assignees ni trabajo solapado; ofrece las propias aparte.
- Asigna solo al inicio explícito y tras verificar usuario, elegibilidad y permisos; añade, no reemplaces.
- Confirma la asignación leyendo GitHub antes de implementar; ante conflictos coordina sin quitar responsables.
- Propón cambios de alcance al mantenedor; no reordenes el roadmap ni publiques revisiones sin aprobación.
- No ejecutes entrega, firma, secretos, releases o cambios de visibilidad por aprobar ODD.

## Decision Gates

| Situación | Acción |
| --- | --- |
| Sin señal ODD | Usa contribución habitual; no fuerces este flujo. |
| Sin índice vigente o alcance aprobado | Pide planificación al mantenedor; no inventes trabajo listo. |
| Issue/PR asignada a terceros o PR solapada | Avisa; ofrece coordinación o alternativas. |
| Asignada solo al mismo usuario | Ofrece reanudación, no trabajo libre. |
| Identidad/permisos/asignación inciertos | Pausa; no declares reserva ni implementes automáticamente. |
| Menor prioridad pero independiente | Avisa y permite elegir. |

## Execution Steps

1. Confirma target, fuentes canónicas vigentes y usuario; pagina la lectura necesaria.
2. Verifica dependencias, aceptación, assignees, comentarios de toma y PR relacionadas.
3. Explica recomendación y avisos; distingue consulta, selección e inicio.
4. Al inicio explícito, revalida, añade assignee y verifica según el workflow.
5. Reutiliza ODD aprobado; ejecuta por fases con comprobaciones aplicables y sin ampliar alcance.
6. Antes de PR, revalida; presenta evidencia y propone entrega. Abrir PR requiere autorización; asigna la PR autorizada al contribuidor y verifica.

## Output Contract

Devuelve issue/PR y fuentes, prioridad, disponibilidad, login/asignación verificados, ODD, comprobaciones, bloqueos y siguiente paso. No declares integración ni publicación pendientes como completadas.

## References

- [Workflow local](references/workflow.md)
- [Guía de contribución](../../../CONTRIBUTING.md)
- [Casos de validación](references/validation-cases.md)
