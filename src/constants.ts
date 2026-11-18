/**
 * The count at which an "accumulated n times" signal is trusted as fully
 * present. One literal for the whole saturation curve: connectivity, revisit
 * confidence, relevance, and consolidation reward are the same ramp, and five
 * copies of its divisor is five places to retune it.
 */
export const SATURATION_COUNT = 10;

/**
 * The one occupancy ladder every bounded store reports against. It now lives in
 * `@senars/util` (the AIKR bag reads it too); re-exported here so the cognitive
 * modules keep importing it from their own constants.
 */
export { PRESSURE } from '@senars/util/config';

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
