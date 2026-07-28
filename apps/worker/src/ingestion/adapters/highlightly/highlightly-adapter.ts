import type { Capability, ExternalMatch, ExternalStandings, FetchContext, SportsDataAdapter, SourceDescriptor } from '@ovalia/domain';
import { HighlightlyClient } from './highlightly-client';
import { HIGHLIGHTLY_COMPETITIONS } from './highlightly-competitions';
import { parseMatchesAsFixtures, parseMatchesAsTeams, parseStandingsPayload } from './highlightly-parser';

const DESCRIPTOR: SourceDescriptor = {
  slug: 'highlightly',
  name: 'Highlightly',
  priority: 70,
  capabilities: ['catalog', 'fixtures', 'results', 'standings'],
};

export class HighlightlyIngestAdapter implements SportsDataAdapter {
  readonly descriptor = DESCRIPTOR;

  constructor(private readonly client: HighlightlyClient) {}

  supports(capability: Capability): boolean {
    return this.descriptor.capabilities.includes(capability);
  }

  async fetchCatalog(_ctx: FetchContext) {
    const currentYear = new Date().getFullYear();
    const competitions = HIGHLIGHTLY_COMPETITIONS.map((c) => {
      const format: 'xv' | 'sevens' = c.tier === 'sevens' ? 'sevens' : 'xv';
      return {
        externalId: c.externalId,
        name: c.name,
        slug: c.slug,
        category: 'clubs' as const,
        gender: 'male' as const,
        format,
        season: { externalId: String(currentYear), name: String(currentYear), year: currentYear },
      };
    });
    const allMatchesRaw = await Promise.all(
      HIGHLIGHTLY_COMPETITIONS.map((c) => this.client.matches({ leagueId: Number(c.externalId) })),
    );
    const teams = allMatchesRaw.flatMap((raw) => parseMatchesAsTeams(raw));
    const uniqueTeams = [...new Map(teams.map((t) => [t.externalId, t])).values()];
    return { competitions, teams: uniqueTeams };
  }

  async fetchFixtures(ctx: FetchContext): Promise<ExternalMatch[]> {
    if (!ctx.competitionExternalId) throw new Error('Highlightly fixtures requiere competitionExternalId');
    const raw = await this.client.matches({ leagueId: Number(ctx.competitionExternalId) });
    return parseMatchesAsFixtures(raw, ctx.competitionExternalId);
  }

  fetchResults(ctx: FetchContext): Promise<ExternalMatch[]> {
    return this.fetchFixtures(ctx);
  }

  async fetchStandings(ctx: FetchContext): Promise<ExternalStandings> {
    if (!ctx.competitionExternalId) throw new Error('Highlightly standings requiere competitionExternalId');
    const season = ctx.seasonYear ?? new Date().getFullYear();
    const raw = await this.client.standings({ leagueId: Number(ctx.competitionExternalId), season });
    return parseStandingsPayload(raw, ctx.competitionExternalId, season);
  }
}
