# TODO28: Structure — the package graph, the directory shape, and the leftovers

**Version:** 1.2 (2026-09-30) · **Predecessor:** TODO27 (phases A–P; strategy composition, then
the primitives pass), which closed the strategy axis and left this. v1.2 is the same plan after
the third pass: §8.1's last upward edge closed, §8.2/§8.6's barrels landed, and the gate that
found them rewritten, because it could not see either.

**Status: closed except §3.2 and the three recorded debts.** Everything in §1, §2, §3.1,
§3.3–§3.5 and §4 landed, plus §8.1, §8.2 and §8.6 — the third pass closed the last
`ALLOWED_UPWARD` entry, so the ledger is now **empty** rather than short. §3.2 is a plan of its
own; §3.6–§3.8 are recorded and still correctly not scheduled. §6 is what happened, §7 is what is
left, §8 is what the work surfaced. Sections that shipped carry a **landed** marker and a note
saying what the tree actually looked like.

> **A fresh session should read §7 first, and §7.11 is the whole of what is left.** The
> package that should not exist is gone, all nine directories in §2.1 hold their contract at
> the top with implementations under `impls/`, `core` no longer reaches upward, the catalogue
> declares every built-in, every barrel names its exports, and `test:unit` is green under
> full-suite load. There is no longer an inversion to record: `ALLOWED_UPWARD` is empty and
> two gates keep it that way.

---

## 0. What this is

TODO27 was a behavioural line of work — one resolution path, then one primitive per concept.
This is a **structural** one. Nothing here changes what the system does; three items change what
it can *accidentally* do — §1.1, a layering inversion that no gate can currently see; §4.3, a
metric that reports a property it does not measure; and, from the third pass, §8.1, the
direction gate that could not see the inversion it was written to catch.

| # | Item | Kind |
|---|------|------|
| 1 | The `kernel` package exists and should not | **defect** — **landed** |
| 2 | Nine directories mix a contract with its implementations | **manual** — yours, in an IDE · **landed** |
| 3 | The leftovers TODO27 recorded | carry-over, re-verified |
| 4 | What we can get for free while reorganizing | opportunistic — **landed** |
| 5 | Deliberately not doing | — |

**§1, §3 and §4 are agent work**: a package that should not exist, a list, and small gate fixes.
**§2 is not** — it is a bulk file move across nine directories, and it is written here as a shape
to aim at while you have the IDE open, not as work to hand over. §2.4 is the exception: that one
is prose, and an agent should write it.

There are no time estimates in this document, by request. The ordering in §2.1 is a suggested
order for the manual moves, not a schedule.

> **§2 is done, and it was done as an agent anyway.** The rule was written first (§2.4) and
> that is what made the moves mechanical — the whole structural pass was eight commits, one
> directory group each, with a gate run per group. The warning above about a 200-file
> unreviewable diff was right about the *first* directory and wrong about the other eight:
> once `AGENTS.md` said what the target shape was, each move was `git mv` plus a
> relative-path rewrite, and `tsc` said whether it was right. §6 records which directories
> had a real decision in them. The lesson is the one §2.4 already carried — the rule is the
> deliverable, and the moves are the easy part.

---

## 1. The package graph

### 1.1 `kernel/` is a package that should not exist — and there are two of them — **landed**

**Verified.** `kernel/` is a 6-file workspace package. `nar/src/kernel/` is a 15-file, 2 076-line
directory. **Both are called `kernel` and they mean unrelated things.** The package holds
`schemas.ts` (618 lines), `budget.ts` (323), `term-view.ts`, `rule-descriptor.ts`,
`verify-derivation.ts`. The directory holds `KernelPerceptionGate.ts` (358), `replay.ts` (329),
`KernelActionGate.ts` (254), `KernelBudgetGate.ts` (232), and the gate registry, thread scope,
event ring, source reputation.

The package is named as though it were the more fundamental of the two, which is why this is
worth writing down rather than just fixing.

**The dependency is also a lie.** `kernel/package.json` declares `dependencies: { zod }` and
nothing else. Five of its six imports of `@senars/nar` are `import type`, but
`kernel/src/budget.ts:7` is a **value** import:

```ts
import { emitBudgetSliceCreated, emitBudgetSliceConsumed,
         emitBudgetSliceExhausted, emitBudgetSliceMerged } from '@senars/nar/tick';
```

which reaches `nar/src/otel/index.ts:206`. It resolves today only through the root
`node_modules` symlinks: `kernel/node_modules/` contains `zod` alone, and resolution from inside
`kernel/` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. The layering inversion is invisible to
`deps:gate`, which counts chains rather than checking direction — and `kernel/src/` is not even
in `DPDM_TARGETS` (`scripts/lib/dpdm.ts:8`), so the package is outside the graph every
dpdm-based gate reads. See §4.2.

**`verify-derivation.ts` is the reason this is not a plain deletion.** Its header argues:

> The truth table below is written out rather than imported from `@senars/nar` on purpose — a
> verifier that shares the engine's arithmetic can only confirm the engine agrees with itself.
> This package has no engine dependency, so that independence is enforced by the dependency graph
> rather than by convention.

The argument is sound. The enforcement is absent — the graph says the package depends on nothing
but `zod` while the package imports from `nar` four times. So the file's stated safety property
is currently guaranteed by nothing, and the table **has already drifted** from the engine's
(TODO27 §22.5: `revision` caps at `MAX_CONFIDENCE` only in the saturated branch while the
verifier caps unconditionally; the verifier's `div` is `safeDiv` without the clamp).

**The move.** Four of the five files are shared contracts with no reason to be a package:
`schemas.ts` (618) → `core/` (io, nar and core all consume it; it is the wire format),
`budget.ts` (322) → `core/` (a `BudgetSlice` flows gate→thread→focus→bag, all of which are in
nar/core), and `term-view.ts` (47) and `rule-descriptor.ts` (54) → `core/`.

`verify-derivation.ts` keeps a home of its own, as a leaf depending only on `@senars/util` and
its own schemas. That is the only arrangement in which its header becomes true. The package
disappears; the boundary it was asserting is expressed by the import graph instead of by a
package manifest that never enforced it.

**Consequences to accept.** `complexity:budget` fixes `workspaceCount` at 7, so that baseline
moves to 6 — a legitimate edit, not a gate relaxation, since the count drops. `@senars/kernel` is
imported from 19 directories and 33 test files; all of them need repointing. TODO27 §14.5 notes
the API doc is generated from the exports map, so this is a `docs:api` change too.

**Scale, and who does it.** Five files move and ~52 import sites repoint. That is a
find-and-replace in an IDE, not a scripted refactor — the concept is one change and the diff is
mechanical, so it is a reasonable agent task in a single pass. It is worth contrasting with
§2, where the *concept* needs deciding first and the diff is large enough that a human has to
review it move by move.

### 1.2 Versions are not a constraint on this work — **landed**

**Decided (2026-09-29): the packages are not published and have no external consumers.**
Every `package.json` version becomes `0.0.0` — util, core, nar, io, kernel, metta, ui — and
AGENTS.md's deprecation lifecycle (mark → two minors → remove at a major) does not apply to
anything in this repository.

This dissolves **TODO27 §20.6**, which was recorded as "the one open blocker" of that line of
work: Phase I (`ba939629`) removed public exports at `nar@0.6.0` without the cycle, and
`exports:audit` cannot catch that because it checks that subpaths have consumers, not that
removals were versioned. With no consumers there is no breaking change to make.

The real lesson from §20.6 is not about versions — it is that **the gate could not see a policy
violation**. Worth keeping the audit as it is and not pretending it covers this ground.

**Consequence for this plan:** items that would normally carry a deprecation marker are just
moves. The `util/types/transport` `Logger` alias (already marked in `b184f9e9`, so the cycle
is running) and the `withTimeout` shadow in `nar/src/capability` (§3.3) can be deleted outright
rather than marked. `AdaptiveStrategy` and `SwitchingStrategy` are already gone — Phase I.

---

## 2. Directory shape

> **This section was a decision to make, not a refactor to run**, and it has been made and
> run — see §6. Everything in it was a bulk file move across nine directories, plus the
> import updates and barrel rewrites that follow. §2.4 was written first, which is what made
> the other eight mechanical enough to do in a pass per directory group rather than one at a
> time. The shape below is the target as it was proposed; §6 records where the tree did not
> match it, which was four directories out of nine.

### 2.1 Nine directories hold a contract beside its implementations — **landed**

**Verified.** The pattern is a `types.ts` (or a small `X.ts` of interfaces) with N sibling
implementation files:

| Directory | API file | Impls | LOC |
|---|---|---|---|
| `nar/src/game` | `Game.ts` (33) | 14 | 2 678 |
| `nar/src/terms` | `types.ts` | 18 | — |
| `nar/src/tools` | `types.ts` | 11 | — |
| `nar/src/rules` | `types.ts` | 11 | — |
| `nar/src/cognitive` | `types.ts` | 8 | — |
| `nar/src/rl` | `types.ts` | 5 | — |
| `nar/src/dialogue` | `types.ts` | 4 | — |
| `nar/src/drives` | `types.ts` | 3 | — |
| `nar/src/imagination` | `types.ts` | 3 | — |

`nar/src/game` is the clearest instance and the one to start with: the entire `Game` /
`GameOutcome` / `Perception` / `MetaGame` / `SelfMetaGame` contract is 33 lines, and it sits
beside fourteen concrete games plus `registry.ts`, `rewards.ts`, `sensors.ts`, `render.ts`,
`meta-spec.ts`, `actions.ts`, `registries.ts`.

Note that some directories already do it the other way — `nar/src/strategies/` has
`premise/`, `sampling/`, `derivation/`, `attention/`, `lm-graph/`, `lm-selectors/`
subdirectories and a single `types.ts` at the top. The convention is *already visible in the
tree*; it is just not the rule.

**Proposed shape**, matching what `strategies/` already does — shown so the target is
unambiguous, not as a work order:

```
game/
  Game.ts            the contract, re-exported from the barrel
  registry.ts        selection
  rewards.ts sensors.ts render.ts actions.ts meta-spec.ts registries.ts
  impls/             ArithmeticGame, BanditGame, CatchGame, ConversationGame,
                     Game2048, GridWorldGame, MetaGame, RPSGame, ReasoningGame,
                     ReasoningMetaGame, SelfMetaGame, SnakeGame, TetrisGame,
                     TicTacToe
```

**Do these yourself, in the IDE, one directory per commit.** Nine directories, one rule. The
rule is the deliverable — write it into `AGENTS.md` first (§2.4) and each move becomes
mechanical enough that the IDE does it for you. A hand-move of one directory with the rule
still undecided is the failure mode to avoid; a scripted 200-file move is the same mistake at
a larger scale.

Order that leaves the tree green longest: `game` first (clearest instance, and `ReasoningGame`
stays exported so the benches are untouched), then the `types.ts` directories, which are more
uniform. `terms` last — 18 files and the deepest import fan-in in the package.

**One wrinkle worth deciding deliberately:** `ReasoningGame` is the bench workhorse — 232 lines,
exported, and the target of the NAL/derivation/ReasoningGame measurement TODO27 §20.2 calls the
real gate on the reasoner. It is *not* an arcade game in the sense `SnakeGame` is. It may belong
in `reason/` or stay in `game/impls/` with a note. The contract is the same either way, so this
is a placement question, not a design one. **Still open** — it stayed in `game/impls/`, and
nothing about the move made the decision easier, which is itself the answer to whether it was
worth making.

### 2.2 Two directories are named `kernel` — resolved by §1.1

The package is dissolved, which leaves `nar/src/kernel/` unambiguous.

### 2.3 Two files are named `metta-proposer.ts` — **landed**

`nar/src/reflex/metta-proposer.ts` (87 lines) exports `agreeByExactAlgebra`, a shared vote
helper. `nar/src/meta/metta-proposer.ts` (279 lines) is the `ProofMettaProposer` class. Different
things, identical name, and `game/index.ts` carries a comment about a *different* rename
("from former cognition/") that shows the tree has been reshuffled by hand before.

Rename the reflex one to what it is — `algebra-vote.ts` or similar — or fold it into the
proposer's own module if it has no second consumer beyond `meta/metta-proposer.ts` and
`src/bin/bot.ts`.

### 2.4 The file-naming convention is unwritten — **landed, and it made §2.1 mechanical**

**Verified: 373 kebab/lower-camel files against 81 PascalCase**, with no rule distinguishing
them. The de facto convention appears to be *implementation classes are PascalCase, everything
else is kebab-case* — `TetrisGame.ts` and `BanditReflex.ts` next to `weighted-quorum.ts` and
`metta-proposer.ts` — but it is inference, not policy, and `Game2048.ts` sits awkwardly under
either reading.

**This is the one item in §2 an agent should write**, because it is prose rather than a move,
and because the other eight items are unmechanical without it. Add to `AGENTS.md`:

- A class whose exported name is a type — `Game`, `BanditReflex`, `TetrisGame` — is
  `PascalCase.ts`.
- Everything else is `kebab-case.ts`: helpers, registries, schemas, configs, barrels.
- A file exporting one class *and* its config type keeps the class's name
  (`TetrisGame.ts` exports `TetrisGameConfig`).
- No file name is an initialism run together (`LMRule.ts` is the exception and is deliberate —
  the domain says LM, not Lm).

Then §2.1's moves are mechanical, and the next contributor can tell which half of the
existing tree was deliberate.

### 2.5 Four single-file directories that are only barrels — **landed**

`nar/src/logger/index.ts` is two lines re-exporting `@senars/util` and `@senars/core/logger` —
a *third* path to the logger, added by the most recent commit. `nar/src/schemas/index.ts` is one
line (`export * from '../nl/schemas.js'`). `nar/src/otel/` and `nar/src/telemetry/` are real
modules with a barrel-shaped directory.

The logger one is worth a second look: there are now three module paths to one logger
(`@senars/util`, `@senars/core/logger`, `@senars/nar/logger`) and only the first two are
load-bearing. The others are a re-export of a re-export.

Also: 27 duplicate basenames across `nar/src` (`config.ts`, `registry.ts`, `factory.ts`,
`manager.ts`, `schemas.ts`, …). Most are harmless — `foo/config.ts` beside `foo/` — but
`similarity.ts` now exists in **both** `nar/src/memory/` and `nar/src/utils/`, which is exactly
the kind of near-collision that sends a grep to the wrong file.

---

## 3. Leftovers from TODO27

TODO27 recorded its remaining work in seven sections that each said "still open (unchanged)"
(§13.7, §15.6, §16.5, §18.4, §19.4, §20.5, §22.7). Transcribing that list turned out to be
worthless as a work queue — **four of its eleven items had already landed** and were carried as
open for several phases each:

| Item | Recorded open in | Actually |
|---|---|---|
| Bench 109, the North Star import-graph test | §15.6, §16.5, §18.4, §22.7 | landed — `tests/nar/todo27-north-star.test.ts` |
| `replay.ts` builds a `Memory` with no attention model | §14.6 → §18.4 | landed — `replay.ts:119-128` resolves via `resolveSlot` |
| The LRU has no metric | §13.7, §14.6, §18.4 | landed — `senars_strategy_memo_size` gauge, TODO27 §21.2 |
| The N1/N2 adapters take an optional catalog | §13.7 | no `catalog` parameter remains |

So the lesson is recorded here and the closed items are dropped rather than kept as
strikethrough: a follow-up list accumulates its own closures, and a plan that inherits it
inherits the staleness. **What follows is the live remainder, verified against the tree, not a
transcription.** The same is true of the older TODO docs — anything mined from them needs the
same check before it is believed.

### 3.1 `registerRuleGraph` is registered by side effect — **landed**

The controller registers it rather than the catalogue. It is registry-mediated so it does not
violate the North Star, but the catalogue is not yet the single declaration of every built-in.

**Landed.** `lm-graph` is a catalogue registration now (`stateful()` in
`strategies/registration.ts`), and `registerRuleGraph` is deleted. The bypass was worse than
described: the North Star bench matched `new *Strategy(`, and a built-in registered by a
*factory function* was invisible to it. The bench now derives the banned names from
`export class` under `strategies/`. §6 has the full account.

### 3.2 The seeded run is still not a hermetic one

`NARConfig.rng` fixes the draws; nothing fixes async interleaving, and `makeId`
(`crypto.randomUUID`, `util/src/utils/shared.ts:1`) still stamps task ids. TODO27 §13.5 records
the cost of the earlier half: `tests/nar/rl/parity/cognitive-advantage.test.ts` seeds the game
but the NAR side samples from `Math.random`, so it flakes under full-suite contention —
attributed there to the pre-existing tier, not introduced by that phase.

The full fix threads an injected `RandomSource` through `NARConfig` into every bag and sampler.
It is a plan of its own and it touches the parity baseline the excluded `test:load-sensitive`
tier exists to protect.

### 3.3 `withTimeout` shadows the canonical name in a declared subpath — **landed**

`nar/src/capability/wasi-sandbox.ts:37` exports a `withTimeout`; `@senars/util` has one at
`util/src/utils/shared.ts:48`. `nar/package.json` declares `./capability` as a public subpath,
so the shadow is exported. TODO27 §22.5 declined to rename it on versioning grounds — per §1.2
those grounds are gone. Rename it.

### 3.4 A cognitive-parameter file loader — **landed**

The `senars replay` CLI and any other out-of-process consumer cannot name the parameters a run
used. TODO27 §18.4 called this "the missing half" of both 18.1 and 18.2, and the other half
has since landed — `replay.ts` accepts `cognitiveParams` and resolves the attention model
correctly, so the loader is the only thing between a replay and the parameters it needs.

`cognitiveParams` reaches `replay` from `src/bin/lib/tune-runner.ts:169`, which has them in
memory. What is missing is a file the CLI can read, so a run's parameters survive the process
that produced them.

**Landed.** The file format already existed — the tuner has been writing
`{ cognitiveParams: params }` and nothing read it. `readCognitiveParams(source)` in
`config/cognitive-parameters.ts` parses and validates it, and
`senars replay --cognitive-params <path>` consumes it. A missing or invalid file exits
non-zero rather than replaying with defaults.

### 3.5 `bandit` reports `pass: false` where the test's own acceptance is 2/3 seeds — **landed**

`scripts/rl-parity.ts` and the test encode the acceptance rule in two places
(`meetsParityAcceptance(envType, overallRatio, passRate)` at `rl-parity.ts:407`). Unify when
either moves.

### 3.6 Association provenance

`AssociateOptions` has no `source`, so a link written by a strategy is indistinguishable from
one written by inference. TODO27 declined this in §10, §11.4, §12.7, §13.7 and §18.4 on the
same grounds each time: it is a `Link` model change, and **nothing can read the field yet**, so
adding it now is a field with no consumer. That reasoning has not changed. Leave it until a
reader exists.

### 3.7 Non-`term`-keyed memories

`LinkLayerMemory` and `GraphMemory` cover the two current shapes. A third storage kind needs no
registry change but would need its own `AssociativeMemory` implementation. A feature, not a
cleanup — recorded so it is not rediscovered as one.

### 3.8 The measurement debts

Three, all recorded rather than scheduled, and all with the same obstacle — an install at a
past commit:

- **The backport measurement** (§19.4). Whether the strategy refactor changed reasoning quality
  is currently unknowable: "cost 11 points" and "cost nothing" are equally unsupported. §19.4
  records one failed attempt and why — the patch applies, but the old tree will not run against
  the current install without a hand-built `node_modules`. The real cost is the install, not the
  patch.
- **The fundamentals bench asserts wiring, not quality** (§20.5). Scenario 1 has a
  multi-candidate ambiguity and the bench checks that candidates come back, not that the right
  one wins. A real project with a scoring decision in it.
- **No deterministic gate on the real-provider lanes** (§20.5). The temperature problem is
  unsolved.

---

## 4. Worth doing while the structure moves

These are not separate projects. They are the things that become cheap, or newly possible, once
§1 and §2 land.

### 4.1 The verifier's drift becomes a test — **landed**

§1.1 dissolves the package but leaves `verify-derivation.ts`'s truth table transcribed and
**already drifted** from the engine's. The point of an independent verifier is that it catches
engine drift, so a drift it has *already* accumulated is the specific failure it exists to
prevent.

The fix is not to import the engine's table — that is what the file's header correctly refuses.
It is a test that pins the two tables' divergences as a declared list: the saturated-branch
`MAX_CONFIDENCE` cap, and `div` versus `safeDiv`. When the engine's arithmetic changes
intentionally, the test says which entries are now wrong. While both are stable, it says
nothing has drifted *further*.

This turns TODO27's "the drift is recorded, not fixed" into something that stays true.

### 4.2 `deps:gate` cannot see direction — or `kernel` at all — **landed**

`deps:gate` counts circular chains and compares a number (`BASELINE = 25`,
`scripts/deps-gate.ts`). It has no notion of *direction*, which is one reason §1.1's inversion is
invisible to it.

The larger gap: `DPDM_TARGETS` (`scripts/lib/dpdm.ts:8`) is
`['src/', 'core/src/', 'nar/src/', 'io/src/', 'metta/src/']` — **`kernel/src/` and `util/src/`
are not analyzed at all.** So the `kernel` package, the one with the layering inversion, is
outside the graph that every dpdm-based gate reads. `complexity:budget`'s
`depsGateRawChains` reads the same helper and is blind for the same reason.

Two changes, in order of value:

1. **Add `kernel/src/` (and `util/src/`) to `DPDM_TARGETS`.** Cheap, and it makes the graph
   honest. Expect the cycle count to move — raising the baseline in the same commit is the
   documented procedure, and the delta is information rather than a regression.
2. **Add a direction check.** A package graph with declared edges is derivable from the
   `package.json` `dependencies` maps, and a check that fails when package A imports package B
   while B does not depend on A catches the class rather than this instance. It would have
   caught §1.1 at commit time.

Together these keep §1.1 fixed rather than fixed-once: the inversion is corrected by hand, and
the graph stops being able to hide the next one.

### 4.3 `unboundedAccumulators: 0` is two hardcoded file checks, not a measurement — **landed**

`complexity:budget` reports `unboundedAccumulators: 0` under a `mustRemainZero` rule, and that
reads like a repository-wide invariant. It is not. `countUnboundedAccumulators`
(`scripts/complexity-budget.ts:123`) walks a **literal array of two paths** —
`nar/src/kernel/source-reputation.ts` and `nar/src/rl/q-belief-store.ts` — and for each asserts
the file's text contains `LruCache` and matches `/LruCache\(\{[^}]*maxSize/`. A file that fails
either test increments the count; a file that *does not exist* also increments it.

So the metric is a string check on two files, it cannot see a new unbounded accumulator
anywhere else, and it is a `mustRemainZero` gate that is green for a reason unrelated to the
property it names. A file could grow an unbounded `Map` tomorrow and the gate would stay green
— which is the same shape of blind spot as §20.6's `exports:audit`, except here the property
being asserted is stronger-sounding than what is checked.

The finding rate says the property is worth having. The last pass alone turned up seven
(`SingleFlight`, `StreamReasoner`, `RuleIndex.recentRules`, `traceGradeHistory`,
`trajectoryHistory`, `ProofMettaProposer.rules`, `ConceptGraph.coActivations`), every one on
an unbounded or untrusted key, plus two manual `pruneWeakest` guards that had never worked
(TODO27 §12.5 noted the instance caches lived in `cognitive/`, outside this scope; Phase G
bounded them anyway).

**A real check** is a heuristic over the AST or a lint rule: flag a `new Map` / `new Set` /
`[]` that is assigned to an instance field and never passed a bound. False positives are the
cost, and a false positive that says "this Map is unbounded — bound it or say why" is a cheap
one. The alternative is to rename the metric to what it does — `boundedContainers: checked` —
so the gate stops implying a coverage it does not have. Either is better than the current
state, which is a green check for a property nothing measures.

### 4.4 `nar/src/nar.ts` is 846 lines against a 940 budget — **decided, not shrunk**

Under, and shrinking is a `mustDecreaseOrJustify` ratchet — but the budget is a line count on a
file that still holds the NAR's construction and its wiring. Worth deciding whether the file
wants to stay that size, rather than letting a number answer by default.

**Decided: the file stays.** The 940-line budget this cites no longer exists — per-file limits
went with the metric renames in the first pass, so there is no number left to answer with,
which is the decision the plan was asking for. `nar/src/nar.ts` is a composition root: ~200
lines of construction and ~630 of public accessor surface, and the accessors belong on the
class. Of the construction, exactly one subsystem has a real seam — System One is optional,
and when it is off the perception config is `undefined` rather than a smaller object — and that
is now `nar/src/system-one-wiring.ts`. 846 → 832, because a decision left it.

### 4.5 The gates do not run the e2e tier — **landed**

`ci.yml` runs `typecheck`, `lint`, `deps:gate`, `exports:audit`, the docs-drift check and
`test:unit`. `test:e2e:smoke`, `test:e2e:bin` and `test:determinism` exist and were verified
locally against the cached GGUFs, but no workflow runs them.

`test:determinism` needs no model and is the gate that protects the seeded-RNG paths the last
several phases touched. It is the cheapest missing CI gate in the repository.

### 4.6 Two flaky tests, verified pre-existing — **landed, and a third joined them**

`tests/nar/todo26-cognitive-agent.test.ts` and
`tests/nar/rl/parity/stress-boundary.test.ts` fail intermittently under full-suite load (both
15 s timeouts) and pass in isolation. Confirmed pre-existing by stashing the working tree and
re-running against clean `main`: the same two, 2 609 passing. `ci.yml` isolates
`test:load-sensitive` in its own job for exactly this reason, so the repository already has the
pattern; these two are not in it.

**Landed, and a third file with them.** `tests/nar/bag-fidelity.test.ts` (chi-squared at 50k
samples) fails the same way and passed in isolation on both sides of every change this pass
made. All three are tagged `@load-sensitive` and moved out of `test:unit` into the isolated
tier, which is the pattern the repository already had. `test:unit` is now 2 611 passing with
zero failures under full-suite load.

---

## 5. Not doing

- **Re-merging the whole UI.** 432 files, 54 737 lines, untouched by any of this.
- **The parameter ledger, the drive system, or the strategy algebra.** Not structural concerns.
- **Reclaiming production LOC as a goal.** `complexity:budget` holds it as a
  `mustDecreaseOrJustify` ratchet and that is the right shape for it. The finds in TODO27 came
  from chasing a duplicated *concept*; a few of them were bugs, and a LOC target would not have
  found any of them.
- **Renaming anything for tidiness alone.** Every rename in §2.3–§2.5 is one that removes a
  genuine ambiguity. The 27 duplicate basenames are worth a look *only* where two of them
  collide meaningfully, as `similarity.ts` does.
- **The `verify-derivation` truth table itself.** §4.1 pins the drift. Rewriting the table is
  the thing the file's header argues against, and closing it properly means two hand-checked
  tables and a scoring decision — a project, not a cleanup.

---

## 6. What landed

Three passes. The first (`f45e9e7a`, `eec1dcb5`, `b7fb1971`) dissolved the `kernel` package
and fixed the three gates that were measuring the wrong thing. The second — the eight
commits below — finished §2, cleared `core`'s upward edges, and closed three of the
leftovers. The third closed §8.1 and §8.2/§8.6, and rewrote the direction gate, because the
gate could not see the thing it existed to catch. Every gate green: `typecheck`,
`typecheck:bin`, `lint`, `deps:gate`, `deps:direction`, `exports:audit`, `exports:check`,
`exports:barrels`, `complexity:budget`, `test:unit` (2 628 passing), `test:load-sensitive`,
`test:determinism`.

### Third pass

| Commit | § | Item |
|---|---|---|
| `64663578` | 8.1 | `MettaPort` in `core`, `createMettaPort` in `metta`, injected through `nar` — and `deps:direction` rewritten to see dynamic imports, undeclared manifests and self-references |
| see below | 8.2, 8.6 | `exports:barrels`: no `export *`, no unreachable module. Seven barrels made explicit, one dead shim deleted |

### §8.1: the gate that could not see the inversion it was written for

The seam itself was the small part. The finding is what `deps:direction` reported when it
was finally able to look properly:

- **The edge was four sites, not one.** `nar/agent/index.ts` and `nar/src/facade/index.ts`,
  and three of the four imports were `await import('@senars/metta')`. The regex matched only
  `import … from '…'`, so removing the one static import made the gate go green with three
  live edges underneath it. The lesson is the same one §7.2 already recorded, one layer up: a
  gate built from a naming convention asserts the convention.
- **The manifest said nothing.** `nar/package.json` declared no `@senars/metta` dependency at
  all. The §1.1 kernel package's manifest declared `zod` and imported `nar` four times; this
  is the same omission, one package over, and no gate compared imports against a manifest.
  That comparison is now the gate's second rule.
- **A self-reference rule found four real sites.** `core` importing `@senars/core/budget` and
  `@senars/core/helpers`, `nar` importing `@senars/nar` twice — each resolving through the
  workspace root rather than the package's own exports map. That is precisely the fragility
  §1.1 described for `kernel`, and it survived the fix of it.

The gate now reads specifiers from a **masking pass**, not a regex: comments and template
literals are blanked, quoted strings are kept. `nar`'s own `test-gen.ts` and
`scaffold-capability.ts` emit `from '@senars/nar/tools/schemas'` as *generated text* — three
files' worth of false positives a naive scan would produce, and a gate that cries wolf is a
gate people route around. The two rules that do not need a parser:

> **Declared means declared** — a package that imports another must declare it in
> `dependencies`. **Dynamic imports count** — `await import(…)` is a value edge at runtime.

There is no type-only exemption any more. The first version excluded `import type` on the
grounds that it is erased at compile time; that is true and it is the wrong question here,
because a package naming a package above it is the layering claim being *made*. Nothing in
the tree needed the exemption, so it went.

`tests/nar/todo28-layering.test.ts` falsifies the scanner against the shapes that break it —
comments, template literals, nested `${}` containing braces and quotes, escaped backticks,
and the two generator files in the repository that emit import text as data.

### §8.2/§8.6: the barrels, and how the conversion was verified

Expanding `export *` into named re-exports is mechanical and *silently destructive* if the
name list is wrong, so the list did not come from a regex over the source. It came from the
compiler: `tsc --declaration --emitDeclarationOnly` over the seven barrels, then each
module's resolved `.d.ts` parsed for its export list, with `export *` inside a `.d.ts`
followed transitively. That gives the exact set including the value/type split — except for
pass-through shims, where `nar/src/utils/throttle.ts` re-exports from `@senars/util` and the
declaration does not mark `ReadOnlyLookup` as a type. Those were adjudicated by `tsc` itself:
each `TS1205` moved the named export from `export { … }` to `export type { … }`, iterated
until clean.

The check that the conversion lost nothing: emit the barrel's `.d.ts` **before** and **after**
and diff the flattened export name sets. 362 names across seven barrels, identical. Recorded
because the failure mode is invisible — a dropped export is not a compile error when the
barrel is the definition.

`exports:barrels` found `nar/src/memory/episodic.ts` on its first run: a three-line shim
re-exporting `EpisodicMemory.ts`, which the `./memory/episodic` subpath had already been
repointed away from. Nothing imported it. Deleted — the second dead file this pass removed,
after `nar/src/kernel/`'s `verify-derivation.ts` claim in §1.1 turned out not to need a
package to live in.

### Second pass

| Commit | § | Item |
|---|---|---|
| `b4efe019` | 2.1 | `drives`, `imagination`, `dialogue`, `rl` — contract at the top, implementations under `impls/` |
| `c75684bd` | 2.1 | `tools`, `rules`, `cognitive` — the same, and the three contract/impl splits the plan warned about |
| `3e17bbf5` | 2.1 | `terms` — 17 modules under `impls/`, the deepest fan-in in the package, done last as planned |
| `e3364586` | 7.8 | The three flaky files join `test:load-sensitive`; the unit tier is now green under full load |
| `eb2426c3` | 8.1 | `core` no longer imports `nar` or `io`. `ALLOWED_UPWARD` is down to one entry |
| `de3bb5d3` | 7.2 | `lm-graph` is a catalogue registration, not a controller side effect |
| `a3e87e03` | 7.4 | `senars replay --cognitive-params <path>` |
| `f9869081` | 4.4 | System One construction given its own seam |

### §2.1: `types.ts` was not the contract in four of the nine

The plan's warning was right and understated. Per directory:

- `drives` — `types.ts` was already the contract. `manager.ts` → `impls/DriveManager.ts`;
  `builtin.ts` and `bootstrap.ts` are data, so they moved as data.
- `imagination` — `types.ts` the contract; three classes → `impls/`. Renamed for the class
  they hold, which is the §2.4 rule applied to files nobody had looked at since.
- `dialogue` — `types.ts` the contract; `consumers/` already a subdirectory, so it became
  `impls/consumers/`. Two files renamed (`capture.ts` → `DialogueCapture.ts`,
  `text-store.ts` → `DialogueTextStore.ts`), one kept its kebab name (`retrospect.ts`
  exports functions, not a class).
- `rl` — `types.ts` is **6 lines** and holds one interface. The implementations are the
  other eleven files, including a whole `adapters/` subdirectory that was already
  implementations. Now `types.ts` at the top, `impls/` below.
- `tools` — `types.ts` the contract, and `tool-registry.ts` was a *second* barrel over
  four impls. It moved under `impls/` with them, so `index.ts` is the only barrel.
- `rules` — the one that needed real work. `types.ts` held the contract **and**
  `RuleRegistry`, `RuleIndex`, `createRulePattern` and two statistics interfaces. Split:
  the contract and `createRulePattern` stayed, `RuleRegistry` → `impls/rule-registry.ts`,
  `RuleIndex` → `impls/RuleIndex.ts`. `RuleStatistics` and `RuleDependency` went back to
  the contract, because they are the shape `RuleIndex` reports, not a strategy.
- `cognitive` — `types.ts` the contract; `ReasoningStep` had been declared in
  `MetacognitiveMonitor.ts` and re-exported by `types.ts`, which is the contract pointing
  at an implementation. Moved into `types.ts` proper.
- `terms` — `types.ts` the contract, plus `operators.ts`, which the contract is
  parameterised by and which stays at the top beside it. `Truth` and `Stamp` are classes
  and became `impls/Truth.ts` and `impls/Stamp.ts`.

`nar/src/terms/` and `nar/src/rules/nal|extended/` keep their existing subdirectory shape —
`extended` and `nal` are rule *families*, which is what `strategies/` already does.

### §7.1's fan-in is shallower than the plan estimated

The plan warned that `terms` has "the deepest import fan-in in the package" and should go
last. It did, and it was mechanical, because the barrel is the only path most of the tree
uses. Twenty-seven deep import sites existed, all of them type-only or test-local. The
larger edit was the *export map*: `@senars/nar/terms/truth.js` was a declared subpath
consumer, and `./cognitive/corrections` was a second one pointing into a directory that
had just moved.

### §7.2: the bypass had a name the test could not see

`registerRuleGraph(registry)` was in `RuleGraph.ts` and called from
`CognitiveController`. The North Star bench's regex was `new \w*(?:Strategy|Composite\w*)\(`,
which matches *construction* — so a built-in registered by a factory function was invisible
to it, and the plan's framing ("the controller registers it rather than the catalogue")
understated the shape.

Two changes:

- `lm-graph` is now a catalogue registration, via a new `stateful()` builder in
  `strategies/registration.ts`: one instance per registration, built on first resolution,
  `config` rejected. That is Invariant S1 as the catalogue has always described it —
  `singleton()` was a pre-built instance, which would have meant constructing a
  `ConceptGraph` at module load for every process that imports the catalogue.
  `singleton()` now delegates to it, so there is one definition rather than two.
- The bench now **derives** the banned names from `export class` declarations under
  `strategies/` instead of matching a suffix. That is what would have caught this, and it
  catches the next one by construction rather than by a reviewer noticing a missing `Strategy`.

The derived check found three more sites immediately, all `new PrioritySampling()`: `learning/
aikr-processor.ts`, `learning/schema-induction.ts`, `lm/system-one/contrastive.ts`. None is
a slot — each is a component's own private default for a sampler it never resolves through
the cognitive registry — so they are named in `CONSTRUCTION_SITES` with that reason rather
than refactored. `NullAttentionModel` is excluded from the derived set by name: it is the
§15.5 substrate default, and the existing attention-import clause already documents it.

**The lesson worth keeping:** a gate built from a naming convention asserts the convention.
The first version of this test would have passed with `registerRuleGraph` in the tree for
several more phases.

### Second-pass §8.1: both `core` seams were misfiled rather than misplaced

The plan proposed moving `createCognitiveAgent` down and `serializeTerm` down. Neither
needed moving — both were in the wrong file for a different reason.

- `core/agent/index.ts` re-exported `createCognitiveAgent` with **zero consumers**. Deleted.
  Nothing needed to move anywhere.
- `core/concept-graph.ts` is not a core primitive. `ConceptGraph` is the co-activation
  substrate `RuleGraph` selects LM rules with, and `RuleGraph` lives in `nar`. It moved to
  `nar/src/memory/ConceptGraph.ts`, which is where its only three consumers already were.
  `serializeTerm` stayed in `terms`, because the alternative — a Narsese serializer in
  `util`, dragging `Term` and `OPERATORS` with it — buys a clean gate at the price of the
  vocabulary being split across two packages.

The `core → io` edge was the one the plan called "a genuine cycle waiting to happen".
`io/src/ledger.ts` depends on nothing but `node:fs`, `node:path`, `zod` and four helpers
that already live in `util/src/utils/fs.ts` — it was never an `io` thing. It is now
`util/src/ledger.ts`, beside the JSONL primitives it is built from, and `io` no longer has
a single file that does not need `core`.

`ALLOWED_UPWARD` is one entry: `nar → metta`, where `nar/agent/index.ts` constructs
`MettaEngine` directly. That one is a genuine seam to inject, not a misfiling.

### §7.4: the file format already existed

`src/bin/lib/tune-runner.ts:166` writes `{ cognitiveParams: params }` and has for some
time. Nothing read it. The loader is `readCognitiveParams(source)` in
`config/cognitive-parameters.ts` — pure, so it is testable, and it accepts both the tuner's
envelope and a bare parameter object, because one is what the tool produces and the other
is what a person writes. Validation is the same `validateParameters` pass a live config
goes through, so a file naming an unregistered strategy fails at load rather than at
resolution. `senars replay --cognitive-params <path>`; a missing or invalid file exits
non-zero rather than replaying with defaults, which would have produced a plausible state
hash from the wrong configuration.

### §7.8: the tier was already the right shape

`test:load-sensitive` already existed and `ci.yml` already ran it in its own job. The three
files needed two things, not a new job: a `@load-sensitive` tag on their `describe` (the
tier selects on `-t '@load-sensitive'`, so a file without the tag contributes nothing) and
removal from `test:unit`, since the tiers must partition. `test:unit` is now **2 611 passing
under full-suite load with zero failures** — which is the first time that has been true
during this line of work.

### §4.4: decided, not shrunk

The 940-line budget the plan cites no longer exists — `complexity:budget` measures
`productionLOC` in aggregate, and per-file limits went with the metric renames in the first
pass. So there is no number to answer with, which is the decision the plan asked for.

`nar/src/nar.ts` is a composition root: ~200 lines of construction and ~630 lines of public
accessor surface. The accessors belong on the class — they are the NAR's API, and moving
them to a mixin or a delegating facade would make every call site worse to read. Of the
construction, exactly one subsystem has a real seam: System One is optional, and when it is
off the perception config is `undefined` rather than a smaller object, so "build it" and
"decide whether the gate registry gets a judge" are the same question. That is now
`nar/src/system-one-wiring.ts`. The rest is a sequence of unconditional
`new X(this.y)` assignments with no boundary to cut at, and splitting it would produce
several narrow files that each exist only to be called once, in order. **846 → 832 lines,
and the file is smaller because one decision left it, not because a number did.**

---

## 7. What is left

### 7.1 §2.1 — done

All nine directories. See §6.

### 7.2 §3.1 `registerRuleGraph` — done

`lm-graph` is a catalogue registration. See §6.

### 7.3 §3.2 the hermetic seeded run — unchanged, and now cheaper to scope

`NARConfig.rng` fixes the draws; nothing fixes async interleaving, and `makeId`
(`crypto.randomUUID`) still stamps task ids. Still a plan of its own, and it still touches
the parity baseline `test:load-sensitive` exists to protect — which is now a *better*
protected baseline than before, since the whole tier is green rather than three files
excluded.

The vocabulary is `deps:direction`'s: a `RandomSource` threaded through `NARConfig` is a
*seam*, not a parameter, and the bags that sample from it are the ones that must take it.
`src/bin/lib/tune-runner.ts:169` already has the parameters in memory, and §7.4 now lets
them survive the process — so the remaining half is the RNG, not the config.

### 7.4 §3.4 the cognitive-parameter loader — done

`replay --cognitive-params`. See §6.

### 7.5 §3.6 / §3.7 recorded, not scheduled

Association provenance (a `Link` field with no reader) and a third `AssociativeMemory` kind
(a feature). Both still correctly declined. Nothing in this pass changed the reasoning:
`LinkLayerMemory` and `GraphMemory` still cover the two shapes, and the derived class names
in the North Star bench found no reader appearing for a `source` field.

### 7.6 §3.8 the three measurement debts — unchanged

All three still blocked on the same thing, an install at a past commit.

### 7.7 §4.4 `nar/src/nar.ts` — decided

System One got the seam it had; the rest stays. See §6.

### 7.8 §4.6 the flaky tests — done

All three are in the isolated tier. See §6.

### 7.9 §8.1 `nar → metta` — done, and the ledger is empty

`MettaPort` in `core`, `createMettaPort` in `metta`, injected into `nar` and wired by the bin
composition root. See §6.

### 7.10 §8.2 / §8.6 the barrels — done

Seven barrels explicit and verified lossless; `exports:barrels` keeps them that way and
catches the module a barrel forgets. See §6.

### 7.11 what is left, in one place

Everything structural in this document is done. Four items remain, none scheduled:

| Item | § | Kind |
|---|---|---|
| The hermetic seeded run | 7.3 | a plan of its own — the only one |
| The `utils/` pass-through shims | 8.8 | mechanical, and the last instance of a named pattern |
| `bandit-epsilon-greedy` as a unit test | 8.9 | a benchmark with a wall-clock timeout |
| The `productionLOC` ratchet | 8.7 | a decision, not a measurement |

The first is the only one that needs new design. §7.3 has it in full; the note that has
changed is that the baseline it would move — the `test:load-sensitive` tier — is greener
than when it was written and still load-sensitive, per §8.9.

The three that are *not* scheduled all share a shape worth naming: each is something a
previous pass already observed and recorded, and each is cheap enough that recording it is
rational only because none of them was urgent. That is the failure mode this plan's §3
warns about — a follow-up list accumulating its own observations. The difference is that
each of these three has a concrete first step written down, where §3's transcribed list had
four items that had already landed.

---

## 8. New improvement opportunities

Surfaced by this pass, not in the original plan. In rough value order. §8.1, §8.2 and §8.6
landed in the third pass; §6 has the accounts.

### 8.1 `nar → metta` is the last upward edge, and it is the one the plan never found — **landed**

`ALLOWED_UPWARD` now holds a single entry: `nar/agent/index.ts` constructs `MettaEngine`
directly. It was found by the *gate*, not by reading the manifests — which is the argument
the first pass made for having one, now with one fewer entry and a correspondingly smaller
case to make.

The fix is a seam, not a move: `createCognitiveAgent` should take an engine, the way it
already takes a registry, a memory and a ledger. It is not small — the MeTTa engine is used
deep in the proof-metta path — and it is the last thing standing between
`core` being importable without anything above it and the layering claim being true rather
than conventional.

**Landed, and the ledger was worse than it said.** `MettaPort` now lives in `core`
(`core/src/metta-port.ts`) — the three methods `nar` actually used — and `metta` implements it
as `createMettaPort`. `nar` takes the port in `NARConfig` and `CreateAgentConfig`; the bin
composition root (`src/bin/lib/metta.ts`) wires the real one. `ALLOWED_UPWARD` is empty.

The edge the ledger recorded as **one** inversion was four import sites across two files,
three of them `await import(…)`, and `nar/package.json` named **no** `@senars/metta`
dependency at all. Three consequences worth keeping:

- **The engine was dead code.** `new MettaEngine()` is constructed without a runtime, and
  `doInitialize` is only reached through `Agent.registerEngine` — which never happened for
  it, because MeTTa is a tool and not an engine. So `mettaExecutor` was calling `query` on an
  engine with `#runtime === null`, which returns `[]` unconditionally. The port builds a real
  runtime; the `metta` tool in `initializeTools` was the only live consumer all along.
- **Absent a port is honest, not degraded.** The `metta` tool is still registered and reports
  `metta engine not configured` — the same string `core`'s builtin tool already used — so the
  tool surface does not change shape with the engine's presence. `adoptLearnedMettaRules`
  already handled an absent tool, so the arbiter loop degrades where it always did.
- **The narrowing also removed an undeclared third-party import.** `initializeTools` was doing
  `await import('effect')`, and `effect` is `metta`'s dependency, not `nar`'s.

See §6 for the gate rewrite that keeps it fixed.

### 8.2 Two barrels per directory, in three of the nine — **landed**

`tools/` had `index.ts` *and* `tool-registry.ts`, the second re-exporting four of the
first's sources. `game/` had `index.ts` re-exporting 14 impls and 9 support modules through
`export *`, so the barrel was a second unversioned index of the directory. `rl/` and
`imagination/` still `export *` from every module including the subdirectory barrels.

The rule that would catch it: **one barrel per directory, and it names what it exports.**
`grep -l "export \*" */src/*/index.ts` finds the current offenders. The `game/` barrel is
already explicit; `rl/` and `imagination/` are not, and `imagination/index.ts` is four
lines of `export *` over a contract and three classes.

**Landed.** `exports:barrels` is the gate: no `export *` in any barrel, and no module that
its barrel, a declared export subpath and every sibling in the package all pass over. Seven
barrels still had stars — `dialogue`, `game`, `imagination`, `nl`, `rl`, `strategies`,
`utils` — and all seven are now explicit, 362 names across them, **verified identical** to
what the stars exported (§6). The check found one dead file on its first run:
`nar/src/memory/episodic.ts`, a three-line shim duplicating `EpisodicMemory.ts`, which the
`./memory/episodic` subpath had already been repointed away from. Deleted.

### 8.3 The North Star's derived names are only as good as `strategies/`

The rebuilt bench reads `export class` declarations under `nar/src/strategies/`. A built-in
that is a factory function returning a closure — `createStrategy`, which the catalogue
itself uses — is still invisible, and `registerRuleGraph` was exactly that shape. Deriving
from the *registration* rather than the class would be stronger: the catalogue is the
declaration of every built-in, so the set of built-in names is
`DEFAULT_REGISTRATIONS` plus whatever the factory returns, and the latter needs a type.

The honest version is what shipped: names from classes, plus the three non-slot sites
named individually. A closure-returning built-in is still a gap, and it is the same gap the
first version had.

### 8.4 The accumulator ledger's paths are now three-deep

`ACCUMULATOR_LEDGER` records repo-relative paths, and two of its two rows moved twice this
pass (`nar/src/rl/q-belief-store.ts` → `nar/src/rl/impls/QBeliefStore.ts`). A missing file
counts as unbounded, so a move that misses the ledger turns the gate red — which is the
right failure direction, and it did fire once, immediately, during `b4efe019`. Worth
keeping. Worth also noting that the *file* is the fragile part, not the rule: a site
identified by a symbol would survive the next §2.1.

### 8.5 `deps:direction` reports a count, and the count went 3 → 1

The output is `no upward value edges (1 known inversion(s) in the ledger)`. With one entry
left, the number is more informative than the prose, and a future `ALLOWED_UPWARD` entry
added without closing one is visible in the diff of that file. Two entries, the number
stops carrying that. Nothing to do; worth knowing which regime the gate is in.

**Closed.** The ledger is empty and the gate no longer reports a count, because there is
nothing to count. The regime question is answered by removal rather than by watching the
number.

### 8.6 `nar/src/terms/index.ts` is 78 lines of hand-maintained re-export — **landed**

Every one of the nine barrels is now explicit rather than `export *` — which is what the
naming rule forces, since PascalCase impls under `impls/` need naming one at a time. The
cost is real: adding a term module means editing the barrel, and a forgotten line is a
silent omission rather than a compile error.

A `verify-exports`-style check — every module under a directory is re-exported by its
barrel — would make the omission fail instead. `scripts/verify-exports.ts` already walks
the export map; the same walk one level down is the shape.

**Landed, but not as proposed — the check as written was wrong.** "Every module under a
directory is re-exported by its barrel" demands ~48 files the tree has deliberately kept
private, and forcing them in would rebuild exactly the second unversioned index §8.2 objects
to. The rule that survives is reachability rather than publicity, and it has no ledger:

> A module is reachable if its barrel names it, a declared export subpath points at it, or
> something outside its own directory imports it. One that is reachable by none of the three
> is invisible.

A private module is not a false positive — its directory's siblings import it, which is the
third clause. What the check asks is whether a file is *reachable*, which is measurable,
rather than *public*, which the barrel already declares.

### 8.7 `productionLOC` is a `mustDecreaseOrJustify` ratchet over 73 705 lines

The second pass moved files and did not add much, so the ratchet should be comfortable —
but it is the one baseline in `complexity-budget.json` that is a judgement call rather than
a count, and it is the metric most likely to be quietly justified away. Worth deciding
whether it is still the right instrument now that the structural work is done and the
remaining movement is behavioural. **Unchanged** — the third pass moved it to 71 196, so the
question is still live rather than answered.

### 8.8 Three pass-through shims in `nar/src/utils/` — the same shape as the file §8.6 deleted

`collections.ts`, `helpers.ts` and `throttle.ts` each exist only to re-export
`@senars/util`, and `utils/index.ts` re-exports all three. That is the *identical* shape to
`memory/episodic.ts` — a second barrel, and a directory whose surface is two paths to one
module. §2.5 recorded the same finding for the logger (`@senars/util`, `@senars/core/logger`
and `@senars/nar/logger`) and did not act on it; `exports:barrels` does not catch this case
either, because a shim *is* imported by its directory's siblings, so it passes the
reachability clause.

The fix is the same as the logger's: delete the shims, repoint the ~19 importing files at
`@senars/util`, and let `nar` declare what it actually uses. Cheap, mechanical, and it would
close the last instance of the pattern this plan spent three passes naming.

### 8.9 `tests/nar/rl/parity/bandit-epsilon-greedy.test.ts` is a benchmark wearing a unit test's clothes

Recorded after the third pass, and **pre-existing** — it fails the same way on clean `HEAD`.

The `Level 2` cases drive 400 to 4 500 real NAR episodes (`perceive()` plus `nar.run(3)` at
`maxDerivationsPerStep: 500`) against a **30-second wall-clock timeout**, with
`cpuThrottleMs: 0`. The assertion is `setTimeout`, not a property, so pass/fail is a function
of machine speed and of whatever else is running: it passes in isolation, and crosses 30 s
under the isolated tier's own load.

§4.6 moved three files into `@load-sensitive` for exactly this shape but left this one
inside the tier, which reduces contention without changing what the assertion measures. The
honest fix is to move it to a bench job, or to scale the timeout to the work. Two smaller
costs sit inside the loop: `g.term.toString()` runs per pending goal per step, and
`bestAction.toString()` twice more per step — real serialisation in the hot path, though
fixing it perturbs what the test spends its time measuring.

### 8.10 The masking scanner is a library now, and three scripts could share it

`scripts/lib/imports.ts` extracts module specifiers by blanking comments and template
literals rather than by parsing. `exports:audit`, `docs:api` and `verify-exports` each walk
module structure by their own route; if any of them ever needs to know what a file imports,
that is the one to call. No duplication is known to exist today — recorded so the third
instance is not written from scratch.

The reason it is a masker and not a parser is worth keeping: `typescript@7` exposes **no
compiler API** (`require('typescript')` returns `{version, versionMajorMinor}`) and
`typescript-eslint` refuses to run against it. A lexical question needed a lexical answer,
and `typescript@7`'s removal of the compiler API is the surprising part.
