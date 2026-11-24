/**
 * Governance schema generators for the genome.
 */

export function generateGovernanceSchemas(): string[] {
  const lines: string[] = [];
  lines.push('// --- Governance ---');
  lines.push('export const AutonomyModeSchema = z.enum(AUTONOMY_MODES);');
  lines.push('export type AutonomyMode = z.infer<typeof AutonomyModeSchema>;');
  lines.push('');

  lines.push('export const AutonomyAuthoritySchema = z.enum(AUTONOMITY_AUTHORITIES);');
  lines.push('export type AutonomyAuthority = z.infer<typeof AutonomyAuthoritySchema>;');
  lines.push('');

  lines.push('export const RiskLevelSchema = z.enum(RISK_LEVELS);');
  lines.push('export type RiskLevel = z.infer<typeof RiskLevelSchema>;');
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

  return lines;
}