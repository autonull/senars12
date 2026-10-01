/**
 * The `decision:manifest` rule (TODO29.a §5.11, A11).
 *
 * A11's acceptance is "mostly *declarations*" — §12 says so — and an ungated
 * declaration is a comment. So the rules are about the declaration rather than
 * about the wiring, and the wiring's *behaviour* is asserted in
 * `tests/nar/todo29a-a11.test.ts`.
 *
 * Four rules:
 *
 *  1. **Every call site is declared.** A caller the manifest does not name is a
 *     capability reachable from somewhere nobody audited — the exact spread §12
 *     warns about.
 *  2. **No `SynthesisQuery` at `position: 'cycle'`.** §2's "`P` at a boundary" is
 *     in `CycleDecisionRequest`'s type; this is the data-side counterpart, so a
 *     manifest row cannot state the combination the type forbids.
 *  3. **`J` names a Belief or a Goal.** §1.2 clause 2 and §2.6 make the axis a
 *     safety property, and `synthesize` declares neither because it produces
 *     candidates rather than admissions.
 *  4. **Every declared site names a budget scope that exists** — an id no
 *     `BUDGET_SCOPES` row has is an unbounded call wearing a scope.
 */

import { DECISION_AXES, DECISION_CALL_SITES, DECISION_POSITIONS, DECISION_QUERIES } from '../../nar/src/decision/call-sites.js';
import { BUDGET_SCOPE_IDS } from '../../nar/src/kernel/budget-scopes.js';

export interface ManifestViolation {
  readonly id: string;
  readonly rule: string;
  readonly detail: string;
}

export const manifestViolations = (
  sites: readonly (typeof DECISION_CALL_SITES)[number][] = DECISION_CALL_SITES
): ManifestViolation[] => {
  const violations: ManifestViolation[] = [];
  const seen = new Set<string>();

  for (const site of sites) {
    const fail = (rule: string, detail: string): void => {
      violations.push({ id: site.id, rule, detail });
    };

    if (seen.has(site.id)) fail('unique-id', `${site.id} is declared twice`);
    seen.add(site.id);

    if (!(DECISION_QUERIES as readonly string[]).includes(site.query))
      fail('vocabulary', `query ${site.query} is not one of ${DECISION_QUERIES.join(', ')}`);
    if (!(DECISION_AXES as readonly string[]).includes(site.axis))
      fail('vocabulary', `axis ${site.axis} is not one of ${DECISION_AXES.join(', ')}`);
    if (!(DECISION_POSITIONS as readonly string[]).includes(site.position))
      fail('vocabulary', `position ${site.position} is not one of ${DECISION_POSITIONS.join(', ')}`);

    // 2 — `P` at a boundary, in data as well as in the type.
    if (site.query === 'synthesize' && site.position === 'cycle')
      fail('synthesis-at-boundary', 'a synthesize query declares position: cycle');
    if (site.query === 'synthesize' && site.axis !== 'none')
      fail('synthesis-axis', 'a synthesize query produces candidates, so it names no axis');
    if (site.query !== 'synthesize' && site.axis === 'none')
      fail('judgment-axis', 'a judgment query must declare whether it is about a Belief or a Goal');

    // 4 — a scope that exists.
    if (!(BUDGET_SCOPE_IDS as readonly string[]).includes(site.budget))
      fail('budget-scope', `${site.budget} is not a declared budget scope`);

    if (!site.at.trim()) fail('declared', 'no address: a declaration with no site drifts');
    if (!site.rationale.trim()) fail('declared', 'no rationale for why this site earns a call');
  }

  return violations;
};
