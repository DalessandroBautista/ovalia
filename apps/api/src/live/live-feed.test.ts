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

  it('requests the Argentine calendar day and keeps only matches in play', async () => {
    let requestedUrl = '';
    const provider = new HighlightlyProvider({
      apiKey: 'test-key',
      now: () => new Date('2026-07-24T15:30:00.000Z'),
      fetch: async (input) => {
        requestedUrl = String(input);
        return (
        new Response(
          JSON.stringify({
            data: [
              {
                id: 91,
                date: '2026-07-23T20:00:00.000Z',
                homeTeam: { id: 10, name: 'Argentina', logo: 'https://img.example/arg.png' },
                awayTeam: { id: 20, name: 'South Africa', logo: 'https://img.example/rsa.png' },
                league: { name: 'Rugby Championship' },
                state: { description: 'Second half', score: '24 - 21' },
              },
              {
                id: 92,
                date: '2026-07-24T10:00:00.000Z',
                homeTeam: { id: 30, name: 'New Zealand', logo: null },
                awayTeam: { id: 40, name: 'Australia', logo: null },
                league: { name: 'Rugby Championship' },
                state: { description: 'Finished', score: '31 - 18' },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
        );
      },
    });

    const result = await provider.getLiveMatches();

    expect(requestedUrl).toBe(
      'https://rugby.highlightly.net/matches?date=2026-07-24&timezone=America%2FArgentina%2FBuenos_Aires&limit=100',
    );
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      id: 'highlightly-91',
      competition: 'Rugby Championship',
      home: { name: 'Argentina', providerId: 10, badgeUrl: '/teams/argentina.png' },
      away: { name: 'South Africa', providerId: 20, badgeUrl: '/teams/sudafrica.svg' },
      homeScore: 24,
      awayScore: 21,
    });
  });

  it('keeps a provider badge for a team that is not in the verified registry', async () => {
    const provider = new HighlightlyProvider({
      apiKey: 'test-key',
      fetch: async () => new Response(JSON.stringify({
        data: [{
          id: 1,
          date: '2026-07-24T20:00:00.000Z',
          homeTeam: { id: 501, name: 'Unknown RFC', logo: 'https://img.example/unknown.png' },
          awayTeam: { id: 502, name: 'Another RFC', logo: null },
          league: { name: 'Test League' },
          state: { description: 'First half', score: '5 - 3' },
        }],
      }), { status: 200 }),
    });

    const result = await provider.getLiveMatches();

    expect(result.matches[0]?.home).toMatchObject({
      name: 'Unknown RFC',
      providerId: 501,
      badgeUrl: 'https://img.example/unknown.png',
    });
    expect(result.matches[0]?.away).not.toHaveProperty('badgeUrl');
  });

  it('marks a provider failure instead of returning demo scores', async () => {
    const provider = new HighlightlyProvider({
      apiKey: 'test-key',
      fetch: async () => new Response('failure', { status: 503 }),
    });

    await expect(provider.getLiveMatches()).resolves.toMatchObject({ status: 'error', matches: [] });
  });
});
