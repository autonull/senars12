import { z } from 'zod';

export const NarConfigSchema = z.object({
  cyclesPerStep: z.number().int().positive().default(10),
  maxConcepts: z.number().int().positive().default(10000),
  truthDefaultFrequency: z.number().min(0).max(1).default(0.5),
  truthDefaultConfidence: z.number().min(0).max(1).default(0.9),
  enableDrives: z.boolean().default(true),
  enableGoals: z.boolean().default(true),
  enableSelfReasoning: z.boolean().default(true),
});

export type NarConfig = z.infer<typeof NarConfigSchema>;