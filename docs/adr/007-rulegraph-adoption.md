# ADR-007: RuleGraph Adopt-or-Retire

## Status

Accepted — **adopted, opt-in** (`strategies.lmRule.type = 'lm-graph'`)

## Date

2026-09-26

## Context

TODO5 shipped `RuleGraph` (`nar/src/strategies/lm-graph/RuleGraph.ts`) and claimed it was
"registered in `CognitiveRegistry`" and "consumes RLFPLearner performance rewards". The
REFACTOR.todo6 audit (§3b) found both claims false:

- `registerRuleGraph()` had zero callers — `'lm-graph'` was never instantiated, so the class
  was dead code behind a registered name.
- `recordPerformance`, `learnFromDerivation`, and `tick()` had zero callers — the
  RLFP-reward loop did not exist.
- `extractFocusTerm` ignored its `LMRuleSelectionContext` and returned
  `{kind:'atom', symbol: rules[0].name}`. Every co-activation edge was therefore a
  self-referential rule-name pair; the graph keyed on *rule names*, not concepts.
- `fallbackSelect` filtered on a `priority` field that `LMRule` does not carry, so it could
  return an **empty** array — a silent, fail-open shutdown of all LM rules (C17 violation).

The decision was adopt-or-retire, with retirement allowed if the wiring showed no benefit.

## Evidence (C1–C5, `tests/nar/rulegraph-wiring.test.ts`)

| Claim | Falsifier | Result |
|-------|-----------|--------|
| Real focus terms reach the selector | `focusTerm` present in context; co-activations keyed on real terms (not rule names) | PASS |
| Selector is fail-closed | `lm-graph` selection is never empty | PASS |
| Rewards change behavior | `recordPerformance` shifts the selection distribution | PASS |
| Selector registered and reachable | `lm-graph` selectable from `CognitiveRegistry` | PASS |
| Premise-side dual role | `graph` source returns memory-backed concepts; `edgeWeight` scorer reads graph weights | PASS |
| No default-path regression | non-`lm-graph` cycle byte-identical (C11) | PASS |
| Graph decays | `tick()` shrinks edge weights | PASS |

Wiring landed in `nar/src/cognitive/controller.ts`: `registerRuleGraph` at controller
assembly (opt-in), `recordPerformance` from the LM rule execution log on each `adapt()`,
`tick()` per adaptation step, and `learnFromDerivation(focus.term, derived.term)` from the
derivation chain. The shared `ConceptGraph` (`getSharedConceptGraph`) is the single
co-activation signal consumed by the selector, the `graph` premise source, and the
`edgeWeight` scorer.

## Decision

**Adopt as an opt-in LM-rule selector; keep `'priority'` as the default.**

1. `strategies.lmRule.type` stays `'priority'` — the graph path is a *strategy*, not the
   baseline, so C11 parity is preserved by construction.
2. `fallbackSelect` returns the top-N rules by registration order (never empty, never
   filtered on a nonexistent field). Fail-closed is now a property of the code, not a claim.
3. `focusTerm?: Term` on `LMRuleSelectionContext` is additive and optional; selectors that
   ignore it are unaffected.

## Consequences

- Easier: co-activation is now a *learned* signal — RLFP rule outcomes re-weight rule
  selection, and derivation paths add graph edges. The three consumer roles (selector,
  premise source, premise scorer) share one graph, so improving derivation quality improves
  premise selection.
- Harder: `lm-graph` owns more state than `priority` (per-rule performance map + graph), and
  its selection depends on graph warmup. First cycles fall back until edges exist.
- Explicitly given up: the fallback path cannot rank by quality — it is registration order.
  Any future `LMRule` priority field must be added at `LMRule`, not assumed here.

### Known limitation (accepted, follow-up recorded)

The graph is keyed on **real terms for the focus side** but still on **rule-name atoms for
the rule side** (`select()` activates `{kind:'atom', symbol: rule.name}` and
`ruleMatchesEdge` compares `rule.name` to `edge.targetTerm.symbol`). Edges learned from
`learnFromDerivation(focusTerm, derivedTerm)` therefore do not match rules by their derived
term. Closing this requires `LMRule` to expose a condition term — a separate change with
its own parity risk, deliberately out of scope here.

## References

- `nar/src/strategies/lm-graph/RuleGraph.ts`
- `nar/src/cognitive/controller.ts` (`#wireRuleGraphCallbacks`)
- `nar/src/strategies/types.ts` (`LMRuleSelectionContext.focusTerm`)
- `nar/src/strategies/premise/primitives.ts` (`PREMISE_SOURCES.graph`, `PREMISE_SCORERS_CURRIED.edgeWeight`)
- `tests/nar/rulegraph-wiring.test.ts`
