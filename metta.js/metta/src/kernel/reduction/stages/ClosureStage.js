import {ReductionStage} from './ReductionStage.js';
import {exp, isExpression} from '../../Term.js';

export class ClosureStage extends ReductionStage {
    constructor() {
        super('closure');
    }

    process(atom, context) {
        if (!isExpression(atom) || !atom.operator || !isExpression(atom.operator)) {
            return null;
        }
        // Detect partial application: ((f 1) 2) -> operator is (f 1), args are [2]
        const opExpr = atom.operator;
        const funcAtom = opExpr.operator;
        if (!funcAtom || (!funcAtom.name && funcAtom.type !== 'variable' && !funcAtom.operator?.name)) {
            return null;
        }
        let rules = funcAtom?.name ? context.space?.rulesFor(funcAtom) : [];
        if ((!rules || rules.length === 0) && atom.operator?.operator?.operator?.name) { rules = context.space?.rulesFor(atom.operator.operator.operator); }
        if ((!rules || rules.length === 0) && atom.operator?.operator?.operator?.operator?.name) { rules = context.space?.rulesFor(atom.operator.operator.operator.operator); }
        if ((!rules || rules.length === 0) && funcAtom?.operator?.name) { rules = context.space?.rulesFor(funcAtom.operator); }
        if ((!rules || rules.length === 0) && funcAtom?.type === 'variable') { rules = context.space?.all() || []; }
        if ((!rules || rules.length === 0) && funcAtom?.name) {
            return null;
        }
        // Combine captured args with provided args: (f 1) captured [1], (f 1) 2 provides [2]
        // For each rule, build a new expression with all args combined
        const capturedArgs = opExpr.components ?? [];
        const providedArgs = atom.components ?? [];
        const allArgs = [...capturedArgs, ...providedArgs];

        // Try to match rules with the combined args
        const matchedRules = [];
        for (const rule of rules) {
            const {pattern} = rule;
            if (!isExpression(pattern)) {
                continue;
            }
            const patternArgs = pattern.components ?? [];
            // Check if we have at least as many args as the pattern expects
            if (allArgs.length >= patternArgs.length) {
                matchedRules.push(rule);
            }
        }

        if (matchedRules.length === 0) {
            return null;
        }
        return {matchClosure: true, atom, funcAtom, capturedArgs, providedArgs, allArgs, rules: matchedRules};
    }
}
