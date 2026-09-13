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
  // Must stay in sync with the DB project_status enum + state machine
  // (draft, active, completed, archived) — no 'paused' state exists.
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
});

export const notificationPreferencesSchema = z
  .object({
    inAppAlerts: z.boolean(),
    emailAlerts: z.boolean(),
    milestoneAlerts: z.boolean(),
    treasuryAlerts: z.boolean(),
    researchLogAlerts: z.boolean(),
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, {
    message: 'At least one preference must be provided',
  });

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;
export type ProjectSettingsInput = z.infer<typeof projectSettingsSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
