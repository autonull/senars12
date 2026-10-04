/**
 * Node history message schemas
 */
import { z } from 'zod';
import { TruthValueSchema } from '../schemas/truth.js';

export const NodeHistoryRequestMsg = z.object({
  type: z.literal('node.history.request'),
  term: z.string(),
});

export const NodeHistoryMsg = z.object({
  type: z.literal('node.history'),
  term: z.string(),
  history: z.array(
    z.object({
      truth: TruthValueSchema,
      stampId: z.string(),
      timestamp: z.number(),
      source: z.enum(['input', 'derivation', 'revision', 'inference']),
    })
  ),
});
