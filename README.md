# SciAgent Protocol

Decentralized research governance and treasury protocol on Base: verifiable
milestone payouts, AI-driven project risk analytics, and immutable research
logs — with a Next.js workspace, Supabase/Postgres backend, and Foundry smart
contracts.

> **Status:** MVP in active development, pre-production. See
> [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) before deploying anywhere —
> notifications and the agent queue are in-memory, the frontend still uses
> a dev session token (`apps/web/lib/dev-auth.ts`), and the dashboard AI
> health badges are hardcoded placeholders.

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

**Trust model:** Privy JWT → server-side session + RBAC → Supabase RLS
(`auth.uid()`, user-scoped client) → on-chain access control. The chain is the
source of truth for balances; Postgres caches it and reconciles (see
[docs/RECONCILIATION.md](./docs/RECONCILIATION.md)).

## Tech stack

| Layer     | Tech                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------- |
| Frontend  | Next.js 15, React 18, Tailwind, TanStack Query, Privy, wagmi/viem                                       |
| API/auth  | Next.js route handlers, `@sciagent/auth` (Privy JWT, RBAC), Zod                                         |
| Data      | Supabase Postgres, Drizzle ORM, PGlite (local dev/test)                                                 |
| Contracts | Solidity 0.8.26, Foundry, OpenZeppelin 5.x (Base Sepolia)                                               |
| Agents/AI | `@sciagent/agents` (tracker/spending/milestone + orchestrator), OpenAI/Gemini via `@sciagent/shared/ai` |
| Tooling   | pnpm workspaces, Turbo, Vitest, ESLint + Prettier, Husky + lint-staged, Sentry                          |

## Folder structure

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
README.md  SECURITY.md  KNOWN_LIMITATIONS.md  DEPLOYMENT.md
docs/                        Feature docs (AUTH, PROJECTS, MILESTONES,
                             RESEARCH_LOGS, RECONCILIATION, REPORTS,
                             NOTIFICATIONS, SETTINGS, DASHBOARD, TESTING_GAPS)
apps/web/                    (no loose docs — see docs/DASHBOARD.md)
packages/agents/AGENTS.md      Agent architecture + queue
packages/database/DATABASE.md  Schema, RLS, migrations, local dev
packages/contracts/SECURITY.md Contract security + audit focus
```

## Setup

Requirements: Node `>=20.18 <25`, pnpm `10.32.1`, Foundry (for contracts).

```bash
pnpm install
cp .env.example .env   # then fill in real values (never commit .env)
```

Key env vars (see [.env.example](./.env.example) for the full list):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`,
`REDIS_URL`, Base RPC URLs, Pinata, OpenAI/Gemini, Sentry.

Database (local, no Docker needed — PGlite file DB):

```bash
pnpm --filter @sciagent/database db:seed   # applies ./migrations, seeds sample data
```

Contracts:

```bash
cd packages/contracts
forge build
forge test
```

Run the web app:

```bash
pnpm --filter sciagent-web dev    # or: pnpm dev (all workspaces)
# If 3000 is occupied (common on Windows), use 3100 — this has caused real confusion:
PORT=3100 pnpm --filter sciagent-web dev   # → http://localhost:3100
```

Demo/preview (no real data, no API calls):

```bash
# After pnpm dev, visit http://localhost:3100/demo
# 5 example projects + mock profile, persistent "Demo mode" banner, Like/Comment/Share/Fund/Create are visibly disabled
```

## Tests, typecheck, lint, build

```bash
pnpm typecheck
pnpm lint
pnpm test        # vitest per package + forge tests via packages/contracts
pnpm build
```

Database tests run against throwaway in-memory PGlite (schema + RLS matrix).
`apps/web` also has route-level persistence integration tests
(`apps/web/lib/__tests__/api-integration.test.ts`) that call the real route
handlers against PGlite with a test-only auth double.

## Docs

Start here, then go deeper:

- [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) — what is explicitly **not**
  production-ready (read before deploying)
- [DEPLOYMENT.md](./DEPLOYMENT.md) — env, migrations, contract deploy, build
- [SECURITY.md](./SECURITY.md) / [packages/contracts/SECURITY.md](./packages/contracts/SECURITY.md) — threat model + audit focus
- [AUTH.md](./docs/AUTH.md) — Privy flow + role matrix
- [PROJECTS.md](./docs/PROJECTS.md) — project CRUD, state machine, collaborators
- [MILESTONES.md](./docs/MILESTONES.md) — milestone lifecycle + fund release
- [RESEARCH_LOGS.md](./docs/RESEARCH_LOGS.md) — logs + IPFS evidence rules
- [RECONCILIATION.md](./docs/RECONCILIATION.md) — chain/DB treasury sync
- [REPORTS.md](./docs/REPORTS.md) — CSV/JSON export
- [NOTIFICATIONS.md](./docs/NOTIFICATIONS.md) — events + preferences
- [SETTINGS.md](./docs/SETTINGS.md) — user + project settings
- [TESTING_GAPS.md](./docs/TESTING_GAPS.md) — coverage + hardening report
- [docs/DASHBOARD.md](./docs/DASHBOARD.md) — dashboard + UI system
- [packages/agents/AGENTS.md](./packages/agents/AGENTS.md) — agent architecture
- [packages/database/DATABASE.md](./packages/database/DATABASE.md) — schema + RLS

Each package also has a short README explaining its role in the system.

## Contributing

Conventional Commits (`commitlint`), ESLint + Prettier via Husky/lint-staged
on commit, CI runs `pnpm typecheck` + `pnpm test` and `forge test`.
