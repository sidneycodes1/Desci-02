# @sciagent/shared

Cross-cutting libraries shared by `apps/web` and workers. Import by subpath
(`@sciagent/shared/supabase`, `.../env`, `.../services`, … — see
`package.json` exports).

- **`supabase/`** — scoped clients. `createSupabaseClientFromToken(token)`
  for user-facing routes (RLS enforced); `getSupabaseAdminClient()` for
  system jobs only (seed, reconciliation, workers).
- **`env/`** — typed server/client/shared env (Zod-validated, lazy so builds
  don't require secrets).
- **`services/`** — domain logic: `treasuryService` (spend validation),
  `milestoneService` (state machine + approval/fund-release),
  `notificationService`, `reportService` (CSV/JSON export).
- **`blockchain/`** — Base mainnet/Sepolia chain + wagmi config.
- **`privy/`** — Privy app config helpers.
- **`storage/`** — Pinata IPFS uploads.
- **`queues/`** — BullMQ/Redis factory (falls back to in-memory locally).
- **`ai/`** — OpenAI/Gemini factory + model selection.
- **`monitoring/`** — logger + Sentry wiring.

```bash
pnpm --filter @sciagent/shared test
pnpm --filter @sciagent/shared typecheck
```
