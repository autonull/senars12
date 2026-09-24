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

interface ExemplarBucket {
  positives: Float32Array[];
  negatives: Float32Array[];
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
  #buckets = new Map<string, ExemplarBucket>();
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
    const bucket = this.#bucket(rubric);
    let added = 0;
    for (const text of exemplars.positives ?? []) {
      const emb = await this.#embed(text, cache);
      if (emb) {
        bucket.positives.push(emb);
        added++;
      }
    }
    for (const text of exemplars.negatives ?? []) {
      const emb = await this.#embed(text, cache);
      if (emb) {
        bucket.negatives.push(emb);
        added++;
      }
    }
    this.#enforceReplayMix(bucket);
    return added;
  }

  /** Fit InfoNCE scale/bias for a rubric from its stored exemplars (leave-one-out positives). */
  calibrate(
    rubric: string,
    options: { epochs?: number; lr?: number } = {}
  ): InfoNCECalibration | undefined {
    const bucket = this.#buckets.get(rubric);
    if (!bucket || bucket.positives.length < 2 || bucket.negatives.length === 0) return undefined;

    // Leave-one-out mean positive: each positive is judged against the rest of
    // its own class, so memorizable singletons cannot trivially win.
    const dim = bucket.positives[0]!.length;
    const meanPositive = (skip: number): Float32Array => {
      const acc = new Float32Array(dim);
      let count = 0;
      for (const [i, p] of bucket.positives.entries()) {
        if (i === skip) continue;
        for (let d = 0; d < dim; d++) acc[d]! += p[d]!;
        count++;
      }
      if (count === 0) return bucket.positives[skip]!;
      for (let d = 0; d < dim; d++) acc[d] = acc[d]! / count;
      return acc;
    };

    const pairs = bucket.positives.map((query, i) => ({
      query,
      positive: meanPositive(i),
      negatives: bucket.negatives,
    }));
    const calibration = fitInfoNCE(pairs, options);
    this.#calibrations.set(rubric, calibration);
    return calibration;
  }

  /** Calibrate every rubric that has both classes; returns fitted rubric ids. */
  calibrateAll(options: { epochs?: number; lr?: number } = {}): string[] {
    return [...this.#buckets.keys()].filter((rubric) => !!this.calibrate(rubric, options));
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
      for (const r of this.#buckets.keys()) {
        const s = this.score(embedding, r);
        if (s !== undefined && (best === undefined || s > best)) best = s;
      }
      return best;
    }
    const bucket = this.#buckets.get(rubric);
    if (!bucket) return undefined;
    const hasPositives = bucket.positives.length > 0;
    if (!hasPositives && bucket.negatives.length === 0) return undefined;

    const maxPos = hasPositives
      ? bucket.positives.reduce((best, p) => Math.max(best, cosineF32(embedding, p)), -1)
      : 0;
    const maxNeg = bucket.negatives.reduce((best, n) => Math.max(best, cosineF32(embedding, n)), -1);
    const calibration = this.#calibrations.get(rubric);
    const scale = calibration?.scale ?? this.#zeroShotScale;
    const bias = calibration?.bias ?? 0;
    return 1 / (1 + Math.exp(-(scale * (maxPos - maxNeg) + bias)));
  }

  /** Max cosine over every stored exemplar — in-domain-ness for OOD routing. */
  routingScore(embedding: Float32Array): number | undefined {
    let best = -1;
    let seen = 0;
    for (const bucket of this.#buckets.values()) {
      for (const p of bucket.positives) {
        best = Math.max(best, cosineF32(embedding, p));
        seen++;
      }
      for (const n of bucket.negatives) {
        best = Math.max(best, cosineF32(embedding, n));
        seen++;
      }
    }
    return seen === 0 ? undefined : Math.max(0, best);
  }

  has(rubric = DOMAIN_RUBRIC): boolean {
    const bucket = this.#buckets.get(rubric);
    return !!bucket && (bucket.positives.length > 0 || bucket.negatives.length > 0);
  }

  isEmpty(): boolean {
    return [...this.#buckets.values()].every(
      (b) => b.positives.length === 0 && b.negatives.length === 0
    );
  }

  stats(): Record<string, RubricExemplarStats> {
    return Object.fromEntries(
      [...this.#buckets.entries()].map(([rubric, b]) => [
        rubric,
        {
          positives: b.positives.length,
          negatives: b.negatives.length,
          calibrated: this.#calibrations.has(rubric),
        },
      ])
    );
  }

  clear(): void {
    this.#buckets.clear();
    this.#calibrations.clear();
  }

  #bucket(rubric: string): ExemplarBucket {
    let bucket = this.#buckets.get(rubric);
    if (!bucket) {
      bucket = { positives: [], negatives: [] };
      this.#buckets.set(rubric, bucket);
    }
    return bucket;
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

  /** FIFO-capped buckets: positives hold the 60% replay share, negatives 40%. */
  #enforceReplayMix(bucket: ExemplarBucket): void {
    const posCap = Math.max(1, Math.round(this.#maxPerRubric * this.#positiveShare));
    const negCap = Math.max(1, this.#maxPerRubric - posCap);
    while (bucket.positives.length > posCap) bucket.positives.shift();
    while (bucket.negatives.length > negCap) bucket.negatives.shift();
  }
}

export function createContrastiveMemory(config?: ContrastiveMemoryConfig): ContrastiveMemory {
  return new ContrastiveMemory(config);
}
