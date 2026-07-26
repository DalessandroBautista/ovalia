import 'dotenv/config';

import { createDatabase } from '@ovalia/database';
import { buildApp } from './app.js';

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? '0.0.0.0';
const connectionString =
  process.env.DATABASE_URL ?? 'postgres://ovalia:ovalia@localhost:54329/ovalia';

const { db, pool } = createDatabase(connectionString);
const app = buildApp({ logger: true }, { db });

const stop = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await pool.end();
  process.exit(0);
};

process.once('SIGINT', () => void stop('SIGINT'));
process.once('SIGTERM', () => void stop('SIGTERM'));

await app.listen({ host, port });
