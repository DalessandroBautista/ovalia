# Escudos completos y cobertura total de divisiones URBA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Todos los clubes de URBA quedan con su escudo oficial verificado y visible en toda la
web (incluida la tabla de posiciones), y el pipeline de ingesta cubre las 85 competencias
reales del feed de URBA 2026 en vez de las 8 actuales.

**Architecture:** Cambios quirúrgicos en la cadena existente de ingesta (adapter URBA →
`run-ingestion` → repos de `@ovalia/database`) y en la capa de lectura (API → web). No se
agregan tablas ni servicios nuevos; se completan campos ya existentes en el schema
(`badge_*` en `teams`) y se generaliza un loop que hoy está hardcodeado a 8 IDs.

**Tech Stack:** TypeScript, Fastify, Drizzle ORM (Postgres/Neon), Next.js, Vitest, GitHub
Actions.

## Global Constraints

- No modificar el slug de las 8 competencias ya publicadas (`urba-top-14`, `urba-primera-a`,
  etc.) — deben seguir viniendo del mapa explícito `URBA_SLUG_BY_EXTERNAL_ID`.
- Los 6 clubes de URBA hoy curados a mano (`sic`, `hindu`, `casi`, `newman`, `alumni`,
  `cuba`) pasan a usar el logo oficial de URBA — se sacan de `TEAM_BADGES`.
- Las 4 selecciones nacionales (`argentina`, `sudafrica`, `nueva-zelanda`, `australia`) NO se
  tocan — siguen curadas a mano en `TEAM_BADGES` y en `seed.ts`.
- Todo cambio en `packages/database` o `apps/worker` que tenga test de integración existente
  se corre contra la base de test local (`pnpm --filter <paquete> test`); si no hay Postgres
  local levantado, esos tests se skippean automáticamente (`describe.skipIf(!available)`) —
  no es bloqueante para completar el task, pero hay que dejar constancia en el commit de si
  corrieron o se skipearon.
- Convención de commits del repo: mensajes en español, formato `tipo: descripción corta`
  (`fix:`, `feat:`, `chore:`, `docs:`), sin firmar con nombre de IA en el asunto.

---

### Task 1: Domain — sumar `badgeSourceUrl`/`badgeFormat` a `ExternalTeam`

**Files:**
- Modify: `packages/domain/src/ingestion/external-team.ts`

**Interfaces:**
- Produces: `ExternalTeam` gana los campos opcionales `badgeSourceUrl?: string` y
  `badgeFormat?: string`, usados por Task 2 y Task 4.

- [ ] **Step 1: Editar el schema**

En `packages/domain/src/ingestion/external-team.ts`, reemplazar el contenido completo por:

```typescript
import { z } from 'zod';

export const externalTeamSchema = z.object({
  /** ID estable del equipo en la fuente. */
  externalId: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().optional(),
  countryCode: z.string().length(2).optional(),
  union: z.string().optional(),
  badgeUrl: z.string().url().optional(),
  /** URL de origen del escudo, para atribución. */
  badgeSourceUrl: z.string().url().optional(),
  /** Extensión del archivo del escudo (ej. "png", "svg"). */
  badgeFormat: z.string().optional(),
});
export type ExternalTeam = z.infer<typeof externalTeamSchema>;
```

- [ ] **Step 2: Typecheck del paquete**

Run: `pnpm --filter @ovalia/domain exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add packages/domain/src/ingestion/external-team.ts
git commit -m "feat: sumar badgeSourceUrl y badgeFormat a ExternalTeam"
```

---

### Task 2: Adapter URBA — poblar `badgeSourceUrl`/`badgeFormat` al parsear clubes

**Files:**
- Modify: `apps/worker/src/ingestion/adapters/urba/urba-parser.ts:122-131`
- Test: `apps/worker/src/ingestion/adapters/urba/urba-parser.test.ts:40-51`

**Interfaces:**
- Consumes: `ExternalTeam` de Task 1 (campos `badgeSourceUrl`, `badgeFormat`).
- Produces: `parseClubsAsTeams(raw: unknown): ExternalTeam[]` — cada equipo con
  `badgeUrl`, `badgeSourceUrl` (mismo valor que `badgeUrl`) y `badgeFormat` (extensión del
  archivo) cuando el club trae `image_uri`.

- [ ] **Step 1: Escribir el test que falla**

En `apps/worker/src/ingestion/adapters/urba/urba-parser.test.ts`, reemplazar el test
`'parsea clubes como equipos con escudo y external ID de club'` (líneas 40-51) por:

```typescript
  it('parsea clubes como equipos con escudo y external ID de club', () => {
    const teams = parseClubsAsTeams({
      clubs: [{ id: 1, name: 'SIC', image_uri: 'img/clubs/sic.png' }],
    });
    expect(teams[0]).toMatchObject({
      externalId: '1',
      name: 'SIC',
      countryCode: 'AR',
      union: 'URBA',
      badgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png',
      badgeSourceUrl: 'https://api.urba.org.ar/img/clubs/sic.png',
      badgeFormat: 'png',
    });
  });

  it('no emite campos de badge cuando el club no trae image_uri', () => {
    const teams = parseClubsAsTeams({
      clubs: [{ id: 2, name: 'Sin Logo', image_uri: '' }],
    });
    expect(teams[0]!.badgeUrl).toBeUndefined();
    expect(teams[0]!.badgeSourceUrl).toBeUndefined();
    expect(teams[0]!.badgeFormat).toBeUndefined();
  });
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/worker exec vitest run urba-parser -t "parsea clubes"`
Expected: FAIL — `badgeSourceUrl`/`badgeFormat` no están definidos todavía.

- [ ] **Step 3: Implementar**

En `apps/worker/src/ingestion/adapters/urba/urba-parser.ts`, reemplazar
`parseClubsAsTeams` (líneas 122-131) por:

```typescript
export function parseClubsAsTeams(raw: unknown): ExternalTeam[] {
  const data = parseOrThrow(rawClubsSchema, raw, 'clubs');
  return data.clubs.map((club) => {
    const badgeUrl = club.image_uri ? `https://api.urba.org.ar/${club.image_uri}` : undefined;
    const badgeFormat = club.image_uri ? club.image_uri.split('.').pop() : undefined;
    return {
      externalId: String(club.id),
      name: club.name,
      countryCode: 'AR' as const,
      union: 'URBA',
      ...(badgeUrl ? { badgeUrl, badgeSourceUrl: badgeUrl } : {}),
      ...(badgeFormat ? { badgeFormat } : {}),
    };
  });
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/worker exec vitest run urba-parser -t "parsea clubes|no emite campos"`
Expected: PASS (ambos tests).

- [ ] **Step 5: Correr toda la suite del parser por las dudas**

Run: `pnpm --filter @ovalia/worker exec vitest run urba-parser`
Expected: todos los tests existentes siguen en verde.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/ingestion/adapters/urba/urba-parser.ts apps/worker/src/ingestion/adapters/urba/urba-parser.test.ts
git commit -m "feat: poblar badgeSourceUrl y badgeFormat al parsear clubes URBA"
```

---

### Task 3: Database — `upsertTeams` actualiza y verifica el badge en cada re-ingest

**Files:**
- Modify: `packages/database/src/repositories/teams-repository.ts`
- Test: `packages/database/src/repositories.test.ts:58-70`

**Interfaces:**
- Produces: `TeamInput` gana `badgeSourceUrl?: string | null` y `badgeFormat?: string | null`.
  `upsertTeams` ahora, en el `ON CONFLICT`, actualiza `badgeUrl`/`badgeSourceUrl`/
  `badgeFormat` siempre, y marca `badgeStatus: 'verified'` + `badgeVerifiedAt: now()` cuando
  el `badgeUrl` entrante no es nulo (si es nulo, deja el estado de badge existente intacto).

- [ ] **Step 1: Escribir el test que falla**

En `packages/database/src/repositories.test.ts`, reemplazar el test
`'upsertTeams es idempotente por slug y resuelve por external ID'` (líneas 58-70) por:

```typescript
  it('upsertTeams es idempotente por slug y resuelve por external ID', async () => {
    const { db } = handle;
    await upsertTeams(db, [
      { slug: 'sic', name: 'SIC', shortName: 'SIC', countryCode: 'AR', externalIds: { urba: '11' } },
    ]);
    await upsertTeams(db, [
      { slug: 'sic', name: 'San Isidro Club', shortName: 'SIC', countryCode: 'AR' },
    ]);
    const team = await findTeamByExternalId(db, 'urba', '11');
    expect(team?.name).toBe('San Isidro Club');
    const all = await db.query.teams.findMany();
    expect(all).toHaveLength(1);
  });

  it('upsertTeams actualiza y verifica el badge cuando llega uno nuevo', async () => {
    const { db } = handle;
    await upsertTeams(db, [
      { slug: 'sic', name: 'SIC', shortName: 'SIC', countryCode: 'AR' },
    ]);
    const before = await db.query.teams.findFirst({ where: (t, { eq }) => eq(t.slug, 'sic') });
    expect(before?.badgeStatus).toBe('pending');
    expect(before?.badgeUrl).toBeNull();

    await upsertTeams(db, [
      {
        slug: 'sic',
        name: 'SIC',
        shortName: 'SIC',
        countryCode: 'AR',
        badgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png',
        badgeSourceUrl: 'https://api.urba.org.ar/img/clubs/sic.png',
        badgeFormat: 'png',
      },
    ]);
    const after = await db.query.teams.findFirst({ where: (t, { eq }) => eq(t.slug, 'sic') });
    expect(after?.badgeUrl).toBe('https://api.urba.org.ar/img/clubs/sic.png');
    expect(after?.badgeSourceUrl).toBe('https://api.urba.org.ar/img/clubs/sic.png');
    expect(after?.badgeFormat).toBe('png');
    expect(after?.badgeStatus).toBe('verified');
    expect(after?.badgeVerifiedAt).not.toBeNull();

    // Un upsert posterior sin badgeUrl no debe borrar el que ya quedó verificado.
    await upsertTeams(db, [{ slug: 'sic', name: 'SIC', shortName: 'SIC', countryCode: 'AR' }]);
    const stillVerified = await db.query.teams.findFirst({ where: (t, { eq }) => eq(t.slug, 'sic') });
    expect(stillVerified?.badgeUrl).toBe('https://api.urba.org.ar/img/clubs/sic.png');
    expect(stillVerified?.badgeStatus).toBe('verified');
  });
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/database exec vitest run repositories -t "upsertTeams actualiza y verifica"`
Expected: FAIL (o SKIP si no hay Postgres de test local — en ese caso avisar y seguir; el
código igual debe quedar correcto para cuando corra en CI/con DB disponible).

- [ ] **Step 3: Implementar**

En `packages/database/src/repositories/teams-repository.ts`, reemplazar el archivo completo
por:

```typescript
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { teams } from '../schema.js';

export type TeamInput = {
  slug: string;
  name: string;
  shortName: string;
  countryCode: string;
  union?: string | null;
  aliases?: string[];
  externalIds?: Record<string, string | number>;
  badgeUrl?: string | null;
  badgeSourceUrl?: string | null;
  badgeFormat?: string | null;
  active?: boolean;
};

export function findTeamBySlug(db: Database, slug: string) {
  return db.query.teams.findFirst({ where: eq(teams.slug, slug) });
}

export function findTeamById(db: Database, id: string) {
  return db.query.teams.findFirst({ where: eq(teams.id, id) });
}

export function listActiveTeams(db: Database) {
  return db.query.teams.findMany({ where: eq(teams.active, true) });
}

export function listTeams(db: Database) {
  return db.query.teams.findMany();
}

export function countActiveTeams(db: Database): Promise<number> {
  return db.$count(teams, eq(teams.active, true));
}

export function findTeamByExternalId(db: Database, provider: string, externalId: string) {
  return db.query.teams.findFirst({
    where: sql`${teams.externalIds} ->> ${provider} = ${externalId}`,
  });
}

/** Upsert por slug de un lote de equipos dentro de una transacción. */
export async function upsertTeams(db: Database, inputs: TeamInput[]): Promise<void> {
  if (inputs.length === 0) return;
  await db.transaction(async (tx) => {
    for (const input of inputs) {
      const values = {
        slug: input.slug,
        name: input.name,
        shortName: input.shortName,
        countryCode: input.countryCode,
        union: input.union ?? null,
        aliases: input.aliases ?? [],
        externalIds: input.externalIds ?? {},
        badgeUrl: input.badgeUrl ?? null,
        badgeSourceUrl: input.badgeSourceUrl ?? null,
        badgeFormat: input.badgeFormat ?? null,
        active: input.active ?? true,
      };
      await tx
        .insert(teams)
        .values(values)
        .onConflictDoUpdate({
          target: teams.slug,
          set: {
            name: values.name,
            shortName: values.shortName,
            countryCode: values.countryCode,
            union: values.union,
            aliases: values.aliases,
            // Los external IDs se fusionan para no perder proveedores previos.
            externalIds: sql`${teams.externalIds} || ${JSON.stringify(values.externalIds)}::jsonb`,
            active: values.active,
            // El badge solo se pisa cuando llega uno nuevo; si el upsert no trae
            // badgeUrl, se conserva el que ya estaba (curado a mano o de un ingest previo).
            badgeUrl: values.badgeUrl ? values.badgeUrl : teams.badgeUrl,
            badgeSourceUrl: values.badgeUrl ? values.badgeSourceUrl : teams.badgeSourceUrl,
            badgeFormat: values.badgeUrl ? values.badgeFormat : teams.badgeFormat,
            badgeStatus: values.badgeUrl ? 'verified' : teams.badgeStatus,
            badgeVerifiedAt: values.badgeUrl ? new Date() : teams.badgeVerifiedAt,
          },
        });
    }
  });
}

/** Agrega un alias normalizado sin duplicarlo. */
export async function addTeamAlias(db: Database, teamId: string, alias: string): Promise<void> {
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  if (!team) return;
  if (team.aliases.includes(alias)) return;
  await db
    .update(teams)
    .set({ aliases: [...team.aliases, alias] })
    .where(and(eq(teams.id, teamId)));
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/database exec vitest run repositories -t "upsertTeams"`
Expected: PASS (o SKIP sin DB local — verificar igual con `tsc --noEmit`).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @ovalia/database exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add packages/database/src/repositories/teams-repository.ts packages/database/src/repositories.test.ts
git commit -m "fix: upsertTeams actualiza y verifica el badge en cada re-ingest"
```

---

### Task 4: `run-ingestion` — pasar los nuevos campos de badge al persistir el catálogo

**Files:**
- Modify: `apps/worker/src/ingestion/run-ingestion.ts:213-224`

**Interfaces:**
- Consumes: `ExternalTeam.badgeSourceUrl`/`badgeFormat` (Task 1), `TeamInput.badgeSourceUrl`/
  `badgeFormat` (Task 3).

- [ ] **Step 1: Editar `persistCatalog`**

En `apps/worker/src/ingestion/run-ingestion.ts`, ubicar el bloque (líneas 213-224):

```typescript
  await upsertTeams(
    db,
    payload.teams.map((team) => ({
      slug: normalizeName(team.name).replace(/\s+/g, '-'),
      name: team.name,
      shortName: team.shortName ?? team.name.slice(0, 3).toUpperCase(),
      countryCode: team.countryCode ?? 'AR',
      union: team.union ?? null,
      badgeUrl: team.badgeUrl ?? null,
    })),
  );
```

Reemplazarlo por:

```typescript
  await upsertTeams(
    db,
    payload.teams.map((team) => ({
      slug: normalizeName(team.name).replace(/\s+/g, '-'),
      name: team.name,
      shortName: team.shortName ?? team.name.slice(0, 3).toUpperCase(),
      countryCode: team.countryCode ?? 'AR',
      union: team.union ?? null,
      badgeUrl: team.badgeUrl ?? null,
      badgeSourceUrl: team.badgeSourceUrl ?? null,
      badgeFormat: team.badgeFormat ?? null,
    })),
  );
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ovalia/worker exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Correr la suite de ingestion del worker**

Run: `pnpm --filter @ovalia/worker exec vitest run run-ingestion`
Expected: PASS o SKIP (requiere Postgres de test local); si corre, todo en verde.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/ingestion/run-ingestion.ts
git commit -m "feat: persistir badgeSourceUrl y badgeFormat al ingerir el catálogo"
```

---

### Task 5: Sacar los 6 clubes URBA de `TEAM_BADGES` y ajustar el seed

**Files:**
- Modify: `packages/domain/src/team-badges.ts`
- Modify: `packages/domain/src/team-badges.test.ts` (si referencia alguno de los 6 clubes
  retirados — revisar y ajustar)
- Modify: `packages/database/src/seed.ts:19-64`

**Interfaces:**
- Produces: `TEAM_BADGES` queda con 4 entradas (`argentina`, `sudafrica`, `nueva-zelanda`,
  `australia`). `seed.ts` ya no crea/actualiza los 6 clubes URBA vía `TEAM_BADGES` — quedan
  exclusivamente a cargo de la ingesta.

- [ ] **Step 1: Revisar qué testea `team-badges.test.ts` sobre los 6 clubes a retirar**

Run: `grep -n "sic\|hindu\|casi\|newman\|alumni\|cuba" packages/domain/src/team-badges.test.ts`

Si aparecen assertions sobre `findTeamBadge`/`resolveTeamBadge` para esos slugs, se
reemplazan por equivalentes usando `argentina` (que sí sigue en la lista) para no perder
cobertura del comportamiento general de la función. No hace falta mantener casos de test
para clubes que ya no están curados.

- [ ] **Step 2: Editar `TEAM_BADGES`**

En `packages/domain/src/team-badges.ts`, reemplazar el array (líneas 14-25) por:

```typescript
export const TEAM_BADGES: readonly TeamBadgeRecord[] = [
  { slug: 'argentina', name: 'Argentina', shortCode: 'ARG', aliases: ['Los Pumas', 'Argentina XV'], badgePath: '/teams/argentina.png', providerQuery: 'Argentina', sourceUrl: 'https://upload.wikimedia.org/wikipedia/en/7/74/Los_pumas_argentina_logo23.png' },
  { slug: 'sudafrica', name: 'Sudáfrica', shortCode: 'RSA', aliases: ['South Africa', 'Springboks', 'Sudafrica'], badgePath: '/teams/sudafrica.svg', providerQuery: 'South Africa', sourceUrl: 'https://upload.wikimedia.org/wikipedia/en/8/83/South_Africa_national_rugby_union_team.svg' },
  { slug: 'nueva-zelanda', name: 'Nueva Zelanda', shortCode: 'NZL', aliases: ['New Zealand', 'All Blacks'], badgePath: '/teams/nueva-zelanda.svg', providerQuery: 'New Zealand', sourceUrl: 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Allblacks-logo.svg' },
  { slug: 'australia', name: 'Australia', shortCode: 'AUS', aliases: ['Wallabies'], badgePath: '/teams/australia.svg', providerQuery: 'Australia', sourceUrl: 'https://upload.wikimedia.org/wikipedia/en/0/02/WallabiesRugbyUnionLogo.svg' },
];
```

(El resto del archivo —`normalizeTeamName`, `findTeamBadge`, `resolveTeamBadge`— no cambia.)

- [ ] **Step 3: Correr los tests del paquete domain y ajustar los que fallen**

Run: `pnpm --filter @ovalia/domain exec vitest run team-badges`

Si falla algún test que buscaba `sic`/`hindu`/`casi`/`newman`/`alumni`/`cuba` en
`TEAM_BADGES`, reemplazar esos casos por el equivalente con `argentina` (o el club nacional
que corresponda), manteniendo la misma aserción sobre el comportamiento de la función, no
sobre el club puntual.

- [ ] **Step 4: Editar `seed.ts`**

En `packages/database/src/seed.ts`, el `metadata` map (líneas 19-30) referencia por slug a
los clubes URBA que ya no están en `TEAM_BADGES`. Como el loop `for (const team of
TEAM_BADGES)` (líneas 32-64) ahora solo itera sobre las 4 selecciones, reducir `metadata` a
esas 4 entradas. Reemplazar las líneas 19-30 por:

```typescript
const metadata: Record<string, { countryCode: string; union: string; shortName: string }> = {
      argentina: { countryCode: 'AR', union: 'UAR', shortName: 'Los Pumas' },
      sudafrica: { countryCode: 'ZA', union: 'SARU', shortName: 'Springboks' },
      'nueva-zelanda': { countryCode: 'NZ', union: 'NZR', shortName: 'All Blacks' },
      australia: { countryCode: 'AU', union: 'Rugby Australia', shortName: 'Wallabies' },
};
```

- [ ] **Step 5: Typecheck y tests del seed**

Run: `pnpm --filter @ovalia/domain exec tsc --noEmit && pnpm --filter @ovalia/database exec tsc --noEmit`
Expected: sin errores (el `seed.ts` no tiene test dedicado; se valida por typecheck y, más
adelante, por correrlo manualmente si hace falta).

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/team-badges.ts packages/domain/src/team-badges.test.ts packages/database/src/seed.ts
git commit -m "feat: unificar escudos de clubes URBA con el logo oficial del feed"
```

---

### Task 6: Standings — incluir `badgeUrl` en la consulta

**Files:**
- Modify: `packages/database/src/repositories/standings-repository.ts:17-38`
- Test: `packages/database/src/repositories.test.ts:150-182`

**Interfaces:**
- Produces: `getStandingsForSeason` devuelve filas con el campo adicional
  `teamBadgeUrl: string | null`.

- [ ] **Step 1: Escribir el test que falla**

En `packages/database/src/repositories.test.ts`, en el test que usa `getStandingsForSeason`
(alrededor de la línea 178), cambiar:

```typescript
    const a = await makeTeam(db, { name: 'A' });
    const b = await makeTeam(db, { name: 'B' });
```

por:

```typescript
    const a = await makeTeam(db, { name: 'A' });
    const b = await makeTeam(db, { name: 'B', badgeUrl: 'https://example.com/b.png' });
```

y después de `expect(rows[0]!.source).toBe('urba');` agregar:

```typescript
    expect(rows[0]!.teamBadgeUrl).toBe('https://example.com/b.png');
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/database exec vitest run repositories -t "getStandingsForSeason\|ordena por puntos"`

(Usar el nombre real del `it(...)` que contiene ese `expect` — buscarlo con
`grep -n "getStandingsForSeason" packages/database/src/repositories.test.ts` si el título
exacto no es obvio por el fragmento de arriba.)

Expected: FAIL — `teamBadgeUrl` no existe en el resultado.

- [ ] **Step 3: Implementar**

En `packages/database/src/repositories/standings-repository.ts`, en el `select` de
`getStandingsForSeason` (líneas 19-32), agregar una línea después de `teamName:
teams.name,`:

```typescript
      teamName: teams.name,
      teamBadgeUrl: teams.badgeUrl,
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: el mismo comando del Step 2.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/repositories/standings-repository.ts packages/database/src/repositories.test.ts
git commit -m "feat: incluir badgeUrl en la consulta de posiciones"
```

---

### Task 7: API — exponer `badgeUrl` en `/v1/competitions/:slug/standings`

**Files:**
- Modify: `apps/api/src/create-app.ts:199-203`
- Test: `apps/api/src/app.test.ts:42-69, 123-138`

**Interfaces:**
- Consumes: `getStandingsForSeason` con `teamBadgeUrl` (Task 6).
- Produces: la respuesta de `/v1/competitions/:slug/standings` trae
  `rows[].team.badgeUrl: string | null`.

- [ ] **Step 1: Escribir el test que falla**

En `apps/api/src/app.test.ts`, dentro de `seedCompetition` (líneas 42-69), cambiar:

```typescript
    const sic = await makeTeam(db, { slug: 'sic', name: 'SIC' });
```

por:

```typescript
    const sic = await makeTeam(db, { slug: 'sic', name: 'SIC', badgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png' });
```

Y en el test `'sirve el catálogo y la tabla de posiciones desde DB'` (línea 136), cambiar:

```typescript
    expect(body.rows[0]).toMatchObject({ position: 1, team: { slug: 'sic' }, points: 4 });
```

por:

```typescript
    expect(body.rows[0]).toMatchObject({
      position: 1,
      team: { slug: 'sic', badgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png' },
      points: 4,
    });
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/api exec vitest run app -t "sirve el catálogo"`
Expected: FAIL — `team.badgeUrl` no viaja en la respuesta todavía.

- [ ] **Step 3: Implementar**

En `apps/api/src/create-app.ts`, ubicar dentro de `GET /v1/competitions/:slug/standings`
(alrededor de la línea 201):

```typescript
      rows: rows.map((r, index) => ({
        position: index + 1,
        team: { slug: r.teamSlug, name: r.teamName },
```

Reemplazar por:

```typescript
      rows: rows.map((r, index) => ({
        position: index + 1,
        team: { slug: r.teamSlug, name: r.teamName, badgeUrl: r.teamBadgeUrl },
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/api exec vitest run app -t "sirve el catálogo"`
Expected: PASS.

- [ ] **Step 5: Correr toda la suite de la API**

Run: `pnpm --filter @ovalia/api exec vitest run`
Expected: todo en verde (o skip sin DB local).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/create-app.ts apps/api/src/app.test.ts
git commit -m "feat: exponer badgeUrl en la respuesta de posiciones"
```

---

### Task 8: Web — tipar `badgeUrl` en `ApiStandingRow`

**Files:**
- Modify: `apps/web/src/lib/api/types.ts:40-50`

**Interfaces:**
- Produces: `ApiStandingRow.team` gana `badgeUrl: string | null`.

- [ ] **Step 1: Editar el tipo**

En `apps/web/src/lib/api/types.ts`, reemplazar:

```typescript
export interface ApiStandingRow {
  position: number;
  team: { slug: string; name: string };
```

por:

```typescript
export interface ApiStandingRow {
  position: number;
  team: { slug: string; name: string; badgeUrl: string | null };
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ovalia/web exec tsc --noEmit`
Expected: sin errores nuevos atribuibles a este cambio (puede haber warnings preexistentes
no relacionados; si los hay, no tocarlos en este task).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api/types.ts
git commit -m "feat: tipar badgeUrl en ApiStandingRow"
```

---

### Task 9: Web — mostrar el escudo en la tabla de posiciones

**Files:**
- Modify: `apps/web/src/features/portal/portal-pages.tsx:172-176`

**Interfaces:**
- Consumes: `ApiStandingRow.team.badgeUrl` (Task 8), componente `TeamBadge` (ya existente en
  `apps/web/src/components/team-badge.tsx`, props `{ name, shortCode, badgeUrl?, size? }`),
  `findTeamBadge` de `@ovalia/domain` (ya importado en este archivo, línea 3).

- [ ] **Step 1: Editar el render de cada fila**

En `apps/web/src/features/portal/portal-pages.tsx`, reemplazar (líneas 172-176):

```typescript
              {standings.rows.map((row) => (
                <div className="standing-row" key={row.team.slug}>
                  <span>{row.position}</span><span>{row.team.name}</span><span>{row.played}</span><span>{row.points}</span>
                </div>
              ))}
```

por:

```typescript
              {standings.rows.map((row) => {
                const shortCode = findTeamBadge({ name: row.team.name })?.shortCode ?? row.team.name.slice(0, 3).toUpperCase();
                return (
                  <div className="standing-row" key={row.team.slug}>
                    <span>{row.position}</span>
                    <span className="standing-team">
                      <TeamBadge name={row.team.name} shortCode={shortCode} badgeUrl={row.team.badgeUrl ?? undefined} size="small" />
                      {row.team.name}
                    </span>
                    <span>{row.played}</span><span>{row.points}</span>
                  </div>
                );
              })}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ovalia/web exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Levantar el dev server y verificar visualmente**

Run: `pnpm --filter @ovalia/web dev` (en background) y abrir
`http://localhost:3000/torneos/urba-top-14`, pestaña "Posiciones".
Expected: cada fila muestra el escudo del club (o el placeholder SVG si `badgeUrl` falla al
cargar) antes del nombre.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/portal/portal-pages.tsx
git commit -m "feat: mostrar el escudo del equipo en la tabla de posiciones"
```

---

### Task 10: Adapter URBA — el catálogo trae las 85 competencias, no solo las 8 prioritarias

**Files:**
- Modify: `apps/worker/src/ingestion/adapters/urba/urba-adapter.ts:40-50`
- Test: `apps/worker/src/ingestion/adapters/urba/urba-parser.test.ts:18-38`

**Interfaces:**
- Consumes: `parseCompetitions(raw, priorityIds?, slugByExternalId?)` (sin cambios de firma).
- Produces: `UrbaAdapter.fetchCatalog` ya no filtra por `URBA_PRIORITY_IDS` — devuelve todas
  las competencias del año, con slug explícito para las 8 conocidas.

- [ ] **Step 1: Escribir el test que falla**

En `apps/worker/src/ingestion/adapters/urba/urba-parser.test.ts`, agregar después del test
`'emite el slug canónico provisto por el adaptador'` (después de la línea 38):

```typescript
  it('sin filtro de IDs devuelve todas las competencias del fixture', () => {
    const competitions = parseCompetitions(loadFixture('championships.sample.json'));
    expect(competitions.length).toBe(8);
  });
```

(El fixture actual tiene 8 entradas — este test documenta que sin `priorityIds` no se
filtra nada; cuando el fixture real de URBA tenga las 85, este número cambiará junto con el
fixture, no con el código del parser.)

- [ ] **Step 2: Correr el test y verificar que pasa** (el parser ya soporta `priorityIds`
opcional, así que este test debería pasar sin tocar `urba-parser.ts` — confirma que el
comportamiento de "sin filtro = todo" ya está bien en el parser; lo que falta es que el
adapter deje de pasar el filtro)

Run: `pnpm --filter @ovalia/worker exec vitest run urba-parser -t "sin filtro de IDs"`
Expected: PASS.

- [ ] **Step 3: Implementar el cambio en el adapter**

En `apps/worker/src/ingestion/adapters/urba/urba-adapter.ts`, ubicar `fetchCatalog`
(líneas 40-50):

```typescript
  async fetchCatalog(ctx: FetchContext) {
    const year = ctx.seasonYear ?? DEFAULT_YEAR;
    const [championshipsRaw, clubsRaw] = await Promise.all([
      this.client.championships(year),
      this.client.clubs(),
    ]);
    return {
      competitions: parseCompetitions(championshipsRaw, URBA_PRIORITY_IDS, URBA_SLUG_BY_EXTERNAL_ID),
      teams: parseClubsAsTeams(clubsRaw),
    };
  }
```

Reemplazar la línea de `competitions:` por:

```typescript
      competitions: parseCompetitions(championshipsRaw, undefined, URBA_SLUG_BY_EXTERNAL_ID),
```

Y quitar `URBA_PRIORITY_IDS` del import (línea 12) ya que deja de usarse en este archivo:

```typescript
import {
  URBA_PRIORITY_COMPETITIONS,
  URBA_SLUG_BY_EXTERNAL_ID,
} from './urba-competitions';
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @ovalia/worker exec tsc --noEmit`
Expected: sin errores (si `URBA_PRIORITY_IDS` queda sin uso en `urba-competitions.ts` mismo
no importa, sigue exportado por si se necesita en otro lado; solo se quitó el import no
usado en `urba-adapter.ts`).

- [ ] **Step 5: Correr toda la suite del parser y del adapter**

Run: `pnpm --filter @ovalia/worker exec vitest run urba`
Expected: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/ingestion/adapters/urba/urba-adapter.ts apps/worker/src/ingestion/adapters/urba/urba-parser.test.ts
git commit -m "feat: el catálogo URBA trae todas las competencias, no solo las prioritarias"
```

---

### Task 11: `importUrba` — fixtures/standings para todas las competencias del catálogo

**Files:**
- Modify: `apps/worker/src/ingestion/adapters/urba/urba-import.ts`
- Test (nuevo): `apps/worker/src/ingestion/adapters/urba/urba-import.test.ts`

**Interfaces:**
- Consumes: `UrbaAdapter.fetchCatalog(ctx): Promise<{ competitions: ExternalCompetition[], teams: ExternalTeam[] }>` (sin cambios de firma, ya existente).
- Produces: `importUrba(options: UrbaImportOptions): Promise<UrbaImportReport>` — el loop de
  fixtures/standings recorre `catalog.competitions` (con `externalId`/`name` reales del
  feed) en vez de la constante `URBA_PRIORITY_COMPETITIONS`. La firma pública de
  `importUrba` y de `UrbaImportReport` no cambian.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/worker/src/ingestion/adapters/urba/urba-import.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseHandle } from '@ovalia/database';
import { getTestDatabase, isDatabaseAvailable, makeSource, truncateAll } from '@ovalia/database/test-support';
import type { UrbaAdapter } from './urba-adapter';
import { importUrba } from './urba-import';

const available = await isDatabaseAvailable();

describe.skipIf(!available)('importUrba', () => {
  it('corre fixtures y standings para todas las competencias del catálogo, no solo las prioritarias', async () => {
    const handle: DatabaseHandle = await getTestDatabase();
    await truncateAll(handle);
    const source = await makeSource(handle.db, { slug: 'urba' });

    const fakeAdapter = {
      descriptor: { slug: 'urba', name: 'URBA', priority: 90, capabilities: ['catalog', 'fixtures', 'standings'] },
      supports: () => true,
      fetchCatalog: vi.fn().mockResolvedValue({
        competitions: [
          { externalId: '1', name: 'TOP 14 - Superior', category: 'clubs', gender: 'male', countryCode: 'AR', format: 'xv', season: { externalId: '2026', name: '2026', year: 2026 } },
          { externalId: '2', name: 'TOP 14 - Intermedia', category: 'clubs', gender: 'male', countryCode: 'AR', format: 'xv', season: { externalId: '2026', name: '2026', year: 2026 } },
        ],
        teams: [],
      }),
      fetchFixtures: vi.fn().mockResolvedValue([]),
      fetchStandings: vi.fn().mockResolvedValue({ competitionExternalId: '1', season: { externalId: '2026', year: 2026 }, rows: [] }),
    } as unknown as UrbaAdapter;

    const report = await importUrba({ db: handle.db, sourceId: source.id, adapter: fakeAdapter });

    expect(report.perCompetition).toHaveLength(2);
    expect(report.perCompetition.map((c) => c.externalId).sort()).toEqual(['1', '2']);
    expect(fakeAdapter.fetchFixtures).toHaveBeenCalledTimes(2);
    expect(fakeAdapter.fetchStandings).toHaveBeenCalledTimes(2);

    await handle.pool.end();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/worker exec vitest run urba-import`
Expected: FAIL — hoy `report.perCompetition` tendría longitud 0 (ninguna de las
`externalId` `'1'`/`'2'` del fake catalog está en `URBA_PRIORITY_COMPETITIONS`).

- [ ] **Step 3: Implementar**

Reemplazar el contenido completo de `apps/worker/src/ingestion/adapters/urba/urba-import.ts`
por:

```typescript
import type { Database } from '@ovalia/database';
import { runIngestion, type RunIngestionResult } from '../../run-ingestion';
import { URBA_PARSER_VERSION } from './urba-parser';
import { UrbaAdapter } from './urba-adapter';

export interface UrbaImportOptions {
  db: Database;
  sourceId: string;
  adapter?: UrbaAdapter;
  seasonYear?: number;
  dryRun?: boolean;
  competitionExternalIds?: string[];
}

export interface UrbaImportReport {
  catalog: RunIngestionResult;
  perCompetition: Array<{
    externalId: string;
    name: string;
    fixtures: RunIngestionResult;
    standings: RunIngestionResult;
  }>;
}

/** Importa el catálogo y, por cada competencia del feed, fixtures y posiciones. */
export async function importUrba(options: UrbaImportOptions): Promise<UrbaImportReport> {
  const adapter = options.adapter ?? new UrbaAdapter();
  const seasonYear = options.seasonYear ?? 2026;
  const base = {
    db: options.db,
    sourceId: options.sourceId,
    adapter,
    parserVersion: URBA_PARSER_VERSION,
    dryRun: options.dryRun,
  } as const;

  // fetchCatalog no tiene efectos secundarios (solo lee de la API de URBA), así que se
  // puede llamar acá para conocer la lista real de competencias del feed, además de
  // dejar que runIngestion haga su propio fetch+persist con checksum/idempotencia.
  const catalogPayload = await adapter.fetchCatalog!({ seasonYear });

  const catalog = await runIngestion({
    ...base,
    capability: 'catalog',
    context: { seasonYear },
  });

  const competitions = options.competitionExternalIds
    ? catalogPayload.competitions.filter((c) =>
        options.competitionExternalIds!.includes(c.externalId),
      )
    : catalogPayload.competitions;

  const perCompetition: UrbaImportReport['perCompetition'] = [];
  for (const competition of competitions) {
    const context = { competitionExternalId: competition.externalId, seasonYear };
    const fixtures = await runIngestion({ ...base, capability: 'fixtures', context });
    const standings = await runIngestion({ ...base, capability: 'standings', context });
    perCompetition.push({
      externalId: competition.externalId,
      name: competition.name,
      fixtures,
      standings,
    });
  }

  return { catalog, perCompetition };
}
```

Nota: `adapter.fetchCatalog` es opcional en el tipo `SportsDataAdapter` de `@ovalia/domain`
— el `!` asume que el adaptador de URBA siempre lo implementa (correcto, `UrbaAdapter` lo
implementa incondicionalmente). Si TypeScript se queja, cambiar a
`if (!adapter.fetchCatalog) throw new Error('adapter sin fetchCatalog')` antes de usarlo.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/worker exec vitest run urba-import`
Expected: PASS.

- [ ] **Step 5: Typecheck y suite completa del worker**

Run: `pnpm --filter @ovalia/worker exec tsc --noEmit && pnpm --filter @ovalia/worker exec vitest run`
Expected: sin errores, todo en verde.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/ingestion/adapters/urba/urba-import.ts apps/worker/src/ingestion/adapters/urba/urba-import.test.ts
git commit -m "feat: importUrba corre fixtures y standings para todas las competencias del catálogo"
```

---

### Task 12: CI — subir el timeout del job de ingesta

**Files:**
- Modify: `.github/workflows/ingest-urba.yml`

**Interfaces:** ninguna (solo config de CI).

- [ ] **Step 1: Editar el timeout**

En `.github/workflows/ingest-urba.yml`, cambiar:

```yaml
    timeout-minutes: 20
```

por:

```yaml
    timeout-minutes: 90
```

- [ ] **Step 2: Validar el YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ingest-urba.yml'))"`
Expected: sin error de parseo.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ingest-urba.yml
git commit -m "chore: subir el timeout de ingesta a 90 min para las 85 competencias"
```

---

### Task 13: Migrar datos existentes y correr una ingesta completa contra Neon

Este task no toca código — aplica los cambios anteriores contra la base de producción
(Neon) y GitHub Actions, y verifica el resultado end-to-end. Requiere acceso a
`DATABASE_URL` de producción (ya configurado como secret en GitHub, ver conversación previa
sobre el deploy) y a `gh` CLI autenticado.

**Files:** ninguno (operación, no código).

- [ ] **Step 1: Push de todos los commits de los Tasks 1-12**

```bash
git push
```

- [ ] **Step 2: Re-sembrar la base con el seed ajustado**

Correr el seed contra Neon para que las 4 selecciones nacionales queden con su badge
curado y para que los 6 clubes URBA retirados de `TEAM_BADGES` no generen inconsistencia
(el seed ya no los toca; sus datos actuales en la base quedan intactos hasta que la próxima
ingesta les actualice el badge por Task 3):

Run: `DATABASE_URL="<url-de-neon>" pnpm --filter @ovalia/database exec tsx src/seed.ts`
Expected: sin errores.

- [ ] **Step 3: Disparar el workflow de ingesta en modo full**

Run: `gh workflow run ingest-urba.yml --repo DalessandroBautista/ovalia --ref feat/real-data-platform -f mode=full`

- [ ] **Step 4: Esperar y verificar el resultado del run**

Run: `gh run list --repo DalessandroBautista/ovalia --workflow=ingest-urba.yml --limit 1`

Esperar a que el status pase a `completed`. Con el timeout de 90 min (Task 12) y 85
competencias, puede tardar bastante — si sigue `in_progress` después de 30-40 min, es
razonable dejarlo correr en background y revisar más tarde en vez de esperar activamente.

Expected: `conclusion: success`. Si falla, correr
`gh run view <run-id> --repo DalessandroBautista/ovalia --log-failed` para diagnosticar
(mismo patrón usado en la sesión anterior para depurar el pipeline).

- [ ] **Step 5: Verificar en la API de producción**

```bash
curl -s https://ovalia-api.vercel.app/v1/competitions | python3 -c "import json,sys; print(len(json.load(sys.stdin)['competitions']))"
```

Expected: ~85 (puede variar levemente si URBA agregó/sacó alguna competencia entre el
diseño y la ejecución).

```bash
curl -s "https://ovalia-api.vercel.app/v1/competitions/urba-top-14/standings" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['rows'][0]['team'])"
```

Expected: el objeto `team` incluye `badgeUrl` no nulo.

- [ ] **Step 6: Verificar visualmente en la web de producción**

Abrir `https://web-livid-zeta-8oddkplxke.vercel.app/torneos/urba-segunda` (o cualquier
torneo con clubes no-curados) y confirmar que la pestaña "Posiciones" muestra el escudo de
cada equipo.

- [ ] **Step 7: Actualizar el spec con el resultado real de timing (si difiere mucho)**

Si la corrida real tardó significativamente más o menos que la estimación de 90 min del
spec (`docs/superpowers/specs/2026-07-27-urba-badges-and-divisions-design.md`, sección
"Riesgos / seguimiento"), anotar el tiempo real ahí para futuras referencias. No es
bloqueante — es un ajuste de documentación.

---

## Self-Review Notes

- **Cobertura del spec:** Parte 1 (escudos) → Tasks 1-9. Parte 2 (divisiones) → Tasks 10-12.
  Verificación end-to-end → Task 13. El punto de "Fuera de alcance" del spec (planteles de
  jugadores, rediseño visual, timeout/alias de CI ajenos a este trabajo) no tiene tasks,
  correctamente.
- **Consistencia de tipos:** `TeamInput` (Task 3), `ExternalTeam` (Task 1) y el retorno de
  `parseClubsAsTeams` (Task 2) usan los mismos nombres de campo (`badgeUrl`,
  `badgeSourceUrl`, `badgeFormat`) de punta a punta. `ApiStandingRow.team.badgeUrl` (Task 8)
  coincide con lo que la API devuelve (Task 7), que a su vez viene de `teamBadgeUrl` en
  `getStandingsForSeason` (Task 6).
- **Orden de tasks:** 1→2→3→4 (backend de badges) es estrictamente secuencial por
  dependencia de tipos. 6→7→8→9 (badge en posiciones) también. 10→11 depende de que el
  parser ya soporte `priorityIds` opcional (ya lo soporta hoy, confirmado leyendo el código
  antes de escribir el plan). Task 5 es independiente y puede hacerse en paralelo con
  6-9. Task 12 es independiente. Task 13 depende de todo lo anterior.
