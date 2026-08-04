import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';
import { createCareer } from './create';
import { simulateSeason } from './season';
import { shouldRetire, summarizeCareer } from './retirement';
import type { CareerCatalog, CareerState } from './types';

const catalog: CareerCatalog = {
  clubs: [{ slug: 'bajo', name: 'Bajo', level: 4, badgeUrl: null }],
};

function baseState(overrides: Partial<CareerState> = {}): CareerState {
  const state = createCareer(
    { surname: 'Pérez', position: 'centro', clubSlug: 'bajo', catalog },
    createSeededRng(1),
  );
  return { ...state, ...overrides };
}

describe('shouldRetire', () => {
  it('no retira a un joven en buen nivel', () => {
    expect(shouldRetire(baseState({ age: 24, overall: 70 }), createSeededRng(1))).toBe(false);
  });

  it('retira siempre pasada la edad límite', () => {
    for (let seed = 0; seed < 30; seed += 1) {
      expect(shouldRetire(baseState({ age: 41, overall: 80 }), createSeededRng(seed))).toBe(true);
    }
  });

  it('retira a un veterano con la media por el piso', () => {
    expect(shouldRetire(baseState({ age: 35, overall: 20 }), createSeededRng(3))).toBe(true);
  });
});

describe('summarizeCareer', () => {
  it('una carrera completa siempre termina: no hay bucle infinito', () => {
    let state = baseState();
    let guard = 0;
    while (!shouldRetire(state, createSeededRng(guard)) && guard < 100) {
      state = simulateSeason(state, createSeededRng(guard));
      guard += 1;
    }
    expect(guard).toBeLessThan(100);
  });

  it('devuelve un puntaje positivo y un veredicto no vacío', () => {
    let state = baseState();
    for (let i = 0; i < 12; i += 1) state = simulateSeason(state, createSeededRng(i));
    const summary = summarizeCareer(state);
    expect(summary.score).toBeGreaterThan(0);
    expect(summary.verdict.length).toBeGreaterThan(0);
    expect(summary.tier.length).toBeGreaterThan(0);
    expect(summary.seasons).toBe(state.history.length);
  });

  it('premia una carrera larga de club tanto como una internacional breve', () => {
    let deClub = baseState({ support: 95, overall: 62 });
    for (let i = 0; i < 15; i += 1) deClub = simulateSeason(deClub, createSeededRng(i));

    let internacional = baseState({ fame: 90, overall: 88, everPro: true, pro: true });
    for (let i = 0; i < 4; i += 1) internacional = simulateSeason(internacional, createSeededRng(i));

    const a = summarizeCareer(deClub).score;
    const b = summarizeCareer(internacional).score;
    // Ninguna debe aplastar a la otra: son caminos distintos, no niveles.
    expect(Math.abs(a - b) / Math.max(a, b)).toBeLessThan(0.5);
  });

  it('produce puntajes con dispersión amplia entre carreras muy distintas', () => {
    let mediocre = baseState({ support: 10, fame: 0, overall: 30, morale: 30 });
    for (let i = 0; i < 3; i += 1) mediocre = simulateSeason(mediocre, createSeededRng(i + 90));

    let sobresaliente = baseState({ support: 95, fame: 90, overall: 95, morale: 90, everPro: true, pro: true });
    for (let i = 0; i < 20; i += 1) sobresaliente = simulateSeason(sobresaliente, createSeededRng(i));

    const low = summarizeCareer(mediocre).score;
    const high = summarizeCareer(sobresaliente).score;
    expect(high).toBeGreaterThan(low * 2);
  });

  it('asigna una comparación con una figura', () => {
    let state = baseState();
    for (let i = 0; i < 10; i += 1) state = simulateSeason(state, createSeededRng(i));
    const summary = summarizeCareer(state);
    expect(summary.comparison.figure.length).toBeGreaterThan(0);
    expect(summary.comparison.reason.length).toBeGreaterThan(0);
  });

  it('es determinística: el mismo estado produce el mismo resumen', () => {
    let state = baseState();
    for (let i = 0; i < 6; i += 1) state = simulateSeason(state, createSeededRng(i));
    expect(summarizeCareer(state)).toEqual(summarizeCareer(state));
  });
});
