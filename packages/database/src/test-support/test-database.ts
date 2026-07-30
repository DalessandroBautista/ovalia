import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { createDatabase } from '../client.js';

const MIGRATIONS_FOLDER = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle');

const BASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://ovalia:ovalia@localhost:54329/ovalia';

function withDatabaseName(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

const TEST_DB_NAME = process.env.TEST_DATABASE_NAME ?? 'ovalia_test';
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? withDatabaseName(BASE_URL, TEST_DB_NAME);
const MAINTENANCE_URL = withDatabaseName(BASE_URL, 'postgres');

let ready: Promise<ReturnType<typeof createDatabase>> | null = null;

/** Devuelve true si el PostgreSQL de test es alcanzable (para skipIf). */
export async function isDatabaseAvailable(): Promise<boolean> {
  const pool = new Pool({ connectionString: MAINTENANCE_URL, connectionTimeoutMillis: 1500 });
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function ensureTestDatabaseExists(): Promise<void> {
  const pool = new Pool({ connectionString: MAINTENANCE_URL, connectionTimeoutMillis: 3000 });
  try {
    const { rowCount } = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      TEST_DB_NAME,
    ]);
    if (rowCount === 0) {
      await pool.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  } finally {
    await pool.end();
  }
}

/** Conexión a la base de test, creada y migrada una sola vez por proceso. */
export function getTestDatabase(): Promise<ReturnType<typeof createDatabase>> {
  if (!ready) {
    ready = (async () => {
      await ensureTestDatabaseExists();
      const handle = createDatabase(TEST_DATABASE_URL);
      await migrate(handle.db, { migrationsFolder: MIGRATIONS_FOLDER });
      return handle;
    })();
  }
  return ready;
}

const TABLES = [
  'analytics_events',
  'feedback',
  'audit_log',
  'contest_rankings',
  'prediction_group_members',
  'prediction_groups',
  'contest_matches',
  'predictions',
  'prediction_contests',
  'verification_tokens',
  'accounts',
  'sessions',
  'standings_snapshots',
  'standings',
  'match_events',
  'matches',
  'rounds',
  'competition_phases',
  'ingestion_conflicts',
  'ingestion_artifacts',
  'ingestion_runs',
  'external_entities',
  'external_sources',
  'editorial_overrides',
  'jobs',
  'articles',
  'seasons',
  'competition_organizations',
  'competitions',
  'organizations',
  'teams',
  'users',
];

/** Limpia todas las tablas manteniendo el esquema (aislamiento entre tests). */
export async function truncateAll(handle: ReturnType<typeof createDatabase>): Promise<void> {
  await handle.pool.query(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
}
