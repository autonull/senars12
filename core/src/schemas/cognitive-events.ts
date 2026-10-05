/**
 * Cognitive event log schemas — the append-only log is the source of truth for
 * cognitive state, and all state mutations must pass through event admission
 * gates. Every variant below is admitted by exactly one gate.
 */

import {
  BandDecisionSchema,
  CognitiveAxisSchema,
  JudgmentShapeSchema,
  generateId,
  parseOrThrow,
} from '@senars/util';
import { z } from 'zod';
import { BudgetSchema, IndependenceSchema } from './common.js';
import { CognitiveEventBaseSchema } from './event-base.js';
import { AutonomyAuthoritySchema, AutonomyModeSchema, PatchProposalSchema } from './governance.js';
import { NarEventSchemas } from './nar-events.js';
import { ProposalAdmittedEventSchema, ProposalRejectedEventSchema } from './proposal.js';
import { BudgetTypeSchema, TerminationReasonSchema } from './reasoning-budget.js';
import { TaskTypeSchema } from './task.js';
import { TruthValueSchema } from './truth.js';

export { CognitiveEventBaseSchema, EngineOriginSchema } from './event-base.js';

/**
 * Where an admitted claim came from. Named rather than inlined because the
 * gate's input declares the same provenance and hands it straight through — a
 * spelling the gate accepts but the event cannot record would otherwise be
 * expressible, and `mapSource`'s fallbacks are written against these five.
 */
export const STIMULUS_SOURCES = ['user', 'llm', 'derivation', 'reflex', 'sensor'] as const;

export const StimulusSourceSchema = z.enum(STIMULUS_SOURCES);

export type StimulusSource = (typeof STIMULUS_SOURCES)[number];

export const TaskAdmittedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('task.admitted'),
  payload: z.object({
    taskId: z.string().uuid(),
    term: z.string(),
    taskType: TaskTypeSchema,
    truth: TruthValueSchema.optional(),
    source: StimulusSourceSchema,
    budget: BudgetSchema,
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
    independenceCheck: IndependenceSchema,
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
    activationSource: z
      .enum(['perception', 'goal', 'derivation', 'decay', 'associative'])
      .optional(),
  }),
});

export const BudgetExhaustedEventSchema = CognitiveEventBaseSchema.extend({
  type: z.literal('budget.exhausted'),
  payload: z.object({
    budgetType: BudgetTypeSchema,
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
    authorizedBy: AutonomyAuthoritySchema,
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
    shape: JudgmentShapeSchema,
    axis: CognitiveAxisSchema,
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
    decisionBand: BandDecisionSchema.optional(),
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

export type CognitiveEventOf<T extends CognitiveEvent['type']> = Extract<
  CognitiveEvent,
  { type: T }
>;

/**
 * What a minting site supplies: the event's own fields minus the ones every
 * event gets anyway, which are stamped here rather than at each call site.
 */
type Mintable<T extends CognitiveEvent['type']> = Omit<
  CognitiveEventOf<T>,
  'type' | 'engine' | 'timestamp' | 'correlationId' | 'causationId'
> & {
  engine: CognitiveEvent['engine'];
  timestamp?: number;
  correlationId?: string;
  causationId?: string;
};

/**
 * Construct an event from the schema, not from a hand-written literal.
 *
 * `T` is inferred from `type`, so the payload is checked at compile time against
 * the same variant {@link CognitiveEventSchema} parses — a site that would emit
 * an event the log rejects is a type error rather than a throw at append time.
 * Stamping the timestamp and correlation id here is what makes "every event is
 * stamped and joinable" an invariant of the constructor instead of a convention
 * nine call sites happened to follow.
 *
 * `engine` stays explicit: it is the provenance discriminant, and the type is
 * what makes "the seam proposes; the kernel admits" checkable.
 */
export const mintCognitiveEvent = <T extends CognitiveEvent['type']>(
  type: T,
  draft: Mintable<T>
): CognitiveEventOf<T> => ({
  ...draft,
  type,
  timestamp: draft.timestamp ?? Date.now(),
  correlationId: draft.correlationId ?? generateId('corr'),
} as CognitiveEventOf<T>);

export const validateCognitiveEvent = (event: unknown): CognitiveEvent =>
  parseOrThrow(CognitiveEventSchema, 'CognitiveEvent', event);

export const isNarEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { engine: 'nar' }> =>
  e.engine === 'nar';

export const isEventType =
  <T extends CognitiveEvent['type']>(type: T) =>
  (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: T }> =>
    e.type === type;
