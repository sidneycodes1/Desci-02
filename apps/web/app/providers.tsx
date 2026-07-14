'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { WagmiProvider } from 'wagmi';

import { createBlockchainConfig } from '@sciagent/shared/blockchain';
import { createPrivyAppConfig, isPrivyAppIdConfigured } from '@sciagent/shared/privy';

const blockchainConfig = createBlockchainConfig();
const privyConfig = createPrivyAppConfig();
const { appId, defaultChainId: _defaultChainId, supportedChains: _supportedChains, ...privyProviderConfig } = privyConfig;
const shouldUsePrivyProvider = isPrivyAppIdConfigured(appId);

export interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(() => new QueryClient());

  if (!shouldUsePrivyProvider) {
    return (
      <WagmiProvider config={blockchainConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={privyProviderConfig}
    >
      <WagmiProvider config={blockchainConfig}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
