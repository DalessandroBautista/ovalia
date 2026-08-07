import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, fetchActiveContest, fetchMatchById, fetchMatches, login, saveContestPredictions, updateAdminArticle } from './client';
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
  it('inicia sesión usando cookies y no expone el token al cliente', async () => {
    const spy = mockFetch({ ok: true, json: { user: { id: 'u', email: 'u@example.test', displayName: 'U', role: 'fan', locale: 'es' } } });
    await login('u@example.test', 'clave-segura');
    expect((spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain('/auth/login');
    expect((spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toMatchObject({ credentials: 'include', method: 'POST' });
  });

  it('carga el concurso activo y guarda el lote de pronósticos', async () => {
    const spy = mockFetch({ ok: true, json: { contest: { slug: 'fecha-1', matches: [] } } });
    await fetchActiveContest();
    expect((spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain('/v1/contests/active');
    await saveContestPredictions('fecha-1', [{ matchId: 'm', homeScore: 20, awayScore: 10 }]);
    expect((spy as unknown as ReturnType<typeof vi.fn>).mock.calls[1]![1]).toMatchObject({ credentials: 'include', method: 'PUT' });
  });

  it('pide el contexto del partido con el identificador escapado', async () => {
    const fetchMatchContext = (apiClient as typeof apiClient & {
      fetchMatchContext?: (id: string) => Promise<unknown>;
    }).fetchMatchContext;
    expect(fetchMatchContext).toBeTypeOf('function');
    if (!fetchMatchContext) return;
    const spy = mockFetch({
      ok: true,
      json: {
        headToHead: { played: 0, homeWins: 0, awayWins: 0, draws: 0, recent: [] },
        form: { home: [], away: [] },
        standings: { home: null, away: null },
      },
    });

    await fetchMatchContext('abc def');

    expect((spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toContain(
      '/v1/matches/abc%20def/context',
    );
  });

  it('consulta el catálogo de organizaciones (todos los países y tipos)', async () => {
    const fetchOrganizations = (apiClient as typeof apiClient & {
      fetchOrganizations?: () => Promise<{ organizations: unknown[] }>;
    }).fetchOrganizations;
    expect(fetchOrganizations).toBeTypeOf('function');
    if (!fetchOrganizations) return;
    const spy = mockFetch({ ok: true, json: { organizations: [] } });
    await fetchOrganizations();
    expect((spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(
      'http://localhost:4000/v1/organizations',
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

  it('guarda la imagen de portada junto con el contenido editorial', async () => {
    const spy = mockFetch({ ok: true, json: { article: {} } });

    await updateAdminArticle('editor-token', 'article-1', {
      title: 'La final del Top 14',
      summary: 'Todo lo que dejó la definición.',
      body: 'Crónica completa.',
      coverImageUrl: 'https://images.example.test/final.webp',
    });

    const options = (spy as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1];
    expect(JSON.parse(String(options.body))).toMatchObject({
      coverImageUrl: 'https://images.example.test/final.webp',
    });
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
