'use client';

import { useEffect, useState } from 'react';

import { fetchHome } from '../../lib/api/client';
import type { ApiHomeResponse } from '../../lib/api/types';

type Status = 'loading' | 'ready' | 'error';

export function useHome(): { status: Status; data: ApiHomeResponse | null } {
  const [state, setState] = useState<{ status: Status; data: ApiHomeResponse | null }>({
    status: 'loading',
    data: null,
  });
  useEffect(() => {
    const controller = new AbortController();
    fetchHome({ signal: controller.signal })
      .then((data) => setState({ status: 'ready', data }))
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setState({ status: 'error', data: null });
        }
      });
    return () => controller.abort();
  }, []);
  return state;
}

/** Cuenta regresiva viva hacia un instante ISO; null si no hay cierre o ya venció. */
export function useCountdown(closesAt: string | null | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!closesAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [closesAt]);
  if (!closesAt) return null;
  const diff = new Date(closesAt).getTime() - now;
  if (Number.isNaN(diff) || diff <= 0) return null;
  const total = Math.floor(diff / 1000);
  const h = String(Math.floor(total / 3600)).padStart(2, '0');
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
