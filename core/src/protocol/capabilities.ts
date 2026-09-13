/**
 * Agent capabilities schema
 */
import { z } from 'zod';

export const AgentCapabilities = z.object({
  engine: z.enum(['nar', 'metta']),
  supports: z.object({
    chat: z.boolean(),
    beliefs: z.boolean(),
    drives: z.boolean(),
    skills: z.boolean(),
    ltm: z.boolean(),
    rlfp: z.boolean(),
    selfReasoning: z.boolean(),
    autonomyLoop: z.boolean(),
  }),
  configSchema: z.record(z.string(), z.any()).optional(),
});
export type AgentCapabilities = z.infer<typeof AgentCapabilities>;
