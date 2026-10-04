/**
 * Object/node patch schemas
 */
import { z } from 'zod';
import { TruthValueSchema } from '../schemas/truth.js';

export const ObjectSetMsg = z.object({
  type: z.literal('object.set'),
  kind: z.enum(['node', 'edge']),
  id: z.string(),
  patch: z.object({
    truth: TruthValueSchema.optional(),
    type: z.string().optional(),
    priority: z.number().min(0).max(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
  }),
});

export const NodeSetMsg = z.object({
  type: z.literal('node.set'),
  id: z.string(),
  patch: z.object({
    truth: TruthValueSchema.optional(),
    priority: z.number().min(0).max(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
  }),
});
