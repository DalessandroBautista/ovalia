import type { Database } from '@ovalia/database';
import { runIngestion, type RunIngestionResult } from '../../run-ingestion';
import { URBA_PARSER_VERSION } from './urba-parser';
import { UrbaAdapter } from './urba-adapter';

export interface UrbaImportOptions {
  db: Database;
  sourceId: string;
  adapter?: UrbaAdapter;
  seasonYear?: number;
  dryRun?: boolean;
  competitionExternalIds?: string[];
}

export interface UrbaImportReport {
  catalog: RunIngestionResult;
  perCompetition: Array<{
    externalId: string;
    name: string;
    fixtures: RunIngestionResult;
    standings: RunIngestionResult;
  }>;
}

/** Importa el catálogo y, por cada competencia del feed, fixtures y posiciones. */
export async function importUrba(options: UrbaImportOptions): Promise<UrbaImportReport> {
  const adapter = options.adapter ?? new UrbaAdapter();
  const seasonYear = options.seasonYear ?? 2026;
  const base = {
    db: options.db,
    sourceId: options.sourceId,
    adapter,
    parserVersion: URBA_PARSER_VERSION,
    dryRun: options.dryRun,
  } as const;

  // fetchCatalog no tiene efectos secundarios (solo lee de la API de URBA), así que se
  // puede llamar acá para conocer la lista real de competencias del feed, además de
  // dejar que runIngestion haga su propio fetch+persist con checksum/idempotencia.
  const catalogPayload = await adapter.fetchCatalog!({ seasonYear });

  const catalog = await runIngestion({
    ...base,
    capability: 'catalog',
    context: { seasonYear },
  });

  const competitions = options.competitionExternalIds
    ? catalogPayload.competitions.filter((c) =>
        options.competitionExternalIds!.includes(c.externalId),
      )
    : catalogPayload.competitions;

  const perCompetition: UrbaImportReport['perCompetition'] = [];
  for (const competition of competitions) {
    const context = { competitionExternalId: competition.externalId, seasonYear };
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
