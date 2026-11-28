/**
 * Phase C (REFACTOR.todo1): the AIKR-Bounded Processor — a six-stage bag
 * pattern (admit → accumulate → trigger → process → emit → decay) shared by
 * every self-maintaining cognitive process (SchemaInductor, ContrastiveMemory).
 * All accumulation is capacity-bounded, decays, evicts, and triggers only
 * under pressure (AIKR); processing is interruptible via AbortSignal and
 * deterministic under an injected RandomSource.
 */
import { type RandomSource } from '@senars/util/random';
import type { Bag, BagItem, BagOptions } from '@senars/bag';
/**
 * One answer for the AIKR pressure gate. A process that declares a different
 * threshold is making a deliberate, named choice — not quietly restating this.
 */
export declare const DEFAULT_PRESSURE_THRESHOLD = 0.7;
/** Items examined per pass when a caller names no budget. */
export declare const DEFAULT_AIKR_BUDGET = 4;
export interface BagSamplingStrategy<T extends BagItem> {
    readonly name: string;
    readonly description: string;
    /** Select up to `budget` items; never mutates the source array. */
    select(items: T[], budget: number, rng: RandomSource): T[];
}
/** Shared options for AIKR-bounded bags (capacity, pressure, decay, budget). */
export interface AikrBagOptions {
    /** Bag capacity (AIKR bound). */
    capacity?: number;
    /**
     * Pressure threshold below which processing is inert
     * (default {@link DEFAULT_PRESSURE_THRESHOLD}).
     */
    pressureThreshold?: number;
    /** Priority floor below which decayed items are forgotten (bag forgetRate). */
    forgetRate?: number;
    /** Default items examined per pass (default {@link DEFAULT_AIKR_BUDGET}). */
    budget?: number;
    /** Injected randomness for sampling (default `ambientRng`). */
    rng?: RandomSource;
}
/** One construction path for every AIKR-bounded bag — capacity is the caller's bound, the rest threads through. */
export declare const createAikrBag: <T extends BagItem>(options: AikrBagOptions & Pick<BagOptions, 'clock' | 'id'> & {
    capacity: number;
}) => Bag<T>;
export declare const FAIRNESS_TRACKED_CAPACITY = 1024;
/**
 * Softmax over priority with temperature (default T=1.0). Controllable
 * exploration/exploitation: T→∞ uniform, T→0 greedy.
 */
export declare class BagPrioritySampling<T extends BagItem> implements BagSamplingStrategy<T> {
    private readonly temperature;
    readonly name = "priority-softmax";
    readonly description = "Softmax over priority with temperature";
    constructor(temperature?: number);
    select(items: T[], budget: number, rng: RandomSource): T[];
}
/** Power-law weights `priority^α` — α>1 exploits the tail, α<1 explores. */
export declare class PowerLawSampling<T extends BagItem> implements BagSamplingStrategy<T> {
    private readonly alpha;
    readonly name = "power-law";
    readonly description = "Power-law weights over priority";
    constructor(alpha?: number);
    select(items: T[], budget: number, rng: RandomSource): T[];
}
/**
 * Aging boost: `effectivePriority = priority × (1 + ageFactor ×
 * cyclesSinceLastSample)`. Guarantees stale items eventually reappear
 * (Proof Obligation #6, scheduler fairness).
 */
export declare class FairnessSampling<T extends BagItem> implements BagSamplingStrategy<T> {
    #private;
    private readonly ageFactor;
    private readonly temperature;
    readonly name = "fairness";
    readonly description = "Aging boost for stale item fairness";
    constructor(ageFactor?: number, temperature?: number);
    select(items: T[], budget: number, rng: RandomSource): T[];
    /** Aging counters of an item since its last selection. */
    cyclesSinceLastSample(id: string): number;
}
/** Truncate to the top-k priorities, then softmax within the truncated set. */
export declare class TopKSampling<T extends BagItem> implements BagSamplingStrategy<T> {
    private readonly temperature;
    private readonly k?;
    readonly name = "top-k";
    readonly description = "Top-k truncation with softmax";
    constructor(temperature?: number, k?: number | undefined);
    select(items: T[], budget: number, rng: RandomSource): T[];
}
/** Legacy raw proportional sampling — exact `PriorityBag.sample()` parity. */
export declare class PriorityProportional<T extends BagItem> implements BagSamplingStrategy<T> {
    readonly name = "priority-proportional";
    readonly description = "Raw priority-proportional sampling";
    select(items: T[], budget: number, rng: RandomSource): T[];
}
export interface AIKRProcessorOptions<TIn extends BagItem, TOut = unknown> {
    /** The bounded, decaying accumulation bag. */
    bag: Bag<TIn>;
    /** Sampling strategy for the process stage (default softmax T=1.0). */
    samplingStrategy?: BagSamplingStrategy<TIn>;
    /**
     * Pressure threshold below which `processIfPressured` is inert
     * (default {@link DEFAULT_PRESSURE_THRESHOLD}).
     */
    pressureThreshold?: number;
    rng?: RandomSource;
    /** The actual work over sampled items; may be async and abortable. */
    process: (items: TIn[], signal?: AbortSignal) => Promise<TOut[]> | TOut[];
}
export interface ProcessOptions {
    budget?: number;
    signal?: AbortSignal;
}
export declare class AIKRProcessor<TIn extends BagItem, TOut> {
    #private;
    constructor(options: AIKRProcessorOptions<TIn, TOut>);
    /** Stage 1 — admit (bag enforces capacity + priority eviction). */
    admit(item: TIn): boolean;
    /** Stage 2 — accumulate (bag pressure). */
    pressure(): number;
    /** Stages 3–5 — trigger, sample, process, emit. */
    process(options?: ProcessOptions): Promise<TOut[]>;
    /** Inert below the pressure threshold (AIKR budget conservation). */
    processIfPressured(options?: ProcessOptions): Promise<TOut[]>;
    /** Stage 6 — decay (forget stale items). */
    decay(_rate?: number): void;
    get samplingStrategyName(): string;
    get size(): number;
}
/** Everything a self-maintaining cognitive process contributes to its AIKR shell. */
export interface AikrShellOptions<TIn extends BagItem, TOut, TView, TAdmit = TIn> extends AikrBagOptions, Pick<BagOptions, 'clock' | 'id'> {
    /** Bag capacity (AIKR bound) — the one bound a process must choose for itself. */
    capacity: number;
    /** Project a bagged candidate onto the domain value `peek` reports. */
    view: (item: TIn) => TView;
    /** Public admit input → bagged candidate; defaults to the identity. */
    admit?: (value: TAdmit) => TIn;
    /** Name the sampling strategy reports under. */
    samplingStrategy: string;
    /** Select up to `budget` accumulated candidates; never mutates the source array. */
    select: (items: TIn[], budget: number, rng: RandomSource) => TIn[];
    /** The actual work over sampled items; may be async and abortable. */
    process: (items: TIn[], signal?: AbortSignal) => Promise<TOut[]> | TOut[];
}
/**
 * The six delegating stages every self-maintaining cognitive process exposes
 * over an {@link AIKRProcessor} — admit, drain, drain-if-pressured, decay,
 * pressure, size, peek. Each process owns different *names* for these
 * (`drain`/`consolidate`/`induceNow`), so the shared body lives here and the
 * process keeps only its public spelling.
 *
 * The constructor is the one construction path for a bounded cognitive process:
 * bag, processor and shell are wired from a single spec, so no site re-derives
 * the wiring or restates the AIKR defaults.
 *
 * `TAdmit` is the type callers hand to {@link AikrShell.admit}, which is
 * usually a domain value (`Episode`, `MinedNegative`) the process wraps into a
 * scored candidate, and the bag item only when it does not.
 */
export declare class AikrShell<TIn extends BagItem, TOut, TView = TOut, TAdmit = TIn> {
    #private;
    readonly bag: Bag<TIn>;
    readonly processor: AIKRProcessor<TIn, TOut>;
    constructor(options: AikrShellOptions<TIn, TOut, TView, TAdmit>);
    /** Stage 1 — admit (bag enforces capacity + priority eviction). */
    admit(value: TAdmit): boolean;
    /** Stages 3–5 — explicit drain, ignoring the pressure gate. */
    drain(options?: ProcessOptions): Promise<TOut[]>;
    /** Inert below the pressure threshold (AIKR budget conservation). */
    drainIfPressured(options?: ProcessOptions): Promise<TOut[]>;
    /** Stage 6 — decay (forget stale accumulation). */
    decay(_rate?: number): void;
    get pressure(): number;
    get size(): number;
    /** Bounded introspection: the bagged candidates, projected. */
    peek(): TView[];
}
//# sourceMappingURL=aikr-processor.d.ts.map