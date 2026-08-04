import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import type { AgendaMatch } from '../matches/agenda-data';
import type { ApiMatchContext, Freshness } from '../../lib/api/types';

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

let organizationsStatus: 'loading' | 'ready' | 'error' = 'ready';

let matchContextState: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  context: ApiMatchContext | null;
} = { status: 'ready', context: null };

vi.mock('../tournaments/use-tournaments', async () => {
  const { ARGENTINA_RUGBY_UNIONS } = await import('@ovalia/domain');
  const competitionSlugsByUnion: Record<string, string[]> = {
    urba: ['urba-top-14', 'top-14-intermedia', 'top-14-preintermedia', 'top-14-m22', 'urba-primera-a', 'menores-de-19-primera-rueda-g2-nivel-1-a'],
    cordoba: ['ucr-top-10-primera', 'ucr-top-10-intermedia'],
    rosario: ['regional-del-litoral-primera'],
    'santa-fe': ['regional-del-litoral-primera'],
    entrerriana: ['regional-del-litoral-primera'],
  };
  return {
  useOrganizations: () => ({
    status: organizationsStatus,
    organizations: organizationsStatus === 'error' ? [] : ARGENTINA_RUGBY_UNIONS.map((organization, index) => ({
      ...organization,
      id: String(index + 1),
      competitionSlugs: competitionSlugsByUnion[organization.slug] ?? [],
    })),
  }),
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
      { slug: 'regional-del-litoral-primera', name: 'Torneo Regional del Litoral - Primera', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'manual', organization: { slug: 'rosario', name: 'Unión de Rugby de Rosario' }, familySlug: 'regional-del-litoral', tier: 'senior', priority: 70 },
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
  };
});

vi.mock('../matches/use-agenda', () => ({
  useAgendaMatches: () => agendaState,
}));

vi.mock('../matches/use-match-context', () => ({
  useMatchContext: () => matchContextState,
}));

vi.mock('../../components/live-rail', () => ({
  useLiveFeed: () => ({ status: 'loading' as const, matches: [] }),
}));

import { MatchesPage, PredictionPage, TournamentsPage, TournamentPage } from './portal-pages';

function modalMatchFixture(): AgendaMatch {
  return {
    id: 'match-1',
    competition: 'TOP 14 - Superior',
    competitionSlug: 'urba-top-14',
    round: 'Fecha 5',
    startsAt: '2026-07-30T18:00:00.000Z',
    status: 'final',
    homeTeam: 'Hindú',
    awayTeam: 'La Plata',
    homeBadgeUrl: null,
    awayBadgeUrl: null,
    homeScore: 24,
    awayScore: 17,
  };
}

function modalContextFixture(): ApiMatchContext {
  return {
    headToHead: { played: 0, homeWins: 0, awayWins: 0, draws: 0, recent: [] },
    form: { home: ['win'], away: ['loss'] },
    standings: { home: null, away: null },
  };
}

describe('public portal pages', () => {
  it('renders the match center', () => {
    agendaState = { status: 'loading', matches: [], source: null, freshness: 'unknown' };
    const html = renderToStaticMarkup(createElement(MatchesPage));
    expect(html).toContain('Centro de partidos');
    expect(html).toContain('Volver al inicio');
    expect(html).toContain('Día anterior');
    expect(html).toContain('Día siguiente');
  });

  it('keeps the agenda visible with a non-blocking notice when the tournament catalog fails', () => {
    agendaState = {
      status: 'ready',
      source: 'urba',
      freshness: 'fresh',
      matches: [
        {
          id: 'top-14-superior', competition: 'TOP 14 - Superior', competitionSlug: 'urba-top-14', round: 'Fecha 1',
          startsAt: '2026-07-25T17:00:00.000Z', status: 'scheduled', homeTeam: 'Newman', awayTeam: 'CUBA',
          homeBadgeUrl: null, awayBadgeUrl: null, homeScore: null, awayScore: null,
        },
      ],
    };
    organizationsStatus = 'error';
    try {
      const html = renderToStaticMarkup(createElement(MatchesPage as ComponentType<{ initialDate?: string }>, { initialDate: '2026-07-25' }));
      expect(html).toContain('Centro de partidos');
      expect(html).toContain('Newman');
      expect(html).toContain('No pudimos cargar el catálogo de torneos');
      expect(html).not.toContain('rugby-explorer__union');
    } finally {
      organizationsStatus = 'ready';
    }
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

  it('filters the match center by tournament family before opening its detail', () => {
    agendaState = {
      status: 'ready',
      source: 'urba',
      freshness: 'fresh',
      matches: [
        {
          id: 'top-14-superior', competition: 'TOP 14 - Superior', competitionSlug: 'urba-top-14', round: 'Fecha 1',
          startsAt: '2026-07-25T17:00:00.000Z', status: 'scheduled', homeTeam: 'Newman', awayTeam: 'CUBA',
          homeBadgeUrl: null, awayBadgeUrl: null, homeScore: null, awayScore: null,
        },
        {
          id: 'top-14-intermedia', competition: 'TOP 14 - Intermedia', competitionSlug: 'top-14-intermedia', round: 'Fecha 1',
          startsAt: '2026-07-25T15:00:00.000Z', status: 'scheduled', homeTeam: 'Newman I', awayTeam: 'CUBA I',
          homeBadgeUrl: null, awayBadgeUrl: null, homeScore: null, awayScore: null,
        },
        {
          id: 'primera-a', competition: 'PRIMERA A - Superior', competitionSlug: 'urba-primera-a', round: 'Fecha 1',
          startsAt: '2026-07-25T18:00:00.000Z', status: 'scheduled', homeTeam: 'Los Matreros', awayTeam: 'San Cirano',
          homeBadgeUrl: null, awayBadgeUrl: null, homeScore: null, awayScore: null,
        },
      ],
    };

    const html = renderToStaticMarkup(createElement(
      MatchesPage as ComponentType<{ initialDate?: string; initialFamily?: string }>,
      { initialDate: '2026-07-25', initialFamily: 'top-14' },
    ));

    expect(html).toContain('Partidos de TOP 14');
    expect(html).toContain('TOP 14 - Superior');
    expect(html).toContain('TOP 14 - Intermedia');
    expect(html).not.toContain('PRIMERA A - Superior');
    expect(html).toContain('href="/torneos/urba-top-14"');
    expect(html).toContain('Ver torneo');
    expect(html).toContain('aria-pressed="true"');
  });

  it('renders the tournament catalog with union and family hierarchy', () => {
    const html = renderToStaticMarkup(createElement(TournamentsPage));
    expect(html).toContain('Todos los torneos');
    expect(html).toContain('URBA');
    expect(html).toContain('TOP 14');
    expect(html).toContain('PRIMERA A');
    expect(html.indexOf('TOP 14')).toBeLessThan(html.indexOf('PRIMERA A'));
    expect(html).toContain('href="/torneos/urba-top-14"');
    expect(html).toContain('href="/torneos/urba-primera-a"');
    expect(html).toContain('Córdoba');
  });

  it('renders the shared rugby explorer with all unions and canonical tournament links', () => {
    const html = renderToStaticMarkup(createElement(TournamentsPage));
    expect(html).toContain('portal-main--compact');
    expect(html).toContain('aria-label="Países y torneos"');
    // Con la nueva estructura, solo se muestran uniones con competencias
    expect((html.match(/rugby-explorer__union/g) || []).length).toBeGreaterThan(0);
    expect(html).toContain('Argentina');
    expect(html).toContain('href="/torneos/urba-top-14"');
  });

  it('shows a shared regional competition from each associated union', () => {
    const html = renderToStaticMarkup(createElement(
      TournamentsPage as ComponentType<{ initialUnion?: string }>,
      { initialUnion: 'rosario' },
    ));

    expect(html).toContain('Unión de Rugby de Rosario');
    expect(html).toContain('Torneo Regional del Litoral');
    expect(html).toContain('href="/torneos/regional-del-litoral-primera"');
    expect(html).toContain('Santa Fe');
    expect(html).toContain('Entre Ríos');
    expect(html).not.toContain('TOP 14 France');
  });

  it('renders the prediction experience', () => {
    expect(renderToStaticMarkup(createElement(PredictionPage))).toContain('Prode Ovalia');
  });
});

describe('browser history sync', () => {
  const originalUrl = window.location.href;

  beforeEach(() => {
    agendaState = {
      status: 'ready',
      source: 'urba',
      freshness: 'fresh',
      matches: [
        {
          id: 'top-14-superior', competition: 'TOP 14 - Superior', competitionSlug: 'urba-top-14', round: 'Fecha 1',
          startsAt: '2026-07-25T17:00:00.000Z', status: 'scheduled', homeTeam: 'Newman', awayTeam: 'CUBA',
          homeBadgeUrl: null, awayBadgeUrl: null, homeScore: null, awayScore: null,
        },
      ],
    };
    organizationsStatus = 'ready';
    window.history.replaceState(null, '', '/partidos');
  });

  afterEach(() => {
    window.history.replaceState(null, '', originalUrl);
  });

  it('pushes a history entry (not just replaceState) when the family filter changes in /partidos', async () => {
    const user = userEvent.setup();
    render(createElement(MatchesPage as ComponentType<{ initialDate?: string }>, { initialDate: '2026-07-25' }));
    const pushSpy = vi.spyOn(window.history, 'pushState');

    // URBA viene expandida por defecto: clickeamos la familia directamente
    const familyButton = screen.getByRole('button', { name: /TOP 14/i });
    await user.click(familyButton);

    expect(pushSpy).toHaveBeenCalled();
    const lastCallUrl = String(pushSpy.mock.calls.at(-1)?.[2]);
    expect(lastCallUrl).toContain('torneo=top-14');
    pushSpy.mockRestore();
  });

  it('restores date and family from the URL when the user navigates back (popstate) in /partidos', () => {
    render(createElement(MatchesPage as ComponentType<{ initialDate?: string; initialFamily?: string }>, { initialDate: '2026-07-25', initialFamily: 'top-14' }));
    expect(screen.getByText(/Partidos de TOP 14/i)).toBeInTheDocument();

    act(() => {
      window.history.pushState(null, '', '/partidos?fecha=2026-07-25');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByText('Todos los partidos')).toBeInTheDocument();
  });

  it('pushes a history entry when the selected union changes in /torneos', async () => {
    const user = userEvent.setup();
    render(createElement(TournamentsPage));
    const pushSpy = vi.spyOn(window.history, 'pushState');

    const cordobaButton = screen.getByRole('button', { name: /Córdoba/i });
    await user.click(cordobaButton);

    expect(pushSpy).toHaveBeenCalled();
    const lastCallUrl = String(pushSpy.mock.calls.at(-1)?.[2]);
    expect(lastCallUrl).toContain('union=cordoba');
    pushSpy.mockRestore();
  });

  it('restores the selected union from the URL when the user navigates back (popstate) in /torneos', () => {
    render(createElement(TournamentsPage, { initialUnion: 'cordoba' } as never));
    expect(within(screen.getByRole('main')).getByText(/Unión Cordobesa/i)).toBeInTheDocument();

    act(() => {
      window.history.pushState(null, '', '/torneos?union=urba');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(within(screen.getByRole('main')).getByText(/Unión de Rugby de Buenos Aires/i)).toBeInTheDocument();
  });
});

describe('MatchesPage con detalle en modal', () => {
  const originalUrl = window.location.href;
  const InteractiveMatchesPage = MatchesPage as ComponentType<{
    initialDate?: string;
    initialMatchId?: string;
  }>;

  beforeEach(() => {
    agendaState = {
      status: 'ready',
      source: 'urba',
      freshness: 'fresh',
      matches: [modalMatchFixture()],
    };
    matchContextState = { status: 'ready', context: modalContextFixture() };
    organizationsStatus = 'ready';
    window.history.replaceState({}, '', '/partidos?fecha=2026-07-30');
  });

  afterEach(() => {
    window.history.replaceState({}, '', originalUrl);
  });

  it('abre el modal cuando la URL trae un partido de la fecha visible', () => {
    render(<InteractiveMatchesPage initialDate="2026-07-30" initialMatchId="match-1" />);
    expect(screen.getByRole('dialog', { name: 'Hindú contra La Plata' })).toBeInTheDocument();
  });

  it('ignora un partido de la URL que no está en la agenda visible', () => {
    render(<InteractiveMatchesPage initialDate="2026-07-30" initialMatchId="inexistente" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre el partido desde la agenda y lo agrega a la URL sin perder la fecha', async () => {
    const user = userEvent.setup();
    render(<InteractiveMatchesPage initialDate="2026-07-30" />);

    await user.click(screen.getByRole('button', { name: /Hindú.*La Plata/i }));
    expect(screen.getByRole('dialog', { name: 'Hindú contra La Plata' })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('partido')).toBe('match-1');
    expect(new URLSearchParams(window.location.search).get('fecha')).toBe('2026-07-30');
  });

  it('cierra el modal y quita solo el partido de la URL', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/partidos?fecha=2026-07-30&partido=match-1');
    render(<InteractiveMatchesPage initialDate="2026-07-30" initialMatchId="match-1" />);

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('partido')).toBeNull();
    expect(new URLSearchParams(window.location.search).get('fecha')).toBe('2026-07-30');
  });

  it('restaura el modal desde la URL al navegar atrás o adelante', async () => {
    render(<InteractiveMatchesPage initialDate="2026-07-30" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      window.history.replaceState({}, '', '/partidos?fecha=2026-07-30&partido=match-1');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    act(() => {
      window.history.replaceState({}, '', '/partidos?fecha=2026-07-30');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
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
