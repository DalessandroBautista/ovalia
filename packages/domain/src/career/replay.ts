import { applyOption, pickScenario } from './scenarios.js';
import { createCareer } from './create.js';
import { shouldRetire } from './retirement.js';
import { createSeededRng } from './rng.js';
import { simulateSeason } from './season.js';
import type { CareerCatalog, CareerPosition, CareerState } from './types.js';

export interface CareerReplayInput {
  surname: string;
  position: CareerPosition;
  clubSlug: string;
  catalog: CareerCatalog;
  seed: number;
  /** Índices de opciones elegidas, en orden. El contrato está en el plan. */
  decisions: readonly number[];
}

/**
 * Reproduce una carrera completa a partir de la semilla y las decisiones.
 * Es el mismo bucle que la interfaz ejecuta interactivamente: misma semilla y
 * mismas decisiones producen exactamente la misma historia.
 */
export function replayCareer(input: CareerReplayInput): CareerState {
  const rng = createSeededRng(input.seed);
  let state = createCareer(
    { surname: input.surname, position: input.position, clubSlug: input.clubSlug, catalog: input.catalog },
    rng,
  );
  for (const decision of input.decisions) {
    if (shouldRetire(state, rng)) break;
    const prompt = pickScenario(state, rng);
    if (!prompt) {
      state = simulateSeason(state, rng);
      continue;
    }
    const option = prompt.options[Math.min(decision, prompt.options.length - 1)]!;
    state = applyOption(state, option);
    state = simulateSeason(state, rng);
  }
  return state;
}
