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
      { slug: 'top-14-preintermedia', name: 'TOP 14 - Preintermedia', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'top-14', tier: 'intermediate', priority: 0 },
      { slug: 'top-14-m22', name: 'TOP 14 - Menores de 22', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'top-14', tier: 'youth', priority: 0 },
      { slug: 'urba-primera-a', name: 'PRIMERA A - Superior', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'primera-a', tier: 'senior', priority: 90 },
      { slug: 'menores-de-19-primera-rueda-g2-nivel-1-a', name: 'Menores de 19 - Primera Rueda - G2 NIVEL 1 A', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'menores-de-19', tier: 'youth', priority: 0 },
      { slug: 'rugby-championship', name: 'Rugby Championship', category: 'national-teams', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'rugby-internacional', name: 'Rugby Internacional' }, familySlug: 'rugby-championship', tier: 'senior', priority: 80 },
      { slug: 'ucr-top-10-primera', name: 'TOP 10 A - Primera', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'manual', organization: { slug: 'cordoba', name: 'Unión Cordobesa' }, familySlug: 'top-10-a', tier: 'senior', priority: 75 },
      { slug: 'ucr-top-10-intermedia', name: 'TOP 10 A - Intermedia', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'manual', organization: { slug: 'cordoba', name: 'Unión Cordobesa' }, familySlug: 'top-10-a', tier: 'intermediate', priority: 0 },
      { slug: 'torneo-interior-a', name: 'Torneo del Interior A', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'manual', organization: null, familySlug: 'torneo-interior-a', tier: 'senior', priority: 70 },
      { slug: 'tests-internacionales', name: 'Tests Internacionales', category: 'national-teams', gender: 'male', countryCode: null, coverage: 'manual', organization: null, familySlug: 'tests-internacionales', tier: 'senior', priority: 60 },
      { slug: 'top-14-france', name: 'TOP 14 France - Principal', category: 'clubs', gender: 'male', countryCode: 'FR', coverage: 'manual', organization: { slug: 'lnr', name: 'Ligue Nationale de Rugby' }, familySlug: 'top-14-france', tier: 'senior', priority: 50 },
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

  it('keeps the primary portal destinations available in mobile navigation', () => {
    const html = renderToStaticMarkup(createElement(TournamentsPage));
    const mobileNav = html.slice(html.indexOf('portal-mobile-nav'));

    expect(html).toContain('portal-mobile-nav');
    expect(mobileNav).toContain('href="/partidos"');
    expect(mobileNav).toContain('href="/torneos"');
    expect(mobileNav).toContain('href="/prodes"');
    expect(mobileNav).toContain('href="/juegos"');
    expect(mobileNav).toContain('href="/ingresar"');
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
    expect(html).toContain('TOP 14');
    expect(html).toContain('PRIMERA A');
    expect(html.indexOf('TOP 14')).toBeLessThan(html.indexOf('PRIMERA A'));
    expect(html).toContain('Superior');
    expect(html).toContain('Intermedia');
    expect(html).toContain('Preintermedia');
    expect(html).toContain('Menores de 22');
    expect(html).toContain('Rugby Internacional');
    expect(html).toContain('Rugby argentino');
    expect(html).toContain('Unión Cordobesa');
    expect(html).toContain('TOP 10 A');
    expect(html).toContain('Primera');
    expect(html).toContain('Torneo del Interior A');
    expect(html).toContain('Tests Internacionales');
  });

  it('groups tournaments by country before organization and counts tournament families', () => {
    const html = renderToStaticMarkup(createElement(TournamentsPage));
    const argentinaIndex = html.indexOf('>Argentina<');
    const internationalIndex = html.indexOf('>Internacional<');
    const franceIndex = html.indexOf('>Francia<');

    expect(html).toContain('tournament-country-nav');
    expect(html).toContain('href="#pais-argentina"');
    expect(html).toContain('5 torneos');
    expect(html).toContain('2 torneos');
    expect(html).toContain('1 torneo');
    expect(argentinaIndex).toBeGreaterThan(-1);
    expect(internationalIndex).toBeGreaterThan(argentinaIndex);
    expect(franceIndex).toBeGreaterThan(internationalIndex);
    expect(html.indexOf('URBA')).toBeGreaterThan(argentinaIndex);
    expect(html.indexOf('Rugby Internacional')).toBeGreaterThan(internationalIndex);
    expect(html.indexOf('Ligue Nationale de Rugby')).toBeGreaterThan(franceIndex);
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
