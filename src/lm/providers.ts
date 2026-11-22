/**
 * Provider facade (M3 split). Public surface unchanged — every symbol the
 * module previously exported is re-exported from its focused home:
 *
 * - `./providers/settings.ts`      — LM settings install/read
 * - `./providers/webllm.ts`        — browser WebLLM runtime + device detect
 * - `./providers/model-factory.ts` — createSeNARSRegistry + model constructors
 * - `./providers/capabilities.ts`  — per-model capability metadata
 * - `./providers/chains.ts`        — provider→task model chains + resolution
 * - `./providers/routing.ts`       — routing policy, demotions, scoring, offline ladder
 * - `./providers/health.ts`        — probes, circuit breakers, health probes
 */
export type { LMTask } from '@senars/types/llm';
export type { LMSettings } from './env-config';
export { cloudApiKey, formatLMConfig } from './env-config';
export type {
  CircuitBreakerSettings,
  CircuitState,
  LMProviderName,
  ProviderHealth,
  ProviderRuntime,
  QualityObjective,
  RoutingDecision,
  RoutingObjective,
  RoutingPolicy,
  RoutingTelemetryEntry,
  WebLLMRuntime,
} from './provider-runtime';
export { getProviderRuntime, PROVIDER_CIRCUIT_DEFAULTS } from './provider-runtime';
export type { ModelCapability } from './providers/capabilities';
export {
  getModelCapability,
  MODEL_CAPABILITIES,
} from './providers/capabilities';
export {
  getModelChain,
  getModelForTask,
  getQualityModel,
  hasCloudCredentials,
} from './providers/chains';
export { probeEmbeddedLlama } from './providers/embedded-llamacpp';
export {
  canUseProvider,
  getAllCircuitBreakers,
  getCircuitBreaker,
  getEffectiveCircuitConfig,
  probeCloudProvider,
  probeOpenAICompatible,
  recordProviderCall,
  resetCircuitBreakers,
  resolveActiveProvider,
  startHealthProbes,
  stopHealthProbes,
} from './providers/health';
export { probeLlamaCpp } from './providers/llamacpp';
export type {
  ModelDownloadProgressCallback,
  SeNARSModelId,
  SeNARSRegistry,
} from './providers/model-factory';
export {
  createSeNARSRegistry,
  getBuiltinProgressCallback,
  localModel,
  mockModel,
  setBuiltinProgressCallback,
} from './providers/model-factory';
export { fetchBounded, probeModelsEndpoint } from './providers/probe';
export type { CandidateScore, ModelReliability } from './providers/routing';
export {
  demoteModel,
  disableRoutingTelemetry,
  enableRoutingTelemetry,
  getDemotions,
  getLastRoutingDecision,
  getRouting,
  getRoutingLogStatus,
  getRoutingStatus,
  logRoutingDecision,
  pickBestModel,
  pickModel,
  resetDemotions,
  resolveOfflineModel,
  resolveOfflineTier,
  setRouting,
} from './providers/routing';
export {
  configureLM,
  getActiveProvider,
  getLMSettings,
  getLmProvider,
  setActiveProvider,
} from './providers/settings';
export { configureWebLLM, detectDevice, getWebLLMRuntime } from './providers/webllm';
