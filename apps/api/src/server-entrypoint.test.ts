import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('entrypoint de Vercel', () => {
  it('crea la instancia Fastify directamente desde src/server.ts', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(here, 'server.ts'), 'utf8');

    expect(source).toMatch(/import\s+Fastify(?:\s*,|\s+from)\s*['"]fastify['"]/);
    expect(source).toMatch(/const\s+app\s*=\s*Fastify\s*\(/);
    expect(source).not.toMatch(/await\s+app\.listen\s*\(/);
    expect(source).not.toMatch(/import\s+['"]dotenv\/config['"]/);
    expect(source).toMatch(/const\s+isHostedRuntime\s*=/);
    expect(source).toMatch(/VERCEL_ENV\s*===\s*['"]preview['"]/);
    expect(source).toMatch(/VERCEL_ENV\s*===\s*['"]production['"]/);
    expect(source).toMatch(/typeof\s+process\.env\.VERCEL_URL\s*===\s*['"]string['"]/);
  });
});
