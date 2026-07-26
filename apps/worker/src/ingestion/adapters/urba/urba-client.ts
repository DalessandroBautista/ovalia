export interface UrbaClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  userAgent?: string;
  timeoutMs?: number;
  minIntervalMs?: number;
  now?: () => number;
}

/** Cliente HTTP para el API público de URBA: timeout, user-agent y rate limit. */
export class UrbaClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly minIntervalMs: number;
  private readonly now: () => number;
  private lastRequestAt = Number.NEGATIVE_INFINITY;

  constructor(options: UrbaClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'https://api.urba.org.ar/api';
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.userAgent = options.userAgent ?? 'OvaliaBot/0.1 (+https://ovalia.local)';
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.minIntervalMs = options.minIntervalMs ?? 1_000;
    this.now = options.now ?? (() => Date.now());
  }

  private async rateLimit(): Promise<void> {
    const wait = this.lastRequestAt + this.minIntervalMs - this.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = this.now();
  }

  async getJson(path: string): Promise<unknown> {
    await this.rateLimit();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/${path}`, {
        headers: { 'user-agent': this.userAgent, accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`URBA HTTP ${response.status} en ${path}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  championships(year: number): Promise<unknown> {
    return this.getJson(`championships/${year}`);
  }

  championship(id: string): Promise<unknown> {
    return this.getJson(`championship/${id}`);
  }

  positions(id: string): Promise<unknown> {
    return this.getJson(`positions/${id}`);
  }

  clubs(): Promise<unknown> {
    return this.getJson('clubs');
  }
}
