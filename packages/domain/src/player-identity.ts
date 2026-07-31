/**
 * Normaliza un nombre de jugador para deduplicación.
 *
 * Reglas:
 * 1. Quita diacríticos (NFD + eliminar combinantes).
 * 2. Pasa a minúsculas.
 * 3. Descarta caracteres no alfanuméricos.
 * 4. Separa en tokens, ordena alfabéticamente, une con espacio.
 *
 * Así «Juan Cruz Pérez», «Pérez, Juan Cruz» y «juan cruz perez»
 * producen la misma clave: 'cruz juan perez'.
 */
export function normalizePlayerName(raw: string): string {
  if (!raw) return '';

  // Quitar diacríticos: descomponer en NFD y eliminar los combinantes (U+0300-U+036f).
  const withoutDiacritics = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Pasar a minúsculas.
  const lowered = withoutDiacritics.toLowerCase();

  // Reemplazar comas y guiones por espacios (separadores comunes).
  const withSpaces = lowered.replace(/[,]/g, ' ').replace(/[-]/g, ' ');

  // Descartar caracteres no alfanuméricos ni espacios.
  const cleaned = withSpaces.replace(/[^a-z0-9\s]/g, '');

  // Separar en tokens, filtrar vacíos, ordenar, unir.
  const tokens = cleaned
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .sort();

  return tokens.join(' ');
}
