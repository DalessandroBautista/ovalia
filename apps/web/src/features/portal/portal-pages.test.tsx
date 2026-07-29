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
      { slug: 'urba-top-14', name: 'TOP 14 - Superior', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: null, tier: 'senior', priority: 100 },
      { slug: 'top-14-intermedia', name: 'TOP 14 - Intermedia', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'top-14', tier: 'intermediate', priority: 0 },
      { slug: 'top-14-preintermedia', name: 'TOP 14 - Preintermedia', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'top-14', tier: 'intermediate', priority: 0 },
      { slug: 'top-14-m22', name: 'TOP 14 - Menores de 22', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'top-14', tier: 'youth', priority: 0 },
      { slug: 'urba-primera-a', name: 'PRIMERA A - Superior', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: null, tier: 'senior', priority: 90 },
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
      { slug: 'top-14-preintermedia', name: 'TOP 14 - Preintermedia', familySlug: 'top-14' },
      { slug: 'top-14-m22', name: 'TOP 14 - Menores de 22', familySlug: 'top-14' },
    ];
    const comp = competitions.find((c) => c.slug === slug);
    const matches: AgendaMatch[] = Array.from({ length: 8 }, (_, index) => ({
      id: `top-14-${index + 1}`,
      competition: 'TOP 14 - Superior',
      competitionSlug: 'urba-top-14',
      round: index === 7 ? 'Fecha 2' : 'Fecha 1',
      startsAt: `2026-07-${25 + Math.floor(index / 7)}T${String(12 + index).padStart(2, '0')}:00:00.000Z`,
      status: 'final',
      homeTeam: `Local ${index + 1}`,
      awayTeam: `Visitante ${index + 1}`,
      homeBadgeUrl: '/badges/home.svg',
      awayBadgeUrl: '/badges/away.svg',
      homeScore: 20 + index,
      awayScore: 10 + index,
    }));
    return {
      status: 'ready' as const,
      competition: comp ? { slug: comp.slug, name: comp.name, familySlug: comp.familySlug, seasons: [{ year: 2026, name: '2026' }] } : null,
      standings: null,
      matches: slug === 'urba-top-14' ? matches : [],
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
    expect(html).toContain('Plantel superior');
    expect(html).toContain('tournament-segment-selector');
    expect(html).not.toContain('Preintermedia');
    expect((html.match(/<h4>TOP 14<\/h4>/g) || []).length).toBe(1);
    expect(html).toContain('tournament-organization-nav');
    expect(html).toContain('Unión Cordobesa');
  });

  it('groups tournaments by country before organization and counts tournament families', () => {
    const html = renderToStaticMarkup(createElement(TournamentsPage));
    const argentinaIndex = html.indexOf('>Argentina<');
    const internationalIndex = html.indexOf('id="pais-internacional"');
    const franceIndex = html.indexOf('id="pais-francia"');

    expect(html).toContain('tournament-country-nav');
    expect(html).toContain('aria-label="Países con torneos"');
    expect(html).toContain('tournament-country-filter');
    expect(html).toContain('5 torneos');
    expect(argentinaIndex).toBeGreaterThan(-1);
    expect(internationalIndex).toBe(-1);
    expect(franceIndex).toBe(-1);
    expect(html.indexOf('URBA')).toBeGreaterThan(argentinaIndex);
    expect(html).not.toContain('Internacional');
    expect(html).not.toContain('<section class="tournament-country" id="pais-internacional"');
    expect(html).not.toContain('<section class="tournament-country" id="pais-francia"');
  });

  it('renders the prediction experience', () => {
    expect(renderToStaticMarkup(createElement(PredictionPage))).toContain('Prode Ovalia');
  });
});

describe('TournamentPage family selector', () => {
  it('muestra un selector con las competencias de la misma familia', () => {
    const html = renderToStaticMarkup(createElement(TournamentPage, { slug: 'urba-top-14', initialTab: 'resultados' }));
    expect(html).toContain('family-selector');
    expect(html).toContain('Intermedia');
    expect(html).toContain('Superior');
    expect(html).toContain('Preintermedia');
    expect(html).toContain('Menores de 22');
    expect(html).toContain('round-toolbar');
    expect(html).toContain('team-badge');
  });

  it('muestra una sola fecha de resultados y permite navegar a la siguiente', () => {
    const html = renderToStaticMarkup(createElement(TournamentPage, { slug: 'urba-top-14', initialTab: 'resultados' }));
    expect(html).toContain('round-toolbar');
    expect(html).toContain('Fecha 1');
    expect(html).not.toContain('Fecha 2');
    expect(html).toContain('aria-label="Siguiente fecha"');
  });
});
