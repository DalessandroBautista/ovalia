import { extname } from 'node:path';
import { TEAM_BADGES } from '@ovalia/domain';
import { createDatabase } from './client';
import { competitions, teams } from './schema';

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

await pool.end();
