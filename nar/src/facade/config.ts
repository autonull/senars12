import type { AutonomyMode, ReasoningBudget } from '@senars/core/derivation-schemas';
import type { MettaPort } from '@senars/core/metta-port';
import type { SystemOneConfig as SystemOneConfigSchema } from '@senars/util/config';
import type { ToolFeedbackObserver } from '@senars/util/feedback';
import type { CognitiveRegistry } from '../cognitive';
import type { CognitiveParameters } from '../config/cognitive-parameters';
import type { GateRegistry } from '../kernel/GateRegistry.js';
import type { LMService, SeNARSRegistry } from '../lm';
import type { EmbeddingCache } from '../lm/system-one/embedding-cache.js';
import type { JudgmentManifold } from '../lm/system-one/types.js';
import type { NarEventBus } from '../types/events.js';
import type { RandomSource } from '../types/primitives.js';
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
  /**
   * MeTTa engine seam. `metta` sits above `nar` in the layering, so the engine
   * is injected by the composition root rather than imported. Absent ⇒ the
   * `metta` tool reports `metta engine not configured`.
   */
  metta?: MettaPort;
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
  /** Phase B (REFACTOR.todo2): episodic consolidation as an AIKR process (inert until admit/emit sinks are wired). */
  episodeConsolidation?: { enabled?: boolean; capacity?: number; budget?: number };
  /** Phase D (REFACTOR.todo2): bounded proposal bag for self-improvement routing (default off ⇒ arrival order). */
  proposals?: { bounded?: boolean; capacity?: number; budget?: number };
  /** Phase D (REFACTOR.todo2): bounded hard-negative mining bag (default off ⇒ direct mining). */
  hardNegativeMining?: { bounded?: boolean; capacity?: number; budget?: number; marginFloor?: number };
  /** Phase E: ProofMettaProposer as a negotiation proposer (learns from proof stream). */
  proofMettaProposer?: { enabled?: boolean; maxRules?: number; minConfidence?: number; patternMinSupport?: number };
  /** Initial autonomy mode for the action gate (default: 'observe-only'). */
  initialAutonomyMode?: AutonomyMode;
  /** Injectable event bus; defaults to a fresh `NarEventBus`. */
  eventBus?: NarEventBus;
  /** Disable embedding layer for semantic similarity (saves resources when no embedding model). */
  enableEmbeddingLayer?: boolean;
}

export function validateNarConfig(config: NARConfig): NARConfig {
  if (config.maxConcepts <= 0) {
    throw new ConfigurationError('maxConcepts must be positive', {
      maxConcepts: config.maxConcepts,
    });
  }
  return config;
}

