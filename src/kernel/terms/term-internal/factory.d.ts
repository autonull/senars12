/**
 * Term Factory — creates and interns terms.
 */
import { TermOp } from '../term-ops';
import type { Term, VariableTerm, ConstantTerm, CompoundTerm } from './types';
/** Term factory with interning. */
export declare class TermFactory {
    private static instance;
    private internTable;
    private variableCounter;
    private hashSeed;
    private constructor();
    /** Get the singleton factory. */
    static getInstance(): TermFactory;
    /** Reset the factory (for testing). */
    static reset(): void;
    /** Hash a string to a 32-bit integer. */
    private hashString;
    /** Create a variable term. */
    variable(name: string): VariableTerm;
    /** Create a constant term. */
    constant(value: string): ConstantTerm;
    /** Convenience: create inheritance (S --> P). */
    inheritance(subject: Term, predicate: Term): CompoundTerm;
    /** Convenience: create similarity (S <-> P). */
    similarity(subject: Term, predicate: Term): CompoundTerm;
    /** Convenience: create implication (S ==> P). */
    implication(antecedent: Term, consequent: Term): CompoundTerm;
    /** Convenience: create predictive implication (S =/> P). */
    predictiveImplication(antecedent: Term, consequent: Term): CompoundTerm;
    /** Convenience: create equivalence (S <=> P). */
    equivalence(subject: Term, predicate: Term): CompoundTerm;
    /** Convenience: create conjunction (S & P). */
    conjunction(...terms: Term[]): CompoundTerm;
    /** Convenience: create disjunction (S | P). */
    disjunction(...terms: Term[]): CompoundTerm;
    /** Convenience: create negation (~S). */
    negation(term: Term): CompoundTerm;
    /** Convenience: create product (* S P ...). */
    product(...terms: Term[]): CompoundTerm;
    /** Convenience: create prediction (S |=> P). */
    prediction(antecedent: Term, consequent: Term): CompoundTerm;
    /** Convenience: create sequential (S ; P). */
    sequential(first: Term, second: Term): CompoundTerm;
    /** Convenience: create extensional image (@ S). */
    extensionalImage(term: Term): CompoundTerm;
    /** Convenience: create intensional image (# S). */
    intensionalImage(term: Term): CompoundTerm;
    /** Create a compound term. */
    compound(op: TermOp, args: readonly Term[]): CompoundTerm;
    /** Get interned term or create new. */
    getOrCreate(op: TermOp, args?: readonly Term[] | string, nameOrValue?: string): Term;
    /** Get intern table size (for debugging). */
    getInternStats(): Record<string, number>;
    /** Alias for getInternStats for compatibility. */
    getStats(): Record<string, number>;
}
/** Global term factory instance (getter to always return current singleton). */
export declare const termFactory: {
    readonly instance: TermFactory;
    variable(name: string): VariableTerm;
    constant(value: string): ConstantTerm;
    compound(op: TermOp, args: readonly Term[]): CompoundTerm;
    inheritance(subject: Term, predicate: Term): CompoundTerm;
    similarity(subject: Term, predicate: Term): CompoundTerm;
    implication(antecedent: Term, consequent: Term): CompoundTerm;
    equivalence(subject: Term, predicate: Term): CompoundTerm;
    conjunction(...terms: Term[]): CompoundTerm;
    disjunction(...terms: Term[]): CompoundTerm;
    negation(term: Term): CompoundTerm;
    product(...terms: Term[]): CompoundTerm;
    prediction(antecedent: Term, consequent: Term): CompoundTerm;
    sequential(first: Term, second: Term): CompoundTerm;
    extensionalImage(term: Term): CompoundTerm;
    intensionalImage(term: Term): CompoundTerm;
    getOrCreate(op: TermOp, args?: readonly Term[] | string, nameOrValue?: string): Term;
    getStats(): Record<string, number>;
};
//# sourceMappingURL=factory.d.ts.map