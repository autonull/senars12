/**
 * Graph operations (delta) + cognitive delta
 */
import { z } from 'zod';
import { msg, variant } from './envelope.js';
import { GraphNodeDataView, Lens } from './graph-view.js';

const ENDPOINTS = { source: z.string(), target: z.string() };
const NODE = { id: z.string(), data: GraphNodeDataView };

export const GraphOp = z.discriminatedUnion('action', [
  variant('action', 'add_node', NODE),
  variant('action', 'update_node', NODE),
  variant('action', 'remove_node', { id: z.string() }),
  variant('action', 'add_edge', {
    ...ENDPOINTS,
    data: z.object({ weight: z.number(), type: z.string(), directed: z.boolean() }).optional(),
  }),
  variant('action', 'remove_edge', ENDPOINTS),
]);
export type GraphOp = z.infer<typeof GraphOp>;
export type GraphOpType = z.infer<typeof GraphOp>;

export const CognitiveDelta = msg('cognitive.delta', {
  seqId: z.number(),
  lens: Lens,
  ops: z.array(GraphOp),
  meta: z
    .object({ truncated: z.boolean().optional(), totalHidden: z.number().optional() })
    .optional(),
});
