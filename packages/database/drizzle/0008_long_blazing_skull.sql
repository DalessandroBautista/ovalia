CREATE TABLE "lineup_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"shirt_number" integer NOT NULL,
	"is_starter" boolean NOT NULL,
	"is_captain" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"full_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lineup_entries" ADD CONSTRAINT "lineup_entries_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup_entries" ADD CONSTRAINT "lineup_entries_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup_entries" ADD CONSTRAINT "lineup_entries_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lineup_match_team_shirt_unique" ON "lineup_entries" USING btree ("match_id","team_id","shirt_number");--> statement-breakpoint
CREATE INDEX "lineup_match_team_idx" ON "lineup_entries" USING btree ("match_id","team_id");--> statement-breakpoint
CREATE INDEX "lineup_player_idx" ON "lineup_entries" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_slug_unique" ON "players" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "players_normalized_idx" ON "players" USING btree ("normalized_name");