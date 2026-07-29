import { describe, expect, it, vi } from 'vitest';
import { HighlightlyClient } from './highlightly-client';

describe('HighlightlyClient', () => {
  it('manda el header de auth y arma la query de matches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
    const client = new HighlightlyClient({ apiKey: 'test-key', fetch: fetchMock as unknown as typeof fetch, minIntervalMs: 0 });
    await client.matches({ leagueId: 73119 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('leagueId=73119'),
      expect.objectContaining({ headers: expect.objectContaining({ 'x-rapidapi-key': 'test-key' }) }),
    );
  });

  it('lanza si la respuesta no es ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    const client = new HighlightlyClient({ apiKey: 'test-key', fetch: fetchMock as unknown as typeof fetch, minIntervalMs: 0 });
    await expect(client.leagues()).rejects.toThrow(/Highlightly HTTP 429/);
  });
});
