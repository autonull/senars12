/**
 * Object/node patch schemas
 */

import { unitInterval } from '@senars/util/config';
import { z } from 'zod';
import { BeliefTruthSchema as TruthValueSchema } from '@senars/util/truth-schema';
import { msg } from './envelope';

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
