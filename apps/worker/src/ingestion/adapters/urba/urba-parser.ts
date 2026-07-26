import { z } from 'zod';
import type {
  ExternalCompetition,
  ExternalMatch,
  ExternalStandings,
  ExternalTeam,
} from '@ovalia/domain';
import { localWallClockToUtc } from '../../normalization/dates';

export const URBA_PARSER_VERSION = 'urba-1';

/** Offset fijo de Argentina para `playdate` sin zona. */
const AR_OFFSET_MINUTES = -180;

const rawSeasonSchema = z.object({ id: z.number(), name: z.string() });

const rawChampionshipSchema = z.object({
  id: z.number(),
  name: z.string(),
  alias: z.string().optional(),
  season: rawSeasonSchema,
});

const rawChampionshipsSchema = z.object({
  championships: z.array(rawChampionshipSchema),
});

const rawClubSchema = z.object({ id: z.number(), name: z.string(), image_uri: z.string().optional() });

const rawClubsSchema = z.object({
  clubs: z.array(rawClubSchema),
});

const rawMatchTeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  club: z.object({ id: z.number(), name: z.string() }),
});

const rawMatchSchema = z.object({
  id: z.number(),
  playdate: z.string(),
  fulfilled: z.boolean(),
  suspended: z.boolean(),
  local_team_score: z.number().nullable(),
  visit_team_score: z.number().nullable(),
  local_team_offensive_bonus: z.number().optional(),
  visit_team_offensive_bonus: z.number().optional(),
  local_team: rawMatchTeamSchema,
  visit_team: rawMatchTeamSchema,
});

const rawRoundSchema = z.object({
  id: z.number(),
  name: z.string(),
  matches: z.array(rawMatchSchema),
});

const rawChampionshipDetailSchema = z.object({
  // El API envuelve el detalle en un array de un elemento.
  championship: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      season: rawSeasonSchema,
      rounds: z.array(rawRoundSchema),
    }),
  ),
});

const rawPositionSchema = z.object({
  position: z.number(),
  played: z.number(),
  won: z.number(),
  tied: z.number(),
  lost: z.number(),
  points_favor: z.number(),
  points_against: z.number(),
  bonus_offensive: z.number(),
  bonus_defensive: z.number(),
  points_total: z.number(),
  team: z.object({ id: z.number(), name: z.string(), club: z.object({ id: z.number(), name: z.string() }) }),
});

const rawPositionsSchema = z.object({ positions: z.array(rawPositionSchema) });

function genderFromName(name: string): 'male' | 'female' | 'mixed' {
  return /femenino/i.test(name) ? 'female' : 'male';
}

function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown, label: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`URBA parser: forma inesperada en ${label}: ${result.error.message.slice(0, 200)}`);
  }
  return result.data;
}

export function parseCompetitions(raw: unknown, priorityIds?: number[]): ExternalCompetition[] {
  const data = parseOrThrow(rawChampionshipsSchema, raw, 'championships');
  return data.championships
    .filter((c) => !priorityIds || priorityIds.includes(c.id))
    .map((c) => ({
      externalId: String(c.id),
      name: c.name,
      category: 'clubs',
      gender: genderFromName(c.name),
      countryCode: 'AR',
      format: 'xv' as const,
      season: { externalId: String(c.season.id), name: c.season.name, year: c.season.id },
    }));
}

export function parseClubsAsTeams(raw: unknown): ExternalTeam[] {
  const data = parseOrThrow(rawClubsSchema, raw, 'clubs');
  return data.clubs.map((club) => ({
    externalId: String(club.id),
    name: club.name,
    countryCode: 'AR' as const,
    union: 'URBA',
    ...(club.image_uri ? { badgeUrl: `https://api.urba.org.ar/${club.image_uri}` } : {}),
  }));
}

function matchStatus(m: z.infer<typeof rawMatchSchema>): ExternalMatch['status'] {
  if (m.suspended) return 'postponed';
  if (m.fulfilled) return 'final';
  return 'scheduled';
}

export function parseFixtures(raw: unknown): ExternalMatch[] {
  const data = parseOrThrow(rawChampionshipDetailSchema, raw, 'championship detail');
  const championship = data.championship[0];
  if (!championship) throw new Error('URBA parser: championship vacío');
  const competitionExternalId = String(championship.id);
  const seasonYear = championship.season.id;
  const matches: ExternalMatch[] = [];
  for (const round of championship.rounds) {
    for (const m of round.matches) {
      const played = m.fulfilled;
      matches.push({
        externalId: String(m.id),
        competitionExternalId,
        seasonYear,
        round: round.name,
        startsAt: localWallClockToUtc(m.playdate.replace(' ', 'T'), AR_OFFSET_MINUTES).toISOString(),
        homeTeamExternalId: String(m.local_team.club.id),
        awayTeamExternalId: String(m.visit_team.club.id),
        status: matchStatus(m),
        homeScore: played ? (m.local_team_score ?? null) : null,
        awayScore: played ? (m.visit_team_score ?? null) : null,
      });
    }
  }
  return matches;
}

export function parseStandings(
  raw: unknown,
  competitionExternalId: string,
  seasonYear: number,
): ExternalStandings {
  const data = parseOrThrow(rawPositionsSchema, raw, 'positions');
  return {
    competitionExternalId,
    seasonYear,
    rows: data.positions.map((p) => ({
      teamExternalId: String(p.team.club.id),
      position: p.position,
      played: p.played,
      won: p.won,
      drawn: p.tied,
      lost: p.lost,
      pointsFor: p.points_favor,
      pointsAgainst: p.points_against,
      bonus: p.bonus_offensive + p.bonus_defensive,
      points: p.points_total,
    })),
  };
}
