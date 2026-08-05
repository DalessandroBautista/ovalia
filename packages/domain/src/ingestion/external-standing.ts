import { z } from 'zod';

export const externalStandingRowSchema = z.object({
  teamExternalId: z.string().min(1),
  teamName: z.string().optional(),
  position: z.number().int().positive().optional(),
  played: z.number().int().nonnegative(),
  won: z.number().int().nonnegative(),
  drawn: z.number().int().nonnegative(),
  lost: z.number().int().nonnegative(),
  pointsFor: z.number().int().nonnegative(),
  pointsAgainst: z.number().int().nonnegative(),
  bonus: z.number().int().nonnegative(),
  points: z.number().int(),
});
export type ExternalStandingRow = z.infer<typeof externalStandingRowSchema>;

export const externalStandingsSchema = z.object({
  competitionExternalId: z.string().min(1),
  seasonYear: z.number().int(),
  rows: z.array(externalStandingRowSchema),
});
export type ExternalStandings = z.infer<typeof externalStandingsSchema>;
