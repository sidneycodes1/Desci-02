import { z } from 'zod';

export const trimmedString = z.string().trim().min(1);

export const nodeEnvSchema = z.enum(['development', 'test', 'production']);

export const booleanStringSchema = z
  .union([z.literal('true'), z.literal('false')])
  .transform((value) => value === 'true');

export const urlSchema = z.string().url();

export function formatEnvErrors(scope: string, issues: z.ZodIssue[]) {
  const details = issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : scope;
      return `- ${path}: ${issue.message}`;
    })
    .join('\n');

  return [
    `[env] ${scope} validation failed`,
    details,
    'Set the missing variables in your environment before starting the app.'
  ].join('\n');
}

export function parseEnvironment<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  rawEnvironment: NodeJS.ProcessEnv,
  scope: string
): z.infer<TSchema> {
  const parsed = schema.safeParse(rawEnvironment);

  if (!parsed.success) {
    throw new Error(formatEnvErrors(scope, parsed.error.issues));
  }

  return parsed.data;
}
