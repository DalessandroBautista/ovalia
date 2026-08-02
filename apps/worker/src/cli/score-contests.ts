import 'dotenv/config';
import { createDatabase, scoreClosedContests } from '@ovalia/database';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL requerido');

const { db, pool } = createDatabase(databaseUrl, { connectionTimeoutMillis: 5_000 });
try {
  const scored = await scoreClosedContests(db);
  console.log(`Concursos puntuados: ${scored}`);
} finally {
  await pool.end();
}
