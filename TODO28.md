# TODO28: Structure — the package graph, the directory shape, and the leftovers

**Version:** 1.4 (2026-09-30) · **Predecessor:** TODO27 (phases A–P; strategy composition, then
the primitives pass), which closed the strategy axis and left this. v1.4 is the same plan after
the fifth pass, which took the one item §7.11 still listed — the hermetic seeded run — and
found the cost was in the assertion, not the code.

**Status: closed except the three recorded debts.** Everything in §1, §2, §3.1, §3.2,
§3.3–§3.5 and §4 landed, plus §8.1, §8.2, §8.6, and — across the fourth and fifth passes —
§8.7, §8.8, §8.9, §8.10 and §8.15. The layering ledger is empty, the barrels are explicit,
a seeded run draws no ambient entropy, and **one command now runs every gate**. §3.6–§3.8
are recorded and still correctly not scheduled. §6 is what happened, §7 is what is left, §8 is what the work surfaced. Sections
that shipped carry a **landed** marker and a note saying what the tree actually looked like.

**Every gate green, run by one command that also checks `ci.yml` runs them.**

> **A fresh session should read §7 first, and §7.11 is now one line long.** The
> package that should not exist is gone, all nine directories in §2.1 hold their contract at
> the top with implementations under `impls/`, `core` no longer reaches upward, the catalogue
> declares every built-in, every barrel names its exports, `test:unit` and `test:load-sensitive`
> are both green under full load, and `pnpm gates` runs the lot. There is no longer an
> inversion to record: `ALLOWED_UPWARD` is empty and two gates keep it that way.

### What the fourth pass added

Three of the four items were cheap. Two were not what they looked like:

- **§8.9 was not a benchmark wearing a unit test's clothes — one of its two `Level 2` cases had
  no timeout at all**, and sat on vitest's 15 s global default while taking ~19 s. It failed in
  isolation, on this machine, which is why the plan had recorded it as load-dependent. Its
  sibling *did* declare `{ timeout: 30000 }`, and that declaration was honoured — which is why
  the file read as one flaky file rather than one marginal test and one missing option.
- **§8.7 was a decision, and the answer was that the ratchet had never ratcheted.**
  `productionLOC` sat 2 415 lines above its measurement and `depsGateRawChains` sat 252 chains
  above, so neither could have failed in any pass of this plan. Both are now at their
  measurements and the rule is named for what the comparison does.

<dcp-message-id>m0125</dcp-message-id>

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

> **The docs-drift check was in that list the whole time, and red for the whole time.** The
> third pass found six stale files — the second pass moved files across nine directories and
> never regenerated. It is the one gate in this plan that was *running* and *failing* rather
> than missing, which is a different and worse failure mode than §4.5 describes: nobody
> notices a build that has been broken since the previous commit. Regenerated; see §6.

**And in the fourth pass the list turned out to be short in the other direction.**
`pnpm gates` (§8.10) checks that every gate it knows about appears in `ci.yml`, and it found
two that did not: `typecheck:bin` and `complexity:budget`. The second is the sharper one —
§6 of this document has claimed `complexity:budget` was a verified green gate since the first
pass, and CI had never run it. §4.5 asked for gates to be added to `ci.yml`; the answer
turned out to include *verifying* the ones already claimed there.

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

Four passes. The first (`f45e9e7a`, `eec1dcb5`, `b7fb1971`) dissolved the `kernel` package
and fixed the three gates that were measuring the wrong thing. The second — the eight
commits below — finished §2, cleared `core`'s upward edges, and closed three of the
leftovers. The third closed §8.1 and §8.2/§8.6, and rewrote the direction gate, because the
gate could not see the thing it existed to catch. The fourth took the four cheap items in
§7.11, and found that two of them were describing their symptom rather than their cause:
§8.9's timeout was never a timeout, and §8.7's ratchet could not fail.

Every gate green, run by `pnpm gates`: `typecheck`, `typecheck:bin`, `lint`, `deps:gate`,
`deps:direction`, `exports:audit`, `exports:check`, `exports:barrels`, `complexity:budget`,
`docs:drift`, `test:unit` (2 628 passing), and under `--tier slow`, `test:determinism` and
`test:load-sensitive` (57 passing across 8 files, under the tier's own load).

### Fifth pass

| Commit | § | Item |
|---|---|---|
| `1c2e0a41` | 7.3 | The id seam in `util`, `NARConfig.ids`, and `test:hermetic` — ambient entropy throws for the duration of a seeded run |

### Fourth pass

| Commit | § | Item |
|---|---|---|
| `b69dd06d` | 8.8, 8.10 | Six `utils/` shims deleted and 89 files repointed; `pnpm gates` added, and it found two gates `ci.yml` was not running |
| `43e46818` | 8.9 | One `Level 2` case in the bandit parity test had no timeout at all and sat on the 15 s default; both now declare 90 s |
| `36311c0b` | 8.7 | The `productionLOC` and `depsGateRawChains` baselines were slack ceilings; both now sit at their measurements |

### §8.10: the list that checks the checklist

The interesting failure is not the two gates `ci.yml` was missing. It is that
`complexity:budget` was on that list — §6 of this document has named it as a verified green
gate since the first pass — while `ci.yml` had never run it. Three passes of "every gate
green" meant every gate green *on the machine where they were run*, and the one place that
distinguishes is the one place two of them were absent.

That is the same shape as §4.5 (gates that do not exist) and §4.5's opposite (a gate that
was running and failing), and it has a name worth keeping: **a gate whose only entry point is
a habit is not a gate.** The fix is one list in `scripts/lib/gates.ts`, a runner, and a
check that the workflow runs every gate in it — because a list that only one side reads is
the same failure with better tooling.

### Third pass

| Commit | § | Item |
|---|---|---|
| `64663578` | 8.1 | `MettaPort` in `core`, `createMettaPort` in `metta`, injected through `nar` — and `deps:direction` rewritten to see dynamic imports, undeclared manifests and self-references |
| `0fc814c4` | 8.2, 8.6 | `exports:barrels`: no `export *`, no unreachable module. Seven barrels made explicit, one dead shim deleted |
| see below | 4.5 | `docs:api` / `docs:architecture` regenerated — the drift gate had been red since the second pass |

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

### §4.5: the gate that was running and failing, rather than missing

Worth setting beside §4.5's own finding, because they are opposite failures. §4.5 is about
gates that *do not exist* in `ci.yml` — cheap to add, and nobody can trip them. The
docs-drift gate was in `ci.yml`, running on every push, and had been failing since the
second pass regenerated nothing after moving files across nine directories.

It survived two passes and a status header that claims `docs:api` as a verified gate,
because the failure is six files of diff rather than a red test, and because the natural
way to run this plan's gates by hand is `pnpm typecheck && pnpm lint && pnpm test:unit`.
Verified pre-existing: the same six files drift on a clean checkout.

The general lesson is the one §7.2 and §8.1 each rediscovered in their own shape — a check
that nobody runs on the way through is a comment, not a gate — and the general fix is the
one `complexity:budget` already models: **one command that runs everything**, so the set of
gates is a list in a script rather than a set of habits.

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

### 7.3 §3.2 the hermetic seeded run — **landed**

`NARConfig.rng` fixed the draws and `makeId` (`crypto.randomUUID`) stamped unpredictable ids
onto them, so a "seeded" run recorded its trace under names nobody could reproduce. Those are
one defect, not two: reproducibility is a property of the *trace*, and the trace was full of
UUIDs.

**Landed, and the finding was that the plan had been about the assertion.** The plan proposed
threading a `RandomSource` into "every bag and sampler" — which is a parameter on a dozen
constructors, and which fixes the half that was already half-fixed. The unseamed half was the
*ids*, and no amount of `rng` threading touches them.

So the seam is where the ids actually are: `util/src/utils/id.ts` gained `installIdSource` /
`sequentialIdSource`, `makeId` reads the installed source, and `NARConfig.ids` installs it for
the NAR's lifetime and restores it on `dispose`. Process-scoped rather than a parameter on 38
call sites, because ids are minted deep in the gates, the task manager and the concept store,
none of which receives a NAR config — and one seeded NAR per process is what the determinism
gate and the replay CLI already assume. `sequentialIdSource` mints **counter-derived UUIDs**
rather than `evt-1`, because `CognitiveEventSchema` validates `taskId` as a UUID at the
untrusted boundary; that was the first thing the new test found.

`NARConfig.rng` is now also passed to five components that already accepted it and were never
given it: `ToolManager`, `RLFPLearner` (into `RewardModel` and `PolicyOptimizer`),
`EpisodeConsolidator`, `MiningBag` and `GameManager`'s `ProposalBag`, plus both
`EpsilonGreedyReflex`es in `facade/system-one.ts` (now one `incumbentReflex` helper — two
copies of the same arm count would drift).

#### The gate is a test that makes entropy throw

`test:hermetic` (`tests/e2e/hermetic-run.test.ts`) mocks `Math.random` and `crypto.randomUUID`
to **throw** and runs the five golden scenarios. A gate built from a naming convention asserts
the convention (§7.2, §8.1); this one cannot be satisfied by a file that merely looks right —
an unthreaded component fails the build by calling one.

It paid for itself on first run, three times over, and none of the three were the plan's
guess:

- **`util/src/logger.ts` drew `Math.random()` on every log line.** `samplingRate` defaults to
  `1.0` and the guard was `if (this.config.samplingRate && Math.random() > …)`, so the default
  path sampled unconditionally to decide not to sample. Now `samplingRate < 1 &&`.
- **`nar/src/bag/Bag.ts` minted its own id from `Math.random`** — deliberately, with a comment
  explaining that bag identity must not shift the seeded *sample* stream. The reasoning was
  right and the conclusion wrong: it needed the *id* seam, not the ambient source.
- **`sequentialIdSource` emitting `evt-1`** was rejected by `CognitiveEventSchema`.

A second case compares the raw event trace between two runs rather than the state hash: the
existing determinism gate's hash is computed from term/priority/truth and is **blind to ids by
construction**, which is why a UUID-stamped trace passed it for as long as it did.

Async interleaving is untouched and is the one half of §3.2 this does not claim. The property
now gated is: *given the same seed and the same ids, two runs produce the same trace* — which
is what reproducibility means for a single-threaded step.

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

**Nothing.** §7.3 was the last item and it landed in the fifth pass (§6). The three §3.8
measurement debts remain, blocked on an install at a past commit, and §3.6/§3.7 remain
recorded rather than scheduled for the reason already given — a `Link` field with no reader and
a feature, not a cleanup.

---

## 8. New improvement opportunities

Surfaced by this pass, not in the original plan. In rough value order. §8.1, §8.2 and §8.6
landed in the third pass; §8.7, §8.8, §8.9 and §8.10 in the fourth; §6 has the accounts.

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

### 8.7 `productionLOC` is a `mustDecreaseOrJustify` ratchet over 73 705 lines — **landed**

The second pass moved files and did not add much, so the ratchet should be comfortable —
but it is the one baseline in `complexity-budget.json` that is a judgement call rather than
a count, and it is the metric most likely to be quietly justified away. Worth deciding
whether it is still the right instrument now that the structural work is done and the
remaining movement is behavioural. **Unchanged** — the third pass moved it to 71 196, so the
question is still live rather than answered.

**Landed, and the instrument was not doing what its name said.** The plan asks whether a
LOC target is still the right instrument. The finding is that the question was premature: it
was never a target, because it could not fail. `productionLOC` had a baseline of 73 705
against a measurement of 71 196 — 2 415 lines of headroom, against a rule named
`mustDecreaseOrJustify`. `depsGateRawChains` had the same shape, 277 against a measurement
of 25. **Neither could have failed in any pass of this plan**, and §6 lists
`complexity:budget` as green in each.

That is the §4.3 shape one level up: a green check asserting less than its name. The fix is
not a better target, it is making the existing one honest:

- The baselines are at their measurements (`productionLOC` 71 290, `depsGateRawChains` 25,
  `exportSubpaths` 94). A ceiling that is never lowered is not a ratchet, it is a number
  that was correct once.
- The rule is `mustNotIncrease`, because that is what `current <= baseline` does. The
  *obligation* to move the baseline down is a commit-time one the code cannot enforce, so
  the failure message says so rather than the rule name implying it.
- The gate's own header now says this, because a reader of `complexity-budget.json` has no
  way to know the numbers were slack.

The decision the plan actually asked for — whether a LOC ceiling is the right instrument
for a codebase whose remaining work is behavioural — is still open, and it is now a real
question rather than a number that could not fail. **Keeping it is defensible**: it is the
metric that most reliably forces a deletion rather than a shrug, and the structural work has
dropped it by ~2 400 lines without anyone being asked to.

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

**Landed — and it was six shims, plus a barrel nothing imported.** The plan counted three;
the tree had `fs.ts` and `jsonl.ts` in the same shape, and `resilience.ts`, which existed only
to re-export `circuit-breaker.ts` one file away. `utils/index.ts` went too: it had **zero**
consumers, and its own header described the enumeration problem it was a symptom of —

> Enumerating their names here is how a new shared helper silently stops reaching the 19
> files that import this barrel.

No file imported the barrel. The comment was describing a fan-in that had already gone.

89 files repointed, `nar/src/utils/` down to four real modules (`circuit-breaker`,
`random`, `result`, `similarity`). Two imports could not be repointed because they named
nar-local symbols that had been riding the shim: `jaccard` (which lives in `utils/similarity`
and is a real nar implementation) and `CircuitBreaker`. Both now name the module directly,
which is the thing the shim was hiding.

**The gate still cannot see this, and that is the standing lesson.** `exports:barrels`
passes the shim because the third reachability clause covers it, and the shape is legal
TypeScript — a module whose body is a re-export is reachable by definition when its siblings
import it. What makes it wrong is not unreachability but *redundancy*: two paths to one
module, and one of them is not the declaration. Deleting them was a human judgement over
five files, and no rule derived from `exports:barrels` would have found them.

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

**Landed, and the diagnosis was a misreading of vitest's signature — corrected here because
the wrong version is more interesting-sounding and would mislead the next reader.** The plan
read the 30 s timeout as a benchmark that outgrew its budget. The first fix claimed the
`{ timeout: 30000 }` was in vitest's *second* argument, where the signature wants
`(name, fn, timeout)`, and was therefore "silently ignored". **That is wrong.** vitest
overloads the second position for exactly this:

```ts
interface TestCollectorCallable<C = object> {
  <ExtraContext extends C>(name, fn?: TestFunction, options?: number): void;
  <ExtraContext extends C>(name, options?: TestCollectorOptions, fn?: TestFunction): void;
}
```

Verified against `vitest@5.0.0`'s own `.d.ts`, and confirmed empirically: a probe test with a
16 s body and `{ timeout: 30_000 }` in second position passes. The original `{ timeout: 30000 }`
was honoured, and 30 s is genuinely not enough for a test that runs 4 500 episodes.

**So the real defect was the one §8.9 half-saw and the plan did not name**: the *other*
`Level 2` case, at line 96, had **no timeout at all** and sits on vitest's 15 s default while
taking ~19 s. That is the test that failed, in isolation, on this machine — and it is why the
failure looked like flakiness rather than a missing declaration. Both cases now pass `90_000`
as the third argument; the first case's omission is the whole bug. The loop cost went too —
the arm index now comes from a `Map` over the three action terms rather than a regex over a
serialised term, three times per step across 400 episodes.

**What survives, and it is the smaller point:** a 30 s ceiling on a ~19 s test is
load-dependent by construction — it passes alone and crosses 30 s under the tier's own load,
which is exactly the "passes in isolation" pattern the plan recorded and could not explain.
The reason it was unexplainable is that the other test in the file was failing for a wholly
different reason, on the same machine, at the same time. Two failures in one file read as one
flaky file. Before blaming a timeout for being too tight, check whether the *neighbouring*
test has a timeout at all.

The `armOf` change is unaffected by any of this and stands on its own.

### 8.10 There is no single command that runs every gate

Surfaced by the docs-drift gate, and the fix for the reason it went unnoticed. The gates are
ten separate `pnpm` scripts; the way they get run by hand is
`typecheck && lint && test:unit`, which omits `deps:gate`, `deps:direction`, both `exports:`
gates, `complexity:budget` and the docs-drift check — and the docs-drift gate then sat red for
a whole pass, in CI, undetected.

`complexity-budget.ts` is already the closest thing to an umbrella: it runs dpdm and
`tsc -p tsconfig.bin.json` internally and gates on their results. The fix is one more script
that runs the list, so the set of gates is a list rather than a set of habits, and a gate added
to `ci.yml` without a local entry point cannot be the only place it runs.

**Landed.** `scripts/lib/gates.ts` is the list; `pnpm gates` runs it. Three things about the
shape, each from a way the obvious version fails:

- **The list is checked against `ci.yml`, not just run.** Before any gate executes, the runner
  verifies that every gate it knows about appears in the workflow. Without this it fixes the
  "nobody runs the gates" failure mode and leaves the "the gate lives only in CI" one — which
  is how a gate gets skipped by a workflow edited without reading the list.
- **It found two gates that `ci.yml` was not running.** `typecheck:bin` and
  `complexity:budget` were both absent — and §6 had been listing `complexity:budget` as a
  verified green gate for three passes. It was green *locally*, and CI had never run it. A
  gate nobody can trip is not a gate, which is §4.5's finding, and it was true of a gate this
  plan itself had claimed was covered.
- **`docs:drift` is now a `pnpm` script rather than an inline shell block.** The drift gate was
  the only check CI ran that no local command could run at all, which is precisely why it sat
  red. A gate that exists only as a YAML step is a gate that nobody reproduces.

The tiers are `gate` (the default: everything above plus `test:unit`) and `slow`
(`test:determinism`, `test:load-sensitive`), because the cost is not uniform and a command
too slow to be used does not get used. The failure message says how many gates did not run,
so a partial run cannot be mistaken for a clean one.

### 8.11 The masking scanner is a library now, and three scripts could share it

`scripts/lib/imports.ts` extracts module specifiers by blanking comments and template
literals rather than by parsing. `exports:audit`, `docs:api` and `verify-exports` each walk
module structure by their own route; if any of them ever needs to know what a file imports,
that is the one to call. No duplication is known to exist today — recorded so the third
instance is not written from scratch.

The reason it is a masker and not a parser is worth keeping: `typescript@7` exposes **no
compiler API** (`require('typescript')` returns `{version, versionMajorMinor}`) and
`typescript-eslint` refuses to run against it. A lexical question needed a lexical answer,
and `typescript@7`'s removal of the compiler API is the surprising part.

### 8.12 A 15 s default is not a timeout you wrote — and vitest will not tell you

Surfaced by §8.9, and the generalisation is the opposite of the one I first drew. §8.9's
actual defect was a test with **no** timeout declaration, silently on the 15 s default. There
is no warning for it: nothing at declaration time, nothing at run time, and the failure reads
as a timeout rather than as a missing option.

Twelve `{ timeout: N }` sites exist in the test tree and **all twelve are the valid
options-object form** — `refactor4-budget.test.ts` (10), `todo16c-cache.test.ts`,
`stress-boundary.test.ts` — and vitest honours every one. So the shape is not the hazard. The
hazard is the **absence**: `grep -rn "^\s*\(it\|test\)(" tests/` and ask which declarations
have no timeout and no enclosing one, then compare each against what it costs.

Two things make that worth doing rather than leaving:

- The default is a **global** (`testTimeout`, currently 15 s) that nobody thinks about when
  adding a test, and it is silently correct for almost all of them. The file-level `describe`
  timeouts (`parity-restoration`, `budgetgate-verification`) are the other way to declare it,
  so a test can inherit from three places and none of them are at the call.
- A test whose runtime is within a factor of two of its timeout is **load-dependent by
  construction**, and the file it shares with another such test will look like one flaky file
  rather than two marginal ones — which is exactly how §8.9's misdiagnosis happened.

The gate shape is small: over `tests/`, find `it`/`test` declarations whose nearest enclosing
`testTimeout`/`{timeout}` exceeds ~3× a measured or declared duration. The measurement is the
awkward part, so the cheap first cut is lexical — flag any heavy test file (one that
constructs a `NAR`) with no timeout declared at either level.

### 8.13 `docs/architecture` encodes an import graph that goes stale quietly

The architecture generator emitted `stream --> utils`, `tools_impls --> utils` and five
other edges that §8.8 deleted, and `git diff --exit-code` caught them only because the
drift gate ran. The `.mmd` files are hand-readable and *correct the moment they are
generated* — but nothing makes them part of the import graph's contract, so a reader
trusting the committed diagram over the tree gets a picture of a repository that no longer
exists.

Two things would make it trustworthy rather than merely current. The first is that
`nar-modules.mmd` now shows `terms_impls --> utils` — the one real edge left, a genuine
dependency on `jaccard`, and the one that stopped being a shim. Worth noting that this is
the *only* thing §8.8 left behind, and it is a real one: `nar/src/utils/similarity.ts` is a
nar implementation, not a pass-through, so it stays. The second is that a diagram which
cannot be regenerated and diffed is documentation, and this one can, so it should be read
as generated output rather than maintained source.

### 8.15 The hermetic test's ceiling is the scenarios it can reach — **landed, and recorded**

`test:hermetic` runs the golden scenarios with System One off, LM off and tools off, because
those are the configurations the scenarios declare. It therefore does **not** cover the
manifold, the episode consolidator, the governance pipeline, `QBeliefStore`'s tie-break or any
reflex path — each is constructed only when its feature flag is on.

That is the honest boundary of the claim, and it is a *test-coverage* boundary rather than a
design one: every one of those components now takes `rng` from config, so what is missing is a
scenario that switches them on, not a seam. Worth knowing when the next ambient-entropy
failure appears in one of them — the test did not miss it because it is blind, but because
nothing exercised it.

### 8.16 `productionLOC` moved up for the first time under `mustNotIncrease`

The fifth pass added the id seam and `productionLOC` went 71 290 → 71 333, so the ratchet from
§8.7 fired on a change that added a real seam rather than padding. The baseline moved to the
measurement in the same commit, which is the documented procedure, and the number is worth
naming: **this is the first time in four passes that the baseline had to move up**, and it
moved for the first honest reason available. A ratchet that has never gone up has not yet been
tested in the direction that matters.

### 8.14 The remaining `utils/` directory is four modules and no barrel

`nar/src/utils/` is now `circuit-breaker.ts`, `random.ts`, `result.ts` and `similarity.ts`,
with no `index.ts` — the first directory in `nar/src` with no barrel, and
`exports:barrels` is green on it. That is worth recording as a *precedent* rather than an
anomaly: the barrel gate's reachability clause treats a missing barrel as "nothing to
check", which is right for four modules imported by relative path and wrong for a directory
whose surface is meant to be public. If a fifth module lands and someone wants to publish
the directory, the barrel comes back and the gate resumes governing it. No action; the
point is that the gate is not asserting every directory has a barrel, which is the property
a reader of `exports:barrels` might assume it is.
