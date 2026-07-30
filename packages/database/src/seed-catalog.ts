import { ARGENTINA_RUGBY_UNIONS } from '@ovalia/domain';

export function unionSlugForCompetition(competitionSlug: string): string | undefined {
  const urbaPrefixes = [
    'urba-',
    'top-14-',
    'primera-',
    'menores-de-',
    'femenino-',
    'rugby-universitario',
    'rugby-formativo',
  ];
  if (urbaPrefixes.some((prefix) => competitionSlug.startsWith(prefix))) return 'urba';
  return undefined;
}

export interface FederalManualCompetition {
  slug: string;
  name: string;
  familySlug: string;
  tier: 'senior';
  category: 'clubs';
  gender: 'male';
  countryCode: 'AR';
  coverage: 'manual';
  priority: number;
  organizationSlug: string;
  additionalOrganizationSlugs: readonly string[];
}

export const FEDERAL_SEED_CATALOG = {
  unionOrganizations: ARGENTINA_RUGBY_UNIONS,
  manualCompetitions: [
    {
      slug: 'cordoba-top-10-a-primera',
      name: 'TOP 10 A - Primera',
      familySlug: 'top-10-a',
      tier: 'senior',
      category: 'clubs',
      gender: 'male',
      countryCode: 'AR',
      coverage: 'manual',
      priority: 75,
      organizationSlug: 'cordoba',
      additionalOrganizationSlugs: [],
    },
    {
      slug: 'regional-del-litoral-primera',
      name: 'Torneo Regional del Litoral - Primera',
      familySlug: 'regional-del-litoral',
      tier: 'senior',
      category: 'clubs',
      gender: 'male',
      countryCode: 'AR',
      coverage: 'manual',
      priority: 70,
      organizationSlug: 'rosario',
      additionalOrganizationSlugs: ['santa-fe', 'entrerriana'],
    },
  ] satisfies readonly FederalManualCompetition[],
} as const;
