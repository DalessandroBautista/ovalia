import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from './app';

describe('API health', () => {
  const apps: Array<ReturnType<typeof buildApp>> = [];

  afterEach(async () => {
    await Promise.all(apps.map((app) => app.close()));
    apps.length = 0;
  });

  it('reports the service name and readiness', async () => {
    const app = buildApp({ logger: false });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ service: 'ovalia-api', status: 'ready' });
  });

  it('serves the public rugby agenda', async () => {
    const app = buildApp({ logger: false });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/v1/matches' });
    const payload = response.json();

    expect(response.statusCode).toBe(200);
    expect(payload.matches).toHaveLength(4);
    expect(payload.matches[0]).toMatchObject({ competition: 'URBA Top 14', homeTeam: 'SIC' });
    expect(payload.matches.filter((match: { status: string }) => match.status === 'live')).toEqual([]);
  });

  it('returns a tournament table', async () => {
    const app = buildApp({ logger: false });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/v1/competitions/urba-top-14/standings' });

    expect(response.statusCode).toBe(200);
    expect(response.json().rows[0]).toMatchObject({ position: 1, team: 'SIC' });
  });

  it('exposes live feed provenance and never falls back to demo matches', async () => {
    const app = buildApp({ logger: false });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/v1/live' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'unavailable', source: 'none', matches: [] });
  });

  it('does not expose a hardcoded match through the live matches filter', async () => {
    const app = buildApp({ logger: false });
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/v1/matches?status=live' });

    expect(response.statusCode).toBe(200);
    expect(response.json().matches).toEqual([]);
  });

  it('allows the local web app to request the live feed', async () => {
    const app = buildApp({ logger: false });
    apps.push(app);

    const response = await app.inject({ method: 'OPTIONS', url: '/v1/live', headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'GET' } });

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
