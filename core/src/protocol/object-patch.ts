/**
 * Object/node patch schemas
 */

import { unitInterval } from '@senars/util/config';
import { z } from 'zod';
import { TruthValueSchema } from '../schemas/truth.js';
import { msg } from './envelope.js';

export const ObjectSetMsg = msg('object.set', {
  kind: z.enum(['node', 'edge']),
  id: z.string(),
  patch: z.object({
    truth: TruthValueSchema.optional(),
    type: z.string().optional(),
    priority: unitInterval.optional(),
    confidence: unitInterval.optional(),
  }),
});

export const NodeSetMsg = msg('node.set', {
  id: z.string(),
  patch: z.object({
    truth: TruthValueSchema.optional(),
    priority: unitInterval.optional(),
    confidence: unitInterval.optional(),
  }),
});
