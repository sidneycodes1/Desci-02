# sciagent-web

Next.js 15 frontend + API for SciAgent Protocol: project dashboard, project
workspace (research logs, treasury/expenses, milestones, reports/export), and
all `/api/*` route handlers.

## Role in the system

- **Pages:** `app/page.tsx` (projects overview), `app/projects/[id]/page.tsx`
  (workspace with 5 tabs). Projects, logs, milestones, treasury balance, and
  expenses come live from the API via TanStack Query. Exception: the AI
  health-score badges are still hardcoded placeholders — see
  `../../KNOWN_LIMITATIONS.md` §4.
- **API:** `app/api/projects/**`, `app/api/notifications`, `app/api/user/*`.
  Every route verifies the Privy Bearer JWT (`@sciagent/auth/session`) and
  queries Postgres through the **user-scoped** Supabase client
  (`createSupabaseClientFromToken`) so RLS applies. Never the admin client.
- **Guards:** Zod schemas in `lib/validation/`, project status machine in
  `lib/state-machine/project.ts`, route middleware in `middleware.ts`,
  error boundary in `app/global-error.tsx`.
- **Dev auth:** pages currently send a placeholder token centralized in
  `lib/dev-auth.ts` — see `../../KNOWN_LIMITATIONS.md` §3. Replace with the real
  Privy `getAccessToken()` flow before production.

## Commands

```bash
pnpm --filter sciagent-web dev        # next dev
pnpm --filter sciagent-web build
pnpm --filter sciagent-web test       # vitest (validation, state machine, API integration)
pnpm --filter sciagent-web typecheck
pnpm --filter sciagent-web lint
```

See [DASHBOARD.md](../../docs/DASHBOARD.md) for UI + API-integration details.
