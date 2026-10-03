/**
 * Cognitive event log schemas — the append-only log is the source of truth for
 * cognitive state, and all state mutations must pass through event admission
 * gates. Every variant below is admitted by exactly one gate.
 */

import { parseOrThrow } from '@senars/util';
import { z } from 'zod';
import { CognitiveEventBaseSchema } from './event-base.js';
import { AutonomyModeSchema, PatchProposalSchema } from './governance.js';
import { NarEventSchemas } from './nar-events.js';
import { TerminationReasonSchema } from './reasoning-budget.js';
import { ProposalAdmittedEventSchema, ProposalRejectedEventSchema } from './proposal.js';
import { TruthValueSchema } from './truth.js';

export { CognitiveEventBaseSchema, EngineOriginSchema } from './event-base.js';

export const TaskAdmittedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('task.admitted'),
  payload: z.object({
    taskId: z.string().uuid(),
    term: z.string(),
    taskType: z.enum(['belief', 'goal', 'question', 'command']),
    truth: TruthValueSchema.optional(),
    source: z.enum(['user', 'llm', 'derivation', 'reflex', 'sensor']),
    budget: z.object({
      priority: z.number().min(0).max(1),
      durability: z.number().min(0).max(1),
      quality: z.number().min(0).max(1),
      cycles: z.number().int().nonnegative(),
      depth: z.number().int().nonnegative(),
    }),
  }),
});

export const DerivationAcceptedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('derivation.accepted'),
  payload: z.object({
    derivationId: z.string().uuid(),
    ruleId: z.string(),
    premises: z.array(z.string()),
    conclusion: z.string(),
    truth: TruthValueSchema,
    evidenceLineage: z.array(z.string().uuid()),
    independenceCheck: z.enum(['independent', 'dependent', 'unknown']),
  }),
});

export const BeliefRevisedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('belief.revised'),
  payload: z.object({
    term: z.string(),
    oldTruth: TruthValueSchema,
    newTruth: TruthValueSchema,
    /** Absent on the nar family's revision events: the engine records the rule, not the log. */
    evidenceLineage: z.array(z.string().uuid()).optional(),
    revisionRule: z.string().optional(),
  }),
});

export const ConceptActivatedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('concept.activated'),
  payload: z.object({
    term: z.string(),
    priority: z.number(),
    /** Which subsystem woke the concept. Absent on `engine: 'nar'` events, which are minted by the bridge from a term's creation. */
    activationSource: z.enum(['perception', 'goal', 'derivation', 'decay', 'associative']).optional(),
  }),
});

export const BudgetExhaustedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('budget.exhausted'),
  payload: z.object({
    budgetType: z.enum(['cycles', 'depth', 'memory', 'llm', 'wallclock']),
    remaining: z.number(),
    limit: z.number(),
    terminationReason: TerminationReasonSchema,
  }),
});

export const PolicyViolationEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('policy.violation'),
  payload: z.object({
    policyId: z.string(),
    violationType: z.enum([
      'unauthorized-tool',
      'budget-exceeded',
      'epistemic-firewall',
      'sandbox-escape',
      'self-mod-unauthorized',
    ]),
    detail: z.string(),
    severity: z.enum(['warn', 'block', 'quarantine']),
  }),
});

export const AutonomyModeChangedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('autonomy.mode.changed'),
  payload: z.object({
    previousMode: AutonomyModeSchema,
    newMode: AutonomyModeSchema,
    authorizedBy: z.enum(['system', 'human', 'external-governance']),
  }),
});

export const SelfModProposalEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('self-mod.proposal'),
  payload: PatchProposalSchema,
});

export const JudgmentResolvedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('judgment.resolved'),
  payload: z.object({
    queryId: z.string(),
    shape: z.enum(['classify', 'evaluate']),
    axis: z.enum(['epistemic', 'teleological']),
    backendId: z.string(),
    tier: z.number().int().min(0).max(3),
    latencyMs: z.number().int().nonnegative(),
    entropy: z.number().optional(),
    abstained: z.boolean(),
    stampType: z.enum(['standard', 'provisional']),
    calibrationVersion: z.string(),
    /** H5/X18: encoder identity digest bound to the head that produced this proposition. */
    encoderDigest: z.string().optional(),
    /** TODO23: judgment provenance (model/calibration/input digests + router band). */
    modelDigest: z.string().optional(),
    calibrationDigest: z.string().optional(),
    inputDigest: z.string().optional(),
    decisionBand: z.enum(['act', 'review', 'block', 'abstain']).optional(),
    cost: z.object({
      tokensIn: z.number().int().nonnegative(),
      tokensOut: z.number().int().nonnegative(),
      computeMs: z.number().int().nonnegative(),
      memoryMb: z.number().nonnegative(),
    }),
  }),
});
export type JudgmentResolvedEvent = z.infer<typeof JudgmentResolvedEventSchema>;

export const EgressGateRejectedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('egress.gate.rejected'),
  payload: z.object({
    gate: z.enum(['groundedness', 'risk']),
    score: z.number().min(0).max(1).optional(),
    detail: z.string().optional(),
  }),
});

export const ShadowValidationDropEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('shadow.validation.dropped'),
  payload: z.object({
    candidateTerm: z.string(),
    source: z.enum(['llm', 'bridge-llm']),
    conflictType: z.enum(['frequency', 'semantic']),
    frequencyDelta: z.number().optional(),
    semanticScore: z.number().optional(),
  }),
});

/**
 * Every event the log admits: the kernel's own families, the two the proposal
 * seam may append as an origin of `proposer`, and the `engine: 'nar'` family the
 * NAR event bridge mints. One union and one validator — an event the repo can
 * emit is an event the schema admits, and `engine` remains the provenance
 * discriminant that makes "the seam proposes, the kernel admits" checkable.
 */
export const CognitiveEventSchema = z.discriminatedUnion('type', [
  TaskAdmittedEventSchema,
  DerivationAcceptedEventSchema,
  BeliefRevisedEventSchema,
  ConceptActivatedEventSchema,
  BudgetExhaustedEventSchema,
  PolicyViolationEventSchema,
  AutonomyModeChangedEventSchema,
  SelfModProposalEventSchema,
  JudgmentResolvedEventSchema,
  EgressGateRejectedEventSchema,
  ShadowValidationDropEventSchema,
  ProposalAdmittedEventSchema,
  ProposalRejectedEventSchema,
  ...NarEventSchemas,
]);

export type CognitiveEvent = z.infer<typeof CognitiveEventSchema>;
export type EgressGateRejectedEvent = z.infer<typeof EgressGateRejectedEventSchema>;
export type ShadowValidationDropEvent = z.infer<typeof ShadowValidationDropEventSchema>;
export type TaskAdmittedEvent = z.infer<typeof TaskAdmittedEventSchema>;
export type DerivationAcceptedEvent = z.infer<typeof DerivationAcceptedEventSchema>;
export type BeliefRevisedEvent = z.infer<typeof BeliefRevisedEventSchema>;
export type ConceptActivatedEvent = z.infer<typeof ConceptActivatedEventSchema>;
export type BudgetExhaustedEvent = z.infer<typeof BudgetExhaustedEventSchema>;
export type PolicyViolationEvent = z.infer<typeof PolicyViolationEventSchema>;
export type AutonomyModeChangedEvent = z.infer<typeof AutonomyModeChangedEventSchema>;
export type SelfModProposalEvent = z.infer<typeof SelfModProposalEventSchema>;

export const validateCognitiveEvent = (event: unknown): CognitiveEvent =>
  parseOrThrow(CognitiveEventSchema, 'CognitiveEvent', event);

export const isNarEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { engine: 'nar' }> =>
  e.engine === 'nar';

export const isEventType =
  <T extends CognitiveEvent['type']>(type: T) =>
  (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: T }> =>
    e.type === type;
