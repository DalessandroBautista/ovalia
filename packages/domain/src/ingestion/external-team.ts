import { z } from 'zod';

export const externalTeamSchema = z.object({
  /** ID estable del equipo en la fuente. */
  externalId: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().optional(),
  countryCode: z.string().length(2).optional(),
  union: z.string().optional(),
  badgeUrl: z.string().url().optional(),
  /** URL de origen del escudo, para atribución. */
  badgeSourceUrl: z.string().url().optional(),
  /** Extensión del archivo del escudo (ej. "png", "svg"). */
  badgeFormat: z.string().optional(),
});
export type ExternalTeam = z.infer<typeof externalTeamSchema>;
