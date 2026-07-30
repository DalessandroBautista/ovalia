export type ApiMatchStatus =
  | 'scheduled'
  | 'live'
  | 'halftime'
  | 'final'
  | 'postponed'
  | 'cancelled';

export type Freshness = 'fresh' | 'stale' | 'unknown';

export interface ApiTeamRef {
  slug: string;
  name: string;
  shortName: string;
  badgeUrl: string | null;
}

export interface ApiMatch {
  id: string;
  competition: { slug: string; name: string };
  season: number;
  round: string;
  startsAt: string;
  venue: string | null;
  status: ApiMatchStatus;
  home: ApiTeamRef;
  away: ApiTeamRef;
  homeScore: number | null;
  awayScore: number | null;
  source: string | null;
  freshness: Freshness;
}

export interface ApiMatchListResponse {
  generatedAt: string;
  matches: ApiMatch[];
  nextCursor: string | null;
}

export interface ApiStandingRow {
  position: number;
  team: { slug: string; name: string; badgeUrl: string | null };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  bonus: number;
  points: number;
}

export interface ApiStandingsResponse {
  competition: { slug: string; name: string };
  season: number;
  rows: ApiStandingRow[];
  source: string | null;
  freshness: Freshness;
}

export interface ApiCompetition {
  slug: string;
  name: string;
  category: string;
  gender: string;
  countryCode: string | null;
  coverage: string;
  organization: { slug: string; name: string } | null;
  familySlug: string | null;
  tier: string;
  priority: number;
}

export interface ApiCompetitionsResponse {
  competitions: ApiCompetition[];
}

export interface ApiOrganization {
  id: string;
  slug: string;
  name: string;
  kind: string;
  countryCode: string | null;
  competitionSlugs: string[];
}

export interface ApiOrganizationsResponse {
  organizations: ApiOrganization[];
}

export interface ApiArticleSummary {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string | null;
}

export interface ApiArticlesResponse {
  articles: ApiArticleSummary[];
}

export interface ApiArticleDetail {
  article: ApiArticleSummary & { body: string };
}

export interface ApiHomeResponse {
  generatedAt: string;
  stats: { competitions: number; clubs: number; live: number };
  contest: { slug: string; name: string; round: string | null; closesAt: string | null } | null;
  featuredArticle: { slug: string; title: string; summary: string; publishedAt: string | null } | null;
}

export interface ApiCompetitionDetail {
  competition: {
    slug: string;
    name: string;
    category: string;
    gender: string;
    coverage: string;
    familySlug: string | null;
    seasons: Array<{ year: number; name: string }>;
  };
}
