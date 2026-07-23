import { describe, expect, it } from 'vitest';

import { createLiveFeedService, HighlightlyProvider } from './live-feed';

describe('live feed service', () => {
  it('returns unavailable without inventing matches when no provider is configured', async () => {
    const service = createLiveFeedService();

    await expect(service.getLiveMatches()).resolves.toMatchObject({
      status: 'unavailable',
      source: 'none',
      matches: [],
    });
  });

  it('normalizes Highlightly matches and team badges', async () => {
    const provider = new HighlightlyProvider({
      apiKey: 'test-key',
      fetch: async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                id: 91,
                date: '2026-07-23T20:00:00.000Z',
                homeTeam: { name: 'Argentina', logo: 'https://img.example/arg.png' },
                awayTeam: { name: 'South Africa', logo: 'https://img.example/rsa.png' },
                league: { name: 'Rugby Championship' },
                state: { description: 'Second half', clock: 64, score: { current: '24 - 21' } },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    });

    const result = await provider.getLiveMatches();

    expect(result.matches[0]).toMatchObject({
      id: 'highlightly-91',
      competition: 'Rugby Championship',
      minute: 64,
      home: { name: 'Argentina', badgeUrl: 'https://img.example/arg.png' },
      away: { name: 'South Africa', badgeUrl: 'https://img.example/rsa.png' },
      homeScore: 24,
      awayScore: 21,
    });
  });

  it('marks a provider failure instead of returning demo scores', async () => {
    const provider = new HighlightlyProvider({
      apiKey: 'test-key',
      fetch: async () => new Response('failure', { status: 503 }),
    });

    await expect(provider.getLiveMatches()).resolves.toMatchObject({ status: 'error', matches: [] });
  });
});
