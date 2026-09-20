-- Phase 2+4: first-class funders + collaboration invites (plan §06).
-- Funding never grants edit; invites resolve into project_collaborators.
CREATE TABLE "project_funders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"total_funded_wei" numeric(78, 0) DEFAULT '0' NOT NULL,
	"first_funded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_funded_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "project_funders" ADD CONSTRAINT "project_funders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_funders" ADD CONSTRAINT "project_funders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_funders" ADD CONSTRAINT "project_funders_total_positive" CHECK ("total_funded_wei" > 0);--> statement-breakpoint
CREATE UNIQUE INDEX "project_funders_project_user_unique" ON "project_funders" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_funders_project_id_idx" ON "project_funders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_funders_user_id_idx" ON "project_funders" USING btree ("user_id");--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_type" text DEFAULT 'project' NOT NULL,
	"entity_id" uuid NOT NULL,
	"inviter_id" uuid NOT NULL,
	"invitee_id" uuid,
	"invitee_handle" text,
	"role" text DEFAULT 'collaborator' NOT NULL,
	"token" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_entity_type_check" CHECK ("entity_type" IN ('project','article'));--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_role_check" CHECK ("role" IN ('owner','collaborator','reader'));--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_status_check" CHECK ("status" IN ('pending','accepted','declined','expired'));--> statement-breakpoint
CREATE UNIQUE INDEX "invites_token_unique" ON "invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invites_entity_idx" ON "invites" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "invites_invitee_idx" ON "invites" USING btree ("invitee_id");--> statement-breakpoint
CREATE INDEX "invites_token_idx" ON "invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invites_status_idx" ON "invites" USING btree ("status");--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "project_funders" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "invites" TO authenticated;--> statement-breakpoint
ALTER TABLE "project_funders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "funders_read_visible" ON "project_funders" FOR SELECT TO authenticated
USING (is_project_visible("project_funders"."project_id"));--> statement-breakpoint
CREATE POLICY "funders_insert_any_authed" ON "project_funders" FOR INSERT TO authenticated
WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "funders_update_own" ON "project_funders" FOR UPDATE TO authenticated
USING ("project_funders"."user_id" = auth.uid());--> statement-breakpoint
ALTER TABLE "invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "invites_select_participant" ON "invites" FOR SELECT TO authenticated
USING ("invites"."inviter_id" = auth.uid() OR "invites"."invitee_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "invites_insert_owner" ON "invites" FOR INSERT TO authenticated
WITH CHECK (
  "invites"."entity_type" <> 'project'
  OR is_project_owner("invites"."entity_id")
);--> statement-breakpoint
CREATE POLICY "invites_update_participant" ON "invites" FOR UPDATE TO authenticated
USING ("invites"."inviter_id" = auth.uid() OR "invites"."invitee_id" = auth.uid());
