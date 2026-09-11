import { describe, expect, it, vi, beforeEach } from 'vitest';

import { verifySession, getSessionUser, invalidateSession } from '../session';
import { PRIVY_AUDIENCE } from '../constants';
import { PrivyClient } from '@privy-io/server-auth';
import { getServerEnv } from '@sciagent/shared/env/server';

const mockVerifyAuthToken = vi.fn();
const mockGetUserFromIdToken = vi.fn();
const mockDeleteUser = vi.fn();

vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: vi.fn(() => ({
    verifyAuthToken: mockVerifyAuthToken,
    getUserFromIdToken: mockGetUserFromIdToken,
    deleteUser: mockDeleteUser,
  })),
}));

vi.mock('@sciagent/shared/env/server', () => ({
  getServerEnv: vi.fn(() => ({ PRIVY_APP_SECRET: 'test-secret' })),
}));

beforeEach(() => {
  mockVerifyAuthToken.mockReset();
  mockGetUserFromIdToken.mockReset();
  mockDeleteUser.mockReset();
});

describe('Session verification', () => {
  it('verifySession throws without token', async () => {
    mockVerifyAuthToken.mockRejectedValue(new Error('No token'));
    await expect(verifySession('')).rejects.toThrow();
  });

  it('getSessionUser returns AuthUser structure', async () => {
    mockVerifyAuthToken.mockResolvedValue({
      userId: 'user-123',
      sessionId: 'sess-456',
      appId: 'app-789',
      issuer: 'privy.io',
      issuedAt: 1700000000,
      expiration: 1700003600,
    });
    mockGetUserFromIdToken.mockResolvedValue({
      id: 'user-123',
      linkedAccounts: [{ type: 'wallet', address: '0xabc' }],
      customMetadata: { sciagent_role: 'owner' },
      email: { address: 'test@example.com' },
      phone: null,
      wallet: { address: '0xabc' },
      isGuest: false,
      createdAt: 1700000000,
    });

    const result = await getSessionUser('bearer-token');
    expect(result.id).toBe('user-123');
    expect(result.role).toBe('owner');
    expect(result.walletAddress).toBe('0xabc');
    expect(result.email).toBe('test@example.com');
  });
});
