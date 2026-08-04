import type { Rng } from './rng.js';
import type { CareerState, CareerPosition } from './types.js';
import { figureForShape, type CareerShape } from './figures.js';

const HARD_RETIREMENT_AGE = 41;

export interface CareerComparison {
  figure: string;
  reason: string;
}

export interface CareerSummary {
  tier: string;
  verdict: string;
  score: number;
  comparison: CareerComparison;
  seasons: number;
  clubs: string[];
  peakLevel: number;
  totalTries: number;
  totalMatches: number;
  caps: number;
}

export function shouldRetire(state: CareerState, rng: Rng): boolean {
  if (state.age >= HARD_RETIREMENT_AGE) return true;
  if (state.age >= 33 && state.overall < 35) return true;
  if (state.age >= 36) return rng.next() < 0.5;
  return false;
}

function shapeOf(state: CareerState): CareerShape {
  const clubs = new Set(state.history.map((record) => record.clubSlug));
  if (clubs.size >= 3) return 'itinerante';
  if (clubs.size <= 1) return 'club-entero';
  const salioJoven = state.history.some((record) => record.age <= 23 && record.level === 1);
  return salioJoven ? 'salto-joven' : 'tardio';
}

/**
 * Pondera media máxima, temporadas, cariño de la hinchada y fama. El peso del
 * arraigo es deliberadamente alto: en el rugby amateur, una carrera entera en el
 * club es un final tan válido como emigrar.
 */
const POSITION_WEIGHT: Record<CareerPosition, number> = {
  pilar: 1.0,
  hooker: 1.02,
  'segunda': 1.02,
  ala: 1.01,
  octavo: 1.01,
  'medio-scrum': 1.03,
  apertura: 1.05,
  centro: 1.0,
  wing: 1.0,
  fullback: 1.0,
};

function scoreOf(state: CareerState): number {
  const seasons = state.history.length;
  const avgRating = seasons > 0 ? state.history.reduce((sum, record) => sum + record.rating, 0) / seasons : 0;
  const proBonus = state.everPro ? 200 : 0;
  const base = Math.round(
    state.peakOverall * 7 +
    avgRating * 6 +
    seasons * 20 +
    state.support * 3 +
    state.fame * 3 +
    proBonus,
  );
  const weight = POSITION_WEIGHT[state.position] ?? 1;
  return Math.round(base * weight);
}

function verdictOf(state: CareerState): { tier: string; verdict: string } {
  const clubs = new Set(state.history.map((record) => record.clubSlug));
  const unSoloClub = clubs.size <= 1;

  if (!state.everPro) {
    if (state.support >= 80 && unSoloClub) {
      return {
        tier: 'Ídolo eterno del club',
        verdict: 'Colgaste los botines donde empezaste. Nunca cruzaste el charco, y en tu club sos leyenda para siempre.',
      };
    }
    if (state.support >= 55) {
      return {
        tier: 'Gloria amateur',
        verdict: 'Una vida de rugby amateur, de tercer tiempo y camiseta sudada. Dejaste todo por los colores.',
      };
    }
    return {
      tier: 'Corazón rugbier',
      verdict: 'No llegaste a la cima ni fuiste ídolo, pero jugaste por amor a la camiseta. El rugby también es esto.',
    };
  }

  if (state.peakOverall >= 90) {
    return {
      tier: 'Leyenda',
      verdict: 'Llegaste tan alto como se puede llegar, y tu nombre quedó grabado en la historia grande.',
    };
  }
  return {
    tier: 'Profesional',
    verdict: 'Viviste del rugby, conociste otras canchas y volviste con historias para contar.',
  };
}

export function summarizeCareer(state: CareerState): CareerSummary {
  const { tier, verdict } = verdictOf(state);
  const figure = figureForShape(shapeOf(state));
  const clubs = [...new Set(state.history.map((record) => record.clubName))];
  const narrativeVerdict = state.caps > 0
    ? `${verdict} Fuiste convocado a la selección en ${state.caps} ${state.caps === 1 ? 'oportunidad' : 'oportunidades'}.`
    : verdict;

  return {
    tier,
    verdict: narrativeVerdict,
    score: scoreOf(state),
    comparison: {
      figure: figure.name,
      reason: `Tu carrera se parece a la de ${figure.name}: ${figure.description}.`,
    },
    seasons: state.history.length,
    clubs,
    peakLevel: state.history.reduce((best, record) => Math.min(best, record.level), 99),
    totalTries: state.history.reduce((sum, record) => sum + record.tries, 0),
    totalMatches: state.history.reduce((sum, record) => sum + record.matchesPlayed, 0),
    caps: state.caps,
  };
}
