/**
 * Phase E (REFACTOR.todo2 §3 tail): `IProposer` over the MeTTa engine.
 * Votes with confidence 1.0 on exact algebraic facts, abstains otherwise.
 * The engine seam is a synchronous evaluator (`(expr) => boolean | null`) —
 * `nar` has no `@senars/metta` dependency, so integrators inject one (the
 * agent's `mettaExecutor` + `Effect.runSync` is the canonical wiring); a null
 * return (engine absent/faulted) means abstain, never a veto.
 */
import type { IProposer, NegotiationInput, ProposerContribution } from './Negotiator.js';
import type { ActionProposal, LearningEvent } from './Reflex.js';

export type MettaEvaluator = (expression: string) => boolean | null;

const defaultToExpression = (action: string): string => `(= (eval ${action}) True)`;

export interface MettaProposerOptions {
  /**
   * Given an action id, return a MeTTa expression asserting the action is
   * sound (e.g. `(= (eval <action>) True)`), or undefined to skip the vote.
   */
  toExpression?: (action: string) => string | undefined;
  /** Confidence for MeTTa-backed contributions (default 1.0 — exact algebra). */
  confidence?: number;
  /** Cap on contributions per resolve (AIKR bound). */
  maxProposals?: number;
}

export class MettaProposer implements IProposer {
  readonly #evaluate: MettaEvaluator;
  readonly #toExpression: (action: string) => string | undefined;
  readonly #confidence: number;
  readonly #maxProposals: number;

  constructor(evaluate: MettaEvaluator, options: MettaProposerOptions = {}) {
    this.#evaluate = evaluate;
    this.#toExpression = options.toExpression ?? defaultToExpression;
    this.#confidence = options.confidence ?? 1.0;
    this.#maxProposals = options.maxProposals ?? 4;
  }

  /**
   * Consulted on exact algebra only: each reflex proposal is checked against
   * the MeTTa engine; agreeing actions are re-proposed at confidence 1.0
   * (dominating in the merge), disagreeing/abstaining ones are left untouched.
   * Never emits a veto — MeTTa agreement amplifies, silence abstains.
   */
  propose(input: NegotiationInput): ProposerContribution {
    if (input.reflexProposals.length === 0) return {};
    const reflex: ActionProposal[] = [];
    for (const p of input.reflexProposals) {
      if (reflex.length >= this.#maxProposals) break;
      const expr = this.#toExpression(p.action);
      if (expr === undefined) continue;
      const verdict = this.#evaluate(expr);
      if (verdict === true) {
        reflex.push({ ...p, confidence: this.#confidence, source: 'metta' });
      }
    }
    return reflex.length > 0 ? { reflex } : {};
  }

  /** MeTTa is stateless per tick — learning events are absorbed (no-op). */
  learn(_event: LearningEvent): void {}
}
