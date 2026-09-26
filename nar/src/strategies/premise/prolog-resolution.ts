/**
 * Genuine PrologResolutionStrategy — SLD resolution with unification,
 * Horn clause backward chaining, occurs-check, depth-bounded search.
 * Registered as `premise` strategy `prolog-resolution`.
 */
import type { Concept, Memory } from '../../memory';
import type { Term } from '../../terms';
import { TermBuilder, unify, termsEqual, isVariableSymbol, getTermArgs, extractSymbols } from '../../terms';
import type { Task, TaskType } from '../../types';
import { createSecondaryTask } from '../../types';
import type { Strategy } from '../types';
import type { ComponentMetadata } from '../types';

interface PrologConfig {
  maxDepth?: number;
  maxResults?: number;
  occursCheck?: boolean;
}

interface Clause {
  head: Term;
  body: Term[];
}

interface Substitution {
  [varName: string]: Term | undefined;
}

interface ResolutionState {
  goals: Term[];
  substitution: Substitution;
  depth: number;
  derivation: Clause[];
}

function isVariable(term: Term): term is Term & { kind: 'atom'; symbol: string } {
  return term.kind === 'atom' && isVariableSymbol(term.symbol);
}

function occursCheck(varName: string, term: Term, subst: Substitution): boolean {
  const resolved = subst[varName];
  if (resolved) return occursCheck(varName, resolved, subst);
  if (isVariable(term)) return term.symbol === varName;
  const args = getTermArgs(term);
  if (args) return args.some(arg => occursCheck(varName, arg, subst));
  return false;
}

function applySubstitution(term: Term, subst: Substitution): Term {
  if (isVariable(term)) {
    const replacement = subst[term.symbol];
    if (replacement) return applySubstitution(replacement, subst);
    return term;
  }
  const args = getTermArgs(term);
  if (!args) return term;
  const newArgs = args.map((arg): Term => applySubstitution(arg, subst));
  return TermBuilder.compound(term.kind as any, newArgs);
}

function unifyTerms(t1: Term, t2: Term, subst: Substitution): Substitution | null {
  const r1 = applySubstitution(t1, subst);
  const r2 = applySubstitution(t2, subst);

  if (termsEqual(r1, r2)) return subst;

  if (isVariable(r1)) {
    if (occursCheck(r1.symbol, r2, subst)) return null;
    return { ...subst, [r1.symbol]: r2 };
  }
  if (isVariable(r2)) {
    if (occursCheck(r2.symbol, r1, subst)) return null;
    return { ...subst, [r2.symbol]: r1 };
  }

  const args1 = getTermArgs(r1);
  const args2 = getTermArgs(r2);
  if (!args1 || !args2 || args1.length !== args2.length) return null;

  let newSubst: Substitution | null = subst;
  for (let i = 0; i < args1.length; i++) {
    const a1 = args1[i];
    const a2 = args2[i];
    if (!a1 || !a2) return null;
    newSubst = unifyTerms(a1, a2, newSubst ?? {});
    if (!newSubst) return null;
  }
  return newSubst;
}

function findHornClauses(memory: Memory): Clause[] {
  const clauses: Clause[] = [];
  for (const concept of memory.listConcepts()) {
    const belief = concept.beliefBag.peek();
    if (!belief?.truth) continue;
    const term = concept.term;
    if (term.kind === 'implication') {
      const args = getTermArgs(term);
      if (args && args.length === 2) {
        const a0 = args[0];
        const a1 = args[1];
        if (a0 && a1) clauses.push({ head: a1, body: [a0] });
      }
    } else if (term.kind === 'equivalence') {
      const args = getTermArgs(term);
      if (args && args.length === 2) {
        const a0 = args[0];
        const a1 = args[1];
        if (a0 && a1) {
          clauses.push({ head: a0, body: [a1] });
          clauses.push({ head: a1, body: [a0] });
        }
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
  memory: Memory
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

    const newGoals = [...clause.body, ...restGoals].map(g => applySubstitution(g, headSubst));
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
    description: 'SLD resolution with unification, Horn clause backward chaining, occurs-check, depth-bounded search',
  };
  readonly sampleSize = 20;
  readonly limit = 5;

  constructor(private readonly config: PrologConfig = {}) {}

  selectSecondary(task: Task, memory: Memory): Task[] {
    const clauses = findHornClauses(memory);
    if (clauses.length === 0) return [];

    const results: Task[] = [];
    const initialState: ResolutionState = {
      goals: [task.term],
      substitution: {},
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