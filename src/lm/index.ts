/**
 * LM — language model configuration, providers, and system one (migrated from @senars/nar/lm).
 */

export { resolveLMConfig, resolveLMSettings } from '@senars/nar/lm';
export { createLMService, createSeNARSRegistry } from '@senars/nar/lm';
export { evaluateQuery } from '@senars/nar/lm/system-one';
export { computeEvidenceId } from '@senars/nar/lm/system-one';
export { probeEmbeddedLlama } from '@senars/nar/lm';
export { getRouting, setRouting, getRoutingLogStatus, getRoutingStatus, getModelChain } from '@senars/nar/lm/providers';
export { readCalibrationLockOrNull } from '@senars/nar/lm/system-one';
export { rubricOf } from '@senars/nar/lm/system-one/contrastive';
export { StubCortex } from '@senars/nar/lm/system-one/dispatcher';
export { createLlamaCppFetch, runWithGrammar } from '@senars/nar/lm/providers/llamacpp';
export { loadGrammar } from '@senars/nar/lm/grammars';
export { JudgmentDataset } from '@senars/nar/lm/system-one/distill';
export { fitCalibrationLock as calibrateFit } from '@senars/nar/lm/system-one/calibration-fit';
export { createSystemOneBudget } from '@senars/nar/lm/system-one/types';
export { CALIBRATION_LOCK_PATH } from '@senars/nar/lm/system-one/calibration-fit';
export { HEAD_SPECS } from '@senars/nar/lm/system-one/head-ontology';
export { SystemOneManifold } from '@senars/nar/lm/system-one/manifold';
export { cloudApiKey, endpointPath, getCircuitBreaker, getEffectiveCircuitConfig, probeJson, probeLlamaCpp, probeModelsEndpoint, resolveOfflineTier, LM_PROVIDER_NAMES, formatLMConfig, isGpuBackend, resetCircuitBreakers, resetDemotions } from '@senars/nar/lm';
export { configureLM, createConfiguredLMRules, resolveEmbeddingGenerator, embeddingRuntime } from '@senars/nar/lm';
export { EmbeddingCache, createEmbeddingCache } from '@senars/nar/lm/system-one/embedding-cache';
export type { TraceGradeInput, TraceGradeResult } from '@senars/nar/lm/system-one/trace-grader';
export { mineHardNegatives } from '@senars/nar/lm/system-one/hard-negatives';
export { SchemaInductor, createSchemaInductor } from '@senars/nar/learning';
export { createFrozenEvalSet, splitOod, evalMetrics, headMetrics, writeEvalSet, loadEvalSet, digestRows } from '@senars/nar/lm/system-one/eval-set';
export { writeCalibrationLock, fitCalibrationLock } from '@senars/nar/lm/system-one/calibration-fit';
export { asRubricId } from '@senars/nar/decision/types';
export type { ScoreDistribution } from '@senars/nar/decision/types';
export { specToQuery } from '@senars/nar/lm/system-one/head-ontology';
export { LM_TASKS } from '@senars/util';
export type { JudgmentQuery } from '@senars/nar/lm/system-one/types';
export type { LMTask } from '@senars/util';
export type { LMProviderName } from '@senars/nar/lm/env-config';