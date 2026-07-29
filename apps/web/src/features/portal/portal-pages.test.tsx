import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentType } from 'react';
import type { AgendaMatch } from '../matches/agenda-data';
import type { Freshness } from '../../lib/api/types';

let agendaState: {
  status: 'loading' | 'ready' | 'error';
  matches: AgendaMatch[];
  source: string | null;
  freshness: Freshness;
} = {
  status: 'loading' as const,
  matches: [],
  source: null,
  freshness: 'unknown' as const,
};

vi.mock('../tournaments/use-tournaments', () => ({
  useCompetitions: () => ({
    status: 'ready',
    competitions: [
      { slug: 'urba-top-14', name: 'TOP 14 - Superior', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'top-14', tier: 'senior', priority: 100 },
      { slug: 'top-14-intermedia', name: 'TOP 14 - Intermedia', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'top-14', tier: 'intermediate', priority: 0 },
      { slug: 'urba-primera-a', name: 'PRIMERA A - Superior', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'primera-a', tier: 'senior', priority: 90 },
      { slug: 'menores-de-19-primera-rueda-g2-nivel-1-a', name: 'Menores de 19 - Primera Rueda - G2 NIVEL 1 A', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'menores-de-19', tier: 'youth', priority: 0 },
      { slug: 'rugby-championship', name: 'Rugby Championship', category: 'national-teams', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'rugby-internacional', name: 'Rugby Internacional' }, familySlug: 'rugby-championship', tier: 'senior', priority: 80 },
      { slug: 'torneo-interior-a', name: 'Torneo del Interior A', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'manual', organization: null, familySlug: 'torneo-interior-a', tier: 'senior', priority: 70 },
      { slug: 'tests-internacionales', name: 'Tests Internacionales', category: 'national-teams', gender: 'male', countryCode: null, coverage: 'manual', organization: null, familySlug: 'tests-internacionales', tier: 'senior', priority: 60 },
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
  useAgendaMatches: () => agendaState,
}));

vi.mock('../../components/live-rail', () => ({
  useLiveFeed: () => ({ status: 'loading' as const, matches: [] }),
}));

import { MatchesPage, PredictionPage, TournamentsPage, TournamentPage } from './portal-pages';

describe('public portal pages', () => {
  it('renders the match center', () => {
    agendaState = { status: 'loading', matches: [], source: null, freshness: 'unknown' };
    const html = renderToStaticMarkup(createElement(MatchesPage));
    expect(html).toContain('Centro de partidos');
    expect(html).toContain('Volver al inicio');
    expect(html).toContain('Día anterior');
    expect(html).toContain('Día siguiente');
  });

  it('groups match center fixtures by tournament priority and time', () => {
    agendaState = {
      status: 'ready',
      source: 'urba',
      freshness: 'fresh',
      matches: [
        {
          id: 'primera-a-early',
          competition: 'PRIMERA A - Superior',
          competitionSlug: 'urba-primera-a',
          round: 'Fecha 1',
          startsAt: '2026-07-25T18:00:00.000Z',
          status: 'scheduled',
          homeTeam: 'Los Matreros',
          awayTeam: 'San Cirano',
          homeBadgeUrl: null,
          awayBadgeUrl: null,
          homeScore: null,
          awayScore: null,
        },
        {
          id: 'top-14-late',
          competition: 'TOP 14 - Superior',
          competitionSlug: 'urba-top-14',
          round: 'Fecha 1',
          startsAt: '2026-07-25T20:00:00.000Z',
          status: 'scheduled',
          homeTeam: 'SIC',
          awayTeam: 'Hindú',
          homeBadgeUrl: null,
          awayBadgeUrl: null,
          homeScore: null,
          awayScore: null,
        },
        {
          id: 'top-14-early',
          competition: 'TOP 14 - Superior',
          competitionSlug: 'urba-top-14',
          round: 'Fecha 1',
          startsAt: '2026-07-25T17:00:00.000Z',
          status: 'scheduled',
          homeTeam: 'Newman',
          awayTeam: 'CUBA',
          homeBadgeUrl: null,
          awayBadgeUrl: null,
          homeScore: null,
          awayScore: null,
        },
      ],
    };

    const html = renderToStaticMarkup(createElement(MatchesPage as ComponentType<{ initialDate?: string }>, { initialDate: '2026-07-25' }));
    expect(html.indexOf('TOP 14 - Superior')).toBeLessThan(html.indexOf('PRIMERA A - Superior'));
    expect(html.indexOf('Newman')).toBeLessThan(html.indexOf('SIC'));
    expect(html).toContain('portal-competition-group');
  });

  it('renders the tournament catalog with hierarchical grouping', () => {
    const html = renderToStaticMarkup(createElement(TournamentsPage));
    expect(html).toContain('Todos los torneos');
    expect(html).toContain('URBA');
    expect(html).toContain('TOP 14 - Superior');
    expect(html).toContain('PRIMERA A - Superior');
    expect(html.indexOf('TOP 14 - Superior')).toBeLessThan(html.indexOf('PRIMERA A - Superior'));
    // No debe listar Intermedia como ítem separado en el nivel 1.
    expect(html).not.toContain('TOP 14 - Intermedia');
    // Juveniles aparece agrupado aparte.
    expect(html).toContain('Juveniles');
    expect(html).toContain('Rugby Internacional');
    expect(html).toContain('Rugby argentino');
    expect(html).toContain('Torneo del Interior A');
    expect(html).toContain('Tests Internacionales');
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
