import { z } from 'zod';
import type { Capability } from '../capability/Capability.js';

const BaseEventSchema = z.object({
  id: z.string().ulid(),
  type: z.string(),
  timestamp: z.number().int().nonnegative(),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
});

export const CognitiveEventSchema = BaseEventSchema.extend({
  type: z.union([
    z.literal('input.user'),
    z.literal('belief.added'), z.literal('belief.retracted'), z.literal('belief.revised'),
    z.literal('drive.changed'), z.literal('goal.achieved'), z.literal('goal.failed'),
    z.literal('concept.activated'), z.literal('derivation.made'),
    z.literal('atom.derived'), z.literal('atom.retracted'),
    z.literal('skill.executed'), z.literal('query.result'),
    z.literal('tool.request'), z.literal('tool.response'),
    z.literal('config.set'), z.literal('config.delete'), z.literal('config.schema'),
    z.literal('kernel.ready'), z.literal('backend.registered'),
    z.literal('bootstrap'),
  ]),
  payload: z.unknown(),
});

export type CognitiveEvent = z.infer<typeof CognitiveEventSchema>;

const TruthValueSchema = z.object({ frequency: z.number().min(0).max(1), confidence: z.number().min(0).max(1) });

export const PayloadSchemas = {
  'input.user': z.object({ text: z.string().max(10000) }),
  'belief.added': z.object({ term: z.string(), truth: TruthValueSchema }),
  'belief.retracted': z.object({ term: z.string() }),
  'belief.revised': z.object({ term: z.string(), oldTruth: TruthValueSchema, newTruth: TruthValueSchema }),
  'drive.changed': z.object({ drive: z.string(), urgency: z.number().min(0).max(1) }),
  'goal.achieved': z.object({ goal: z.string() }),
  'goal.failed': z.object({ goal: z.string(), reason: z.string() }),
  'concept.activated': z.object({ term: z.string(), priority: z.number().min(0).max(1) }),
  'derivation.made': z.object({ rule: z.string(), premises: z.array(z.string()), conclusion: z.string() }),
  'atom.derived': z.object({ atom: z.string(), space: z.string() }),
  'atom.retracted': z.object({ atom: z.string(), space: z.string() }),
  'skill.executed': z.object({ skill: z.string(), args: z.array(z.string()), result: z.string(), durationMs: z.number() }),
  'query.result': z.object({ pattern: z.string(), results: z.array(z.string()), space: z.string() }),
  'tool.request': z.object({ toolName: z.string(), args: z.record(z.string(), z.unknown()), timeoutMs: z.number().optional() }),
  'tool.response': z.object({ requestId: z.string().uuid(), toolName: z.string(), result: z.unknown().optional(), error: z.string().optional(), durationMs: z.number() }),
  'config.set': z.object({ path: z.string(), value: z.unknown() }),
  'config.delete': z.object({ path: z.string() }),
  'config.schema': z.object({ schema: z.unknown() }),
  'kernel.ready': z.object({ backendIds: z.array(z.string()) }),
  'backend.registered': z.object({ manifest: z.unknown() }),
  'bootstrap': z.object({ beliefs: z.array(z.string()).optional(), atoms: z.array(z.object({ atom: z.string(), space: z.string().optional() })).optional(), skills: z.array(z.object({ name: z.string(), code: z.string() })).optional() }),
} as const;

export function validatePayload(type: string, payload: unknown): void {
  const schema = PayloadSchemas[type as keyof typeof PayloadSchemas];
  if (schema) schema.parse(payload);
}