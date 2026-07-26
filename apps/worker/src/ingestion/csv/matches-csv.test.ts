import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseHandle } from '@ovalia/database';
import {
  getTestDatabase,
  isDatabaseAvailable,
  makeCompetition,
  makeSeason,
  makeSource,
  makeTeam,
  truncateAll,
} from '@ovalia/database/test-support';
import { importMatchesCsv, MATCHES_CSV_HEADER } from './matches-csv';

const available = await isDatabaseAvailable();
const HEADER = MATCHES_CSV_HEADER.join(',');

describe.skipIf(!available)('importMatchesCsv', () => {
  let handle: DatabaseHandle;

  beforeEach(async () => {
    handle = await getTestDatabase();
    await truncateAll(handle);
  });

  afterAll(async () => {
    if (available) await handle.pool.end().catch(() => undefined);
  });

  async function setup() {
    const { db } = handle;
    const source = await makeSource(db, { slug: 'manual' });
    const competition = await makeCompetition(db, { slug: 'liga-x' });
    const season = await makeSeason(db, competition.id, { year: 2026 });
    await makeTeam(db, { slug: 'sic', name: 'SIC', aliases: ['San Isidro Club'] });
    await makeTeam(db, { slug: 'casi', name: 'CASI' });
    return { db, sourceId: source.id, season };
  }

  it('dry-run valida sin persistir', async () => {
    const { db, sourceId } = await setup();
    const csv = `${HEADER}\nliga-x,2026,Fecha 1,2026-08-01T15:00:00-03:00,SIC,CASI,final,20,17`;
    const report = await importMatchesCsv({ db, sourceId, content: csv, dryRun: true });
    expect(report.persisted).toBe(1);
    expect(report.errors).toHaveLength(0);
    const matches = await db.query.matches.findMany();
    expect(matches).toHaveLength(0);
  });

  it('importa, es idempotente y registra artifact + auditoría', async () => {
    const { db, sourceId } = await setup();
    const csv = `${HEADER}\nliga-x,2026,Fecha 1,2026-08-01T15:00:00-03:00,San Isidro Club,CASI,final,20,17`;
    const first = await importMatchesCsv({ db, sourceId, content: csv });
    expect(first.persisted).toBe(1);
    const matches = await db.query.matches.findMany();
    expect(matches).toHaveLength(1);
    expect(matches[0]!.homeScore).toBe(20);

    // Reimportar el mismo CSV no duplica (identidad natural).
    const second = await importMatchesCsv({ db, sourceId, content: csv });
    expect(second.persisted).toBe(1);
    expect(await db.query.matches.findMany()).toHaveLength(1);

    const artifacts = await db.query.ingestionArtifacts.findMany();
    expect(artifacts.length).toBeGreaterThanOrEqual(1);
    const audit = await db.query.auditLog.findMany();
    expect(audit.some((a) => a.action === 'csv.import.matches')).toBe(true);
  });

  it('crea conflicto ante equipo desconocido', async () => {
    const { db, sourceId } = await setup();
    const csv = `${HEADER}\nliga-x,2026,Fecha 1,2026-08-01T15:00:00-03:00,SIC,Equipo Fantasma,scheduled,,`;
    const report = await importMatchesCsv({ db, sourceId, content: csv });
    expect(report.conflicts).toBe(1);
    expect(report.persisted).toBe(0);
    const conflicts = await db.query.ingestionConflicts.findMany();
    expect(conflicts).toHaveLength(1);
  });

  it('rechaza cabecera inválida', async () => {
    const { db, sourceId } = await setup();
    const report = await importMatchesCsv({ db, sourceId, content: 'foo,bar\n1,2' });
    expect(report.errors[0]!.message).toContain('Cabecera inválida');
  });

  it('neutraliza fórmulas de CSV', async () => {
    const { db, sourceId } = await setup();
    // Un equipo con prefijo de fórmula no debe resolver ni ejecutarse.
    const csv = `${HEADER}\nliga-x,2026,Fecha 1,2026-08-01T15:00:00-03:00,=cmd,CASI,scheduled,,`;
    const report = await importMatchesCsv({ db, sourceId, content: csv });
    expect(report.conflicts).toBe(1);
  });
});
