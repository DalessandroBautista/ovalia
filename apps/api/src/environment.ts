export interface ApiEnvironment {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  databaseUrl: string;
  databasePoolMax: number;
  webOrigin: string;
}

export function readApiEnvironment(source: NodeJS.ProcessEnv = process.env): ApiEnvironment {
  const isVercelRuntime =
    source.VERCEL === '1' ||
    source.VERCEL_ENV === 'preview' ||
    source.VERCEL_ENV === 'production' ||
    typeof source.VERCEL_URL === 'string';
  const nodeEnv = source.NODE_ENV ?? (isVercelRuntime ? 'production' : 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error(`NODE_ENV inválido: ${nodeEnv}`);
  }
  if (nodeEnv === 'production') {
    const missing = ['DATABASE_URL', 'WEB_ORIGIN'].filter((name) => !source[name]?.trim());
    if (missing.length > 0) {
      throw new Error(`Variables obligatorias en producción: ${missing.join(', ')}`);
    }
  }
  const port = Number(source.API_PORT ?? 4000);
  if (!Number.isInteger(port) || port <= 0) throw new Error('API_PORT debe ser un entero positivo');
  const databasePoolMax = Number(source.DATABASE_POOL_MAX ?? 10);
  if (!Number.isInteger(databasePoolMax) || databasePoolMax <= 0) {
    throw new Error('DATABASE_POOL_MAX debe ser un entero positivo');
  }

  return {
    nodeEnv: nodeEnv as ApiEnvironment['nodeEnv'],
    host: source.API_HOST ?? '0.0.0.0',
    port,
    databaseUrl: source.DATABASE_URL ?? 'postgres://ovalia:ovalia@localhost:54329/ovalia',
    databasePoolMax,
    webOrigin: source.WEB_ORIGIN ?? 'http://localhost:3000',
  };
}
