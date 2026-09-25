import { type BagItem, PriorityBag } from '../../bag/Bag.js';
import { AIKRProcessor, PrioritySampling } from '../../learning/aikr-processor.js';
import type { EmbeddingCache, JudgmentQuery } from './types.js';

/** Domain-level rubric shared by all contrastive consumers (gate, grader, routing). */
export const DOMAIN_RUBRIC = 'domain';

export type ContrastiveScorerFn = (embedding: Float32Array, rubric?: string) => number | undefined;

/** Rubric a query is judged under (mirrors the manifold's head lookup rule). */
export function rubricOf(query: JudgmentQuery): string {
  return query.kind === 'classify' ? (query.rubric ?? 'task_type') : query.rubric;
}

export function cosineF32(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface InfoNCECalibration {
  /** Learned logit scale (CLIP-style inverse temperature). */
  scale: number;
  bias: number;
  /** Final mean InfoNCE loss over the fit pairs. */
  loss: number;
}

export interface InfoNCEPair {
  query: Float32Array;
  positive: Float32Array;
  negatives: readonly Float32Array[];
}

/**
 * Bidirectional InfoNCE over frozen embeddings: learns (scale, bias) that
 * separate (query, positive) logits from (query, negative) logits via softmax
 * cross-entropy. Deterministic full-batch SGD; the contrastive analogue of a
 * calibrated decision head with no projection layer.
 */
export function fitInfoNCE(
  pairs: readonly InfoNCEPair[],
  options: { epochs?: number; lr?: number; scaleInit?: number } = {}
): InfoNCECalibration {
  const epochs = options.epochs ?? 100;
  const lr = options.lr ?? 0.1;
  let scale = options.scaleInit ?? 10;
  let bias = 0;
  let loss = Number.POSITIVE_INFINITY;

  for (let epoch = 0; epoch < epochs; epoch++) {
    let dScale = 0;
    let dBias = 0;
    loss = 0;
    for (const { query, positive, negatives } of pairs) {
      const cosPos = Math.max(-1, Math.min(1, cosineF32(query, positive)));
      const cosNegs = negatives.map((n) => Math.max(-1, Math.min(1, cosineF32(query, n))));
      const logits = [scale * cosPos + bias, ...cosNegs.map((c) => scale * c + bias)];
      const max = Math.max(...logits);
      const exp = logits.map((l) => Math.exp(l - max));
      const sum = exp.reduce((a, b) => a + b, 0);
      const probs = exp.map((e) => e / sum);
      loss += -Math.log(probs[0]!);
      // dL/dz_0 = p_0 − 1; dL/dz_j = p_j; z_i = scale·c_i + bias
      dScale += (probs[0]! - 1) * cosPos;
      dBias += probs[0]! - 1;
      cosNegs.forEach((c, j) => {
        dScale += probs[j + 1]! * c;
        dBias += probs[j + 1]!;
      });
    }
    const n = pairs.length || 1;
    scale = Math.min(100, Math.max(0.1, scale - (lr * dScale) / n));
    bias = Math.min(10, Math.max(-10, bias - (lr * dBias) / n));
  }
  return { scale, bias, loss: loss / (pairs.length || 1) };
}

export interface ContrastiveMemoryConfig {
  /** Per-rubric exemplar budget (positives get the 60% replay share). */
  maxPerRubric?: number;
  /** Replay mix: fraction of the budget reserved for positives (CLM 40/60). */
  positiveShare?: number;
  /** Zero-shot logit scale before calibration. */
  scale?: number;
}

export interface RubricExemplarStats {
  positives: number;
  negatives: number;
  calibrated: boolean;
}

/** Bag item for a stored exemplar (Phase C — AIKR-bounded self-maintenance). */
export interface ExemplarItem extends BagItem {
  kind: 'pos' | 'neg';
  embedding: Float32Array;
}

interface RubricState {
  pos: PriorityBag<ExemplarItem>;
  neg: PriorityBag<ExemplarItem>;
  /** Pending high-confidence judgments awaiting AIKR-bounded promotion. */
  pending: PriorityBag<ExemplarItem>;
  maintainer: import('../../learning/aikr-processor.js').AIKRProcessor<ExemplarItem, number>;
}

/**
 * Rubric-scoped contrastive exemplar memory (CLM System One): positives and
 * hard negatives per rubric under a 40/60 replay-mix cap, InfoNCE temperature
 * calibration, and zero-shot cosine scoring for uncalibrated heads.
 */
export class ContrastiveMemory {
  readonly #maxPerRubric: number;
  readonly #positiveShare: number;
  readonly #zeroShotScale: number;
  /** Phase C: per-rubric exemplar bags (priority eviction, decay, 40/60 caps). */
  readonly #rubrics = new Map<string, RubricState>();
  #calibrations = new Map<string, InfoNCECalibration>();

  constructor(config: ContrastiveMemoryConfig = {}) {
    this.#maxPerRubric = config.maxPerRubric ?? 128;
    this.#positiveShare = config.positiveShare ?? 0.6;
    this.#zeroShotScale = config.scale ?? 10;
  }

  /** Add exemplar texts (embedded via the shared cache) under a rubric; returns added count. */
  async add(
    rubric: string,
    exemplars: { positives?: readonly string[]; negatives?: readonly string[] },
    cache: EmbeddingCache
  ): Promise<number> {
    let added = 0;
    for (const text of exemplars.positives ?? []) {
      const emb = await this.#embed(text, cache);
      if (emb && this.#admit(rubric, { kind: 'pos', embedding: emb })) added++;
    }
    for (const text of exemplars.negatives ?? []) {
      const emb = await this.#embed(text, cache);
      if (emb && this.#admit(rubric, { kind: 'neg', embedding: emb })) added++;
    }
    return added;
  }

  /** Add pre-computed exemplar embeddings directly (for text-redacted sources
   *  like the distillation dataset); returns stored count. */
  addEmbeddings(
    rubric: string,
    exemplars: { positives?: readonly Float32Array[]; negatives?: readonly Float32Array[] }
  ): number {
    let added = 0;
    for (const emb of exemplars.positives ?? []) {
      if (this.#admit(rubric, { kind: 'pos', embedding: emb })) added++;
    }
    for (const emb of exemplars.negatives ?? []) {
      if (this.#admit(rubric, { kind: 'neg', embedding: emb })) added++;
    }
    return added;
  }

  /** Fit InfoNCE scale/bias for a rubric from its stored exemplars (leave-one-out positives). */
  calibrate(
    rubric: string,
    options: { epochs?: number; lr?: number } = {}
  ): InfoNCECalibration | undefined {
    const positives = this.#positives(rubric);
    const negatives = this.#negatives(rubric);
    if (positives.length < 2 || negatives.length === 0) return undefined;

    // Leave-one-out mean positive: each positive is judged against the rest of
    // its own class, so memorizable singletons cannot trivially win.
    const dim = positives[0]!.length;
    const meanPositive = (skip: number): Float32Array => {
      const acc = new Float32Array(dim);
      let count = 0;
      for (const [i, p] of positives.entries()) {
        if (i === skip) continue;
        for (let d = 0; d < dim; d++) acc[d]! += p[d]!;
        count++;
      }
      if (count === 0) return positives[skip]!;
      for (let d = 0; d < dim; d++) acc[d] = acc[d]! / count;
      return acc;
    };

    const pairs = positives.map((query, i) => ({
      query,
      positive: meanPositive(i),
      negatives,
    }));
    const calibration = fitInfoNCE(pairs, options);
    this.#calibrations.set(rubric, calibration);
    return calibration;
  }

  /** Calibrate every rubric that has both classes; returns fitted rubric ids. */
  calibrateAll(options: { epochs?: number; lr?: number } = {}): string[] {
    return [...this.#rubrics.keys()].filter((rubric) => !!this.calibrate(rubric, options));
  }

  /**
   * Zero-shot/calibrated contrastive score in (0,1): best-positive similarity
   * minus best-negative similarity passed through the learned logit. When no
   * rubric is given, the best score across all stored rubrics is returned
   * (cross-rubric in-domain-ness). Undefined when no exemplars exist.
   */
  score(embedding: Float32Array, rubric?: string): number | undefined {
    if (rubric === undefined) {
      let best: number | undefined;
      for (const r of this.#rubrics.keys()) {
        const s = this.score(embedding, r);
        if (s !== undefined && (best === undefined || s > best)) best = s;
      }
      return best;
    }
    const positives = this.#positives(rubric);
    const negatives = this.#negatives(rubric);
    if (positives.length === 0 && negatives.length === 0) return undefined;

    const maxPos = positives.reduce((best, p) => Math.max(best, cosineF32(embedding, p)), -1);
    const maxNeg = negatives.reduce((best, n) => Math.max(best, cosineF32(embedding, n)), -1);
    const calibration = this.#calibrations.get(rubric);
    const scale = calibration?.scale ?? this.#zeroShotScale;
    const bias = calibration?.bias ?? 0;
    return 1 / (1 + Math.exp(-(scale * (maxPos - maxNeg) + bias)));
  }

  /** Max cosine over every stored exemplar — in-domain-ness for OOD routing. */
  routingScore(embedding: Float32Array): number | undefined {
    let best = -1;
    let seen = 0;
    for (const rubric of this.#rubrics.keys()) {
      for (const emb of [...this.#positives(rubric), ...this.#negatives(rubric)]) {
        best = Math.max(best, cosineF32(embedding, emb));
        seen++;
      }
    }
    return seen === 0 ? undefined : Math.max(0, best);
  }

  has(rubric = DOMAIN_RUBRIC): boolean {
    const state = this.#rubrics.get(rubric);
    return !!state && (state.pos.size() > 0 || state.neg.size() > 0);
  }

  isEmpty(): boolean {
    return [...this.#rubrics.values()].every((s) => s.pos.size() === 0 && s.neg.size() === 0);
  }

  stats(): Record<string, RubricExemplarStats> {
    return Object.fromEntries(
      [...this.#rubrics.entries()].map(([rubric, s]) => [
        rubric,
        {
          positives: s.pos.size(),
          negatives: s.neg.size(),
          calibrated: this.#calibrations.has(rubric),
        },
      ])
    );
  }

  clear(): void {
    this.#rubrics.clear();
    this.#calibrations.clear();
  }

  /**
   * Phase C: per-cycle decay — stale exemplar priority erodes; items below the
   * forget floor drop out, keeping the pool fresh (flywheel maintenance).
   */
  decay(rate?: number): void {
    for (const state of this.#rubrics.values()) {
      state.pos.decay(rate);
      state.neg.decay(rate);
      state.pending.decay(rate);
    }
  }

  /**
   * Phase C: judgment auto-admission — a high-confidence decision is admitted
   * to the exemplar pool when it improves discrimination margin (flywheel:
   * judgments → exemplars → better calibrated judgments).
   */
  observeJudgment(
    rubric: string,
    embedding: Float32Array,
    judgment: { label: 'pos' | 'neg'; confidence: number },
    options: { admitThreshold?: number } = {}
  ): boolean {
    if (judgment.confidence < (options.admitThreshold ?? 0.8)) return false;
    const positives = this.#positives(rubric);
    const negatives = this.#negatives(rubric);
    const maxPos = positives.reduce((best, p) => Math.max(best, cosineF32(embedding, p)), -1);
    const maxNeg = negatives.reduce((best, n) => Math.max(best, cosineF32(embedding, n)), -1);
    const margin = Math.max(0, maxPos - maxNeg);
    const state = this.#rubricState(rubric);
    return state.maintainer.admit({
      id: `${judgment.label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      priority: margin * judgment.confidence,
      kind: judgment.label,
      embedding,
    });
  }

  /** Promote pending judgments into the exemplar pool when pressure allows. */
  async maintainIfPressured(options: { budget?: number } = {}): Promise<number> {
    let promoted = 0;
    for (const state of this.#rubrics.values()) {
      const counts = await state.maintainer.processIfPressured(options);
      promoted += counts.reduce((a, b) => a + b, 0);
    }
    return promoted;
  }

  #rubricState(rubric: string): RubricState {
    let state = this.#rubrics.get(rubric);
    if (!state) {
      const posCap = Math.max(1, Math.round(this.#maxPerRubric * this.#positiveShare));
      const negCap = Math.max(1, this.#maxPerRubric - posCap);
      const pos = new PriorityBag<ExemplarItem>({ capacity: posCap });
      const neg = new PriorityBag<ExemplarItem>({ capacity: negCap });
      const pending = new PriorityBag<ExemplarItem>({ capacity: 64 });
      // Phase C: the second AIKRProcessor instantiation — pending judgments
      // promote into the exemplar bags under pressure (flywheel closure).
      const maintainer = new AIKRProcessor<ExemplarItem, number>({
        bag: pending,
        samplingStrategy: new PrioritySampling(1.0),
        pressureThreshold: 0.7,
        process: (items) => {
          let promoted = 0;
          for (const item of items) {
            if ((item.kind === 'pos' ? pos : neg).add(item)) promoted++;
          }
          return [promoted];
        },
      });
      state = { pos, neg, pending, maintainer };
      this.#rubrics.set(rubric, state);
    }
    return state;
  }

  /** Margin-weighted admission into the priority bag (capacity-evicting). */
  #admit(
    rubric: string,
    exemplar: { kind: 'pos' | 'neg'; embedding: Float32Array },
    priority?: number
  ): boolean {
    const state = this.#rubricState(rubric);
    const margin = (() => {
      const others = exemplar.kind === 'pos' ? this.#negatives(rubric) : this.#positives(rubric);
      if (others.length === 0) return 1;
      const maxCos = others.reduce(
        (best, o) => Math.max(best, cosineF32(exemplar.embedding, o)),
        -1
      );
      return 1 - maxCos; // discrimination vs the opposing class
    })();
    const item: ExemplarItem = {
      id: `${exemplar.kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      priority: Math.max(1e-6, priority ?? margin),
      kind: exemplar.kind,
      embedding: exemplar.embedding,
    };
    const bag = exemplar.kind === 'pos' ? state.pos : state.neg;
    const admitted = bag.add(item);
    if (admitted) state.maintainer?.admit(item);
    return admitted;
  }

  #positives(rubric: string): Float32Array[] {
    const state = this.#rubrics.get(rubric);
    if (!state) return [];
    return [...state.pos.all()].map((e) => e.embedding);
  }

  #negatives(rubric: string): Float32Array[] {
    const state = this.#rubrics.get(rubric);
    if (!state) return [];
    return [...state.neg.all()].map((e) => e.embedding);
  }

  async #embed(text: string, cache: EmbeddingCache): Promise<Float32Array | undefined> {
    try {
      const pointer = await cache.write(text);
      const buffer = cache.read(pointer);
      return buffer?.slice();
    } catch {
      return undefined;
    }
  }
}

export function createContrastiveMemory(config?: ContrastiveMemoryConfig): ContrastiveMemory {
  return new ContrastiveMemory(config);
}
