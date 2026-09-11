import { describe, expect, it, vi } from 'vitest';

import { invalidateSession } from '../session';
import { PrivyClient } from '@privy-io/server-auth';

const mockDeleteUser = vi.fn();

vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: vi.fn(() => ({
    deleteUser: mockDeleteUser,
  })),
}));

vi.mock('@sciagent/shared/env/server', () => ({
  getServerEnv: vi.fn(() => ({ PRIVY_APP_SECRET: 'test-secret' })),
}));

describe('invalidateSession', () => {
  it('calls deleteUser with userId', async () => {
    await invalidateSession('user-123');
    expect(mockDeleteUser).toHaveBeenCalledWith('user-123');
  });
});
