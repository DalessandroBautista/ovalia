# Navegación jerárquica de torneos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/torneos` y el calendario del home dejan de listar competencias planas y pasan a
una jerarquía de 3 niveles: organización (URBA, Rugby Internacional, ...) → familia de
torneo (Top 14, Primera A, ...) → categoría dentro de la familia (Superior, Intermedia,
Preintermedia, M22).

**Architecture:** Dos columnas nuevas en `competitions` (`family_slug`, `tier`) pobladas
por una función pura de derivación de nombre para URBA, join contra `organizations`
(tabla existente, hoy vacía) expuesto en `/v1/competitions`, y agrupación en el cliente
(sin endpoint de agregación nuevo).

**Tech Stack:** TypeScript, Drizzle ORM + drizzle-kit (migraciones), Fastify, Next.js,
Vitest.

Este es el Plan 2 de 3 del spec
`docs/superpowers/specs/2026-07-28-home-fallback-torneos-nav-highlightly-design.md`
(Parte 2). Depende de que exista la columna `priority` curada del Plan 1 (Task 3) para que
"familia" muestre primero la división Superior, pero no depende del resto del Plan 1.

## Global Constraints

- Los nombres de URBA vienen siempre como `"DIVISIÓN - CATEGORÍA"` (confirmado contra el
  fixture real y la API en vivo en la sesión de diseño). La derivación de taxonomía debe
  tolerar nombres que no sigan el patrón (sin guion) devolviendo `tier: 'senior'` y
  `familySlug` igual al slug de la propia competencia, no crashear.
- No se crea ningún endpoint de agregación nuevo — la agrupación se hace en el cliente.
- Convención de commits en español, `tipo: descripción corta`.

---

### Task 1: Migración de schema — `family_slug` y `tier` en `competitions`

**Files:**
- Modify: `packages/database/src/schema.ts`
- Create: migración generada por drizzle-kit en `packages/database/drizzle/`

**Interfaces:**
- Produces: `competitions.familySlug: text | null`, `competitions.tier: text not null
  default 'senior'`.

- [ ] **Step 1: Editar el schema**

En `packages/database/src/schema.ts`, en la tabla `competitions` (después de `priority:
integer(...)`), agregar:

```typescript
  familySlug: text('family_slug'),
  tier: text('tier').notNull().default('senior'),
```

- [ ] **Step 2: Generar la migración**

Run: `cd packages/database && pnpm exec drizzle-kit generate`
Expected: crea un archivo nuevo en `packages/database/drizzle/000X_<nombre>.sql` con
`ALTER TABLE "competitions" ADD COLUMN "family_slug" text;` y
`ALTER TABLE "competitions" ADD COLUMN "tier" text DEFAULT 'senior' NOT NULL;`.

- [ ] **Step 3: Aplicar la migración contra la base de test local**

Requiere Postgres local corriendo (`docker ps` → contenedor `ovalia-db-1` en `54329`).

Run:
```bash
DATABASE_URL="postgres://ovalia:ovalia@localhost:54329/ovalia" pnpm --filter @ovalia/database exec drizzle-kit migrate
```
Expected: aplica sin error.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @ovalia/database exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/schema.ts packages/database/drizzle/
git commit -m "feat: agregar family_slug y tier a competitions"
```

---

### Task 2: Poblar `organizations` en el seed

**Files:**
- Modify: `packages/database/src/seed.ts`

**Interfaces:**
- Produces: filas en `organizations` con slugs `urba`, `super-rugby`,
  `rugby-internacional`, `rugby-seven`.

- [ ] **Step 1: Revisar el repositorio de organizaciones**

`packages/database` no tiene hoy un `organizations-repository.ts` — confirmar con
`find packages/database/src/repositories -iname "*organization*"`. Si no existe, crear
`packages/database/src/repositories/organizations-repository.ts`:

```typescript
import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { organizations } from '../schema.js';

export type OrganizationInput = {
  slug: string;
  name: string;
  kind: string;
  countryCode?: string | null;
};

export async function upsertOrganization(db: Database, input: OrganizationInput) {
  const values = {
    slug: input.slug,
    name: input.name,
    kind: input.kind,
    countryCode: input.countryCode ?? null,
  };
  const [row] = await db
    .insert(organizations)
    .values(values)
    .onConflictDoUpdate({
      target: organizations.slug,
      set: { name: values.name, kind: values.kind, countryCode: values.countryCode },
    });
  return row!;
}

export function findOrganizationBySlug(db: Database, slug: string) {
  return db.query.organizations.findFirst({ where: eq(organizations.slug, slug) });
}
```

Agregar el export en `packages/database/src/repositories.ts` (o el barrel file que
reexporte todos los repositorios — confirmar el nombre real con
`grep -rn "export \* from './repositories" packages/database/src/index.ts`).

- [ ] **Step 2: Test del repositorio**

En `packages/database/src/repositories.test.ts`, agregar (importando `upsertOrganization`,
`findOrganizationBySlug`):

```typescript
  it('upsertOrganization es idempotente por slug', async () => {
    const { db } = handle;
    await upsertOrganization(db, { slug: 'urba', name: 'Unión de Rugby de Buenos Aires', kind: 'union', countryCode: 'AR' });
    await upsertOrganization(db, { slug: 'urba', name: 'URBA', kind: 'union', countryCode: 'AR' });
    const org = await findOrganizationBySlug(db, 'urba');
    expect(org?.name).toBe('URBA');
    const all = await db.query.organizations.findMany();
    expect(all).toHaveLength(1);
  });
```

Run: `pnpm --filter @ovalia/database exec vitest run repositories -t "upsertOrganization"`
Expected: FAIL primero (función no existe), después de implementar el Step 1 completo,
PASS.

- [ ] **Step 3: Sumar el seed de organizaciones**

En `packages/database/src/seed.ts`, después del bloque de curado de `priority` (Plan 1
Task 3, o al final si ese plan todavía no se implementó — este task no depende de él para
compilar, solo el orden final en el archivo puede variar), agregar:

```typescript
const ORGANIZATIONS: Array<{ slug: string; name: string; kind: string; countryCode: string | null }> = [
  { slug: 'urba', name: 'Unión de Rugby de Buenos Aires', kind: 'union', countryCode: 'AR' },
  { slug: 'super-rugby', name: 'Súper Rugby', kind: 'league', countryCode: null },
  { slug: 'rugby-internacional', name: 'Rugby Internacional', kind: 'international', countryCode: null },
  { slug: 'rugby-seven', name: 'Rugby Seven', kind: 'sevens', countryCode: null },
];
for (const org of ORGANIZATIONS) {
  await upsertOrganization(db, org);
}
```

Importar `upsertOrganization` en el bloque de imports de `seed.ts`.

- [ ] **Step 4: Correr el seed local y verificar**

Run: `DATABASE_URL="postgres://ovalia:ovalia@localhost:54329/ovalia" pnpm --filter @ovalia/database exec tsx src/seed.ts`
Expected: sin error.

- [ ] **Step 5: Typecheck y suite**

Run: `pnpm --filter @ovalia/database exec tsc --noEmit && pnpm --filter @ovalia/database exec vitest run`
Expected: sin errores, todo en verde.

- [ ] **Step 6: Commit**

```bash
git add packages/database/src/repositories/organizations-repository.ts packages/database/src/repositories.ts packages/database/src/seed.ts packages/database/src/repositories.test.ts
git commit -m "feat: repositorio de organizaciones y seed de uniones/ligas"
```

---

### Task 3: `deriveUrbaTaxonomy` — familia y tier a partir del nombre

**Files:**
- Create: `apps/worker/src/ingestion/adapters/urba/urba-taxonomy.ts`
- Test: `apps/worker/src/ingestion/adapters/urba/urba-taxonomy.test.ts`

**Interfaces:**
- Produces: `deriveUrbaTaxonomy(name: string): { familySlug: string; tier: 'senior' |
  'intermediate' | 'youth' | 'women' | 'university' }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/worker/src/ingestion/adapters/urba/urba-taxonomy.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { deriveUrbaTaxonomy } from './urba-taxonomy';

describe('deriveUrbaTaxonomy', () => {
  it('clasifica Superior como senior', () => {
    expect(deriveUrbaTaxonomy('TOP 14 - Superior')).toEqual({ familySlug: 'top-14', tier: 'senior' });
  });
  it('clasifica Intermedia como intermediate', () => {
    expect(deriveUrbaTaxonomy('TOP 14 - Intermedia')).toEqual({ familySlug: 'top-14', tier: 'intermediate' });
  });
  it('clasifica Preintermedia (con o sin letra) como intermediate', () => {
    expect(deriveUrbaTaxonomy('TOP 14 - Preintermedia')).toEqual({ familySlug: 'top-14', tier: 'intermediate' });
    expect(deriveUrbaTaxonomy('TOP 14 - Preintermedia B')).toEqual({ familySlug: 'top-14', tier: 'intermediate' });
  });
  it('clasifica Menores de 22 como youth', () => {
    expect(deriveUrbaTaxonomy('TOP 14 - Menores de 22')).toEqual({ familySlug: 'top-14', tier: 'youth' });
  });
  it('clasifica Femenino como women, familia por su propio nombre', () => {
    expect(deriveUrbaTaxonomy('FEMENINO - TOP 9')).toEqual({ familySlug: 'femenino', tier: 'women' });
  });
  it('clasifica Menores de 19/17/16/15 como youth, familia por edad', () => {
    expect(deriveUrbaTaxonomy('Menores de 19 - Primera Rueda - G2 NIVEL 1 A')).toEqual({ familySlug: 'menores-de-19', tier: 'youth' });
    expect(deriveUrbaTaxonomy('Menores de 15 - Primera Rueda - G1 A')).toEqual({ familySlug: 'menores-de-15', tier: 'youth' });
  });
  it('clasifica Universitario/Formativo como university', () => {
    expect(deriveUrbaTaxonomy('Rugby Universitario - Campeonato')).toEqual({ familySlug: 'rugby-universitario', tier: 'university' });
    expect(deriveUrbaTaxonomy('Rugby Formativo - Primera Division')).toEqual({ familySlug: 'rugby-formativo', tier: 'university' });
  });
  it('nombres sin patrón conocido devuelven senior y familia propia, sin crashear', () => {
    expect(deriveUrbaTaxonomy('Torneo Especial')).toEqual({ familySlug: 'torneo-especial', tier: 'senior' });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/worker exec vitest run urba-taxonomy`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar**

Crear `apps/worker/src/ingestion/adapters/urba/urba-taxonomy.ts`:

```typescript
export type UrbaTier = 'senior' | 'intermediate' | 'youth' | 'women' | 'university';

export interface UrbaTaxonomy {
  familySlug: string;
  tier: UrbaTier;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function tierFromCategory(category: string): UrbaTier {
  const normalized = category.toLowerCase();
  if (/^menores de 22/.test(normalized)) return 'youth';
  if (/^(intermedia|preintermedia)/.test(normalized)) return 'intermediate';
  if (/^superior|^primera divisi[oó]n$/.test(normalized)) return 'senior';
  return 'senior';
}

/** Deriva familia (torneo del que es "hermana" esta competencia) y tier a partir del
 * nombre crudo de URBA, que sigue el patrón "DIVISIÓN - CATEGORÍA" para las divisiones
 * de clubes, o nombres propios para femenino/juveniles/universitario/formativo. */
export function deriveUrbaTaxonomy(name: string): UrbaTaxonomy {
  if (/^femenino\b/i.test(name)) {
    return { familySlug: 'femenino', tier: 'women' };
  }
  const menoresMatch = name.match(/^menores de (\d+)/i);
  if (menoresMatch) {
    return { familySlug: `menores-de-${menoresMatch[1]}`, tier: 'youth' };
  }
  if (/^rugby universitario/i.test(name)) {
    return { familySlug: 'rugby-universitario', tier: 'university' };
  }
  if (/^rugby formativo/i.test(name)) {
    return { familySlug: 'rugby-formativo', tier: 'university' };
  }
  const parts = name.split(' - ');
  if (parts.length >= 2) {
    const [division, ...rest] = parts;
    const category = rest.join(' - ');
    return { familySlug: slugify(division!), tier: tierFromCategory(category) };
  }
  return { familySlug: slugify(name), tier: 'senior' };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/worker exec vitest run urba-taxonomy`
Expected: PASS todos.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @ovalia/worker exec tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/ingestion/adapters/urba/urba-taxonomy.ts apps/worker/src/ingestion/adapters/urba/urba-taxonomy.test.ts
git commit -m "feat: deriveUrbaTaxonomy clasifica competencias URBA en familia y tier"
```

---

### Task 4: Enchufar la taxonomía en el parser y persistirla

**Files:**
- Modify: `packages/domain/src/ingestion/external-competition.ts`
- Modify: `apps/worker/src/ingestion/adapters/urba/urba-parser.ts`
- Modify: `packages/database/src/repositories/competitions-repository.ts`
- Modify: `apps/worker/src/ingestion/run-ingestion.ts`
- Test: `apps/worker/src/ingestion/adapters/urba/urba-parser.test.ts`,
  `packages/database/src/repositories.test.ts`

**Interfaces:**
- Consumes: `deriveUrbaTaxonomy` (Task 3).
- Produces: `ExternalCompetition` gana `familySlug?: string`, `tier?: string`;
  `CompetitionInput` (database) gana los mismos campos opcionales; `upsertCompetition` los
  persiste (sin necesidad de "preservar si no viene", a diferencia de `priority` — estos
  campos siempre se pueden recalcular del nombre en cada ingesta, no hay curación manual
  que proteger).

- [ ] **Step 1: Domain — sumar los campos**

En `packages/domain/src/ingestion/external-competition.ts`, revisar el schema actual
(`grep -n "externalCompetitionSchema" -A 15 packages/domain/src/ingestion/external-competition.ts`)
y agregar:

```typescript
  familySlug: z.string().optional(),
  tier: z.string().optional(),
```

al objeto zod existente.

- [ ] **Step 2: Test del parser**

En `apps/worker/src/ingestion/adapters/urba/urba-parser.test.ts`, extender el test
`'parsea competencias con género y temporada'` (o agregar uno nuevo) para afirmar:

```typescript
  it('parsea familySlug y tier derivados del nombre', () => {
    const competitions = parseCompetitions(loadFixture('championships.sample.json'));
    const top14 = competitions.find((c) => c.externalId === '2025176');
    expect(top14).toMatchObject({ familySlug: 'top-14', tier: 'senior' });
  });
```

Run: `pnpm --filter @ovalia/worker exec vitest run urba-parser -t "familySlug y tier"`
Expected: FAIL.

- [ ] **Step 3: Implementar en el parser**

En `apps/worker/src/ingestion/adapters/urba/urba-parser.ts`, en `parseCompetitions`,
importar `deriveUrbaTaxonomy` desde `./urba-taxonomy` y sumar sus campos al objeto
devuelto por cada competencia:

```typescript
    .map((c) => {
      const slug = slugByExternalId?.get(String(c.id));
      const taxonomy = deriveUrbaTaxonomy(c.name);
      return {
        externalId: String(c.id),
        name: c.name,
        ...(slug ? { slug } : {}),
        category: 'clubs',
        gender: genderFromName(c.name),
        countryCode: 'AR',
        format: 'xv' as const,
        familySlug: taxonomy.familySlug,
        tier: taxonomy.tier,
        season: { externalId: String(c.season.id), name: c.season.name, year: c.season.id },
      };
    });
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/worker exec vitest run urba-parser`
Expected: todos en verde.

- [ ] **Step 5: Database — sumar campos a `CompetitionInput` y persistirlos**

En `packages/database/src/repositories/competitions-repository.ts`, agregar a
`CompetitionInput`:

```typescript
  familySlug?: string | null;
  tier?: string;
```

y en `upsertCompetition`, sumar al objeto `values` y al `set` del `onConflictDoUpdate`:

```typescript
    familySlug: input.familySlug ?? null,
    tier: input.tier ?? 'senior',
```

(en `values`, junto a `priority: input.priority`), y en el `set`:

```typescript
        familySlug: values.familySlug,
        tier: values.tier,
```

(estos SÍ se actualizan siempre, a diferencia de `priority` — no necesitan el guard de
"preservar si no viene", porque siempre se recalculan del nombre real en cada ingesta y no
hay curación manual que proteger).

- [ ] **Step 6: Test de persistencia**

En `packages/database/src/repositories.test.ts`, agregar:

```typescript
  it('upsertCompetition persiste familySlug y tier', async () => {
    const { db } = handle;
    const row = await upsertCompetition(db, {
      slug: 'top-14-intermedia',
      name: 'TOP 14 - Intermedia',
      category: 'clubs',
      gender: 'male',
      familySlug: 'top-14',
      tier: 'intermediate',
    });
    expect(row.familySlug).toBe('top-14');
    expect(row.tier).toBe('intermediate');
  });
```

Run: `pnpm --filter @ovalia/database exec vitest run repositories -t "familySlug y tier"`
Expected: FAIL primero, PASS después de implementar.

- [ ] **Step 7: Worker — pasar los campos en `persistCatalog`**

En `apps/worker/src/ingestion/run-ingestion.ts`, en `persistCatalog`, el call a
`upsertCompetition` suma:

```typescript
      familySlug: competition.familySlug ?? null,
      tier: competition.tier ?? 'senior',
```

- [ ] **Step 8: Typecheck y suites completas**

Run:
```bash
pnpm --filter @ovalia/domain exec tsc --noEmit
pnpm --filter @ovalia/database exec tsc --noEmit && pnpm --filter @ovalia/database exec vitest run
pnpm --filter @ovalia/worker exec tsc --noEmit && pnpm --filter @ovalia/worker exec vitest run
```
Expected: sin errores, todo en verde.

- [ ] **Step 9: Rebuild de domain y database (los consumen api/worker desde dist)**

Run: `pnpm --filter @ovalia/domain build && pnpm --filter @ovalia/database build`

- [ ] **Step 10: Commit**

```bash
git add packages/domain/src/ingestion/external-competition.ts apps/worker/src/ingestion/adapters/urba/urba-parser.ts apps/worker/src/ingestion/adapters/urba/urba-parser.test.ts packages/database/src/repositories/competitions-repository.ts packages/database/src/repositories.test.ts apps/worker/src/ingestion/run-ingestion.ts
git commit -m "feat: derivar y persistir familySlug/tier en la ingesta de URBA"
```

---

### Task 5: Backfill de `familySlug`/`tier` para las 88 competencias ya en producción

**Files:**
- Create: `packages/database/src/scripts/backfill-competition-taxonomy.ts`

**Interfaces:**
- Consumes: `deriveUrbaTaxonomy` (Task 3), `upsertCompetition` con familySlug/tier
  (Task 4).

- [ ] **Step 1: Escribir el script one-off**

Crear `packages/database/src/scripts/backfill-competition-taxonomy.ts`:

```typescript
import { createDatabase } from '../client.js';
import { competitions } from '../schema.js';
import { deriveUrbaTaxonomy } from '../../../../apps/worker/src/ingestion/adapters/urba/urba-taxonomy.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL requerido');
const { db, pool } = createDatabase(connectionString);

const rows = await db.select().from(competitions);
let updated = 0;
for (const row of rows) {
  const taxonomy = deriveUrbaTaxonomy(row.name);
  await db
    .update(competitions)
    .set({ familySlug: taxonomy.familySlug, tier: taxonomy.tier })
    .where((c) => c.id === row.id);
  updated += 1;
}
console.log(`Backfill completo: ${updated} competencias actualizadas.`);
await pool.end();
```

Revisar la sintaxis real de `where` con Drizzle para update por id (probablemente
`eq(competitions.id, row.id)` en vez de un callback — ajustar según el patrón que ya usan
otros repositorios del proyecto, ej. `packages/database/src/repositories/teams-repository.ts`
usa `eq(teams.id, teamId)` importado de `drizzle-orm`).

Nota sobre el import cruzado a `apps/worker`: si el path relativo resulta frágil o
`packages/database` no puede resolver módulos fuera de su propio `rootDir` de TypeScript,
alternativa más simple: copiar `deriveUrbaTaxonomy` como función privada dentro del script
mismo (son ~25 líneas, aceptable duplicar en un script one-off que se corre una vez y no se
mantiene).

- [ ] **Step 2: Correr contra la base de test local**

Run: `DATABASE_URL="postgres://ovalia:ovalia@localhost:54329/ovalia" pnpm --filter @ovalia/database exec tsx src/scripts/backfill-competition-taxonomy.ts`
Expected: imprime la cantidad de filas actualizadas, sin error.

- [ ] **Step 3: Verificar manualmente**

Run:
```bash
DATABASE_URL="postgres://ovalia:ovalia@localhost:54329/ovalia" pnpm --filter @ovalia/database exec tsx -e "
import { createDatabase } from './src/client.js';
import { sql } from 'drizzle-orm';
const { db, pool } = createDatabase(process.env.DATABASE_URL);
const r = await db.execute(sql\`select family_slug, tier, count(*)::int as c from competitions group by family_slug, tier order by c desc limit 15\`);
console.log(r.rows);
await pool.end();
"
```
Expected: `top-14` con varias filas de distinto `tier`, `menores-de-19` con `tier=youth`,
etc.

- [ ] **Step 4: Commit**

```bash
git add packages/database/src/scripts/backfill-competition-taxonomy.ts
git commit -m "chore: script de backfill de familySlug/tier para competencias existentes"
```

(Este script se corre una vez contra producción en el Task 8 de este plan — no forma parte
del pipeline de ingesta regular.)

---

### Task 6: API — exponer `organization`, `familySlug`, `tier`

**Files:**
- Modify: `apps/api/src/create-app.ts`
- Modify: `apps/web/src/lib/api/types.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Produces: `GET /v1/competitions` devuelve por cada competencia
  `organization: { slug: string; name: string } | null`, `familySlug: string | null`,
  `tier: string`.

- [ ] **Step 1: Escribir el test que falla**

En `apps/api/src/app.test.ts`, agregar (usando `upsertOrganization`/`upsertCompetition`
directo, o extendiendo `seedCompetition` — revisar si conviene un seed nuevo específico):

```typescript
  it('/v1/competitions incluye organización, familia y tier', async () => {
    const { db } = handle;
    const org = await upsertOrganization(db, { slug: 'urba', name: 'URBA', kind: 'union', countryCode: 'AR' });
    await upsertCompetition(db, {
      slug: 'urba-top-14',
      name: 'TOP 14 - Superior',
      category: 'clubs',
      gender: 'male',
      familySlug: 'top-14',
      tier: 'senior',
      organizationId: org.id,
    });
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/competitions' });
    const body = res.json();
    const top14 = body.competitions.find((c: { slug: string }) => c.slug === 'urba-top-14');
    expect(top14).toMatchObject({
      organization: { slug: 'urba', name: 'URBA' },
      familySlug: 'top-14',
      tier: 'senior',
    });
  });
```

Importar `upsertOrganization` y `upsertCompetition` en `app.test.ts`.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/api exec vitest run app -t "organización, familia y tier"`
Expected: FAIL.

- [ ] **Step 3: Implementar — repositorio**

`listCompetitions` (en `packages/database/src/repositories/competitions-repository.ts`)
hoy usa `db.query.competitions.findMany()`. Cambiarlo para incluir la relación con
`organizations`:

```typescript
export function listCompetitions(db: Database) {
  return db.query.competitions.findMany({ with: { organization: true } });
}
```

Esto requiere que el `relations()` de Drizzle para `competitions` → `organizations` esté
declarado en `packages/database/src/schema.ts` (revisar si ya existe una sección de
`relations` al final del archivo; si no existe ninguna relación declarada todavía en el
proyecto, agregar):

```typescript
import { relations } from 'drizzle-orm';
// ...
export const competitionsRelations = relations(competitions, ({ one }) => ({
  organization: one(organizations, { fields: [competitions.organizationId], references: [organizations.id] }),
}));
```

Y confirmar que `client.ts` (`createDatabase`) pasa el `schema` completo (incluidas las
relations) a `drizzle(pool, { schema })` — revisar `packages/database/src/client.ts`; si el
`schema` importado es `import * as schema from './schema.js'`, las relations nuevas se
recogen automáticamente sin más cambios.

- [ ] **Step 4: Implementar — API**

En `apps/api/src/create-app.ts`, la ruta `GET /v1/competitions` (líneas ~157-168) pasa de:

```typescript
      competitions: competitions.map((c) => ({
        slug: c.slug,
        name: c.name,
        category: c.category,
        gender: c.gender,
        countryCode: c.countryCode,
        coverage: c.coverage,
      })),
```

a:

```typescript
      competitions: competitions.map((c) => ({
        slug: c.slug,
        name: c.name,
        category: c.category,
        gender: c.gender,
        countryCode: c.countryCode,
        coverage: c.coverage,
        organization: c.organization ? { slug: c.organization.slug, name: c.organization.name } : null,
        familySlug: c.familySlug,
        tier: c.tier,
      })),
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/api exec vitest run app`
Expected: todo en verde.

- [ ] **Step 6: Actualizar tipos del web**

En `apps/web/src/lib/api/types.ts`, `ApiCompetition` gana:

```typescript
  organization: { slug: string; name: string } | null;
  familySlug: string | null;
  tier: string;
```

- [ ] **Step 7: Typecheck de los tres paquetes**

Run:
```bash
pnpm --filter @ovalia/database exec tsc --noEmit
pnpm --filter @ovalia/api exec tsc --noEmit
pnpm --filter @ovalia/web exec tsc --noEmit
```
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add packages/database/src/schema.ts packages/database/src/repositories/competitions-repository.ts apps/api/src/create-app.ts apps/api/src/app.test.ts apps/web/src/lib/api/types.ts
git commit -m "feat: /v1/competitions expone organization, familySlug y tier"
```

---

### Task 7: Frontend — landing jerárquica de `/torneos`

**Files:**
- Modify: `apps/web/src/features/portal/portal-pages.tsx`
- Test: crear `apps/web/src/features/portal/portal-pages.test.tsx` si no existe (revisar
  con `find apps/web/src/features/portal -name "*.test.tsx"`)

**Interfaces:**
- Consumes: `ApiCompetition.organization/familySlug/tier` (Task 6).

- [ ] **Step 1: Escribir el test que falla**

Si no existe un test file para `portal-pages.tsx`, crear
`apps/web/src/features/portal/portal-pages.test.tsx` con:

```typescript
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../tournaments/use-tournaments', () => ({
  useCompetitions: () => ({
    status: 'ready',
    competitions: [
      { slug: 'urba-top-14', name: 'TOP 14 - Superior', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'top-14', tier: 'senior' },
      { slug: 'top-14-intermedia', name: 'TOP 14 - Intermedia', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'top-14', tier: 'intermediate' },
      { slug: 'urba-primera-a', name: 'PRIMERA A - Superior', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'primera-a', tier: 'senior' },
      { slug: 'menores-de-19-primera-rueda-g2-nivel-1-a', name: 'Menores de 19 - Primera Rueda - G2 NIVEL 1 A', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'menores-de-19', tier: 'youth' },
    ],
  }),
  useTournament: vi.fn(),
}));

import { TournamentsPage } from './portal-pages';

describe('TournamentsPage', () => {
  it('agrupa por organización y muestra solo un ítem por familia senior', () => {
    const html = renderToStaticMarkup(createElement(TournamentsPage));
    expect(html).toContain('URBA');
    expect(html).toContain('TOP 14 - Superior');
    expect(html).toContain('PRIMERA A - Superior');
    // No debe listar Intermedia como ítem separado en el nivel 1.
    expect(html).not.toContain('TOP 14 - Intermedia');
    // Juveniles aparece agrupado aparte.
    expect(html).toContain('Juveniles');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/web exec vitest run portal-pages`
Expected: FAIL — la agrupación actual (`covered`/`upcoming` por `coverage`) no filtra por
`tier` ni agrupa por `organization`.

- [ ] **Step 3: Implementar**

Reemplazar `TournamentsPage` en `apps/web/src/features/portal/portal-pages.tsx`:

```typescript
interface OrgGroup {
  orgName: string;
  senior: ApiCompetition[];
  youth: ApiCompetition[];
}

function groupByOrganization(competitions: ApiCompetition[]): OrgGroup[] {
  const seniorSeen = new Set<string>();
  const youthSeen = new Set<string>();
  const groups = new Map<string, OrgGroup>();
  for (const c of competitions) {
    if (c.coverage !== 'auto') continue;
    const orgName = c.organization?.name ?? 'Sin unión';
    if (!groups.has(orgName)) groups.set(orgName, { orgName, senior: [], youth: [] });
    const group = groups.get(orgName)!;
    const familyKey = `${orgName}:${c.familySlug ?? c.slug}`;
    if (c.tier === 'youth') {
      if (!youthSeen.has(familyKey)) { youthSeen.add(familyKey); group.youth.push(c); }
    } else if (c.tier === 'senior') {
      if (!seniorSeen.has(familyKey)) { seniorSeen.add(familyKey); group.senior.push(c); }
    }
  }
  return [...groups.values()];
}

export function TournamentsPage() {
  const { status, competitions } = useCompetitions();
  const groups = groupByOrganization(competitions);
  const upcoming = competitions.filter((c) => c.coverage !== 'auto');
  return (
    <Frame eyebrow="COBERTURA" title="Todos los torneos" intro="Competencias con datos verificados y las que estamos incorporando.">
      {status === 'loading' ? <p className="portal-live-status">Cargando torneos…</p> : null}
      {status === 'error' ? <p className="portal-live-status portal-live-status--error">No pudimos cargar los torneos.</p> : null}
      {groups.map((group) => (
        <section className="tournament-group" key={group.orgName}>
          <h2>{group.orgName}</h2>
          {group.senior.map((c) => (
            <a href={`/torneos/${c.slug}`} key={c.slug}><span>{c.name}</span><i>→</i></a>
          ))}
          {group.youth.length > 0 ? (
            <>
              <h3>Juveniles</h3>
              {group.youth.map((c) => (
                <a href={`/torneos/${c.slug}`} key={c.slug}><span>{c.name}</span><i>→</i></a>
              ))}
            </>
          ) : null}
        </section>
      ))}
      {upcoming.length > 0 ? (
        <section className="tournament-group">
          <h2>En preparación</h2>
          {upcoming.map((c) => (
            <div className="tournament-upcoming" key={c.slug} aria-disabled="true">
              <span>{c.name}</span>
              <small>Cobertura en preparación</small>
            </div>
          ))}
        </section>
      ) : null}
    </Frame>
  );
}
```

Importar `ApiCompetition` desde `../../lib/api/types` si no está ya importado en el
archivo.

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/web exec vitest run portal-pages`
Expected: PASS.

- [ ] **Step 5: Typecheck y suite completa**

Run: `pnpm --filter @ovalia/web exec tsc --noEmit && pnpm --filter @ovalia/web exec vitest run`
Expected: sin errores, todo en verde.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/portal/portal-pages.tsx apps/web/src/features/portal/portal-pages.test.tsx
git commit -m "feat: /torneos agrupa por organización y familia en vez de lista plana"
```

---

### Task 8: Frontend — selector de familia dentro de `TournamentPage`

**Files:**
- Modify: `apps/web/src/features/portal/portal-pages.tsx`
- Test: `apps/web/src/features/portal/portal-pages.test.tsx`

**Interfaces:**
- Consumes: `useCompetitions()` (ya usado en `TournamentsPage`, se suma a
  `TournamentPage`).

- [ ] **Step 1: Escribir el test que falla**

Agregar al mock de `useCompetitions` del test file (mismo mock del Task 7, reutilizado) y
sumar:

```typescript
  it('TournamentPage muestra un selector con las competencias de la misma familia', () => {
    const html = renderToStaticMarkup(createElement(TournamentPage, { slug: 'urba-top-14' }));
    expect(html).toContain('TOP 14 - Intermedia');
  });
```

(Este test requiere también mockear `useTournament(slug, season)` — que ya está en el
`vi.mock` del Task 7 como `vi.fn()`; ajustarlo para devolver un estado mínimo válido, ej.
`useTournament: () => ({ status: 'ready', competition: { slug: 'urba-top-14', name: 'TOP 14 - Superior', seasons: [{ year: 2026, name: '2026' }] }, standings: null, matches: [] })`.)

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @ovalia/web exec vitest run portal-pages -t "selector con las competencias"`
Expected: FAIL — `TournamentPage` no renderiza nada de las competencias hermanas hoy.

- [ ] **Step 3: Implementar**

En `TournamentPage` (`apps/web/src/features/portal/portal-pages.tsx`), sumar:

```typescript
  const { competitions } = useCompetitions();
  const siblings = competitions.filter((c) => c.familySlug && c.familySlug === competition?.familySlug);
```

(ubicar esta línea después de que `competition` esté disponible — es decir, después del
`if (status === 'error' || !competition) return ...` existente, ya que `competition` puede
ser `null` antes de eso).

Y en el JSX, después de la `<nav className="tab-bar">` existente (posiciones/resultados/
calendario) y antes del contenido de la tab activa, agregar el selector:

```typescript
      {siblings.length > 1 ? (
        <nav className="family-selector" aria-label="Otras categorías de este torneo">
          {siblings.map((s) => (
            <a
              key={s.slug}
              href={`/torneos/${s.slug}`}
              className={s.slug === slug ? 'active' : ''}
            >
              {s.name.split(' - ').at(-1) ?? s.name}
            </a>
          ))}
        </nav>
      ) : null}
```

Nota: `ApiCompetition` (el tipo de `competitions` en `useCompetitions`) no trae
`familySlug` en el objeto `competition` de `useTournament` (que es `ApiCompetitionDetail`,
un tipo distinto) — revisar `apps/web/src/lib/api/types.ts` para `ApiCompetitionDetail` y
sumarle `familySlug: string | null` igual que se hizo en `ApiCompetition` (Task 6), y
propagarlo desde `apps/api/src/create-app.ts` en la ruta `GET /v1/competitions/:slug` (el
mismo patrón que en Task 6 Step 4, aplicado a ese otro endpoint).

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @ovalia/web exec vitest run portal-pages`
Expected: PASS.

- [ ] **Step 5: Typecheck y suite completa**

Run: `pnpm --filter @ovalia/web exec tsc --noEmit && pnpm --filter @ovalia/web exec vitest run`
Expected: sin errores, todo en verde.

- [ ] **Step 6: Verificación visual**

Levantar dev server (web + api con `DATABASE_URL` local), navegar a `/torneos/urba-top-14`
y confirmar que aparece el selector con Intermedia/Preintermedia/M22, y que clickear cambia
de página mostrando el torneo correcto.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/portal/portal-pages.tsx apps/web/src/features/portal/portal-pages.test.tsx apps/web/src/lib/api/types.ts apps/api/src/create-app.ts
git commit -m "feat: selector de categorías hermanas dentro de la página de torneo"
```

---

### Task 9: Frontend — el calendario del home muestra un torneo por vez

**Files:**
- Modify: `apps/web/src/features/home/home-page.tsx`
- Test: `apps/web/src/features/home/home-page.test.tsx`

**Interfaces:**
- Consumes: `groupMatchesByCompetition` (ya existe en `apps/web/src/features/matches/agenda-data.ts`,
  sin cambios).

- [ ] **Step 1: Escribir el test que falla**

En `apps/web/src/features/home/home-page.test.tsx` (creado en el Plan 1, Task 8 — si este
plan se ejecuta antes del Plan 1, crear el archivo con el mismo patrón de imports), agregar:

```typescript
  it('Agenda muestra un solo torneo a la vez, con selector para los demás', () => {
    // Requiere mockear useAgendaMatches para devolver partidos de dos competencias.
    // Ver el mock ya usado en otros tests de esta suite para el shape de AgendaMatch.
  });
```

Dado que `Agenda` usa el hook `useAgendaMatches` internamente (no recibe los datos por
props), este test necesita `vi.mock('../matches/use-agenda', ...)` — seguir el mismo
patrón de mock que se use en Task 7/8 de este plan para `useCompetitions`. Escribir el
mock con dos competencias (`'TOP 14 - Superior'` y `'Rugby Championship'`) con un partido
cada una, y afirmar que solo una tabla de partidos se renderiza a la vez, más un selector
con el nombre de la otra.

- [ ] **Step 2: Implementar**

En `apps/web/src/features/home/home-page.tsx`, función `Agenda`:

```typescript
function Agenda() {
  const [selectedDate, setSelectedDate] = useState(() => argentinaDateKey());
  const agenda = useAgendaMatches(selectedDate);
  const groups = groupMatchesByCompetition(filterMatchesByDate(agenda.matches, selectedDate));
  const [selectedCompetition, setSelectedCompetition] = useState<string | undefined>(undefined);
  const today = argentinaDateKey();
  const activeGroup = groups.find((g) => g.competition === selectedCompetition) ?? groups[0];

  return (
    <section className="agenda" id="partidos">
      <div className="section-heading">
        <div><p className="eyebrow">AGENDA</p><h2>{selectedDate === today ? 'Partidos de hoy' : 'Partidos del día'}</h2></div>
        <a href="/partidos">Ver calendario completo <span>↗</span></a>
      </div>
      <DatePicker selectedDate={selectedDate} onSelect={setSelectedDate} />
      {agenda.status === 'loading' ? <p className="agenda-status">Cargando la agenda…</p> : null}
      {agenda.status === 'error' ? <p className="agenda-status agenda-status--error">No pudimos cargar la agenda. Intentá nuevamente en unos minutos.</p> : null}
      {agenda.status === 'ready' && groups.length === 0 ? <p className="agenda-status">No hay partidos programados para esta fecha.</p> : null}
      {groups.length > 1 ? (
        <nav className="agenda-competition-selector" aria-label="Elegir torneo">
          {groups.map((group) => (
            <button
              type="button"
              key={group.competition}
              className={group.competition === activeGroup?.competition ? 'active' : ''}
              onClick={() => setSelectedCompetition(group.competition)}
            >
              {group.competition}
            </button>
          ))}
        </nav>
      ) : null}
      {activeGroup ? (
        <article className="competition" key={`${activeGroup.competition}-${activeGroup.round}`}>
          <header>
            <div className="competition__identity"><span className="competition__mark">XV</span><div><h3>{activeGroup.competition}</h3><p>{activeGroup.round}</p></div></div>
            <a href="/torneos">Ver torneo <span>↗</span></a>
          </header>
          <div>{activeGroup.matches.map((match) => <MatchRow match={match} key={match.id} />)}</div>
        </article>
      ) : null}
    </section>
  );
}
```

(`selectedCompetition` se resetea implícitamente al cambiar de fecha porque `groups` cambia
y `activeGroup` cae al `groups[0]` — no hace falta un `useEffect` extra para resetear el
estado.)

- [ ] **Step 3: Completar y correr el test del Step 1**

Con la implementación lista, terminar de escribir el mock/aserciones del test del Step 1
concretamente (verificar que solo un `<article className="competition">` aparece en el
HTML, y que aparecen botones con los nombres de ambas competencias en el selector).

Run: `pnpm --filter @ovalia/web exec vitest run home-page`
Expected: PASS.

- [ ] **Step 4: Typecheck y suite completa**

Run: `pnpm --filter @ovalia/web exec tsc --noEmit && pnpm --filter @ovalia/web exec vitest run`
Expected: sin errores, todo en verde.

- [ ] **Step 5: Verificación visual**

Con el dev server levantado y datos reales de varias competencias el mismo día, confirmar
que el home muestra un solo torneo y el selector permite cambiar.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/home/home-page.tsx apps/web/src/features/home/home-page.test.tsx
git commit -m "feat: la agenda del home muestra un torneo a la vez con selector"
```

---

### Task 10: Backfill en producción y deploy

**Files:** ninguno (operación).

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Aplicar la migración de schema contra Neon**

```bash
DATABASE_URL="<connection-string-de-neon>" pnpm --filter @ovalia/database exec drizzle-kit migrate
```

- [ ] **Step 3: Correr el seed (organizaciones)**

```bash
DATABASE_URL="<connection-string-de-neon>" pnpm --filter @ovalia/database exec tsx src/seed.ts
```

- [ ] **Step 4: Correr el backfill de taxonomía**

```bash
DATABASE_URL="<connection-string-de-neon>" pnpm --filter @ovalia/database exec tsx src/scripts/backfill-competition-taxonomy.ts
```

- [ ] **Step 5: Asociar `organizationId` de URBA a las competencias URBA existentes**

El backfill del Task 5 solo pone `familySlug`/`tier` — falta enlazar `organizationId`.
Correr un update puntual (una sola vez, vía `tsx -e` o agregándolo al mismo script del
Task 5 antes de este deploy):

```bash
DATABASE_URL="<connection-string-de-neon>" pnpm --filter @ovalia/database exec tsx -e "
import { createDatabase } from './src/client.js';
import { competitions, organizations } from './src/schema.js';
import { eq, like } from 'drizzle-orm';
const { db, pool } = createDatabase(process.env.DATABASE_URL);
const [urba] = await db.select().from(organizations).where(eq(organizations.slug, 'urba')).limit(1);
if (urba) {
  await db.update(competitions).set({ organizationId: urba.id }).where(like(competitions.slug, 'urba-%'));
  await db.update(competitions).set({ organizationId: urba.id }).where(like(competitions.slug, 'top-14-%'));
  await db.update(competitions).set({ organizationId: urba.id }).where(like(competitions.slug, 'primera-%'));
  await db.update(competitions).set({ organizationId: urba.id }).where(like(competitions.slug, 'menores-de-%'));
  await db.update(competitions).set({ organizationId: urba.id }).where(like(competitions.slug, 'femenino-%'));
  await db.update(competitions).set({ organizationId: urba.id }).where(like(competitions.slug, 'rugby-universitario%'));
  await db.update(competitions).set({ organizationId: urba.id }).where(like(competitions.slug, 'rugby-formativo%'));
}
console.log('organizationId de URBA enlazado');
await pool.end();
"
```

- [ ] **Step 6: Redeploy de API y web**

```bash
cd apps/api && pnpm dlx vercel@latest --prod --scope dalessandrobautistas-projects --yes
cd ../web && pnpm dlx vercel@latest --prod --scope dalessandrobautistas-projects --yes
```

- [ ] **Step 7: Verificar en producción**

```bash
curl -s "https://ovalia-api.vercel.app/v1/competitions" | python3 -c "
import json,sys
d = json.load(sys.stdin)['competitions']
top14 = next(c for c in d if c['slug'] == 'urba-top-14')
print(top14)
"
```
Expected: `organization: {'slug': 'urba', 'name': ...}`, `familySlug: 'top-14'`, `tier:
'senior'`.

Abrir `/torneos` y `/torneos/urba-top-14` en la web de producción y confirmar visualmente
la jerarquía y el selector.

---

## Self-Review Notes

- **Cobertura del spec (sección 2 completa)**: 2.1 → Tasks 1-5. 2.2 → Task 6. 2.3 → Tasks
  7-8. 2.4 → Task 9. Backfill/deploy → Task 10.
- **Riesgo del spec anotado** ("selector visual exacto no fijado") se resuelve en Tasks 8-9
  con una implementación concreta mínima (lista de links/botones) — si en la revisión visual
  del Task 8 Step 6 o Task 9 Step 5 no convence, es un ajuste de CSS/interacción, no de
  arquitectura.
- **Dependencia entre planes**: Task 1 de este plan (migración) es independiente del Plan
  1; el orden real de ejecución entre Plan 1 y Plan 2 no importa salvo que Plan 2 Task 3 de
  este documento (curado de `priority`) debe haber corrido para que el Task 9 muestre Top 14
  antes que Preintermedia en el selector por defecto — si Plan 2 se ejecuta primero, alcanza
  con correr el seed del Plan 1 (Task 3 de ese plan) antes del backfill de este Task 10.
