import { and, asc, desc, eq, gt, sql } from 'drizzle-orm';
import { scorePrediction } from '@ovalia/domain';
import type { Database } from '../client.js';
import {
  contestMatches,
  contestRankings,
  matches,
  predictionContests,
  predictions,
} from '../schema.js';

export class ContestClosedError extends Error {
  constructor() {
    super('contest_closed');
    this.name = 'ContestClosedError';
  }
}

export class ContestNotReadyError extends Error {
  constructor() {
    super('contest_not_ready');
    this.name = 'ContestNotReadyError';
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

export function getContestBySlug(db: Database, slug: string) {
  return db.query.predictionContests.findFirst({ where: eq(predictionContests.slug, slug) });
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

/** Puntúa todos los partidos finales de un concurso y lo deja en estado scored. */
export async function scoreContest(db: Database, contestId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [contest] = await tx
      .select()
      .from(predictionContests)
      .where(eq(predictionContests.id, contestId))
      .for('update');
    if (!contest) throw new Error('contest_not_found');

    const contestRows = await tx
      .select({
        matchId: contestMatches.matchId,
        status: matches.status,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
      })
      .from(contestMatches)
      .innerJoin(matches, eq(matches.id, contestMatches.matchId))
      .where(eq(contestMatches.contestId, contestId));
    if (contestRows.length === 0 || contestRows.some((row) => row.status !== 'final' || row.homeScore == null || row.awayScore == null)) {
      throw new ContestNotReadyError();
    }

    const contestPredictions = await tx
      .select()
      .from(predictions)
      .where(eq(predictions.contestId, contestId));
    for (const prediction of contestPredictions) {
      const result = contestRows.find((row) => row.matchId === prediction.matchId);
      if (!result || result.homeScore == null || result.awayScore == null) continue;
      await tx
        .update(predictions)
        .set({ awardedPoints: scorePrediction(
          { home: prediction.homeScore, away: prediction.awayScore },
          { home: result.homeScore, away: result.awayScore },
        ), updatedAt: new Date() })
        .where(eq(predictions.id, prediction.id));
    }
    await tx
      .update(predictionContests)
      .set({ status: 'scored' })
      .where(eq(predictionContests.id, contestId));
  });
  await rebuildRanking(db, contestId);
}

/** Procesa de forma idempotente todos los concursos cerrados que ya tienen resultados. */
export async function scoreClosedContests(db: Database): Promise<number> {
  const closed = await db.query.predictionContests.findMany({ where: eq(predictionContests.status, 'closed') });
  let scored = 0;
  for (const contest of closed) {
    try {
      await scoreContest(db, contest.id);
      scored += 1;
    } catch (error) {
      if (!(error instanceof ContestNotReadyError)) throw error;
    }
  }
  return scored;
}
