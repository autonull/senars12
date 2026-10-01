# The in-cycle induction inventory

**Dated:** 2026-09-30 · **Plan:** `TODO29.a.md` §11.1 (Q1′) · **Gate:** `pnpm induction:inventory` ·
**Data:** [`nar/src/lm/in-cycle-inventory.ts`](../nar/src/lm/in-cycle-inventory.ts)

The live cycle path (`NARExecution.run`) has **no tick stages**. `nar/src/tick/` declares the canonical
stage vocabulary — `perceive, recall, attend, reason, propose, negotiate, authorize, act, validate,
learn, consolidate` — and nothing in production calls it: the only callers are four test files. So a
plan whose acceptance criteria speak of "no `propose`-stage work inside a `reason` stage" is asserting
about a pipeline this tree does not run. `PhaseTimer` records free-form categories (`cycle`,
`reasoner`, `drives`, …) and is the only cycle-wide attribution that exists. **A1's trace assertion
needs a stage vocabulary on the live cycle first, and that is A0 work this inventory does not do.**

## What the cycle path actually reaches

Of the layer's imports from outside `nar/src/lm/`:

| | edges | value imports | type imports |
|---|---|---|---|
| cycle path (12 files) | 14 | **3** | 11 |
| everything else (17 files) | 82 | 47 | 35 |
| total | 96 | 50 | 46 |

The cycle path already holds the layer as *data* almost everywhere. `RuleProcessor` — the one place
the cycle applies a model rule — imports `LMRule` as a **type only** and receives instances through
`registerLMRule`; `strategies/types.ts` and the five `LMRuleSelector`s do the same. That is why A1 is
a wiring change and not a rewrite (§4 row 9).

The three value imports are the whole of what the census found:

- `memory/embedding.ts:2` — `getLMSettings`, `detectDevice`. Configuration, no await.
- `learning/schema-induction.ts:13` — `parseJsonObject`, a JSON parser. The *induction* is a method
  call on a component the NAR owns, not an import.
- `cognitive/impls/analyzers/corrections.ts:4` — `loadGrammar`, with an `await lm.tryGenerateText`
  beside it. Dead: `attemptLMCorrection` has no callers.

The other 47 value imports are `facade/`, `nar.ts`, `system-one-wiring.ts`, `nar-lm.ts`, `agent/`,
`dialogue/`, `nl/`, `focus/`, `eval/` and the package barrel — assembly and agent-side. **That is A2's
subject**, and this gate deliberately does not fail on them: a second opinion about the dependency
direction, disagreeing with `deps:direction`, is worse than none.

## The dispositions

| behaviour | disposition | who would notice its absence |
|---|---|---|
| `lm-rule-derivation` | `synchronous` → target `boundary` | any derivation a model rule produced; measured at 33 inducer invocations per cycle |
| `ingress-judgment` | `synchronous`, by design | the injection veto above 0.1 at `KernelPerceptionGate.admitViaJudge` |
| `schema-induction-admission` | `synchronous` | the AIKR bag's pressure — `.schemas-induce` has nothing to work on |
| `embedding-config-read` | `synchronous` | recall under a mock or CPU-only provider |
| `stream-reasoner-flush` | `boundary` | nothing — its only caller in the repository is a test (§4 row 9) |
| `episode-consolidation` | `boundary` | the lifecycle command, its only production caller |
| `narsese-correction` | `dropped` | nobody — no callers, so the behaviour cannot be lost |

**`ingress-judgment` stays synchronous by design.** Judging a precondition of admission is *gating*,
not learning, and the plan does not ask for it to move. It is the one row where "close the cycle"
would break an epistemic control if it were treated as a cycle-path dependence to remove.

## What the gate checks, and what it deliberately does not

It checks that every cycle-path value import is a declared behaviour; that every attribution names a
declared behaviour and a file that still imports the layer; and that every `file:line` in
`PROVIDER_SEAMS` still holds the await it claims. It prints the census either way, because the census
is the finding and the gate is only the thing that keeps it from decaying.

It does **not** check that the dispositions are right. They are decisions, and a gate that enforced a
decision would only make it harder to revisit one.
