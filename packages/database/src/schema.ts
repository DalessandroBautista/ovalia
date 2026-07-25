import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

export const matchStatus = pgEnum('match_status', ['scheduled', 'live', 'halftime', 'final', 'postponed', 'cancelled']);
export const articleStatus = pgEnum('article_status', ['draft', 'review', 'published', 'archived']);
export const userRole = pgEnum('user_role', ['fan', 'contributor', 'editor', 'admin']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  role: userRole('role').notNull().default('fan'),
  locale: text('locale').notNull().default('es'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex('users_email_unique').on(table.email)]);

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  countryCode: text('country_code').notNull(),
  union: text('union'),
  badgeUrl: text('badge_url'),
  badgeSourceUrl: text('badge_source_url'),
  badgeFormat: text('badge_format'),
  badgeStatus: text('badge_status').notNull().default('pending'),
  badgeVerifiedAt: timestamp('badge_verified_at', { withTimezone: true }),
  aliases: jsonb('aliases').$type<string[]>().notNull().default([]),
  externalIds: jsonb('external_ids').$type<Record<string, string | number>>().notNull().default({}),
  active: boolean('active').notNull().default(true)
}, (table) => [uniqueIndex('teams_slug_unique').on(table.slug)]);

export const competitions = pgTable('competitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  countryCode: text('country_code'),
  category: text('category').notNull(),
  gender: text('gender').notNull(),
  format: text('format').notNull().default('xv'),
  priority: integer('priority').notNull().default(0)
}, (table) => [uniqueIndex('competitions_slug_unique').on(table.slug)]);

export const seasons = pgTable('seasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  competitionId: uuid('competition_id').notNull().references(() => competitions.id),
  name: text('name').notNull(),
  year: integer('year').notNull(),
  rules: jsonb('rules').notNull().default({})
}, (table) => [uniqueIndex('season_competition_year_unique').on(table.competitionId, table.year)]);

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  round: text('round').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  venue: text('venue'),
  status: matchStatus('status').notNull().default('scheduled'),
  homeTeamId: uuid('home_team_id').notNull().references(() => teams.id),
  awayTeamId: uuid('away_team_id').notNull().references(() => teams.id),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  homeTries: integer('home_tries').notNull().default(0),
  awayTries: integer('away_tries').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [index('matches_starts_at_idx').on(table.startsAt), index('matches_season_idx').on(table.seasonId)]);

export const matchEvents = pgTable('match_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  matchId: uuid('match_id').notNull().references(() => matches.id),
  sequence: integer('sequence').notNull(),
  minute: integer('minute').notNull(),
  side: text('side').notNull(),
  type: text('type').notNull(),
  playerName: text('player_name'),
  points: integer('points').notNull().default(0),
  source: text('source').notNull(),
  verifiedBy: uuid('verified_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex('match_events_sequence_unique').on(table.matchId, table.sequence)]);

export const standings = pgTable('standings', {
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  teamId: uuid('team_id').notNull().references(() => teams.id),
  played: integer('played').notNull().default(0),
  won: integer('won').notNull().default(0),
  drawn: integer('drawn').notNull().default(0),
  lost: integer('lost').notNull().default(0),
  pointsFor: integer('points_for').notNull().default(0),
  pointsAgainst: integer('points_against').notNull().default(0),
  bonus: integer('bonus').notNull().default(0),
  points: integer('points').notNull().default(0)
}, (table) => [primaryKey({ columns: [table.seasonId, table.teamId] })]);

export const predictions = pgTable('predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  matchId: uuid('match_id').notNull().references(() => matches.id),
  homeScore: integer('home_score').notNull(),
  awayScore: integer('away_score').notNull(),
  awardedPoints: integer('awarded_points'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex('prediction_user_match_unique').on(table.userId, table.matchId)]);

export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  body: text('body').notNull(),
  locale: text('locale').notNull().default('es'),
  status: articleStatus('status').notNull().default('draft'),
  authorId: uuid('author_id').references(() => users.id),
  aiGenerated: boolean('ai_generated').notNull().default(false),
  sourceData: jsonb('source_data').notNull().default({}),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex('articles_slug_locale_unique').on(table.slug, table.locale)]);

export const ingestionRuns = pgTable('ingestion_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull(),
  status: text('status').notNull(),
  payload: jsonb('payload').notNull().default({}),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true })
});
