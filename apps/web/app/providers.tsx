'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { WagmiProvider } from 'wagmi';

import { createConfig as createWagmiConfig, http as httpTransport } from 'wagmi';

import {
  baseMainnetChain,
  baseSepoliaChain,
  createBlockchainConfig,
  supportedChains,
} from '@sciagent/shared/blockchain';
import { createPrivyAppConfig, isPrivyAppIdConfigured } from '@sciagent/shared/privy';

function getBlockchainConfigSafe() {
  try {
    return createBlockchainConfig();
  } catch {
    // Fallback for static generation when env is missing — use placeholder RPCs.
    // Uses only static chain definitions (no env reads), so this never throws.
    try {
      return createWagmiConfig({
        chains: [...supportedChains],
        ssr: true,
        transports: {
          [baseMainnetChain.id]: httpTransport('https://mainnet.base.org'),
          [baseSepoliaChain.id]: httpTransport('https://sepolia.base.org'),
        },
      });
    } catch {
      // Last resort: return dummy object cast — prevents build throw, runtime will still require real env
      return {} as ReturnType<typeof createBlockchainConfig>;
    }
  }
}

function getPrivyConfigSafe() {
  try {
    return createPrivyAppConfig();
  } catch {
    return {
      appId: 'privy_app_example',
      loginMethods: ['wallet', 'email'] as const,
      appearance: { theme: 'dark' as const },
      embeddedWallets: { createOnLogin: 'users-without-wallets' as const },
      defaultChainId: 84532,
      supportedChains: [8453, 84532] as unknown as never,
    } as never;
  }
}

export interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [configs] = useState(() => {
    const bc = getBlockchainConfigSafe();
    const pc = getPrivyConfigSafe() as ReturnType<typeof createPrivyAppConfig>;
    const { appId: aid, defaultChainId: _d, supportedChains: _s, ...rest } = pc;
    return {
      blockchainConfig: bc,
      appId: aid,
      privyProviderConfig: rest,
      shouldUsePrivy: isPrivyAppIdConfigured(aid),
    };
  });

  if (!configs.shouldUsePrivy) {
    return (
      <WagmiProvider config={configs.blockchainConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    );
  }

  return (
    <PrivyProvider appId={configs.appId} config={configs.privyProviderConfig}>
      <WagmiProvider config={configs.blockchainConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
