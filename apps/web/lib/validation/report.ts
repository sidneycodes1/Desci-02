import { z } from 'zod';

export const exportReportQuerySchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  section: z.enum(['all', 'logs', 'expenses', 'milestones']).default('all'),
});

export type ExportReportQuery = z.infer<typeof exportReportQuerySchema>;
