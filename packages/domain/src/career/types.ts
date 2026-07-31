export type CareerPosition =
  | 'pilar' | 'hooker' | 'segunda' | 'ala' | 'octavo'
  | 'medio-scrum' | 'apertura' | 'centro' | 'wing' | 'fullback';

export interface CareerAttributes {
  power: number;
  speed: number;
  vision: number;
  discipline: number;
}

export interface CareerClub {
  slug: string;
  name: string;
  /** Nivel de división: 1 es el más alto. */
  level: number;
  badgeUrl: string | null;
}

export interface CareerCatalog {
  clubs: CareerClub[];
}

export interface SeasonRecord {
  season: number;
  age: number;
  clubSlug: string;
  clubName: string;
  level: number;
  rating: number;
  note: string;
}

export interface CareerState {
  surname: string;
  position: CareerPosition;
  attributes: CareerAttributes;
  age: number;
  season: number;
  club: CareerClub;
  /** Media general del jugador, de 1 a 100. */
  overall: number;
  morale: number;
  /** Cariño de la hinchada del club actual. */
  support: number;
  fame: number;
  pro: boolean;
  everPro: boolean;
  injured: boolean;
  retired: boolean;
  peakOverall: number;
  history: SeasonRecord[];
}
