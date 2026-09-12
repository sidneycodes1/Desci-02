# SciAgent Protocol — Deployment & Launch Checklist

## Environment Variables Configuration

Copy `.env.example` to `.env` in the root workspace and populate required secrets:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
RPC_URL_BASE_SEPOLIA=https://sepolia.base.org
DEPLOYER_PRIVATE_KEY=0x...
```

---

## 1. Database Migrations Execution

Run Drizzle schema migrations to apply tables and RLS policies:

```bash
pnpm --filter @sciagent/database migrate
```

---

## 2. Smart Contract Deployment to Base Sepolia

Deploy protocol registries using Foundry deployment script:

```bash
cd packages/contracts
forge script script/DeployProtocol.s.sol --rpc-url $RPC_URL_BASE_SEPOLIA --private-key $DEPLOYER_PRIVATE_KEY --broadcast
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
