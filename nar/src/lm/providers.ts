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
export type { LMTask } from '@senars/util';
export type { LMSettings } from './env-config.js';

export type {
  CircuitBreakerConfig,
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
} from './provider-runtime.js';
export { getProviderRuntime, PROVIDER_CIRCUIT_DEFAULTS } from './provider-runtime.js';
export type { ModelCapability } from './providers/capabilities.js';
export {
  getModelCapability,
  MODEL_CAPABILITIES,
} from './providers/capabilities.js';
export {
  getModelChain,
  getModelForTask,
  getQualityModel,
  hasCloudCredentials,
} from './providers/chains.js';
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
} from './providers/health.js';
export type {
  ModelDownloadProgressCallback,
  SeNARSModelId,
  SeNARSRegistry,
} from './providers/model-factory.js';
export {
  cloudApiKey,
  createSeNARSRegistry,
  getBuiltinProgressCallback,
  localModel,
  mockModel,
  setBuiltinProgressCallback,
} from './providers/model-factory.js';
export type { CandidateScore } from './providers/routing.js';
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
} from './providers/routing.js';
export { configureLM, getLMSettings, getLmProvider } from './providers/settings.js';
export { configureWebLLM, detectDevice, getWebLLMRuntime } from './providers/webllm.js';
