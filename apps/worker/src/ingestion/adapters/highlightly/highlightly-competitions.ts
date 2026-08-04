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
  // TODO: verificar externalId de Six Nations contra la API de Highlightly.
  { externalId: 'PENDIENTE-six-nations', name: 'Six Nations', slug: 'six-nations', tier: 'senior', organizationSlug: 'rugby-internacional' },
  // TODO: verificar externalId de United Rugby Championship contra la API de Highlightly.
  // organizationSlug provisorio: torneo multinacional, agrupado como internacional.
  { externalId: 'PENDIENTE-united-rugby-championship', name: 'United Rugby Championship', slug: 'united-rugby-championship', tier: 'senior', organizationSlug: 'rugby-internacional' },
  // TODO: verificar externalId de Top 14 de Francia contra la API de Highlightly.
  { externalId: 'PENDIENTE-top-14-francia', name: 'Top 14 Francia', slug: 'top-14-francia', tier: 'senior', organizationSlug: 'top-14' },
  // TODO: verificar externalId de Premiership Rugby contra la API de Highlightly.
  // organizationSlug provisorio: liga doméstica, usa su propio slug como Super Rugby/Top 14.
  { externalId: 'PENDIENTE-premiership-rugby', name: 'Premiership Rugby', slug: 'premiership-rugby', tier: 'senior', organizationSlug: 'premiership-rugby' },
];

export const HIGHLIGHTLY_SLUG_BY_EXTERNAL_ID: ReadonlyMap<string, string> = new Map(
  HIGHLIGHTLY_COMPETITIONS.map((c) => [c.externalId, c.slug]),
);
