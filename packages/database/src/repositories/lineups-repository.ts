import { and, asc, count, eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { lineupEntries, matches, players } from '../schema.js';

export interface LineupEntryRow {
  shirtNumber: number;
  isStarter: boolean;
  isCaptain: boolean;
  player: { id: string; slug: string; fullName: string };
}

export interface LineupResult {
  home: LineupEntryRow[];
  away: LineupEntryRow[];
}

export interface LineupEntryInput {
  playerId: string;
  shirtNumber: number;
  isStarter: boolean;
  isCaptain: boolean;
}

export interface ReplaceLineupInput {
  matchId: string;
  teamId: string;
  entries: LineupEntryInput[];
}

/** Obtiene las formaciones de ambos equipos para un partido. */
export async function getLineupsForMatch(
  db: Database,
  matchId: string,
): Promise<LineupResult> {
  const rows = await db
    .select({
      teamId: lineupEntries.teamId,
      shirtNumber: lineupEntries.shirtNumber,
      isStarter: lineupEntries.isStarter,
      isCaptain: lineupEntries.isCaptain,
      playerId: players.id,
      playerSlug: players.slug,
      playerFullName: players.fullName,
    })
    .from(lineupEntries)
    .innerJoin(players, eq(lineupEntries.playerId, players.id))
    .where(eq(lineupEntries.matchId, matchId))
    .orderBy(asc(lineupEntries.shirtNumber));

  // Consultar equipos del partido para clasificar home/away.
  const [match] = await db
    .select({ homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) return { home: [], away: [] };

  const toEntry = (row: typeof rows[number]): LineupEntryRow => ({
    shirtNumber: row.shirtNumber,
    isStarter: row.isStarter,
    isCaptain: row.isCaptain,
    player: { id: row.playerId, slug: row.playerSlug, fullName: row.playerFullName },
  });

  return {
    home: rows.filter((r) => r.teamId === match.homeTeamId).map(toEntry),
    away: rows.filter((r) => r.teamId === match.awayTeamId).map(toEntry),
  };
}

/**
 * Reemplaza la formación de un equipo en un partido.
 * Borra las entradas previas del equipo y crea las nuevas.
 * El caller es responsable de escribir en audit_log.
 */
export async function replaceLineup(
  db: Database,
  input: ReplaceLineupInput,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(lineupEntries)
      .where(and(
        eq(lineupEntries.matchId, input.matchId),
        eq(lineupEntries.teamId, input.teamId),
      ));

    if (input.entries.length > 0) {
      await tx.insert(lineupEntries).values(
        input.entries.map((entry) => ({
          matchId: input.matchId,
          teamId: input.teamId,
          playerId: entry.playerId,
          shirtNumber: entry.shirtNumber,
          isStarter: entry.isStarter,
          isCaptain: entry.isCaptain,
        })),
      );
    }
  });
}

/** Verifica si un partido tiene al menos una entrada de formación. */
export async function hasLineup(
  db: Database,
  matchId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ value: count() })
    .from(lineupEntries)
    .where(eq(lineupEntries.matchId, matchId));
  return (row?.value ?? 0) > 0;
}
