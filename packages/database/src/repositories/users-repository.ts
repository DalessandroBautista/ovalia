import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { users } from '../schema.js';

export type UserRole = 'fan' | 'contributor' | 'editor' | 'admin';

export type UserInput = {
  email: string;
  displayName: string;
  role?: UserRole;
  locale?: string;
  passwordHash?: string | null;
};

export function findUserByEmail(db: Database, email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

export function findUserById(db: Database, id: string) {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

export async function createUser(db: Database, input: UserInput) {
  const [row] = await db
    .insert(users)
    .values({
      email: input.email,
      displayName: input.displayName,
      role: input.role ?? 'fan',
      locale: input.locale ?? 'es',
      passwordHash: input.passwordHash ?? null,
    })
    .returning();
  return row!;
}

export async function setUserRole(db: Database, id: string, role: UserRole) {
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function updateUserPassword(db: Database, id: string, passwordHash: string) {
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

export async function markUserEmailVerified(db: Database, email: string) {
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.email, email));
}
