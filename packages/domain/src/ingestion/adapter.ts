import type { ExternalArticleReference } from './external-article-reference';
import type { ExternalCompetition } from './external-competition';
import type { ExternalMatch } from './external-match';
import type { ExternalStandings } from './external-standing';
import type { ExternalTeam } from './external-team';
import type { Capability, SourceDescriptor } from './source';

export interface FetchContext {
  /** Ventana temporal opcional para fixtures/resultados. */
  from?: Date;
  to?: Date;
  seasonYear?: number;
  competitionExternalId?: string;
  signal?: AbortSignal;
}

/**
 * Contrato común de un adaptador de fuente deportiva. Cada método es opcional
 * según la `capability` declarada. El adaptador produce contratos internos
 * estables: nunca expone HTML, IDs ni formatos de terceros al resto del sistema.
 */
export interface SportsDataAdapter {
  readonly descriptor: SourceDescriptor;
  supports(capability: Capability): boolean;
  fetchCatalog?(ctx: FetchContext): Promise<{
    competitions: ExternalCompetition[];
    teams: ExternalTeam[];
  }>;
  fetchFixtures?(ctx: FetchContext): Promise<ExternalMatch[]>;
  fetchResults?(ctx: FetchContext): Promise<ExternalMatch[]>;
  fetchStandings?(ctx: FetchContext): Promise<ExternalStandings>;
  fetchNews?(ctx: FetchContext): Promise<ExternalArticleReference[]>;
}

export function supportsCapability(
  descriptor: SourceDescriptor,
  capability: Capability,
): boolean {
  return descriptor.capabilities.includes(capability);
}
