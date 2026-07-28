ALTER TABLE "competitions" ADD COLUMN "family_slug" text;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "tier" text DEFAULT 'senior' NOT NULL;