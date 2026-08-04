import { randomInt, type Rng } from './rng.js';
import type { CareerCatalog, CareerClub, CareerPosition, CareerState } from './types.js';

const STARTING_AGE = 18;
const DEFAULT_SURNAME = 'Jugador';

/**
 * Catálogo mínimo para que el juego funcione si la interfaz no pudo traer los
 * clubes reales. No pretende ser fiel: existe para que el juego nunca se rompa.
 */
export const FALLBACK_CATALOG: CareerCatalog = {
  clubs: [
    {
      slug: 'club-del-barrio',
      name: 'Club del Barrio',
      level: 5,
      badgeUrl: null,
      unionSlug: 'urba',
      unionName: 'Unión de Rugby de Buenos Aires',
      divisionSlug: 'urba-tercera',
      divisionName: 'Tercera',
    },
    {
      slug: 'club-de-ascenso',
      name: 'Club de Ascenso',
      level: 3,
      badgeUrl: null,
      unionSlug: 'urba',
      unionName: 'Unión de Rugby de Buenos Aires',
      divisionSlug: 'urba-primera-b',
      divisionName: 'Primera B',
    },
    {
      slug: 'club-grande',
      name: 'Club Grande',
      level: 1,
      badgeUrl: null,
      unionSlug: 'urba',
      unionName: 'Unión de Rugby de Buenos Aires',
      divisionSlug: 'urba-top-14',
      divisionName: 'Top 14',
    },
  ],
};

export interface CreateCareerInput {
  surname: string;
  position: CareerPosition;
  clubSlug: string;
  catalog: CareerCatalog;
}

function resolveCatalog(catalog: CareerCatalog): CareerCatalog {
  return catalog.clubs.length > 0 ? catalog : FALLBACK_CATALOG;
}

function resolveClub(catalog: CareerCatalog, slug: string): CareerClub {
  const found = catalog.clubs.find((club) => club.slug === slug);
  if (found) return found;
  // Sin coincidencia, arranca en el club de división más baja disponible:
  // empezar desde abajo es la premisa del juego.
  return [...catalog.clubs].sort((a, b) => b.level - a.level)[0]!;
}

export function createCareer(input: CreateCareerInput, rng: Rng): CareerState {
  const catalog = resolveCatalog(input.catalog);
  const club = resolveClub(catalog, input.clubSlug);
  const surname = input.surname.trim() || DEFAULT_SURNAME;

  const attributes = {
    power: randomInt(rng, 3, 7),
    speed: randomInt(rng, 3, 7),
    vision: randomInt(rng, 3, 7),
    discipline: randomInt(rng, 3, 7),
  };
  const overall = 40 + attributes.power + attributes.speed + attributes.vision;

  return {
    surname,
    position: input.position,
    attributes,
    age: STARTING_AGE,
    season: 1,
    club,
    originClubSlug: club.slug,
    overall,
    morale: 60,
    support: 20,
    fame: 0,
    pro: false,
    everPro: false,
    injured: false,
    injurySeverity: null,
    caps: 0,
    retired: false,
    peakOverall: overall,
    history: [],
  };
}
