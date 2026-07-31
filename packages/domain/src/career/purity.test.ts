import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CAREER_DIR = new URL('.', import.meta.url).pathname;

describe('pureza del motor de carrera', () => {
  it('ningún archivo de producción usa Math.random', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(CAREER_DIR)) {
      if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
      const source = readFileSync(join(CAREER_DIR, file), 'utf8');
      if (source.includes('Math.random')) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('ningún archivo del motor importa framework ni base de datos', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(CAREER_DIR)) {
      if (!file.endsWith('.ts')) continue;
      const source = readFileSync(join(CAREER_DIR, file), 'utf8');
      if (/from '(react|next|drizzle-orm|@ovalia\/database)/.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
