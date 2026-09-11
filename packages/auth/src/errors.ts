export class AuthError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export class SessionExpiredError extends AuthError {
  constructor(message = 'Session expired') {
    super(message, 'SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

export class UnauthorizedError extends AuthError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class InsufficientRoleError extends AuthError {
  constructor(requiredRole: string) {
    super(
      `Requires role ${requiredRole} or higher`,
      'INSUFFICIENT_ROLE'
    );
    this.name = 'InsufficientRoleError';
  }
}

export class InvalidTokenError extends AuthError {
  constructor(message = 'Invalid token') {
    super(message, 'INVALID_TOKEN');
    this.name = 'InvalidTokenError';
  }
}
