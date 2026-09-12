import { z } from 'zod';

export const milestoneStateEnum = z.enum(['created', 'submitted', 'approved', 'rejected']);
export type MilestoneState = z.infer<typeof milestoneStateEnum>;

export const createMilestoneSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  descriptionUri: z
    .string()
    .url('Description URI must be a valid URL')
    .min(1, 'Description URI is required'),
});

export const submitMilestoneProofSchema = z.object({
  proofUri: z
    .string()
    .url('Proof URI must be a valid URL')
    .min(1, 'Proof URI is required'),
});

export const approveMilestoneSchema = z.object({
  releaseAmountWei: z
    .string()
    .regex(/^[1-9]\d*$/, 'Release amount in wei must be a positive integer string')
    .optional(),
  comment: z.string().max(1024).optional(),
});

export const rejectMilestoneSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(1024),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type SubmitMilestoneProofInput = z.infer<typeof submitMilestoneProofSchema>;
export type ApproveMilestoneInput = z.infer<typeof approveMilestoneSchema>;
export type RejectMilestoneInput = z.infer<typeof rejectMilestoneSchema>;
