import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { FeaturedMatch, HomePage } from './home-page';

// Usa la fecha real de "hoy" en vez de una fija, para que el filtro de "partidos de
// hoy" de la Agenda no descarte estos partidos mockeados al pasar los días.
const todayAt = (hour: string) => `${new Date().toISOString().slice(0, 10)}T${hour}:00Z`;

vi.mock('../matches/use-agenda', () => ({
  useAgendaMatches: () => ({
    status: 'ready' as const,
    matches: [
      {
        id: 'm1',
        competition: 'TOP 14 - Superior',
        round: 'Fecha 1',
        startsAt: todayAt('18:00'),
        homeTeam: 'SIC',
        awayTeam: 'Hindú',
        status: 'scheduled' as const,
        homeScore: null,
        awayScore: null,
        homeBadgeUrl: null,
        awayBadgeUrl: null,
      },
      {
        id: 'm2',
        competition: 'Rugby Championship',
        round: 'Jornada 3',
        startsAt: todayAt('20:00'),
        homeTeam: 'Argentina',
        awayTeam: 'Sudáfrica',
        status: 'scheduled' as const,
        homeScore: null,
        awayScore: null,
        homeBadgeUrl: null,
        awayBadgeUrl: null,
      },
    ],
    source: null,
    freshness: 'unknown' as const,
  }),
}));

vi.mock('../matches/use-upcoming', () => ({
  useUpcomingMatches: () => ({ matches: [], nextCursor: null }),
}));

vi.mock('./use-home', () => ({
  useHome: () => ({ data: null, status: 'ready' as const }),
  useCountdown: () => null,
}));

vi.mock('../../components/live-rail', () => ({
  useLiveFeed: () => ({ status: 'empty' as const, source: 'database', freshness: 'fresh' as const, generatedAt: '', matches: [] }),
  LiveRailView: () => null,
  formatUpcomingTime: (t: string) => t,
}));

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

describe('Agenda en HomePage', () => {
  it('incluye Torneos en la navegación móvil principal', () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    const mobileNav = html.slice(html.indexOf('bottom-nav'));

    expect(mobileNav).toContain('href="/torneos"');
  });

  it('muestra un solo torneo a la vez con selector para los demás', () => {
    const html = renderToStaticMarkup(createElement(HomePage));
    // Solo un article.competition debe aparecer.
    const competitionCount = (html.match(/class="competition"/g) || []).length;
    expect(competitionCount).toBe(1);
    // El selector debe mostrar ambos torneos.
    expect(html).toContain('TOP 14 - Superior');
    expect(html).toContain('Rugby Championship');
    expect(html).toContain('agenda-match-layout');
    expect(html).toContain('agenda-competition-selector');
  });
});
