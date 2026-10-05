/**
 * Governance schemas — autonomy level, self-modification proposals, risk, and
 * the decision vocabulary the governance runner records.
 *
 * Sits below the event log because `autonomy.mode.changed` and
 * `self-mod.proposal` are two of the events it admits: the mode is a property
 * of a decision, and a patch is something a decision can be about.
 */
import { type CapabilityRisk, CapabilityRiskSchema } from '@senars/util';
import { z } from 'zod';

export const AutonomyModeSchema = z.enum([
  'observe-only',
  'propose-only',
  'sandbox-execute',
  'low-risk-auto-merge',
  'human-approved-production',
]);
export type AutonomyMode = z.infer<typeof AutonomyModeSchema>;

/**
 * Who may move the autonomy mode. The action gate's port spelled this union out
 * inline and the gate spelled it out again, so a fourth authority — an external
 * approver, say — had to be added in both places to be accepted in both. The
 * table *is* the union: the zod form is what the durable event validates
 * against, and the type is read off it, so an authority cannot be admitted by
 * one and rejected by the other.
 */
export const AUTONOMITY_AUTHORITIES = ['system', 'human', 'external-governance'] as const;

export const AutonomyAuthoritySchema = z.enum(AUTONOMITY_AUTHORITIES);

export type AutonomyAuthority = (typeof AUTONOMITY_AUTHORITIES)[number];

/**
 * The modes that may not execute. Four readers asked this of the enum by hand —
 * the action gate on a scope and on the global mode, and the proposal router on
 * its own route — and the four copies had room to disagree about which modes
 * count, which is the one question a mode exists to answer.
 */
const NON_EXECUTING_MODES: ReadonlySet<AutonomyMode> = new Set<AutonomyMode>([
  'observe-only',
  'propose-only',
]);

export const permitsExecution = (mode: AutonomyMode): boolean => !NON_EXECUTING_MODES.has(mode);

/**
 * The governance record's spelling of each risk tier.
 *
 * A patch, a risk assessment and a governance decision record their tier in caps
 * while a self-improvement proposal records it in lower case, so the same three
 * tiers had two vocabularies and a hand-written ternary to cross between them.
 * `satisfies Record<CapabilityRisk, ...>` is what makes them one: a tier added to
 * `CAPABILITY_RISKS` fails to typecheck here until its caps spelling is declared,
 * so the two can never name different tiers and {@link riskLevelOf} stays total.
 */
const RISK_LEVEL_BY_CAPABILITY_RISK = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
} as const satisfies Record<CapabilityRisk, string>;

export const RISK_LEVELS = Object.values(RISK_LEVEL_BY_CAPABILITY_RISK);

export const RiskLevelSchema = z.enum(RISK_LEVELS);
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** The caps spelling of a risk tier — the only conversion between the two vocabularies. */
export const riskLevelOf = (risk: CapabilityRisk): RiskLevel => RISK_LEVEL_BY_CAPABILITY_RISK[risk];

export const GameDomainSchema = z.enum(['external', 'self']);
export type GameDomain = z.infer<typeof GameDomainSchema>;

export const RewardDomainSchema = z.enum([
  'external-reflex',
  'self-scheduler',
  'self-config-proposal',
  'self-patch-score',
  'self-explanation-rank',
]);
export type RewardDomain = z.infer<typeof RewardDomainSchema>;

export const PatchProposalSchema = z.object({
  proposalId: z.string().uuid(),
  patchRef: z.string(),
  baseCommit: z.string(),
  patchDiff: z.string(),
  ciResults: z.object({
    test: z.boolean(),
    typecheck: z.boolean(),
    lint: z.boolean(),
    durationMs: z.number().int().positive(),
  }),
  riskSelfAssessment: RiskLevelSchema,
  affectedComponents: z.array(
    z.enum([
      'approval-logic',
      'sandbox-config',
      'reward-functions',
      'autonomy-mode',
      'kernel-gates',
      'cognitive-params',
      'tools',
      'rules',
      'memory',
      'other',
    ])
  ),
  affectedFiles: z.array(z.string()),
  linesAdded: z.number().int().nonnegative(),
  linesRemoved: z.number().int().nonnegative(),
  coverageDelta: z.number().optional(),
  rationale: z.string(),
  timestamp: z.number().int().positive(),
  agentSignature: z.string(),
  correlationId: z.string().optional(),
});
export type PatchProposal = z.infer<typeof PatchProposalSchema>;

export const SelfImprovementProposalSchema = z.object({
  proposalId: z.string().uuid(),
  kind: z.enum([
    'knob-tune',
    'focus-weight',
    'strategy-switch',
    'schema-promotion',
    'patch-apply',
    'test-generate',
    'schema-evolution',
    'metta-rule-adoption',
  ]),
  riskTier: CapabilityRiskSchema,
  payload: z.record(z.string(), z.unknown()),
  rewardDomain: RewardDomainSchema,
  correlationId: z.string().optional(),
});
export type SelfImprovementProposal = z.infer<typeof SelfImprovementProposalSchema>;

/**
 * What kind of change each proposal kind makes, and therefore what governance it
 * needs: `high` waits for a human, `medium` is held for sandbox validation, `low`
 * may auto-apply. The tiers live with the kinds because the router reads the tier and
 * nothing else — a producer that writes its own tier is choosing its own route, and
 * two of them had: a schema promotion declared `low` where this says `medium`, so it
 * auto-applied a change to the reasoning substrate without the validation the table
 * asks for.
 */
export const PROPOSAL_RISK = {
  'focus-weight': 'low',
  'strategy-switch': 'low',
  'knob-tune': 'medium',
  'schema-promotion': 'medium',
  'test-generate': 'medium',
  'patch-apply': 'high',
  'schema-evolution': 'low',
  'metta-rule-adoption': 'low',
} as const satisfies Record<SelfImprovementProposal['kind'], SelfImprovementProposal['riskTier']>;

/** The tier a proposal of this kind carries. */
export const proposalRisk = (
  kind: SelfImprovementProposal['kind']
): SelfImprovementProposal['riskTier'] => PROPOSAL_RISK[kind];

export const RiskAssessmentSchema = z.object({
  risk: RiskLevelSchema,
  score: z.number().int().nonnegative(),
  factors: z.array(
    z.object({
      factor: z.string(),
      file: z.string().optional(),
      component: z.string().optional(),
      severity: RiskLevelSchema,
    })
  ),
});
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

export const GovernanceDecisionSchema = z.object({
  action: z.enum(['AUTO_MERGE', 'CREATE_PR', 'REQUIRE_HUMAN_REVIEW', 'REJECT']),
  reason: z.string(),
  reviewers: z.number().int().nonnegative().optional(),
});
export type GovernanceDecision = z.infer<typeof GovernanceDecisionSchema>;

export const GovernanceEventSchema = z.object({
  eventId: z.string().uuid(),
  proposalId: z.string().uuid(),
  decision: z.enum(['AUTO_MERGED', 'PR_CREATED', 'HUMAN_REVIEW_REQUIRED', 'REJECTED']),
  riskLevel: RiskLevelSchema,
  autonomyMode: AutonomyModeSchema,
  decidedAt: z.number().int().positive(),
  decidedBy: z.enum(['governance-runner', 'human-reviewer', 'security-team']),
});
export type GovernanceEvent = z.infer<typeof GovernanceEventSchema>;
