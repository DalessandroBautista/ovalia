'use client';

import { useEffect, useState } from 'react';

import type { AgendaMatch } from './agenda-data';

type AgendaStatus = 'loading' | 'ready' | 'error';

interface AgendaState {
  status: AgendaStatus;
  matches: AgendaMatch[];
}

const initialState: AgendaState = { status: 'loading', matches: [] };

export function useAgendaMatches(): AgendaState {
  const [state, setState] = useState<AgendaState>(initialState);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
        const response = await fetch(`${baseUrl}/v1/matches`, { signal: controller.signal });
        if (!response.ok) throw new Error('agenda unavailable');
        const payload = (await response.json()) as { matches: AgendaMatch[] };
        setState({ status: 'ready', matches: payload.matches });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setState({ status: 'error', matches: [] });
        }
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  return state;
}
