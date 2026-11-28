/**
 * Term Interning — global term identity management.
 *
 * Provides the single source of truth for term equality: two terms are
 * equal iff they are the same object (===). This is enforced by the
 * TermFactory which interns all created terms.
 */
import { TermFactory, Term, VariableTerm, ConstantTerm, CompoundTerm } from './term-internal';
import { TermOp } from './term-ops';
/** Interning statistics. */
export interface InternStats {
    totalTerms: number;
    variables: number;
    constants: number;
    compounds: number;
    byOp: Record<string, number>;
    memoryEstimate: number;
}
/** Global interning state. */
export declare class TermInterner {
    private factory;
    private enabled;
    conjunction: (...terms: Term[]) => CompoundTerm;
    disjunction: (...terms: Term[]) => CompoundTerm;
    negation: (term: Term) => CompoundTerm;
    implication: (antecedent: Term, consequent: Term) => CompoundTerm;
    equivalence: (left: Term, right: Term) => CompoundTerm;
    product: (...terms: Term[]) => CompoundTerm;
    inheritance: (subject: Term, predicate: Term) => CompoundTerm;
    similarity: (subject: Term, predicate: Term) => CompoundTerm;
    extensionalImage: (term: Term, image: Term) => CompoundTerm;
    intensionalImage: (term: Term, image: Term) => CompoundTerm;
    prediction: (term: Term, predicted: Term) => CompoundTerm;
    concurrent: (...terms: Term[]) => CompoundTerm;
    sequential: (...terms: Term[]) => CompoundTerm;
    parallel: (...terms: Term[]) => CompoundTerm;
    statement: (term: Term) => CompoundTerm;
    question: (term: Term) => CompoundTerm;
    goal: (term: Term) => CompoundTerm;
    getHash: (term: Term) => number;
    constructor(factory?: TermFactory);
    /** Enable/disable interning (for testing). */
    setEnabled(enabled: boolean): void;
    /** Check if interning is enabled. */
    isEnabled(): boolean;
    /** Intern a term (returns existing if already interned). */
    intern(term: Term): Term;
    /** Get interned variable or create new. */
    variable(name: string): VariableTerm;
    /** Get interned constant or create new. */
    constant(value: string): ConstantTerm;
    /** Get interned compound or create new. */
    compound(op: TermOp, ...args: Term[]): CompoundTerm;
    /** Parse and intern a Narsese string. */
    parse(narsese: string): Term;
    /** Format a term as Narsese. */
    format(term: Term): string;
    /** Check equality by identity. */
    equals(a: Term, b: Term): boolean;
    /** Get term hash. */
    hash(term: Term): number;
    /** Get term complexity. */
    complexity(term: Term): number;
    /** Get all interned terms. */
    getAllTerms(): Term[];
    /** Get interning statistics. */
    getStats(): InternStats;
    /** Clear all interned terms (for testing). */
    clear(): void;
    /** Get the underlying factory. */
    getFactory(): TermFactory;
}
/** Global interner instance. */
export declare const termInterner: TermInterner;
/**
 * Term structural equality.
 * Returns true if a and b have the same structure and values.
 */
export declare function termEquals(a: Term, b: Term): boolean;
/**
 * Term hash function.
 */
export declare function termHash(term: Term): number;
/**
 * Term complexity function.
 */
export declare function termComplexity(term: Term): number;
/**
 * Create a term from a JSON-serializable representation.
 * Used for deserialization (e.g., from log, network).
 */
export declare function termFromJSON(json: TermJSON): Term;
/** JSON representation of a term. */
export interface TermJSON {
    op: string;
    name?: string;
    value?: string;
    args?: TermJSON[];
}
/**
 * Convert a term to JSON-serializable form.
 */
export declare function termToJSON(term: Term): TermJSON;
/**
 * Term visitor pattern for traversing term trees.
 */
export interface TermVisitor<T> {
    visitVariable(term: VariableTerm): T;
    visitConstant(term: ConstantTerm): T;
    visitCompound(term: CompoundTerm, children: T[]): T;
}
/**
 * Visit a term tree with a visitor.
 */
export declare function visitTerm<T>(term: Term, visitor: TermVisitor<T>): T;
/**
 * Map a term tree, transforming each node.
 */
export declare function mapTerm(term: Term, mapper: (term: Term) => Term): Term;
/**
 * Find all subterms matching a predicate.
 */
export declare function findSubterms(term: Term, predicate: (term: Term) => boolean): Term[];
/**
 * Get all variables in a term.
 */
export declare function getVariables(term: Term): VariableTerm[];
/**
 * Get all constants in a term.
 */
export declare function getConstants(term: Term): ConstantTerm[];
/**
 * Substitute variables in a term.
 */
export declare function substitute(term: Term, substitution: Map<VariableTerm, Term>): Term;
/**
 * Check if a term contains a variable.
 */
export declare function containsVariable(term: Term, variable: VariableTerm): boolean;
/**
 * Get the set of all variables in a term.
 */
export declare function getVariableSet(term: Term): Set<VariableTerm>;
/**
 * Rename variables in a term to avoid capture.
 */
export declare function renameVariables(term: Term, prefix?: string): Term;
/**
 * Standardize variables apart (rename to fresh variables).
 */
export declare function standardizeApart(term: Term): Term;
/**
 * Check if two terms are unifiable (without performing unification).
 * Quick syntactic check.
 */
export declare function isUnifiable(a: Term, b: Term): boolean;
export type { Term, VariableTerm, ConstantTerm, CompoundTerm } from './term-internal';
export { TermOp, TermFactory, isCompound, isAtomic } from './term-internal';
//# sourceMappingURL=intern.d.ts.map