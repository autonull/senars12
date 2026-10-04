/**
 * Gate I/O schemas — the contracts for PerceptionGate, ActionGate, RewardGate
 * and BudgetGate. Each gate admits exactly one event variant, so this is the
 * only place the four input/output pairs sit beside one another.
 */
import { z } from 'zod';
import { TaskAdmittedEventSchema } from './cognitive-events.js';
import { RewardDomainSchema } from './governance.js';
import {
  BUDGET_SCOPE_IDS,
  ReasoningBudgetSchema,
  TerminationReasonSchema,
} from './reasoning-budget.js';
import { SourceQualitySchema } from './truth.js';

export const PerceptionGateInputSchema = z.object({
  sourceId: z.string(),
  /** A4a/X29: explicit provenance; falls back to sourceId heuristics when omitted. */
  source: z.enum(['user', 'llm', 'derivation', 'reflex', 'sensor']).optional(),
  rawObservation: z.unknown(),
  sensorConfidence: z.number().min(0).max(1),
  sourceQuality: SourceQualitySchema,
  correlationId: z.string().optional(),
});

export const PerceptionGateOutputSchema = z.object({
  admitted: z.boolean(),
  task: TaskAdmittedEventSchema.shape.payload.optional(),
  rejectionReason: z.string().optional(),
});

export const ActionGateInputSchema = z.object({
  proposalId: z.string().uuid(),
  operation: z.string(),
  args: z.record(z.string(), z.unknown()),
  proposerReflexId: z.string().optional(),
  nalDerivationId: z.string().uuid().optional(),
  correlationId: z.string().optional(),
});

export const ActionGateOutputSchema = z.object({
  authorized: z.boolean(),
  toolCallId: z.string().uuid().optional(),
  vetoReason: z.string().optional(), // If NAL derivation vetoes
  requiredApprovals: z.array(z.string()).optional(),
});

export const RewardGateInputSchema = z.object({
  eventId: z.string().uuid(),
  rewardSignal: z.number().min(-1).max(1),
  rewardType: z.enum([
    'extrinsic',
    'intrinsic',
    'derivation-depth-reduction',
    'self-model-accuracy',
    'contradiction-reduction',
  ]),
  targetType: z.enum([
    'attention-priority',
    'policy-weights',
    'truth-frequency',
    'truth-confidence',
  ]),
  targetId: z.string(),
  domain: RewardDomainSchema.optional(),
  correlationId: z.string().optional(),
});

export const RewardGateOutputSchema = z.object({
  accepted: z.boolean(),
  mutationApplied: z.boolean().optional(),
  epistemicFirewallViolation: z.boolean().optional(),
  rejectionReason: z.string().optional(),
  requiresProposal: z.boolean().optional(),
});

/** Every operation the budget gate accounts. The five A7 control scopes are the
 *  named ones (TODO29.a §5.7); `BUDGET_SCOPES` says which dimension each spends. */
export const BudgetOperationSchema = z.enum([
  'nal-step',
  'lm-call',
  'memory-op',
  'derivation-depth',
  'systemone-judgment',
  'derivation',
  'premise-selection',
  'candidate-derivation',
  'proposal-application',
  'control-work',
  'decision-derivation',
]);

/** The operation vocabulary as a value, for the readers that must enumerate it.
 *  A gate that has to check an operation against this list used to scrape the
 *  enum's source text, which over-captured whatever followed the enum and made
 *  the check weaker than it read. */
export const BUDGET_OPERATIONS: readonly BudgetOperation[] = BudgetOperationSchema.options;

export const BudgetGateInputSchema = z.object({
  budget: ReasoningBudgetSchema.optional(),
  operation: BudgetOperationSchema,
  estimatedCost: z.number().int().positive().optional(),
  scopeId: z.union([z.enum(BUDGET_SCOPE_IDS), z.string()]).optional(),
  correlationId: z.string().optional(),
});

export const BudgetGateOutputSchema = z.object({
  granted: z.boolean(),
  updatedBudget: ReasoningBudgetSchema.optional(),
  terminationReason: TerminationReasonSchema.optional(),
});

/**
 * The four kernel gates, named once. `recordGateDecision` keys every gate's
 * telemetry by it and `GateError` reports it, so a fifth gate is a new member
 * here rather than another hand-written copy of the same union.
 */
export type GateName = 'perception' | 'action' | 'reward' | 'budget';

/**
 * The one gate decision: a grant, and why not when refused.
 *
 * Each gate's *output* keeps the grant and reason names of its own domain —
 * `admitted`/`rejectionReason`, `authorized`/`vetoReason`, `granted`/`terminationReason` —
 * because those are wire contracts and event payloads. This is the vocabulary
 * everything downstream of a gate reads: telemetry, the veto counters, and the
 * decision span. A gate declares its projection once, so a refusal can never be
 * reported under a different rule than the one its own output states.
 */
export interface GateOutcome {
  granted: boolean;
  /** Refusal reason; undefined when granted. */
  reason?: string;
}

export type PerceptionGateInput = z.infer<typeof PerceptionGateInputSchema>;
export type PerceptionGateOutput = z.infer<typeof PerceptionGateOutputSchema>;
export type ActionGateInput = z.infer<typeof ActionGateInputSchema>;
export type ActionGateOutput = z.infer<typeof ActionGateOutputSchema>;
export type RewardGateInput = z.infer<typeof RewardGateInputSchema>;
export type RewardGateOutput = z.infer<typeof RewardGateOutputSchema>;
export type BudgetOperation = z.infer<typeof BudgetOperationSchema>;
export type BudgetGateInput = z.infer<typeof BudgetGateInputSchema>;
export type BudgetGateOutput = z.infer<typeof BudgetGateOutputSchema>;
