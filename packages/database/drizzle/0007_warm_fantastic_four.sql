CREATE TABLE "competition_organizations" (
	"competition_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	CONSTRAINT "competition_organizations_competition_id_organization_id_pk" PRIMARY KEY("competition_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "competition_organizations" ADD CONSTRAINT "competition_organizations_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_organizations" ADD CONSTRAINT "competition_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competition_organizations_organization_idx" ON "competition_organizations" USING btree ("organization_id");