import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from './client';
import {
  editorialOverrides,
  externalEntities,
  ingestionArtifacts,
  matches,
  predictions,
  seasons,
  sessions,
} from './schema';
import {
  makeCompetition,
  makeContest,
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

describe.skipIf(!available)('schema constraints', () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    handle = await getTestDatabase();
    await truncateAll(handle);
  });

  afterAll(async () => {
    if (available) await handle.pool.end().catch(() => undefined);
  });

  it('rechaza external ID duplicado por fuente y tipo', async () => {
    const { db } = handle;
    const source = await makeSource(db);
    const team = await makeTeam(db);
    await db.insert(externalEntities).values({
      sourceId: source.id,
      entityType: 'team',
      externalId: 'ext-1',
      ovaliaId: team.id,
    });
    await expect(
      db.insert(externalEntities).values({
        sourceId: source.id,
        entityType: 'team',
        externalId: 'ext-1',
        ovaliaId: team.id,
      }),
    ).rejects.toThrow();
  });

  it('rechaza un partido con local y visitante iguales', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db);
    const season = await makeSeason(db, competition.id);
    const team = await makeTeam(db);
    await expect(
      db.insert(matches).values({
        seasonId: season.id,
        round: 'Fecha 1',
        startsAt: new Date('2026-08-01T18:00:00Z'),
        homeTeamId: team.id,
        awayTeamId: team.id,
      }),
    ).rejects.toThrow();
  });

  it('rechaza predicción duplicada por usuario/concurso/partido', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db);
    const season = await makeSeason(db, competition.id);
    const home = await makeTeam(db);
    const away = await makeTeam(db);
    const user = await makeUser(db);
    const contest = await makeContest(db, { seasonId: season.id });
    const [match0] = await db
      .insert(matches)
      .values({
        seasonId: season.id,
        round: 'Fecha 1',
        startsAt: new Date('2026-08-01T18:00:00Z'),
        homeTeamId: home.id,
        awayTeamId: away.id,
      })
      .returning();
    await db.insert(predictions).values({
      userId: user.id,
      contestId: contest.id,
      matchId: match0!.id,
      homeScore: 10,
      awayScore: 7,
    });
    await expect(
      db.insert(predictions).values({
        userId: user.id,
        contestId: contest.id,
        matchId: match0!.id,
        homeScore: 20,
        awayScore: 5,
      }),
    ).rejects.toThrow();
  });

  it('rechaza slug de competencia duplicado y temporada duplicada', async () => {
    const { db } = handle;
    const competition = await makeCompetition(db, { slug: 'dup-comp' });
    await expect(makeCompetition(db, { slug: 'dup-comp' })).rejects.toThrow();
    await makeSeason(db, competition.id, { year: 2026 });
    await expect(
      db
        .insert(seasons)
        .values({ competitionId: competition.id, name: '2026 bis', year: 2026 }),
    ).rejects.toThrow();
  });

  it('rechaza artifact duplicado por fuente y checksum (idempotencia)', async () => {
    const { db } = handle;
    const source = await makeSource(db);
    await db
      .insert(ingestionArtifacts)
      .values({ sourceId: source.id, checksum: 'abc123' });
    await expect(
      db.insert(ingestionArtifacts).values({ sourceId: source.id, checksum: 'abc123' }),
    ).rejects.toThrow();
  });

  it('exige autor y motivo en un override editorial', async () => {
    const { db } = handle;
    await expect(
      db.execute(
        sql`insert into editorial_overrides (target_type, target_id) values ('match', 'x')`,
      ),
    ).rejects.toThrow();
    const user = await makeUser(db);
    const [row] = await db
      .insert(editorialOverrides)
      .values({
        targetType: 'match',
        targetId: 'x',
        reason: 'corrección verificada',
        authorId: user.id,
      })
      .returning();
    expect(row!.reason).toBe('corrección verificada');
  });

  it('elimina sesiones en cascada al borrar el usuario', async () => {
    const { db } = handle;
    const user = await makeUser(db);
    await db.insert(sessions).values({
      userId: user.id,
      tokenHash: 'hash-1',
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    await db.execute(sql`delete from users where id = ${user.id}`);
    const remaining = await db.query.sessions.findMany();
    expect(remaining).toHaveLength(0);
  });

  it('tiene los índices clave presentes', async () => {
    const { db } = handle;
    const rows = await db.execute<{ indexname: string }>(
      sql`select indexname from pg_indexes where schemaname = 'public'`,
    );
    const names = rows.rows.map((r) => r.indexname);
    for (const expected of [
      'matches_starts_at_idx',
      'matches_status_idx',
      'external_entity_source_type_id_unique',
      'ingestion_artifact_source_checksum_unique',
      'jobs_status_run_idx',
      'articles_status_published_idx',
    ]) {
      expect(names).toContain(expected);
    }
  });
});
