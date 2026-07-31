import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApiLineups, ApiMatchContext } from '../../lib/api/types';
import type { AgendaMatch } from './agenda-data';

let contextState: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  context: ApiMatchContext | null;
};

let lineupsState: {
  status: 'idle' | 'loading' | 'ready' | 'error';
  lineups: ApiLineups | null;
};

vi.mock('./use-match-context', () => ({
  useMatchContext: () => contextState,
}));

vi.mock('./use-match-lineups', () => ({
  useMatchLineups: () => lineupsState,
}));

import { MatchModal } from './match-modal';

function matchFixture(): AgendaMatch {
  return {
    id: 'match-1',
    competition: 'URBA Top 14',
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

function contextFixture(): ApiMatchContext {
  return {
    headToHead: {
      played: 2,
      homeWins: 1,
      awayWins: 1,
      draws: 0,
      recent: [
        {
          id: 'previous-1',
          startsAt: '2026-05-10T18:00:00.000Z',
          homeTeamSlug: 'hindu',
          awayTeamSlug: 'la-plata',
          homeTeamName: 'Hindú',
          awayTeamName: 'CURDA La Plata',
          homeScore: 20,
          awayScore: 10,
        },
      ],
    },
    form: { home: ['win', 'loss'], away: ['draw'] },
    standings: {
      home: { position: 3, points: 40, played: 10 },
      away: { position: 8, points: 22, played: 10 },
    },
  };
}

function lineupsFixture(): ApiLineups {
  return {
    home: [
      { shirtNumber: 1, isStarter: true, isCaptain: false, player: { slug: 'marcos-torrillas', fullName: 'Marcos Torrillas' } },
      { shirtNumber: 10, isStarter: true, isCaptain: true, player: { slug: 'juan-cruz-perez', fullName: 'Juan Cruz Pérez' } },
      { shirtNumber: 16, isStarter: false, isCaptain: false, player: { slug: 'felipe-lopez', fullName: 'Felipe López' } },
    ],
    away: [
      { shirtNumber: 10, isStarter: true, isCaptain: true, player: { slug: 'nicolas-sanchez', fullName: 'Nicolás Sánchez' } },
    ],
  };
}

describe('MatchModal', () => {
  beforeEach(() => {
    contextState = { status: 'ready', context: contextFixture() };
    lineupsState = { status: 'idle', lineups: null };
  });

  it('muestra los equipos y el resultado mientras carga el contexto', () => {
    contextState = { status: 'loading', context: null };
    render(<MatchModal match={matchFixture()} onClose={() => {}} />);

    const dialog = screen.getByRole('dialog', { name: 'Hindú contra La Plata' });
    expect(within(dialog).getByText('Hindú')).toBeInTheDocument();
    expect(within(dialog).getByText('La Plata')).toBeInTheDocument();
    expect(within(dialog).getByText('24')).toBeInTheDocument();
    expect(within(dialog).getByText('17')).toBeInTheDocument();
    expect(within(dialog).getByText('Cargando contexto…')).toBeInTheDocument();
  });

  it('cambia entre forma, historial y posiciones', async () => {
    const user = userEvent.setup();
    render(<MatchModal match={matchFixture()} onClose={() => {}} />);

    expect(screen.getByRole('button', { name: 'Forma' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Historial' }));
    expect(screen.getByRole('button', { name: 'Historial' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('2 partidos entre ambos')).toBeInTheDocument();
    const historyList = screen.getByRole('list');
    expect(within(historyList).getByText('Hindú')).toBeInTheDocument();
    expect(within(historyList).getByText('CURDA La Plata')).toBeInTheDocument();
    expect(within(historyList).queryByText('hindu')).not.toBeInTheDocument();
    expect(within(historyList).queryByText('la plata')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Posiciones' }));
    expect(screen.getByRole('button', { name: 'Posiciones' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('3°')).toBeInTheDocument();
  });

  it('muestra vacíos honestos cuando falla el contexto sin perder la cabecera', async () => {
    contextState = { status: 'error', context: null };
    const user = userEvent.setup();
    render(<MatchModal match={matchFixture()} onClose={() => {}} />);

    expect(screen.getAllByText('Sin partidos anteriores')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Historial' }));
    expect(screen.getByText('Sin enfrentamientos previos registrados')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Posiciones' }));
    expect(screen.getAllByText('Este equipo no figura en la tabla')).toHaveLength(2);
    expect(screen.getByRole('dialog', { name: 'Hindú contra La Plata' })).toBeInTheDocument();
  });

  it('cierra con Escape y con el botón visible', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MatchModal match={matchFixture()} onClose={onClose} />);

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('no muestra la pestaña de formaciones si no hay datos', () => {
    lineupsState = { status: 'ready', lineups: { home: [], away: [] } };
    render(<MatchModal match={matchFixture()} onClose={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Formaciones' })).not.toBeInTheDocument();
  });

  it('muestra la pestaña de formaciones cuando hay datos', async () => {
    lineupsState = { status: 'ready', lineups: lineupsFixture() };
    const user = userEvent.setup();
    render(<MatchModal match={matchFixture()} onClose={() => {}} />);

    expect(screen.getByRole('button', { name: 'Formaciones' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Formaciones' }));

    expect(screen.getByText('Marcos Torrillas')).toBeInTheDocument();
    expect(screen.getByText('Juan Cruz Pérez')).toBeInTheDocument();
    expect(screen.getByText('Felipe López')).toBeInTheDocument();
    expect(screen.getByText('Nicolás Sánchez')).toBeInTheDocument();
  });

  it('muestra la marca de capitán solo donde corresponde', async () => {
    lineupsState = { status: 'ready', lineups: lineupsFixture() };
    const user = userEvent.setup();
    render(<MatchModal match={matchFixture()} onClose={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Formaciones' }));

    const captains = screen.queryAllByTitle('Capitán');
    expect(captains).toHaveLength(2); // Juan Cruz Pérez y Nicolás Sánchez
  });

  it('no muestra la pestaña de formaciones mientras se están cargando', () => {
    lineupsState = { status: 'loading', lineups: null };
    render(<MatchModal match={matchFixture()} onClose={() => {}} />);

    // La pestaña no debe parpadear: solo aparece cuando hay formación cargada.
    expect(screen.queryByRole('button', { name: 'Formaciones' })).not.toBeInTheDocument();
  });

  it('no muestra la pestaña de formaciones si la carga falló', () => {
    lineupsState = { status: 'error', lineups: null };
    render(<MatchModal match={matchFixture()} onClose={() => {}} />);

    expect(screen.queryByRole('button', { name: 'Formaciones' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Hindú contra La Plata' })).toBeInTheDocument();
  });
});
