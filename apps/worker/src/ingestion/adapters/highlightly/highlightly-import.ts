import type { Database } from '@ovalia/database';
import { runIngestion, type RunIngestionResult } from '../../run-ingestion';
import { HighlightlyIngestAdapter } from './highlightly-adapter';
import { HighlightlyClient } from './highlightly-client';

export interface HighlightlyImportOptions {
  db: Database;
  sourceId: string;
  adapter?: HighlightlyIngestAdapter;
  dryRun?: boolean;
}

export interface HighlightlyImportReport {
  catalog: RunIngestionResult;
  perCompetition: Array<{
    externalId: string;
    name: string;
    fixtures: RunIngestionResult;
    standings: RunIngestionResult;
  }>;
}

/** Importa el catálogo curado de Highlightly y, por cada competencia, fixtures y posiciones. */
export async function importHighlightly(options: HighlightlyImportOptions): Promise<HighlightlyImportReport> {
  const apiKey = process.env.HIGHLIGHTLY_API_KEY;
  if (!apiKey) throw new Error('HIGHLIGHTLY_API_KEY requerido para ingestión de Highlightly');
  const adapter = options.adapter ?? new HighlightlyIngestAdapter(new HighlightlyClient({ apiKey }));
  const base = {
    db: options.db,
    sourceId: options.sourceId,
    adapter,
    parserVersion: 'highlightly-1',
    dryRun: options.dryRun,
  } as const;

  const catalogPayload = await adapter.fetchCatalog!({});

  const catalog = await runIngestion({
    ...base,
    capability: 'catalog',
    context: {},
  });

  const perCompetition: HighlightlyImportReport['perCompetition'] = [];
  for (const competition of catalogPayload.competitions) {
    const context = { competitionExternalId: competition.externalId, seasonYear: competition.season.year };
    const fixtures = await runIngestion({ ...base, capability: 'fixtures', context });
    const standings = await runIngestion({ ...base, capability: 'standings', context });
    perCompetition.push({
      externalId: competition.externalId,
      name: competition.name,
      fixtures,
      standings,
    });
  }

  return { catalog, perCompetition };
}
