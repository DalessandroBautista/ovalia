import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString, max: 10 });
  return { db: drizzle(pool, { schema }), pool };
}

export type DatabaseHandle = ReturnType<typeof createDatabase>;
export type Database = DatabaseHandle['db'];
