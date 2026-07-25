import { z } from 'zod';

export const externalCompetitionSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  gender: z.enum(['male', 'female', 'mixed']),
  countryCode: z.string().length(2).optional(),
  format: z.enum(['xv', 'sevens']).default('xv'),
  season: z.object({
    externalId: z.string().optional(),
    name: z.string().min(1),
    year: z.number().int(),
  }),
});
export type ExternalCompetition = z.infer<typeof externalCompetitionSchema>;
