import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import {
  countActiveTeams,
  countCoveredCompetitions,
  featuredPublishedArticle,
  findCompetitionBySlug,
  findMatchById,
  findMatchesByCompetition,
  findMatchesInRange,
  findSeason,
  findTeamBySlug,
  getActiveContest,
  getLatestSeason,
  getStandingsForSeason,
  listCompetitions,
  listSeasons,
  pingDatabase,
  type Database,
} from '@ovalia/database';
import {
  createConfiguredLiveProvider,
  createLiveFeedService,
  readLiveFeedCacheTtl,
  type LiveProvider,
} from './live/live-feed.js';
import {
  competitionMatchesQuerySchema,
  decodeCursor,
  encodeCursor,
  freshness,
  matchesQuerySchema,
  standingsQuerySchema,
} from './schemas.js';

export interface AppDependencies {
  db: Database;
  liveProvider?: LiveProvider;
}

type MatchRow = Awaited<ReturnType<typeof findMatchById>>;

function serializeMatch(row: NonNullable<MatchRow>) {
  return {
    id: row.id,
    competition: { slug: row.competitionSlug, name: row.competitionName },
    season: row.seasonYear,
    round: row.round,
    startsAt: row.startsAt.toISOString(),
    venue: row.venue,
    status: row.status,
    home: { slug: row.home.slug, name: row.home.name, shortName: row.home.shortName, badgeUrl: row.home.badgeUrl },
    away: { slug: row.away.slug, name: row.away.name, shortName: row.away.shortName, badgeUrl: row.away.badgeUrl },
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    source: row.source,
    freshness: freshness(row.fetchedAt),
  };
}

export function buildApp(options: FastifyServerOptions = {}, dependencies: AppDependencies) {
  const { db } = dependencies;
  const app = Fastify({ genReqId: () => crypto.randomUUID(), ...options });

  const liveFeed = createLiveFeedService(
    dependencies.liveProvider ?? createConfiguredLiveProvider(),
    { cacheTtlMs: readLiveFeedCacheTtl() },
  );

  void app.register(helmet);
  void app.register(cors, {
    origin: (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',').map((o) => o.trim()),
    credentials: true,
  });
  void app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 120),
    timeWindow: process.env.RATE_LIMIT_WINDOW ?? '1 minute',
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error, reqId: request.id }, 'request failed');
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    void reply
      .code(status)
      .send({ error: status === 500 ? 'internal_error' : error.message, reqId: request.id });
  });

  // --- Salud ---
  app.get('/health', async () => ({ service: 'ovalia-api', status: 'ok' }));
  app.get('/ready', async (_request, reply) => {
    try {
      await pingDatabase(db);
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'unavailable', reason: 'database' });
    }
  });

  // --- Live ---
  app.get('/v1/live', async () => liveFeed.getLiveMatches());

  // --- Partidos ---
  app.get('/v1/matches', async (request, reply) => {
    const query = request.query as Record<string, string>;
    if (query.status === 'live') {
      const feed = await liveFeed.getLiveMatches();
      return { generatedAt: feed.generatedAt, source: feed.source, matches: feed.matches };
    }
    const parsed = matchesQuerySchema.safeParse(query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query', issues: parsed.error.issues });
    const now = new Date();
    const from = parsed.data.from ? new Date(parsed.data.from) : new Date(now.getTime() - 7 * 864e5);
    const to = parsed.data.to ? new Date(parsed.data.to) : new Date(now.getTime() + 30 * 864e5);
    const result = await findMatchesInRange(db, {
      from,
      to,
      competitionSlug: parsed.data.competition,
      status: parsed.data.status,
      limit: parsed.data.limit,
      cursor: decodeCursor(parsed.data.cursor),
    });
    return {
      generatedAt: now.toISOString(),
      matches: result.matches.map((m) => serializeMatch(m as NonNullable<MatchRow>)),
      nextCursor: encodeCursor(result.nextCursor),
    };
  });

  app.get('/v1/matches/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const match = await findMatchById(db, id);
    if (!match) return reply.code(404).send({ error: 'match_not_found' });
    return { match: serializeMatch(match) };
  });

  // --- Competencias ---
  app.get('/v1/competitions', async () => {
    const competitions = await listCompetitions(db);
    return {
      competitions: competitions.map((c) => ({
        slug: c.slug,
        name: c.name,
        category: c.category,
        gender: c.gender,
        countryCode: c.countryCode,
        coverage: c.coverage,
      })),
    };
  });

  app.get('/v1/competitions/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const competition = await findCompetitionBySlug(db, slug);
    if (!competition) return reply.code(404).send({ error: 'competition_not_found' });
    const seasons = await listSeasons(db, competition.id);
    return {
      competition: {
        slug: competition.slug,
        name: competition.name,
        category: competition.category,
        gender: competition.gender,
        coverage: competition.coverage,
        seasons: seasons.map((s) => ({ year: s.year, name: s.name })),
      },
    };
  });

  app.get('/v1/competitions/:slug/standings', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const parsed = standingsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    const competition = await findCompetitionBySlug(db, slug);
    if (!competition) return reply.code(404).send({ error: 'competition_not_found' });
    const season = parsed.data.season
      ? await findSeason(db, competition.id, parsed.data.season)
      : await getLatestSeason(db, competition.id);
    if (!season) return reply.code(404).send({ error: 'season_not_found' });
    const rows = await getStandingsForSeason(db, season.id);
    return {
      competition: { slug: competition.slug, name: competition.name },
      season: season.year,
      rows: rows.map((r, index) => ({
        position: index + 1,
        team: { slug: r.teamSlug, name: r.teamName },
        played: r.played,
        won: r.won,
        drawn: r.drawn,
        lost: r.lost,
        pointsFor: r.pointsFor,
        pointsAgainst: r.pointsAgainst,
        bonus: r.bonus,
        points: r.points,
      })),
      source: rows[0]?.source ?? null,
      freshness: freshness(rows[0]?.fetchedAt),
    };
  });

  app.get('/v1/competitions/:slug/matches', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const parsed = competitionMatchesQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query' });
    const result = await findMatchesByCompetition(db, {
      competitionSlug: slug,
      seasonYear: parsed.data.season,
      round: parsed.data.round,
      limit: parsed.data.limit,
      cursor: decodeCursor(parsed.data.cursor),
    });
    return {
      matches: result.matches.map((m) => serializeMatch(m as NonNullable<MatchRow>)),
      nextCursor: encodeCursor(result.nextCursor),
    };
  });

  // --- Equipos ---
  app.get('/v1/teams/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const team = await findTeamBySlug(db, slug);
    if (!team) return reply.code(404).send({ error: 'team_not_found' });
    return {
      team: {
        slug: team.slug,
        name: team.name,
        shortName: team.shortName,
        countryCode: team.countryCode,
        union: team.union,
        badgeUrl: team.badgeUrl,
      },
    };
  });

  // --- Portada: agregados reales ---
  app.get('/v1/home', async () => {
    const [coveredCompetitions, activeTeams, feed, contest, article] = await Promise.all([
      countCoveredCompetitions(db),
      countActiveTeams(db),
      liveFeed.getLiveMatches(),
      getActiveContest(db),
      featuredPublishedArticle(db),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      stats: {
        competitions: coveredCompetitions,
        clubs: activeTeams,
        live: feed.matches.length,
      },
      contest: contest
        ? { slug: contest.slug, name: contest.name, round: contest.round, closesAt: contest.closesAt?.toISOString() ?? null }
        : null,
      featuredArticle: article
        ? { slug: article.slug, title: article.title, summary: article.summary, publishedAt: article.publishedAt?.toISOString() ?? null }
        : null,
    };
  });

  return app;
}
