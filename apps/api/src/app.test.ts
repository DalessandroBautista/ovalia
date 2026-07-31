import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from '@ovalia/database';
import {
  createConflict,
  createDraft,
  createPlayer,
  linkCompetitionOrganization,
  replaceLineup,
  replaceStandings,
  setArticleStatus,
  upsertCompetition,
  upsertMatchByNaturalKey,
  upsertOrganization,
} from '@ovalia/database';
import {
  getTestDatabase,
  isDatabaseAvailable,
  makeCompetition,
  makeSeason,
  makeTeam,
  truncateAll,
} from '@ovalia/database/test-support';
import { normalizePlayerName } from '@ovalia/domain';
import { buildApp } from './create-app';

const available = await isDatabaseAvailable();

describe.skipIf(!available)('API real', () => {
  let handle: DatabaseHandle;
  const apps: Array<ReturnType<typeof buildApp>> = [];

  beforeEach(async () => {
    handle = await getTestDatabase();
    await truncateAll(handle);
  });

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
    if (available) await handle.pool.end().catch(() => undefined);
  });

  function makeAppFor() {
    const app = buildApp({ logger: false }, { db: handle.db });
    apps.push(app);
    return app;
  }

  async function seedCompetition() {
    const { db } = handle;
    const competition = await makeCompetition(db, { slug: 'urba-top-14', name: 'URBA Top 14' });
    const season = await makeSeason(db, competition.id, { year: 2026 });
    const sic = await makeTeam(db, { slug: 'sic', name: 'SIC', badgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png' });
    const hindu = await makeTeam(db, { slug: 'hindu', name: 'Hindú' });
    const current = await upsertMatchByNaturalKey(db, {
      seasonId: season.id,
      round: 'Fecha 1',
      startsAt: new Date('2026-08-01T18:00:00Z'),
      homeTeamId: sic.id,
      awayTeamId: hindu.id,
      status: 'final',
      homeScore: 24,
      awayScore: 21,
      source: 'urba',
    });
    await replaceStandings(
      db,
      season.id,
      [
        { teamId: sic.id, played: 1, won: 1, drawn: 0, lost: 0, pointsFor: 24, pointsAgainst: 21, bonus: 0, points: 4 },
        { teamId: hindu.id, played: 1, won: 0, drawn: 0, lost: 1, pointsFor: 21, pointsAgainst: 24, bonus: 1, points: 1 },
      ],
      'urba',
    );
    return { competition, season, sic, hindu, current: current.match };
  }

  it('/health y /ready responden', async () => {
    const app = makeAppFor();
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    const ready = await app.inject({ method: 'GET', url: '/ready' });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: 'ready' });
  });

  it('sirve partidos reales desde PostgreSQL con rango', async () => {
    await seedCompetition();
    const app = makeAppFor();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/matches?from=2026-07-01T00:00:00Z&to=2026-09-01T00:00:00Z',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0]).toMatchObject({
      competition: { slug: 'urba-top-14' },
      home: { slug: 'sic' },
      status: 'final',
      homeScore: 24,
    });
    expect(body.matches[0].freshness).toBe('fresh');
  });

  it('valida query inválida con 400', async () => {
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/matches?from=no-fecha' });
    expect(res.statusCode).toBe(400);
  });

  it('devuelve el detalle real de un partido por id', async () => {
    await seedCompetition();
    const app = makeAppFor();
    const list = await app.inject({ method: 'GET', url: '/v1/matches' });
    const id = list.json().matches[0].id;
    const detail = await app.inject({ method: 'GET', url: `/v1/matches/${id}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().match.away.name).toBe('Hindú');
  });

  it('404 para un partido inexistente', async () => {
    const app = makeAppFor();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/matches/00000000-0000-0000-0000-000000000000',
    });
    expect(res.statusCode).toBe(404);
  });

  it('devuelve 404 para el contexto de un partido inexistente', async () => {
    const app = makeAppFor();
    const response = await app.inject({
      method: 'GET',
      url: '/v1/matches/00000000-0000-0000-0000-000000000000/context',
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'match_not_found' });
  });

  it('devuelve historial, forma y posiciones de un partido existente', async () => {
    const { db } = handle;
    const seeded = await seedCompetition();
    await upsertMatchByNaturalKey(db, {
      seasonId: seeded.season.id,
      round: 'Fecha anterior',
      startsAt: new Date('2026-07-01T18:00:00Z'),
      homeTeamId: seeded.hindu.id,
      awayTeamId: seeded.sic.id,
      status: 'final',
      homeScore: 10,
      awayScore: 20,
      source: 'urba',
    });

    const app = makeAppFor();
    const response = await app.inject({
      method: 'GET',
      url: `/v1/matches/${seeded.current.id}/context`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      headToHead: { played: 1, homeWins: 1, awayWins: 0, draws: 0 },
      form: { home: ['win'], away: ['loss'] },
      standings: {
        home: { position: 1, points: 4, played: 1 },
        away: { position: 2, points: 1, played: 1 },
      },
    });
  });

  it('el historial y la forma reciente no mezclan partidos de otra competencia (mismo club, otra división)', async () => {
    const { db } = handle;
    const seeded = await seedCompetition();
    const otraCompetencia = await makeCompetition(db, { slug: 'urba-top-14-intermedia', name: 'URBA Top 14 Intermedia' });
    const otraSeason = await makeSeason(db, otraCompetencia.id, { year: 2026 });
    // Mismo par de equipos (SIC/Hindú), pero en otra división: no debe contar en el historial.
    await upsertMatchByNaturalKey(db, {
      seasonId: otraSeason.id,
      round: 'Fecha anterior',
      startsAt: new Date('2026-07-01T18:00:00Z'),
      homeTeamId: seeded.hindu.id,
      awayTeamId: seeded.sic.id,
      status: 'final',
      homeScore: 10,
      awayScore: 20,
      source: 'urba',
    });

    const app = makeAppFor();
    const response = await app.inject({
      method: 'GET',
      url: `/v1/matches/${seeded.current.id}/context`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      headToHead: { played: 0, homeWins: 0, awayWins: 0, draws: 0, recent: [] },
      form: { home: [], away: [] },
    });
  });

  it('el historial incluye el nombre de cada equipo, no solo el identificador', async () => {
    const { db } = handle;
    const seeded = await seedCompetition();
    await upsertMatchByNaturalKey(db, {
      seasonId: seeded.season.id,
      round: 'Fecha anterior',
      startsAt: new Date('2026-07-01T18:00:00Z'),
      homeTeamId: seeded.hindu.id,
      awayTeamId: seeded.sic.id,
      status: 'final',
      homeScore: 10,
      awayScore: 20,
      source: 'urba',
    });

    const app = makeAppFor();
    const response = await app.inject({
      method: 'GET',
      url: `/v1/matches/${seeded.current.id}/context`,
    });

    expect(response.statusCode).toBe(200);
    const [recent] = response.json().headToHead.recent;
    expect(recent).toMatchObject({ homeTeamName: 'Hindú', awayTeamName: 'SIC' });
  });

  it('sirve próximos partidos importantes en /v1/matches/upcoming', async () => {
    const { db } = handle;
    const important = await makeCompetition(db, { slug: 'urba-top-14', priority: 100 });
    const minor = await makeCompetition(db, { slug: 'top-14-preintermedia', priority: 0 });
    const importantSeason = await makeSeason(db, important.id);
    const minorSeason = await makeSeason(db, minor.id);
    const a = await makeTeam(db, { slug: 'a', name: 'A' });
    const b = await makeTeam(db, { slug: 'b', name: 'B' });
    const futureDate = new Date(Date.now() + 7 * 864e5);
    await upsertMatchByNaturalKey(db, {
      seasonId: importantSeason.id,
      round: 'Fecha 1',
      startsAt: futureDate,
      homeTeamId: a.id,
      awayTeamId: b.id,
    });
    await upsertMatchByNaturalKey(db, {
      seasonId: minorSeason.id,
      round: 'Fecha 1',
      startsAt: futureDate,
      homeTeamId: a.id,
      awayTeamId: b.id,
    });

    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/matches/upcoming?limit=5' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0]).toMatchObject({ competition: { slug: 'urba-top-14' } });
  });

  it('sirve el catálogo y la tabla de posiciones desde DB', async () => {
    await seedCompetition();
    const app = makeAppFor();
    const catalog = await app.inject({ method: 'GET', url: '/v1/competitions' });
    expect(catalog.json().competitions.some((c: { slug: string }) => c.slug === 'urba-top-14')).toBe(true);

    const standings = await app.inject({
      method: 'GET',
      url: '/v1/competitions/urba-top-14/standings',
    });
    expect(standings.statusCode).toBe(200);
    const body = standings.json();
    expect(body.season).toBe(2026);
    expect(body.rows[0]).toMatchObject({
      position: 1,
      team: { slug: 'sic', badgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png' },
      points: 4,
    });
    expect(body.source).toBe('urba');
  });

  it('/v1/competitions incluye organización, familia y tier', async () => {
    const { db } = handle;
    const org = await upsertOrganization(db, { slug: 'urba', name: 'URBA', kind: 'union', countryCode: 'AR' });
    await upsertCompetition(db, {
      slug: 'urba-top-14',
      name: 'TOP 14 - Superior',
      category: 'clubs',
      gender: 'male',
      familySlug: 'top-14',
      tier: 'senior',
      organizationId: org.id,
    });
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/competitions' });
    const body = res.json();
    const top14 = body.competitions.find((c: { slug: string }) => c.slug === 'urba-top-14');
    expect(top14).toMatchObject({
      organization: { slug: 'urba', name: 'URBA' },
      familySlug: 'top-14',
      tier: 'senior',
    });
  });

  it('/v1/organizations devuelve uniones vacías y asociaciones regionales', async () => {
    const { db } = handle;
    const rosario = await upsertOrganization(db, { slug: 'rosario', name: 'Unión de Rugby de Rosario', kind: 'union', countryCode: 'AR' });
    const santaFe = await upsertOrganization(db, { slug: 'santa-fe', name: 'Unión Santafesina de Rugby', kind: 'union', countryCode: 'AR' });
    const entrerriana = await upsertOrganization(db, { slug: 'entrerriana', name: 'Unión Entrerriana de Rugby', kind: 'union', countryCode: 'AR' });
    await upsertOrganization(db, { slug: 'andina', name: 'Unión Andina de Rugby', kind: 'union', countryCode: 'AR' });
    const litoral = await upsertCompetition(db, {
      slug: 'regional-del-litoral-primera',
      name: 'Torneo Regional del Litoral - Primera',
      category: 'clubs',
      gender: 'male',
      countryCode: 'AR',
      familySlug: 'regional-del-litoral',
      organizationId: rosario.id,
    });
    await linkCompetitionOrganization(db, { competitionId: litoral.id, organizationId: santaFe.id });
    await linkCompetitionOrganization(db, { competitionId: litoral.id, organizationId: entrerriana.id });

    const app = makeAppFor();
    const response = await app.inject({ method: 'GET', url: '/v1/organizations?countryCode=AR&kind=union' });
    expect(response.statusCode).toBe(200);
    const bySlug = new Map(response.json().organizations.map((organization: { slug: string; competitionSlugs: string[] }) => [organization.slug, organization.competitionSlugs]));
    expect(bySlug.get('rosario')).toEqual(['regional-del-litoral-primera']);
    expect(bySlug.get('santa-fe')).toEqual(['regional-del-litoral-primera']);
    expect(bySlug.get('entrerriana')).toEqual(['regional-del-litoral-primera']);
    expect(bySlug.get('andina')).toEqual([]);
  });

  it('/v1/organizations valida los filtros en el límite', async () => {
    const app = makeAppFor();
    const response = await app.inject({ method: 'GET', url: '/v1/organizations?countryCode=ARG&kind=union' });
    expect(response.statusCode).toBe(400);
  });

  it('404 para competencia inexistente', async () => {
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/competitions/no-existe/standings' });
    expect(res.statusCode).toBe(404);
  });

  it('el filtro status=live nunca devuelve partidos demo', async () => {
    await seedCompetition();
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/matches?status=live' });
    expect(res.statusCode).toBe(200);
    expect(res.json().matches).toEqual([]);
  });

  it('/v1/home devuelve agregados reales', async () => {
    const { db } = handle;
    await makeCompetition(db, { slug: 'urba-top-14', coverage: 'auto' });
    await makeCompetition(db, { slug: 'manual-x', coverage: 'manual' });
    await makeTeam(db, { slug: 't1' });
    await makeTeam(db, { slug: 't2' });
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/home' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.stats.competitions).toBe(1); // solo la de cobertura auto
    expect(body.stats.clubs).toBe(2);
    expect(body.contest).toBeNull();
    expect(body.featuredArticle).toBeNull();
  });

  it('/v1/articles solo expone publicados', async () => {
    const { db } = handle;
    await createDraft(db, { slug: 'borrador', title: 'Borrador', summary: 's', body: 'b' });
    const pub = await createDraft(db, { slug: 'publicada', title: 'Publicada', summary: 's', body: 'cuerpo' });
    await setArticleStatus(db, pub.id, 'published');
    const app = makeAppFor();
    const list = await app.inject({ method: 'GET', url: '/v1/articles' });
    expect(list.json().articles).toHaveLength(1);
    expect(list.json().articles[0].slug).toBe('publicada');
    const detail = await app.inject({ method: 'GET', url: '/v1/articles/publicada' });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().article.body).toBe('cuerpo');
    const missing = await app.inject({ method: 'GET', url: '/v1/articles/borrador' });
    expect(missing.statusCode).toBe(404);
  });

  it('registra eventos de analytics y feedback sin PII obligatoria', async () => {
    const { db } = handle;
    const app = makeAppFor();
    const ev = await app.inject({
      method: 'POST',
      url: '/v1/events',
      payload: { name: 'view_date', metadata: { date: '2026-03-14' } },
    });
    expect(ev.statusCode).toBe(202);
    const bad = await app.inject({ method: 'POST', url: '/v1/events', payload: {} });
    expect(bad.statusCode).toBe(400);
    const fb = await app.inject({
      method: 'POST',
      url: '/v1/feedback',
      payload: { message: 'Buenísima la agenda' },
    });
    expect(fb.statusCode).toBe(201);
    expect(await db.query.analyticsEvents.findMany()).toHaveLength(1);
    expect(await db.query.feedback.findMany()).toHaveLength(1);
  });

  it('admin deniega por defecto y resuelve conflictos con token', async () => {
    const { db } = handle;
    const conflict = await createConflict(db, {
      entityType: 'match',
      candidates: [{ home: 'x', away: 'y' }],
      reason: 'equipo sin resolver',
    });

    // Sin ADMIN_TOKEN configurado → 503 (deny por defecto).
    delete process.env.ADMIN_TOKEN;
    const app1 = makeAppFor();
    expect((await app1.inject({ method: 'GET', url: '/admin/summary' })).statusCode).toBe(503);

    process.env.ADMIN_TOKEN = 'secreto';
    const app2 = makeAppFor();
    expect((await app2.inject({ method: 'GET', url: '/admin/summary' })).statusCode).toBe(401);
    const ok = await app2.inject({
      method: 'GET',
      url: '/admin/summary',
      headers: { 'x-admin-token': 'secreto' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().openConflicts).toBe(1);

    const resolved = await app2.inject({
      method: 'POST',
      url: `/admin/conflicts/${conflict.id}/resolve`,
      headers: { 'x-admin-token': 'secreto' },
      payload: { status: 'dismissed' },
    });
    expect(resolved.statusCode).toBe(200);
    const after = await db.query.ingestionConflicts.findMany();
    expect(after[0]!.status).toBe('dismissed');
    delete process.env.ADMIN_TOKEN;
  });

  it('admin rechaza una resolución inválida sin mutar ni auditar el conflicto', async () => {
    const { db } = handle;
    const conflict = await createConflict(db, {
      entityType: 'match',
      candidates: [{ home: 'x', away: 'y' }],
      reason: 'equipo sin resolver',
    });
    process.env.ADMIN_TOKEN = 'secreto';
    const app = makeAppFor();

    const response = await app.inject({
      method: 'POST',
      url: `/admin/conflicts/${conflict.id}/resolve`,
      headers: { 'x-admin-token': 'secreto' },
      payload: { status: 'cualquier-cosa' },
    });

    expect(response.statusCode).toBe(400);
    expect((await db.query.ingestionConflicts.findFirst())!.status).toBe('open');
    expect(await db.query.auditLog.findMany()).toHaveLength(0);
    delete process.env.ADMIN_TOKEN;
  });

  it('permite CORS al web local', async () => {
    const app = makeAppFor();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/v1/live',
      headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'GET' },
    });
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  // --- Lineups API ---

  it('GET /v1/matches/:id/lineups devuelve listas vacías si no hay formación', async () => {
    const seeded = await seedCompetition();
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: `/v1/matches/${seeded.current.id}/lineups` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ home: [], away: [] });
  });

  it('GET /v1/matches/:id/lineups devuelve 404 si el partido no existe', async () => {
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/matches/00000000-0000-0000-0000-000000000000/lineups' });
    expect(res.statusCode).toBe(404);
  });

  it('GET /v1/matches/:id/lineups devuelve formaciones cargadas', async () => {
    const { db } = handle;
    const seeded = await seedCompetition();

    const player = await createPlayer(db, {
      fullName: 'Marcos Torrillas',
      normalizedName: 'marcos torrillas',
    });

    await replaceLineup(db, {
      matchId: seeded.current.id,
      teamId: seeded.sic.id,
      entries: [{ playerId: player.id, shirtNumber: 10, isStarter: true, isCaptain: true }],
    });

    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: `/v1/matches/${seeded.current.id}/lineups` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.home).toHaveLength(1);
    expect(body.home[0]).toMatchObject({
      shirtNumber: 10,
      isStarter: true,
      isCaptain: true,
      // El slug ahora es un UUID interno (identificador del jugador); se verifica solo el nombre.
      player: { slug: player.slug, fullName: 'Marcos Torrillas' },
    });
    expect(body.away).toEqual([]);
  });

  it('POST /admin/matches/:id/lineups guarda y reemplaza formaciones con token', async () => {
    const seeded = await seedCompetition();
    process.env.ADMIN_TOKEN = 'secreto';
    const app = makeAppFor();

    const res = await app.inject({
      method: 'POST',
      url: `/admin/matches/${seeded.current.id}/lineups`,
      headers: { 'x-admin-token': 'secreto' },
      payload: {
        side: 'home',
        entries: [
          { shirtNumber: 10, name: 'Marcos Torrillas', isCaptain: true, playerId: null },
          { shirtNumber: 9, name: 'Juan Cruz Pérez', isCaptain: false, playerId: null },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, side: 'home' });

    // Verificar que los datos persisten.
    const getRes = await app.inject({ method: 'GET', url: `/v1/matches/${seeded.current.id}/lineups` });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().home).toHaveLength(2);

    // Verificar auditoría.
    const audit = await handle.db.query.auditLog.findMany();
    expect(audit.some((entry) => entry.action === 'admin.lineup.save')).toBe(true);

    delete process.env.ADMIN_TOKEN;
  });

  it('POST /admin/matches/:id/lineups rechaza sin token', async () => {
    const seeded = await seedCompetition();
    delete process.env.ADMIN_TOKEN;
    const app = makeAppFor();
    const res = await app.inject({
      method: 'POST',
      url: `/admin/matches/${seeded.current.id}/lineups`,
      payload: { side: 'home', entries: [{ shirtNumber: 10, name: 'Test', isCaptain: false, playerId: null }] },
    });
    expect(res.statusCode).toBe(503);
  });

  it('POST /admin/matches/:id/lineups rechaza body inválido', async () => {
    const seeded = await seedCompetition();
    process.env.ADMIN_TOKEN = 'secreto';
    const app = makeAppFor();
    const res = await app.inject({
      method: 'POST',
      url: `/admin/matches/${seeded.current.id}/lineups`,
      headers: { 'x-admin-token': 'secreto' },
      payload: { side: 'home', entries: [{ shirtNumber: 999, name: '', isCaptain: false, playerId: null }] },
    });
    expect(res.statusCode).toBe(400);
    delete process.env.ADMIN_TOKEN;
  });

  it('POST /admin/matches/:id/lineups nunca fusiona homónimos: cargar el mismo nombre dos veces crea dos jugadores', async () => {
    const seeded = await seedCompetition();
    process.env.ADMIN_TOKEN = 'secreto';
    const app = makeAppFor();

    await app.inject({
      method: 'POST',
      url: `/admin/matches/${seeded.current.id}/lineups`,
      headers: { 'x-admin-token': 'secreto' },
      payload: { side: 'home', entries: [{ shirtNumber: 10, name: 'Juan Pérez', isCaptain: false, playerId: null }] },
    });
    await app.inject({
      method: 'POST',
      url: `/admin/matches/${seeded.current.id}/lineups`,
      headers: { 'x-admin-token': 'secreto' },
      payload: { side: 'away', entries: [{ shirtNumber: 10, name: 'Juan Pérez', isCaptain: false, playerId: null }] },
    });

    const players = await handle.db.query.players.findMany();
    expect(players).toHaveLength(2);
    expect(players[0]!.id).not.toBe(players[1]!.id);

    delete process.env.ADMIN_TOKEN;
  });

  it('POST /admin/matches/:id/lineups rechaza 403 para competencias juveniles y no guarda nada', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db, {
      slug: 'urba-menores-de-15',
      name: 'Menores de 15 - Primera Rueda - G1 A',
      tier: 'youth',
    });
    const season = await makeSeason(db, competition.id, { year: 2026 });
    const sic = await makeTeam(db, { slug: 'sic-m15', name: 'SIC M15' });
    const hindu = await makeTeam(db, { slug: 'hindu-m15', name: 'Hindú M15' });
    const { match } = await upsertMatchByNaturalKey(db, {
      seasonId: season.id,
      round: 'Fecha 1',
      startsAt: new Date('2026-08-01T18:00:00Z'),
      homeTeamId: sic.id,
      awayTeamId: hindu.id,
      status: 'scheduled',
      source: 'urba',
    });

    process.env.ADMIN_TOKEN = 'secreto';
    const app = makeAppFor();
    const res = await app.inject({
      method: 'POST',
      url: `/admin/matches/${match.id}/lineups`,
      headers: { 'x-admin-token': 'secreto' },
      payload: {
        side: 'home',
        entries: [{ shirtNumber: 10, name: 'Nombre de Menor', isCaptain: false, playerId: null }],
      },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'youth_category_not_allowed' });

    const players = await handle.db.query.players.findMany();
    expect(players).toHaveLength(0);
    const audit = await handle.db.query.auditLog.findMany();
    expect(audit.some((entry) => entry.action === 'admin.lineup.save')).toBe(false);

    delete process.env.ADMIN_TOKEN;
  });

  it('POST /admin/matches/:id/lineups sigue funcionando para competencias senior', async () => {
    const seeded = await seedCompetition();
    process.env.ADMIN_TOKEN = 'secreto';
    const app = makeAppFor();
    const res = await app.inject({
      method: 'POST',
      url: `/admin/matches/${seeded.current.id}/lineups`,
      headers: { 'x-admin-token': 'secreto' },
      payload: {
        side: 'home',
        entries: [{ shirtNumber: 10, name: 'Jugador Adulto', isCaptain: false, playerId: null }],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, side: 'home' });
    delete process.env.ADMIN_TOKEN;
  });

  it('POST /admin/matches/:id/lineups rechaza playerId inexistente con 400', async () => {
    const seeded = await seedCompetition();
    process.env.ADMIN_TOKEN = 'secreto';
    const app = makeAppFor();
    const res = await app.inject({
      method: 'POST',
      url: `/admin/matches/${seeded.current.id}/lineups`,
      headers: { 'x-admin-token': 'secreto' },
      payload: {
        side: 'home',
        entries: [
          { shirtNumber: 10, name: 'Fantasma', isCaptain: false, playerId: '00000000-0000-0000-0000-000000000000' },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'unknown_player' });
    delete process.env.ADMIN_TOKEN;
  });

  // --- Players search API ---

  it('GET /v1/players/search devuelve jugadores por nombre normalizado', async () => {
    await createPlayer(handle.db, {
      fullName: 'Marcos Torrillas',
      normalizedName: 'marcos torrillas',
    });
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/players/search?q=marcos%20torrillas' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.players).toHaveLength(1);
    expect(body.players[0]).toMatchObject({
      fullName: 'Marcos Torrillas',
      normalizedName: 'marcos torrillas',
    });
  });

  it('GET /v1/players/search normaliza la consulta (acentos y mayúsculas)', async () => {
    await createPlayer(handle.db, {
      fullName: 'Juan Cruz Pérez',
      normalizedName: normalizePlayerName('Juan Cruz Pérez'),
    });
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/players/search?q=Juan%20Cruz%20P%C3%A9rez' });
    expect(res.statusCode).toBe(200);
    expect(res.json().players).toHaveLength(1);
  });

  it('GET /v1/players/search encuentra por prefijo del primer nombre (no exige el nombre completo)', async () => {
    await createPlayer(handle.db, {
      fullName: 'Juan Cruz Pérez',
      normalizedName: normalizePlayerName('Juan Cruz Pérez'),
    });
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/players/search?q=Juan' });
    expect(res.statusCode).toBe(200);
    expect(res.json().players).toHaveLength(1);
  });

  it('GET /v1/players/search rechaza consultas de menos de 3 caracteres', async () => {
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/players/search?q=an' });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'query_too_short' });
  });

  it('GET /v1/players/search acepta consultas de exactamente 3 caracteres', async () => {
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/players/search?q=jua' });
    expect(res.statusCode).toBe(200);
  });

  it('GET /v1/players/search devuelve lista vacía sin coincidencias', async () => {
    const app = makeAppFor();
    const res = await app.inject({ method: 'GET', url: '/v1/players/search?q=jugador%20inexistente' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ players: [] });
  });

  describe('career', () => {
    it('arma el catálogo de clubes con su división desde las competencias', async () => {
      const { db } = handle;
      const top14 = await makeCompetition(db, { slug: 'urba-top-14', name: 'URBA Top 14' });
      const primeraB = await makeCompetition(db, { slug: 'urba-primera-b', name: 'URBA Primera B' });
      const seasonTop = await makeSeason(db, top14.id, { year: 2026 });
      const seasonB = await makeSeason(db, primeraB.id, { year: 2026 });
      const sic = await makeTeam(db, { slug: 'sic', name: 'SIC', badgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png' });
      const bajo = await makeTeam(db, { slug: 'club-bajo', name: 'Club Bajo' });
      await replaceStandings(db, seasonTop.id, [{ teamId: sic.id, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, bonus: 0, points: 0 }], 'urba');
      await replaceStandings(db, seasonB.id, [{ teamId: bajo.id, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, bonus: 0, points: 0 }], 'urba');

      const app = makeAppFor();
      const res = await app.inject({ method: 'GET', url: '/v1/career/clubs' });
      expect(res.statusCode).toBe(200);
      const clubs = res.json().clubs;
      expect(clubs).toContainEqual({ slug: 'sic', name: 'SIC', level: 1, badgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png' });
      expect(clubs).toContainEqual({ slug: 'club-bajo', name: 'Club Bajo', level: 3, badgeUrl: null });
    });

    it('publica una entrada al ranking con apodo', async () => {
      const app = makeAppFor();
      const res = await app.inject({
        method: 'POST',
        url: '/v1/career/entries',
        payload: {
          displayName: 'TercerTiempo',
          score: 850,
          summary: { tier: 'Gloria amateur', verdict: 'V', score: 850, comparison: { figure: 'Hugo Porta', reason: 'R' }, seasons: 14, clubs: ['SIC'], peakLevel: 1 },
          history: [],
          surname: 'Pérez',
          position: 'centro',
          clubSlug: 'sic',
          seed: 42,
          decisions: [0, 1],
          originKey: 'a'.repeat(64),
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().entry.displayName).toBe('TercerTiempo');
    });

    it('rechaza un apodo inválido', async () => {
      const app = makeAppFor();
      const res = await app.inject({
        method: 'POST',
        url: '/v1/career/entries',
        payload: {
          displayName: '  ',
          score: 1,
          summary: { tier: 't', verdict: 'v', score: 1, comparison: { figure: 'f', reason: 'r' }, seasons: 1, clubs: [], peakLevel: 9 },
          history: [],
          surname: 'Pérez',
          position: 'centro',
          clubSlug: 'sic',
          seed: 1,
          decisions: [],
          originKey: 'a'.repeat(64),
        },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('invalid_career_entry');
    });

    it('corta por límite de publicaciones por origen', async () => {
      const app = makeAppFor();
      const base = {
        score: 100, displayName: 'X', originKey: 'b'.repeat(64),
        summary: { tier: 't', verdict: 'v', score: 100, comparison: { figure: 'f', reason: 'r' }, seasons: 1, clubs: [], peakLevel: 9 },
        history: [], surname: 'P', position: 'centro', clubSlug: 'sic', seed: 1, decisions: [],
      };
      for (let i = 0; i < 3; i += 1) {
        const ok = await app.inject({ method: 'POST', url: '/v1/career/entries', payload: { ...base, displayName: `X${i}` } });
        expect(ok.statusCode).toBe(201);
      }
      const res = await app.inject({ method: 'POST', url: '/v1/career/entries', payload: { ...base, displayName: 'X3' } });
      expect(res.statusCode).toBe(429);
      expect(res.json().error).toBe('too_many_career_posts');
    });

    it('lista el ranking ordenado por puntaje', async () => {
      const app = makeAppFor();
      const entry = { displayName: 'Pibe', score: 700, originKey: 'c'.repeat(64), summary: { tier: 't', verdict: 'v', score: 700, comparison: { figure: 'f', reason: 'r' }, seasons: 1, clubs: [], peakLevel: 9 }, history: [], surname: 'P', position: 'centro', clubSlug: 'sic', seed: 1, decisions: [] };
      await app.inject({ method: 'POST', url: '/v1/career/entries', payload: entry });
      await app.inject({ method: 'POST', url: '/v1/career/entries', payload: { ...entry, displayName: 'Duro', score: 900 } });
      const res = await app.inject({ method: 'GET', url: '/v1/career/entries?limit=10' });
      expect(res.statusCode).toBe(200);
      expect(res.json().entries.map((e: { displayName: string }) => e.displayName)).toEqual(['Duro', 'Pibe']);
    });

    it('devuelve el detalle de una entrada para la tarjeta compartible', async () => {
      const app = makeAppFor();
      const created = await app.inject({ method: 'POST', url: '/v1/career/entries', payload: { displayName: 'Ídolo', score: 800, originKey: 'd'.repeat(64), summary: { tier: 't', verdict: 'v', score: 800, comparison: { figure: 'f', reason: 'r' }, seasons: 1, clubs: [], peakLevel: 9 }, history: [], surname: 'P', position: 'centro', clubSlug: 'sic', seed: 42, decisions: [0, 1] } });
      const id = created.json().entry.id;
      const res = await app.inject({ method: 'GET', url: `/v1/career/entries/${id}` });
      expect(res.statusCode).toBe(200);
      expect(res.json().entry.seed).toBe(42);
      expect(res.json().entry.decisions).toEqual([0, 1]);
    });
  });
});
