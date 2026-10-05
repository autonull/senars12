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

---

## Result 2026-10-02 — macro-falsified, micro-disagrees (5 seeds, appended without touching the above)

Command (nothing above this line was edited to favour it):

```text
LM_PROVIDER=llamacpp-embedded LM_LLAMACPP_MODEL=.models/Qwen3.5-0.8B-Q4_0.gguf \
pnpm exec tsx scripts/arcade.ts -- --games snake,bandit,tictactoe \
  --arms nal,manifold,lm --episodes 3 --seed 7 --seeds 5
```

Per-seed macroBrier (`[seed N] lm manifold nal` as printed):

| seed | lm | manifold | nal |
|---|---|---|---|
| 7 | 0.3742 | 0.2447 | 0.2013 |
| 8 | 0.3338 | 0.2498 | 0.2183 |
| 9 | 0.3324 | 0.2635 | 0.2505 |
| 10 | 0.3386 | 0.2633 | 0.2384 |
| 11 | 0.3473 | 0.2611 | 0.2375 |

Aggregate (mean ± sd over seeds):

| arm | macroBrier | microBrier |
|---|---|---|
| lm | 0.3452±0.0154 | 0.2692±0.0013 |
| manifold | 0.2565±0.0078 | 0.1132±0.0050 |
| nal | 0.2292±0.0173 | 0.2745±0.0158 |

Against the four pre-registered conditions:

1. **`lm` below `nal`: NO — falsified.** 0.345 vs 0.229, same ordering on all 5 seeds.
2. **`manifold` below `nal`: NO — falsified.** 0.257 vs 0.229, same ordering on all 5 seeds.
3. **Survives seeds: yes, in the wrong direction.** The ordering `nal < manifold < lm` holds on
   every seed; the gap is real and it is not the thesis's.
4. **Moot** — neither beats `nal`.

The doc's own measurement rule fires as well: microBrier says `manifold` (0.113) beats both,
macro says `nal`. A difference surviving only one of the two is a difference about tick counts,
not decisions — so the honest reading is macro-falsified *and* measurement-disagreeing.

Confounds, recorded so the next run knows what it must remove rather than what it must find:

- **J was never fitted.** The manifold arm ran on untrained stub heads (TODO30 §4.3 open) —
  `manifold` here is hash scores plus an abstain threshold, not a calibrated layer.
- **Arm asymmetry.** `nal` forces cognitive mode (seeded rules + NAL veto shaping play);
  `lm`/`manifold` run without it. The control gets symbolic help the challengers don't.
- **Small model, small games.** Qwen3.5-0.8B; snake/bandit/tictactoe. Nothing here generalises
  beyond this harness.
- **The first attempt at this run was void** and is not evidence: the arcade wrapped reflexes
  in adapters that (a) dropped `prefetch` so `lm`/`manifold` never consulted anything but the
  epsilon-greedy fallback, and (b) hid proposals from the recorder so `predicted ≡ 0.5` and every
  Brier was exactly 0.25. Fixed in the `fix(arcade)` commit (adapters forward `prefetch`
  awaitably; recording sits outermost); the void numbers were never written here.

## Reframe 2026-10-02 — coverage, not thesis (appended without touching the above)

The falsification framing is retired. Every arm must work — NAL, manifold, LM,
and the RL baselines (`qlearning`, `policygradient`, added to the arcade matrix
2026-10-02 in `scripts/lib/rl-arms.ts`: tabular Q-learning and REINFORCE over
state keys, honest predicted probabilities, no kernel gates since they are
baseline controls). The matrix compares approaches to find what each is good
for; a "falsified" row is a repair ticket, not a verdict. Smoke 2026-10-02
(bandit, 2 episodes, seed 7): qlearning 0.1899 / policygradient 0.2630 /
random 0.2811 macroBrier — the learners learn, and the comparison is against
real baselines now.
