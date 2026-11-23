/**
 * Governance schemas — autonomy, risk, proposals, decisions.
 * Re-exported from generated genome for backward compatibility.
 */
export {
  AUTONOMY_MODES,
  AutonomyModeSchema,
  AUTONOMITY_AUTHORITIES,
  AutonomyAuthoritySchema,
  NON_EXECUTING_MODES,
  permitsExecution,
  RISK_LEVELS,
  RISK_LEVEL_BY_CAPABILITY_RISK,
  RiskLevelSchema,
  riskLevelOf,
  CAPABILITY_RISKS,
  CapabilityRiskSchema,
  GAME_DOMAINS,
  GameDomainSchema,
  REWARD_DOMAINS,
  RewardDomainSchema,
  PatchProposalSchema,
  SELF_IMPROVEMENT_KINDS,
  SelfImprovementProposalSchema,
  PROPOSAL_RISK,
  proposalRisk,
  RiskAssessmentSchema,
  GOVERNANCE_ACTIONS,
  GovernanceDecisionSchema,
  GOVERNANCE_DECISIONS,
  GOVERNANCE_DECIDED_BY,
  GovernanceEventSchema,
} from '@senars/generated';

export type {
  AutonomyMode,
  AutonomyAuthority,
  RiskLevel,
  CapabilityRisk,
  GameDomain,
  RewardDomain,
  PatchProposal,
  SelfImprovementProposal,
  RiskAssessment,
  GovernanceDecision,
  GovernanceEvent,
} from '@senars/generated';