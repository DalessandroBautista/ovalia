import 'dotenv/config';

import { createDatabase } from '@ovalia/database';
import { buildApp } from './create-app.js';
import { readApiEnvironment } from './environment.js';

const environment = readApiEnvironment();

const { db, pool } = createDatabase(environment.databaseUrl, {
  max: environment.databasePoolMax,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});
const app = buildApp({ logger: true }, { db });

const stop = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await pool.end();
  process.exit(0);
};

process.once('SIGINT', () => void stop('SIGINT'));
process.once('SIGTERM', () => void stop('SIGTERM'));

await app.listen({ host: environment.host, port: environment.port });
