'use client';

import { useEffect, useState } from 'react';

import { fetchMatchLineups } from '../../lib/api/client';
import type { ApiLineups } from '../../lib/api/types';

type LineupsStatus = 'idle' | 'loading' | 'ready' | 'error';

interface LineupsState {
  status: LineupsStatus;
  lineups: ApiLineups | null;
}

export function useMatchLineups(id: string | null): LineupsState {
  const [state, setState] = useState<LineupsState>({
    status: id ? 'loading' : 'idle',
    lineups: null,
  });

  useEffect(() => {
    if (!id) {
      setState({ status: 'idle', lineups: null });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading', lineups: null });
    const load = async () => {
      try {
        const lineups = await fetchMatchLineups(id, { signal: controller.signal });
        setState({ status: 'ready', lineups });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error', lineups: null });
      }
    };
    void load();
    return () => controller.abort();
  }, [id]);

  return state;
}
