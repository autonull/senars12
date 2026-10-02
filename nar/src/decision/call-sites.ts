/**
 * The decision call-site manifest (TODO29.a §5.11, A11).
 *
 * **Why a manifest at all.** §12 calls A11 the item that can spread: "a
 * capability available everywhere is as safe as each call site", so its acceptance
 * is mostly *declarations* — and an ungated declaration is a comment. Every site
 * that can ask a decision names itself here, with the four things an auditor has
 * to check by hand otherwise: which profile, whether it is about a **Belief** or
 * a **Goal**, which budget scope pays, and whether the call sits inline in a
 * cycle or at a boundary.
 *
 * The gate reads this table and fails on a call site that is not in it, on a
 * `synthesize` that declares `position: 'cycle'`, and on a site whose declared
 * axis does not match its query — which is the Belief/Goal split §1.2 clause 2
 * and §2.6 make a safety property, expressed once as data rather than re-read at
 * eight call sites.
 */

import type { DecisionAxis, DecisionPosition } from '../ports/decision.js';
import type { BudgetScopeId } from '../kernel/budget-scopes.js';

export interface DecisionCallSite {
  /** Stable id, and the symbol a caller names in a violation message. */
  readonly id: string;
  /** `file:line` of the call, kept because a declaration with no address drifts. */
  readonly at: string;
  /** The text that must still be on that line (like ProviderSeam.callSites). */
  readonly contains: string;
  /** `classify` or `evaluate` for `J`; `synthesize` for `P`. */
  readonly query: 'classify' | 'evaluate' | 'synthesize';
  /**
   * What the decision is about. `epistemic` reaches `Truth` through
   * `PerceptionGate`; `teleological` is confined to `Desire`. A `synthesize` call
   * declares neither: it produces candidates, not admissions.
   */
  readonly axis: DecisionAxis | 'none';
  readonly position: DecisionPosition;
  readonly budget: BudgetScopeId;
  /** One line on why this site is worth a call — TODO30 §1 measures which pay. */
  readonly rationale: string;
}

/**
 * The sites bound today. **One, on purpose, and the reason is recorded rather
 * than papered over.** §2.5 names eight candidate stages — premise formation, rule
 * selection, contradiction adjudication, goal handling, attention, consolidation,
 * explanation — and §5.11 asks for the port at all of them. Five of those seven
 * **have no decision point in this tree to bind it to**: there is no contradiction
 * adjudication step, attention has one owner and one clock and no rank to ask
 * about (A4), and the explanation surface is a read. Declaring eight wired sites
 * would have been a manifest of intentions.
 *
 * So the manifest is a claim about the tree, and `config:model-matrix` fails on a
 * call site that is not in it — which means adding a second site is now a
 * two-line change a gate will notice. §2.5's ordering and §11.2's "which `J` call
 * sites are worth their budget" stay TODO30 §1's, because that is a measurement
 * and this is a declaration.
 */
export const DECISION_CALL_SITES: readonly DecisionCallSite[] = [
  {
    id: 'authorize.admission-order',
    at: 'nar/src/nar-execution.ts:456',
    contains: 'await askSafely(this.decision,',
    query: 'classify',
    axis: 'epistemic',
    position: 'cycle',
    budget: 'decision-derivations',
    rationale:
      'the only stage through which anything reaches state, and the only truncation that decides what fits — `ranking.maxAdmissions`. A decision reorders the candidates; it never creates an admission',
  },
] as const satisfies readonly DecisionCallSite[];

/** Ids, for a gate's failure message and for a test to assert against. */
export const DECISION_CALL_SITE_IDS = DECISION_CALL_SITES.map((site) => site.id);

/** The declared vocabulary, so a gate reads one table rather than three literals. */
export const DECISION_QUERIES = ['classify', 'evaluate', 'synthesize'] as const;
export const DECISION_AXES = ['epistemic', 'teleological', 'none'] as const;
export const DECISION_POSITIONS = ['cycle', 'boundary'] as const;
