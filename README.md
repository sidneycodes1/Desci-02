# DesciAgent Protocol
 
Milestone-gated research funding with on-chain settlement and AI-assisted monitoring.
 
**Status:** MVP in active development. Web build is currently **broken** (EPIPE / Windows worker failure — see below). Contracts, typecheck, and lint all pass. Do not deploy until the build is fixed.
 
---
 
## What is SciAgent Protocol?
 
Researchers usually get grant money in one lump sum, upfront, with little visibility into whether the work actually happens. SciAgent Protocol changes that: researchers apply for funding, and instead of getting paid all at once, they get paid **milestone by milestone** as they deliver verifiable work.
 
- **Privy** handles login — a simple identity service, so nobody has to trust the app itself with passwords.
- **RLS (Row-Level Security)** is a set of database rules that make sure each user can only see their own data.
- The **blockchain** is the final source of truth for money — once a milestone is approved, the payout is recorded on-chain, not just in a database that could be edited.
- **AI agents** run in the background watching project spending and flagging risk, so funders don't have to manually audit every expense.
In short: apply → get funded in stages → prove the work → get paid → build a reputation, all provably auditable.
 
## The Problem
 
Traditional research grants are slow to disburse, pay out regardless of delivery, and give funders little real-time visibility into whether money is being used as promised. SciAgent Protocol ties funding to verified milestones and puts the settlement layer on-chain, so "the money was spent on X" isn't just a claim in a spreadsheet.
 
## How It Works
 
1. Researcher applies via the web app.
2. Project gets funded in milestones, not a lump sum.
3. Researcher logs milestones and evidence as work happens.
4. AI agents track spending and flag risk in the background. *(Note: the queue behind this is currently in-memory — see Known Limitations.)*
5. Funds release when a milestone is approved; smart contracts enforce who can do this.
6. Researcher builds an on-chain reputation score over time.
## Architecture
 
```
┌─────────────┐      Privy JWT       ┌──────────────────┐
│  apps/web   │ ───────────────────▶ │  API routes      │
│  Next.js 15 │                      │  + @sciagent/auth│
└──────┬──────┘                      │  (RBAC, session) │
       │ TanStack Query              └────────┬─────────┘
       │                                      │ user-scoped client
       │                             ┌────────▼─────────┐     ┌────────────────┐
       │                             │ Supabase/Postgres│◀───▶│ contracts (Base)│
       │                             │ Drizzle + RLS    │sync │ GrantTreasury, │
       │                             └────────┬─────────┘     │ MilestoneReg…  │
       │                                      │               └────────────────┘
       │                             ┌────────▼─────────┐
       └────────────────────────────▶│ @sciagent/{agents,shared,ui} │
                                     │ AI health scores, services, │
                                     │ validation, design system   │
                                     └─────────────────────────────┘
```
 
**Trust model:** Privy JWT confirms who you are → Supabase RLS (`auth.uid()`, user-scoped client) confirms what data you can see → the blockchain is the final source of truth for balances. Postgres caches on-chain state and reconciles it (see `docs/RECONCILIATION.md`).
 
## Tech Stack
 
| Layer | Technology |
|---|---|
| Frontend | Next.js 15.2.6, React 18, Tailwind, TanStack Query, Privy, wagmi/viem |
| API / Auth | Next.js route handlers, `@sciagent/auth` (Privy JWT, RBAC), Zod |
| Data | Supabase Postgres, Drizzle ORM, PGlite (local dev/test) |
| Contracts | Solidity 0.8.26, Foundry, OpenZeppelin 5.x (Base Sepolia) |
| Agents / AI | `@sciagent/agents` (tracker/spending/milestone + orchestrator), OpenAI/Gemini via `@sciagent/shared/ai` |
| Tooling | pnpm workspaces, Turbo, Vitest, ESLint + Prettier, Husky + lint-staged, Sentry |
 
## Full Route Map
 
>  **Not yet reliably audited.** A prior pass claimed this was complete (38 pages / 27 API routes classified), but the actual per-route table was never produced or shown — only a summary ("APIs use `session.supabase`, rest is query-based, no contradictions"). Treat that summary as **unverified** until someone opens the ~65 files and fills in this table for real. Placeholder below.
 
| Path | Type | Data source | Status | Auth required |
|---|---|---|---|---|
| *(pending real per-file audit)* | | | | |
 
## What's Built vs. Not
 
###  Working (verified)
- `pnpm install`, `pnpm typecheck`, `pnpm lint` — all pass (6/6 packages)
- Smart contracts — `forge build` + `forge test` pass, 26/26 tests
- `pnpm test` — passes for contracts
- CI pipeline exists at `.github/workflows/ci.yml`, runs typecheck/lint/test/build/forge on push and PR
- `users.handle` — present in migrations `0005` and `0007`
- `GrantTreasury.executeExpense` (line ~222) — access control confirmed: `whenNotPaused`, `nonReentrant`, plus a role/ownership check (`msg.sender == proposer` or `hasRole(APPROVER)`)
- No admin/`service_role` Supabase client hits found in `app/api` (grep returned none)
- `dev-auth.ts` — only one usage found, at `AuthProvider.tsx:8`
###  Partially Working / Mocked (verified)
- **Web build fails** — EPIPE / Windows pipe-worker failure, exit code from an uncaught exception (not an env var or memory issue). This blocks `pnpm build` and blocks deployment.
- **AI health badges are hardcoded** — no dashboard route exists in the codebase (`find` for a dashboard directory returned nothing); the only badge references found are static, no live query behind them.
- **Notification/agent queue is in-memory** — `packages/agents/src/queue.ts:6` uses an in-process Map. State is lost on server restart.
- **Demo page has mock data** — `apps/web/app/demo/page.tsx:28` has a hardcoded mock profile. Confirmed confined to `/demo`, does not leak into authenticated routes.
- **Rate limiting is absent** — grep for `rateLimit`/`throttle`/`@upstash/ratelimit` across `apps` and `packages` returned nothing.
###  Not Started / Genuinely Unverified
- Full per-route classification (see Route Map above)
- Whether every individual page calls a real API vs. renders local state (only spot-checked, not exhaustive)
## Known Limitations
 
- Web build is currently broken (EPIPE, Windows-specific pipe/worker failure) — **do not deploy**.
- Notifications and the AI agent queue are in-memory; both reset on restart.
- Dashboard AI health badges are hardcoded placeholders, not live data.
- No rate limiting anywhere in the app or API layer.
- Full route-by-route behavior has not been exhaustively verified — see Route Map.
## Roadmap
 
**Phase 1 — Fix the build (blocker)**
- Diagnose and resolve the EPIPE/Windows worker failure blocking `pnpm build`
- Confirm a clean build on both the dev machine and CI
**Phase 2 — Finish the route audit**
- Open all ~65 pages/API routes individually, classify each as real-data / mock / stub
- Fill in the Full Route Map table above for real
**Phase 3 — Replace in-memory state**
- Move the notification system and agent queue to a persistent store (Redis/BullMQ, already a listed dependency)
- Confirm graceful degradation if OpenAI/Gemini keys are missing, rather than a crash
**Phase 4 — Wire up the dashboard**
- Build a real dashboard route with live AI health data instead of hardcoded badges
**Phase 5 — Harden for production**
- Add rate limiting
- Re-run the full security grep (secrets, TODO/FIXME/HACK, Zod validation coverage) to full completion
*(Phases depend on each other in order — Phase 1 blocks meaningful testing of everything after it.)*
 
## Folder Structure
 
```
apps/web/                  Next.js workspace (routes, API, validation, state machines)
packages/
  agents/                  AI agent suite + queue (tracker, spending, milestone, orchestrator)
  auth/                    Privy session, RBAC, middleware, RLS helpers
  contracts/               Foundry project (src/, script/Deploy.s.sol, test/)
  database/                Drizzle schema, migrations, seed, PGlite tests
  shared/                  Cross-cutting: supabase clients, env, privy, blockchain,
                            storage (Pinata), queues, AI, services, monitoring
  ui/                      Design system (Button, Card, Badge, Input, Modal, Spinner)
docs/                       Feature docs (AUTH, PROJECTS, MILESTONES, RESEARCH_LOGS,
                            RECONCILIATION, REPORTS, NOTIFICATIONS, SETTINGS,
                            DASHBOARD, TESTING_GAPS)
.github/workflows/          CI (ci.yml)
README.md  SECURITY.md  KNOWN_LIMITATIONS.md  DEPLOYMENT.md
```
 
## Getting Started
 
Requirements: Node >=20.18 <25, pnpm 10.32.1, Foundry (for contracts).
 
```bash
pnpm install               #  passes clean
cp .env.example .env       # fill in real values — never commit .env
```
 
Key env vars (see `.env.example` for the full list): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `REDIS_URL`, Base RPC URLs, Pinata, OpenAI/Gemini, Sentry.
 
Database (local, no Docker needed — PGlite file DB):
```bash
pnpm --filter @sciagent/database db:seed   # applies ./migrations, seeds sample data
```
 
Contracts:
```bash
cd packages/contracts
forge build     #  passes
forge test      #  26/26 passing
```
 
Run the web app:
```bash
pnpm --filter sciagent-web dev    # or: pnpm dev (all workspaces)
# If 3000 is occupied (common on Windows), use 3100:
PORT=3100 pnpm --filter sciagent-web dev   # → http://localhost:3100
```
 
 **`pnpm build` currently fails** with an EPIPE/Windows worker error. Do not attempt to deploy or run a production build until Phase 1 of the roadmap is resolved.
 
Demo/preview (no real data, no API calls):
```bash
# After pnpm dev, visit http://localhost:3100/demo
# Mock projects + mock profile, persistent "Demo mode" banner,
# Like/Comment/Share/Fund/Create are visibly disabled
```
 
## Testing & Quality Gates
 
Before opening a PR:
```bash
pnpm typecheck   #  must pass — currently passes
pnpm lint        #  must pass — currently passes
pnpm test        #  must pass — currently passes (contracts confirmed 26/26)
pnpm build       #  currently FAILS — fix required before this gate is real
cd packages/contracts && forge test   #  must pass — currently passes
```
 
CI (`.github/workflows/ci.yml`) runs all of the above on push and PR. It will currently fail at the build step until Phase 1 is resolved.
 
## Security
 
Trust model: Privy JWT → Supabase RLS → on-chain settlement. See `SECURITY.md` and `packages/contracts/SECURITY.md` for the full threat model and audit focus.
 
Known gaps as of this audit: no rate limiting found anywhere in the app or API layer; secrets/env handling and Zod validation coverage have not been exhaustively re-checked in this pass.
 
## Documentation Index
 
- `KNOWN_LIMITATIONS.md` — what's explicitly not production-ready (read before deploying)
- `DEPLOYMENT.md` — env, migrations, contract deploy, build
- `SECURITY.md` / `packages/contracts/SECURITY.md` — threat model + audit focus
- `docs/AUTH.md` — Privy flow + role matrix
- `docs/PROJECTS.md` — project CRUD, state machine, collaborators
- `docs/MILESTONES.md` — milestone lifecycle + fund release
- `docs/RESEARCH_LOGS.md` — logs + IPFS evidence rules
- `docs/RECONCILIATION.md` — chain/DB treasury sync
- `docs/REPORTS.md` — CSV/JSON export
- `docs/NOTIFICATIONS.md` — events + preferences
- `docs/SETTINGS.md` — user + project settings
- `docs/TESTING_GAPS.md` — coverage + hardening report
- `docs/DASHBOARD.md` — dashboard + UI system
- `packages/agents/AGENTS.md` — agent architecture
- `packages/database/DATABASE.md` — schema + RLS
## Contributing
 
- Conventional Commits, enforced via commitlint (`commitlint.config.js`)
- ESLint + Prettier via Husky/lint-staged on commit
- PR checklist: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `forge test` must all pass. **`pnpm build` must also pass before merge once Phase 1 is fixed** — until then, note the build is a known-broken exception.
- Reviewed by: *[TBD — Sidney to assign]*
## Team / Contact
 
*[Placeholder — Sidney to fill in with team names, roles, and contact info]*
 
