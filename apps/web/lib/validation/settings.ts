import { z } from 'zod';

export const userSettingsSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100),
  bio: z.string().max(500).optional(),
  orcidId: z
    .string()
    .regex(/^(\d{4}-){3}\d{3}[\dX]$/, 'Invalid ORCID ID format (e.g. 0000-0002-1825-0097)')
    .optional()
    .or(z.literal('')),
  primaryWalletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum wallet address format')
    .optional(),
});

export const projectSettingsSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(200),
  metadataUri: z.string().url('Metadata URI must be a valid URL'),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'archived']).optional(),
});

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
export type ProjectSettingsInput = z.infer<typeof projectSettingsSchema>;
