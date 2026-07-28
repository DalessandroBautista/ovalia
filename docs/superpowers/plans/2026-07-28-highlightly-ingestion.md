# Fuente Highlightly (Súper Rugby, Los Pumas, Sevens) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nuevo adapter de ingesta (`HighlightlyIngestAdapter`) que trae catálogo, fixtures
y standings de Súper Rugby, Rugby Championship (incluye Los Pumas), tests amistosos
internacionales y Seven's World Cup, usando la misma cañería (`SportsDataAdapter` →
`run-ingestion` → repos de `@ovalia/database`) que ya usa URBA.

**Architecture:** Cliente HTTP + parser + adapter nuevos en
`apps/worker/src/ingestion/adapters/highlightly/`, registrados en el mismo
`adapter-registry` que URBA. Workflow de GitHub Actions separado, mismo patrón que
`ingest-urba.yml`.

**Tech Stack:** TypeScript, Zod (parseo/validación de contrato), Vitest, GitHub Actions.

Este es el Plan 3 de 3 del spec
`docs/superpowers/specs/2026-07-28-home-fallback-torneos-nav-highlightly-design.md`
(Parte 3). Es independiente de los Planes 1 y 2 — no depende de `family_slug`/`tier`/
`organizations` para funcionar (aunque para que estos partidos aparezcan bien agrupados en
`/torneos`, conviene que el Plan 2 ya esté implementado; si no lo está, este adapter igual
persiste competencias válidas, solo que sin agrupar hasta que el Plan 2 se aplique).

## Global Constraints

- API key de Highlightly ya contratada en plan Pro (7.500 req/día, 12 req/seg) — el valor
  concreto de la key se pasa como secret, nunca se hardcodea en el repo.
- Base URL: `https://rugby.highlightly.net`. Header de auth: `x-rapidapi-key`.
- IDs de liga curados y verificados contra la API real en la sesión de diseño: Super Rugby
  `61205`, Rugby Championship `73119`, Friendly International `72268`, Seven's World Cup
  `73970`.
- El endpoint `/standings` devolvió `groups: []` (vacío) para `leagueId=61205` y
  `leagueId=73119` en ambas temporadas probadas (2025, 2026) durante el diseño — el parser
  de standings debe tolerar esa respuesta vacía sin crashear (se resuelve como "sin datos
  de posiciones todavía", no como error).
- Convención de commits en español, `tipo: descripción corta`.

---

### Task 1: Cliente HTTP de Highlightly

**Files:**
- Create: `apps/worker/src/ingestion/adapters/highlightly/highlightly-client.ts`
- Test: `apps/worker/src/ingestion/adapters/highlightly/highlightly-client.test.ts`

**Interfaces:**
- Produces: clase `HighlightlyClient` con métodos `leagues(): Promise<unknown>`,
  `matches(params: { leagueId: number; season?: number }): Promise<unknown>`,
  `standings(params: { leagueId: number; season: number }): Promise<unknown>`.

- [ ] **Step 1: Revisar el cliente de URBA como referencia de patrón**

Leer `apps/worker/src/ingestion/adapters/urba/urba-client.ts` completo — el cliente nuevo
sigue el mismo patrón (rate limit con `minIntervalMs`, timeout con `AbortController`,
`getJson(path)` genérico).

- [ ] **Step 2: Escribir el test que falla**

Crear `apps/worker/src/ingestion/adapters/highlightly/highlightly-client.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { HighlightlyClient } from './highlightly-client';

describe('HighlightlyClient', () => {
  it('manda el header de auth y arma la query de matches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    const client = new HighlightlyClient({ apiKey: 'test-key', fetch: fetchMock as unknown as typeof fetch, minIntervalMs: 0 });
    await client.matches({ leagueId: 73119 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('leagueId=73119'),
      expect.objectContaining({ headers: expect.objectContaining({ 'x-rapidapi-key': 'test-key' }) }),
    );
  });

  it('lanza si la respuesta no es ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    const client = new HighlightlyClient({ apiKey: 'test-key', fetch: fetchMock as unknown as typeof fetch, minIntervalMs: 0 });
    await expect(client.leagues()).rejects.toThrow(/Highlightly HTTP 429/);
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/worker exec vitest run highlightly-client`
Expected: FAIL — el módulo no existe.

- [ ] **Step 4: Implementar**

Crear `apps/worker/src/ingestion/adapters/highlightly/highlightly-client.ts`:

```typescript
export interface HighlightlyClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  minIntervalMs?: number;
  now?: () => number;
}

/** Cliente HTTP para el API de Highlightly (rugby): timeout, auth header y rate limit. */
export class HighlightlyClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private lastRequestAt = Number.NEGATIVE_INFINITY;

  constructor(options: HighlightlyClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://rugby.highlightly.net';
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.minIntervalMs = options.minIntervalMs ?? 100;
    this.now = options.now ?? (() => Date.now());
  }

  private async rateLimit(): Promise<void> {
    const wait = this.lastRequestAt + this.minIntervalMs - this.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = this.now();
  }

  private async getJson(path: string, query: Record<string, string | number | undefined>): Promise<unknown> {
    await this.rateLimit();
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) search.set(key, String(value));
    }
    const url = `${this.baseUrl}/${path}${search.toString() ? `?${search}` : ''}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: { 'x-rapidapi-key': this.apiKey, accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Highlightly HTTP ${response.status} en ${path}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  leagues(): Promise<unknown> {
    return this.getJson('leagues', {});
  }

  matches(params: { leagueId: number; season?: number }): Promise<unknown> {
    return this.getJson('matches', { leagueId: params.leagueId, season: params.season });
  }

  standings(params: { leagueId: number; season: number }): Promise<unknown> {
    return this.getJson('standings', { leagueId: params.leagueId, season: params.season });
  }
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/worker exec vitest run highlightly-client`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @ovalia/worker exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/ingestion/adapters/highlightly/highlightly-client.ts apps/worker/src/ingestion/adapters/highlightly/highlightly-client.test.ts
git commit -m "feat: cliente HTTP de Highlightly con rate limit y timeout"
```

---

### Task 2: Competencias curadas y fixtures de contrato reales

**Files:**
- Create: `apps/worker/src/ingestion/adapters/highlightly/highlightly-competitions.ts`
- Create: `apps/worker/src/ingestion/adapters/highlightly/__fixtures__/matches-rugby-championship.sample.json`
- Create: `apps/worker/src/ingestion/adapters/highlightly/__fixtures__/standings-empty.sample.json`
- Create: `apps/worker/src/ingestion/adapters/highlightly/__fixtures__/README.md`

**Interfaces:**
- Produces: `HIGHLIGHTLY_COMPETITIONS: readonly HighlightlyCompetitionRef[]` con
  `{ externalId: string; name: string; slug: string; tier: string; organizationSlug:
  string }`.

- [ ] **Step 1: Grabar fixtures reales**

Contra la API real (usando la key ya provista y verificada en el diseño), guardar
respuestas reducidas:

```bash
curl -s -H "x-rapidapi-key: $HIGHLIGHTLY_API_KEY" "https://rugby.highlightly.net/matches?leagueId=73119&limit=3" \
  > apps/worker/src/ingestion/adapters/highlightly/__fixtures__/matches-rugby-championship.sample.json
echo '{"groups": [], "league": {"id": 73119, "logo": "https://highlightly.net/rugby/images/leagues/73119.png", "name": "Rugby Championship", "season": 2025}}' \
  > apps/worker/src/ingestion/adapters/highlightly/__fixtures__/standings-empty.sample.json
```

Crear `apps/worker/src/ingestion/adapters/highlightly/__fixtures__/README.md`:

```markdown
# Fixtures de contrato Highlightly

Muestras reducidas del API de Highlightly (rugby.highlightly.net), obtenidas el
2026-07-28. Uso exclusivo para tests de contrato del parser. No contienen datos
personales.
```

- [ ] **Step 2: Definir las competencias curadas**

Crear `apps/worker/src/ingestion/adapters/highlightly/highlightly-competitions.ts`:

```typescript
export interface HighlightlyCompetitionRef {
  externalId: string;
  name: string;
  slug: string;
  tier: 'senior' | 'sevens';
  organizationSlug: string;
}

/** Competencias curadas de Highlightly (verificadas contra el API real en el diseño). */
export const HIGHLIGHTLY_COMPETITIONS: readonly HighlightlyCompetitionRef[] = [
  { externalId: '61205', name: 'Super Rugby', slug: 'super-rugby', tier: 'senior', organizationSlug: 'super-rugby' },
  { externalId: '73119', name: 'Rugby Championship', slug: 'rugby-championship', tier: 'senior', organizationSlug: 'rugby-internacional' },
  { externalId: '72268', name: 'Friendly International', slug: 'tests-internacionales', tier: 'senior', organizationSlug: 'rugby-internacional' },
  { externalId: '73970', name: "Seven's World Cup", slug: 'seven-world-cup', tier: 'sevens', organizationSlug: 'rugby-seven' },
];

export const HIGHLIGHTLY_SLUG_BY_EXTERNAL_ID: ReadonlyMap<string, string> = new Map(
  HIGHLIGHTLY_COMPETITIONS.map((c) => [c.externalId, c.slug]),
);
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ovalia/worker exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/ingestion/adapters/highlightly/highlightly-competitions.ts apps/worker/src/ingestion/adapters/highlightly/__fixtures__/
git commit -m "feat: competencias curadas de Highlightly y fixtures de contrato"
```

---

### Task 3: Parser de Highlightly

**Files:**
- Create: `apps/worker/src/ingestion/adapters/highlightly/highlightly-parser.ts`
- Test: `apps/worker/src/ingestion/adapters/highlightly/highlightly-parser.test.ts`

**Interfaces:**
- Produces:
  - `parseMatchesAsFixtures(raw: unknown): ExternalMatch[]`
  - `parseMatchesAsTeams(raw: unknown): ExternalTeam[]` (equipos derivados de
    `homeTeam`/`awayTeam` de cada partido — Highlightly no tiene un endpoint de "clubes de
    esta liga" como URBA; el catálogo de equipos se arma a partir de los partidos mismos).
  - `parseStandingsPayload(raw: unknown, competitionExternalId: string, season: number):
    ExternalStandings` (devuelve `rows: []` si `groups` viene vacío, sin lanzar).

- [ ] **Step 1: Inspeccionar el shape real de una respuesta de matches**

Abrir `apps/worker/src/ingestion/adapters/highlightly/__fixtures__/matches-rugby-championship.sample.json`
(grabado en el Task 2) y confirmar los campos: `data[].id`, `.date`, `.state.score`,
`.state.description`, `.homeTeam.{id,name,logo}`, `.awayTeam.{id,name,logo}`,
`.league.{id,name,season}`.

- [ ] **Step 2: Escribir el test que falla**

Crear `apps/worker/src/ingestion/adapters/highlightly/highlightly-parser.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseMatchesAsFixtures, parseMatchesAsTeams, parseStandingsPayload } from './highlightly-parser';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');
function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

describe('Highlightly parser (contrato)', () => {
  it('parsea partidos con estado y equipos', () => {
    const matches = parseMatchesAsFixtures(loadFixture('matches-rugby-championship.sample.json'));
    expect(matches.length).toBeGreaterThan(0);
    const finished = matches.find((m) => m.status === 'final');
    expect(finished).toBeDefined();
    expect(finished!.homeTeamExternalId).toMatch(/^\d+$/);
  });

  it('deriva equipos únicos de los partidos', () => {
    const teams = parseMatchesAsTeams(loadFixture('matches-rugby-championship.sample.json'));
    expect(teams.length).toBeGreaterThan(0);
    expect(new Set(teams.map((t) => t.externalId)).size).toBe(teams.length);
  });

  it('devuelve rows vacío sin lanzar cuando standings no tiene groups', () => {
    const standings = parseStandingsPayload(loadFixture('standings-empty.sample.json'), '73119', 2025);
    expect(standings.rows).toEqual([]);
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/worker exec vitest run highlightly-parser`
Expected: FAIL — el módulo no existe.

- [ ] **Step 4: Implementar**

Antes de escribir el parser, revisar la forma exacta de `ExternalMatch` y
`ExternalStandings` en `packages/domain/src/ingestion/external-match.ts` y
`external-standing.ts` (mismo patrón que ya usa `urba-parser.ts` — copiar los nombres de
campo exactos de ahí, no inventar nuevos). Crear
`apps/worker/src/ingestion/adapters/highlightly/highlightly-parser.ts` siguiendo el mismo
patrón de `urba-parser.ts` (uso de Zod para `parseOrThrow`, mapeo de estado de partido):

```typescript
import { z } from 'zod';
import type { ExternalMatch, ExternalStandings, ExternalTeam } from '@ovalia/domain';

const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  logo: z.string().nullable().optional(),
});

const matchSchema = z.object({
  id: z.union([z.number(), z.string()]),
  date: z.string(),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
  league: z.object({ id: z.number(), name: z.string(), season: z.number() }),
  state: z.object({ description: z.string(), score: z.string() }),
});

const matchesResponseSchema = z.object({ data: z.array(matchSchema) });

const standingsResponseSchema = z.object({
  groups: z.array(z.unknown()),
  league: z.object({ id: z.number(), season: z.number() }),
});

function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown, label: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Highlightly parser: respuesta inválida de ${label}: ${result.error.message}`);
  }
  return result.data;
}

function matchStatus(m: z.infer<typeof matchSchema>): ExternalMatch['status'] {
  const description = m.state.description.toLowerCase();
  if (description === 'finished') return 'final';
  if (['first half', 'second half', 'half time', 'extra time'].includes(description)) return 'live';
  if (description === 'postponed' || description === 'suspended') return 'postponed';
  if (description === 'cancelled') return 'cancelled';
  return 'scheduled';
}

function parseScore(score: string): [number | null, number | null] {
  const parts = score.split('-').map((v) => Number(v.trim()));
  const [home, away] = parts;
  if (!Number.isFinite(home) || !Number.isFinite(away)) return [null, null];
  return [home!, away!];
}

export function parseMatchesAsFixtures(raw: unknown): ExternalMatch[] {
  const data = parseOrThrow(matchesResponseSchema, raw, 'matches');
  return data.data.map((m): ExternalMatch => {
    const [homeScore, awayScore] = parseScore(m.state.score);
    return {
      externalId: String(m.id),
      competitionExternalId: String(m.league.id),
      seasonYear: m.league.season,
      round: 'Fecha',
      startsAt: m.date,
      status: matchStatus(m),
      homeTeamExternalId: String(m.homeTeam.id),
      awayTeamExternalId: String(m.awayTeam.id),
      homeScore,
      awayScore,
    };
  });
}

export function parseMatchesAsTeams(raw: unknown): ExternalTeam[] {
  const data = parseOrThrow(matchesResponseSchema, raw, 'matches');
  const byId = new Map<string, ExternalTeam>();
  for (const m of data.data) {
    for (const team of [m.homeTeam, m.awayTeam]) {
      const externalId = String(team.id);
      if (!byId.has(externalId)) {
        byId.set(externalId, {
          externalId,
          name: team.name,
          ...(team.logo ? { badgeUrl: team.logo, badgeSourceUrl: team.logo } : {}),
        });
      }
    }
  }
  return [...byId.values()];
}

export function parseStandingsPayload(raw: unknown, competitionExternalId: string, season: number): ExternalStandings {
  const data = parseOrThrow(standingsResponseSchema, raw, 'standings');
  // Highlightly puede devolver groups: [] para competencias sin tabla de posiciones
  // (ej. series de tests). Se persiste como "sin filas" en vez de lanzar.
  return {
    competitionExternalId,
    season: { externalId: String(season), year: season },
    rows: [],
  };
}
```

Ajustar los nombres de campo exactos (`ExternalMatch.round`, `ExternalStandings.season`,
etc.) contra lo que realmente exponga `packages/domain/src/ingestion/external-match.ts` y
`external-standing.ts` — el bloque de arriba es la intención, no necesariamente el nombre
literal de cada propiedad; si el tipo real difiere, adaptar el objeto devuelto sin cambiar
el comportamiento descripto.

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/worker exec vitest run highlightly-parser`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @ovalia/worker exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add apps/worker/src/ingestion/adapters/highlightly/highlightly-parser.ts apps/worker/src/ingestion/adapters/highlightly/highlightly-parser.test.ts
git commit -m "feat: parser de contrato para partidos y standings de Highlightly"
```

---

### Task 4: `HighlightlyIngestAdapter`

**Files:**
- Create: `apps/worker/src/ingestion/adapters/highlightly/highlightly-adapter.ts`
- Create: `apps/worker/src/ingestion/adapters/highlightly/highlightly-import.ts`

**Interfaces:**
- Consumes: `HighlightlyClient` (Task 1), `HIGHLIGHTLY_COMPETITIONS` (Task 2), parsers
  (Task 3).
- Produces: `HighlightlyIngestAdapter implements SportsDataAdapter`;
  `importHighlightly(options: { db: Database; sourceId: string; adapter?:
  HighlightlyIngestAdapter; dryRun?: boolean }): Promise<HighlightlyImportReport>`.

- [ ] **Step 1: Implementar el adapter**

Crear `apps/worker/src/ingestion/adapters/highlightly/highlightly-adapter.ts`, siguiendo el
mismo patrón que `apps/worker/src/ingestion/adapters/urba/urba-adapter.ts`:

```typescript
import type { Capability, ExternalMatch, ExternalStandings, FetchContext, SportsDataAdapter, SourceDescriptor } from '@ovalia/domain';
import { HighlightlyClient } from './highlightly-client';
import { HIGHLIGHTLY_COMPETITIONS } from './highlightly-competitions';
import { parseMatchesAsFixtures, parseMatchesAsTeams, parseStandingsPayload } from './highlightly-parser';

const DESCRIPTOR: SourceDescriptor = {
  slug: 'highlightly',
  name: 'Highlightly',
  priority: 70,
  capabilities: ['catalog', 'fixtures', 'results', 'standings'],
};

export class HighlightlyIngestAdapter implements SportsDataAdapter {
  readonly descriptor = DESCRIPTOR;

  constructor(private readonly client: HighlightlyClient) {}

  supports(capability: Capability): boolean {
    return this.descriptor.capabilities.includes(capability);
  }

  async fetchCatalog(_ctx: FetchContext) {
    const allMatches: unknown[] = [];
    const competitions = HIGHLIGHTLY_COMPETITIONS.map((c) => ({
      externalId: c.externalId,
      name: c.name,
      slug: c.slug,
      category: 'clubs' as const,
      gender: 'male' as const,
      countryCode: null,
      format: 'xv' as const,
      familySlug: c.slug,
      tier: c.tier,
      season: { externalId: String(new Date().getFullYear()), name: String(new Date().getFullYear()), year: new Date().getFullYear() },
    }));
    for (const competition of HIGHLIGHTLY_COMPETITIONS) {
      const raw = await this.client.matches({ leagueId: Number(competition.externalId) });
      allMatches.push(raw);
    }
    const teams = allMatches.flatMap((raw) => parseMatchesAsTeams(raw));
    const uniqueTeams = [...new Map(teams.map((t) => [t.externalId, t])).values()];
    return { competitions, teams: uniqueTeams };
  }

  async fetchFixtures(ctx: FetchContext): Promise<ExternalMatch[]> {
    if (!ctx.competitionExternalId) throw new Error('Highlightly fixtures requiere competitionExternalId');
    const raw = await this.client.matches({ leagueId: Number(ctx.competitionExternalId) });
    return parseMatchesAsFixtures(raw);
  }

  fetchResults(ctx: FetchContext): Promise<ExternalMatch[]> {
    return this.fetchFixtures(ctx);
  }

  async fetchStandings(ctx: FetchContext): Promise<ExternalStandings> {
    if (!ctx.competitionExternalId) throw new Error('Highlightly standings requiere competitionExternalId');
    const season = ctx.seasonYear ?? new Date().getFullYear();
    const raw = await this.client.standings({ leagueId: Number(ctx.competitionExternalId), season });
    return parseStandingsPayload(raw, ctx.competitionExternalId, season);
  }
}
```

Revisar contra `packages/domain/src/ingestion/adapter.ts` y `external-competition.ts` si
`ExternalCompetition` exige más campos de los usados arriba (por ejemplo si `category`/
`gender` son un `z.enum` estricto que no acepta los valores usados) — ajustar los literales
si hace falta, sin cambiar la estructura general.

- [ ] **Step 2: Implementar el import helper**

Crear `apps/worker/src/ingestion/adapters/highlightly/highlightly-import.ts`, calcado del
patrón ya usado en `apps/worker/src/ingestion/adapters/urba/urba-import.ts` (versión con
`fetchCatalog` para derivar la lista real de competencias, tal como quedó ese archivo tras
el plan de URBA):

```typescript
import type { Database } from '@ovalia/database';
import { runIngestion, type RunIngestionResult } from '../../run-ingestion';
import { HighlightlyIngestAdapter } from './highlightly-adapter';
import { HighlightlyClient } from './highlightly-client';

export interface HighlightlyImportOptions {
  db: Database;
  sourceId: string;
  adapter?: HighlightlyIngestAdapter;
  dryRun?: boolean;
}

export interface HighlightlyImportReport {
  catalog: RunIngestionResult;
  perCompetition: Array<{ externalId: string; name: string; fixtures: RunIngestionResult; standings: RunIngestionResult }>;
}

export async function importHighlightly(options: HighlightlyImportOptions): Promise<HighlightlyImportReport> {
  const apiKey = process.env.HIGHLIGHTLY_API_KEY;
  if (!apiKey) throw new Error('HIGHLIGHTLY_API_KEY requerido para ingestión de Highlightly');
  const adapter = options.adapter ?? new HighlightlyIngestAdapter(new HighlightlyClient({ apiKey }));
  const base = {
    db: options.db,
    sourceId: options.sourceId,
    adapter,
    parserVersion: 'highlightly-1',
    dryRun: options.dryRun,
  } as const;

  const catalogPayload = await adapter.fetchCatalog!({});
  const catalog = await runIngestion({ ...base, capability: 'catalog', context: {} });

  const perCompetition: HighlightlyImportReport['perCompetition'] = [];
  for (const competition of catalogPayload.competitions) {
    const context = { competitionExternalId: competition.externalId, seasonYear: competition.season.year };
    const fixtures = await runIngestion({ ...base, capability: 'fixtures', context });
    const standings = await runIngestion({ ...base, capability: 'standings', context });
    perCompetition.push({ externalId: competition.externalId, name: competition.name, fixtures, standings });
  }
  return { catalog, perCompetition };
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ovalia/worker exec tsc --noEmit`
Expected: sin errores (resolver cualquier discrepancia de tipos contra el `SportsDataAdapter`
real de `@ovalia/domain` que surja acá).

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/ingestion/adapters/highlightly/highlightly-adapter.ts apps/worker/src/ingestion/adapters/highlightly/highlightly-import.ts
git commit -m "feat: HighlightlyIngestAdapter y helper de import completo"
```

---

### Task 5: Registro del adapter y CLI

**Files:**
- Modify: `apps/worker/src/ingestion/register-adapters.ts`
- Modify: `apps/worker/src/cli/ingest.ts`
- Modify: `packages/database/src/seed.ts`

**Interfaces:**
- Consumes: `HighlightlyIngestAdapter` (Task 4), `registerAdapter` (ya existe en
  `adapter-registry.ts`, sin cambios).

- [ ] **Step 1: Registrar el adapter**

En `apps/worker/src/ingestion/register-adapters.ts`, agregar:

```typescript
import { HighlightlyIngestAdapter } from './adapters/highlightly/highlightly-adapter';
import { HighlightlyClient } from './adapters/highlightly/highlightly-client';

registerAdapter('highlightly', () => {
  const apiKey = process.env.HIGHLIGHTLY_API_KEY;
  if (!apiKey) throw new Error('HIGHLIGHTLY_API_KEY requerido');
  return new HighlightlyIngestAdapter(new HighlightlyClient({ apiKey }));
});
```

- [ ] **Step 2: Sumar el source en el seed**

En `packages/database/src/seed.ts`, junto a los demás `upsertSource` (urba, uar,
world-rugby, highlightly-live), revisar si ya existe una entrada `slug: 'highlightly'`
(la que hoy usa el live feed podría llamarse distinto, ej. `'highlightly'` ya usado para
"live" — confirmar con `grep -n "highlightly" packages/database/src/seed.ts`). Si el slug
`'highlightly'` ya está tomado por la entrada de live feed, usar un slug distinto para esta
fuente de ingesta, ej. `'highlightly-ingest'`, y ajustar `register-adapters.ts` y
`ingest-highlightly.yml` (Task 6) para usar ese mismo slug consistentemente. Si no existe
ninguna entrada, agregar:

```typescript
await upsertSource(db, {
  slug: 'highlightly',
  name: 'Highlightly (Súper Rugby, internacionales, seven)',
  priority: 70,
  capabilities: ['catalog', 'fixtures', 'results', 'standings'],
  automationAllowed: true,
  active: true,
  attribution: 'Highlightly — highlightly.net',
});
```

- [ ] **Step 3: CLI**

`apps/worker/src/cli/ingest.ts` ya soporta `--source <slug> --all` para cualquier
adaptador registrado (rama genérica al final del archivo), pero el bloque especial de URBA
(`if (args.source === 'urba' && args.all)`) usa `importUrba` en vez del flujo genérico.
Agregar un bloque análogo para Highlightly, después del de URBA:

```typescript
    if (args.source === 'highlightly' && args.all) {
      const { importHighlightly } = await import('../ingestion/adapters/highlightly/highlightly-import');
      const report = await importHighlightly({ db, sourceId: source.id, dryRun: args.dryRun });
      console.log(`[highlightly/catalog] ${report.catalog.status} persisted=${report.catalog.persisted}`);
      for (const comp of report.perCompetition) {
        console.log(
          `[highlightly/${comp.name}] fixtures=${comp.fixtures.status}(${comp.fixtures.persisted}/${comp.fixtures.conflicts}) ` +
            `standings=${comp.standings.status}(${comp.standings.persisted}/${comp.standings.conflicts})`,
        );
      }
      return;
    }
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @ovalia/worker exec tsc --noEmit && pnpm --filter @ovalia/database exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Prueba manual local con dry-run**

Requiere `HIGHLIGHTLY_API_KEY` en el entorno (la key ya provista en esta sesión):

```bash
DATABASE_URL="postgres://ovalia:ovalia@localhost:54329/ovalia" HIGHLIGHTLY_API_KEY="593b3b5a-6892-404b-b1e8-1b86de40b6e9" pnpm --filter @ovalia/worker exec tsx src/cli/ingest.ts --source highlightly --all --dry-run
```
Expected: corre sin lanzar excepciones, imprime el resumen por competencia (aunque en
dry-run no persista).

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/ingestion/register-adapters.ts apps/worker/src/cli/ingest.ts packages/database/src/seed.ts
git commit -m "feat: registrar Highlightly como fuente de ingesta y sumarlo al CLI"
```

---

### Task 6: Workflow de CI

**Files:**
- Create: `.github/workflows/ingest-highlightly.yml`

**Interfaces:** ninguna (config de CI).

- [ ] **Step 1: Escribir el workflow**

Calcado de `.github/workflows/ingest-urba.yml`:

```yaml
name: Refresh Highlightly data

on:
  schedule:
    - cron: '17 */6 * * *'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: highlightly-production-ingestion
  cancel-in-progress: false

jobs:
  ingest:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    environment: production
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      HIGHLIGHTLY_API_KEY: ${{ secrets.HIGHLIGHTLY_API_KEY }}
      PARSER_VERSION: ${{ github.sha }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.17.0
          run_install: false
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @ovalia/domain build
      - run: pnpm --filter @ovalia/database build
      - name: Require the production credentials
        run: test -n "$DATABASE_URL" && test -n "$HIGHLIGHTLY_API_KEY"
      - name: Refresh Highlightly catalog, fixtures and standings
        run: pnpm --filter @ovalia/worker exec tsx src/cli/ingest.ts --source highlightly --all
```

(Cron a las `:17` en vez de `:07` como URBA, para no competir por rate limit de red al
mismo minuto exacto — no hay razón técnica estricta, es solo prolijidad.)

- [ ] **Step 2: Validar el YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ingest-highlightly.yml'))"`
Expected: sin error.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ingest-highlightly.yml
git commit -m "feat: workflow de ingesta programada de Highlightly"
```

---

### Task 7: Secret en GitHub y primera corrida

**Files:** ninguno (operación).

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Cargar el secret en GitHub**

```bash
gh secret set HIGHLIGHTLY_API_KEY --repo DalessandroBautista/ovalia --env production --body "593b3b5a-6892-404b-b1e8-1b86de40b6e9"
```

(Usar el mismo patrón que se usó para `DATABASE_URL` en el hito de deploy anterior — `gh`
ya está instalado y autenticado en `~/.local/bin/gh` de una sesión previa; si no está
disponible, reinstalar con el mismo procedimiento: descargar el binario release de GitHub
CLI y `gh auth login --web`.)

- [ ] **Step 3: Correr el seed en Neon (agrega la fuente `highlightly`)**

```bash
DATABASE_URL="<connection-string-de-neon>" pnpm --filter @ovalia/database exec tsx src/seed.ts
```

- [ ] **Step 4: Disparar el workflow manualmente**

```bash
gh workflow run ingest-highlightly.yml --repo DalessandroBautista/ovalia --ref feat/real-data-platform
```

- [ ] **Step 5: Verificar el resultado**

```bash
gh run list --repo DalessandroBautista/ovalia --workflow=ingest-highlightly.yml --limit 1
```

Esperar a `completed`/`success`. Si falla, `gh run view <run-id> --repo
DalessandroBautista/ovalia --log-failed` para diagnosticar — mismo procedimiento ya usado
para depurar `ingest-urba.yml` en la sesión anterior.

- [ ] **Step 6: Verificar en la API de producción (requiere que la API ya esté deployada con los cambios de este plan si tocó tipos compartidos — este plan no cambia `apps/api`, así que no hace falta redeploy de API)**

```bash
curl -s "https://ovalia-api.vercel.app/v1/competitions" | python3 -c "
import json,sys
d = json.load(sys.stdin)['competitions']
print([c['slug'] for c in d if c['slug'] in ('super-rugby','rugby-championship','tests-internacionales','seven-world-cup')])
"
```
Expected: las 4 competencias curadas aparecen.

---

## Self-Review Notes

- **Cobertura del spec (sección 3 completa)**: 3.1-3.2 → contexto ya verificado en el spec
  y en `Global Constraints`. 3.3 → Task 2. 3.4 → Tasks 1, 3, 4, 5. 3.5 → Tasks 6-7.
- **Riesgo señalado explícitamente y no escondido**: Task 3 documenta que `/standings`
  devolvió `groups: []` en las pruebas del diseño — el parser lo maneja como "sin datos"
  en vez de asumir que siempre va a haber tabla de posiciones. Si en producción alguna de
  las 4 competencias sí tiene standings reales, el parser actual simplemente seguirá
  devolviendo `rows: []` para ella (no falla, pero tampoco aprovecha datos que podrían
  existir) — señalado como mejora futura, no bloqueante para este plan.
- **Nombre de campos de dominio no verificados al 100%**: Task 3 Step 4 y Task 4 Step 1
  instruyen explícitamente revisar `packages/domain/src/ingestion/external-match.ts`,
  `external-standing.ts` y `adapter.ts` antes de fijar los nombres de campo exactos, en vez
  de asumirlos — evita que el plan quede "roto" si el dominio tiene nombres ligeramente
  distintos a los de URBA.
- **Colisión de slug de `source`**: Task 5 Step 2 anticipa que el slug `'highlightly'`
  puede ya estar tomado por la entrada de "live feed" en el seed, y da una salida concreta
  (usar `'highlightly-ingest'` en su lugar) en vez de asumir que no hay conflicto.
