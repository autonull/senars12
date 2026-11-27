import type { CognitiveParameters } from '../config/cognitive-parameters';
export interface TunableKnob {
    readonly name: string;
    readonly path: string;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    get(): number;
    set(value: number): void;
}
export type KnobRoot = 'cognitive' | 'systemOne';
/** Unified knob table (G2/X9) — one spec list covering both roots. */
export interface KnobSpec {
    readonly name: string;
    /** Where the value lives in its root's parameter tree. */
    readonly path: string;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly root: KnobRoot;
    /**
     * `value` snapped onto the row's step and clamped into its range, by the table that owns
     * the row. `set` used to re-derive that arithmetic from its own `min`/`max`/`step`, so a
     * quantizer and the bound it claims to enforce were two implementations.
     */
    quantize(value: number): number;
}
type ParamObj = Record<string, any>;
/**
 * The tunable subset of `cognitiveBounds`, with every range projected by its own row.
 *
 * These rows used to restate their `min`/`max`/`step` by hand, and nine of the ten had
 * drifted from the canonical table — the tuner could not reach values the config schema
 * already admitted. *Which* parameters are tunable is a decision; the numbers are not.
 */
declare const cognitiveKnobs: readonly KnobSpec[];
declare const systemOneKnobs: readonly KnobSpec[];
export declare const KNOB_SPECS: readonly KnobSpec[];
export declare function findKnobSpec(name: string): KnobSpec | undefined;
export declare function createKnobSet(params: CognitiveParameters, systemOne?: ParamObj): Record<string, TunableKnob>;
export { cognitiveKnobs as knobSchema, systemOneKnobs as systemOneKnobSchema };
//# sourceMappingURL=knobs.d.ts.map