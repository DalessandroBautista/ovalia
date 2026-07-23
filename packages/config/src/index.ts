import { z } from 'zod';

const serverEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().default('postgres://ovalia:ovalia@localhost:54329/ovalia'),
  HIGHLIGHTLY_API_KEY: z.string().optional(),
  HIGHLIGHTLY_API_BASE_URL: z.string().url().default('https://rugby.highlightly.net'),
  OPENAI_API_KEY: z.string().optional()
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function readServerEnvironment(source: NodeJS.ProcessEnv = process.env): ServerEnvironment {
  return serverEnvironmentSchema.parse(source);
}
