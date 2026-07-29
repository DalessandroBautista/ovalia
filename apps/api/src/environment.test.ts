import { describe, expect, it } from 'vitest';

import { readApiEnvironment } from './environment';

describe('readApiEnvironment', () => {
  it('rechaza producción sin base ni origen web explícitos', () => {
    expect(() => readApiEnvironment({ NODE_ENV: 'production' })).toThrow(
      /DATABASE_URL.*WEB_ORIGIN|WEB_ORIGIN.*DATABASE_URL/,
    );
  });

  it('trata Vercel como entorno productivo aunque NODE_ENV no esté seteado', () => {
    expect(() => readApiEnvironment({ VERCEL: '1' })).toThrow(
      /DATABASE_URL.*WEB_ORIGIN|WEB_ORIGIN.*DATABASE_URL/,
    );
  });

  it('trata VERCEL_ENV=preview como entorno productivo', () => {
    expect(() => readApiEnvironment({ VERCEL_ENV: 'preview' })).toThrow(
      /DATABASE_URL.*WEB_ORIGIN|WEB_ORIGIN.*DATABASE_URL/,
    );
  });

  it('trata VERCEL_URL como señal de runtime alojado', () => {
    expect(() => readApiEnvironment({ VERCEL_URL: 'ovalia-api.vercel.app' })).toThrow(
      /DATABASE_URL.*WEB_ORIGIN|WEB_ORIGIN.*DATABASE_URL/,
    );
  });

  it('mantiene defaults locales únicamente fuera de producción', () => {
    expect(readApiEnvironment({ NODE_ENV: 'development' })).toMatchObject({
      databaseUrl: 'postgres://ovalia:ovalia@localhost:54329/ovalia',
      webOrigin: 'http://localhost:3000',
      port: 4000,
      databasePoolMax: 10,
    });
  });

  it('limita explícitamente el pool configurado para serverless', () => {
    expect(readApiEnvironment({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://example',
      WEB_ORIGIN: 'https://ovalia.example',
      DATABASE_POOL_MAX: '3',
    }).databasePoolMax).toBe(3);
  });
});
