import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AgendaFallback, FeaturedMatch, HomePage, LatestNewsCarousel } from './home-page';
import { argentinaDateKey } from '../matches/agenda-data';
import type { ApiMatch } from '../../lib/api/types';

// Usa el día argentino real de "hoy" (no el UTC) para que el filtro de "partidos de
// hoy" de la Agenda -que compara con argentinaDateKey()- no descarte estos partidos
// mockeados al pasar los días, incluida la franja 21:00-24:00 en Argentina donde el
// día UTC ya avanzó pero el día argentino no.
const todayAt = (hour: string) => `${argentinaDateKey()}T${hour}:00Z`;

const result: ApiMatch = {
  id: 'sic-hindu-final',
  competition: { slug: 'top-14', name: 'TOP 14' },
  season: 2026,
  round: 'Fecha 12',
  startsAt: '2026-08-01T18:30:00.000Z',
  venue: null,
  status: 'final',
  home: { slug: 'sic', name: 'SIC', shortName: 'SIC', badgeUrl: null },
  away: { slug: 'hindu', name: 'Hindú', shortName: 'HIN', badgeUrl: null },
  homeScore: 24,
  awayScore: 21,
  source: 'urba',
  freshness: 'fresh',
};

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

describe('contenido útil cuando no hay vivo ni notas', () => {
  it('muestra próximos partidos en lugar de dejar la agenda vacía', () => {
    const upcoming = { ...result, id: 'next', status: 'scheduled' as const, homeScore: null, awayScore: null };
    const html = renderToStaticMarkup(createElement(AgendaFallback, { matches: [upcoming] }));

    expect(html).toContain('Próximos partidos');
    expect(html).toContain('SIC');
    expect(html).toContain('Hindú');
  });

  it('presenta notas con imagen y controles accesibles', () => {
    const html = renderToStaticMarkup(createElement(LatestNewsCarousel, {
      articles: [{
        slug: 'la-final',
        title: 'La final que cambió el torneo',
        summary: 'Claves de una definición inolvidable.',
        coverImageUrl: 'https://images.example.test/final.webp',
        publishedAt: '2026-08-02T12:00:00.000Z',
      }],
      fallbackMatches: [],
    }));

    expect(html).toContain('Últimas noticias');
    expect(html).toContain('La final que cambió el torneo');
    expect(html).toContain('https://images.example.test/final.webp');
    expect(html).toContain('aria-label="Noticia anterior"');
    expect(html).toContain('aria-label="Noticia siguiente"');
  });

  it('usa resultados verificados y los rotula como tales si todavía no hay notas', () => {
    const html = renderToStaticMarkup(createElement(LatestNewsCarousel, {
      articles: [],
      fallbackMatches: [result],
    }));

    expect(html).toContain('Últimos resultados');
    expect(html).toContain('24 — 21');
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
