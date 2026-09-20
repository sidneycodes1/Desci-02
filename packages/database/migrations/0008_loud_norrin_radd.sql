CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_target_idx" ON "comments" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "comments_created_at_idx" ON "comments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "likes_user_target_unique" ON "likes" USING btree ("user_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "likes_target_idx" ON "likes" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "likes_user_idx" ON "likes" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_target_type_check" CHECK ("target_type" IN ('project','article'));--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_target_type_check" CHECK ("target_type" IN ('project','article'));--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "likes" TO authenticated;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "comments" TO authenticated;--> statement-breakpoint
CREATE OR REPLACE FUNCTION is_engagement_target_visible(t_type text, t_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  IF t_type = 'project' THEN
    RETURN is_project_visible(t_id);
  ELSIF t_type = 'article' THEN
    RETURN EXISTS (
      SELECT 1 FROM "articles" a
      WHERE a."id" = t_id AND a."deleted_at" IS NULL
        AND (a."status" = 'published' OR a."author_id" = auth.uid()
             OR EXISTS (SELECT 1 FROM "article_collaborators" ac WHERE ac."article_id"=a."id" AND ac."user_id"=auth.uid()))
    );
  END IF;
  RETURN false;
END; $$;--> statement-breakpoint
ALTER TABLE "likes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "likes_select_visible" ON "likes" FOR SELECT TO authenticated
  USING (is_engagement_target_visible(target_type, target_id));--> statement-breakpoint
CREATE POLICY "likes_insert_own" ON "likes" FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "likes_delete_own" ON "likes" FOR DELETE TO authenticated
  USING (user_id = auth.uid());--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "comments_select_visible" ON "comments" FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND is_engagement_target_visible(target_type, target_id));--> statement-breakpoint
CREATE POLICY "comments_insert_own" ON "comments" FOR INSERT TO authenticated
  WITH CHECK (author_user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "comments_update_own" ON "comments" FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid()) WITH CHECK (author_user_id = auth.uid());