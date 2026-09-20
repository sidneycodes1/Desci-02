/**
 * Per-project membership — the one hard rule from the UI plan:
 * "Anyone can read. Only the owner and invited collaborators can edit."
 *
 * Roles are RELATIONSHIPS to a project, not global account types:
 * a user can own project A, collaborate on B, fund C, and read everything else.
 *
 * Global Privy `sciagent_role` now gates platform admin endpoints ONLY.
 * It never gates project creation or editing (see AUTH-MIGRATION plan §09).
 *
 * Pure module (no React/fetch) so Vitest + route handlers share it.
 */

export type ProjectRelation = 'owner' | 'collaborator' | 'funder' | 'reader';

export interface MembershipInput {
  ownerUserId: string;
  appUserId: string;
  isCollaborator: boolean;
  isAdmin?: boolean;
}

/** Resolve a user's relation to one project. Owner wins over collaborator. */
export function getProjectRelation(m: MembershipInput): ProjectRelation {
  if (m.appUserId === m.ownerUserId) return 'owner';
  if (m.isCollaborator) return 'collaborator';
  return 'reader';
}

/** Edit = owner or invited collaborator. No exceptions. */
export function canEditProject(m: MembershipInput): boolean {
  const rel = getProjectRelation(m);
  return rel === 'owner' || rel === 'collaborator' || m.isAdmin === true;
}

/** Invite = owner (or platform admin) only. Collaborators see it locked. */
export function canInvite(m: MembershipInput): boolean {
  return m.appUserId === m.ownerUserId || m.isAdmin === true;
}

/** Fund approval = owner, funder-of-record, or admin (plan §02). */
export function canApproveFunds(m: MembershipInput & { isFunder?: boolean }): boolean {
  return (
    m.appUserId === m.ownerUserId || m.isFunder === true || m.isAdmin === true
  );
}

/** Delete = owner or admin only. */
export function canDeleteProject(m: MembershipInput): boolean {
  return m.appUserId === m.ownerUserId || m.isAdmin === true;
}

/**
 * Editor route guard target. Returns the read-only URL when the user
 * must NOT enter `/edit/[id]`, or null when editing is allowed.
 */
export function editorGuardRedirect(
  m: MembershipInput,
  readUrl: string
): string | null {
  return canEditProject(m) ? null : readUrl;
}
