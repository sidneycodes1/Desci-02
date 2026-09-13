# SciAgent Protocol — Deployment & Launch Checklist

> Pre-read: [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md). The items
> tracked there (in-memory notifications, in-memory agent queue, dev session
> token, hardcoded dashboard health scores) MUST be resolved before any
> production launch.

## Environment Variables Configuration

Copy `.env.example` to `.env` in the repo root and populate real secrets
(never commit `.env`). Full variable list lives in `.env.example`; the
critical ones:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_BASE_MAINNET_RPC_URL=https://mainnet.base.org
DEPLOYER_PRIVATE_KEY=0x...
```

---

## 1. Database Migrations Execution

Apply the Drizzle migrations in `packages/database/migrations/` to Supabase
(e.g. via `drizzle-kit migrate` with `DATABASE_URL`, or the Supabase SQL
editor — see `packages/database/DATABASE.md`):

```bash
pnpm --filter @sciagent/database db:seed   # local PGlite migrate + seed (dev only)
```

---

## 2. Smart Contract Deployment to Base Sepolia

Deploy protocol registries using the Foundry deployment script
(`packages/contracts/script/Deploy.s.sol`, contract `DeployProtocol`):

```bash
cd packages/contracts
forge script script/Deploy.s.sol --rpc-url $NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY --broadcast
```

---

## 3. Web Application Production Build

Build Next.js web application bundle:

```bash
pnpm --filter sciagent-web build
```

---

## 4. Final Verification Command Sequence

```bash
pnpm typecheck
pnpm test
```
