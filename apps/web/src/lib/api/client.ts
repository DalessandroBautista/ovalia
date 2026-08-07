import type {
  ApiArticleDetail,
  ApiArticlesResponse,
  ApiCareerClub,
  ApiCareerEntry,
  ApiCareerSeasonRecord,
  ApiCareerSummary,
  ApiCompetitionDetail,
  ApiCompetitionsResponse,
  ApiHomeResponse,
  ApiLineups,
  ApiMatch,
  ApiMatchContext,
  ApiMatchListResponse,
  ApiOrganizationsResponse,
  ApiStandingsResponse,
  PlayerSearchResponse,
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
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
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
      // 'default' respeta el Cache-Control que manda la API (30s + SWR en GET /v1/*)
      // en vez de forzar un viaje completo a la base en cada navegación.
      cache: options.cache ?? 'default',
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...options.headers,
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
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

export function fetchMatchContext(id: string, options?: ApiFetchOptions) {
  return apiFetch<ApiMatchContext>(`/v1/matches/${encodeURIComponent(id)}/context`, options);
}

export function fetchUpcomingMatches(limit: number, options?: ApiFetchOptions) {
  return apiFetch<{ generatedAt: string; matches: ApiMatch[] }>(
    `/v1/matches/upcoming${toQueryString({ limit })}`,
    options,
  );
}

export function fetchCompetitions(options?: ApiFetchOptions) {
  return apiFetch<ApiCompetitionsResponse>('/v1/competitions', options);
}

export function fetchOrganizations(options?: ApiFetchOptions) {
  return apiFetch<ApiOrganizationsResponse>('/v1/organizations', options);
}

export function fetchHome(options?: ApiFetchOptions) {
  return apiFetch<ApiHomeResponse>('/v1/home', options);
}

export function fetchArticles(options?: ApiFetchOptions) {
  return apiFetch<ApiArticlesResponse>('/v1/articles', options);
}

export function fetchArticle(slug: string, options?: ApiFetchOptions) {
  return apiFetch<ApiArticleDetail>(`/v1/articles/${encodeURIComponent(slug)}`, options);
}

// --- Admin (token mínimo) ---
export interface AdminSummary {
  openConflicts: number;
  failedRuns: number;
  pendingDrafts: number;
}
export interface AdminConflict {
  id: string;
  entityType: string;
  reason: string | null;
  candidates: unknown;
  createdAt: string;
}

export function fetchAdminSummary(token: string) {
  return apiFetch<AdminSummary>('/admin/summary', { headers: { 'x-admin-token': token } });
}

export function fetchAdminConflicts(token: string) {
  return apiFetch<{ conflicts: AdminConflict[] }>('/admin/conflicts', {
    headers: { 'x-admin-token': token },
  });
}

export function resolveAdminConflict(token: string, id: string, status: 'resolved' | 'dismissed') {
  return apiFetch<{ id: string; status: string }>(`/admin/conflicts/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    headers: { 'x-admin-token': token },
    body: { status },
  });
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

// --- Lineups (Tramo C) ---

export function fetchMatchLineups(id: string, options?: ApiFetchOptions) {
  return apiFetch<ApiLineups>(`/v1/matches/${encodeURIComponent(id)}/lineups`, options);
}

export function fetchPlayersSearch(q: string, options?: ApiFetchOptions) {
  return apiFetch<PlayerSearchResponse>(
    `/v1/players/search${toQueryString({ q })}`,
    options,
  );
}

export function saveMatchLineup(
  token: string,
  matchId: string,
  side: 'home' | 'away',
  entries: Array<{ shirtNumber: number; name: string; isCaptain: boolean; playerId: string | null }>,
) {
  return apiFetch<{ ok: boolean; matchId: string; side: string }>(
    `/admin/matches/${encodeURIComponent(matchId)}/lineups`,
    {
      method: 'POST',
      headers: { 'x-admin-token': token },
      body: { side, entries },
    },
  );
}

// --- Simulador de carrera ---

export function fetchCareerClubs(options?: ApiFetchOptions) {
  return apiFetch<{ clubs: ApiCareerClub[] }>('/v1/career/clubs', options);
}

export function publishCareerEntry(
  input: {
    displayName: string;
    score: number;
    summary: ApiCareerSummary;
    history: ApiCareerSeasonRecord[];
    surname: string;
    position: string;
    clubSlug: string;
    seed: number;
    decisions: number[];
    originKey: string;
  },
  options?: ApiFetchOptions,
) {
  return apiFetch<{ entry: ApiCareerEntry }>('/v1/career/entries', {
    method: 'POST',
    body: input,
    ...options,
  });
}

export function fetchCareerRanking(limit = 20, options?: ApiFetchOptions) {
  return apiFetch<{ entries: ApiCareerEntry[] }>(`/v1/career/entries?limit=${limit}`, options);
}

export function fetchCareerEntry(id: string, options?: ApiFetchOptions) {
  return apiFetch<{ entry: ApiCareerEntry }>(`/v1/career/entries/${encodeURIComponent(id)}`, options);
}

export interface ApiCsvImportReport {
  totalRows: number;
  persisted: number;
  conflicts: number;
  errors: Array<{ line: number; message: string }>;
  dryRun: boolean;
  checksum: string;
}

export function ingestMatchesCsv(
  token: string,
  competitionSlug: string,
  csvContent: string,
  dryRun = false,
) {
  return apiFetch<ApiCsvImportReport>('/admin/ingest/csv', {
    method: 'POST',
    headers: { 'x-admin-token': token },
    body: { competitionSlug, csvContent, dryRun },
  });
}

