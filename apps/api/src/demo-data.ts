export const matches = [
  {
    id: 'sic-hindu-2026-07-25',
    competition: 'URBA Top 14',
    round: 'Fecha 12',
    startsAt: '2026-07-25T18:30:00.000Z',
    status: 'scheduled',
    homeTeam: 'SIC',
    awayTeam: 'Hindú',
    homeScore: null,
    awayScore: null
  },
  {
    id: 'casi-newman-2026-07-25',
    competition: 'URBA Top 14',
    round: 'Fecha 12',
    startsAt: '2026-07-25T18:30:00.000Z',
    status: 'scheduled',
    homeTeam: 'CASI',
    awayTeam: 'Newman',
    homeScore: null,
    awayScore: null
  },
  {
    id: 'argentina-south-africa-2026',
    competition: 'Rugby Championship',
    round: 'Fecha 3',
    startsAt: '2026-07-23T20:00:00.000Z',
    status: 'final',
    homeTeam: 'Argentina',
    awayTeam: 'Sudáfrica',
    homeScore: 24,
    awayScore: 21
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
    awayScore: null
  }
] as const;

export const urbaStandings = [
  { position: 1, team: 'SIC', played: 11, won: 9, drawn: 0, lost: 2, difference: 142, bonus: 7, points: 43 },
  { position: 2, team: 'Hindú', played: 11, won: 8, drawn: 1, lost: 2, difference: 96, bonus: 6, points: 40 },
  { position: 3, team: 'Newman', played: 11, won: 8, drawn: 0, lost: 3, difference: 78, bonus: 5, points: 37 },
  { position: 4, team: 'Alumni', played: 11, won: 7, drawn: 1, lost: 3, difference: 54, bonus: 6, points: 36 }
] as const;
