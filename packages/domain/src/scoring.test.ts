import { describe, expect, it } from 'vitest';

import { applyScoringEvent, emptyScore } from './scoring';

describe('rugby scoring', () => {
  it('adds five points for a try to the selected team', () => {
    const score = applyScoringEvent(emptyScore(), { team: 'home', type: 'try' });

    expect(score).toEqual({ home: 5, away: 0 });
  });

  it('supports conversions, penalties and drop goals', () => {
    const events = [
      { team: 'away', type: 'conversion' },
      { team: 'away', type: 'penalty' },
      { team: 'away', type: 'drop-goal' },
    ] as const;

    const score = events.reduce(applyScoringEvent, emptyScore());

    expect(score).toEqual({ home: 0, away: 8 });
  });

  it('does not mutate the previous score', () => {
    const initial = emptyScore();

    applyScoringEvent(initial, { team: 'home', type: 'try' });

    expect(initial).toEqual({ home: 0, away: 0 });
  });
});
