import { randomInt, type Rng } from './rng.js';
import type { CareerPosition, CareerState, SeasonRecord } from './types.js';

const DECLINE_AGE = 30;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Peso de try por puesto: los backs de punta convierten mucho más que los forwards. */
const TRY_WEIGHT: Record<CareerPosition, number> = {
  pilar: 0.1,
  hooker: 0.2,
  segunda: 0.15,
  ala: 0.3,
  octavo: 0.35,
  'medio-scrum': 0.5,
  apertura: 0.4,
  centro: 0.8,
  wing: 1.3,
  fullback: 0.9,
};

function triesFor(state: CareerState, rng: Rng): number {
  const weight = TRY_WEIGHT[state.position] ?? 0.3;
  const skillFactor = Math.max(0, state.overall - 40) / 60;
  const expected = weight * (1 + skillFactor) * 6;
  return Math.max(0, Math.round(expected + randomInt(rng, -2, 2)));
}

const INJURY_PENALTY: Record<'leve' | 'grave', number> = { leve: -4, grave: -10 };
const INJURY_MATCHES_LOST: Record<'leve' | 'grave', number> = { leve: 4, grave: 10 };
const INJURY_BASE_CHANCE = 0.1;
const INJURY_AGE_STEP = 0.006;

/** Probabilidad y severidad de una lesión: crece con la edad. El resultado afecta la próxima temporada. */
function rollInjury(state: CareerState, rng: Rng): 'leve' | 'grave' | null {
  const chance = INJURY_BASE_CHANCE + Math.max(0, state.age - 25) * INJURY_AGE_STEP;
  if (rng.next() >= chance) return null;
  return rng.next() < 0.7 ? 'leve' : 'grave';
}

const SELECTION_OVERALL_FLOOR = 78;
const SELECTION_BASE_CHANCE = 0.12;

/** Convocatoria a la selección: sólo alcanzable con media alta, más probable cuanto mejor sea el jugador. */
function rollSelection(state: CareerState, rng: Rng): boolean {
  if (state.overall < SELECTION_OVERALL_FLOOR) return false;
  const chance = SELECTION_BASE_CHANCE + (state.overall - SELECTION_OVERALL_FLOOR) * 0.01;
  return rng.next() < chance;
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
  const carriedInjuryPenalty = state.injurySeverity ? INJURY_PENALTY[state.injurySeverity] : 0;
  const rating = clamp(ratingFor(state, rng) + carriedInjuryPenalty, 1, 99);
  const growth = state.age < DECLINE_AGE ? (rating - 60) / 12 : 0;
  const overall = clamp(Math.round(state.overall + growth + ageDelta(state.age)), 1, 100);

  const injury = rollInjury(state, rng);
  const selected = rollSelection(state, rng);
  const matchesPlayed = clamp(
    randomInt(rng, 14, 24) - (state.injurySeverity ? INJURY_MATCHES_LOST[state.injurySeverity] : 0),
    0,
    30,
  );
  const tries = triesFor(state, rng);

  let note = rating >= 75 ? 'Temporada consagratoria.' : rating >= 55 ? 'Temporada sólida.' : 'Temporada para el olvido.';
  if (injury) note += injury === 'grave' ? ' Una lesión grave te dejó afuera varias fechas.' : ' Una lesión leve te sacó algunos partidos.';
  if (selected) note += ' Llegó la convocatoria a la selección.';

  const record: SeasonRecord = {
    season: state.season,
    age: state.age,
    clubSlug: state.club.slug,
    clubName: state.club.name,
    level: state.club.level,
    rating,
    note,
    tries,
    matchesPlayed,
    injury,
    selected,
  };

  return {
    ...state,
    season: state.season + 1,
    age: state.age + 1,
    overall,
    peakOverall: Math.max(state.peakOverall, overall),
    support: clamp(state.support + Math.round((rating - 60) / 6), 0, 100),
    fame: clamp(state.fame + Math.round((rating - 65) / 8) + (selected ? 6 : 0), 0, 100),
    morale: clamp(state.morale + Math.round((rating - 60) / 8), 0, 100),
    injured: injury !== null,
    injurySeverity: injury,
    caps: state.caps + (selected ? 1 : 0),
    history: [...state.history, record],
  };
}
