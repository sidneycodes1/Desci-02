import { z } from 'zod';

/** POST /api/projects/[id]/fund — any authenticated wallet funds any project. */
export const fundProjectSchema = z.object({
  amountWei: z
    .string()
    .regex(/^[1-9]\d*$/, 'Amount in wei must be a positive integer string'),
});

export type FundProjectInput = z.infer<typeof fundProjectSchema>;

/** POST /api/invites — owner invites by user id, handle, or shareable link. */
export const createInviteSchema = z.object({
  entityType: z.enum(['project', 'article']).default('project'),
  entityId: z.string().uuid('Invalid entity ID'),
  inviteeId: z.string().uuid('Invalid user ID').optional(),
  inviteeHandle: z.string().min(1).max(100).optional(),
  message: z.string().max(500).optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

/** POST /api/invites/[token] — accept or decline. */
export const respondInviteSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

export type RespondInviteInput = z.infer<typeof respondInviteSchema>;

/** Pure helper shared by route + tests: accumulate wei totals without float. */
export function addWei(a: string, b: string): string {
  return (BigInt(a) + BigInt(b)).toString();
}
