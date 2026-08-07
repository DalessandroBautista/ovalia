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
  countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
  kind: z.enum(['union', 'league', 'international', 'sevens']).optional(),
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

export const authRegisterSchema = z.object({
  email: z.string().trim().email().max(320),
  displayName: z.string().trim().min(2).max(80),
  password: z.string().min(8).max(200),
});

export const authLoginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200),
});

export const authTokenSchema = z.object({ token: z.string().min(20).max(256) });

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(320),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(20).max(256),
  password: z.string().min(8).max(200),
});

export const predictionBatchSchema = z.object({
  predictions: z.array(z.object({
    matchId: z.string().uuid(),
    homeScore: z.number().int().min(0).max(100),
    awayScore: z.number().int().min(0).max(100),
  })).min(1).max(100),
});

export const adminConflictResolutionSchema = z.object({
  status: z.enum(['resolved', 'dismissed']),
  resolution: z.unknown().optional(),
});

export const adminArticleStatusSchema = z.object({
  status: z.enum(['draft', 'review', 'published', 'archived']),
});

export const adminArticleContentSchema = z.object({
  title: z.string().trim().min(8).max(180),
  summary: z.string().trim().min(12).max(500),
  body: z.string().trim().min(20).max(50_000),
  coverImageUrl: z.string().trim().url().max(2_048).nullable().optional(),
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

// --- Lineups (Tramo C) ---

export const lineupEntryInputSchema = z.object({
  shirtNumber: z.number().int().min(1).max(99),
  name: z.string().min(1).max(120),
  isCaptain: z.boolean().default(false),
  playerId: z.string().uuid().nullable(),
});

export const adminLineupSchema = z.object({
  side: z.enum(['home', 'away']),
  entries: z.array(lineupEntryInputSchema).min(1).max(30),
});

export type LineupEntryInput = z.infer<typeof lineupEntryInputSchema>;
export type AdminLineupInput = z.infer<typeof adminLineupSchema>;

// --- Simulador de carrera ---

function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

const apodoSchema = z
  .string()
  .trim()
  .min(1, 'apodo vacío')
  .max(24, 'apodo demasiado largo')
  .refine((value) => !hasControlCharacters(value), 'caracteres de control no permitidos')
  .refine((value) => !/(https?:\/\/|www\.)/i.test(value), 'enlaces no permitidos');

const careerSummarySchema = z.object({
  tier: z.string().min(1),
  verdict: z.string().min(1),
  score: z.number().int().nonnegative(),
  comparison: z.object({ figure: z.string().min(1), reason: z.string().min(1) }),
  seasons: z.number().int().nonnegative(),
  clubs: z.array(z.string()),
  peakLevel: z.number().int().positive(),
  totalTries: z.number().int().nonnegative(),
  totalMatches: z.number().int().nonnegative(),
  caps: z.number().int().nonnegative(),
});

const careerHistorySchema = z.array(
  z.object({
    season: z.number().int(),
    age: z.number().int(),
    clubSlug: z.string(),
    clubName: z.string(),
    level: z.number().int(),
    rating: z.number().int(),
    note: z.string(),
    tries: z.number().int().nonnegative(),
    matchesPlayed: z.number().int().nonnegative(),
    injury: z.enum(['leve', 'grave']).nullable(),
    selected: z.boolean(),
  }),
);

export const careerEntryInputSchema = z.object({
  displayName: apodoSchema,
  score: z.number().int().min(0).max(100_000),
  summary: careerSummarySchema,
  history: careerHistorySchema,
  surname: z.string().trim().min(1).max(40),
  position: z.enum(['pilar', 'hooker', 'segunda', 'ala', 'octavo', 'medio-scrum', 'apertura', 'centro', 'wing', 'fullback']),
  clubSlug: z.string().min(1).max(120),
  seed: z.number().int().min(0).max(4_294_967_295),
  decisions: z.array(z.number().int().nonnegative()).max(120),
  originKey: z.string().regex(/^[a-f0-9]{64}$/, 'originKey debe ser un hash sha256 hex'),
});
export type CareerEntryInput = z.infer<typeof careerEntryInputSchema>;

export const careerListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminIngestCsvSchema = z.object({
  competitionSlug: z.string().min(1),
  csvContent: z.string().min(1),
  dryRun: z.boolean().default(false),
});
export type AdminIngestCsvInput = z.infer<typeof adminIngestCsvSchema>;

