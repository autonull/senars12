/**
 * The in-cycle induction inventory (TODO29.a §11.1 Q1′).
 *
 * Q1′ asks which behaviours currently happen *inside a cycle* because of the
 * induction layer, and what happens to each once the cycle closes. The
 * dispositions are decisions, not derivations — which is why they are written
 * down here rather than inferred from the code, and why the gate that checks
 * them (`induction:inventory`) checks that they exist rather than what they
 * say.
 *
 * The column that carries the weight is `noticedBy`. Moving a behaviour and
 * losing it look identical from inside a diff; "who would notice its absence"
 * is the difference, and a behaviour nobody would notice is either dead code or
 * a claim nobody has tested.
 *
 * **Behaviours, not call sites.** A behaviour that the cycle reaches through
 * three routes is one row, because three rows would each look complete while
 * the behaviour had in fact been half-declared.
 */
/** Where a behaviour goes once the cycle is closed. */
export type InCycleDisposition = 
/** Runs outside the cycle, at a declared application boundary (A3). */
'boundary'
/** Stays on the cycle path, and says so. */
 | 'synchronous'
/** Removed from the cycle path; the audit is what says it was safe. */
 | 'dropped';
export interface InCycleBehaviour {
    readonly id: string;
    /** What the system does because of the layer, named as a behaviour. */
    readonly behaviour: string;
    readonly disposition: InCycleDisposition;
    /** Who would notice, and as what, if this were absent. */
    readonly noticedBy: string;
    /** Why the disposition is the one it is. */
    readonly note?: string;
}
export declare const IN_CYCLE_INVENTORY: readonly InCycleBehaviour[];
/**
 * The cycle path, by directory. Everything outside it is assembly or agent-side
 * and is A2's subject rather than this inventory's.
 */
export declare const CYCLE_PATH_PREFIXES: readonly string[];
/**
 * Which declared behaviour owns each cycle-path file's imports of the layer.
 *
 * **Empty since A2 (2026-10-01).** The census it annotates now reads *zero*
 * edges across zero files: no cycle-path module imports the induction layer at
 * all, so there is nothing to attribute. The constant stays because the rule it
 * feeds is the point — an edge that reappears must name a behaviour, and a rule
 * with nothing to check is the kind that stops being read.
 */
export declare const IN_CYCLE_EDGE_ATTRIBUTIONS: readonly {
    readonly file: string;
    readonly behaviour: string;
}[];
//# sourceMappingURL=in-cycle-inventory.d.ts.map