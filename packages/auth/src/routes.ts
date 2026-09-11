export const protectedRoutes = [
  '/api/projects',
  '/api/expenses',
  '/api/milestones',
  '/api/reputation',
  '/api/admin',
] as const;

export const publicRoutes = [
  '/api/auth',
  '/api/health',
] as const;

export const routeRoles: Record<string, string[]> = {
  '/api/admin': ['admin'],
  '/api/projects': ['owner', 'admin'],
  '/api/expenses': ['owner', 'member', 'admin'],
  '/api/milestones': ['owner', 'member', 'admin'],
  '/api/reputation': ['owner', 'admin'],
};

export function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some((route) => pathname.startsWith(route));
}

export function getRequiredRole(pathname: string): string[] | undefined {
  return routeRoles[pathname];
}
