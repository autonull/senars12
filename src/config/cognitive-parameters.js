import { createLogger } from '../util/logger';
import { deepEqual, deepFreeze, deepMerge } from '../util/object';
import { errMsg } from '../util/error';
import { keyedBy } from '../util/collections';
import { cognitiveBound, COGNITIVE_DEFAULT_PATHS, validateAgainstBounds, buildDefaultsFromBounds } from './bound-table';
import { bagSlotErrors } from '../bag/registration';
import { strategySpecErrors, } from '../strategies/registration';
const log = createLogger({ scope: 'cognitive-params' });
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
export const STRATEGY_SLOTS = {
    sampling: { key: 'sampling', type: 'sampling' },
    premise: { key: 'premise', type: 'premise' },
    derivation: { key: 'derivation', type: 'derivation' },
    'lm-rule': { key: 'lmRule', type: 'lm-rule' },
    attention: { key: 'attention', type: 'attention' },
};
/** The same slots read from the config side, for a caller holding a slot key. */
export const STRATEGY_SLOTS_BY_KEY = keyedBy(Object.values(STRATEGY_SLOTS), ({ key }) => key, ({ type }) => type);
/** Build default parameters from the shared cognitive bounds. */
export function buildDefaults() {
    const boundDefaults = buildDefaultsFromBounds(cognitiveBound, [...COGNITIVE_DEFAULT_PATHS]);
    return {
        priority: {
            initialPriority: boundDefaults.priority.initialPriority,
            maxPriority: boundDefaults.priority.maxPriority,
            directMentionBoost: boundDefaults.priority.directMentionBoost,
            relatedConceptBoost: boundDefaults.priority.relatedConceptBoost,
            decayRate: boundDefaults.priority.decayRate,
            propagationStrength: boundDefaults.priority.propagationStrength,
        },
        lm: {
            enabled: true,
            singlePremiseEnabled: true,
            maxRulesPerCycle: boundDefaults.lm.maxRulesPerCycle,
            callTimeoutMs: boundDefaults.lm.callTimeoutMs,
            ruleCategories: {
                translation: true,
                explanation: true,
                metaReasoning: true,
                uncertainty: true,
                schemaInduction: true,
                temporalCausal: true,
                conceptElaboration: true,
            },
            /** @deprecated Use strategies.lmRule.type instead */
            selectionStrategy: 'all',
        },
        attention: {
            autoPrime: true,
            primeBoost: boundDefaults.attention.primeBoost,
            relatedBoost: boundDefaults.attention.relatedBoost,
            structuralSimilarity: true,
            semanticRelatedness: false,
            propagateActivation: true,
            propagationIterations: boundDefaults.attention.propagationIterations,
        },
        inference: {
            maxDerivationsPerStep: boundDefaults.inference.maxDerivationsPerStep,
            maxDerivationDepth: boundDefaults.inference.maxDerivationDepth,
            enableCircularDetection: true,
            enableTraceCollection: false,
            cpuThrottleMs: boundDefaults.inference.cpuThrottleMs,
            maxSampledConcepts: boundDefaults.inference.maxSampledConcepts,
            ranking: {
                maxAdmissions: boundDefaults.inference.rankingMaxAdmissions,
                minScore: boundDefaults.inference.rankingMinScore,
            },
        },
        modelRunner: {
            maxLoops: boundDefaults.modelRunner.maxLoops,
        },
        memory: {
            activationDecayRate: boundDefaults.memory.activationDecayRate,
        },
        strategies: {
            sampling: { type: 'priority' },
            premise: { type: 'default-formation' },
            derivation: { type: 'default' },
            lmRule: { type: 'priority', maxRules: 5 },
            attention: { type: 'simple' },
            bag: {},
        },
    };
}
export const DEFAULT_COGNITIVE_PARAMETERS = deepFreeze(buildDefaults());
/**
 * Fast inference configuration - minimal LM usage
 */
export const FAST_COGNITIVE_CONFIG = deepFreeze({
    ...DEFAULT_COGNITIVE_PARAMETERS,
    lm: {
        ...DEFAULT_COGNITIVE_PARAMETERS.lm,
        enabled: false,
    },
});
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
export const PARAMETER_SPACE = {
    priority: {
        initialPriority: cognitiveBound.range('priority.initialPriority'),
        directMentionBoost: cognitiveBound.range('priority.directMentionBoost'),
        relatedConceptBoost: cognitiveBound.range('priority.relatedConceptBoost'),
    },
    lm: {
        maxRulesPerCycle: cognitiveBound.range('lm.maxRulesPerCycle'),
        callTimeoutMs: cognitiveBound.range('lm.callTimeoutMs'),
    },
    attention: {
        primeBoost: cognitiveBound.range('attention.primeBoost'),
        relatedBoost: cognitiveBound.range('attention.relatedBoost'),
    },
    inference: {
        maxDerivationsPerStep: cognitiveBound.range('inference.maxDerivationsPerStep'),
        maxDerivationDepth: cognitiveBound.range('inference.maxDerivationDepth'),
        rankingMaxAdmissions: cognitiveBound.range('inference.rankingMaxAdmissions'),
        rankingMinScore: cognitiveBound.range('inference.rankingMinScore'),
    },
    modelRunner: { maxLoops: cognitiveBound.range('modelRunner.maxLoops') },
    memory: { activationDecayRate: cognitiveBound.range('memory.activationDecayRate') },
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
export function validateParameters(params, catalog) {
    const errors = [];
    // Validate all numeric bounds using the shared utility
    if (params.priority)
        errors.push(...validateAgainstBounds(params.priority, cognitiveBound, 'priority'));
    if (params.lm)
        errors.push(...validateAgainstBounds(params.lm, cognitiveBound, 'lm'));
    if (params.attention)
        errors.push(...validateAgainstBounds(params.attention, cognitiveBound, 'attention'));
    if (params.inference)
        errors.push(...validateAgainstBounds(params.inference, cognitiveBound, 'inference'));
    if (params.modelRunner)
        errors.push(...validateAgainstBounds(params.modelRunner, cognitiveBound, 'modelRunner'));
    if (params.memory)
        errors.push(...validateAgainstBounds(params.memory, cognitiveBound, 'memory'));
    if (params.lm?.selectionStrategy) {
        log.warn('selectionStrategy in LMConfig is deprecated. Use strategies.lmRule.type instead.');
    }
    if (catalog && params.strategies) {
        for (const slot of Object.values(STRATEGY_SLOTS)) {
            const params_ = params.strategies[slot.key];
            if (!params_)
                continue;
            errors.push(...strategySpecErrors(slot.key, slot.type, params_.type, params_.config, catalog.list(slot.type)));
        }
    }
    // The bag slot names no strategy, so it validates its own config.
    if (params.strategies)
        errors.push(...bagSlotErrors(params.strategies.bag));
    return {
        valid: errors.length === 0,
        errors,
    };
}
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
export const mergeParameters = (partial) => deepMerge(DEFAULT_COGNITIVE_PARAMETERS, partial);
/** Per-slot strategy change detection — avoids serializing the whole strategy graph to compare it. */
export function sameStrategies(a, b) {
    const keys = Object.keys(a);
    return keys.every((key) => deepEqual(a[key], b[key]));
}
/**
 * Parse a run's parameter file, the way `tune-runner` writes one.
 *
 * The tuner emits `{ "cognitiveParams": { … } }`; a hand-written file may be the
 * bare parameter object. Both are accepted, because the second is what a person
 * writes and the first is what the tool produces — refusing one of them buys
 * nothing. Validation is the same pass a live config goes through, so a file
 * that names an unregistered strategy fails here rather than at resolution.
 */
export function readCognitiveParams(source) {
    let parsed;
    try {
        parsed = JSON.parse(source);
    }
    catch (err) {
        return { params: DEFAULT_COGNITIVE_PARAMETERS, errors: [`not valid JSON: ${errMsg(err)}`] };
    }
    const raw = parsed?.cognitiveParams ?? parsed;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return { params: DEFAULT_COGNITIVE_PARAMETERS, errors: ['expected a parameter object'] };
    }
    const params = mergeParameters(raw);
    const { errors } = validateParameters(params);
    return { params, errors };
}
