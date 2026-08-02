import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { contestMatches } from '@ovalia/database';
import { getTestDatabase, isDatabaseAvailable, makeCompetition, makeContest, makeMatch, makeSeason, makeTeam, truncateAll } from '@ovalia/database/test-support';
import { buildApp } from './create-app';

const available = await isDatabaseAvailable();

describe.skipIf(!available)('contest routes', () => {
  let handle: Awaited<ReturnType<typeof getTestDatabase>>;
  const apps: Array<ReturnType<typeof buildApp>> = [];

  beforeEach(async () => {
    handle = await getTestDatabase();
    await truncateAll(handle);
  });

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
    if (available) await handle.pool.end().catch(() => undefined);
  });

  it('expone el concurso activo y guarda pronósticos solo para sus partidos', async () => {
    const competition = await makeCompetition(handle.db);
    const season = await makeSeason(handle.db, competition.id);
    const home = await makeTeam(handle.db);
    const away = await makeTeam(handle.db);
    const match = await makeMatch(handle.db, { seasonId: season.id, homeTeamId: home.id, awayTeamId: away.id });
    const contest = await makeContest(handle.db, {
      slug: 'fecha-1',
      status: 'open',
      closesAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await handle.db.insert(contestMatches).values({ contestId: contest.id, matchId: match.id, ordinal: 1 });

    const app = buildApp({ logger: false }, { db: handle.db });
    apps.push(app);
    const registered = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'prode@example.test', displayName: 'Prode', password: 'clave-segura' },
    });
    const cookie = registered.headers['set-cookie'];
    const active = await app.inject({ method: 'GET', url: '/v1/contests/active' });
    expect(active.statusCode).toBe(200);
    expect(active.json().contest.slug).toBe('fecha-1');
    expect(active.json().contest.matches[0].match.id).toBe(match.id);

    const saved = await app.inject({
      method: 'PUT',
      url: '/v1/contests/fecha-1/predictions',
      headers: { cookie },
      payload: { predictions: [{ matchId: match.id, homeScore: 24, awayScore: 21 }] },
    });
    expect(saved.statusCode).toBe(200);
    const mine = await app.inject({ method: 'GET', url: '/v1/contests/fecha-1/predictions', headers: { cookie } });
    expect(mine.statusCode).toBe(200);
    expect(mine.json().predictions[0].homeScore).toBe(24);
  });

  it('permite puntuar un concurso cerrado desde el admin y publica su ranking', async () => {
    const competition = await makeCompetition(handle.db);
    const season = await makeSeason(handle.db, competition.id);
    const home = await makeTeam(handle.db);
    const away = await makeTeam(handle.db);
    const match = await makeMatch(handle.db, {
      seasonId: season.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      status: 'final',
      homeScore: 24,
      awayScore: 18,
    });
    const contest = await makeContest(handle.db, {
      slug: 'fecha-final',
      status: 'open',
      closesAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await handle.db.insert(contestMatches).values({ contestId: contest.id, matchId: match.id, ordinal: 1 });
    const app = buildApp({ logger: false }, { db: handle.db });
    apps.push(app);
    const registered = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'score@example.test', displayName: 'Scorer', password: 'clave-segura' },
    });
    const cookie = registered.headers['set-cookie'];
    await app.inject({
      method: 'PUT',
      url: '/v1/contests/fecha-final/predictions',
      headers: { cookie },
      payload: { predictions: [{ matchId: match.id, homeScore: 24, awayScore: 18 }] },
    });
    await handle.pool.query('UPDATE prediction_contests SET status = \'closed\' WHERE id = $1', [contest.id]);
    process.env.ADMIN_TOKEN = 'test-admin-token';

    const scored = await app.inject({
      method: 'POST',
      url: '/admin/contests/fecha-final/score',
      headers: { 'x-admin-token': 'test-admin-token' },
    });
    expect(scored.statusCode).toBe(200);
    expect(scored.json().status).toBe('scored');
    expect((await app.inject({ method: 'GET', url: '/v1/contests/fecha-final/ranking' })).json().ranking[0].points).toBe(5);
  });
});
