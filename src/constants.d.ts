/**
 * The count at which an "accumulated n times" signal is trusted as fully
 * present. One literal for the whole saturation curve: connectivity, revisit
 * confidence, relevance, and consolidation reward are the same ramp, and five
 * copies of its divisor is five places to retune it.
 */
export declare const SATURATION_COUNT = 10;
/**
 * The one occupancy ladder every bounded store reports against. It now lives in
 * `@senars/util` (the AIKR bag reads it too); re-exported here so the cognitive
 * modules keep importing it from their own constants.
 */
export { PRESSURE } from '@senars/config';
/**
 * The bag capacities a focus is built with when its options are silent. `Focus`
 * and `GameFocus` each wrote `1000`/`500` at their own construction sites, and
 * `GameFocus` then forwarded its own defaults into `Focus`, so a retune of one
 * bound left the other holding the old pair.
 */
export declare const FOCUS_DEFAULTS: Readonly<{
    readonly taskCapacity: 1000;
    readonly conceptCapacity: 500;
}>;
/** The smaller pair a meta focus runs on — self-reporting is not the main work. */
export declare const META_FOCUS_DEFAULTS: Readonly<{
    readonly taskCapacity: 500;
    readonly conceptCapacity: 200;
}>;
export declare const LINK: Readonly<{
    readonly DEFAULT_CAPACITY: 1000;
    readonly TERM_LAYER_CAPACITY: 1000;
    readonly SEMANTIC_LAYER_CAPACITY: 500;
    readonly FORGET_POLICY: 'priority';
    readonly DECAY_RATE: 0.001;
    /** The link noise floor: below this a decayed link is dropped, not kept weak. */
    readonly MIN_PRIORITY: 0.01;
    readonly SEMANTIC_MIN_SIMILARITY: 0.6;
}>;
//# sourceMappingURL=constants.d.ts.map