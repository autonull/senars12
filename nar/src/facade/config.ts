import type { MettaPort } from '@senars/core/metta-port';
import type { AutonomyMode, ReasoningBudget } from '@senars/core/schemas';
import type { IdSource } from '@senars/util';
import type { SystemOneConfig as SystemOneConfigSchema } from '@senars/util/config';
import type { ToolFeedbackObserver } from '@senars/util/feedback';
import type { CognitiveRegistry } from '../cognitive';
import type { CognitiveParameters } from '../config/cognitive-parameters';
import type { BudgetScopeId } from '../kernel/budget-scopes.js';
import type { GateRegistry } from '../kernel/GateRegistry.js';
import type { LMService, SeNARSRegistry } from '../lm';
import type { EmbeddingCache } from '../lm/system-one/embedding-cache.js';
import type { JudgmentManifold } from '../lm/system-one/types.js';
import type { EmbeddingGenerator } from '../memory/embedding.js';
import { ConfigurationError, type CoreConfig } from '../types';
import type { NarEventBus } from '../types/events.js';
import type { RandomSource } from '../types/primitives.js';
import type { DecisionPort } from '../ports/decision.js';

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
  /**
   * TODO29.a §5.11, A11: the decision layer's port into the cycle. **Declaring
   * one is the whole configuration surface** — a bound port is consulted, an
   * absent one is not, and nothing else about `J` or `P` is switchable here.
   * `enableLMRules` was deleted in A2 precisely because a boolean that reads as
   * "no model reasoning" and means "model reasoning that answers nothing" is the
   * defect §9 lists; a port is the honest shape.
   */
  decision?: DecisionPort;
  providerRegistry?: SeNARSRegistry;
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
  /**
   * Id minting for the process this NAR owns. Absent ⇒ `crypto.randomUUID`.
   * Installed for the NAR's lifetime and restored on `dispose`, so a seeded
   * configuration yields reproducible event ids — `rng` fixes the draws, this
   * fixes the names the draws are recorded under.
   */
  ids?: IdSource;
  /** Phase B (REFACTOR.todo2): episodic consolidation as an AIKR process (inert until admit/emit sinks are wired). */
  episodeConsolidation?: { enabled?: boolean; capacity?: number; budget?: number };
  /** Phase D (REFACTOR.todo2): bounded proposal bag for self-improvement routing (default off ⇒ arrival order). */
  proposals?: { bounded?: boolean; capacity?: number; budget?: number };
  /** Phase D (REFACTOR.todo2): bounded hard-negative mining bag (default off ⇒ direct mining). */
  hardNegativeMining?: {
    bounded?: boolean;
    capacity?: number;
    budget?: number;
    marginFloor?: number;
  };
  /** Phase E: ProofMettaProposer as a negotiation proposer (learns from proof stream). */
  proofMettaProposer?: {
    enabled?: boolean;
    maxRules?: number;
    minConfidence?: number;
    patternMinSupport?: number;
  };
  /** Initial autonomy mode for the action gate (default: 'observe-only'). */
  initialAutonomyMode?: AutonomyMode;
  /**
   * Control-budget ceilings, per declared `scopeId` (TODO29.a §5.7). An absent
   * scope uses its declared default, so this is an override and not the
   * declaration — `BUDGET_SCOPES` owns every scope's vocabulary, owner and
   * overflow reason.
   */
  controlBudgets?: Partial<Record<BudgetScopeId, number>>;
  /** Injectable event bus; defaults to a fresh `NarEventBus`. */
  eventBus?: NarEventBus;
  /** Disable embedding layer for semantic similarity (saves resources when no embedding model). */
  enableEmbeddingLayer?: boolean;
  /** Which embedder memory's semantic link layer uses. Unset reads provider settings. */
  embeddingGenerator?: EmbeddingGenerator;
}

export function validateNarConfig(config: NARConfig): NARConfig {
  if (config.maxConcepts <= 0) {
    throw new ConfigurationError('maxConcepts must be positive', {
      maxConcepts: config.maxConcepts,
    });
  }
  return config;
}
