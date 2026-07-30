import { describe, expect, it } from 'vitest';
import * as database from './index';
import { unionSlugForCompetition } from './seed-catalog.js';

type FederalSeedCatalog = {
  unionOrganizations: ReadonlyArray<{ slug: string; name: string; kind: 'union'; countryCode: 'AR' }>;
  manualCompetitions: ReadonlyArray<{
    slug: string;
    familySlug: string;
    organizationSlug: string;
    additionalOrganizationSlugs: readonly string[];
  }>;
};

function federalSeedCatalog(): FederalSeedCatalog | undefined {
  return (database as typeof database & { FEDERAL_SEED_CATALOG?: FederalSeedCatalog }).FEDERAL_SEED_CATALOG;
}

describe('FEDERAL_SEED_CATALOG', () => {
  it('incluye las 25 uniones oficiales sin duplicar slugs', () => {
    const organizations = federalSeedCatalog()?.unionOrganizations ?? [];
    expect(organizations).toHaveLength(25);
    expect(new Set(organizations.map((organization) => organization.slug)).size).toBe(25);
  });

  it('incluye un torneo cordobés manual sin datos deportivos inventados', () => {
    expect(federalSeedCatalog()?.manualCompetitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ organizationSlug: 'cordoba', familySlug: 'top-10-a' }),
    ]));
  });

  it('define un solo Regional del Litoral compartido por Rosario, Santa Fe y Entre Ríos', () => {
    const litoral = federalSeedCatalog()?.manualCompetitions.filter((competition) => competition.familySlug === 'regional-del-litoral') ?? [];
    expect(litoral).toHaveLength(1);
    expect(litoral[0]).toMatchObject({
      organizationSlug: 'rosario',
      additionalOrganizationSlugs: ['santa-fe', 'entrerriana'],
    });
  });

  it('asocia las competencias URBA heredadas sin capturar torneos nacionales', () => {
    expect(unionSlugForCompetition('urba-top-14')).toBe('urba');
    expect(unionSlugForCompetition('urba-primera-c')).toBe('urba');
    expect(unionSlugForCompetition('top-14-intermedia')).toBe('urba');
    expect(unionSlugForCompetition('primera-a-preintermedia')).toBe('urba');
    expect(unionSlugForCompetition('menores-de-19-nivel-1')).toBe('urba');
    expect(unionSlugForCompetition('femenino-desarrollo')).toBe('urba');
    expect(unionSlugForCompetition('rugby-universitario-campeonato')).toBe('urba');
    expect(unionSlugForCompetition('rugby-formativo-encuentro')).toBe('urba');
    expect(unionSlugForCompetition('torneo-interior-a')).toBeUndefined();
  });
});
