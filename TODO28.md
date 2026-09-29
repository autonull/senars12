# TODO28: Structure — the package graph, the directory shape, and the leftovers

**Version:** 1.0 (2026-09-29) · **Predecessor:** TODO27 (phases A–P; strategy composition, then
the primitives pass), which closed the strategy axis and left this.

**Status: §1, §2.3–§2.5, §3.3, §3.5 and §4 have landed** (see *What landed* at the end of
this document; commits `f45e9e7a`, `eec1dcb5`, `b7fb1971`). Every item below was verified
against `e5646695` / `b184f9e9` unless a line says otherwise, and the landed sections say
where the tree moved underneath them.

> **A fresh session should read §1 first.** §1 is the one defect: a package that should not
> exist, importing the package it was supposed to be independent of, invisibly to every gate.
> §2 is a set of bulk file moves. **The rule is now written** (§2.4, landed in `AGENTS.md`) and
> one directory is done (§2.1, `game/`); the remaining eight are mechanical now that the rule
> exists. §3 is TODO27's leftovers, re-verified against the tree rather than transcribed;
> §4 is what became cheap once the above were done.

---

## 0. What this is

TODO27 was a behavioural line of work — one resolution path, then one primitive per concept.
This is a **structural** one. Nothing here changes what the system does; two items change what
it can *accidentally* do — §1.1, a layering inversion that no gate can currently see, and §4.3,
a metric that reports a property it does not measure.

| # | Item | Kind |
|---|------|------|
| 1 | The `kernel` package exists and should not | **defect** |
| 2 | Nine directories mix a contract with its implementations | **manual** — yours, in an IDE |
| 3 | The leftovers TODO27 recorded | carry-over, re-verified |
| 4 | What we can get for free while reorganizing | opportunistic |
| 5 | Deliberately not doing | — |

**§1, §3 and §4 are agent work**: a package that should not exist, a list, and small gate fixes.
**§2 is not** — it is a bulk file move across nine directories, and it is written here as a shape
to aim at while you have the IDE open, not as work to hand over. §2.4 is the exception: that one
is prose, and an agent should write it.

There are no time estimates in this document, by request. The ordering in §2.1 is a suggested
order for the manual moves, not a schedule.

---

## 1. The package graph

### 1.1 `kernel/` is a package that should not exist — and there are two of them

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

### 1.2 Versions are not a constraint on this work

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

> **This section is a decision to make, not a refactor to run.** Everything in it is a bulk
> file move — dozens of files across nine directories, plus the import updates and barrel
> rewrites that follow. That is IDE work, done by you, one directory at a time. An agent
> doing it in one pass produces a 200-file diff nobody can review, and the review is the only
> reason the move is safe.
>
> What an agent *should* do here is the part nobody enjoys: decide the rule, and write it down
> before the first move. §2.4 is that. Everything else in §2 is a shape to aim at while you
> have the IDE open.

### 2.1 Nine directories hold a contract beside its implementations

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
is a placement question, not a design one.

### 2.2 Two directories are named `kernel` — resolved by §1.1

The package is dissolved, which leaves `nar/src/kernel/` unambiguous.

### 2.3 Two files are named `metta-proposer.ts`

`nar/src/reflex/metta-proposer.ts` (87 lines) exports `agreeByExactAlgebra`, a shared vote
helper. `nar/src/meta/metta-proposer.ts` (279 lines) is the `ProofMettaProposer` class. Different
things, identical name, and `game/index.ts` carries a comment about a *different* rename
("from former cognition/") that shows the tree has been reshuffled by hand before.

Rename the reflex one to what it is — `algebra-vote.ts` or similar — or fold it into the
proposer's own module if it has no second consumer beyond `meta/metta-proposer.ts` and
`src/bin/bot.ts`.

### 2.4 The file-naming convention is unwritten — **do this one first**

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

### 2.5 Four single-file directories that are only barrels

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

### 3.1 `registerRuleGraph` is registered by side effect

The controller registers it (`nar/src/cognitive/controller.ts:199`) rather than the catalogue.
It is registry-mediated so it does not violate the North Star, but the catalogue is not yet
the single declaration of every built-in.

### 3.2 The seeded run is still not a hermetic one

`NARConfig.rng` fixes the draws; nothing fixes async interleaving, and `makeId`
(`crypto.randomUUID`, `util/src/utils/shared.ts:1`) still stamps task ids. TODO27 §13.5 records
the cost of the earlier half: `tests/nar/rl/parity/cognitive-advantage.test.ts` seeds the game
but the NAR side samples from `Math.random`, so it flakes under full-suite contention —
attributed there to the pre-existing tier, not introduced by that phase.

The full fix threads an injected `RandomSource` through `NARConfig` into every bag and sampler.
It is a plan of its own and it touches the parity baseline the excluded `test:load-sensitive`
tier exists to protect.

### 3.3 `withTimeout` shadows the canonical name in a declared subpath

`nar/src/capability/wasi-sandbox.ts:37` exports a `withTimeout`; `@senars/util` has one at
`util/src/utils/shared.ts:48`. `nar/package.json` declares `./capability` as a public subpath,
so the shadow is exported. TODO27 §22.5 declined to rename it on versioning grounds — per §1.2
those grounds are gone. Rename it.

### 3.4 A cognitive-parameter file loader

The `senars replay` CLI and any other out-of-process consumer cannot name the parameters a run
used. TODO27 §18.4 called this "the missing half" of both 18.1 and 18.2, and the other half
has since landed — `replay.ts` accepts `cognitiveParams` and resolves the attention model
correctly, so the loader is the only thing between a replay and the parameters it needs.

`cognitiveParams` reaches `replay` from `src/bin/lib/tune-runner.ts:169`, which has them in
memory. What is missing is a file the CLI can read, so a run's parameters survive the process
that produced them.

### 3.5 `bandit` reports `pass: false` where the test's own acceptance is 2/3 seeds

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

### 4.1 The verifier's drift becomes a test

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

### 4.2 `deps:gate` cannot see direction — or `kernel` at all

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

### 4.3 `unboundedAccumulators: 0` is two hardcoded file checks, not a measurement

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

### 4.4 `nar/src/nar.ts` is 846 lines against a 940 budget

Under, and shrinking is a `mustDecreaseOrJustify` ratchet — but the budget is a line count on a
file that still holds the NAR's construction and its wiring. Worth deciding whether the file
wants to stay that size, rather than letting a number answer by default.

### 4.5 The gates do not run the e2e tier

`ci.yml` runs `typecheck`, `lint`, `deps:gate`, `exports:audit`, the docs-drift check and
`test:unit`. `test:e2e:smoke`, `test:e2e:bin` and `test:determinism` exist and were verified
locally against the cached GGUFs, but no workflow runs them.

`test:determinism` needs no model and is the gate that protects the seeded-RNG paths the last
several phases touched. It is the cheapest missing CI gate in the repository.

### 4.6 Two flaky tests, verified pre-existing

`tests/nar/todo26-cognitive-agent.test.ts` and
`tests/nar/rl/parity/stress-boundary.test.ts` fail intermittently under full-suite load (both
15 s timeouts) and pass in isolation. Confirmed pre-existing by stashing the working tree and
re-running against clean `main`: the same two, 2 609 passing. `ci.yml` isolates
`test:load-sensitive` in its own job for exactly this reason, so the repository already has the
pattern; these two are not in it.

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

## 6. What landed (2026-09-29)

Three commits: `f45e9e7a` (§1), `eec1dcb5` (§1.2, §2.3–§2.5, §3.3, §3.5, §4),
`b7fb1971` (§2.1 `game/`). Every gate green: `typecheck`, `typecheck:bin`, `lint`,
`deps:gate`, `deps:direction` (new), `exports:audit`, `exports:check`, `docs:api` +
`docs:architecture` drift, `complexity:budget`, `test:unit`, `test:determinism`.

### Landed

| § | Item | Notes |
|---|------|-------|
| 1.1 | The `kernel` package dissolves | `schemas.ts` → `core/derivation-schemas.ts`, `budget.ts` / `verify-derivation.ts` → `core/`. `term-view.ts` and `rule-descriptor.ts` **deleted** — they had no consumer, and `exports:audit` only caught them once the package stopped shielding them. `workspaceCount` 7 → 6. |
| 1.2 | Versions `0.0.0` | Plus the two live deprecations deleted rather than marked: `transport`'s `Logger` alias, and `nar/capability`'s `withTimeout` → `withSandboxTimeout`. `AGENTS.md` now says the lifecycle does not apply here. |
| 2.3 | Two `metta-proposer.ts` files | The shared vote is `reflex/algebra-vote.ts`; each proposer is named for its class (`MettaProposer.ts`, `ProofMettaProposer.ts`). |
| 2.4 | The naming rule | `AGENTS.md`, first — it made every other §2 item mechanical. |
| 2.5 | Barrel-only directories | `@senars/nar/logger` (a re-export of a re-export) and `nar/src/schemas/` both gone. One logger path fewer; two fewer module paths to the same declarations. |
| 3.3 | `withTimeout` shadow | Renamed; the canonical `@senars/util` one is the only exported name. |
| 3.5 | Bandit acceptance | The rule was already in `nar/src/rl/parity-acceptance.ts`; the test was re-implementing it inline and now calls `meetsParityAcceptance`. |
| 4.1 | Verifier drift pinned | `tests/unit/core/verifier-drift.test.ts`. Declared divergence: `revision`'s **saturated branch, frequency only** — confidence agrees at the cap. Also pins that `div` is unclamped where `safeDiv` is (latent today), and that every table entry has an engine counterpart. |
| 4.2 | Direction check | `pnpm deps:direction` + CI. `util/src/` joins `DPDM_TARGETS` (cycle count unchanged at 4/25). |
| 4.3 | The accumulator metric | Renamed to what it measures; the audit set is declared data with a reason per row. See the note below. |
| 4.5 | `test:determinism` in CI | Its own job. 4 s, no model. |
| 2.1 | `game/` → `impls/` | The clearest instance, done first. The other eight directories are listed below. |

### The `budget.ts` problem was bigger than the package graph

§1.1 said `budget.ts`'s import of `@senars/nar/tick` was a layering inversion.
Moving the file into `core` would have *created* the same inversion one level
down, because `core` already depends on `nar` in two places. So the commit did
the second half of the job as well:

- `core/src/event-sink.ts` is a module-level domain-event sink. `initOtel`
  registers the exporter there. A lower layer announces something without
  importing a tracer. Seven one-line otel wrappers that existed only to forward
  an `emitEvent` collapsed into their call sites, and two of them
  (`emitBackpressureDecision`, `emitBagPressureTransition`,
  `emitStrategySelection`) were reachable only through a package boundary
  `core` should not be crossing.
- The `budget:slice:*` payloads have **one owner** now (`core/budget.ts`) instead
  of being transcribed into `nar`'s event map; `NAREventMap` extends
  `BudgetEventMap`.
- `AIKRBudget` had two declarations (`bag/Bag.ts`, `tick/tick.ts`). It has one.
- `core/agent/{Agent,pipeline,types}` imported `ThreadScope` from
  `@senars/nar/kernel` — a *different* `ThreadScope` from the one `core` exports
  as a `BudgetSlice` alias, so the field was typed wrong the whole time and
  nothing caught it. Replaced with the structural `CorrelationScopeStore`.

### §4.3: the detection rule was built, measured, and rejected

The plan offered a heuristic over the AST or a rename. Both were tried:

```
text scan for fields assigned `new Map` / `new Set` / `[]`
  574 candidates across six source roots
  302 unpruned — local variables, per-call scratch space, per-invocation maps
```

A heuristic that noisy cannot be a gate; it becomes a gate people learn to
ignore, which is the failure mode `exports:audit` already has. So the shipped
shape is the rename, plus two things the plan did not propose:

- the audit set is **data** (`scripts/lib/accumulator-ledger.ts`) with the reason
  each site is on it, so the next audit is adding a row rather than editing a
  hardcoded array in a counting function;
- `accumulatorsAudited` is a new metric with a `mustNotDecrease` ratchet, so the
  set cannot be quietly shrunk to make the gate pass. **The gate cannot catch a
  new unbounded accumulator elsewhere, and nothing in it claims to.** That is
  the honest version; the previous one was green for a reason unrelated to the
  property it named.

### §4.2: `import type` is excluded, and the ledger has three entries

An upward **type** edge is erased at compile time and cannot form a runtime
cycle, so it is not a layering break — it is a smell. Value edges only. The gate
found three pre-existing inversions on its first real run, all now named in
`ALLOWED_UPWARD` with the seam that would break each:

- `core → io` — `core/memory/SessionManager.ts` uses `createLedger`
- `core → nar` — `core/agent/index.ts` re-exports nar's `createCognitiveAgent`;
  `core/concept-graph.ts` uses `serializeTerm`
- `nar → metta` — `nar/agent/index.ts` constructs `MettaEngine` directly

The `nar → metta` one was **not** in the plan's list and is the argument for
having the gate: the plan's §4.2 was written from the manifests, the gate reads
the imports.

---

## 7. What is left

### 7.1 The other eight directories in §2.1

The rule is written and `game/` is done, so these are mechanical. `terms` last —
18 files and the deepest import fan-in in the package. Same shape each time:
contract at the top, implementations under `impls/`, barrel unchanged so the
export surface does not move.

`terms`, `tools`, `rules`, `cognitive`, `rl`, `dialogue`, `drives`, `imagination`.

**`types.ts` is not the contract in every one of them.** In `game/`, `types.ts`
holds the *component* vocabulary (sensors, actions, rewards) and `Game.ts` holds
the game contract. Check which is which per directory before moving; the
mechanical move is only mechanical once the target is right.

### 7.2 §3.1 `registerRuleGraph`

Unchanged. The catalogue is still not the single declaration of every built-in.
Registry-mediated, so it does not violate the North Star — but it is a second
place a built-in is named, and `game/registry.ts` is now a third kind of the
same thing.

### 7.3 §3.2 the hermetic seeded run

Unchanged, and now sharper. `deps:direction` gave us the vocabulary: a
`RandomSource` threaded through `NARConfig` is a *seam*, not a parameter, and
the bags that sample from it are the ones that must take it. Still a plan of its
own; still touches the parity baseline `test:load-sensitive` exists to protect.

### 7.4 §3.4 the cognitive-parameter file loader

Unchanged. `replay.ts` accepts `cognitiveParams` and resolves the attention
model correctly; the only thing missing is a file the CLI can read.

### 7.5 §3.6 / §3.7 recorded, not scheduled

Association provenance (a `Link` field with no reader) and a third
`AssociativeMemory` kind (a feature). Both still correctly declined.

### 7.6 §3.8 the three measurement debts

Unchanged — all three still blocked on the same thing, an install at a past
commit.

### 7.7 §4.4 `nar/src/nar.ts` at 846 lines

Unchanged. The `game/` move does not touch it; the construction and the wiring
are still one file.

### 7.8 §4.6 two flaky tests

Still flaky, still pre-existing, still outside the `test:load-sensitive` tier.
`tests/nar/todo26-cognitive-agent.test.ts` and
`tests/nar/rl/parity/stress-boundary.test.ts` — confirmed again on a clean stash
of this work's tree. A third turned up during this pass and also passed in
isolation on both sides of the change: `tests/nar/bag-fidelity.test.ts`
(chi-squared at 50k samples under full-suite load).

**The pattern is now three files and one job.** The fix is to add these to the
`test:load-sensitive` set so they run isolated in CI, which is the pattern
`ci.yml` already has for four other files. That is a small, mechanical change
worth doing before more load-sensitive tests accumulate.

---

## 8. New improvement opportunities

Surfaced by the work, not in the original plan. In rough value order.

### 8.1 `core` still depends on `nar` and `io` — the largest remaining inversion

`core` is the layer *below* `nar` and it imports from it, in two places, for a
reason that no longer reads: `core/agent/index.ts` re-exports nar's
`createCognitiveAgent`, and `core/concept-graph.ts` imports `serializeTerm`.
Both are small seams:

- `createCognitiveAgent` is a NAR-level factory with no business in core's agent
  barrel. Moving it under `nar/src/agent/` and leaving a thin type-only
  re-export is most of the work.
- `serializeTerm` is a pure Narsese serializer with no NAR dependency of its
  own. It belongs in `util` beside the rest of the term primitives.

Removing both takes `ALLOWED_UPWARD` from three entries to one, and the last
one (`core → io`, the ledger in `SessionManager`) is a genuine cycle waiting to
happen. **`core` being importable without `nar` is what makes the layering
claim real** — right now it is a convention with two exceptions in a script.

### 8.2 `nar/src/nar.ts` imports its logger from `core` and everything imports `core`

Not a defect — the opposite. Worth recording that the *event sink* worked:
moving a signal across a package boundary needed one 40-line module and no
consumer changes. That is the shape for any future downward signal.

### 8.3 The `exports:audit` PUBLIC_API list is now the only place a dead export can hide

Two of §1.1's six files were dead (`term-view`, `rule-descriptor`) and were
caught only because the package dissolved. The audit is a consumer check, not a
reachability check: it cannot see a subpath that has exactly one consumer which
is itself dead. Worth a decision on whether `PUBLIC_API` entries should require
a reason, the way `ALLOWED_UPWARD` and the accumulator ledger do.

### 8.4 The 27 duplicate basenames, revisited

§5 said the duplicates are worth a look only where two of them collide
meaningfully, as `similarity.ts` does. The `game/` move makes a second class
visible: `nar/src/game/index.ts` re-exported 14 impls and 9 support modules
through `export *`, so the barrel was a second, unversioned index of the whole
directory. Any directory whose barrel is a `export *` over more than a handful
of modules has the same shape. `grep -c "export \*" */src/*/index.ts`.

### 8.5 The verifier's `VERIFIER_TRUTH_TABLE` export

`verify-derivation.ts` now exports its table so the drift test can compare it.
That is safe — nothing in the engine imports it, so the verifier's proofs are
still computed without the engine's arithmetic — but it is a *value* export from
a module whose whole argument is about independence. The next reader should find
that reasoning in the file, not have to reconstruct it. It is in the JSDoc.

### 8.6 `deps:direction` counts `export … from` as a value edge

A re-export is not a runtime cycle risk in the way a call is, and the gate
currently treats `core/agent/index.ts`'s re-export of `createCognitiveAgent`
identically to `concept-graph.ts`'s call of `serializeTerm`. Splitting the two
would let the re-export case be measured separately, which matters because §8.1
is two different fixes wearing one ledger entry.
