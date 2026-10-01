# Q3 — The falsifiable hypothesis, written before the run

**Status: pre-registered 2026-10-01, before the first `lm`/`manifold` arcade run under A1's closed
cycle.** This document is what makes `TODO29.a.md` §12's "the thesis is negative" risk falsifiable
rather than rhetorical. It is written *before* the measurement on purpose: after the run, any
document agreeing with the result is a rationalisation, and §11.1 asks for the alternative.

## The claim, in one sentence

**A decision layer (`J`) added to the symbolic cycle (`S`) improves decision calibration on games
where the state is enumerable, and the improvement survives when the added layer is asked to
*explain* rather than merely to *rank* (`P`).**

Concretely, with the arcade's existing controlled comparison — same games, same seeds, same
`EpsilonGreedyReflex` actuator (`numArms: 10, epsilon: 0.1`) behind every arm, per-tick Brier
scored against realized outcome:

| arm | what it is |
|---|---|
| `nal` | symbolic cycle + kernel gates over a plain epsilon-greedy reflex. **The control.** After A1 it has no provider registered, so no inducer exists in it at all — the vestigial-inducer objection in §11.1 no longer applies |
| `manifold` | `J` only: local, calibrated, open-technique heads, no provider |
| `lm` | `P` reaches a real offline model under a GBNF action grammar, judged by `J` (tier 1) so candidates are calibrated-ranked rather than first-token-ranked |

```text
pnpm arcade -- --games snake,bandit,tictactoe --arms nal,manifold,lm --episodes 3 --seed 7
```

The aggregate is `BrierHarness.aggregate()`'s **macro Brier** — the mean over games of each game's
Brier — because `microBrier` weights every tick equally and lets a long game outvote a short one.
Both are printed; **a difference that survives only one of them is a difference about tick counts,
not about decisions.** That is a falsification of the *measurement*, and it is cheap to check.

## What would count as the model not earning its place

Stated before the run, in the negative direction, because the positive direction is what a plan
hoping to justify itself will produce:

1. **`lm`'s macro Brier is not below `nal`'s.** The primary claim. Lower is better. Not
   "improves calibration on *some* game" — the pre-registered aggregate, on the game set, at the
   seed count the run uses.
2. **`manifold` is not below `nal`.** If the calibrated-but-local layer cannot beat a plain
   epsilon-greedy reflex through the same gates, then the capability is not reaching the decision,
   whatever its internal scores look like. This is the arm that isolates `J` from `P`.
3. **The gap does not survive seeds.** Run each seed independently and read the spread. A
   difference smaller than the seed-to-seed spread is noise wearing a number.
4. **`lm` loses to `manifold` while both beat `nal`.** This does *not* falsify the thesis; it
   falsifies the *open-technique* claim, and it would say the routing should go through `J` alone
   (§2's "`P` at a boundary"). Recorded separately for that reason.

## What this experiment cannot show

Stated up front so a later reader does not read more into it than it earned:

- **It is not about reasoning depth.** The games are small and enumerable; the arms differ in
  *calibration*, not in what they can represent. Nothing here shows the symbolic side is better.
- **It does not measure the symbolic cycle at all.** `GameFocus` in cognitive mode runs
  `nalDerivations` and reports the count; the harness scores *decisions*, not derivations. The
  arms share the reflex; the cycle is the environment, not the subject.
- **The `lm` arm is skipped without `LM_LLAMACPP_MODEL`** — fail-closed, with a note. A run missing
  the `lm` row is a one-arm result and must not be reported as a three-arm one.
- **`nal` is a control for `J`/`P`, not for `S` alone in general.** It is the strongest control the
  harness has: same gates, same actuator, no provider. It is still epsilon-greedy behind a cycle,
  not a bare random arm.

## The clean-control condition, and why it now holds

§11.1 recorded the objection that until A1 landed, the `nal` arm "ran a constructed, fully registered
layer with execution gated" — **a falsification experiment whose control arm has a vestigial
inducer cannot falsify anything.** Two items closed it:

- **A1** (2026-09-30) — the cycle no longer awaits a model; `enableLMRules` and the register-but-
  never-execute path are gone. `nal` runs with **no provider registered**, so there is no inducer
  to be vestigial.
- **A10** (2026-10-01) — the rule set is a loaded artifact rather than an import side effect, so
  `nal`'s 55 rules come from the artifact and the arm is the same system the plan claims is closed.

The condition is therefore satisfied. **If a future item reintroduces a constructed-but-unused layer
in the control arm, this document's runs stop being evidence**, and the reintroduction is visible as
a `core:no-lm` / `induction:inventory` failure rather than as a quiet improvement in the numbers.

## Recording the outcome

The run writes `.reports/arcade.{json,md}`, including the `aggregate` block. A finished Q3 appends
the numbers, the seed count, and the date **below this line**, unmodified above it — the split is
the point.

---

## Outcome

_(not yet run — see `TODO29.a.md` §11.1)_
