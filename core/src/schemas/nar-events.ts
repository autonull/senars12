/**
 * The `engine: 'nar'` family — every event the NAR's own event bridge mints.
 *
 * These are the variants `util/src/types/cognitive.ts` used to declare by hand,
 * with no runtime validator behind them, which is why the union that *did* have
 * one rejected all of them. One union, one validator: these schemas sit in the
 * discriminated union in `cognitive-events.ts` alongside the kernel's.
 */

import { z } from 'zod';
import { CognitiveEventBaseSchema } from './event-base.js';
import { TruthValueSchema } from './truth.js';

/** Nar events are the `engine: 'nar'` discriminant `isNarEvent` narrows on. */
const NarBase = CognitiveEventBaseSchema.extend({ engine: z.literal('nar') });

export const InputUserEventSchema = NarBase.extend({
  type: z.literal('input.user'),
  payload: z.object({ text: z.string(), source: z.string() }),
});

export const DerivationMadeEventSchema = NarBase.extend({
  type: z.literal('derivation.made'),
  payload: z.object({
    rule: z.string(),
    premises: z.array(z.string()),
    conclusion: z.string(),
    cpuMs: z.number().optional(),
    lmCalls: z.number().optional(),
    lmTokens: z.number().optional(),
  }),
});

export const AtomDerivedEventSchema = NarBase.extend({
  type: z.literal('atom.derived'),
  payload: z.object({ atom: z.string(), space: z.string() }),
});

export const AtomRetractedEventSchema = NarBase.extend({
  type: z.literal('atom.retracted'),
  payload: z.object({ atom: z.string(), space: z.string() }),
});

export const BeliefAddedEventSchema = NarBase.extend({
  type: z.literal('belief.added'),
  payload: z.object({ term: z.string(), truth: TruthValueSchema }),
});

export const BeliefRetractedEventSchema = NarBase.extend({
  type: z.literal('belief.retracted'),
  payload: z.object({ term: z.string() }),
});

export const DriveChangedEventSchema = NarBase.extend({
  type: z.literal('drive.changed'),
  payload: z.object({ drive: z.string(), urgency: z.number() }),
});

export const GoalAchievedEventSchema = NarBase.extend({
  type: z.literal('goal.achieved'),
  payload: z.object({ goal: z.string() }),
});

export const GoalFailedEventSchema = NarBase.extend({
  type: z.literal('goal.failed'),
  payload: z.object({ goal: z.string(), reason: z.string() }),
});

export const SkillExecutedEventSchema = NarBase.extend({
  type: z.literal('skill.executed'),
  payload: z.object({
    skill: z.string(),
    args: z.array(z.string()),
    result: z.string(),
    durationMs: z.number(),
  }),
});

export const ToolRequestEventSchema = NarBase.extend({
  type: z.literal('tool.request'),
  payload: z.object({
    toolName: z.string(),
    args: z.record(z.string(), z.unknown()),
    timeoutMs: z.number().optional(),
  }),
});

export const ToolResponseEventSchema = NarBase.extend({
  type: z.literal('tool.response'),
  payload: z.object({
    requestId: z.string(),
    toolName: z.string(),
    result: z.unknown().optional(),
    error: z.string().optional(),
    durationMs: z.number(),
  }),
});

const ConfigBase = {
  payload: z.object({ path: z.string() }),
};

export const ConfigSetEventSchema = NarBase.extend({
  type: z.literal('config.set'),
  payload: z.object({ path: z.string(), value: z.unknown() }),
});

export const ConfigDeleteEventSchema = NarBase.extend({
  type: z.literal('config.delete'),
  ...ConfigBase,
});

export const ConfigSchemaEventSchema = NarBase.extend({
  type: z.literal('config.schema'),
  payload: z.object({ schema: z.unknown() }),
});

export const KernelReadyEventSchema = NarBase.extend({
  type: z.literal('kernel.ready'),
  payload: z.object({ backendIds: z.array(z.string()) }),
});

export const BackendRegisteredEventSchema = NarBase.extend({
  type: z.literal('backend.registered'),
  payload: z.object({ manifest: z.unknown() }),
});

export const BootstrapEventSchema = NarBase.extend({
  type: z.literal('bootstrap'),
  payload: z.object({
    beliefs: z.array(z.string()).optional(),
    atoms: z.array(z.object({ atom: z.string(), space: z.string().optional() })).optional(),
    skills: z.array(z.object({ name: z.string(), code: z.string() })).optional(),
  }),
});

export const CycleEventSchema = NarBase.extend({
  type: z.literal('cycle'),
  cycle: z.number(),
  derived: z.number(),
  payload: z.object({ cycle: z.number(), derived: z.number() }),
});

export const HealthEventSchema = NarBase.extend({
  type: z.literal('health'),
  payload: z.object({ status: z.string(), cycleCount: z.number(), errorRate: z.number() }),
});

export const ConflictDetectedEventSchema = NarBase.extend({
  type: z.literal('conflict:detected'),
  payload: z.object({ term: z.string(), conflictWith: z.string() }),
});

export const NarEventSchemas = [
  InputUserEventSchema,
  DerivationMadeEventSchema,
  AtomDerivedEventSchema,
  AtomRetractedEventSchema,
  BeliefAddedEventSchema,
  BeliefRetractedEventSchema,
  DriveChangedEventSchema,
  GoalAchievedEventSchema,
  GoalFailedEventSchema,
  SkillExecutedEventSchema,
  ToolRequestEventSchema,
  ToolResponseEventSchema,
  ConfigSetEventSchema,
  ConfigDeleteEventSchema,
  ConfigSchemaEventSchema,
  KernelReadyEventSchema,
  BackendRegisteredEventSchema,
  BootstrapEventSchema,
  CycleEventSchema,
  HealthEventSchema,
  ConflictDetectedEventSchema,
] as const;
