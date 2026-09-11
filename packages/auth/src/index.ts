export { ROLE_HIERARCHY, hasRole, resolveRole, isHigherOrEqual } from './role';
export type { Role, Permission } from './role';
export { verifySession, getSessionUser, invalidateSession } from './session';
export type { PrivySession, AuthUser, SessionClaims } from './session';
export { createAuthMiddleware, authGuard } from './middleware';
export { protectedRoutes, publicRoutes, isProtectedRoute } from './routes';
export { generateRlsPolicies, generateUserRlsPolicy, RLS_SQL } from './rls';
export { AuthError, SessionExpiredError, UnauthorizedError, InsufficientRoleError, InvalidTokenError } from './errors';
export { PRIVY_AUDIENCE, ROLE_TO_PRIVY_METADATA_KEY } from './constants';
