# ADR-010: Premise Primitives Taxonomy

## Status

Accepted

## Date

2026-09-26

## Context

REFACTOR.todo6 §1 audited the premise layer and found three distinct defects:

1. **Wrapper/shadow collisions.** The registered `term-link` was a sampling wrapper that
   never touched `LinkManager`; the genuine `TermLinkStrategy` was shadowed by a same-named
   wrapper. `prolog` was registered as a sampling wrapper with zero Prolog logic.
2. **Nine strategies, one shape.** `bag`, `default-formation`, `prolog`, `resolution`,
   `term-link`, `task-match`, `exhaustive`, `goal-driven`, `analogical` all reduced to
   `samplePremises(memory, task, {sampleSize, limit, filter, truthFilter})`. New capability
   (graph sources, embedding scorers, windowed sampling) would have arrived as a tenth
   hand-rolled class.
3. **A silent-degradation regression (found during close-out).** When the canonical
   `samplePremises` was rebuilt on the primitives pipeline, it forwarded only
   `source`/`scorer`/`filters`/`minScore` and **dropped `filter` and `truthFilter` entirely**.
   Every predicate-carrying strategy silently degraded:
   `resolution` → behaved like `default-formation` (no `inheritanceOnly`),
   `goal-driven` → no confidence threshold, `bag` → its no-stamp-overlap guard was a stub
   (`return true`) that nobody noticed because nothing asserted it. Honest names, wrong
   behavior — the exact C17 failure the sprint set out to eliminate.

A dead pre-refactor copy of `samplePremises` survived at `nar/src/reason/premise/sample.ts`
(correct, zero importers), which is how the regression hid.

## Decision

**Premise strategies are compositions of four primitive maps, declared in one module.**

`nar/src/strategies/premise/primitives.ts` owns:

| Map | Entries |
|-----|---------|
| `PREMISE_SOURCES` | `bag`, `links`, `taskArgs`, `graph` |
| `PREMISE_SCORERS` (+`_CURRIED`) | `priority`; `linkWeight`, `edgeWeight` |
| `PREMISE_SCORERS_EXTENDED` | `linear{link, embed, pri}` |
| `PREMISE_FILTERS` (+`_CURRIED`) | `sharedAtoms`, `noStampOverlap`, `inheritanceOnly`, `inheritanceOverlap`; `highConfidence(thr)` |

A named strategy is data, not a class. Filters accept parameters
(`FilterSpec = FilterName | { highConfidence: number }`), and one-off predicates survive as
`where` / `whereTruth` escape hatches that are *composed with* the declared filters — never
silently dropped.

Registered compositions (plan §1.3):

| Name | Composition | Budget |
|------|-------------|--------|
| `default-formation` | bag + priority + [sharedAtoms] | 10/5 |
| `bag` | bag + priority + [sharedAtoms, noStampOverlap] | 10/10 |
| `resolution` | bag + priority + [inheritanceOnly] | 15/5 |
| `goal-driven` | bag + priority + [highConfidence 0.7] | 20/5 |
| `exhaustive` | bag + priority + [sharedAtoms] | 100/100 |
| `analogical` | bag + priority + [inheritanceOnly, inheritanceOverlap] | 15/3 |
| `sampled` | bag + priority + [sharedAtoms] | 20/5 |
| `term-link` | links + `linkWeight`, `minScore 0.3` | limit 20 |
| `decomposition` | bespoke (task-args walk) | — |
| `prolog-resolution` | bespoke (SLD search) | — |
| `semantic` | bespoke class — `listConcepts()` + weighted linear score | limit 10 |

### Wrapper retirement

- `prolog` — **removed**. No Prolog logic existed under that name; configs now error and must
  migrate to `prolog-resolution` (the genuine SLD implementation) or a sampled composition.
- `task-match` — **renamed** `sampled`; the old name is an error, which is the migration signal.
- `term-link` — same-name swap to the genuine link-manager implementation. Behavior changes
  from sampling to link-walk; that change is the point of the fix.
- `semantic` — registered (was an orphaned class, imported but never called). It stays a
  class for now: it enumerates *all* concepts (`memory.listConcepts()`), which no registered
  source expresses, and it reads embedding similarity from the memory's embedding index. The
  `linear` scorer exists and is tested, but has no registered consumer — see Consequences.

### Single home (C13/C20)

`nar/src/reason/strategies/{index,semantic,term-link}.ts` and `nar/src/reason/premise/` were
byte-level duplicates of `nar/src/strategies/premise/*` with zero importers. Deleted. One
definition per concept, one home per strategy type.

## Consequences

- Easier: adding a premise capability (a new source, scorer, or filter) is one map entry and
  one line in a named strategy. `graph`/`edgeWeight` (C4) and the retired wrappers prove it.
- Easier to falsify: `tests/nar/premise-primitives.test.ts` asserts each composition's filters
  *actually apply*, which is the test whose absence let the drop-through regression ship.
- Harder: the primitive pipeline is the only place premise filtering happens. A new escape
  hatch is a deliberate decision, not an accident.
- Intended behavior changes (all outside the default `default-formation` path, so C11 parity
  is preserved by construction): `resolution` and `goal-driven` regain their filters, `bag`
  gains a *real* no-stamp-overlap guard (its `truthFilter` was previously a no-op stub), and
  `analogical` moves from bespoke code to a composition with identical semantics.
- `PREMISE_SCORERS_EXTENDED.linear` has **no registered consumer**. Plan §1.3 specified
  `semantic` as a composition over a `concepts` source; no such source was added, so
  `semantic` remains a bespoke class and `linear` is dead-but-tested capability. Closing this
  needs a `concepts` source in `PREMISE_SOURCES` (enumerate-all, not a sample), which is a
  behavior-preserving refactor of `SemanticStrategy` — not done here rather than done
  half-way.
- `PREMISE_SCORERS_EXTENDED.linear` also has no embedding term yet (`embeddingSim` is `0`),
  so its `embed` weight is reserved rather than silently dropped. Recorded, not hidden.

## References

- `nar/src/strategies/premise/primitives.ts`
- `nar/src/strategies/premise/selection-strategies.ts`
- `nar/src/reason/strategies/base.ts` (`createStrategy`)
- `nar/src/cognitive/registry.ts` (registration list)
- `tests/nar/premise-primitives.test.ts`
- `docs/adr/007-rulegraph-adoption.md` (the `graph` source / `edgeWeight` scorer)
