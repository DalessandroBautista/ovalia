import { calculateMatchPoints, type MatchStatus } from '@ovalia/domain';
import { normalizeName } from './text';

const VALID_STATUSES: ReadonlySet<MatchStatus> = new Set([
  'scheduled',
  'live',
  'halftime',
  'final',
  'postponed',
  'cancelled',
]);

export function mapMatchStatus(external: string): MatchStatus {
  const value = external.toLowerCase() as MatchStatus;
  if (VALID_STATUSES.has(value)) return value;
  throw new Error(`Unknown match status: ${external}`);
}

/**
 * Identidad natural de un partido: temporada + ronda + local + visitante.
 * Cambios de sede u horario mantienen la misma clave (mismo partido).
 */
export function naturalMatchKey(input: {
  seasonYear: number;
  round: string;
  homeKey: string;
  awayKey: string;
}): string {
  return [
    input.seasonYear,
    normalizeName(input.round),
    input.homeKey,
    input.awayKey,
  ].join('::');
}

/** Puntos de tabla (incluye bonus) reutilizando la regla del dominio. */
export function matchTablePoints(summary: {
  homeScore: number;
  awayScore: number;
  homeTries: number;
  awayTries: number;
}): { home: number; away: number } {
  return calculateMatchPoints(summary);
}
