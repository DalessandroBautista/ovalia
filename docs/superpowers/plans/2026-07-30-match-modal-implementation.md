# Modal de partido — plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar este plan tarea por tarea. Los
> pasos usan casillas (`- [ ]`) para el seguimiento.

**Goal:** Abrir cualquier partido de la agenda en un modal que muestre forma
reciente, enfrentamientos previos y posición en la tabla, sin perder la fecha que
el usuario está mirando.

**Architecture:** Un endpoint nuevo `GET /v1/matches/:id/context` reúne en una
respuesta lo que consumen las tres pestañas. El cálculo vive en funciones puras
de `packages/domain`; `packages/database` solo trae filas; `apps/api` valida y
serializa; `apps/web` agrega el modal a la agenda con el estado en la URL.

**Tech Stack:** TypeScript estricto, Fastify, Drizzle sobre PostgreSQL, Next.js
App Router, Vitest, Testing Library.

## Global Constraints

- TDD obligatorio: prueba primero, verificar que falla, después implementar.
- TypeScript estricto: sin `any`, sin aserciones que apaguen el verificador.
- `packages/domain` no importa framework ni base de datos.
- Validación de entrada en `apps/api/src/schemas.ts`.
- Estados vacíos honestos: nunca afirmar algo falso por ausencia de datos.
- Usar `corepack pnpm` — `pnpm` no está en el PATH.
- Cierre de cada tarea: `corepack pnpm verify` y commit enfocado.

## Enmienda del 2026-07-30 — entorno de pruebas

Al ejecutar la tarea 1 se detectó que `apps/web` no tenía jsdom ni Testing
Library: sus pruebas usaban `renderToStaticMarkup`, que produce HTML estático sin
DOM y no puede ejercer un clic, una tecla ni `popstate`. Las pruebas que este
plan especificaba en las tareas 7 y 8 chocaban con ese techo.

El entorno de DOM se incorpora durante la ronda de corrección de la tarea 1. A
partir de ahí, **las pruebas de comportamiento interactivo usan Testing Library**;
`renderToStaticMarkup` queda solo para aserciones de marcado estático. Las
tareas 7 y 8 de abajo ya reflejan ese cambio.

## Especificaciones de referencia

- `docs/superpowers/specs/2026-07-30-match-modal-design.md`
- `docs/superpowers/specs/2026-07-29-shared-rugby-explorer-design.md`

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/domain/src/match-context.ts` | Cálculo puro de H2H, forma y posición |
| `packages/database/src/repositories/matches-repository.ts` | Consulta de partidos previos |
| `apps/api/src/create-app.ts` | Ruta `/v1/matches/:id/context` |
| `apps/web/src/lib/api/types.ts` | Tipos de la respuesta |
| `apps/web/src/lib/api/client.ts` | `fetchMatchContext` |
| `apps/web/src/features/matches/use-match-context.ts` | Hook de carga |
| `apps/web/src/features/matches/match-modal.tsx` | Modal y sus tres pestañas |
| `apps/web/src/hooks/use-focus-trap.ts` | Atrapado de foco compartido |

---

### Task 1: Cerrar el explorador compartido

Las tareas 1 a 8 de `2026-07-29-shared-rugby-explorer-implementation.md` ya están
implementadas en el árbol de trabajo. Falta su tarea 9 y el commit. Ninguna
decisión de diseño se revisa acá.

**Files:**
- Modificar: ninguno salvo que la verificación encuentre fallas

- [ ] **Step 1: Correr la verificación completa**

```bash
corepack pnpm verify
```
Esperado: PASS. Si falla, corregir antes de seguir. No usar `vitest` suelto
desde la raíz: saltea el arranque de las bases de test por paquete y produce
fallos falsos en `database` y `worker`.

- [ ] **Step 2: Correr el build**

```bash
corepack pnpm build
```
Esperado: PASS.

- [ ] **Step 3: Revisar visualmente**

Levantar API y web contra la base migrada y sembrada. Abrir `/torneos` y
`/partidos` en escritorio y en un ancho de 420 px. Confirmar que el explorador
queda fijo en escritorio, que el drawer abre y cierra en mobile, y que el filtro
de familia conserva la fecha.

- [ ] **Step 4: Revisar el diff**

```bash
git diff --check
git status --short
```
Esperado: sin espacios en blanco erróneos. `.gitignore` no debe entrar en el
commit del explorador.

- [ ] **Step 5: Commit**

```bash
git add apps packages
git commit -m "feat: explorador compartido de uniones y torneos"
```

---

### Task 2: Cálculo puro del contexto de partido

**Files:**
- Crear: `packages/domain/src/match-context.ts`
- Crear: `packages/domain/src/match-context.test.ts`
- Modificar: `packages/domain/src/index.ts`

**Interfaces:**
- Consume: nada.
- Produce: `PastMatch`, `FormResult`, `HeadToHead`, `TeamPosition`,
  `buildHeadToHead`, `buildRecentForm`, `findTeamPosition`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Crear `packages/domain/src/match-context.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildHeadToHead, buildRecentForm, findTeamPosition } from './match-context';
import type { PastMatch } from './match-context';

const match = (
  id: string,
  startsAt: string,
  homeTeamSlug: string,
  homeScore: number,
  awayTeamSlug: string,
  awayScore: number,
): PastMatch => ({ id, startsAt, homeTeamSlug, homeScore, awayTeamSlug, awayScore });

describe('buildHeadToHead', () => {
  it('devuelve un balance vacío cuando no hubo enfrentamientos', () => {
    expect(buildHeadToHead({ homeTeamSlug: 'hindu', awayTeamSlug: 'la-plata', matches: [] })).toEqual({
      played: 0,
      homeWins: 0,
      awayWins: 0,
      draws: 0,
      recent: [],
    });
  });

  it('cuenta la victoria del equipo local aunque haya jugado de visitante', () => {
    const matches = [match('m1', '2025-05-10T18:00:00.000Z', 'la-plata', 12, 'hindu', 30)];
    const result = buildHeadToHead({ homeTeamSlug: 'hindu', awayTeamSlug: 'la-plata', matches });
    expect(result.homeWins).toBe(1);
    expect(result.awayWins).toBe(0);
  });

  it('cuenta los empates por separado', () => {
    const matches = [match('m1', '2025-05-10T18:00:00.000Z', 'hindu', 20, 'la-plata', 20)];
    const result = buildHeadToHead({ homeTeamSlug: 'hindu', awayTeamSlug: 'la-plata', matches });
    expect(result).toMatchObject({ played: 1, homeWins: 0, awayWins: 0, draws: 1 });
  });

  it('ignora los partidos contra terceros', () => {
    const matches = [
      match('m1', '2025-05-10T18:00:00.000Z', 'hindu', 20, 'sic', 10),
      match('m2', '2025-06-10T18:00:00.000Z', 'hindu', 20, 'la-plata', 10),
    ];
    expect(buildHeadToHead({ homeTeamSlug: 'hindu', awayTeamSlug: 'la-plata', matches }).played).toBe(1);
  });

  it('lista los más recientes primero y respeta el límite', () => {
    const matches = [
      match('m1', '2024-05-10T18:00:00.000Z', 'hindu', 20, 'la-plata', 10),
      match('m2', '2026-05-10T18:00:00.000Z', 'hindu', 21, 'la-plata', 11),
      match('m3', '2025-05-10T18:00:00.000Z', 'hindu', 22, 'la-plata', 12),
    ];
    const result = buildHeadToHead({ homeTeamSlug: 'hindu', awayTeamSlug: 'la-plata', matches, limit: 2 });
    expect(result.played).toBe(3);
    expect(result.recent.map((item) => item.id)).toEqual(['m2', 'm3']);
  });
});

describe('buildRecentForm', () => {
  it('devuelve una lista vacía sin partidos previos', () => {
    expect(buildRecentForm({ teamSlug: 'hindu', matches: [] })).toEqual([]);
  });

  it('clasifica victoria, empate y derrota desde ambos lados', () => {
    const matches = [
      match('m1', '2026-05-03T18:00:00.000Z', 'hindu', 30, 'sic', 10),
      match('m2', '2026-05-02T18:00:00.000Z', 'sic', 15, 'hindu', 15),
      match('m3', '2026-05-01T18:00:00.000Z', 'sic', 25, 'hindu', 12),
    ];
    expect(buildRecentForm({ teamSlug: 'hindu', matches })).toEqual(['win', 'draw', 'loss']);
  });

  it('devuelve como máximo cinco resultados, del más reciente al más viejo', () => {
    const matches = Array.from({ length: 7 }, (_, index) =>
      match(`m${index}`, `2026-05-0${index + 1}T18:00:00.000Z`, 'hindu', 30, 'sic', 10));
    expect(buildRecentForm({ teamSlug: 'hindu', matches })).toEqual(['win', 'win', 'win', 'win', 'win']);
    expect(buildRecentForm({ teamSlug: 'hindu', matches })).toHaveLength(5);
  });
});

describe('findTeamPosition', () => {
  const rows = [
    { teamSlug: 'hindu', points: 40, played: 10 },
    { teamSlug: 'la-plata', points: 30, played: 10 },
  ];

  it('devuelve el puesto según el orden recibido', () => {
    expect(findTeamPosition(rows, 'la-plata')).toEqual({ position: 2, points: 30, played: 10 });
  });

  it('devuelve null cuando el equipo no está en la tabla', () => {
    expect(findTeamPosition(rows, 'sic')).toBeNull();
  });
});
```

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/domain exec vitest run src/match-context.test.ts
```
Esperado: FAIL con «Failed to resolve import "./match-context"».

- [ ] **Step 3: Implementar el módulo**

Crear `packages/domain/src/match-context.ts`:

```typescript
export type FormResult = 'win' | 'draw' | 'loss';

export interface PastMatch {
  id: string;
  /** Momento de inicio en ISO 8601 UTC. */
  startsAt: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
  homeScore: number;
  awayScore: number;
}

export interface HeadToHead {
  played: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  recent: PastMatch[];
}

export interface TeamPosition {
  position: number;
  points: number;
  played: number;
}

const HEAD_TO_HEAD_LIMIT = 10;
const RECENT_FORM_LIMIT = 5;

/** Más reciente primero. Las cadenas ISO en UTC ordenan lexicográficamente. */
function byMostRecent(a: PastMatch, b: PastMatch): number {
  return b.startsAt.localeCompare(a.startsAt);
}

export function buildHeadToHead(params: {
  homeTeamSlug: string;
  awayTeamSlug: string;
  matches: readonly PastMatch[];
  limit?: number;
}): HeadToHead {
  const { homeTeamSlug, awayTeamSlug, matches, limit = HEAD_TO_HEAD_LIMIT } = params;
  const between = matches
    .filter((item) =>
      (item.homeTeamSlug === homeTeamSlug && item.awayTeamSlug === awayTeamSlug) ||
      (item.homeTeamSlug === awayTeamSlug && item.awayTeamSlug === homeTeamSlug))
    .toSorted(byMostRecent);

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  for (const item of between) {
    if (item.homeScore === item.awayScore) {
      draws += 1;
      continue;
    }
    const winner = item.homeScore > item.awayScore ? item.homeTeamSlug : item.awayTeamSlug;
    if (winner === homeTeamSlug) homeWins += 1;
    else awayWins += 1;
  }

  return { played: between.length, homeWins, awayWins, draws, recent: between.slice(0, limit) };
}

export function buildRecentForm(params: {
  teamSlug: string;
  matches: readonly PastMatch[];
  limit?: number;
}): FormResult[] {
  const { teamSlug, matches, limit = RECENT_FORM_LIMIT } = params;
  return matches
    .filter((item) => item.homeTeamSlug === teamSlug || item.awayTeamSlug === teamSlug)
    .toSorted(byMostRecent)
    .slice(0, limit)
    .map((item) => {
      if (item.homeScore === item.awayScore) return 'draw';
      const isHome = item.homeTeamSlug === teamSlug;
      const own = isHome ? item.homeScore : item.awayScore;
      const rival = isHome ? item.awayScore : item.homeScore;
      return own > rival ? 'win' : 'loss';
    });
}

/** Las filas llegan ya ordenadas por la consulta de posiciones. */
export function findTeamPosition(
  rows: readonly { teamSlug: string; points: number; played: number }[],
  teamSlug: string,
): TeamPosition | null {
  const index = rows.findIndex((row) => row.teamSlug === teamSlug);
  if (index < 0) return null;
  const row = rows[index]!;
  return { position: index + 1, points: row.points, played: row.played };
}
```

- [ ] **Step 4: Exportar desde el índice del paquete**

Agregar a `packages/domain/src/index.ts`, respetando el orden existente:

```typescript
export * from './match-context.js';
```

- [ ] **Step 5: Correr las pruebas y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/domain exec vitest run src/match-context.test.ts
```
Esperado: PASS, 10 pruebas.

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/match-context.ts packages/domain/src/match-context.test.ts packages/domain/src/index.ts
git commit -m "feat(domain): calcular historial, forma y posicion de un partido"
```

---

### Task 3: Consulta de partidos previos

**Files:**
- Modificar: `packages/database/src/repositories/matches-repository.ts`
- Modificar: `packages/database/src/repositories.test.ts`

**Interfaces:**
- Consume: `baseSelect` (privada del módulo), tablas `matches`, `teams`.
- Produce: `findPastMatchesForTeams(db, { teamIds, before, limit? })`, que
  devuelve filas con la forma de `baseSelect`: incluyen `id`, `startsAt`,
  `status`, `homeScore`, `awayScore` y los objetos `home` y `away` con `id`,
  `slug`, `name`, `shortName` y `badgeUrl`.

- [ ] **Step 1: Escribir la prueba que falla**

Agregar a `packages/database/src/repositories.test.ts`, siguiendo el patrón de
preparación de datos que ya usan las pruebas de ese archivo:

```typescript
it('trae solo partidos finalizados anteriores de los equipos pedidos', async () => {
  const { db, seasonId, teams } = await seedCompetitionFixture();
  const before = new Date('2026-06-01T00:00:00.000Z');

  await insertMatch(db, {
    seasonId,
    round: 'Fecha 1',
    startsAt: new Date('2026-05-01T18:00:00.000Z'),
    homeTeamId: teams.hindu,
    awayTeamId: teams.sic,
    status: 'final',
    homeScore: 30,
    awayScore: 10,
  });
  await insertMatch(db, {
    seasonId,
    round: 'Fecha 2',
    startsAt: new Date('2026-07-01T18:00:00.000Z'),
    homeTeamId: teams.hindu,
    awayTeamId: teams.sic,
    status: 'final',
    homeScore: 25,
    awayScore: 24,
  });
  await insertMatch(db, {
    seasonId,
    round: 'Fecha 3',
    startsAt: new Date('2026-05-15T18:00:00.000Z'),
    homeTeamId: teams.hindu,
    awayTeamId: teams.sic,
    status: 'scheduled',
  });

  const rows = await findPastMatchesForTeams(db, {
    teamIds: [teams.hindu, teams.sic],
    before,
  });

  expect(rows).toHaveLength(1);
  expect(rows[0]?.homeScore).toBe(30);
});
```

Si `seedCompetitionFixture` o `insertMatch` no existen con esos nombres en el
archivo, usar los ayudantes equivalentes que ya estén definidos ahí y adaptar la
preparación; no crear ayudantes nuevos.

- [ ] **Step 2: Correr la prueba y verificar que falla**

```bash
corepack pnpm --filter @ovalia/database test
```
Esperado: FAIL con «findPastMatchesForTeams is not defined».

- [ ] **Step 3: Implementar la consulta**

En `packages/database/src/repositories/matches-repository.ts`, ampliar la
importación de `drizzle-orm` con `inArray`, `lt` y `or`:

```typescript
import { and, asc, desc, eq, gt, gte, inArray, lt, lte, or, sql } from 'drizzle-orm';
```

Y agregar al final del archivo:

```typescript
export type PastMatchesParams = {
  teamIds: readonly [string, string];
  before: Date;
  limit?: number;
};

/**
 * Partidos finalizados de cualquiera de los dos equipos, anteriores a `before`.
 * Alimenta a la vez el historial entre ambos y la forma reciente de cada uno,
 * por eso no filtra por competencia ni exige que jueguen entre sí.
 */
export async function findPastMatchesForTeams(db: Database, params: PastMatchesParams) {
  const ids = [...params.teamIds];
  return baseSelect(db)
    .where(and(
      eq(matches.status, 'final'),
      lt(matches.startsAt, params.before),
      or(inArray(matches.homeTeamId, ids), inArray(matches.awayTeamId, ids)),
    ))
    .orderBy(desc(matches.startsAt))
    .limit(Math.min(params.limit ?? 200, 500));
}
```

- [ ] **Step 4: Correr la prueba y verificar que pasa**

```bash
corepack pnpm --filter @ovalia/database test
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/repositories/matches-repository.ts packages/database/src/repositories.test.ts
git commit -m "feat(database): consultar partidos previos de dos equipos"
```

---

### Task 4: Endpoint de contexto

**Files:**
- Modificar: `apps/api/src/create-app.ts`
- Modificar: `apps/api/src/app.test.ts`

**Interfaces:**
- Consume: `findMatchById`, `findPastMatchesForTeams`, `getStandingsForSeason`,
  `buildHeadToHead`, `buildRecentForm`, `findTeamPosition`.
- Produce: `GET /v1/matches/:id/context`, cuya respuesta es
  `{ headToHead, form: { home, away }, standings: { home, away } }`, donde
  `form.home` y `form.away` son arreglos de `'win' | 'draw' | 'loss'` y
  `standings.home` y `standings.away` son `TeamPosition | null`.

No hace falta esquema de validación: el único parámetro es el identificador de
la ruta, y su validez se determina buscando el partido.

- [ ] **Step 1: Escribir las pruebas que fallan**

Agregar a `apps/api/src/app.test.ts`:

```typescript
it('devuelve 404 para el contexto de un partido inexistente', async () => {
  const app = await buildTestApp();
  const response = await app.inject({
    method: 'GET',
    url: '/v1/matches/00000000-0000-0000-0000-000000000000/context',
  });
  expect(response.statusCode).toBe(404);
  expect(response.json()).toEqual({ error: 'match_not_found' });
});

it('devuelve historial, forma y posiciones de un partido existente', async () => {
  const app = await buildTestApp();
  const matchId = await seedMatchWithHistory();
  const response = await app.inject({ method: 'GET', url: `/v1/matches/${matchId}/context` });
  expect(response.statusCode).toBe(200);
  const body = response.json();
  expect(body.headToHead).toMatchObject({ played: expect.any(Number) });
  expect(Array.isArray(body.form.home)).toBe(true);
  expect(Array.isArray(body.form.away)).toBe(true);
  expect(body.standings).toHaveProperty('home');
  expect(body.standings).toHaveProperty('away');
});
```

Usar los ayudantes de preparación que ya existan en el archivo para construir la
aplicación de prueba y sembrar un partido; si tienen otros nombres, adaptarlos.

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/api test
```
Esperado: FAIL, la ruta responde 404 de Fastify por no existir.

- [ ] **Step 3: Implementar la ruta**

En `apps/api/src/create-app.ts`, sumar a las importaciones existentes
`findPastMatchesForTeams` desde `@ovalia/database` y `buildHeadToHead`,
`buildRecentForm` y `findTeamPosition` desde `@ovalia/domain`. Agregar la ruta
inmediatamente después de `app.get('/v1/matches/:id', ...)`:

```typescript
app.get('/v1/matches/:id/context', async (request, reply) => {
  const { id } = request.params as { id: string };
  const match = await findMatchById(db, id);
  if (!match) return reply.code(404).send({ error: 'match_not_found' });

  const [pastRows, standingRows] = await Promise.all([
    findPastMatchesForTeams(db, {
      teamIds: [match.home.id, match.away.id],
      before: match.startsAt,
    }),
    getStandingsForSeason(db, match.seasonId),
  ]);

  const past = pastRows.map((row) => ({
    id: row.id,
    startsAt: row.startsAt.toISOString(),
    homeTeamSlug: row.home.slug,
    awayTeamSlug: row.away.slug,
    homeScore: row.homeScore ?? 0,
    awayScore: row.awayScore ?? 0,
  }));

  return {
    headToHead: buildHeadToHead({
      homeTeamSlug: match.home.slug,
      awayTeamSlug: match.away.slug,
      matches: past,
    }),
    form: {
      home: buildRecentForm({ teamSlug: match.home.slug, matches: past }),
      away: buildRecentForm({ teamSlug: match.away.slug, matches: past }),
    },
    standings: {
      home: findTeamPosition(standingRows, match.home.slug),
      away: findTeamPosition(standingRows, match.away.slug),
    },
  };
});
```

- [ ] **Step 4: Correr las pruebas y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/api test
```
Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/create-app.ts apps/api/src/app.test.ts
git commit -m "feat(api): exponer contexto deportivo de un partido"
```

---

### Task 5: Cliente tipado y hook de carga

**Files:**
- Modificar: `apps/web/src/lib/api/types.ts`
- Modificar: `apps/web/src/lib/api/client.ts`
- Crear: `apps/web/src/features/matches/use-match-context.ts`
- Modificar: `apps/web/src/lib/api/client.test.ts`

**Interfaces:**
- Consume: `GET /v1/matches/:id/context` de la tarea 4, `apiFetch` y `ApiError`.
- Produce: `ApiMatchContext`, `fetchMatchContext(id, options?)` y
  `useMatchContext(id: string | null)`, que devuelve
  `{ status: 'idle' | 'loading' | 'ready' | 'error'; context: ApiMatchContext | null }`.
  Con `id` en `null` el hook no llama a la red y queda en `idle`.

- [ ] **Step 1: Agregar los tipos**

En `apps/web/src/lib/api/types.ts`:

```typescript
export type ApiFormResult = 'win' | 'draw' | 'loss';

export interface ApiHeadToHeadMatch {
  id: string;
  startsAt: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
  homeScore: number;
  awayScore: number;
}

export interface ApiTeamPosition {
  position: number;
  points: number;
  played: number;
}

export interface ApiMatchContext {
  headToHead: {
    played: number;
    homeWins: number;
    awayWins: number;
    draws: number;
    recent: ApiHeadToHeadMatch[];
  };
  form: { home: ApiFormResult[]; away: ApiFormResult[] };
  standings: { home: ApiTeamPosition | null; away: ApiTeamPosition | null };
}
```

- [ ] **Step 2: Escribir la prueba que falla**

Agregar a `apps/web/src/lib/api/client.test.ts`, con el mismo estilo de simulación
de `fetch` que usan las pruebas existentes del archivo:

```typescript
it('pide el contexto del partido con el identificador escapado', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ headToHead: { played: 0, homeWins: 0, awayWins: 0, draws: 0, recent: [] }, form: { home: [], away: [] }, standings: { home: null, away: null } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);

  await fetchMatchContext('abc def');

  expect(fetchMock.mock.calls[0]?.[0]).toContain('/v1/matches/abc%20def/context');
});
```

- [ ] **Step 3: Correr la prueba y verificar que falla**

```bash
corepack pnpm --filter @ovalia/web exec vitest run src/lib/api/client.test.ts
```
Esperado: FAIL con «fetchMatchContext is not exported».

- [ ] **Step 4: Implementar la función del cliente**

En `apps/web/src/lib/api/client.ts`, sumar `ApiMatchContext` a la lista de tipos
importados y agregar, junto a `fetchMatchById`:

```typescript
export function fetchMatchContext(id: string, options?: ApiFetchOptions) {
  return apiFetch<ApiMatchContext>(`/v1/matches/${encodeURIComponent(id)}/context`, options);
}
```

- [ ] **Step 5: Implementar el hook**

Crear `apps/web/src/features/matches/use-match-context.ts`, siguiendo el patrón
de `use-match-detail.ts`:

```typescript
'use client';

import { useEffect, useState } from 'react';

import { fetchMatchContext } from '../../lib/api/client';
import type { ApiMatchContext } from '../../lib/api/types';

type ContextStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ContextState {
  status: ContextStatus;
  context: ApiMatchContext | null;
}

export function useMatchContext(id: string | null): ContextState {
  const [state, setState] = useState<ContextState>({ status: 'idle', context: null });

  useEffect(() => {
    if (!id) {
      setState({ status: 'idle', context: null });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading', context: null });
    const load = async () => {
      try {
        const context = await fetchMatchContext(id, { signal: controller.signal });
        setState({ status: 'ready', context });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error', context: null });
      }
    };
    void load();
    return () => controller.abort();
  }, [id]);

  return state;
}
```

- [ ] **Step 6: Correr las pruebas y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/web exec vitest run src/lib/api/client.test.ts
```
Esperado: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/api apps/web/src/features/matches/use-match-context.ts
git commit -m "feat(web): cliente y hook del contexto de partido"
```

---

### Task 6: Extraer el atrapado de foco

`rugby-explorer.tsx` tiene hoy esta lógica escrita en línea para su drawer y el
modal necesita exactamente la misma. Se extrae antes de duplicarla.

**Files:**
- Crear: `apps/web/src/hooks/use-focus-trap.ts`
- Modificar: `apps/web/src/features/tournaments/rugby-explorer.tsx:89-115`

**Interfaces:**
- Produce: `useFocusTrap({ active, containerRef, onEscape })`, que mientras
  `active` sea verdadero bloquea el desplazamiento del cuerpo, lleva el foco al
  primer elemento enfocable del contenedor, cicla el tabulador dentro de él,
  llama a `onEscape` con la tecla Escape y restaura el foco previo al
  desactivarse.

- [ ] **Step 1: Crear el hook**

Crear `apps/web/src/hooks/use-focus-trap.ts`:

```typescript
'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = 'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(params: {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onEscape: () => void;
}): void {
  const { active, containerRef, onEscape } = params;

  useEffect(() => {
    if (!active) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    containerRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onEscape();
        return;
      }
      if (event.key !== 'Tab' || !containerRef.current) return;
      const focusable = [...containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [active, containerRef, onEscape]);
}
```

- [ ] **Step 2: Usarlo en el explorador**

En `apps/web/src/features/tournaments/rugby-explorer.tsx`, reemplazar el bloque
`useEffect` de las líneas 89 a 115 por:

```typescript
  useFocusTrap({
    active: drawerOpen,
    containerRef: drawerRef,
    onEscape: useCallback(() => setDrawerOpen(false), []),
  });
```

Ajustar las importaciones: `useCallback` y `useRef` desde `react`,
`useFocusTrap` desde `../../hooks/use-focus-trap`. `useEffect` deja de usarse en
este archivo.

- [ ] **Step 3: Correr las pruebas de web y verificar que siguen pasando**

```bash
corepack pnpm --filter @ovalia/web test
```
Esperado: PASS, las 39 pruebas existentes. Las del drawer del explorador cubren
esta lógica y deben seguir en verde sin cambios.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-focus-trap.ts apps/web/src/features/tournaments/rugby-explorer.tsx
git commit -m "refactor(web): extraer atrapado de foco reutilizable"
```

---

### Task 7: Modal de partido

**Files:**
- Crear: `apps/web/src/features/matches/match-modal.tsx`
- Modificar: `apps/web/src/features/portal/portal-pages.test.tsx`
- Modificar: `apps/web/app/globals.css`

**Interfaces:**
- Consume: `useMatchContext` de la tarea 5, `useFocusTrap` de la tarea 6,
  `AgendaMatch` de `../matches/agenda-data`, `TeamBadge` y `findTeamBadge` como
  los usa `portal-pages.tsx:428-443`.
- Produce: `MatchModal({ match, onClose })`, donde `match` es un `AgendaMatch` y
  `onClose` no recibe argumentos.

- [ ] **Step 1: Escribir las pruebas que fallan**

Agregar a `apps/web/src/features/portal/portal-pages.test.tsx`:

```typescript
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchModal } from '../matches/match-modal';

describe('MatchModal', () => {
  it('muestra la cabecera con los dos equipos antes de cargar el contexto', () => {
    contextState = { status: 'loading', context: null };
    render(<MatchModal match={agendaMatchFixture()} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Hindú')).toBeDefined();
    expect(within(dialog).getByText('La Plata')).toBeDefined();
  });

  it('nombra el diálogo con los dos equipos', () => {
    contextState = { status: 'loading', context: null };
    render(<MatchModal match={agendaMatchFixture()} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Hindú contra La Plata' })).toBeDefined();
  });

  it('cambia de pestaña al hacer clic', async () => {
    contextState = { status: 'ready', context: matchContextFixture() };
    render(<MatchModal match={agendaMatchFixture()} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Historial' }));
    expect(screen.getByRole('button', { name: 'Historial' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Forma' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('degrada cada pestaña con un vacío honesto cuando el contexto falla', async () => {
    contextState = { status: 'error', context: null };
    render(<MatchModal match={agendaMatchFixture()} onClose={() => {}} />);
    // La cabecera sobrevive al fallo: sale de los datos que la agenda ya tenía.
    expect(screen.getByText('Hindú')).toBeDefined();
    expect(screen.getByText('Sin partidos anteriores')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Historial' }));
    expect(screen.getByText('Sin enfrentamientos previos registrados')).toBeDefined();
    await userEvent.click(screen.getByRole('button', { name: 'Posiciones' }));
    expect(screen.getByText('Este equipo no figura en la tabla')).toBeDefined();
  });

  it('cierra con Escape y con el botón de cerrar', async () => {
    contextState = { status: 'ready', context: matchContextFixture() };
    const onClose = vi.fn();
    render(<MatchModal match={agendaMatchFixture()} onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
```

Agregar también este ayudante de contexto, junto al de partido:

```typescript
function matchContextFixture(): ApiMatchContext {
  return {
    headToHead: {
      played: 2,
      homeWins: 1,
      awayWins: 1,
      draws: 0,
      recent: [
        { id: 'p1', startsAt: '2026-05-10T18:00:00.000Z', homeTeamSlug: 'hindu', awayTeamSlug: 'la-plata', homeScore: 20, awayScore: 10 },
      ],
    },
    form: { home: ['win', 'loss'], away: ['draw'] },
    standings: { home: { position: 3, points: 40, played: 10 }, away: { position: 8, points: 22, played: 10 } },
  };
}
```

Agregar arriba del archivo, junto a las simulaciones que ya existen, el estado
del contexto y su simulación, y un ayudante de partido:

```typescript
let contextState: { status: 'idle' | 'loading' | 'ready' | 'error'; context: unknown } = {
  status: 'loading',
  context: null,
};

vi.mock('../matches/use-match-context', () => ({
  useMatchContext: () => contextState,
}));

function agendaMatchFixture(): AgendaMatch {
  return {
    id: 'match-1',
    competitionName: 'URBA Top 14',
    competitionSlug: 'urba-top-14',
    round: 'Fecha 5',
    startsAt: '2026-07-30T18:00:00.000Z',
    status: 'final',
    home: { slug: 'hindu', name: 'Hindú', shortName: 'HIN', badgeUrl: null },
    away: { slug: 'la-plata', name: 'La Plata', shortName: 'LAP', badgeUrl: null },
    homeScore: 24,
    awayScore: 17,
  } as AgendaMatch;
}
```

Si la forma real de `AgendaMatch` en `../matches/agenda-data` difiere, ajustar el
ayudante a esa forma en lugar de forzar el tipo.

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/web exec vitest run src/features/portal/portal-pages.test.tsx
```
Esperado: FAIL con «MatchModal is not defined».

- [ ] **Step 3: Implementar el modal**

Crear `apps/web/src/features/matches/match-modal.tsx`. La cabecera se dibuja con
los datos de `match`, que la agenda ya tiene en memoria, y solo las pestañas
dependen de la red:

```tsx
'use client';

import { useCallback, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { useMatchContext } from './use-match-context';
import type { AgendaMatch } from './agenda-data';
import type { ApiFormResult } from '../../lib/api/types';

type Tab = 'forma' | 'historial' | 'posiciones';

const FORM_LABEL: Record<ApiFormResult, string> = { win: 'G', draw: 'E', loss: 'P' };

function FormStrip({ results }: { results: ApiFormResult[] }) {
  if (results.length === 0) return <p className="match-modal__empty">Sin partidos anteriores</p>;
  return (
    <ul className="match-modal__form">
      {results.map((result, index) => (
        <li className={`match-modal__form-chip is-${result}`} key={index}>{FORM_LABEL[result]}</li>
      ))}
    </ul>
  );
}

export function MatchModal({ match, onClose }: { match: AgendaMatch; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('forma');
  const dialogRef = useRef<HTMLDivElement>(null);
  const handleEscape = useCallback(() => onClose(), [onClose]);
  useFocusTrap({ active: true, containerRef: dialogRef, onEscape: handleEscape });
  const { status, context } = useMatchContext(match.id);

  const failed = status === 'error';
  const label = `${match.home.name} contra ${match.away.name}`;

  return (
    <div className="match-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="match-modal" role="dialog" aria-modal="true" aria-label={label} ref={dialogRef}>
        <header className="match-modal__header">
          <button type="button" className="match-modal__close" aria-label="Cerrar" onClick={onClose}>×</button>
          <small>{match.competitionName} · {match.round}</small>
          <div className="match-modal__teams">
            <span>{match.home.name}</span>
            <strong>{match.homeScore ?? '—'} — {match.awayScore ?? '—'}</strong>
            <span>{match.away.name}</span>
          </div>
        </header>

        <nav className="match-modal__tabs" aria-label="Secciones del partido">
          <button type="button" aria-pressed={tab === 'forma'} onClick={() => setTab('forma')}>Forma</button>
          <button type="button" aria-pressed={tab === 'historial'} onClick={() => setTab('historial')}>Historial</button>
          <button type="button" aria-pressed={tab === 'posiciones'} onClick={() => setTab('posiciones')}>Posiciones</button>
        </nav>

        <div className="match-modal__panel">
          {tab === 'forma' && (
            failed || !context
              ? <p className="match-modal__empty">Sin partidos anteriores</p>
              : <><FormStrip results={context.form.home} /><FormStrip results={context.form.away} /></>
          )}

          {tab === 'historial' && (
            failed || !context || context.headToHead.played === 0
              ? <p className="match-modal__empty">Sin enfrentamientos previos registrados</p>
              : (
                <>
                  <p className="match-modal__balance">
                    {context.headToHead.homeWins} — {context.headToHead.draws} — {context.headToHead.awayWins}
                  </p>
                  <ul className="match-modal__history">
                    {context.headToHead.recent.map((item) => (
                      <li key={item.id}>
                        {item.homeTeamSlug} {item.homeScore} — {item.awayScore} {item.awayTeamSlug}
                      </li>
                    ))}
                  </ul>
                </>
              )
          )}

          {tab === 'posiciones' && (
            failed || !context || (!context.standings.home && !context.standings.away)
              ? <p className="match-modal__empty">Este equipo no figura en la tabla</p>
              : (
                <ul className="match-modal__standings">
                  <li>{match.home.name}: {context.standings.home ? `${context.standings.home.position}º · ${context.standings.home.points} pts` : 'sin datos'}</li>
                  <li>{match.away.name}: {context.standings.away ? `${context.standings.away.position}º · ${context.standings.away.points} pts` : 'sin datos'}</li>
                </ul>
              )
          )}
        </div>

        <footer className="match-modal__footer">
          <a href={`/partidos/${encodeURIComponent(match.id)}`}>Ver detalle completo</a>
        </footer>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Agregar los estilos**

En `apps/web/app/globals.css`, agregar las reglas de `.match-modal-overlay`,
`.match-modal` y sus elementos siguiendo las variables de color y los radios que
ya usa el archivo. La paleta de Ovalia no cambia: reutilizar las variables
existentes, sin introducir colores nuevos. En anchos menores a 520 px el modal
ocupa el ancho completo y se ancla al borde inferior.

- [ ] **Step 5: Correr las pruebas y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/web exec vitest run src/features/portal/portal-pages.test.tsx
```
Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/matches/match-modal.tsx apps/web/src/features/portal/portal-pages.test.tsx apps/web/app/globals.css
git commit -m "feat(web): modal de partido con forma, historial y posiciones"
```

---

### Task 8: Integración con la agenda y la URL

**Files:**
- Modificar: `apps/web/src/features/portal/portal-pages.tsx:83-207`
- Modificar: `apps/web/app/partidos/page.tsx`
- Modificar: `apps/web/src/features/portal/portal-pages.test.tsx`

**Interfaces:**
- Consume: `MatchModal` de la tarea 7.
- Produce: `MatchesPage` acepta además `initialMatchId?: string`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Agregar a `apps/web/src/features/portal/portal-pages.test.tsx`:

```typescript
describe('MatchesPage con modal', () => {
  beforeEach(() => {
    agendaState = { status: 'ready', matches: [agendaMatchFixture()], source: 'urba', freshness: 'fresh' };
    contextState = { status: 'ready', context: matchContextFixture() };
    window.history.replaceState({}, '', '/partidos?fecha=2026-07-30');
  });

  it('abre el modal cuando la URL trae un partido', () => {
    render(<MatchesPage initialMatchId="match-1" />);
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('no abre el modal si el partido de la URL no está en la fecha', () => {
    render(<MatchesPage initialMatchId="inexistente" />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('abre el modal al hacer clic y agrega el partido a la URL', async () => {
    render(<MatchesPage />);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Hindú/ }));
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(new URLSearchParams(window.location.search).get('partido')).toBe('match-1');
    // La fecha que el usuario estaba mirando no se pierde al abrir el modal.
    expect(new URLSearchParams(window.location.search).get('fecha')).toBe('2026-07-30');
  });

  it('cierra el modal y saca el partido de la URL sin tocar la fecha', async () => {
    render(<MatchesPage initialMatchId="match-1" />);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(new URLSearchParams(window.location.search).get('partido')).toBeNull();
    expect(new URLSearchParams(window.location.search).get('fecha')).toBe('2026-07-30');
  });

  it('cierra el modal cuando el navegador vuelve atrás', async () => {
    render(<MatchesPage />);
    await userEvent.click(screen.getByRole('button', { name: /Hindú/ }));
    expect(screen.getByRole('dialog')).toBeDefined();

    window.history.replaceState({}, '', '/partidos?fecha=2026-07-30');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
```

`waitFor` se importa de `@testing-library/react` junto con `render` y `screen`.

La última prueba simula el retroceso cambiando la URL y despachando `popstate`,
porque jsdom no implementa la pila de historial real de un navegador. Verifica lo
que importa: que el componente reaccione al evento reconstruyendo su estado desde
la URL.

- [ ] **Step 2: Correr las pruebas y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/web exec vitest run src/features/portal/portal-pages.test.tsx
```
Esperado: FAIL, no se renderiza ningún diálogo.

- [ ] **Step 3: Conectar el modal en la agenda**

En `MatchesPage` de `portal-pages.tsx`, agregar `initialMatchId` a las props y un
estado `openMatchId` inicializado con ese valor. Al hacer clic en una fila de
partido se fija `openMatchId` y se sincroniza la URL con los parámetros que la
página ya administra, sin recargar:

```typescript
const [openMatchId, setOpenMatchId] = useState<string | null>(initialMatchId ?? null);

const syncMatchParam = (matchId: string | null) => {
  const params = new URLSearchParams(window.location.search);
  if (matchId) params.set('partido', matchId);
  else params.delete('partido');
  const query = params.toString();
  window.history.pushState({}, '', query ? `?${query}` : window.location.pathname);
};

const openMatch = (matchId: string) => { setOpenMatchId(matchId); syncMatchParam(matchId); };
const closeMatch = () => { setOpenMatchId(null); syncMatchParam(null); };
```

Registrar el manejo de `popstate` para que retroceder y avanzar reflejen el
parámetro:

```typescript
useEffect(() => {
  const onPopState = () => {
    setOpenMatchId(new URLSearchParams(window.location.search).get('partido'));
  };
  window.addEventListener('popstate', onPopState);
  return () => window.removeEventListener('popstate', onPopState);
}, []);
```

Un identificador que no corresponda a ningún partido de la fecha no abre nada:

```tsx
const openMatch = matches.find((item) => item.id === openMatchId) ?? null;
...
{openMatch ? <MatchModal match={openMatch} onClose={closeMatch} /> : null}
```

`PortalMatchRow` recibe un `onOpen` y deja de ser un enlace de navegación dura
hacia el detalle; el enlace al detalle completo queda dentro del modal.

- [ ] **Step 4: Leer el parámetro en la ruta**

En `apps/web/app/partidos/page.tsx`, extraer `partido` de `searchParams` —junto
a `fecha` y `torneo`, que ya se leen— y pasarlo como `initialMatchId`.

- [ ] **Step 5: Correr las pruebas y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/web test
```
Esperado: PASS, incluidas las 39 anteriores.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/portal apps/web/app/partidos/page.tsx
git commit -m "feat(web): abrir partidos de la agenda en modal con estado en la URL"
```

---

### Task 9: Verificación integral

**Files:**
- Ninguno salvo correcciones que surjan.

- [ ] **Step 1: Verificación y build**

```bash
corepack pnpm verify
corepack pnpm build
```
Esperado: ambos PASS.

- [ ] **Step 2: Revisión manual**

Levantar API y web contra la base migrada. En `/partidos`: abrir un partido,
confirmar que la URL suma `partido=`, retroceder y confirmar que el modal cierra,
avanzar y confirmar que reabre. Recargar con el parámetro puesto y confirmar que
el modal aparece. Probar las tres pestañas en un partido con historial y en uno
de un equipo recién ascendido.

- [ ] **Step 3: Verificar el degradado**

Detener la API y abrir un partido: la cabecera debe seguir visible con los dos
equipos y el marcador, y cada pestaña debe mostrar su mensaje de vacío. El modal
no debe quedar en blanco ni lanzar un error sin capturar.

- [ ] **Step 4: Revisar en mobile**

A 420 px de ancho: el modal ocupa el ancho completo, se cierra con el botón y
con Escape, y el foco no se escapa al fondo mientras está abierto.

- [ ] **Step 5: Commit final**

```bash
git diff --check
git status --short
git commit --allow-empty -m "chore: verificar modal de partido de extremo a extremo"
```

---

## Notas de revisión del plan

**Cobertura del spec.** Las tres pestañas acordadas están en la tarea 7; el
endpoint único, en la 4; las definiciones de historial, forma y posición, en la
2; el estado en la URL y los controles del navegador, en la 8; el degradado por
pestaña, en las tareas 7 y 9; la extracción del atrapado de foco, en la 6. La
página `/partidos/[slug]` no se toca, de modo que su metadata se conserva.

**Fuera de este plan.** La pestaña de formaciones pertenece a
`2026-07-30-players-and-lineups-design.md` y se suma cuando exista carga de
planteles.

**Ayudantes de prueba.** Las tareas 3, 4 y 7 reutilizan los ayudantes de
preparación que ya existen en cada archivo de pruebas. Si sus nombres difieren de
los citados, adaptar la preparación a los existentes en lugar de crear ayudantes
nuevos.
