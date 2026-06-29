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

    /** Pluggable strategy configuration */
    strategies: {
        sampling: { type: string; config?: Record<string, unknown> };
        premise: { type: string; config?: Record<string, unknown> };
        derivation: { type: string; config?: Record<string, unknown> };
        lmRule: { type: string; maxRules: number; config?: Record<string, unknown> };
        attention: { type: string; config?: Record<string, unknown> };
    };
}

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

    /** Master switch for LM rules */
    enableLMRules?: boolean;
}

/**
 * Default cognitive parameters - balanced for general use
 */
export const DEFAULT_COGNITIVE_PARAMETERS: CognitiveParameters = {
    priority: {
        initialPriority: 0.1,
        maxPriority: 1.0,
        directMentionBoost: 0.3,
        relatedConceptBoost: 0.15,
        decayRate: 0.05,
        propagationStrength: 0.1
    },

    lm: {
        enabled: true,
        singlePremiseEnabled: true,
        maxRulesPerCycle: 13,
        callTimeoutMs: 5000,
        ruleCategories: {
            translation: true,
            explanation: true,
            metaReasoning: true,
            uncertainty: true,
            schemaInduction: true,
            temporalCausal: true,
            conceptElaboration: true
        },
        /** @deprecated Use strategies.lmRule.type instead */
        selectionStrategy: 'all'
    },

    attention: {
        autoPrime: true,
        primeBoost: 0.3,
        relatedBoost: 0.15,
        structuralSimilarity: true,
        semanticRelatedness: false,
        propagateActivation: true,
        propagationIterations: 2
    },

    inference: {
        maxDerivationsPerStep: 1000,
        maxDerivationDepth: 10,
        enableCircularDetection: true,
        enableTraceCollection: false,
        cpuThrottleMs: 0,
        maxSampledConcepts: 100
    },

    strategies: {
        sampling: {type: 'priority'},
        premise: {type: 'default-formation'},
        derivation: {type: 'default'},
        lmRule: {type: 'priority', maxRules: 5},
        attention: {type: 'simple'}
    }
};

/**
 * Fast inference configuration - minimal LM usage
 */
export const FAST_COGNITIVE_CONFIG: CognitiveParameters = {
    ...DEFAULT_COGNITIVE_PARAMETERS,
    lm: {
        ...DEFAULT_COGNITIVE_PARAMETERS.lm,
        enabled: false
    }
};

/**
 * LM-heavy configuration - maximum enhancement
 */
export const LM_HEAVY_CONFIG: CognitiveParameters = {
    ...DEFAULT_COGNITIVE_PARAMETERS,
    lm: {
        ...DEFAULT_COGNITIVE_PARAMETERS.lm,
        maxRulesPerCycle: 13,
        callTimeoutMs: 8000
    }
};

/**
 * Research configuration - all tracing enabled
 */
export const RESEARCH_COGNITIVE_CONFIG: CognitiveParameters = {
    ...DEFAULT_COGNITIVE_PARAMETERS,
    inference: {
        ...DEFAULT_COGNITIVE_PARAMETERS.inference,
        enableTraceCollection: true,
        maxDerivationsPerStep: 100 // Limit for detailed analysis
    }
};

/**
 * Parameter space for optimization
 * Defines ranges for each tunable parameter
 */
export const PARAMETER_SPACE = {
    priority: {
        initialPriority: {min: 0.01, max: 0.2, default: 0.1},
        directMentionBoost: {min: 0.1, max: 0.5, default: 0.3},
        relatedConceptBoost: {min: 0.05, max: 0.3, default: 0.15}
    },

    lm: {
        maxRulesPerCycle: {min: 1, max: 13, default: 13},
        callTimeoutMs: {min: 1000, max: 30000, default: 5000}
    },

    attention: {
        primeBoost: {min: 0.1, max: 0.5, default: 0.3},
        relatedBoost: {min: 0.05, max: 0.3, default: 0.15}
    },

    inference: {
        maxDerivationsPerStep: {min: 100, max: 10000, default: 1000},
        maxDerivationDepth: {min: 5, max: 20, default: 10}
    }
} as const;

/**
 * Validate cognitive parameters
 */
export function validateParameters(params: Partial<CognitiveParameters>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (params.priority) {
        const p = params.priority;
        if (p.initialPriority < 0 || p.initialPriority > 1) errors.push('priority.initialPriority must be in [0, 1]');
        if (p.directMentionBoost < 0 || p.directMentionBoost > 1) errors.push('priority.directMentionBoost must be in [0, 1]');
    }

    if (params.lm?.selectionStrategy) {
        console.warn('selectionStrategy in LMConfig is deprecated. Use strategies.lmRule.type instead.');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Merge partial parameters with defaults
 */
export function mergeParameters(partial: Partial<CognitiveParameters>): CognitiveParameters {
    return {
        priority: {...DEFAULT_COGNITIVE_PARAMETERS.priority, ...partial.priority},
        lm: {...DEFAULT_COGNITIVE_PARAMETERS.lm, ...partial.lm},
        attention: {...DEFAULT_COGNITIVE_PARAMETERS.attention, ...partial.attention},
        inference: {...DEFAULT_COGNITIVE_PARAMETERS.inference, ...partial.inference},
        strategies: {
            ...DEFAULT_COGNITIVE_PARAMETERS.strategies,
            ...partial.strategies,
            sampling: {...DEFAULT_COGNITIVE_PARAMETERS.strategies.sampling, ...partial.strategies?.sampling},
            premise: {...DEFAULT_COGNITIVE_PARAMETERS.strategies.premise, ...partial.strategies?.premise},
            derivation: {...DEFAULT_COGNITIVE_PARAMETERS.strategies.derivation, ...partial.strategies?.derivation},
            lmRule: {...DEFAULT_COGNITIVE_PARAMETERS.strategies.lmRule, ...partial.strategies?.lmRule},
            attention: {...DEFAULT_COGNITIVE_PARAMETERS.strategies.attention, ...partial.strategies?.attention}
        }
    };
}
