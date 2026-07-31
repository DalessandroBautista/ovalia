# Simulador de carrera — interfaz, ranking y tarjeta compartible (plan de implementación)

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usar
> superpowers:subagent-driven-development (recomendado) o
> superpowers:executing-plans para implementar este plan tarea por tarea. Los
> pasos usan casillas (`- [ ]`) para el seguimiento.

**Goal:** Poner el simulador de carrera de rugbier en el hub de `/juegos`: el
juego jugable completo, «Camino al XV» reconvertido en paso de creación, los
clubes reales de URBA con su división, y el cierre con tarjeta compartible,
comparación y publicación a un ranking híbrido (apodo hoy, cuenta cuando exista
el Hito 10).

**Architecture:** El motor puro ya está terminado en
`packages/domain/src/career/` y este plan **no lo reescribe**: la interfaz se
escribe contra sus firmas reales (ver «Firmas del motor» abajo). El flujo nuevo
vive en tres capas:

- `packages/domain`: dos funciones puras nuevas que conectan el juego con el
  motor (mapeo de rol de «Camino al XV» a posición, y reproducción de una
  carrera desde semilla + decisiones).
- `packages/database` + `apps/api`: una tabla de publicaciones al ranking, un
  repositorio y cuatro rutas (`/v1/career/clubs`, `POST/GET
  /v1/career/entries`, `GET /v1/career/entries/:id`).
- `apps/web`: un componente por juego (el hub deja de ser un monolito), la
  carrera jugable con persistencia en `sessionStorage`, la tarjeta compartible
  y la publicación al ranking con apodo.

**Tech Stack:** TypeScript estricto, Vitest, Drizzle, Fastify, Next.js App
Router, Testing Library.

## Firmas reales del motor (no inventar otras)

Todo lo que la interfaz consuma del motor sale de `packages/domain/src/career/`:

- `createCareer(input: { surname: string; position: CareerPosition; clubSlug: string; catalog: CareerCatalog }, rng: Rng): CareerState`
- `simulateSeason(state: CareerState, rng: Rng): CareerState`
- `pickScenario(state: CareerState, rng: Rng): ScenarioPrompt | null`
- `applyOption(state: CareerState, option: ScenarioOption): CareerState`
- `shouldRetire(state: CareerState, rng: Rng): boolean`
- `summarizeCareer(state: CareerState): CareerSummary` (con `tier`, `verdict`,
  `score`, `comparison`, `seasons`, `clubs`, `peakLevel`)
- `createSeededRng(seed: number): Rng`
- `FALLBACK_CATALOG`, `CareerClub { slug, name, level, badgeUrl }`,
  `CareerPosition` (10 puestos), `CareerState`, `SeasonRecord`

## El orden del azar (contrato de reproducibilidad)

La tarjeta compartida promete: misma semilla y mismas decisiones, misma
historia. Eso exige fijar el orden en que el bucle consume el RNG. Este plan lo
fija así y la tarea 1 lo prueba:

```
rng = createSeededRng(seed)
state = createCareer({ surname, position, clubSlug, catalog }, rng)   // 4 números
loop:
  if shouldRetire(state, rng) break                                  // 0 o 1 número
  prompt = pickScenario(state, rng)                                  // 1 número
  state = applyOption(state, prompt.options[decision])               // 0 números
  state = simulateSeason(state, rng)                                 // 1 número
```

La UI pausa después de `pickScenario` para esperar la decisión; `decisions` es
la lista de índices elegidos, en orden. `replayCareer` ejecuta el mismo bucle de
forma síncrona y debe dar exactamente el mismo estado final.

## Global Constraints

- TDD obligatorio: prueba primero, verificar que falla, después implementar.
- TypeScript estricto: sin `any`, sin aserciones que apaguen el verificador.
- `packages/domain/src/career` sigue sin `Math.random` ni dependencias externas
  (la guardia `purity.test.ts` ya la aplica). En `apps/web` el azar global para
  **elegir la semilla inicial** sí está permitido: la pureza se exige en el
  motor, no en la interfaz.
- El motor de carrera ya aprobado no se reescribe: si una regla del juego
  necesita un cambio, se documenta en «Notas de revisión» y se evalúa aparte.
- El apodo se valida en el servidor (largo máximo y filtro de contenido) y hay
  límite de publicaciones por origen: nadie spamea la tabla.
- No se guarda ningún dato personal: apodo, puntaje, resumen de trayectoria,
  semilla y decisiones. Nada más.
- Sin datos de menores; sin atribuir estadísticas inventadas a personas reales.
- Usar `corepack pnpm` — `pnpm` no está en el PATH.
- Nunca `vitest` suelto desde la raíz. Correr por paquete.
- Cierre de cada tarea: correr las pruebas del paquete afectado y commit.

## Especificación de referencia

`docs/superpowers/specs/2026-07-30-career-simulator-design.md` (interfaz,
ranking híbrido, tarjeta, reconversión de «Camino al XV»).
`docs/superpowers/specs/2026-07-30-authentication-design.md` (por qué la vía
con cuenta queda preparada sin implementarse: el Hito 10 aún no existe).

## Estructura de archivos

| Archivo | Paquete | Responsabilidad |
|---|---|---|
| `domain/src/career/replay.ts` | domain | `replayCareer`: reproduce la carrera desde semilla + decisiones |
| `domain/src/career/replay.test.ts` | domain | pruebas del contrato de reproducibilidad |
| `domain/src/games.ts` (mod) | domain | `roleToCareerPosition`: conecta «Camino al XV» con la carrera |
| `domain/src/games.test.ts` (mod) | domain | pruebas del mapeo de rol a posición |
| `database/src/schema.ts` (mod) | database | tabla `career_entries` |
| `database/drizzle/NNNN_*.sql` (nueva) | database | migración de `career_entries` |
| `database/src/repositories/career-repository.ts` | database | insert, listado, detalle y conteo por origen |
| `database/src/repositories/career-repository.test.ts` | database | pruebas del repositorio |
| `database/src/repositories/index.ts` (mod) | database | export del repo |
| `api/src/schemas.ts` (mod) | api | zod del apodo y de la publicación |
| `api/src/create-app.ts` (mod) | api | rutas `/v1/career/*` |
| `api/src/app.test.ts` (mod) | api | pruebas de las rutas |
| `web/src/lib/api/types.ts` (mod) | web | tipos `ApiCareerClub`, `ApiCareerEntry` |
| `web/src/lib/api/client.ts` (mod) | web | `fetchCareerClubs`, `fetchCareerRanking`, `publishCareerEntry`, `fetchCareerEntry` |
| `web/src/features/games/games-hub.tsx` (mod) | web | índice del hub (tres tarjetas) |
| `web/src/features/games/identity-game.tsx` | web | «Tu identidad ovalada» (extraído sin cambios) |
| `web/src/features/games/xv-path.tsx` | web | «Camino al XV»: revela el puesto al confirmar |
| `web/src/features/games/career-game.tsx` | web | la carrera: creación, bucle, cierre |
| `web/src/features/games/career-card.tsx` | web | tarjeta compartible (tier, timeline, comparación, score) |
| `web/src/features/games/use-career-run.ts` | web | estado del bucle con `sessionStorage` |
| `web/src/features/games/use-career-clubs.ts` | web | catálogo real con fallback al de reserva |
| `web/src/features/games/use-career-ranking.ts` | web | ranking y publicación |
| `web/src/features/games/games-hub.test.tsx` | web | pruebas UI del hub |
| `web/src/features/games/xv-path.test.tsx` | web | pruebas UI de «Camino al XV» |
| `web/src/features/games/career-game.test.tsx` | web | pruebas UI del recorrido completo |
| `web/app/juegos/carrera/[id]/page.tsx` | web | tarjeta compartible pública (server component) |

---

### Task 1: Conectar «Camino al XV» con el motor y garantizar la reproducción

**Files:**
- Modificar: `packages/domain/src/games.ts` y `packages/domain/src/games.test.ts`
- Crear: `packages/domain/src/career/replay.ts` y `packages/domain/src/career/replay.test.ts`

**Interfaces:**
- Produce: `roleToCareerPosition(role: string): CareerPosition | null` en
  `games.ts`, y `replayCareer(input: CareerReplayInput): CareerState` en
  `career/replay.ts`.

**Decisión:** «Camino al XV» devuelve hoy cuatro roles legibles (`chooseCareerOutcome`).
El motor trabaja con las diez `CareerPosition`. El mapeo de los cuatro roles a
posiciones del motor vive en el dominio (regla pura, testeable): «Tercera línea
de impacto» → `ala`, «Wing definidor» → `wing`, «Apertura conductor» →
`apertura`, «Centro completo» → `centro`; cualquier otro rol → `null` (la UI
pide elegir posición manualmente).

- [ ] **Step 1: Escribir las pruebas que fallan**

En `packages/domain/src/games.test.ts`:

```typescript
import { roleToCareerPosition } from './games';

describe('roleToCareerPosition', () => {
  it('mapea los cuatro roles de Camino al XV a posiciones del motor', () => {
    expect(roleToCareerPosition('Tercera línea de impacto')).toBe('ala');
    expect(roleToCareerPosition('Wing definidor')).toBe('wing');
    expect(roleToCareerPosition('Apertura conductor')).toBe('apertura');
    expect(roleToCareerPosition('Centro completo')).toBe('centro');
  });

  it('devuelve null para cualquier otro rol', () => {
    expect(roleToCareerPosition('Kicker')).toBeNull();
    expect(roleToCareerPosition('')).toBeNull();
  });
});
```

En `packages/domain/src/career/replay.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';
import { createCareer } from './create';
import { simulateSeason } from './season';
import { pickScenario, applyOption } from './scenarios';
import { shouldRetire } from './retirement';
import { replayCareer } from './replay';
import type { CareerCatalog, CareerState } from './types';

const catalog: CareerCatalog = {
  clubs: [
    { slug: 'bajo', name: 'Bajo', level: 4, badgeUrl: null },
    { slug: 'alto', name: 'Alto', level: 1, badgeUrl: null },
  ],
};

/** El mismo bucle que la UI ejecutará, sincrónico y con decisiones prefijadas. */
function interactiva(input: { surname: string; position: 'centro'; clubSlug: string; catalog: CareerCatalog; seed: number; decisions: number[] }): CareerState {
  const rng = createSeededRng(input.seed);
  let state = createCareer({ surname: input.surname, position: input.position, clubSlug: input.clubSlug, catalog: input.catalog }, rng);
  for (const decision of input.decisions) {
    if (shouldRetire(state, rng)) break;
    const prompt = pickScenario(state, rng);
    if (!prompt) { state = simulateSeason(state, rng); continue; }
    state = applyOption(state, prompt.options[Math.min(decision, prompt.options.length - 1)]!);
    state = simulateSeason(state, rng);
  }
  return state;
}

describe('replayCareer', () => {
  const base = { surname: 'Pérez', position: 'centro' as const, clubSlug: 'bajo', catalog };

  it('reproduce exactamente la carrera interactiva con las mismas decisiones', () => {
    const decisions = [0, 1, 0, 1, 1, 0, 0, 1];
    const esperado = interactiva({ ...base, seed: 42, decisions });
    const actual = replayCareer({ ...base, seed: 42, decisions });
    expect(actual).toEqual(esperado);
  });

  it('es determinística: mismo input, mismo estado', () => {
    const a = replayCareer({ ...base, seed: 7, decisions: [0, 1, 0] });
    const b = replayCareer({ ...base, seed: 7, decisions: [0, 1, 0] });
    expect(a).toEqual(b);
  });

  it('una carrera completa siempre termina: decisiones acotadas, sin bucle infinito', () => {
    const decisions = new Array(60).fill(0);
    const state = replayCareer({ ...base, seed: 99, decisions });
    expect(state.history.length).toBeGreaterThan(0);
    expect(state.retired || state.age > 35).toBe(true);
  });

  it('reproduce también el retiro: terminar antes de agotar las decisiones', () => {
    const state = replayCareer({ ...base, seed: 5, decisions: new Array(80).fill(1) });
    expect(state.history.length).toBeLessThan(80);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/domain exec vitest run src/games.test.ts src/career/replay.test.ts
```

Esperado: FAIL por importaciones sin resolver (`roleToCareerPosition`,
`./replay`).

- [ ] **Step 3: Implementar el mapeo de rol**

En `packages/domain/src/games.ts` (importando `CareerPosition` desde
`./career/types.js`):

```typescript
import type { CareerPosition } from './career/types.js';

const ROLE_TO_POSITION: Record<string, CareerPosition> = {
  'Tercera línea de impacto': 'ala',
  'Wing definidor': 'wing',
  'Apertura conductor': 'apertura',
  'Centro completo': 'centro',
};

/**
 * Conecta «Camino al XV» con la carrera: el rol que devuelve `chooseCareerOutcome`
 * se convierte en la posición inicial del jugador en el simulador.
 */
export function roleToCareerPosition(role: string): CareerPosition | null {
  return ROLE_TO_POSITION[role] ?? null;
}
```

- [ ] **Step 4: Implementar la reproducción**

Crear `packages/domain/src/career/replay.ts`:

```typescript
import { applyOption } from './scenarios.js';
import { createCareer } from './create.js';
import { pickScenario } from './scenarios.js';
import { shouldRetire } from './retirement.js';
import { createSeededRng } from './rng.js';
import { simulateSeason } from './season.js';
import type { CareerCatalog, CareerPosition, CareerState } from './types.js';

export interface CareerReplayInput {
  surname: string;
  position: CareerPosition;
  clubSlug: string;
  catalog: CareerCatalog;
  seed: number;
  /** Índices de opciones elegidas, en orden. El contrato está en el plan. */
  decisions: readonly number[];
}

/**
 * Reproduce una carrera completa a partir de la semilla y las decisiones.
 * Es el mismo bucle que la interfaz ejecuta interactivamente: misma semilla y
 * mismas decisiones producen exactamente la misma historia.
 */
export function replayCareer(input: CareerReplayInput): CareerState {
  const rng = createSeededRng(input.seed);
  let state = createCareer(
    { surname: input.surname, position: input.position, clubSlug: input.clubSlug, catalog: input.catalog },
    rng,
  );
  for (const decision of input.decisions) {
    if (shouldRetire(state, rng)) break;
    const prompt = pickScenario(state, rng);
    if (!prompt) {
      state = simulateSeason(state, rng);
      continue;
    }
    const option = prompt.options[Math.min(decision, prompt.options.length - 1)]!;
    state = applyOption(state, option);
    state = simulateSeason(state, rng);
  }
  return state;
}
```

- [ ] **Step 5: Correr y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/domain test
```

Esperado: PASS, incluidas las 96 pruebas previas del paquete.

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/games.ts packages/domain/src/games.test.ts packages/domain/src/career/replay.ts packages/domain/src/career/replay.test.ts
git commit -m "feat(domain): conectar Camino al XV con la carrera y reproducir la carrera por semilla y decisiones"
```

---

### Task 2: Tabla del ranking y repositorio

**Files:**
- Modificar: `packages/database/src/schema.ts`
- Crear: `packages/database/src/repositories/career-repository.ts` y
  `packages/database/src/repositories/career-repository.test.ts`
- Modificar: `packages/database/src/repositories/index.ts`

**Interfaces:**
- Produce: tabla `careerEntries` y el repositorio
  `insertCareerEntry(db, input)`, `listCareerEntries(db, { limit })`,
  `findCareerEntryById(db, id)`,
  `countRecentEntriesByOrigin(db, originKey, since)`.

**Diseño de la tabla:** guarda el resumen de la trayectoria publicado, la
semilla y las decisiones (para la tarjeta reproducible), y el apodo o usuario.
Sin datos personales adicionales. `userId` es nullable: hoy nadie tiene sesión;
cuando exista el Hito 10, la vía con cuenta lo puebla sin cambiar la tabla.

- [ ] **Step 1: Escribir la prueba del repositorio (falla)**

En `packages/database/src/repositories/career-repository.test.ts`, con el
patrón de `repositories.test.ts` (base de test real, `truncateAll`):

```typescript
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from '../client.js';
import { makeTeam } from '../test-support/index.js';
import { getTestDatabase, isDatabaseAvailable, truncateAll } from '../test-support/index.js';
import { createUser } from './users-repository.js';
import { countRecentEntriesByOrigin, findCareerEntryById, insertCareerEntry, listCareerEntries } from './career-repository.js';

const available = await isDatabaseAvailable();

describe.skipIf(!available)('career_entries', () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    handle = await getTestDatabase();
    await truncateAll(handle);
  });

  afterAll(async () => {
    if (available) await handle.pool.end().catch(() => undefined);
  });

  const entry = {
    score: 850,
    displayName: 'TercerTiempo',
    summary: {
      tier: 'Gloria amateur',
      verdict: 'Una vida de rugby amateur.',
      score: 850,
      comparison: { figure: 'Hugo Porta', reason: 'Tu carrera se parece a la de Hugo Porta.' },
      seasons: 14,
      clubs: ['Bajo'],
      peakLevel: 4,
    },
    history: [{ season: 1, age: 18, clubSlug: 'bajo', clubName: 'Bajo', level: 4, rating: 62, note: 'Temporada sólida.' }],
    surname: 'Pérez',
    position: 'centro',
    clubSlug: 'bajo',
    seed: 42,
    decisions: [0, 1, 0],
    originKey: 'abc123',
  };

  it('inserta y recupera una entrada por id', async () => {
    const { db } = handle;
    const created = await insertCareerEntry(db, entry);
    const found = await findCareerEntryById(db, created.id);
    expect(found).not.toBeNull();
    expect(found!.displayName).toBe('TercerTiempo');
    expect(found!.score).toBe(850);
    expect(found!.seed).toBe(42);
    expect(found!.decisions).toEqual([0, 1, 0]);
  });

  it('lista las entradas ordenadas por puntaje descendente', async () => {
    const { db } = handle;
    await insertCareerEntry(db, { ...entry, score: 500, displayName: 'Bajo' });
    await insertCareerEntry(db, { ...entry, score: 900, displayName: 'Alto' });
    const rows = await listCareerEntries(db, { limit: 10 });
    expect(rows.map((r) => r.displayName)).toEqual(['Alto', 'Bajo']);
  });

  it('cuenta las publicaciones recientes por origen para el límite de frecuencia', async () => {
    const { db } = handle;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await insertCareerEntry(db, { ...entry, originKey: 'mismo-origen' });
    await insertCareerEntry(db, { ...entry, originKey: 'mismo-origen', displayName: 'Otro' });
    await insertCareerEntry(db, { ...entry, originKey: 'otro-origen' });
    expect(await countRecentEntriesByOrigin(db, 'mismo-origen', since)).toBe(2);
    expect(await countRecentEntriesByOrigin(db, 'otro-origen', since)).toBe(1);
  });

  it('acepta userId y guarda el nombre del usuario como displayName', async () => {
    const { db } = handle;
    const user = await createUser(db, { email: 'jugador@mail.com', displayName: 'Jugador de Varela' });
    const created = await insertCareerEntry(db, { ...entry, displayName: 'Jugador de Varela', userId: user.id });
    expect(created.userId).toBe(user.id);
  });
});
```

Verificar la firma real de `createUser` en `users-repository.ts` antes de fijar
el test; si difiere, adaptar el test a la firma real (no al revés).

- [ ] **Step 2: Correr y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/database exec vitest run src/repositories/career-repository.test.ts
```

Esperado: FAIL por importaciones sin resolver.

- [ ] **Step 3: Agregar la tabla al schema**

En `packages/database/src/schema.ts`, al final de la sección de tablas
(importando `type CareerSummary, type SeasonRecord` de `@ovalia/domain` en la
parte de tipos):

```typescript
// --- Simulador de carrera (publicaciones al ranking) ---

export const careerEntries = pgTable('career_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  score: integer('score').notNull(),
  displayName: text('display_name').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  summary: jsonb('summary').notNull().$type<CareerSummary>(),
  history: jsonb('history').notNull().$type<SeasonRecord[]>(),
  surname: text('surname').notNull(),
  position: text('position').notNull(),
  clubSlug: text('club_slug').notNull(),
  seed: integer('seed').notNull(),
  decisions: jsonb('decisions').notNull().$type<number[]>(),
  originKey: text('origin_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index('career_entries_score_idx').on(table.score),
  index('career_entries_origin_idx').on(table.originKey, table.createdAt),
]);
```

Generar la migración:

```bash
corepack pnpm --filter @ovalia/database generate
```

Verificar que aparece un archivo `NNNN_*.sql` nuevo en
`packages/database/drizzle/` con el `CREATE TABLE career_entries`.

- [ ] **Step 4: Implementar el repositorio**

Crear `packages/database/src/repositories/career-repository.ts`:

```typescript
import { and, desc, eq, gte } from 'drizzle-orm';
import type { Database } from '../client.js';
import { careerEntries } from '../schema.js';

export interface CareerEntryInput {
  score: number;
  displayName: string;
  userId?: string | null;
  summary: unknown;
  history: unknown;
  surname: string;
  position: string;
  clubSlug: string;
  seed: number;
  decisions: number[];
  originKey?: string | null;
}

export function insertCareerEntry(db: Database, input: CareerEntryInput) {
  return db
    .insert(careerEntries)
    .values({
      score: input.score,
      displayName: input.displayName,
      userId: input.userId ?? null,
      summary: input.summary,
      history: input.history,
      surname: input.surname,
      position: input.position,
      clubSlug: input.clubSlug,
      seed: input.seed,
      decisions: input.decisions,
      originKey: input.originKey ?? null,
    })
    .returning()
    .then((rows) => rows[0]!);
}

export function listCareerEntries(db: Database, { limit }: { limit: number }) {
  return db
    .select()
    .from(careerEntries)
    .orderBy(desc(careerEntries.score), desc(careerEntries.createdAt))
    .limit(limit);
}

export function findCareerEntryById(db: Database, id: string) {
  return db.select().from(careerEntries).where(eq(careerEntries.id, id)).limit(1).then((rows) => rows[0] ?? null);
}

export function countRecentEntriesByOrigin(db: Database, originKey: string, since: Date) {
  return db
    .select({ count: count() })
    .from(careerEntries)
    .where(and(eq(careerEntries.originKey, originKey), gte(careerEntries.createdAt, since)))
    .then((rows) => rows[0]?.count ?? 0);
}
```

> Nota: `count()` se importa de `drizzle-orm` (`import { count } from 'drizzle-orm'`).

Agregar al final de `packages/database/src/repositories/index.ts`:

```typescript
export * from './career-repository.js';
```

- [ ] **Step 5: Correr y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/database test
```

Esperado: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/database/src/schema.ts packages/database/src/repositories/career-repository.ts packages/database/src/repositories/career-repository.test.ts packages/database/src/repositories/index.ts packages/database/drizzle
git commit -m "feat(database): tabla y repositorio del ranking de carreras"
```

---

### Task 3: Rutas del catálogo y del ranking

**Files:**
- Modificar: `apps/api/src/schemas.ts` y `apps/api/src/create-app.ts`
- Modificar: `apps/api/src/app.test.ts`

**Interfaces:**
- Produce: schemas `careerClubsQuerySchema` (sin parámetros por ahora),
  `careerEntryInputSchema`, `careerListQuerySchema`; rutas
  `GET /v1/career/clubs`, `POST /v1/career/entries`,
  `GET /v1/career/entries`, `GET /v1/career/entries/:id`.

**Diseño del catálogo real:** el nivel de división no vive en la base (la tabla
`teams` no tiene `level`); se deriva de las competencias. El orden de las
divisiones de URBA es fijo y curado:

```typescript
const URBA_DIVISION_LEVEL: Record<string, number> = {
  'urba-top-14': 1,
  'urba-primera-a': 2,
  'urba-primera-b': 3,
  'urba-primera-c': 4,
  'urba-segunda': 5,
  'urba-tercera': 6,
  'urba-desarrollo': 7,
};
```

Para cada competencia con slug en ese mapa: `getLatestSeason` → `getStandingsForSeason`
→ los equipos de esa división. Si un club aparece en más de una división, se
queda con el nivel más alto (número menor). Si la base no tiene datos, la ruta
devuelve `{ clubs: [] }` y la web usa el catálogo de reserva del dominio: el
juego nunca se rompe.

**Diseño de la publicación:** la web envía `{ displayName, score, summary,
history, surname, position, clubSlug, seed, decisions, originKey }`. El apodo
se valida con zod (largo 1-24, sin caracteres de control ni URLs) y el servidor
aplica el límite de 3 publicaciones por `originKey` en 24 h. La vía con cuenta
del Hito 10 está preparada en la tabla (`userId` nullable); cuando exista el
plugin de sesión, el handler poblará `userId` desde la sesión en vez del apodo
del body, sin cambiar la ruta.

- [ ] **Step 1: Escribir las pruebas que fallan**

Agregar en `apps/api/src/app.test.ts` (mismo patrón de `seedCompetition` que ya
usa el archivo):

```typescript
describe('career', () => {
  it('arma el catálogo de clubes con su división desde las competencias', async () => {
    const { db } = handle;
    const top14 = await makeCompetition(db, { slug: 'urba-top-14', name: 'URBA Top 14' });
    const primeraB = await makeCompetition(db, { slug: 'urba-primera-b', name: 'URBA Primera B' });
    const seasonTop = await makeSeason(db, top14.id, { year: 2026 });
    const seasonB = await makeSeason(db, primeraB.id, { year: 2026 });
    const sic = await makeTeam(db, { slug: 'sic', name: 'SIC', badgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png' });
    const bajo = await makeTeam(db, { slug: 'club-bajo', name: 'Club Bajo' });
    await replaceStandings(db, seasonTop.id, [{ teamId: sic.id, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, bonus: 0, points: 0 }], 'urba');
    await replaceStandings(db, seasonB.id, [{ teamId: bajo.id, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, bonus: 0, points: 0 }], 'urba');

    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/career/clubs' });
    expect(res.statusCode).toBe(200);
    const clubs = res.json().clubs;
    expect(clubs).toContainEqual({ slug: 'sic', name: 'SIC', level: 1, badgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png' });
    expect(clubs).toContainEqual({ slug: 'club-bajo', name: 'Club Bajo', level: 3, badgeUrl: null });
  });

  it('publica una entrada al ranking con apodo', async () => {
    const app = makeAppFor();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/career/entries',
      payload: {
        displayName: 'TercerTiempo',
        score: 850,
        summary: { tier: 'Gloria amateur', verdict: 'V', score: 850, comparison: { figure: 'Hugo Porta', reason: 'R' }, seasons: 14, clubs: ['SIC'], peakLevel: 1 },
        history: [],
        surname: 'Pérez',
        position: 'centro',
        clubSlug: 'sic',
        seed: 42,
        decisions: [0, 1],
        originKey: 'a'.repeat(64),
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().entry.displayName).toBe('TercerTiempo');
  });

  it('rechaza un apodo inválido', async () => {
    const app = makeAppFor();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/career/entries',
      payload: {
        displayName: '  ',
        score: 1,
        summary: { tier: 't', verdict: 'v', score: 1, comparison: { figure: 'f', reason: 'r' }, seasons: 1, clubs: [], peakLevel: 9 },
        history: [],
        surname: 'Pérez',
        position: 'centro',
        clubSlug: 'sic',
        seed: 1,
        decisions: [],
        originKey: 'a'.repeat(64),
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid_career_entry');
  });

  it('corta por límite de publicaciones por origen', async () => {
    const app = makeAppFor();
    const base = {
      score: 100, displayName: 'X', originKey: 'b'.repeat(64),
      summary: { tier: 't', verdict: 'v', score: 100, comparison: { figure: 'f', reason: 'r' }, seasons: 1, clubs: [], peakLevel: 9 },
      history: [], surname: 'P', position: 'centro', clubSlug: 'sic', seed: 1, decisions: [],
    };
    for (let i = 0; i < 3; i += 1) {
      const ok = await app.inject({ method: 'POST', url: '/v1/career/entries', payload: { ...base, displayName: `X${i}` } });
      expect(ok.statusCode).toBe(201);
    }
    const res = await app.inject({ method: 'POST', url: '/v1/career/entries', payload: { ...base, displayName: 'X3' } });
    expect(res.statusCode).toBe(429);
    expect(res.json().error).toBe('too_many_career_posts');
  });

  it('lista el ranking ordenado por puntaje', async () => {
    const app = makeAppFor();
    const entry = { displayName: 'Pibe', score: 700, originKey: 'c'.repeat(64), summary: { tier: 't', verdict: 'v', score: 700, comparison: { figure: 'f', reason: 'r' }, seasons: 1, clubs: [], peakLevel: 9 }, history: [], surname: 'P', position: 'centro', clubSlug: 'sic', seed: 1, decisions: [] };
    await app.inject({ method: 'POST', url: '/v1/career/entries', payload: entry });
    await app.inject({ method: 'POST', url: '/v1/career/entries', payload: { ...entry, displayName: 'Duro', score: 900 } });
    const res = await app.inject({ method: 'GET', url: '/v1/career/entries?limit=10' });
    expect(res.statusCode).toBe(200);
    expect(res.json().entries.map((e: { displayName: string }) => e.displayName)).toEqual(['Duro', 'Pibe']);
  });

  it('devuelve el detalle de una entrada para la tarjeta compartible', async () => {
    const app = makeAppFor();
    const created = await app.inject({ method: 'POST', url: '/v1/career/entries', payload: { displayName: 'Ídolo', score: 800, originKey: 'd'.repeat(64), summary: { tier: 't', verdict: 'v', score: 800, comparison: { figure: 'f', reason: 'r' }, seasons: 1, clubs: [], peakLevel: 9 }, history: [], surname: 'P', position: 'centro', clubSlug: 'sic', seed: 42, decisions: [0, 1] } });
    const id = created.json().entry.id;
    const res = await app.inject({ method: 'GET', url: `/v1/career/entries/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().entry.seed).toBe(42);
    expect(res.json().entry.decisions).toEqual([0, 1]);
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/api exec vitest run src/app.test.ts
```

Esperado: FAIL por rutas inexistentes.

- [ ] **Step 3: Implementar los schemas**

En `apps/api/src/schemas.ts`:

```typescript
// --- Simulador de carrera ---

const apodoSchema = z
  .string()
  .trim()
  .min(1, 'apodo vacío')
  .max(24, 'apodo demasiado largo')
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), 'caracteres de control no permitidos')
  .refine((value) => !/(https?:\/\/|www\.)/i.test(value), 'enlaces no permitidos');

const careerSummarySchema = z.object({
  tier: z.string().min(1),
  verdict: z.string().min(1),
  score: z.number().int().nonnegative(),
  comparison: z.object({ figure: z.string().min(1), reason: z.string().min(1) }),
  seasons: z.number().int().nonnegative(),
  clubs: z.array(z.string()),
  peakLevel: z.number().int().positive(),
});

const careerHistorySchema = z.array(
  z.object({
    season: z.number().int(),
    age: z.number().int(),
    clubSlug: z.string(),
    clubName: z.string(),
    level: z.number().int(),
    rating: z.number().int(),
    note: z.string(),
  }),
);

export const careerEntryInputSchema = z.object({
  displayName: apodoSchema,
  score: z.number().int().min(0).max(100_000),
  summary: careerSummarySchema,
  history: careerHistorySchema,
  surname: z.string().trim().min(1).max(40),
  position: z.enum(['pilar', 'hooker', 'segunda', 'ala', 'octavo', 'medio-scrum', 'apertura', 'centro', 'wing', 'fullback']),
  clubSlug: z.string().min(1).max(120),
  seed: z.number().int().min(0).max(4_294_967_295),
  decisions: z.array(z.number().int().nonnegative()).max(120),
  originKey: z.string().regex(/^[a-f0-9]{64}$/, 'originKey debe ser un hash sha256 hex'),
});
export type CareerEntryInput = z.infer<typeof careerEntryInputSchema>;

export const careerListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
```

> Decisión de diseño: el `originKey` viaja ya hasheado desde la web (sha-256 en
> hex). El servidor nunca recibe un identificador de dispositivo crudo: sin
> dato personal, con capacidad de límite.

- [ ] **Step 4: Implementar las rutas**

En `apps/api/src/create-app.ts`:

1. Importar del paquete de datos: `careerEntries` no, sino las funciones nuevas
   `insertCareerEntry`, `listCareerEntries`, `findCareerEntryById`,
   `countRecentEntriesByOrigin` (y reutilizar `getLatestSeason`,
   `getStandingsForSeason`, `findCompetitionBySlug`).
2. Importar `careerEntryInputSchema`, `careerListQuerySchema` desde `./schemas.js`.
3. Constante de divisiones y helper del catálogo (fuera de `configureApp` o
   dentro, pero puro):

```typescript
const URBA_DIVISION_LEVEL: Record<string, number> = {
  'urba-top-14': 1,
  'urba-primera-a': 2,
  'urba-primera-b': 3,
  'urba-primera-c': 4,
  'urba-segunda': 5,
  'urba-tercera': 6,
  'urba-desarrollo': 7,
};

const CAREER_PUBLISH_LIMIT = 3;
const CAREER_PUBLISH_WINDOW_MS = 24 * 60 * 60 * 1000;
```

4. Las cuatro rutas:

```typescript
// --- Simulador de carrera ---

app.get('/v1/career/clubs', async () => {
  const byLevel = new Map<string, { slug: string; name: string; level: number; badgeUrl: string | null }>();
  for (const [slug, level] of Object.entries(URBA_DIVISION_LEVEL)) {
    const competition = await findCompetitionBySlug(db, slug);
    if (!competition) continue;
    const season = await getLatestSeason(db, competition.id);
    if (!season) continue;
    const rows = await getStandingsForSeason(db, season.id);
    for (const row of rows) {
      const current = byLevel.get(row.teamSlug);
      if (!current || level < current.level) {
        byLevel.set(row.teamSlug, { slug: row.teamSlug, name: row.teamName, level, badgeUrl: row.teamBadgeUrl });
      }
    }
  }
  return { clubs: [...byLevel.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)) };
});

app.post('/v1/career/entries', async (request, reply) => {
  const parsed = careerEntryInputSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'invalid_career_entry', issues: parsed.error.issues });
  const data = parsed.data;

  // La vía con cuenta llega con el Hito 10: cuando el plugin de sesión exista,
  // este handler resuelve userId desde la sesión y deja de confiar en el apodo.
  const since = new Date(Date.now() - CAREER_PUBLISH_WINDOW_MS);
  const recent = await countRecentEntriesByOrigin(db, data.originKey, since);
  if (recent >= CAREER_PUBLISH_LIMIT) {
    return reply.code(429).send({ error: 'too_many_career_posts' });
  }

  const row = await insertCareerEntry(db, data);
  return reply.code(201).send({ entry: serializeCareerEntry(row) });
});

app.get('/v1/career/entries', async (request) => {
  const parsed = careerListQuerySchema.safeParse(request.query);
  const limit = parsed.success ? parsed.data.limit : 20;
  const rows = await listCareerEntries(db, { limit });
  return { entries: rows.map(serializeCareerEntry) };
});

app.get('/v1/career/entries/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const row = await findCareerEntryById(db, id);
  if (!row) return reply.code(404).send({ error: 'career_entry_not_found' });
  return { entry: serializeCareerEntry(row) };
});
```

Con un serializer acotado (mismos campos que la web necesita; el `history` solo
en el detalle, no en el listado):

```typescript
function serializeCareerEntry(row: Awaited<ReturnType<typeof insertCareerEntry>>) {
  return {
    id: row.id,
    score: row.score,
    displayName: row.displayName,
    summary: row.summary,
    surname: row.surname,
    position: row.position,
    clubSlug: row.clubSlug,
    seed: row.seed,
    decisions: row.decisions,
    createdAt: row.createdAt.toISOString(),
  };
}
```

> Si el listado necesita incluir `history` (para no hacer un viaje extra en la
> tarjeta), el serializer del detalle agrega `history: row.history`. Se prefiere
> el detalle con history y el listado sin él.

- [ ] **Step 5: Correr y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/api test
```

Esperado: PASS, incluidas las pruebas previas de la API.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/schemas.ts apps/api/src/create-app.ts apps/api/src/app.test.ts
git commit -m "feat(api): catalogo de clubes y ranking de carreras"
```

---

### Task 4: El hub deja de ser un monolito y «Camino al XV» pasa a ser creación

**Files:**
- Crear: `apps/web/src/features/games/identity-game.tsx`,
  `apps/web/src/features/games/xv-path.tsx`,
  `apps/web/src/features/games/games-hub.test.tsx`,
  `apps/web/src/features/games/xv-path.test.tsx`
- Modificar: `apps/web/src/features/games/games-hub.tsx`

**Interfaces:**
- Produce: `IdentityGame`, `XvPath` (ambos componentes client sin props de
  estado externo) y `GamesHub` reducido a índice con tres tarjetas:
  «Tu identidad ovalada», «Camino al XV» y «Carrera de rugbier».

**Comportamiento de «Camino al XV» corregido (spec):** los deslizadores ya no
muestran el resultado en vivo. Hay un botón «Descubrí tu puesto» que, al
confirmar, llama `chooseCareerOutcome` y revela el rol. Debajo, si
`roleToCareerPosition(rol)` devuelve una posición, aparece «Arrancar la carrera
con este puesto», que salta a la carrera con la posición prefijada (el hub
acepta un callback `onStartCareer(position?)`). Si el rol no mapea (no debería
pasar), el botón arranca sin posición y el paso de creación la pide.

- [ ] **Step 1: Escribir las pruebas del hub que fallan**

`apps/web/src/features/games/games-hub.test.tsx` (patrón Testing Library de la
web, ver `features/home/home-page.test.tsx`):

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GamesHub } from './games-hub';

describe('GamesHub', () => {
  it('muestra las tres tarjetas de juegos', () => {
    render(<GamesHub />);
    expect(screen.getByRole('button', { name: /Tu identidad ovalada/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Camino al XV/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Carrera de rugbier/i })).toBeTruthy();
  });

  it('abre la identidad ovalada desde el hub', async () => {
    render(<GamesHub />);
    await userEvent.click(screen.getByRole('button', { name: /Tu identidad ovalada/i }));
    expect(screen.getByText(/Con cinco minutos por jugar preferís/i)).toBeTruthy();
  });
});
```

`apps/web/src/features/games/xv-path.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { XvPath } from './xv-path';

describe('XvPath', () => {
  it('no revela el puesto antes de confirmar', () => {
    render(<XvPath onStartCareer={() => undefined} />);
    expect(screen.queryByText(/TU ROL/i)).toBeNull();
  });

  it('revela el puesto al confirmar', async () => {
    render(<XvPath onStartCareer={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: /Descubrí tu puesto/i }));
    expect(screen.getByText(/TU ROL/i)).toBeTruthy();
  });

  it('ofrece arrancar la carrera con el puesto elegido', async () => {
    const onStartCareer = vi.fn();
    render(<XvPath onStartCareer={onStartCareer} />);
    await userEvent.click(screen.getByRole('button', { name: /Descubrí tu puesto/i }));
    await userEvent.click(screen.getByRole('button', { name: /Arrancar la carrera/i }));
    expect(onStartCareer).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/web exec vitest run src/features/games
```

Esperado: FAIL por componentes inexistentes.

- [ ] **Step 3: Implementar**

1. Mover el código de la identidad a `identity-game.tsx` (idéntico
   comportamiento; exporta `IdentityGame`).
2. Crear `xv-path.tsx` con el nuevo comportamiento (revelación al confirmar,
   botón a la carrera usando `roleToCareerPosition`). Props:
   `{ onStartCareer: (position?: CareerPosition) => void }`.
3. Reducir `games-hub.tsx` a índice: estado `mode`, render de
   `IdentityGame`, `XvPath` (con `onStartCareer` que pasa a la carrera) y, en
   esta tarea, una tarjeta «Carrera de rugbier» que pasa a modo `career` con un
   placeholder temporal (`CareerGame` se implementa en la tarea 5; mientras
   tanto el botón puede no renderizarse o renderizar un «en construcción» que
   la tarea 5 reemplaza). Preferido: dejar el modo `career` preparado y que la
   tarea 5 monte `CareerGame`; no agregar texto de «en construcción» que luego
   haya que borrar — si la tarea 5 no existe aún en el árbol, el botón se
   deshabilita.

- [ ] **Step 4: Correr y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/web test
```

Esperado: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/games
git commit -m "feat(web): separar el hub en un componente por juego y convertir Camino al XV en paso de creacion"
```

---

### Task 5: La carrera jugable y la tarjeta compartible

**Files:**
- Crear: `apps/web/src/features/games/career-game.tsx`,
  `apps/web/src/features/games/career-card.tsx`,
  `apps/web/src/features/games/use-career-run.ts`,
  `apps/web/src/features/games/use-career-clubs.ts`,
  `apps/web/src/features/games/career-game.test.tsx`
- Modificar: `apps/web/src/features/games/games-hub.tsx` (montar `CareerGame`),
  `apps/web/src/lib/api/types.ts`, `apps/web/src/lib/api/client.ts`
- Crear: `apps/web/app/juegos/carrera/[id]/page.tsx`

**Interfaces:**
- Produce: `useCareerClubs(): { clubs: CareerClub[]; loading: boolean }` (fetch
  de `/v1/career/clubs`, fallback a `FALLBACK_CATALOG` del dominio),
  `useCareerRun` (estado del bucle con `sessionStorage`), `CareerGame`,
  `CareerCard`, y la página server `/juegos/carrera/[id]`.

**Contrato del bucle (de la tarea 1 y del plan):** la UI ejecuta exactamente el
bucle que `replayCareer` prueba. En cada iteración: evalúa `shouldRetire`;
si no retira, `pickScenario` y pausa para que el jugador elija; al elegir,
`applyOption` y `simulateSeason`. `decisions` se va acumulando. El estado
completo (`CareerState`), la semilla, el input de creación y `decisions` viven
en `sessionStorage` bajo `ovalia.career.run`; al recargar se reanuda.

**Persistencia en curso:** `sessionStorage` (spec: «La carrera en curso vive en
la sesión del navegador»). Al retirar, el estado queda en memoria del
componente para el cierre; al publicar, se limpia.

**Semilla inicial:** la web la elige con azar global (`Math.floor(Math.random()
* 2 ** 31)`). La pureza del motor es la que está protegida; elegir la semilla
es responsabilidad de la interfaz.

**Cierre:** `summarizeCareer` produce `tier`, `verdict`, `score`,
`comparison`. `CareerCard` muestra: tier, verdict, timeline del historial
(temporadas con rating y nota), clubes por los que pasó, mejor momento
(temporada de mayor rating), categoría máxima (`peakLevel`) y el score.
Botones: «Compartir» (copia la URL `/juegos/carrera/[id]` de la entrada ya
publicada) y «Jugar de nuevo» (semilla nueva).

**Tarjeta compartible:** página server `apps/web/app/juegos/carrera/[id]/page.tsx`
que fetchea `GET /v1/career/entries/:id` con `apiFetch` y renderiza
`CareerCard` con la entrada (misma tarjeta que ve quien jugó). Si no existe,
página de «carrera no encontrada». Nota: la URL es estable porque el servidor
guarda el resumen; la reproducibilidad (semilla + decisiones) queda garantizada
por el motor y por la tarea 1.

- [ ] **Step 1: Escribir las pruebas del recorrido que fallan**

`apps/web/src/features/games/career-game.test.tsx`. Para no depender de la red
ni de la base, el test mockea `fetchCareerClubs` (o el hook `useCareerClubs`) y
fija un RNG real vía la semilla de creación. Se prueban los tres momentos del
spec: creación, avance de temporada con decisión, resumen final con
publicación.

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FALLBACK_CATALOG } from '@ovalia/domain';
import { CareerGame } from './career-game';

vi.mock('./use-career-clubs', () => ({
  useCareerClubs: () => ({ clubs: FALLBACK_CATALOG.clubs, loading: false }),
}));

describe('CareerGame', () => {
  it('permite crear el jugador: apellido, club y posición', async () => {
    render(<CareerGame />);
    await userEvent.type(screen.getByLabelText(/Apellido/i), 'Pérez');
    await userEvent.click(screen.getByRole('button', { name: /Empezar la carrera/i }));
    expect(screen.getByText(/Pérez/i)).toBeTruthy();
  });

  it('avanza la temporada y muestra las decisiones del escenario', async () => {
    render(<CareerGame />);
    await userEvent.type(screen.getByLabelText(/Apellido/i), 'Pérez');
    await userEvent.click(screen.getByRole('button', { name: /Empezar la carrera/i }));
    // El primer escenario ofrece al menos dos opciones.
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2);
    await userEvent.click(screen.getAllByRole('button')[0]!);
    // El historial muestra la temporada jugada.
    expect(screen.getByText(/Temporada 1/i)).toBeTruthy();
  });

  it('cierra con tarjeta, puntaje y comparación', async () => {
    render(<CareerGame initialSeed={123} />);
    await userEvent.type(screen.getByLabelText(/Apellido/i), 'Pérez');
    await userEvent.click(screen.getByRole('button', { name: /Empezar la carrera/i }));
    // Se avanza eligiendo la primera opción hasta el retiro (tope de iteraciones).
    // El test itera hasta ver el cierre; `CareerGame` expone un botón
    // «Seguir»/opción para acelerar la prueba si hiciera falta.
    expect(await screen.findByText(/Ídolo eterno del club|Gloria amateur|Corazón rugbier|Leyenda|Profesional/i)).toBeTruthy();
    expect(screen.getByText(/Tu carrera se parece/i)).toBeTruthy();
  });
});
```

> Nota de implementación: el bucle tiene un tope de seguridad de temporadas
> (p. ej. 60) aunque `shouldRetire` ya garantiza que la carrera termina; el
> tope evita que un error de UI deje la pantalla colgada. La prueba del cierre
> usa el tope si el retiro tarda.

- [ ] **Step 2: Correr y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/web exec vitest run src/features/games/career-game.test.tsx
```

Esperado: FAIL por importaciones sin resolver.

- [ ] **Step 3: Tipos y cliente API de la web**

En `apps/web/src/lib/api/types.ts`:

```typescript
export interface ApiCareerClub {
  slug: string;
  name: string;
  level: number;
  badgeUrl: string | null;
}

export interface ApiCareerSummary {
  tier: string;
  verdict: string;
  score: number;
  comparison: { figure: string; reason: string };
  seasons: number;
  clubs: string[];
  peakLevel: number;
}

export interface ApiCareerSeasonRecord {
  season: number;
  age: number;
  clubSlug: string;
  clubName: string;
  level: number;
  rating: number;
  note: string;
}

export interface ApiCareerEntry {
  id: string;
  score: number;
  displayName: string;
  summary: ApiCareerSummary;
  surname: string;
  position: string;
  clubSlug: string;
  seed: number;
  decisions: number[];
  createdAt: string;
  history?: ApiCareerSeasonRecord[];
}
```

En `apps/web/src/lib/api/client.ts`:

```typescript
export function fetchCareerClubs(options?: ApiFetchOptions) {
  return apiFetch<{ clubs: ApiCareerClub[] }>('/v1/career/clubs', options);
}

export function publishCareerEntry(
  input: {
    displayName: string;
    score: number;
    summary: ApiCareerSummary;
    history: ApiCareerSeasonRecord[];
    surname: string;
    position: string;
    clubSlug: string;
    seed: number;
    decisions: number[];
    originKey: string;
  },
  options?: ApiFetchOptions,
) {
  return apiFetch<{ entry: ApiCareerEntry }>('/v1/career/entries', {
    method: 'POST',
    body: input,
    ...options,
  });
}

export function fetchCareerRanking(limit = 20, options?: ApiFetchOptions) {
  return apiFetch<{ entries: ApiCareerEntry[] }>(`/v1/career/entries?limit=${limit}`, options);
}

export function fetchCareerEntry(id: string, options?: ApiFetchOptions) {
  return apiFetch<{ entry: ApiCareerEntry }>(`/v1/career/entries/${encodeURIComponent(id)}`, options);
}
```

- [ ] **Step 4: Implementar los hooks**

`use-career-clubs.ts`:

```typescript
import { useEffect, useState } from 'react';
import { FALLBACK_CATALOG, type CareerClub } from '@ovalia/domain';
import { fetchCareerClubs } from '../../lib/api/client';

export function useCareerClubs(): { clubs: CareerClub[]; loading: boolean } {
  const [clubs, setClubs] = useState<CareerClub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchCareerClubs()
      .then(({ clubs: reales }) => {
        if (!alive) return;
        // El juego nunca se rompe: si no hay datos reales, catálogo de reserva.
        setClubs(reales.length > 0 ? reales : FALLBACK_CATALOG.clubs);
      })
      .catch(() => {
        if (alive) setClubs(FALLBACK_CATALOG.clubs);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { clubs, loading };
}
```

`use-career-run.ts`: guarda el estado en `sessionStorage` con clave
`ovalia.career.run`. Expone:

- `run: CareerRun | null` donde
  `CareerRun = { seed, input: { surname, position, clubSlug }, decisions, state }`
- `createRun(input, seed)`, `choose(optionIndex)`, `reset()`.

`choose` ejecuta el bucle de la tarea 1 contra el `state` actual, guarda el
nuevo `state` y el índice en `decisions`, y devuelve si la carrera se retiró
(para que `CareerGame` muestre el cierre). Al cargar, restaura desde
`sessionStorage` si existe.

- [ ] **Step 5: Implementar `CareerGame` y `CareerCard`**

`CareerGame` (client) con cuatro pantallas de estado interno:

1. **setup** (si no hay run): form con apellido (input), club (select del
   catálogo de `useCareerClubs`) y posición (select de las diez
   `CareerPosition`, prefijada por `roleToCareerPosition` si viene de
   «Camino al XV»). Botón «Empezar la carrera» → genera semilla, `createRun`.
2. **decision**: muestra el escenario (`pickScenario` ya llamado por el hook al
   quedar en este estado) con título, subtítulo y las opciones como botones.
   Al elegir → `choose(índice)`.
3. **season**: breve pantalla del resultado de la temporada (rating, nota del
   `history` recién agregado, edad) con botón «Siguiente temporada» que vuelve
   a evaluar `shouldRetire`.
4. **retired**: `summarizeCareer` → `CareerCard` + ranking (tarea 6) +
   publicación.

Para el flujo de la UI, el hook puede entregar el `prompt` del escenario actual
o exponer una función `next()` que devuelve `{ kind: 'decision' | 'season' |
'retired', ... }` — la prueba de la tarea exige que tras elegir una opción se
vea la temporada jugada y que al final haya tarjeta. La implementación elige el
detalle mientras cumpla el contrato del bucle.

`CareerCard` (presentacional, usa la entrada del ranking o el resumen en
memoria): tier, verdict, timeline, clubes, mejor momento, categoría máxima,
score, comparación.

- [ ] **Step 6: La tarjeta compartible**

`apps/web/app/juegos/carrera/[id]/page.tsx` (server component):

```typescript
import { fetchCareerEntry } from '../../../src/lib/api/client';
import { CareerCard } from '../../../src/features/games/career-card';

export default async function CareerCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { entry } = await fetchCareerEntry(id);
    return <CareerCard entry={entry} />;
  } catch {
    return <p>Esa carrera no existe o ya no está publicada.</p>;
  }
}
```

- [ ] **Step 7: Correr y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/web test
corepack pnpm --filter @ovalia/web exec tsc --noEmit
```

Esperado: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/games apps/web/src/lib/api apps/web/app/juegos
git commit -m "feat(web): carrera de rugbier jugable con tarjeta compartible"
```

---

### Task 6: Publicación al ranking con apodo y verificación integral

**Files:**
- Crear: `apps/web/src/features/games/use-career-ranking.ts`,
  `apps/web/src/features/games/career-ranking.tsx` (vista del top 10),
  `apps/web/src/features/games/career-ranking.test.tsx`
- Modificar: `apps/web/src/features/games/career-game.tsx` (montar la
  publicación y la vista de ranking en el cierre)

**Interfaces:**
- Produce: `useCareerRanking` con `top: ApiCareerEntry[]`,
  `publish({ displayName, run, summary })`, `myEntry: ApiCareerEntry | null` y
  `error`; y el componente `CareerRanking`.

**Diseño de la publicación:** al retirarse, el cierre ofrece «Publicar en el
ranking». Si no hay sesión (siempre hoy), pide un apodo (input, máx 24) y
publica con `publishCareerEntry` usando `originKey` = sha-256 del
`ovalia.visitorId` (UUID persistido en `localStorage`, creado si no existe).
Sobre `sha-256` en el navegador: usar `crypto.subtle.digest` (contexto seguro;
la PWA corre en HTTPS). Si `crypto.subtle` no está disponible, degradar a un
hash simple documentado — el servidor solo exige 64 hex, no verifica el
algoritmo. Tras publicar: `myEntry` se setea, el botón «Compartir» de la tarjeta
apunta a `/juegos/carrera/[id]`, y la vista de ranking muestra el top 10 con la
entrada del jugador resaltada. Si el servidor responde 429, el error muestra
«Ya publicaste muchas veces hoy» sin romper la pantalla.

**Cuándo llega el Hito 10:** este componente ya deja el contrato (userId en la
tabla); cuando exista el plugin de sesión, el POST usará la sesión y el apodo
dejará de pedirse. Ningún cambio de interfaz de este plan queda bloqueado por
eso.

- [ ] **Step 1: Escribir las pruebas que fallan**

`apps/web/src/features/games/career-ranking.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CareerRanking } from './career-ranking';

vi.mock('./use-career-ranking', () => ({
  useCareerRanking: () => ({
    top: [{ id: '1', score: 900, displayName: 'Duro', summary: { tier: 't', verdict: 'v', score: 900, comparison: { figure: 'f', reason: 'r' }, seasons: 1, clubs: [], peakLevel: 9 }, surname: 'P', position: 'centro', clubSlug: 'sic', seed: 1, decisions: [], createdAt: '' }],
    publish: vi.fn(),
    myEntry: null,
    error: null,
  }),
}));

describe('CareerRanking', () => {
  it('muestra el top del ranking', () => {
    render(<CareerRanking />);
    expect(screen.getByText('Duro')).toBeTruthy();
  });

  it('pide apodo para publicar y valida el campo', async () => {
    render(<CareerRanking />);
    await userEvent.click(screen.getByRole('button', { name: /Publicar en el ranking/i }));
    expect(screen.getByLabelText(/Apodo/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

```bash
corepack pnpm --filter @ovalia/web exec vitest run src/features/games/career-ranking.test.tsx
```

Esperado: FAIL por componentes inexistentes.

- [ ] **Step 3: Implementar**

`use-career-ranking.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import type { ApiCareerEntry, ApiCareerSummary } from '../../lib/api/types';
import { fetchCareerRanking, publishCareerEntry } from '../../lib/api/client';

export interface CareerRunPublish {
  displayName: string;
  surname: string;
  position: string;
  clubSlug: string;
  seed: number;
  decisions: number[];
  summary: ApiCareerSummary;
  history: ApiCareerSummary['seasons'] extends never ? never : unknown[];
}
```

> El tipo exacto de `history` es el del historial del estado del motor
> (`SeasonRecord[]` de `@ovalia/domain`); se tipa con el import del dominio en
> la implementación final.

```typescript
export function useCareerRanking() {
  const [top, setTop] = useState<ApiCareerEntry[]>([]);
  const [myEntry, setMyEntry] = useState<ApiCareerEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCareerRanking(10)
      .then(({ entries }) => setTop(entries))
      .catch(() => setTop([]));
  }, []);

  const publish = useCallback(async (input: {
    displayName: string;
    surname: string;
    position: string;
    clubSlug: string;
    seed: number;
    decisions: number[];
    summary: ApiCareerSummary;
    history: SeasonRecord[];
  }) => {
    setError(null);
    const visitorId = getVisitorId();
    const originKey = await hashVisitorId(visitorId);
    try {
      const { entry } = await publishCareerEntry({ ...input, originKey });
      setMyEntry(entry);
      const { entries } = await fetchCareerRanking(10);
      setTop(entries);
    } catch (err) {
      setError(err instanceof Error && err.message.includes('429') ? 'Ya publicaste muchas veces hoy. Volvé mañana.' : 'No se pudo publicar. Probá de nuevo.');
    }
  }, []);

  return { top, myEntry, error, publish };
}
```

> `getVisitorId` y `hashVisitorId` viven en el mismo archivo (o en
> `lib/visitor-id.ts`): el primero crea/lee el UUID de `localStorage`
> (`ovalia.visitorId`) y el segundo devuelve sha-256 hex, con degradación
> documentada si `crypto.subtle` no existe.

`CareerRanking`: vista del top 10 + botón «Publicar en el ranking» que abre un
form con apodo y publica; `myEntry` resaltada.

En `CareerGame`: en la pantalla `retired`, montar `CareerRanking` y pasar el
run y el summary; si `myEntry` existe, el botón «Compartir» copia la URL
`/juegos/carrera/${myEntry.id}`.

- [ ] **Step 4: Correr y verificar que pasan**

```bash
corepack pnpm --filter @ovalia/web test
corepack pnpm --filter @ovalia/web exec tsc --noEmit
```

Esperado: PASS.

- [ ] **Step 5: Verificación integral y commit**

```bash
corepack pnpm verify
corepack pnpm build
```

Esperado: ambos PASS en el monorepo.

```bash
git add apps/web/src/features/games
git commit -m "feat(web): publicar la carrera al ranking con apodo y ver el top"
```

---

## Notas de revisión del plan

**Cobertura del spec.** La tarjeta compartible, la comparación con figuras y el
puntaje ya los produce el motor (tarea 5 del plan del motor); este plan los
trae a la pantalla. El ranking híbrido queda preparado: hoy publica con apodo
anónimo y el Hito 10 lo completa sin tocar la tabla (`userId` nullable). «Camino
al XV» deja de revelar el resultado en vivo y pasa a ser el paso de creación.
El hub se separa en un componente por juego.

**Decisión tomada: la carrera no cambia de club todavía.** El motor aprobado no
tiene escenario que modifique `state.club`; los ascensos se expresan como nivel
de división en el rendimiento y el veredicto («Ídolo eterno del club») premia
quedarse. Los clubes del exterior (Europa/Súper Rugby) del spec quedan
**postergados** hasta que exista mecánica de pases; se agregan al catálogo
cuando el motor la tenga. Se documenta acá para que nadie los busque en esta
iteración.

**Decisión tomada: el nivel de división se deriva, no se persiste.** `teams` no
tiene columna `level` y no se agrega: el nivel sale de las competencias vigentes
(`urba-top-14` → 1 … `urba-desarrollo` → 7) en el momento en que se arma el
catálogo. Si el dato no está, el catálogo de reserva del dominio cubre el juego.

**Reproducibilidad.** El contrato del bucle (orden de consumo del RNG) queda
fijado y probado en la tarea 1 (`replayCareer`). La tarjeta pública renderiza el
resumen guardado; la re-encarnación interactiva completa (ver la carrera
reproducida paso a paso desde la tarjeta) queda fuera de esta iteración como
mejora futura.

**Tope de seguridad en la UI.** Aunque `shouldRetire` garantiza el final, el
bucle de `CareerGame` lleva un tope de 60 temporadas para que un error de UI no
deje la pantalla colgada.

**Sobre los límites de frecuencia.** El rate-limit global de Fastify (120/min)
ya existe; el límite por origen (3 en 24 h) es específico de la publicación y
usa un `originKey` hasheado para no guardar identificadores crudos.

**Sobre el hash del visitante.** La degradación de `crypto.subtle` está
documentada para no romper en contextos no seguros; el servidor solo exige
formato hex de 64 caracteres.
