import { and, eq, gt } from 'drizzle-orm';
import type { Database } from '../client.js';
import { verificationTokens } from '../schema.js';

export function createVerificationToken(
  db: Database,
  input: { identifier: string; tokenHash: string; purpose: string; expiresAt: Date },
) {
  return db.insert(verificationTokens).values(input).returning();
}

export async function consumeVerificationToken(
  db: Database,
  input: { tokenHash: string; purpose: string },
) {
  return db.transaction(async (tx) => {
    const [token] = await tx
      .select()
      .from(verificationTokens)
      .where(and(
        eq(verificationTokens.tokenHash, input.tokenHash),
        eq(verificationTokens.purpose, input.purpose),
        gt(verificationTokens.expiresAt, new Date()),
      ))
      .limit(1);
    if (!token) return null;
    await tx.delete(verificationTokens).where(eq(verificationTokens.id, token.id));
    return token;
  });
}
