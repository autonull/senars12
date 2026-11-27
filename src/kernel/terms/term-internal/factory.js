/**
 * Term Factory — creates and interns terms.
 */
import { TermOp } from '../term-ops';
import { SenarsError } from '../../../errors/senars-error';
/** Term factory with interning. */
export class TermFactory {
    static instance;
    internTable = new Map();
    variableCounter = 0;
    hashSeed = 0x9e3779b9;
    constructor() {
        // Initialize intern tables for each op
        for (const op of Object.values(TermOp)) {
            this.internTable.set(op, new Map());
        }
    }
    /** Get the singleton factory. */
    static getInstance() {
        if (!TermFactory.instance) {
            TermFactory.instance = new TermFactory();
        }
        return TermFactory.instance;
    }
    /** Reset the factory (for testing). */
    static reset() {
        TermFactory.instance = new TermFactory();
    }
    /** Hash a string to a 32-bit integer. */
    hashString(str) {
        let hash = this.hashSeed;
        for (let i = 0; i < str.length; i++) {
            hash = Math.imul(hash ^ str.charCodeAt(i), 0x85ebca6b);
            hash ^= hash >>> 13;
            hash = Math.imul(hash, 0xc2b2ae35);
            hash ^= hash >>> 16;
        }
        return hash >>> 0;
    }
    /** Create a variable term. */
    variable(name) {
        const key = `var:${name}`;
        const table = this.internTable.get(TermOp.VARIABLE);
        let term = table.get(key);
        if (term)
            return term;
        term = Object.freeze({
            op: TermOp.VARIABLE,
            name,
            index: this.variableCounter++,
            hash: this.hashString(key),
            complexity: 1,
        });
        table.set(key, term);
        return term;
    }
    /** Create a constant term. */
    constant(value) {
        const key = `const:${value}`;
        const table = this.internTable.get(TermOp.CONSTANT);
        let term = table.get(key);
        if (term)
            return term;
        term = Object.freeze({
            op: TermOp.CONSTANT,
            value,
            hash: this.hashString(key),
            complexity: 1,
        });
        table.set(key, term);
        return term;
    }
    /** Convenience: create inheritance (S --> P). */
    inheritance(subject, predicate) {
        return this.compound(TermOp.INHERITANCE, [subject, predicate]);
    }
    /** Convenience: create similarity (S <-> P). */
    similarity(subject, predicate) {
        return this.compound(TermOp.SIMILARITY, [subject, predicate]);
    }
    /** Convenience: create implication (S ==> P). */
    implication(antecedent, consequent) {
        return this.compound(TermOp.IMPLICATION, [antecedent, consequent]);
    }
    /** Convenience: create predictive implication (S =/> P). */
    predictiveImplication(antecedent, consequent) {
        return this.compound(TermOp.PREDICTIVE_IMPLICATION, [antecedent, consequent]);
    }
    /** Convenience: create equivalence (S <=> P). */
    equivalence(subject, predicate) {
        return this.compound(TermOp.EQUIVALENCE, [subject, predicate]);
    }
    /** Convenience: create conjunction (S & P). */
    conjunction(...terms) {
        return this.compound(TermOp.CONJUNCTION, terms);
    }
    /** Convenience: create disjunction (S | P). */
    disjunction(...terms) {
        return this.compound(TermOp.DISJUNCTION, terms);
    }
    /** Convenience: create negation (~S). */
    negation(term) {
        return this.compound(TermOp.NEGATION, [term]);
    }
    /** Convenience: create product (* S P ...). */
    product(...terms) {
        return this.compound(TermOp.PRODUCT, terms);
    }
    /** Convenience: create prediction (S |=> P). */
    prediction(antecedent, consequent) {
        return this.compound(TermOp.PREDICTION, [antecedent, consequent]);
    }
    /** Convenience: create sequential (S ; P). */
    sequential(first, second) {
        return this.compound(TermOp.SEQUENTIAL, [first, second]);
    }
    /** Convenience: create extensional image (@ S). */
    extensionalImage(term) {
        return this.compound(TermOp.EXTENSIONAL_IMAGE, [term]);
    }
    /** Convenience: create intensional image (# S). */
    intensionalImage(term) {
        return this.compound(TermOp.INTENSIONAL_IMAGE, [term]);
    }
    /** Create a compound term. */
    compound(op, args) {
        if (op === TermOp.VARIABLE || op === TermOp.CONSTANT) {
            throw new SenarsError('Invalid op for compound term', 'VALIDATION_ERROR');
        }
        const argKeys = args.map((a) => a.hash.toString(16)).join(',');
        const key = `comp:${op}:${argKeys}`;
        const table = this.internTable.get(op);
        let term = table.get(key);
        if (term)
            return term;
        const complexity = 1 + args.reduce((sum, a) => sum + a.complexity, 0);
        term = Object.freeze({
            op,
            args,
            arity: args.length,
            hash: this.hashString(key),
            complexity,
        });
        table.set(key, term);
        return term;
    }
    /** Get interned term or create new. */
    getOrCreate(op, args, nameOrValue) {
        switch (op) {
            case TermOp.VARIABLE:
                return this.variable(args);
            case TermOp.CONSTANT:
                return this.constant(args);
            default:
                return this.compound(op, args);
        }
    }
    /** Get intern table size (for debugging). */
    getInternStats() {
        const stats = {};
        for (const [op, table] of this.internTable) {
            stats[op] = table.size;
        }
        return stats;
    }
    /** Alias for getInternStats for compatibility. */
    getStats() {
        return this.getInternStats();
    }
}
/** Global term factory instance (getter to always return current singleton). */
export const termFactory = {
    get instance() {
        return TermFactory.getInstance();
    },
    // Proxy all methods to the current instance
    variable(name) { return TermFactory.getInstance().variable(name); },
    constant(value) { return TermFactory.getInstance().constant(value); },
    compound(op, args) { return TermFactory.getInstance().compound(op, args); },
    // Add other methods as needed
    inheritance(subject, predicate) { return TermFactory.getInstance().inheritance(subject, predicate); },
    similarity(subject, predicate) { return TermFactory.getInstance().similarity(subject, predicate); },
    implication(antecedent, consequent) { return TermFactory.getInstance().implication(antecedent, consequent); },
    equivalence(subject, predicate) { return TermFactory.getInstance().equivalence(subject, predicate); },
    conjunction(...terms) { return TermFactory.getInstance().conjunction(...terms); },
    disjunction(...terms) { return TermFactory.getInstance().disjunction(...terms); },
    negation(term) { return TermFactory.getInstance().negation(term); },
    product(...terms) { return TermFactory.getInstance().product(...terms); },
    prediction(antecedent, consequent) { return TermFactory.getInstance().prediction(antecedent, consequent); },
    sequential(first, second) { return TermFactory.getInstance().sequential(first, second); },
    extensionalImage(term) { return TermFactory.getInstance().extensionalImage(term); },
    intensionalImage(term) { return TermFactory.getInstance().intensionalImage(term); },
    getOrCreate(op, args, nameOrValue) { return TermFactory.getInstance().getOrCreate(op, args, nameOrValue); },
    getStats() { return TermFactory.getInstance().getStats(); },
};
