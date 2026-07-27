import { describe, expect, it } from 'vitest';

import { createDatabase } from './client';

describe('createDatabase', () => {
  it('permite limitar el pool para entornos serverless', async () => {
    const { pool } = createDatabase('postgres://unused:unused@localhost:1/unused', { max: 3 });
    expect(pool.options.max).toBe(3);
    await pool.end();
  });
});
