import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { normalizePlayerName } from '@ovalia/domain';
import type { Database } from '../client.js';
import { players } from '../schema.js';

export interface NewPlayerInput {
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

/**
 * Crea un jugador nuevo. Nunca fusiona con uno existente: cada llamada es una
 * persona distinta, incluso si comparte nombre con otra. El `slug` es un UUID
 * generado acá mismo (no se deriva del nombre), así que homónimos no colisionan.
 */
export async function createPlayer(
  db: Database,
  input: NewPlayerInput,
): Promise<PlayerRow> {
  const id = randomUUID();
  const [row] = await db
    .insert(players)
    .values({
      id,
      slug: id,
      fullName: input.fullName,
      normalizedName: input.normalizedName,
    })
    .returning();
  return row!;
}

/**
 * Busca jugadores cuyo nombre coincida por prefijo de token con la consulta.
 * Cada token de la consulta (normalizado) debe ser prefijo de algún token del
 * `normalizedName` almacenado. Limita a `limit` resultados (20 por defecto).
 */
export async function searchPlayersByName(
  db: Database,
  { query, limit = 20 }: { query: string; limit?: number },
): Promise<PlayerRow[]> {
  const queryTokens = normalizePlayerName(query)
    .split(' ')
    .filter((token) => token.length > 0);
  if (queryTokens.length === 0) return [];

  const all = await db.query.players.findMany();
  const matches = all.filter((player) => {
    const nameTokens = player.normalizedName.split(' ').filter((token) => token.length > 0);
    return queryTokens.every((queryToken) => nameTokens.some((nameToken) => nameToken.startsWith(queryToken)));
  });
  return matches.slice(0, limit);
}
