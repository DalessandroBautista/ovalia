import { extname } from 'node:path';
import { classifyCompetitionTier, TEAM_BADGES } from '@ovalia/domain';
import { createDatabase } from './client.js';
import { upsertSource } from './repositories/ingestion-repository.js';
import { upsertCompetition, upsertSeason } from './repositories/competitions-repository.js';
import { linkCompetitionOrganization, upsertOrganization } from './repositories/organizations-repository.js';
import { createUser } from './repositories/users-repository.js';
import { FEDERAL_SEED_CATALOG, unionSlugForCompetition } from './seed-catalog.js';
import { competitions, teams, users } from './schema.js';
import { eq } from 'drizzle-orm';

// Seed honesto (Hito 1.4): solo configuración de fuentes, catálogo verificado y
// bootstrap estructural. NO crea partidos/resultados que puedan parecer reales.
// Contenido de desarrollo únicamente con SEED_DEMO=true.
const SEED_DEMO = process.env.SEED_DEMO === 'true';

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://ovalia:ovalia@localhost:54329/ovalia';
const { db, pool } = createDatabase(connectionString);

const metadata: Record<string, { countryCode: string; union: string; shortName: string }> = {
      argentina: { countryCode: 'AR', union: 'UAR', shortName: 'Los Pumas' },
      sudafrica: { countryCode: 'ZA', union: 'SARU', shortName: 'Springboks' },
      'nueva-zelanda': { countryCode: 'NZ', union: 'NZR', shortName: 'All Blacks' },
      australia: { countryCode: 'AU', union: 'Rugby Australia', shortName: 'Wallabies' },
};

for (const team of TEAM_BADGES) {
    const identity = metadata[team.slug]!;
    const values = {
      slug: team.slug,
      name: team.name,
      shortName: identity.shortName,
      countryCode: identity.countryCode,
      union: identity.union,
      badgeUrl: team.badgePath,
      badgeSourceUrl: team.sourceUrl,
      badgeFormat: extname(team.badgePath).slice(1),
      badgeStatus: 'verified',
      badgeVerifiedAt: new Date(),
      aliases: [...team.aliases],
      externalIds: team.externalIds ?? {},
    };
    await db.insert(teams).values(values).onConflictDoUpdate({
      target: teams.slug,
      set: {
        name: values.name,
        shortName: values.shortName,
        countryCode: values.countryCode,
        union: values.union,
        badgeUrl: values.badgeUrl,
        badgeSourceUrl: values.badgeSourceUrl,
        badgeFormat: values.badgeFormat,
        badgeStatus: values.badgeStatus,
        badgeVerifiedAt: values.badgeVerifiedAt,
        aliases: values.aliases,
        externalIds: values.externalIds,
      },
    });
}

// Organizaciones (uniones, ligas, torneos internacionales).
const ORGANIZATIONS: Array<{ slug: string; name: string; kind: string; countryCode: string | null }> = [
  ...FEDERAL_SEED_CATALOG.unionOrganizations,
  { slug: 'super-rugby', name: 'Súper Rugby', kind: 'league', countryCode: null },
  { slug: 'rugby-internacional', name: 'Rugby Internacional', kind: 'international', countryCode: null },
  { slug: 'rugby-seven', name: 'Rugby Seven', kind: 'sevens', countryCode: null },
];
const organizationIds = new Map<string, string>();
for (const org of ORGANIZATIONS) {
  const organization = await upsertOrganization(db, org);
  organizationIds.set(organization.slug, organization.id);
}

for (const competition of FEDERAL_SEED_CATALOG.manualCompetitions) {
  const organizationId = organizationIds.get(competition.organizationSlug);
  if (!organizationId) throw new Error(`Organización federal inexistente: ${competition.organizationSlug}`);
  const row = await upsertCompetition(db, {
    slug: competition.slug,
    name: competition.name,
    familySlug: competition.familySlug,
    tier: competition.tier,
    category: competition.category,
    gender: competition.gender,
    countryCode: competition.countryCode,
    coverage: competition.coverage,
    priority: competition.priority,
    organizationId,
  });
  for (const additionalOrganizationSlug of competition.additionalOrganizationSlugs) {
    const additionalOrganizationId = organizationIds.get(additionalOrganizationSlug);
    if (!additionalOrganizationId) throw new Error(`Organización federal inexistente: ${additionalOrganizationSlug}`);
    await linkCompetitionOrganization(db, { competitionId: row.id, organizationId: additionalOrganizationId });
  }
}

await db
  .insert(competitions)
  .values([
    {
      slug: 'urba-top-14',
      name: 'URBA Top 14',
      countryCode: 'AR',
      category: 'clubs',
      gender: 'male',
      priority: 100,
    },
    {
      slug: 'rugby-championship',
      name: 'Rugby Championship',
      category: 'national-teams',
      gender: 'male',
      priority: 100,
    },
    {
      slug: 'torneo-interior-a',
      name: 'Torneo del Interior A',
      countryCode: 'AR',
      category: 'clubs',
      gender: 'male',
      priority: 90,
    },
    {
      slug: 'seven-republica',
      name: 'Seven de la República',
      countryCode: 'AR',
      category: 'unions',
      gender: 'mixed',
      format: 'sevens',
      priority: 80,
    },
  ])
  .onConflictDoNothing();

// Vincula catálogos importados antes de que existieran organizaciones federales.
// La regla vive en seed-catalog para que sea explícita, testeable e idempotente.
for (const competition of await db.select().from(competitions)) {
  const unionSlug = unionSlugForCompetition(competition.slug);
  if (!unionSlug) continue;
  const organizationId = organizationIds.get(unionSlug);
  if (!organizationId) throw new Error(`Organización federal inexistente: ${unionSlug}`);
  await upsertCompetition(db, {
    slug: competition.slug,
    name: competition.name,
    category: competition.category,
    gender: competition.gender,
    countryCode: competition.countryCode,
    format: competition.format,
    priority: competition.priority,
    coverage: competition.coverage,
    organizationId,
    familySlug: competition.familySlug,
    // upsertCompetition siempre sobreescribe tier (a diferencia de priority u
    // organizationId): sin esto, este loop de vinculación pisaría a 'senior'
    // el tier ya clasificado de competencias juveniles (ej. "Menores de 15").
    tier: competition.tier ?? classifyCompetitionTier(competition.name),
  });
}

// Configuración de fuentes externas (inactivas hasta validar términos/automatización).
await upsertSource(db, {
  slug: 'urba',
  name: 'Unión de Rugby de Buenos Aires',
  priority: 90,
  baseUrl: 'https://fixture.urba.org.ar',
  capabilities: ['catalog', 'fixtures', 'results', 'standings'],
  automationAllowed: true,
  active: true,
  attribution: 'URBA — urba.org.ar',
});
await upsertSource(db, {
  slug: 'uar',
  name: 'Unión Argentina de Rugby',
  priority: 85,
  baseUrl: 'https://uar.com.ar',
  capabilities: ['catalog', 'fixtures', 'results'],
  automationAllowed: false,
  active: false,
  attribution: 'UAR — uar.com.ar',
});
await upsertSource(db, {
  slug: 'world-rugby',
  name: 'World Rugby',
  priority: 80,
  baseUrl: 'https://www.world.rugby',
  capabilities: ['fixtures', 'results'],
  automationAllowed: false,
  active: false,
  attribution: 'World Rugby — world.rugby',
});
await upsertSource(db, {
  slug: 'highlightly',
  name: 'Highlightly (live)',
  priority: 40,
  capabilities: ['live'],
  automationAllowed: true,
  active: false,
  attribution: 'Highlightly',
});
await upsertSource(db, {
  slug: 'highlightly-ingest',
  name: 'Highlightly (Súper Rugby, internacionales, seven)',
  priority: 70,
  capabilities: ['catalog', 'fixtures', 'results', 'standings'],
  automationAllowed: true,
  active: true,
  attribution: 'Highlightly — highlightly.net',
});

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
      // Igual razón que arriba: preservar (o reclasificar) el tier en vez de
      // dejar que el default 'senior' de upsertCompetition lo pise.
      tier: row.tier ?? classifyCompetitionTier(row.name),
    });
  }
}

// Temporada estructural de bootstrap para la competencia con cobertura prioritaria.
const [urba] = await db
  .select()
  .from(competitions)
  .where(eq(competitions.slug, 'urba-top-14'))
  .limit(1);
if (urba) {
  const year = new Date().getFullYear();
  await upsertSeason(db, {
    competitionId: urba.id,
    name: String(year),
    year,
  });
}

// Usuario admin de desarrollo: solo bajo SEED_DEMO explícito.
if (SEED_DEMO) {
  const email = 'admin@ovalia.dev';
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length === 0) {
    await createUser(db, {
      email,
      displayName: 'Admin de desarrollo',
      role: 'admin',
    });
  }
}

await pool.end();
