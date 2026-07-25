import { z } from 'zod';

/** Capacidades que un adaptador de fuente puede ofrecer. */
export const capabilitySchema = z.enum([
  'catalog',
  'fixtures',
  'results',
  'standings',
  'news',
  'live',
]);
export type Capability = z.infer<typeof capabilitySchema>;

export const sourceDescriptorSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  priority: z.number().int(),
  capabilities: z.array(capabilitySchema).min(1),
});
export type SourceDescriptor = z.infer<typeof sourceDescriptorSchema>;
