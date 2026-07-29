'use client';

import { useEffect, useState } from 'react';

import { fetchUpcomingMatches } from '../../lib/api/client';
import type { ApiMatch } from '../../lib/api/types';

export interface UpcomingState {
  status: 'loading' | 'ready' | 'error';
  matches: ApiMatch[];
}

const initialState: UpcomingState = { status: 'loading', matches: [] };

/** Próximos partidos de competencias importantes, para el fallback cuando no hay nada en vivo. */
export function useUpcomingMatches(limit: number): UpcomingState {
  const [state, setState] = useState<UpcomingState>(initialState);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const payload = await fetchUpcomingMatches(limit, { signal: controller.signal });
        setState({ status: 'ready', matches: payload.matches });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setState({ status: 'error', matches: [] });
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [limit]);

  return state;
}
