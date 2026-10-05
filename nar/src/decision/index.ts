/**
 * The decision layer's contracts, nameable by the core.
 *
 * The vocabulary (`JudgmentQuery`, `SynthesisQuery`, their propositions and
 * `CognitiveAxis`) plus the stamps a decision carries. A core module may import
 * this without importing the induction layer, which is what lets A11's port be
 * typed in the committed vocabulary rather than a paraphrase of it.
 */

export {
  ADMISSION_ORDER_CALL_SITE,
  DECISION_AXES,
  DECISION_CALL_SITE_IDS,
  DECISION_CALL_SITES,
  DECISION_POSITIONS,
  DECISION_QUERIES,
  type DecisionCallSite,
} from './call-sites.js';
export {
  createProvisionalStamp,
  isProvisionalStamp,
  type ProvisionalStamp,
} from './provisional-stamp.js';
export { asRubricId, COGNITIVE_AXES, cognitiveAxisSchema, RUBRIC_IDS, rubricIdSchema } from './types.js';
export { SYNTHESIS_AXIS } from '../ports/decision.js';
export type {
  BackendId,
  Calibration,
  CalibrationVersion,
  ClassifyProposition,
  ClassifyQuery,
  CognitiveAxis,
  CognitiveContext,
  CognitiveDispatcher,
  ConsensusResult,
  CortexHealth,
  CriticalityLevel,
  EmbeddingCache,
  EmbeddingPointer,
  EvaluateProposition,
  EvaluateQuery,
  GenerativeCortex,
  HeadResult,
  JudgmentHead,
  JudgmentManifold,
  JudgmentProposition,
  JudgmentQuery,
  ManifoldHealth,
  ModelDigest,
  PEAResult,
  PropositionBase,
  QueryId,
  ResourceCost,
  RubricId,
  ScoreLegend,
  SynthesisProposition,
  SynthesisQuery,
} from './types.js';
export { createSystemOneBudget, SYSTEM_ONE_BUDGET_DEFAULTS } from './types.js';
