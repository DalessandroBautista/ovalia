import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from '@ovalia/database';
import {
  getTestDatabase,
  isDatabaseAvailable,
  makeSource,
  truncateAll,
} from '@ovalia/database/test-support';
import type {
  ExternalMatch,
  ExternalStandings,
  SportsDataAdapter,
} from '@ovalia/domain';
import { runIngestion } from './run-ingestion';

const available = await isDatabaseAvailable();

function fakeAdapter(overrides: Partial<SportsDataAdapter> = {}): SportsDataAdapter {
  return {
    descriptor: { slug: 'fake', name: 'Fake', priority: 10, capabilities: ['catalog', 'fixtures', 'results', 'standings'] },
    supports: () => true,
    fetchCatalog: async () => ({
      competitions: [
        {
          externalId: 'c1',
          name: 'Test Cup',
          category: 'clubs',
          gender: 'male' as const,
          format: 'xv' as const,
          season: { name: '2026', year: 2026 },
        },
      ],
      teams: [
        { externalId: 't1', name: 'Alfa RC' },
        { externalId: 't2', name: 'Beta RC' },
      ],
    }),
    fetchFixtures: async (): Promise<ExternalMatch[]> => [
      {
        competitionExternalId: 'c1',
        seasonYear: 2026,
        round: 'Fecha 1',
        startsAt: '2026-08-01T15:00:00-03:00',
        homeTeamExternalId: 't1',
        awayTeamExternalId: 't2',
        status: 'scheduled',
      },
    ],
    ...overrides,
  };
}

describe.skipIf(!available)('runIngestion', () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    handle = await getTestDatabase();
    await truncateAll(handle);
  });

  afterAll(async () => {
    if (available) await handle.pool.end().catch(() => undefined);
  });

  it('persiste catálogo y luego fixtures resueltos', async () => {
    const { db } = handle;
    const source = await makeSource(db, { slug: 'fake' });
    const adapter = fakeAdapter();

    const catalog = await runIngestion({
      db,
      sourceId: source.id,
      adapter,
      capability: 'catalog',
      parserVersion: 'v1',
    });
    expect(catalog.status).toBe('success');

    const fixtures = await runIngestion({
      db,
      sourceId: source.id,
      adapter,
      capability: 'fixtures',
      parserVersion: 'v1',
    });
    expect(fixtures.status).toBe('success');
    expect(fixtures.persisted).toBe(1);
    expect(fixtures.conflicts).toBe(0);

    const matches = await db.query.matches.findMany();
    expect(matches).toHaveLength(1);
    expect(matches[0]!.startsAt.toISOString()).toBe('2026-08-01T18:00:00.000Z');
    expect(matches[0]!.source).toBe('fake');
  });

  it('es idempotente por checksum (segunda corrida se saltea)', async () => {
    const { db } = handle;
    const source = await makeSource(db, { slug: 'fake' });
    const adapter = fakeAdapter();
    await runIngestion({ db, sourceId: source.id, adapter, capability: 'catalog', parserVersion: 'v1' });
    const first = await runIngestion({ db, sourceId: source.id, adapter, capability: 'fixtures', parserVersion: 'v1' });
    const second = await runIngestion({ db, sourceId: source.id, adapter, capability: 'fixtures', parserVersion: 'v1' });
    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(true);
    expect(second.status).toBe('skipped');
    const matches = await db.query.matches.findMany();
    expect(matches).toHaveLength(1);
  });

  it('marca la corrida como failed ante un parser roto y no persiste', async () => {
    const { db } = handle;
    const source = await makeSource(db, { slug: 'fake' });
    const adapter = fakeAdapter({
      fetchFixtures: async () => {
        throw new Error('HTML inesperado');
      },
    });
    const result = await runIngestion({ db, sourceId: source.id, adapter, capability: 'fixtures', parserVersion: 'v1' });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('HTML inesperado');
    const matches = await db.query.matches.findMany();
    expect(matches).toHaveLength(0);
  });

  it('crea un conflicto cuando un equipo no resuelve', async () => {
    const { db } = handle;
    const source = await makeSource(db, { slug: 'fake' });
    const adapter = fakeAdapter({
      fetchCatalog: undefined,
      fetchFixtures: async (): Promise<ExternalMatch[]> => [
        {
          competitionExternalId: 'zzz',
          seasonYear: 2026,
          round: 'Fecha 1',
          startsAt: '2026-08-01T15:00:00-03:00',
          homeTeamExternalId: 'unknown-1',
          awayTeamExternalId: 'unknown-2',
          status: 'scheduled',
        },
      ],
    });
    const result = await runIngestion({ db, sourceId: source.id, adapter, capability: 'fixtures', parserVersion: 'v1' });
    expect(result.conflicts).toBe(1);
    const conflicts = await db.query.ingestionConflicts.findMany();
    expect(conflicts).toHaveLength(1);
  });

  it('crea conflicto cuando local y visitante resuelven al mismo equipo', async () => {
    const { db } = handle;
    const source = await makeSource(db, { slug: 'fake' });
    const adapter = fakeAdapter({
      fetchFixtures: async (): Promise<ExternalMatch[]> => [
        {
          competitionExternalId: 'c1',
          seasonYear: 2026,
          round: 'Fecha 1',
          startsAt: '2026-08-01T15:00:00-03:00',
          homeTeamExternalId: 't1',
          awayTeamExternalId: 't1', // mismo equipo local y visitante
          status: 'scheduled',
        },
      ],
    });
    await runIngestion({ db, sourceId: source.id, adapter, capability: 'catalog', parserVersion: 'v1' });
    const result = await runIngestion({ db, sourceId: source.id, adapter, capability: 'fixtures', parserVersion: 'v1' });
    // No debe lanzar, no debe persistir un match inválido (CHECK home <> away) y debe registrar conflicto
    expect(result.status).toBe('success');
    expect(result.persisted).toBe(0);
    expect(result.conflicts).toBe(1);
    const matches = await db.query.matches.findMany();
    expect(matches).toHaveLength(0);
    const conflicts = await db.query.ingestionConflicts.findMany();
    expect(conflicts).toHaveLength(1);
  });

  it('persiste standings resueltos', async () => {
    const { db } = handle;
    const source = await makeSource(db, { slug: 'fake' });
    const standings: ExternalStandings = {
      competitionExternalId: 'c1',
      seasonYear: 2026,
      rows: [
        { teamExternalId: 't1', played: 1, won: 1, drawn: 0, lost: 0, pointsFor: 30, pointsAgainst: 10, bonus: 1, points: 5 },
        { teamExternalId: 't2', played: 1, won: 0, drawn: 0, lost: 1, pointsFor: 10, pointsAgainst: 30, bonus: 0, points: 0 },
      ],
    };
    const adapter = fakeAdapter({ fetchStandings: async () => standings });
    await runIngestion({ db, sourceId: source.id, adapter, capability: 'catalog', parserVersion: 'v1' });
    const result = await runIngestion({ db, sourceId: source.id, adapter, capability: 'standings', parserVersion: 'v1' });
    expect(result.persisted).toBe(2);
    const rows = await db.query.standings.findMany();
    expect(rows).toHaveLength(2);
  });

  it('resuelve y crea equipos no catalogados en standings mediante teamName', async () => {
    const { db } = handle;
    const source = await makeSource(db, { slug: 'fake' });
    const standings: ExternalStandings = {
      competitionExternalId: 'c1',
      seasonYear: 2026,
      rows: [
        { teamExternalId: 't1', teamName: 'Alfa RC', played: 1, won: 1, drawn: 0, lost: 0, pointsFor: 30, pointsAgainst: 10, bonus: 1, points: 5 },
        { teamExternalId: 't3', teamName: 'Gamma University', played: 1, won: 0, drawn: 0, lost: 1, pointsFor: 10, pointsAgainst: 30, bonus: 0, points: 0 },
      ],
    };
    const adapter = fakeAdapter({ fetchStandings: async () => standings });
    await runIngestion({ db, sourceId: source.id, adapter, capability: 'catalog', parserVersion: 'v1' });
    const result = await runIngestion({ db, sourceId: source.id, adapter, capability: 'standings', parserVersion: 'v1' });
    expect(result.persisted).toBe(2);
    expect(result.conflicts).toBe(0);
    const rows = await db.query.standings.findMany();
    expect(rows).toHaveLength(2);
    const gamma = await db.query.teams.findFirst({ where: (t, { eq }) => eq(t.slug, 'gamma-university') });
    expect(gamma).toBeDefined();
    expect(gamma?.name).toBe('Gamma University');
  });
});
