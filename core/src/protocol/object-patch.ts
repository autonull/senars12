/**
 * Object/node patch schemas
 */
import { z } from 'zod';
import { TruthValueSchema } from '../schemas/truth.js';
import { unitInterval } from '@senars/util/config';

export const ObjectSetMsg = z.object({
  type: z.literal('object.set'),
  kind: z.enum(['node', 'edge']),
  id: z.string(),
  patch: z.object({
    truth: TruthValueSchema.optional(),
    type: z.string().optional(),
    priority: unitInterval.optional(),
    confidence: unitInterval.optional(),
  }),
});

export const NodeSetMsg = z.object({
  type: z.literal('node.set'),
  id: z.string(),
  patch: z.object({
    truth: TruthValueSchema.optional(),
    priority: unitInterval.optional(),
    confidence: unitInterval.optional(),
  }),
});
