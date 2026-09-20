# SciAgent Database (Phase 2)

Drizzle ORM + Supabase Postgres. Runtime user queries go through a
user-scoped Supabase client (`createSupabaseClientFromToken(token)` in API
routes, `createSupabaseServerClient(cookieAdapter)` where cookie auth is
used) so `auth.uid()` RLS policies apply; Drizzle owns
schema/migrations/seed/worker scripts. The service-role admin client is
for system jobs only (seed, reconciliation, AI workers).

## Conventions

- `snake_case`, plural table names, `id uuid` PKs (app-generated via
  `crypto.randomUUID`, no `pgcrypto` dependency).
- `created_at` / `updated_at` timestamptz on mutable rows; nullable
  `deleted_at` = soft-delete.
- `onchain_*_id bigint unique nullable` links off-chain rows to chain
  entities; NULL until minted.
- Wei amounts are `numeric(78,0)` (uint256 range), handled as strings.

## Tables

| Table                   | Purpose                                                                                                                                       | Delete strategy     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `users`                 | Profile 1:1 with `auth.users.id`; `role` researcher/reviewer/admin                                                                            | never (identity)    |
| `wallets`               | Extra wallets per user (`address` unique)                                                                                                     | hard (cascade)      |
| `projects`              | Research projects; `status` draft/active/completed/archived; `metadata_uri` mirrors registry                                                  | soft (`deleted_at`) |
| `project_collaborators` | (project, user) membership, PK composite                                                                                                      | hard (membership)   |
| `research_logs`         | Progress entries per project with optional IPFS evidence (`evidence_cid/mime/size`); Phase 6                                                  | soft (`deleted_at`) |
| `milestones`            | Mirrors `MilestoneRegistry` states created/submitted/approved                                                                                 | soft                |
| `treasury_balances`     | Cached on-chain balance per project (chain is truth; Phase 7 reconciles)                                                                      | never               |
| `expenses`              | Spend requests; `memo varchar(1024)` = `MAX_MEMO_LENGTH`; recipient must equal project owner (contract rule, enforced app-side — cross-table) | never (audit trail) |
| `reputation_events`     | Points events (`points <> 0`); `subject_address` kept even without user row                                                                   | never (audit trail) |
| `reputation_scores`     | Materialized score cache per subject                                                                                                          | never               |
| `ai_agent_runs`         | Agent audit log; `needs_review` = human-in-the-loop gate                                                                                      | never (audit log)   |

Indexes on all FKs + `(owner,status)`, `(project,status/state)`,
`(agent,status)`. DB checks: `points <> 0`, `amount_wei > 0`, memo length
(varchar), enum types, uniques, FKs.

## RLS (all 11 tables, `auth.uid()`)

- Members (owner or collaborator) read their project scope; drafts are
  private, active/completed/archived readable by any authenticated user.
- Writes are owner-only (projects/milestones/expenses/collaborator mgmt);
  `users` rows are self-only and `role` can never self-escalate
  (trigger `users_no_role_escalation`, 42501).
- `treasury_balances` / `reputation_scores` / `ai_agent_runs`: no
  authenticated writes at all (service_role jobs only).
- `reputation_events` inserts: project owner as oracle delegate (see Phase 4
  role model in `../../docs/AUTH.md`).
- Mutual project/collaborator policy references use `SECURITY DEFINER`
  `plpgsql` helpers (`is_project_owner/member/visible`) — plain-SQL
  helpers inline and recurse (42P17); the role trigger is invoker on
  purpose (`SET ROLE` keeps `session_user`, changes `current_user`).

## Migrations

- `migrations/0000_*` — Drizzle-generated tables/enums/indexes.
- `migrations/0001_rls_policies.sql` — hand-written checks, grants,
  helpers, policies (`drizzle-kit generate --custom` journal entry).
- `migrations/0002_blue_mulholland_black.sql` — Drizzle-generated
  `research_logs` table DDL.
- `migrations/0003_research_logs_rls.sql` — hand-written grants + RLS
  policies for `research_logs`.
- `migrations/0004_elite_orphan.sql` — Drizzle-generated `users.bio` /
  `users.orcid_id` columns (profile enrichment).
- Apply on Supabase via `drizzle-kit migrate` with `DATABASE_URL`, or SQL
  in the Supabase SQL editor (create `authenticated` role first on fresh
  projects — it exists by default on Supabase).

## Local dev/test (no docker needed)

- `pnpm --filter @sciagent/database db:seed` — migrates + seeds PGlite
  file DB at `packages/database/.local-pglite` (gitignored).
- `pnpm --filter @sciagent/database test` — 36 tests on throwaway PGlite:
  19 schema (tables, RLS-enabled, constraints, seed relations) + 17 RLS
  behavioral (outsider/collaborator/owner matrix, oracle/admin-only
  writes). Test shim provides `auth.uid()` + roles before migrations.

## Gaps / Phase 4+ hooks

- `users.role` changes need the admin path (trigger blocks all
  self-service escalation, including legitimate admin UI — Phase 4).
- Reputation inserts should move to a dedicated oracle role (currently
  project-owner delegate).
- `expenses.recipient == project.owner` is app-enforced (Phase 7 must
  re-validate against chain before submitting).
