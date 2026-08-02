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

export type ApiFormResult = 'win' | 'draw' | 'loss';

export interface ApiHeadToHeadMatch {
  id: string;
  startsAt: string;
  homeTeamSlug: string;
  awayTeamSlug: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
}

export interface ApiTeamPosition {
  position: number;
  points: number;
  played: number;
}

export interface ApiMatchContext {
  headToHead: {
    played: number;
    homeWins: number;
    awayWins: number;
    draws: number;
    recent: ApiHeadToHeadMatch[];
  };
  form: { home: ApiFormResult[]; away: ApiFormResult[] };
  standings: { home: ApiTeamPosition | null; away: ApiTeamPosition | null };
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

export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  role: 'fan' | 'contributor' | 'editor' | 'admin';
  locale: string;
}

export interface ApiContestMatch {
  ordinal: number;
  match: ApiMatch;
}

export interface ApiContest {
  slug: string;
  name: string;
  round: string | null;
  status: 'draft' | 'open' | 'closed' | 'scored';
  opensAt: string | null;
  closesAt: string | null;
  matches: ApiContestMatch[];
}

export interface ApiPrediction {
  matchId: string;
  homeScore: number;
  awayScore: number;
  awardedPoints: number | null;
}

export interface ApiContestRankingEntry {
  position: number | null;
  points: number;
  user: { displayName: string } | null;
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

// --- Lineups (Tramo C) ---

export interface ApiLineupPlayer {
  slug: string;
  fullName: string;
}

export interface ApiLineupEntry {
  shirtNumber: number;
  isStarter: boolean;
  isCaptain: boolean;
  player: ApiLineupPlayer;
}

export interface ApiLineups {
  home: ApiLineupEntry[];
  away: ApiLineupEntry[];
}

export interface ApiPlayer {
  id: string;
  slug: string;
  fullName: string;
  normalizedName: string;
}

export interface PlayerSearchResponse {
  players: ApiPlayer[];
}

// --- Simulador de carrera ---

export interface ApiCareerClub {
  slug: string;
  name: string;
  level: number;
  badgeUrl: string | null;
}

export interface ApiCareerSummary {
  tier: string;
  verdict: string;
  score: number;
  comparison: { figure: string; reason: string };
  seasons: number;
  clubs: string[];
  peakLevel: number;
}

export interface ApiCareerSeasonRecord {
  season: number;
  age: number;
  clubSlug: string;
  clubName: string;
  level: number;
  rating: number;
  note: string;
}

export interface ApiCareerEntry {
  id: string;
  score: number;
  displayName: string;
  summary: ApiCareerSummary;
  surname: string;
  position: string;
  clubSlug: string;
  seed: number;
  decisions: number[];
  createdAt: string;
  history?: ApiCareerSeasonRecord[];
}
