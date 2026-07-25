CREATE TYPE "public"."conflict_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."contest_status" AS ENUM('draft', 'open', 'closed', 'scored');--> statement-breakpoint
CREATE TYPE "public"."ingestion_artifact_status" AS ENUM('pending', 'fetched', 'parsed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competition_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'regular' NOT NULL,
	"ordinal" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest_matches" (
	"contest_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"ordinal" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "contest_matches_contest_id_match_id_pk" PRIMARY KEY("contest_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "contest_rankings" (
	"contest_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"position" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_rankings_contest_id_user_id_pk" PRIMARY KEY("contest_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "editorial_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"patch" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason" text NOT NULL,
	"author_id" uuid NOT NULL,
	"verification_source" text,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_until" timestamp with time zone,
	"closed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"external_id" text NOT NULL,
	"ovalia_id" uuid,
	"confidence" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"base_url" text,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"terms_url" text,
	"attribution" text,
	"automation_allowed" boolean DEFAULT false NOT NULL,
	"robots_checked_at" timestamp with time zone,
	"active" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"source_id" uuid,
	"capability" text,
	"url" text,
	"status" "ingestion_artifact_status" DEFAULT 'pending' NOT NULL,
	"content_type" text,
	"checksum" text NOT NULL,
	"parser_version" text,
	"raw_path" text,
	"payload" jsonb,
	"error" text,
	"fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"entity_type" text NOT NULL,
	"status" "conflict_status" DEFAULT 'open' NOT NULL,
	"candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"resolution" jsonb,
	"reason" text,
	"created_by" uuid,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"dedupe_key" text,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'union' NOT NULL,
	"country_code" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_contests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"round" text,
	"status" "contest_status" DEFAULT 'draft' NOT NULL,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_group_members" (
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prediction_group_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "prediction_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"invite_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" uuid,
	"season_id" uuid NOT NULL,
	"name" text NOT NULL,
	"number" integer,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "standings_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"source" text NOT NULL,
	"rows" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checksum" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" text DEFAULT 'email' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "prediction_user_match_unique";--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "coverage" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "phase_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "round_id" uuid;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "contest_id" uuid;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "standings" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "standings" ADD COLUMN "fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_phases" ADD CONSTRAINT "competition_phases_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_matches" ADD CONSTRAINT "contest_matches_contest_id_prediction_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."prediction_contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_matches" ADD CONSTRAINT "contest_matches_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_rankings" ADD CONSTRAINT "contest_rankings_contest_id_prediction_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."prediction_contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_rankings" ADD CONSTRAINT "contest_rankings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editorial_overrides" ADD CONSTRAINT "editorial_overrides_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_entities" ADD CONSTRAINT "external_entities_source_id_external_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."external_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_artifacts" ADD CONSTRAINT "ingestion_artifacts_run_id_ingestion_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ingestion_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_artifacts" ADD CONSTRAINT "ingestion_artifacts_source_id_external_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."external_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_conflicts" ADD CONSTRAINT "ingestion_conflicts_source_id_external_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."external_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_conflicts" ADD CONSTRAINT "ingestion_conflicts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_conflicts" ADD CONSTRAINT "ingestion_conflicts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_contests" ADD CONSTRAINT "prediction_contests_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_group_members" ADD CONSTRAINT "prediction_group_members_group_id_prediction_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."prediction_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_group_members" ADD CONSTRAINT "prediction_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_groups" ADD CONSTRAINT "prediction_groups_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_phase_id_competition_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."competition_phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_snapshots" ADD CONSTRAINT "standings_snapshots_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_unique" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "phase_season_name_unique" ON "competition_phases" USING btree ("season_id","name");--> statement-breakpoint
CREATE INDEX "editorial_override_target_idx" ON "editorial_overrides" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_entity_source_type_id_unique" ON "external_entities" USING btree ("source_id","entity_type","external_id");--> statement-breakpoint
CREATE INDEX "external_entity_ovalia_idx" ON "external_entities" USING btree ("entity_type","ovalia_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_sources_slug_unique" ON "external_sources" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_artifact_source_checksum_unique" ON "ingestion_artifacts" USING btree ("source_id","checksum");--> statement-breakpoint
CREATE INDEX "ingestion_artifact_checksum_idx" ON "ingestion_artifacts" USING btree ("checksum");--> statement-breakpoint
CREATE INDEX "ingestion_conflict_status_idx" ON "ingestion_conflicts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_status_run_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_dedupe_unique" ON "jobs" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_unique" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "prediction_contests_slug_unique" ON "prediction_contests" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "prediction_groups_invite_unique" ON "prediction_groups" USING btree ("invite_code");--> statement-breakpoint
CREATE UNIQUE INDEX "round_season_name_unique" ON "rounds" USING btree ("season_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "standings_snapshot_season_idx" ON "standings_snapshots" USING btree ("season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_token_hash_unique" ON "verification_tokens" USING btree ("token_hash");--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_phase_id_competition_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."competition_phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_contest_id_prediction_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."prediction_contests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_status_published_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "matches_status_idx" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "prediction_user_contest_match_unique" ON "predictions" USING btree ("user_id","contest_id","match_id");