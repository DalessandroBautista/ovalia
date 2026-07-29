# Próximos partidos en el home, navegación jerárquica de torneos y fuente Highlightly

## Contexto

Esta sesión venía de completar escudos y ampliar la cobertura de URBA a 85 competencias
(ver `2026-07-27-urba-badges-and-divisions-design.md`). Al revisar el resultado en
producción surgieron tres problemas relacionados que se resuelven juntos en este spec:

1. Cuando no hay partidos en vivo, el home queda con un estado vacío ("Consultando
   partidos en vivo…") en vez de mostrar algo útil.
2. El home ("Partidos del día") y `/torneos` renderizan **todas** las competencias apiladas
   una debajo de la otra, sin jerarquía — con 85 competencias URBA esto es inmanejable, y
   mezcla divisiones "Superior" (las que importan) con Intermedia/Preintermedia/juveniles
   (que además no tienen horario real: URBA no publica hora de kickoff para esas
   categorías, por eso aparecen como `00:00`).
3. Ovalia hoy solo cubre URBA. Falta rugby nacional (Súper Rugby, tests de Los Pumas) e
   internacional (Sevens), sin fuente de datos para eso.

## Objetivo

1. El home muestra próximos partidos importantes cuando no hay nada en vivo.
2. `/torneos` y el calendario del home organizan las competencias en una jerarquía
   navegable (Unión/liga → familia de torneo → categoría dentro de la familia), en vez de
   una lista plana.
3. Se suma una fuente de datos nueva (Highlightly, plan Pro ya contratado) para Súper
   Rugby, tests de Los Pumas y Sevens, usando el mismo patrón de adapter/ingesta que URBA.

## Fuera de alcance

- Otras uniones argentinas (Interior, Cuyo, etc.) — no tienen API pública, solo sitio web;
  quedarían para un trabajo de scraping aparte, no cubierto acá.
- Planteles de jugadores.
- Rediseño visual/estético más allá de lo necesario para la navegación jerárquica.

## Parte 1 — Bug de `priority` y "próximos partidos importantes"

### 1.1 Arreglar que la ingesta resetee `priority`

`upsertCompetition` (`packages/database/src/repositories/competitions-repository.ts`)
siempre escribe `priority: input.priority ?? 0` en el `ON CONFLICT`, así que cada
re-ingesta de URBA pisa la prioridad de **todas** las competencias a 0 — incluida
`urba-top-14`, que el seed había dejado en 100.

Cambio: `onConflictDoUpdate` solo actualiza `priority` cuando `input.priority` viene
explícito (no default a 0); si no viene, preserva el valor existente en la fila. Mismo
patrón que ya se usó para no pisar `badgeStatus` verificado en `upsertTeams`.

`persistCatalog` (`apps/worker/src/ingestion/run-ingestion.ts`) deja de mandar `priority`
en el `upsertCompetition` que hace por cada competencia del catálogo URBA — nunca más la
toca.

### 1.2 Prioridad explícita para las divisiones "Superior" de URBA

En `seed.ts`, después del bloque de equipos/fuentes, se agrega un loop que hace `upsert`
de prioridad explícita (con `upsertCompetition`, pasando `priority`) para las 8 divisiones
Superior/Primera ya conocidas (reutilizando `URBA_PRIORITY_COMPETITIONS` de
`apps/worker/src/ingestion/adapters/urba/urba-competitions.ts` como fuente de la lista y el
orden):

| slug | priority |
|---|---|
| urba-top-14 | 100 |
| urba-primera-a | 90 |
| urba-primera-b | 80 |
| urba-primera-c | 70 |
| urba-segunda | 60 |
| urba-tercera | 50 |
| urba-desarrollo | 40 |
| urba-femenino-top-9 | 30 |

Todo lo demás (Intermedia, Preintermedia A-F, M22, juveniles, universitario, formativo)
queda en `priority = 0` — el valor por defecto — y por lo tanto nunca se considera
"importante" para el fallback del home.

### 1.3 Endpoint de próximos partidos importantes

Nueva función `findUpcomingMatches(db, { limit, now })` en
`packages/database/src/repositories/matches-repository.ts`:

```typescript
export async function findUpcomingMatches(db: Database, params: { limit: number; now: Date }) {
  return baseSelect(db)
    .where(and(
      eq(matches.status, 'scheduled'),
      gt(competitions.priority, 0),
      gte(matches.startsAt, params.now),
    ))
    .orderBy(desc(competitions.priority), asc(matches.startsAt))
    .limit(params.limit);
}
```

(`baseSelect` es la misma función interna que ya arma el join completo con equipos y
competencia, usada por `findMatchesInRange`/`findMatchById`.)

Nuevo endpoint `GET /v1/matches/upcoming?limit=5` en `apps/api/src/create-app.ts`, mismo
shape de respuesta que `/v1/matches` (reutiliza `serializeMatch`):

```json
{ "generatedAt": "...", "matches": [ /* ApiMatch[] */ ] }
```

### 1.4 Frontend: fallback en los dos lugares vacíos

Nuevo hook `useUpcomingMatches(limit)` (`apps/web/src/features/home/use-home.ts` o archivo
nuevo junto a `use-agenda.ts`), mismo patrón que `useAgendaMatches`.

- **`LiveRailView`** (`apps/web/src/components/live-rail.tsx`): cuando `feed.matches.length
  === 0` y `feed.status !== 'loading'`, en vez de `feedMessage(feed)` se renderiza la lista
  de hasta 5 próximos partidos importantes (competencia + fecha/hora corta en vez de
  minuto/marcador).
- **`FeaturedMatch`** (`apps/web/src/features/home/home-page.tsx`): mismo criterio — si no
  hay partido en vivo, muestra el próximo partido importante más cercano en el mismo layout
  de tarjeta grande, con rótulo "PRÓXIMO PARTIDO IMPORTANTE" en vez de "EN VIVO" y fecha/hora
  en vez de marcador.

## Parte 2 — Navegación jerárquica de torneos

### 2.1 Modelo de datos

**`organizations`** (tabla ya existente en el schema, sin filas hasta ahora): se puebla con:

| slug | name | kind | countryCode |
|---|---|---|---|
| urba | Unión de Rugby de Buenos Aires | union | AR |
| super-rugby | Súper Rugby | league | null |
| rugby-internacional | Rugby Internacional | international | null |
| rugby-seven | Rugby Seven | sevens | null |

**`competitions`** gana dos columnas nuevas (migración Drizzle):

- `family_slug text` — agrupa competencias hermanas del mismo torneo. Para URBA se deriva
  del nombre (la parte antes de " - ", slugificada: "TOP 14 - Superior" → familia
  `top-14`). Para las de Highlightly, cada una es su propia familia (su propio slug).
- `tier text not null default 'senior'` — uno de `senior | intermediate | youth | women |
  university | sevens`. Para URBA se deriva de la categoría (la parte después de " - "):
  "Superior"/"Primera" → `senior`; "Intermedia"/"Preintermedia*" → `intermediate`;
  "Menores de 22" → `youth`; "Femenino *" → `women`; "Menores de 1[5-9] *" → `youth`;
  "Universitario"/"Formativo" → `university`. Para Highlightly: Súper Rugby y Rugby
  Championship/Friendly International → `senior`; Seven's World Cup → `sevens`.

Función pura y testeada `deriveUrbaTaxonomy(name: string): { familySlug: string; tier:
CompetitionTier }` en `apps/worker/src/ingestion/adapters/urba/urba-taxonomy.ts`, usada por
`urba-parser.ts` al construir cada `ExternalCompetition`. `ExternalCompetition` (domain)
gana `familySlug` y `tier` opcionales; si el adapter no los provee, `persistCatalog` no los
pisa (mismo patrón preservar-si-no-viene que en Parte 1).

`upsertCompetition` pasa a aceptar y persistir `organizationId`, `familySlug`, `tier`.

### 2.2 API

`GET /v1/competitions` agrega `organization: { slug, name } | null`, `familySlug`, `tier`
a cada competencia en la respuesta (join simple contra `organizations`).

No hay endpoint nuevo: la agrupación (por organización, por familia) se arma en el
frontend a partir de la lista plana de competencias — son ~90-150 filas, liviano para
agrupar en el cliente y evita mantener un endpoint de agregación aparte.

### 2.3 Frontend — `/torneos`

Reestructura `apps/web/src/features/portal/portal-pages.tsx` (la vista `AllTournamentsPage`
o como se llame la que renderiza `/torneos` hoy):

**Nivel 1 — landing de `/torneos`**: agrupado por `organization`, mostrando por cada
organización solo las competencias `tier === 'senior'` de cada familia distinta (es decir,
un ítem por familia, no uno por categoría). Orden: URBA primero, después Rugby
Internacional/Súper Rugby/Seven. Dentro de URBA, "Juveniles" aparece como una entrada
propia (agrupando las familias con `tier === 'youth'` bajo un sub-encabezado, no mezcladas
con las de `tier === 'senior'`).

**Nivel 2 — página de familia** (ruta existente `/torneos/[slug]`, sin cambiar el patrón de
URL): sigue mostrando posiciones/resultados/calendario de la competencia puntual (por
ejemplo `urba-top-14`), pero agrega un selector (tabs o dropdown, a definir en
implementación con `frontend-design`/`impeccable` si hace falta pulir) que lista las demás
competencias con el mismo `familySlug` (Intermedia, Preintermedia A-F, M22) para saltar
entre ellas sin volver al listado general.

### 2.4 Frontend — calendario del home (`Agenda`)

`apps/web/src/features/home/home-page.tsx`, componente `Agenda`: en vez de
`groups.map(...)` renderizando todos los grupos apilados, se agrega estado
`selectedCompetitionSlug` (por defecto, el grupo de mayor `priority` con partidos ese día)
y se renderiza **un solo grupo**, con un selector lateral (lista de píldoras/tabs con el
nombre corto de cada competencia que tiene partidos ese día) para cambiar. Reutiliza
`groupMatchesByCompetition` tal cual —- ya arma los grupos, solo cambia cuál se muestra.

## Parte 3 — Fuente de datos Highlightly (Súper Rugby, Los Pumas, Sevens)

### 3.1 Estado actual

`apps/api/src/live/live-feed.ts` ya integra Highlightly, pero **solo** para el feed de "en
vivo" (`HighlightlyProvider.getLiveMatches`), con su propio schema/parseo acotado a
partidos en curso. No hay adapter de ingesta (catálogo/fixtures/standings) para Highlightly
hoy — es 100% nuevo.

### 3.2 Cuenta y límites verificados

La API key ya está contratada en plan **Pro** (7.500 requests/día, 12 req/seg), verificado
en vivo contra `GET /leagues` (headers `x-ratelimit-requests-limit: 7500`). Suficiente para
correr catálogo + fixtures + standings de las 4 competencias curadas cada 6 horas sin
acercarse al límite.

### 3.3 Competencias curadas (IDs verificados contra la API real)

| externalId (leagueId) | nombre | slug Ovalia | organización | tier |
|---|---|---|---|---|
| 61205 | Super Rugby | super-rugby | super-rugby | senior |
| 73119 | Rugby Championship | rugby-championship | rugby-internacional | senior |
| 72268 | Friendly International | tests-internacionales | rugby-internacional | senior |
| 73970 | Seven's World Cup | seven-world-cup | rugby-seven | sevens |

(Rugby Championship y Friendly International ya traen a Los Pumas — verificado: partido
Argentina vs Sudáfrica real en la respuesta de `GET /matches?leagueId=73119`.)

### 3.4 Nuevo adapter

`apps/worker/src/ingestion/adapters/highlightly/` (paralelo a `adapters/urba/`):

- `highlightly-client.ts`: cliente HTTP con rate limit (igual patrón que `UrbaClient`),
  base URL `https://rugby.highlightly.net`, header `x-rapidapi-key`.
- `highlightly-parser.ts`: parsers `parseLeaguesAsCompetitions`, `parseMatchesAsFixtures`,
  `parseStandingsPayload` — contrato análogo a `urba-parser.ts`, con fixtures propias
  grabadas de respuestas reales (mismo patrón de `__fixtures__/*.sample.json` + atribución).
- `highlightly-competitions.ts`: la tabla de la sección 3.3 (curada, análoga a
  `URBA_PRIORITY_COMPETITIONS`).
- `highlightly-adapter.ts`: `HighlightlyIngestAdapter implements SportsDataAdapter`
  (nombre distinto de `HighlightlyProvider` para no confundir con el de live-feed, que no
  se toca).
- `highlightly-import.ts`: análogo a `urba-import.ts`.

Se registra en `apps/worker/src/ingestion/register-adapters.ts`. El CLI
(`apps/worker/src/cli/ingest.ts`) ya soporta cualquier fuente registrada vía
`--source highlightly --all`, no necesita cambios.

### 3.5 CI

Nuevo workflow `.github/workflows/ingest-highlightly.yml`, mismo patrón que
`ingest-urba.yml` (build de `@ovalia/domain`+`@ovalia/database`, `timeout-minutes: 30`
—alcanza de sobra para 4 competencias—, cron cada 6 horas). Nuevo secret
`HIGHLIGHTLY_API_KEY` en el GitHub Environment `production` (la key ya provista en esta
conversación).

## Riesgos / seguimiento

- **Parámetros exactos de la API de Highlightly** (paginación de `/matches`, filtro de
  temporada, shape exacto de `/standings`) se terminan de verificar durante la
  implementación del adapter — lo confirmado en esta sesión (`/leagues`, `/matches` sin
  filtro de `season`) alcanza para arrancar, pero el parser puede necesitar ajustes al
  toparse con la respuesta real completa.
- **Selector de familia (2.3)**: el spec no fija el componente visual exacto (tabs vs
  dropdown) — se decide en implementación siguiendo el estilo ya establecido en el resto
  del portal.
- **Migración de datos existente**: al agregar `family_slug`/`tier`, las 88 competencias
  URBA ya en producción necesitan un backfill (correr la derivación sobre las existentes,
  no solo sobre nuevas). Se hace con un script one-off en la implementación, no con una
  migración de schema que además escriba datos.
- Este spec es grande a propósito (decisión explícita del usuario de no partirlo). La
  implementación sí se secuencia en fases dentro del mismo plan: Parte 1 (rápida, ya
  acotada) → Parte 2 (navegación, depende del backfill de taxonomía) → Parte 3 (fuente
  nueva, independiente de las otras dos, se puede paralelizar).

## Testing

- `upsertCompetition`: test de que preserva `priority` existente si no viene explícito, y
  lo actualiza si viene.
- `findUpcomingMatches`: filtra por `priority > 0`, ordena por prioridad y luego fecha.
- `deriveUrbaTaxonomy`: casos representativos por cada `tier` (Superior, Intermedia,
  Preintermedia B, Menores de 22, Femenino, Menores de 19, Universitario) contra nombres
  reales del fixture de URBA.
- Endpoint `/v1/matches/upcoming` y el `organization`/`familySlug`/`tier` en
  `/v1/competitions`.
- `highlightly-parser.ts`: contrato con fixtures grabadas, igual patrón que
  `urba-parser.test.ts`.
- Componentes: estado vacío → fallback en `LiveRailView`/`FeaturedMatch`; selector de
  familia en la página de torneo; selector de competencia en `Agenda`.
