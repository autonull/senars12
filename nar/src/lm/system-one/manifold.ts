import type { ReasoningBudget } from '@senars/kernel/schemas';
import { v4 as uuidv4 } from 'uuid';
import { validateBatchQueries } from './algebra.js';
import { ContrastiveMemory, rubricOf } from './contrastive.js';
import {
  createDefaultCalibrationSuite,
  type DriftDemotionConfig,
  DriftDemotionManager,
  type IsotonicCalibrator,
  type RollingECEConfig,
  RollingECEMonitor,
} from './calibration.js';
import {
  applyCalibrationLock,
  assertLockMatches,
  type CalibrationLock,
} from './calibration-fit.js';
import {
  createAllActionHeads,
  createAllIngressHeads,
  createAllMemoryHeads,
  createAllSynthesisHeads,
  type PerHeadConfig,
} from './heads/index.js';
import type {
  BackendId,
  CalibrationVersion,
  ClassifyProposition,
  ConsensusResult,
  EmbeddingCache,
  EmbeddingPointer,
  EvaluateProposition,
  HeadResult,
  JudgmentHead,
  JudgmentManifold,
  JudgmentProposition,
  JudgmentQuery,
  ManifoldHealth,
  ModelDigest,
  ResourceCost,
  RubricId,
} from './types.js';

export interface ManifoldConfig {
  backendId: BackendId;
  modelDigest: ModelDigest;
  calibrationVersion: CalibrationVersion;
  embeddingCache: EmbeddingCache;
  heads: Map<string, JudgmentHead>;
  rollingECEConfig?: Partial<RollingECEConfig>;
  driftDemotionConfig?: Partial<DriftDemotionConfig>;
  maxBatchSize: number;
  maxLatencyMs: number;
  abstainThreshold: number;
  /** Optional callback invoked for each resolved judgment proposition.
   *  Allows consumers to emit kernel events and metrics without coupling the manifold to the event system. */
  onProposition?: (proposition: JudgmentProposition, query: JudgmentQuery) => void;
  /** Digest-pinned calibration lock (D2): fitted calibrators + per-head abstain thresholds. */
  calibrationLock?: CalibrationLock;
  /** CLM contrastive exemplar memory: zero-shot cosine fallback when heads are unfitted. */
  contrastive?: ContrastiveMemory;
}

function entropy(distribution: readonly { option: string; p: number }[]): number {
  let h = 0;
  for (const { p } of distribution) {
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

function topOption(distribution: readonly { option: string; p: number }[]): {
  option: string;
  p: number;
} {
  let best = distribution[0]!;
  for (const d of distribution) {
    if (d.p > best.p) best = d;
  }
  return best;
}

function makeProposition(
  query: JudgmentQuery,
  result: HeadResult,
  base: Omit<JudgmentProposition, 'kind' | 'axis' | 'distribution' | 'top' | 'entropy' | 'score'>
): JudgmentProposition {
  if (query.kind === 'classify') {
    const dist =
      result.distribution ??
      query.space.map((opt, i) => ({
        option: opt,
        p: i === 0 ? 1.0 : 0.0,
      }));
    return {
      ...base,
      kind: 'classify',
      axis: query.axis,
      distribution: dist,
      top: topOption(dist),
      entropy: entropy(dist),
    };
  } else {
    return {
      ...base,
      kind: 'evaluate',
      axis: query.axis,
      score: result.score,
      legend: result.legend ?? evaluateLegend(query, result.score),
    };
  }
}

/** Score legend fallback: build the probability-weighted position from the
 *  query's declared levels when the head did not emit one. */
function evaluateLegend(query: JudgmentQuery, score: number) {
  if (query.kind !== 'evaluate') return undefined;
  const levels = query.levels;
  if (!levels || levels.length < 2) return undefined;
  const n = levels.length;
  const weights = levels.map((_, i) => Math.max(0, 1 - Math.abs(score - i / (n - 1)) * (n - 1)));
  const total = weights.reduce((a: number, b) => a + b, 0) || 1;
  return { levels, weights: weights.map((w) => w / total) };
}

export class SystemOneManifold implements JudgmentManifold {
  #config: ManifoldConfig;
  #health: ManifoldHealth;
  #rollingECEMonitor: RollingECEMonitor;
  #driftDemotion: DriftDemotionManager;
  #cycleCounter = 0;
  #calibrators: Map<string, IsotonicCalibrator>;
  #contrastive?: ContrastiveMemory;
  /** Head-size recommendation (scaling laws): 0 when uncomputed. */
  #suggestedHeadSize = 0;

  constructor(config: ManifoldConfig) {
    this.#config = config;
    this.#contrastive = config.contrastive;
    this.#calibrators = createDefaultCalibrationSuite(config.calibrationVersion);
    if (config.calibrationLock) {
      assertLockMatches(config.calibrationLock, config.modelDigest);
      applyCalibrationLock(this.#calibrators, config.calibrationLock);
    }

    this.#rollingECEMonitor = new RollingECEMonitor(config.rollingECEConfig);
    this.#driftDemotion = new DriftDemotionManager(config.driftDemotionConfig);
    this.#driftDemotion.registerBackend(config.backendId, this.#calibrators);

    this.#health = {
      backendId: config.backendId,
      ready: true,
      breakerOpen: false,
      rollingEce: 0,
      queueDepth: 0,
    };
  }

  async judgeBatch(
    sharedContext: EmbeddingPointer,
    queries: readonly JudgmentQuery[],
    _budget: ReasoningBudget
  ): Promise<JudgmentProposition[]> {
    const startTime = performance.now();

    if (queries.length > this.#config.maxBatchSize) {
      throw new Error(`Batch size ${queries.length} exceeds max ${this.#config.maxBatchSize}`);
    }

    validateBatchQueries(queries);

    const contextEmbedding = this.#config.embeddingCache.read(sharedContext);
    if (!contextEmbedding) {
      throw new Error(`Embedding not found for pointer ${sharedContext}`);
    }

    this.#health.queueDepth = queries.length;
    const results: JudgmentProposition[] = [];

    for (const query of queries) {
      const rubric = rubricOf(query);
      const head = this.#config.heads.get(rubric);
      if (!head && !this.#contrastive?.has(rubric)) {
        throw new Error(`No head registered for query: ${query.kind} ${rubric}`);
      }

      const queryStart = performance.now();
      let headResult: HeadResult;

      if (head) {
        try {
          headResult = await head.evaluate(contextEmbedding, query);
        } catch (_e) {
          headResult = {
            score: 0.5,
            abstained: true,
            abstainReason: 'timeout',
          };
        }
      } else {
        // Headless contrastive fallback (CLM zero-shot cosine scoring).
        const score = this.#contrastive?.score(contextEmbedding, rubric);
        headResult =
          score === undefined
            ? { score: 0.5, abstained: true, abstainReason: 'out-of-domain' }
            : { score, abstained: false };
      }

      const latencyMs = Math.ceil(performance.now() - queryStart);

      const base: Omit<
        JudgmentProposition,
        'kind' | 'axis' | 'distribution' | 'top' | 'entropy' | 'score'
      > = {
        queryId: uuidv4() as any,
        backendId: this.#config.backendId,
        modelDigest: this.#config.modelDigest,
        calibration: {
          version: this.#config.calibrationVersion,
          ece: this.#rollingECEMonitor.getRollingECE(),
          fitted:
            head?.fitted === true ||
            (this.#calibrators.get(query.kind === 'classify' ? 'classify' : query.rubric)?.fitted ??
              false),
        },
        latencyMs,
        cost: this.estimateCost(query, latencyMs),
        tier: 1,
        abstained: headResult.abstained,
        abstainReason: headResult.abstainReason,
      };

      const proposition = makeProposition(query, headResult, base);
      results.push(proposition);

      // Emit telemetry via callback (kernel events + metrics)
      if (this.#config.onProposition) {
        this.#config.onProposition(proposition, query);
      }
    }

    const totalLatency = performance.now() - startTime;
    this.#setHealth('latency', totalLatency > this.#config.maxLatencyMs);

    this.#updateCalibration(results);
    this.#cycleCounter++;
    this.#checkDrift();

    this.#health.rollingEce = this.#rollingECEMonitor.getRollingECE();
    this.#health.queueDepth = 0;

    return results;
  }

  async consensus(
    sharedContext: EmbeddingPointer,
    query: JudgmentQuery,
    k: number,
    budget: ReasoningBudget
  ): Promise<ConsensusResult> {
    const fanout = Math.min(k, 3);
    const runs: JudgmentProposition[][] = [];

    // Sampled self-consistency (open technique): heads are deterministic, so
    // repeated judgments are salted per run index — agreement then measures
    // stability under seeded perturbation rather than trivially reading 1.0.
    for (let i = 0; i < fanout; i++) {
      const runQuery =
        i === 0
          ? query
          : ({ ...query, instruction: query.instruction + '\u200b'.repeat(i) } as JudgmentQuery);
      const batch = await this.judgeBatch(sharedContext, [runQuery], budget);
      runs.push(batch);
    }

    const first = runs[0]?.[0];
    if (!first) throw new Error('manifold ensemble produced no verdict');
    let agreement = 1.0;

    if (first.kind === 'classify') {
      const topOptions = runs.map((r) => (r[0]! as ClassifyProposition).top.option);
      const unique = new Set(topOptions);
      agreement = 1 / unique.size;
    } else {
      const scores = runs.map((r) => (r[0]! as EvaluateProposition).score);
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
      agreement = Math.max(0, 1 - variance * 4);
    }

    return {
      proposition: first,
      agreement,
      independent: fanout <= 1,
    };
  }

  health(): ManifoldHealth {
    return { ...this.#health };
  }

  getEmbeddingCache(): EmbeddingCache {
    return this.#config.embeddingCache;
  }

  getCalibrators(): ReadonlyMap<string, IsotonicCalibrator> {
    return this.#calibrators;
  }

  /** Registered judgment heads (Phase F, audit M4 — replaces private-name reach-in). */
  getHeads(): ReadonlyMap<string, JudgmentHead> {
    return this.#config.heads;
  }

  getDriftDemotionManager(): DriftDemotionManager {
    return this.#driftDemotion;
  }

  setDemoted(demoted: boolean): void {
    this.#setHealth('manual', demoted);
  }

  registerHead(head: JudgmentHead): void {
    this.#config.heads.set(head.rubric, head);
  }

  /** Per-head abstain thresholds from the loaded calibration lock (empty when unfitted). */
  getAbstainThresholds(): ReadonlyMap<string, number> {
    return new Map(
      (this.#config.calibrationLock?.heads ?? []).map((e) => [e.headId, e.abstainThreshold])
    );
  }

  getCalibrationLock(): CalibrationLock | undefined {
    return this.#config.calibrationLock;
  }

  /**
   * Single health reducer (B9/X25): `ready`/`breakerOpen` derive exclusively from the
   * active cause set. Causes: 'latency' (trips on slow batch, recovers on next healthy
   * batch), 'drift' (demotion manager), 'manual' (setDemoted).
   */
  #healthCauses: { latency: boolean; drift: boolean; manual: boolean } = {
    latency: false,
    drift: false,
    manual: false,
  };

  #setHealth(cause: 'latency' | 'drift' | 'manual', active: boolean): void {
    this.#healthCauses[cause] = active;
    const { latency, drift, manual } = this.#healthCauses;
    this.#health.ready = !(drift || manual);
    this.#health.breakerOpen = latency || drift || manual;
  }

  #estimateCost(query: JudgmentQuery, latencyMs: number): ResourceCost {
    const baseTokens = query.instruction.length / 4;
    return {
      tokensIn: Math.ceil(baseTokens),
      tokensOut: 0,
      computeMs: latencyMs,
      memoryMb: 4,
    };
  }

  estimateCost = this.#estimateCost.bind(this);

  #updateCalibration(results: JudgmentProposition[]): void {
    // Do NOT update calibrators with self-supervised predictions (observed: predicted).
    // Calibrators are only updated from real labels sourced from JudgmentDataset (Phase D).
    // Until then, they remain in unfitted state (fitted: false) and report ECE honestly.

    const totalSamples = results.length;
    const avgECE =
      Array.from(this.#calibrators.values()).reduce((sum, c) => sum + c.getECE(), 0) /
      this.#calibrators.size;
    this.#rollingECEMonitor.record(avgECE, totalSamples);
  }

  #checkDrift(): void {
    const driftResult = this.#driftDemotion.updateCycle(this.#config.backendId, this.#cycleCounter);
    if (driftResult) this.#setHealth('drift', driftResult.demoted);

    const health = this.#driftDemotion.getHealth(this.#config.backendId);
    if (health) this.#setHealth('drift', health.isDemoted);
  }

  syncHealth(): void {
    const health = this.#driftDemotion.getHealth(this.#config.backendId);
    if (health) this.#setHealth('drift', health.isDemoted);
  }

  /** Register or update the telemetry callback for resolved propositions. */
  setPropositionCallback(callback: ManifoldConfig['onProposition']): void {
    this.#config.onProposition = callback;
  }

  /** Current telemetry callback (enables multi-consumer chaining). */
  getPropositionCallback(): ManifoldConfig['onProposition'] {
    return this.#config.onProposition;
  }

  getContrastiveMemory(): ContrastiveMemory | undefined {
    return this.#contrastive;
  }

  /**
   * CLM scaling-law head sizing (Kwok et al. 2026): optimal projection-head
   * width grows as a power law in the labeled-data budget. With N labels and
   * embedding dim D: width = clamp(D · (N/N₀)^0.18, 8, D) — N₀ = 64 labels at
   * full width. Returns the recommended width and stores it for telemetry.
   */
  suggestHeadSize(labelCount: number, embeddingDim = 384): number {
    if (labelCount <= 0) return 0;
    const n0 = 64;
    const raw = embeddingDim * Math.pow(labelCount / n0, 0.18);
    const width = Math.round(Math.min(embeddingDim, Math.max(8, raw)));
    this.#suggestedHeadSize = width;
    return width;
  }

  getLastSuggestedHeadSize(): number {
    return this.#suggestedHeadSize;
  }
}

export function createManifold(
  embeddingCache: EmbeddingCache,
  config: Partial<ManifoldConfig> & { perHeadConfig?: Record<string, PerHeadConfig> } = {}
): SystemOneManifold {
  const backendId = (config.backendId ?? 'encoder-wasm-s1') as BackendId;
  const modelDigest = (config.modelDigest ?? 'sha256:all-MiniLM-L6-v2-heads-v1') as ModelDigest;
  const calibrationVersion = (config.calibrationVersion ?? 'v2.4.1') as CalibrationVersion;

  const heads = new Map<RubricId, JudgmentHead>();
  const abstainThreshold = config.abstainThreshold ?? 0.3;
  const perHeadConfig = config.perHeadConfig ?? {};

  const factoryOptions = { calibrationVersion, embeddingCache, abstainThreshold, perHeadConfig };

  const ingressHeads = createAllIngressHeads(factoryOptions);
  const actionHeads = createAllActionHeads(factoryOptions);
  const synthesisHeads = createAllSynthesisHeads(factoryOptions);
  const memoryHeads = createAllMemoryHeads(factoryOptions);

  for (const [key, head] of ingressHeads) heads.set(key, head);
  for (const [key, head] of actionHeads) heads.set(key, head);
  for (const [key, head] of synthesisHeads) heads.set(key, head);
  for (const [key, head] of memoryHeads) heads.set(key, head);

  const manifoldConfig: ManifoldConfig = {
    backendId,
    modelDigest,
    calibrationVersion,
    embeddingCache,
    heads,
    maxBatchSize: config.maxBatchSize ?? 64,
    maxLatencyMs: config.maxLatencyMs ?? 33,
    abstainThreshold,
    rollingECEConfig: config.rollingECEConfig,
    driftDemotionConfig: config.driftDemotionConfig,
    onProposition: config.onProposition,
    calibrationLock: config.calibrationLock,
    contrastive: config.contrastive,
  };

  return new SystemOneManifold(manifoldConfig);
}
