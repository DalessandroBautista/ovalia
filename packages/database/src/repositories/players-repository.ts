import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { players } from '../schema.js';

export interface PlayerInput {
  slug: string;
  fullName: string;
  normalizedName: string;
}

export interface PlayerRow {
  id: string;
  slug: string;
  fullName: string;
  normalizedName: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Busca un jugador por su nombre normalizado (clave de deduplicación). */
export async function findPlayerByNormalizedName(
  db: Database,
  normalizedName: string,
): Promise<PlayerRow | null> {
  const row = await db.query.players.findFirst({
    where: eq(players.normalizedName, normalizedName),
  });
  return row ?? null;
}

/** Busca todos los jugadores con el mismo nombre normalizado (homónimos). */
export async function findPlayersByNormalizedName(
  db: Database,
  normalizedName: string,
): Promise<PlayerRow[]> {
  return db.query.players.findMany({
    where: eq(players.normalizedName, normalizedName),
  });
}

/** Busca un jugador por ID. */
export async function findPlayerById(
  db: Database,
  id: string,
): Promise<PlayerRow | null> {
  const row = await db.query.players.findFirst({
    where: eq(players.id, id),
  });
  return row ?? null;
}

/** Busca un jugador por slug. */
export async function findPlayerBySlug(
  db: Database,
  slug: string,
): Promise<PlayerRow | null> {
  const row = await db.query.players.findFirst({
    where: eq(players.slug, slug),
  });
  return row ?? null;
}

/** Crea o actualiza un jugador por slug. */
export async function upsertPlayer(
  db: Database,
  input: PlayerInput,
): Promise<PlayerRow> {
  const existing = await findPlayerBySlug(db, input.slug);
  if (existing) {
    const [row] = await db
      .update(players)
      .set({
        fullName: input.fullName,
        normalizedName: input.normalizedName,
        updatedAt: new Date(),
      })
      .where(eq(players.id, existing.id))
      .returning();
    return row!;
  }
  const [row] = await db
    .insert(players)
    .values({
      slug: input.slug,
      fullName: input.fullName,
      normalizedName: input.normalizedName,
    })
    .returning();
  return row!;
}

/** Crea un jugador nuevo sin verificar duplicados. */
export async function createPlayer(
  db: Database,
  input: PlayerInput,
): Promise<PlayerRow> {
  const [row] = await db
    .insert(players)
    .values({
      slug: input.slug,
      fullName: input.fullName,
      normalizedName: input.normalizedName,
    })
    .returning();
  return row!;
}
