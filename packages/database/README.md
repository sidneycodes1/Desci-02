# @sciagent/database

Drizzle ORM schema, migrations, seed, and PGlite tests for SciAgent's
Supabase Postgres. Runtime user queries go through the Supabase scoped
client; Drizzle owns schema/migrations/seed/worker scripts.

```bash
pnpm --filter @sciagent/database db:seed   # migrate + seed local PGlite file DB
pnpm --filter @sciagent/database test
pnpm --filter @sciagent/database typecheck
```

See [DATABASE.md](./DATABASE.md) for conventions, tables, RLS, migrations,
and local dev.
