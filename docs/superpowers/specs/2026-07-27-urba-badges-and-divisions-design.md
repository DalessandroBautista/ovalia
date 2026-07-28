# Escudos completos y cobertura total de divisiones URBA

## Contexto

El pipeline de ingesta real de URBA (`apps/worker/src/ingestion/adapters/urba`) hoy solo
trae 8 competencias ("Superior" de cada división) de las 85 que expone el feed oficial de
URBA para la temporada 2026. Además, aunque el catálogo de clubes de URBA (`/clubs`, 99
equipos) ya trae un `badgeUrl` para cada club y se persiste en la tabla `teams`, dos bugs
hacen que el usuario perciba que "faltan escudos":

1. La tabla de posiciones (pestaña "Posiciones" de cada torneo) no pide ni renderiza
   `badgeUrl` — solo lo hacen las pestañas de Resultados/Calendario.
2. El upsert de equipos (`upsertTeams`) omite los campos de badge en su
   `ON CONFLICT DO UPDATE`, así que una vez creado un equipo, un re-ingest nunca puede
   actualizar/verificar su escudo.

## Objetivo

1. Todos los equipos de URBA (99 clubes, incluidos los 6 curados a mano hoy) usan el logo
   oficial que expone el feed de URBA, marcado como `verified`.
2. El escudo se ve en la tabla de posiciones, no solo en resultados/calendario.
3. El pipeline de ingesta cubre las 85 competencias del feed 2026 (todas las divisiones y
   categorías: Superior, Intermedia, Preintermedia A-F, Menores de 22, Femenino,
   Universitario, Formativo, Menores de 19/17/16/15), no solo las 8 "Superior" actuales.

## Fuera de alcance

- Planteles de jugadores (roster de personas). Lo que el usuario llamó "planteles" son en
  realidad las categorías/torneos de cada división (Intermedia, Pre A-F, M22), ya cubiertas
  por el punto 3.
- Rediseño visual del componente `TeamBadge` o de la tabla de posiciones más allá de sumar
  la columna/ícono de escudo.
- Alias de dominio, timeout de CI, y limpieza del proyecto Vercel fantasma "ovalia" (quedan
  pendientes de una conversación anterior, no forman parte de este trabajo pero se atienden
  el punto de timeout como parte del punto 3 porque es un requisito técnico para que funcione).

## Diseño

### 1. Escudos: unificar con el logo oficial de URBA

**`packages/database/src/repositories/teams-repository.ts` — `upsertTeams`**

Agregar al `set` del `onConflictDoUpdate`:
- `badgeUrl: values.badgeUrl`
- `badgeSourceUrl: values.badgeSourceUrl`
- `badgeFormat: values.badgeFormat`
- `badgeStatus: sql\`case when ${values.badgeUrl}::text is not null then 'verified' else ${teams.badgeStatus} end\``
- `badgeVerifiedAt: sql\`case when ${values.badgeUrl}::text is not null then now() else ${teams.badgeVerifiedAt} end\``

Solo se marca `verified` cuando el upsert trae un `badgeUrl` no nulo (siempre que venga de
URBA, ya que el catálogo de clubes siempre trae `image_uri`). Si en el futuro se agrega otra
fuente sin badge, no rompe el estado de badges ya verificados.

`TeamInput` (en el mismo archivo) gana los campos `badgeSourceUrl` y `badgeFormat`.

**`apps/worker/src/ingestion/adapters/urba/urba-parser.ts` — `parseClubsAsTeams`**

Agregar `badgeSourceUrl` (mismo valor que `badgeUrl`, es la URL directa del club en el feed
de URBA) y `badgeFormat` (extensión del archivo, ej. `png`) a cada `ExternalTeam` devuelto.

**`packages/domain` — tipo `ExternalTeam`**

Sumar los campos opcionales `badgeSourceUrl?: string` y `badgeFormat?: string`.

**`apps/worker/src/ingestion/run-ingestion.ts` — `persistCatalog`**

Pasar `badgeSourceUrl` y `badgeFormat` desde el `ExternalTeam` al `upsertTeams`.

Con esto, cada corrida del cron de ingesta (catálogo corre siempre, en cualquier modo)
actualiza y verifica el badge de los 99 clubes de URBA, incluidos los 6 que hoy están
curados a mano — sus SVG locales dejan de usarse una vez que el badge de URBA quede en la
base (el componente ya prioriza `remoteUrl` sobre el catálogo local solo si no hay match en
`TEAM_BADGES`; como seguimos queriendo que todos usen URBA, la limpieza de `TEAM_BADGES`
para esos 6 clubes se hace en el mismo cambio — ver más abajo).

**`packages/domain/src/team-badges.ts`**

Quitar del array `TEAM_BADGES` las 6 entradas de clubes URBA (`sic`, `hindu`, `casi`,
`newman`, `alumni`, `cuba`). Quedan solo las 4 selecciones nacionales (Argentina, Sudáfrica,
Nueva Zelanda, Australia), que no vienen de ningún feed automático y siguen curadas a mano.

**`packages/database/src/seed.ts`**

El seed de equipos (`TEAM_BADGES` + `metadata`) ya no incluye los 6 clubes URBA una vez
retirados de `TEAM_BADGES` — el seed solo sembrará las 4 selecciones nacionales como
equipos "manuales"; los clubes de URBA se crean/actualizan exclusivamente vía ingesta.
Ajustar el `metadata` map del seed para no romper por entradas huérfanas.

### 2. Mostrar el escudo en la tabla de posiciones

**`packages/database/src/repositories/*.ts` — `getStandingsForSeason`**

Sumar `teamBadgeUrl: teams.badgeUrl` al `select`/join existente contra `teams`.

**`apps/api/src/create-app.ts` — `GET /v1/competitions/:slug/standings`**

Incluir `badgeUrl: r.teamBadgeUrl` dentro de `team: { slug, name, badgeUrl }` en la
respuesta.

**`apps/web/src/lib/api/types.ts`**

Sumar `badgeUrl: string | null` al tipo del `team` dentro de una fila de standings.

**`apps/web/src/features/portal/portal-pages.tsx`**

En el render de cada `standing-row` (línea ~172-175), envolver el nombre del equipo con
`<TeamBadge name={row.team.name} shortCode={...} badgeUrl={row.team.badgeUrl} size="small" />`,
igual que ya se hace en resultados/calendario.

### 3. Cobertura completa de competencias URBA

**`apps/worker/src/ingestion/adapters/urba/urba-competitions.ts`**

`URBA_PRIORITY_COMPETITIONS` y `URBA_SLUG_BY_EXTERNAL_ID` se mantienen tal cual — siguen
siendo el mapa de slugs "lindos" para las 8 competencias ya publicadas (no se les toca el
slug para no romper URLs/SEO existentes).

**`apps/worker/src/ingestion/adapters/urba/urba-adapter.ts`**

- `fetchCatalog` deja de filtrar por `URBA_PRIORITY_IDS`: `parseCompetitions(championshipsRaw, undefined, URBA_SLUG_BY_EXTERNAL_ID)` — trae las 85 competencias del año, con slug explícito solo para las 8 conocidas y auto-slugify (ya soportado en `persistCatalog`) para el resto.
- `fetchFixtures`/`fetchResults`: cuando no viene `ctx.competitionExternalId`, en vez de iterar `URBA_PRIORITY_COMPETITIONS`, reciben la lista completa de IDs desde afuera (ver siguiente punto) — el adapter no necesita conocer la lista completa por sí mismo, ya la recibe resuelta.

**`apps/worker/src/ingestion/adapters/urba/urba-import.ts`**

`importUrba` ya hace primero `fetchCatalog` (paso `catalog`). Se reutiliza esa respuesta:
después de persistir el catálogo, se listan los `externalId` de **todas** las competencias
devueltas por `catalog.competitions` para el loop de fixtures/standings (hoy usa
`URBA_PRIORITY_COMPETITIONS` directamente). Esto reemplaza la lista hardcodeada de 8 por la
respuesta real y completa del feed, sin mantenimiento manual futuro si URBA agrega/saca
divisiones.

Nota de implementación: `runIngestion({ capability: 'catalog', ... })` no devuelve
actualmente el payload crudo (`RunIngestionResult` es un resumen de conteos), así que
`importUrba` necesita obtener la lista de competencias de otra forma: la opción más simple
es que `importUrba` llame `adapter.fetchCatalog(ctx)` una vez él mismo (antes o en paralelo
al `runIngestion` de catálogo) para quedarse con la lista de `externalId`s, ya que
`fetchCatalog` no tiene efectos secundarios (solo lee de la API de URBA).

**`.github/workflows/ingest-urba.yml`**

Subir `timeout-minutes` de 20 a 90. Con 85 competencias × 2 llamadas (fixtures + standings)
a ~1 req/seg de rate limit, el paso "full" puede tardar bien más de 20 minutos. El cron de
"results" (cada 10 min, más liviano) no cambia.

## Riesgos / seguimiento

- **Timing real desconocido**: no hay forma de medir de antemano cuánto tarda una corrida
  "full" con 85 competencias contra la API real de URBA. El timeout de 90 min es una
  estimación conservadora; si la primera corrida real tarda más, hay que ajustar (o paralelizar
  llamadas respetando el rate limit, que hoy es secuencial).
- **Volumen de datos nuevo**: 85 competencias probablemente traen muchos más partidos que las
  1182 actuales (quizás 5-10x). No debería haber problema de esquema/rendimiento a ese
  volumen, pero no se valida en este spec.
- **Divisiones juveniles (M15-M19)**: tienen nombres largos con "Eq B", "G1", "G2", "NIVEL 1/2"
  que el auto-slugify convertirá literalmente (ej. `menores-de-19-primera-rueda-g2-nivel-1-a`).
  No se le da tratamiento especial a esos nombres en este spec — quedan tal cual el
  auto-slugify los genere.

## Testing

- Tests existentes de `urba-parser.test.ts` se actualizan para cubrir los nuevos campos de
  badge en `parseClubsAsTeams` y el `parseCompetitions` sin filtro de `priorityIds`.
- Test nuevo/actualizado en `teams-repository` (o equivalente) para el `onConflictDoUpdate`
  con badge.
- Test de la ruta `/v1/competitions/:slug/standings` verificando que `badgeUrl` viaja en la
  respuesta.
- No hay test de integración contra la API real de URBA (ya es el patrón existente: se usan
  fixtures grabadas).
