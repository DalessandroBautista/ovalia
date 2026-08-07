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

interface LeagueRef {
  id: number;
  seasons: Array<{ season: number }>;
}

/** Temporada más reciente disponible de una liga, o null si no expone seasons. */
function latestSeasonOf(league: LeagueRef): number | null {
  const seasons = league.seasons.map((s) => s.season);
  return seasons.length > 0 ? Math.max(...seasons) : null;
}

export class HighlightlyIngestAdapter implements SportsDataAdapter {
  readonly descriptor = DESCRIPTOR;

  constructor(private readonly client: HighlightlyClient) {}

  supports(capability: Capability): boolean {
    return this.descriptor.capabilities.includes(capability);
  }

  /** Mapa leagueId → temporada más reciente, cacheado por instancia. */
  private async seasonByLeague(): Promise<Map<number, number>> {
    const raw = await this.client.leagues();
    // La API envuelve la lista en { data: [...] } (igual que /matches).
    const leagues = (Array.isArray(raw) ? raw : (raw as { data?: LeagueRef[] }).data) ?? [];
    const map = new Map<number, number>();
    for (const league of leagues) {
      const latest = latestSeasonOf(league);
      if (latest !== null) map.set(league.id, latest);
    }
    return map;
  }

  async fetchCatalog(_ctx: FetchContext) {
    void _ctx;
    const currentYear = new Date().getFullYear();
    // Resolvemos la temporada real de cada liga: fijar el año actual hace que las
    // ligas cuya temporada vigente es otra (p.ej. Rugby Championship 2025, World
    // Cup 2027) devuelvan 404 al pedir fixtures/standings de un año inexistente.
    const seasonByLeague = await this.seasonByLeague();
    // Los externalId 'PENDIENTE-*' aún no tienen leagueId real de Highlightly:
    // se excluyen del catálogo para no llamar a la API con Number(...) = NaN.
    const readyCompetitions = HIGHLIGHTLY_COMPETITIONS.filter((c) => !c.externalId.startsWith('PENDIENTE-'));
    const competitions = readyCompetitions.map((c) => {
      const format: 'xv' | 'sevens' = c.tier === 'sevens' ? 'sevens' : 'xv';
      const year = seasonByLeague.get(Number(c.externalId)) ?? currentYear;
      return {
        externalId: c.externalId,
        name: c.name,
        slug: c.slug,
        category: 'clubs' as const,
        gender: 'male' as const,
        format,
        season: { externalId: String(year), name: String(year), year },
      };
    });
    const allMatchesRaw = await Promise.all(
      readyCompetitions.map((c) => this.client.matches({ leagueId: Number(c.externalId) })),
    );
    const teams = allMatchesRaw.flatMap((raw) => parseMatchesAsTeams(raw));
    const uniqueTeams = [...new Map(teams.map((t) => [t.externalId, t])).values()];
    return { competitions, teams: uniqueTeams };
  }

  async fetchFixtures(ctx: FetchContext): Promise<ExternalMatch[]> {
    if (!ctx.competitionExternalId) throw new Error('Highlightly fixtures requiere competitionExternalId');
    // Se filtra por season para que coincida con la temporada que fetchCatalog creó en
    // Ovalia — sin este filtro, /matches devuelve partidos de varios años y el resolver
    // de temporada de run-ingestion los marca en conflicto por no encontrar la season.
    const raw = await this.client.matches({ leagueId: Number(ctx.competitionExternalId), season: ctx.seasonYear });
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
