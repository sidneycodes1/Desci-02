-- Phase 3: reader publishing (plan §06). Articles are independent of
-- projects but may link to one. Readers publish without membership anywhere.
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"author_id" uuid NOT NULL,
	"project_id" uuid,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_status_check" CHECK ("status" IN ('draft','published','archived'));--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_visibility_check" CHECK ("visibility" IN ('public','private'));--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_title_nonempty" CHECK (char_length("title") BETWEEN 1 AND 300);--> statement-breakpoint
CREATE INDEX "articles_author_id_idx" ON "articles" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "articles_project_id_idx" ON "articles" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "articles_status_idx" ON "articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");--> statement-breakpoint
CREATE TABLE "article_collaborators" (
	"id" uuid PRIMARY KEY NOT NULL,
	"article_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "article_collaborators" ADD CONSTRAINT "article_collaborators_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_collaborators" ADD CONSTRAINT "article_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_collaborators" ADD CONSTRAINT "article_collaborators_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_collaborators_unique" ON "article_collaborators" USING btree ("article_id","user_id");--> statement-breakpoint
CREATE INDEX "article_collaborators_article_idx" ON "article_collaborators" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "article_collaborators_user_idx" ON "article_collaborators" USING btree ("user_id");--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "articles" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "article_collaborators" TO authenticated;--> statement-breakpoint
ALTER TABLE "articles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "articles_read_published" ON "articles" FOR SELECT TO authenticated
USING ("articles"."status" = 'published' AND "articles"."deleted_at" IS NULL);--> statement-breakpoint
CREATE POLICY "articles_read_own" ON "articles" FOR SELECT TO authenticated
USING ("articles"."author_id" = auth.uid());--> statement-breakpoint
CREATE POLICY "articles_insert_authed" ON "articles" FOR INSERT TO authenticated
WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "articles_update_author_or_collab" ON "articles" FOR UPDATE TO authenticated
USING (
  "articles"."author_id" = auth.uid()
  OR EXISTS (
    SELECT 1 FROM "article_collaborators" "ac"
    WHERE "ac"."article_id" = "articles"."id" AND "ac"."user_id" = auth.uid()
  )
);--> statement-breakpoint
ALTER TABLE "article_collaborators" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "article_collabs_select_member" ON "article_collaborators" FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM "articles" "a" WHERE "a"."id" = "article_collaborators"."article_id" AND "a"."author_id" = auth.uid())
  OR "article_collaborators"."user_id" = auth.uid()
);--> statement-breakpoint
CREATE POLICY "article_collabs_insert_author" ON "article_collaborators" FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM "articles" "a" WHERE "a"."id" = "article_collaborators"."article_id" AND "a"."author_id" = auth.uid())
);--> statement-breakpoint
CREATE POLICY "article_collabs_delete_author" ON "article_collaborators" FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM "articles" "a" WHERE "a"."id" = "article_collaborators"."article_id" AND "a"."author_id" = auth.uid())
);
