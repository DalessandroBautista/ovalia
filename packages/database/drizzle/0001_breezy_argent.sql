ALTER TABLE "teams" ADD COLUMN "badge_source_url" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "badge_format" text;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "badge_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "badge_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "external_ids" jsonb DEFAULT '{}'::jsonb NOT NULL;