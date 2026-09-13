# @sciagent/auth

Privy-based authentication package for SciAgent dApps.

## Overview

Provides session management, role-based access control, and Supabase RLS policy generation tied to Privy JWT verification.

## Architecture

```
Privy (client) → Privy JWT → @sciagent/auth → Supabase RLS → Contract calls
```

- **Privy** issues JWTs on login
- **@sciagent/auth** verifies JWTs server-side using `@privy-io/server-auth`
- **Supabase RLS** policies enforce row-level security using `auth.uid()`
- **Smart contracts** are called with the authenticated user's wallet

## Installation

```bash
pnpm add @sciagent/auth --filter @sciagent/web
```

## Usage

### Server-side session verification

```ts
import { verifySession, getSessionUser } from '@sciagent/auth/server';

const session = await verifySession(request.headers.get('Authorization')!.slice(7));
const user = await getSessionUser(token);
```

### Route protection

```ts
import { createAuthMiddleware } from '@sciagent/auth/middleware';

const auth = createAuthMiddleware({ requiredRole: 'owner' });
```

### RLS Policies

```ts
import { generateRlsPolicies } from '@sciagent/auth/rls';

const sql = generateRlsPolicies([
  'project_registries',
  'grant_expenses',
  'milestones',
  'reputation_events',
]);
```

## Role Hierarchy

| Role   | Level | Permissions                                                                                                                                                                                                                                 |
| ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| admin  | 4     | All permissions including project:create, project:update, project:delete, expense:propose, expense:approve, expense:execute, milestone:create, milestone:approve, reputation:write, admin:manage_users, admin:manage_roles, admin:pause_all |
| owner  | 3     | Project management (create/update/delete), expense management (propose/approve/execute), milestone management (create/approve), reputation:write                                                                                            |
| member | 2     | Read-only access to projects. Cannot create projects, propose expenses, or create milestones. Treasury and milestone actions are owner/admin-only.                                                                                          |
| viewer | 1     | Read-only access to projects                                                                                                                                                                                                                |

## Environment Variables

- `NEXT_PUBLIC_PRIVY_APP_ID` — Privy application ID
- `PRIVY_APP_SECRET` — Privy app secret for server-side JWT verification
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key

## Tests

```bash
pnpm test --filter @sciagent/auth
```

## Security

See `packages/contracts/SECURITY.md` for the full security posture including trust boundaries and known limitations.
