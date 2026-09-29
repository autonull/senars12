/**
 * The shared MeTTa-agreement vote — the one place a reflex proposal is checked
 * against the exact algebra and re-proposed.
 *
 * It lives apart from both proposers (`reflex/MettaProposer` and
 * `meta/ProofMettaProposer`) because it is the part they share: same engine
 * check, same amplification rule, same cap. A helper named after one of its two
 * callers is a file whose ownership reads wrong.
 */
import type { NegotiationInput, ProposerContribution } from './Negotiator.js';
import type { ActionProposal } from './Reflex.js';

/** `(expr) => boolean | null` — null when the engine is absent or faulted. */
export type MettaEvaluator = (expression: string) => boolean | null;

/** Maps an action id to the MeTTa expression asserting it, or undefined to skip. */
export type MettaFactSource = (action: string) => string | undefined;

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

