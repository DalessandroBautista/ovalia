import { describe, expect, it, vi } from 'vitest';
import type { DatabaseHandle } from '@ovalia/database';
import { getTestDatabase, isDatabaseAvailable, makeSource, truncateAll } from '@ovalia/database/test-support';
import type { UrbaAdapter } from './urba-adapter';
import { importUrba } from './urba-import';

const available = await isDatabaseAvailable();

describe.skipIf(!available)('importUrba', () => {
  it('corre fixtures y standings para todas las competencias del catálogo, no solo las prioritarias', async () => {
    const handle: DatabaseHandle = await getTestDatabase();
    await truncateAll(handle);
    const source = await makeSource(handle.db, { slug: 'urba' });

    const fakeAdapter = {
      descriptor: { slug: 'urba', name: 'URBA', priority: 90, capabilities: ['catalog', 'fixtures', 'standings'] },
      supports: () => true,
      fetchCatalog: vi.fn().mockResolvedValue({
        competitions: [
          { externalId: '1', name: 'TOP 14 - Superior', category: 'clubs', gender: 'male', countryCode: 'AR', format: 'xv', season: { externalId: '2026', name: '2026', year: 2026 } },
          { externalId: '2', name: 'TOP 14 - Intermedia', category: 'clubs', gender: 'male', countryCode: 'AR', format: 'xv', season: { externalId: '2026', name: '2026', year: 2026 } },
        ],
        teams: [],
      }),
      fetchFixtures: vi.fn().mockResolvedValue([]),
      fetchStandings: vi.fn().mockResolvedValue({ competitionExternalId: '1', season: { externalId: '2026', year: 2026 }, rows: [] }),
    } as unknown as UrbaAdapter;

    const report = await importUrba({ db: handle.db, sourceId: source.id, adapter: fakeAdapter });

    expect(report.perCompetition).toHaveLength(2);
    expect(report.perCompetition.map((c) => c.externalId).sort()).toEqual(['1', '2']);
    expect(fakeAdapter.fetchFixtures).toHaveBeenCalledTimes(2);
    expect(fakeAdapter.fetchStandings).toHaveBeenCalledTimes(2);

    await handle.pool.end();
  });
});
