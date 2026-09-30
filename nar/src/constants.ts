/**
 * The count at which an "accumulated n times" signal is trusted as fully
 * present. One literal for the whole saturation curve: connectivity, revisit
 * confidence, relevance, and consolidation reward are the same ramp, and five
 * copies of its divisor is five places to retune it.
 */
export const SATURATION_COUNT = 10;

/**
 * One occupancy ladder for every bounded store that reports pressure — the
 * concept store, the task bags, and eviction. They all measure the same
 * quantity (`occupancy`, 0..1), so four rungs spelled four times with four
 * different values meant eviction, telemetry and health could disagree about
 * whether the system was under pressure at the same instant.
 *
 * `NEUTRAL` is the baseline eviction scales its batch sizes from, not a
 * threshold: it is the occupancy at which an archive/forget batch is zero.
 */
export const PRESSURE = Object.freeze({
  NEUTRAL: 0.5,
  HIGH: 0.7,
  ARCHIVE: 0.8,
  CRITICAL: 0.9,
} as const);

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
