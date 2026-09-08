-- Custom SQL migration file, put your code below! --
-- Phase 2: DB-level constraints + Row Level Security (auth.uid() scoping).
-- Applies to Supabase (auth.uid() provided). For local PGlite tests the
-- harness creates an `auth.uid()` shim + `authenticated` role BEFORE
-- applying migrations. Service_role / table owner bypasses RLS by design.
--
-- Recursion note: policies on `projects` <-> `project_collaborators`
-- reference each other, so membership checks live in SECURITY DEFINER
-- helpers (bypass RLS, standard Supabase pattern). Policies call helpers;
-- helpers never trigger policies -> no infinite recursion.

-- ---------------------------------------------------------------- DB checks
ALTER TABLE "reputation_events"
  ADD CONSTRAINT "reputation_events_points_nonzero" CHECK ("points" <> 0);
--> statement-breakpoint
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_positive" CHECK ("amount_wei" > 0);
--> statement-breakpoint

-- ---------------------------------------------------------------- grants
-- Authenticated app users get only the operations RLS policies allow.
-- Writes to treasury_balances / reputation_scores / ai_agent_runs are
-- service_role-only (reconciliation + AI workers), so no write grants.
GRANT SELECT, INSERT, UPDATE ON "users" TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "wallets" TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "projects" TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "project_collaborators" TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "milestones" TO authenticated;
--> statement-breakpoint
GRANT SELECT ON "treasury_balances" TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "expenses" TO authenticated;
--> statement-breakpoint
GRANT SELECT, INSERT ON "reputation_events" TO authenticated;
--> statement-breakpoint
GRANT SELECT ON "reputation_scores" TO authenticated;
--> statement-breakpoint
GRANT SELECT ON "ai_agent_runs" TO authenticated;
--> statement-breakpoint

-- ---------------------------------------------------------------- helpers
-- plpgsql (NOT sql): plain-SQL helpers get inlined into policy
-- expressions, which defeats SECURITY DEFINER and causes infinite
-- recursion between projects <-> project_collaborators policies.
CREATE OR REPLACE FUNCTION is_project_owner(pid uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "projects" "p"
    WHERE "p"."id" = pid AND "p"."owner_user_id" = auth.uid() AND "p"."deleted_at" IS NULL
  );
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION is_project_member(pid uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "projects" "p"
    LEFT JOIN "project_collaborators" "pc"
      ON "pc"."project_id" = "p"."id" AND "pc"."user_id" = auth.uid()
    WHERE "p"."id" = pid AND "p"."deleted_at" IS NULL
      AND ("p"."owner_user_id" = auth.uid() OR "pc"."user_id" IS NOT NULL)
  );
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION is_project_visible(pid uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "projects" "p"
    LEFT JOIN "project_collaborators" "pc"
      ON "pc"."project_id" = "p"."id" AND "pc"."user_id" = auth.uid()
    WHERE "p"."id" = pid AND "p"."deleted_at" IS NULL
      AND ("p"."owner_user_id" = auth.uid() OR "p"."status" <> 'draft' OR "pc"."user_id" IS NOT NULL)
  );
END;
$$;
--> statement-breakpoint

-- ---------------------------------------------------------------- users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "users_select_own_or_shared" ON "users" FOR SELECT TO authenticated
USING (
  "users"."id" = auth.uid()
  OR EXISTS (
    SELECT 1 FROM "project_collaborators" "pc_me"
    JOIN "project_collaborators" "pc_them" ON "pc_me"."project_id" = "pc_them"."project_id"
    WHERE "pc_me"."user_id" = auth.uid() AND "pc_them"."user_id" = "users"."id"
      AND is_project_member("pc_me"."project_id")
  )
  OR EXISTS (
    SELECT 1 FROM "projects" "p"
    WHERE "p"."deleted_at" IS NULL AND (
      ("p"."owner_user_id" = auth.uid()
        AND EXISTS (SELECT 1 FROM "project_collaborators" "pc" WHERE "pc"."project_id" = "p"."id" AND "pc"."user_id" = "users"."id"))
      OR
      ("p"."owner_user_id" = "users"."id"
        AND EXISTS (SELECT 1 FROM "project_collaborators" "pc" WHERE "pc"."project_id" = "p"."id" AND "pc"."user_id" = auth.uid()))
    )
  )
);
--> statement-breakpoint
CREATE POLICY "users_insert_own" ON "users" FOR INSERT TO authenticated
WITH CHECK ("users"."id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "users_update_own" ON "users" FOR UPDATE TO authenticated
USING ("users"."id" = auth.uid())
WITH CHECK ("users"."id" = auth.uid());
--> statement-breakpoint
-- Role escalation guard as a trigger (not a WITH CHECK subquery: a policy
-- subquery scanning `users` recurses into this same policy set, 42P17).
-- Service_role/postgres (admin path, Phase 4) bypass the check.
-- SECURITY INVOKER on purpose: the check must see the effective caller.
-- (SET ROLE changes current_user but not session_user, and DEFINER would
-- mask current_user as the owner — both wrong here. INVOKER + current_user
-- is the only combination that sees 'authenticated'.)
CREATE OR REPLACE FUNCTION prevent_user_role_escalation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."role" IS DISTINCT FROM OLD."role"
    AND current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'user role changes require the admin path' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS users_no_role_escalation ON "users";
--> statement-breakpoint
CREATE TRIGGER users_no_role_escalation BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION prevent_user_role_escalation();
--> statement-breakpoint

-- ---------------------------------------------------------------- wallets
ALTER TABLE "wallets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "wallets_owner_all" ON "wallets" FOR ALL TO authenticated
USING ("wallets"."user_id" = auth.uid())
WITH CHECK ("wallets"."user_id" = auth.uid());
--> statement-breakpoint

-- ---------------------------------------------------------------- projects
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Members always see their projects; any authenticated user sees
-- non-draft, non-deleted projects. Drafts stay private.
CREATE POLICY "projects_select_visible" ON "projects" FOR SELECT TO authenticated
USING (
  "projects"."deleted_at" IS NULL AND (
    "projects"."owner_user_id" = auth.uid()
    OR "projects"."status" <> 'draft'
    OR EXISTS (
      SELECT 1 FROM "project_collaborators" "pc"
      WHERE "pc"."project_id" = "projects"."id" AND "pc"."user_id" = auth.uid()
    )
  )
);
--> statement-breakpoint
CREATE POLICY "projects_insert_own" ON "projects" FOR INSERT TO authenticated
WITH CHECK ("projects"."owner_user_id" = auth.uid());
--> statement-breakpoint
CREATE POLICY "projects_update_owner" ON "projects" FOR UPDATE TO authenticated
USING ("projects"."owner_user_id" = auth.uid())
WITH CHECK ("projects"."owner_user_id" = auth.uid());
--> statement-breakpoint

-- ---------------------------------------------------------------- collaborators
ALTER TABLE "project_collaborators" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "collaborators_select_member" ON "project_collaborators" FOR SELECT TO authenticated
USING (is_project_member("project_collaborators"."project_id"));
--> statement-breakpoint
CREATE POLICY "collaborators_insert_owner" ON "project_collaborators" FOR INSERT TO authenticated
WITH CHECK (is_project_owner("project_collaborators"."project_id"));
--> statement-breakpoint
CREATE POLICY "collaborators_delete_owner" ON "project_collaborators" FOR DELETE TO authenticated
USING (is_project_owner("project_collaborators"."project_id"));
--> statement-breakpoint

-- ---------------------------------------------------------------- milestones
ALTER TABLE "milestones" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "milestones_select_visible" ON "milestones" FOR SELECT TO authenticated
USING (is_project_visible("milestones"."project_id"));
--> statement-breakpoint
CREATE POLICY "milestones_write_owner" ON "milestones" FOR ALL TO authenticated
USING (is_project_owner("milestones"."project_id"))
WITH CHECK (is_project_owner("milestones"."project_id"));
--> statement-breakpoint

-- ---------------------------------------------------------------- treasury balances (read-only for app users)
ALTER TABLE "treasury_balances" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "treasury_balances_select_visible" ON "treasury_balances" FOR SELECT TO authenticated
USING (is_project_visible("treasury_balances"."project_id"));
--> statement-breakpoint

-- ---------------------------------------------------------------- expenses
ALTER TABLE "expenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "expenses_select_visible" ON "expenses" FOR SELECT TO authenticated
USING (is_project_visible("expenses"."project_id"));
--> statement-breakpoint
CREATE POLICY "expenses_insert_owner_proposer" ON "expenses" FOR INSERT TO authenticated
WITH CHECK (
  "expenses"."proposer_user_id" = auth.uid()
  AND is_project_owner("expenses"."project_id")
);
--> statement-breakpoint
CREATE POLICY "expenses_update_owner" ON "expenses" FOR UPDATE TO authenticated
USING (is_project_owner("expenses"."project_id"))
WITH CHECK (is_project_owner("expenses"."project_id"));
--> statement-breakpoint

-- ---------------------------------------------------------------- reputation
ALTER TABLE "reputation_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "reputation_events_select_member" ON "reputation_events" FOR SELECT TO authenticated
USING (is_project_member("reputation_events"."project_id"));
--> statement-breakpoint
-- Project owner acts as oracle delegate until Phase 4 role model lands.
CREATE POLICY "reputation_events_insert_owner_oracle" ON "reputation_events" FOR INSERT TO authenticated
WITH CHECK (
  "reputation_events"."actor_user_id" = auth.uid()
  AND is_project_owner("reputation_events"."project_id")
);
--> statement-breakpoint

ALTER TABLE "reputation_scores" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "reputation_scores_select_own_or_shared" ON "reputation_scores" FOR SELECT TO authenticated
USING (
  "reputation_scores"."subject_user_id" = auth.uid()
  OR EXISTS (
    SELECT 1 FROM "projects" "p"
    WHERE "p"."deleted_at" IS NULL
      AND is_project_member("p"."id")
      AND (
        "p"."owner_user_id" = "reputation_scores"."subject_user_id"
        OR EXISTS (
          SELECT 1 FROM "project_collaborators" "pc2"
          WHERE "pc2"."project_id" = "p"."id"
            AND "pc2"."user_id" = "reputation_scores"."subject_user_id"
        )
      )
  )
);
--> statement-breakpoint

-- ---------------------------------------------------------------- agent runs (admin-written, members read)
ALTER TABLE "ai_agent_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "ai_agent_runs_select_member" ON "ai_agent_runs" FOR SELECT TO authenticated
USING (
  "ai_agent_runs"."project_id" IS NOT NULL
  AND is_project_member("ai_agent_runs"."project_id")
);
--> statement-breakpoint
