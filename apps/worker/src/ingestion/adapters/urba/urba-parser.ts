import { z } from 'zod';
import type {
  ExternalCompetition,
  ExternalMatch,
  ExternalStandings,
  ExternalTeam,
} from '@ovalia/domain';
import { localWallClockToUtc } from '../../normalization/dates';
import { deriveUrbaTaxonomy, type UrbaTier } from './urba-taxonomy';

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

export function parseCompetitions(
  raw: unknown,
  priorityIds?: number[],
  slugByExternalId?: ReadonlyMap<string, string>,
): ExternalCompetition[] {
  const data = parseOrThrow(rawChampionshipsSchema, raw, 'championships');
  return data.championships
    .filter((c) => !priorityIds || priorityIds.includes(c.id))
    .map((c) => {
      const slug = slugByExternalId?.get(String(c.id));
      const taxonomy = deriveUrbaTaxonomy(c.name);
      return {
        externalId: String(c.id),
        name: c.name,
        ...(slug ? { slug } : {}),
        category: 'clubs',
        gender: genderFromName(c.name),
        countryCode: 'AR',
        format: 'xv' as const,
        familySlug: taxonomy.familySlug,
        tier: taxonomy.tier,
        season: { externalId: String(c.season.id), name: c.season.name, year: c.season.id },
      };
    });
}

export function parseClubsAsTeams(raw: unknown): ExternalTeam[] {
  const data = parseOrThrow(rawClubsSchema, raw, 'clubs');
  return data.clubs.map((club) => {
    const badgeUrl = club.image_uri ? `https://api.urba.org.ar/${club.image_uri}` : undefined;
    const badgeFormat = club.image_uri ? club.image_uri.split('.').pop() : undefined;
    return {
      externalId: String(club.id),
      name: club.name,
      countryCode: 'AR' as const,
      union: 'URBA',
      ...(badgeUrl ? { badgeUrl, badgeSourceUrl: badgeUrl } : {}),
      ...(badgeFormat ? { badgeFormat } : {}),
    };
  });
}

function matchStatus(m: z.infer<typeof rawMatchSchema>): ExternalMatch['status'] {
  if (m.suspended) return 'postponed';
  if (m.fulfilled) return 'final';
  return 'scheduled';
}

function isBye(team: z.infer<typeof rawMatchTeamSchema>): boolean {
  return /^bye$/i.test(team.name.trim()) || /^bye$/i.test(team.club.name.trim());
}

/**
 * Regla de negocio para el kickoff de un partido URBA:
 * - Playdate 00:00:00 en competencias senior → 15:30 hora local de Argentina
 *   (las primeras divisiones juegan a esa hora; el API devuelve medianoche).
 * - Playdate 00:00:00 en el resto de categorías (intermediate, youth, women,
 *   university) → null: no hay horario informado, cada club define el suyo.
 * - Playdate con hora real distinta de 00:00 → se respeta tal cual.
 */
function resolveStartsAt(playdate: string, tier: UrbaTier): string | null {
  const iso = playdate.replace(' ', 'T');
  const [datePart, timePart] = iso.split('T');
  const atMidnight = timePart === '00:00' || timePart === '00:00:00';
  if (atMidnight && tier !== 'senior') return null;
  const wallClock = atMidnight ? `${datePart}T15:30:00` : iso;
  return localWallClockToUtc(wallClock, AR_OFFSET_MINUTES).toISOString();
}

export function parseFixtures(raw: unknown, expectedCompetitionExternalId?: string): ExternalMatch[] {
  const data = parseOrThrow(rawChampionshipDetailSchema, raw, 'championship detail');
  const championship = data.championship[0];
  if (!championship) throw new Error('URBA parser: championship vacío');
  // Etiquetamos con el id que se solicitó (competencia del catálogo), no con el id
  // que la API repita en el payload: URBA puede responder un detalle cuyo id difiere
  // del pedido (por ejemplo wrappers de fase/rueda), lo que corrompe el fixture.
  const competitionExternalId = expectedCompetitionExternalId ?? String(championship.id);
  const seasonYear = championship.season.id;
  const tier = deriveUrbaTaxonomy(championship.name).tier;
  const matches: ExternalMatch[] = [];
  for (const round of championship.rounds) {
    for (const m of round.matches) {
      // URBA modela la fecha libre como un partido 0-0 contra el club sintético
      // "Bye". No es un encuentro deportivo ni debe entrar en la agenda.
      if (isBye(m.local_team) || isBye(m.visit_team)) continue;
      const played = m.fulfilled;
      matches.push({
        externalId: String(m.id),
        competitionExternalId,
        seasonYear,
        round: round.name,
        startsAt: resolveStartsAt(m.playdate, tier),
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
      teamName: p.team.club.name || p.team.name,
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
