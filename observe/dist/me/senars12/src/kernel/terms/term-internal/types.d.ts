/**
 * Kernel Term Types — core term type definitions.
 */
import type { TruthValue, Stamp } from '../../types';
import { TermOp } from '../term-ops';
export { TermOp } from '../term-ops';
/** Base term interface. */
export interface TermBase {
    readonly op: TermOp;
    readonly hash: number;
    readonly complexity: number;
}
/** Variable term. */
export interface VariableTerm extends TermBase {
    op: TermOp.VARIABLE;
    readonly name: string;
    readonly index: number;
}
/** Constant/atom term. */
export interface ConstantTerm extends TermBase {
    op: TermOp.CONSTANT;
    readonly value: string;
}
/** Compound term (binary or n-ary). */
export interface CompoundTerm extends TermBase {
    op: Exclude<TermOp, TermOp.VARIABLE | TermOp.CONSTANT>;
    readonly args: readonly Term[];
    readonly arity: number;
}
/** Any term. */
export type Term = VariableTerm | ConstantTerm | CompoundTerm;
/** Term with stamp for the working memory. */
export interface StampedTerm {
    readonly term: Term;
    readonly stamp: Stamp;
    readonly truth: TruthValue;
}
//# sourceMappingURL=types.d.ts.map