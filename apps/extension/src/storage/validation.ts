import { z } from 'zod';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const activityInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter an activity name.').max(60, 'Use at most 60 characters for the name.'),
  category: z.enum(['career', 'health', 'hobbies-habits']),
  timesPerWeek: z.number().int('Weekly goal must be a whole number.').min(1, 'Weekly goal must be at least 1.').max(99, 'Weekly goal must be at most 99.'),
  importance: z.enum(['high', 'medium', 'low']),
  archived: z.boolean().default(false),
}).strict();

export const activitySchema = activityInputSchema.extend({
  archived: z.boolean(),
  id: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
}).strict();

export const logSchema = z.object({
  id: z.string().min(1),
  activityId: z.string().min(1),
  loggedAt: z.iso.datetime({ offset: true }),
  note: z.string().trim().max(280, 'Keep the note under 280 characters.').optional(),
}).strict();

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error.issues.map((issue) => issue.message).join(' '));
  return result.data;
}
