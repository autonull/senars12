/**
 * Variable Term Operations — advanced variable manipulation.
 */
import type { Term, VariableTerm } from './types';
/** Variable generator for creating fresh variables. */
export declare class VariableGenerator {
    private counter;
    private prefix;
    constructor(prefix?: string);
    /** Generate a fresh variable. */
    fresh(): VariableTerm;
    /** Generate a named variable. */
    named(name: string): VariableTerm;
    /** Reset the counter. */
    reset(): void;
    /** Set the counter. */
    setCounter(value: number): void;
    /** Get current counter. */
    getCounter(): number;
}
/** Default variable generator. */
export declare const variableGenerator: VariableGenerator;
/** Get most general unifier. */
export declare function mgu(a: Term, b: Term): Map<string, Term> | null;
/** Check if two terms are unifiable. */
export declare function isUnifiable(a: Term, b: Term): boolean;
//# sourceMappingURL=variable.d.ts.map