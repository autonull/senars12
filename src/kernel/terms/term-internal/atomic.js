/**
 * Atomic Term Operations — utilities for variable and constant terms.
 */
import { TermOp } from '../term-ops';
/** Check if term is a variable. */
export function isVariable(term) {
    return term.op === TermOp.VARIABLE;
}
/** Check if term is a constant. */
export function isConstant(term) {
    return term.op === TermOp.CONSTANT;
}
/** Get variable name. */
export function getVariableName(term) {
    if (isVariable(term))
        return term.name;
    return null;
}
/** Get constant value. */
export function getConstantValue(term) {
    if (isConstant(term))
        return term.value;
    return null;
}
/** Create a variable term from index. */
export function variableFromIndex(index, prefix = '_') {
    return { op: TermOp.VARIABLE, name: `${prefix}${index}`, index, hash: 0, complexity: 1 };
}
