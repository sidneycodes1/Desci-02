import { describe, expect, it } from 'vitest';

import { baseMainnetChain, baseSepoliaChain } from '../blockchain/chains';
import { isSupportedChainId, shortenAddress } from '../blockchain/utils';

describe('blockchain helpers', () => {
  it('detects supported chain ids', () => {
    expect(isSupportedChainId(baseMainnetChain.id)).toBe(true);
    expect(isSupportedChainId(baseSepoliaChain.id)).toBe(true);
    expect(isSupportedChainId(1)).toBe(false);
  });

  it('shortens addresses safely', () => {
    expect(shortenAddress('0x000000000000000000000000000000000000dead')).toContain('...dEaD');
  });
});
