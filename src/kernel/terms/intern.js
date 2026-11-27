/**
 * Term Interning — global term identity management.
 *
 * Provides the single source of truth for term equality: two terms are
 * equal iff they are the same object (===). This is enforced by the
 * TermFactory which interns all created terms.
 */
import { TermFactory } from './term-internal';
import { TermOp } from './term-ops';
import { fromNarsese, formatTerm } from './term-internal/canonical';
/** Global interning state. */
export class TermInterner {
    factory;
    enabled = true;
    // Convenience methods for common compound terms
    conjunction;
    disjunction;
    negation;
    implication;
    equivalence;
    product;
    inheritance;
    similarity;
    extensionalImage;
    intensionalImage;
    prediction;
    concurrent;
    sequential;
    parallel;
    statement;
    question;
    goal;
    getHash;
    constructor(factory = TermFactory.getInstance()) {
        this.factory = factory;
    }
    /** Enable/disable interning (for testing). */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    /** Check if interning is enabled. */
    isEnabled() {
        return this.enabled;
    }
    /** Intern a term (returns existing if already interned). */
    intern(term) {
        if (!this.enabled)
            return term;
        // The factory already interns on creation, so this is a no-op
        // but provides a clear API for "ensure interned"
        return term;
    }
    /** Get interned variable or create new. */
    variable(name) {
        return this.factory.variable(name);
    }
    /** Get interned constant or create new. */
    constant(value) {
        return this.factory.constant(value);
    }
    /** Get interned compound or create new. */
    compound(op, ...args) {
        return this.factory.compound(op, args);
    }
    /** Parse and intern a Narsese string. */
    parse(narsese) {
        return fromNarsese(narsese) ?? this.factory.variable('parse_error');
    }
    /** Format a term as Narsese. */
    format(term) {
        return formatTerm(term);
    }
    /** Check equality by identity. */
    equals(a, b) {
        return a === b;
    }
    /** Get term hash. */
    hash(term) {
        return term.hash;
    }
    /** Get term complexity. */
    complexity(term) {
        return term.complexity;
    }
    /** Get all interned terms. */
    getAllTerms() {
        const terms = [];
        for (const table of this.factory['internTable'].values()) {
            for (const term of table.values()) {
                terms.push(term);
            }
        }
        return terms;
    }
    /** Get interning statistics. */
    getStats() {
        const allTerms = this.getAllTerms();
        const byOp = {};
        let variables = 0, constants = 0, compounds = 0;
        for (const term of allTerms) {
            byOp[term.op] = (byOp[term.op] ?? 0) + 1;
            switch (term.op) {
                case TermOp.VARIABLE:
                    variables++;
                    break;
                case TermOp.CONSTANT:
                    constants++;
                    break;
                default:
                    compounds++;
                    break;
            }
        }
        // Rough memory estimate: 64 bytes per term + string data
        const memoryEstimate = allTerms.length * 64 +
            allTerms.reduce((sum, t) => sum + JSON.stringify(t).length, 0);
        return {
            totalTerms: allTerms.length,
            variables,
            constants,
            compounds,
            byOp,
            memoryEstimate,
        };
    }
    /** Clear all interned terms (for testing). */
    clear() {
        TermFactory.reset();
        this.factory = TermFactory.getInstance();
    }
    /** Get the underlying factory. */
    getFactory() {
        return this.factory;
    }
}
/** Global interner instance. */
export const termInterner = new TermInterner();
/** Convenience methods for common compound terms. */
termInterner.conjunction = (...terms) => termInterner.compound(TermOp.CONJUNCTION, ...terms);
termInterner.disjunction = (...terms) => termInterner.compound(TermOp.DISJUNCTION, ...terms);
termInterner.negation = (term) => termInterner.compound(TermOp.NEGATION, term);
termInterner.implication = (antecedent, consequent) => termInterner.compound(TermOp.IMPLICATION, antecedent, consequent);
termInterner.equivalence = (left, right) => termInterner.compound(TermOp.EQUIVALENCE, left, right);
termInterner.product = (...terms) => termInterner.compound(TermOp.PRODUCT, ...terms);
termInterner.inheritance = (subject, predicate) => termInterner.compound(TermOp.INHERITANCE, subject, predicate);
termInterner.similarity = (subject, predicate) => termInterner.compound(TermOp.SIMILARITY, subject, predicate);
termInterner.extensionalImage = (term, image) => termInterner.compound(TermOp.EXTENSIONAL_IMAGE, term, image);
termInterner.intensionalImage = (term, image) => termInterner.compound(TermOp.INTENSIONAL_IMAGE, term, image);
termInterner.prediction = (term, predicted) => termInterner.compound(TermOp.PREDICTION, term, predicted);
termInterner.concurrent = (...terms) => termInterner.compound(TermOp.CONCURRENT, ...terms);
termInterner.sequential = (...terms) => termInterner.compound(TermOp.SEQUENTIAL, ...terms);
termInterner.parallel = (...terms) => termInterner.compound(TermOp.PARALLEL, ...terms);
termInterner.statement = (term) => termInterner.compound(TermOp.STATEMENT, term);
termInterner.question = (term) => termInterner.compound(TermOp.QUESTION, term);
termInterner.goal = (term) => termInterner.compound(TermOp.GOAL, term);
termInterner.getHash = (term) => termInterner.hash(term);
/**
 * Term structural equality.
 * Returns true if a and b have the same structure and values.
 */
export function termEquals(a, b) {
    if (a === b)
        return true;
    if (a.op !== b.op)
        return false;
    if (a.op === TermOp.CONSTANT && b.op === TermOp.CONSTANT) {
        return a.value === b.value;
    }
    if (a.op === TermOp.VARIABLE && b.op === TermOp.VARIABLE) {
        return a.name === b.name;
    }
    const ca = a;
    const cb = b;
    if (ca.arity !== cb.arity)
        return false;
    for (let i = 0; i < ca.arity; i++) {
        if (!termEquals(ca.args[i], cb.args[i]))
            return false;
    }
    return true;
}
/**
 * Term hash function.
 */
export function termHash(term) {
    return termInterner.hash(term);
}
/**
 * Term complexity function.
 */
export function termComplexity(term) {
    return termInterner.complexity(term);
}
/**
 * Create a term from a JSON-serializable representation.
 * Used for deserialization (e.g., from log, network).
 */
export function termFromJSON(json) {
    switch (json.op) {
        case 'var':
            return termInterner.variable(json.name);
        case 'const':
            return termInterner.constant(json.value);
        default:
            return termInterner.compound(json.op, ...(json.args ?? []).map(termFromJSON));
    }
}
/**
 * Convert a term to JSON-serializable form.
 */
export function termToJSON(term) {
    const base = { op: term.op };
    if (term.op === TermOp.VARIABLE) {
        base.name = term.name;
    }
    else if (term.op === TermOp.CONSTANT) {
        base.value = term.value;
    }
    else {
        base.args = term.args.map(termToJSON);
    }
    return base;
}
/**
 * Visit a term tree with a visitor.
 */
export function visitTerm(term, visitor) {
    switch (term.op) {
        case TermOp.VARIABLE:
            return visitor.visitVariable(term);
        case TermOp.CONSTANT:
            return visitor.visitConstant(term);
        default: {
            const children = term.args.map(arg => visitTerm(arg, visitor));
            return visitor.visitCompound(term, children);
        }
    }
}
/**
 * Map a term tree, transforming each node.
 */
export function mapTerm(term, mapper) {
    const mapped = mapper(term);
    if (mapped !== term)
        return mapped;
    if (term.op === TermOp.VARIABLE || term.op === TermOp.CONSTANT) {
        return term;
    }
    const compound = term;
    const newArgs = compound.args.map(arg => mapTerm(arg, mapper));
    if (newArgs === compound.args)
        return term;
    return termInterner.compound(compound.op, ...newArgs);
}
/**
 * Find all subterms matching a predicate.
 */
export function findSubterms(term, predicate) {
    const results = [];
    visitTerm(term, {
        visitVariable: (t) => { if (predicate(t))
            results.push(t); return undefined; },
        visitConstant: (t) => { if (predicate(t))
            results.push(t); return undefined; },
        visitCompound: (t, children) => { if (predicate(t))
            results.push(t); return undefined; },
    });
    return results;
}
/**
 * Get all variables in a term.
 */
export function getVariables(term) {
    return findSubterms(term, t => t.op === TermOp.VARIABLE);
}
/**
 * Get all constants in a term.
 */
export function getConstants(term) {
    return findSubterms(term, t => t.op === TermOp.CONSTANT);
}
/**
 * Substitute variables in a term.
 */
export function substitute(term, substitution) {
    return mapTerm(term, t => {
        if (t.op === TermOp.VARIABLE) {
            return substitution.get(t) ?? t;
        }
        return t;
    });
}
/** Get args of a compound term. */
function getArgs(term) {
    return term.op !== TermOp.VARIABLE && term.op !== TermOp.CONSTANT ? term.args : null;
}
/**
 * Check if a term contains a variable.
 */
export function containsVariable(term, variable) {
    return findSubterms(term, t => t === variable).length > 0;
}
/**
 * Get the set of all variables in a term.
 */
export function getVariableSet(term) {
    return new Set(getVariables(term));
}
/**
 * Rename variables in a term to avoid capture.
 */
export function renameVariables(term, prefix = '_v') {
    const mapping = new Map();
    let counter = 0;
    return mapTerm(term, t => {
        if (t.op === TermOp.VARIABLE) {
            let newVar = mapping.get(t);
            if (!newVar) {
                newVar = termInterner.variable(`${prefix}${counter++}`);
                mapping.set(t, newVar);
            }
            return newVar;
        }
        return t;
    });
}
/**
 * Standardize variables apart (rename to fresh variables).
 */
export function standardizeApart(term) {
    return renameVariables(term);
}
/**
 * Check if two terms are unifiable (without performing unification).
 * Quick syntactic check.
 */
export function isUnifiable(a, b) {
    if (a === b)
        return true;
    if (a.op === TermOp.VARIABLE || b.op === TermOp.VARIABLE)
        return true;
    if (a.op !== b.op)
        return false;
    if (a.op === TermOp.CONSTANT && b.op === TermOp.CONSTANT) {
        return a.value === b.value;
    }
    const ca = a;
    const cb = b;
    if (ca.arity !== cb.arity)
        return false;
    for (let i = 0; i < ca.arity; i++) {
        if (!isUnifiable(ca.args[i], cb.args[i]))
            return false;
    }
    return true;
}
export { TermOp, TermFactory, isCompound, isAtomic } from './term-internal';
