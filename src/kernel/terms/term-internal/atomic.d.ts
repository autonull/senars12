/**
 * Atomic Term Operations — utilities for variable and constant terms.
 */
import type { Term, VariableTerm, ConstantTerm } from './types';
/** Check if term is a variable. */
export declare function isVariable(term: Term): term is VariableTerm;
/** Check if term is a constant. */
export declare function isConstant(term: Term): term is ConstantTerm;
/** Get variable name. */
export declare function getVariableName(term: Term): string | null;
/** Get constant value. */
export declare function getConstantValue(term: Term): string | null;
/** Create a variable term from index. */
export declare function variableFromIndex(index: number, prefix?: string): VariableTerm;
//# sourceMappingURL=atomic.d.ts.map