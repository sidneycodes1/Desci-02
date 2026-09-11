import { describe, expect, it } from 'vitest';

import { AuthError, SessionExpiredError, UnauthorizedError, InsufficientRoleError, InvalidTokenError } from '../errors';

describe('Auth errors', () => {
  it('AuthError has correct code', () => {
    const err = new AuthError('test', 'TEST');
    expect(err.code).toBe('TEST');
    expect(err.name).toBe('AuthError');
  });

  it('SessionExpiredError extends AuthError', () => {
    const err = new SessionExpiredError();
    expect(err).toBeInstanceOf(AuthError);
    expect(err.code).toBe('SESSION_EXPIRED');
  });

  it('UnauthorizedError has default message', () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe('Unauthorized');
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('InsufficientRoleError includes required role', () => {
    const err = new InsufficientRoleError('admin');
    expect(err.message).toContain('admin');
    expect(err.code).toBe('INSUFFICIENT_ROLE');
  });

  it('InvalidTokenError has default message', () => {
    const err = new InvalidTokenError();
    expect(err.message).toBe('Invalid token');
    expect(err.code).toBe('INVALID_TOKEN');
  });
});
