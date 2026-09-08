import { getClientEnv } from '../env/client';
import { blockchainChainIds, baseSepoliaChain } from '../blockchain';
import type { PrivyAppConfig, PrivyProviderConfig } from './types';

export const privyLoginMethods = ['wallet', 'email'] as const;

export function createPrivyProviderConfig(
  overrides: Partial<PrivyProviderConfig> = {}
): PrivyProviderConfig {
  return {
    loginMethods: [...privyLoginMethods],
    appearance: {
      theme: 'dark',
      ...overrides.appearance,
    },
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
      ...overrides.embeddedWallets,
    },
    defaultChainId: overrides.defaultChainId ?? baseSepoliaChain.id,
    supportedChains: overrides.supportedChains ?? [...blockchainChainIds],
  };
}

export function createPrivyAppConfig(overrides: Partial<PrivyAppConfig> = {}): PrivyAppConfig {
  const providerConfig = createPrivyProviderConfig(overrides);

  const env = getClientEnv();
  return {
    appId: env.NEXT_PUBLIC_PRIVY_APP_ID,
    ...providerConfig,
    ...overrides,
  };
}

export function createPrivyAuthFlowConfig() {
  const env = getClientEnv();
  return {
    loginMethods: [...privyLoginMethods],
    callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    loginRedirectUrl: `${env.NEXT_PUBLIC_APP_URL}/auth/login`,
    logoutRedirectUrl: `${env.NEXT_PUBLIC_APP_URL}/auth/logout`,
  };
}

export function isPrivyAppIdConfigured(appId: string): boolean {
  const normalizedAppId = appId.trim();

  if (!normalizedAppId) {
    return false;
  }

  return !/example|placeholder|your-privy-app-id/i.test(normalizedAppId);
}
