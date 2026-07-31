import { and, asc, desc, eq, gt, gte, inArray, lt, lte, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Database } from '../client.js';
import { competitions, matches, seasons, teams } from '../schema.js';

export type MatchStatus =
  | 'scheduled'
  | 'live'
  | 'halftime'
  | 'final'
  | 'postponed'
  | 'cancelled';

export type MatchInput = {
  seasonId: string;
  round: string;
  startsAt: Date;
  homeTeamId: string;
  awayTeamId: string;
  venue?: string | null;
  status?: MatchStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  homeTries?: number;
  awayTries?: number;
  source?: string | null;
  phaseId?: string | null;
  roundId?: string | null;
};

const homeTeam = alias(teams, 'home_team');
const awayTeam = alias(teams, 'away_team');

function baseSelect(db: Database) {
  return db
    .select({
      id: matches.id,
      round: matches.round,
      startsAt: matches.startsAt,
      venue: matches.venue,
      status: matches.status,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeTries: matches.homeTries,
      awayTries: matches.awayTries,
      source: matches.source,
      fetchedAt: matches.fetchedAt,
      seasonId: matches.seasonId,
      competitionSlug: competitions.slug,
      competitionName: competitions.name,
      seasonYear: seasons.year,
      home: {
        id: homeTeam.id,
        slug: homeTeam.slug,
        name: homeTeam.name,
        shortName: homeTeam.shortName,
        badgeUrl: homeTeam.badgeUrl,
      },
      away: {
        id: awayTeam.id,
        slug: awayTeam.slug,
        name: awayTeam.name,
        shortName: awayTeam.shortName,
        badgeUrl: awayTeam.badgeUrl,
      },
    })
    .from(matches)
    .innerJoin(seasons, eq(matches.seasonId, seasons.id))
    .innerJoin(competitions, eq(seasons.competitionId, competitions.id))
    .innerJoin(homeTeam, eq(matches.homeTeamId, homeTeam.id))
    .innerJoin(awayTeam, eq(matches.awayTeamId, awayTeam.id));
}

export type MatchListParams = {
  from: Date;
  to: Date;
  competitionSlug?: string;
  status?: MatchStatus;
  limit?: number;
  cursor?: { startsAt: Date; id: string };
};

export async function findMatchesInRange(db: Database, params: MatchListParams) {
  const limit = Math.min(params.limit ?? 50, 200);
  const filters = [gte(matches.startsAt, params.from), lte(matches.startsAt, params.to)];
  if (params.competitionSlug) filters.push(eq(competitions.slug, params.competitionSlug));
  if (params.status) filters.push(eq(matches.status, params.status));
  if (params.cursor) {
    filters.push(
      sql`(${matches.startsAt}, ${matches.id}) > (${params.cursor.startsAt.toISOString()}, ${params.cursor.id})`,
    );
  }
  const rows = await baseSelect(db)
    .where(and(...filters))
    .orderBy(asc(matches.startsAt), asc(matches.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return {
    matches: page,
    nextCursor: hasMore && last ? { startsAt: last.startsAt, id: last.id } : null,
  };
}

export async function findMatchById(db: Database, id: string) {
  const [row] = await baseSelect(db).where(eq(matches.id, id)).limit(1);
  return row ?? null;
}

export async function findUpcomingMatches(db: Database, params: { limit: number; now: Date }) {
  return baseSelect(db)
    .where(and(
      eq(matches.status, 'scheduled'),
      gt(competitions.priority, 0),
      gte(matches.startsAt, params.now),
    ))
    .orderBy(desc(competitions.priority), asc(matches.startsAt))
    .limit(params.limit);
}

export type CompetitionMatchesParams = {
  competitionSlug: string;
  seasonYear?: number;
  round?: string;
  limit?: number;
  cursor?: { startsAt: Date; id: string };
};

export async function findMatchesByCompetition(db: Database, params: CompetitionMatchesParams) {
  const limit = Math.min(params.limit ?? 100, 200);
  const filters = [eq(competitions.slug, params.competitionSlug)];
  if (params.seasonYear) filters.push(eq(seasons.year, params.seasonYear));
  if (params.round) filters.push(eq(matches.round, params.round));
  if (params.cursor) {
    filters.push(
      sql`(${matches.startsAt}, ${matches.id}) > (${params.cursor.startsAt.toISOString()}, ${params.cursor.id})`,
    );
  }
  const rows = await baseSelect(db)
    .where(and(...filters))
    .orderBy(asc(matches.startsAt), asc(matches.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  return {
    matches: page,
    nextCursor: hasMore && last ? { startsAt: last.startsAt, id: last.id } : null,
  };
}

export type PastMatchesParams = {
  teamIds: readonly [string, string];
  before: Date;
  /**
   * Restringe a la misma competencia que el partido consultado. En URBA, un mismo
   * cruce de clubes se juega el mismo día en varias divisiones (Superior, Intermedia,
   * Preintermedia, ...), que comparten el registro de equipo pero son planteles y
   * competencias distintas. Sin este filtro, el historial mezclaba resultados de
   * divisiones ajenas y producía un balance falso.
   */
  competitionSlug?: string;
  limit?: number;
};

/** Partidos finalizados de cualquiera de los equipos, anteriores al partido consultado. */
export async function findPastMatchesForTeams(db: Database, params: PastMatchesParams) {
  const teamIds = [...params.teamIds];
  const filters = [
    eq(matches.status, 'final'),
    lt(matches.startsAt, params.before),
    or(inArray(matches.homeTeamId, teamIds), inArray(matches.awayTeamId, teamIds)),
  ];
  if (params.competitionSlug) filters.push(eq(competitions.slug, params.competitionSlug));
  return baseSelect(db)
    .where(and(...filters))
    .orderBy(desc(matches.startsAt))
    .limit(Math.min(params.limit ?? 200, 500));
}

/** Identidad natural: temporada + ronda + local + visitante. */
function naturalMatch(db: Database, input: MatchInput) {
  return db.query.matches.findFirst({
    where: and(
      eq(matches.seasonId, input.seasonId),
      eq(matches.round, input.round),
      eq(matches.homeTeamId, input.homeTeamId),
      eq(matches.awayTeamId, input.awayTeamId),
    ),
  });
}

/** Upsert idempotente por identidad natural. Actualiza sede/horario/resultado. */
export async function upsertMatchByNaturalKey(db: Database, input: MatchInput) {
  return db.transaction(async (tx) => {
    const existing = await naturalMatch(tx as unknown as Database, input);
    const values = {
      seasonId: input.seasonId,
      round: input.round,
      startsAt: input.startsAt,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      venue: input.venue ?? null,
      status: input.status ?? 'scheduled',
      homeScore: input.homeScore ?? null,
      awayScore: input.awayScore ?? null,
      homeTries: input.homeTries ?? 0,
      awayTries: input.awayTries ?? 0,
      source: input.source ?? null,
      phaseId: input.phaseId ?? null,
      roundId: input.roundId ?? null,
      fetchedAt: new Date(),
      updatedAt: new Date(),
    };
    if (existing) {
      const [row] = await tx
        .update(matches)
        .set({
          startsAt: values.startsAt,
          venue: values.venue,
          status: values.status,
          homeScore: values.homeScore,
          awayScore: values.awayScore,
          homeTries: values.homeTries,
          awayTries: values.awayTries,
          source: values.source,
          fetchedAt: values.fetchedAt,
          updatedAt: values.updatedAt,
        })
        .where(eq(matches.id, existing.id))
        .returning();
      return { match: row!, created: false };
    }
    const [row] = await tx.insert(matches).values(values).returning();
    return { match: row!, created: true };
  });
}
