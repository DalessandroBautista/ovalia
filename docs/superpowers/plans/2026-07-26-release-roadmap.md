# Ovalia — Roadmap por releases (checklist viva)

Fecha: 2026-07-26
Reemplaza el orden lineal de hitos del plan maestro por **entregas verticales validables**.
El plan técnico (`2026-07-25-real-data-full-execution-plan.md`) sigue siendo el backlog
de detalle; este documento define **qué se publica y en qué orden**, y el **estado real**.

## Decisiones de producto adoptadas

- **Usuario inicial**: jugador/exjugador y seguidor de clubes URBA (Buenos Aires).
- **Métrica norte (North Star)**: usuarios semanales que consultan partidos de una
  fecha o de un equipo favorito.
- **Estrategia**: validar retención con una beta chica de URBA Top 14 antes de expandir
  cobertura, editorial e IA.
- **Reordenamiento clave vs plan maestro**:
  - Favoritos + alertas ANTES que el agente editorial IA.
  - Auth/prode individual en Release 2 (retención), no en el tronco temprano.
  - CMS manual antes que IA; la IA es acelerador del editor, no prioridad.
  - Expansión de cobertura (UAR, internacionales, idiomas, sponsors) al final.

## Estado global (al 2026-07-26)

`pnpm verify` verde con **116 tests**; `build` verde; audit de hardcodes limpio.
Hitos del plan maestro completados: **0, 1, 2, 3, 6**.

---

## Release 1 — Beta honesta de URBA Top 14  ← FOCO ACTUAL

Objetivo: primer producto publicable. Un seguidor de URBA entra y ve fixtures,
resultados y tabla reales, con fuente y frescura, sin controles ficticios.

| # | Ítem | Hito | Estado |
|---|---|---|---|
| 1 | Fuente URBA validada legal y técnicamente | 3.1 | ✅ hecho (`docs/data-sources/urba.md`) |
| 2 | CSV trazable de respaldo | 3.6 | ✅ hecho (`ingest:csv`, checksum+auditoría) |
| 3 | Fixtures/resultados/tabla completos en PostgreSQL | 3 | ✅ hecho (1182 partidos, tabla = fuente oficial) |
| 4 | Locks, retries y scheduler de ingestión | 2.3/2.4 | ✅ hecho (SKIP LOCKED, advisory lock, scheduler) |
| 5 | API sin `demo-data` | 6 | ✅ hecho (`demo-data.ts` eliminado) |
| 6 | Inicio conectado a datos reales | 7/9 | ⬜ pendiente |
| 7 | Agenda por rango + fecha en URL | 7 | ⬜ pendiente |
| 8 | Página de torneo (tabla, fixtures, resultados) | 8 | ⬜ pendiente |
| 9 | Detalle de partido desde DB (+overlay live) | 7 | ⬜ pendiente |
| 10 | Frescura y fuente visibles en UI | 7/8 | ⬜ pendiente |
| 11 | Sin controles ficticios (`href="#"`, botones muertos) | 14 | ⬜ pendiente (parcial) |
| 12 | Admin mínimo: importar y corregir conflictos | 13 (subset) | ⬜ pendiente |
| 13 | Analytics de navegación + canal de feedback | nuevo | ⬜ pendiente |
| 14 | SEO básico por partido/torneo | nuevo | ⬜ pendiente |
| 15 | 5–10 usuarios beta recurrentes | operativo | ⬜ pendiente |

**Definition of Done Release 1**: la agenda, el torneo Top 14 y el detalle leen de la
API real; cada dato muestra fuente/frescura; no hay controles ficticios en esas
pantallas; un editor puede importar (auto/CSV) y resolver conflictos; hay analytics y
un canal de feedback; corre localmente con un comando.

### Secuencia inmediata (lo que sigue ahora)

1. **Hito 7** — cliente API tipado en web + agenda por rango/URL + detalle real.
2. **Hito 8 (Top 14)** — página de torneo con tabla/fixtures reales y slug real.
3. **Hito 9 (parcial)** — agregados reales de inicio (sin countdown/nota falsos).
4. **Admin mínimo de conflictos** (subset de Hito 13): ver raw vs normalizado,
   asociar equipo, cerrar conflicto (los 40 de Tercera/Femenino).
5. **Analytics + feedback** (privacidad primero) y **SEO** por partido/torneo.
6. Quitar controles ficticios de las pantallas de Release 1.

---

## Release 2 — Retención

- Registro/login (Hito 10).
- Favoritos de equipos/competencias (nuevo).
- Alertas de inicio y resultado (nuevo).
- Prode individual persistido (Hito 11).
- Analytics de prode/favoritos y feedback in-product.

Prioridad: **favoritos y alertas antes que prode**, por su potencial de uso recurrente.

## Release 3 — Comunidad y competencia

- Rankings, grupos privados de prode (Hito 11 extendido).
- Perfil e historial, tarjetas compartibles, medallas/rachas.

## Release 4 — Editorial

- CMS manual completo (Hito 12 sin IA): drafts→review→published, portada configurable.
- Recién después: asistente IA como acelerador del editor.
- Nota: hoy `apps/worker/src/index.ts` solo inicializa OpenAI y loguea; la IA no es
  prioridad hasta que exista workflow editorial humano funcionando.

## Release 5 — Expansión de cobertura

- Más categorías URBA, UAR/interior (Hito 4), selecciones e internacionales (Hito 5).
- Idiomas adicionales (Hito 14), sponsors/publicidad.
- Se expande según búsquedas, favoritos y pedidos reales, no por inventario.

---

## Backlog transversal de producto (faltaba en el plan)

| Ítem | Estado | Nota |
|---|---|---|
| Definición de usuario inicial | ✅ definido arriba | jugador/exjugador URBA |
| Métrica norte | ✅ definida | usuarios semanales que ven fecha/equipo favorito |
| Métricas de calidad de datos | ⬜ | cobertura, exactitud, antigüedad, tiempo-hasta-corregir |
| Analytics (navegación/prode/favoritos/errores) | ⬜ | privacidad primero, sin PII innecesaria |
| Canal de feedback visible | ⬜ | Release 1 |
| SLA por fuente | ⬜ | cada cuánto actualiza, cuánto puede estar stale |
| Responsable operativo de datos (fin de semana) | ⬜ | rol humano |
| Registro de decisiones + checklist viva | ✅ este documento | mantener actualizado por hito |
| Criterios de abandono de competencia | ⬜ | cuándo pasa a manual o se deja de mostrar |
| Estrategia SEO por partido/torneo | ⬜ | tras contenido real |

## SLA de datos (borrador inicial, a confirmar con operador)

| Dato | Frecuencia objetivo | Stale máximo aceptable |
|---|---|---|
| Fixtures futuros | cada 6 h | 24 h |
| Resultados (día de partido) | cada 10 min en ventana | 1 h |
| Posiciones | tras cada resultado | 12 h |
| Catálogo/equipos | semanal | 7 d |

## Criterios de abandono (borrador)

- Una competencia pasa a **manual/CSV** si su fuente cambia formato o prohíbe
  automatización (con evidencia documentada).
- Se **oculta** (no se muestra vacía ni inventada) si no hay fuente ni carga manual
  sostenible y no está en el foco de la beta.
