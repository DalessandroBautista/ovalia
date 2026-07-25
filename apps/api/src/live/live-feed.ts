import { z } from 'zod';
import { resolveTeamBadge } from '@ovalia/domain';

export interface LiveTeam {
  name: string;
  shortCode: string;
  providerId?: number;
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

export const BASIC_PLAN_CACHE_TTL_MS = 15 * 60 * 1_000;

export function readLiveFeedCacheTtl(environment: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(environment.LIVE_FEED_CACHE_TTL_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : BASIC_PLAN_CACHE_TTL_MS;
}

const highlightlyResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.union([z.number(), z.string()]),
      date: z.string(),
      homeTeam: z.object({ id: z.number().optional(), name: z.string(), logo: z.string().url().nullish() }),
      awayTeam: z.object({ id: z.number().optional(), name: z.string(), logo: z.string().url().nullish() }),
      league: z.object({ name: z.string() }),
      state: z.object({
        description: z.string(),
        score: z.string(),
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
  private readonly now: () => Date;

  constructor(options: { apiKey: string; baseUrl?: string; fetch?: typeof globalThis.fetch; now?: () => Date }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://rugby.highlightly.net';
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? (() => new Date());
  }

  async getLiveMatches(): Promise<LiveFeed> {
    const currentDate = this.now();
    const generatedAt = currentDate.toISOString();
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(currentDate);
    const query = new URLSearchParams({
      date,
      timezone: 'America/Argentina/Buenos_Aires',
      limit: '100',
    });
    try {
      const response = await this.fetcher(`${this.baseUrl}/matches?${query}`, {
        headers: { 'x-rapidapi-key': this.apiKey },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`Highlightly returned ${response.status}`);
      const payload = highlightlyResponseSchema.parse(await response.json());
      const liveStates = new Set(['First half', 'Second half', 'Extra time', 'Break time', 'Half time', 'Penalties']);
      const matches = payload.data.filter((match) => liveStates.has(match.state.description)).map((match): LiveMatch => {
        const [homeScore, awayScore] = parseScore(match.state.score);
        return {
          id: `highlightly-${match.id}`,
          competition: match.league.name,
          startsAt: match.date,
          phase: match.state.description,
          home: {
            name: match.homeTeam.name,
            shortCode: shortCode(match.homeTeam.name),
            ...(match.homeTeam.id != null ? { providerId: match.homeTeam.id } : {}),
            ...resolveBadge(match.homeTeam),
          },
          away: {
            name: match.awayTeam.name,
            shortCode: shortCode(match.awayTeam.name),
            ...(match.awayTeam.id != null ? { providerId: match.awayTeam.id } : {}),
            ...resolveBadge(match.awayTeam),
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

function resolveBadge(team: { id?: number; name: string; logo?: string | null }): { badgeUrl?: string } {
  const badgeUrl = resolveTeamBadge({
    name: team.name,
    providerId: team.id,
    remoteUrl: team.logo ?? undefined,
  });
  return badgeUrl ? { badgeUrl } : {};
}

export function createLiveFeedService(
  provider?: LiveProvider,
  options: { cacheTtlMs?: number; now?: () => number } = {},
) {
  const cacheTtlMs = options.cacheTtlMs ?? BASIC_PLAN_CACHE_TTL_MS;
  const now = options.now ?? Date.now;
  let cachedFeed: LiveFeed | undefined;
  let lastVerifiedFeed: LiveFeed | undefined;
  let cachedAt = Number.NEGATIVE_INFINITY;
  let refreshInFlight: Promise<LiveFeed> | undefined;

  const refresh = async (): Promise<LiveFeed> => {
    const providerFeed = await provider!.getLiveMatches();
    cachedAt = now();
    if (providerFeed.status === 'error' && lastVerifiedFeed) {
      cachedFeed = { ...lastVerifiedFeed, freshness: 'stale' };
      return cachedFeed;
    }
    cachedFeed = providerFeed;
    if (providerFeed.status !== 'error') lastVerifiedFeed = providerFeed;
    return providerFeed;
  };

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
      if (cachedFeed && now() - cachedAt < cacheTtlMs) return cachedFeed;
      if (refreshInFlight) return refreshInFlight;
      refreshInFlight = refresh().finally(() => {
        refreshInFlight = undefined;
      });
      return refreshInFlight;
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
