export type Role = 'admin' | 'owner' | 'member' | 'viewer';

export type Permission =
  | 'project:create'
  | 'project:update'
  | 'project:delete'
  | 'expense:propose'
  | 'expense:approve'
  | 'expense:execute'
  | 'milestone:create'
  | 'milestone:approve'
  | 'reputation:write'
  | 'admin:manage_users'
  | 'admin:manage_roles'
  | 'admin:pause_all';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'project:create', 'project:update', 'project:delete',
    'expense:propose', 'expense:approve', 'expense:execute',
    'milestone:create', 'milestone:approve',
    'reputation:write',
    'admin:manage_users', 'admin:manage_roles', 'admin:pause_all',
  ],
  owner: [
    'project:create', 'project:update', 'project:delete',
    'expense:propose', 'expense:approve', 'expense:execute',
    'milestone:create', 'milestone:approve',
    'reputation:write',
  ],
  member: [], // Collaborators/Members are read-only for treasury & milestone controls
  viewer: [],
};

export const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 4,
  owner: 3,
  member: 2,
  viewer: 1,
};

export function resolveRole(roleString: string | undefined): Role {
  const normalized = (roleString ?? 'viewer').toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'owner') return 'owner';
  if (normalized === 'member') return 'member';
  return 'viewer';
}

export function hasRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function isHigherOrEqual(role: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[requiredRole];
}
