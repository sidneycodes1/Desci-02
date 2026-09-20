import type { SupportedChainId } from '../blockchain/chains';

export type PrivyLoginMethod = 'email' | 'wallet';
export type PrivyAppearanceTheme = 'dark' | 'light';

export interface PrivyEmbeddedWalletsConfig {
  createOnLogin: 'all-users' | 'users-without-wallets' | 'off';
}

export interface PrivyProviderConfig {
  loginMethods: PrivyLoginMethod[];
  appearance: {
    theme: PrivyAppearanceTheme;
  };
  embeddedWallets: PrivyEmbeddedWalletsConfig;
  defaultChainId: SupportedChainId;
  supportedChains: SupportedChainId[];
}

export interface PrivyAppConfig extends PrivyProviderConfig {
  appId: string;
}
