import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from './client';
import * as repositoryExports from './repositories';
import {
  ContestClosedError,
  createDraft,
  createPlayer,
  createUser,
  featuredPublishedArticle,
  findMatchById,
  findMatchesInRange,
  findPastMatchesForTeams,
  findPlayerByNormalizedName,
  searchPlayersByName,
  findTeamByExternalId,
  findUpcomingMatches,
  findUserByEmail,
  findOrganizationBySlug,
  getActiveContest,
  getLineupsForMatch,
  getStandingsForSeason,
  hasArtifact,
  hasLineup,
  linkExternalEntity,
  listPublishedArticles,
  rebuildRanking,
  recordArtifact,
  recordAudit,
  replaceLineup,
  replaceStandings,
  resolveExternalEntity,
  setArticleStatus,
  upsertCompetition,
  upsertMatchByNaturalKey,
  upsertOrganization,
  upsertPrediction,
  upsertTeams,
  findPlayerBySlug,
  listTeamsForCompetition,
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

  it('upsertOrganization es idempotente por slug', async () => {
    const { db } = handle;
    await upsertOrganization(db, { slug: 'urba', name: 'Unión de Rugby de Buenos Aires', kind: 'union', countryCode: 'AR' });
    await upsertOrganization(db, { slug: 'urba', name: 'URBA', kind: 'union', countryCode: 'AR' });
    const org = await findOrganizationBySlug(db, 'urba');
    expect(org?.name).toBe('URBA');
    const all = await db.query.organizations.findMany();
    expect(all).toHaveLength(1);
  });

  it('lista una competencia regional bajo todas sus uniones sin ocultar las uniones vacías', async () => {
    type OrganizationCatalogRow = {
      slug: string;
      competitionSlugs: string[];
    };
    type LinkCompetitionOrganization = (
      db: DatabaseHandle['db'],
      input: { competitionId: string; organizationId: string },
    ) => Promise<unknown>;
    type ListOrganizations = (
      db: DatabaseHandle['db'],
      filters: { countryCode: string; kind: string },
    ) => Promise<OrganizationCatalogRow[]>;
    const exports = repositoryExports as typeof repositoryExports & {
      linkCompetitionOrganization?: LinkCompetitionOrganization;
      listOrganizationsWithCompetitionSlugs?: ListOrganizations;
    };

    expect(exports.linkCompetitionOrganization).toBeTypeOf('function');
    expect(exports.listOrganizationsWithCompetitionSlugs).toBeTypeOf('function');
    if (!exports.linkCompetitionOrganization || !exports.listOrganizationsWithCompetitionSlugs) return;

    const { db } = handle;
    const rosario = await upsertOrganization(db, { slug: 'rosario', name: 'Unión de Rugby de Rosario', kind: 'union', countryCode: 'AR' });
    const santaFe = await upsertOrganization(db, { slug: 'santa-fe', name: 'Unión Santafesina de Rugby', kind: 'union', countryCode: 'AR' });
    const entrerriana = await upsertOrganization(db, { slug: 'entrerriana', name: 'Unión Entrerriana de Rugby', kind: 'union', countryCode: 'AR' });
    await upsertOrganization(db, { slug: 'andina', name: 'Unión Andina de Rugby', kind: 'union', countryCode: 'AR' });
    const litoral = await upsertCompetition(db, {
      slug: 'regional-del-litoral',
      name: 'Torneo Regional del Litoral',
      category: 'clubs',
      gender: 'male',
      countryCode: 'AR',
      familySlug: 'regional-del-litoral',
      organizationId: rosario.id,
    });
    await exports.linkCompetitionOrganization(db, { competitionId: litoral.id, organizationId: santaFe.id });
    await exports.linkCompetitionOrganization(db, { competitionId: litoral.id, organizationId: entrerriana.id });

    const catalog = await exports.listOrganizationsWithCompetitionSlugs(db, { countryCode: 'AR', kind: 'union' });
    const bySlug = new Map(catalog.map((organization) => [organization.slug, organization.competitionSlugs]));
    expect(bySlug.get('rosario')).toEqual(['regional-del-litoral']);
    expect(bySlug.get('santa-fe')).toEqual(['regional-del-litoral']);
    expect(bySlug.get('entrerriana')).toEqual(['regional-del-litoral']);
    expect(bySlug.get('andina')).toEqual([]);
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

  it('upsertCompetition preserva priority si no viene explícito en un upsert posterior', async () => {
    const { db } = handle;
    const created = await upsertCompetition(db, {
      slug: 'urba-top-14',
      name: 'TOP 14 - Superior',
      category: 'clubs',
      gender: 'male',
      priority: 100,
    });
    expect(created.priority).toBe(100);

    const updated = await upsertCompetition(db, {
      slug: 'urba-top-14',
      name: 'TOP 14 - Superior',
      category: 'clubs',
      gender: 'male',
      // sin priority: no debe resetear a 0
    });
    expect(updated.priority).toBe(100);

    const explicitlyZero = await upsertCompetition(db, {
      slug: 'urba-top-14',
      name: 'TOP 14 - Superior',
      category: 'clubs',
      gender: 'male',
      priority: 0,
    });
    expect(explicitlyZero.priority).toBe(0);
  });

  it('upsertCompetition preserva organizationId si un upsert posterior no lo trae', async () => {
    const { db } = handle;
    const org = await upsertOrganization(db, { slug: 'urba-test-org', name: 'URBA', kind: 'union' });
    const created = await upsertCompetition(db, {
      slug: 'urba-top-14-org-test',
      name: 'TOP 14 - Superior',
      category: 'clubs',
      gender: 'male',
      organizationId: org.id,
    });
    expect(created.organizationId).toBe(org.id);

    const updated = await upsertCompetition(db, {
      slug: 'urba-top-14-org-test',
      name: 'TOP 14 - Superior',
      category: 'clubs',
      gender: 'male',
      // sin organizationId: no debe resetear a null
    });
    expect(updated.organizationId).toBe(org.id);
  });

  it('upsertCompetition persiste familySlug y tier', async () => {
    const { db } = handle;
    const row = await upsertCompetition(db, {
      slug: 'top-14-intermedia',
      name: 'TOP 14 - Intermedia',
      category: 'clubs',
      gender: 'male',
      familySlug: 'top-14',
      tier: 'intermediate',
    });
    expect(row.familySlug).toBe('top-14');
    expect(row.tier).toBe('intermediate');
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

  it('trae solo partidos finalizados anteriores de los equipos pedidos', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db, { slug: 'context-history' });
    const season = await makeSeason(db, competition.id);
    const hindu = await makeTeam(db, { slug: 'hindu', name: 'Hindú' });
    const sic = await makeTeam(db, { slug: 'sic', name: 'SIC' });

    await makeMatch(db, {
      seasonId: season.id,
      round: 'Fecha 1',
      startsAt: new Date('2026-05-01T18:00:00.000Z'),
      homeTeamId: hindu.id,
      awayTeamId: sic.id,
      status: 'final',
      homeScore: 30,
      awayScore: 10,
    });
    await makeMatch(db, {
      seasonId: season.id,
      round: 'Fecha 2',
      startsAt: new Date('2026-07-01T18:00:00.000Z'),
      homeTeamId: hindu.id,
      awayTeamId: sic.id,
      status: 'final',
      homeScore: 25,
      awayScore: 24,
    });
    await makeMatch(db, {
      seasonId: season.id,
      round: 'Fecha 3',
      startsAt: new Date('2026-05-15T18:00:00.000Z'),
      homeTeamId: hindu.id,
      awayTeamId: sic.id,
      status: 'scheduled',
    });

    const rows = await findPastMatchesForTeams(db, {
      teamIds: [hindu.id, sic.id],
      before: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.homeScore).toBe(30);
  });

  it('findPastMatchesForTeams restringe a la misma competencia cuando se pide', async () => {
    const { db } = handle;
    const superior = await makeCompetition(db, { slug: 'top-14-superior' });
    const intermedia = await makeCompetition(db, { slug: 'top-14-intermedia' });
    const superiorSeason = await makeSeason(db, superior.id);
    const intermediaSeason = await makeSeason(db, intermedia.id);
    // Mismo par de equipos (registro de club compartido entre divisiones).
    const casi = await makeTeam(db, { slug: 'casi', name: 'CASI' });
    const champagnat = await makeTeam(db, { slug: 'champagnat', name: 'Champagnat' });

    await makeMatch(db, {
      seasonId: superiorSeason.id,
      round: 'Fecha 1',
      startsAt: new Date('2026-05-01T18:00:00.000Z'),
      homeTeamId: casi.id,
      awayTeamId: champagnat.id,
      status: 'final',
      homeScore: 31,
      awayScore: 24,
    });
    await makeMatch(db, {
      seasonId: intermediaSeason.id,
      round: 'Fecha 1',
      startsAt: new Date('2026-05-01T18:00:00.000Z'),
      homeTeamId: casi.id,
      awayTeamId: champagnat.id,
      status: 'final',
      homeScore: 32,
      awayScore: 31,
    });

    const rows = await findPastMatchesForTeams(db, {
      teamIds: [casi.id, champagnat.id],
      before: new Date('2026-06-01T00:00:00.000Z'),
      competitionSlug: 'top-14-superior',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.homeScore).toBe(31);
  });

  it('findUpcomingMatches trae solo partidos de competencias con priority > 0, ordenados por prioridad y fecha', async () => {
    const { db } = handle;
    const important = await makeCompetition(db, { slug: 'urba-top-14', priority: 100 });
    const minor = await makeCompetition(db, { slug: 'top-14-preintermedia', priority: 0 });
    const importantSeason = await makeSeason(db, important.id);
    const minorSeason = await makeSeason(db, minor.id);
    const a = await makeTeam(db, { name: 'A' });
    const b = await makeTeam(db, { name: 'B' });
    const c = await makeTeam(db, { name: 'C' });
    const d = await makeTeam(db, { name: 'D' });

    // Partido de competencia sin prioridad: no debe aparecer.
    await upsertMatchByNaturalKey(db, {
      seasonId: minorSeason.id,
      round: 'Fecha 1',
      startsAt: new Date('2026-08-01T00:00:00Z'),
      homeTeamId: a.id,
      awayTeamId: b.id,
    });
    // Dos partidos de competencia importante, en orden inverso al que deben salir.
    const later = await upsertMatchByNaturalKey(db, {
      seasonId: importantSeason.id,
      round: 'Fecha 2',
      startsAt: new Date('2026-08-10T00:00:00Z'),
      homeTeamId: a.id,
      awayTeamId: c.id,
    });
    const sooner = await upsertMatchByNaturalKey(db, {
      seasonId: importantSeason.id,
      round: 'Fecha 1',
      startsAt: new Date('2026-08-02T00:00:00Z'),
      homeTeamId: b.id,
      awayTeamId: d.id,
    });

    const upcoming = await findUpcomingMatches(db, { limit: 5, now: new Date('2026-07-28T00:00:00Z') });
    expect(upcoming.map((m) => m.id)).toEqual([sooner.match.id, later.match.id]);
  });

  it('replaceStandings reemplaza la tabla completa y ordena por puntos', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db);
    const season = await makeSeason(db, competition.id);
    const a = await makeTeam(db, { name: 'A' });
    const b = await makeTeam(db, { name: 'B', badgeUrl: 'https://example.com/b.png' });
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
    expect(rows[0]!.teamBadgeUrl).toBe('https://example.com/b.png');
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

  // --- Players ---

  it('createPlayer persiste y findPlayerByNormalizedName lo encuentra', async () => {
    const { db } = handle;
    const player = await createPlayer(db, {
      fullName: 'Juan Cruz Pérez',
      normalizedName: 'cruz juan perez',
    });
    expect(player.fullName).toBe('Juan Cruz Pérez');
    expect(player.slug).toBe(player.id);

    const found = await findPlayerByNormalizedName(db, 'cruz juan perez');
    expect(found?.id).toBe(player.id);
  });

  it('createPlayer nunca fusiona: dos cargas del mismo nombre crean dos jugadores distintos', async () => {
    const { db } = handle;
    const first = await createPlayer(db, { fullName: 'Marcos Torrillas', normalizedName: 'marcos torrillas' });
    const second = await createPlayer(db, { fullName: 'Marcos Torrillas', normalizedName: 'marcos torrillas' });
    expect(second.id).not.toBe(first.id);
    expect(second.slug).not.toBe(first.slug);
    const all = await db.query.players.findMany();
    expect(all).toHaveLength(2);
  });

  it('findPlayerBySlug busca por slug', async () => {
    const { db } = handle;
    const player = await createPlayer(db, { fullName: 'Nicolás Sánchez', normalizedName: 'nicolas sanchez' });
    const found = await findPlayerBySlug(db, player.slug);
    expect(found?.fullName).toBe('Nicolás Sánchez');
  });

  it('searchPlayersByName encuentra por prefijo del primer nombre', async () => {
    const { db } = handle;
    await createPlayer(db, { fullName: 'Juan Cruz Pérez', normalizedName: 'cruz juan perez' });
    const results = await searchPlayersByName(db, { query: 'Juan' });
    expect(results).toHaveLength(1);
    expect(results[0]!.fullName).toBe('Juan Cruz Pérez');
  });

  it('searchPlayersByName encuentra por prefijo del apellido', async () => {
    const { db } = handle;
    await createPlayer(db, { fullName: 'Juan Cruz Pérez', normalizedName: 'cruz juan perez' });
    const results = await searchPlayersByName(db, { query: 'Pérez' });
    expect(results).toHaveLength(1);
    expect(results[0]!.fullName).toBe('Juan Cruz Pérez');
  });

  it('searchPlayersByName devuelve vacío sin coincidencias', async () => {
    const { db } = handle;
    await createPlayer(db, { fullName: 'Juan Cruz Pérez', normalizedName: 'cruz juan perez' });
    const results = await searchPlayersByName(db, { query: 'Nicolás' });
    expect(results).toHaveLength(0);
  });

  it('searchPlayersByName respeta el límite', async () => {
    const { db } = handle;
    for (let i = 0; i < 25; i += 1) {
      await createPlayer(db, { fullName: `Juan Pérez ${i}`, normalizedName: `juan perez${i}` });
    }
    const results = await searchPlayersByName(db, { query: 'Juan' });
    expect(results).toHaveLength(20);
    const limited = await searchPlayersByName(db, { query: 'Juan', limit: 5 });
    expect(limited).toHaveLength(5);
  });

  // --- Lineups ---

  it('getLineupsForMatch devuelve vacío cuando no hay datos', async () => {
    const { db } = handle;
    const match = await makeMatch(db, {
      seasonId: (await makeSeason(db, (await makeCompetition(db)).id)).id,
      homeTeamId: (await makeTeam(db)).id,
      awayTeamId: (await makeTeam(db)).id,
    });
    const result = await getLineupsForMatch(db, match.id);
    expect(result.home).toEqual([]);
    expect(result.away).toEqual([]);
  });

  it('replaceLineup guarda y getLineupsForMatch recupera entradas', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db);
    const season = await makeSeason(db, competition.id);
    const homeTeam = await makeTeam(db, { slug: 'home-fc', name: 'Home FC', shortName: 'HOM' });
    const awayTeam = await makeTeam(db, { slug: 'away-fc', name: 'Away FC', shortName: 'AWY' });
    const match = await makeMatch(db, { seasonId: season.id, homeTeamId: homeTeam.id, awayTeamId: awayTeam.id });

    const player = await createPlayer(db, {
      fullName: 'Marcos Torrillas',
      normalizedName: 'marcos torrillas',
    });

    await replaceLineup(db, {
      matchId: match.id,
      teamId: homeTeam.id,
      entries: [
        { playerId: player.id, shirtNumber: 1, isStarter: true, isCaptain: true },
      ],
    });

    const result = await getLineupsForMatch(db, match.id);
    expect(result.home).toHaveLength(1);
    expect(result.home[0]!.shirtNumber).toBe(1);
    expect(result.home[0]!.isCaptain).toBe(true);
    expect(result.home[0]!.player.fullName).toBe('Marcos Torrillas');
    expect(result.away).toHaveLength(0);
  });

  it('replaceLineup reemplaza entradas previas del mismo equipo', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db);
    const season = await makeSeason(db, competition.id);
    const homeTeam = await makeTeam(db, { slug: 'home', name: 'Home', shortName: 'HOM' });
    const awayTeam = await makeTeam(db, { slug: 'away', name: 'Away', shortName: 'AWY' });
    const match = await makeMatch(db, { seasonId: season.id, homeTeamId: homeTeam.id, awayTeamId: awayTeam.id });

    const p1 = await createPlayer(db, { fullName: 'Player 1', normalizedName: 'player 1' });
    const p2 = await createPlayer(db, { fullName: 'Player 2', normalizedName: 'player 2' });

    // Primera carga
    await replaceLineup(db, {
      matchId: match.id,
      teamId: homeTeam.id,
      entries: [{ playerId: p1.id, shirtNumber: 1, isStarter: true, isCaptain: true }],
    });

    // Reemplazo
    await replaceLineup(db, {
      matchId: match.id,
      teamId: homeTeam.id,
      entries: [{ playerId: p2.id, shirtNumber: 1, isStarter: true, isCaptain: false }],
    });

    const result = await getLineupsForMatch(db, match.id);
    expect(result.home).toHaveLength(1);
    expect(result.home[0]!.player.id).toBe(p2.id);
  });

  it('hasLineup detecta si hay formaciones cargadas', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db);
    const season = await makeSeason(db, competition.id);
    const homeTeam = await makeTeam(db, { slug: 'h', name: 'H', shortName: 'H' });
    const awayTeam = await makeTeam(db, { slug: 'a', name: 'A', shortName: 'A' });
    const match = await makeMatch(db, { seasonId: season.id, homeTeamId: homeTeam.id, awayTeamId: awayTeam.id });

    expect(await hasLineup(db, match.id)).toBe(false);

    const player = await createPlayer(db, { fullName: 'P', normalizedName: 'p' });
    await replaceLineup(db, {
      matchId: match.id,
      teamId: homeTeam.id,
      entries: [{ playerId: player.id, shirtNumber: 10, isStarter: true, isCaptain: false }],
    });

    expect(await hasLineup(db, match.id)).toBe(true);
  });

  it('listTeamsForCompetition obtiene equipos por standings, partidos u organización', async () => {
    const { db } = handle;
    const org = await upsertOrganization(db, { slug: 'cordoba', name: 'Unión Cordobesa de Rugby', kind: 'union', countryCode: 'AR' });
    const comp = await upsertCompetition(db, {
      slug: 'cordoba-top-10',
      name: 'Top 10 Cordoba',
      category: 'clubs',
      gender: 'male',
      countryCode: 'AR',
      organizationId: org.id,
    });

    await upsertTeams(db, [
      { slug: 'tala', name: 'Tala RC', shortName: 'TAL', countryCode: 'AR', union: 'cordoba' },
      { slug: 'tablada', name: 'La Tablada', shortName: 'TAB', countryCode: 'AR', union: 'Unión Cordobesa de Rugby' },
    ]);

    const fallback = await listTeamsForCompetition(db, comp.id);
    expect(fallback).toHaveLength(2);
    expect(fallback.map((t) => t.name)).toEqual(['La Tablada', 'Tala RC']);
  });
});
