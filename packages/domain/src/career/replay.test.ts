import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';
import { createCareer } from './create';
import { simulateSeason } from './season';
import { pickScenario, applyOption } from './scenarios';
import { shouldRetire } from './retirement';
import { replayCareer } from './replay';
import type { CareerCatalog, CareerState } from './types';

const catalog: CareerCatalog = {
  clubs: [
    {
      slug: 'bajo',
      name: 'Bajo',
      level: 4,
      badgeUrl: null,
      unionSlug: 'urba',
      unionName: 'Unión de Rugby de Buenos Aires',
      divisionSlug: 'urba-primera-c',
      divisionName: 'Primera C',
    },
    {
      slug: 'alto',
      name: 'Alto',
      level: 1,
      badgeUrl: null,
      unionSlug: 'urba',
      unionName: 'Unión de Rugby de Buenos Aires',
      divisionSlug: 'urba-top-14',
      divisionName: 'Top 14',
    },
  ],
};

/** El mismo bucle que la UI ejecutará, sincrónico y con decisiones prefijadas. */
function interactiva(input: { surname: string; position: 'centro'; clubSlug: string; catalog: CareerCatalog; seed: number; decisions: number[] }): CareerState {
  const rng = createSeededRng(input.seed);
  let state = createCareer({ surname: input.surname, position: input.position, clubSlug: input.clubSlug, catalog: input.catalog }, rng);
  for (const decision of input.decisions) {
    if (shouldRetire(state, rng)) break;
    const prompt = pickScenario(state, rng, input.catalog);
    if (!prompt) { state = simulateSeason(state, rng); continue; }
    state = applyOption(state, prompt.options[Math.min(decision, prompt.options.length - 1)]!, input.catalog);
    state = simulateSeason(state, rng);
  }
  return state;
}

describe('replayCareer', () => {
  const base = { surname: 'Pérez', position: 'centro' as const, clubSlug: 'bajo', catalog };

  it('reproduce exactamente la carrera interactiva con las mismas decisiones', () => {
    const decisions = [0, 1, 0, 1, 1, 0, 0, 1];
    const esperado = interactiva({ ...base, seed: 42, decisions });
    const actual = replayCareer({ ...base, seed: 42, decisions });
    expect(actual).toEqual(esperado);
  });

  it('es determinística: mismo input, mismo estado', () => {
    const a = replayCareer({ ...base, seed: 7, decisions: [0, 1, 0] });
    const b = replayCareer({ ...base, seed: 7, decisions: [0, 1, 0] });
    expect(a).toEqual(b);
  });

  it('una carrera completa siempre termina: decisiones acotadas, sin bucle infinito', () => {
    const decisions = new Array(60).fill(0);
    const state = replayCareer({ ...base, seed: 99, decisions });
    expect(state.history.length).toBeGreaterThan(0);
    expect(state.retired || state.age > 35).toBe(true);
  });

  it('reproduce también el retiro: terminar antes de agotar las decisiones', () => {
    const state = replayCareer({ ...base, seed: 5, decisions: new Array(80).fill(1) });
    expect(state.history.length).toBeLessThan(80);
  });
});
