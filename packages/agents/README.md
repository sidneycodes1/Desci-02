# @sciagent/agents

Autonomous background AI agents that score research projects and feed the
dashboard health index: **tracker** (activity), **spending** (treasury
compliance), **milestone** (proof verification) — combined by the
**orchestrator** into a 0–100 project health index. `queue.ts` schedules the
jobs (BullMQ/Redis in production, in-memory fallback locally — see
`KNOWN_LIMITATIONS.md` §2).

```bash
pnpm --filter @sciagent/agents test
pnpm --filter @sciagent/agents typecheck
```

See [AGENTS.md](./AGENTS.md) for architecture, scoring, and queue details.
