/**
 * Phase C (REFACTOR.todo1): the AIKR-Bounded Processor — a six-stage bag
 * pattern (admit → accumulate → trigger → process → emit → decay) shared by
 * every self-maintaining cognitive process (SchemaInductor, ContrastiveMemory).
 * All accumulation is capacity-bounded, decays, evicts, and triggers only
 * under pressure (AIKR); processing is interruptible via AbortSignal and
 * deterministic under an injected RandomSource.
 */
import type { Bag, BagItem } from '../bag/Bag.js';
import type { RandomSource } from '../types/primitives.js';

export interface SamplingStrategy<T extends BagItem> {
  readonly name: string;
  /** Select up to `budget` items; never mutates the source array. */
  select(items: T[], budget: number, rng: RandomSource): T[];
}

const softmaxWeights = <T>(
  items: T[],
  scoreOf: (item: T) => number
): {
  item: T;
  weight: number;
}[] => {
  const raw = items.map((item) => scoreOf(item));
  const max = Math.max(...raw, 0);
  const exps = raw.map((r) => Math.exp(r - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return items.map((item, i) => ({ item, weight: exps[i]! / sum }));
};

/** Sample `budget` items without replacement by weighted roulette. */
const weightedWithoutReplacement = <T>(
  weighted: { item: T; weight: number }[],
  budget: number,
  rng: RandomSource
): T[] => {
  const pool = weighted.filter((w) => w.weight > 0);
  const out: T[] = [];
  for (let i = 0; i < budget && pool.length > 0; i++) {
    const total = pool.reduce((a, w) => a + w.weight, 0);
    if (total <= 0) {
      out.push(pool.shift()!.item);
      continue;
    }
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx]!.weight;
      if (r <= 0) break;
    }
    const picked = pool[Math.min(idx, pool.length - 1)]!;
    out.push(picked.item);
    pool.splice(pool.indexOf(picked), 1);
  }
  return out;
};

/**
 * Softmax over priority with temperature (default T=1.0). Controllable
 * exploration/exploitation: T→∞ uniform, T→0 greedy.
 */
export class PrioritySampling<T extends BagItem> implements SamplingStrategy<T> {
  readonly name = 'priority-softmax';
  constructor(private readonly temperature = 1.0) {}
  select(items: T[], budget: number, rng: RandomSource): T[] {
    const t = Math.max(this.temperature, 1e-9);
    return weightedWithoutReplacement(
      softmaxWeights(items, (item) => item.priority / t),
      budget,
      rng
    );
  }
}

/** Power-law weights `priority^α` — α>1 exploits the tail, α<1 explores. */
export class PowerLawSampling<T extends BagItem> implements SamplingStrategy<T> {
  readonly name = 'power-law';
  constructor(private readonly alpha = 1.5) {}
  select(items: T[], budget: number, rng: RandomSource): T[] {
    return weightedWithoutReplacement(
      softmaxWeights(items, (item) => Math.log(Math.max(item.priority, 1e-9) ** this.alpha)),
      budget,
      rng
    );
  }
}

/**
 * Aging boost: `effectivePriority = priority × (1 + ageFactor ×
 * cyclesSinceLastSample)`. Guarantees stale items eventually reappear
 * (Proof Obligation #6, scheduler fairness).
 */
export class FairnessSampling<T extends BagItem> implements SamplingStrategy<T> {
  readonly name = 'fairness';
  #sinceSampled = new Map<string, number>();
  constructor(
    private readonly ageFactor = 0.5,
    private readonly temperature = 1.0
  ) {}

  select(items: T[], budget: number, rng: RandomSource): T[] {
    const t = Math.max(this.temperature, 1e-9);
    const picked = weightedWithoutReplacement(
      softmaxWeights(items, (item) => {
        const age = this.#sinceSampled.get(item.id) ?? 0;
        return (item.priority * (1 + this.ageFactor * age)) / t;
      }),
      budget,
      rng
    );
    const pickedIds = new Set(picked.map((p) => p.id));
    for (const item of items) {
      this.#sinceSampled.set(
        item.id,
        pickedIds.has(item.id) ? 0 : (this.#sinceSampled.get(item.id) ?? 0) + 1
      );
    }
    return picked;
  }

  /** Aging counters of an item since its last selection. */
  cyclesSinceLastSample(id: string): number {
    return this.#sinceSampled.get(id) ?? 0;
  }
}

/** Truncate to the top-k priorities, then softmax within the truncated set. */
export class TopKSampling<T extends BagItem> implements SamplingStrategy<T> {
  readonly name = 'top-k';
  constructor(
    private readonly temperature = 1.0,
    private readonly k?: number
  ) {}
  select(items: T[], budget: number, rng: RandomSource): T[] {
    const k = Math.max(this.k ?? budget, budget);
    const top = [...items].sort((a, b) => b.priority - a.priority).slice(0, k);
    const t = Math.max(this.temperature, 1e-9);
    return weightedWithoutReplacement(
      softmaxWeights(top, (item) => item.priority / t),
      budget,
      rng
    );
  }
}

/** Legacy raw proportional sampling — exact `PriorityBag.sample()` parity. */
export class PriorityProportional<T extends BagItem> implements SamplingStrategy<T> {
  readonly name = 'priority-proportional';
  select(items: T[], budget: number, rng: RandomSource): T[] {
    const pool = items.slice();
    const out: T[] = [];
    for (let i = 0; i < budget && pool.length > 0; i++) {
      const total = pool.reduce((a, item) => a + Math.max(item.priority, 0), 0);
      if (total <= 0) {
        out.push(pool.shift()!);
        continue;
      }
      let r = rng() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) {
        r -= Math.max(pool[idx]!.priority, 0);
        if (r <= 0) break;
      }
      const picked = pool[Math.min(idx, pool.length - 1)]!;
      out.push(picked);
      pool.splice(pool.indexOf(picked), 1);
    }
    return out;
  }
}

export interface AIKRProcessorOptions<TIn extends BagItem, TOut = unknown> {
  /** The bounded, decaying accumulation bag. */
  bag: Bag<TIn>;
  /** Sampling strategy for the process stage (default softmax T=1.0). */
  samplingStrategy?: SamplingStrategy<TIn>;
  /** Pressure threshold below which `processIfPressured` is inert (default 0.7). */
  pressureThreshold?: number;
  rng?: RandomSource;
  /** The actual work over sampled items; may be async and abortable. */
  process: (items: TIn[], signal?: AbortSignal) => Promise<TOut[]> | TOut[];
}

export interface ProcessOptions {
  budget?: number;
  signal?: AbortSignal;
}

export class AIKRProcessor<TIn extends BagItem, TOut> {
  readonly #bag: Bag<TIn>;
  readonly #strategy: SamplingStrategy<TIn>;
  readonly #threshold: number;
  readonly #rng: RandomSource;
  readonly #process: (items: TIn[], signal?: AbortSignal) => Promise<TOut[]> | TOut[];

  constructor(options: AIKRProcessorOptions<TIn, TOut>) {
    this.#bag = options.bag;
    this.#strategy = options.samplingStrategy ?? new PrioritySampling();
    this.#threshold = options.pressureThreshold ?? 0.7;
    this.#rng = options.rng ?? Math.random;
    this.#process = options.process;
  }

  /** Stage 1 — admit (bag enforces capacity + priority eviction). */
  admit(item: TIn): boolean {
    return this.#bag.add(item);
  }

  /** Stage 2 — accumulate (bag pressure). */
  pressure(): number {
    return this.#bag.pressure();
  }

  /** Stages 3–5 — trigger, sample, process, emit. */
  async process(options: ProcessOptions = {}): Promise<TOut[]> {
    const budget = options.budget ?? 4;
    const items: TIn[] = [];
    for (const item of this.#bag.all()) items.push(item);
    const sampled = this.#strategy.select(items, budget, this.#rng);
    if (sampled.length === 0) return [];
    const results = await this.#process(sampled, options.signal);
    // An aborted batch is not consumed — items stay for a later pass.
    if (!options.signal?.aborted) {
      for (const item of sampled) this.#bag.remove(item.id);
    }
    return results;
  }

  /** Inert below the pressure threshold (AIKR budget conservation). */
  async processIfPressured(options: ProcessOptions = {}): Promise<TOut[]> {
    if (this.pressure() < this.#threshold) return [];
    return this.process(options);
  }

  /** Stage 6 — decay (forget stale items). */
  decay(rate?: number): void {
    this.#bag.decay(rate);
  }

  get samplingStrategyName(): string {
    return this.#strategy.name;
  }

  get size(): number {
    return this.#bag.size();
  }
}
