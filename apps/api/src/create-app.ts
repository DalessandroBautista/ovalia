import { timingSafeEqual } from 'node:crypto';
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyReply,
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
  countRecentEntriesByOrigin,
  ContestClosedError,
  ContestNotReadyError,
  createSession,
  createUser,
  createVerificationToken,
  consumeVerificationToken,
  deleteSessionByTokenHash,
  deleteSessionsByUserId,
  ArticleTransitionError,
  updateArticleContent,
  featuredPublishedArticle,
  findPublishedArticleBySlug,
  findArticleById,
  findCareerEntryById,
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
  findSessionWithUserByTokenHash,
  findTeamBySlug,
  findUserByEmail,
  findUserById,
  findUpcomingMatches,
  getActiveContest,
  getContestBySlug,
  getContestMatches,
  getContestRanking,
  getUserPredictions,
  getLatestSeason,
  getLineupsForMatch,
  getStandingsForSeason,
  insertCareerEntry,
  listCareerEntries,
  listCompetitions,
  listEditorialQueue,
  listOrganizationsWithCompetitionSlugs,
  listSeasons,
  markUserEmailVerified,
  pingDatabase,
  replaceLineup,
  scoreContest,
  transitionArticleStatus,
  updateUserPassword,
  upsertPrediction,
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
  adminArticleStatusSchema,
  adminArticleContentSchema,
  adminLineupSchema,
  analyticsEventSchema,
  authLoginSchema,
  authRegisterSchema,
  authTokenSchema,
  careerEntryInputSchema,
  careerListQuerySchema,
  competitionMatchesQuerySchema,
  decodeCursor,
  encodeCursor,
  feedbackSchema,
  freshness,
  matchesQuerySchema,
  organizationsQuerySchema,
  predictionBatchSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  standingsQuerySchema,
} from './schemas.js';
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  verifyPassword,
} from './auth.js';

export interface AppDependencies {
  db: Database;
  liveProvider?: LiveProvider;
  sendAuthEmail?: (message: AuthEmailMessage) => Promise<void>;
}

export interface AuthEmailMessage {
  kind: 'verify-email' | 'password-reset';
  to: string;
  token: string;
  expiresAt: Date;
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

function serializeUser(user: { id: string; email: string; displayName: string; role: string; locale: string }) {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, locale: user.locale };
}

function readCookie(headers: Record<string, unknown>, name: string): string | null {
  const raw = headers.cookie;
  if (typeof raw !== 'string') return null;
  for (const part of raw.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=') || null;
  }
  return null;
}

function setSessionCookie(reply: FastifyReply, token: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  reply.header(
    'set-cookie',
    `${SESSION_COOKIE}=${token}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Path=/; HttpOnly; SameSite=Lax${secure}`,
  );
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.header('set-cookie', `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`);
}

// --- Simulador de carrera ---

const URBA_DIVISION_LEVEL: Record<string, number> = {
  'urba-top-14': 1,
  'urba-primera-a': 2,
  'urba-primera-b': 3,
  'urba-primera-c': 4,
  'urba-segunda': 5,
  'urba-tercera': 6,
  'urba-desarrollo': 7,
};

const CAREER_PUBLISH_LIMIT = 3;
const CAREER_PUBLISH_WINDOW_MS = 24 * 60 * 60 * 1000;

type CareerEntryRow = Awaited<ReturnType<typeof insertCareerEntry>>;

function serializeCareerEntry(row: CareerEntryRow) {
  return {
    id: row.id,
    score: row.score,
    displayName: row.displayName,
    summary: row.summary,
    surname: row.surname,
    position: row.position,
    clubSlug: row.clubSlug,
    seed: row.seed,
    decisions: row.decisions,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeCareerEntryDetail(row: CareerEntryRow) {
  return { ...serializeCareerEntry(row), history: row.history };
}

export function configureApp(app: FastifyInstance, dependencies: AppDependencies) {
  const { db } = dependencies;
  const sendAuthEmail = dependencies.sendAuthEmail ?? (async () => undefined);

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

  app.addHook('onRequest', async (request, reply) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
    const origin = request.headers.origin;
    if (!origin) return;
    const allowedOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!allowedOrigins.includes(origin)) {
      await reply.code(403).send({ error: 'csrf_origin_rejected' });
    }
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error, reqId: request.id }, 'request failed');
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    void reply
      .code(status)
      .send({ error: status === 500 ? 'internal_error' : error.message, reqId: request.id });
  });

  async function currentUser(request: { headers: Record<string, unknown> }) {
    const token = readCookie(request.headers, SESSION_COOKIE);
    if (!token) return null;
    const found = await findSessionWithUserByTokenHash(db, hashSessionToken(token));
    return found?.user ?? null;
  }

  async function requireUser(request: { headers: Record<string, unknown> }, reply: FastifyReply) {
    const user = await currentUser(request);
    if (!user) {
      void reply.code(401).send({ error: 'unauthorized' });
      return null;
    }
    return user;
  }

  // --- Autenticación ---
  app.post('/auth/register', async (request, reply) => {
    const parsed = authRegisterSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_registration' });
    const email = normalizeEmail(parsed.data.email);
    if (await findUserByEmail(db, email)) return reply.code(409).send({ error: 'email_in_use' });
    try {
      const user = await createUser(db, {
        email,
        displayName: parsed.data.displayName,
        passwordHash: await hashPassword(parsed.data.password),
      });
      const verificationToken = createSessionToken();
      const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await createVerificationToken(db, {
        identifier: email,
        tokenHash: hashSessionToken(verificationToken),
        purpose: 'email',
        expiresAt: verificationExpiresAt,
      });
      await sendAuthEmail({ kind: 'verify-email', to: email, token: verificationToken, expiresAt: verificationExpiresAt });
      const token = createSessionToken();
      await createSession(db, {
        userId: user.id,
        tokenHash: hashSessionToken(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      });
      setSessionCookie(reply, token);
      return reply.code(201).send({ user: serializeUser(user) });
    } catch (error) {
      if (error instanceof Error && /unique|duplicate/i.test(error.message)) {
        return reply.code(409).send({ error: 'email_in_use' });
      }
      throw error;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const parsed = authLoginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_login' });
    const user = await findUserByEmail(db, normalizeEmail(parsed.data.email));
    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'invalid_credentials' });
    }
    const token = createSessionToken();
    await createSession(db, {
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    setSessionCookie(reply, token);
    return { user: serializeUser(user) };
  });

  app.get('/auth/me', async (request, reply) => {
    const user = await requireUser(request, reply);
    return user ? { user: serializeUser(user) } : reply;
  });

  app.post('/auth/logout', async (request, reply) => {
    const token = readCookie(request.headers, SESSION_COOKIE);
    if (token) await deleteSessionByTokenHash(db, hashSessionToken(token));
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.post('/auth/verify-email', async (request, reply) => {
    const parsed = authTokenSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_verification_token' });
    const verification = await consumeVerificationToken(db, {
      tokenHash: hashSessionToken(parsed.data.token),
      purpose: 'email',
    });
    if (!verification) return reply.code(400).send({ error: 'invalid_verification_token' });
    await markUserEmailVerified(db, verification.identifier);
    return reply.code(204).send();
  });

  app.post('/auth/password-reset/request', async (request, reply) => {
    const parsed = passwordResetRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_password_reset_request' });
    const email = normalizeEmail(parsed.data.email);
    const user = await findUserByEmail(db, email);
    if (user) {
      const token = createSessionToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await createVerificationToken(db, {
        identifier: email,
        tokenHash: hashSessionToken(token),
        purpose: 'password-reset',
        expiresAt,
      });
      await sendAuthEmail({ kind: 'password-reset', to: email, token, expiresAt });
    }
    return reply.code(202).send({ ok: true });
  });

  app.post('/auth/password-reset/confirm', async (request, reply) => {
    const parsed = passwordResetConfirmSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_password_reset' });
    const reset = await consumeVerificationToken(db, {
      tokenHash: hashSessionToken(parsed.data.token),
      purpose: 'password-reset',
    });
    if (!reset) return reply.code(400).send({ error: 'invalid_password_reset' });
    const user = await findUserByEmail(db, reset.identifier);
    if (!user) return reply.code(400).send({ error: 'invalid_password_reset' });
    await updateUserPassword(db, user.id, await hashPassword(parsed.data.password));
    await deleteSessionsByUserId(db, user.id);
    return reply.code(204).send();
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
      homeTeamName: row.home.name,
      awayTeamName: row.away.name,
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

  // --- Prode ---
  async function serializeContest(contest: NonNullable<Awaited<ReturnType<typeof getContestBySlug>>>) {
    const links = await getContestMatches(db, contest.id);
    const matches = await Promise.all(links.map(async (link) => {
      const match = await findMatchById(db, link.matchId);
      return match ? { ordinal: link.ordinal, match: serializeMatch(match) } : null;
    }));
    return {
      slug: contest.slug,
      name: contest.name,
      round: contest.round,
      status: contest.status,
      opensAt: contest.opensAt?.toISOString() ?? null,
      closesAt: contest.closesAt?.toISOString() ?? null,
      matches: matches.filter((row): row is NonNullable<typeof row> => row !== null),
    };
  }

  app.get('/v1/contests/active', async (_request, reply) => {
    const contest = await getActiveContest(db);
    if (!contest) return reply.code(404).send({ error: 'active_contest_not_found' });
    return { contest: await serializeContest(contest) };
  });

  app.get('/v1/contests/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const contest = await getContestBySlug(db, slug);
    if (!contest) return reply.code(404).send({ error: 'contest_not_found' });
    return { contest: await serializeContest(contest) };
  });

  app.get('/v1/contests/:slug/predictions', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    const { slug } = request.params as { slug: string };
    const contest = await getContestBySlug(db, slug);
    if (!contest) return reply.code(404).send({ error: 'contest_not_found' });
    const predictions = await getUserPredictions(db, user.id, contest.id);
    return {
      contest: { slug: contest.slug, closesAt: contest.closesAt?.toISOString() ?? null },
      predictions: predictions.map((prediction) => ({
        matchId: prediction.matchId,
        homeScore: prediction.homeScore,
        awayScore: prediction.awayScore,
        awardedPoints: prediction.awardedPoints,
      })),
    };
  });

  app.put('/v1/contests/:slug/predictions', async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return reply;
    const parsed = predictionBatchSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_predictions' });
    const { slug } = request.params as { slug: string };
    const contest = await getContestBySlug(db, slug);
    if (!contest) return reply.code(404).send({ error: 'contest_not_found' });
    const allowedMatchIds = new Set((await getContestMatches(db, contest.id)).map((link) => link.matchId));
    if (parsed.data.predictions.some((prediction) => !allowedMatchIds.has(prediction.matchId))) {
      return reply.code(400).send({ error: 'match_not_in_contest' });
    }
    try {
      const predictions = await Promise.all(parsed.data.predictions.map((prediction) => upsertPrediction(db, {
        userId: user.id,
        contestId: contest.id,
        ...prediction,
      })));
      return { predictions: predictions.map((prediction) => ({
        matchId: prediction.matchId,
        homeScore: prediction.homeScore,
        awayScore: prediction.awayScore,
        awardedPoints: prediction.awardedPoints,
      })) };
    } catch (error) {
      if (error instanceof ContestClosedError) return reply.code(409).send({ error: 'contest_closed' });
      throw error;
    }
  });

  app.get('/v1/contests/:slug/ranking', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const contest = await getContestBySlug(db, slug);
    if (!contest) return reply.code(404).send({ error: 'contest_not_found' });
    const ranking = await getContestRanking(db, contest.id);
    const rows = await Promise.all(ranking.map(async (entry) => {
      const user = await findUserById(db, entry.userId);
      return { position: entry.position, points: entry.points, user: user ? { displayName: user.displayName } : null };
    }));
    return { contest: { slug: contest.slug }, ranking: rows };
  });

  // --- Admin (sesión con rol editor/admin o token legacy durante la migración) ---
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

  async function requireAdmin(request: { headers: Record<string, unknown> }, reply: FastifyReply) {
    const token = process.env.ADMIN_TOKEN;
    if (token && tokensMatch(request.headers['x-admin-token'], token)) return { id: null, via: 'admin-token' as const };
    const user = await currentUser(request);
    if (user?.role === 'editor' || user?.role === 'admin') return { id: user.id, via: 'session' as const };
    if (!token) {
      void reply.code(503).send({ error: 'admin_disabled', reason: 'ADMIN_TOKEN no configurado' });
      return null;
    }
    void reply.code(401).send({ error: 'unauthorized' });
    return null;
  }

  app.get('/admin/articles', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    const articles = await listEditorialQueue(db, 100);
    return {
      articles: articles.map((article) => ({
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        status: article.status,
        aiGenerated: article.aiGenerated,
        createdAt: article.createdAt.toISOString(),
      })),
    };
  });

  app.get('/admin/articles/:id', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    const { id } = request.params as { id: string };
    const article = await findArticleById(db, id);
    if (!article) return reply.code(404).send({ error: 'article_not_found' });
    return {
      article: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        summary: article.summary,
        body: article.body,
        status: article.status,
        sourceData: article.sourceData,
        aiGenerated: article.aiGenerated,
      },
    };
  });

  app.patch('/admin/articles/:id', async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return reply;
    const { id } = request.params as { id: string };
    const parsed = adminArticleContentSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_article_content' });
    const article = await updateArticleContent(db, id, parsed.data);
    if (!article) return reply.code(404).send({ error: 'article_not_found' });
    await recordAudit(db, {
      action: 'admin.article.edit',
      targetType: 'article',
      targetId: id,
      actorId: actor.id,
      metadata: { via: actor.via },
    });
    return { article: { id: article.id, slug: article.slug, title: article.title, summary: article.summary, body: article.body, status: article.status } };
  });

  app.post('/admin/articles/:id/status', async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return reply;
    const { id } = request.params as { id: string };
    const parsed = adminArticleStatusSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_article_status' });
    try {
      const current = await findArticleById(db, id);
      if (!current) return reply.code(404).send({ error: 'article_not_found' });
      const article = await transitionArticleStatus(db, id, parsed.data.status);
      if (!article) return reply.code(404).send({ error: 'article_not_found' });
      await recordAudit(db, {
        action: 'admin.article.status',
        targetType: 'article',
        targetId: id,
        actorId: actor.id,
        metadata: { from: current.status, to: parsed.data.status, via: actor.via },
      });
      return { article: { id: article.id, slug: article.slug, status: article.status, publishedAt: article.publishedAt?.toISOString() ?? null } };
    } catch (error) {
      if (error instanceof ArticleTransitionError) return reply.code(409).send({ error: 'invalid_article_transition' });
      throw error;
    }
  });

  app.post('/admin/contests/:slug/score', async (request, reply) => {
    const actor = await requireAdmin(request, reply);
    if (!actor) return reply;
    const { slug } = request.params as { slug: string };
    const contest = await getContestBySlug(db, slug);
    if (!contest) return reply.code(404).send({ error: 'contest_not_found' });
    try {
      await scoreContest(db, contest.id);
      await recordAudit(db, {
        action: 'admin.contest.score',
        targetType: 'prediction_contest',
        targetId: contest.id,
        actorId: actor.id,
        metadata: { slug, via: actor.via },
      });
      return { slug, status: 'scored' };
    } catch (error) {
      if (error instanceof ContestNotReadyError) return reply.code(409).send({ error: 'contest_not_ready' });
      throw error;
    }
  });

  app.get('/admin/summary', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    const [openConflicts, failedRuns, pendingDrafts] = await Promise.all([
      countOpenConflicts(db),
      countFailedRuns(db),
      countPendingDrafts(db),
    ]);
    return { openConflicts, failedRuns, pendingDrafts };
  });

  app.get('/admin/conflicts', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
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
    const actor = await requireAdmin(request, reply);
    if (!actor) return reply;
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
      actorId: actor.id,
      metadata: { status, via: actor.via },
    });
    return { id, status };
  });

  // --- Admin: Lineups (Tramo C) ---

  app.post('/admin/matches/:id/lineups', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return reply;
    const { id } = request.params as { id: string };

    const match = await findMatchById(db, id);
    if (!match) return reply.code(404).send({ error: 'match_not_found' });

    // Una formación es una lista de nombres de personas identificables: nunca
    // se cargan datos de menores (AGENTS.md), y esto ahora se aplica técnicamente
    // por el tier de la competencia, no solo por convención operativa.
    if (match.competitionTier !== 'senior') {
      return reply.code(403).send({ error: 'youth_category_not_allowed' });
    }

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

  // --- Simulador de carrera ---

  app.get('/v1/career/clubs', async () => {
    const byLevel = new Map<string, { slug: string; name: string; level: number; badgeUrl: string | null }>();
    for (const [slug, level] of Object.entries(URBA_DIVISION_LEVEL)) {
      const competition = await findCompetitionBySlug(db, slug);
      if (!competition) continue;
      const season = await getLatestSeason(db, competition.id);
      if (!season) continue;
      const rows = await getStandingsForSeason(db, season.id);
      for (const row of rows) {
        const current = byLevel.get(row.teamSlug);
        if (!current || level < current.level) {
          byLevel.set(row.teamSlug, { slug: row.teamSlug, name: row.teamName, level, badgeUrl: row.teamBadgeUrl });
        }
      }
    }
    return { clubs: [...byLevel.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)) };
  });

  app.post('/v1/career/entries', async (request, reply) => {
    const parsed = careerEntryInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_career_entry', issues: parsed.error.issues });
    const data = parsed.data;

    // La vía con cuenta llega con el Hito 10: cuando el plugin de sesión exista,
    // este handler resuelve userId desde la sesión y deja de confiar en el apodo.
    const since = new Date(Date.now() - CAREER_PUBLISH_WINDOW_MS);
    const recent = await countRecentEntriesByOrigin(db, data.originKey, since);
    if (recent >= CAREER_PUBLISH_LIMIT) {
      return reply.code(429).send({ error: 'too_many_career_posts' });
    }

    const row = await insertCareerEntry(db, data);
    return reply.code(201).send({ entry: serializeCareerEntry(row) });
  });

  app.get('/v1/career/entries', async (request) => {
    const parsed = careerListQuerySchema.safeParse(request.query);
    const limit = parsed.success ? parsed.data.limit : 20;
    const rows = await listCareerEntries(db, { limit });
    return { entries: rows.map(serializeCareerEntry) };
  });

  app.get('/v1/career/entries/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await findCareerEntryById(db, id);
    if (!row) return reply.code(404).send({ error: 'career_entry_not_found' });
    return { entry: serializeCareerEntryDetail(row) };
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
