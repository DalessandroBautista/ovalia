/**
 * Clasificador puro de categoría de competencia a partir de su nombre.
 *
 * Existe porque una formación (lineup) es una lista de nombres de personas
 * identificables, y AGENTS.md prohíbe cargar datos de menores. La única señal
 * disponible hoy para distinguir competencias juveniles de adultas es el
 * nombre tal como lo entrega la fuente (ej. "Menores de 15 - Primera Rueda -
 * G1 A", "M17 Torneo Apertura"), así que este módulo centraliza esa regla en
 * un único lugar puro, testeable y reutilizable desde la ingesta, el seed y
 * (indirectamente, vía la columna `tier`) desde la ruta admin de lineups.
 */

export type CompetitionTier = 'youth' | 'senior';

// "menores" alcanza por sí solo: en el rugby argentino nunca aparece en
// nombres de competencias de adultos (a diferencia de números sueltos como
// "15", que sí aparecen en "TOP 14" o "Primera 15").
const YOUTH_KEYWORD = /\bmenores\b/;

// Formas abreviadas habituales: M15, M16, M17, M18, M19, M20. El límite de
// palabra (\b) evita que "TOP 14" o "Primera 15" —que no llevan una "m"
// pegada al número— se confundan con una abreviatura juvenil.
const YOUTH_ABBREVIATION = /\bm(1[5-9]|20)\b/;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function classifyCompetitionTier(competitionName: string): CompetitionTier {
  const normalized = normalize(competitionName);
  if (YOUTH_KEYWORD.test(normalized) || YOUTH_ABBREVIATION.test(normalized)) {
    return 'youth';
  }
  return 'senior';
}
