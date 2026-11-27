/**
 * Phase C (REFACTOR.todo1): the AIKR-Bounded Processor — a six-stage bag
 * pattern (admit → accumulate → trigger → process → emit → decay) shared by
 * every self-maintaining cognitive process (SchemaInductor, ContrastiveMemory).
 * All accumulation is capacity-bounded, decays, evicts, and triggers only
 * under pressure (AIKR); processing is interruptible via AbortSignal and
 * deterministic under an injected RandomSource.
 */
import { ambientRng, weightedSample, weightedSampleBy } from '@senars/util/random';
import { incrementCount, selectTopN } from '@senars/util/collections';
import { LruCache } from '@senars/util/lru-cache';
import { invTemperature, softmaxWeights } from '@senars/util/numeric';
import { createBag } from '@senars/bag';
/**
 * One answer for the AIKR pressure gate. A process that declares a different
 * threshold is making a deliberate, named choice — not quietly restating this.
 */
export const DEFAULT_PRESSURE_THRESHOLD = 0.7;
/** Items examined per pass when a caller names no budget. */
export const DEFAULT_AIKR_BUDGET = 4;
/** One construction path for every AIKR-bounded bag — capacity is the caller's bound, the rest threads through. */
export const createAikrBag = (options) => createBag({
    capacity: options.capacity,
    forgetRate: options.forgetRate,
    rng: options.rng,
    ...(options.clock ? { clock: options.clock } : {}),
    ...(options.id ? { id: options.id } : {}),
});
export const FAIRNESS_TRACKED_CAPACITY = 1024;
/**
 * Softmax over priority with temperature (default T=1.0). Controllable
 * exploration/exploitation: T→∞ uniform, T→0 greedy.
 */
export class BagPrioritySampling {
    temperature;
    name = 'priority-softmax';
    description = 'Softmax over priority with temperature';
    constructor(temperature = 1.0) {
        this.temperature = temperature;
    }
    select(items, budget, rng) {
        const t = invTemperature(this.temperature);
        return weightedSampleBy(softmaxWeights(items, (item) => item.priority * t), budget, rng);
    }
}
/** Power-law weights `priority^α` — α>1 exploits the tail, α<1 explores. */
export class PowerLawSampling {
    alpha;
    name = 'power-law';
    description = 'Power-law weights over priority';
    constructor(alpha = 1.5) {
        this.alpha = alpha;
    }
    select(items, budget, rng) {
        return weightedSampleBy(softmaxWeights(items, (item) => Math.log(Math.max(item.priority, 1e-9) ** this.alpha)), budget, rng);
    }
}
/**
 * Aging boost: `effectivePriority = priority × (1 + ageFactor ×
 * cyclesSinceLastSample)`. Guarantees stale items eventually reappear
 * (Proof Obligation #6, scheduler fairness).
 */
export class FairnessSampling {
    ageFactor;
    temperature;
    name = 'fairness';
    description = 'Aging boost for stale item fairness';
    /** Aging counters, bounded by recency: unbounded, this grew with every id the bag ever admitted. */
    #sinceSampled = new LruCache({
        maxSize: FAIRNESS_TRACKED_CAPACITY,
    });
    constructor(ageFactor = 0.5, temperature = 1.0) {
        this.ageFactor = ageFactor;
        this.temperature = temperature;
    }
    select(items, budget, rng) {
        const t = invTemperature(this.temperature);
        const picked = weightedSampleBy(softmaxWeights(items, (item) => {
            const age = this.#sinceSampled.get(item.id) ?? 0;
            return item.priority * (1 + this.ageFactor * age) * t;
        }), budget, rng);
        const pickedIds = new Set(picked.map(({ id }) => id));
        for (const { id } of items) {
            if (pickedIds.has(id))
                this.#sinceSampled.set(id, 0);
            else
                incrementCount(this.#sinceSampled, id);
        }
        return picked;
    }
    /** Aging counters of an item since its last selection. */
    cyclesSinceLastSample(id) {
        return this.#sinceSampled.get(id) ?? 0;
    }
}
/** Truncate to the top-k priorities, then softmax within the truncated set. */
export class TopKSampling {
    temperature;
    k;
    name = 'top-k';
    description = 'Top-k truncation with softmax';
    constructor(temperature = 1.0, k) {
        this.temperature = temperature;
        this.k = k;
    }
    select(items, budget, rng) {
        const k = Math.max(this.k ?? budget, budget);
        const top = selectTopN(items, k, (item) => item.priority);
        const t = invTemperature(this.temperature);
        return weightedSampleBy(softmaxWeights(top, (item) => item.priority * t), budget, rng);
    }
}
/** Legacy raw proportional sampling — exact `PriorityBag.sample()` parity. */
export class PriorityProportional {
    name = 'priority-proportional';
    description = 'Raw priority-proportional sampling';
    select(items, budget, rng) {
        return weightedSample(items, budget, (item) => item.priority, rng);
    }
}
export class AIKRProcessor {
    #bag;
    #strategy;
    #threshold;
    #rng;
    #process;
    constructor(options) {
        this.#bag = options.bag;
        this.#strategy = options.samplingStrategy ?? new BagPrioritySampling();
        this.#threshold = options.pressureThreshold ?? DEFAULT_PRESSURE_THRESHOLD;
        this.#rng = options.rng ?? ambientRng;
        this.#process = options.process;
    }
    /** Stage 1 — admit (bag enforces capacity + priority eviction). */
    admit(item) {
        return this.#bag.add(item);
    }
    /** Stage 2 — accumulate (bag pressure). */
    pressure() {
        const level = this.#bag.pressure();
        return level === 'critical' ? 1 : level === 'elevated' ? 0.5 : 0;
    }
    /** Stages 3–5 — trigger, sample, process, emit. */
    async process(options = {}) {
        const budget = options.budget ?? DEFAULT_AIKR_BUDGET;
        const items = [];
        for (const item of this.#bag.all())
            items.push(item);
        const sampled = this.#strategy.select(items, budget, this.#rng);
        if (sampled.length === 0)
            return [];
        const results = await this.#process(sampled, options.signal);
        // An aborted batch is not consumed — items stay for a later pass.
        if (!options.signal?.aborted) {
            const ids = new Set(sampled.map((item) => item.id));
            this.#bag.removeAll((item) => ids.has(item.id));
        }
        return results;
    }
    /** Inert below the pressure threshold (AIKR budget conservation). */
    async processIfPressured(options = {}) {
        if (this.pressure() < this.#threshold)
            return [];
        return this.process(options);
    }
    /** Stage 6 — decay (forget stale items). */
    decay(_rate) {
        this.#bag.decay();
    }
    get samplingStrategyName() {
        return this.#strategy.name;
    }
    get size() {
        return this.#bag.size;
    }
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
export class AikrShell {
    bag;
    processor;
    #budget;
    #view;
    #admit;
    constructor(options) {
        const bag = createAikrBag(options);
        this.bag = bag;
        this.#budget = options.budget ?? DEFAULT_AIKR_BUDGET;
        this.#view = options.view;
        this.#admit = options.admit ?? ((value) => value);
        this.processor = new AIKRProcessor({
            bag,
            pressureThreshold: options.pressureThreshold,
            rng: options.rng,
            samplingStrategy: { name: options.samplingStrategy, description: options.samplingStrategy, select: options.select },
            process: options.process,
        });
    }
    /** Stage 1 — admit (bag enforces capacity + priority eviction). */
    admit(value) {
        return this.bag.add(this.#admit(value));
    }
    /** Stages 3–5 — explicit drain, ignoring the pressure gate. */
    drain(options = {}) {
        return this.processor.process({ ...options, budget: options.budget ?? this.#budget });
    }
    /** Inert below the pressure threshold (AIKR budget conservation). */
    drainIfPressured(options = {}) {
        return this.processor.processIfPressured({
            ...options,
            budget: options.budget ?? this.#budget,
        });
    }
    /** Stage 6 — decay (forget stale accumulation). */
    decay(_rate) {
        this.processor.decay();
    }
    get pressure() {
        return this.processor.pressure();
    }
    get size() {
        return this.bag.size;
    }
    /** Bounded introspection: the bagged candidates, projected. */
    peek() {
        return [...this.bag.all()].map(this.#view);
    }
}
