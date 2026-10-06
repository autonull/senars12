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

/**
 * The bag capacities a focus is built with when its options are silent. `Focus`
 * and `GameFocus` each wrote `1000`/`500` at their own construction sites, and
 * `GameFocus` then forwarded its own defaults into `Focus`, so a retune of one
 * bound left the other holding the old pair.
 */
export const FOCUS_DEFAULTS = Object.freeze({ taskCapacity: 1000, conceptCapacity: 500 } as const);

/** The smaller pair a meta focus runs on — self-reporting is not the main work. */
export const META_FOCUS_DEFAULTS = Object.freeze({
  taskCapacity: 500,
  conceptCapacity: 200,
} as const);

export const LINK = Object.freeze({
  DEFAULT_CAPACITY: 1000,
  TERM_LAYER_CAPACITY: 1000,
  SEMANTIC_LAYER_CAPACITY: 500,
  FORGET_POLICY: 'priority' as const,
  DECAY_RATE: 0.001,
  /** The link noise floor: below this a decayed link is dropped, not kept weak. */
  MIN_PRIORITY: 0.01,
  SEMANTIC_MIN_SIMILARITY: 0.6,
} as const);
