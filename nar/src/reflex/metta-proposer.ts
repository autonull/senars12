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

/**
 * The one MeTTa-agreement vote: re-propose every reflex action the exact engine
 * confirms, at `confidence` and tagged `source`. Never a veto — agreement
 * amplifies, silence abstains. Shared by the live and proof-backed proposers.
 */
export function agreeByExactAlgebra(
  input: NegotiationInput,
  toExpression: MettaFactSource,
  evaluate: MettaEvaluator,
  { source, confidence, maxProposals = Number.POSITIVE_INFINITY }: {
    source: string;
    confidence: number;
    maxProposals?: number;
  }
): ProposerContribution {
  const reflex: ActionProposal[] = [];
  for (const p of input.reflexProposals) {
    if (reflex.length >= maxProposals) break;
    const expr = toExpression(p.action);
    if (expr !== undefined && evaluate(expr) === true) {
      reflex.push({ ...p, confidence, source });
    }
  }
  return reflex.length > 0 ? { reflex } : {};
}

export type MettaFactSource = (action: string) => string | undefined;

export interface MettaProposerOptions {
  /**
   * Required: maps an action id to the MeTTa expression asserting it is sound
   * (e.g. a fact-table lookup returning `(= (sound move-north) True)`), or
   * undefined to skip the vote. There is deliberately no default — the MeTTa
   * stdlib has no `eval` op, so a generic template would abstain forever
   * (audit M1, TODO2 §10a).
   */
  toExpression: MettaFactSource;
  /** Confidence for MeTTa-backed contributions (default 1.0 — exact algebra). */
  confidence?: number;
  /** Cap on contributions per resolve (AIKR bound). */
  maxProposals?: number;
}

export class MettaProposer implements IProposer {
  readonly #evaluate: MettaEvaluator;
  readonly #toExpression: MettaFactSource;
  readonly #confidence: number;
  readonly #maxProposals: number;

  constructor(evaluate: MettaEvaluator, options: MettaProposerOptions) {
    this.#evaluate = evaluate;
    this.#toExpression = options.toExpression;
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
    return agreeByExactAlgebra(input, this.#toExpression, this.#evaluate, {
      source: 'metta',
      confidence: this.#confidence,
      maxProposals: this.#maxProposals,
    });
  }

  /** MeTTa is stateless per tick — learning events are absorbed (no-op). */
  learn(_event: LearningEvent): void {}
}
