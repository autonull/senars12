/**
 * The count at which an "accumulated n times" signal is trusted as fully
 * present. One literal for the whole saturation curve: connectivity, revisit
 * confidence, relevance, and consolidation reward are the same ramp, and five
 * copies of its divisor is five places to retune it.
 */
export const SATURATION_COUNT = 10;

export const LINK = Object.freeze({
  DEFAULT_CAPACITY: 1000,
  TERM_LAYER_CAPACITY: 1000,
  SEMANTIC_LAYER_CAPACITY: 500,
  FORGET_POLICY: 'priority' as const,
  DECAY_RATE: 0.001,
  MIN_PRIORITY: 0.01,
  CONNECTIVITY_NORMALIZER: SATURATION_COUNT,
  ACTIVATION_PROPAGATION_FACTOR: 0.1,
  TERM_LINK_STRATEGY_PRIORITY: 0.6,
  TERM_LINK_MIN_PRIORITY: 0.1,
  TERM_LINK_MAX_RESULTS: 20,
  SEMANTIC_MIN_SIMILARITY: 0.6,
  SEMANTIC_MAX_RESULTS: 10,
  TYPE_CAPACITY_BUDGETS: {
    'term-link': 0.5,
    inheritance: 0.2,
    similarity: 0.15,
    implication: 0.15,
  },
} as const);
