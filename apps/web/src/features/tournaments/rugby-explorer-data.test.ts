import { describe, expect, it } from 'vitest';
import type { ApiCompetition, ApiOrganization } from '../../lib/api/types';
import type { AgendaMatch } from '../matches/agenda-data';
import { buildRugbyExplorer, filterMatchesByFamily } from './rugby-explorer-data';

const organizations: ApiOrganization[] = [
  { id: '1', slug: 'andina', name: 'Unión Andina de Rugby', kind: 'union', countryCode: 'AR', competitionSlugs: [] },
  { id: '2', slug: 'urba', name: 'Unión de Rugby de Buenos Aires', kind: 'union', countryCode: 'AR', competitionSlugs: ['urba-top-14', 'top-14-intermedia'] },
  { id: '3', slug: 'rosario', name: 'Unión de Rugby de Rosario', kind: 'union', countryCode: 'AR', competitionSlugs: ['regional-del-litoral-primera'] },
  { id: '4', slug: 'santa-fe', name: 'Unión Santafesina de Rugby', kind: 'union', countryCode: 'AR', competitionSlugs: ['regional-del-litoral-primera'] },
];

const competitions: ApiCompetition[] = [
  { slug: 'urba-top-14', name: 'TOP 14 - Superior', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'top-14', tier: 'senior', priority: 100 },
  { slug: 'top-14-intermedia', name: 'TOP 14 - Intermedia', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'auto', organization: { slug: 'urba', name: 'URBA' }, familySlug: 'top-14', tier: 'intermediate', priority: 0 },
  { slug: 'regional-del-litoral-primera', name: 'Torneo Regional del Litoral - Primera', category: 'clubs', gender: 'male', countryCode: 'AR', coverage: 'manual', organization: { slug: 'rosario', name: 'Unión de Rugby de Rosario' }, familySlug: 'regional-del-litoral', tier: 'senior', priority: 70 },
];

describe('buildRugbyExplorer', () => {
  it('conserva uniones sin torneos y prioriza las que tienen cobertura', () => {
    const explorer = buildRugbyExplorer(organizations, competitions);
    expect(explorer.map((union) => union.key)).toEqual(['urba', 'rosario', 'santa-fe', 'andina']);
    expect(explorer.find((union) => union.key === 'urba')?.shortLabel).toBe('URBA');
    expect(explorer.find((union) => union.key === 'andina')?.families).toEqual([]);
  });

  it('agrupa todas las divisiones de una familia y elige senior como destino canónico', () => {
    const top14 = buildRugbyExplorer(organizations, competitions)
      .find((union) => union.key === 'urba')?.families[0];
    expect(top14?.divisions.map((division) => division.slug)).toEqual(['urba-top-14', 'top-14-intermedia']);
    expect(top14?.canonicalSlug).toBe('urba-top-14');
  });

  it('presenta una competencia regional bajo cada unión asociada sin duplicarla dentro de ellas', () => {
    const explorer = buildRugbyExplorer(organizations, competitions);
    expect(explorer.find((union) => union.key === 'rosario')?.families.map((family) => family.key)).toEqual(['regional-del-litoral']);
    expect(explorer.find((union) => union.key === 'santa-fe')?.families.map((family) => family.key)).toEqual(['regional-del-litoral']);
  });
});

describe('filterMatchesByFamily', () => {
  it('incluye partidos de todas las divisiones de la familia elegida', () => {
    const matches = [
      { id: '1', competitionSlug: 'urba-top-14' },
      { id: '2', competitionSlug: 'top-14-intermedia' },
      { id: '3', competitionSlug: 'regional-del-litoral-primera' },
    ] as AgendaMatch[];
    expect(filterMatchesByFamily(matches, 'top-14', competitions).map((match) => match.id)).toEqual(['1', '2']);
  });
});
