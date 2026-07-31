import { and, count, desc, eq, gte } from 'drizzle-orm';
import type { CareerSummary, SeasonRecord } from '@ovalia/domain';
import type { Database } from '../client.js';
import { careerEntries } from '../schema.js';

export interface CareerEntryInput {
  score: number;
  displayName: string;
  userId?: string | null;
  summary: CareerSummary;
  history: SeasonRecord[];
  surname: string;
  position: string;
  clubSlug: string;
  seed: number;
  decisions: number[];
  originKey?: string | null;
}

export function insertCareerEntry(db: Database, input: CareerEntryInput) {
  return db
    .insert(careerEntries)
    .values({
      score: input.score,
      displayName: input.displayName,
      userId: input.userId ?? null,
      summary: input.summary,
      history: input.history,
      surname: input.surname,
      position: input.position,
      clubSlug: input.clubSlug,
      seed: input.seed,
      decisions: input.decisions,
      originKey: input.originKey ?? null,
    })
    .returning()
    .then((rows) => rows[0]!);
}

export function listCareerEntries(db: Database, { limit }: { limit: number }) {
  return db
    .select()
    .from(careerEntries)
    .orderBy(desc(careerEntries.score), desc(careerEntries.createdAt))
    .limit(limit);
}

export function findCareerEntryById(db: Database, id: string) {
  return db.select().from(careerEntries).where(eq(careerEntries.id, id)).limit(1).then((rows) => rows[0] ?? null);
}

export function countRecentEntriesByOrigin(db: Database, originKey: string, since: Date) {
  return db
    .select({ count: count() })
    .from(careerEntries)
    .where(and(eq(careerEntries.originKey, originKey), gte(careerEntries.createdAt, since)))
    .then((rows) => rows[0]?.count ?? 0);
}
