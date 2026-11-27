import { applySubstitution, getArgs, unify } from '../../terms';
import { createSecondaryTask } from '../../types';
import { Strategy as BaseStrategy } from '../base';
/**
 * SLD resolution carries an accumulated substitution, so both clauses are
 * ground-ed through it before the shared unifier (which owns the occurs check)
 * runs.
 */
function unifyTerms(t1, t2, subst) {
    return unify(applySubstitution(t1, subst), applySubstitution(t2, subst), subst, true) ?? null;
}
function findHornClauses(memory) {
    const clauses = [];
    for (const concept of memory.conceptValues()) {
        const belief = concept.topBelief();
        if (!belief)
            continue;
        const term = concept.term;
        if (term.kind === 'implication') {
            const [a0, a1] = getArgs(term);
            if (a0 && a1)
                clauses.push({ head: a1, body: [a0] });
        }
        else if (term.kind === 'equivalence') {
            const [a0, a1] = getArgs(term);
            if (a0 && a1) {
                clauses.push({ head: a0, body: [a1] });
                clauses.push({ head: a1, body: [a0] });
            }
        }
        else {
            clauses.push({ head: term, body: [] });
        }
    }
    return clauses;
}
function sldResolve(goal, clauses, config, state, results, memory) {
    if (state.depth >= (config.maxDepth ?? 10))
        return;
    if (results.length >= (config.maxResults ?? 10))
        return;
    if (state.goals.length === 0) {
        const finalTerm = applySubstitution(goal, state.substitution);
        const concept = memory.getConcept(finalTerm);
        if (concept) {
            const belief = concept.topBelief();
            if (belief) {
                results.push(createSecondaryTask(finalTerm, concept.priority, belief.truth, 'belief'));
            }
        }
        return;
    }
    const [currentGoal, ...restGoals] = state.goals;
    if (!currentGoal)
        return;
    const resolvedGoal = applySubstitution(currentGoal, state.substitution);
    for (const clause of clauses) {
        const headSubst = unifyTerms(resolvedGoal, clause.head, state.substitution);
        if (!headSubst)
            continue;
        const newGoals = [...clause.body, ...restGoals].map((g) => applySubstitution(g, headSubst));
        sldResolve(goal, clauses, config, {
            goals: newGoals,
            substitution: headSubst,
            depth: state.depth + 1,
        }, results, memory);
        if (results.length >= (config.maxResults ?? 10))
            return;
    }
}
export class PrologResolutionStrategy extends BaseStrategy {
    config;
    sampleSize = 20;
    limit = 5;
    constructor(config = {}) {
        super('prolog-resolution', 'SLD resolution with unification, Horn clause backward chaining, occurs-check, depth-bounded search');
        this.config = config;
    }
    selectSecondary(task, memory) {
        const clauses = findHornClauses(memory);
        if (clauses.length === 0)
            return [];
        const results = [];
        const initialState = {
            goals: [task.term],
            substitution: new Map(),
            depth: 0,
        };
        sldResolve(task.term, clauses, this.config, initialState, results, memory);
        return results.slice(0, this.config.maxResults ?? this.limit);
    }
}
export const createPrologResolutionStrategy = (config) => {
    return new PrologResolutionStrategy(config);
};
