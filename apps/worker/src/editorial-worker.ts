import { claimNextJob, completeJob, failJob, type Database, type JobRow } from '@ovalia/database';
import { z } from 'zod';
import { generateAndStoreMatchDraft, type ResponsesClient } from './editorial-agent.js';

const editorialMatchSchema = z.object({
  competition: z.string().min(1),
  homeTeam: z.string().min(1),
  awayTeam: z.string().min(1),
  homeScore: z.number().int().nonnegative(),
  awayScore: z.number().int().nonnegative(),
  events: z.array(z.object({
    minute: z.number().int().optional(),
    type: z.string().min(1),
    playerName: z.string().optional(),
  })),
});

const editorialPayloadSchema = z.object({
  slug: z.string().min(1).max(180),
  authorId: z.string().uuid().nullable().optional(),
  match: editorialMatchSchema,
});

export async function processEditorialJob(
  db: Database,
  client: ResponsesClient,
  job: JobRow,
) {
  if (job.type !== 'editorial.match-draft') throw new Error(`unsupported_job:${job.type}`);
  try {
    const payload = editorialPayloadSchema.parse(job.payload);
    const article = await generateAndStoreMatchDraft(db, client, payload);
    await completeJob(db, job.id);
    return article;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_editorial_job_error';
    await failJob(db, job.id, message);
    throw error;
  }
}

export async function runEditorialWorkerOnce(
  db: Database,
  client: ResponsesClient,
  workerId: string,
): Promise<boolean> {
  const job = await claimNextJob(db, workerId);
  if (!job) return false;
  try {
    await processEditorialJob(db, client, job);
  } catch {
    // failJob ya deja el motivo y decide si reintentar o marcar failed.
  }
  return true;
}
