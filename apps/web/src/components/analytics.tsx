'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { track } from '../lib/analytics';

/** Registra un page_view en cada cambio de ruta (sin PII). */
export function Analytics() {
  const pathname = usePathname();
  useEffect(() => {
    track('page_view');
  }, [pathname]);
  return null;
}
