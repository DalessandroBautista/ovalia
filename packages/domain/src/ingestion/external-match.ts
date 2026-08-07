import { z } from 'zod';

export const externalMatchStatusSchema = z.enum([
  'scheduled',
  'live',
  'halftime',
  'final',
  'postponed',
  'cancelled',
]);
export type ExternalMatchStatus = z.infer<typeof externalMatchStatusSchema>;

export const externalMatchSchema = z.object({
  externalId: z.string().optional(),
  competitionExternalId: z.string().min(1),
  seasonYear: z.number().int(),
  round: z.string().min(1),
  /**
   * Fecha/hora en ISO 8601 con offset explícito de la competencia, o null cuando
   * la fuente no informa horario (p. ej. divisiones URBA donde cada club define
   * el kickoff, que llegan con playdate 00:00:00).
   */
  startsAt: z.string().datetime({ offset: true }).nullable(),
  homeTeamExternalId: z.string().min(1),
  awayTeamExternalId: z.string().min(1),
  venue: z.string().optional(),
  status: externalMatchStatusSchema.default('scheduled'),
  homeScore: z.number().int().nullable().optional(),
  awayScore: z.number().int().nullable().optional(),
  homeTries: z.number().int().nonnegative().optional(),
  awayTries: z.number().int().nonnegative().optional(),
});
export type ExternalMatch = z.infer<typeof externalMatchSchema>;
