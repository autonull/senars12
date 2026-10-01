/**
 * The decision port (TODO29.a §5.11, A11).
 *
 * **What this connects is something that already works.** The decision layer is
 * exercised today through `ManifoldReflex` on the agent/game side; the finding
 * §5.11 records is that it is wired to the wrong side of the system. A rich,
 * calibrated, open-technique capability is reachable from the RL side and not
 * from the reasoning cycle — so this is a **routing change, not a capability
 * invention**, which is also why the plan's kill criteria do not apply to it.
 *
 * **The types are the committed ones, not a paraphrase.** `JudgmentQuery`,
 * `SynthesisQuery` and their propositions live in `nar/src/decision/` — a leaf
 * that depends on `@senars/core` and the term layer and on nothing under `lm/`.
 * A port typed in the layer's *own* vocabulary is only possible if the vocabulary
 * is nameable from the cycle path, which is what A2's gate would otherwise
 * forbid; see `nar/src/decision/types.ts`.
 *
 * **Three properties, and each is unrepresentable-away rather than documented.**
 *
 *  1. **Optional per call site.** `null` is a normal answer, not an error: a
 *     stage with no port bound takes its own declared path. The four-configuration
 *     matrix in miniature, per stage.
 *  2. **A decision, never an effect.** The return type is a proposition, and a
 *     proposition cannot write. A port reachable from every stage that can also
 *     write, returning something with a side effect, is the shape of the bug this
 *     whole plan is about.
 *  3. **`SynthesisQuery` cannot declare `position: 'cycle'`.** §2's "`P` at a
 *     boundary" is in the type, so a caller has to delete the type to violate it
 *     rather than merely to get it wrong.
 */

import { boundedSignal, raceDeadline } from '@senars/util';
import type {
  JudgmentProposition,
  JudgmentQuery,
  SynthesisProposition,
  SynthesisQuery,
} from '../decision/types.js';
import type { BudgetScopeId } from '../kernel/budget-scopes.js';

/** Either profile of the one model-reasoning capability. `J` and `P`, not two capabilities. */
export type DecisionRequest = JudgmentQuery | SynthesisQuery;

/** What comes back. A proposition, which is data — never a write, never a verdict. */
export type DecisionResult = JudgmentProposition | SynthesisProposition;

/**
 * Where in the cycle a call site sits. `J` is bounded and inline; `P` is open
 * generation and belongs at a boundary. The two are **not** in a gate
 * relationship (§2.1) — this names where a call is allowed, not what it may veto.
 */
export type DecisionPosition = 'cycle' | 'boundary';

/** What a decision is about. `CognitiveAxis`'s two values mean exactly this. */
export type DecisionAxis = 'epistemic' | 'teleological';

/**
 * A cycle-scoped request. The budget is a *declared scope* (A7), not a number, so
 * a decision cannot quietly spend the symbolic derivation budget — and the two
 * being separate scopes is what makes that structural rather than a convention.
 */
export type CycleDecisionRequest =
  | (JudgmentQuery & {
      readonly budget: BudgetScopeId;
      readonly position: 'cycle';
      readonly axis: DecisionAxis;
    })
  | (SynthesisQuery & {
      readonly budget: BudgetScopeId;
      readonly position: 'boundary';
    });

/**
 * The port. One method, because one capability.
 *
 * `null` is returned for absence *and* for a refusal, and those are the same
 * thing to a caller: the bound port's own failure modes are already distinguished
 * in-band by `PropositionBase.abstained` / `abstainReason`, so a caller that
 * needs the reason reads the proposition and a caller that does not gets `null`.
 */
export interface DecisionPort {
  ask(request: CycleDecisionRequest): Promise<DecisionResult | null>;
}

/** The absence. A value, so a bound port and an unbound one are the same question. */
export const NO_DECISION_PORT: DecisionPort = { ask: async () => null };

/**
 * The bound on one decision ask.
 *
 * **A deadline is not optional here, and the test that proved it is the reason.**
 * A1 gave every provider await on the cycle path a bound; the decision port is a
 * new one, and a bound that only catches *faults* leaves the cycle waiting on a
 * port that never answers — which §5.11's acceptance forbids in as many words
 * ("absence, refusal, timeout, breaker-open and out-of-domain cannot prevent
 * completion"). A test that builds a never-settling port and asserts `null` is
 * what turned that from an intention into a line of code.
 *
 * Declared here rather than configured, because a *budget* for how many decisions
 * a cycle may take already exists (A7's `decision-derivations`); what was missing
 * was the bound on one call, and a second knob for it would be a second place to
 * set a number nobody sets.
 */
export const DECISION_ASK_TIMEOUT_MS = 500;

/**
 * Ask, and never hang and never throw. A decision layer that faults — or that
 * never answers — is a decision layer that did not decide, and §7 invariant 14's
 * fail-closed rule says what happens next: the caller takes its own path.
 *
 * The two failure shapes need different words because they are different
 * conditions: a fault is caught, a hang is outranked. Both are `null` to a caller,
 * and a caller that needs to tell them apart reads the proposition's
 * `abstainReason` — which is why a *refusal* is not `null` and an *error* is.
 */
export const askSafely = async (
  port: DecisionPort | undefined,
  request: CycleDecisionRequest,
  timeoutMs: number = DECISION_ASK_TIMEOUT_MS
): Promise<DecisionResult | null> => {
  if (!port) return null;
  const signal = boundedSignal(timeoutMs);
  try {
    const outcome = await raceDeadline(port.ask(request), timeoutMs);
    return outcome.timedOut ? null : outcome.value;
  } catch {
    return null;
  } finally {
    signal.done();
  }
};
