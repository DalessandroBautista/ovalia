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
  { externalId: '46738', name: 'European Rugby Champions Cup', slug: 'champions-cup', tier: 'senior', organizationSlug: 'rugby-internacional' },
  { externalId: '45036', name: 'Challenge Cup', slug: 'challenge-cup', tier: 'senior', organizationSlug: 'rugby-internacional' },
  { externalId: '32271', name: 'Currie Cup', slug: 'currie-cup', tier: 'senior', organizationSlug: 'currie-cup' },
  // id 68864 = Bunnings NPC de Nueva Zelanda (id 25463 Mitre 10 Cup solo tuvo datos hasta 2020)
  { externalId: '68864', name: 'Bunnings NPC', slug: 'bunnings-npc', tier: 'senior', organizationSlug: 'bunnings-npc' },
  { externalId: '59503', name: 'World Cup', slug: 'rugby-world-cup', tier: 'senior', organizationSlug: 'rugby-internacional' },
  { externalId: '13549', name: 'Premier 15s Women', slug: 'premiership-women', tier: 'senior', organizationSlug: 'premiership-rugby' },
  { externalId: '15251', name: 'Pro D2', slug: 'pro-d2', tier: 'senior', organizationSlug: 'pro-d2' },
  { externalId: '35675', name: 'Super Liga Americana', slug: 'super-rugby-americas', tier: 'senior', organizationSlug: 'rugby-internacional' },
  { externalId: '38228', name: 'Major League Rugby', slug: 'major-league-rugby', tier: 'senior', organizationSlug: 'major-league-rugby' },
  { externalId: '77374', name: 'Pacific Nations Cup', slug: 'pacific-nations-cup', tier: 'senior', organizationSlug: 'rugby-internacional' },
];

export const HIGHLIGHTLY_SLUG_BY_EXTERNAL_ID: ReadonlyMap<string, string> = new Map(
  HIGHLIGHTLY_COMPETITIONS.map((c) => [c.externalId, c.slug]),
);

