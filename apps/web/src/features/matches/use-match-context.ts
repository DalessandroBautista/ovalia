'use client';

import { useEffect, useState } from 'react';

import { fetchMatchContext } from '../../lib/api/client';
import type { ApiMatchContext } from '../../lib/api/types';

type ContextStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ContextState {
  status: ContextStatus;
  context: ApiMatchContext | null;
}

export function useMatchContext(id: string | null): ContextState {
  const [state, setState] = useState<ContextState>({
    status: id ? 'loading' : 'idle',
    context: null,
  });

  useEffect(() => {
    if (!id) {
      setState({ status: 'idle', context: null });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading', context: null });
    const load = async () => {
      try {
        const context = await fetchMatchContext(id, { signal: controller.signal });
        setState({ status: 'ready', context });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ status: 'error', context: null });
      }
    };
    void load();
    return () => controller.abort();
  }, [id]);

  return state;
}
