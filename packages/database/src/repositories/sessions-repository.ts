import { and, eq, gt } from 'drizzle-orm';
import type { Database } from '../client.js';
import { sessions, users } from '../schema.js';

export async function createSession(
  db: Database,
  input: { userId: string; tokenHash: string; expiresAt: Date },
) {
  const [row] = await db.insert(sessions).values(input).returning();
  return row!;
}

export async function findSessionWithUserByTokenHash(db: Database, tokenHash: string) {
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function deleteSessionByTokenHash(db: Database, tokenHash: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

export async function deleteSessionsByUserId(db: Database, userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}
