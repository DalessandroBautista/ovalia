import { randomInt, type Rng } from './rng.js';
import type { CareerState, SeasonRecord } from './types.js';

const DECLINE_AGE = 30;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Exigencia de la división: cuanto más alto el nivel (1 es el máximo), más media
 * hace falta para rendir bien.
 */
function difficultyFor(level: number): number {
  return 90 - (level - 1) * 12;
}

function ratingFor(state: CareerState, rng: Rng): number {
  const gap = state.overall - difficultyFor(state.club.level);
  const luck = randomInt(rng, -12, 12);
  const moraleEffect = (state.morale - 50) / 10;
  return clamp(Math.round(60 + gap * 0.6 + luck + moraleEffect), 1, 99);
}

function ageDelta(age: number): number {
  if (age < DECLINE_AGE) return 0;
  // La caída se acelera: leve a los 30, marcada pasados los 35.
  return -((age - DECLINE_AGE + 1) * 0.8);
}

export function simulateSeason(state: CareerState, rng: Rng): CareerState {
  const rating = ratingFor(state, rng);
  const growth = state.age < DECLINE_AGE ? (rating - 60) / 12 : 0;
  const overall = clamp(Math.round(state.overall + growth + ageDelta(state.age)), 1, 100);

  const record: SeasonRecord = {
    season: state.season,
    age: state.age,
    clubSlug: state.club.slug,
    clubName: state.club.name,
    level: state.club.level,
    rating,
    note: rating >= 75 ? 'Temporada consagratoria.' : rating >= 55 ? 'Temporada sólida.' : 'Temporada para el olvido.',
  };

  return {
    ...state,
    season: state.season + 1,
    age: state.age + 1,
    overall,
    peakOverall: Math.max(state.peakOverall, overall),
    support: clamp(state.support + Math.round((rating - 60) / 6), 0, 100),
    fame: clamp(state.fame + Math.round((rating - 65) / 8), 0, 100),
    morale: clamp(state.morale + Math.round((rating - 60) / 8), 0, 100),
    history: [...state.history, record],
  };
}
