import { and, asc, desc, eq, gt, sql } from 'drizzle-orm';
import type { Database } from '../client';
import {
  contestMatches,
  contestRankings,
  predictionContests,
  predictions,
} from '../schema';

export class ContestClosedError extends Error {
  constructor() {
    super('contest_closed');
    this.name = 'ContestClosedError';
  }
}

/** Concurso abierto más próximo a cerrar. */
export async function getActiveContest(db: Database, now: Date = new Date()) {
  const [row] = await db
    .select()
    .from(predictionContests)
    .where(and(eq(predictionContests.status, 'open'), gt(predictionContests.closesAt, now)))
    .orderBy(asc(predictionContests.closesAt))
    .limit(1);
  return row ?? null;
}

export function getContestMatches(db: Database, contestId: string) {
  return db
    .select()
    .from(contestMatches)
    .where(eq(contestMatches.contestId, contestId))
    .orderBy(asc(contestMatches.ordinal));
}

export function getUserPredictions(db: Database, userId: string, contestId: string) {
  return db.query.predictions.findMany({
    where: and(eq(predictions.userId, userId), eq(predictions.contestId, contestId)),
  });
}

/**
 * Guarda/actualiza una predicción respetando el cierre con el reloj del servidor.
 * Bloquea la fila del concurso dentro de la transacción para evitar carreras al cierre.
 */
export async function upsertPrediction(
  db: Database,
  input: {
    userId: string;
    contestId: string;
    matchId: string;
    homeScore: number;
    awayScore: number;
  },
) {
  return db.transaction(async (tx) => {
    const [contest] = await tx
      .select()
      .from(predictionContests)
      .where(eq(predictionContests.id, input.contestId))
      .for('update');
    if (!contest) throw new Error('contest_not_found');
    const now = new Date();
    const closed =
      contest.status === 'closed' ||
      contest.status === 'scored' ||
      (contest.closesAt != null && contest.closesAt.getTime() <= now.getTime());
    if (closed) throw new ContestClosedError();

    const [row] = await tx
      .insert(predictions)
      .values({
        userId: input.userId,
        contestId: input.contestId,
        matchId: input.matchId,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
      })
      .onConflictDoUpdate({
        target: [predictions.userId, predictions.contestId, predictions.matchId],
        set: {
          homeScore: input.homeScore,
          awayScore: input.awayScore,
          updatedAt: now,
        },
      })
      .returning();
    return row!;
  });
}

export function getContestRanking(db: Database, contestId: string) {
  return db
    .select()
    .from(contestRankings)
    .where(eq(contestRankings.contestId, contestId))
    .orderBy(desc(contestRankings.points));
}

/** Recalcula puntos por usuario y persiste posiciones (idempotente). */
export async function rebuildRanking(
  db: Database,
  contestId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const totals = await tx
      .select({
        userId: predictions.userId,
        points: sql<number>`coalesce(sum(${predictions.awardedPoints}), 0)`.mapWith(Number),
      })
      .from(predictions)
      .where(eq(predictions.contestId, contestId))
      .groupBy(predictions.userId)
      .orderBy(desc(sql`coalesce(sum(${predictions.awardedPoints}), 0)`));
    await tx.delete(contestRankings).where(eq(contestRankings.contestId, contestId));
    if (totals.length === 0) return;
    await tx.insert(contestRankings).values(
      totals.map((total, index) => ({
        contestId,
        userId: total.userId,
        points: total.points,
        position: index + 1,
      })),
    );
  });
}
