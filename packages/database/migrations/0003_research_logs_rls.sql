-- Custom SQL migration for Phase 6: Research Logs RLS.
-- Table DDL lives in 0002 (drizzle-kit generated); this file holds the
-- authenticated-role grants + RLS policies, mirroring the 0000/0001 split.
-- (Content recovered verbatim from the previously unregistered 0002_research_logs.sql.)
GRANT SELECT, INSERT, UPDATE, DELETE ON "research_logs" TO authenticated;
--> statement-breakpoint

ALTER TABLE "research_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "research_logs_select_visible" ON "research_logs" FOR SELECT TO authenticated
USING (
  "research_logs"."deleted_at" IS NULL AND is_project_visible("research_logs"."project_id")
);
--> statement-breakpoint

CREATE POLICY "research_logs_insert_member" ON "research_logs" FOR INSERT TO authenticated
WITH CHECK (
  "research_logs"."author_user_id" = auth.uid()
  AND is_project_member("research_logs"."project_id")
);
--> statement-breakpoint

CREATE POLICY "research_logs_update_author" ON "research_logs" FOR UPDATE TO authenticated
USING (
  "research_logs"."deleted_at" IS NULL
  AND ("research_logs"."author_user_id" = auth.uid() OR is_project_owner("research_logs"."project_id"))
)
WITH CHECK (
  "research_logs"."author_user_id" = auth.uid() OR is_project_owner("research_logs"."project_id")
);
--> statement-breakpoint

CREATE POLICY "research_logs_delete_author_or_owner" ON "research_logs" FOR DELETE TO authenticated
USING (
  "research_logs"."author_user_id" = auth.uid() OR is_project_owner("research_logs"."project_id")
);
