import { z } from 'zod';

export const ALLOWED_EVIDENCE_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/json',
  'text/plain',
  'text/markdown',
] as const;

export const MAX_EVIDENCE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const createResearchLogSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(50000, 'Content must be less than 50,000 characters'),
  evidenceCid: z.string().optional(),
  evidenceMimeType: z
    .enum(ALLOWED_EVIDENCE_MIME_TYPES, {
      errorMap: () => ({ message: 'Unsupported evidence file type' }),
    })
    .optional(),
  evidenceSizeBytes: z
    .number()
    .max(MAX_EVIDENCE_FILE_SIZE_BYTES, 'File size exceeds 10MB limit')
    .optional(),
});

export const updateResearchLogSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
  evidenceCid: z.string().optional(),
  evidenceMimeType: z.enum(ALLOWED_EVIDENCE_MIME_TYPES).optional(),
  evidenceSizeBytes: z.number().max(MAX_EVIDENCE_FILE_SIZE_BYTES).optional(),
});

export type CreateResearchLogInput = z.infer<typeof createResearchLogSchema>;
export type UpdateResearchLogInput = z.infer<typeof updateResearchLogSchema>;
