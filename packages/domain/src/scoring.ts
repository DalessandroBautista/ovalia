export type TeamSide = 'home' | 'away';

export type ScoringEventType = 'try' | 'conversion' | 'penalty' | 'drop-goal';

export interface Score {
  readonly home: number;
  readonly away: number;
}

export interface ScoringEvent {
  readonly team: TeamSide;
  readonly type: ScoringEventType;
}

const POINTS: Readonly<Record<ScoringEventType, number>> = {
  try: 5,
  conversion: 2,
  penalty: 3,
  'drop-goal': 3,
};

export function emptyScore(): Score {
  return { home: 0, away: 0 };
}

export function applyScoringEvent(score: Score, event: ScoringEvent): Score {
  return {
    ...score,
    [event.team]: score[event.team] + POINTS[event.type],
  };
}
