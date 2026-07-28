import { z } from 'zod';

export const externalCompetitionSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  /** Slug canónico legible provisto por el adaptador (si no, se deriva del nombre). */
  slug: z.string().min(1).optional(),
  category: z.string().min(1),
  gender: z.enum(['male', 'female', 'mixed']),
  countryCode: z.string().length(2).optional(),
  format: z.enum(['xv', 'sevens']).default('xv'),
  familySlug: z.string().optional(),
  tier: z.string().optional(),
  season: z.object({
    externalId: z.string().optional(),
    name: z.string().min(1),
    year: z.number().int(),
  }),
});
export type ExternalCompetition = z.infer<typeof externalCompetitionSchema>;
