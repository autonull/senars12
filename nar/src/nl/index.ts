export type { TranslationCacheEntry } from './cache.js';
export { TranslationCache } from './cache.js';
export type { ClarificationRequest } from './clarification.js';
export { ClarificationHandler, generateClarificationWithLM } from './clarification.js';
export type { NarseseIntent } from './narsese-intent.js';
export { dispatchNarseseIntent } from './narsese-intent.js';
export type { InputType } from './classifier.js';
export { classify } from './classifier.js';
export type { ContextAssemblerOpts } from './context-assembler.js';
export { ContextAssembler } from './context-assembler.js';
export type { FirewallOptions, FirewallVerdict } from './firewall.js';
export { defaultFirewall, SymbolicFirewall } from './firewall.js';
export type {
  BeliefInfo,
  ConflictInfo,
  DerivationTrace,
  GenerationInput,
  GenerationOutput,
} from './generation.js';
export { NLGenerationService } from './generation.js';
export { AmbiguitySchema, AnalogySchema, BeliefRevisionSchema, ClarificationSchema, ConceptElaborationSchema, CoreferenceSchema, ExplanationSchema, GenerationOutputSchema, GoalDecompositionSchema, HypothesisSchema, MetaReasoningSchema, NarseseBeliefSchema, QuestionGenerationSchema, SchemaInductionSchema, TaskBatchSchema, TemporalCausalSchema, TranslationSchema, UncertaintySchema, VariableGroundingSchema } from './schemas.js';
export type { AnalogyResult, BeliefRevisionResult, ClarificationResult, ConceptElaborationResult, ExplanationResult, GoalDecompositionResult, HypothesisResult, MetaReasoningResult, QuestionGenerationResult, SchemaInductionResult, TemporalCausalResult, TranslationResult, UncertaintyResult, VariableGroundingResult } from './schemas.js';
export type { Ambiguity, Coreference, NLContext, TaskBatch } from './understanding.js';
export {
  detectAmbiguityFlags,
  locateSpan,
  NLUnderstandingService,
  toFormalizationBatch,
} from './understanding.js';
