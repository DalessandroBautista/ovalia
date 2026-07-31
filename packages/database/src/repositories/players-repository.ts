import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { normalizePlayerName } from '@ovalia/domain';
import type { Database } from '../client.js';
import { players } from '../schema.js';

/** Escapa los caracteres especiales de LIKE (`\`, `%`, `_`) para usar un valor como literal. */
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

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

  // `normalizedName` guarda los tokens del nombre ordenados alfabéticamente y
  // separados por espacios. Cada token de la consulta debe ser prefijo de
  // algún token almacenado: o bien está al inicio de la columna (LIKE
  // 'token%') o le sigue a un espacio (LIKE '% token%'). Todos los tokens de
  // la consulta deben cumplirse (AND).
  //
  // El índice btree `players_normalized_idx` acelera el caso 'token%' pero no
  // '% token%' (un LIKE con comodín al inicio no usa un btree). Si el volumen
  // de jugadores crece lo suficiente para que esto importe, la salida es un
  // índice trigram (extensión `pg_trgm`), no agregado acá porque no hace
  // falta para el volumen actual y requeriría una migración.
  const tokenConditions = queryTokens.map((token) => {
    const escaped = escapeLikePattern(token);
    return sql`(${players.normalizedName} LIKE ${`${escaped}%`} OR ${players.normalizedName} LIKE ${`% ${escaped}%`})`;
  });

  const rows = await db.query.players.findMany({
    where: and(...tokenConditions),
    limit,
  });
  return rows;
}
