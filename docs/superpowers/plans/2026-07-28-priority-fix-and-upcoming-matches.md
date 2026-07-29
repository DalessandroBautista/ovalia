# Priority fix y próximos partidos importantes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arreglar que la ingesta resetee `priority` a 0 en cada corrida, curar la
prioridad de las 8 divisiones Superior/Primera de URBA, y mostrar próximos partidos
importantes en el home (ticker + tarjeta grande) cuando no hay nada en vivo.

**Architecture:** Fix quirúrgico en `upsertCompetition` (mismo patrón "preservar si no
viene explícito" que ya se usó para badges), un curado one-off en `seed.ts`, una función de
repositorio nueva + endpoint nuevo que reutiliza el pipeline existente de matches, y dos
componentes de React que ya existen ganando una rama de fallback.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM (Postgres/Neon), Next.js, Vitest.

Este es el Plan 1 de 3 del spec
`docs/superpowers/specs/2026-07-28-home-fallback-torneos-nav-highlightly-design.md`
(Parte 1). Los Planes 2 y 3 (navegación jerárquica y fuente Highlightly) son documentos
separados y no son prerequisito de este.

## Global Constraints

- Las 8 divisiones Superior/Primera de URBA y su orden de prioridad (100 a 30) vienen del
  spec, sección 1.2 — usar esos valores exactos.
- No modificar el comportamiento de `findMatchesInRange` (paginación por cursor) — la
  nueva función de "próximos" es independiente.
- Seguir el patrón de commits en español, `tipo: descripción corta`.

---

### Task 1: `upsertCompetition` preserva `priority` si no viene explícito

**Files:**
- Modify: `packages/database/src/repositories/competitions-repository.ts`
- Test: `packages/database/src/repositories.test.ts`

**Interfaces:**
- Produces: `upsertCompetition(db, input: CompetitionInput)` — cuando `input.priority` es
  `undefined`, el `ON CONFLICT` conserva el `priority` ya existente en la fila; cuando
  viene un número (incluido `0` explícito), lo actualiza.

- [ ] **Step 1: Leer el estado actual del archivo**

`packages/database/src/repositories/competitions-repository.ts` hoy tiene:

```typescript
export async function upsertCompetition(db: Database, input: CompetitionInput) {
  const values = {
    slug: input.slug,
    name: input.name,
    category: input.category,
    gender: input.gender,
    countryCode: input.countryCode ?? null,
    format: input.format ?? 'xv',
    priority: input.priority ?? 0,
    coverage: input.coverage ?? 'manual',
    organizationId: input.organizationId ?? null,
  };
  const [row] = await db
    .insert(competitions)
    .values(values)
    .onConflictDoUpdate({
      target: competitions.slug,
      set: {
        name: values.name,
        category: values.category,
        gender: values.gender,
        countryCode: values.countryCode,
        format: values.format,
        priority: values.priority,
        coverage: values.coverage,
        organizationId: values.organizationId,
      },
    });
  return row!;
}
```

- [ ] **Step 2: Escribir el test que falla**

En `packages/database/src/repositories.test.ts`, agregar (junto a los demás tests de
competencias/import ya existentes; buscar `upsertCompetition` en los imports del archivo
— si no está importado, agregarlo al bloque de `import { ... } from './repositories'`):

```typescript
  it('upsertCompetition preserva priority si no viene explícito en un upsert posterior', async () => {
    const { db } = handle;
    const created = await upsertCompetition(db, {
      slug: 'urba-top-14',
      name: 'TOP 14 - Superior',
      category: 'clubs',
      gender: 'male',
      priority: 100,
    });
    expect(created.priority).toBe(100);

    const updated = await upsertCompetition(db, {
      slug: 'urba-top-14',
      name: 'TOP 14 - Superior',
      category: 'clubs',
      gender: 'male',
      // sin priority: no debe resetear a 0
    });
    expect(updated.priority).toBe(100);

    const explicitlyZero = await upsertCompetition(db, {
      slug: 'urba-top-14',
      name: 'TOP 14 - Superior',
      category: 'clubs',
      gender: 'male',
      priority: 0,
    });
    expect(explicitlyZero.priority).toBe(0);
  });
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/database exec vitest run repositories -t "upsertCompetition preserva priority"`
Expected: FAIL en la segunda aserción (`updated.priority` da `0`, no `100`).

- [ ] **Step 4: Implementar**

Reemplazar el `onConflictDoUpdate` de `upsertCompetition` por:

```typescript
export async function upsertCompetition(db: Database, input: CompetitionInput) {
  const values = {
    slug: input.slug,
    name: input.name,
    category: input.category,
    gender: input.gender,
    countryCode: input.countryCode ?? null,
    format: input.format ?? 'xv',
    priority: input.priority,
    coverage: input.coverage ?? 'manual',
    organizationId: input.organizationId ?? null,
  };
  const [row] = await db
    .insert(competitions)
    .values({ ...values, priority: values.priority ?? 0 })
    .onConflictDoUpdate({
      target: competitions.slug,
      set: {
        name: values.name,
        category: values.category,
        gender: values.gender,
        countryCode: values.countryCode,
        format: values.format,
        // Solo se actualiza priority si vino explícito en este upsert; si no, se
        // conserva el valor ya guardado (evita que la ingesta pise una prioridad
        // curada a mano).
        ...(values.priority !== undefined ? { priority: values.priority } : {}),
        coverage: values.coverage,
        organizationId: values.organizationId,
      },
    });
  return row!;
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/database exec vitest run repositories -t "upsertCompetition preserva priority"`
Expected: PASS.

- [ ] **Step 6: Typecheck y suite completa**

Run: `pnpm --filter @ovalia/database exec tsc --noEmit && pnpm --filter @ovalia/database exec vitest run`
Expected: sin errores, todo en verde.

- [ ] **Step 7: Commit**

```bash
git add packages/database/src/repositories/competitions-repository.ts packages/database/src/repositories.test.ts
git commit -m "fix: upsertCompetition preserva priority si el upsert no lo trae explícito"
```

---

### Task 2: `persistCatalog` deja de mandar `priority`

**Files:**
- Modify: `apps/worker/src/ingestion/run-ingestion.ts`

**Interfaces:**
- Consumes: `upsertCompetition` con `priority` opcional (Task 1).

- [ ] **Step 1: Ubicar el call site**

En `apps/worker/src/ingestion/run-ingestion.ts`, la función `persistCatalog` llama
`upsertCompetition(db, { slug, name, category, gender, countryCode, format, coverage:
'auto' })`. Confirmar (con `grep -n "upsertCompetition" apps/worker/src/ingestion/run-ingestion.ts`)
que ese call site **no** pasa `priority` — si no lo pasa, no hay cambio de código que
hacer acá; este task es de verificación, no de edición.

- [ ] **Step 2: Verificar con un test de integración existente**

Run: `pnpm --filter @ovalia/worker exec vitest run run-ingestion`
Expected: PASS (los tests existentes de `persistCatalog` no dependen de `priority`, así
que deben seguir pasando sin cambios).

- [ ] **Step 3: Si el call site SÍ pasaba priority, quitarlo**

Si el grep del Step 1 muestra que se pasa `priority` (por ejemplo `priority: 0` o similar),
quitar esa línea del objeto que se le pasa a `upsertCompetition` dentro de
`persistCatalog`, y volver a correr Steps 2.

- [ ] **Step 4: Commit (solo si hubo cambio de código)**

```bash
git add apps/worker/src/ingestion/run-ingestion.ts
git commit -m "fix: la ingesta de catálogo no pisa priority de las competencias"
```

Si el Step 1 confirmó que no hacía falta editar nada, no hay commit para este task —
seguir al Task 3.

---

### Task 3: Curar `priority` de las 8 divisiones Superior/Primera en el seed

**Files:**
- Modify: `packages/database/src/seed.ts`

**Interfaces:**
- Consumes: `upsertCompetition` (Task 1), `URBA_PRIORITY_COMPETITIONS` de
  `apps/worker/src/ingestion/adapters/urba/urba-competitions.ts` (ya existente, no cambia
  en este plan).

- [ ] **Step 1: Revisar el import de URBA_PRIORITY_COMPETITIONS**

`packages/database` no depende hoy de `apps/worker`. Como `URBA_PRIORITY_COMPETITIONS`
vive en `apps/worker/src/ingestion/adapters/urba/urba-competitions.ts`, importarlo desde
`packages/database/src/seed.ts` crearía una dependencia circular de paquetes (worker ya
depende de database). En vez de importarlo, se define la tabla de prioridades
directamente en `seed.ts` — son 8 líneas fijas, no vale la pena la dependencia cruzada.

- [ ] **Step 2: Editar `seed.ts`**

Ubicar, en `packages/database/src/seed.ts`, el bloque después de `upsertSource` (fuentes
externas) y antes de la temporada de bootstrap (`const [urba] = await db.select()...`).
Insertar ahí:

```typescript
// Prioridad curada de las divisiones Superior/Primera de URBA (Hito: home fallback).
// La ingesta (persistCatalog) nunca vuelve a pisar esto porque upsertCompetition
// preserva priority si no viene explícito.
const URBA_TOP_FLIGHT_PRIORITY: Record<string, number> = {
  'urba-top-14': 100,
  'urba-primera-a': 90,
  'urba-primera-b': 80,
  'urba-primera-c': 70,
  'urba-segunda': 60,
  'urba-tercera': 50,
  'urba-desarrollo': 40,
  'urba-femenino-top-9': 30,
};
for (const [slug, priority] of Object.entries(URBA_TOP_FLIGHT_PRIORITY)) {
  const existing = await db.select().from(competitions).where(eq(competitions.slug, slug)).limit(1);
  const row = existing[0];
  if (row) {
    await upsertCompetition(db, {
      slug: row.slug,
      name: row.name,
      category: row.category,
      gender: row.gender,
      countryCode: row.countryCode,
      format: row.format,
      priority,
      coverage: row.coverage,
    });
  }
}
```

(Se lee la fila existente primero porque el seed puede correr antes o después de que la
ingesta haya creado esas competencias — si `urba-top-14` todavía no existe en la base, no
hay nada que curar todavía y se salta; la próxima corrida de ingesta la crea y una
re-corrida del seed la cura.)

Agregar `upsertCompetition` al import de `packages/database/src/seed.ts` si no está ya
(`import { upsertCompetition } from './repositories/competitions-repository.js';` — revisar
el patrón de imports relativos que ya usa el archivo, ej. `upsertSource` se importa desde
`./repositories/ingestion-repository.js`).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ovalia/database exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Correr el seed contra la base de test local y verificar manualmente**

Requiere Postgres local corriendo (`docker ps` debe mostrar el contenedor de
`ovalia-db-1` en el puerto `54329`; si no está, `docker compose up -d` desde la raíz del
repo).

Run:
```bash
DATABASE_URL="postgres://ovalia:ovalia@localhost:54329/ovalia" pnpm --filter @ovalia/database exec tsx src/seed.ts
```
Expected: corre sin error. Si `urba-top-14` no existe todavía en esa base, no falla (el
loop lo saltea).

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/seed.ts
git commit -m "feat: curar priority de las divisiones Superior/Primera de URBA en el seed"
```

---

### Task 4: `findUpcomingMatches` — próximos partidos importantes

**Files:**
- Modify: `packages/database/src/repositories/matches-repository.ts`
- Test: `packages/database/src/repositories.test.ts`

**Interfaces:**
- Produces: `findUpcomingMatches(db: Database, params: { limit: number; now: Date })`,
  devuelve el mismo shape de fila que `findMatchesInRange` (usa la misma `baseSelect`
  interna), ordenado por `competitions.priority desc, matches.startsAt asc`, filtrado a
  `status = 'scheduled' AND competitions.priority > 0 AND startsAt >= now`.

- [ ] **Step 1: Escribir el test que falla**

En `packages/database/src/repositories.test.ts`, agregar (usando los factories
`makeCompetition`, `makeSeason`, `makeTeam` ya importados, y `upsertMatchByNaturalKey` ya
importado):

```typescript
  it('findUpcomingMatches trae solo partidos de competencias con priority > 0, ordenados por prioridad y fecha', async () => {
    const { db } = handle;
    const important = await makeCompetition(db, { slug: 'urba-top-14', priority: 100 });
    const minor = await makeCompetition(db, { slug: 'top-14-preintermedia', priority: 0 });
    const importantSeason = await makeSeason(db, important.id);
    const minorSeason = await makeSeason(db, minor.id);
    const a = await makeTeam(db, { name: 'A' });
    const b = await makeTeam(db, { name: 'B' });
    const c = await makeTeam(db, { name: 'C' });
    const d = await makeTeam(db, { name: 'D' });

    // Partido de competencia sin prioridad: no debe aparecer.
    await upsertMatchByNaturalKey(db, {
      seasonId: minorSeason.id,
      round: 'Fecha 1',
      startsAt: new Date('2026-08-01T00:00:00Z'),
      homeTeamId: a.id,
      awayTeamId: b.id,
    });
    // Dos partidos de competencia importante, en orden inverso al que deben salir.
    const later = await upsertMatchByNaturalKey(db, {
      seasonId: importantSeason.id,
      round: 'Fecha 2',
      startsAt: new Date('2026-08-10T00:00:00Z'),
      homeTeamId: a.id,
      awayTeamId: c.id,
    });
    const sooner = await upsertMatchByNaturalKey(db, {
      seasonId: importantSeason.id,
      round: 'Fecha 1',
      startsAt: new Date('2026-08-02T00:00:00Z'),
      homeTeamId: b.id,
      awayTeamId: d.id,
    });

    const upcoming = await findUpcomingMatches(db, { limit: 5, now: new Date('2026-07-28T00:00:00Z') });
    expect(upcoming.map((m) => m.id)).toEqual([sooner.match.id, later.match.id]);
  });
```

Revisar la firma real de retorno de `upsertMatchByNaturalKey` (usada arriba como
`sooner.match.id`) — si en el codebase actual devuelve directamente la fila en vez de
`{ match }`, ajustar a `sooner.id`/`later.id`. Confirmar con
`grep -n "export async function upsertMatchByNaturalKey" -A 15 packages/database/src/repositories/matches-repository.ts`
antes de escribir el test.

Agregar `findUpcomingMatches` al bloque de imports de `repositories.test.ts` (junto a
`getStandingsForSeason`, etc.).

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/database exec vitest run repositories -t "findUpcomingMatches"`
Expected: FAIL — `findUpcomingMatches` no existe todavía (error de import/compilación).

- [ ] **Step 3: Implementar**

En `packages/database/src/repositories/matches-repository.ts`, agregar el import `gt`
junto a los demás de `drizzle-orm` (`import { and, asc, desc, eq, gt, gte, lte, sql } from
'drizzle-orm';`), y agregar, después de `findMatchesInRange`:

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

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/database exec vitest run repositories -t "findUpcomingMatches"`
Expected: PASS.

- [ ] **Step 5: Typecheck y suite completa**

Run: `pnpm --filter @ovalia/database exec tsc --noEmit && pnpm --filter @ovalia/database exec vitest run`
Expected: sin errores, todo en verde.

- [ ] **Step 6: Rebuild del paquete (lo consume apps/api desde dist)**

Run: `pnpm --filter @ovalia/database build`
Expected: sin errores. (Necesario para que `apps/api` vea la función nueva — ver Task 5.)

- [ ] **Step 7: Commit**

```bash
git add packages/database/src/repositories/matches-repository.ts packages/database/src/repositories.test.ts
git commit -m "feat: findUpcomingMatches trae próximos partidos de competencias importantes"
```

---

### Task 5: Endpoint `GET /v1/matches/upcoming`

**Files:**
- Modify: `apps/api/src/create-app.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Consumes: `findUpcomingMatches` (Task 4), `serializeMatch` (ya existe en
  `create-app.ts:63-79`, sin cambios).
- Produces: `GET /v1/matches/upcoming?limit=N` → `{ generatedAt: string, matches: ApiMatch[] }`.

- [ ] **Step 1: Escribir el test que falla**

En `apps/api/src/app.test.ts`, agregar un test nuevo (después del que verifica
`/v1/matches`, usando el mismo patrón de `makeCompetition`/`makeSeason`/`makeTeam`/
`upsertMatchByNaturalKey` ya usado en `seedCompetition`):

```typescript
  it('sirve próximos partidos importantes en /v1/matches/upcoming', async () => {
    const { db } = handle;
    const important = await makeCompetition(db, { slug: 'urba-top-14', priority: 100 });
    const minor = await makeCompetition(db, { slug: 'top-14-preintermedia', priority: 0 });
    const importantSeason = await makeSeason(db, important.id);
    const minorSeason = await makeSeason(db, minor.id);
    const a = await makeTeam(db, { slug: 'a', name: 'A' });
    const b = await makeTeam(db, { slug: 'b', name: 'B' });
    const futureDate = new Date(Date.now() + 7 * 864e5);
    await upsertMatchByNaturalKey(db, {
      seasonId: importantSeason.id,
      round: 'Fecha 1',
      startsAt: futureDate,
      homeTeamId: a.id,
      awayTeamId: b.id,
    });
    await upsertMatchByNaturalKey(db, {
      seasonId: minorSeason.id,
      round: 'Fecha 1',
      startsAt: futureDate,
      homeTeamId: a.id,
      awayTeamId: b.id,
    });

    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/matches/upcoming?limit=5' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0]).toMatchObject({ competition: { slug: 'urba-top-14' } });
  });
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/api exec vitest run app -t "próximos partidos importantes"`
Expected: FAIL — 404, la ruta no existe.

- [ ] **Step 3: Implementar**

En `apps/api/src/create-app.ts`, agregar el import de `findUpcomingMatches` junto a los
demás imports de `@ovalia/database` (buscar el bloque `import { ... } from
'@ovalia/database';` cerca del principio del archivo y sumar `findUpcomingMatches` a la
lista).

Agregar la ruta nueva justo antes de `app.get('/v1/matches/:id', ...)`:

```typescript
  app.get('/v1/matches/upcoming', async (request) => {
    const query = request.query as Record<string, string>;
    const limit = Math.min(Number(query.limit) || 5, 20);
    const now = new Date();
    const rows = await findUpcomingMatches(db, { limit, now });
    return {
      generatedAt: now.toISOString(),
      matches: rows.map((m) => serializeMatch(m as NonNullable<MatchRow>)),
    };
  });
```

(`MatchRow` ya está importado/definido en este archivo para el uso existente de
`serializeMatch` en la ruta `/v1/matches` — reutilizar el mismo tipo, no crear uno nuevo.)

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/api exec vitest run app -t "próximos partidos importantes"`
Expected: PASS.

- [ ] **Step 5: Typecheck y suite completa**

Run: `pnpm --filter @ovalia/api exec tsc --noEmit && pnpm --filter @ovalia/api exec vitest run`
Expected: sin errores, todo en verde.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/create-app.ts apps/api/src/app.test.ts
git commit -m "feat: endpoint /v1/matches/upcoming con próximos partidos importantes"
```

---

### Task 6: Cliente web + hook `useUpcomingMatches`

**Files:**
- Modify: `apps/web/src/lib/api/client.ts`
- Create: `apps/web/src/features/matches/use-upcoming.ts`
- Test: `apps/web/src/features/matches/use-upcoming.test.ts`

**Interfaces:**
- Consumes: `apiFetch`, `ApiMatch`, `ApiMatchListResponse` (ya existen en
  `apps/web/src/lib/api/*`).
- Produces: `fetchUpcomingMatches(limit, options?)` en `client.ts`; hook
  `useUpcomingMatches(limit: number): { status: 'loading' | 'ready' | 'error'; matches:
  ApiMatch[] }` en `use-upcoming.ts`.

- [ ] **Step 1: Agregar `fetchUpcomingMatches` al cliente**

En `apps/web/src/lib/api/client.ts`, después de `fetchMatchById`:

```typescript
export function fetchUpcomingMatches(limit: number, options?: ApiFetchOptions) {
  return apiFetch<{ generatedAt: string; matches: ApiMatch[] }>(
    `/v1/matches/upcoming${toQueryString({ limit })}`,
    options,
  );
}
```

- [ ] **Step 2: Escribir el hook**

Crear `apps/web/src/features/matches/use-upcoming.ts`:

```typescript
'use client';

import { useEffect, useState } from 'react';

import { fetchUpcomingMatches } from '../../lib/api/client';
import type { ApiMatch } from '../../lib/api/types';

export interface UpcomingState {
  status: 'loading' | 'ready' | 'error';
  matches: ApiMatch[];
}

const initialState: UpcomingState = { status: 'loading', matches: [] };

/** Próximos partidos de competencias importantes, para el fallback cuando no hay nada en vivo. */
export function useUpcomingMatches(limit: number): UpcomingState {
  const [state, setState] = useState<UpcomingState>(initialState);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const payload = await fetchUpcomingMatches(limit, { signal: controller.signal });
        setState({ status: 'ready', matches: payload.matches });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setState({ status: 'error', matches: [] });
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [limit]);

  return state;
}
```

- [ ] **Step 3: Escribir un test del hook**

Crear `apps/web/src/features/matches/use-upcoming.test.ts`. Revisar primero cómo testea
hooks similares el codebase (`grep -rn "renderHook\|@testing-library" apps/web/src/features
--include="*.test.ts*"` — si no hay precedente de testing-library, usar el patrón manual de
render con `react-dom/server` que ya usan otros tests del proyecto, o testear indirectamente
vía el componente que lo consume en el Task 7/8 en vez de un test aislado del hook). Si el
proyecto no tiene infraestructura de testing de hooks aislados, saltar este test y confiar
en los tests de componente de los Tasks 7 y 8 — anotarlo así en el commit.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @ovalia/web exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/client.ts apps/web/src/features/matches/use-upcoming.ts
git commit -m "feat: hook useUpcomingMatches y cliente para /v1/matches/upcoming"
```

---

### Task 7: Fallback en el ticker `LiveRailView`

**Files:**
- Modify: `apps/web/src/components/live-rail.tsx`
- Test: `apps/web/src/components/live-ui.test.tsx`

**Interfaces:**
- Consumes: `useUpcomingMatches` (Task 6).
- Produces: `LiveRailView` renderiza hasta 5 próximos partidos en vez del mensaje de texto
  cuando `feed.matches.length === 0 && feed.status !== 'loading'`.

- [ ] **Step 1: Escribir el test que falla**

En `apps/web/src/components/live-ui.test.tsx`, revisar cómo se testea hoy `LiveRailView`
(`grep -n "LiveRailView" apps/web/src/components/live-ui.test.tsx`). Como `LiveRailView`
hoy es un componente puro que recibe `feed` por props (sin hooks internos propios más allá
de `useLiveFeed`, que es un hook separado), el fallback nuevo necesita que el componente
también reciba los próximos partidos — la forma más simple y testeable es agregar un prop
opcional `upcoming: ApiMatch[]` a `LiveRailView` en vez de que el propio componente llame al
hook (mantiene `LiveRailView` puro y fácil de testear con `renderToStaticMarkup`, igual que
hoy).

Agregar el test:

```typescript
  it('shows upcoming important matches when there is nothing live', () => {
    const html = renderToStaticMarkup(
      createElement(LiveRailView, {
        feed: { status: 'empty', source: 'database', freshness: 'fresh', generatedAt: '', matches: [] },
        upcoming: [
          {
            id: 'm1',
            competition: { slug: 'urba-top-14', name: 'TOP 14 - Superior' },
            season: 2026,
            round: 'Fecha 5',
            startsAt: '2026-08-02T18:00:00.000Z',
            venue: null,
            status: 'scheduled',
            home: { slug: 'sic', name: 'SIC', shortName: 'SIC', badgeUrl: null },
            away: { slug: 'hindu', name: 'Hindú', shortName: 'HIN', badgeUrl: null },
            homeScore: null,
            awayScore: null,
            source: 'urba',
            freshness: 'fresh',
          },
        ],
      }),
    );

    expect(html).toContain('SIC');
    expect(html).toContain('Hindú');
    expect(html).not.toContain('No hay partidos en vivo ahora');
  });
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/web exec vitest run live-ui -t "shows upcoming important matches"`
Expected: FAIL (sigue mostrando el mensaje de texto, `upcoming` no se usa todavía).

- [ ] **Step 3: Implementar**

En `apps/web/src/components/live-rail.tsx`, modificar `LiveRailView`:

```typescript
export function LiveRailView({ feed, upcoming = [] }: { feed: LiveFeedPayload; upcoming?: LiveFeedMatch[] | ApiUpcomingMatch[] }) {
```

Dado que `LiveFeedMatch` (el tipo que usa el ticker para partidos en vivo) y `ApiMatch`
(lo que devuelve `/v1/matches/upcoming`) tienen forma distinta (`home.shortCode` vs
`home.shortName`, sin `minute`/`phase`), la forma más simple es mapear en el punto de uso
(Task 8) a un tipo común mínimo en vez de que `live-rail.tsx` conozca `ApiMatch`. Definir en
`live-rail.tsx`, junto a `LiveFeedMatch`:

```typescript
export interface UpcomingRailMatch {
  id: string;
  competition: string;
  startsAt: string;
  home: { name: string; shortCode: string; badgeUrl?: string };
  away: { name: string; shortCode: string; badgeUrl?: string };
}
```

Y reemplazar el `LiveRailView` completo por:

```typescript
function formatUpcomingTime(startsAt: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(startsAt));
}

export function LiveRailView({ feed, upcoming = [] }: { feed: LiveFeedPayload; upcoming?: UpcomingRailMatch[] }) {
  const showUpcoming = feed.matches.length === 0 && feed.status !== 'loading' && upcoming.length > 0;
  return (
    <section className="live-rail" aria-label="Partidos en vivo" aria-live="polite">
      <div className="live-rail__inner">
        <div className="live-rail__label"><i /> EN VIVO</div>
        <div className="live-rail__track">
          {feed.matches.length ? feed.matches.map((match) => (
            <a className="rail-match" href={`/partidos/${match.id}`} key={match.id}>
              <span className="rail-match__competition">{match.competition}</span>
              <b>{match.minute ? `${match.minute}'` : match.phase}</b>
              <span><TeamBadge {...match.home} />{match.home.shortCode}</span><strong>{match.homeScore}</strong>
              <span><TeamBadge {...match.away} />{match.away.shortCode}</span><strong>{match.awayScore}</strong>
            </a>
          )) : showUpcoming ? upcoming.map((match) => (
            <a className="rail-match" href={`/partidos/${match.id}`} key={match.id}>
              <span className="rail-match__competition">{match.competition}</span>
              <b>{formatUpcomingTime(match.startsAt)}</b>
              <span><TeamBadge name={match.home.name} shortCode={match.home.shortCode} badgeUrl={match.home.badgeUrl} />{match.home.shortCode}</span>
              <span><TeamBadge name={match.away.name} shortCode={match.away.shortCode} badgeUrl={match.away.badgeUrl} />{match.away.shortCode}</span>
            </a>
          )) : <p className="live-rail__empty"><span className="status-spinner" />{feedMessage(feed)}</p>}
        </div>
        {feed.source !== 'none' ? <small className="live-source">Fuente: {feed.source === 'highlightly' ? 'Highlightly' : 'Ovalia verificado'}</small> : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/web exec vitest run live-ui`
Expected: todos los tests de ese archivo en verde, incluido el nuevo.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @ovalia/web exec tsc --noEmit`
Expected: sin errores (revisar que `apps/web/src/features/portal/portal-pages.tsx`, que
también usa `LiveRailView` indirectamente vía `useLiveFeed`, no se rompa — como `upcoming`
es opcional con default `[]`, los call sites existentes que no lo pasan siguen compilando).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/live-rail.tsx apps/web/src/components/live-ui.test.tsx
git commit -m "feat: LiveRailView muestra próximos partidos importantes sin nada en vivo"
```

---

### Task 8: Fallback en la tarjeta grande del Hero (`FeaturedMatch`)

**Files:**
- Modify: `apps/web/src/features/home/home-page.tsx`
- Test: `apps/web/src/features/home/home-page.test.tsx` (crear si no existe; revisar
  primero con `find apps/web/src/features/home -name "*.test.tsx"`)

**Interfaces:**
- Consumes: `useUpcomingMatches` (Task 6), `UpcomingRailMatch`/`LiveRailView` (Task 7).

- [ ] **Step 1: Ubicar el punto de integración**

En `apps/web/src/features/home/home-page.tsx`, la función `Hero({ feed, home })` renderiza
`<FeaturedMatch feed={feed} />` y, más abajo en el árbol de componentes de la página
completa, se usa `<LiveRailView feed={feed} />` (buscar con `grep -n "LiveRailView\|Hero(" apps/web/src/features/home/home-page.tsx`).

- [ ] **Step 2: Conectar `useUpcomingMatches` en el componente de página**

En el componente que orquesta la home (buscar `export function HomePage` o equivalente en
`home-page.tsx`), agregar:

```typescript
const upcoming = useUpcomingMatches(5);
```

y pasar `upcoming.matches` mapeado a `UpcomingRailMatch[]` tanto a `<Hero feed={feed}
home={home} upcoming={upcomingRailMatches} />` como al `<LiveRailView feed={feed}
upcoming={upcomingRailMatches} />`. El mapeo (definir como función local o en
`use-upcoming.ts` como `toUpcomingRailMatches(matches: ApiMatch[]): UpcomingRailMatch[]`):

```typescript
function toUpcomingRailMatches(matches: ApiMatch[]): UpcomingRailMatch[] {
  return matches.map((m) => ({
    id: m.id,
    competition: m.competition.name,
    startsAt: m.startsAt,
    home: { name: m.home.name, shortCode: m.home.shortName, badgeUrl: m.home.badgeUrl ?? undefined },
    away: { name: m.away.name, shortCode: m.away.shortName, badgeUrl: m.away.badgeUrl ?? undefined },
  }));
}
```

- [ ] **Step 3: Escribir el test que falla para `FeaturedMatch`**

Revisar si existe `apps/web/src/features/home/home-page.test.tsx`; si no existe, crear uno
nuevo con este contenido mínimo (ajustar imports según lo que exporte realmente
`home-page.tsx` — puede que `FeaturedMatch` no esté exportado; si no lo está, exportarlo
agregando `export` delante de `function FeaturedMatch`):

```typescript
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FeaturedMatch } from './home-page';

describe('FeaturedMatch fallback', () => {
  it('muestra el próximo partido importante cuando no hay nada en vivo', () => {
    const html = renderToStaticMarkup(
      createElement(FeaturedMatch, {
        feed: { status: 'empty', source: 'database', freshness: 'fresh', generatedAt: '', matches: [] },
        upcoming: [
          {
            id: 'm1',
            competition: 'TOP 14 - Superior',
            startsAt: '2026-08-02T18:00:00.000Z',
            home: { name: 'SIC', shortCode: 'SIC' },
            away: { name: 'Hindú', shortCode: 'HIN' },
          },
        ],
      }),
    );
    expect(html).toContain('PRÓXIMO PARTIDO IMPORTANTE');
    expect(html).toContain('SIC');
    expect(html).toContain('Hindú');
  });
});
```

- [ ] **Step 4: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/web exec vitest run home-page`
Expected: FAIL — `FeaturedMatch` no acepta/usa `upcoming` todavía, o no está exportado.

- [ ] **Step 5: Implementar**

Modificar `FeaturedMatch` en `apps/web/src/features/home/home-page.tsx`:

```typescript
export function FeaturedMatch({ feed, upcoming = [] }: { feed: LiveFeedPayload; upcoming?: UpcomingRailMatch[] }) {
  const match = feed.matches[0];
  if (!match) {
    const next = upcoming[0];
    if (next) {
      return (
        <article className="featured-match">
          <div className="featured-match__topline">
            <span>PRÓXIMO PARTIDO IMPORTANTE</span>
            <span>{next.competition}</span>
          </div>
          <div className="featured-match__score">
            <div className="featured-team">
              <TeamBadge name={next.home.name} shortCode={next.home.shortCode} badgeUrl={next.home.badgeUrl} size="large" />
              <div><small>{next.home.shortCode}</small><h2>{next.home.name}</h2></div>
            </div>
            <div className="scoreboard"><b>{formatUpcomingTime(next.startsAt)}</b></div>
            <div className="featured-team featured-team--away">
              <div><small>{next.away.shortCode}</small><h2>{next.away.name}</h2></div>
              <TeamBadge name={next.away.name} shortCode={next.away.shortCode} badgeUrl={next.away.badgeUrl} size="large" />
            </div>
          </div>
          <a className="match-link" href={`/partidos/${next.id}`}>Ver detalle <span>↗</span></a>
        </article>
      );
    }
    const message = feed.status === 'loading'
      ? 'Consultando partidos en vivo'
      : feed.status === 'error'
        ? 'Datos en vivo temporalmente no disponibles'
        : 'No hay partidos en vivo ahora';
    return (
      <article className="featured-match featured-match--empty">
        <div className="featured-match__topline"><span>VIVO OVALIA</span><span>FUENTE VERIFICADA</span></div>
        <div className="live-empty-hero"><RugbyBallIcon /><p className="eyebrow">ESTADO DEL FEED</p><h2>{message}</h2><p>Cuando comience un partido cubierto, el marcador aparecerá acá automáticamente.</p></div>
        <a className="match-link" href="/partidos">Ver agenda completa <span>↗</span></a>
      </article>
    );
  }
  return (
    // ... el resto de la función, sin cambios (rama de partido en vivo existente).
  );
}
```

Importar `formatUpcomingTime` y `UpcomingRailMatch` desde `../../components/live-rail`
(exportar `formatUpcomingTime` desde ese archivo si no lo está ya, agregando `export`
delante de su definición en el Task 7).

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/web exec vitest run home-page`
Expected: PASS.

- [ ] **Step 7: Typecheck y suite completa**

Run: `pnpm --filter @ovalia/web exec tsc --noEmit && pnpm --filter @ovalia/web exec vitest run`
Expected: sin errores, todo en verde.

- [ ] **Step 8: Verificación visual con el dev server**

Levantar `pnpm --filter @ovalia/web dev` y `pnpm --filter @ovalia/api dev` (con
`DATABASE_URL` apuntando a Postgres local, como en sesiones anteriores), abrir
`http://localhost:3000` en un momento sin partidos en vivo, y confirmar que la tarjeta
grande y el ticker muestran próximos partidos de Top 14 (o la división con mayor prioridad
que tenga partidos futuros), no de Preintermedia/Intermedia.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/features/home/home-page.tsx apps/web/src/features/home/home-page.test.tsx apps/web/src/components/live-rail.tsx
git commit -m "feat: tarjeta destacada del home muestra el próximo partido importante"
```

---

### Task 9: Deploy y verificación en producción

**Files:** ninguno (operación).

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Correr el seed contra Neon (para curar priority de las 8 divisiones)**

```bash
DATABASE_URL="<connection-string-de-neon>" pnpm --filter @ovalia/database exec tsx src/seed.ts
```

- [ ] **Step 3: Redeploy de API y web**

```bash
cd apps/api && pnpm dlx vercel@latest --prod --scope dalessandrobautistas-projects --yes
cd ../web && pnpm dlx vercel@latest --prod --scope dalessandrobautistas-projects --yes
```

- [ ] **Step 4: Verificar `/v1/matches/upcoming` en producción**

```bash
curl -s "https://ovalia-api.vercel.app/v1/matches/upcoming?limit=5" | python3 -m json.tool
```
Expected: solo partidos de `urba-top-14`, `urba-primera-a`, etc. (no de Preintermedia).

- [ ] **Step 5: Verificar visualmente**

Abrir la web de producción cuando no haya partidos en vivo y confirmar el fallback en
ambos componentes (mismo criterio que Task 8 Step 8).

---

## Self-Review Notes

- **Cobertura del spec (sección 1 completa)**: 1.1 → Tasks 1-2. 1.2 → Task 3. 1.3 → Tasks
  4-6. 1.4 → Tasks 7-8. Deploy → Task 9.
- **Consistencia de tipos**: `UpcomingRailMatch` se define una vez en `live-rail.tsx`
  (Task 7) y se reutiliza en `home-page.tsx` (Task 8) sin redefinirlo. `findUpcomingMatches`
  (Task 4) y el endpoint (Task 5) usan el mismo `MatchRow`/`serializeMatch` ya existentes,
  sin inventar un shape nuevo.
- **Riesgo señalado explícitamente**: Task 6 Step 3 reconoce que puede no haber
  infraestructura de test de hooks aislados en este proyecto y da una salida clara (delegar
  cobertura a los tests de componente) en vez de inventar una que no encaje con el resto del
  repo.
