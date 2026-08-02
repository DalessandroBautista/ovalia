import 'dotenv/config';
import OpenAI from 'openai';
import { createDatabase } from '@ovalia/database';
import { runEditorialWorkerOnce } from '../editorial-worker.js';

const databaseUrl = process.env.DATABASE_URL;
const apiKey = process.env.OPENAI_API_KEY;
if (!databaseUrl) throw new Error('DATABASE_URL requerido');

if (!apiKey) {
  console.log('Editorial worker omitido: OPENAI_API_KEY no configurada.');
} else {
  const { db, pool } = createDatabase(databaseUrl, { connectionTimeoutMillis: 5_000 });
  const client = new OpenAI({ apiKey });
  try {
    const processed = await runEditorialWorkerOnce(db, client, `editorial-${process.pid}`);
    console.log(processed ? 'Editorial job procesado.' : 'No hay jobs editoriales pendientes.');
  } finally {
    await pool.end();
  }
}
