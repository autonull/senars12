/**
 * Graph node schemas (engine-specific)
 */
import { z } from 'zod';
import { TruthValue } from './chat.js';

/** Optional UI lens attributes attached to any graph node. */
export const LensData = z.object({ score: z.number(), color: z.string(), size: z.number() });
export type LensData = z.infer<typeof LensData>;

/** Node position; `threadIndex` orders nodes inside a reasoning thread. */
export const NodeLayout = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  threadIndex: z.number().optional(),
});
export type NodeLayout = z.infer<typeof NodeLayout>;

export const NarConceptNode = z.object({
  nodeType: z.literal('nar:concept'),
  id: z.string().optional(),
  label: z.string().optional(),
  term: z.string(),
  priority: z.number(),
  confidence: z.number(),
  truth: TruthValue.optional(),
  isContradiction: z.boolean().optional(),
  occurrenceTime: z.number().optional(),
  goalRelevance: z.number().optional(),
  lensData: LensData.optional(),
  layout: NodeLayout.optional(),
  html: z.string().optional(),
  punctuation: z.enum(['.', '!', '?']).optional(),
});

export const MettaAtomNode = z.object({
  nodeType: z.literal('metta:atom'),
  id: z.string().optional(),
  label: z.string().optional(),
  atom: z.string(),
  type: z.string().optional(),
  space: z.string(),
  lensData: LensData.optional(),
  layout: NodeLayout.optional(),
});

export const MettaSkillNode = z.object({
  nodeType: z.literal('metta:skill'),
  id: z.string().optional(),
  label: z.string().optional(),
  skill: z.string(),
  args: z.array(z.string()),
  result: z.string(),
  durationMs: z.number(),
  lensData: LensData.optional(),
  layout: NodeLayout.optional(),
});

export const GraphNodeDataStrict = z.discriminatedUnion('nodeType', [
  NarConceptNode,
  MettaAtomNode,
  MettaSkillNode,
]);
export type GraphNodeDataStrict = z.infer<typeof GraphNodeDataStrict>;
