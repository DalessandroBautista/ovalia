import { asc, desc, eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { standings, standingsSnapshots, teams } from '../schema.js';

export type StandingRow = {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  bonus: number;
  points: number;
};

export function getStandingsForSeason(db: Database, seasonId: string) {
  return db
    .select({
      teamId: standings.teamId,
      teamSlug: teams.slug,
      teamName: teams.name,
      played: standings.played,
      won: standings.won,
      drawn: standings.drawn,
      lost: standings.lost,
      pointsFor: standings.pointsFor,
      pointsAgainst: standings.pointsAgainst,
      bonus: standings.bonus,
      points: standings.points,
      source: standings.source,
      fetchedAt: standings.fetchedAt,
    })
    .from(standings)
    .innerJoin(teams, eq(standings.teamId, teams.id))
    .where(eq(standings.seasonId, seasonId))
    .orderBy(desc(standings.points), asc(teams.name));
}

/** Reemplaza la tabla completa de una temporada en una transacción. */
export async function replaceStandings(
  db: Database,
  seasonId: string,
  rows: StandingRow[],
  source: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(standings).where(eq(standings.seasonId, seasonId));
    if (rows.length === 0) return;
    await tx.insert(standings).values(
      rows.map((row) => ({
        seasonId,
        teamId: row.teamId,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        bonus: row.bonus,
        points: row.points,
        source,
        fetchedAt: new Date(),
      })),
    );
  });
}

export async function saveStandingsSnapshot(
  db: Database,
  input: { seasonId: string; source: string; rows: unknown; checksum?: string | null },
) {
  const [row] = await db
    .insert(standingsSnapshots)
    .values({
      seasonId: input.seasonId,
      source: input.source,
      rows: input.rows ?? [],
      checksum: input.checksum ?? null,
    })
    .returning();
  return row!;
}
