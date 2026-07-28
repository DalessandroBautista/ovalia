import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../tournaments/use-tournaments', () => ({
  useCompetitions: () => ({
    status: 'ready',
    competitions: [
      { slug: 'urba-top-14', name: 'TOP 14 - Superior', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'top-14', tier: 'senior' },
      { slug: 'top-14-intermedia', name: 'TOP 14 - Intermedia', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'top-14', tier: 'intermediate' },
      { slug: 'urba-primera-a', name: 'PRIMERA A - Superior', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'primera-a', tier: 'senior' },
      { slug: 'menores-de-19-primera-rueda-g2-nivel-1-a', name: 'Menores de 19 - Primera Rueda - G2 NIVEL 1 A', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'menores-de-19', tier: 'youth' },
      { slug: 'rugby-championship', name: 'Rugby Championship', category: 'national-teams', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'rugby-internacional', name: 'Rugby Internacional' }, familySlug: 'rugby-championship', tier: 'senior' },
    ],
  }),
  useTournament: (slug: string) => {
    const competitions = [
      { slug: 'urba-top-14', name: 'TOP 14 - Superior', familySlug: 'top-14' },
      { slug: 'top-14-intermedia', name: 'TOP 14 - Intermedia', familySlug: 'top-14' },
    ];
    const comp = competitions.find((c) => c.slug === slug);
    return {
      status: 'ready' as const,
      competition: comp ? { slug: comp.slug, name: comp.name, familySlug: comp.familySlug, seasons: [{ year: 2026, name: '2026' }] } : null,
      standings: null,
      matches: [],
    };
  },
}));

vi.mock('../matches/use-agenda', () => ({
  useAgendaMatches: () => ({ status: 'loading', matches: [], source: null, freshness: 'unknown' as const }),
}));

vi.mock('../../components/live-rail', () => ({
  useLiveFeed: () => ({ status: 'loading' as const, matches: [] }),
}));

import { MatchesPage, PredictionPage, TournamentsPage, TournamentPage } from './portal-pages';

describe('public portal pages', () => {
  it('renders the match center', () => {
    const html = renderToStaticMarkup(createElement(MatchesPage));
    expect(html).toContain('Centro de partidos');
    expect(html).toContain('Volver al inicio');
    expect(html).toContain('Día anterior');
    expect(html).toContain('Día siguiente');
  });

  it('renders the tournament catalog with hierarchical grouping', () => {
    const html = renderToStaticMarkup(createElement(TournamentsPage));
    expect(html).toContain('Todos los torneos');
    expect(html).toContain('URBA');
    expect(html).toContain('TOP 14 - Superior');
    expect(html).toContain('PRIMERA A - Superior');
    // No debe listar Intermedia como ítem separado en el nivel 1.
    expect(html).not.toContain('TOP 14 - Intermedia');
    // Juveniles aparece agrupado aparte.
    expect(html).toContain('Juveniles');
  });

  it('renders the prediction experience', () => {
    expect(renderToStaticMarkup(createElement(PredictionPage))).toContain('Prode Ovalia');
  });
});

describe('TournamentPage family selector', () => {
  it('muestra un selector con las competencias de la misma familia', () => {
    const html = renderToStaticMarkup(createElement(TournamentPage, { slug: 'urba-top-14' }));
    expect(html).toContain('family-selector');
    expect(html).toContain('Intermedia');
    expect(html).toContain('Superior');
  });
});
