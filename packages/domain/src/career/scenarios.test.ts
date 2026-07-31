import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';
import { createCareer } from './create';
import { applyOption, pickScenario } from './scenarios';
import type { CareerCatalog, CareerState } from './types';

const catalog: CareerCatalog = {
  clubs: [{ slug: 'bajo', name: 'Bajo', level: 4, badgeUrl: null }],
};

function baseState(overrides: Partial<CareerState> = {}): CareerState {
  const state = createCareer(
    { surname: 'Pérez', position: 'ala', clubSlug: 'bajo', catalog },
    createSeededRng(1),
  );
  return { ...state, ...overrides };
}

describe('pickScenario', () => {
  it('siempre devuelve un escenario con al menos dos opciones', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const prompt = pickScenario(baseState(), createSeededRng(seed));
      expect(prompt).not.toBeNull();
      expect(prompt!.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('es determinística con la misma semilla', () => {
    const state = baseState();
    expect(pickScenario(state, createSeededRng(9))).toEqual(pickScenario(state, createSeededRng(9)));
  });

  it('no ofrece escenarios juveniles a un veterano', () => {
    const claves = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const prompt = pickScenario(baseState({ age: 36 }), createSeededRng(seed));
      if (prompt) claves.add(prompt.key);
    }
    expect(claves.has('vida-amateur')).toBe(false);
  });

  it('ofrece la tensión amateur a un jugador joven que no es profesional', () => {
    const claves = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const prompt = pickScenario(baseState({ age: 21, pro: false }), createSeededRng(seed));
      if (prompt) claves.add(prompt.key);
    }
    expect(claves.has('vida-amateur')).toBe(true);
  });
});

describe('applyOption', () => {
  it('aplica los deltas sin mutar el estado recibido', () => {
    const before = baseState({ morale: 50, support: 50 });
    const copy = structuredClone(before);
    const after = applyOption(before, {
      label: 'Meterle a full',
      description: 'Entrenás como animal.',
      risk: 'riesgo',
      effect: { overall: 2, morale: 3, note: 'Dejaste todo.' },
    });
    expect(before).toEqual(copy);
    expect(after.overall).toBe(before.overall + 2);
    expect(after.morale).toBe(53);
  });

  it('acota los valores entre 0 y 100', () => {
    const after = applyOption(baseState({ morale: 99, support: 1 }), {
      label: 'x',
      description: 'y',
      risk: 'seguro',
      effect: { morale: 50, support: -50, note: 'z' },
    });
    expect(after.morale).toBe(100);
    expect(after.support).toBe(0);
  });

  it('marca como profesional cuando el efecto lo indica', () => {
    const after = applyOption(baseState(), {
      label: 'Firmar',
      description: 'Te ofrecen contrato.',
      risk: 'seguro',
      effect: { pro: true, note: 'Firmaste tu primer contrato.' },
    });
    expect(after.pro).toBe(true);
    expect(after.everPro).toBe(true);
  });
});
