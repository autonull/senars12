import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { Perception } from '../../game/Game.js';
import type { ActionProposal, LearningEvent, Reflex } from '../../reflex/Reflex.js';
import type { EmbeddingPointer, JudgmentManifold } from './types.js';

/**
 * UCB selection policy over `reflex_value` manifold scores (C5): bonus is
 * proportional to exploration uncertainty (per-action visit counts). Comparison
 * policy for Bench 20/21; selected via `systemOne.rl.policy: 'ucb'`.
 */
export class ManifoldUCBReflex implements Reflex<Perception, string> {
  readonly id = 'manifold-ucb-reflex';

  readonly #inner: {
    prefetch: (
      stateId: string,
      context: EmbeddingPointer,
      legalActions: readonly string[],
      manifold: JudgmentManifold,
      budget: ReasoningBudget
    ) => Promise<void>;
    propose: (state: Perception, legalActions: string[]) => ActionProposal[];
  };
  readonly #ucbC: number;
  readonly #visits = new Map<string, Map<string, number>>();
  #totalVisits = 0;

  constructor(inner: ManifoldUCBReflexDelegates, ucbC = 0.5) {
    this.#inner = inner;
    this.#ucbC = ucbC;
  }

  prefetch(
    stateId: string,
    context: EmbeddingPointer,
    legalActions: readonly string[],
    manifold: JudgmentManifold,
    budget: ReasoningBudget
  ): Promise<void> {
    return this.#inner.prefetch(stateId, context, legalActions, manifold, budget);
  }

  propose(state: Perception, legalActions: string[]): ActionProposal[] {
    const proposals = this.#inner.propose(state, legalActions);
    const stateVisits = this.#visits.get(state.stateId) ?? new Map<string, number>();
    const total = Math.max(1, this.#totalVisits);
    return proposals
      .map((p) => {
        const visits = stateVisits.get(String(p.action)) ?? 0;
        const bonus = this.#ucbC * Math.sqrt(Math.log(total) / (1 + visits));
        return { ...p, value: p.value + bonus };
      })
      .sort((a, b) => b.value - a.value);
  }

  /** Record an executed action's visit for the UCB bonus. */
  recordVisit(stateId: string, action: string): void {
    const stateVisits = this.#visits.get(stateId) ?? new Map<string, number>();
    stateVisits.set(action, (stateVisits.get(action) ?? 0) + 1);
    this.#visits.set(stateId, stateVisits);
    this.#totalVisits++;
  }

  learn(event: LearningEvent): void {
    this.recordVisit(
      event.perception?.stateId ?? 'unknown-state',
      event.actionExecuted ?? event.actionProposed
    );
  }
}

export interface ManifoldUCBReflexDelegates {
  prefetch: (
    stateId: string,
    context: EmbeddingPointer,
    legalActions: readonly string[],
    manifold: JudgmentManifold,
    budget: ReasoningBudget
  ) => Promise<void>;
  propose: (state: Perception, legalActions: string[]) => ActionProposal[];
}
