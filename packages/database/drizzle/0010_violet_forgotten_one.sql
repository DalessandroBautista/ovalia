CREATE TABLE "career_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"score" integer NOT NULL,
	"display_name" text NOT NULL,
	"user_id" uuid,
	"summary" jsonb NOT NULL,
	"history" jsonb NOT NULL,
	"surname" text NOT NULL,
	"position" text NOT NULL,
	"club_slug" text NOT NULL,
	"seed" integer NOT NULL,
	"decisions" jsonb NOT NULL,
	"origin_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "career_entries" ADD CONSTRAINT "career_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "career_entries_score_idx" ON "career_entries" USING btree ("score");--> statement-breakpoint
CREATE INDEX "career_entries_origin_idx" ON "career_entries" USING btree ("origin_key","created_at");