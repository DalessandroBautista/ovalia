import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Database } from '@ovalia/database';
import {
  createConflict,
  findCompetitionBySlug,
  findSeason,
  listTeams,
  recordArtifact,
  recordAudit,
  upsertMatchByNaturalKey,
} from '@ovalia/database';
import { normalizeName, parseOffsetDateTime } from '../normalization';

export const MATCHES_CSV_HEADER = [
  'competition_slug',
  'season_year',
  'round',
  'starts_at',
  'home_team',
  'away_team',
  'status',
  'home_score',
  'away_score',
] as const;

const rowSchema = z.object({
  competition_slug: z.string().min(1),
  season_year: z.coerce.number().int(),
  round: z.string().min(1),
  starts_at: z.string().datetime({ offset: true }),
  home_team: z.string().min(1),
  away_team: z.string().min(1),
  status: z.enum(['scheduled', 'live', 'halftime', 'final', 'postponed', 'cancelled']).default('scheduled'),
  home_score: z.string().optional(),
  away_score: z.string().optional(),
});

export interface CsvImportReport {
  totalRows: number;
  persisted: number;
  conflicts: number;
  errors: Array<{ line: number; message: string }>;
  dryRun: boolean;
  checksum: string;
}

/** Neutraliza fórmulas de CSV (previene ejecución en planillas). */
function sanitize(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function parseCsv(content: string): { header: string[]; rows: string[][] } {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) return { header: [], rows: [] };
  const header = lines[0]!.split(',').map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split(',').map((c) => sanitize(c.trim())));
  return { header, rows };
}

async function buildAliasIndex(db: Database): Promise<Map<string, string[]>> {
  const teams = await listTeams(db);
  const index = new Map<string, string[]>();
  const add = (name: string, id: string) => {
    const key = normalizeName(name);
    index.set(key, [...(index.get(key) ?? []), id]);
  };
  for (const team of teams) {
    add(team.name, team.id);
    add(team.shortName, team.id);
    add(team.slug, team.id);
    for (const alias of team.aliases) add(alias, team.id);
  }
  return index;
}

/**
 * Importa partidos desde CSV con validación, dry-run y trazabilidad.
 * Preserva archivo (checksum), usuario y conserva la misma identidad natural que
 * el pipeline automático, de modo que ambos son intercambiables.
 */
export async function importMatchesCsv(options: {
  db: Database;
  sourceId: string;
  content: string;
  actorId?: string | null;
  dryRun?: boolean;
}): Promise<CsvImportReport> {
  const { db, sourceId } = options;
  const checksum = createHash('sha256').update(options.content).digest('hex');
  const { header, rows } = parseCsv(options.content);
  const errors: CsvImportReport['errors'] = [];

  const expected = MATCHES_CSV_HEADER.join(',');
  if (header.join(',') !== expected) {
    return {
      totalRows: 0,
      persisted: 0,
      conflicts: 0,
      errors: [{ line: 1, message: `Cabecera inválida. Esperado: ${expected}` }],
      dryRun: options.dryRun ?? false,
      checksum,
    };
  }

  const aliasIndex = await buildAliasIndex(db);
  const resolveTeam = (name: string): string | null | 'ambiguous' => {
    const matches = Array.from(new Set(aliasIndex.get(normalizeName(name)) ?? []));
    if (matches.length === 1) return matches[0]!;
    if (matches.length > 1) return 'ambiguous';
    return null;
  };

  let persisted = 0;
  let conflicts = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const line = i + 2;
    const record = Object.fromEntries(header.map((h, idx) => [h, rows[i]![idx] ?? '']));
    const parsed = rowSchema.safeParse(record);
    if (!parsed.success) {
      errors.push({ line, message: parsed.error.issues[0]?.message ?? 'fila inválida' });
      continue;
    }
    const row = parsed.data;
    const competition = await findCompetitionBySlug(db, row.competition_slug);
    if (!competition) {
      errors.push({ line, message: `competencia desconocida: ${row.competition_slug}` });
      continue;
    }
    const season = await findSeason(db, competition.id, row.season_year);
    if (!season) {
      errors.push({ line, message: `temporada ${row.season_year} inexistente` });
      continue;
    }
    const home = resolveTeam(row.home_team);
    const away = resolveTeam(row.away_team);
    if (home === null || away === null || home === 'ambiguous' || away === 'ambiguous') {
      conflicts += 1;
      if (!options.dryRun) {
        await createConflict(db, {
          sourceId,
          entityType: 'match',
          candidates: [record],
          reason: 'equipo CSV sin resolver o ambiguo',
        });
      }
      continue;
    }
    if (!options.dryRun) {
      await upsertMatchByNaturalKey(db, {
        seasonId: season.id,
        round: row.round,
        startsAt: parseOffsetDateTime(row.starts_at),
        homeTeamId: home,
        awayTeamId: away,
        status: row.status,
        homeScore: row.home_score ? Number(row.home_score) : null,
        awayScore: row.away_score ? Number(row.away_score) : null,
        source: sourceId,
      });
    }
    persisted += 1;
  }

  if (!options.dryRun) {
    await recordArtifact(db, {
      sourceId,
      checksum,
      capability: 'fixtures',
      status: 'parsed',
      parserVersion: 'csv-1',
      payload: { rows: rows.length, actorId: options.actorId ?? null },
    });
    await recordAudit(db, {
      actorId: options.actorId ?? null,
      action: 'csv.import.matches',
      targetType: 'source',
      targetId: sourceId,
      metadata: { checksum, persisted, conflicts },
    });
  }

  return {
    totalRows: rows.length,
    persisted,
    conflicts,
    errors,
    dryRun: options.dryRun ?? false,
    checksum,
  };
}
