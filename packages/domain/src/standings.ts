export interface MatchSummary {
  homeScore: number;
  awayScore: number;
  homeTries: number;
  awayTries: number;
}

export function calculateMatchPoints(match: MatchSummary): { home: number; away: number } {
  let home = 0;
  let away = 0;
  if (match.homeScore === match.awayScore) {
    home = 2;
    away = 2;
  } else if (match.homeScore > match.awayScore) {
    home = 4;
    if (match.homeScore - match.awayScore <= 7) away += 1;
  } else {
    away = 4;
    if (match.awayScore - match.homeScore <= 7) home += 1;
  }
  if (match.homeTries >= 4) home += 1;
  if (match.awayTries >= 4) away += 1;
  return { home, away };
}
