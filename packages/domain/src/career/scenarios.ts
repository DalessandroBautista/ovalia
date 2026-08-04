import { pickWeighted, type Rng } from './rng.js';
import type { CareerCatalog, CareerClub, CareerState } from './types.js';

export interface ScenarioEffect {
  overall?: number;
  morale?: number;
  support?: number;
  fame?: number;
  pro?: boolean;
  /** Cambia de club: a una división superior, a una inferior, o de vuelta al club de origen. */
  club?: 'up' | 'down' | 'origin';
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
  isEligible: (state: CareerState, catalog: CareerCatalog) => boolean;
  build: (state: CareerState, catalog: CareerCatalog) => ScenarioPrompt;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Club de división superior (menor `level`) más cercano al actual, si hay alguno en el catálogo. */
function clubOneUp(catalog: CareerCatalog, current: CareerClub): CareerClub | null {
  const better = catalog.clubs
    .filter((club) => club.slug !== current.slug && club.level < current.level)
    .sort((a, b) => b.level - a.level);
  return better[0] ?? null;
}

/** Club de división inferior (mayor `level`) más cercano al actual, si hay alguno en el catálogo. */
function clubOneDown(catalog: CareerCatalog, current: CareerClub): CareerClub | null {
  const worse = catalog.clubs
    .filter((club) => club.slug !== current.slug && club.level > current.level)
    .sort((a, b) => a.level - b.level);
  return worse[0] ?? null;
}

function originClub(catalog: CareerCatalog, state: CareerState): CareerClub | null {
  if (state.club.slug === state.originClubSlug) return null;
  return catalog.clubs.find((club) => club.slug === state.originClubSlug) ?? null;
}

function resolveClubForEffect(
  state: CareerState,
  direction: ScenarioEffect['club'],
  catalog: CareerCatalog,
): CareerClub {
  if (!direction) return state.club;
  if (direction === 'up') return clubOneUp(catalog, state.club) ?? state.club;
  if (direction === 'down') return clubOneDown(catalog, state.club) ?? state.club;
  return originClub(catalog, state) ?? state.club;
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
    isEligible: (state, catalog) => state.overall >= 70 && clubOneUp(catalog, state.club) !== null,
    build: (state, catalog) => {
      const target = clubOneUp(catalog, state.club);
      return {
        key: 'oferta-de-arriba',
        title: 'Te llaman de arriba',
        subtitle: `${target ? target.name : 'Un club de una división superior'} pregunta por vos. En ${state.club.name} te quieren.`,
        options: [
          {
            label: 'Aceptar el desafío',
            description: 'Más nivel, más exigencia, menos minutos asegurados.',
            risk: 'riesgo',
            effect: {
              overall: 1,
              fame: 8,
              support: -10,
              club: 'up',
              note: `Diste el salto a ${target ? target.name : 'una división superior'}.`,
            },
          },
          {
            label: 'Quedarte donde sos ídolo',
            description: 'Acá sos referente. Afuera, uno más.',
            risk: 'seguro',
            effect: { support: 12, morale: 4, note: 'Elegiste la camiseta de siempre.' },
          },
        ],
      };
    },
  },
  {
    key: 'bajan-de-categoria',
    weight: 1.3,
    isEligible: (state, catalog) =>
      (state.age >= 30 || state.overall < 55) && clubOneDown(catalog, state.club) !== null,
    build: (state, catalog) => {
      const target = clubOneDown(catalog, state.club);
      return {
        key: 'bajan-de-categoria',
        title: 'Se complica en la cancha',
        subtitle: `${state.club.name} no te asegura el lugar. Un club de una división más abajo te abre la puerta.`,
        options: [
          {
            label: 'Bajar y sumar minutos',
            description: 'Menos nivel, pero volvés a ser protagonista.',
            risk: 'seguro',
            effect: {
              support: 6,
              morale: 3,
              club: 'down',
              note: `Bajaste a ${target ? target.name : 'una división inferior'} para volver a jugar.`,
            },
          },
          {
            label: 'Pelear por quedarte',
            description: 'Te la jugás por el lugar, aunque te cueste minutos.',
            risk: 'riesgo',
            effect: { morale: -3, support: -2, note: 'Elegiste pelear el puesto donde estabas.' },
          },
        ],
      };
    },
  },
  {
    key: 'vuelta-al-origen',
    weight: 1.2,
    isEligible: (state, catalog) => state.age >= 24 && originClub(catalog, state) !== null,
    build: (state, catalog) => {
      const home = originClub(catalog, state);
      return {
        key: 'vuelta-al-origen',
        title: 'Las raíces llaman',
        subtitle: `${home ? home.name : 'Tu club de origen'} te ofrece volver a jugar donde arrancaste.`,
        options: [
          {
            label: 'Volver a las raíces',
            description: 'Cerrás el círculo donde empezó todo.',
            risk: 'seguro',
            effect: { support: 15, fame: -4, club: 'origin', note: 'Volviste al club donde arrancaste.' },
          },
          {
            label: 'Seguir tu camino afuera',
            description: 'Todavía te queda algo por hacer lejos de casa.',
            risk: 'riesgo',
            effect: { fame: 3, note: 'Decidiste seguir afuera un poco más.' },
          },
        ],
      };
    },
  },
  {
    key: 'el-gran-salto',
    weight: 1.1,
    isEligible: (state) => !state.pro && state.overall >= 68 && state.age <= 29,
    build: (state) => ({
      key: 'el-gran-salto',
      title: 'El gran salto',
      subtitle: 'Un representante te ofrece firmar profesional. Es dejar el club, el trabajo y la rutina de siempre.',
      options: [
        {
          label: 'Firmar profesional',
          description: 'Dejás el amateurismo atrás para vivir del rugby.',
          risk: 'riesgo',
          effect: {
            pro: true,
            fame: 15,
            support: -15,
            morale: -3,
            note: `Firmaste tu primer contrato profesional. ${state.club.name} quedó atrás.`,
          },
        },
        {
          label: 'Quedarte con lo tuyo',
          description: 'El club, la familia, el trabajo. Rechazás la oferta.',
          risk: 'seguro',
          effect: { support: 8, morale: 3, note: 'Le dijiste que no al profesionalismo.' },
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

/**
 * Sentido general del efecto de una opción, para que la interfaz lo comunique
 * visualmente antes de avanzar (color, ícono) sin duplicar la lógica de puntaje.
 */
export function effectTone(effect: ScenarioEffect): 'positivo' | 'negativo' | 'neutro' {
  const score =
    (effect.overall ?? 0) +
    (effect.morale ?? 0) * 0.5 +
    (effect.support ?? 0) * 0.3 +
    (effect.fame ?? 0) * 0.3 +
    (effect.pro ? 5 : 0);
  if (score > 0.5) return 'positivo';
  if (score < -0.5) return 'negativo';
  return 'neutro';
}

export function pickScenario(state: CareerState, rng: Rng, catalog: CareerCatalog): ScenarioPrompt | null {
  const eligible = POOL.filter((definition) => definition.isEligible(state, catalog));
  const chosen = pickWeighted(
    rng,
    eligible.map((definition) => ({ weight: definition.weight, value: definition })),
  );
  return chosen ? chosen.build(state, catalog) : null;
}

export function applyOption(state: CareerState, option: ScenarioOption, catalog: CareerCatalog): CareerState {
  const { effect } = option;
  const pro = effect.pro ?? state.pro;
  const club = resolveClubForEffect(state, effect.club, catalog);
  const changedClub = club.slug !== state.club.slug;
  return {
    ...state,
    club,
    overall: clamp(state.overall + (effect.overall ?? 0), 1, 100),
    morale: clamp(state.morale + (effect.morale ?? 0), 0, 100),
    // Al cambiar de club el cariño de la hinchada nueva parte de menos: aún no
    // te conocen, más allá de lo que sume o reste el propio efecto.
    support: clamp(state.support + (effect.support ?? 0) - (changedClub ? 15 : 0), 0, 100),
    fame: clamp(state.fame + (effect.fame ?? 0), 0, 100),
    pro,
    everPro: state.everPro || pro,
  };
}
