import 'dotenv/config';

import { createDatabase } from '@ovalia/database';
import Fastify from 'fastify';
import { configureApp } from './create-app.js';
import { readApiEnvironment } from './environment.js';

const environment = readApiEnvironment();

const { db, pool } = createDatabase(environment.databaseUrl, {
  max: environment.databasePoolMax,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});
const app = Fastify({ logger: true, genReqId: () => crypto.randomUUID() });
configureApp(app, { db });

const stop = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await pool.end();
  process.exit(0);
};

process.once('SIGINT', () => void stop('SIGINT'));
process.once('SIGTERM', () => void stop('SIGTERM'));

void app.listen({ host: environment.host, port: environment.port }).catch((error: unknown) => {
  app.log.error({ err: error }, 'failed to start api');
  process.exit(1);
});
