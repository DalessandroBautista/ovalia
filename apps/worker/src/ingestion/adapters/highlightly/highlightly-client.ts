export interface HighlightlyClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  minIntervalMs?: number;
  now?: () => number;
}

/** Cliente HTTP para el API de Highlightly (rugby): timeout, auth header y rate limit. */
export class HighlightlyClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private lastRequestAt = Number.NEGATIVE_INFINITY;

  constructor(options: HighlightlyClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? 'https://rugby.highlightly.net';
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.minIntervalMs = options.minIntervalMs ?? 100;
    this.now = options.now ?? (() => Date.now());
  }

  private async rateLimit(): Promise<void> {
    const wait = this.lastRequestAt + this.minIntervalMs - this.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = this.now();
  }

  private async getJson(path: string, query: Record<string, string | number | undefined>): Promise<unknown> {
    await this.rateLimit();
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) search.set(key, String(value));
    }
    const url = `${this.baseUrl}/${path}${search.toString() ? `?${search}` : ''}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: { 'x-rapidapi-key': this.apiKey, accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Highlightly HTTP ${response.status} en ${path}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  leagues(): Promise<unknown> {
    return this.getJson('leagues', {});
  }

  matches(params: { leagueId: number; season?: number }): Promise<unknown> {
    return this.getJson('matches', { leagueId: params.leagueId, season: params.season });
  }

  standings(params: { leagueId: number; season: number }): Promise<unknown> {
    return this.getJson('standings', { leagueId: params.leagueId, season: params.season });
  }
}
