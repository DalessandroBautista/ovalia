# Hoja de ruta de funcionalidades inspiradas en Ovalados

Fecha: 2026-07-30

Este documento **secuencia** seis tramos de trabajo y define qué significa
terminar cada uno. No reemplaza a los planes de implementación: cada tramo tiene
—o tendrá— su propio plan con pasos de TDD, y el detalle de código vive ahí.

Tampoco reemplaza a `2026-07-26-release-roadmap.md`, que sigue siendo el
documento de releases. Este es un corte transversal de un pedido concreto.

## Origen

Del análisis de `ovalados.com` se tomaron cinco ideas: navegación lateral por
competencia, modal de partido, buscador de jugadores, foro de debate y simulador
de carrera. Se adopta la **estructura funcional**; no se copian la estética, la
paleta, el contenido ni el código. La identidad visual de Ovalia no cambia.

Dos verificaciones hechas sobre la fuente condicionan todo lo que sigue:

- La API pública de URBA **no expone formaciones**. Sus objetos de partido solo
  traen equipos, fecha, marcadores, bonus y referencias de video. Cualquier
  funcionalidad sobre jugadores requiere carga manual.
- La API pública de URBA **sí expone video por partido**, en los campos
  `video_club` y `video_tv`. No formaba parte del pedido y no se planifica acá,
  pero queda registrado como oportunidad disponible sin fuente nueva.

## Orden de ejecución

El orden lo eligió el responsable del producto: primero el valor deportivo, aun
sabiendo que tarda más en rendir.

| # | Tramo | Spec | Depende de | Estado |
|---|---|---|---|---|
| A | Explorador compartido | `2026-07-29-shared-rugby-explorer-design.md` | — | Implementado, falta verificar y confirmar |
| B | Modal de partido | `2026-07-30-match-modal-design.md` | A | Spec aprobado, plan escrito |
| C | Jugadores y formaciones | `2026-07-30-players-and-lineups-design.md` | B | Spec escrito |
| D | Buscador de jugadores | `2026-07-30-player-search-design.md` | C | Spec escrito |
| E | Foro por partido | `2026-07-30-match-forum-design.md` | Hito 10 (auth) | Spec escrito, **bloqueado** |
| F | Simulador de carrera | `2026-07-30-career-simulator-design.md` | — | Spec escrito |

A y B se ejecutan juntos: el plan
`2026-07-30-match-modal-implementation.md` los cubre.

F no depende de nada y puede adelantarse en cualquier momento si conviene
entregar algo visible mientras C avanza.

E no puede empezar hasta que exista autenticación. Las tablas `users`,
`sessions` y `accounts` ya están en el esquema, pero `apps/api/src/create-app.ts`
no expone ninguna ruta de sesión. Intentar E antes obliga a inventar un concepto
de usuario provisorio que después habría que reconciliar.

## Por qué los planes detallados se escriben de a uno

Un plan de implementación útil contiene el código real de cada paso y las firmas
exactas que consume de los tramos anteriores. Escribir hoy el plan detallado de
D exigiría inventar los nombres de las funciones que C todavía no definió, y el
de E exigiría inventar la forma de la sesión que el Hito 10 todavía no eligió.
Serían planes con huecos disfrazados de planes completos.

Por eso: **el plan detallado de cada tramo se escribe cuando arranca ese tramo**,
contra el código que existe en ese momento. Los specs, que fijan las decisiones de
diseño, ya están todos escritos y son estables.

## Restricciones globales

Valen para los seis tramos y se repiten en cada plan.

- TDD en toda regla o comportamiento (`AGENTS.md`). La prueba se escribe antes,
  se verifica que falle, y recién después se implementa.
- TypeScript estricto. Sin `any` ni aserciones que apaguen el verificador.
- `packages/domain` no depende de framework ni de base de datos. La lógica pura
  vive ahí y se prueba ahí.
- Toda mutación deportiva o editorial escribe en `audit_log`.
- Validación de entrada en el límite de cada proceso, con esquema en
  `apps/api/src/schemas.ts`.
- Sin secretos, sin contenido copiado, sin datos de menores.
- Los estados vacíos son honestos: se dice qué falta, nunca se afirma algo falso
  por ausencia de datos.
- Cada tramo cierra con `pnpm verify` y `pnpm build` en verde, y un commit
  enfocado. Usar `corepack pnpm`: `pnpm` no está en el PATH.

## Definición de terminado por tramo

**A — Explorador.** `pnpm verify` y `pnpm build` en verde; `/torneos` y
`/partidos` revisados en escritorio y mobile; el cambio confirmado en un commit.

**B — Modal.** Desde la agenda se abre un partido en modal con forma reciente,
enfrentamientos previos y posición en tabla; la URL refleja el partido abierto y
los controles del navegador lo cierran y reabren; un fallo del endpoint deja la
cabecera visible y degrada cada pestaña por separado.

**C — Formaciones.** Un editor carga el plantel de un partido pegando texto,
previsualiza el resultado, resuelve los jugadores ambiguos y confirma; la
confirmación queda auditada; la pestaña de formaciones aparece en el modal solo
en los partidos que tienen datos.

**D — Buscador.** Se busca por nombre y se llega a una ficha con los partidos en
los que el jugador figuró; la búsqueda se resuelve en PostgreSQL; la cobertura
parcial está advertida en la interfaz.

**E — Foro.** Cualquiera lee el debate de un partido sin sesión; publicar exige
cuenta; el límite de frecuencia se aplica en la API; la cola de denuncias se
resuelve desde el panel de administración con auditoría.

**F — Simulador.** Se juega una carrera completa hasta el retiro; la simulación
es determinística ante una semilla fija; «Camino al XV» sigue funcionando por su
cuenta y ofrece arrancar una carrera con el puesto ya elegido.

## Riesgo principal

C compromete trabajo humano recurrente —unos siete partidos por fecha en Top
14— y D no tiene valor sin él. Si esa carga no se sostiene, D queda como una
funcionalidad vacía que promete más de lo que entrega.

Mitigación: ejecutar C completo y sostener la carga durante al menos tres fechas
antes de empezar D. Si la carga no se sostuvo, D se pospone y no se pierde nada
más que el tiempo de C.
