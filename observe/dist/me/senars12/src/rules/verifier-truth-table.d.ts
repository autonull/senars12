/**
 * Verifier Truth Table — the transcribed NAL truth functions, kept independent
 * from the engine's arithmetic so drift is detectable (TODO28 §4.1).
 *
 * This table is *not* imported by the engine. The engine uses `Truth` directly;
 * the verifier uses this table. A test (`verifier-drift.test.ts`) compares them
 * and declares any further drift.
 *
 * IMPORTANT: These implementations are EXACT COPIES of the engine's Truth methods
 * to ensure the only drift is the declared one: revision:frequency
 * (saturated revision branch).
 *
 * Shared constants are imported from kernel/truth-constants to eliminate
 * constant duplication while keeping implementations independent.
 */
import type { Truth } from '../terms';
type TruthFn = (t1: Truth, t2?: Truth, ...args: unknown[]) => Truth | null | number;
/** Binary truth functions as recorded by the verifier (exact copies from engine). */
export declare const BINARY_TRUTH: Readonly<Record<string, (f1: number, f2: number, c1: number, c2: number) => [number, number]>>;
/** Unary truth functions as recorded by the verifier (exact copies from engine). */
export declare const UNARY_TRUTH: Readonly<Record<string, (f: number, c: number) => [number, number]>>;
/** The complete verifier truth table. */
export declare const VERIFIER_TRUTH_TABLE: {
    readonly BINARY_TRUTH: Readonly<Record<string, (f1: number, f2: number, c1: number, c2: number) => [number, number]>>;
    readonly UNARY_TRUTH: Readonly<Record<string, (f: number, c: number) => [number, number]>>;
};
/**
 * Resolve a truth function name to the engine's implementation.
 * Returns null if the name is not recognized.
 */
export declare function resolveTruthFn(_ruleId: string, truthFnName: string): TruthFn | null;
export {};
//# sourceMappingURL=verifier-truth-table.d.ts.map