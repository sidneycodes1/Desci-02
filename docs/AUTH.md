# SciAgent Protocol — Authentication & Authorization

## Overview

SciAgent uses Privy for authentication and role-based access control (RBAC) for authorization. All API endpoints are protected with JWT verification and role checks.

## Authentication Flow

1. User authenticates via Privy (wallet login)
2. Privy issues a JWT token
3. Client includes JWT in `Authorization: Bearer <token>` header
4. Server verifies JWT using `@sciagent/auth/session`
5. Server extracts user ID and role from verified session
6. API endpoints enforce role-based permissions

## Role Matrix

| Permission         | Admin | Owner | Member | Viewer |
| ------------------ | ----- | ----- | ------ | ------ |
| project:create     | ✅    | ✅    | ❌     | ❌     |
| project:update     | ✅    | ✅    | ❌     | ❌     |
| project:delete     | ✅    | ✅    | ❌     | ❌     |
| expense:propose    | ✅    | ✅    | ❌     | ❌     |
| expense:approve    | ✅    | ✅    | ❌     | ❌     |
| expense:execute    | ✅    | ✅    | ❌     | ❌     |
| milestone:create   | ✅    | ✅    | ❌     | ❌     |
| milestone:approve  | ✅    | ✅    | ❌     | ❌     |
| reputation:write   | ✅    | ✅    | ❌     | ❌     |
| admin:manage_users | ✅    | ❌    | ❌     | ❌     |
| admin:manage_roles | ✅    | ❌    | ❌     | ❌     |
| admin:pause_all    | ✅    | ❌    | ❌     | ❌     |

## Key Design Decisions

### Collaborator (Member) Role

- **Read-only for treasury and milestone actions**: Members/collaborators cannot propose expenses or create milestones. These are owner/admin-only to maintain financial control.
- **Project participation**: Members can view projects they're added to and can create research logs (if they have project access).
- **No financial authority**: Members cannot initiate spending or milestone approvals.

### Owner Role

- Full project management authority
- Can propose, approve, and execute expenses
- Can create and approve milestones
- Can manage project collaborators
- Cannot perform admin-level operations (user management, role changes)

### Admin Role

- All owner permissions
- Can manage users and roles across the platform
- Can pause all operations (emergency stop)
- Should be used sparingly for platform governance

## API Enforcement

All API routes enforce these permissions at multiple layers:

1. **Session verification**: JWT must be valid and not expired
2. **Role checks**: User must have required role for the operation
3. **Project access**: User must be owner or collaborator for project-specific operations
4. **RLS policies**: Database enforces row-level security based on `auth.uid()`
5. **Business logic**: Additional validation (e.g., expense recipient must be project owner)

## Testing

Role permissions are tested in `packages/auth/src/test/role.test.ts` to ensure the permission matrix cannot silently drift. The test explicitly verifies that:

- Admin has all permissions
- Owner has project, expense, milestone, and reputation permissions
- Member has NO expense:propose or milestone:create permissions
- Viewer has no permissions

## Security Notes

- Role escalation is blocked at the database level (trigger `users_no_role_escalation`)
- Self-service role changes are not permitted
- Admin operations require elevated privileges and should be audited
- All financial operations (expenses, milestones) require owner/admin approval
