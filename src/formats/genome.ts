/**
 * Schema Genome — the single source of truth for all contracts.
 *
 * This file defines every schema as data (not code), then generates:
 * 1. TypeScript types + Zod validators (src/generated/schemas.ts)
 * 2. JSON Schema for MCP surface (src/generated/json-schema/)
 *
 * The genome is the only place a schema is declared. Generated output is
 * never hand-edited; `schema:drift` verifies freshness.
 */

import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'generated');
const JSON_SCHEMA_DIR = join(OUT_DIR, 'json-schema');

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(JSON_SCHEMA_DIR, { recursive: true });

// ============================================================================
// SINGLE SOURCE OF TRUTH — ALL DEFINITIONS HERE
// ============================================================================

const Defs = {
  // Enums (values only, types derived)
  enums: {
    TASK_TYPES: ['belief', 'goal', 'question', 'command'] as const,
    TASK_BAG_KINDS: ['belief', 'goal', 'question'] as const,
    TASK_PUNCTUATIONS: ['.', '!', '?', ';'] as const,
    TOLERANT_PUNCTUATIONS: ['', '.', '!', '?'] as const,
    SOURCE_QUALITY: [
      'PRIMARY',
      'SECONDARY',
      'GENERAL',
      'TERTIARY',
      'LLM_PRIOR',
      'PEER_AGENT',
      'SELF_METTA',
    ] as const,
    AMBIGUITY_TYPES: [
      'parse',
      'intent',
      'term',
      'reference',
      'quantifier',
      'modal',
      'temporal',
      'negation',
    ] as const,
    AMBIGUITY_SEVERITIES: ['low', 'medium', 'high'] as const,
    DETECTED_INTENTS: ['chat', 'command', 'reasoning', 'learning'] as const,
    STIMULUS_SOURCES: ['user', 'llm', 'derivation', 'reflex', 'sensor'] as const,
    AUTONOMY_MODES: [
      'observe-only',
      'propose-only',
      'sandbox-execute',
      'low-risk-auto-merge',
      'human-approved-production',
    ] as const,
    AUTONOMITY_AUTHORITIES: ['system', 'human', 'external-governance'] as const,
    RISK_LEVELS: ['LOW', 'MEDIUM', 'HIGH'] as const,
    CAPABILITY_RISKS: ['low', 'medium', 'high'] as const,
    GAME_DOMAINS: ['external', 'self'] as const,
    REWARD_DOMAINS: [
      'external-reflex',
      'self-scheduler',
      'self-config-proposal',
      'self-patch-score',
      'self-explanation-rank',
    ] as const,
    RULE_CATEGORIES: [
      'core',
      'logic',
      'propositional',
      'higher-order',
      'comparison',
      'classical',
      'structural',
      'temporal',
      'procedural',
      'meta-cognitive',
      'variable',
    ] as const,
    RULE_PROVENANCE_KINDS: ['builtin', 'proposal', 'import'] as const,
    ENGINE_ORIGINS: ['nar', 'proposer', 'metta'] as const,
    PROPOSAL_KINDS: ['content', 'rule'] as const,
    PROPOSAL_REJECTIONS: [
      'schema-version',
      'stale-revision',
      'evicted-reference',
      'queue-overflow',
      'cancelled',
      'failed-schema',
    ] as const,
    BUDGET_SCOPE_IDS: [
      'derivations',
      'premises',
      'candidate-derivations',
      'proposal-application',
      'control-work',
      'decision-derivations',
    ] as const,
    BUDGET_TYPES: ['cycles', 'depth', 'memory', 'llm'] as const,
    TERMINATION_REASONS: [
      'cycle-budget',
      'depth-budget',
      'memory-budget',
      'llm-budget',
      'deadline',
      'backpressure',
      'aborted',
      'completed',
    ] as const,
    BUDGET_OPERATIONS: [
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
    ] as const,
    GATE_NAMES: ['perception', 'action', 'reward', 'budget'] as const,
    REWARD_TYPES: [
      'extrinsic',
      'intrinsic',
      'derivation-depth-reduction',
      'self-model-accuracy',
      'contradiction-reduction',
    ] as const,
    REWARD_TARGET_TYPES: [
      'attention-priority',
      'policy-weights',
      'truth-frequency',
      'truth-confidence',
    ] as const,
    VIOLATION_TYPES: [
      'unauthorized-tool',
      'budget-exceeded',
      'epistemic-firewall',
      'sandbox-escape',
      'self-mod-unauthorized',
    ] as const,
    SEVERITY_LEVELS: ['warn', 'block', 'quarantine'] as const,
    SELF_IMPROVEMENT_KINDS: [
      'knob-tune',
      'focus-weight',
      'strategy-switch',
      'schema-promotion',
      'patch-apply',
      'test-generate',
      'schema-evolution',
      'metta-rule-adoption',
    ] as const,
    GOVERNANCE_ACTIONS: ['AUTO_MERGE', 'CREATE_PR', 'REQUIRE_HUMAN_REVIEW', 'REJECT'] as const,
    GOVERNANCE_DECISIONS: ['AUTO_MERGED', 'PR_CREATED', 'HUMAN_REVIEW_REQUIRED', 'REJECTED'] as const,
    GOVERNANCE_DECIDED_BY: ['governance-runner', 'human-reviewer', 'security-team'] as const,
    ACTIVATION_SOURCES: [
      'perception',
      'goal',
      'derivation',
      'decay',
      'associative',
    ] as const,
    KERNEL_CONTROL_STATES: ['running', 'paused', 'stepping'] as const,
    CONFLICT_TYPES: ['frequency', 'semantic'] as const,
    HEALTH_STATUSES: ['healthy', 'degraded', 'unhealthy'] as const,
    SHADOW_SOURCES: ['llm', 'bridge-llm'] as const,
    STAMP_TYPES: ['standard', 'provisional'] as const,
    EGRESS_GATES: ['groundedness', 'risk'] as const,
  },

  // Derived constants (objects, maps) - these are NOT enums, declared once
  constants: {
    TASK_PUNCTUATION: {
      belief: '.',
      goal: '!',
      question: '?',
      command: ';',
    } as const,
    SOURCE_QUALITY_CONFIDENCE: {
      PRIMARY: 0.9,
      SECONDARY: 0.7,
      GENERAL: 0.55,
      TERTIARY: 0.4,
      LLM_PRIOR: 0.5,
      PEER_AGENT: 0.6,
      SELF_METTA: 0.7,
    } as const,
    AMBIGUITY_SEVERITY: {
      parse: 'high',
      intent: 'high',
      term: 'medium',
      reference: 'low',
      quantifier: 'medium',
      modal: 'medium',
      temporal: 'low',
      negation: 'high',
    } as const,
    RISK_LEVEL_BY_CAPABILITY_RISK: {
      low: 'LOW',
      medium: 'MEDIUM',
      high: 'HIGH',
    } as const,
    BUDGET_TYPES_MAP: {
      cycles: 'cycles',
      depth: 'depth',
      memoryOps: 'memory',
      llmCalls: 'llm',
    } as const,
    PROPOSAL_RISK: {
      'focus-weight': 'low',
      'strategy-switch': 'low',
      'knob-tune': 'medium',
      'schema-promotion': 'medium',
      'test-generate': 'medium',
      'patch-apply': 'high',
      'schema-evolution': 'low',
      'metta-rule-adoption': 'low',
    } as const,
    NON_EXECUTING_MODES: ['observe-only', 'propose-only'] as const,
    BUILTIN_RULE_ARTIFACT_VERSION: 'builtin/1',
    RULE_TABLE_SCHEMA_VERSION: 1,
    PROPOSAL_SCHEMA_VERSION: 2,
  },

  // Primitive validators
  primitives: {
    uuid: 'z.string().uuid()',
    nonEmpty: 'z.string().min(1)',
    nonNegativeInt: 'z.number().int().nonnegative()',
    positiveInt: 'z.number().int().positive()',
    unitInterval: 'z.number().min(0).max(1)',
    signedUnitInterval: 'z.number().min(-1).max(1)',
    timestamp: 'z.number().int().positive()',
  },
} as const;

// ============================================================================
// CODE GENERATION
// ============================================================================

function generate(): string {
  const lines: string[] = [];

  lines.push('// Generated by src/formats/genome.ts — DO NOT EDIT');
  lines.push('// Run: tsx src/formats/genome.ts');
  lines.push('');
  lines.push("import { z } from 'zod';");
  lines.push("import { generateId } from '@senars/util';");
  lines.push('');

  // ============================================================================
  // PRIMITIVES
  // ============================================================================
  lines.push('// ============================================================================');
  lines.push('// PRIMITIVES');
  lines.push('// ============================================================================');
  lines.push('');
  for (const [name, code] of Object.entries(Defs.primitives)) {
    lines.push(`export const ${name} = () => ${code};`);
  }
  lines.push('');

  // ============================================================================
  // ENUMS — declare once, use everywhere
  // ============================================================================
  lines.push('// ============================================================================');
  lines.push('// ENUMS');
  lines.push('// ============================================================================');
  lines.push('');
  for (const [name, values] of Object.entries(Defs.enums)) {
    const typeName = name.replace(/S$/, '').replace(/_/g, '_');
    // Special case: AMBIGUITY_SEVERITIES -> AMBIGUITY_SEVERITY (not AMBIGUITY_SEVERITIE)
    const finalTypeName = name === 'AMBIGUITY_SEVERITIES' ? 'AMBIGUITY_SEVERITY' : typeName;
    lines.push(`export const ${name} = ${JSON.stringify(values, null, 2)} as const;`);
    lines.push(`export type ${finalTypeName} = (typeof ${name})[number];`);
    lines.push('');
  }

  // ============================================================================
  // CONSTANTS
  // ============================================================================
  lines.push('// ============================================================================');
  lines.push('// CONSTANTS');
  lines.push('// ============================================================================');
  lines.push('');
  for (const [name, value] of Object.entries(Defs.constants)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`export const ${name} = ${JSON.stringify(value, null, 2)} as const;`);
    } else {
      lines.push(`export const ${name} = ${JSON.stringify(value)} as const;`);
    }
    lines.push('');
  }

  // ============================================================================
  // ZOD SCHEMAS — in dependency order
  // ============================================================================
  lines.push('// ============================================================================');
  lines.push('// ZOD SCHEMAS');
  lines.push('// ============================================================================');
  lines.push('');

  // --- Basic schemas (no dependencies) ---
  lines.push('/** The 0..1 truth pair every event payload, derivation record, and formalization candidate carries. */');
  lines.push('export const TruthValueSchema = z.object({');
  lines.push('  frequency: unitInterval(),');
  lines.push('  confidence: unitInterval(),');
  lines.push('});');
  lines.push('export type TruthValue = z.infer<typeof TruthValueSchema>;');
  lines.push('');

  lines.push('/** Where a claim came from. Provenance is what bounds its confidence. */');
  lines.push('export const SourceQualitySchema = z.enum(SOURCE_QUALITY);');
  lines.push('export type SourceQuality = z.infer<typeof SourceQualitySchema>;');
  lines.push('');

  lines.push("/** A source's track record, as the one thing it is allowed to do to a ceiling: lower it. */");
  lines.push('export interface CeilingReputation {');
  lines.push('  effectiveCeiling(base: number, key: string): number;');
  lines.push('}');
  lines.push('');
  lines.push('export interface CeilingLimits {');
  lines.push('  reputation?: CeilingReputation;');
  lines.push('  sourceKey?: string;');
  lines.push('  atMost?: number;');
  lines.push('  scaledBy?: number;');
  lines.push('}');
  lines.push('');
  lines.push('export const confidenceCeiling = (quality: SourceQuality, limits: CeilingLimits = {}): number => {');
  lines.push('  const base = SOURCE_QUALITY_CONFIDENCE[quality];');
  lines.push('  const rated = limits.reputation && limits.sourceKey ? limits.reputation.effectiveCeiling(base, limits.sourceKey) : base;');
  lines.push('  const bounded = limits.atMost === undefined ? rated : Math.min(limits.atMost, rated);');
  lines.push('  return Math.min(1, Math.max(0, limits.scaledBy === undefined ? bounded : bounded * limits.scaledBy));');
  lines.push('};');
  lines.push('');

  // --- Common ---
  lines.push('export const RulePatternSideSchema = z.object({ op: nonEmpty() });');
  lines.push('export type RulePatternSide = z.infer<typeof RulePatternSideSchema>;');
  lines.push('');
  lines.push('export const RulePatternSchema = z.object({');
  lines.push('  left: RulePatternSideSchema,');
  lines.push('  right: RulePatternSideSchema,');
  lines.push('});');
  lines.push('export type RulePattern = z.infer<typeof RulePatternSchema>;');
  lines.push('');
  lines.push('export const BudgetSchema = z.object({');
  lines.push('  priority: unitInterval(),');
  lines.push('  durability: unitInterval(),');
  lines.push('  quality: unitInterval(),');
  lines.push('  cycles: nonNegativeInt(),');
  lines.push('  depth: nonNegativeInt(),');
  lines.push('});');
  lines.push('export type Budget = z.infer<typeof BudgetSchema>;');
  lines.push('');

  lines.push('/** One turn of conversation history. Re-exported from @senars/util. */');
  lines.push('export interface HistoryEntry {');
  lines.push("  role: 'user' | 'assistant' | 'system';");
  lines.push('  content: string;');
  lines.push('  timestamp: number;');
  lines.push('}');
  lines.push('export const HistoryEntrySchema = z.object({');
  lines.push("  role: z.enum(['user', 'assistant', 'system']),");
  lines.push('  content: z.string(),');
  lines.push('  timestamp: z.number().int().nonnegative(),');
  lines.push('});');
  lines.push('');

  // --- Formalization ---
  lines.push('export const ambiguitySeverityOf = (type: AMBIGUITY_TYPE): typeof AMBIGUITY_SEVERITIES[number] => AMBIGUITY_SEVERITY[type] as typeof AMBIGUITY_SEVERITIES[number];');
  lines.push('');
  lines.push('export const AmbiguityReportSchema = z.object({');
  lines.push('  type: z.enum(AMBIGUITY_TYPES),');
  lines.push('  description: z.string(),');
  lines.push('  options: z.array(z.string()),');
  lines.push('  confidence: unitInterval(),');
  lines.push('});');
  lines.push('export type AmbiguityReport = z.infer<typeof AmbiguityReportSchema>;');
  lines.push('');
  lines.push('export const AmbiguityFlagSchema = AmbiguityReportSchema.extend({');
  lines.push('  severity: z.enum(AMBIGUITY_SEVERITIES),');
  lines.push('});');
  lines.push('export type AmbiguityFlag = z.infer<typeof AmbiguityFlagSchema>;');
  lines.push('');
  lines.push('export const SourceSpanSchema = z.object({');
  lines.push('  start: nonNegativeInt(),');
  lines.push('  end: nonNegativeInt(),');
  lines.push('  text: z.string(),');
  lines.push('});');
  lines.push('export type SourceSpan = z.infer<typeof SourceSpanSchema>;');
  lines.push('');
  lines.push('export const FormalizationCandidateSchema = z.object({');
  lines.push('  candidateId: uuid(),');
  lines.push('  narsese: z.string(),');
  lines.push('  taskType: z.enum(TASK_TYPES),');
  lines.push('  truth: TruthValueSchema.optional(),');
  lines.push('  confidence: unitInterval(),');
  lines.push('  sourceSpans: z.array(SourceSpanSchema),');
  lines.push('  ambiguityFlags: z.array(AmbiguityFlagSchema),');
  lines.push('  metadata: z.object({');
  lines.push('    model: z.string().optional(),');
  lines.push('    promptTokens: nonNegativeInt().optional(),');
  lines.push('    completionTokens: nonNegativeInt().optional(),');
  lines.push('    latencyMs: nonNegativeInt().optional(),');
  lines.push('  }).optional(),');
  lines.push('});');
  lines.push('export type FormalizationCandidate = z.infer<typeof FormalizationCandidateSchema>;');
  lines.push('');
  lines.push('export const FormalizationBatchSchema = z.object({');
  lines.push('  batchId: uuid(),');
  lines.push('  sourceText: z.string(),');
  lines.push('  candidates: z.array(FormalizationCandidateSchema),');
  lines.push('  detectedIntent: z.enum(DETECTED_INTENTS).optional(),');
  lines.push('  globalAmbiguities: z.array(AmbiguityFlagSchema).optional(),');
  lines.push('});');
  lines.push('export type FormalizationBatch = z.infer<typeof FormalizationBatchSchema>;');
  lines.push('');

  // --- Gate I/O ---
  lines.push('export const PerceptionGateInputSchema = z.object({');
  lines.push('  sourceId: z.string(),');
  lines.push('  source: z.enum(STIMULUS_SOURCES).optional(),');
  lines.push('  rawObservation: z.unknown(),');
  lines.push('  sensorConfidence: unitInterval(),');
  lines.push('  sourceQuality: SourceQualitySchema,');
  lines.push('  correlationId: z.string().optional(),');
  lines.push('});');
  lines.push('export type PerceptionGateInput = z.infer<typeof PerceptionGateInputSchema>;');
  lines.push('');

  lines.push('export const ActionGateInputSchema = z.object({');
  lines.push('  proposalId: uuid(),');
  lines.push('  operation: z.string(),');
  lines.push('  args: z.record(z.string(), z.unknown()),');
  lines.push('  proposerReflexId: z.string().optional(),');
  lines.push('  nalDerivationId: uuid().optional(),');
  lines.push('  correlationId: z.string().optional(),');
  lines.push('});');
  lines.push('export type ActionGateInput = z.infer<typeof ActionGateInputSchema>;');
  lines.push('');

  lines.push('export const ActionGateOutputSchema = z.object({');
  lines.push('  authorized: z.boolean(),');
  lines.push('  toolCallId: uuid().optional(),');
  lines.push('  vetoReason: z.string().optional(),');
  lines.push('  requiredApprovals: z.array(z.string()).optional(),');
  lines.push('});');
  lines.push('export type ActionGateOutput = z.infer<typeof ActionGateOutputSchema>;');
  lines.push('');

  lines.push('export const RewardGateInputSchema = z.object({');
  lines.push('  eventId: uuid(),');
  lines.push('  rewardSignal: signedUnitInterval(),');
  lines.push("  rewardType: z.enum(['extrinsic', 'intrinsic', 'derivation-depth-reduction', 'self-model-accuracy', 'contradiction-reduction']),");
  lines.push("  targetType: z.enum(['attention-priority', 'policy-weights', 'truth-frequency', 'truth-confidence']),");
  lines.push('  targetId: z.string(),');
  lines.push('  domain: z.enum(REWARD_DOMAINS).optional(),');
  lines.push('  correlationId: z.string().optional(),');
  lines.push('});');
  lines.push('export type RewardGateInput = z.infer<typeof RewardGateInputSchema>;');
  lines.push('');

  lines.push('export const RewardGateOutputSchema = z.object({');
  lines.push('  accepted: z.boolean(),');
  lines.push('  mutationApplied: z.boolean().optional(),');
  lines.push('  epistemicFirewallViolation: z.boolean().optional(),');
  lines.push('  rejectionReason: z.string().optional(),');
  lines.push('  requiresProposal: z.boolean().optional(),');
  lines.push('});');
  lines.push('export type RewardGateOutput = z.infer<typeof RewardGateOutputSchema>;');
  lines.push('');

  lines.push('export const BudgetOperationSchema = z.enum(BUDGET_OPERATIONS);');
  lines.push('export type BudgetOperation = z.infer<typeof BudgetOperationSchema>;');
  lines.push('');

  // --- Governance ---
  lines.push('export const AutonomyModeSchema = z.enum(AUTONOMY_MODES);');
  lines.push('export type AutonomyMode = z.infer<typeof AutonomyModeSchema>;');
  lines.push('');
  lines.push('export const AutonomyAuthoritySchema = z.enum(AUTONOMITY_AUTHORITIES);');
  lines.push('export type AutonomyAuthority = z.infer<typeof AutonomyAuthoritySchema>;');
  lines.push('');
  lines.push('export const GameDomainSchema = z.enum(GAME_DOMAINS);');
  lines.push('export type GameDomain = z.infer<typeof GameDomainSchema>;');
  lines.push('');
  lines.push('export const RewardDomainSchema = z.enum(REWARD_DOMAINS);');
  lines.push('export type RewardDomain = z.infer<typeof RewardDomainSchema>;');
  lines.push('');
  lines.push('export const PatchProposalSchema = z.object({');
  lines.push('  proposalId: uuid(),');
  lines.push('  patchRef: z.string(),');
  lines.push('  baseCommit: z.string(),');
  lines.push('  patchDiff: z.string(),');
  lines.push('  ciResults: z.object({');
  lines.push('    test: z.boolean(),');
  lines.push('    typecheck: z.boolean(),');
  lines.push('    lint: z.boolean(),');
  lines.push('    durationMs: positiveInt(),');
  lines.push('  }),');
  lines.push('  riskSelfAssessment: z.enum(RISK_LEVELS),');
  lines.push('  affectedComponents: z.array(z.enum([\'approval-logic\', \'sandbox-config\', \'reward-functions\', \'autonomy-mode\', \'kernel-gates\', \'cognitive-params\', \'tools\', \'rules\', \'memory\', \'other\'])),');
  lines.push('  affectedFiles: z.array(z.string()),');
  lines.push('  linesAdded: nonNegativeInt(),');
  lines.push('  linesRemoved: nonNegativeInt(),');
  lines.push('  coverageDelta: z.number().optional(),');
  lines.push('  rationale: z.string(),');
  lines.push('  timestamp: timestamp(),');
  lines.push('  agentSignature: z.string(),');
  lines.push('  correlationId: z.string().optional(),');
  lines.push('});');
  lines.push('export type PatchProposal = z.infer<typeof PatchProposalSchema>;');
  lines.push('');
  lines.push('export const SelfImprovementProposalSchema = z.object({');
  lines.push('  proposalId: uuid(),');
  lines.push('  kind: z.enum(SELF_IMPROVEMENT_KINDS),');
  lines.push('  riskTier: z.enum(CAPABILITY_RISKS),');
  lines.push('  payload: z.record(z.string(), z.unknown()),');
  lines.push('  rewardDomain: RewardDomainSchema,');
  lines.push('  correlationId: z.string().optional(),');
  lines.push('});');
  lines.push('export type SelfImprovementProposal = z.infer<typeof SelfImprovementProposalSchema>;');
  lines.push('');
  lines.push('export const proposalRisk = (kind: SelfImprovementProposal[\'kind\']): SelfImprovementProposal[\'riskTier\'] => PROPOSAL_RISK[kind];');
  lines.push('');
  lines.push('export const RiskAssessmentSchema = z.object({');
  lines.push('  risk: z.enum(RISK_LEVELS),');
  lines.push('  score: nonNegativeInt(),');
  lines.push('  factors: z.array(z.object({');
  lines.push('    factor: z.string(),');
  lines.push('    file: z.string().optional(),');
  lines.push('    component: z.string().optional(),');
  lines.push('    severity: z.enum(RISK_LEVELS),');
  lines.push('  })),');
  lines.push('});');
  lines.push('export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;');
  lines.push('');
  lines.push('export const GovernanceDecisionSchema = z.object({');
  lines.push('  action: z.enum(GOVERNANCE_ACTIONS),');
  lines.push('  reason: z.string(),');
  lines.push('  reviewers: nonNegativeInt().optional(),');
  lines.push('});');
  lines.push('export type GovernanceDecision = z.infer<typeof GovernanceDecisionSchema>;');
  lines.push('');
  lines.push('export const GovernanceEventSchema = z.object({');
  lines.push('  eventId: uuid(),');
  lines.push('  proposalId: uuid(),');
  lines.push('  decision: z.enum(GOVERNANCE_DECISIONS),');
  lines.push('  riskLevel: z.enum(RISK_LEVELS),');
  lines.push('  autonomyMode: AutonomyModeSchema,');
  lines.push('  decidedAt: timestamp(),');
  lines.push('  decidedBy: z.enum(GOVERNANCE_DECIDED_BY),');
  lines.push('});');
  lines.push('export type GovernanceEvent = z.infer<typeof GovernanceEventSchema>;');
  lines.push('');

  // --- Rule table ---
  lines.push('export const RuleProvenanceSchema = z.discriminatedUnion(\'kind\', [');
  lines.push("  z.object({ kind: z.literal('builtin') }),");
  lines.push('  z.object({');
  lines.push('    kind: z.literal(\'proposal\'),');
  lines.push('    proposalId: nonEmpty(),');
  lines.push('    producer: nonEmpty().optional(),');
  lines.push('  }),');
  lines.push("  z.object({ kind: z.literal('import'), source: nonEmpty() }),");
  lines.push(']);');
  lines.push('export type RuleProvenance = z.infer<typeof RuleProvenanceSchema>;');
  lines.push('');
  lines.push('export const RuleDeclarationSchema = z.object({');
  lines.push('  ruleId: nonEmpty(),');
  lines.push('  description: z.string(),');
  lines.push('  ...RulePatternSchema.shape,');
  lines.push("  truthFn: nonEmpty(),");
  lines.push("  body: nonEmpty(),");
  lines.push('  priority: z.number(),');
  lines.push('  taskType: z.enum(TASK_TYPES).optional(),');
  lines.push('});');
  lines.push('export type RuleDeclaration = z.infer<typeof RuleDeclarationSchema>;');
  lines.push('');
  lines.push('export const RuleArtifactEntrySchema = RuleDeclarationSchema.extend({');
  lines.push('  artifactVersion: nonEmpty(),');
  lines.push('  ruleSetRevision: nonNegativeInt(),');
  lines.push('  parentRevision: nonNegativeInt().nullable(),');
  lines.push('  ruleSchemaVersion: positiveInt(),');
  lines.push('  provenance: RuleProvenanceSchema,');
  lines.push('  eventId: z.string().optional(),');
  lines.push('});');
  lines.push('export type RuleArtifactEntry = z.infer<typeof RuleArtifactEntrySchema>;');
  lines.push('');
  lines.push('export const RuleTableSchema = z.object({');
  lines.push('  schemaVersion: positiveInt(),');
  lines.push('  artifactVersion: nonEmpty(),');
  lines.push('  revision: nonNegativeInt(),');
  lines.push('  entries: z.array(RuleArtifactEntrySchema),');
  lines.push('});');
  lines.push('export type RuleTable = z.infer<typeof RuleTableSchema>;');
  lines.push('');
  lines.push('export interface RuleTableDiff {');
  lines.push('  readonly from: number;');
  lines.push('  readonly to: number;');
  lines.push('  readonly added: readonly string[];');
  lines.push('  readonly removed: readonly string[];');
  lines.push('  readonly superseded: readonly string[];');
  lines.push('  readonly unchanged: number;');
  lines.push('}');
  lines.push('');
  lines.push("export const RULE_TABLE_REJECTIONS = ['schema-version', 'artifact-version', 'duplicate-rule-id', 'unresolved-body', 'empty-id'] as const;");
  lines.push('export type RuleTableRejection = (typeof RULE_TABLE_REJECTIONS)[number];');
  lines.push('');
  lines.push('export interface RuleTableFault {');
  lines.push('  readonly ruleId: string;');
  lines.push('  readonly reason: RuleTableRejection;');
  lines.push('  readonly detail: string;');
  lines.push('}');
  lines.push('');

  // --- Event base ---
  lines.push('export const EngineOriginSchema = z.enum(ENGINE_ORIGINS);');
  lines.push('');
  lines.push('export const CognitiveEventBaseSchema = z.object({');
  lines.push('  engine: EngineOriginSchema,');
  lines.push('  timestamp: timestamp(),');
  lines.push('  correlationId: z.string(),');
  lines.push('  causationId: z.string().optional(),');
  lines.push('  id: z.string().optional(),');
  lines.push('});');
  lines.push('');
  lines.push("export const PROPOSER_ORIGIN = 'proposer' as const;");
  lines.push("export const NAR_ORIGIN = 'nar' as const;");
  lines.push('');

  // --- Task ---
  lines.push('export const TaskTypeSchema = z.enum(TASK_TYPES);');
  lines.push('export type TaskType = z.infer<typeof TaskTypeSchema>;');
  lines.push('export const TaskBagKindSchema = z.enum(TASK_BAG_KINDS);');
  lines.push('export type TaskBagKind = z.infer<typeof TaskBagKindSchema>;');
  lines.push('export const TaskPunctuationSchema = z.enum(TASK_PUNCTUATIONS);');
  lines.push('export type TaskPunctuation = z.infer<typeof TaskPunctuationSchema>;');
  lines.push('export const TolerantPunctuationSchema = z.enum(TOLERANT_PUNCTUATIONS);');
  lines.push('export type TolerantPunctuation = z.infer<typeof TolerantPunctuationSchema>;');
  lines.push('');
  lines.push('const TASK_TYPE_BY_PUNCTUATION = new Map<string, TaskType>(Object.entries(TASK_PUNCTUATION).map(([type, mark]) => [mark, type as TaskType]));');
  lines.push('export const taskTypeForPunctuation = (punctuation: string): TaskType | null => TASK_TYPE_BY_PUNCTUATION.get(punctuation) ?? null;');
  lines.push('');

  // --- Cognitive events (kernel) ---
  lines.push('export const StimulusSourceSchema = z.enum(STIMULUS_SOURCES);');
  lines.push('export type StimulusSource = (typeof STIMULUS_SOURCES)[number];');
  lines.push('');

  lines.push('export const TaskAdmittedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('task.admitted'),");
  lines.push('  payload: z.object({');
  lines.push('    taskId: uuid(),');
  lines.push('    term: z.string(),');
  lines.push('    taskType: TaskTypeSchema,');
  lines.push('    truth: TruthValueSchema.optional(),');
  lines.push('    source: StimulusSourceSchema,');
  lines.push('    budget: BudgetSchema,');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const DerivationAcceptedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('derivation.accepted'),");
  lines.push('  payload: z.object({');
  lines.push('    derivationId: uuid(),');
  lines.push('    ruleId: z.string(),');
  lines.push('    ruleCategory: z.enum(RULE_CATEGORIES).optional(),');
  lines.push('    premises: z.array(z.string()),');
  lines.push('    conclusion: z.string(),');
  lines.push('    truth: TruthValueSchema,');
  lines.push('    premiseTruths: z.array(TruthValueSchema).optional(),');
  lines.push('    truthFn: z.string().optional(),');
  lines.push('    evidenceLineage: z.array(uuid()),');
  lines.push("    independenceCheck: z.enum(['independent', 'dependent', 'unknown']),");
  lines.push('    cycle: nonNegativeInt().optional(),');
  lines.push('    correlationId: z.string().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const BeliefRevisedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('belief.revised'),");
  lines.push('  payload: z.object({');
  lines.push('    term: z.string(),');
  lines.push('    oldTruth: TruthValueSchema,');
  lines.push('    newTruth: TruthValueSchema,');
  lines.push('    evidenceLineage: z.array(uuid()).optional(),');
  lines.push('    revisionRule: z.string().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConceptActivatedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('concept.activated'),");
  lines.push('  payload: z.object({');
  lines.push('    term: z.string(),');
  lines.push('    priority: z.number(),');
  lines.push("    activationSource: z.enum(['perception', 'goal', 'derivation', 'decay', 'associative']).optional(),");
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const BudgetExhaustedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('budget.exhausted'),");
  lines.push('  payload: z.object({');
  lines.push("    budgetType: z.enum(['cycles', 'depth', 'memory', 'llm']),");
  lines.push('    remaining: z.number(),');
  lines.push('    limit: z.number(),');
  lines.push('    terminationReason: z.enum(TERMINATION_REASONS),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const PolicyViolationEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('policy.violation'),");
  lines.push('  payload: z.object({');
  lines.push('    policyId: z.string(),');
  lines.push("    violationType: z.enum(['unauthorized-tool', 'budget-exceeded', 'epistemic-firewall', 'sandbox-escape', 'self-mod-unauthorized']),");
  lines.push('    detail: z.string(),');
  lines.push("    severity: z.enum(['warn', 'block', 'quarantine']),");
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const AutonomyModeChangedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('autonomy.mode.changed'),");
  lines.push('  payload: z.object({');
  lines.push('    previousMode: AutonomyModeSchema,');
  lines.push('    newMode: AutonomyModeSchema,');
  lines.push('    authorizedBy: AutonomyAuthoritySchema,');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SelfModProposalEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('self-mod.proposal'),");
  lines.push('  payload: PatchProposalSchema,');
  lines.push('});');
  lines.push('');

  lines.push('export const JudgmentResolvedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('judgment.resolved'),");
  lines.push('  payload: z.object({');
  lines.push('    queryId: z.string(),');
  lines.push('    shape: z.string(), // JudgmentShapeSchema');
  lines.push('    axis: z.string(), // CognitiveAxisSchema');
  lines.push('    backendId: z.string(),');
  lines.push('    tier: z.number().int().min(0).max(3),');
  lines.push('    latencyMs: nonNegativeInt(),');
  lines.push('    entropy: z.number().optional(),');
  lines.push('    abstained: z.boolean(),');
  lines.push("    stampType: z.enum(['standard', 'provisional']),");
  lines.push('    calibrationVersion: z.string(),');
  lines.push('    encoderDigest: z.string().optional(),');
  lines.push('    modelDigest: z.string().optional(),');
  lines.push('    calibrationDigest: z.string().optional(),');
  lines.push('    inputDigest: z.string().optional(),');
  lines.push('    decisionBand: z.unknown().optional(), // BandDecisionSchema');
  lines.push('    cost: z.object({');
  lines.push('      tokensIn: nonNegativeInt(),');
  lines.push('      tokensOut: nonNegativeInt(),');
  lines.push('      computeMs: nonNegativeInt(),');
  lines.push('      memoryMb: z.number().nonnegative(),');
  lines.push('    }),');
  lines.push('  }),');
  lines.push('});');
  lines.push('export type JudgmentResolvedEvent = z.infer<typeof JudgmentResolvedEventSchema>;');
  lines.push('');

  lines.push('export const EgressGateRejectedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('egress.gate.rejected'),");
  lines.push('  payload: z.object({');
  lines.push("    gate: z.enum(['groundedness', 'risk']),");
  lines.push('    score: unitInterval().optional(),');
  lines.push('    detail: z.string().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('export type EgressGateRejectedEvent = z.infer<typeof EgressGateRejectedEventSchema>;');
  lines.push('');

  lines.push('export const ShadowValidationDropEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('shadow.validation.dropped'),");
  lines.push('  payload: z.object({');
  lines.push('    candidateTerm: z.string(),');
  lines.push("    source: z.enum(['llm', 'bridge-llm']),");
  lines.push("    conflictType: z.enum(['frequency', 'semantic']),");
  lines.push('    frequencyDelta: z.number().optional(),');
  lines.push('    semanticScore: z.number().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('export type ShadowValidationDropEvent = z.infer<typeof ShadowValidationDropEventSchema>;');
  lines.push('');

  // --- Derivation records (before DerivationRecordEventSchema) ---
  lines.push('export const RuleCategorySchema = z.enum(RULE_CATEGORIES);');
  lines.push('export type RuleCategory = (typeof RULE_CATEGORIES)[number];');
  lines.push('');

  lines.push('export const DerivationStepSchema = z.object({');
  lines.push('  stepId: uuid(),');
  lines.push('  ruleId: z.string(),');
  lines.push('  ruleCategory: RuleCategorySchema,');
  lines.push('  premises: z.array(z.string()),');
  lines.push('  conclusion: z.string(),');
  lines.push('  truth: TruthValueSchema,');
  lines.push('  truthFn: z.string().optional(),');
  lines.push('  substitution: z.record(z.string(), z.string()).optional(),');
  lines.push('  premiseTruths: z.array(TruthValueSchema).optional(),');
  lines.push('  evidenceLineage: z.array(uuid()),');
  lines.push("  independence: z.enum(['independent', 'dependent', 'unknown']),");
  lines.push('  cycle: nonNegativeInt().optional(),');
  lines.push('  correlationId: z.string().optional(),');
  lines.push('  timestamp: timestamp().optional(),');
  lines.push('});');
  lines.push('');

  lines.push('export const DerivationRecordSchema = z.object({');
  lines.push('  derivationId: uuid(),');
  lines.push('  taskId: uuid(),');
  lines.push('  goalTerm: z.string(),');
  lines.push('  steps: z.array(DerivationStepSchema),');
  lines.push('  finalTruth: TruthValueSchema,');
  lines.push('  totalCycles: nonNegativeInt(),');
  lines.push('  maxDepthReached: nonNegativeInt(),');
  lines.push('  timestamp: timestamp(),');
  lines.push("  engine: z.literal('nar'),");
  lines.push('});');
  lines.push('');
  lines.push('export type DerivationRecord = z.infer<typeof DerivationRecordSchema>;');
  lines.push('export type DerivationStep = z.infer<typeof DerivationStepSchema>;');
  lines.push('');

  // --- DerivationRecordEventSchema (depends on DerivationRecordSchema) ---
  lines.push('export const DerivationRecordEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('derivation.record'),");
  lines.push('  payload: DerivationRecordSchema,');
  lines.push('});');
  lines.push('');

  // --- NAR events ---
  lines.push("const NarBase = CognitiveEventBaseSchema.extend({ engine: z.literal('nar') });");
  lines.push('');
  lines.push('export const InputUserEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('input.user'),");
  lines.push('  payload: z.object({ text: z.string(), source: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const DerivationMadeEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('derivation.made'),");
  lines.push('  payload: z.object({');
  lines.push('    rule: z.string(),');
  lines.push('    premises: z.array(z.string()),');
  lines.push('    conclusion: z.string(),');
  lines.push('    cpuMs: z.number().optional(),');
  lines.push('    lmCalls: z.number().optional(),');
  lines.push('    lmTokens: z.number().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const AtomDerivedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('atom.derived'),");
  lines.push('  payload: z.object({ atom: z.string(), space: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const AtomRetractedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('atom.retracted'),");
  lines.push('  payload: z.object({ atom: z.string(), space: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const BeliefAddedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('belief.added'),");
  lines.push('  payload: z.object({ term: z.string(), truth: TruthValueSchema }),');
  lines.push('});');
  lines.push('');

  lines.push('export const BeliefRetractedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('belief.retracted'),");
  lines.push('  payload: z.object({ term: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const DriveChangedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('drive.changed'),");
  lines.push('  payload: z.object({ drive: z.string(), urgency: z.number() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const GoalAchievedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('goal.achieved'),");
  lines.push('  payload: z.object({ goal: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const GoalFailedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('goal.failed'),");
  lines.push('  payload: z.object({ goal: z.string(), reason: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const SkillExecutedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('skill.executed'),");
  lines.push('  payload: z.object({');
  lines.push('    skill: z.string(),');
  lines.push('    args: z.array(z.string()),');
  lines.push('    result: z.string(),');
  lines.push('    durationMs: z.number(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ToolRequestEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('tool.request'),");
  lines.push('  payload: z.object({');
  lines.push('    toolName: z.string(),');
  lines.push('    args: z.record(z.string(), z.unknown()),');
  lines.push('    timeoutMs: z.number().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ToolResponseEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('tool.response'),");
  lines.push('  payload: z.object({');
  lines.push('    requestId: z.string(),');
  lines.push('    toolName: z.string(),');
  lines.push('    result: z.unknown().optional(),');
  lines.push('    error: z.string().optional(),');
  lines.push('    durationMs: z.number(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConfigSetEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('config.set'),");
  lines.push('  payload: z.object({ path: z.string(), value: z.unknown() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConfigDeleteEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('config.delete'),");
  lines.push('  payload: z.object({ path: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConfigSchemaEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('config.schema'),");
  lines.push('  payload: z.object({ schema: z.unknown() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const KernelReadyEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('kernel.ready'),");
  lines.push('  payload: z.object({ backendIds: z.array(z.string()) }),');
  lines.push('});');
  lines.push('');

  lines.push('export const BackendRegisteredEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('backend.registered'),");
  lines.push('  payload: z.object({ manifest: z.unknown() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const BootstrapEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('bootstrap'),");
  lines.push('  payload: z.object({');
  lines.push('    beliefs: z.array(z.string()).optional(),');
  lines.push('    atoms: z.array(z.object({ atom: z.string(), space: z.string().optional() })).optional(),');
  lines.push('    skills: z.array(z.object({ name: z.string(), code: z.string() })).optional(),');
  lines.push('    restored: z.object({');
  lines.push('      cycleCount: z.number(),');
  lines.push('      concepts: z.number(),');
  lines.push('      pendingTasks: z.number(),');
  lines.push('    }).optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const CycleEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('cycle'),");
  lines.push('  cycle: z.number(),');
  lines.push('  derived: z.number(),');
  lines.push('  payload: z.object({');
  lines.push('    cycle: z.number(),');
  lines.push('    derived: z.number(),');
  lines.push('    state: z.enum(KERNEL_CONTROL_STATES),');
  lines.push('    phase: z.string(),');
  lines.push('    activeTasks: z.number(),');
  lines.push('    budget: z.record(z.string(), z.number()),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const HealthEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('health'),");
  lines.push('  payload: z.object({');
  lines.push("    status: z.enum(['healthy', 'degraded', 'unhealthy']),");
  lines.push('    cycleCount: z.number(),');
  lines.push('    errorRate: z.number(),');
  lines.push('    byEngine: z.record(z.string(), z.number()).optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ConflictDetectedEventSchema = NarBase.extend({');
  lines.push("  type: z.literal('conflict:detected'),");
  lines.push('  payload: z.object({ term: z.string(), conflictWith: z.string() }),');
  lines.push('});');
  lines.push('');

  lines.push('export const NarEventSchemas = [');
  lines.push('  InputUserEventSchema,');
  lines.push('  DerivationMadeEventSchema,');
  lines.push('  AtomDerivedEventSchema,');
  lines.push('  AtomRetractedEventSchema,');
  lines.push('  BeliefAddedEventSchema,');
  lines.push('  BeliefRetractedEventSchema,');
  lines.push('  DriveChangedEventSchema,');
  lines.push('  GoalAchievedEventSchema,');
  lines.push('  GoalFailedEventSchema,');
  lines.push('  SkillExecutedEventSchema,');
  lines.push('  ToolRequestEventSchema,');
  lines.push('  ToolResponseEventSchema,');
  lines.push('  ConfigSetEventSchema,');
  lines.push('  ConfigDeleteEventSchema,');
  lines.push('  ConfigSchemaEventSchema,');
  lines.push('  KernelReadyEventSchema,');
  lines.push('  BackendRegisteredEventSchema,');
  lines.push('  BootstrapEventSchema,');
  lines.push('  CycleEventSchema,');
  lines.push('  HealthEventSchema,');
  lines.push('  ConflictDetectedEventSchema,');
  lines.push('] as const;');
  lines.push('');

  // --- Proposal events ---
  lines.push('const EnvelopeSchema = z.object({');
  lines.push('  proposalId: nonEmpty(),');
  lines.push('  schemaVersion: positiveInt(),');
  lines.push('  baseRevision: nonNegativeInt(),');
  lines.push('  cyclesPerProposal: positiveInt(),');
  lines.push('  issuedAtCycle: nonNegativeInt(),');
  lines.push('  references: z.array(z.string()),');
  lines.push('});');
  lines.push('');

  lines.push('export const ContentProposalSchema = EnvelopeSchema.extend({');
  lines.push("  kind: z.literal('content'),");
  lines.push('  payload: z.object({');
  lines.push('    taskType: TaskTypeSchema,');
  lines.push('    term: nonEmpty(),');
  lines.push('    truth: TruthValueSchema.optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const RuleProposalSchema = EnvelopeSchema.extend({');
  lines.push("  kind: z.literal('rule'),");
  lines.push('  payload: z.object({');
  lines.push('    ruleId: nonEmpty(),');
  lines.push('    name: nonEmpty(),');
  lines.push('    pattern: RulePatternSchema,');
  lines.push("    truthFn: nonEmpty(),");
  lines.push('    priority: unitInterval(),');
  lines.push('    body: z.string().optional(),');
  lines.push('    symbolicFallback: z.string().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ProposalSchema = z.discriminatedUnion(\'kind\', [ContentProposalSchema, RuleProposalSchema]);');
  lines.push('export type ContentProposal = z.infer<typeof ContentProposalSchema>;');
  lines.push('export type RuleProposal = z.infer<typeof RuleProposalSchema>;');
  lines.push('export type Proposal = z.infer<typeof ProposalSchema>;');
  lines.push('');

  lines.push('export const ProposalRejectedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('proposal.rejected'),");
  lines.push('  engine: z.literal(PROPOSER_ORIGIN),');
  lines.push('  payload: z.object({');
  lines.push('    proposalId: z.string(),');
  lines.push('    kind: z.enum(PROPOSAL_KINDS),');
  lines.push('    reason: z.enum(PROPOSAL_REJECTIONS),');
  lines.push('    detail: z.string(),');
  lines.push('    observedRevision: nonNegativeInt(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');

  lines.push('export const ProposalAdmittedEventSchema = CognitiveEventBaseSchema.extend({');
  lines.push("  type: z.literal('proposal.admitted'),");
  lines.push('  engine: z.literal(PROPOSER_ORIGIN),');
  lines.push('  payload: z.object({');
  lines.push('    proposalId: z.string(),');
  lines.push('    kind: z.enum(PROPOSAL_KINDS),');
  lines.push('    schemaVersion: positiveInt(),');
  lines.push('    baseRevision: nonNegativeInt(),');
  lines.push('    resultingRevision: positiveInt(),');
  lines.push('    declaration: RuleDeclarationSchema.optional(),');
  lines.push('    producer: z.string().optional(),');
  lines.push('  }),');
  lines.push('});');
  lines.push('');
  lines.push('export type ProposalRejectedEvent = z.infer<typeof ProposalRejectedEventSchema>;');
  lines.push('export type ProposalAdmittedEvent = z.infer<typeof ProposalAdmittedEventSchema>;');
  lines.push('');

  // --- Reasoning budget (before BudgetGate) ---
  lines.push('export const ConsumedBudgetSchema = z.object({');
  lines.push('  cycles: nonNegativeInt().default(0),');
  lines.push('  depth: nonNegativeInt().default(0),');
  lines.push('  memoryOps: nonNegativeInt().default(0),');
  lines.push('  llmCalls: nonNegativeInt().default(0),');
  lines.push('});');
  lines.push('export type ConsumedBudget = z.infer<typeof ConsumedBudgetSchema>;');
  lines.push('');

  lines.push('export const TerminationReasonSchema = z.enum(TERMINATION_REASONS);');
  lines.push('export type TerminationReason = z.infer<typeof TerminationReasonSchema>;');
  lines.push('');

  lines.push('export const zeroConsumed = (): ConsumedBudget => ({ cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 });');
  lines.push('');
  lines.push('export const ReasoningBudgetSchema = z.object({');
  lines.push('  maxCycles: positiveInt(),');
  lines.push('  maxDepth: positiveInt(),');
  lines.push('  maxMemoryOps: positiveInt(),');
  lines.push('  maxLMCalls: nonNegativeInt(),');
  lines.push('  wallclockDeadlineMs: positiveInt().optional(),');
  lines.push('  abortSignal: z.unknown().optional(),');
  lines.push('  terminationReason: TerminationReasonSchema.optional(),');
  lines.push('  consumed: ConsumedBudgetSchema.default(zeroConsumed),');
  lines.push('});');
  lines.push('export type ReasoningBudget = z.infer<typeof ReasoningBudgetSchema>;');
  lines.push('');

  // --- BudgetGate (depends on ReasoningBudgetSchema, TerminationReasonSchema) ---
  lines.push('export const BudgetGateInputSchema = z.object({');
  lines.push('  budget: ReasoningBudgetSchema.optional(),');
  lines.push('  operation: BudgetOperationSchema,');
  lines.push('  estimatedCost: positiveInt().optional(),');
  lines.push('  scopeId: z.union([z.enum(BUDGET_SCOPE_IDS), z.string()]).optional(),');
  lines.push('  correlationId: z.string().optional(),');
  lines.push('});');
  lines.push('export type BudgetGateInput = z.infer<typeof BudgetGateInputSchema>;');
  lines.push('');

  lines.push('export const BudgetGateOutputSchema = z.object({');
  lines.push('  granted: z.boolean(),');
  lines.push('  updatedBudget: ReasoningBudgetSchema.optional(),');
  lines.push('  terminationReason: z.enum(TERMINATION_REASONS).optional(),');
  lines.push('});');
  lines.push('export type BudgetGateOutput = z.infer<typeof BudgetGateOutputSchema>;');
  lines.push('');

  lines.push("export type GateName = 'perception' | 'action' | 'reward' | 'budget';");
  lines.push('');
  lines.push('/** The decision shape: a grant, and why not when refused. */');
  lines.push('export type Verdict<Granted extends string, Reason extends string = \'reason\'> = {');
  lines.push('  [K in Granted]: boolean;');
  lines.push('} & {');
  lines.push('  [K in Reason]?: string;');
  lines.push('};');
  lines.push('');
  lines.push("export type GateOutcome = Verdict<'granted'>;");
  lines.push('');

  // --- PerceptionGateOutput (depends on TaskAdmittedEventSchema) ---
  lines.push('export const PerceptionGateOutputSchema = z.object({');
  lines.push('  admitted: z.boolean(),');
  lines.push('  task: TaskAdmittedEventSchema.shape.payload.optional(),');
  lines.push('  rejectionReason: z.string().optional(),');
  lines.push('});');
  lines.push('export type PerceptionGateOutput = z.infer<typeof PerceptionGateOutputSchema>;');
  lines.push('');

  // --- Union types and validators (at the end) ---
  lines.push('export const CognitiveEventSchema = z.discriminatedUnion(\'type\', [');
  lines.push('  TaskAdmittedEventSchema,');
  lines.push('  DerivationAcceptedEventSchema,');
  lines.push('  DerivationRecordEventSchema,');
  lines.push('  BeliefRevisedEventSchema,');
  lines.push('  ConceptActivatedEventSchema,');
  lines.push('  BudgetExhaustedEventSchema,');
  lines.push('  PolicyViolationEventSchema,');
  lines.push('  AutonomyModeChangedEventSchema,');
  lines.push('  SelfModProposalEventSchema,');
  lines.push('  JudgmentResolvedEventSchema,');
  lines.push('  EgressGateRejectedEventSchema,');
  lines.push('  ShadowValidationDropEventSchema,');
  lines.push('  ProposalAdmittedEventSchema,');
  lines.push('  ProposalRejectedEventSchema,');
  lines.push('  ...NarEventSchemas,');
  lines.push(']);');
  lines.push('');

  lines.push('export type CognitiveEvent = z.infer<typeof CognitiveEventSchema>;');
  lines.push('export type TaskAdmittedEvent = z.infer<typeof TaskAdmittedEventSchema>;');
  lines.push('export type DerivationAcceptedEvent = z.infer<typeof DerivationAcceptedEventSchema>;');
  lines.push('export type DerivationRecordEvent = z.infer<typeof DerivationRecordEventSchema>;');
  lines.push('export type BeliefRevisedEvent = z.infer<typeof BeliefRevisedEventSchema>;');
  lines.push('export type ConceptActivatedEvent = z.infer<typeof ConceptActivatedEventSchema>;');
  lines.push('export type BudgetExhaustedEvent = z.infer<typeof BudgetExhaustedEventSchema>;');
  lines.push('export type PolicyViolationEvent = z.infer<typeof PolicyViolationEventSchema>;');
  lines.push('export type AutonomyModeChangedEvent = z.infer<typeof AutonomyModeChangedEventSchema>;');
  lines.push('export type SelfModProposalEvent = z.infer<typeof SelfModProposalEventSchema>;');
  lines.push('');

  lines.push('export type CognitiveEventOf<T extends CognitiveEvent[\'type\']> = Extract<CognitiveEvent, { type: T }>;');
  lines.push('');

  lines.push('export const validateCognitiveEvent = (data: unknown) => CognitiveEventSchema.parse(data);');
  lines.push('export const validateProposal = (data: unknown) => ProposalSchema.parse(data);');
  lines.push('export const validateFormalizationCandidate = (data: unknown) => FormalizationCandidateSchema.parse(data);');
  lines.push('export const validateFormalizationBatch = (data: unknown) => FormalizationBatchSchema.parse(data);');
  lines.push('export const validateDerivationRecord = (data: unknown) => DerivationRecordSchema.parse(data);');
  lines.push('export const validateReasoningBudget = (data: unknown) => ReasoningBudgetSchema.parse(data);');
  lines.push('export const validateRuleTable = (data: unknown) => RuleTableSchema.parse(data);');
  lines.push('');

  lines.push("export const isNarEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { engine: 'nar' }> => e.engine === 'nar';");
  lines.push('');
  lines.push('export const isEventType = <T extends CognitiveEvent[\'type\']>(type: T) => (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: T }> => e.type === type;');
  lines.push('');

  // --- Mint function ---
  lines.push('type Mintable<T extends CognitiveEvent[\'type\']> = Omit<');
  lines.push('  CognitiveEventOf<T>,');
  lines.push("  'type' | 'engine' | 'timestamp' | 'correlationId' | 'causationId'");
  lines.push('> & {');
  lines.push('  engine: CognitiveEvent[\'engine\'];');
  lines.push('  timestamp?: number;');
  lines.push('  correlationId?: string;');
  lines.push('  causationId?: string;');
  lines.push('};');
  lines.push('');
  lines.push('export const mintCognitiveEvent = <T extends CognitiveEvent[\'type\']>(');
  lines.push('  type: T,');
  lines.push('  draft: Mintable<T>');
  lines.push('): CognitiveEventOf<T> =>');
  lines.push('  ({');
  lines.push('    ...draft,');
  lines.push('    type,');
  lines.push('    timestamp: draft.timestamp ?? Date.now(),');
  lines.push("    correlationId: draft.correlationId ?? generateId('corr'),");
  lines.push('  }) as CognitiveEventOf<T>;');
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// MAIN
// ============================================================================

const output = generate();
writeFileSync(join(OUT_DIR, 'schemas.ts'), output);
console.log('Generated:', join(OUT_DIR, 'schemas.ts'));