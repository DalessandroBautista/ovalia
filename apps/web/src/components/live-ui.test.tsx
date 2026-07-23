import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LiveRailView } from './live-rail';
import { TeamBadge } from './team-badge';

describe('live rugby UI', () => {
  it('renders an honest empty state without a configured provider', () => {
    const html = renderToStaticMarkup(
      createElement(LiveRailView, {
        feed: { status: 'unavailable', source: 'none', freshness: 'unknown', generatedAt: '', matches: [] },
      }),
    );

    expect(html).toContain('No hay partidos en vivo ahora');
    expect(html).not.toContain('Argentina 27');
  });

  it('renders a remote team badge when one is provided', () => {
    const html = renderToStaticMarkup(
      createElement(TeamBadge, { name: 'Argentina', shortCode: 'ARG', badgeUrl: 'https://img.example/arg.png' }),
    );

    expect(html).toContain('<img');
    expect(html).toContain('Escudo de Argentina');
  });

  it('renders an svg shield fallback instead of a broken image', () => {
    const html = renderToStaticMarkup(createElement(TeamBadge, { name: 'SIC', shortCode: 'SIC' }));

    expect(html).toContain('<svg');
    expect(html).toContain('SIC');
  });
});
