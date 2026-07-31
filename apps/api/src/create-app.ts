import { timingSafeEqual } from 'node:crypto';
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import {
  countActiveTeams,
  countCoveredCompetitions,
  countFailedRuns,
  countOpenConflicts,
  countPendingDrafts,
  featuredPublishedArticle,
  findPublishedArticleBySlug,
  listOpenConflicts,
  listPublishedArticles,
  recordAudit,
  recordEvent,
  recordFeedback,
  resolveConflict,
  findCompetitionBySlug,
  findMatchById,
  findMatchesByCompetition,
  findMatchesInRange,
  findPastMatchesForTeams,
  createPlayer,
  findPlayerById,
  searchPlayersByName,
  findSeason,
  findTeamBySlug,
  findUpcomingMatches,
  getActiveContest,
  getLatestSeason,
  getLineupsForMatch,
  getStandingsForSeason,
  listCompetitions,
  listOrganizationsWithCompetitionSlugs,
  listSeasons,
  pingDatabase,
  replaceLineup,
  type Database,
} from '@ovalia/database';
import { buildHeadToHead, buildRecentForm, findTeamPosition, normalizePlayerName } from '@ovalia/domain';
import {
  createConfiguredLiveProvider,
  createLiveFeedService,
  readLiveFeedCacheTtl,
  type LiveProvider,
} from './live/live-feed.js';
import {
  adminConflictResolutionSchema,
  adminLineupSchema,
  analyticsEventSchema,
  competitionMatchesQuerySchema,
  decodeCursor,
  encodeCursor,
  feedbackSchema,
  freshness,
  matchesQuerySchema,
  organizationsQuerySchema,
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

export function configureApp(app: FastifyInstance, dependencies: AppDependencies) {
  const { db } = dependencies;

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
  app.get('/ready', async (request, reply) => {
    try {
      await pingDatabase(db);
      return { status: 'ready' };
    } catch (error) {
      request.log.error({ err: error }, 'database ping failed');
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

  app.get('/v1/matches/upcoming', async (request) => {
    const query = request.query as Record<string, string>;
    const limit = Math.min(Number(query.limit) || 5, 20);
    const now = new Date();
    const rows = await findUpcomingMatches(db, { limit, now });
    return {
      generatedAt: now.toISOString(),
      matches: rows.map((m) => serializeMatch(m as NonNullable<MatchRow>)),
    };
  });

  app.get('/v1/matches/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const match = await findMatchById(db, id);
    if (!match) return reply.code(404).send({ error: 'match_not_found' });
    return { match: serializeMatch(match) };
  });

  app.get('/v1/matches/:id/context', async (request, reply) => {
    const { id } = request.params as { id: string };
    const match = await findMatchById(db, id);
    if (!match) return reply.code(404).send({ error: 'match_not_found' });

    const [pastRows, standingRows] = await Promise.all([
      findPastMatchesForTeams(db, {
        teamIds: [match.home.id, match.away.id],
        before: match.startsAt,
        competitionSlug: match.competitionSlug,
      }),
      getStandingsForSeason(db, match.seasonId),
    ]);
    const past = pastRows.map((row) => ({
      id: row.id,
      startsAt: row.startsAt.toISOString(),
      homeTeamSlug: row.home.slug,
      awayTeamSlug: row.away.slug,
      homeScore: row.homeScore ?? 0,
      awayScore: row.awayScore ?? 0,
    }));

    return {
      headToHead: buildHeadToHead({
        homeTeamSlug: match.home.slug,
        awayTeamSlug: match.away.slug,
        matches: past,
      }),
      form: {
        home: buildRecentForm({ teamSlug: match.home.slug, matches: past }),
        away: buildRecentForm({ teamSlug: match.away.slug, matches: past }),
      },
      standings: {
        home: findTeamPosition(standingRows, match.home.slug),
        away: findTeamPosition(standingRows, match.away.slug),
      },
    };
  });

  // --- Lineups (Tramo C) ---

  app.get('/v1/matches/:id/lineups', async (request, reply) => {
    const { id } = request.params as { id: string };
    const match = await findMatchById(db, id);
    if (!match) return reply.code(404).send({ error: 'match_not_found' });

    const lineups = await getLineupsForMatch(db, id);
    return {
      home: lineups.home.map((e) => ({
        shirtNumber: e.shirtNumber,
        isStarter: e.isStarter,
        isCaptain: e.isCaptain,
        player: { slug: e.player.slug, fullName: e.player.fullName },
      })),
      away: lineups.away.map((e) => ({
        shirtNumber: e.shirtNumber,
        isStarter: e.isStarter,
        isCaptain: e.isCaptain,
        player: { slug: e.player.slug, fullName: e.player.fullName },
      })),
    };
  });

  // --- Competencias ---
  app.get('/v1/organizations', async (request, reply) => {
    const parsed = organizationsQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_query', issues: parsed.error.issues });
    const organizations = await listOrganizationsWithCompetitionSlugs(db, parsed.data);
    return { organizations };
  });

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
        organization: c.organization ? { slug: c.organization.slug, name: c.organization.name } : null,
        familySlug: c.familySlug,
        tier: c.tier,
        priority: c.priority,
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
        familySlug: competition.familySlug,
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
        team: { slug: r.teamSlug, name: r.teamName, badgeUrl: r.teamBadgeUrl },
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

  // --- Jugadores (Tramo C) ---
  app.get('/v1/players/search', async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.length < 3) return reply.code(400).send({ error: 'query_too_short' });
    const rows = await searchPlayersByName(db, { query: q });
    return {
      players: rows.map((p) => ({ id: p.id, slug: p.slug, fullName: p.fullName, normalizedName: p.normalizedName })),
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

  // --- Noticias (solo publicadas) ---
  app.get('/v1/articles', async () => {
    const articles = await listPublishedArticles(db, { limit: 30 });
    return {
      articles: articles.map((a) => ({
        slug: a.slug,
        title: a.title,
        summary: a.summary,
        publishedAt: a.publishedAt?.toISOString() ?? null,
      })),
    };
  });

  app.get('/v1/articles/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const article = await findPublishedArticleBySlug(db, slug);
    if (!article) return reply.code(404).send({ error: 'article_not_found' });
    return {
      article: {
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        body: article.body,
        publishedAt: article.publishedAt?.toISOString() ?? null,
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

  // --- Analytics y feedback (anónimo, sin PII obligatoria) ---
  app.post('/v1/events', async (request, reply) => {
    const parsed = analyticsEventSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_event' });
    await recordEvent(db, parsed.data);
    return reply.code(202).send({ ok: true });
  });

  app.post('/v1/feedback', async (request, reply) => {
    const parsed = feedbackSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_feedback' });
    await recordFeedback(db, parsed.data);
    return reply.code(201).send({ ok: true });
  });

  // --- Admin (deny por defecto; protegido por token mínimo hasta auth real en Hito 10) ---
  function tokensMatch(provided: unknown, expected: string): boolean {
    if (typeof provided !== 'string') return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    // Comparación en tiempo constante: iguala longitudes antes de comparar.
    if (a.length !== b.length) {
      timingSafeEqual(b, b);
      return false;
    }
    return timingSafeEqual(a, b);
  }

  function requireAdmin(request: { headers: Record<string, unknown> }, reply: {
    code: (n: number) => { send: (b: unknown) => unknown };
  }): boolean {
    const token = process.env.ADMIN_TOKEN;
    if (!token) {
      reply.code(503).send({ error: 'admin_disabled', reason: 'ADMIN_TOKEN no configurado' });
      return false;
    }
    if (!tokensMatch(request.headers['x-admin-token'], token)) {
      reply.code(401).send({ error: 'unauthorized' });
      return false;
    }
    return true;
  }

  app.get('/admin/summary', async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    const [openConflicts, failedRuns, pendingDrafts] = await Promise.all([
      countOpenConflicts(db),
      countFailedRuns(db),
      countPendingDrafts(db),
    ]);
    return { openConflicts, failedRuns, pendingDrafts };
  });

  app.get('/admin/conflicts', async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    const conflicts = await listOpenConflicts(db, 100);
    return {
      conflicts: conflicts.map((c) => ({
        id: c.id,
        entityType: c.entityType,
        reason: c.reason,
        candidates: c.candidates,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  });

  app.post('/admin/conflicts/:id/resolve', async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    const { id } = request.params as { id: string };
    const parsed = adminConflictResolutionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_resolution' });
    const { status, resolution } = parsed.data;
    const row = await resolveConflict(db, id, { status, resolution });
    if (!row) return reply.code(404).send({ error: 'conflict_not_found' });
    await recordAudit(db, {
      action: 'admin.conflict.resolve',
      targetType: 'ingestion_conflict',
      targetId: id,
      // Sin identidad de usuario todavía (token-only); se atribuye el método.
      // El actor real se registra cuando exista auth/RBAC (Hito 10).
      metadata: { status, via: 'admin-token' },
    });
    return { id, status };
  });

  // --- Admin: Lineups (Tramo C) ---

  app.post('/admin/matches/:id/lineups', async (request, reply) => {
    if (!requireAdmin(request, reply)) return reply;
    const { id } = request.params as { id: string };

    const match = await findMatchById(db, id);
    if (!match) return reply.code(404).send({ error: 'match_not_found' });

    const parsed = adminLineupSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_lineup', issues: parsed.error.issues });

    const teamId = parsed.data.side === 'home' ? match.home.id : match.away.id;

    // Verificar que cada playerId provisto por el cliente exista de verdad: un UUID
    // inexistente rompería la FK con un 500 en vez de un 400 claro.
    for (const entry of parsed.data.entries) {
      if (entry.playerId && !(await findPlayerById(db, entry.playerId))) {
        return reply.code(400).send({ error: 'unknown_player' });
      }
    }

    // Resolver o crear jugadores. Sin playerId explícito, siempre se crea una
    // persona nueva: la carga nunca fusiona homónimos por su cuenta (ver spec).
    const resolvedEntries: Array<{ playerId: string; shirtNumber: number; isStarter: boolean; isCaptain: boolean }> = [];
    for (const entry of parsed.data.entries) {
      let playerId = entry.playerId;
      if (!playerId) {
        const normalizedName = normalizePlayerName(entry.name);
        const player = await createPlayer(db, { fullName: entry.name, normalizedName });
        playerId = player.id;
      }
      resolvedEntries.push({
        playerId,
        shirtNumber: entry.shirtNumber,
        isStarter: entry.shirtNumber <= 15,
        isCaptain: entry.isCaptain,
      });
    }

    await replaceLineup(db, {
      matchId: id,
      teamId,
      entries: resolvedEntries,
    });

    await recordAudit(db, {
      action: 'admin.lineup.save',
      targetType: 'match_lineup',
      targetId: id,
      metadata: { side: parsed.data.side, count: parsed.data.entries.length, via: 'admin-token' },
    });

    return { ok: true, matchId: id, side: parsed.data.side };
  });

  return app;
}

export function buildApp(
  options: FastifyServerOptions = {},
  dependencies: AppDependencies,
) {
  const app = Fastify({ genReqId: () => crypto.randomUUID(), ...options });
  return configureApp(app, dependencies);
}
