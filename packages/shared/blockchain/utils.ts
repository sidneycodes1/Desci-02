import { getAddress, isAddress, type Address } from 'viem';

import { baseMainnetChain, baseSepoliaChain } from './chains';

export function normalizeAddress(address: string): Address {
  return getAddress(address);
}

export function isSupportedAddress(address: string) {
  return isAddress(address);
}

export function shortenAddress(address: string, visibleCharacters = 4) {
  const checksummed = getAddress(address);
  return `${checksummed.slice(0, 2 + visibleCharacters)}...${checksummed.slice(-visibleCharacters)}`;
}

export function getChainById(chainId: number) {
  if (chainId === baseMainnetChain.id) {
    return baseMainnetChain;
  }

  if (chainId === baseSepoliaChain.id) {
    return baseSepoliaChain;
  }

  return undefined;
}

export function isSupportedChainId(chainId: number): chainId is typeof baseMainnetChain.id | typeof baseSepoliaChain.id {
  return chainId === baseMainnetChain.id || chainId === baseSepoliaChain.id;
}
