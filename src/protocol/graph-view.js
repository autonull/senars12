/**
 * Graph node data (UI flat view) + lens
 */
import { z } from 'zod';
import { TaskPunctuationSchema } from '../schemas/task';
import { cognitionShape, lensShape } from './graph-nodes';
export const GraphNodeDataView = z.object({
    id: z.string().optional(),
    label: z.string().optional(),
    term: z.string().optional(),
    atom: z.string().optional(),
    skill: z.string().optional(),
    priority: z.number().optional(),
    confidence: z.number().optional(),
    ...cognitionShape,
    ...lensShape,
    nodeType: z.enum(['nar:concept', 'metta:atom', 'metta:skill']),
    capabilities: z.array(z.string()).optional(),
    html: z.string().optional(),
    punctuation: TaskPunctuationSchema.optional(),
    space: z.string().optional(),
    durationMs: z.number().optional(),
    args: z.array(z.string()).optional(),
    type: z.string().optional(),
    result: z.string().optional(),
    /** Derivation provenance: which NAL rule produced this node, and what it cost. */
    rule: z.string().optional(),
    cpuMs: z.number().optional(),
    lmCalls: z.number().optional(),
    lmTokens: z.number().optional(),
});
export const GraphNodeData = GraphNodeDataView;
export const Lens = z.string();
