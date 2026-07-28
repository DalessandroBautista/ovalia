import { describe, expect, it } from 'vitest';

import {
  argentinaDateKey,
  argentinaDayRange,
  buildCalendarDays,
  filterMatchesByDate,
  formatAgendaDateLabel,
  groupMatchesByCompetition,
  mapApiMatch,
  shiftDateKey,
  type AgendaMatch,
} from './agenda-data';
import type { ApiMatch } from '../../lib/api/types';

const matches: AgendaMatch[] = [
  {
    id: 'argentina-south-africa-2026',
    competition: 'Rugby Championship',
    round: 'Fecha 3',
    startsAt: '2026-07-23T20:00:00.000Z',
    status: 'final',
    homeTeam: 'Argentina',
    awayTeam: 'Sudáfrica',
    homeBadgeUrl: null,
    awayBadgeUrl: null,
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
    homeBadgeUrl: null,
    awayBadgeUrl: null,
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
    homeBadgeUrl: null,
    awayBadgeUrl: null,
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

describe('API mapping', () => {
  it('argentinaDayRange cubre el día argentino con offset -03:00', () => {
    expect(argentinaDayRange('2026-08-01')).toEqual({
      from: '2026-08-01T00:00:00-03:00',
      to: '2026-08-01T23:59:59-03:00',
    });
  });

  it('mapApiMatch aplana el DTO y conserva fuente/frescura', () => {
    const api: ApiMatch = {
      id: 'm1',
      competition: { slug: 'top-14-superior', name: 'TOP 14 - Superior' },
      season: 2026,
      round: 'Fecha 1',
      startsAt: '2026-08-01T18:00:00.000Z',
      venue: 'SIC',
      status: 'final',
      home: { slug: 'sic', name: 'SIC', shortName: 'SIC', badgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png' },
      away: { slug: 'hindu', name: 'Hindú', shortName: 'HIN', badgeUrl: null },
      homeScore: 24,
      awayScore: 21,
      source: 'urba',
      freshness: 'fresh',
    };
    expect(mapApiMatch(api)).toMatchObject({
      id: 'm1',
      competition: 'TOP 14 - Superior',
      competitionSlug: 'top-14-superior',
      homeTeam: 'SIC',
      awayTeam: 'Hindú',
      homeBadgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png',
      awayBadgeUrl: null,
      homeScore: 24,
      source: 'urba',
      freshness: 'fresh',
    });
  });
});
