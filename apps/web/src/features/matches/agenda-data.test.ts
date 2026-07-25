import { describe, expect, it } from 'vitest';

import {
  argentinaDateKey,
  buildCalendarDays,
  filterMatchesByDate,
  formatAgendaDateLabel,
  groupMatchesByCompetition,
  shiftDateKey,
  type AgendaMatch,
} from './agenda-data';

const matches: AgendaMatch[] = [
  {
    id: 'argentina-south-africa-2026',
    competition: 'Rugby Championship',
    round: 'Fecha 3',
    startsAt: '2026-07-23T20:00:00.000Z',
    status: 'final',
    homeTeam: 'Argentina',
    awayTeam: 'Sudáfrica',
    homeScore: 24,
    awayScore: 21,
  },
  {
    id: 'sic-hindu-2026-07-25',
    competition: 'URBA Top 14',
    round: 'Fecha 12',
    startsAt: '2026-07-25T18:30:00.000Z',
    status: 'scheduled',
    homeTeam: 'SIC',
    awayTeam: 'Hindú',
    homeScore: null,
    awayScore: null,
  },
  {
    id: 'new-zealand-australia-2026',
    competition: 'Rugby Championship',
    round: 'Fecha 3',
    startsAt: '2026-07-25T07:05:00.000Z',
    status: 'scheduled',
    homeTeam: 'Nueva Zelanda',
    awayTeam: 'Australia',
    homeScore: null,
    awayScore: null,
  },
];

describe('shared agenda dates', () => {
  it('assigns an instant to its calendar day in Argentina', () => {
    expect(argentinaDateKey('2026-07-26T01:30:00.000Z')).toBe('2026-07-25');
  });

  it('moves between ISO calendar days without timezone drift', () => {
    expect(shiftDateKey('2026-07-25', -1)).toBe('2026-07-24');
    expect(shiftDateKey('2026-07-25', 1)).toBe('2026-07-26');
  });

  it('builds a clickable seven-day window around the selected date', () => {
    expect(buildCalendarDays('2026-07-25').map((day) => day.key)).toEqual([
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
      '2026-07-25',
      '2026-07-26',
      '2026-07-27',
      '2026-07-28',
    ]);
  });

  it('shows HOY only for the actual Argentine date', () => {
    const now = new Date('2026-07-25T15:00:00.000Z');
    expect(formatAgendaDateLabel('2026-07-25', now)).toBe('HOY · SÁBADO 25 JUL');
    expect(formatAgendaDateLabel('2026-07-23', now)).toBe('JUEVES 23 JUL');
  });
});

describe('shared agenda fixtures', () => {
  it('does not mix matches from July 23 into July 25', () => {
    expect(filterMatchesByDate(matches, '2026-07-23').map((match) => match.id)).toEqual([
      'argentina-south-africa-2026',
    ]);
    expect(filterMatchesByDate(matches, '2026-07-25').map((match) => match.id)).toEqual([
      'new-zealand-australia-2026',
      'sic-hindu-2026-07-25',
    ]);
  });

  it('groups the selected fixtures by competition', () => {
    const groups = groupMatchesByCompetition(filterMatchesByDate(matches, '2026-07-25'));
    expect(groups.map((group) => [group.competition, group.matches.length])).toEqual([
      ['Rugby Championship', 1],
      ['URBA Top 14', 1],
    ]);
  });
});
