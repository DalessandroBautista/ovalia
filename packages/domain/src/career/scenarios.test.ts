import { describe, expect, it } from 'vitest';
import { createSeededRng } from './rng';
import { createCareer } from './create';
import { applyOption, effectTone, pickScenario } from './scenarios';
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
  ],
};

const multiCatalog: CareerCatalog = {
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
      slug: 'medio',
      name: 'Medio',
      level: 2,
      badgeUrl: null,
      unionSlug: 'urba',
      unionName: 'Unión de Rugby de Buenos Aires',
      divisionSlug: 'urba-primera-a',
      divisionName: 'Primera A',
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

function baseState(overrides: Partial<CareerState> = {}): CareerState {
  const state = createCareer(
    { surname: 'Pérez', position: 'ala', clubSlug: 'bajo', catalog },
    createSeededRng(1),
  );
  return { ...state, ...overrides };
}

function baseStateMulti(overrides: Partial<CareerState> = {}): CareerState {
  const state = createCareer(
    { surname: 'Pérez', position: 'ala', clubSlug: 'bajo', catalog: multiCatalog },
    createSeededRng(1),
  );
  return { ...state, ...overrides };
}

describe('pickScenario', () => {
  it('siempre devuelve un escenario con al menos dos opciones', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const prompt = pickScenario(baseState(), createSeededRng(seed), catalog);
      expect(prompt).not.toBeNull();
      expect(prompt!.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('es determinística con la misma semilla', () => {
    const state = baseState();
    expect(pickScenario(state, createSeededRng(9), catalog)).toEqual(
      pickScenario(state, createSeededRng(9), catalog),
    );
  });

  it('no ofrece escenarios juveniles a un veterano', () => {
    const claves = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const prompt = pickScenario(baseState({ age: 36 }), createSeededRng(seed), catalog);
      if (prompt) claves.add(prompt.key);
    }
    expect(claves.has('vida-amateur')).toBe(false);
  });

  it('ofrece la tensión amateur a un jugador joven que no es profesional', () => {
    const claves = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const prompt = pickScenario(baseState({ age: 21, pro: false }), createSeededRng(seed), catalog);
      if (prompt) claves.add(prompt.key);
    }
    expect(claves.has('vida-amateur')).toBe(true);
  });
});

describe('applyOption', () => {
  it('aplica los deltas sin mutar el estado recibido', () => {
    const before = baseState({ morale: 50, support: 50 });
    const copy = structuredClone(before);
    const after = applyOption(
      before,
      {
        label: 'Meterle a full',
        description: 'Entrenás como animal.',
        risk: 'riesgo',
        effect: { overall: 2, morale: 3, note: 'Dejaste todo.' },
      },
      catalog,
    );
    expect(before).toEqual(copy);
    expect(after.overall).toBe(before.overall + 2);
    expect(after.morale).toBe(53);
  });

  it('acota los valores entre 0 y 100', () => {
    const after = applyOption(
      baseState({ morale: 99, support: 1 }),
      { label: 'x', description: 'y', risk: 'seguro', effect: { morale: 50, support: -50, note: 'z' } },
      catalog,
    );
    expect(after.morale).toBe(100);
    expect(after.support).toBe(0);
  });

  it('marca como profesional cuando el efecto lo indica', () => {
    const after = applyOption(
      baseState(),
      { label: 'Firmar', description: 'Te ofrecen contrato.', risk: 'seguro', effect: { pro: true, note: 'Firmaste tu primer contrato.' } },
      catalog,
    );
    expect(after.pro).toBe(true);
    expect(after.everPro).toBe(true);
  });

  it('mueve de club cuando el efecto lo pide', () => {
    const before = baseStateMulti();
    const after = applyOption(
      before,
      { label: 'Subir', description: 'x', risk: 'riesgo', effect: { club: 'up', note: 'Subiste.' } },
      multiCatalog,
    );
    expect(after.club.slug).not.toBe(before.club.slug);
    expect(after.club.level).toBeLessThan(before.club.level);
  });
});

describe('effectTone', () => {
  it('marca positivo un efecto con ganancias netas', () => {
    expect(effectTone({ overall: 2, morale: 4, note: 'x' })).toBe('positivo');
  });

  it('marca negativo un efecto con pérdidas netas', () => {
    expect(effectTone({ overall: -2, support: -10, note: 'x' })).toBe('negativo');
  });

  it('marca neutro un efecto sin impacto relevante', () => {
    expect(effectTone({ note: 'x' })).toBe('neutro');
  });

  it('considera pasar a profesional como un efecto positivo', () => {
    expect(effectTone({ pro: true, note: 'x' })).toBe('positivo');
  });
});

describe('oferta-de-arriba', () => {
  it('aceptar la oferta cambia de club a uno de división superior', () => {
    const state = baseStateMulti({ overall: 80, club: multiCatalog.clubs[0]! });
    let prompt = null;
    let usedSeed = -1;
    for (let seed = 0; seed < 200 && !prompt; seed += 1) {
      const candidate = pickScenario(state, createSeededRng(seed), multiCatalog);
      if (candidate?.key === 'oferta-de-arriba') {
        prompt = candidate;
        usedSeed = seed;
      }
    }
    expect(prompt).not.toBeNull();
    expect(usedSeed).toBeGreaterThanOrEqual(0);
    const accept = prompt!.options.find((option) => option.effect.club === 'up');
    expect(accept).toBeDefined();
    const after = applyOption(state, accept!, multiCatalog);
    expect(after.club.slug).not.toBe(state.club.slug);
    expect(after.club.level).toBeLessThan(state.club.level);
  });
});

describe('salto profesional', () => {
  it('existe una combinación alcanzable de decisiones que produce un final profesional', () => {
    let foundPro = false;
    for (let seed = 0; seed < 400 && !foundPro; seed += 1) {
      const state = replayCareer({
        surname: 'Pérez',
        position: 'apertura',
        clubSlug: 'alto',
        catalog: multiCatalog,
        seed,
        decisions: new Array(60).fill(0),
      });
      if (state.everPro) foundPro = true;
    }
    expect(foundPro).toBe(true);
  });
});

describe('forma de la carrera', () => {
  it('a lo largo de muchas carreras aparece más de una forma de trayectoria', () => {
    const tiers = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      const state = replayCareer({
        surname: 'Pérez',
        position: 'centro',
        clubSlug: 'bajo',
        catalog: multiCatalog,
        seed,
        decisions: new Array(40).fill(seed % 3),
      });
      tiers.add(new Set(state.history.map((r) => r.clubSlug)).size > 1 ? 'multi-club' : 'un-club');
    }
    expect(tiers.size).toBeGreaterThan(1);
  });
});
