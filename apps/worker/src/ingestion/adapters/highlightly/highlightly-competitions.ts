export interface HighlightlyCompetitionRef {
  externalId: string;
  name: string;
  slug: string;
  tier: 'senior' | 'sevens';
  organizationSlug: string;
}

/** Competencias curadas de Highlightly (verificadas contra el API real en el diseño). */
export const HIGHLIGHTLY_COMPETITIONS: readonly HighlightlyCompetitionRef[] = [
  { externalId: '61205', name: 'Super Rugby', slug: 'super-rugby', tier: 'senior', organizationSlug: 'super-rugby' },
  { externalId: '73119', name: 'Rugby Championship', slug: 'rugby-championship', tier: 'senior', organizationSlug: 'rugby-internacional' },
  { externalId: '72268', name: 'Friendly International', slug: 'tests-internacionales', tier: 'senior', organizationSlug: 'rugby-internacional' },
  { externalId: '73970', name: "Seven's World Cup", slug: 'seven-world-cup', tier: 'sevens', organizationSlug: 'rugby-seven' },
];

export const HIGHLIGHTLY_SLUG_BY_EXTERNAL_ID: ReadonlyMap<string, string> = new Map(
  HIGHLIGHTLY_COMPETITIONS.map((c) => [c.externalId, c.slug]),
);
