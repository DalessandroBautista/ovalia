import { describe, expect, it } from 'vitest';

import { publicSiteUrl } from './site-url';

describe('publicSiteUrl', () => {
  it('prioriza la URL canónica configurada', () => {
    expect(publicSiteUrl({ NEXT_PUBLIC_SITE_URL: 'https://ovalia.com.ar/' })).toBe(
      'https://ovalia.com.ar',
    );
  });

  it('usa la URL del deployment de Vercel si no hay dominio propio', () => {
    expect(publicSiteUrl({ VERCEL_URL: 'ovalia-preview.vercel.app' })).toBe(
      'https://ovalia-preview.vercel.app',
    );
  });

  it('sólo cae a localhost durante desarrollo local', () => {
    expect(publicSiteUrl({})).toBe('http://localhost:3000');
  });
});
