# Project Management (Phase 5)

## Overview

Phase 5 implements the core project management functionality for SciAgent Protocol, including CRUD operations, state machine enforcement, and collaborator management. All operations are protected by the authentication and authorization system from Phase 4.

## State Machine

### Project Statuses

Projects can be in one of four states:

- **draft**: Initial state, project is being created and edited
- **active**: Project is live and can receive funding, create milestones, and track expenses
- **completed**: Project has finished its work, no further changes allowed
- **archived**: Project is archived (terminal state, no further actions possible)

### Valid Transitions

```
draft → active (project activation)
draft → archived (archiving without activation)
active → completed (project completion)
active → archived (archiving active projects)
completed → archived (archiving completed projects)
```

### Invalid Transitions

- `active → draft` (cannot go back to draft)
- `completed → active` (cannot reactivate completed projects)
- `archived → any` (archived is terminal)
- Same status transitions are not allowed

### State Machine Functions

```typescript
import { canTransitionStatus, validateStatusTransition, isTerminalStatus, isActiveProject, isEditableProject } from './lib/state-machine/project';

// Check if transition is valid
if (canTransitionStatus('draft', 'active')) {
  // Allow transition
}

// Validate and throw if invalid
validateStatusTransition('active', 'draft'); // Throws error

// Helper functions
isTerminalStatus('archived'); // true
isActiveProject('active'); // true
isEditableProject('draft'); // true
```

## API Routes

### POST /api/projects

Create a new project. Requires authentication and minimum `owner` role.

**Request:**
```json
{
  "name": "Research Project Name",
  "metadataUri": "https://example.com/metadata.json",
  "status": "draft" // optional, defaults to "draft"
}
```

**Response:** 201 with created project

### GET /api/projects

List all projects where the authenticated user is owner or collaborator.

**Response:** 200 with array of projects

### GET /api/projects/[id]

Get a specific project. Requires authentication and project access (owner or collaborator).

**Response:** 200 with project details

### PATCH /api/projects/[id]

Update a project. Requires authentication and owner role (or admin). Status transitions are validated against the state machine.

**Request:**
```json
{
  "name": "Updated Name",
  "metadataUri": "https://example.com/new-metadata.json",
  "status": "active"
}
```

**Response:** 200 with updated project

### DELETE /api/projects/[id]

Soft delete a project. Requires authentication and owner role (or admin). Only projects in `draft` status can be deleted.

**Response:** 200 with success confirmation

### GET /api/projects/[id]/collaborators

List project collaborators. Requires authentication and project access.

**Response:** 200 with array of collaborators including user details

### POST /api/projects/[id]/collaborators

Add a collaborator to a project. Requires authentication and owner role (or admin).

**Request:**
```json
{
  "userId": "user-uuid",
  "role": "collaborator" // or "viewer"
}
```

**Response:** 201 with added collaborator

### DELETE /api/projects/[id]/collaborators/[userId]

Remove a collaborator from a project. Requires authentication and owner role (or admin).

**Response:** 200 with success confirmation

## Validation

All input is validated using Zod schemas:

- `createProjectSchema`: Validates project creation (name length, URL format, status enum)
- `updateProjectSchema`: Validates project updates (all fields optional)
- `addCollaboratorSchema`: Validates collaborator addition (UUIDs, role enum)
- `removeCollaboratorSchema`: Validates collaborator removal (UUIDs)

### Validation Rules

- Project name: 1-200 characters, required
- Metadata URI: Must be valid URL, required
- Status: Must be one of `draft`, `active`, `completed`, `archived`
- User IDs: Must be valid UUIDs
- Collaborator roles: `owner`, `collaborator`, or `viewer`

## Authorization

### Role Requirements

- **Create project**: `owner` or `admin`
- **Update project**: Owner or `admin`
- **Delete project**: Owner or `admin` (only draft projects)
- **Add collaborator**: Owner or `admin`
- **Remove collaborator**: Owner or `admin`
- **View project**: Owner or collaborator

### Access Control

All API routes:
1. Require valid Bearer token in Authorization header
2. Verify session using Privy JWT
3. Check role requirements for the operation
4. Validate ownership/collaborator access for read operations
5. Use Supabase RLS via user-scoped client for database operations

## Database Integration

Projects are stored in the `projects` table with the following fields:

- `id`: UUID primary key
- `onchain_project_id`: BigInt (nullable, set when minted on-chain)
- `owner_user_id`: UUID foreign key to users
- `name`: Text (required)
- `metadata_uri`: Text (required)
- `status`: Enum (draft/active/completed/archived)
- `onchain_tx_hash`: Text (nullable)
- `created_at`: Timestamp with timezone
- `updated_at`: Timestamp with timezone
- `deleted_at`: Timestamp with timezone (soft delete)

Collaborators are stored in `project_collaborators` with composite primary key on (project_id, user_id).

## Testing

### Unit Tests

- Validation schemas: 20 tests covering all validation rules and edge cases
- State machine: 18 tests covering all valid/invalid transitions and helper functions

Run tests:
```bash
pnpm --filter sciagent-web test
```

### Test Coverage

- Validation: ✅ All schemas tested
- State machine: ✅ All transitions tested
- API routes: ⚠️ Integration tests deferred due to workspace package module resolution issues in vitest

## Security Considerations

1. **Authentication**: All routes require valid Privy JWT
2. **Authorization**: Role-based access control enforced server-side
3. **Input Validation**: All user input validated with Zod schemas
4. **State Machine**: Invalid status transitions blocked at API level
5. **Ownership**: Only owners (or admins) can modify projects
6. **Soft Delete**: Projects are soft-deleted to preserve audit trail
7. **RLS**: Database operations use user-scoped Supabase client for RLS enforcement

## Known Limitations

1. API route integration tests are deferred due to vitest module resolution issues with workspace packages. These should be added as integration tests using a test database.
2. Collaborator role permissions are not yet enforced at the API level (only owner/admin can modify projects). Future phases should add granular collaborator permissions.
3. No rate limiting on API routes yet.
4. Project metadata is stored as a URI reference; metadata content validation is not implemented.

## Next Steps

Phase 6 will implement research logs (progress updates, evidence uploads) tied to projects.
