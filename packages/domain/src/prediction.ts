export interface PredictedScore {
  home: number;
  away: number;
}

function outcome(score: PredictedScore): 'home' | 'draw' | 'away' {
  if (score.home === score.away) return 'draw';
  return score.home > score.away ? 'home' : 'away';
}

export function scorePrediction(prediction: PredictedScore, result: PredictedScore): number {
  if (prediction.home === result.home && prediction.away === result.away) return 5;
  if (outcome(prediction) !== outcome(result)) return 0;
  if (prediction.home - prediction.away === result.home - result.away) return 3;
  return 1;
}
