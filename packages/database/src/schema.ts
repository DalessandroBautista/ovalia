import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
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
export const ingestionArtifactStatus = pgEnum('ingestion_artifact_status', ['pending', 'fetched', 'parsed', 'failed', 'skipped']);
export const conflictStatus = pgEnum('conflict_status', ['open', 'resolved', 'dismissed']);
export const jobStatus = pgEnum('job_status', ['pending', 'running', 'done', 'failed']);
export const contestStatus = pgEnum('contest_status', ['draft', 'open', 'closed', 'scored']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  role: userRole('role').notNull().default('fan'),
  locale: text('locale').notNull().default('es'),
  passwordHash: text('password_hash'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
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
  organizationId: uuid('organization_id').references(() => organizations.id),
  countryCode: text('country_code'),
  category: text('category').notNull(),
  gender: text('gender').notNull(),
  format: text('format').notNull().default('xv'),
  priority: integer('priority').notNull().default(0),
  coverage: text('coverage').notNull().default('manual')
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
  phaseId: uuid('phase_id').references(() => competitionPhases.id),
  roundId: uuid('round_id').references(() => rounds.id),
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
  source: text('source'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index('matches_starts_at_idx').on(table.startsAt),
  index('matches_season_idx').on(table.seasonId),
  index('matches_status_idx').on(table.status),
  check('matches_teams_distinct', sql`${table.homeTeamId} <> ${table.awayTeamId}`)
]);

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
  points: integer('points').notNull().default(0),
  source: text('source'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true })
}, (table) => [primaryKey({ columns: [table.seasonId, table.teamId] })]);

export const predictions = pgTable('predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  contestId: uuid('contest_id').references(() => predictionContests.id),
  matchId: uuid('match_id').notNull().references(() => matches.id),
  homeScore: integer('home_score').notNull(),
  awayScore: integer('away_score').notNull(),
  awardedPoints: integer('awarded_points'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex('prediction_user_contest_match_unique').on(table.userId, table.contestId, table.matchId)
]);

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
}, (table) => [
  uniqueIndex('articles_slug_locale_unique').on(table.slug, table.locale),
  index('articles_status_published_idx').on(table.status, table.publishedAt)
]);

export const ingestionRuns = pgTable('ingestion_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: text('provider').notNull(),
  status: text('status').notNull(),
  payload: jsonb('payload').notNull().default({}),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true })
});

// --- Ampliación canónica (Hito 1) ---

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  kind: text('kind').notNull().default('union'),
  countryCode: text('country_code'),
  active: boolean('active').notNull().default(true)
}, (table) => [uniqueIndex('organizations_slug_unique').on(table.slug)]);

export const competitionPhases = pgTable('competition_phases', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  name: text('name').notNull(),
  type: text('type').notNull().default('regular'),
  ordinal: integer('ordinal').notNull().default(0)
}, (table) => [uniqueIndex('phase_season_name_unique').on(table.seasonId, table.name)]);

export const rounds = pgTable('rounds', {
  id: uuid('id').primaryKey().defaultRandom(),
  phaseId: uuid('phase_id').references(() => competitionPhases.id),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  name: text('name').notNull(),
  number: integer('number'),
  startsAt: timestamp('starts_at', { withTimezone: true }),
  endsAt: timestamp('ends_at', { withTimezone: true })
}, (table) => [uniqueIndex('round_season_name_unique').on(table.seasonId, table.name)]);

export const externalSources = pgTable('external_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  priority: integer('priority').notNull().default(0),
  baseUrl: text('base_url'),
  capabilities: jsonb('capabilities').$type<string[]>().notNull().default([]),
  termsUrl: text('terms_url'),
  attribution: text('attribution'),
  automationAllowed: boolean('automation_allowed').notNull().default(false),
  robotsCheckedAt: timestamp('robots_checked_at', { withTimezone: true }),
  active: boolean('active').notNull().default(false)
}, (table) => [uniqueIndex('external_sources_slug_unique').on(table.slug)]);

export const externalEntities = pgTable('external_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').notNull().references(() => externalSources.id),
  entityType: text('entity_type').notNull(),
  externalId: text('external_id').notNull(),
  ovaliaId: uuid('ovalia_id'),
  confidence: integer('confidence'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex('external_entity_source_type_id_unique').on(table.sourceId, table.entityType, table.externalId),
  index('external_entity_ovalia_idx').on(table.entityType, table.ovaliaId)
]);

export const ingestionArtifacts = pgTable('ingestion_artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').references(() => ingestionRuns.id),
  sourceId: uuid('source_id').references(() => externalSources.id),
  capability: text('capability'),
  url: text('url'),
  status: ingestionArtifactStatus('status').notNull().default('pending'),
  contentType: text('content_type'),
  checksum: text('checksum').notNull(),
  parserVersion: text('parser_version'),
  rawPath: text('raw_path'),
  payload: jsonb('payload'),
  error: text('error'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex('ingestion_artifact_source_checksum_unique').on(table.sourceId, table.checksum),
  index('ingestion_artifact_checksum_idx').on(table.checksum)
]);

export const ingestionConflicts = pgTable('ingestion_conflicts', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id').references(() => externalSources.id),
  entityType: text('entity_type').notNull(),
  status: conflictStatus('status').notNull().default('open'),
  candidates: jsonb('candidates').notNull().default([]),
  resolution: jsonb('resolution'),
  reason: text('reason'),
  createdBy: uuid('created_by').references(() => users.id),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true })
}, (table) => [index('ingestion_conflict_status_idx').on(table.status)]);

export const editorialOverrides = pgTable('editorial_overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  patch: jsonb('patch').notNull().default({}),
  reason: text('reason').notNull(),
  authorId: uuid('author_id').notNull().references(() => users.id),
  verificationSource: text('verification_source'),
  effectiveFrom: timestamp('effective_from', { withTimezone: true }).notNull().defaultNow(),
  effectiveUntil: timestamp('effective_until', { withTimezone: true }),
  closed: boolean('closed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [index('editorial_override_target_idx').on(table.targetType, table.targetId)]);

export const standingsSnapshots = pgTable('standings_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').notNull().references(() => seasons.id),
  source: text('source').notNull(),
  rows: jsonb('rows').notNull().default([]),
  checksum: text('checksum'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [index('standings_snapshot_season_idx').on(table.seasonId)]);

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index('audit_log_created_idx').on(table.createdAt),
  index('audit_log_target_idx').on(table.targetType, table.targetId)
]);

// --- Autenticación (base para Hito 10) ---

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
  index('sessions_user_idx').on(table.userId)
]);

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  uniqueIndex('accounts_provider_account_unique').on(table.provider, table.providerAccountId)
]);

export const verificationTokens = pgTable('verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  identifier: text('identifier').notNull(),
  tokenHash: text('token_hash').notNull(),
  purpose: text('purpose').notNull().default('email'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex('verification_token_hash_unique').on(table.tokenHash)]);

// --- Prode (base para Hito 11) ---

export const predictionContests = pgTable('prediction_contests', {
  id: uuid('id').primaryKey().defaultRandom(),
  seasonId: uuid('season_id').references(() => seasons.id),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  round: text('round'),
  status: contestStatus('status').notNull().default('draft'),
  rules: jsonb('rules').notNull().default({}),
  opensAt: timestamp('opens_at', { withTimezone: true }),
  closesAt: timestamp('closes_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex('prediction_contests_slug_unique').on(table.slug)]);

export const contestMatches = pgTable('contest_matches', {
  contestId: uuid('contest_id').notNull().references(() => predictionContests.id, { onDelete: 'cascade' }),
  matchId: uuid('match_id').notNull().references(() => matches.id),
  ordinal: integer('ordinal').notNull().default(0)
}, (table) => [primaryKey({ columns: [table.contestId, table.matchId] })]);

export const predictionGroups = pgTable('prediction_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  inviteCode: text('invite_code').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex('prediction_groups_invite_unique').on(table.inviteCode)]);

export const predictionGroupMembers = pgTable('prediction_group_members', {
  groupId: uuid('group_id').notNull().references(() => predictionGroups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [primaryKey({ columns: [table.groupId, table.userId] })]);

export const contestRankings = pgTable('contest_rankings', {
  contestId: uuid('contest_id').notNull().references(() => predictionContests.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  points: integer('points').notNull().default(0),
  position: integer('position'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [primaryKey({ columns: [table.contestId, table.userId] })]);

// --- Cola de jobs (PostgreSQL como cola inicial económica) ---

export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  status: jobStatus('status').notNull().default('pending'),
  runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(5),
  dedupeKey: text('dedupe_key'),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: text('locked_by'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index('jobs_status_run_idx').on(table.status, table.runAt),
  uniqueIndex('jobs_dedupe_unique').on(table.dedupeKey)
]);

// --- Analytics y feedback (privacidad primero: sin PII) ---

export const analyticsEvents = pgTable('analytics_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  path: text('path'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  index('analytics_events_name_idx').on(table.name),
  index('analytics_events_created_idx').on(table.createdAt)
]);

export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  message: text('message').notNull(),
  path: text('path'),
  contact: text('contact'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
