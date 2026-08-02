import { createDatabase } from '@ovalia/database';
import { config as loadDotenv } from 'dotenv';
import Fastify from 'fastify';
import { configureApp } from './create-app.js';
import { readApiEnvironment } from './environment.js';

const isHostedRuntime =
  process.env.VERCEL === '1' ||
  process.env.VERCEL_ENV === 'preview' ||
  process.env.VERCEL_ENV === 'production' ||
  typeof process.env.VERCEL_URL === 'string';

if (process.env.NODE_ENV !== 'production' && !isHostedRuntime) {
  loadDotenv();
}

const environment = readApiEnvironment();

const { db, pool } = createDatabase(environment.databaseUrl, {
  max: environment.databasePoolMax,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});
const app = Fastify({ logger: true, genReqId: () => crypto.randomUUID() });
configureApp(app, {
  db,
  webOrigins: environment.webOrigin.split(',').map((origin) => origin.trim()).filter(Boolean),
});

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
