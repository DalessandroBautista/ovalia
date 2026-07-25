# Inventario de datos hardcodeados — plan de datos reales

Fecha de escaneo: 2026-07-25
Baseline: commit `8faa30d`, rama `feat/real-data-platform`.
Fuente de verdad de destino: PostgreSQL vía API de Ovalia.

Clasificación: `operativo` (prohibido en prod), `editorial` (prohibido),
`configuracion` (permitido si se parametriza), `test` (permitido en carpetas de test),
`estatico` (contenido de producto permitido y versionado).

## Hallazgos

| # | Archivo:línea | Dato / acción | Clase | Fuente/destino real | Endpoint/repositorio | Hito | Criterio de eliminación |
|---|---|---|---|---|---|---|---|
| 1 | `apps/api/src/demo-data.ts` (todo, 53 líneas: 4 partidos) | Cuatro partidos 2026 | operativo | Ingestión URBA → DB | `matches-repository` | 3–6 | El archivo no se importa en build productivo |
| 2 | `apps/api/src/demo-data.ts` (4 filas standings) | Posiciones URBA demo | operativo | Standings oficiales + cálculo | `standings-repository` | 3–6 | Idem |
| 3 | `apps/api/src/app.ts:3` | `import { matches, urbaStandings } from './demo-data'` | operativo | Repositorios inyectados | `apps/api` servicios | 6 | Sin import de `demo-data` |
| 4 | `apps/api/src/app.ts:48-49` | Solo slug `urba-top-14`, `season: 2026`, `rows: urbaStandings` | operativo | Competencia/temporada desde DB | `competitions-repository` | 6/8 | Endpoint resuelve cualquier slug/season desde DB |
| 5 | `apps/web/src/features/home/home-page.tsx:101` | `26` torneos | operativo | Agregado real | `GET /v1/home` | 9 | Valor viene de API |
| 6 | `home-page.tsx:102` | `184` clubes | operativo | Agregado real | `GET /v1/home` | 9 | Idem |
| 7 | `home-page.tsx:182` | `PRODE · FECHA 17` | operativo | Concurso abierto real | `GET /v1/home` / prodes | 11 | Derivado del concurso |
| 8 | `home-page.tsx:185` | Countdown `01:42:18` | operativo | `closesAt` − reloj | prodes | 9/11 | Calculado en cliente desde `closesAt` |
| 9 | `home-page.tsx:183,195` | Nota, autor `Equipo Ovalia`, `6 min` | editorial | Artículo destacado publicado | `articles-repository` | 12 | Bloque desde artículo `published` |
| 10 | `home-page.tsx:228` | `© 2026 Ovalia` | configuracion | Año corriente | fecha/config | 9 | Año calculado |
| 11 | `apps/web/src/features/portal/portal-pages.tsx:19` | `tournamentGroups` array | operativo | Catálogo real | `GET /v1/competitions` | 8 | Sin array local |
| 12 | `portal-pages.tsx:76` | Links de torneo a `#` (salvo urba-top-14) | operativo/control | Rutas por slug | routing | 8/14 | Sin `href="#"` |
| 13 | `portal-pages.tsx:84` (PredictionPage) | URBA, `Fecha 12`, cierre y 3 partidos SIC/CASI/Alumni | operativo | Concurso persistido | prodes API | 11 | Partidos del concurso real |
| 14 | `portal-pages.tsx:84` inputs `defaultValue="0"` + botón sin handler | acción ficticia | Predicción usuario/API | prodes API | 11 | Guardado/carga reales |
| 15 | `portal-pages.tsx:90` (TournamentPage) | `rows` — 5 filas tabla | operativo | Standings completos | `GET /v1/competitions/:slug/standings` | 8 | Tabla desde API |
| 16 | `portal-pages.tsx:91` | `Temporada 2026` literal + tabs con anclas | operativo/control | Selector/temporada activa | competitions API | 8/14 | Selector real; secciones reales |
| 17 | `apps/web/app/partidos/[slug]/page.tsx` (MatchDetail) | Solo busca en feed live | comportamiento | DB por ID + overlay live | `GET /v1/matches/:id` | 7 | Detalle desde DB |
| 18 | `apps/web/app/noticias/page.tsx:4` | `articles` — 3 notas locales | editorial | Artículos `published` | `GET /v1/articles` | 12 | Sin array local |
| 19 | `noticias/page.tsx:9` | `Leer nota →` a `#` | control ficticio | Ruta `/noticias/:slug` | routing | 12/14 | Enlace real |
| 20 | `apps/web/app/admin/page.tsx:4` | Contadores `3`/`7`/`4` + borrador y botón fijos | operativo/editorial | Queries dashboard + workflow | admin API | 12/13 | Datos desde DB |
| 21 | `apps/web/app/ingresar/page.tsx:4` | Botones/form sin handlers + recuperación a `#` | acción ficticia | Auth y recuperación reales | auth API | 10/14 | Formularios funcionales |
| 22 | `home-page.tsx` header | Buscar sin acción | control ficticio | Búsqueda real o retirar | search API | 14 | Implementado o retirado |
| 23 | headers | Selector ES sin cambio | control ficticio | i18n real o retirar | i18n | 14 | Idem |
| 24 | `packages/database/src/seed.ts` | Equipos y competencias como cobertura | bootstrap | Catálogo importado | seed honesto | 1/3–5 | Solo aliases/config; sin partidos falsos |
| 25 | `packages/domain/src/team-badges.ts` | ~12 identidades/escudos | configuracion | DB/ext IDs importados | team-badges + DB | 1/8 | Assets verificados como fallback, catálogo desde DB |
| 26 | `apps/worker/src/editorial-agent.ts:27` | Modelo `gpt-5-mini` literal | configuracion | `OPENAI_MODEL` validado | config | 12/15 | Env con default documentado |
| 27 | `apps/worker/src/index.ts:11-12` | Solo inicializa cliente OpenAI | comportamiento | Cola/job persistido | worker jobs | 12 | Procesa jobs reales |
| 28 | `apps/api/src/live/live-feed.ts:160-169` | Caché en memoria del proceso | operativo | Snapshot/lock en PostgreSQL | ingestion/live repo | 5/15 | Estado compartido en DB |

## Contenido estático permitido (no eliminar)

| Archivo | Contenido | Clase | Acción |
|---|---|---|---|
| `apps/web/src/features/games/games-hub.tsx` | Preguntas y decisiones de juegos | estatico | Documentar; puede permanecer (0/17) |
| `packages/domain` scoring/games | Reglas y perfiles | estatico | Permanece con tests/versionado |
| `packages/i18n` | Lista de locales ES/EN/PT | configuracion | Permanece si coincide con UI real (14/17) |
| `apps/web/public/teams/manifest.json` | Procedencia de assets | configuracion | Mantener y sincronizar con DB (8/17) |
| `.env.example` | URLs localhost y defaults dev | configuracion | Solo ejemplo; prod validado (15) |

## Reglas de rugby / prodes en dominio

Permitidas versionadas en código (spec §2): reglas puras de rugby, puntuación de
prodes, árboles narrativos de juegos, traducciones, design tokens, navegación
estructural y aliases iniciales de normalización (ampliables desde DB).
