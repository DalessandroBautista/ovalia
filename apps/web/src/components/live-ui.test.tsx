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

  it('shows upcoming important matches when there is nothing live', () => {
    const html = renderToStaticMarkup(
      createElement(LiveRailView, {
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

    expect(html).toContain('SIC');
    expect(html).toContain('Hindú');
    expect(html).not.toContain('No hay partidos en vivo ahora');
  });

  it('prioritizes the verified local badge over a remote provider badge', () => {
    const html = renderToStaticMarkup(
      createElement(TeamBadge, { name: 'Argentina', shortCode: 'ARG', badgeUrl: 'https://img.example/arg.png' }),
    );

    expect(html).toContain('src="/teams/argentina.png"');
    expect(html).not.toContain('https://img.example/arg.png');
    expect(html).toContain('Escudo de Argentina');
  });

  it('resolves a verified local club badge from its alias', () => {
    const html = renderToStaticMarkup(createElement(TeamBadge, { name: 'Los Pumas', shortCode: 'ARG' }));

    expect(html).toContain('src="/teams/argentina.png"');
    expect(html).not.toContain('<svg');
  });

  it('renders the shield fallback for an unknown team without an image', () => {
    const html = renderToStaticMarkup(createElement(TeamBadge, { name: 'Unknown RFC', shortCode: 'UNK' }));

    expect(html).toContain('<svg');
    expect(html).toContain('UNK');
  });

  it('keeps a remote badge for an unknown team', () => {
    const html = renderToStaticMarkup(createElement(TeamBadge, {
      name: 'Unknown RFC',
      shortCode: 'UNK',
      badgeUrl: 'https://img.example/unknown.png',
    }));

    expect(html).toContain('src="https://img.example/unknown.png"');
  });
});
