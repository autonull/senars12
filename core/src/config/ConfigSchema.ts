import { z } from 'zod';

export const ConfigSchema = z.record(
  z.string(),
  z.object({
    type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
    default: z.unknown().optional(),
    description: z.string().optional(),
    enum: z.array(z.string()).optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
  })
);

export type ConfigSchema = z.infer<typeof ConfigSchema>;
