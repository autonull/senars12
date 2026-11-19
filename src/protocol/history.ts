/**
 * Node history message schemas
 */
import { z } from 'zod';
import { BeliefTruthSchema as TruthValueSchema } from '@senars/util/truth-schema';
import { msg } from './envelope.js';

export const NodeHistoryRequestMsg = msg('node.history.request', { term: z.string() });

export const NodeHistoryMsg = msg('node.history', {
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
