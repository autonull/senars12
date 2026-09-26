import type { ReasoningBudget } from '@senars/kernel/schemas';
import type { Perception } from '../../game/Game.js';
import type { ActionProposal, LearningEvent, Reflex } from '../../reflex/Reflex.js';
import type { EmbeddingPointer, JudgmentManifold, JudgmentQuery, JudgmentProposition } from './types.js';
import { createHash } from 'node:crypto';
import type { JudgmentProvenance } from './decide.js';

/**
 * Two-stage placement fan-out (W7 / DQ2 — the first live `judgeCascade`
 * consumer). Stage-1 coarse-ranks the entire legal-action set in ONE batch
 * (one-prefill parity, Bench 35d); stage-2 fine-scores only the top-K when
 * the set exceeds K. Stage-2's query space is derived from stage-1's resolved
 * ranking — the cascade dependency, batched.
 */
export interface PlacementCascadeReflexOptions {
  /** Stage-2 fires only when the legal-action set exceeds this (DQ2: cap-gated). */
  topK?: number;
}

const COARSE_QUERY = (action: string): JudgmentQuery => ({
  kind: 'evaluate',
  instruction: `Coarse feasibility of placement ${action}`,
  rubric: 'feasibility',
  axis: 'teleological',
});

const FINE_QUERY = (action: string): JudgmentQuery => ({
  kind: 'evaluate',
  instruction: `Fine value of placement ${action}`,
  rubric: 'reflex_value',
  axis: 'teleological',
});

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function deriveCascadeProvenance(
  stage1: JudgmentProposition | undefined,
  stage2: JudgmentProposition | undefined,
  inputDigest: string,
  decision: 'act' | 'review' | 'block' | 'abstain',
  abstained: boolean
): JudgmentProvenance {
  const first = stage2 ?? stage1;
  const calibrationDigest = first?.calibration?.version
    ? sha256(`${first.modelDigest}:${first.calibration.version}`)
    : undefined;
  return {
    modelDigest: first?.modelDigest,
    calibrationDigest,
    inputDigest,
    contrastiveDigest: undefined,
    fitted: (stage1?.calibration?.fitted === true) || (stage2?.calibration?.fitted === true),
    abstained,
    band: decision,
    timestamp: Date.now(),
  };
}

interface PrefetchEntry {
  score: number;
  provenance: JudgmentProvenance;
}

export class PlacementCascadeReflex implements Reflex<Perception, string> {
  readonly id = 'placement-cascade';
  readonly topK: number;

  #fallback: Reflex<unknown, unknown>;
  #prefetch = new Map<string, Map<string, PrefetchEntry>>();

  constructor(fallback: Reflex<unknown, unknown>, options: PlacementCascadeReflexOptions = {}) {
    this.#fallback = fallback;
    this.topK = options.topK ?? 8;
  }

  /** Called at the attend stage of the same cycle, before propose. */
  async prefetch(
    stateId: string,
    sharedContext: EmbeddingPointer,
    legalActions: readonly string[],
    manifold: JudgmentManifold,
    budget: ReasoningBudget
  ): Promise<void> {
    try {
      // Stage-1: one batched coarse rank over the whole set.
      const coarse = await manifold.judgeBatch(
        sharedContext,
        legalActions.map(COARSE_QUERY),
        budget
      );
      const ranked = legalActions
        .map((action, i) => {
          const p = coarse[i];
          return { action, p: p && !p.abstained && p.kind === 'evaluate' ? p.score : -1 };
        })
        .sort((a, b) => b.p - a.p);

      if (ranked.length <= this.topK) {
        const rows = new Map<string, PrefetchEntry>();
        for (const r of ranked) {
          const prop = coarse[legalActions.indexOf(r.action)];
          const provenance = deriveCascadeProvenance(prop, undefined, sha256(r.action), 'act', !prop || prop.abstained);
          rows.set(r.action, { score: r.p, provenance });
        }
        this.#prefetch.set(stateId, rows);
        return;
      }

      // Stage-2: fine reflex_value on the top-K only (cascade dependency).
      const topKActions = ranked.slice(0, this.topK).map((r) => r.action);
      const fine = await manifold.judgeBatch(
        sharedContext,
        topKActions.map(FINE_QUERY),
        budget
      );
      const rows = new Map<string, PrefetchEntry>();
      topKActions.forEach((action, i) => {
        const p = fine[i];
        if (p && !p.abstained && p.kind === 'evaluate') {
          const coarseProp = coarse[legalActions.indexOf(action)];
          const provenance = deriveCascadeProvenance(coarseProp, p, sha256(action), 'act', false);
          rows.set(action, { score: p.score, provenance });
        }
      });
      if (rows.size > 0) this.#prefetch.set(stateId, rows);
    } catch {
      // Manifold unavailable — table stays cold, incumbent reflex serves
    }
  }

  /** Synchronous contract honored: reads the prefetch table (consume-once). */
  propose(state: Perception, legalActions: string[]): ActionProposal[] {
    const rows = this.#prefetch.get(state.stateId);
    if (!rows) return this.#fallback.propose(state, legalActions) as ActionProposal[];

    this.#prefetch.delete(state.stateId);
    const proposals: ActionProposal[] = [];
    const fallbackProposals =
      rows.size < legalActions.length
        ? (this.#fallback.propose(state, legalActions) as ActionProposal[])
        : [];
    const byAction = new Map(fallbackProposals.map((p) => [String(p.action), p]));

    for (const action of legalActions) {
      const entry = rows.get(String(action));
      const incumbent = byAction.get(String(action));
      if (entry !== undefined)
        proposals.push({ action, value: entry.score, confidence: entry.score, source: this.id, provenance: entry.provenance });
      else if (incumbent) proposals.push(incumbent);
    }
    return proposals;
  }

  learn(event: LearningEvent): void {
    this.#fallback.learn(event);
  }
}
