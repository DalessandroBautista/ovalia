import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';
import { createCareer } from './create';
import { simulateSeason } from './season';
import type { CareerCatalog, CareerState } from './types';

const catalog: CareerCatalog = {
  clubs: [
    { slug: 'bajo', name: 'Bajo', level: 4, badgeUrl: null },
    { slug: 'alto', name: 'Alto', level: 1, badgeUrl: null },
  ],
};

function baseState(overrides: Partial<CareerState> = {}): CareerState {
  const state = createCareer(
    { surname: 'Pérez', position: 'centro', clubSlug: 'bajo', catalog },
    createSeededRng(1),
  );
  return { ...state, ...overrides };
}

describe('simulateSeason', () => {
  it('avanza una temporada y una edad, y suma un registro al historial', () => {
    const before = baseState();
    const after = simulateSeason(before, createSeededRng(10));
    expect(after.season).toBe(before.season + 1);
    expect(after.age).toBe(before.age + 1);
    expect(after.history).toHaveLength(1);
    expect(after.history[0]?.clubName).toBe(before.club.name);
  });

  it('no muta el estado recibido', () => {
    const before = baseState();
    const copy = structuredClone(before);
    simulateSeason(before, createSeededRng(10));
    expect(before).toEqual(copy);
  });

  it('es determinística con la misma semilla', () => {
    const before = baseState();
    const a = simulateSeason(before, createSeededRng(55));
    const b = simulateSeason(before, createSeededRng(55));
    expect(a).toEqual(b);
  });

  it('a lo largo de muchas temporadas, un jugador mejor rinde más que uno peor', () => {
    const bueno = baseState({ overall: 85 });
    const malo = baseState({ overall: 45 });
    const media = (state: CareerState) => {
      let acc = state;
      for (let i = 0; i < 10; i += 1) acc = simulateSeason(acc, createSeededRng(100 + i));
      return acc.history.reduce((sum, r) => sum + r.rating, 0) / acc.history.length;
    };
    expect(media(bueno)).toBeGreaterThan(media(malo));
  });

  it('registra la media máxima alcanzada', () => {
    let state = baseState({ overall: 60 });
    for (let i = 0; i < 8; i += 1) state = simulateSeason(state, createSeededRng(200 + i));
    expect(state.peakOverall).toBeGreaterThanOrEqual(60);
    expect(state.peakOverall).toBeGreaterThanOrEqual(state.overall);
  });

  it('hace caer la media de un veterano a lo largo de varias temporadas', () => {
    let state = baseState({ age: 34, overall: 80 });
    const inicial = state.overall;
    for (let i = 0; i < 5; i += 1) state = simulateSeason(state, createSeededRng(300 + i));
    expect(state.overall).toBeLessThan(inicial);
  });

  it('mantiene la media dentro de 1 y 100', () => {
    let state = baseState({ overall: 99 });
    for (let i = 0; i < 20; i += 1) state = simulateSeason(state, createSeededRng(400 + i));
    expect(state.overall).toBeLessThanOrEqual(100);
    expect(state.overall).toBeGreaterThanOrEqual(1);
  });
});
