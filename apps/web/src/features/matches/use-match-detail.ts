'use client';

import { useEffect, useState } from 'react';

import { ApiError, fetchMatchById } from '../../lib/api/client';
import type { ApiMatch } from '../../lib/api/types';

type DetailStatus = 'loading' | 'ready' | 'not-found' | 'error';

interface DetailState {
  status: DetailStatus;
  match: ApiMatch | null;
}

export function useMatchDetail(id: string): DetailState {
  const [state, setState] = useState<DetailState>({ status: 'loading', match: null });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', match: null });
    const load = async () => {
      try {
        const { match } = await fetchMatchById(id, { signal: controller.signal });
        setState({ status: 'ready', match });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 404) {
          setState({ status: 'not-found', match: null });
          return;
        }
        setState({ status: 'error', match: null });
      }
    };
    void load();
    return () => controller.abort();
  }, [id]);

  return state;
}
