/**
 * Compound Term Operations — utilities for compound terms.
 */
import { TermOp } from '../term-ops';
/** Get term arguments. */
export function getArgs(term) {
    if (term.op !== TermOp.VARIABLE && term.op !== TermOp.CONSTANT) {
        return term.args;
    }
    return [];
}
/** Check if term is an inheritance statement. */
export function isInheritance(term) {
    return isCompound(term) && term.op === TermOp.INHERITANCE;
}
/** Check if term is a conjunction. */
export function isConjunction(term) {
    return isCompound(term) && term.op === TermOp.CONJUNCTION;
}
/** Check if term is a disjunction. */
export function isDisjunction(term) {
    return isCompound(term) && term.op === TermOp.DISJUNCTION;
}
/** Check if term is a negation. */
export function isNegation(term) {
    return isCompound(term) && term.op === TermOp.NEGATION;
}
/** Check if term is a similarity. */
export function isSimilarity(term) {
    return isCompound(term) && term.op === TermOp.SIMILARITY;
}
/** Check if term is an implication. */
export function isImplication(term) {
    return isCompound(term) && (term.op === TermOp.IMPLICATION || term.op === TermOp.PREDICTIVE_IMPLICATION);
}
/** Check if term is an equivalence. */
export function isEquivalence(term) {
    return isCompound(term) && term.op === TermOp.EQUIVALENCE;
}
/** Check if term is a statement (inheritance, similarity, etc.). */
export function isStatement(term) {
    return isCompound(term) &&
        (term.op === TermOp.INHERITANCE ||
            term.op === TermOp.SIMILARITY ||
            term.op === TermOp.IMPLICATION ||
            term.op === TermOp.PREDICTIVE_IMPLICATION ||
            term.op === TermOp.EQUIVALENCE);
}
/** Check if term is a question (uses STATEMENT/QUESTION/GOAL punctuation). */
export function isQuestion(term) {
    return isCompound(term) && term.op === TermOp.QUESTION;
}
/** Check if term is a goal (uses STATEMENT/QUESTION/GOAL punctuation). */
export function isGoal(term) {
    return isCompound(term) && term.op === TermOp.GOAL;
}
/** Check if term is atomic (variable or constant). */
export function isAtomic(term) {
    return term.op === TermOp.VARIABLE || term.op === TermOp.CONSTANT;
}
/** Check if term is compound (not atomic). */
export function isCompound(term) {
    return term.op !== TermOp.VARIABLE && term.op !== TermOp.CONSTANT;
}
/** Check if term has any variables. */
export function hasVariable(term) {
    if (term.op === TermOp.VARIABLE)
        return true;
    if (isCompound(term)) {
        return term.args.some(hasVariable);
    }
    return false;
}
/** Get all symbols in a term. */
export function getSymbols(term) {
    const symbols = new Set();
    function collect(t) {
        if (t.op === TermOp.CONSTANT) {
            symbols.add(t.value);
        }
        else if (isCompound(t)) {
            for (const arg of t.args) {
                collect(arg);
            }
        }
    }
    collect(term);
    return symbols;
}
/** Check if two terms share any symbol. */
export function sharesSymbol(a, b) {
    const aSymbols = getSymbols(a);
    const bSymbols = getSymbols(b);
    for (const s of aSymbols) {
        if (bSymbols.has(s))
            return true;
    }
    return false;
}
/** Calculate structural similarity between two terms (0-1). */
export function calculateSimilarity(a, b) {
    if (a.hash === b.hash)
        return 1.0;
    const aSyms = getSymbols(a);
    const bSyms = getSymbols(b);
    if (aSyms.size === 0 && bSyms.size === 0)
        return 1.0;
    if (aSyms.size === 0 || bSyms.size === 0)
        return 0.0;
    let intersection = 0;
    for (const s of aSyms) {
        if (bSyms.has(s))
            intersection++;
    }
    const union = aSyms.size + bSyms.size - intersection;
    return intersection / union;
}
/** Visit all subterms. */
export function visitTerms(term, visitor) {
    visitor(term);
    if (isCompound(term)) {
        for (const arg of term.args) {
            visitTerms(arg, visitor);
        }
    }
}
/** Create a term key for hashing/lookup. */
export function termKey(term) {
    if (term.op === TermOp.VARIABLE) {
        return `var:${term.name}`;
    }
    if (term.op === TermOp.CONSTANT) {
        return `const:${term.value}`;
    }
    const argKeys = term.args.map(termKey).join(',');
    return `${term.op}(${argKeys})`;
}
