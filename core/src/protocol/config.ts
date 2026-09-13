/**
 * Configuration message schemas
 */
import { z } from 'zod';

export const ConfigField = z.object({
  type: z.enum(['slider', 'dropdown', 'text', 'toggle']),
  label: z.string(),
  value: z.any(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  description: z.string().optional(),
  category: z.enum(['llm', 'nars', 'system', 'advanced']).optional(),
  validation: z
    .object({
      pattern: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
});
export const ConfigSchemaMsg = z.object({
  type: z.literal('config.schema'),
  data: z.record(z.string(), ConfigField),
});
export const ConfigSetMsg = z.object({
  type: z.literal('config.set'),
  key: z.string(),
  value: z.any(),
});
