/** Parsea un ISO 8601 con offset explícito a un instante UTC. */
export function parseOffsetDateTime(iso: string): Date {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime: ${iso}`);
  }
  return date;
}

/**
 * Convierte una hora de pared local (sin offset) a UTC usando el offset fijo
 * de la competencia en minutos (p. ej. Argentina = -180).
 */
export function localWallClockToUtc(local: string, offsetMinutes: number): Date {
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error(`Invalid local datetime: ${local}`);
  const [, y, mo, d, h, mi, s] = match;
  const utcMs = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s ?? '0'),
  );
  return new Date(utcMs - offsetMinutes * 60_000);
}
