import { describe, expect, it } from 'vitest';

import { recentResultsRange, selectRecentResults } from './use-home-content';
import type { ApiMatch } from '../../lib/api/types';

const match = (id: string, startsAt: string, status: ApiMatch['status']): ApiMatch => ({
  id,
  competition: { slug: 'top-14', name: 'TOP 14' },
  season: 2026,
  round: 'Fecha 1',
  startsAt,
  venue: null,
  status,
  home: { slug: 'sic', name: 'SIC', shortName: 'SIC', badgeUrl: null },
  away: { slug: 'hindu', name: 'Hindú', shortName: 'HIN', badgeUrl: null },
  homeScore: status === 'final' ? 24 : null,
  awayScore: status === 'final' ? 21 : null,
  source: 'urba',
  freshness: 'fresh',
});

describe('contenido reciente de la portada', () => {
  it('consulta catorce días hasta el final del día argentino actual', () => {
    expect(recentResultsRange(new Date('2026-08-02T15:00:00.000Z'))).toEqual({
      from: '2026-07-19T00:00:00-03:00',
      to: '2026-08-02T23:59:59-03:00',
    });
  });

  it('deja solo finales y muestra primero el más reciente', () => {
    const matches = [
      match('old', '2026-08-01T17:00:00.000Z', 'final'),
      match('future', '2026-08-03T17:00:00.000Z', 'scheduled'),
      match('new', '2026-08-02T17:00:00.000Z', 'final'),
    ];

    expect(selectRecentResults(matches, 2).map((item) => item.id)).toEqual(['new', 'old']);
  });
});
