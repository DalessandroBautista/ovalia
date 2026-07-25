import { describe, expect, it } from 'vitest';
// @ts-expect-error — script utilitario en JS sin tipos.
import { runAudit } from '../../../scripts/audit-production-hardcodes.mjs';

// Guard contra regresiones de hardcodes productivos (plan Hito 0.3).
// Cualquier hardcode nuevo fuera de scripts/hardcode-allowlist.json falla aquí.
describe('audit-production-hardcodes', () => {
  it('no encuentra hardcodes productivos fuera de la allowlist', () => {
    const { violations } = runAudit() as {
      violations: Array<{ rule: string; file: string; line: number }>;
    };
    if (violations.length > 0) {
      const detail = violations
        .map((v) => `[${v.rule}] ${v.file}:${v.line}`)
        .join('\n');
      throw new Error(`Hardcodes fuera de allowlist:\n${detail}`);
    }
    expect(violations).toHaveLength(0);
  });
});
