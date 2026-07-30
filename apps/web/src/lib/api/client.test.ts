import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, fetchMatchById, fetchMatches } from './client';
import * as apiClient from './client';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mockFetch(response: { ok: boolean; status?: number; json?: unknown }) {
  const spy = vi.fn(async () => ({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => response.json,
  })) as unknown as typeof globalThis.fetch;
  globalThis.fetch = spy;
  return spy;
}

describe('api client', () => {
  it('consulta el catálogo de uniones argentinas', async () => {
    const fetchOrganizations = (apiClient as typeof apiClient & {
      fetchOrganizations?: () => Promise<{ organizations: unknown[] }>;
    }).fetchOrganizations;
    expect(fetchOrganizations).toBeTypeOf('function');
    if (!fetchOrganizations) return;
    const spy = mockFetch({ ok: true, json: { organizations: [] } });
    await fetchOrganizations();
    expect((spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      'http://localhost:4000/v1/organizations?countryCode=AR&kind=union',
    );
  });

  it('construye la query de partidos y devuelve el payload tipado', async () => {
    const spy = mockFetch({ ok: true, json: { generatedAt: 'x', matches: [], nextCursor: null } });
    const result = await fetchMatches({ from: '2026-08-01T00:00:00-03:00', competition: 'top-14-superior', limit: 50 });
    expect(result.matches).toEqual([]);
    const url = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(url).toContain('/v1/matches?');
    expect(url).toContain('from=');
    expect(url).toContain('competition=top-14-superior');
    expect(url).toContain('limit=50');
  });

  it('lanza ApiError con el status en respuestas no-ok', async () => {
    mockFetch({ ok: false, status: 404 });
    await expect(fetchMatchById('missing')).rejects.toMatchObject({ status: 404 });
    await expect(fetchMatchById('missing')).rejects.toBeInstanceOf(ApiError);
  });

  it('distingue un timeout interno de una cancelación del consumidor', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      }),
    ) as unknown as typeof globalThis.fetch;

    const request = apiFetch('/v1/matches', { timeoutMs: 25 });
    const rejection = expect(request).rejects.toMatchObject({ name: 'ApiError', status: 408 });
    await vi.advanceTimersByTimeAsync(25);

    await rejection;
  });
});
