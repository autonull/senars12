/**
 * Phase C (REFACTOR.todo1): the AIKR-Bounded Processor — a six-stage bag
 * pattern (admit → accumulate → trigger → process → emit → decay) shared by
 * every self-maintaining cognitive process (SchemaInductor, ContrastiveMemory).
 * All accumulation is capacity-bounded, decays, evicts, and triggers only
 * under pressure (AIKR); processing is interruptible via AbortSignal and
 * deterministic under an injected RandomSource.
 */
import { softmax } from '@senars/util';
import type { Bag, BagItem } from '../bag/Bag.js';
import type { RandomSource } from '../types/primitives.js';
import { selectTopN } from '../utils/collections.js';
import { weightedSample, weightedSampleBy } from '../utils/random.js';

export interface SamplingStrategy<T extends BagItem> {
  readonly name: string;
  /** Select up to `budget` items; never mutates the source array. */
  select(items: T[], budget: number, rng: RandomSource): T[];
}

/** Shared options for AIKR-bounded bags (capacity, pressure, decay, budget). */
export interface AikrBagOptions {
  /** Bag capacity (AIKR bound). */
  capacity?: number;
  /** Pressure threshold below which processing is inert (default 0.7). */
  pressureThreshold?: number;
  /** Priority floor below which decayed items are forgotten (bag forgetRate). */
  forgetRate?: number;
  /** Default items examined per pass (default 4). */
  budget?: number;
  /** Injected randomness for sampling (default Math.random). */
  rng?: RandomSource;
}

const softmaxWeights = <T>(
  items: T[],
  scoreOf: (item: T) => number
): {
  item: T;
  weight: number;
}[] => {
  const exps = softmax(items.map((item) => scoreOf(item)));
  return items.map((item, i) => ({ item, weight: exps[i]! }));
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
    return weightedSampleBy(
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
    return weightedSampleBy(
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
    const picked = weightedSampleBy(
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
    const top = selectTopN(items, k, (item) => item.priority);
    const t = Math.max(this.temperature, 1e-9);
    return weightedSampleBy(
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
    return weightedSample(items, budget, (item) => item.priority, rng);
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

export interface AikrShellOptions<TIn extends BagItem, TOut, TView, TAdmit> {
  bag: Bag<TIn>;
  processor: AIKRProcessor<TIn, TOut>;
  /** Default items examined per pass when a call passes no budget. */
  budget: number;
  /** Project a bagged candidate onto the domain value `peek` reports. */
  view: (item: TIn) => TView;
  /** Public admit input → bagged candidate; defaults to the identity. */
  admit?: (value: TAdmit) => TIn;
}

/**
 * The six delegating stages every self-maintaining cognitive process exposes
 * over an {@link AIKRProcessor} — admit, drain, drain-if-pressured, decay,
 * pressure, size, peek. Each process owns different *names* for these
 * (`drain`/`consolidate`/`induceNow`), so the shared body lives here and the
 * process keeps only its public spelling.
 *
 * `TAdmit` is the type callers hand to {@link AikrShell.admit}, which is
 * usually a domain value (`Episode`, `MinedNegative`) the process wraps into a
 * scored candidate, and the bag item only when it does not.
 */
export class AikrShell<TIn extends BagItem, TOut, TView = TOut, TAdmit = TIn> {
  readonly bag: Bag<TIn>;
  readonly processor: AIKRProcessor<TIn, TOut>;
  readonly #budget: number;
  readonly #view: (item: TIn) => TView;
  readonly #admit: (value: TAdmit) => TIn;

  constructor(options: AikrShellOptions<TIn, TOut, TView, TAdmit>) {
    this.bag = options.bag;
    this.processor = options.processor;
    this.#budget = options.budget;
    this.#view = options.view;
    this.#admit = options.admit ?? ((value) => value as unknown as TIn);
  }

  /** Stage 1 — admit (bag enforces capacity + priority eviction). */
  admit(value: TAdmit): boolean {
    return this.bag.add(this.#admit(value));
  }

  /** Stages 3–5 — explicit drain, ignoring the pressure gate. */
  drain(options: ProcessOptions = {}): Promise<TOut[]> {
    return this.processor.process({ ...options, budget: options.budget ?? this.#budget });
  }

  /** Inert below the pressure threshold (AIKR budget conservation). */
  drainIfPressured(options: ProcessOptions = {}): Promise<TOut[]> {
    return this.processor.processIfPressured({ ...options, budget: options.budget ?? this.#budget });
  }

  /** Stage 6 — decay (forget stale accumulation). */
  decay(rate?: number): void {
    this.processor.decay(rate);
  }

  get pressure(): number {
    return this.processor.pressure();
  }

  get size(): number {
    return this.bag.size();
  }

  /** Bounded introspection: the bagged candidates, projected. */
  peek(): TView[] {
    return [...this.bag.all()].map(this.#view);
  }
}
