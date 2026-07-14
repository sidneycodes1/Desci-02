import { createConfig, http } from 'wagmi';

import { clientEnv } from '../env/client';
import { baseMainnetChain, baseSepoliaChain, supportedChains, type SupportedChainId } from './chains';

export interface BlockchainConfigOptions {
  ssr?: boolean;
}

export function createBlockchainConfig(options: BlockchainConfigOptions = {}) {
  return createConfig({
    chains: [...supportedChains],
    ssr: options.ssr ?? true,
    transports: {
      [baseMainnetChain.id]: http(clientEnv.NEXT_PUBLIC_BASE_MAINNET_RPC_URL),
      [baseSepoliaChain.id]: http(clientEnv.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL)
    }
  });
}

export const blockchainChainIds = supportedChains.map((chain) => chain.id) as SupportedChainId[];

export function createWalletConnectProject() {
  return {
    projectId: clientEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    metadata: {
      name: 'SciAgent',
      description: 'SciAgent wallet access',
      url: clientEnv.NEXT_PUBLIC_APP_URL,
      icons: []
    }
  };
}
