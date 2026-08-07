import { z } from 'zod';
import type { ExternalMatch, ExternalStandings, ExternalTeam } from '@ovalia/domain';

const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  logo: z.string().nullable().optional(),
});

const matchSchema = z.object({
  id: z.union([z.number(), z.string()]),
  date: z.string(),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
  league: z.object({ id: z.number(), name: z.string(), season: z.number() }),
  state: z.object({ description: z.string(), score: z.string().nullable() }),
});

const matchesResponseSchema = z.object({ data: z.array(matchSchema) });

const standingsGroupSchema = z.object({
  name: z.string().nullable().optional(),
  standings: z.array(
    z.object({
      team: z.object({ id: z.number(), name: z.string(), logo: z.string().nullable().optional() }),
      wins: z.number().int().nullable().default(0),
      loses: z.number().int().nullable().default(0),
      draws: z.number().int().nullable().default(0),
      position: z.number().int().nullable().optional(),
      points: z.number().int().nullable().default(0),
      gamesPlayed: z.number().int().nullable().default(0),
      scoredPoints: z.number().int().nullable().default(0),
      receivedPoints: z.number().int().nullable().default(0),
    }),
  ),
});

const standingsResponseSchema = z.object({
  groups: z.array(standingsGroupSchema),
  league: z.object({ id: z.number(), season: z.number() }),
});

function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown, label: string): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Highlightly parser: respuesta inválida de ${label}: ${result.error.message}`);
  }
  return result.data;
}

function matchStatus(m: z.infer<typeof matchSchema>): ExternalMatch['status'] {
  const description = m.state.description.toLowerCase();
  if (description === 'finished') return 'final';
  if (['first half', 'second half', 'half time', 'extra time'].includes(description)) return 'live';
  if (description === 'postponed' || description === 'suspended') return 'postponed';
  if (description === 'cancelled') return 'cancelled';
  return 'scheduled';
}

function parseScore(score: string | null): [number | null, number | null] {
  if (!score) return [null, null];
  const parts = score.split('-').map((v) => Number(v.trim()));
  const [home, away] = parts;
  if (!Number.isFinite(home) || !Number.isFinite(away)) return [null, null];
  return [home!, away!];
}

/** Partidos crudos de Highlightly → contrato interno. `competitionExternalId` se pasa
 * explícito porque `league.id` en la respuesta puede no coincidir 1:1 con el leagueId
 * pedido (Highlightly a veces agrupa sub-torneos bajo el mismo league.id consultado). */
export function parseMatchesAsFixtures(raw: unknown, competitionExternalId: string): ExternalMatch[] {
  const data = parseOrThrow(matchesResponseSchema, raw, 'matches');
  return data.data.map((m): ExternalMatch => {
    const [homeScore, awayScore] = parseScore(m.state.score);
    return {
      externalId: String(m.id),
      competitionExternalId,
      seasonYear: m.league.season,
      round: 'Fecha',
      startsAt: m.date,
      status: matchStatus(m),
      homeTeamExternalId: String(m.homeTeam.id),
      awayTeamExternalId: String(m.awayTeam.id),
      homeScore,
      awayScore,
    };
  });
}

export function parseMatchesAsTeams(raw: unknown): ExternalTeam[] {
  const data = parseOrThrow(matchesResponseSchema, raw, 'matches');
  const byId = new Map<string, ExternalTeam>();
  for (const m of data.data) {
    for (const team of [m.homeTeam, m.awayTeam]) {
      const externalId = String(team.id);
      if (!byId.has(externalId)) {
        byId.set(externalId, {
          externalId,
          name: team.name,
          ...(team.logo ? { badgeUrl: team.logo, badgeSourceUrl: team.logo } : {}),
        });
      }
    }
  }
  return [...byId.values()];
}

/** Tabla de posiciones de Highlightly. Puede venir en uno o varios grupos
 * (conferencias/zonas). Algunas competencias (series de tests, por ejemplo)
 * devuelven `groups: []` — se persiste como "sin filas todavía", no como error. */
export function parseStandingsPayload(raw: unknown, competitionExternalId: string, seasonYear: number): ExternalStandings {
  const data = parseOrThrow(standingsResponseSchema, raw, 'standings');
  const rows = data.groups.flatMap((group) =>
    group.standings.map((entry): ExternalStandings['rows'][number] => ({
      teamExternalId: String(entry.team.id),
      teamName: entry.team.name,
      position: entry.position ?? undefined,
      played: entry.gamesPlayed ?? 0,
      won: entry.wins ?? 0,
      drawn: entry.draws ?? 0,
      lost: entry.loses ?? 0,
      pointsFor: entry.scoredPoints ?? 0,
      pointsAgainst: entry.receivedPoints ?? 0,
      bonus: 0,
      points: entry.points ?? 0,
    })),
  );
  return {
    competitionExternalId,
    seasonYear,
    rows,
  };
}
