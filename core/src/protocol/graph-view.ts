/**
 * Graph node data (UI flat view) + lens
 */
import { z } from 'zod';
import { TruthValue } from './chat.js';

export const GraphNodeDataView = z.object({
  id: z.string().optional(),
  label: z.string().optional(),
  term: z.string().optional(),
  atom: z.string().optional(),
  skill: z.string().optional(),
  priority: z.number().optional(),
  confidence: z.number().optional(),
  truth: TruthValue.optional(),
  isContradiction: z.boolean().optional(),
  occurrenceTime: z.number().optional(),
  goalRelevance: z.number().optional(),
  lensData: z.object({ score: z.number(), color: z.string(), size: z.number() }).optional(),
  layout: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
      threadIndex: z.number().optional(),
    })
    .optional(),
  nodeType: z.enum(['nar:concept', 'metta:atom', 'metta:skill']),
  capabilities: z.array(z.string()).optional(),
  html: z.string().optional(),
  punctuation: z.enum(['.', '!', '?']).optional(),
  space: z.string().optional(),
  durationMs: z.number().optional(),
  args: z.array(z.string()).optional(),
  type: z.string().optional(),
  result: z.string().optional(),
});
export type GraphNodeDataView = z.infer<typeof GraphNodeDataView>;

export const GraphNodeData = GraphNodeDataView;
export type GraphNodeData = z.infer<typeof GraphNodeDataView>;

export const Lens = z.string();
export type Lens = z.infer<typeof Lens>;
