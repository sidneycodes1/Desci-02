import { describe, expect, it } from 'vitest';

import { proposeExpenseSchema } from '../treasury';

describe('Treasury & Expense Validation Schema', () => {
  const validAddress = '0x1234567890123456789012345678901234567890';

  it('validates a correct propose expense input', () => {
    const result = proposeExpenseSchema.safeParse({
      recipientAddress: validAddress,
      amountWei: '1000000000000000000',
      memo: 'Lab consumables purchase',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid Ethereum address format', () => {
    const result = proposeExpenseSchema.safeParse({
      recipientAddress: '0xinvalid',
      amountWei: '1000',
      memo: 'Valid memo',
    });

    expect(result.success).toBe(false);
  });

  it('rejects non-positive or non-integer wei strings', () => {
    const resultZero = proposeExpenseSchema.safeParse({
      recipientAddress: validAddress,
      amountWei: '0',
      memo: 'Valid memo',
    });
    expect(resultZero.success).toBe(false);

    const resultFloat = proposeExpenseSchema.safeParse({
      recipientAddress: validAddress,
      amountWei: '1.5',
      memo: 'Valid memo',
    });
    expect(resultFloat.success).toBe(false);
  });
});
