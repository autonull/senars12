import type { ActionProposal, LearningEvent, Reflex } from '../../reflex/Reflex.js';
import type { Perception } from '../../game/Game.js';
import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { EmbeddingPointer, JudgmentManifold } from './types.js';

/**
 * Semantic reflex (§7.3): bridges the synchronous `Reflex.propose` contract to
 * the asynchronous Manifold by serving proposals from a judgment table
 * prefetched at the attend stage of the same cycle. Falls back to the
 * incumbent reflex when the table is cold.
 */
export class ManifoldReflex implements Reflex<Perception, string> {
  readonly id = 'manifold-reflex';

  #fallback: Reflex<unknown, unknown>;
  #prefetch = new Map<string, Map<string, number>>();

  constructor(fallback: Reflex<unknown, unknown>) {
    this.#fallback = fallback;
  }

  /** Called at the attend stage of the same cycle, before propose. */
  async prefetch(
    stateId: string,
    sharedContext: EmbeddingPointer,
    legalActions: readonly string[],
    manifold: JudgmentManifold,
    budget: ReasoningBudget
  ): Promise<void> {
    const queries = legalActions.map((action) => ({
      kind: 'evaluate' as const,
      instruction: `Evaluate value of action ${action}`,
      rubric: 'reflex_value' as const,
      axis: 'teleological' as const,
    }));
    try {
      const propositions = await manifold.judgeBatch(sharedContext, queries, budget);
      const rows = new Map<string, number>();
      legalActions.forEach((action, i) => {
        const p = propositions[i];
        if (p && !p.abstained && p.kind === 'evaluate') rows.set(action, p.score);
      });
      if (rows.size > 0) this.#prefetch.set(stateId, rows);
    } catch {
      // Manifold unavailable — table stays cold, incumbent reflex serves
    }
  }

  /** Synchronous contract honored: reads the prefetch table. */
  propose(state: Perception, legalActions: string[]): ActionProposal[] {
    const rows = this.#prefetch.get(state.stateId);
    if (!rows) return this.#fallback.propose(state, legalActions) as ActionProposal[];

    const proposals: ActionProposal[] = [];
    const fallbackProposals =
      rows.size < legalActions.length
        ? (this.#fallback.propose(state, legalActions) as ActionProposal[])
        : [];
    const byAction = new Map(fallbackProposals.map((p) => [p.action, p]));

    for (const action of legalActions) {
      const score = rows.get(action);
      const incumbent = byAction.get(action);
      if (score !== undefined) {
        proposals.push({ action, value: score, confidence: score, source: this.id });
      } else if (incumbent) {
        proposals.push(incumbent);
      }
    }
    return proposals;
  }

  learn(event: LearningEvent): void {
    // Distillation label: (perception, action, outcome) pairs for reflex_value heads
    this.#fallback.learn(event);
  }
}
