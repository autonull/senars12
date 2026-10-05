/**
 * Graph node schemas (engine-specific)
 */
import { z } from 'zod';
import { TaskPunctuationSchema } from '../schemas/task.js';
import { TruthValueSchema } from '../schemas/truth.js';

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

/** Optional UI lens attributes carried by every graph node. */
export const lensShape = { lensData: LensData.optional(), layout: NodeLayout.optional() };

/** Truth/attention annotations carried by every cognitively meaningful node. */
export const cognitionShape = {
  truth: TruthValueSchema.optional(),
  isContradiction: z.boolean().optional(),
  occurrenceTime: z.number().optional(),
  goalRelevance: z.number().optional(),
};

export const NarConceptNode = z.object({
  nodeType: z.literal('nar:concept'),
  id: z.string().optional(),
  label: z.string().optional(),
  term: z.string(),
  priority: z.number(),
  confidence: z.number(),
  ...cognitionShape,
  ...lensShape,
  html: z.string().optional(),
  punctuation: TaskPunctuationSchema.optional(),
});

export const MettaAtomNode = z.object({
  nodeType: z.literal('metta:atom'),
  id: z.string().optional(),
  label: z.string().optional(),
  atom: z.string(),
  type: z.string().optional(),
  space: z.string(),
  ...lensShape,
});

export const MettaSkillNode = z.object({
  nodeType: z.literal('metta:skill'),
  id: z.string().optional(),
  label: z.string().optional(),
  skill: z.string(),
  args: z.array(z.string()),
  result: z.string(),
  durationMs: z.number(),
  ...lensShape,
});

export const GraphNodeDataStrict = z.discriminatedUnion('nodeType', [
  NarConceptNode,
  MettaAtomNode,
  MettaSkillNode,
]);
export type GraphNodeDataStrict = z.infer<typeof GraphNodeDataStrict>;
