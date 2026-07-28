import type {
  Capability,
  ExternalMatch,
  ExternalStandings,
  FetchContext,
  SportsDataAdapter,
  SourceDescriptor,
} from '@ovalia/domain';
import { UrbaClient } from './urba-client';
import {
  URBA_PRIORITY_COMPETITIONS,
  URBA_SLUG_BY_EXTERNAL_ID,
} from './urba-competitions';
import {
  parseClubsAsTeams,
  parseCompetitions,
  parseFixtures,
  parseStandings,
} from './urba-parser';

const DESCRIPTOR: SourceDescriptor = {
  slug: 'urba',
  name: 'Unión de Rugby de Buenos Aires',
  priority: 90,
  capabilities: ['catalog', 'fixtures', 'results', 'standings'],
};

const DEFAULT_YEAR = 2026;

export class UrbaAdapter implements SportsDataAdapter {
  readonly descriptor = DESCRIPTOR;

  constructor(private readonly client: UrbaClient = new UrbaClient()) {}

  supports(capability: Capability): boolean {
    return this.descriptor.capabilities.includes(capability);
  }

  async fetchCatalog(ctx: FetchContext) {
    const year = ctx.seasonYear ?? DEFAULT_YEAR;
    const [championshipsRaw, clubsRaw] = await Promise.all([
      this.client.championships(year),
      this.client.clubs(),
    ]);
    return {
      competitions: parseCompetitions(championshipsRaw, undefined, URBA_SLUG_BY_EXTERNAL_ID),
      teams: parseClubsAsTeams(clubsRaw),
    };
  }

  async fetchFixtures(ctx: FetchContext): Promise<ExternalMatch[]> {
    const ids = ctx.competitionExternalId
      ? [ctx.competitionExternalId]
      : URBA_PRIORITY_COMPETITIONS.map((c) => c.externalId);
    const all: ExternalMatch[] = [];
    for (const id of ids) {
      const raw = await this.client.championship(id);
      all.push(...parseFixtures(raw));
    }
    return all;
  }

  fetchResults(ctx: FetchContext): Promise<ExternalMatch[]> {
    // El detalle de URBA incluye resultados y fixtures en el mismo endpoint.
    return this.fetchFixtures(ctx);
  }

  async fetchStandings(ctx: FetchContext): Promise<ExternalStandings> {
    if (!ctx.competitionExternalId) {
      throw new Error('URBA standings requiere competitionExternalId');
    }
    const year = ctx.seasonYear ?? DEFAULT_YEAR;
    const raw = await this.client.positions(ctx.competitionExternalId);
    return parseStandings(raw, ctx.competitionExternalId, year);
  }
}
