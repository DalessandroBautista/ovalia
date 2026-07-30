export type FormResult = 'win' | 'draw' | 'loss';

export interface PastMatch {
  id: string;
  startsAt: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
  homeScore: number;
  awayScore: number;
}

export interface HeadToHead {
  played: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  recent: PastMatch[];
}

export interface TeamPosition {
  position: number;
  points: number;
  played: number;
}

const HEAD_TO_HEAD_LIMIT = 10;
const RECENT_FORM_LIMIT = 5;

function byMostRecent(left: PastMatch, right: PastMatch): number {
  return right.startsAt.localeCompare(left.startsAt);
}

export function buildHeadToHead(params: {
  homeTeamSlug: string;
  awayTeamSlug: string;
  matches: readonly PastMatch[];
  limit?: number;
}): HeadToHead {
  const { homeTeamSlug, awayTeamSlug, matches, limit = HEAD_TO_HEAD_LIMIT } = params;
  const between = matches
    .filter((item) =>
      (item.homeTeamSlug === homeTeamSlug && item.awayTeamSlug === awayTeamSlug)
      || (item.homeTeamSlug === awayTeamSlug && item.awayTeamSlug === homeTeamSlug))
    .sort(byMostRecent);

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  for (const item of between) {
    if (item.homeScore === item.awayScore) {
      draws += 1;
      continue;
    }
    const winner = item.homeScore > item.awayScore ? item.homeTeamSlug : item.awayTeamSlug;
    if (winner === homeTeamSlug) homeWins += 1;
    else awayWins += 1;
  }

  return { played: between.length, homeWins, awayWins, draws, recent: between.slice(0, limit) };
}

export function buildRecentForm(params: {
  teamSlug: string;
  matches: readonly PastMatch[];
  limit?: number;
}): FormResult[] {
  const { teamSlug, matches, limit = RECENT_FORM_LIMIT } = params;
  return matches
    .filter((item) => item.homeTeamSlug === teamSlug || item.awayTeamSlug === teamSlug)
    .sort(byMostRecent)
    .slice(0, limit)
    .map((item) => {
      if (item.homeScore === item.awayScore) return 'draw';
      const isHome = item.homeTeamSlug === teamSlug;
      const ownScore = isHome ? item.homeScore : item.awayScore;
      const rivalScore = isHome ? item.awayScore : item.homeScore;
      return ownScore > rivalScore ? 'win' : 'loss';
    });
}

export function findTeamPosition(
  rows: readonly { teamSlug: string; points: number; played: number }[],
  teamSlug: string,
): TeamPosition | null {
  const index = rows.findIndex((row) => row.teamSlug === teamSlug);
  if (index < 0) return null;
  const row = rows[index]!;
  return { position: index + 1, points: row.points, played: row.played };
}
