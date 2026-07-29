import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import * as schema from './schema.js';

export function createDatabase(
  connectionString: string,
  options: Pick<PoolConfig, 'max' | 'idleTimeoutMillis' | 'connectionTimeoutMillis'> = {},
) {
  const pool = new Pool({ connectionString, max: 10, ...options });
  return { db: drizzle(pool, { schema }), pool };
}

export type DatabaseHandle = ReturnType<typeof createDatabase>;
export type Database = DatabaseHandle['db'];

/** Verifica conectividad con la base (para /ready). Lanza si no responde. */
export async function pingDatabase(db: Database): Promise<void> {
  await db.execute(sql`select 1`);
}
