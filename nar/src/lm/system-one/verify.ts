/**
 * P2 (TODO19): SDE-style verify cascade + consensus fan-out as a budget knob.
 * Thin compositions over `judgeCascade`, `ConfidenceRouter`, and the manifold's
 * self-consistency `consensus` — no new machinery.
 */

import {
  type CascadeJudge,
  type ConfidenceBands,
  judgeCascade,
  routeConfidence,
  truthProbability,
} from './policy.js';
import type {
  EmbeddingPointer,
  EvaluateProposition,
  EvaluateQuery,
  JudgmentProposition,
  JudgmentQuery,
  ReasoningBudget,
} from './types.js';

export type VerifyDecision = 'act' | 'review' | 'block' | 'abstain';

export interface VerifyResult {
  decision: VerifyDecision;
  /** Stage-1 plausibility (P(true)); undefined on abstain. */
  p: number | undefined;
  /** Stage-2 verification proposition — present only when the router escalated. */
  verification?: JudgmentProposition;
}

/** Stage-2 query space derived from stage-1 uncertainty: evidential support, not plausibility. */
const verifyQuery = (statement: string, p: number): EvaluateQuery => ({
  kind: 'evaluate',
  rubric: 'plausibility',
  axis: 'epistemic',
  levels: ['unsupported', 'supported'],
  instruction: `Independent verification (stage-1 p=${p.toFixed(2)}): assess evidential support for: ${statement}`,
});

/**
 * SDE-style verify cascade: cheap stage-1 self-eval routes through the
 * confidence bands; the expensive stage-2 verification fires only on
 * `review`/`block` — never re-verifying an `act`.
 */
export async function verifyCascade(
  judge: CascadeJudge,
  sharedContext: EmbeddingPointer,
  statement: string,
  bands: ConfidenceBands,
  budget: ReasoningBudget
): Promise<VerifyResult> {
  const stage1 = truthProbability(statement);
  const result = await judgeCascade(
    judge,
    sharedContext,
    stage1,
    (first) => {
      if (first.kind !== 'evaluate' || first.abstained) return undefined;
      const p = (first as EvaluateProposition).score;
      const decision = routeConfidence(p, bands);
      return decision === 'act' ? undefined : verifyQuery(statement, p);
    },
    budget
  );
  const prop = result.stage1 as EvaluateProposition;
  const decision: VerifyDecision = prop.abstained ? 'abstain' : routeConfidence(prop.score, bands);
  return { decision, p: prop.abstained ? undefined : prop.score, verification: result.stage2 };
}

export interface ConsensusJudge {
  consensus(
    sharedContext: EmbeddingPointer,
    query: JudgmentQuery,
    k: number,
    budget: ReasoningBudget
  ): Promise<{ proposition: JudgmentProposition; agreement: number; independent: boolean }>;
}

/** Fan-out never exceeds the LM-call budget remaining; k≥1 always degrades to a single judgment. */
export const fanoutWithinBudget = (k: number, budget: ReasoningBudget, charged = 0): number =>
  Math.max(1, Math.min(k, budget.maxLMCalls - (budget.consumed?.llmCalls ?? 0) - charged));

/** Consensus fan-out as a budget knob: the requested k is clamped to remaining budget. */
export async function consensusFanout(
  judge: ConsensusJudge,
  sharedContext: EmbeddingPointer,
  query: JudgmentQuery,
  k: number,
  budget: ReasoningBudget,
  charged = 0
) {
  return judge.consensus(sharedContext, query, fanoutWithinBudget(k, budget, charged), budget);
}
