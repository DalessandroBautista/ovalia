import { z } from 'zod';

export const matchStatusSchema = z.enum([
  'scheduled',
  'live',
  'halftime',
  'final',
  'postponed',
  'cancelled',
]);

/** Query de listado de partidos por rango. */
export const matchesQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  competition: z.string().min(1).optional(),
  status: matchStatusSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});
export type MatchesQuery = z.infer<typeof matchesQuerySchema>;

export const standingsQuerySchema = z.object({
  season: z.coerce.number().int().optional(),
});

export const organizationsQuerySchema = z.object({
  countryCode: z.string().regex(/^[A-Z]{2}$/).default('AR'),
  kind: z.enum(['union', 'league', 'international', 'sevens']).default('union'),
});

/** Evento de analytics anónimo (sin PII). */
export const analyticsEventSchema = z.object({
  name: z.string().min(1).max(64),
  path: z.string().max(256).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const feedbackSchema = z.object({
  message: z.string().min(1).max(2000),
  path: z.string().max(256).optional(),
  contact: z.string().max(200).optional(),
});

export const adminConflictResolutionSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
  resolution: z.unknown().optional(),
});

export const competitionMatchesQuerySchema = z.object({
  season: z.coerce.number().int().optional(),
  round: z.string().min(1).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

/** Cursor opaco = base64("<iso>|<uuid>"). */
export function encodeCursor(cursor: { startsAt: Date; id: string } | null): string | null {
  if (!cursor) return null;
  return Buffer.from(`${cursor.startsAt.toISOString()}|${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined): { startsAt: Date; id: string } | undefined {
  if (!raw) return undefined;
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const [iso, id] = decoded.split('|');
  if (!iso || !id) return undefined;
  const startsAt = new Date(iso);
  if (Number.isNaN(startsAt.getTime())) return undefined;
  return { startsAt, id };
}

/** Frescura a partir de la última obtención. */
export function freshness(fetchedAt: Date | null | undefined, now: Date = new Date()): 'fresh' | 'stale' | 'unknown' {
  if (!fetchedAt) return 'unknown';
  const ageMs = now.getTime() - fetchedAt.getTime();
  return ageMs <= 24 * 60 * 60 * 1000 ? 'fresh' : 'stale';
}
