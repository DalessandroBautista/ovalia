import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from './client';
import {
  claimNextJob,
  completeJob,
  enqueueJob,
  failJob,
  withAdvisoryLock,
} from './repositories/jobs-repository';
import { jobs } from './schema';
import { eq } from 'drizzle-orm';
import {
  getTestDatabase,
  isDatabaseAvailable,
  truncateAll,
} from './test-support/test-database';

const available = await isDatabaseAvailable();

describe.skipIf(!available)('jobs repository', () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    handle = await getTestDatabase();
    await truncateAll(handle);
  });

  afterAll(async () => {
    if (available) await handle.pool.end().catch(() => undefined);
  });

  it('encola de forma idempotente por dedupeKey', async () => {
    const { db } = handle;
    const first = await enqueueJob(db, { type: 'ingest', dedupeKey: 'urba:fixtures:2026-08-01' });
    const second = await enqueueJob(db, { type: 'ingest', dedupeKey: 'urba:fixtures:2026-08-01' });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    const all = await db.query.jobs.findMany();
    expect(all).toHaveLength(1);
  });

  it('claimNextJob no entrega el mismo job a dos workers', async () => {
    const { db } = handle;
    await enqueueJob(db, { type: 'ingest', dedupeKey: 'a' });
    const [w1, w2] = await Promise.all([
      claimNextJob(db, 'worker-1'),
      claimNextJob(db, 'worker-2'),
    ]);
    const claimed = [w1, w2].filter((j) => j != null);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.attempts).toBe(1);
  });

  it('failJob reintenta hasta agotar y luego marca failed', async () => {
    const { db } = handle;
    const job = await enqueueJob(db, { type: 'ingest', dedupeKey: 'b' });
    // maxAttempts por defecto = 5; forzamos attempts alto para agotar.
    await db.update(jobs).set({ attempts: 5 }).where(eq(jobs.id, job!.id));
    await failJob(db, job!.id, 'boom');
    const [row] = await db.select().from(jobs).where(eq(jobs.id, job!.id));
    expect(row!.status).toBe('failed');
    expect(row!.lastError).toBe('boom');
  });

  it('completeJob marca done', async () => {
    const { db } = handle;
    const job = await enqueueJob(db, { type: 'ingest', dedupeKey: 'c' });
    const claimed = await claimNextJob(db, 'w');
    await completeJob(db, claimed!.id);
    const [row] = await db.select().from(jobs).where(eq(jobs.id, job!.id));
    expect(row!.status).toBe('done');
  });

  it('withAdvisoryLock ejecuta la función y devuelve su resultado', async () => {
    const { db } = handle;
    let ran = false;
    const result = await withAdvisoryLock(db, 'lock-key', async () => {
      ran = true;
      return 42;
    });
    expect(ran).toBe(true);
    expect(result).toBe(42);
  });

  it('withAdvisoryLock devuelve null si otra sesión ya tiene el lock', async () => {
    const { db, pool } = handle;
    // Tomamos el lock manualmente en una conexión dedicada y lo mantenemos.
    const holder = await pool.connect();
    // hash idéntico al de la implementación (djb2 sobre charCodes).
    let lockId = 0;
    const key = 'held-key';
    for (let i = 0; i < key.length; i += 1) lockId = (lockId * 31 + key.charCodeAt(i)) | 0;
    await holder.query('select pg_advisory_lock($1)', [lockId]);
    try {
      const result = await withAdvisoryLock(db, key, async () => 'should-not-run');
      expect(result).toBeNull();
    } finally {
      await holder.query('select pg_advisory_unlock($1)', [lockId]);
      holder.release();
    }
  });
});
