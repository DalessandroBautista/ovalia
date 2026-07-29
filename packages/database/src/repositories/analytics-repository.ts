import type { Database } from '../client.js';
import { analyticsEvents, feedback } from '../schema.js';

export async function recordEvent(
  db: Database,
  input: { name: string; path?: string | null; metadata?: Record<string, unknown> },
) {
  const [row] = await db
    .insert(analyticsEvents)
    .values({
      name: input.name,
      path: input.path ?? null,
      metadata: input.metadata ?? {},
    })
    .returning();
  return row!;
}

export async function recordFeedback(
  db: Database,
  input: { message: string; path?: string | null; contact?: string | null },
) {
  const [row] = await db
    .insert(feedback)
    .values({
      message: input.message,
      path: input.path ?? null,
      contact: input.contact ?? null,
    })
    .returning();
  return row!;
}
