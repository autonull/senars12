export const DEPRECATED_DEPRECATED_THRESHOLDS = Object.freeze({
    PRIORITY: Object.freeze({LOW: 0.3, MEDIUM: 0.7, HIGH: 0.9}),
    MERGE: 0.85,
    ARCHIVE: 0.2,
    PRESSURE: 0.9,
    TEMPORAL_RESOLUTION: 1000,
    DECAY_TIME_CONSTANT: 60000,
} as const);

export const LINK = Object.freeze({
    DEFAULT_CAPACITY: 1000,
    TERM_LAYER_CAPACITY: 1000,
    SEMANTIC_LAYER_CAPACITY: 500,
    FORGET_POLICY: 'priority' as const,
    DECAY_RATE: 0.001,
    MIN_PRIORITY: 0.01,
    CONNECTIVITY_NORMALIZER: 10,
    ACTIVATION_PROPAGATION_FACTOR: 0.1,
    TERM_LINK_STRATEGY_PRIORITY: 0.6,
    TERM_LINK_MIN_PRIORITY: 0.1,
    TERM_LINK_MAX_RESULTS: 20,
    SEMANTIC_MIN_SIMILARITY: 0.6,
    SEMANTIC_MAX_RESULTS: 10,
    TYPE_CAPACITY_BUDGETS: {
        'term-link': 0.5,
        'inheritance': 0.2,
        'similarity': 0.15,
        'implication': 0.15,
    },
} as const);

export const RELATIONSHIP_INDEX = Object.freeze({
    PREFIXES: {
        SUBJECT: 'subject:',
        PREDICATE: 'predicate:',
        PREMISE: 'premise:',
        CONCLUSION: 'conclusion:',
        SIMILAR: 'similar:',
    },
} as const);
