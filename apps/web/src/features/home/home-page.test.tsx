import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FeaturedMatch } from './home-page';

describe('FeaturedMatch fallback', () => {
  it('muestra el próximo partido importante cuando no hay nada en vivo', () => {
    const html = renderToStaticMarkup(
      createElement(FeaturedMatch, {
        feed: { status: 'empty', source: 'database', freshness: 'fresh', generatedAt: '', matches: [] },
        upcoming: [
          {
            id: 'm1',
            competition: 'TOP 14 - Superior',
            startsAt: '2026-08-02T18:00:00.000Z',
            home: { name: 'SIC', shortCode: 'SIC' },
            away: { name: 'Hindú', shortCode: 'HIN' },
          },
        ],
      }),
    );
    expect(html).toContain('PRÓXIMO PARTIDO IMPORTANTE');
    expect(html).toContain('SIC');
    expect(html).toContain('Hindú');
  });
});
