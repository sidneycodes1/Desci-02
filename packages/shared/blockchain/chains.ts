import { defineChain } from 'viem';

export const baseMainnetChain = defineChain({
  id: 8453,
  name: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://mainnet.base.org']
    }
  },
  blockExplorers: {
    default: {
      name: 'Basescan',
      url: 'https://basescan.org',
      apiUrl: 'https://api.basescan.org/api'
    }
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 5022
    },
    portal: {
      1: {
        address: '0x49048044D57e1C92A77f79988d21Fa8fAF74E97e',
        blockCreated: 17482143
      }
    },
    l1StandardBridge: {
      1: {
        address: '0x3154Cf16ccdb4C6d922629664174b904d80F2C35',
        blockCreated: 17482143
      }
    },
    disputeGameFactory: {
      1: {
        address: '0x43edB88C4B80fDD2AdFF2412A7BebF9dF42cB40e'
      }
    },
    l2OutputOracle: {
      1: {
        address: '0x56315b90c40730925ec5485cf004d835058518A0'
      }
    }
  },
  sourceId: 1
});

export const baseSepoliaChain = defineChain({
  id: 84532,
  network: 'base-sepolia',
  name: 'Base Sepolia',
  nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org']
    }
  },
  blockExplorers: {
    default: {
      name: 'Basescan',
      url: 'https://sepolia.basescan.org',
      apiUrl: 'https://api-sepolia.basescan.org/api'
    }
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 1059647
    },
    portal: {
      11_155_111: {
        address: '0x49f53e41452c74589e85ca1677426ba426459e85',
        blockCreated: 4446677
      }
    },
    l1StandardBridge: {
      11_155_111: {
        address: '0xfd0Bf71F60660E2f608ed56e1659C450eB113120',
        blockCreated: 4446677
      }
    },
    disputeGameFactory: {
      11_155_111: {
        address: '0xd6E6dBf4F7EA0ac412fD8b65ED297e64BB7a06E1'
      }
    },
    l2OutputOracle: {
      11_155_111: {
        address: '0x84457ca9D0163FbC4bbfe4Dfbb20ba46e48DF254'
      }
    }
  },
  testnet: true,
  sourceId: 11_155_111
});

export const supportedChains = [baseMainnetChain, baseSepoliaChain] as const;

export type SupportedChainId = (typeof supportedChains)[number]['id'];
