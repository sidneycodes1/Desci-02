export interface AuthMiddlewareOptions {
  requiredRole?: import('./role').Role;
  requiredPermission?: import('./role').Permission;
  requireWallet?: boolean;
}

export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  return async function authMiddleware(
    request: Request,
    context: { params: Record<string, string> }
  ): Promise<Response | void> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Missing Authorization header');
    }

    const token = authHeader.slice(7);
    const { verifySession } = await import('./session');
    const session = await verifySession(token);

    if (options.requiredRole && session.role !== options.requiredRole) {
      throw new Error(`Requires role ${options.requiredRole}`);
    }

    if (options.requiredPermission && !session.permissions.includes(options.requiredPermission)) {
      throw new Error(`Missing permission ${options.requiredPermission}`);
    }

    return;
  };
}

export function authGuard(options: AuthMiddlewareOptions = {}) {
  return createAuthMiddleware(options);
}
