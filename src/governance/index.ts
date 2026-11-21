export type {
  ProposalActuators,
  ProposalRoute,
  ValidationVerdict,
  SelfMetaGameEvidence,
  AdaptationRecord,
} from './pipeline.js';
export {
  GovernancePolicyEngine,
  PatchRiskClassifier,
  ProposalRouter,
  SandboxValidator,
  GovernanceResolver,
} from './pipeline.js';

// W3: Risk–Verdict Gate Matrix
export {
  RISK_CLASSES,
  type RiskClass,
  GATE_DECISIONS,
  type GateDecision,
  type GateResult,
  riskClassOf,
  evaluateGate,
  evaluateGateFromRisk,
  isPermitted,
  requiredExplanation,
} from './risk-verdict.js';

// W3: Governance-Owned Artifacts & Mission Overlays
export {
  GOVERNANCE_ARTIFACT_KINDS,
  type GovernanceArtifactKind,
  GovernanceArtifactSchema,
  type GovernanceArtifact,
  GovernanceArtifactRegistry,
  governanceArtifactRegistry,
  MissionOverlaySchema,
  type MissionOverlay,
  MissionOverlayRegistry,
  missionOverlayRegistry,
  createMissionOverlay,
} from './artifacts.js';

// W3: Governance Spine — unified autonomy/governance/decision/capability
export {
  GovernanceSpine,
  governanceSpine,
  evaluateThroughSpine,
  getCurrentAutonomyMode,
  createOverlayThroughSpine,
  getOverlayDeltaThroughSpine,
} from './spine.js';
