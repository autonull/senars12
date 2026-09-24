import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { SystemOneConfig as SystemOneConfigSchema } from '@senars/util/config';
import type { LMService } from '../lm';
import { createLMServiceCortex } from '../lm/system-one/cortex-adapter.js';
import { ContrastiveMemory } from '../lm/system-one/contrastive.js';
import { createDispatcher, StubCortex } from '../lm/system-one/dispatcher.js';
import { JudgmentDataset } from '../lm/system-one/distill.js';
import { createEmbeddingCache, type EmbeddingCache } from '../lm/system-one/embedding-cache.js';
import { recordEmbeddingCacheEvent } from '../metrics/prometheus.js';
import { createGroundednessGate } from '../lm/system-one/groundedness-gate.js';
import { mineHardNegatives, seedContrastiveMemory } from '../lm/system-one/hard-negatives.js';
import { createHttpManifold } from '../lm/system-one/http-manifold.js';
import { LMReflex } from '../lm/system-one/lm-reflex.js';
import { createManifold } from '../lm/system-one/manifold.js';
import { ManifoldReflex } from '../lm/system-one/manifold-reflex.js';
import type { TraceGradeInput, TraceGradeResult } from '../lm/system-one/trace-grader.js';
import { createTraceGrader } from '../lm/system-one/trace-grader.js';
import type { CognitiveDispatcher, JudgmentManifold } from '../lm/system-one/types.js';
import { composeModelDigest, encoderDigest } from '../lm/system-one/wasi-runtime.js';
import { createLogger } from '../logger';
import { createEmbeddingGenerator } from '../memory/embedding.js';
import { EpsilonGreedyReflex } from '../reflex/EpsilonGreedyReflex.js';
import type { Reflex } from '../reflex/Reflex.js';
import type { NARConfig } from './config.js';

/**
 * System One runtime (extracted from NAR — M2): owns the Tier-1 manifold,
 * embedding cache, dispatcher, groundedness/trace components and their
 * telemetry. Inert unless `config.systemOne.enabled`.
 */
export class SystemOneRuntime {
  readonly embeddingCache?: EmbeddingCache;
  readonly manifold?: JudgmentManifold;
  readonly dispatcher?: CognitiveDispatcher;
  readonly groundednessGate?: (narration: string) => Promise<boolean>;
  readonly traceGrader?: (trace: TraceGradeInput) => Promise<TraceGradeResult>;
  readonly dataset?: JudgmentDataset;
  /** CLM contrastive exemplar memory (zero-shot scoring + hard-negative routing). */
  readonly contrastive = new ContrastiveMemory();

  private readonly config: NARConfig;
  private readonly logger: ReturnType<typeof createLogger>;

  constructor(
    config: NARConfig,
    opts: {
      lmService?: LMService;
      onJudgmentResolved: (proposition: unknown, query?: unknown) => void;
      logger?: ReturnType<typeof createLogger>;
    }
  ) {
    this.config = config;
    this.logger = opts.logger ?? createLogger({ scope: 'NAR.SystemOne' });
    const systemOneConfig = config.systemOne;
    const logger = this.logger;
    if (!systemOneConfig?.enabled) return;

    // Create embedding cache (zero-copy, pooled Float32Array)
    const encoderConfig =
      systemOneConfig.manifold && !('judgeBatch' in systemOneConfig.manifold)
        ? (systemOneConfig.manifold as SystemOneConfigSchema['manifold']).encoder
        : undefined;
    const encoder = createEmbeddingGenerator(undefined, encoderConfig);
    const embeddingCache =
      systemOneConfig.embeddingCache ??
      createEmbeddingCache({
        maxSize: 10000,
        ttlMs: 300_000,
        dimension: encoderConfig?.dimension ?? encoder.dimension,
        generator: encoder,
        metricsSink: recordEmbeddingCacheEvent,
      });
    this.embeddingCache = embeddingCache;

    // Create manifold with per-head config from systemOne config
    let manifold: JudgmentManifold;
    const manifoldFileConfig = systemOneConfig.manifold as
      | SystemOneConfigSchema['manifold']
      | undefined;
    if (manifoldFileConfig?.provider === 'http' && manifoldFileConfig.endpoint) {
      // D4: remote judge over the /v1/systemone wire shape; local cache still
      // produces the context embedding; remote results are untrusted (LLM_PRIOR ceiling).
      manifold = createHttpManifold({
        endpoint: manifoldFileConfig.endpoint,
        embeddingCache,
        timeoutMs: manifoldFileConfig.timeoutMs,
      });
    } else if (systemOneConfig.manifold && 'judgeBatch' in systemOneConfig.manifold) {
      // Pre-built manifold provided
      manifold = systemOneConfig.manifold as JudgmentManifold;
    } else {
      const manifoldConfig = (systemOneConfig.manifold as SystemOneConfigSchema['manifold']) ?? {};
      const perHeadConfig: Record<string, any> = {};
      if (manifoldConfig.heads) {
        for (const [key, headConfig] of Object.entries(manifoldConfig.heads)) {
          perHeadConfig[key] = {
            modelDigest: headConfig.modelDigest,
            calibrationVersion: headConfig.calibrationVersion,
            abstainThreshold: headConfig.abstainThreshold,
            enabled: headConfig.enabled,
          };
        }
      }

      manifold = createManifold(embeddingCache, {
        backendId: 'encoder-wasm-s1' as any,
        modelDigest: composeModelDigest(
          encoderDigest(
            encoderConfig?.modelId ?? 'Xenova/all-MiniLM-L6-v2',
            encoderConfig?.dimension ?? 384
          ),
          'all-MiniLM-L6-v2-heads-v1'
        ) as any,
        calibrationVersion: 'v2.4.1' as any,
        perHeadConfig,
        maxBatchSize: 64,
        maxLatencyMs: 33,
        abstainThreshold: 0.3,
        contrastive: this.contrastive,
      });
    }

    this.manifold = manifold;

    // Emit judgment.resolved telemetry from the real Tier 1 manifold
    if ('setPropositionCallback' in manifold) {
      const m = manifold as {
        setPropositionCallback: (cb: (proposition: any, query: any) => void) => void;
        getPropositionCallback?: () => ((proposition: any, query: any) => void) | undefined;
      };
      const previous = m.getPropositionCallback?.();
      m.setPropositionCallback((proposition, query) => {
        previous?.(proposition, query);
        opts.onJudgmentResolved(proposition, query);
      });
    }

    // Create cortex adapter if provider is not 'off'
    let cortex: import('../lm/system-one/types.js').GenerativeCortex;
    if (
      systemOneConfig.cortex?.provider &&
      systemOneConfig.cortex.provider !== 'off' &&
      opts.lmService
    ) {
      cortex = createLMServiceCortex({
        lmService: opts.lmService,
        grammar: 'narsese-term',
        temperature: 0,
        model: systemOneConfig.cortex?.model,
      });
    } else {
      cortex = new StubCortex('off');
    }

    // Create dispatcher with all four tiers (real manifold as Tier 1)
    this.dispatcher = createDispatcher(
      true,
      {
        embeddingCache,
        tier1Manifold: manifold,
        provisional: {
          cInitial: systemOneConfig.provisional?.cInitial ?? 0.1,
          decayRate: systemOneConfig.provisional?.decayRate ?? 0.3,
          maxTtlMs: systemOneConfig.provisional?.maxTtlMs ?? 30_000,
        },
        contrastive: this.contrastive,
      },
      cortex
    );

    // Create groundedness gate for egress filtering
    this.groundednessGate = createGroundednessGate({
      manifold,
      embeddingCache,
      threshold: 0.7,
      contrastive: this.contrastive,
    });

    // E4: trace grader over the live manifold; dataset auto-flush (D3) when enabled
    const datasetPath = systemOneConfig.distillation?.datasetPath;
    let dataset: JudgmentDataset | undefined;
    if (datasetPath) {
      dataset = new JudgmentDataset();
      dataset.setVectorSidecarPath('.cache/systemone/vectors');
      if (systemOneConfig.distillation?.autoFlush) {
        dataset.startAutoFlush(datasetPath);
      }
    }
    this.dataset = dataset;
    this.traceGrader = createTraceGrader({
      manifold,
      embeddingCache,
      dataset,
      contrastive: this.contrastive,
    });

    logger.info('System One initialized', {
      manifold: this.manifold ? 'enabled' : 'disabled',
      dispatcher: this.dispatcher ? 'enabled' : 'disabled',
      cortex: systemOneConfig.cortex?.provider ?? 'off',
    });
  }

  private get s1Budget(): ReasoningBudget {
    return this.config.systemOne?.reasoningBudget ?? DEFAULT_S1_BUDGET;
  }

  get enabled(): boolean {
    return this.dispatcher !== undefined;
  }

  /**
   * CLM contrastive refresh: mine hard negatives from live NAR state
   * (belief contradictions + episodic errors), seed the exemplar memory,
   * and refit InfoNCE calibrations. Idempotent; no-op when System One is
   * disabled or no belief source is supplied.
   */
  async refreshContrastive(
    nar?: { getBeliefs: () => readonly unknown[] },
    episodic?: import('../memory/EpisodicMemory.js').EpisodicMemory
  ): Promise<void> {
    if (!this.embeddingCache || !nar) return;
    const mined = await mineHardNegatives(nar as never, episodic, { limit: 64 });
    await seedContrastiveMemory(mined, this.contrastive, this.embeddingCache);
    this.contrastive.calibrateAll();
  }

  /**
   * Create and bind a ManifoldReflex to a GameFocus.
   * Returns the created reflex for external management, or undefined if System One is disabled.
   */
  attachManifoldReflex(gameFocus: {
    bindReflex: (reflex: Reflex) => void;
    setReflexPrefetchContext?: (context: {
      manifold: JudgmentManifold;
      embeddingCache: EmbeddingCache;
      budget: ReasoningBudget;
    }) => void;
  }): Reflex | undefined {
    if (!this.dispatcher || !this.manifold || !this.embeddingCache) return undefined;

    // Create incumbent reflex as fallback
    const incumbentReflex = new EpsilonGreedyReflex('incumbent', { numArms: 10, epsilon: 0.1 });

    // Create ManifoldReflex with incumbent fallback
    const manifoldReflex = new ManifoldReflex(incumbentReflex);

    // Bind to the GameFocus
    gameFocus.bindReflex(manifoldReflex);

    // Prefetch at the attend stage of each GameFocus step (C1) — the async gap is
    // absorbed before the synchronous propose contract.
    gameFocus.setReflexPrefetchContext?.({
      manifold: this.manifold,
      embeddingCache: this.embeddingCache,
      budget: this.s1Budget,
    });

    this.logger.info('ManifoldReflex attached to GameFocus');
    return manifoldReflex;
  }

  /**
   * Create and bind an LMReflex to a GameFocus (TODO17 C1): a real LM decides
   * per tick under a GBNF action grammar; the manifold judges its candidates.
   * Undefined when System One (dispatcher) is disabled.
   */
  attachLMReflex(
    gameFocus: {
      bindReflex: (reflex: Reflex) => void;
      setReflexPrefetchContext?: (context: {
        manifold: JudgmentManifold;
        embeddingCache: EmbeddingCache;
        budget: ReasoningBudget;
      }) => void;
    },
    options: { maxCandidates?: number } = {}
  ): Reflex | undefined {
    if (!this.dispatcher || !this.embeddingCache || !this.manifold) return undefined;

    const incumbent = new EpsilonGreedyReflex('lm-incumbent', { numArms: 10, epsilon: 0.1 });
    const lmReflex = new LMReflex({
      fallback: incumbent,
      dispatcher: this.dispatcher,
      embeddingCache: this.embeddingCache,
      budget: this.s1Budget,
      dataset: this.dataset,
      maxCandidates: options.maxCandidates ?? this.config.systemOne?.lmReflex?.maxCandidates ?? 3,
      contrastive: this.contrastive,
    });
    gameFocus.bindReflex(lmReflex);
    gameFocus.setReflexPrefetchContext?.({
      manifold: this.manifold,
      embeddingCache: this.embeddingCache,
      budget: lmReflex.budget,
    });
    this.logger.info('LMReflex attached to GameFocus');
    return lmReflex;
  }
}

const DEFAULT_S1_BUDGET: ReasoningBudget = {
  maxCycles: 100,
  maxDepth: 10,
  maxMemoryOps: 1000,
  maxLMCalls: 5,
  consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
};
