import type {
  ApiCompetitionDetail,
  ApiCompetitionsResponse,
  ApiHomeResponse,
  ApiMatch,
  ApiMatchListResponse,
  ApiStandingsResponse,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const DEFAULT_TIMEOUT_MS = 10_000;

export interface ApiFetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  cache?: RequestCache;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort);
  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      signal: controller.signal,
      cache: options.cache ?? 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      throw new ApiError(`API ${response.status} en ${path}`, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (timedOut && error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(`API timeout en ${path}`, 408);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}

export interface MatchesQuery {
  from?: string;
  to?: string;
  competition?: string;
  status?: string;
  cursor?: string;
  limit?: number;
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function fetchMatches(query: MatchesQuery, options?: ApiFetchOptions) {
  return apiFetch<ApiMatchListResponse>(
    `/v1/matches${toQueryString(query as Record<string, string | number | undefined>)}`,
    options,
  );
}

export function fetchMatchById(id: string, options?: ApiFetchOptions) {
  return apiFetch<{ match: ApiMatch }>(`/v1/matches/${encodeURIComponent(id)}`, options);
}

export function fetchCompetitions(options?: ApiFetchOptions) {
  return apiFetch<ApiCompetitionsResponse>('/v1/competitions', options);
}

export function fetchHome(options?: ApiFetchOptions) {
  return apiFetch<ApiHomeResponse>('/v1/home', options);
}

export function fetchCompetition(slug: string, options?: ApiFetchOptions) {
  return apiFetch<ApiCompetitionDetail>(`/v1/competitions/${encodeURIComponent(slug)}`, options);
}

export function fetchStandings(slug: string, season?: number, options?: ApiFetchOptions) {
  return apiFetch<ApiStandingsResponse>(
    `/v1/competitions/${encodeURIComponent(slug)}/standings${toQueryString({ season })}`,
    options,
  );
}

export function fetchCompetitionMatches(
  slug: string,
  query: { season?: number; round?: string; cursor?: string; limit?: number },
  options?: ApiFetchOptions,
) {
  return apiFetch<ApiMatchListResponse>(
    `/v1/competitions/${encodeURIComponent(slug)}/matches${toQueryString(query as Record<string, string | number | undefined>)}`,
    options,
  );
}
