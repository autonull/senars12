import { type BagSlotParams } from '../bag/registration';
import { type StrategyCatalog, type StrategyConfig, type StrategySpec } from '../strategies/registration';
/**
 * Cognitive Architecture Parameters
 *
 * All hyperparameters controlling SeNARS behavior are defined here.
 * These can be tuned, optimized, or evolved without code changes.
 *
 * Categories:
 * - Priority Management: boosts, decay
 * - LM Integration: when and how LM rules fire
 * - Attention Mechanisms: how concepts gain/lose priority
 * - Inference Control: derivation limits
 */
export interface CognitiveParameters {
    /** Priority Management */
    priority: PriorityConfig;
    /** LM Integration */
    lm: LMConfig;
    /** Attention Mechanisms */
    attention: AttentionConfig;
    /** Inference Control */
    inference: InferenceConfig;
    /** Model Runner Control */
    modelRunner: ModelRunnerConfig;
    /** Memory Control */
    memory: MemoryParams;
    /** Pluggable strategy configuration */
    strategies: {
        sampling: StrategySlotParams;
        /**
         * One premise strategy, or several composed per task. A list lets several
         * associative memories (term links, embedding similarity, co-activation)
         * contribute premises in one pass; overlapping terms are deduped to the
         * highest-priority claim.
         */
        premise: StrategySlotParams;
        derivation: StrategySlotParams;
        lmRule: StrategySlotParams & {
            maxRules: number;
        };
        attention: StrategySlotParams;
        bag: BagSlotParams;
    };
}
/**
 * A strategy slot names a strategy and its configuration; the registry turns
 * that pair into a validated, memoized instance (TODO27 §2.2). A list names
 * several strategies composed into one.
 *
 * The bag slot is the exception: there is no strategy to name, because
 * `PriorityBag` is the only AIKR queue. The slot is its configuration, and it
 * carries a contract (`bag/registration.ts`) rather than a registry.
 */
export interface StrategySlotParams {
    type: StrategySpec;
    config?: StrategyConfig;
}
/**
 * Every strategy slot, as the pair that the two sides of the system spell
 * differently: the config graph says `lmRule`, the registry says `lm-rule`.
 *
 * Declared once and keyed by the registry type, because that direction is the
 * lossless one — indexing it yields the slot's config key at its literal type,
 * so a fifth slot added here reaches the controller, the registry and the
 * validation walk together. It was three hand-written copies of these five pairs
 * in two files (`SLOT_KEY`, `SLOT_TYPES` in the registry, this table), and they
 * were already free to disagree.
 */
export declare const STRATEGY_SLOTS: {
    readonly sampling: {
        readonly key: 'sampling';
        readonly type: 'sampling';
    };
    readonly premise: {
        readonly key: 'premise';
        readonly type: 'premise';
    };
    readonly derivation: {
        readonly key: 'derivation';
        readonly type: 'derivation';
    };
    readonly 'lm-rule': {
        readonly key: 'lmRule';
        readonly type: 'lm-rule';
    };
    readonly attention: {
        readonly key: 'attention';
        readonly type: 'attention';
    };
};
/** The same slots read from the config side, for a caller holding a slot key. */
export declare const STRATEGY_SLOTS_BY_KEY: Record<"attention" | "derivation" | "lmRule" | "premise" | "sampling", "attention" | "derivation" | "lm-rule" | "premise" | "sampling">;
export interface PriorityConfig {
    /** Initial priority for new concepts */
    initialPriority: number;
    /** Maximum priority (ceiling) */
    maxPriority: number;
    /** Priority boost when concept is directly mentioned */
    directMentionBoost: number;
    /** Priority boost for related concepts */
    relatedConceptBoost: number;
    /** Priority decay rate per cycle */
    decayRate: number;
    /** Activation propagation strength */
    propagationStrength: number;
    [key: string]: unknown;
}
export interface LMConfig {
    /** Enable LM rules */
    enabled: boolean;
    /** Require single premise for LM rules */
    singlePremiseEnabled: boolean;
    /** Maximum LM rules to fire per cycle */
    maxRulesPerCycle: number;
    /** Timeout for individual LM calls (ms) */
    callTimeoutMs: number;
    /** Enable specific LM rule categories */
    ruleCategories: {
        translation: boolean;
        explanation: boolean;
        metaReasoning: boolean;
        uncertainty: boolean;
        schemaInduction: boolean;
        temporalCausal: boolean;
        conceptElaboration: boolean;
    };
    /** Strategy for selecting which LM rules to fire */
    selectionStrategy: 'all' | 'priority' | 'rotation' | 'diverse';
    /** Rotation index for round-robin selection */
    rotationIndex?: number;
    [key: string]: unknown;
}
export interface AttentionConfig {
    /** Enable automatic attention priming */
    autoPrime: boolean;
    /** Boost amount for direct mention */
    primeBoost: number;
    /** Boost for related concepts */
    relatedBoost: number;
    /** Enable structural similarity detection */
    structuralSimilarity: boolean;
    /** Enable semantic relatedness (requires embeddings) */
    semanticRelatedness: boolean;
    /** Propagate activation to neighbors */
    propagateActivation: boolean;
    /** Number of propagation iterations */
    propagationIterations: number;
    [key: string]: unknown;
}
export interface InferenceConfig {
    /** Maximum derivations per step */
    maxDerivationsPerStep: number;
    /** Maximum derivation depth */
    maxDerivationDepth: number;
    /** Enable circular detection */
    enableCircularDetection: boolean;
    /** Enable trace collection */
    enableTraceCollection: boolean;
    /** CPU throttle delay (ms) between derivations */
    cpuThrottleMs: number;
    /** Maximum concepts to sample for inference */
    maxSampledConcepts: number;
    /** Enable single-premise LM rules */
    singlePremiseLMRules?: boolean;
    /** Maximum LM rules to fire per step */
    maxLMRulesPerStep?: number;
    /** Derivation ranking at admission (score = c × decisiveness − sizePenalty) */
    ranking?: {
        maxAdmissions: number;
        minScore: number;
    };
    [key: string]: unknown;
}
export interface ModelRunnerConfig {
    /** Maximum reasoning loops per turn */
    maxLoops: number;
    [key: string]: unknown;
}
/**
 * The tunable half of memory. Named `...Params`, not `MemoryConfig`, because
 * `memory/config.ts` owns the component's own forty-field `MemoryConfig` and the
 * two shared a name while sharing no fields.
 */
export interface MemoryParams {
    /** Activation decay rate per cycle */
    activationDecayRate: number;
    [key: string]: unknown;
}
/** Build default parameters from the shared cognitive bounds. */
export declare function buildDefaults(): CognitiveParameters;
export declare const DEFAULT_COGNITIVE_PARAMETERS: CognitiveParameters;
/**
 * Fast inference configuration - minimal LM usage
 */
export declare const FAST_COGNITIVE_CONFIG: CognitiveParameters;
/**
 * Parameter space for optimization — the tunable subset of `cognitiveBounds`,
 * named rather than mirrored.
 *
 * This was 13 rows of `getCognitiveBound(category, key, 'min' | 'max' | 'default')`,
 * which is a second copy of the table that no ratchet could see: widening a bound
 * in `@senars/util` left this one describing the old range. The rows are named
 * because the *subset* is a decision (which parameters are tunable), and the
 * numbers inside each row are not.
 */
export declare const PARAMETER_SPACE: {
    readonly priority: {
        readonly initialPriority: import("./bound-table").BoundRange;
        readonly directMentionBoost: import("./bound-table").BoundRange;
        readonly relatedConceptBoost: import("./bound-table").BoundRange;
    };
    readonly lm: {
        readonly maxRulesPerCycle: import("./bound-table").BoundRange;
        readonly callTimeoutMs: import("./bound-table").BoundRange;
    };
    readonly attention: {
        readonly primeBoost: import("./bound-table").BoundRange;
        readonly relatedBoost: import("./bound-table").BoundRange;
    };
    readonly inference: {
        readonly maxDerivationsPerStep: import("./bound-table").BoundRange;
        readonly maxDerivationDepth: import("./bound-table").BoundRange;
        readonly rankingMaxAdmissions: import("./bound-table").BoundRange;
        readonly rankingMinScore: import("./bound-table").BoundRange;
    };
    readonly modelRunner: {
        readonly maxLoops: import("./bound-table").BoundRange;
    };
    readonly memory: {
        readonly activationDecayRate: import("./bound-table").BoundRange;
    };
};
/**
 * Validate cognitive parameters.
 *
 * `catalog` is the registry's read-only slice. It is injected rather than
 * imported because `cognitive/registry.ts` already depends on this module, and
 * `strategies/registration` is a leaf: the strategy pass needs no registry
 * import to exist. Without a catalog the strategy pass is skipped, so a caller
 * that only has numbers still gets the numeric validation.
 */
export declare function validateParameters(params: Partial<CognitiveParameters>, catalog?: StrategyCatalog): {
    valid: boolean;
    errors: string[];
};
/**
 * Partial parameters over the frozen defaults.
 *
 * One deep merge, so a nested knob is reachable at any depth. The previous
 * spelling named every section and then named, again, which nested leaves had to
 * be copied by hand (`ranking`, `ruleCategories`) — a list that goes stale the
 * moment a section gains a sub-object, at which point a knob writes through a
 * shared reference. Freezing the defaults is what makes the shared untouched
 * branches safe rather than quietly mutable: this is ESM, so such a write throws
 * at the call site instead of polluting `isolate:false` state.
 */
export declare const mergeParameters: (partial: Partial<CognitiveParameters>) => CognitiveParameters;
/** Per-slot strategy change detection — avoids serializing the whole strategy graph to compare it. */
export declare function sameStrategies(a: CognitiveParameters['strategies'], b: CognitiveParameters['strategies']): boolean;
/**
 * Parse a run's parameter file, the way `tune-runner` writes one.
 *
 * The tuner emits `{ "cognitiveParams": { … } }`; a hand-written file may be the
 * bare parameter object. Both are accepted, because the second is what a person
 * writes and the first is what the tool produces — refusing one of them buys
 * nothing. Validation is the same pass a live config goes through, so a file
 * that names an unregistered strategy fails here rather than at resolution.
 */
export declare function readCognitiveParams(source: string): {
    params: CognitiveParameters;
    errors: string[];
};
//# sourceMappingURL=cognitive-parameters.d.ts.map