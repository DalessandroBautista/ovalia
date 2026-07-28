import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from './client';
import {
  ContestClosedError,
  createDraft,
  createUser,
  featuredPublishedArticle,
  findMatchById,
  findMatchesInRange,
  findTeamByExternalId,
  findUserByEmail,
  getActiveContest,
  getStandingsForSeason,
  hasArtifact,
  linkExternalEntity,
  listPublishedArticles,
  rebuildRanking,
  recordArtifact,
  recordAudit,
  replaceStandings,
  resolveExternalEntity,
  setArticleStatus,
  upsertMatchByNaturalKey,
  upsertPrediction,
  upsertTeams,
} from './repositories';
import { predictions } from './schema';
import { eq } from 'drizzle-orm';
import {
  makeCompetition,
  makeContest,
  makeMatch,
  makeSeason,
  makeSource,
  makeTeam,
  makeUser,
} from './test-support/factories';
import {
  getTestDatabase,
  isDatabaseAvailable,
  truncateAll,
} from './test-support/test-database';

const available = await isDatabaseAvailable();

describe.skipIf(!available)('repositories', () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    handle = await getTestDatabase();
    await truncateAll(handle);
  });

  afterAll(async () => {
    if (available) await handle.pool.end().catch(() => undefined);
  });

  it('upsertTeams es idempotente por slug y resuelve por external ID', async () => {
    const { db } = handle;
    await upsertTeams(db, [
      { slug: 'sic', name: 'SIC', shortName: 'SIC', countryCode: 'AR', externalIds: { urba: '11' } },
    ]);
    await upsertTeams(db, [
      { slug: 'sic', name: 'San Isidro Club', shortName: 'SIC', countryCode: 'AR' },
    ]);
    const team = await findTeamByExternalId(db, 'urba', '11');
    expect(team?.name).toBe('San Isidro Club');
    const all = await db.query.teams.findMany();
    expect(all).toHaveLength(1);
  });

  it('upsertTeams actualiza y verifica el badge cuando llega uno nuevo', async () => {
    const { db } = handle;
    await upsertTeams(db, [
      { slug: 'sic', name: 'SIC', shortName: 'SIC', countryCode: 'AR' },
    ]);
    const before = await db.query.teams.findFirst({ where: (t, { eq }) => eq(t.slug, 'sic') });
    expect(before?.badgeStatus).toBe('pending');
    expect(before?.badgeUrl).toBeNull();

    await upsertTeams(db, [
      {
        slug: 'sic',
        name: 'SIC',
        shortName: 'SIC',
        countryCode: 'AR',
        badgeUrl: 'https://api.urba.org.ar/img/clubs/sic.png',
        badgeSourceUrl: 'https://api.urba.org.ar/img/clubs/sic.png',
        badgeFormat: 'png',
      },
    ]);
    const after = await db.query.teams.findFirst({ where: (t, { eq }) => eq(t.slug, 'sic') });
    expect(after?.badgeUrl).toBe('https://api.urba.org.ar/img/clubs/sic.png');
    expect(after?.badgeSourceUrl).toBe('https://api.urba.org.ar/img/clubs/sic.png');
    expect(after?.badgeFormat).toBe('png');
    expect(after?.badgeStatus).toBe('verified');
    expect(after?.badgeVerifiedAt).not.toBeNull();

    // Un upsert posterior sin badgeUrl no debe borrar el que ya quedó verificado.
    await upsertTeams(db, [{ slug: 'sic', name: 'SIC', shortName: 'SIC', countryCode: 'AR' }]);
    const stillVerified = await db.query.teams.findFirst({ where: (t, { eq }) => eq(t.slug, 'sic') });
    expect(stillVerified?.badgeUrl).toBe('https://api.urba.org.ar/img/clubs/sic.png');
    expect(stillVerified?.badgeStatus).toBe('verified');
  });

  it('upsertMatchByNaturalKey no duplica y actualiza horario/resultado', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db);
    const season = await makeSeason(db, competition.id);
    const home = await makeTeam(db);
    const away = await makeTeam(db);
    const first = await upsertMatchByNaturalKey(db, {
      seasonId: season.id,
      round: 'Fecha 1',
      startsAt: new Date('2026-08-01T18:00:00Z'),
      homeTeamId: home.id,
      awayTeamId: away.id,
    });
    expect(first.created).toBe(true);
    const second = await upsertMatchByNaturalKey(db, {
      seasonId: season.id,
      round: 'Fecha 1',
      startsAt: new Date('2026-08-01T20:00:00Z'),
      homeTeamId: home.id,
      awayTeamId: away.id,
      status: 'final',
      homeScore: 24,
      awayScore: 21,
    });
    expect(second.created).toBe(false);
    expect(second.match.id).toBe(first.match.id);
    const all = await db.query.matches.findMany();
    expect(all).toHaveLength(1);
    expect(all[0]!.status).toBe('final');
    expect(all[0]!.homeScore).toBe(24);
  });

  it('findMatchesInRange filtra por rango y pagina por cursor', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db, { slug: 'urba' });
    const season = await makeSeason(db, competition.id);
    const home = await makeTeam(db);
    const away = await makeTeam(db);
    for (let i = 0; i < 3; i += 1) {
      await makeMatch(db, {
        seasonId: season.id,
        homeTeamId: home.id,
        awayTeamId: away.id,
        round: `Fecha ${i + 1}`,
        startsAt: new Date(`2026-08-0${i + 1}T18:00:00Z`),
      });
    }
    const first = await findMatchesInRange(db, {
      from: new Date('2026-08-01T00:00:00Z'),
      to: new Date('2026-08-31T00:00:00Z'),
      limit: 2,
    });
    expect(first.matches).toHaveLength(2);
    expect(first.matches[0]!.competitionSlug).toBe('urba');
    expect(first.nextCursor).not.toBeNull();
    const second = await findMatchesInRange(db, {
      from: new Date('2026-08-01T00:00:00Z'),
      to: new Date('2026-08-31T00:00:00Z'),
      limit: 2,
      cursor: first.nextCursor!,
    });
    expect(second.matches).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
  });

  it('findMatchById devuelve equipos y competencia', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db, { name: 'URBA Top 14' });
    const season = await makeSeason(db, competition.id);
    const home = await makeTeam(db, { name: 'SIC' });
    const away = await makeTeam(db, { name: 'CASI' });
    const match = await makeMatch(db, {
      seasonId: season.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
    });
    const detail = await findMatchById(db, match.id);
    expect(detail?.home.name).toBe('SIC');
    expect(detail?.away.name).toBe('CASI');
    expect(detail?.competitionName).toBe('URBA Top 14');
  });

  it('replaceStandings reemplaza la tabla completa y ordena por puntos', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db);
    const season = await makeSeason(db, competition.id);
    const a = await makeTeam(db, { name: 'A' });
    const b = await makeTeam(db, { name: 'B' });
    await replaceStandings(
      db,
      season.id,
      [
        { teamId: a.id, played: 1, won: 1, drawn: 0, lost: 0, pointsFor: 30, pointsAgainst: 10, bonus: 1, points: 5 },
        { teamId: b.id, played: 1, won: 0, drawn: 0, lost: 1, pointsFor: 10, pointsAgainst: 30, bonus: 0, points: 0 },
      ],
      'urba',
    );
    await replaceStandings(
      db,
      season.id,
      [
        { teamId: b.id, played: 2, won: 1, drawn: 0, lost: 1, pointsFor: 40, pointsAgainst: 40, bonus: 1, points: 6 },
        { teamId: a.id, played: 2, won: 1, drawn: 0, lost: 1, pointsFor: 40, pointsAgainst: 40, bonus: 1, points: 5 },
      ],
      'urba',
    );
    const rows = await getStandingsForSeason(db, season.id);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.teamName).toBe('B');
    expect(rows[0]!.source).toBe('urba');
  });

  it('recordArtifact es idempotente por fuente y checksum', async () => {
    const { db } = handle;
    const source = await makeSource(db);
    const first = await recordArtifact(db, { sourceId: source.id, checksum: 'sum-1' });
    expect(first.created).toBe(true);
    const second = await recordArtifact(db, { sourceId: source.id, checksum: 'sum-1' });
    expect(second.created).toBe(false);
    expect(await hasArtifact(db, source.id, 'sum-1')).toBe(true);
  });

  it('resuelve y enlaza entidades externas', async () => {
    const { db } = handle;
    const source = await makeSource(db);
    const team = await makeTeam(db);
    expect(await resolveExternalEntity(db, source.id, 'team', 'x9')).toBeNull();
    await linkExternalEntity(db, {
      sourceId: source.id,
      entityType: 'team',
      externalId: 'x9',
      ovaliaId: team.id,
    });
    expect(await resolveExternalEntity(db, source.id, 'team', 'x9')).toBe(team.id);
  });

  it('lista solo artículos publicados y expone el destacado', async () => {
    const { db } = handle;
    const author = await makeUser(db, { role: 'editor' });
    await createDraft(db, {
      slug: 'borrador',
      title: 'Borrador',
      summary: 's',
      body: 'b',
      authorId: author.id,
    });
    const published = await createDraft(db, {
      slug: 'publicada',
      title: 'Publicada',
      summary: 's',
      body: 'b',
      authorId: author.id,
    });
    await setArticleStatus(db, published.id, 'published');
    const list = await listPublishedArticles(db);
    expect(list).toHaveLength(1);
    expect(list[0]!.slug).toBe('publicada');
    const featured = await featuredPublishedArticle(db);
    expect(featured?.slug).toBe('publicada');
  });

  it('getActiveContest devuelve el concurso abierto más próximo', async () => {
    const { db } = handle;
    await makeContest(db, {
      status: 'open',
      closesAt: new Date(Date.now() + 7 * 24 * 3_600_000),
    });
    const soon = await makeContest(db, {
      status: 'open',
      closesAt: new Date(Date.now() + 24 * 3_600_000),
    });
    await makeContest(db, { status: 'draft', closesAt: new Date(Date.now() + 3_600_000) });
    const active = await getActiveContest(db);
    expect(active?.id).toBe(soon.id);
  });

  it('upsertPrediction guarda antes del cierre y bloquea después', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db);
    const season = await makeSeason(db, competition.id);
    const home = await makeTeam(db);
    const away = await makeTeam(db);
    const user = await makeUser(db);
    const match = await makeMatch(db, {
      seasonId: season.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
    });
    const openContest = await makeContest(db, {
      status: 'open',
      closesAt: new Date(Date.now() + 3_600_000),
    });
    const saved = await upsertPrediction(db, {
      userId: user.id,
      contestId: openContest.id,
      matchId: match.id,
      homeScore: 10,
      awayScore: 7,
    });
    expect(saved.homeScore).toBe(10);
    // Editar reutiliza la misma fila.
    await upsertPrediction(db, {
      userId: user.id,
      contestId: openContest.id,
      matchId: match.id,
      homeScore: 15,
      awayScore: 9,
    });
    const mine = await db.query.predictions.findMany({
      where: eq(predictions.userId, user.id),
    });
    expect(mine).toHaveLength(1);
    expect(mine[0]!.homeScore).toBe(15);

    const closedContest = await makeContest(db, {
      status: 'closed',
      closesAt: new Date(Date.now() - 3_600_000),
    });
    await expect(
      upsertPrediction(db, {
        userId: user.id,
        contestId: closedContest.id,
        matchId: match.id,
        homeScore: 1,
        awayScore: 1,
      }),
    ).rejects.toBeInstanceOf(ContestClosedError);
  });

  it('rebuildRanking ordena por puntos otorgados', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db);
    const season = await makeSeason(db, competition.id);
    const home = await makeTeam(db);
    const away = await makeTeam(db);
    const match = await makeMatch(db, {
      seasonId: season.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
    });
    const contest = await makeContest(db, {
      status: 'scored',
      closesAt: new Date(Date.now() - 3_600_000),
    });
    const alice = await makeUser(db, { displayName: 'Alice' });
    const bob = await makeUser(db, { displayName: 'Bob' });
    await db.insert(predictions).values([
      { userId: alice.id, contestId: contest.id, matchId: match.id, homeScore: 24, awayScore: 21, awardedPoints: 5 },
      { userId: bob.id, contestId: contest.id, matchId: match.id, homeScore: 10, awayScore: 10, awardedPoints: 1 },
    ]);
    await rebuildRanking(db, contest.id);
    const ranking = await db.query.contestRankings.findMany();
    const top = ranking.find((r) => r.position === 1);
    expect(top?.userId).toBe(alice.id);
    expect(top?.points).toBe(5);
  });

  it('createUser + findUserByEmail y recordAudit persisten', async () => {
    const { db } = handle;
    const user = await createUser(db, { email: 'e@x.test', displayName: 'E' });
    expect((await findUserByEmail(db, 'e@x.test'))?.id).toBe(user.id);
    const entry = await recordAudit(db, {
      actorId: user.id,
      action: 'match.override',
      targetType: 'match',
      targetId: 'abc',
    });
    expect(entry.action).toBe('match.override');
  });
});
