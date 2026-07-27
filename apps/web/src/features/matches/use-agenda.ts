'use client';

import { useEffect, useState } from 'react';

import { fetchMatches } from '../../lib/api/client';
import { argentinaDayRange, mapApiMatch, type AgendaMatch } from './agenda-data';
import type { Freshness } from '../../lib/api/types';

type AgendaStatus = 'loading' | 'ready' | 'error';

interface AgendaState {
  status: AgendaStatus;
  matches: AgendaMatch[];
  freshness: Freshness;
  source: string | null;
}

const initialState: AgendaState = {
  status: 'loading',
  matches: [],
  freshness: 'unknown',
  source: null,
};

/** Carga los partidos de un día (rango en el backend). Vuelve a pedir al cambiar la fecha. */
export function useAgendaMatches(selectedDate: string): AgendaState {
  const [state, setState] = useState<AgendaState>(initialState);

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, status: 'loading' }));
    const load = async () => {
      try {
        const { from, to } = argentinaDayRange(selectedDate);
        const payload = await fetchMatches({ from, to, limit: 200 }, { signal: controller.signal });
        const matches = payload.matches.map(mapApiMatch);
        const stale = matches.find((m) => m.freshness === 'stale');
        setState({
          status: 'ready',
          matches,
          freshness: stale ? 'stale' : (matches[0]?.freshness ?? 'unknown'),
          source: matches[0]?.source ?? null,
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setState({ status: 'error', matches: [], freshness: 'unknown', source: null });
        }
      }
    };
    void load();
    return () => controller.abort();
  }, [selectedDate]);

  return state;
}
