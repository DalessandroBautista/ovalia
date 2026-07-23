export type MatchStatus = 'scheduled' | 'live' | 'halftime' | 'final' | 'postponed' | 'cancelled';

export interface MatchState {
  status: MatchStatus;
  scheduledAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export type MatchCommand =
  | { type: 'kickoff'; at: string }
  | { type: 'halftime'; at: string }
  | { type: 'resume'; at: string }
  | { type: 'finish'; at: string }
  | { type: 'postpone'; at: string }
  | { type: 'cancel'; at: string };

export function createScheduledMatch(scheduledAt: string): MatchState {
  return { status: 'scheduled', scheduledAt };
}

export function advanceMatch(match: MatchState, command: MatchCommand): MatchState {
  if (command.type === 'kickoff' && match.status === 'scheduled') {
    return { ...match, status: 'live', startedAt: command.at };
  }
  if (command.type === 'halftime' && match.status === 'live') return { ...match, status: 'halftime' };
  if (command.type === 'resume' && match.status === 'halftime') return { ...match, status: 'live' };
  if (command.type === 'finish' && (match.status === 'live' || match.status === 'halftime')) {
    return { ...match, status: 'final', finishedAt: command.at };
  }
  if (command.type === 'finish' && match.status === 'scheduled') {
    throw new Error('A scheduled match cannot finish before kickoff');
  }
  if (command.type === 'postpone' && match.status === 'scheduled') return { ...match, status: 'postponed' };
  if (command.type === 'cancel' && (match.status === 'scheduled' || match.status === 'postponed')) {
    return { ...match, status: 'cancelled' };
  }
  throw new Error(`Invalid match transition: ${match.status} -> ${command.type}`);
}
