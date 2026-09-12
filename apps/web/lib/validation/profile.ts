import { z } from 'zod';

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  orcidId: z
    .string()
    .regex(/^(\d{4}-){3}\d{3}[\dX]$/, 'Invalid ORCID ID format (e.g. 0000-0002-1825-0097)')
    .optional()
    .or(z.literal('')),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
