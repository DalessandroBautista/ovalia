import { describe, expect, it, vi } from 'vitest';
import { HighlightlyIngestAdapter } from './highlightly-adapter';
import type { HighlightlyClient } from './highlightly-client';

const LEAGUES = [
  // Liga en plena temporada 2026.
  { id: 61205, name: 'Super Rugby', seasons: [{ season: 2025 }, { season: 2026 }] },
  // Liga cuya temporada más reciente es 2025: pedir season=2026 sería un 404.
  { id: 73119, name: 'Rugby Championship', seasons: [{ season: 2024 }, { season: 2025 }] },
  // Liga puntual: no tiene 2026.
  { id: 73970, name: "Seven's World Cup", seasons: [{ season: 2022 }] },
];

/**
 * El catálogo debe resolver la temporada más reciente real de cada liga desde
 * /leagues, en vez de fijar siempre el año actual (causa de 404 en ligas cuya
 * temporada más reciente no es el año corriente, p.ej. Rugby Championship 2025).
 */
function makeAdapter(clientStub?: Partial<Pick<HighlightlyClient, 'leagues' | 'matches'>>): HighlightlyIngestAdapter {
  const client = {
    leagues: async () => LEAGUES,
    matches: async () => ({ data: [] }),
    ...clientStub,
  } as unknown as HighlightlyClient;
  return new HighlightlyIngestAdapter(client);
}

describe('HighlightlyIngestAdapter.fetchCatalog', () => {
  it('usa la temporada más reciente real de cada liga, no el año actual fijo', async () => {
    const adapter = makeAdapter();
    const catalog = await adapter.fetchCatalog!({});
    const bySlug = new Map(catalog.competitions.map((c) => [c.slug, c]));
    // Super Rugby: sigue en 2026.
    expect(bySlug.get('super-rugby')!.season.year).toBe(2026);
    // Rugby Championship: su temporada vigente es 2025, no 2026.
    expect(bySlug.get('rugby-championship')!.season.year).toBe(2025);
    // Seven's World Cup: última edición 2022.
    expect(bySlug.get('seven-world-cup')!.season.year).toBe(2022);
  });
});