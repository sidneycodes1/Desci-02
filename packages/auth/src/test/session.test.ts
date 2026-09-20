import { describe, expect, it, vi } from 'vitest';

import { verifySession, getSessionUser, getAppIdentity, invalidateSession as _invalidateSession } from '../session';

const mockVerifyAuthToken = vi.fn();
const mockGetUserFromIdToken = vi.fn();

vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: vi.fn(() => ({
    verifyAuthToken: mockVerifyAuthToken,
    getUserFromIdToken: mockGetUserFromIdToken,
  })),
}));

vi.mock('@sciagent/shared/env/server', () => ({
  getServerEnv: vi.fn(() => ({ PRIVY_APP_SECRET: 'test-secret' })),
}));

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

  it('getAppIdentity returns the raw Privy DID plus wallet in one call', async () => {
    mockVerifyAuthToken.mockResolvedValue({
      userId: 'did:privy:cmu090hdu00hx0cl3gjkjtp0c',
      sessionId: 'sess-1',
      appId: 'app-789',
      issuer: 'privy.io',
      issuedAt: 1700000000,
      expiration: 1700003600,
    });
    mockGetUserFromIdToken.mockResolvedValue({
      id: 'did:privy:cmu090hdu00hx0cl3gjkjtp0c',
      linkedAccounts: [{ type: 'wallet', address: '0xdef' }],
      customMetadata: {},
      email: null,
      phone: null,
      wallet: { address: '0xdef' },
      isGuest: false,
      createdAt: 1700000000,
    });

    const identity = await getAppIdentity('real-privy-token');
    // The DID must stay a DID here — uuid resolution happens in app-session,
    // never by silently coercing (that coercion was the /api/projects 500).
    expect(identity.userId).toBe('did:privy:cmu090hdu00hx0cl3gjkjtp0c');
    expect(identity.walletAddress).toBe('0xdef');
    expect(identity.role).toBe('viewer');
    expect(mockVerifyAuthToken).toHaveBeenCalledWith('real-privy-token');
  });

  it('getAppIdentity falls back to linked wallet accounts when primary wallet is absent', async () => {
    mockVerifyAuthToken.mockResolvedValue({
      userId: 'did:privy:nowallet',
      sessionId: 'sess-2',
      appId: 'app-789',
      issuer: 'privy.io',
      issuedAt: 1700000000,
      expiration: 1700003600,
    });
    mockGetUserFromIdToken.mockResolvedValue({
      id: 'did:privy:nowallet',
      linkedAccounts: [{ type: 'wallet', address: '0xlinked' }],
      customMetadata: {},
      email: null,
      phone: null,
      wallet: null,
      isGuest: false,
      createdAt: 1700000000,
    });

    const identity = await getAppIdentity('token-2');
    expect(identity.walletAddress).toBe('0xlinked');
  });
});
