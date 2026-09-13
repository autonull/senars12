/**
 * Graph operations (delta) + cognitive delta
 */
import { z } from 'zod';
import { GraphNodeDataView, Lens } from './graph-view.js';

export const GraphOp = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add_node'), id: z.string(), data: GraphNodeDataView }),
  z.object({
    action: z.literal('update_node'),
    id: z.string(),
    data: GraphNodeDataView,
  }),
  z.object({ action: z.literal('remove_node'), id: z.string() }),
  z.object({
    action: z.literal('add_edge'),
    source: z.string(),
    target: z.string(),
    data: z.object({ weight: z.number(), type: z.string(), directed: z.boolean() }).optional(),
  }),
  z.object({ action: z.literal('remove_edge'), source: z.string(), target: z.string() }),
]);
export type GraphOp = z.infer<typeof GraphOp>;
export type GraphOpType = z.infer<typeof GraphOp>;

export const CognitiveDelta = z.object({
  type: z.literal('cognitive.delta'),
  seqId: z.number(),
  lens: Lens,
  ops: z.array(GraphOp),
  meta: z
    .object({ truncated: z.boolean().optional(), totalHidden: z.number().optional() })
    .optional(),
});
