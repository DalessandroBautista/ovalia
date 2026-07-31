import { pickWeighted, type Rng } from './rng.js';
import type { CareerState } from './types.js';

export interface ScenarioEffect {
  overall?: number;
  morale?: number;
  support?: number;
  fame?: number;
  pro?: boolean;
  note: string;
}

export interface ScenarioOption {
  label: string;
  description: string;
  risk: 'riesgo' | 'seguro';
  effect: ScenarioEffect;
}

export interface ScenarioPrompt {
  key: string;
  title: string;
  subtitle: string;
  options: ScenarioOption[];
}

interface ScenarioDefinition {
  key: string;
  weight: number;
  isEligible: (state: CareerState) => boolean;
  build: (state: CareerState) => ScenarioPrompt;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const POOL: ScenarioDefinition[] = [
  {
    key: 'otra-temporada',
    weight: 1,
    isEligible: () => true,
    build: (state) => ({
      key: 'otra-temporada',
      title: `Otra temporada en ${state.club.name}`,
      subtitle: '¿Cómo encarás el año?',
      options: [
        {
          label: 'Meterle a full',
          description: 'Entrenás como animal. Más progreso, más desgaste.',
          risk: 'riesgo',
          effect: { overall: 2, morale: -2, note: 'Dejaste todo en cada entrenamiento.' },
        },
        {
          label: 'Disfrutar el año',
          description: 'Rugby, amigos y tercer tiempo. Sin apuros.',
          risk: 'seguro',
          effect: { overall: 0, morale: 4, support: 3, note: 'Un año a puro disfrute con los muchachos.' },
        },
      ],
    }),
  },
  {
    key: 'vida-amateur',
    weight: 2,
    isEligible: (state) => !state.pro && state.age < 28,
    build: () => ({
      key: 'vida-amateur',
      title: 'La vida amateur aprieta',
      subtitle: 'El rugby no paga las cuentas y la semana se hace cuesta arriba. ¿Qué priorizás?',
      options: [
        {
          label: 'Priorizar el rugby',
          description: 'Todo por el club, aunque el bolsillo llore.',
          risk: 'riesgo',
          effect: { overall: 2, morale: 3, note: 'Elegiste el rugby por encima de todo.' },
        },
        {
          label: 'Meterle a la facultad',
          description: 'Te recibís. El rugby espera, pero asegurás el futuro.',
          risk: 'seguro',
          effect: { overall: -1, fame: -2, morale: 2, note: 'Cerraste la carrera. La cabeza más tranquila.' },
        },
        {
          label: 'Agarrar un laburo',
          description: 'Trabajás toda la semana y llegás muerto al entrenamiento.',
          risk: 'riesgo',
          effect: { overall: -2, morale: -2, note: 'Entre el laburo y el rugby, casi no dormís.' },
        },
      ],
    }),
  },
  {
    key: 'cuerpo-pasa-factura',
    weight: 1.4,
    isEligible: (state) => state.age >= 29,
    build: () => ({
      key: 'cuerpo-pasa-factura',
      title: 'El cuerpo pasa factura',
      subtitle: 'Te levantás dolorido y la recuperación ya no es la de antes.',
      options: [
        {
          label: 'Aguantar y jugar igual',
          description: 'El equipo te necesita. El dolor se banca.',
          risk: 'riesgo',
          effect: { overall: -1, support: 6, morale: 2, note: 'Jugaste infiltrado más de una vez.' },
        },
        {
          label: 'Parar y recuperarte bien',
          description: 'Te perdés media temporada, pero volvés entero.',
          risk: 'seguro',
          effect: { overall: 1, support: -4, note: 'Elegiste cuidarte para durar.' },
        },
      ],
    }),
  },
  {
    key: 'oferta-de-arriba',
    weight: 1.6,
    isEligible: (state) => state.overall >= 70 && state.club.level > 1,
    build: (state) => ({
      key: 'oferta-de-arriba',
      title: 'Te llaman de arriba',
      subtitle: `Un club de una división superior pregunta por vos. En ${state.club.name} te quieren.`,
      options: [
        {
          label: 'Aceptar el desafío',
          description: 'Más nivel, más exigencia, menos minutos asegurados.',
          risk: 'riesgo',
          effect: { overall: 1, fame: 8, support: -10, note: 'Diste el salto a una división superior.' },
        },
        {
          label: 'Quedarte donde sos ídolo',
          description: 'Acá sos referente. Afuera, uno más.',
          risk: 'seguro',
          effect: { support: 12, morale: 4, note: 'Elegiste la camiseta de siempre.' },
        },
      ],
    }),
  },
  {
    key: 'tercer-tiempo',
    weight: 1.2,
    isEligible: (state) => state.age <= 32,
    build: () => ({
      key: 'tercer-tiempo',
      title: 'Después del partido',
      subtitle: 'Se ganó, hubo tercer tiempo y los muchachos quieren seguirla.',
      options: [
        {
          label: 'Seguirla con el plantel',
          description: 'El grupo se hace también acá.',
          risk: 'riesgo',
          effect: { overall: -1, morale: 5, support: 3, note: 'Noche larga con los muchachos.' },
        },
        {
          label: 'Cuidar el físico',
          description: 'Profesionalismo puro, aunque te carguen.',
          risk: 'seguro',
          effect: { overall: 1, morale: -2, note: 'Te volviste temprano. El cuerpo lo agradece.' },
        },
      ],
    }),
  },
];

export function pickScenario(state: CareerState, rng: Rng): ScenarioPrompt | null {
  const eligible = POOL.filter((definition) => definition.isEligible(state));
  const chosen = pickWeighted(
    rng,
    eligible.map((definition) => ({ weight: definition.weight, value: definition })),
  );
  return chosen ? chosen.build(state) : null;
}

export function applyOption(state: CareerState, option: ScenarioOption): CareerState {
  const { effect } = option;
  const pro = effect.pro ?? state.pro;
  return {
    ...state,
    overall: clamp(state.overall + (effect.overall ?? 0), 1, 100),
    morale: clamp(state.morale + (effect.morale ?? 0), 0, 100),
    support: clamp(state.support + (effect.support ?? 0), 0, 100),
    fame: clamp(state.fame + (effect.fame ?? 0), 0, 100),
    pro,
    everPro: state.everPro || pro,
  };
}
