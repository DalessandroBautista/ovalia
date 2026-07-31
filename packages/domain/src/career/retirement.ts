import type { Rng } from './rng.js';
import type { CareerState } from './types.js';
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
function scoreOf(state: CareerState): number {
  return Math.round(
    state.peakOverall * 3 +
    state.history.length * 12 +
    state.support * 2.5 +
    state.fame * 2,
  );
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

  return {
    tier,
    verdict,
    score: scoreOf(state),
    comparison: {
      figure: figure.name,
      reason: `Tu carrera se parece a la de ${figure.name}: ${figure.description}.`,
    },
    seasons: state.history.length,
    clubs,
    peakLevel: state.history.reduce((best, record) => Math.min(best, record.level), 99),
  };
}
