/**
 * Slot composition (TODO27 §2.5): one spec form, five semantics.
 *
 * A `string[]` composes through the slot's own composite class; a
 * `StrategyExpression` is a derivation-only form and reuses the algebra
 * (Invariant D4: `sequence` is the only combinator meaningful for a
 * synchronous, total slot). Labels are deterministic, so composing the same
 * spec twice yields the same registered name.
 */
import type { StrategyType } from '../../strategies/types';
import { type CompositeSpec } from '../../strategies/registration';
/** The stable registry name for a composed slot — `describeSpec` is the one renderer. */
export declare const composedName: (spec: CompositeSpec) => string;
/**
 * Compose one spec into one instance. A single-element list is the part itself
 * — a "composite" of one is an indirection with no behaviour.
 */
export declare const composeSpec: <T>(type: StrategyType, spec: CompositeSpec, leaf: (name: string) => T) => T;
//# sourceMappingURL=composition.d.ts.map