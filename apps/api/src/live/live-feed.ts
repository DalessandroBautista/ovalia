import { z } from 'zod';

export interface LiveTeam {
  name: string;
  shortCode: string;
  badgeUrl?: string;
}

export interface LiveMatch {
  id: string;
  competition: string;
  startsAt: string;
  phase: string;
  minute?: number;
  home: LiveTeam;
  away: LiveTeam;
  homeScore: number;
  awayScore: number;
}

export interface LiveFeed {
  status: 'live' | 'empty' | 'unavailable' | 'error';
  source: 'highlightly' | 'database' | 'none';
  freshness: 'fresh' | 'stale' | 'unknown';
  generatedAt: string;
  matches: LiveMatch[];
}

export interface LiveProvider {
  getLiveMatches(): Promise<LiveFeed>;
}

const highlightlyResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.union([z.number(), z.string()]),
      date: z.string(),
      homeTeam: z.object({ name: z.string(), logo: z.string().url().nullish() }),
      awayTeam: z.object({ name: z.string(), logo: z.string().url().nullish() }),
      league: z.object({ name: z.string() }),
      state: z.object({
        description: z.string(),
        clock: z.number().nullish(),
        score: z.object({ current: z.string() }),
      }),
    }),
  ),
});

function shortCode(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function parseScore(score: string): [number, number] {
  const [home, away] = score.split('-').map((value) => Number(value.trim()));
  return [Number.isFinite(home) ? home! : 0, Number.isFinite(away) ? away! : 0];
}

export class HighlightlyProvider implements LiveProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: typeof globalThis.fetch;

  constructor(options: { apiKey: string; baseUrl?: string; fetch?: typeof globalThis.fetch }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://rugby.highlightly.net';
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  async getLiveMatches(): Promise<LiveFeed> {
    const generatedAt = new Date().toISOString();
    try {
      const response = await this.fetcher(`${this.baseUrl}/matches?status=live`, {
        headers: { 'x-rapidapi-key': this.apiKey },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`Highlightly returned ${response.status}`);
      const payload = highlightlyResponseSchema.parse(await response.json());
      const matches = payload.data.map((match): LiveMatch => {
        const [homeScore, awayScore] = parseScore(match.state.score.current);
        return {
          id: `highlightly-${match.id}`,
          competition: match.league.name,
          startsAt: match.date,
          phase: match.state.description,
          ...(match.state.clock == null ? {} : { minute: match.state.clock }),
          home: {
            name: match.homeTeam.name,
            shortCode: shortCode(match.homeTeam.name),
            ...(match.homeTeam.logo ? { badgeUrl: match.homeTeam.logo } : {}),
          },
          away: {
            name: match.awayTeam.name,
            shortCode: shortCode(match.awayTeam.name),
            ...(match.awayTeam.logo ? { badgeUrl: match.awayTeam.logo } : {}),
          },
          homeScore,
          awayScore,
        };
      });
      return {
        status: matches.length ? 'live' : 'empty',
        source: 'highlightly',
        freshness: 'fresh',
        generatedAt,
        matches,
      };
    } catch {
      return { status: 'error', source: 'highlightly', freshness: 'unknown', generatedAt, matches: [] };
    }
  }
}

export function createLiveFeedService(provider?: LiveProvider) {
  return {
    async getLiveMatches(): Promise<LiveFeed> {
      if (!provider) {
        return {
          status: 'unavailable',
          source: 'none',
          freshness: 'unknown',
          generatedAt: new Date().toISOString(),
          matches: [],
        };
      }
      return provider.getLiveMatches();
    },
  };
}

export function createConfiguredLiveProvider(environment: NodeJS.ProcessEnv = process.env): LiveProvider | undefined {
  const apiKey = environment.HIGHLIGHTLY_API_KEY?.trim();
  if (!apiKey) return undefined;
  return new HighlightlyProvider({
    apiKey,
    baseUrl: environment.HIGHLIGHTLY_API_BASE_URL ?? 'https://rugby.highlightly.net',
  });
}
