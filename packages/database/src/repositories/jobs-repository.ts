import { and, eq, lte, sql } from 'drizzle-orm';
import type { Database } from '../client.js';
import { jobs } from '../schema.js';

export type JobRow = typeof jobs.$inferSelect;

/** Encola un job idempotente por dedupeKey (no duplica si ya existe pendiente). */
export async function enqueueJob(
  db: Database,
  input: { type: string; payload?: Record<string, unknown>; dedupeKey?: string | null; runAt?: Date },
): Promise<JobRow | null> {
  const rows = await db
    .insert(jobs)
    .values({
      type: input.type,
      payload: input.payload ?? {},
      dedupeKey: input.dedupeKey ?? null,
      runAt: input.runAt ?? new Date(),
    })
    .onConflictDoNothing({ target: jobs.dedupeKey })
    .returning();
  return rows[0] ?? null;
}

/**
 * Reclama el próximo job ejecutable con FOR UPDATE SKIP LOCKED para que dos
 * workers nunca tomen el mismo job simultáneamente.
 */
export async function claimNextJob(
  db: Database,
  worker: string,
  now: Date = new Date(),
): Promise<JobRow | null> {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.status, 'pending'), lte(jobs.runAt, now)))
      .orderBy(jobs.runAt)
      .limit(1)
      .for('update', { skipLocked: true });
    if (!candidate) return null;
    const [claimed] = await tx
      .update(jobs)
      .set({
        status: 'running',
        lockedAt: now,
        lockedBy: worker,
        attempts: sql`${jobs.attempts} + 1`,
        updatedAt: now,
      })
      .where(eq(jobs.id, candidate.id))
      .returning();
    return claimed ?? null;
  });
}

export async function completeJob(db: Database, id: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status: 'done', updatedAt: new Date() })
    .where(eq(jobs.id, id));
}

export async function failJob(
  db: Database,
  id: string,
  error: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [job] = await tx.select().from(jobs).where(eq(jobs.id, id)).for('update');
    if (!job) return;
    const exhausted = job.attempts >= job.maxAttempts;
    await tx
      .update(jobs)
      .set({
        status: exhausted ? 'failed' : 'pending',
        lastError: error,
        lockedAt: null,
        lockedBy: null,
        runAt: exhausted ? job.runAt : new Date(Date.now() + 60_000),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, id));
  });
}

/** Ejecuta `fn` bajo un advisory lock por clave; devuelve null si no lo obtuvo. */
export async function withAdvisoryLock<T>(
  db: Database,
  key: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  const lockId = hashKey(key);
  const acquired = await db.execute<{ locked: boolean }>(
    sql`select pg_try_advisory_lock(${lockId}) as locked`,
  );
  if (!acquired.rows[0]?.locked) return null;
  try {
    return await fn();
  } finally {
    await db.execute(sql`select pg_advisory_unlock(${lockId})`);
  }
}

function hashKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return hash;
}
