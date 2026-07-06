/**
 * SubExprStage.js - Reduce sub-expressions before rule matching
 * Handles nested expressions like (if (has-type? 42 Number) 42 (error ...))
 * by first reducing the condition to a value.
 */
import {ReductionStage} from './ReductionStage.js';
import {isExpression} from '../../Term.js';

// Operators where sub-expression reduction should NOT happen on the first arg
const SKIP_FIRST_ARG = new Set(['let*', 'let', 'lambda', 'λ', '|->', 'function', 'collapse', 'collapse-n', 'foldall']);

export class SubExprStage extends ReductionStage {
    constructor() {
        super('subexpr');
    }

    process(atom, _context) {
        if (!atom || !isExpression(atom)) return null;
        const opName = atom.operator?.name || atom.operator;

        // Skip binding forms — their first arg (bindings) should not be reduced
        if (SKIP_FIRST_ARG.has(opName)) return null;

        // Reduce operator if it's an expression (e.g., ((f 1) 2) where f 1 is expr)
        if (isExpression(atom.operator)) {
            return {reduceOperatorExpr: true, atom};
        }

        // Reduce first component if it's an expression (e.g., condition in if)
        if (atom.components?.length > 0 && isExpression(atom.components[0])) {
            return {reduceFirstArg: true, atom};
        }

        return null;
    }
}

