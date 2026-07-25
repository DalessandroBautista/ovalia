import { extname } from 'node:path';
import { TEAM_BADGES } from '@ovalia/domain';
import { createDatabase } from './client';
import { upsertSource } from './repositories/ingestion-repository';
import { upsertSeason } from './repositories/competitions-repository';
import { createUser } from './repositories/users-repository';
import { competitions, teams, users } from './schema';
import { eq } from 'drizzle-orm';

// Seed honesto (Hito 1.4): solo configuración de fuentes, catálogo verificado y
// bootstrap estructural. NO crea partidos/resultados que puedan parecer reales.
// Contenido de desarrollo únicamente con SEED_DEMO=true.
const SEED_DEMO = process.env.SEED_DEMO === 'true';

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://ovalia:ovalia@localhost:54329/ovalia';
const { db, pool } = createDatabase(connectionString);

const metadata: Record<string, { countryCode: string; union: string; shortName: string }> = {
      sic: { countryCode: 'AR', union: 'URBA', shortName: 'SIC' },
      hindu: { countryCode: 'AR', union: 'URBA', shortName: 'Hindú' },
      casi: { countryCode: 'AR', union: 'URBA', shortName: 'CASI' },
      newman: { countryCode: 'AR', union: 'URBA', shortName: 'Newman' },
      alumni: { countryCode: 'AR', union: 'URBA', shortName: 'Alumni' },
      cuba: { countryCode: 'AR', union: 'URBA', shortName: 'CUBA' },
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

// Configuración de fuentes externas (inactivas hasta validar términos/automatización).
await upsertSource(db, {
  slug: 'urba',
  name: 'Unión de Rugby de Buenos Aires',
  priority: 90,
  baseUrl: 'https://fixture.urba.org.ar',
  capabilities: ['catalog', 'fixtures', 'results', 'standings'],
  automationAllowed: false,
  active: false,
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
