import { z } from 'zod';

export const MAX_MEMO_BYTES = 1024;

export const proposeExpenseSchema = z.object({
  recipientAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid Ethereum wallet address'),
  amountWei: z
    .string()
    .regex(/^[1-9]\d*$/, 'Amount in wei must be a positive integer string'),
  memo: z
    .string()
    .min(1, 'Memo is required')
    .refine((m) => Buffer.byteLength(m, 'utf8') <= MAX_MEMO_BYTES, {
      message: `Memo exceeds max allowed length of ${MAX_MEMO_BYTES} bytes`,
    }),
});

export const reconcileTreasurySchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  targetBlock: z.number().int().positive().optional(),
});

export type ProposeExpenseInput = z.infer<typeof proposeExpenseSchema>;
export type ReconcileTreasuryInput = z.infer<typeof reconcileTreasurySchema>;
