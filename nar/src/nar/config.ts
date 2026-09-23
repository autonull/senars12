import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { SystemOneConfig as SystemOneConfigSchema } from '@senars/util/config';
import type { ToolFeedbackObserver } from '@senars/util/feedback';
import type { CognitiveRegistry } from '../cognitive';
import type { CognitiveParameters } from '../config/cognitive-parameters';
import type { GateRegistry } from '../kernel/GateRegistry.js';
import type { LMService, SeNARSRegistry } from '../lm';
import type { EmbeddingCache } from '../lm/system-one/embedding-cache.js';
import type { JudgmentManifold } from '../lm/system-one/types.js';
import type { AttentionModel } from '../strategies';
import type { RandomSource } from '../types/primitives.js';
import { SimpleAttention } from '../strategies';
import { ConfigurationError, type CoreConfig } from '../types';

export interface RLFPConfig {
  optimizeInterval?: number;
}

/** File-validated System One config (zod-inferred, single source of truth — G6). */
export type SystemOneFileConfig = SystemOneConfigSchema;

/** Runtime config extending the file config with injected runtime objects. */
export interface SystemOneRuntimeConfig extends Omit<SystemOneFileConfig, 'manifold'> {
  manifold?: SystemOneFileConfig['manifold'] | JudgmentManifold;
  embeddingCache?: EmbeddingCache;
  reasoningBudget?: ReasoningBudget;
}

/** Back-compat alias for the runtime config. */
export type SystemOneConfig = SystemOneRuntimeConfig;

export interface NARConfig extends CoreConfig {
  lmService?: LMService;
  providerRegistry?: SeNARSRegistry;
  enableLMRules?: boolean;
  enableTools?: boolean;
  enableSelf?: boolean;
  enableRLFP?: boolean;
  rlfp?: RLFPConfig;
  enableBidirectionalFeedback?: boolean;
  enableProactiveEnrichment?: boolean;
  enableLMStreaming?: boolean;
  persistState?: boolean;
  statePath?: string;

  cognitiveParams?: CognitiveParameters;
  strategyRegistry?: CognitiveRegistry;
  adaptationInterval?: number;
  feedbackObserver?: ToolFeedbackObserver;
  /** TODO19 F2: per-instance gate registry; defaults to a fresh isolated instance. */
  gateRegistry?: GateRegistry;

  systemOne?: Partial<SystemOneConfig>;
  /** TODO20 §5s: injectable RNG — one knob for deterministic replay (threads to focus bags). */
  rng?: RandomSource;
}

export function validateNarConfig(config: NARConfig): NARConfig {
  if (config.maxConcepts <= 0) {
    throw new ConfigurationError('maxConcepts must be positive', {
      maxConcepts: config.maxConcepts,
    });
  }
  return config;
}

export function createAttentionModel(config: NARConfig): AttentionModel {
  const type = config.cognitiveParams?.strategies.attention.type;
  if (!type) return new SimpleAttention();
  return config.strategyRegistry?.get('attention', type) ?? new SimpleAttention();
}
