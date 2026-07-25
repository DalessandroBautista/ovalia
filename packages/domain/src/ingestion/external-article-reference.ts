import { z } from 'zod';

/** Referencia a una noticia oficial: nunca redistribuye el texto completo. */
export const externalArticleReferenceSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  publishedAt: z.string().datetime({ offset: true }).optional(),
  summary: z.string().optional(),
});
export type ExternalArticleReference = z.infer<typeof externalArticleReferenceSchema>;
