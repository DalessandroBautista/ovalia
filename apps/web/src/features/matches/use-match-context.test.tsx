import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiMatchContext } from '../../lib/api/types';
import { useMatchContext } from './use-match-context';

const { fetchMatchContextMock } = vi.hoisted(() => ({
  fetchMatchContextMock: vi.fn(),
}));

vi.mock('../../lib/api/client', () => ({
  fetchMatchContext: fetchMatchContextMock,
}));

const emptyContext: ApiMatchContext = {
  headToHead: { played: 0, homeWins: 0, awayWins: 0, draws: 0, recent: [] },
  form: { home: [], away: [] },
  standings: { home: null, away: null },
};

describe('useMatchContext', () => {
  beforeEach(() => {
    fetchMatchContextMock.mockReset();
  });

  it('permanece inactivo y no consulta la API sin partido', () => {
    const { result } = renderHook(() => useMatchContext(null));
    expect(result.current).toEqual({ status: 'idle', context: null });
    expect(fetchMatchContextMock).not.toHaveBeenCalled();
  });

  it('publica el contexto cuando termina la consulta', async () => {
    fetchMatchContextMock.mockResolvedValue(emptyContext);
    const { result } = renderHook(() => useMatchContext('match-1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(fetchMatchContextMock).toHaveBeenCalledWith('match-1', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(result.current.context).toEqual(emptyContext);
  });

  it('degrada a error cuando falla la consulta', async () => {
    fetchMatchContextMock.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useMatchContext('match-1'));
    await waitFor(() => expect(result.current).toEqual({ status: 'error', context: null }));
  });
});
