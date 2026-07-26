import { createHash } from 'node:crypto';
import type { Database } from '@ovalia/database';
import {
  createConflict,
  finishRun,
  findSeason,
  hasArtifact,
  linkExternalEntity,
  listExternalLinks,
  listTeams,
  recordArtifact,
  replaceStandings,
  resolveExternalEntity,
  startRun,
  upsertCompetition,
  upsertMatchByNaturalKey,
  upsertSeason,
  upsertTeams,
} from '@ovalia/database';
import type {
  Capability,
  ExternalMatch,
  ExternalStandings,
  FetchContext,
  SportsDataAdapter,
} from '@ovalia/domain';
import { normalizeName, parseOffsetDateTime, resolveEntity } from './normalization';
import type { EntityLookups } from './normalization';

export interface RunIngestionOptions {
  db: Database;
  sourceId: string;
  adapter: SportsDataAdapter;
  capability: Capability;
  parserVersion: string;
  context?: FetchContext;
  dryRun?: boolean;
  now?: () => Date;
}

export interface RunIngestionResult {
  runId: string;
  status: 'success' | 'skipped' | 'failed';
  checksum: string;
  persisted: number;
  conflicts: number;
  skipped: boolean;
  error?: string;
}

function checksumOf(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function buildTeamLookups(db: Database, sourceId: string): Promise<EntityLookups> {
  const teamRows = await listTeams(db);
  const links = await listExternalLinks(db, sourceId, 'team');
  const byExt = new Map<string, string>();
  for (const link of links) if (link.ovaliaId) byExt.set(link.externalId, link.ovaliaId);
  const byAliasMap = new Map<string, string[]>();
  const add = (name: string, id: string) => {
    const key = normalizeName(name);
    byAliasMap.set(key, [...(byAliasMap.get(key) ?? []), id]);
  };
  for (const team of teamRows) {
    add(team.name, team.id);
    add(team.shortName, team.id);
    for (const alias of team.aliases) add(alias, team.id);
  }
  return {
    byExternalId: (id) => byExt.get(id) ?? null,
    byAlias: (norm) => byAliasMap.get(norm) ?? [],
  };
}

async function resolveSeasonId(
  db: Database,
  match: Pick<ExternalMatch, 'competitionExternalId' | 'seasonYear'>,
  sourceId: string,
): Promise<string | null> {
  const competitionOvaliaId = await resolveExternalEntity(
    db,
    sourceId,
    'competition',
    match.competitionExternalId,
  );
  if (!competitionOvaliaId) return null;
  const season = await findSeason(db, competitionOvaliaId, match.seasonYear);
  return season?.id ?? null;
}

/** Orquesta una corrida de ingestión trazable e idempotente. */
export async function runIngestion(options: RunIngestionOptions): Promise<RunIngestionResult> {
  const { db, adapter, capability, sourceId, parserVersion } = options;
  const run = await startRun(db, adapter.descriptor.slug);
  try {
    const payload = await fetchCapability(adapter, capability, options.context ?? {});
    const checksum = checksumOf(payload);

    if (await hasArtifact(db, sourceId, checksum)) {
      await finishRun(db, run.id, { status: 'success', payload: { skipped: true } });
      return { runId: run.id, status: 'skipped', checksum, persisted: 0, conflicts: 0, skipped: true };
    }

    let persisted = 0;
    let conflicts = 0;

    if (!options.dryRun) {
      if (capability === 'catalog') {
        ({ persisted } = await persistCatalog(db, sourceId, payload as CatalogPayload));
      } else if (capability === 'fixtures' || capability === 'results') {
        ({ persisted, conflicts } = await persistMatches(db, sourceId, payload as ExternalMatch[]));
      } else if (capability === 'standings') {
        ({ persisted, conflicts } = await persistStandings(
          db,
          sourceId,
          payload as ExternalStandings,
          adapter.descriptor.slug,
        ));
      }
      await recordArtifact(db, {
        sourceId,
        checksum,
        runId: run.id,
        capability,
        parserVersion,
        status: 'parsed',
        payload,
      });
    }

    await finishRun(db, run.id, { status: 'success', payload: { persisted, conflicts } });
    return {
      runId: run.id,
      status: 'success',
      checksum,
      persisted,
      conflicts,
      skipped: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(db, run.id, { status: 'failed', error: message });
    return {
      runId: run.id,
      status: 'failed',
      checksum: '',
      persisted: 0,
      conflicts: 0,
      skipped: false,
      error: message,
    };
  }
}

type CatalogPayload = Awaited<ReturnType<NonNullable<SportsDataAdapter['fetchCatalog']>>>;

async function fetchCapability(
  adapter: SportsDataAdapter,
  capability: Capability,
  ctx: FetchContext,
): Promise<unknown> {
  switch (capability) {
    case 'catalog':
      if (!adapter.fetchCatalog) throw new Error('adapter lacks catalog');
      return adapter.fetchCatalog(ctx);
    case 'fixtures':
      if (!adapter.fetchFixtures) throw new Error('adapter lacks fixtures');
      return adapter.fetchFixtures(ctx);
    case 'results':
      if (!adapter.fetchResults) throw new Error('adapter lacks results');
      return adapter.fetchResults(ctx);
    case 'standings':
      if (!adapter.fetchStandings) throw new Error('adapter lacks standings');
      return adapter.fetchStandings(ctx);
    default:
      throw new Error(`unsupported capability: ${capability}`);
  }
}

async function persistCatalog(db: Database, sourceId: string, payload: CatalogPayload) {
  let persisted = 0;
  for (const competition of payload.competitions) {
    const slug = normalizeName(competition.name).replace(/\s+/g, '-');
    const saved = await upsertCompetition(db, {
      slug,
      name: competition.name,
      category: competition.category,
      gender: competition.gender,
      countryCode: competition.countryCode ?? null,
      format: competition.format,
      coverage: 'auto',
    });
    const season = await upsertSeason(db, {
      competitionId: saved.id,
      name: competition.season.name,
      year: competition.season.year,
    });
    await linkExternalEntity(db, {
      sourceId,
      entityType: 'competition',
      externalId: competition.externalId,
      ovaliaId: saved.id,
    });
    void season;
    persisted += 1;
  }
  await upsertTeams(
    db,
    payload.teams.map((team) => ({
      slug: normalizeName(team.name).replace(/\s+/g, '-'),
      name: team.name,
      shortName: team.shortName ?? team.name.slice(0, 3).toUpperCase(),
      countryCode: team.countryCode ?? 'AR',
      union: team.union ?? null,
      badgeUrl: team.badgeUrl ?? null,
    })),
  );
  // Enlaza external IDs de equipos recién creados.
  const lookups = await buildTeamLookups(db, sourceId);
  for (const team of payload.teams) {
    const resolved = resolveEntity({ externalId: team.externalId, name: team.name }, lookups);
    if (resolved.kind === 'valid') {
      await linkExternalEntity(db, {
        sourceId,
        entityType: 'team',
        externalId: team.externalId,
        ovaliaId: resolved.value.ovaliaId,
      });
      persisted += 1;
    }
  }
  return { persisted };
}

async function persistMatches(db: Database, sourceId: string, matches: ExternalMatch[]) {
  const lookups = await buildTeamLookups(db, sourceId);
  let persisted = 0;
  let conflicts = 0;
  for (const match of matches) {
    const seasonId = await resolveSeasonId(db, match, sourceId);
    const home = resolveEntity({ externalId: match.homeTeamExternalId, name: match.homeTeamExternalId }, lookups);
    const away = resolveEntity({ externalId: match.awayTeamExternalId, name: match.awayTeamExternalId }, lookups);
    if (!seasonId || home.kind !== 'valid' || away.kind !== 'valid') {
      await createConflict(db, {
        sourceId,
        entityType: 'match',
        candidates: [match],
        reason: !seasonId ? 'temporada/competencia sin resolver' : 'equipo sin resolver',
      });
      conflicts += 1;
      continue;
    }
    await upsertMatchByNaturalKey(db, {
      seasonId,
      round: match.round,
      startsAt: parseOffsetDateTime(match.startsAt),
      homeTeamId: home.value.ovaliaId,
      awayTeamId: away.value.ovaliaId,
      venue: match.venue ?? null,
      status: match.status,
      homeScore: match.homeScore ?? null,
      awayScore: match.awayScore ?? null,
      homeTries: match.homeTries ?? 0,
      awayTries: match.awayTries ?? 0,
      source: sourceId,
    });
    persisted += 1;
  }
  return { persisted, conflicts };
}

async function persistStandings(
  db: Database,
  sourceId: string,
  standings: ExternalStandings,
  source: string,
) {
  const seasonId = await resolveSeasonId(db, standings, sourceId);
  if (!seasonId) {
    await createConflict(db, {
      sourceId,
      entityType: 'standings',
      candidates: [standings],
      reason: 'temporada/competencia sin resolver',
    });
    return { persisted: 0, conflicts: 1 };
  }
  const lookups = await buildTeamLookups(db, sourceId);
  const rows: Parameters<typeof replaceStandings>[2] = [];
  let conflicts = 0;
  for (const row of standings.rows) {
    const team = resolveEntity({ externalId: row.teamExternalId, name: row.teamExternalId }, lookups);
    if (team.kind !== 'valid') {
      await createConflict(db, {
        sourceId,
        entityType: 'standings-row',
        candidates: [row],
        reason: 'equipo sin resolver',
      });
      conflicts += 1;
      continue;
    }
    rows.push({
      teamId: team.value.ovaliaId,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      bonus: row.bonus,
      points: row.points,
    });
  }
  if (rows.length > 0) await replaceStandings(db, seasonId, rows, source);
  return { persisted: rows.length, conflicts };
}
