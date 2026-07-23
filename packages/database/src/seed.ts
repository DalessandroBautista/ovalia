import { createDatabase } from './client';
import { competitions, teams } from './schema';

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://ovalia:ovalia@localhost:54329/ovalia';
const { db, pool } = createDatabase(connectionString);

await db
  .insert(teams)
  .values([
    { slug: 'sic', name: 'San Isidro Club', shortName: 'SIC', countryCode: 'AR', union: 'URBA' },
    { slug: 'hindu', name: 'Hindú Club', shortName: 'Hindú', countryCode: 'AR', union: 'URBA' },
    {
      slug: 'casi',
      name: 'Club Atlético de San Isidro',
      shortName: 'CASI',
      countryCode: 'AR',
      union: 'URBA',
    },
    { slug: 'newman', name: 'Club Newman', shortName: 'Newman', countryCode: 'AR', union: 'URBA' },
    {
      slug: 'argentina',
      name: 'Argentina',
      shortName: 'Los Pumas',
      countryCode: 'AR',
      union: 'UAR',
    },
    {
      slug: 'sudafrica',
      name: 'Sudáfrica',
      shortName: 'Springboks',
      countryCode: 'ZA',
      union: 'SARU',
    },
  ])
  .onConflictDoNothing();

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
