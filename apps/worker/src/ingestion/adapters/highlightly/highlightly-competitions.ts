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
  { externalId: '44185', name: 'Six Nations', slug: 'six-nations', tier: 'senior', organizationSlug: 'rugby-internacional' },
  // organizationSlug: torneo multinacional (Sudáfrica + islas británicas + Italia), agrupado como internacional.
  { externalId: '65460', name: 'United Rugby Championship', slug: 'united-rugby-championship', tier: 'senior', organizationSlug: 'rugby-internacional' },
  { externalId: '14400', name: 'Top 14 Francia', slug: 'top-14-francia', tier: 'senior', organizationSlug: 'top-14' },
  // id 11847 = Premiership Rugby de Inglaterra; Highlightly también expone ligas homónimas
  // en Austria (5039) y Gales (41632) que no son la liga inglesa real.
  { externalId: '11847', name: 'Premiership Rugby', slug: 'premiership-rugby', tier: 'senior', organizationSlug: 'premiership-rugby' },
];

export const HIGHLIGHTLY_SLUG_BY_EXTERNAL_ID: ReadonlyMap<string, string> = new Map(
  HIGHLIGHTLY_COMPETITIONS.map((c) => [c.externalId, c.slug]),
);
