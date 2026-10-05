/**
 * Genuine PrologResolutionStrategy — SLD resolution with unification,
 * Horn clause backward chaining, occurs-check, depth-bounded search.
 * Registered as `premise` strategy `prolog-resolution`.
 */
import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { Term } from '../../terms';
import { applySubstitution, getArgs, unify, type Substitution } from '../../terms';
import type { Task, TaskType } from '../../types';
import { createSecondaryTask } from '../../types';
import type { ComponentMetadata, Strategy } from '../types';

interface PrologConfig {
  maxDepth?: number;
  maxResults?: number;
  occursCheck?: boolean;
}

interface Clause {
  head: Term;
  body: Term[];
}

interface ResolutionState {
  goals: Term[];
  substitution: Substitution;
  depth: number;
  derivation: Clause[];
}

/**
 * SLD resolution carries an accumulated substitution, so both clauses are
 * ground-ed through it before the shared unifier (which owns the occurs check)
 * runs.
 */
function unifyTerms(t1: Term, t2: Term, subst: Substitution): Substitution | null {
  return unify(applySubstitution(t1, subst), applySubstitution(t2, subst), subst, true) ?? null;
}

function findHornClauses(memory: MemoryView): Clause[] {
  const clauses: Clause[] = [];
  for (const concept of memory.listConcepts()) {
    const belief = concept.beliefBag.peek();
    if (!belief?.truth) continue;
    const term = concept.term;
    if (term.kind === 'implication') {
      const [a0, a1] = getArgs(term);
      if (a0 && a1) clauses.push({ head: a1, body: [a0] });
    } else if (term.kind === 'equivalence') {
      const [a0, a1] = getArgs(term);
      if (a0 && a1) {
        clauses.push({ head: a0, body: [a1] });
        clauses.push({ head: a1, body: [a0] });
      }
    } else {
      clauses.push({ head: term, body: [] });
    }
  }
  return clauses;
}

function sldResolve(
  goal: Term,
  clauses: Clause[],
  config: PrologConfig,
  state: ResolutionState,
  results: Task[],
  memory: MemoryView
): void {
  if (state.depth >= (config.maxDepth ?? 10)) return;
  if (results.length >= (config.maxResults ?? 10)) return;

  if (state.goals.length === 0) {
    const finalTerm = applySubstitution(goal, state.substitution);
    const concept = memory.getConcept(finalTerm);
    if (concept) {
      const belief = concept.beliefBag.peek();
      if (belief?.truth) {
        results.push(createSecondaryTask(finalTerm, concept.priority, belief.truth, 'belief'));
      }
    }
    return;
  }

  const [currentGoal, ...restGoals] = state.goals;
  if (!currentGoal) return;
  const resolvedGoal = applySubstitution(currentGoal, state.substitution);

  for (const clause of clauses) {
    const headSubst = unifyTerms(resolvedGoal, clause.head, state.substitution);
    if (!headSubst) continue;

    const newGoals = [...clause.body, ...restGoals].map((g) => applySubstitution(g, headSubst));
    sldResolve(
      goal,
      clauses,
      config,
      {
        goals: newGoals,
        substitution: headSubst,
        depth: state.depth + 1,
        derivation: [...state.derivation, clause],
      },
      results,
      memory
    );
    if (results.length >= (config.maxResults ?? 10)) return;
  }
}

export class PrologResolutionStrategy implements Strategy {
  readonly name = 'prolog-resolution';
  readonly metadata: ComponentMetadata = {
    name: 'prolog-resolution',
    description:
      'SLD resolution with unification, Horn clause backward chaining, occurs-check, depth-bounded search',
  };
  readonly sampleSize = 20;
  readonly limit = 5;

  constructor(private readonly config: PrologConfig = {}) {}

  selectSecondary(task: Task, memory: MemoryView): Task[] {
    const clauses = findHornClauses(memory);
    if (clauses.length === 0) return [];

    const results: Task[] = [];
    const initialState: ResolutionState = {
      goals: [task.term],
      substitution: new Map(),
      depth: 0,
      derivation: [],
    };

    sldResolve(task.term, clauses, this.config, initialState, results, memory);
    return results.slice(0, this.config.maxResults ?? this.limit);
  }
}

export const createPrologResolutionStrategy = (config?: PrologConfig): Strategy => {
  return new PrologResolutionStrategy(config);
};
