# TODO29.a: Runtime Architecture — S/J/P over a closed core

**Version:** 3.12 · **Status:** A0–A5, A12 step 1, its `^name` retirement and §0.8.4's n-ary gap landed — A6–A11 not started · **Predecessor:** `TODO29.md` (v2.5 — superseded as an execution plan, retained
unchanged as the measurement and provenance record; §0.4 maps its sections onto this one) ·
**Successor:** `TODO30.md`, blocked on this.

**Scope: architecture and semantics. A0's instrumentation and A1's cycle closure have landed; A1
changed *when* model-backed rules exist, not what the core derives from what** (§0.8). No latency, throughput, complexity,
population-scaling or index-shape requirement appears in this document's acceptance criteria. Every
one of those is `TODO30` §1–§10, deliberately, because they are measurable only after the seams they
are measured through exist. What stays here is what is testable on the tree in its current state:
dependency direction, proposal semantics, state ownership, read purity, and declared resource
lifecycle.

> **A fresh session reads §0.1 (two minutes), then §1.2 and §1.3 (the two invariants everything else
> follows from), then §5.12 (the item summary — one command, one gate, one risk per item).** §4 row 16
> is the finding that makes A11 cheap instead of an invention, and §12's two kill criteria should be
> checked *before* anything is built. **A3 is done (§0.8.9)**, so nothing in §5.14 is unanswered
> and the queue is A6, whose dispatch order A4's re-established baselines are the reference for.
> **A3's rule queue has no producer yet** — the rule half of the protocol is specified, gated and
> tested but not reachable from a model, which is A10's job.

---

## 0. Orientation

### 0.1 The two-minute answer

| question | answer | where |
|---|---|---|
| **What am I changing?** | Where model reasoning is reachable from, and therefore which parts of the core depend on it; who owns each cycle-path quantity; what a proposal is and when it may land; whether the rule set is data or code | §5 |
| **What must result?** | A closed synchronous cycle over committed state, with S / J / P composed through one seam and one set of gates | §1, §2 |
| **What must not change?** | NAL parity, determinism, `test:hermetic`, one inference path, the six packages, the epistemic firewall | §7 |
| **How do I know it worked?** | Twelve new gates, each landing with its item and each shipped with a test proving it can fail. Seven have landed (`cycle:no-provider`, `induction:inventory`, `core:no-lm`, `memory:ports`, `attention:write-surface`, `proposal:protocol`, `terms:canonical`'s A12 form) | §10 |
| **What belongs to TODO30 instead?** | Every data-structure choice, every cost target, `k`, the index shapes, the scaling gates | §11.2 |

### 0.2 Decided, and load-bearing

| decision | where | why settled |
|---|---|---|
| The thesis is **composition**, not optionality: symbolic and model reasoning coexist in one system | §0 | the project's author |
| The cycle **never depends** on a model response for completion — a model may be called anywhere on the cycle path | §1.3 | a call-count-of-zero rule was too strict *and* passed while a real dependency remained (§4, row 5) |
| **One model-reasoning capability, two profiles**: `J` = a typed *decision* (`classify` / `evaluate`, bounded, inline) and `P` = `synthesize` (open, boundary). They are **not** in a gate relationship | §2.1 | `JudgmentQuery = ClassifyQuery \| EvaluateQuery` and `SynthesisQuery` are committed types; the primitive names and the `Noul` fold were decided in `TODO16.md` §2 and are in the code |
| A decision layer's reach over `Truth` is whether it asked about a **Belief** or a **Goal**, and its probabilities are admissible **because its calibration is measured and pinned** — not because it is a model | §2.1.1, §2.6 | the field is required on every query and proposition, enforced at the transducer and validated in the schema; isotonic calibrators with a digest-pinned `calibration-lock.json` |
| Both profiles are **optional** (the model may not be provided) and both **fail closed** | §7 inv. 14 | the author; and a judged input that cannot be judged must not be admitted unjudged |
| The rule set is **loaded data**, admitted through a port, versioned and revertable — never mutated by an import | §7 inv. 15, §5.10 | the alternative leaves the rule set as code, which makes learnability a claim about a message format |
| NARchy **winnows** rules with a predicate trie and stays interpreted; its rule set is **selected at startup** | §3.4 | stated by NARchy's author — the earlier "precompiles" reading came from filenames and was wrong |
| NARchy's data structures live in a **separate module** (`jcog`) from its reasoning | §3.4 | the monorepo layout; makes "storage is a port" a module-boundary precedent |
| Structural work precedes behavioural work | §6 | so the one attribution (A4's RL/parity baselines) is measured on the final shape |

### 0.3 What this unlocks, in the README's terms

This is a substrate plan, so it claims nothing about SeNARS being better at anything. What it does
do is make four README promises structurally true rather than aspirational, and each row is a
§7 invariant plus the item that establishes it:

| README promise | what makes it structural | item |
|---|---|---|
| "a bounded, event-sourced cognitive runtime … deterministic replay, standalone verification" | one committed state transition per admission; proposals are events, not fixtures | A3, A9 |
| "bounded priority bags, cooperative yielding, anytime algorithms … graceful degradation" | every unbounded resource has a declared owner, capacity, retention rule, overflow behaviour and pressure signal | A8 |
| "every proposer output … is judged … before it can influence state" | `J`/`P` reach state only through the kernel's four gates; the port is advisory | A3, A11 |
| "TypeScript enforces internal representational invariants at compile-time" | `Concept.priority` loses its public setter; the core's extension contract stops naming `LMRule` | A2, A4 |
| "Dynamic Neuro-Symbolic Fusion … bidirectional feedback" | bidirectional feedback is only safe once the symbolic side is closed and every return path is gated | A1, A2 |

### 0.4 Section map from `TODO29.md`

`TODO30` cross-references the old numbering. `§0 → §0 · §1 → §4 · §2 → §3.4 · §3 → §1–§3 ·
§3.7 → §2 · §4 → §5 · §4.1 → §5.14 · §5 → §0.3 · §6 → §6 · §7 → §7 · §8 → §8 · §9 → §9 ·
§10 → §10 · §11 → §13 · §12 → §11 · §13 dropped · §14 → §4, §12 · §15 → §12`

### 0.5 Open, and needing a decision before the named item

| question | blocks | where |
|---|---|---|
| ~~The in-cycle induction inventory~~ — **answered and landed with A0**; the dispositions were A1's to revise and were | A1 | §0.8, §0.8.1 |
| ~~A3's eight protocol decisions — unit of work, trigger, overflow per proposal kind, denied-batch behaviour, staleness, evicted references, versioning, cancellation~~ — **answered and landed with A3** (§0.8.9), written down in `docs/proposal-protocol.md` and gated by `proposal:protocol` | nothing; A3's own acceptance | §5.3, §5.14, §0.8.9 |
| The `J` placement order and budget across the eight candidate sites | nothing architectural; TODO30 §1 measures it | §2.5 |
| Q3's hypothesis — which arm should beat which, by how much, on which games, and what would count as "the model does not earn its place" | the plan's only falsifiable claim | §11.1 |
| Is the induction layer ever a seventh workspace package (answered for the *contracts*; the rest open) | nothing | §11.1 |
| ~~A census test asserting the core's shipped table is exactly the registered NAL rules~~ — **answered and landed with A2**; the count (55) is the committed part. Its *other* half — the table growing only through a proposal — is §4 row 14, and belongs to A10 | A10 | §11.1, §0.8.6 |

### 0.6 Next actions, in order

1. ~~**A0**~~ — instrumentation, including provider-*dependency* detection, not presence detection.
   **Done**, except for one thing §0.8 finding 1 names: the live cycle has no tick stages, so A1's
   trace criterion has nothing to read. Do that before A1, or restate A1 criterion 2.
2. ~~**§5.14 + A3's eight protocol decisions**~~ — **done 2026-10-01** (§0.8.9): the eight decisions are
   `docs/proposal-protocol.md`, `proposal:protocol` fails when the document and the code disagree, and
   the lifecycle that enforces them is wired into the seam. **Its largest remainder is that the rule
   queue has no producer** — nothing synthesises a reaction yet, so the rule half is specified, gated
   and tested but unreachable. That is A10.
3. ~~**A1**~~ — **done 2026-09-30.** The cycle stages model-backed work and pumps it off-cycle; every
   provider await carries a deadline; every model-backed rule declares and runs a symbolic body.
4. ~~**A2**~~ — **done 2026-10-01** (§0.8.6): the cycle path imports the layer zero times and
   `core:no-lm` is the gate that says so. **Not done, and now the item's largest remainder:** the
   seam contracts were *not* moved to `@senars/core/schemas` — §0.8.6 explains why the narrower
   thing was done instead and what it costs.
5. **A12** — **step 1 is done** (§0.8.2), **its `^name` retirement is done** (§0.8.3) and **§0.8.4 is
   done**: a three-premise conjunction reads back, and *readable* is now a gated property beside
   *injective*. **What is left is the reducers**, and they wait for A4's baselines (§5.12).
6. ~~**A5**~~ — **done 2026-10-01** (§0.8.7): the cycle path reaches memory through nine named
   ports, and `memory:ports` is the gate that says so.
7. ~~**A4**~~ — **done 2026-10-01** (§0.8.8): `Concept.priority` has no setter and seven named
   reasons, reads do not decay, `getGoals()` stopped minting stamps, the scorer and `Concept`'s
   second link graph are gone, and the RL/parity baselines were re-established and committed here.
   **What is left is A3's eight protocol decisions** — the only unanswered thing in the queue — then
   A6, whose dispatch order A4's baselines are the reference for.

### 0.7 What this plan is not

Not performance work, not the capability thesis, not the `lm/` internals, not UI, not NAL. §9 has
the list. Read this as the floor, not the claim.

### 0.8 What has landed

**A0 is done (2026-09-30), and A1 (§0.8.1).** A0 changed no reasoning path; A1 changed *when* a
model-backed rule exists in a cycle's life, not what the core derives from what.

| artefact | what it is |
|---|---|
| `nar/src/lm/in-cycle-inventory.ts` | the Q1′ inventory as data: 7 behaviours with dispositions and a *noticedBy* column, the cycle path as a declared prefix list, and the three cycle-path value imports attributed to behaviours |
| `nar/src/lm/provider-seams.ts` | the three cycle-path awaits on a provider, each with the bound it has **today** (`bounded: false` for all three) and the `file:line` + text it must still hold |
| `scripts/lib/induction-inventory.ts` | pure verdict logic: an unaccounted cycle-path import, a dead call site, an unattributed or undeclared behaviour |
| `scripts/lib/provider-dependency.ts` | the **symmetric** rule: a seam declared bounded must not block, a seam declared unbounded **must** block, and a probe that was never entered fails |
| `pnpm induction:inventory` | the gate, plus the census it prints |
| `pnpm cycle:no-provider` | drives a never-resolving provider through every declared seam, using the real `LMRule` / `KernelPerceptionGate` / `StreamReasoner` |
| `tests/nar/todo29a-a0.test.ts` | 21 tests, every gate rule's failure case first |
| `docs/induction-inventory.md` | the one dated page Q1′ asks for |

Both gates were confirmed to fail by flipping a declaration, then restored — §10.1's rule, applied
to the gates themselves.

**Three findings the instrumentation produced, none of them in §4:**

1. **The live cycle has no tick stages.** `nar/src/tick/` declares the canonical vocabulary and
   *nothing in production calls it* — the only callers are four test files. `NARExecution.run` records
   free-form `PhaseTimer` categories. So §5.1's acceptance criterion 2 ("no `propose`-stage work
   inside a `reason` stage") is about a pipeline this tree does not run. **A1 cannot assert it until
   the live cycle has a stage vocabulary, which is now A0's second job and is not done.**
2. **The cycle path's dependence on the layer is already mostly data.** 14 edges into `nar/src/lm/`
   from the cycle path: 3 values, 11 types. `RuleProcessor` — the one place the cycle applies a model
   rule — imports `LMRule` as a **type only** and takes instances through `registerLMRule`. This is
   §4 row 9's positive half, and it is why A1 is a wiring change rather than a rewrite.
3. **The circuit breaker bounds failure count, not time.** `LMRule.executeLM` wraps
   `tryGenerateText` in `CircuitBreaker.execute`, whose `resetTimeoutMs` governs a half-open probe
   and not an in-flight call. So the `lm-rule-apply` seam hangs on a provider that never resolves,
   exactly as declared — and the probe confirms it rather than inferring it.

**Improvement opportunities the instrumentation exposed, none of them blocking A1:**

- `CYCLE_PATH_PREFIXES` is a hand-maintained directory list. It is the right size today (12 files),
  and a file moving into or out of the cycle path silently changes which edges need attribution. A
  `deps:direction`-style manifest keyed on the *cycle* rather than the layer would make it derived.
  Deferred: the list is short, and a wrong derived answer would be worse than a short list.
- `ProviderSeam.callSites` is `file:line` plus a substring, which is a reference that can rot. The
  gate catches rot; it cannot catch a line moving *and* the substring travelling with it, because
  that is indistinguishable from the seam moving.
- The census prints; it does not store. Nothing commits the counts, so a regression from 3 value
  imports to 5 is visible in review but not in CI.

### 0.8.1 A1 is done (2026-09-30)

The cycle no longer awaits a model, and every provider await on any path carries a deadline. What
changed is **when** a model-backed rule exists in a cycle's life, not what the core derives from what.

| artefact | what it is |
|---|---|
| `nar/src/proposal/cycle-trace.ts` | the stage vocabulary the live cycle lacked (§0.8 finding 1). `NARExecution.run` now runs `perceive → attend → reason → authorize → propose → learn`, using `tick`'s stage names, and records each region; `findStageOverlaps` / `findInCycleProposals` are the pure predicates the tests read |
| `nar/src/proposal/lm-rule-producer.ts` | `LMProposalProducer` — the cycle's only route to a provider. Stages into the `StreamReasoner`'s bounded queue, pumps it without being awaited, drains settled derivations at the next `authorize` stage |
| `nar/src/stream/reasoner.ts` | the seam, generalised as far as it needed to be: `gates` are **injected** (the process global is gone), one flush is bounded by `backendTimeoutMs`, overflow is **drop-newest** with a counter, and a request may carry its own `derive` so a producer needs no second queue |
| `nar/src/rules/impls/processor.ts` | `stageLMRules` (synchronous, the cycle's half) and `applyLMRules` (the off-cycle half); `stepScalars` deleted rather than invalidated |
| `nar/src/lm/rule/LMRule.ts` | `callTimeoutMs` on every provider call, and `hasSymbolicFallback` — the declaration the gate reads |
| `nar/src/kernel/KernelPerceptionGate.ts` | `judgeTimeoutMs`, and a **timeout that takes the same fail-closed path a fault takes**. Unjudged admission on expiry is not a degradation, it is a bypass of the injection veto |
| `scripts/rule-fallback.ts`, `scripts/gates-one-cycle-path.ts` | two new gates; both wired into `pnpm gates` |
| `tests/nar/todo29a-a1.test.ts`, `tests/nar/todo29a-model-matrix.test.ts` | A1's acceptance, and the four configurations |

**Three decisions §5.13 did not pre-answer, made here.**

1. **Unit of asynchronous work** — one premise pair, applied by one rule selector pass. That is
   `processLMRulesImpl`'s own granularity, kept, because it is the unit the rules were written for.
2. **Trigger** — the `propose` stage of every cycle calls `pump()`, which is a no-op when the queue is
   empty. "Cycles per proposal" is therefore governed by how much work the cycle *stages*, which is
   the derivation rate — one `stageLMRules` per premise pair, bounded by the queue's `maxPending`.
3. **Overflow** — drop-newest, in the seam, counted in `stats().dropped`. The queued requests already
   paid for their place; dropping them would refund a decision the system acted on.
4. **A denied batch (budget refused)** — re-queued at the head and trimmed, which is the pre-existing
   behaviour and is now the only path that can grow the backlog. It raises no `backpressure` reason of
   its own; the budget gate already records `budget.exhausted` with `llm-budget`, which is A7's
   vocabulary rather than a second one.
5. **Staleness** — a proposal is applied at the **next** `authorize` stage, not whenever it arrives.
   This is the decision that keeps the cycle closed, and it is now structural rather than a comment:
   `pumpProposals` is not awaited and `takeDerived` is only read in `authorize`.

**Two things A1 found that are not in §4:**

- **A configured `J` is not yet functional.** With System One enabled and no calibrated heads,
  `SystemOneIngressJudge` abstains, so `config:model-matrix` shows the `J` configurations *refusing
  ingress* rather than admitting it. That is D1 working — the alternative is admitting unjudged input —
  but it means §2.6's four-way invariance is asserted on the `P` axis today, and on the `J` axis only
  once a judge that admits exists. Recorded in §11.1.
- **`hasStructuralSimilarityNoOverlap` can never be true.** It asks for symbol-bag similarity above
  0.6 *and* no shared symbol; a non-empty intersection is a precondition of a Jaccard score above 0,
  so `lm-analogical-reasoning` never activates (`nar/src/lm/rule-selectors/connectivity.ts:17`). This
  is §4 row 7's shape — a condition that documents an intent and cannot fire — and it is a layer
  concern, so it belongs to A2 rather than here.

**One correction to §7 invariant 1.** There is no `tests/nar/nal1-rules` file. The suites that exist are
`nal2-copula`, `nal7-temporal`, `nal8-procedural`, `nal9-self`, plus `todo17b-nal-arm` — so "NAL parity"
has meant four files for several passes, and A12's gate has to say which four.

**Notes for A1 (superseded by the above, kept because §0.8's findings are the record):**

**Notes for A1:**

- The three seams are named and probed. A1's work is to make `bounded` true on `lm-rule-apply` and
  `ingress-judge`, which turns `cycle:no-provider` into §1.3's invariant with no new gate and no new
  file. `stream-reasoner-backend` becomes bounded as a consequence of A1 step 3.
- **`ingress-judgment` is `synchronous` by design and must not be moved.** Judging a precondition of
  admission is gating, not learning. A1 step 7 adds a *timeout*; it must not relocate the judge.
- A1 acceptance 4 ("a proposal cannot affect state before the declared application boundary") needs
  a stage vocabulary on the live cycle — see finding 1 above. Either introduce one on
  `NARExecution` (small: the `PhaseTimer` categories are already per-step labels), or restate the
  criterion against `PhaseTimer`. Restating is cheaper and says less; introducing one costs A0 work
  that A1's own acceptance depends on.
- `IN_CYCLE_INVENTORY` gains a row the moment `DefaultDerivation` stops calling `processLMRules`:
  `lm-rule-derivation` moves from `synchronous` to `boundary`, and the gate will fail until it does
  not, because the attribution's file no longer imports the layer. That is the gate working.


### 0.8.2 A12 step 1 is done (2026-09-30) — `7cef8635`

The operator table, the grammar and the serialiser are one surface form, every
kind round-trips, and the round-trip generator is derived rather than written
down. §4 rows 19–21 are what it cost. **"Every kind round-trips" is true of the
kind shapes and false of the grammar** — §0.8.4 is the hole, and §0.8.3 is the
remaining half of this step.

| artefact | what it is |
|---|---|
| `nar/src/terms/operators.ts` | `OPERATORS[k].symbol` is **the Narsese spelling** — `==>`, `&|`, `=/>`, `=|`, `&/`, `{`, `[`, `,`, `^` — and the kinds named `instance`/`property` are `setExt`/`setInt`, the names Narsese and the grammar already used |
| `nar/src/terms/narsese.peggy` | one token list (`OperatorToken`) behind both syntactic positions; `INFIX_KINDS` holds canonical spellings only and `LEGACY_KINDS` the older ones (`&&`, `||`, `=>`, `,/`), and an unmapped operator is a **parse error** rather than a kind |
| `nar/src/terms/impls/serialize.ts` | derives every spelling from `OPERATORS`; **dense** — `(a-->b)`, `(a&b)`, `(a,b)`, `(a&/b)` — and always parenthesises an operation's arguments |
| `nar/src/terms/impls/factory.ts` | `tuple` is gone: the comma copula is `product`, and the grammar splats it. A one-member variadic compound **is** its member |
| `scripts/terms-canonical.ts`, `pnpm terms:canonical` | the gate: every kind round-trips, the grammar names no kind the table lacks, every table symbol is in the token list — wired into `pnpm gates` and `ci.yml` |
| `tests/nar/property/narsese-roundtrip.test.ts` | one arbitrary per `OPERATORS` kind, plus the grammar-agreement property |

**Five decisions this step did not pre-answer.**

1. **Canonical Narsese is dense.** `(a-->b)`, `(a&b)`, `(a,b)`, `(a&/b)`, `(f^(x))` — for bytes, as §5.12.1 said, and this is the commit that spends them.
2. **An operation is an operator atom and its arguments as a product**: `f^(x)` is one argument, `f^(x,y)` and `f^(x,y,z)` are several. `operation` stays a **binary** kind whose right side is the product, so `procedural.ts` and nal8 keep `args[0]`/`args[1]` and no one-member product is ever built.
3. **`f(x,y)` and the legacy `^f(x,y)` parse to that term and are never written** — accepted-and-never-emitted, which is the same tie-break §5.12 uses for negation's two spellings.
4. **`^` is an operation sigil, not an atom character.** Without that, `(a^b)` read as one atom named `a^b`; without a `OperationAtom` rule, `^move_north` stopped being an atom at all. Both exist, and the gate catches either regression.
5. **A one-member variadic compound is its member**, which is the Java reference's `InterCONJxt_to_one` generalised. This is the first §5.12 reducer to land: it is not optional, because `(a)` parsed to a one-argument `product` that printed as `a`, and the round trip then produced a different term.

**Two things step 1 found that are not §4 rows 20–21.**

- **A canonical form is now injective, so `toString` is an identity.** `tests/nar/unit/term-identity.test.ts` used to record the opposite — three structures printing alike, held apart only by `termKey` — and rule 5 removes the collision. The test was rewritten to the stronger property: no two distinct terms print alike. **That is worth stating as a §7 invariant**, because every persisted key built from a printed form depends on it.
- **`docs/java/Op.java` settles nothing about operations.** There is no `OPERATOR` and no `^` in `NarseseParser`; the reference's `buildCompound` default arm is `op(op).the(x)`, an operator built from its token. So `^op(…)` was always a SeNARS-local convention and the spelling question was ours to answer, not inherited.

**Improvement opportunities, none blocking.**

- The grammar's token list is still hand-written, and the gate checks agreement rather than generating it. Peggy can take a `--dependency`, which would let the initialiser import `OPERATORS` and make the token list derived — **not done**: peggy's initialiser counts braces naively, so the `{` and `[` wrapper symbols cannot appear in it at all, which is why `LEGACY_KINDS` and `INFIX_KINDS` are checked rather than shared.
- ~460 test literals moved to dense form in one sweep, rewritten by a script that only substituted where the parser proved both spellings equal. **The script was deleted** rather than committed; the gate covers the property it was checking, and a second copy of the densifier is a second source of truth about the canonical form.
- `nar/src/drives/impls/DriveManager.ts` and `bootstrap.ts` build Narsese by hand, so two of them still had padded spellings after the sweep. **Any remaining hand-built Narsese in `src/` is a place the dense form has to be remembered by hand**, and the round-trip gate only sees what goes through a term.

### 0.8.3 The `^name` retirement is done (2026-10-01)

A tool goal is the `operation` term `tool(args)`, recognised by `kind`, and `^tool` is a **parse error**. `f(x,y,z)` is shorthand for `(f^(x,y,z))`; `f()` is `(f^())`, the 0-ary product.

| artefact | what it is |
|---|---|
| `terms/impls/operation-term.ts` | `operationTerm` builds an `operation`; `readOperationTerm` reads one; **`operationNameOf`** is the recogniser every goal reader now shares. `OPERATION_MARK`, the `^name` atom and the `'true'` empty-args sentinel are gone — no args is `TermBuilder.product()`, the 0-ary product, and the decoder recognises that term rather than a string |
| `terms/narsese.peggy` | `OperationTerm`, `OperationAtom`, `OperationName`, `OperationArgs` and `OperationArg` are **deleted**. `f(x,y)` was already the reader's arm; `^f(...)` no longer exists. `^` stays out of every atom character class, so `(a^b)` is still an `operation` |
| `nar-execution.ts` | `isToolGoal` is `operationNameOf(term) !== undefined` |
| `focus/Focus.ts`, `tools/impls/goal.ts`, `tick/bindings.ts`, `gates/tasks.ts`, `rules/impls/meta-rules.ts` | read the operation, or are callers of the one encoder |
| `rl/impls/adapters/{action,agent}.ts`, `scripts/rl-parity.ts` | an RL action label is `operationTerm(name)`, not `Atom('^name')`. `action.ts` selects a pending goal by **reading the operation** (`topPendingOperation`) and an arm by `this.actions.indexOf(...)`, not by a regex over the printed form |
| `task/classify.ts` | reads the operation's name instead of an atom's sigil |
| `nl/firewall.ts` | **the mint pattern moved.** `/\^[\w-]+/` matched the sigil, so with `^` unparseable it would have waved through every `tool(args)` the model writes; it is now `/[\w-]\s*\(/`. The predicate whitelist exempts an operation's callee **by structure** (`visitTerms` + `operationNameOf`), which is what the sigil used to express |
| `game/meta-spec.ts` | `describeMetaGameActions` emits `focus_weight(f1, 0.8)`. These are the strings a model is asked to emit, so they are in the surface syntax, and the sigil is no longer part of it |
| `tests/nar/property/narsese-roundtrip.test.ts` | the generator's arguments are **compounds**, not only atoms (§0.8.4) |
| `scripts/terms-canonical.ts` | a fourth rule: **`operationTerm` round-trips** at 0–3 arguments. The per-kind check builds `operation` out of atoms, so it says nothing about the encoder the tool layer actually calls |

**Six decisions this step did not pre-answer.**

1. **`^f(...)` is deleted rather than accepted-and-never-written.** §5.12.1 decision 3 chose "accepted and never written", the same tie-break it uses for negation's two spellings. The author overruled it: the form is nonsense, so a reader that still accepts it is a reader with a second grammar. **It is now a parse error**, which is the strongest mechanism the language has for "this is not a spelling".
2. **No arguments is the 0-ary product, not `true`.** `f()` and `(f^())` already agreed on `TRUE` — the factory's identity for `product()` — while the encoder used a lowercase `true`. That is two spellings for one idea inside one commit, so `NO_ARGS = TermBuilder.product()` and the decoder compares *terms*. It also fixes a latent bug: `^tool()` used to decode to `{ arg0: '*' }`, not `{}`.
3. **A compound argument needs its own parentheses**, in the shorthand as well as the canonical form: `move((left-->dir),(3-->steps))`. `(dir-->left,steps-->3)` is not a term (§0.8.4), so the bare comma list cannot appear as an argument list.
4. **The serialiser needed no change**, despite a promising-looking hole. `serializeOperation` was already correct: each member is serialised with its own parentheses, and `operationTerm` nests its arguments in inheritances, so a product of inheritances never needs a bare-statement list. I diagnosed this backwards, added a `BareStatement` rule for it, and removed it — `nar/src/terms/impls/serialize.ts` is untouched.
5. **A malformed `META_GOAL_BY_DRIVE` literal now throws** instead of logging a warning and dropping the drive (§0.8.5).
6. **The two RL selectors dropped a regex over a printed form.** `GridWorldSelector` matched `/move_(up|right|down|left)/` against `bestAction.toString()`, which only worked while the printed form carried the sigil.

**One correction to §0.8.3's own hazard list.** It named six readers that sniff `startsWith('^')` and predicted they "keep passing if the filter merely returns nothing". Nine did. Two of them were worse than predicted, and both are now kind tests:

| site | was |
|---|---|
| `no-bypass`, `goal-action` ×2, `self-improvement-litmus`, `belief-perception`, `diagnostic`, `nar-execution.ts:442`, `self-report.ts`, `self-improve-demo.ts` | `toString().startsWith('^')` or `.includes('^pull_arm')` |
| `bandit-epsilon-greedy`, `cognitive-advantage` ×4, `stress-boundary` | `toString().includes('^pull_arm')` |
| `goal-action.test.ts` | asserted `kind === 'inheritance'` and `predicate.symbol === '^move_to'` — the *old* term, as the contract |
| `reward-belief.test.ts` | asserted `['^move_north', 'state_s_3_4']` from a product's members |

The gate was **the four NAL parity suites plus `terms:canonical`**, as §0.8.3 said, and it is not sufficient on its own: two of the failures were in `todo5b-phase1`, `nar-execution` and `cognitive-advantage`, none of which is a parity suite. `pnpm test:unit` is what says goal recognition did not move, because **all of the readers are the thing being changed**.

### 0.8.4 The gate's blind spot: no n-ary statement can be read back

Found by the generator change in §0.8.3, and **older than this gate and unrelated to operators**: a bare operator chain is not a term.

```text
(a&b&c)      PARSE FAIL      conjunction, three members
(a&|b&|c)    PARSE FAIL      parallel, three members
(a&/b&/c)    PARSE FAIL      sequence, three members
((a&|b&|c)-->d)  PARSE FAIL  and therefore anything nesting one
(&,a,b,c)    => (a&b&c)      the prefix form read fine all along
(a,b,c)      => (a,b,c)      product: the comma copula has its own rule
(a-->b)      => (a-->b)
```

**Any conjunction of three or more premises — the ordinary shape of an NARS derivation — serialises to text its own grammar refuses.** Note the asymmetry: the *prefix* form `(&,a,b,c)` was readable at every arity and nested inside a statement, a negation and a set, so **the reader was never the broken half.** Nothing in the tree noticed, because terms are built in memory and the printed form is rarely re-read.

The cause is structural. `Term` reaches a statement only through `Statement`, which requires a leading `<` or `(`; `CompoundTerm`'s product arm is `"(" TermList ")"` and `TermList` holds `Term`s, none of which can be a bare `a&b&c`. So the chain stops at the first operand and the rest is left over.

**Status: DONE (2026-10-01), with its own gate. The fix was in the serialiser, not the grammar.**

**Narsese spells an n-ary copula two ways, and they are not interchangeable:**

```text
(a&b)          infix — valid for TWO members only
(&,a,b,c)      prefix — the n-ary form, any arity >= 3
(a,b,c)        product: its copula IS the comma, so this is already its prefix form
```

`docs/java/NarseseParser.java` draws the line itself: `CompoundInfix` is exactly
`Term() op Term()` — two terms, one operator — while `MultiArgTerm(..., initialOp, ...)` reads the
operator first and then a comma-separated list. **The repeated-infix form `(a&b&c)` is not a third
spelling, it is a malformed one.** So the defect was that **`serialize` emitted it**: a three-premise
conjunction — the ordinary shape of a NARS derivation — was written in a form the reader refused.
The fix is `PREFIX_ARITY_THRESHOLD` in `serialize.ts`: two members stays infix because it is shorter
and it is what Narsese authors write, three or more takes the prefix form.

| artefact | what it is |
|---|---|
| `terms/impls/serialize.ts` | `PREFIX_ARITY_THRESHOLD` — the whole fix. `product` is exempt, because its copula is the comma |
| `scripts/terms-canonical.ts` | a fourth rule: **a canonical form is readable**, not only injective |
| `tests/nar/property/narsese-roundtrip.test.ts` | cap lifted to 2 levels x 3 members, variadic kinds at every arity |

**Two decisions this did not pre-answer.**

1. **The reader gets no new rule.** The prefix form already read back at every arity and nested inside
   a statement, a negation and a set — so the honest change is one line in the writer. Adding a
   `BareStatement` rule to accept repeated infix would have made the gate green while leaving the
   serialiser emitting terms upstream cannot produce, which is §5.12.1's "accepted and never written"
   in its worst form: **accepting our own mistake and calling it a grammar feature.**
2. **The gate compares the term, not only the text.** `roundTrips` asserts `serialize(read) === text`
   **and** `termsEqual`, because a fold that differs from the canonical form round-trips as text and
   is still a different term. It also asks a binary kind for one arity and a variadic kind for three:
   asserting `implication` at 4 members tests a term `createCompound` accepts and the serialiser
   silently drops.

**One correction, and it is about a test rather than the grammar.** `strategies.test.ts`'s "should
decompose conjunctions into components" **had never asserted anything.** It ran two `if` branches and
neither was reachable, because `(&, a, b, c)` produced no concepts at all — so it passed vacuously
through many passes. Once the conjunction existed the assertion ran for the first time and failed,
because decomposition maps a conjunction's arguments to their *concepts' beliefs* and no member had
one. Fixed by asserting the members first, and the test now asserts `toHaveLength(3)` and the exact
members. **A test that cannot fail is the same defect as a gate that cannot fail**, and this one had
a green tick the whole time.

Two knock-on facts now settled:

- The round-trip property is capped at **two levels of nesting and three members**, and the cap is named in the test as `MAX_DEPTH` / `MAX_ARITY`. It is no longer hiding a hole; it is where the property stops being about canonical form and starts being about the parser's stack.
- §0.8.2's claim that "a canonical form is now injective, so `toString` is an identity" is **true of `termKey`, not of the grammar**. Restated as two invariants, and now both gated: *a canonical form is injective* (`termsEqual` in `terms-canonical`) and *a canonical form is readable* (the new rule).

### 0.8.5 The failure mode the retirement was built to catch, caught

`nar-execution.ts` built its meta-goal table by parsing two narsese **literals** at module load, inside a `try` that warned and returned `[]`. When `^switch_strategy(...)` stopped parsing, both drives were silently dropped, the whole system ran with no meta-goal injection, and **every test still passed** — because a filter that matches nothing and a filter that was removed look identical from the outside. It surfaced only because `nar-execution.test.ts` was converted to `operationNameOf(t.term) === 'switch_strategy'`; the other five converted readers had the same shape and none of them failed.

It now throws. A literal in that file is a constant, so it is either right or a build break, and a boot-time throw is the strongest mechanism available for a constant.

**It happened again, one commit later, and that is the finding.** §0.8.4 closed the n-ary gap, and
`pnpm test:unit` surfaced `(^apply_fix-->patch)` being **allowed** by the firewall: the chain made
`apply_fix-->patch` a legal argument, so the retired empty-head `^` sigil parsed again — as a
one-argument `operation` that serialises to the empty string. The firewall counts a parse failure as
blocked, so making a parse *succeed* silently flipped a security assertion from true to false, and the
only reason it was caught is that the round-trip gate was run in the same breath. **A filter that
matches nothing and a filter that was removed look identical from the outside — and a filter that
*used* to match nothing and now matches something looks identical to a filter that works.**

**The generalisable finding.** §0.8.3 predicted this exact failure and named the files; what it did not predict is that the *prediction itself* was not the mitigation. Converting the readers is necessary and was not sufficient — the string literals the readers were matching against had to be found separately, and nothing in the compiler or the gates connects a literal to the parse that will reject it. **A rule that would have caught this: every narsese string literal in `src/` is parsed by a gate**, which is the natural companion to §0.8.2's note that `DriveManager.ts` and `bootstrap.ts` build Narsese by hand.

**Improvement opportunities from §0.8.4, none blocking.**

- **`&&` and `||` are still unreadable**, and always were: `(a&&b)` was a parse failure before this
  change too, so `LEGACY_KINDS` advertises four legacy spellings of which only two (`=>`, `,/`) can
  actually be read. Either the grammar accepts them or the table stops claiming them — a documented
  compatibility that does not work is worse than a rejected one.
- **The grammar is hand-regenerated.** `npx peggy -o …` is not in `package.json`, so nothing fails if
  the grammar and the committed parser disagree. A `terms:grammar` script would make that a build
  step; the plan's §10.1 rule applies and the gate cannot see it.
- **One parser, two readers, one gate.** `terms-canonical` (the gate), `narsese-roundtrip.test.ts`
  (the property) and `scripts/generate-architecture.ts` each read the grammar differently. Three
  readings of one file is three chances to disagree.

**Improvement opportunities, none blocking.**

- `meta-rules.buildOperationTerm` passes `arg.toString()` as an *argument value*, so `(focused-->x)` becomes the sanitised atom `_focused_x_` and is re-parsed as a string, never as a term. `operationTerm` should take terms for compound arguments, or the rule should build the operation directly. The arg is round-tripped as text today and the tool receives a mangled name.
- `OPERATOR_PATTERN` in the firewall is now `/[\w-]\s*\(/`, which blocks any `f(...)` in LLM input. That is the intent, but it also blocks a *quoted* atom inside an otherwise legitimate statement. Cheap to narrow (require the call to start a term), not done.
- The `^`-sigil form has no deprecation story now that it is a parse error: a persisted goal written by an older build will not read back. Nothing in the tree persists a goal term across versions today, and `termParser` failure is already loud, so this is a note rather than a migration.

### 0.8.6 A2 is done (2026-10-01) — the cycle path reaches the layer through four capabilities and a gate

The induction census now prints the sentence A2 existed to make true: **"Of the cycle path: 0 edges
across 0 files — 0 values, 0 types."** Nine cycle-path imports went to zero, and the remaining 49
value imports across 17 files are all assembly.

| artefact | what it is |
|---|---|
| `rules/types.ts` | **`ModelRule`** — id, name, category, priority, `condition`, `hasSymbolicFallback`, `canApply`, `apply`, `getStats`, `setEventBus`, `enable`, `disable`. What the cycle needs of a model-backed rule, in core vocabulary. `ModelRuleWork` / `ModelRuleWorkSink` replace `LMRuleWork` / `LMRuleWorkSink` |
| `ports/text-generator.ts` | **`TextGenerator`** — one method, `generateText(prompt, opts?)`. `LMService` satisfies it structurally; a caller cannot demand an argument the core has no vocabulary for |
| `memory/embedding.ts` | **`EmbeddingRuntime`** + `EmbeddingRuntimeSource`. The embedder takes a source *function*; it no longer reads provider settings |
| `lm/embedding-runtime.ts` | the only module that answers one. `nar.ts`, `facade/system-one.ts` and `src/bin/lib/lifecycle.ts` bind it |
| `lm/correction.ts` | `attemptLMCorrection` moved here from `cognitive/impls/analyzers/`. It is a provider call under a layer-owned grammar, and it had no production caller |
| `util/src/utils/json.ts` | `extractJsonObject` / `parseJsonObject`, moved out of `lm/json.ts` because they are pure. The zod half stayed, re-exporting these |
| `scripts/lib/layer-boundary.ts` | the rule, once: what is on the cycle path, what resolves into the layer, and what the violation reads like |
| `scripts/core-no-lm.ts` | **`pnpm core:no-lm`** — six kinds of import fail, no type-only exemption |
| `tests/nar/todo29a-a2.test.ts` | 18 tests: each rule failing first, plus the census |

**Five decisions this item did not pre-answer.**

1. **`enableLMRules` is gone, and "no model rules" became "no provider".** The flag gated
   *execution* while the layer was always constructed and registered — §4 row 13's finding, 33
   inducer invocations per cycle *with the flag off*. A `NARConfig` boolean that reads as "no model
   reasoning" and means "model reasoning that runs and answers nothing" is the exact defect §9 lists.
   Three places had to answer for what it used to say:
   - **`NARBuilder`'s `lmRules` capability now *requires* `withLM()`**, on the `BuilderError` path
     `self` and tier-2 System One already took. A profile claiming model rules without a provider is
     a profile that is wrong, not a build that quietly derives less.
   - **The S/J/P matrix drives `P` with whether a provider is registered.** Which is what `P` was
     standing for; the flag was a proxy for it.
   - **The no-bypass contract asserted `config.enableLMRules === false`.** It now asserts the absence
     it meant: no provider, and `getModelRuleStats()` empty.
   `LMConfig.enableLMRules` in `cognitive-parameters.ts` and the deprecated shadow `NARConfig` in
   `util` were both unread — deleted, not mirrored.
2. **`TextGenerator` is one method, and that is the whole argument.** `LMService` has `getModel`,
   `generateObject`, `stream`, routing and a usage ledger, none of which the cycle path wants and all
   of which the core would then be typed against. Structural typing means the extra members cost
   nothing and the *port* cannot grow them: adding `generateObject` to `TextGenerator` is a decision
   someone has to defend.
3. **The embedding runtime is injected as a *function*, not a value, and its absence is a
   deliberate `provider: 'none'`.** Two reasons, and the second is the dangerous one. A function, so
   a settings change between two embeddings is picked up without rebuilding the generator. And the
   default must be *no provider*: `Memory` constructs an `EmbeddingLayer` by default, so a default of
   `'transformers'` would make a bare `new Memory()` pull a second heavy runtime into the process —
   which is exactly the failure §0.8.4's embedding note describes. The core now degrades honestly to
   `MockEmbeddingGenerator` and `nar.ts` binds the real one.
4. **The census is a test, not a script.** `RuleRegistry` is populated by a module side effect, so
   an out-of-process scan could only see the table by importing it — at which point it is a test. It
   asserts the registered set equals the declared set, that the count is **55**, and that every rule
   declares a truth function and a priority. The count is the committed part: a rule arriving is a
   decision, and a decision in an array literal is easy to miss and hard to argue about afterwards.
   *A10 removes the side effect and this can move to a script.*
5. **The registry slot keys stayed `lmRule` / `lm-rule`.** A2's blast radius said the strategy slots
   change together with the README's five-category table, and it would have been ~40 more sites:
   `cognitive-parameters.ts`, `CognitiveRegistry.SLOT_KEY`, `src/config/schema.ts`,
   `senars.config.json`, the agent capability surface, `dialogue/impls/consumers/adapt.ts`, and the
   README table. Those are *configuration* vocabulary about a model's rules — a user's word, in a
   user's file — and renaming them buys no boundary. **The contract is `ModelRuleSelector`; the slot
   a user configures is still `lmRule`.** Deliberately left, in this commit, with the reasoning.

**What is not done, and it is the item's largest remainder.**

- **The seam contracts did not move to `@senars/core/schemas`.** §5.2 named `@senars/core/schemas/proposal`
  as the home for `Proposal` / `ProposalSource`. What landed instead is narrower and, I think, better
  for the cycle: `ModelRule` and `ModelRuleSelector` in `nar/src/rules/types.ts` and
  `nar/src/strategies/types.ts`, `TextGenerator` in `nar/src/ports/`. Three reasons.
  **(a)** `Proposal` *already* has its contract, and it is in the core: `nar/src/stream/reasoner.ts`
  owns `LMRequest` / `ProvisionalBelief` with the provisional-truth discipline, the declared overflow
  policy, the deadlines and the two bounded ledgers — and §5.2 itself says "generalised **in place**
  rather than duplicated … it does not get a second class." Moving it to `core/schemas` would have
  been the second class, in a different package. **(b)** `core` is a *different* system (§11's
  Agent / SessionManager / bridge), and a proposal is NAR vocabulary: `RuleInput`, `Stamp`, `Term`.
  Importing it into `core` would force `core` to know the terms its own package does not have.
  **(c)** Nothing was blocked: the gate is a scan of `nar`, and `core`'s own imports are already
  `util` + its own schemas, checked by `deps:direction`.
  **So the acceptance criterion is met in substance (no layer type appears in a core extension
  contract) and not in letter (the contracts are in `nar`, not in `core/schemas`).** Recorded rather
  than quietly dropped. If `core` ever grows a proposal consumer, revisit it.
- **"Green with the layer's directory removed from the build graph" is met as *cycle-path structural
  independence*, not as literal directory removal.** `nar/src/index.ts` re-exports `createLMService`,
  `LMRule` and the System One surface, and `src/bin/**` imports those by subpath. Deleting
  `nar/src/lm/` would therefore break the *assembly* — which is the correct shape, and is also why
  the honest claim is the narrower one. What is proven: a cycle-path module cannot reach the layer
  (gated), and a NAR with no `lmService` reasons green (NAL suites, `test:unit`, `test:hermetic`,
  `test:determinism`).
- **"No provider implementation can reach private core state" is not asserted.** Half of it is
  structural — a provider receives `ModelRule`-shaped data and a `GateRegistry`, never a closure over
  NAR internals — but `facade/system-one.ts` hands the layer a live NAR, and asserting the *absence*
  of private reach needs a boundary definition the plan has not written. Left for A11, which owns
  `DecisionPort` and where the question is unavoidable.
- **The census's "grows only through a proposal" half is A10's.** The table is still registered by an
  import side effect, so nothing today could assert it.

**Three findings the item produced, none of them in §4.**

1. **The registry key and the contract type are different vocabularies and I conflated them for a
   while.** `LMRuleSelector` was both a TypeScript interface in `nar/src/strategies/types.ts` and,
   two directories over, the string `'lm-rule'` that `CognitiveRegistry` keys its slot map on. Only
   the first was a cycle-path/layer coupling. Renaming the second would have been 40 sites of pure
   churn against a user's config file. **A type and a configuration key that share a name are two
   things, and only one of them is a boundary.**
2. **Removing a flag is a distributed edit, and three of the five sites were the interesting ones.**
   The mechanical ones are the call sites. The interesting ones are where the flag had become *the
   mechanism* for something: the builder capability, the matrix axis, and the contract test. None of
   them reads as "delete a boolean" once you ask what the boolean was standing in for. **For the
   second one of those — `ModelRule` needed `category` and `condition` added** — the compiler found
   two dependencies the port had been hiding: `DiverseSelector` buckets on `rule.category` and
   `RuleGraph` matches on `rule.condition`. A contract declared from the call sites you can see is
   declared from the wrong side; these two were only reachable from the implementations.
3. **`ModelRuleStats` was already in `@senars/util`, and `LMRuleConfig` still is** — a config type for
   the layer's rule class, living in the bottom package. The rename to `ModelRuleStats` was free and
   correct; `LMRuleConfig` is the same problem one level over and is untouched. **Two types with the
   same name and opposite owners is the shape that produced §4 row 9.**

**Improvement opportunities A2 exposed, none of them blocking.**

- **`nar/package.json` needed an export for each new module and lost one** (the `corrections`
  subpath, whose only consumer was a bench script). Export subpaths 89 → 88, but the churn is a
  signal: `nar/src/lm/` is a *directory with no barrel contract*, and every module inside it that
  assembly needs is a manifest entry. `exports:barrels` passes and did not catch it, because the
  question it asks is "does every directory have a barrel", not "is a barrel reachable".
- **`IN_CYCLE_EDGE_ATTRIBUTIONS` is now an empty array with a long comment.** That is the correct
  state and a bad shape: an empty constant plus prose is a comment with a type. The rule it feeds
  (`unattributed-cycle-import`) is the part that matters and is what should have been kept. If a
  future cycle-path edge appears, the gate fails — which is the test.
- **`nar/src/index.ts` is the reason acceptance 2 could not be met literally**, and it is also the
  reason `@senars/nar/lm` is imported by subpath in eleven places across `src/bin/`. A layer
  subpath export per module is a wide public surface for a directory that is meant to be *beyond*
  the core. Worth one pass when A10 lands and the layer's public shape is meant anyway.
- **The four new capability types are exported from four different modules** (`rules/types`,
  `strategies/types`, `ports/`, `memory/embedding`) and none from one place a reader would look.
  `@senars/nar/ports` is a plausible home for all four; it was not done because `ModelRule` and
  `ModelRuleSelector` sit next to the types they constrain, and moving them would have traded
  locality for tidiness.
- **`test:load-sensitive` does not fit the budget its own docstring claims.**
  `tests/nar/rl/parity-restoration.test.ts` says "costs ~6 minutes" for three environments at
  20 seeds × 20 episodes × 30 steps. Measured 2026-10-01: it had not finished the third
  environment at **25 minutes** and was still going when the run was abandoned — each environment
  shells out to `scripts/rl-parity.ts` via `execSync`, so the cost is 3–6 sequential child
  processes. It is `slow`-tier and opt-in, so nothing red, and this is a note rather than a gate
  failure. It does mean the tier cannot be used as a pre-commit check, and §11.1's separate note
  about `todo16-batching`'s wall-clock assertion is the same tier and probably the same cause.
  **Whoever next needs it should split the file per environment** so one slow child does not gate
  the other two.
- **`scripts/lib/layer-boundary.ts` reads the inventory's `CYCLE_PATH_PREFIXES` and
  `induction-inventory.ts` reads the same file's `IN_CYCLE_EDGE_ATTRIBUTIONS`.** One list, two
  readers, no duplication — but the dependency runs *from the gate into the layer it polices*, which
  is correct (the ledger is data) and slightly unnerving.


### 0.8.7 A5 is done (2026-10-01) — the cycle path reaches memory through nine ports, and a gate says so

The finding A5 answers is §4 row 2, and the shape of the answer is the one §1.1 asks for first: a
**cycle-path module cannot import `nar/src/memory/memory.ts`**, and `memory:ports` fails when one
does. `Memory` still composes the ports and still owns the nine responsibilities; what changed is that
no consumer on the cycle path *names* it, so a widened dependency is now a red gate rather than a
review comment.

| artefact | what it is |
|---|---|
| `nar/src/memory/ports/` | nine contracts, one per responsibility: `ConceptReader`/`ConceptWriter`, `TaskAdmission`, `BeliefTable`, `GoalEnumeration`, `LinkPort`, `StatisticsView`, `SymbolIndex`, `MemoryClock`, `AttentionOwner`. Composed as `MemoryReader` / `MemoryWriter` / `MemoryPorts`, and `MemoryView` is now *composed from* them rather than redeclaring the read surface |
| `nar/src/memory/config.ts` | `MemoryConfig` and its defaults, so a port implementation can take capacity and retention knobs without importing the facade |
| `nar/src/memory/memory.ts` | `implements MemoryPorts`; `links()`, `beliefs()`, `taskCount()` added and the rest delegated. No behaviour moved |
| `nar/src/reason/inference-controller.ts` | takes `InferenceMemory = MemoryView & { attentionModel }` — the two things the cycle actually reads |
| `nar/src/task/manager.ts` | takes `TaskAdmission` and nothing else; it never needed the store |
| `nar/src/rules/impls/processor.ts`, `nar/src/learning/schema-induction.ts`, `nar/src/rules/impls/hydration.ts`, `nar/src/cognitive/impls/CognitiveController.ts`, `nar/src/nar-execution.ts`, `nar/src/memory/pressure/consolidation.ts`, `nar/src/memory/state/serialization.ts` | each names the narrowest port: `MemoryReader`, `MemoryPorts`, `StatisticsView & ConceptWriter`, … |
| `scripts/memory-ports.ts`, `pnpm memory:ports` | the gate, plus `scanCoreLayerSourceFiles` / `lineAt` in `scripts/lib/layer-boundary.ts` so the cycle-path path is read once and shared with `core:no-lm` |
| `tests/nar/todo29a-a5.test.ts` | 5 tests, and the load-bearing one is `FakeStore` — an array-backed `MemoryPorts` with no index, no archive and no `Memory` in it, driving `InferenceController`, `TaskManager` and `RuleProcessor` |

**Five decisions this item did not pre-answer.**

1. **The gate is an import ban, not a conformance check.** "Cycle code depends on ports" has two
   readings: *every consumer satisfies its port* (a type check, which the compiler already does) and
   *no consumer names the facade* (a property of the source). Only the second can fail silently, so
   it is the one that is gated — the same choice A2 made with `core:no-lm`, and for the same reason.
2. **Composition sites are declared, not inferred.** `replay.ts` must construct a `Memory`; so must
   `memory/index.ts`, which publishes it. Both are in a two-entry `COMPOSITION_SITES` ledger with
   reasons, so the set is enumerable and a third site is a decision somebody writes down. **An empty
   ledger would have been suspicious, not clean** — a rule with nothing to except is a rule nobody has
   checked against a real composition root.
3. **A directory specifier counts as naming the facade.** `'../memory'` resolves to the barrel, which
   re-exports `Memory`, so the gate matches the file, the directory and either with `.js`. My first
   version matched only `'../memory/memory.js'`, and **it passed while `inference-controller.ts`
   imported the barrel** — §0.8.5's failure mode again, in the gate I was writing to catch it. Caught
   by re-adding the violation by hand, which is the only reason it was caught.
4. **`MemoryConfig` moved before it was needed.** The port implementations cannot take capacity knobs
   without importing the facade they exist to avoid, so the config became its own module. It is a
   mechanical move that removes the first reason a port would have had to name `Memory`.
5. **`MemoryStatistics` moved to the port that produces it.** `game/types.ts` was the only other
   importer and it was importing it *through the facade* to name a shape — the storage detail leaking
   into a consumer, which is the item's own finding, in its smallest form.

**Three findings the item produced, none of them in §4.**

- **`MemoryView` was the seam, and it was also a leak.** It named `LinkManager`, `EmbeddingLayer`,
  `AssociativeRegistry` and `Focus` — four concrete types. It now names `LinkPort` and a
  `SemanticSimilarity` read surface, and reaches `links()` instead of `getLinkManager()`. **The seam
  existed and was still a coupling**, which is worth stating because §5.5 predicted the opposite:
  "the boundary is already implied by `MemoryView`". It was implied for the *facade* and not for the
  types behind it.
- **`getLinkManager()` is still on `Memory`,** because 15 test sites and `nar.ts` call it. So there
  are now two names for the same surface, and only the strategies moved. **A5's acceptance is met
  (no cycle-path module names the facade) and the god-object is still one class.** That is the honest
  state of §12's wrapper risk: the wrapper half is closed, the god-object half is A4's and A8's.
- **A test double is worth more here than the ports are.** `FakeStore` is 120 lines and it is what
  makes the ports load-bearing: every consumer below runs against an array and no index. Without it,
  "the contracts mention no concrete type" is a sentence about type declarations rather than a
  statement about what the code does.

**Improvement opportunities A5 exposed, none blocking.**

- **`Memory` is now 9 interfaces deep and still one class.** The ports make the boundary *enforced*
  and the split *declarative*; the extraction — `TermMapConceptStore`, a real `BeliefTable`, an
  archive behind `ConceptWriter` — did not happen, because §5.5's "simplest correct implementation"
  is satisfied by delegation. TODO30 §4 is where that becomes worth doing, and it can be measured
  through these ports now.
- **`Focus` is the last concrete type on `MemoryView`,** and A4 owns it: `MemoryView.getFocus()`
  returns the attention owner's object until A4 replaces it with the port A4's interface implies.
- **`COMPOSITION_SITES` is a hand-maintained file list,** with the rot risk §0.8 named for
  `ProviderSeam.callSites`. Unlike that one, a stale entry is *harmless* — it exempts a file that may
  no longer import the facade — so it fails open and never red for the wrong reason. Noted rather
  than fixed.
- **`nar/src/lm/`, `facade/`, `query/`, `tools/` and `nar.ts` still take `Memory`.** Those are
  assembly and agent-side, which is the same exemption `core:no-lm` makes, and the reason the gate is
  scoped to the declared cycle path rather than to `nar/src`. `query/memory-query.ts` is the one
  borderline case: it is a read surface with a name that suggests it should be on `MemoryView`.
- **Two of the nine port names are worse than the rest, and the fix is mechanical.** Reviewed after
  landing: `StatisticsView` → **`Statistics`** (the `View` suffix is the weakest in the set — every
  port here is a view of something) and `AttentionOwner` → **`Attention`** (§3.1 already names this
  port `Attention`, and it pairs cleanly with the existing `AttentionModel`: the port owns the model,
  the model is not the port). Four proposals were **declined**, and the reasons are the record:
  - **`LinkPort` → `Links`** — §3.1 draws a deliberate line between *port* and *index* ("`Attention` is
    an interface with a mutation surface, not an index with an update method, because 'one owner' is
    the property and 'index' is an implementation"), and the port set embodies it: `SymbolIndex` *is*
    index-shaped, `LinkPort` is a mutation surface that is not. `Links` also collides with the
    `links()` accessor that returns it, and with the `Link*` family in `memory/links/`.
  - **`GoalEnumeration` → `Goals`** — `getGoals()` returns `Task[]`, not `Goal[]`, and `Goal` is
    half the `Belief`/`Goal` epistemic firewall, so the short name points at the firewall concept and
    away from "read surface over stored goals".
  - **`TaskAdmission` → `TaskInput`** — *admission is the gate vocabulary*:
    `PerceptionGate.admitTask`, "four gates mediate every state mutation", A3's "proposal admission is
    a single committed state transition". `TaskInput` suggests a channel, and blurring that line is
    what the plan exists to prevent.
  - **`MemoryClock` → `Clock`** — the `Memory` prefix is redundant inside `memory/ports/`, but A4
    introduces `DecayClock` (§5.4) and `consolidate()` is not only decay (it is eviction, link decay
    and focus update), so `Clock` + `DecayClock` would be two clocks. A4 should name its thing
    instead.

  The general finding behind the two acceptances: **a suffix should carry information, or be
  dropped.** `TaskAdmission` (gate semantics) and `LinkPort` (not-an-index) earn their suffix;
  `MemoryView`/`StatisticsView` do not. The tree is already mixed on this — A2's ports are
  `TextGenerator`, `EmbeddingRuntime` and `ModelRule`, none of which takes a shape word — so the
  renames bring A5's set in line rather than imposing a new rule.

**Seven naming cleanups found while reviewing A5's, none blocking, none started, none on the critical
path.** Items 1–5 are *duplication* removals rather than restylings — which is the only kind worth
doing without a reason, since a rename that satisfies a style and not a duplication is churn. Items
6–7 are a different kind again: an over-claim, not a duplicate.

1. **`LMRuleConfig` moves out of `@senars/util`, and keeps its name.** §0.8.6's finding 3 is still
   open: a config type for the *layer's* rule class lives in the *bottom* package, so `util` knows
   vocabulary it should not. **The author's correction to the obvious fix is load-bearing: `LM` is
   the right prefix** — it means Language Model specifically, where `Model` would claim a generality
   the type does not have (other model kinds may arrive), and `ModelRule` / `ModelRuleStats`
   deliberately mean "the core's contract", not "any model". So the defect is the *package*, not the
   name: `LMRuleConfig` (and `LMRuleConfigV2`, which extends it from `nar/src/lm/rule/types-v2.ts`)
   belong beside `LMRule` in `nar/src/lm/`. `nar/src/lm/lm-service.ts` already re-exports
   `LMRuleConfig` from `util`, so **the move is invisible to every consumer** — which is also how we
   know it is a move and not a rewrite. **Two types with the same name and opposite owners is the
   shape that produced §4 row 9.**
2. **`getMemoryPressure()` is deleted, not renamed** — `capacityPressure()` is the name, and
   `getMemoryPressure()` is now a one-line delegate to it that `memory-pressure.test.ts` asserts is
   equal. A5 made `capacityPressure` the port method, so the alias is pure legacy: **two names for one
   quantity is §0.8.6's "a type and a config key that share a name are two things".** Delete the
   method and the assertion together.
3. **`TaskData` vs `TaskRecord` — decide after one read, do not assume they merge.** `concept.ts`
   holds `TaskData` (live: carries `id` and `priority`), `task/record.ts` holds `TaskRecord` (the
   persisted projection), and `state/serialization.ts` round-trips between them. If that is a real
   distinction it **needs a docstring saying so**; if it is not, it is the same two-names-one-thing
   defect as #2 and the same treatment as A12 gave a term's spellings. **Recorded as a question, not
   as work** — merging two shapes on a guess is worse than two named shapes with one undocumented
   difference.
4. **The `NARConfig` shadow in `@senars/util` is deleted.** Deprecated since 0.8.0, it is re-exported
   from `util/src/index.ts` and **read by nothing** — every one of the 20+ `NARConfig` sites in the
   tree imports from `@senars/nar` or `src`. `util` importing nothing from `nar` is what makes the
   deletion safe. A deprecated duplicate that survives is a second source of truth, which is defect
   #1 in a different file: **delete rather than rename.**
5. **`InferenceMemory` moves from `inference-controller.ts` into `ports/`.** It is
   `MemoryView & { attentionModel }`, declared locally because A5 needed exactly that composite. Once
   `AttentionOwner` is `Attention`, the composite belongs beside the contracts it composes rather than
   in one consumer — otherwise the port set has a member that only exists because a consumer needed
   it.

> **All seven are low-priority and none is on the critical path.** They are recorded because the
> author raised them, not because the plan needs them: A4, A3's decisions and A6 are the queue. Each
> costs review attention and none buys an invariant, so **do not pull one forward to make a commit
> look tidier** — the failure mode §0.8 named for `ProviderSeam.callSites` applies here too, where a
> cleanup in flight reads as progress.

**Two more over-general `Model` names, from the same review.** The author's criterion — does `Model`
claim a generality the thing does not have? — separates ~120 `Model*` identifiers cleanly, and it is
worth writing down *which* ones pass, because the obvious answer is wrong.

6. **`core/src/ModelRunner.ts` and its family → `LMRunner`**: `ModelProvider`, `ModelTier`,
   `ModelEvent`, `ModelRunResult`. **This is the one genuine over-claim in the tree.** The file
   imports `generateText`, `streamText`, `LanguageModel` and `ModelMessage` from the `ai` SDK — every
   one a language-model concept, and `LanguageModel` is the SDK's own word for it. So it is an LM
   runner wearing a generic name, in **the package that is supposed to be the most
   vocabulary-neutral**. It is not "a model runner that happens to work with LMs"; it cannot be
   pointed at anything else. The smell is already visible in `createCortexFromLM.ts`, which writes
   `LMTask ≡ ModelTier` to bridge two vocabularies that should have been one. **Not free:** `core`'s
   public surface, so it wants its own item rather than a drive-by — and §7 invariant 10 requires the
   README's documented surface updated in the same commit.
7. **`ModelRunnerConfig` (`nar/src/config/cognitive-parameters.ts`) folds in with it** — one field,
   `maxLoops`, commented "Maximum reasoning loops per turn", named after the class it mirrors. It is
   a naming artefact of the runner, not a category of thing.

**Three that were considered and deliberately left, because the same suffix does not mean the same
thing in each** — and a sweep that renamed all of them would have been wrong:

- **`ModelRule` / `ModelRuleSelector` / `ModelRuleStats`** (41 + 35 + 12 sites) — this is *already*
  the generic half of a deliberate pair. A2's move was: the core names a `ModelRule`, the layer
  implements it as `LMRule`. So `Model` here means "backed by *some* model, implementation-agnostic,"
  which is exactly the claim — and it is what makes the pair coherent rather than accidental.
  **Renaming these would undo A2.**
- **`AttentionModel`** (50 sites) and **`RewardModel`** (29) — neither is a language model. The first
  is `prime`/`decay`/`tick`, an attention *policy* filling a slot named `attention`; the second is a
  reward *function* with learned weights, paired with a self-documenting `RewardModelConfig`. The
  author's `LM` correction does not reach them, and 79 sites of churn would buy nothing.
- **`LanguageModel`, `ModelMessage`** — re-exports of the `ai` SDK's own names. Renaming a re-export
  breaks its correspondence with its source for no gain. `ModelCapability` sits inside
  `lm/providers/`, where `lm` already supplies the context.

**What A4 can now do that it could not before.** §5.4's acceptance is "the only module that can write
`Concept.priority` is the attention owner's", and `attention:write-surface` is its backstop gate.
`MemoryView` is the read surface the strategy layer takes, `MemoryClock.consolidate` is the *only*
port that advances the decay clock, and `decayAll` is `private` in the one class that still holds it —
so the write-surface enumeration A4 needs now starts from a port list rather than from a
call-site grep. **A4 landed on 2026-10-01 (§0.8.8) and needed no decisions.**

---

### 0.8.8 A4 is done (2026-10-01) — attention has one owner, one clock, and reads that do not write

The one deliberate behaviour change in the plan. `Concept.priority` is no longer writable from
outside its own class, the two sampling methods stopped being writes that happened to return
something, and the two quantities that had two owners (goal stamps, focus priority) have one each.

| artefact | what it is |
|---|---|
| `memory/concept.ts` | **`AttentionEvent`** — seven reasons, and `writeAttention` as the only way `priority` moves. The public setter, `boost`, `decay`, `decayAttention`, `activation`, `activationValue`, `useCount` and `lastDecayTime` are gone |
| `memory/memory.ts` | `sample` and `sampleWindow` are pure reads; `decayAll` is private with one caller and takes the cycles elapsed; `getGoals()` reads a stored stamp |
| `memory/pressure/scorer.ts` | **deleted**, with `ScorerConfig` and its two barrel exports |
| `memory/focus.ts` | the stored `priority` copy is gone: Focus selects by `concept.priority`, it does not keep it |
| `memory/lifecycle/forgetting.ts` | `selectVictim(concepts)` — the victim policies read priority directly, and take no scorer |
| `strategies/attention/SpreadingActivation.ts` | spreads through `ctx.memory.links()`, not a graph only `mergeWith` wrote |
| `scripts/lib/attention-surface.ts`, `scripts/attention-write-surface.ts` | **`pnpm attention:write-surface`** — the backstop the plan names by this name |
| `tests/nar/todo29a-a4.test.ts` | 16 tests: every gate rule failing first, then the behaviour on real objects |
| `nar/src/rl/parity-acceptance.ts`, `tests/nar/rl/parity-restoration.test.ts` | the re-measured baselines, committed |

**Five decisions this item did not pre-answer.**

1. **The write surface is a closed union of reasons, not a token only the owner holds.** §5.4 asks
   for "a small set of named operations … each has one caller and one reason type", which is what a
   discriminated union gives for free: the compiler rejects a caller naming a reason that does not
   exist, and the gate can *enumerate* the reasons instead of grepping for assignments that rot.
   A private module token would have failed to compile at every other call site — including the ones
   the plan wants to exist, since deserialise, replay and a coverage sensor all legitimately write an
   absolute value they computed themselves. Those three share **`assign`**: the writer decided the
   value and attention is not a factor in it.
2. **The scorer is deleted rather than wired.** The first attempt wired recency to `lastAccessedAt`
   and it broke `tests/nar/todo27-seeded-sampling.test.ts` within the hour: two stores built in the
   same millisecond ranked differently, because the ranking read the clock. **A ranking that reads
   `lastAccessedAt` is not a pure function of the store, and the tree's determinism invariant is
   worth more than a second factor.** So recency is out; novelty and relevance are out because no
   scorer has a link port to read them through; and what remains — `0.3 + 0.2·priority` per call
   shape — is a monotone function of `priority`, which is what `topConcepts` now reads directly.
   `forgetting-curve` and `composite` read `c.priority` and are the two policies whose numbers moved
   (§5.13's risk row said parity is the arbiter; it was, and it held).
3. **A read that decays is not a decay rate.** `activationDecayRate` was reaching
   `attentionModel.decay(concept, 1, rate)` with a literal `1` for the cycles elapsed, so the
   configuration said "per consolidation" and the code said "per whatever asked". `consolidate` now
   divides by the interval it waited and passes the quotient, which is the same number on the
   default interval of 10 and a real one above it. **It also means the decay clock only moves when
   consolidation fires**, so a store that is read but never consolidated no longer forgets at all.
   That is the plan's claim, not a new one — §4 row 1 measured 8.2 sweeps per cycle, and now there
   is one per ten.
4. **The link graph was deleted, and that is the *populate* branch of §5.4's either/or.**
   `Concept.linkedConcepts` was written by `mergeWith` alone, so `SpreadingActivation.prime` walked
   an empty map on every primed concept and returned `SimpleAttention`'s boost under a longer name.
   The alternative to deletion — populating a second term-keyed store beside `LinkManager` — would
   have added a writer to fix a reader. Instead the model reads `ctx.memory.links()`, which is
   where links actually live and which `mergeConcepts`/`createAbstractConcept`/the associative
   registry already write. **`SpreadingActivation` now does what its metadata says**, which means it
   is a behaviour change under the `spreading` slot — a slot that is not the default
   (`strategies.attention` defaults to `simple`), so the baselines below do not see it.
5. **`Focus` stores concepts, not priorities.** It kept a `priority` snapshot taken at insert time
   and `adjustAttention` moved *that* copy, so focus ranked on a value that had not changed since
   admission. The copy is gone; `adjustAttention` went with it (no callers), and `findOrphanedLinks`
   — which used `forEachLink` — now asks `LinkManager`.

**The baselines, re-established here as §5.4 requires.** 20 seeds × 20 episodes × 30 steps,
`--mode both`, all three environments, measured on this change and committed to the two files that
carry them:

| environment | before (2026-09-28) | after (A4) | floor | verdict |
|---|---|---|---|---|
| gridworld | 0.6459 | **0.6459** | 0.60 | unmoved |
| bandit | 0.8240 | **0.7206** | 0.60 | −0.10, passes |
| non-stationary | 0.9565 | **0.8316** | 0.60 | −0.13, passes |

Bandit was re-run from the same tree and reproduced 0.7206 exactly, so the harness is still
deterministic and the deltas are A4's, not the harness's. **Why bandit and non-stationary fell and
gridworld did not:** both reward dense, immediate feedback over a short horizon, and a store that
forgets on a clock instead of once per read keeps concepts attention longer — which is the behaviour
A4 asked for and the cost of it. Gridworld is a sparse-reward grid where the concept set barely
changes, so it does not see the difference. The seed pass rates went *up* (0.70 / 0.85 / 0.90), so
the aggregate fall is a ceiling effect on a few strong seeds rather than a wider spread.

**Improvement opportunities A4 exposed, none of them blocking.**

- **`GoalRelevanceAttention` is inert, and now provably so.** It boosts by word overlap with
  `memory.getFocus().getActiveGoals()`, and nothing ever calls `setActiveGoals` — so the overlap is
  always 0 and the model is `SimpleAttention × 1`. `Memory.getGoals()` is the real enumeration and is
  one port away. **Not done here**: it changes the meaning of a registered strategy, which is A11's
  question about who may reach what, and it wants the `GoalEnumeration` port to be the answer rather
  than a patch.
- **`Focus`'s topic-boost machinery is dead with it** — `boostTopic`, `getTopicBoosts`,
  `clearTopicBoosts`, `adjustPriority`, `activeGoals`, `getActiveGoals`, `forEachFocus`,
  `focusConcepts` and `capacity` have no production caller. `nar/src/focus/Focus.ts` is a different
  class and is not affected. A delete pass with the gate running is cheap; it was left because
  §5.4's scope is attention ownership and a second deletion in the same commit is a second thing to
  attribute.
- **`Memory.mergeConcepts` has no caller at all**, and `Concept.canMergeWith` exists only for it.
  Its similarity threshold (0.85) is a tuning constant nothing reaches.
- **`getGoals()` still reads `occurrenceTime ?? Date.now()`**, which is the same defect one field
  over from the stamp: two reads of a goal admitted without an occurrence time return different
  timestamps. The admission path mints one (`createTask`), so this is only reachable through
  `rehydrateTask` on an old dump; A9's event reducer is the right place to close it.
- **`writeAttention` takes a reason union rather than a policy object**, so `SpreadingActivation`
  still knows it is allowed to write a *neighbour's* attention. A model that returned boosts instead
  of applying them would move the write into the owner, which is where §5.4's `Attention` interface
  puts it. Not done: it changes every model's signature for a rule that is currently satisfied.

---

### 0.8.9 A3 is done (2026-10-01) — the eight decisions are a document, and the document is gated

The item the plan expands rather than contracts. Prose is now a protocol: `docs/proposal-protocol.md`
holds D1–D8, `pnpm proposal:protocol` fails when the document and the code disagree, and every decision
has a reason code a rejection actually carries.

| artefact | what it is |
|---|---|
| `core/src/schemas/proposal.ts` | the seam contract as data: a `Proposal` envelope and **two** kinds whose payloads share no field, so the content/rule distinction is a type rather than a flag. `PROPOSAL_SCHEMA_VERSION`, `PROPOSAL_KINDS`, six rejection reasons |
| `core/src/schemas/event-base.ts` | `CognitiveEventBaseSchema` and `EngineOriginSchema`, extracted so the kernel's and the seam's events extend one definition instead of two |
| `cognitive-events.ts` | `proposal.admitted` and `proposal.rejected` join the discriminated union, so one log carries both families and a replay reducer reads one stream |
| `nar/src/proposal/lifecycle.ts` | the state machine: two queues with two policies, `judge` as a pure function of the boundary, `commit` as the one transition, `fromEvents` as the replay |
| `nar/src/proposal/lm-rule-producer.ts` | the drained work becomes a `ContentProposal` carrying the premises it read; only what the lifecycle admits reaches the gate |
| `nar/src/nar.ts` | the producer gets a `resolves` against the store and its own bounded log — a proposal that never reached a gate has no gate log |
| `docs/proposal-protocol.md` | D1–D8, each with what enforces it |
| `scripts/proposal-protocol.ts`, `scripts/lib/proposal-protocol.ts` | `pnpm proposal:protocol`, wired into `pnpm gates` and `ci.yml` |
| `tests/nar/todo29a-a3.test.ts` | 26 tests: every gate rule failing first, then each decision on real objects |

**Four decisions this item did not pre-answer.**

1. **`references` moved to the envelope.** Both kinds read terms and D6 checks them identically, so
   the field was duplicated for no reason — and while it was duplicated, the two payloads shared a
   field and the "separate types" claim was one field short of true. Hoisting it made the payloads
   disjoint, which is what `the-kinds-have-different-payloads` now asserts.
2. **A gate on the document, not just the code.** §5.3's acceptance is "in the schema document, not a
   comment", and a document cannot be enforced. The gate reads `docs/proposal-protocol.md` and compares
   it against the constants the code runs: every decision present, every reason code named in its own
   section, both kinds declared, payloads disjoint, both queues bounded. It caught two real defects on
   first run — the shared `references` field, and D5 discussing staleness without ever naming
   `stale-revision`.
3. **The revision is assigned by `commit`, not by `judge`.** A boundary admits a *batch*, and every
   admission in it advances the table, so a verdict carrying a revision would have been computed
   against a revision its own predecessor had not reached. The test caught this: two admissions in one
   boundary both claimed r1.
4. **No parallel revision bookkeeping was needed.** `stage` runs at `propose` and `admit` at the next
   `authorize`, and a commit only happens inside that `admit` — so everything drained at one boundary
   was staged since the last one with no commit between. Staleness is bounded *by construction*, and
   `baseRevision` fires exactly when something outside the producer committed. The first draft carried
   a `BoundedRing` of observed revisions to make this explicit; the construction says it, and the ring
   was a second account of a fact the stage order already determines.

**One test expectation was wrong before the code was.** `admit` judges and only `commit` writes the
admitted event, so a batch's rejections are recorded at `admit` and its admissions at `commit`. The
test asserted all four events arrived from `admit` alone; the split is the correct shape.

**Improvement opportunities A3 exposed, none of them blocking.**

- **The rule queue has no producer.** `LMProposalProducer` only emits content proposals, because
  nothing in the tree synthesises a reaction. The rule half of the protocol is therefore specified,
  validated, gated and tested but **not yet reachable from a model** — which is A10's job (learned
  rules admitted as data) and the reason the rule queue's capacity is a guess today. **Do not read
  `maxPendingRules: 16` as a tuned number**; it is the smallest value that makes "refused, not
  dropped" observable.
- **The seam's log is per-NAR and in-memory.** `getProposalLog()` is bounded and never persisted,
  unlike the gate logs, which `persistGateLogs` writes to JSONL. A3's replay works because
  `fromEvents` takes a stream — but nothing yet *produces* that stream from disk for proposals.
  That is one line in `EventLogPersistence` and belongs with A9, which is where
  `replay:proposal` is already scheduled.
- **`failed-schema` is a rejection reason nothing routes to.** `submit` validates through
  `validateProposal`, which *throws* rather than returning a verdict, so a malformed proposal is a
  caller error rather than a recorded rejection. The reason is declared because D6's evicted-reference
  check and D7's version check both need somewhere to land a "this proposal is not admissible"; whether
  malformed input should also land there — rather than throw past the seam — is a decision A10 makes
  when a proposer is finally allowed to be untrusted.
- **`proposalOf` reconstructs a proposal from a `Task` on every drain.** Fine at one per premise pair,
  but it re-serialises the term and rebuilds the truth pair each time. If the boundary ever carries
  hundreds of proposals this is the hot spot, and it is the shape A9's recorded-proposal path would
  replace anyway.

---

## 1. The contract

### 1.1 The architecture contract

> **Every cycle-path responsibility has exactly one owner and an interface through which its
> implementation can be replaced. No cycle-path component may require an induction provider, hidden
> global state, or an implicit traversal of the whole population.**

Three clauses, each falsifiable, none needing a stopwatch:

- **one owner** — a mutation of `Concept.priority` or of the decay clock is reachable from one
  owner only, and the write surface is enumerable (§7 inv. 5).
- **replaceable** — each cycle-path responsibility is reached through a port whose contract does
  not mention the concrete type (§3.1, A5, A6).
- **no implicit population traversal** — a read that must consider the whole population is a
  *declared* decision with a named owner and a budget, not a side effect of a getter (A4, A8).

This holds for a tree that is currently O(N) everywhere, and it is what TODO30 needs in place
before it can measure anything.

Each clause prefers the strongest mechanism available, in this order, because a rule nobody enforces
is a comment:

```text
representational   the type forbids it           (Concept.priority has no public setter)
structural         the package graph forbids it   (seam contracts in @senars/core/schemas)
declarative        a ledger of the sites          (accumulator ledger, call-site manifests)
mechanical         a gate that can fail           (attention:write-surface, deps:gate)
```

Three of the four have a precedent in this tree: `verify-derivation`'s dependency floor, the
accumulator ledger's "declare it as data", and `deps:gate` itself. The one to build from nothing is
the first.

### 1.2 Committed state versus advisory computation

**This is the single sentence the rest of the plan is made of.** Three qualitatively different
things exist in this system:

```text
Core committed state ──▶ gates ──▶ events        authoritative; replayable; the only input
                                                     deterministic reasoning may read
Advisory computation  ──▶ J/P answers            bounded, optional, timeout-failing, never
                                                     authoritative until admitted
Uncommitted producer work ──▶ proposal queue      out of band; no cycle participation; may not
                                                     mutate state at any price
```

> **Only committed core state may influence deterministic reasoning. Advisory computation and
> uncommitted producer state must never become implicit inputs to a cycle.**

Three consequences that are easy to lose:

1. **A proposal has no authority until it is committed.** Not when it is produced, not when it is
   queued, not when it is validated — when it is *committed*, at a declared boundary, through the
   gates, as an event (A3). This is why "apply whenever it arrives" reopens the cycle.
2. **A conclusion and a proposal are different acts, and only the second is boundary-governed.** A
   `J` answer that concludes something is an **in-band derivation**: produced inside the cycle and
   admitted through the normal derivation-admission path under budget, like any other conclusion. A
   *proposal* — a `P` output, or any untrusted write attempted from outside the cycle — has no
   authority until the declared boundary. So the boundary rule does not forbid inline `J`; it
   governs **writes attempted from outside the cycle**, and an in-band derivation is not one. Both
   readings of §2.3's "may produce derivations" are otherwise available and only one of them keeps
   §2.3 true: treating a `J` conclusion as a proposal makes inline `J` illegal, and treating every
   proposal as a conclusion makes "never mid-cycle" unenforceable.
3. **TODO30's licence is bounded.** Optimization may change **how** committed state is indexed or
   retrieved; it may never change **what counts as** committed state. An index that silently admits
   uncommitted producer work has crossed from an optimization into an architecture change, and this
   is the line it crosses.

### 1.3 The cycle invariant, stated correctly

The online reasoner is **closed, synchronous, and has no required external dependency on the cycle
path**:

```text
ONLINE REASONER — closed, synchronous
  deterministic with respect to committed state and its inputs
  optional model calls may occur on the cycle path
  a model result never gates completion
  every model call is budget- and timeout-bounded
  no provider mutates core state directly
```

**"No I/O, no model" was the wrong sentence** and this document does not use it. A `J` call on the
cycle path is permitted, wanted, and safe — precisely *because* the invariant below holds:

> **The synchronous cycle must never depend on an external model response for completion.**

Every wording of that requirement — "no model in the cycle", "zero in-cycle calls" — is a proxy,
and §4 row 5 is the demonstration: the proxy would pass on today's tree while `KernelPerceptionGate`
awaits a judge with no timeout (§4, §5.1 step 7). Assert the property, not the count.

What *is* forbidden on the cycle path:

- an **unbounded** wait on a provider (timeout, then treated as failing);
- a provider writing core state without passing a gate;
- a proposal landing mid-cycle;
- a provider's *absence* or *failure* changing which path the consumer takes, other than by taking
  its own declared path or the fail-closed path.

---

## 2. S/J/P: the architecture

### 2.1 The vocabulary, defined once

The runtime has three reasoning modes, and **two of the three are already implemented and typed** in
`nar/src/lm/system-one/`. This plan does not invent them; it makes them reachable from the reasoning
cycle.

| mode | meaning | already exists as |
|---|---|---|
| **`S` — Symbolic** | deterministic reasoning over the shipped NAL/extended-NAL rule table | `RuleEngine` / `InferenceTable` (A6) |
| **`J` — Decision** | answer one bounded, *typed* question: pick from a closed option set, or rate against ordered levels. Returns probabilities, never text | `ClassifyQuery` / `EvaluateQuery` → `ClassifyProposition` / `EvaluateProposition` (`types.ts:66-141`) |
| **`P` — Proposal** | open-ended generation: explain, propose, generalise, derive | `SynthesisQuery` → `SynthesisProposition`, plus the A3 proposal seam |

**Two primitives, not three, and that is deliberate.** The decision layer's canonical form is
`Choice` / `Score` / `Noul`. SeNARS folds `Noul` into `Evaluate` — a yes/no is an evaluation whose
level anchors are `["false", "true"]`, so it *is* the NAL frequency judgement with a different label —
and names the surviving pair `classify` / `evaluate`. `SynthesisQuery` is the third query kind and is
`P`. **The vocabulary is committed code** (`JudgmentQuery = ClassifyQuery | EvaluateQuery`), not a
naming choice made by this document; the lineage and the reasoning behind the fold are in
`TODO16.md` §2 and `TODO16b.md` Appendix A.

**`J` and `P` are two profiles of one seam; `S` is a different capability.** They share the seam and
the event log. `S` and `J` share a *representation* — typed values, calibrated scalars and probability
distributions are natively what NAL deals in — while `S` and `P` cannot (§2.6).

### 2.1.1 The three properties that make `J` safe, and all three are implemented

This is the substance the plan was missing, and none of it is new:

1. **Every query declares what it is about: a `Belief` or a `Goal`.** The field is called `axis` in
   the code (`CognitiveAxis`, `types.ts:63`) and its two values are `'epistemic'` and `'teleological'`,
   but the meaning is exactly the README's own split: **epistemic = Belief, teleological = Goal.** A
   **Belief** answer may speak to `Truth`; a **Goal** answer may only touch `Desire` and is
   *mathematically forbidden* from mutating factual `Truth` — enforced at the transducer
   (`action-transducer.ts:37` refuses any proposition whose axis is not the goal side or which
   abstained), validated in the schema (`http-endpoint.ts:21,29`), and defaulted to the safe side
   (`decide.ts:293`). Every shipped head declares which it is in `head-specs.ts`. **This is the
   epistemic firewall as a required field rather than a convention** — and it answers a question this
   document previously left open.
2. **Every proposition reports how it failed.** `PropositionBase` carries `abstained: boolean` and
   `abstainReason: 'low-confidence' | 'out-of-domain' | 'timeout' | 'breaker-open'`
   (`types.ts:114-121`). So "not configured", "did not answer", "out of domain", "timed out" and
   "circuit open" are five distinguishable facts at the type level — which is what lets `absent` and
   `failed` take different paths without a comment.
3. **Every proposition carries its own calibration and cost.** `Calibration { version, ece, fitted }`
   and `ResourceCost { tokensIn, tokensOut, computeMs, memoryMb }`, plus per-head isotonic calibrators
   and a digest-pinned `calibration-lock.json`. **A provider's probability is admissible because its
   calibration is measured and pinned, not because it is a model** — and an uncalibrated provider's
   scores are clamped at the gate rather than believed.

Consequence for this plan: **`J` is not a new capability and A11 is not an invention.** It is a
completed, typed, calibrated layer that is currently wired to the *agent* side (§5.11).

The names are the tree's own: `IngressJudge` and `admitViaJudge` are `J` at ingress;
`judgment-pipeline.ts`, `ClassifyQuery`/`EvaluateQuery` and the `RubricId` heads are what already
builds it; `P` is `SynthesisQuery`, the tick stage `propose`, the `TickContext.state.proposals` array,
and the `Proposal` contract of A3.

**Anti-drift note, because "judgment" can still be misread.** A decision layer answers a typed
question and returns probabilities; it is not a verdict on another tier. `J` does not authorize,
gate, approve or reject `P`, and it never speaks about `P` at all. What the consumer does with an
answer — admit it, derive from it, select with it, prioritise with it — is a separate decision
belonging to the consumer. This is the v2.4 error the plan corrected, and the
word "judgment" is not licence to reintroduce it.

### 2.2 The shape

```text
             ┌────────────────────────────────┐
             │   S — symbolic core            │
             │   closed · synchronous         │
             │   no required external dep     │
             └───────────────┬────────────────┘
                             │ shared derivation context
             ┌───────────────┴───────────────┐
             │                               │
   ┌─────────▼─────────┐          ┌──────────▼──────────┐
   │  J — decision     │          │  P — proposal       │
   │  bounded question │          │  open-ended work    │
   │  inline · optional│          │  boundary · optional│
   │  may derive       │          │  produces proposals │
   └─────────┬─────────┘          └──────────┬──────────┘
             │                               │
             └───────────┬───────────────────┘
                         ▼
              admission through the kernel gates
                         ▼
                 committed state  +  event log
```

### 2.3 The table

| | **`S`** | **`J`** | **`P`** |
|---|---|---|---|
| question answered | — | one specific question, bounded | an open-ended request |
| result | a conclusion, computed | a bounded answer | proposals, abstractions, derivations |
| latency | microseconds | **microseconds** — linear heads over a frozen backbone; `ResourceCost.computeMs` is recorded per proposition so the claim is measured, not asserted | unbounded; boundary only |
| **may produce derivations** | yes | **yes** | yes |
| where it may run | anywhere in the cycle | **anywhere in the pipeline**, cycle included | at a declared boundary |
| trust | trusted: the shipped table | untrusted: judged on arrival, admitted through a gate | untrusted: provisional until admitted |
| lifecycle | fixed; changed by a release | shares the model's configuration | runtime, versioned, **revertable** (§5.10) |
| absent | n/a | **no answers; the consumer takes its own path** | **no proposals; the system reasons unchanged** |
| failing | must be total; NAL parity is the gate | **fail closed**, bounded, cycle unaffected | **fail closed**; nothing applied |
| hanging | must be impossible | **timeout, then treated as failing** | timeout, then nothing applied |

"Optional" means **absence**, not graceful degradation, and the distinction is the design:

- **absent** ⇒ the consumer takes its own path, unchanged. With no model at all the core is a
  complete NARS-like reasoner — this is the `systemOne.enabled: false` path that already ships.
- **failing** ⇒ **fail closed.** An unobtainable answer is not a pass and not a negative: the
  consumer refuses the decision and records why. A model-backed *rule* that cannot call its model
  runs its **symbolic fallback** — a deterministic body, not a degraded one.
- **hanging** ⇒ bounded by a timeout, then treated as failing. Never awaited.

### 2.4 Four configurations, and the one property worth stating

The design is defined for four configurations — {`J` present or absent} × {`P` present or absent} —
and the system must initialise, reason and pass NAL parity in all four.

| configuration | `S` | `J` | `P` | expected effect |
|---|---|---|---|---|
| S | ✓ | — | — | symbolic baseline |
| S+J | ✓ | ✓ | — | `J` may add or adjudicate derivations |
| S+P | ✓ | — | ✓ | rule/content induction may alter future state |
| S+J+P | ✓ | ✓ | ✓ | composition |

> **`S` must be invariant across all four, while the whole system's derivations may legitimately
> differ.**

That consequence is counter-intuitive enough to state as a rule: a test demanding identical
derivations across the four configurations is demanding that `J` and `P` do nothing. What must match
across the four is the *core's* behaviour. `config:model-matrix` gates it.

### 2.5 Where `J` could earn its place

Ordered by what is measurable, not by what is imaginable. **None of this is mandated here** — the
capability is general and the *placement* is an experiment. The ordering and the budget are
TODO30 §1's to decide. The second column is the point that makes each row actionable: a decision
layer answers a *typed* question, so each site declares which primitive it asks, and the answer is
validated against that declaration at the seam.

| site | question it would answer | primitive | answers about | exists? |
|---|---|---|---|---|
| ingress | what is this observation, what task type, is it an injection | `classify` + `evaluate` | Belief | **yes** — `KernelPerceptionGate` + System One |
| rule selection | which of the applicable rules to try first | `classify` over the applicable set | Belief | partly — `LMRuleSelector` is exactly this shape |
| premise formation | which premises should be paired, given this task | `classify` over candidate pairs | Belief | partly — a `PremiseSource` slot exists |
| contradiction | which of two conflicting beliefs to prefer, and why | `evaluate` against a legend, or `classify` | Belief | no |
| attention | a bounded priority suggestion, applied **by the owner**, never written directly | `evaluate` against priority levels | Goal | no — and it must go through A4's owner |
| consolidation | what is worth keeping, what is worth forgetting | `evaluate` × `compositeScore` | Goal | partly — the pressure/consolidation path |
| goal handling | is this goal worth decomposing now; which tool would serve it | `evaluate`, then `classify` over tools | Goal | partly — drive/decompose strategies |
| explanation | explain this derivation, on demand | `synthesize` | — | partly — NL generation |
| rule induction | a new reaction, admitted at a boundary | `synthesize` → A3's rule path | — | **no — this is A10 + A3** |

Three constraints on all eight, from this plan and not from taste: the answer is **advisory until a
gate admits it**; anything that writes state writes through the owner A4 establishes, never
directly; anything on the cycle path is bounded by §1.3. A `J` that could write `Concept.priority`
directly would undo A4, and a `J` in the cycle without a budget would undo A1.

The pipeline shape, so an implementation does not re-create the v2.4 confusion:

```text
J asks ──▶ J returns an answer or candidate conclusion
         ──▶ the consumer decides what that answer means
         ──▶ the normal admission / derivation / selection path
```

### 2.6 Three consequences of the split

1. **`S` shares a representation with `J`, and cannot share one with `P`.** A symbolic rule is a
   total function from premises to conclusion; an open generation is a request whose result may be
   absent, and modelling those uniformly produces either an `async` hole in a supposedly synchronous
   engine or a prompt-shaped wrapper around NAL. But `J`'s output is *already typed* — a distribution
   over a declared option set, or a calibrated scalar against a declared legend, on a declared axis —
   which is the same kind of thing NAL reasons over. So `S` and `J` share a data representation and
   `S` and `P` share only the seam and the event log.

   **What a decision-layer conclusion may touch follows from whether it is a Belief or a Goal, and is
   already decided and implemented** (§2.1.1): a **Belief** answer's probability is admitted to
   `Truth` at the gate's source-quality ceiling, and a **Goal** answer is confined to `Desire` and
   cannot reach `Truth` at all. So a decision layer does not need a special rule about truth — it needs
   to declare which kind of question it asked, which is already a required field on every query.
2. **Fusion is preserved by sharing derivation context, not by sharing an execution path.** The model
   is told what the symbolic tier concluded — after the fact, or inline if `J` answered within
   budget. Both keep the reasoner closed while the model sees the reasoning.
3. **Content proposals and rule proposals are different acts** and may not share a queue, an
   overflow policy or an admission path (A3, §5.3). A content proposal is a task to be admitted; a
   rule proposal mutates the table every future derivation depends on. **A wrong belief poisons one
   derivation; a wrong rule poisons all of them.** One `Proposal` interface with one overflow policy
   erases that asymmetry.

And the seam that already exists, which the plan makes load-bearing rather than invents:
`nar/src/lm/rule-templates/fallbacks.ts` gives every model-backed rule a symbolic body, and
`executeLM` already returns `null` on failure. **The best-of-both seam is already built.** What is
missing is that nothing *requires* it — so a new `P` rule with no fallback would be accepted
silently. A1 makes the fallback a schema requirement.

### 2.7 Why composition, and not optionality

Three earlier passes framed the thesis as "the core does not depend on the model". That is
*necessary* and reads as the claim; it is the floor. The claim is **composition**: the best of a
NAR-shaped symbolic reasoner *and* a model, which requires the two to have different
representations, different schedules and different trust levels, and to meet at exactly one place.

- **The core becomes falsifiable.** A NAR-shaped core can be held to NAR's own standards — NAL
  parity, determinism, a replay — and `J`/`P` earn their place by beating them. If the two are
  inseparable, neither claim can be tested.
- **Optionality is a deployment requirement.** Latency budgets, air-gapped deployments, regulated
  environments and the deterministic test tier all need a core that runs with no model.
- **It makes the hermetic tier free.** The question "how does a background model survive
  `test:hermetic`" answers itself: the hermetic run *is* the no-provider run plus a recorded
  proposal stream replayed through the same seam (A9). No gate is weakened and no test is skipped —
  which removes the failure mode that produced §4 row 4.
- **It does not require the innovation to live outside the core.** Admitting a *rule* into a running
  system belongs to the **core**, and it survives the layer's absence (A11).

The differentiator is **selected vs learned**, not fixed vs configurable: NARchy lets you choose
which pre-written rules to enable, at boot. The claim here is that rules are *produced*, admitted
through gates, versioned and revertable **while the system runs**. Loading a table is not novel —
NARchy does that at startup. *Admitting a rule into a running system through a gated, recorded,
revertable path* is the difference, and it is a smaller and more defensible claim than "NARS has a
fixed rule set".

---

## 3. Seams and ports

### 3.1 The ports

Five **cycle-path** ports, in dependency order, plus the two seam contracts declared alongside them
(§3.3, §5.11) — seven contracts in all. Each port replaces part of the god-object rather than adding
a layer. **None of
these is an index**; choosing implementations is TODO30 §4–§7.

```text
ConceptStore     get(term, create) · set · remove · size · summary · clear
Attention        touch(term, event) · topK(n) · commit(now) · forget(term)
BeliefTable      per-concept: insert · peek · size · retention policy
InferenceTable   lookup(antecedentKind, consequentKind) · dispatch(...)
CycleExecutor    one cycle, under a budget, with a pluggable concurrency strategy
```

Two of them matter most. `ConceptStore` and `Attention` are the ones NARchy's precedent speaks to
(§3.4); the other three are consequences of their existing members. One shape change is deliberate:
`Attention` is an *interface with a mutation surface*, not an index with an update method, because
"one owner" is the property and "index" is an implementation.

Two further contracts, from A2 and A11:

```text
Proposal / ProposalSource   declared in @senars/core/schemas; data, never a closure over NAR
                            internals; content and rule kinds are separate types (§5.3)
DecisionPort               one optional port onto the *existing* decision layer; advisory; every
                            call site declares query kind, axis, budget and position at the type
                            level (§5.11). Reuses `JudgmentQuery` / `SynthesisQuery` verbatim
```

**What A5 declared is more contracts than the list above, and less scope.** It did not ship one
`ConceptStore` — it shipped the *split* the list implies, as nine contracts in
`nar/src/memory/ports/`, plus `AttentionOwner` and the `MemoryClock` that `decayAll`'s single remaining
caller implies:

```text
ConceptReader / ConceptWriter   the population: get · add · remove · archive · list · values · size · clear
TaskAdmission                   addTask(term, type, truth, budget, stamp)
BeliefTable                     beliefs(concept) · taskCount(concept)
GoalEnumeration                 getGoals()
LinkPort                        getLinks · getLinkPriority · addLink · remove* · layers · applyDecay
StatisticsView                  capacityPressure · totals · getStatistics
SymbolIndex                     queryBySymbol · queryByTimeRange · findConcepts · findSimilar · getRelated
MemoryClock                     consolidate({ cycleCount })   — the only tick of the decay clock
AttentionOwner                  attentionModel · setAttentionModel
```

Composed as `MemoryReader` / `MemoryWriter` / `MemoryPorts`, and `MemoryView` — the seam the strategy
layer already took — is now *composed from* them rather than redeclaring the read surface. `InferenceTable`
(A6) and `CycleExecutor` are the two that have not landed. `Attention` above is A4's, and
`AttentionOwner` is the slice of it A5 needed to rewire `CognitiveController`.

### 3.2 The cycle

The shape, with no cost claims attached:

```text
input ──▶ attention.touch(term, event)          replaces the O(N) relevance scan
      ──▶ admission                            through the store's neighbour port
      ──▶ attention.commit(now)                 the only decay in the system, on a clock
      ──▶ workingSet = attention.topK(n)       replaces sample() + the decorative scorer
      ──▶ for each premise pair:
             inference.dispatch(...)
      ──▶ budgeted admit of conclusions
      ──▶ drive / meta / self — on a budget, opt-in
```

One owner per quantity, one cadence per clock, one write path per fact, one seam for `J` and `P`.
The cycle has *no* prohibition on model calls in it; it has the invariant of §1.3.

### 3.3 The spine and the proposal lifecycle

```text
                   ┌──────────────────────────────────────────┐
  input ──▶ gate ─▶│  ONLINE REASONER — closed, sync, bounded │
                   │  no required external dependency        │
                   │  (model calls permitted, bounded, never │
                   │   required for completion)              │
                   └───────────────┬──────────────────────────┘
                                   │ commits only
                                   ▼
                        ┌─────────────────────┐
                        │  THE SEAM           │  versioned · validated
                        │  rule table         │  gated · revertable
                        │  proposals          │  replayable
                        └──────────┬──────────┘
                                   │ proposes
                                   ▼
                   ┌──────────────────────────────────────────┐
  un-committed ────▶│  INDUCTION LAYER — out of band          │
  derivations       │  bounded queue · its own budget · no    │
                    │  cycle participation · every output a   │
                    │  proposal · provisional until applied   │
                    └──────────────────────────────────────────┘
```

**What the seam does not do.** It does not let the reasoner read the inducer's intermediate state,
and it does not let a proposal land mid-cycle. A proposal applies at a declared boundary or not at
all — the next `authorize` stage, structurally rather than by convention (§5.14, decided in §0.8.1).

**The seam runs through the kernel gates, not around them.** This is a README-level invariant the
split must not erode: `PerceptionGate` admits, `BudgetGate` accounts, `RewardGate` holds the
epistemic firewall, `ActionGate` authorises, and *"four gates mediate every state mutation; every
subsystem operates through them; none can bypass them."* The requirement here is therefore stronger
than "a provider proposes":

> **A proposal is a request to a gate, and the gate is the only thing that may write state.**

In particular a proposal may propose a rule, an abstraction or an attention weight; it may never
propose a truth value to be written without `PerceptionGate`'s source-quality ceiling, and it may
never reach `Truth.frequency` or `Truth.confidence` through a reward path. The existing
`provisionalConfidence` 0.3 is the correct instinct and must survive the payload change.

#### Two kinds of proposal

| | **content proposal** | **rule proposal** |
|---|---|---|
| payload | a formalized term / provisional belief / goal / abstraction | a reaction: pattern + truth function + priority |
| frequency | continuous, driven by ingress and derivation | rare, and deliberate |
| trust | untrusted, admitted through `PerceptionGate` at the source-quality ceiling | untrusted, and must clear the rule schema |
| cost of dropping one | low — the next derivation produces another | high — it *is* the learned capability |
| overflow | drop-oldest is acceptable; the context is regenerable | **never silently dropped**; overflow must be reported |
| reversibility | n/a — a task's provenance is its admission event | must be revertable, and the revision recorded (A10) |
| where it lands | memory, via a gate | the rule table, behind `InferenceTable` (A6, A10) |

**One queue with one policy for both is the specific mistake to avoid**, and it is the mistake a
single `Proposal` interface invites. The distinction belongs in the *type*, not in a field.

#### The applicability rule

```
Provider observes revision R
        ↓
Provider emits proposal P with schemaVersion v, baseRevision R
        ↓
Core reaches a declared synchronization boundary
        ↓
Core checks P.schemaVersion      → incompatible ⇒ reject loudly
Core checks P.baseRevision       → stale        ⇒ reject as stale
Core checks referenced objects   → evicted      ⇒ reject, do not salvage
        ↓
apply(P) through the gates  |  reject(P) as a recorded event
```

"Apply whenever it arrives" is prohibited: it reopens the cycle.

#### Atomicity with the event log

**Proposal admission is a single committed state transition.** This is the invariant that makes
`revertable` a state-machine property rather than a feature claim, and it is required by §1.2:

> The event that records admission is the source of truth for the resulting table revision.
> In-memory indexes are **derived** from that state and are **never independently authoritative**.

The failure this forecloses, in both directions:

```text
event log says rule R exists      +      in-memory table says R does not      (after a crash)
in-memory table says R exists     +      event log has no admission event      (a direct write)
```

There is exactly one write. A crash cannot occur between two, because there are not two. A rule
added at runtime therefore appears in dispatch, is in the event log, carries a version, and reverts —
and those four facts are the *same fact*, not four that can drift.

### 3.4 NARchy: the precedent, briefly

Reference `github.com/narchy/narchy` pinned at `f3a9bcc` (§13). NARchy is derived from OpenNARS and
modifies it substantially, so every divergence below is a deliberate decision by someone — a stronger
reference than two unrelated systems.

| | SeNARS today | NARchy |
|---|---|---|
| concept store | one 646-line class doing 9 jobs | a port, 6 abstract methods, 8 implementations |
| priority / decay | a field with 10 external writers, re-ranked on read; swept inside `sample()`, 8× per cycle | one owner (`PriTree`), committed on a duration-derived clock (`Focus.commit`) |
| what a cycle selects from | the whole population | a declared working set |
| rule dispatch | 4-bucket union + full sort per application | a predicate trie that **winnows**, still interpreted |
| beliefs / eviction | 3 fixed capacity constants × concepts; trigger is concept count | policy-based bags, 8 table types; per-container, by policy |

Two corrections are load-bearing and both came from NARchy's author rather than from its filenames:

- it **winnows** rules with a predicate trie and stays **interpreted**; deeper bytecode compilation
  was available and deliberately not taken. `RuleIndex`'s 2-tuple kind key is the depth-1 case of
  exactly that structure, so A6 is incremental and parity-gated rather than a rewrite.
- its rule set is **selectable at runtime startup**, by enabling chosen rulesets. So the
  differentiator is *selected vs learned* (§2.7), not *fixed vs configurable*, and A10's job is
  admission, not loading.

Its data structures live in a **different module** (`jcog`) from its reasoning (`narchy`), which
makes "storage is a port" a *module-boundary* precedent rather than a convention — A5's exact claim.

---

## 4. Findings that justify the work

The evidence for these is in `TODO29.md` §1 (read it once, then use this table as the trace). An
empty owner means the finding has no gate, and a finding with no gate is a finding with no owner.

| # | finding | evidence | owner |
|---|---|---|---|
| 1 | a read mutates the heap: `sample()` calls `decayAll()`, so one cycle does ~8 decay writes and ~8 population rankings; the decay clock advances `min(sampleSize, N)` times per cycle | `memory/memory.ts:354,370` → `:557`; measured 8.2/8.0/5.0 per cycle | **A4 — done 2026-10-01** (§0.8.8): `sample` / `sampleWindow` are pure reads and the sweep has one caller, `consolidate`, which now reports the interval it elapsed instead of a literal `1` |
| 2 | every memory read is a full scan and the index that exists is bypassed; the *default* premise source is a scan-and-sort | `memory.ts:216,206,244,471,542`; `strategies/premise/primitives.ts:56` | **A5 — dependency half done 2026-10-01** (§0.8.7): the cycle path reaches memory through nine ports and `memory:ports` gates the facade. **The read-shape half is untouched** — the scans are still scans, and the structures are TODO30 §4 |
| 3 | the scorer is decorative: its only call site passes no context, so `novelty ≡ 1`, `relevance ≡ 0` and ranking by retrieval score *is* ranking by `priority` | `memory/pressure/scorer.ts:22-28,84-88`; one caller, `memory/lifecycle/forgetting.ts:46` | **A4 — done 2026-10-01** (§0.8.8): the class is deleted. Its four factors were a constant plus a scaled priority, so retrieval ranks by attention order directly; `forgetting-curve` and `composite` read `concept.priority` |
| 4 | eviction measures concept count, not tasks, and its candidate filter is *anti-correlated* with pressure — the only evictable concepts are empty shells | `memory/pressure/consolidation.ts:24`; `memory.ts:519` | **A8** |
| 5 | `getGoals()` mints a fresh `Stamp.createInput()` per goal per call, so anything keyed on stamp overlap reasons about an id that never repeats | `memory.ts:253` | **A4 — done 2026-10-01** (§0.8.8): stamps are minted at admission (`Concept.addTask`) and `TaskData.stamp` is non-optional, so two reads of one goal return the same identity |
| 6 | `Concept.priority` has ten external and six internal writers; `linkedConcepts`/`subConcepts`/`parentConcepts` are written only by `mergeWith`, so `SpreadingActivation.prime` is a no-op wearing a real cost | call-site audit | **A4 — done 2026-10-01** (§0.8.8): no setter, seven named reasons, and `Concept`'s second link graph deleted; `SpreadingActivation` now reads the link *port*, so it spreads through links that exist |
| 7 | two rules document a fix they did not get: `stepScalars` is never invalidated (a shadowed `resetMetaBudget` means the memo is process-stale), and the `RuleIndex` tie-break orders nothing because `recordRuleHit` has no callers | `rules/impls/processor.ts:156-181`; `nar-execution.ts:76,116,179,368`; `rules/impls/RuleIndex.ts:131-140` | **A1** (delete), **A6** (tie-break) |
| 8 | three of four dispatch buckets are empty: 0 of 55 registered rules use a wildcard, 21 share one hot cell | census, §13 | **A6** |
| 9 | **the seam exists, is bounded and gated, and has no caller.** `StreamReasoner` is committed, exported and tested; its only caller in the repository is a test. Meanwhile the cycle reaches the model by a different route — `processLMRules`, called synchronously, 33× per cycle | `stream/reasoner.ts`; `strategies/derivation/DefaultDerivation.ts:26,30`; `nar-execution.ts:234` `step(5000, …)` | **A1** |
| 10 | the seam spends against the **process-global** `gateRegistry`, not the per-instance one `createGateRegistry()` exists to provide, so two NARs in one process share an LM budget | `stream/reasoner.ts:2,80`; `kernel/GateRegistry.ts:117,120` | **A1** |
| 11 | a **present-but-hung** `J` at ingress is awaited with no timeout. Absence and throw are both handled correctly (absent ⇒ unjudged path; throw ⇒ fail closed, D1) | `kernel/KernelPerceptionGate.ts:72-73,117-118,154` | **A1** |
| 12 | the core's *strategy extension contract* is typed in terms of the induction layer's rule type, in **39** files | `strategies/types.ts:1,71` | **A2** — **fixed 2026-10-01.** Nine cycle-path imports, not 39: the other 30 were assembly. `ModelRule`, `ModelRuleSelector`, `TextGenerator`, `EmbeddingRuntime`; census reads zero (§0.8.6) |
| 13 | optionality is not operational: `enableLMRules: false` still constructs and registers the layer — 33 invocations per cycle with the flag off | `nar.ts:762,823,837`; `facade/index.ts:98` | **A2** — **fixed 2026-10-01.** The flag is deleted; no provider means no model rules, and there is no third state to misread (§0.8.6 decision 1) |
| 14 | the rule set is a **module-global mutated by an import**, so it cannot be loaded, versioned, swapped or reverted, and a well-formed rule proposal has no path to becoming a rule | `rules/impls/registration.ts`; `rules/impls/rule-registry.ts` | **A10** |
| 15 | the growth arithmetic: quadratic admission via `neighborsOf`, a linear-shift `TermCollection`, a full-map victim scan, a bounded-buffer `selectTopN` | `memory.ts:308-314`; `terms/impls/term-collection.ts:57-65`; `util/src/utils/bounded-map.ts:210-216` | **TODO30 §4, §7** |
| 16 | **the decision layer is wired to the agent side, not the reasoning side.** A complete typed/calibrated layer — `classify`/`evaluate`/`synthesize`, `CognitiveAxis`, `abstainReason`, isotonic calibrators with a digest-pinned lock, `ConfidenceRouter`, `judgeCascade` — is attached to a **`GameFocus`**, while the reasoning cycle reaches a model only via the ingress judge and `processLMRules` | `facade/system-one.ts:337`; `nar.ts:571`; `types.ts:63-141` | **A11** |
| 17 | the three primitives are `classify` / `evaluate` / `synthesize` — `Noul` was folded into `evaluate` because a yes/no is a frequency judgement with two anchors. The plan must not reintroduce `Noul` as a fourth primitive or restate it as three | `types.ts:66-89`; `TODO16.md` §2; `TODO16b.md` App. A | **A11** (terminology, enforced by the types) |
| 18 | **`product` is declared commutative and is not.** `createCompound` sorts a commutative kind's arguments at construction, so `(*,bird,cat)` and `(*,cat,bird)` interned to **one** term and `termsEqual` answered yes for two different products. `docs/java/Op.java:110` builds `PROD` through the non-commutative constructor | `nar/src/terms/operators.ts:20`; `factory.ts:64` | **A12** — **fixed 2026-09-30**, one declaration and a test. Found while reading `Op.java` for A12's catalogue: a commutativity flag is not a formatting choice, it is a claim about equality |
| 19 | ~~**six of sixteen kinds do not round-trip through Narsese, and the round-trip test cannot see it.**~~ **Fixed 2026-09-30 by A12 step 1** (`7cef8635`); the round-trip generator now derives its kinds from `OPERATORS`, and `pnpm terms:canonical` gates the agreement. **six of sixteen kinds did not round-trip through Narsese, and the round-trip test could not see it.** `implication`, `parallel`, `predictive`, `retrospective` use symbols the grammar has never accepted; `instance`/`property` are not the kinds the grammar builds (`setExt`/`setInt`); `operation` loses its parens. `product` is worse than broken: `TermBuilder.tuple` builds it as a **conjunction**, so `(a,b)` and `(a&b)` are the same term | `nar/src/terms/operators.ts`; `narsese.peggy:4,118`; `factory.ts:107`; `tests/nar/property/narsese-roundtrip.test.ts:14-20` | **A12 step 1** (§5.12.1) — **done 2026-09-30**; the `^name` retirement is **done (§0.8.3)** and what remains is **§0.8.4**, the grammar cannot read a bare operator chain |

| 20 | **an operator token with no kind behind it builds a term whose `kind` is the symbol.** `narsese.peggy` resolved an infix token through `INFIX_KINDS[op] ?? op`, so `(penguin --> (-- fly))` produced a predicate of kind `'--'` that *serialised as `(fly)`* — the negation was gone from the term's identity while the surrounding belief looked negated — and `f(x)` produced a compound of kind `'atom'` carrying arguments. The grammar now fails an unmapped operator instead of inventing a kind | `narsese.peggy:132,140` (pre-fix); reproduced in §0.8.2 | **A12 step 1** — **fixed 2026-09-30** |
| 21 | **the tree had two spellings for one idea.** `^tool(a,b)` decoded to `Inheritance(Product(args), Atom('^tool'))` — the convention with real traffic — while `(f^(x))` decoded to a compound of kind `operation`. Neither could read the other, and both were reachable from a cycle. Upstream settles nothing here: `docs/java/Op.java` has no `OPERATOR` and `NarseseParser` no `^`, so `^op(…)` is a SeNARS-local convention and the choice is ours | `terms/impls/operation-term.ts`; `rules/impls/registration.ts:359-371` | **A12 step 1** for the spelling — **done, including the `^name` retirement (§0.8.3)**, which deleted the sigil form from the grammar rather than deprecating it |

**#15 is entirely TODO30's.** A4 fixes *who* may write `priority`, not with what structure it is
read. **#14 is not justified by a finding at all** — it is justified by the thesis, and §1 has no
entry for "the rule set is code" because the obvious way to find it is to read the plan rather than
the tree. It is the only item whose absence is invisible from the diagnosis, which is why §12
carries the risk row.

---

## 5. The work

Thirteen items — the twelve below plus A12 (§5.12), added after A1 found that the term layer has no
canonical form. **A0 first and separately** — it is the harness that decides whether the rest worked.
**A1 second, alone** — finding 9 makes it a wiring change and a one-line test makes it the cheapest
behaviour change available. **A2 immediately after**, because the seam and the dependency direction
are one change and only the first half is testable alone.

Each item below states: what it is for, the change, **acceptance** (demonstrable, not aspirational),
one verifying command, the gate it lands, and its risk.

### 5.1 A1 — Close the cycle: make the committed seam the only seam

*For findings 7, 9, 10, 11. This item wires in the channel that exists and deletes the other route.*

Nothing in `cpuThrottleMs` / `maxRulesPerCycle` / `callTimeoutMs` / `Promise.all` on the induction
path is a design decision — it is the cost of a model living inside a cycle meant to close in
microseconds. `inferenceController.step(5000, …)` (`nar-execution.ts:234`) is a five-second deadline
on such a step, and that is the tell.

1. `DefaultDerivation.ts:26,30` stops calling `processor.processLMRules`. The synchronous path is
   `applySyncRules` (`rules/impls/processor.ts:246`) and nothing else.
2. The production path constructs a `StreamReasoner` (or its A2 generalisation) at the cycle boundary
   and reaches a provider only through `flush` / `reasonHook`.
3. **The seam takes its gates by injection.** Replace the module-global `gateRegistry` import with a
   `GateRegistry` passed at construction, taken from the same place `nar.ts:136` takes it. Two lines,
   and it is the difference between the seam being usable in a process with two agents and not.
4. `stepScalars` and the shadowed `resetMetaBudget` are **deleted, not fixed** — with the layer out
   of the cycle the memo has no reason to exist.
5. `cpuThrottleMs` and `callTimeoutMs` lose their reason to exist. Either they go or they become
   properties of the *offline* pass. Do not leave them bounding a cycle that no longer contains the
   thing they were written for.
6. Overflow policy moves from drop-oldest to A3's decided policy, in `StreamReasoner`, with a test
   that fills the queue and asserts what survives.
7. **The `J` profile gets a bound, not a fallback.** Its optionality is already correct — absent ⇒
   unjudged path, throws ⇒ fail closed (D1). What is missing is the third case: a hung judge has no
   timeout, so `nar.input()` waits forever. Add one, and on expiry take the **same** fail-closed path
   a throw takes. **Do not degrade to unjudged admission on timeout** — that bypasses the injection
   veto, which is the one thing D1 exists to prevent.
8. **Every model-backed rule keeps its symbolic body, and the schema requires it.** The path is
   implemented and nothing requires it, so a new `P` rule with no fallback would be accepted
   silently. Make it a rule-schema requirement with a test.

**Acceptance**

1. **A test that injects a provider that never resolves, calls `run()`, and asserts the cycle
   finishes.** One line, written failing-first.
2. A cycle completes *and derives the same conclusions* with a `J` judge and a `P` rule backend that
   both never resolve — and the recorded trace shows no `propose`-stage work inside a `reason` stage.
3. Two NARs in one process each see their own `BudgetGate` accounting, and a NAR built with an
   injected registry spends against that registry rather than the process global.
4. **The causal model of a producer's effect, as four separate assertions** — not one, because they
   are four properties:

   ```text
   For a fixed cycle-start state and fixed inputs:
     · registering a producer does not change the current cycle's required progress;
     · a producer that returns no proposal produces the same committed state;
     · a proposal cannot affect state before the declared application boundary;
     · after an accepted proposal is applied, subsequent cycles may legitimately differ.
   ```

   The last clause is what makes the first three safe: a proposal *does* change future state, and a
   stronger assertion than the first three would forbid the system from learning anything.
5. A proposal that arrives is applied at a declared boundary or not at all — never mid-cycle.
6. A NAR with **zero** proposal producers registered still reasons.
7. There is still exactly one `InferenceController` construction site and one `.step(` call site.
8. **All four S/J/P configurations are complete systems** — four runs, each initialising, reasoning
   and passing NAL parity. What matches across the four is the *core's* behaviour.
9. A hung `J` is rejected on a timeout, and the rejection is the fail-closed one.
10. NAL parity, `test:determinism` and `test:hermetic` green.


### 5.2 A2 — Move the induction layer beyond the core

*Deliberately not a separate letter from A1 step 3: the seam and the layer boundary are one change,
and you cannot have a core-owned seam interface while the core imports the layer's rule type.*

- The core declares the proposal contract in core vocabulary, and a proposal is **data** — never a
  closure over NAR internals, which would re-create the coupling the type boundary just removed.
- **The contracts live in `@senars/core/schemas/proposal`, with a dependency floor of `util`.** Not
  "somewhere in `nar/src`, policed by a gate row". Two precedents are already in the tree:
  `core/verify-derivation` exists so that "a verifier bug cannot hide behind an engine bug", and the
  induction layer **already imports from `@senars/core/schemas`**. The boundary then stops being a
  lint rule and becomes a structural fact: `core` imports `util` and its own schemas, `nar` imports
  `core`, and a provider reaching into `nar` internals breaks the build.
- `stream/reasoner.ts` is generalised **in place** rather than duplicated: `LMRequest` /
  `ProvisionalBelief` are already a request/response pair with a provisional-truth discipline, which
  is the shape a `Proposal` needs. The seam gets a schema version and a base revision; it does not
  get a second class.
- `strategies/types.ts` stops importing `LMRule`. The five strategy types are re-expressed so a
  producer is not typed in the layer's vocabulary — the cleaner answer is that selection is a
  *proposal-time* concern and `LMRuleSelector` is not a reasoning-cycle strategy type at all.
- `nar.ts`'s unconditional `initializeLMRules` / `LMRules` / `NARLM` / `wireSystemOne` become
  assembly in the composition root (`src/`), which already exists for that purpose.
- The 39 imports are inverted or removed because the thing they reached for moved down.
- `lm` leaves the core config schema, on the precedent of `bagSize` and `interactionGuide`: an
  optional component must not shape a required one. It becomes plugin configuration, validated where
  the plugin is assembled.

**Blast radius**, because finding it by `typecheck` wastes a day. The last column is **what actually
happened** (2026-10-01, §0.8.6); a plan that marks its own rows unverified is a plan whose next
reader redoes the work.

| surface | where | planned | landed |
|---|---|---|---|
| `NARConfig.enableLMRules` | `facade/config.ts`, README config block, `docs/api/nar.md` | removed, docs regenerated | **done** — plus `LMConfig.enableLMRules` and the deprecated shadow in `util/src/types/nar.ts`, both unread |
| the `lm` config category | `config/cognitive-parameters.ts` | moves out of `CognitiveParameters` into plugin config | **not done.** Only the dead `enableLMRules` went. `callTimeoutMs` and the rest stay, and `LM_HEAVY_` / `FAST_` presets are untouched — the config is the layer's *own* vocabulary, not a core contract, so nothing about the boundary required moving it |
| the four presets | `DEFAULT_` / `FAST_` / `LM_HEAVY_` / `RESEARCH_COGNITIVE_CONFIG` | `FAST_COGNITIVE_CONFIG` and `LM_HEAVY_CONFIG` leave or narrow | **not done**, deliberately — see the row above. Narrowing a preset changes behaviour and buys no boundary; it is TODO30's question about what an LM-free configuration should cost |
| the strategy slots | `cognitive/registrations.ts` + README's five-category table | `LMRuleSelector` ceases to be a cycle strategy; registry and README table change together | **half done, deliberately.** The *contract* is `ModelRuleSelector` and selection is documented as a proposal-time concern. The *keys* stay `lmRule` / `'lm-rule'`: ~40 sites across `cognitive-parameters.ts`, `CognitiveRegistry`, `src/config/schema.ts`, `senars.config.json`, the agent surface and `dialogue/…/adapt.ts`, all of them a user's configuration word. §0.8.6 decision 5 |
| the export index | README's "Complete API Export" block | `LMRule`, `LMRuleFactory`, `lmCommands` move to the plugin side | **not done**, and it is the reason acceptance 2 could not be met literally. `LMRule` and `LMRules` are still core-exported — *usable* is not *reachable from the cycle*, which is the distinction §0.8.6 leans on |
| the seam contracts | `@senars/core/schemas/proposal` | declared there, dependency floor `util` | **not done, with three reasons** (§0.8.6 "What is not done"). `nar/src/stream/reasoner.ts` already holds the proposal contract, and §5.2's own bullet says generalise it *in place* |

**Acceptance**

1. `deps:gate` gains a row: `nar` core may not import `nar/src/lm/`. **Done, and in
   `deps:direction` instead** — `deps:gate` counts cycles and compares a number, and a layering rule
   is not a number. `core:no-lm` is the standalone gate; both call `scripts/lib/layer-boundary.ts`.
   **DONE 2026-10-01.**
1a. The seam contracts are in `@senars/core/schemas`. **NOT DONE, with reasons** (§0.8.6). The
   *substance* — no layer-typed value in a core extension contract — is met: `ModelRule`,
   `ModelRuleSelector`, `TextGenerator`, `EmbeddingRuntime`, all in `nar`. The *letter* is not.
   `core`'s import list does still contain only `util` and its own schemas.
2. A no-provider NAR reasons, green with the layer's directory removed from the build graph.
   **PARTIAL.** A no-provider NAR reasons and every suite is green. Literal directory removal is not
   claimed: `nar/src/index.ts` re-exports the layer for assembly, so deleting it breaks `src/bin/**`
   — the correct shape, and a narrower claim than the criterion. What *is* gated is the thing that
   matters: a cycle-path module cannot reach the layer at all.
3. NAL parity green with no producer registered, and a census asserts the core's shipped table is
   exactly the registered NAL rules and grows only through a proposal. **HALF DONE.** Parity green;
   the census is in `tests/nar/todo29a-a2.test.ts` (registered set == declared set, count 55, every
   rule declares a truth function and a priority). "Grows only through a proposal" is A10's half —
   the table is still an import side effect.
4. `enableLMRules` is gone — replaced by absence. **DONE 2026-10-01.**
5. No provider implementation can reach private core state, and no layer-typed value appears in a
   core extension contract. **HALF DONE.** The second clause is done and gated. The first is not
   asserted: it needs a definition of the boundary that the plan has not written, and it is A11's
   to write (`DecisionPort`).
6. `README.md`, `docs/api/nar.md` and the export index no longer advertise `enableLMRules`…
   **DONE for `enableLMRules`** — README, `docs/api/nar.md`, `docs/tech/cognitive-grounding.md`,
   `docs/tech/rl-parity.md`, `src/config/defaults.ts`, seven scripts and 33 test files.
   `pnpm docs:drift` green. **Not done: the `lm` config block**, which was never advertised in the
   README to begin with; what it *does* still advertise is the layer's own vocabulary, which is
   correct. Every blast-radius row above is changed or consciously left, in this commit.


**Settled: no seventh package, for the contracts.** Moving `Proposal` / `ProposalSource` to
`@senars/core/schemas` makes the boundary structural for the thing that matters, at the price of one
directory. A seventh package would additionally force everything the layer *reads* — concepts,
memory statistics, derivation chains — to become public API, a much larger change to a much larger
surface. §11.1 keeps the question open for the day the layer needs to be genuinely un-buildable.

**Correction to the paragraph above, after building it (2026-10-01).** The claim that moving the
contracts to `core/schemas` "makes the boundary structural" turned out to be the wrong claim for the
wrong reason. `Proposal` already has its contract, in `nar/src/stream/reasoner.ts`, and §5.2's own
second bullet says to generalise it **in place** rather than duplicate it. So the two bullets above
contradicted each other: the first says *move it out*, the second says *do not give it a second
class*. What actually made the boundary structural was neither — it was **the core naming a
capability** (`ModelRule`, `TextGenerator`, `EmbeddingRuntime`) and **a gate over the cycle path**.
Moving a type between packages is not what stops a well-meaning import; a gate is. The seven-package
question is now sharper and smaller: it is only worth asking if the layer must become *un-buildable*,
and nothing so far asks for that.

### 5.3 A3 — Specify the proposal lifecycle

*This is the one area the plan expands rather than contracts, because it is the boundary the whole
plan exists to make real, and prose is not a protocol.*

Decide, and write each into the schema document rather than a comment:

- unit of work (one derivation, one consolidation window, one episode);
- trigger semantics — a trigger, not a rate, expressed as **cycles per proposal**;
- the maximum pending proposals and the **overflow policy** per proposal kind;
- the stale-proposal policy;
- behaviour when referenced concepts no longer exist;
- schema and version compatibility;
- cancellation semantics;
- replay semantics.

What the code already answers, which is the best possible starting position:

| question | today | must be decided |
|---|---|---|
| overflow (content) | drop-oldest, twice (`pushCapped`, `trimCapped`) | acceptable for regenerable context — say so explicitly, so it is a decision and not an accident |
| overflow (rule) | **nothing exists** | a rule proposal must never be dropped silently: a bounded queue with an explicit refusal event the operator can see |
| backpressure | defer above `highPressure`; on `BudgetGate` denial re-queue at the head and trim the tail | what happens to a *denied* batch — retry, drop, or a recorded rejection event; and does a denial emit a `TerminationReason`? |
| provisionality | `provisionalConfidence` 0.3, revised by `Truth.revision` on settle | whether a content proposal is a *truth claim* at all (it should be a claim about a term, judged at admission — not a direct write) |
| staleness | none — `ProvisionalBelief` carries no revision | the applicability rule in §3.3 |
| symbolic fallback | exists per rule, required by nothing | a schema requirement: no `P` rule registers without one, and the fallback runs when the provider is absent |

**Acceptance**

- each of the eight decisions is in the schema document, not a comment;
- the content/rule distinction is in the *type*, and a rule proposal cannot be routed down the
  content path — with a test that tries;
- every registered `P` rule has a symbolic fallback that runs with no provider present;
- a recorded proposal stream replays deterministically against recorded core state, through the same
  seam (A9);
- **proposal admission is one committed state transition** (§3.3): a test that replays the event log
  reconstructs the admitted table with no in-memory state carried across, and a test that interrupts
  between admission and index update still reconstructs the admitted table;
- a test fills the queue past capacity and asserts the chosen overflow policy, including a denied
  batch;
- a test applies a proposal whose `baseRevision` is stale and asserts rejection, not silent
  application;
- a test applies a proposal referencing an evicted concept and asserts rejection.

**Status: done 2026-10-01 (§0.8.9).** Every criterion above is asserted in
`tests/nar/todo29a-a3.test.ts` (26 tests). Two are narrower than written and the narrowing is
deliberate: *"a recorded proposal stream replays deterministically against recorded core state"* is
half-landed — `ProposalLifecycle.fromEvents` replays a stream it is handed, but nothing yet persists
the seam's log to disk, so that is A9's `replay:proposal`; and *"a test that interrupts between
admission and index update still reconstructs the admitted table"* is asserted by discarding the
in-memory lifecycle and rebuilding from the events alone, which is the property with no way to
interleave in a single-threaded test. The *"denied batch"* criterion is A1's D4 rather than this
item's: a `BudgetGate` denial already records `budget.exhausted`, so there is no second vocabulary
to add here. **The one thing not done is a producer for the rule queue** — see §0.8.9.


### 5.4 A4 — Establish state ownership, and make reads observational

*The one deliberate behaviour change in this plan. Everything else is a data structure or a wiring
change.*

```ts
interface Attention {
  touch(term: Term, reason: AttentionEvent): void
  topK(limit: number): readonly Term[]
  commit(now: number): void
}
interface DecayClock { tick(now: number): void }
```

The interface is not the important part; the important part is that callers stop writing
`Concept.priority` and stop invoking decay as a side effect of reading.

- `decayAll` leaves `sample()` and `sampleWindow()` (`memory.ts:354,370`). Both become pure reads.
  `consolidate` (`:381`) is the only clock tick left, called from one place.
- `activationDecayRate` means what the configuration says. §13's sweep table collapses to one row.
- `getGoals()` stops minting stamps: minted at write, stored, read on get. `Stamp.overlaps` and
  `noStampOverlap` become well-defined for goals, which they are not today.
- **Make the invariant a type before making it a rule.** `priority`'s public setter is the root of
  finding 6, and sixteen sites compile against it, so "one owner" could otherwise only be policed by
  review or a grep. The fix is representational, and it is this repository's own stated philosophy:
  `priority` becomes a read-only getter, and mutation moves behind an internal writer only the
  attention owner holds. A new writer then fails to compile rather than failing a gate, and the
  write-surface test becomes a backstop.
- The ten external writers become a small set of named operations — input touch, related touch, decay,
  reinforce, replay, deserialise, self-tune. Each has one caller and one reason type.
- **Decide the scorer's fate** (finding 3): either wire novelty and relevance to real signals —
  relatedness from the link port, recency from `lastAccessedAt` — and keep four factors, or delete
  two and select by attention order. The current answer is neither, and this is a *design* decision
  to be recorded with its reason. It belongs here because it decides what `topK` means, and `topK` is
  the contract TODO30 will measure.
- `SpreadingActivation` and `Concept.updateLinks` either get a populated link graph or are deleted.
  `linkedConcepts` is written only by `mergeWith`, so today they are no-ops wearing a cost, and
  `inference-controller.ts:104-110` applies their boost regardless.

**Acceptance — all met 2026-10-01 (§0.8.8)**

- ~~`Concept.priority` has no public setter, and the only module that can write it is the attention
  owner's~~ — the setter is gone; `writeAttention(AttentionEvent)` is the only write, and
  `attention:write-surface` enumerates the reasons and asserts a setter has not come back;
- ~~`decayAll` has exactly one call site, and `maxSampledConcepts` appears in no decay
  measurement~~ — one call site (`consolidate`), and the sweep is passed the cycles elapsed rather
  than a literal `1`;
- ~~reading a concept twice without an intervening write returns the same identity and the same
  stamp~~ — `getGoals()` reads a stamp minted at admission, and sampling moves nothing;
- ~~the attention and clock implementations are replaceable without changing any caller~~ — already
  true after A5, and now exercised: a store's decay is whatever the installed model says, and
  swapping `SimpleAttention` for `NullAttentionModel` changes no caller;
- ~~the RL/parity baselines are re-established **here, once**, and committed in the same
  change~~ — measured and committed: gridworld **0.6459** (unchanged), bandit **0.7206** (was
  0.8240), non-stationary **0.8316** (was 0.9565), all above the 0.60 floors, bandit reproduced
  0.7206 exactly on a repeat.


### 5.5 A5 — Make `Memory` a set of ports

*For finding 2. Split the 646 lines along the responsibilities §1.2 of `TODO29.md` already
enumerates: storage → `ConceptStore`, per-concept beliefs → `BeliefTable`, links → a link port, goals
→ a goal enumeration port, statistics → a statistics view. **Start with the simplest correct
implementation plus a test double**; sophisticated backends are TODO30 §4 and §7, and are only
possible once the ports exist.*

The purpose is dependency inversion:

> reasoning code depends on the concept of storage, not on one concrete all-purpose implementation.

`MemoryView` (`memory/view.ts`, 34 lines) is already the seam the strategies use; this widens it
rather than inventing a parallel one.

**This item lands before A4, and the reason is attribution, not risk.** A4 is the one deliberate
behaviour change and A5 is the largest mechanical diff; in one window the behavioural delta is
unattributable, because every learned value moves *and* every call site moves. Splitting the lines
first costs nothing — it is mechanical and parity-guarded — and leaves A4 as a small diff against a
structure that is already final.

**Acceptance** — all five **met 2026-10-01**, recorded here so the next reader does not re-derive them
(§0.8.7 has what landed and what it cost):

- cycle code depends on ports, not on `Memory` — **and gated**: `pnpm memory:ports` fails on a
  cycle-path import of `nar/src/memory/memory.ts`, with two declared composition sites;
- storage details do not leak into reasoning code — **with one honest exception**: `MemoryView` still
  returns the concrete `Focus`, which is A4's to replace, and `Memory` still exposes
  `getLinkManager()` for assembly and tests;
- each port has focused unit tests that construct it directly — `FakeStore` in
  `tests/nar/todo29a-a5.test.ts` implements every port over an array and drives the three real
  consumers with no `Memory` in sight;
- existing semantic tests still cover current behaviour through the ports — `pnpm test:unit` green
  (324 files), no behaviour moved;
- the port contracts mention no concrete type, so an implementation can be swapped without touching a
  caller — **except `MemoryView.getFocus()`**, and the exception is A4's, not this item's.

**The item's own half of §12's wrapper risk is closed and the other half is not.** The gate says no
cycle-path module names the facade, so the cycle cannot be depending on a forwarding god-object. But
`Memory` is still one class holding nine responsibilities, and the ports are satisfied by delegation
rather than by extraction — "storage is a port" is true as a *dependency* claim and false as an
*implementation* claim. The extraction is TODO30 §4's job, and it can be measured through these ports
now.


### 5.6 A6 — Define inference dispatch as an architectural port

*For findings 7 and 8.*

```text
InferenceTable
  lookup(antecedentKind, consequentKind)
  dispatch(...)
```

Three decisions, none of them "make it faster", two of them already made by measurement:

- the rule representation and the dispatch implementation become separate, so a replacement costs one
  file;
- **`*:*` goes, and it is safe to say so**: zero of 55 registered rules use a wildcard bucket, so the
  three wildcard lookups are dead work on the innermost path. Make `createRulePattern`'s two
  parameters required — the type already forbids wildcards for DSL rules — delete the three lookups,
  and keep the census as the test that fails when a rule arrives without a kind pair. The durable
  invariant is *"a rule declares its kinds or it does not register"*, which is a better contract than
  "there is a catch-all";
- the `RuleIndex` tie-break is either exercised by a test — `recordRuleHit` is called and the field
  has data — or deleted. It is currently a comparator that orders nothing, wearing a comment that
  explains why it orders nothing. This is the one decision left, and it is semantic, not structural.

**Do not** require tries, DAGs, decision trees or generated code here. TODO30 §6 chooses among them
from a measured workload, after measuring the candidate count that survives winnowing.

**Acceptance**

- inference code depends on the dispatch interface;
- `createRulePattern` requires both kinds, and a test fails if any registered rule sits under a
  wildcard key — the census, as a gate;
- the tie-break is either specified-and-tested or gone;
- NAL parity green;
- existing rule-ordering behaviour is explicitly preserved or explicitly recorded as a semantic
  change, with the NAL suites as the gate;
- any cache keyed on rule ordering invalidates on the state its ordering depended on — the shape
  `RuleIndex.ordered` already gets right with `rankingEpoch`, and the shape `stepScalars` gets wrong.


### 5.7 A7 — Define control budgets as semantics

*For the per-cycle-caller half of finding 2.*

**Use the budget system the kernel already has.** `ReasoningBudget` is a schema in
`@senars/core/schemas/reasoning-budget`; `KernelBudgetGate` accounts it per-focus by `scopeId` and
already names its failure modes — `cycle-budget`, `depth-budget`, `llm-budget`, `deadline`,
`backpressure` — as a `TerminationReason` enum. A second budget concept would be a second accounting
of the same resource, and the two would drift.

So the bounds below are `ReasoningBudget` scopes with named `scopeId`s, not a new mechanism:
derivations per step; secondary premise consideration; proposal application; control/meta work; and
**decision-layer derivations** — its own scope, deliberately *not* shared with `derivations per step`.

**That last separation is load-bearing.** §2.4 requires `S` to be invariant across all four
configurations. If decision-layer output drew on the same derivation budget as symbolic output, then
decision-layer load would change how many symbolic derivations a cycle can afford — and `S`'s
behaviour would become budget-dependent, which is the coupling §1.2's committed-state rule exists to
prevent. Separate scopes mean decision-layer load can exhaust *its own* budget and stop, while `S`'s
derivations are untouched. The **relative** cost of the two scopes is a configuration value, so the
trade-off can be tuned (eventually from measured feedback, via `SelfOptimizer`) without either scope
absorbing the other — which is only expressible because they are separate `scopeId`s.

`NARExecution.run` (`nar-execution.ts:184-379`) runs a fixed sequence of control and meta steps per
cycle, including two population-sized `getGoals()` calls (`:417` in `emitCognitiveStateSummary`,
`:455` in `injectMetaGoals`) and an O(N)-plus-two-sorts `getStatistics()` (`:424`). **The bound is
architectural — "a step may not be unbounded merely because no cost model has been written yet" — and
how cheaply the budget is executed is TODO30's.** Naming them now gives A4's read-purity work and
A6's dispatch work a place to *stop*.

**Acceptance**

- every budget is a `ReasoningBudget` scope with a named owner, a default, a configuration source, a
  `TerminationReason` for overflow, and a test demonstrating enforcement;
- **`decision-derivations` is a distinct `scopeId` from the symbolic derivation scope**, and a test
  shows the symbolic derivation count for a fixed episode is unchanged when the decision-layer budget
  is set to zero — i.e. `S`'s invariance across the four configurations is budgeted, not asserted;
- the shadowed `resetMetaBudget` name is gone from one of the two places it exists;
- the per-cycle `getGoals` / `getStatistics` callers are budgeted or removed, and the decision is
  recorded;
- `proposal-application` is a budget scope with A3's overflow behaviour, so a full queue and a spent
  budget are the same kind of event with the same kind of reason.


### 5.8 A8 — Define memory and resource contracts

*For finding 4.*

> **Every unbounded resource has an explicit owner and a declared lifecycle policy** — what it holds,
> who owns it, its capacity, its retention rule, its overflow behaviour, and the signal it raises
> when capacity cannot be reclaimed.

For each resource, a reviewable record:

```text
resource · owner · capacity · retention policy · overflow behaviour · pressure signal
```

Specifically for memory:

- `capacityPressure()` accounts for the dominant consumer, not only `concepts.size`. `totals()`
  already reports `totalTasks`; eviction does not read it.
- the candidate filter stops being anti-correlated with pressure: a concept must be able to age out
  *while holding tasks*, ranked by age × value.
- eviction must be able to **report that it could not free anything** rather than returning a silent
  `{ archived: 0, forgotten: 0 }`.
- the accumulator ledger grows from its 2 declared sites to every production container that can grow,
  and the textual `LruCache`/`maxSize` check is replaced by gating the *declaration*.

**Do not redesign the eviction data structures here** — that is TODO30 §7.

**Acceptance**

- a reviewable inventory exists for every production accumulator that can grow without an explicit
  bound;
- memory pressure is monotonically related to every bounded resource it reports;
- a memory at 99% with nothing evictable says so, and a test asserts it says so;
- the ledger covers every site the accumulator gate declares as cycle-path;
- `capacityPressure()` and the policy it names are the same quantity, asserted by a test rather than
  by a comment — finding 4 is a disagreement between a signal and a policy, and it survived because
  nothing compared them.


### 5.9 A9 — Deterministic replay

**A proposal is a `CognitiveEvent`, and the fixture is the event log the kernel already keeps.** The
repository is event-sourced — README: "the event log is the cryptographic source of truth", with
`SqliteEventLog` / `InMemoryEventLog` and pure reducers (`kernel/replay.ts`,
`replayCognitiveState`, `EventLogPersistence.ts`). A proposal *is* an untrusted write attempt, so
inventing a parallel fixture format would be the same mistake as inventing a parallel budget system
in A7: a second representation of state that can disagree with the first. A9 therefore extends the
existing reducer with `proposal.*` event kinds and nothing else.

```text
core state
+ recorded proposal events
+ configuration
+ deterministic inputs
```

with no live provider involved. Schema/version mismatches must fail explicitly rather than silently
replaying against incompatible state — and the proposal schema is the *first* thing in this
repository that a recorded fixture from a future commit would silently mis-apply.

**Acceptance**

- a live provider is unnecessary for the hermetic tier;
- `replayCognitiveState` reconstructs the same state from a log containing `proposal.*` events, and
  the reduction is a pure function of the log;
- a recorded proposal stream replays identically, twice;
- an incompatible proposal version fails loudly, with a test that asserts the failure;
- a proposal stream recorded against revision *R* is rejected against *R+1*.


### 5.10 A10 — The rule path: the reaction table is admitted data, not an import side effect

*For finding 14. **This is the item that carries the thesis.** Everything else here makes the
existing system well-bounded; this is the one that makes the rule set grow while the system runs.*

Today `rules/impls/registration.ts` assembles the 55 NAL and extended-NAL rules and registers them
on a global `RuleRegistry` **as a module side effect** — importing the module changes the rule set.
Three consequences, and they compound:

1. **The rule set cannot be loaded, versioned, swapped or rolled back.** It is code, and it is
   whatever the import graph happened to contain. A schema migration has no meaning for it.
2. **A proposal can carry a perfectly well-formed new reaction and there is no path by which it
   becomes one.** A3 delivers bytes to a door with nothing on the other side. Until this item lands,
   "the rule set is a learnable, versioned artifact" is a claim about a transport.
3. **It is the same hidden-global defect A1 fixes for the gate registry, in the place where it is
   most consequential**: a global mutated by an import, which no test can distinguish from a global
   mutated by a caller.

- **Registration moves behind the `InferenceTable` port** (A6). No module other than the port's
  implementation may mutate the rule set, and the port can enumerate it.
- **The built-in table becomes a versioned artifact** with a schema version, loaded through the seam:
  validated, recorded, revertable. README's rule matrix is then *generated* from it rather than
  transcribed, which closes the second hand-maintained source of truth in the tree.
- **This is the rule-proposal path of A3, and only that path.** A content proposal lands in memory
  through `PerceptionGate` and needs none of this. A *rule* proposal is the only thing in the system
  that changes what every future derivation can conclude — which is why it is the only thing that
  gets versioning, a schema, a refusal event on overflow, and a revert.
- **Absence becomes a value.** "No table loaded" is a state the core runs in — the same "absent, not
  disabled" property §2.3 demands of the induction layer, applied to the rules. A NAR with an empty
  table initialises, runs cycles and reports zero derivations; it does not fall over, and it does not
  silently reach the NAL rules through some other import.
- **Learned rules are revertable.** A seam whose outputs cannot be undone is a deployment, not an
  artifact. *Roll the rule set back* is an operation, not a restart.
- **A rule may not change the rule set mid-cycle.** That is A3's boundary rule, and it is why this
  item follows A3 rather than preceding it.

#### Rule artifact identity

Every entry in the table carries its own identity, so that "revertable" is a state-machine property
rather than a claim:

```ts
interface RuleArtifactEntry {
  artifactVersion: string;        // the shipped table artifact's version
  ruleSetRevision: number;        // monotonic; the table revision this entry entered at
  ruleId: string;
  ruleSchemaVersion: number;
  parentRevision: number | null;  // the baseRevision it was admitted against (null if builtin)
  provenance: RuleProvenance;     // { kind: 'builtin' | 'proposal' | 'import'; producer?; eventId? }
}
```

The durable requirements, each testable:

- **two table revisions are comparable** — a diff of *R* against *R+1* is enumerable (added, removed,
  superseded), which is what a revert needs and what `git diff` gives for code;
- **a previous revision is restorable without reconstructing the original import graph** — the entry's
  `parentRevision` and `provenance` are sufficient, because the import graph is exactly the thing A10
  deletes;
- **admission is one committed transition** (§3.3), so the table revision and the event that created
  it cannot disagree.

**Acceptance**

- deleting the registration import leaves a core with an empty rule table that still initialises,
  runs a cycle and reports zero derivations — absence, not a crash;
- a rule added at runtime through the seam appears in dispatch, is in the event log, carries its
  `ruleSetRevision` and `provenance`, and can be reverted to the previous revision;
- **two revisions are diffable and a prior revision is restored from the artifact alone** — no import
  graph, no replay of the admission sequence, no reconstruction;
- the in-memory dispatch index is reconstructed from committed state and is never independently
  authoritative — a test that mutates the index alone does not change the reconstructed table, and a
  test that replays the log does;
- a table artifact with an incompatible schema version fails loudly at load, and a recorded artifact
  replays identically;
- the loaded table and the code-registered table produce **identical derivations** on the NAL suites —
  this item adds a capability, and parity is how you prove it added one without changing anything
  else;
- the table is enumerable at runtime: ids, kinds, revisions, provenance, artifact version.


### 5.11 A11 — make the decision layer reachable from the reasoning cycle

*Small, and it is what makes §2's central claim true rather than aspirational. It follows A1,
because the port is only safe once every call through it is bounded.*

**The premise of the earlier draft of this item was wrong, and the correction makes it cheaper.**
The plan previously said the only model-reasoning capability reachable from core is the `J`
injected into `PerceptionGate`, so A11 was an invention. It is not. `nar/src/lm/system-one/` is a
**complete, typed, calibrated, open-technique decision layer**: `classify` and `evaluate` queries,
`synthesize` for open generation, `CognitiveAxis` on every query and proposition, `abstainReason` on
every result, isotonic calibrators with a digest-pinned lock, `ConfidenceRouter`, `compositeScore`,
`judgeCascade`, per-head rubrics, and `ResourceCost` on every answer.

**The actual finding is that it is wired to the wrong side of the system.** `facade/system-one.ts:337`
attaches a `ManifoldReflex` to a **`GameFocus`** — the agent/game apparatus — and `nar.ts:571` only
forwards that. So a rich decision capability is reachable from the RL side of the boundary and not
from the reasoning cycle, while the reasoning cycle reaches a model by two *other* routes: the ingress
judge and `processLMRules`. §9 already excludes `game/` and `focus/` as targets, so this item is not
"wire the manifold in" — it is **give the reasoning cycle its own typed port to the layer that already
exists**, and leave the agent-side binding alone.

- The core declares **one optional port**, typed in the layer's own vocabulary rather than a new one,
  so §9's "no new abstraction where one already exists" holds:

  ```ts
  /** Reuses the committed decision-layer contracts verbatim. */
  type DecisionRequest = JudgmentQuery | SynthesisQuery;        // types.ts:87
  type DecisionResult  = JudgmentProposition | SynthesisProposition;

  interface DecisionPort {
    ask(request: DecisionRequest): Promise<DecisionResult | null>   // null = no port bound
  }
  ```

  `null` is safe **only** because absence is per-*call-site*: a call site with no port bound takes its
  own declared path, and a bound port's own failure modes are already distinguished in-band by
  `PropositionBase.abstained` / `abstainReason` (`types.ts:114-121`). A proposal that *is* a write
  attempt still goes through A3's seam; `SynthesisQuery` produces candidates, not admissions.
- **Axis, budget and position are declared in the request**, so each is a compile-time requirement:

  ```ts
  type CycleDecisionRequest =
    | (JudgmentQuery & { budget: BudgetScope; position: 'cycle' })
    | (SynthesisQuery & { budget: BudgetScope; position: 'boundary' })
  ```

  `SynthesisQuery` is excluded from `'cycle'` in the type, which is §2's "`P` at a boundary"
  constraint made unrepresentable-away rather than documented.
- Every stage that could use a bounded answer takes the port **injected and optional**: premise
  formation, rule selection, contradiction adjudication, goal handling, attention, consolidation,
  explanation. A stage with no port configured follows its own path — the four-configuration matrix in
  miniature, per stage.
- **The port is advisory.** An answer never writes state directly: a **Belief** answer is admitted
  through `PerceptionGate` at the source-quality ceiling, a **Goal** answer may only move
  `Desire`, and anything that writes priority writes through the owner A4 establishes. A port
  reachable from every stage that can also write is the shape of the bug this whole plan is about, so
  the port's return type is a decision, not an effect.
- **The cascade and router are reused, not rebuilt.** `judgeCascade` (stage 2's space derived from
  stage 1), `ConfidenceRouter` (bands → act / review / block / abstain) and `compositeScore` are the
  decision-layer's own composition, and they are exactly the "where `J` earns its place" question —
  already answered as a mechanism, pending a measurement of which sites pay.

**Acceptance**

- **a stage without a model port follows the existing symbolic path with identical observable
  semantics** — same admitted tasks, same derivations, same stamps; *not* "byte-identical to today",
  which is not an architectural property and which the implementation cannot deliver;
- **a stage with a decision port may obtain additional information, but absence, refusal, timeout,
  breaker-open and out-of-domain cannot prevent completion or bypass the normal gate/admission
  path** — asserted separately per `abstainReason`, and by a stage whose backend hangs;
- **Belief and Goal are honoured per call site**: a `Goal` answer that reaches `Truth` fails
  `config:model-matrix`, and a `Belief` answer admitted above its head's source-quality ceiling
  fails it too;
- the port is unreachable from any write path without going through a gate (a test, not a review);
- **an answer that concludes something is an in-band derivation**: admitted through the normal
  derivation-admission path, never by direct write, counted against the A7 derivation budget, on the
  Belief/Goal split it declared (§1.2 clause 2, §2.6); and the NAL suites still pass with the
  port bound;
- every call site is in a declared manifest with its query kind, Belief/Goal, budget and position, and
  an undeclared one — or a `SynthesisQuery` declaring `position: 'cycle'` — fails
  `config:model-matrix`;
- `J` never authorizes, gates, approves or rejects `P` — a test, because the word "judgment" invites
  exactly that confusion (§2.1);
- **an uncalibrated or lock-mismatched provider's scores are clamped at the gate, not believed** — the
  existing `calibration-lock.json` digest check is the gate, and this item's manifest is where a head
  is bound.


### 5.12 A12 — Canonical form: term reducers and task reducers

*Not in the original twelve. Added 2026-09-30, because A1's model matrix made a redundancy visible that
is not a performance problem and not a memory-structure problem: the term layer has no canonical form.*

`(a | (a | c))` and `(a | c)` are the same claim, and they intern to different `termKey`s
(`nar/src/terms/impls/factory.ts:61`), so they occupy two concepts and two derivation records. Two
reductions in the same shape follow from the same omission:

```text
(a | (a | c))        ≡  (a | c)              associativity
(a & a)              ≡  a                    idempotence
--x. %0.8%           |-  x. %0.2%            (--x).f = 1 - f_x, whole range
x. %0.2%             |-  --x. %0.8%
--x. %1%             |-  x. %0%              the same rule at the endpoints
x. %0%               |-  --x. %1%
```

`createCompound` already sorts commutative args and already collapses empty compounds to `TRUE`/`FALSE`.
What is missing is everything that makes the form *canonical* rather than *interned*: flattening nested
same-kind compounds, dropping repeated args, pushing negations inward, and folding the frequency
extremes. Each is a NAL axiom, so each is sound; none is implemented, and none is a TODO30 question.

**Status: step 1 is done (§0.8.2), its `^name` remainder is done (§0.8.3), and §0.8.4's n-ary
statement gap is closed.** The decisions below were made while landing it. **What is left of A12 is the
reducers below** — the behavioural half, which waits for A4's baselines, as §5.12's own sequencing
paragraph says.

**Sequencing within this item, and the two halves are not equal.** §5.12.1 — the grammar/symbol/kind
alignment — is a **correctness fix whose baseline is "broken"**, so it needs no attribution window and no
waiting on A4: six kinds cannot round-trip at all, and no measurement can be attributed to a change that
makes an unreadable thing readable. The reducers below are the behavioural half and they wait for A4's
baselines. Doing step 1 first also removes a hazard from every later item: a reducer written against a
grammar that cannot read its own output is untestable, and the acceptance below depends on round-tripping.

**Why it is in this plan and not TODO30.** TODO30 owns *what the store does with* a term — indexes,
containers, dedup of terms **already persisted**. It does not own *what a term is*, and a plan that
leaves canonical form to a performance pass will either never do it or do it as an optimisation
laundering a semantic change. It is also the same class of item as A4: a behaviour change whose
attribution must be clean, which is why it is its own item rather than folded into A6's dispatch work.

**The abstraction, because more reducers are coming.** Not a `switch` in `createCompound`, and not a
per-call-site normalisation pass — §10.1's rule, in the shape this repository keeps hitting: a
documented intent with no mechanism behind it. One registry, two levels:

```ts
/** nar/src/terms/reduce.ts */
export interface TermReducer {
  readonly id: string;
  applies(term: Term): boolean;
  reduce(term: Term): Term;
}

/** nar/src/terms/reduce-task.ts — the same shape over a claim rather than a formula. */
export interface TaskReducer {
  readonly id: string;
  applies(task: Task): boolean;
  reduce(task: Task): Task;
}

export const TERM_REDUCERS: readonly TermReducer[];
export const TASK_REDUCERS: readonly TaskReducer[];
export const canonicalTerm = (term: Term): Term;    // fixpoint over TERM_REDUCERS
export const canonicalTask = (task: Task): Task;    // canonicalTerm, then fixpoint over TASK_REDUCERS
```

Applied at **construction** — `createCompound` canonicalises before it computes `termKey`, and
`createTask` canonicalises before the task is stored — which is what makes `termsEqual`, interning and
memory dedup agree for free instead of agreeing by luck on whichever producer normalised.

**How to add a reducer, so the next one is an append and not a redesign.** Four steps, and the registry
is the only thing that changes: (1) implement `{ id, applies, reduce }`; (2) add it to `TERM_REDUCERS` or
`TASK_REDUCERS`, **at most one step from a canonical term** — a reducer that needs two passes to see its
own output is a fixpoint the pipeline cannot guarantee; (3) add its cases to the round-trip and
canonical-form properties, including one already-canonical input that must come back *identical* (the
no-allocation claim in acceptance depends on it); (4) run the NAL suites, where a parity change is a
finding about that reducer rather than a baseline to regenerate. Reducers must be **commuting with each
other** — `flatten ∘ dedupe ∘ sort` and `dedupe ∘ flatten ∘ sort` must agree — which the idempotence
property above is what actually tests. A reducer that *removes* an operator kind is a §9 boundary
decision, not an entry in a list.

**The catalogue, with what is decided and what is not.**

| reducer | level | decided | note |
|---|---|---|---|
| `flatten-nested` | term | **yes** — conjunction, disjunction, parallel, **product (flatten, never sort)** | never implication, equivalence, instance or property: nesting or membership there is meaningful. `product` is associative but not commutative (§4 row 18), so flattening and sorting are different reducers for it |
| `dedupe-args` | term | **yes** | `(a & a) → a`; one arg collapses to itself, zero to `TRUE`/`FALSE` as today |
| `sort-args` | term | already exists | the one reducer that needs no new code |
| `double-negation` | term | **yes** | `--x → x` |
| `negation-normal-form` | term | **yes** | De Morgan in both directions, plus the implication/equivalence contrapositive: `(a ==> --b) |- --(a ==> b)` and `(--a ==> b) |- (a ==> --b)` |
| `negation-into-truth` | task | **the rule is yes; the direction is open** | NAL's negation rule is general, not a special case at the extremes: `(--x).f = 1 − f_x`, same confidence. So `--x. %0.8%` and `x. %0.2%` are one claim, and `%1%`/`%0%` are only its endpoints. See below — the rule is settled, the canonical spelling is a choice |
| `constant-folding` | task | **open** | `TRUE. %1%` and `FALSE. %0%` are identities; whether they are rewritten or dropped is a policy question, and dropping a `c=0` task is a *policy*, not a normalisation — A8's territory, not this item's |
| `absorption` | task | **open** | `(a & --a) → FALSE` is a truth-level identity, not a syntactic one, and needs the truth function to be named |

**The reference reducer suite is in the tree.** `docs/java/TermReductionsTest.java` is OpenNARS'
`TermReductionsTest`, committed deliberately (2026-09-30) as the catalogue this item is measured
against. Read rather than copied, because half of it is about operators this tree does not have — and
knowing which half is the design. What it contributes:

| from the reference | adopt? | note |
|---|---|---|
| `InterCONJxt/ntReduction1–3` — associativity for `&&` and `||`, multi-level | **yes** | this is `flatten-nested`. Our commutative n-ary kinds are `conjunction`, `disjunction`, `parallel` — **`product` is n-ary but not commutative** (§4 row 18), so flattening it is an *associativity* reducer that must not sort |
| `IntExtEqual` — `CONJ(p, p) == p` | **yes** | idempotence, `dedupe-args` |
| `InterCONJntReduction_to_one` — a compound of one distinct member *is* that member | **yes** | `(&&,P)` must not exist; ours collapses to `TRUE` on *zero* args today, and the one-arg case is the other half of the same rule |
| `Multireduction` — reduction applied repeatedly reaches one form | **yes** | the acceptance property below; it is a *fixpoint* requirement, not a single pass |
| `embeddedSetDontFlatten` — `{{1,2},3}` does **not** flatten | **yes, as a boundary** | the nearest equivalent here is that a unary `instance`/`property` is never entered. Recorded because it is the test that says *where flattening stops*, and a reducer with no stated boundary has one by accident |
| `ConjunctionParallelWithConjunctionParallel` — `(&&,a,b,c)` ≡ `((b&|c)&|a)`, members sorted into a canonical grouping | **open** | we have `parallel`, so the operator exists; the canonical grouping rule for it is not decided, and getting it wrong makes the form non-unique rather than wrong |
| `DisjunctionReduction1/2` — `(x:a \| x:b \| …)` ≡ `(a-->x \| b-->x \| …)` | **open, deliberately deferred** | a rewrite *across* operator kinds. Our rule table matches on inheritance patterns (§4 row 8's census), so collapsing product form into inheritance form can change which rules fire — that is A6's dispatch question wearing a term-layer costume. Record, do not implement here |
| `Difference*`, `DifferenceSorted`, `DiffEqual` — `-,` normalisation, `diff(p,p) → FALSE` | **not applicable** | there is no difference operator in `OPERATORS` (`nar/src/terms/operators.ts:5`). If one is added, it arrives with its own reducer and its own boundary conditions — not by extending this item |
| `TemporalConjunction*`, `RepeatInverseEquivalent` — `&&+k` intervals, `(x &&-1 x) == (x &&+1 x)` | **not applicable** | same: temporal intervals are a term-kind this tree does not have, and their identities need interval arithmetic rather than canonicalisation |
| `TemporalConjunctionReduction2`, `DisallowInhAndSim…` — `@Disabled` | **kept as-is** | upstream keeps a diagnosis next to the missing behaviour rather than deleting it, which is §10.1's rule applied by someone else first |

**Canonical Narsese form: dense, and for bytes.** `(a&b)`, `(a,b)`, `(a-->b)`, `(a||b)`, `(a,/b)` — no
padding anywhere, because every space lands in every serialised term, every key built from one and every
log line. `(a,b)` stays the product's canonical spelling rather than `(*,a,b)`, on the same grounds: it is
shorter and it is what the grammar reads. The full decision, and the grammar work that has to precede it,
is §5.12.1 — including the correction of this paragraph's earlier revision.

**The negation rule, in full, because "frequency extremes" was an understatement.** NAL's negation
rule is a *function*, not a pair of endpoints:

```text
(--x).f = 1 − f_x ,  c = c_x        so   --x. %0.8%  ≡  x. %0.2%
                                     and --x. %1%    ≡  x. %0%     (the same rule, at the ends)
```

Confidence is carried through untouched, and the **stamp is not rewritten** — this is the same claim
spelled twice, not a revision of it, so the reduction belongs in canonical form and not in
`Truth.revision`. That distinction is the whole reason it is a task reducer rather than a truth-function
rule: `revision` is for a new belief about the world, this is the same belief with a different surface.

**What is still a choice: which spelling survives.** Two claims, one truth, and a canonical form has to
pick one — otherwise every reduction is a no-op on a term the system wrote both ways.

| policy | rule | what it preserves | what it costs |
|---|---|---|---|
| **P1 — positive head** | `--x. %f%c% → x. %(1−f)%c%` | a task head is never a bare negation | a rule that tests `term.kind === 'negation'` at the *task head* stops firing; negation survives only inside compounds and on subterms |
| **P2 — doubted claims stay negated** (recommended) | `x. %f%c% → --x. %(1−f)%c%` when `f < 0.5` | doubt is visible as a negation, which is how Narsese authors write it, and no authored structure is destroyed | a task head *can* be a bare negation, so both spellings exist in memory and any consumer must handle a negated head |

P2 is the recommendation because it is the smaller change: it adds a convention rather than removing one,
and it cannot silently disable a rule that matches negated heads. Either way the reduction is a *tie-break*
— exactly one of the two spellings is canonical — and after this lands *no construction path* may produce
the losing one, or the pair reappears in memory. That includes the parsers: a task read from Narsese text
goes through `canonicalTask` on the way in, or the round-trip gate will catch it. **Recorded as open, deliberately:** the choice
belongs with whoever writes the reducers and reads the rule table for negated-head assumptions, and a test
must pin whichever is chosen (`P2` ⇒ a task with f < 0.5 and an unnegated head never survives
canonicalisation).

**Acceptance**

- `canonical(canonical(t)) === canonical(t)` and `canonical(t)` equals `t` for already-canonical terms,
  over the term corpus the NAL suites build — a property test, not a spot check;
- the NAL suites are unchanged in what they derive: parity is the gate, and any difference is a finding
  about a reducer that is not sound rather than a baseline to regenerate;
- two spellings of one claim reach memory as one concept, asserted on a term pair rather than on a
  statistic;
- `(--x).f = 1 − f_x` holds as a canonical-form property for the whole range, not only the endpoints:
  `--x. %0.8%` and `x. %0.2%` are one task, `--x. %1%` and `x. %0%` are one task, confidence preserved in
  both, and the stamp is unchanged by the reduction;
- `canonicalTerm` is on the hot path, so a benchmark-free budget stands in its place: every reducer
  returns `applies(t) === false` on a canonical term, so a fixed point costs one pass and no allocation
  (asserted by object identity on the common path);
- a persisted state written before the change still loads: this is the one place where the term layer's
  change meets A9's version story, and a term key that no longer exists is a migration, not a detail —
  **so the schema version is bumped in the same commit and TODO30 owns the re-keying of stored terms**.

**Risk: medium, and it is entirely the parity risk.** Every reducer here changes derived terms, which
is the one thing §7 invariant 1 protects. That is why it is its own item, in its own commit, after A4's
baselines are re-established, and gated on the four suites that actually exist.

---

### 5.12.1 A12's first step: align the operator table with the grammar

*Recorded 2026-09-30 from a review of `docs/java/Op.java` and `nar/src/terms/narsese.peggy`. A canonical
form that the parser cannot read is not canonical, so this precedes every reducer in §5.12 — and it is
where the review found the largest defect in the term layer, which is not formatting.*

**Findings, all reproduced in one probe** (`toNarsese` → `fromNarsese` per kind):

| kind | serialises as | reads back as | verdict |
|---|---|---|---|
| `inheritance` `similarity` `conjunction` `disjunction` `negation` `equivalence` `sequence` `product` | `(a-->b)` … `(a,b)` | same | **round-trips** |
| `implication` | `(a=>b)` | parse failure | **wrong symbol**: Narsese spells it `==>`, and the grammar has only ever accepted `==>` (`narsese.peggy:4`) |
| `parallel` | `(a||b)` | `(a|b)` — a disjunction | **wrong symbol**: the grammar's token is `&|` |
| `predictive` / `retrospective` | `(a/>b)` / `(a/<b)` | parse failure | **wrong symbols**: the grammar's are `=/>` and `=\|` |
| `instance` / `property` | `{a}` / `[a]` | `(a)` | **wrong kinds**: the grammar builds `setExt` / `setInt`, and upstream names them **extensional set `{a}`** and **intensional set `[a]`** — our `instance`/`property` names are a NAL2-rules naming that leaked into the term kinds |
| `operation` | `a^b` (unparenthesised) | `a^b` | **not a compound any more**: a round-trip silently loses the parens that make it one |

**`product` is the comma copula, and was wired to the wrong kind.** `TermBuilder.tuple` called
`createCompound('conjunction', …)` (`nar/src/terms/impls/factory.ts:107`), and the grammar routes the
comma list through `tuple` (`narsese.peggy:118`). So `(a,b)` built a **conjunction**, every product in
the tree was indistinguishable from one, and `product` had no text syntax at all — while five call sites
(`rl/impls/QBeliefStore.ts:63`, `terms/impls/operation-term.ts:58`) already called `TermBuilder.product(a, b)`
with two arguments, against a builder that had no such method. **The fix is a rename, not an addition:**
`tuple` becomes `product`, with no `tuple` alias left behind, and the parser is regenerated from
`narsese.peggy` (`npx peggy -o nar/src/terms/peggy-generated.cjs nar/src/terms/narsese.peggy` — the
generated file is committed, so the grammar and the parser cannot disagree silently).

**Why the round-trip property test never caught any of it.** `tests/nar/property/narsese-roundtrip.test.ts`
enumerates its kinds by hand — `inheritance`, `similarity`, `conjunction`, `disjunction`, `negation` — and
those are exactly the five that work. **The generator is the bug**: it is a list of what passes, written
as if it were a list of what exists. It must derive its kinds from `OPERATORS`, and the broken kinds
must appear as *named expectations* — assert that `parallel` does not round-trip, by what it becomes —
so that fixing the grammar makes a test fail and say so, and adding an operator makes a test fail because
nobody wrote its round-trip yet. That is §10.1's rule with the generator in the place of the doc comment.

**Canonical Narsese form: no padding.** `(a&b)`, `(a,b)`, `(a-->b)`, `(a||b)`, `(a,/b)`, `(a==>b)` — dense,
and the product keeps the comma short-hand rather than `(*,a,b)`. **The reason is bytes, not
readability**: every space a serialiser emits is a byte in every serialised term, in every `termKey` built
from one, in every persisted state and every log line, and canonical form is the form that gets stored
copied the most. One separator constant (`ARGUMENT_SEPARATOR`), no spacing rule anywhere, and the operator
symbols as Narsese writes them. Correcting an earlier note in this document: a previous revision justified
keeping `(a & b)` by "the space is part of reading the operator". That was a rationalisation, and it was
wrong.

**Consequence to be aware of before starting.** Serialisation is asserted as literal strings in ~70 places
across the NAL suites and elsewhere, so this step's diff is dominated by mechanical string updates. Do it
as its own commit, before the reducers of §5.12, with the NAL suites as the gate — and do **not** fold the
`product`/`parallel`/`implication` semantics in with the whitespace: semantics first, whitespace second,
so a parity failure has one cause.

---

### 5.13 Item summary — one command, one gate, one risk

Every acceptance criterion above is demonstrated by a command and a gate. Gates are wired into
`pnpm gates` **with the item that needs them** (§10).

| item | verified by | gate lands with it | risk |
|---|---|---|---|
| **A0** | `pnpm run cycle:no-provider && pnpm run induction:inventory && pnpm bench:cycle -- --selftest && pnpm test:hermetic` — **done 2026-09-30** | `cycle:no-provider`, `induction:inventory` (both landed in their A0 form; shared with A1) | **none** — pure instrumentation; no reasoning path touched |
| **A1** | `pnpm run cycle:no-provider && pnpm run rule:has-fallback && pnpm run gates:one-cycle-path && pnpm run config:model-matrix`, `pnpm test:determinism`, NAL suites — **done 2026-09-30** | `cycle:no-provider`, `rule:has-fallback`, `config:model-matrix`, `gates:one-cycle-path`, `induction:inventory` | **medium** — the only item that changes reasoning behaviour: not the derivations, but the *timing* of when rules exist, which changes the sequence over a fixed episode |
| **A2** | `pnpm run core:no-lm && pnpm run deps:direction && pnpm run docs:drift` — **done 2026-10-01** | `core:no-lm`, plus the same row inside `deps:direction` | **medium-high** — 51 files. The price of a boundary that cannot be crossed by accident, and it is mechanical: reviewable by the compiler |
| **A3** | `pnpm proposal:protocol`, `pnpm test:unit` (new seam tests) — **done 2026-10-01** | `proposal:protocol` | **low** — the one item the plan expands rather than contracts |
| **A4** | `pnpm run attention:write-surface`, `pnpm test:unit` + a diff on the committed baseline file — **done 2026-10-01** | `attention:write-surface` | **high, and confined to this item.** Every learned value moves: why it is alone, why it lands after A5, and why the baselines are regenerated here rather than left to drift through A6–A8 |
| **A5** | `pnpm test:unit` + `pnpm memory:ports` — **done 2026-10-01** | `memory:ports` | **low** — mechanical, and the boundary was already implied by `MemoryView` |
| **A6** | `pnpm test:unit` (NAL suites + dispatch tests) | `dispatch:no-wildcard` | **medium** — dispatch order changes, so parity is the gate |
| **A7** | `pnpm test:unit` (budget-enforcement tests) | — | **low-medium** — the behaviour change is "steps stop running by default" |
| **A8** | `pnpm test:unit` (resource-policy tests) | `resource:policy` | **medium** — retention policy *is* behaviour; policy and structure together is how a semantic change hides inside a refactor |
| **A9** | `pnpm test:hermetic` — the tier this item exists to make possible | `replay:proposal` (`slow`) | **low** — extends an existing reducer with new event kinds |
| **A10** | `pnpm run rules:loaded-data`, `pnpm test:unit` | `rules:loaded-data` | **medium-high** — the only item that changes what the system can do rather than how it is arranged. Last in sequence for that reason |
| **A12** | `pnpm run terms:canonical`, NAL suites, `pnpm test:unit` — **step 1 (§5.12.1) done 2026-09-30, `^name` retirement done 2026-10-01, §0.8.4's readability rule done 2026-10-01; the reducers remain, and A4's baselines they were waiting for now exist (§0.8.8)** | `terms:canonical` (now also asserting *readable*, not only injective), plus the widened round-trip test |
| **A11** | `pnpm run config:model-matrix`, `pnpm test:unit` | `config:model-matrix` (re-landed, with the manifest) | **medium** — the item that can spread. A capability available everywhere is as safe as each call site, so its acceptance is mostly *declarations*, and an ungated declaration is a comment |

### 5.14 The questions A1–A3 will be decided by

The split is easy to half-do. These are the decisions a half-done split defers, listed so they get
answered deliberately rather than by whoever next opens the queue.

- **Unit of asynchronous work.** One proposal over one derivation, one consolidation window, or one
  episode. Too small and the model is prompted into trivia; too large and its latency becomes the
  wall. Most worth answering before the schema is written.
- **Trigger.** Not a rate — a trigger: a budget of un-committed derivations accumulated, a
  consolidation interval elapsed, or a salience signal fired. Express the balance as **cycles per
  proposal**: "one proposal per 10 000 cycles of un-committed derivations, dropping X when full" is a
  contract; "run every N seconds" is not.
- **Overflow policy.** The code already drops the oldest, twice. Drop-newest is simplest and probably
  right initially; drop-lowest-priority needs a priority the payload must then carry. **This cannot be
  left implicit**: a queue with no declared policy is an unbounded queue with extra steps.
- **A denied batch.** The reasoner re-queues at the head and trims. Retry, drop, or a recorded
  rejection? Whether a denied proposal produces a `backpressure` `TerminationReason` is the
  difference between "the queue is full" being visible and being inferred.
- **A proposal referencing evicted concepts.** Reject, or salvage what still resolves? Rejecting is
  simpler and more honest. Say so before the first eviction bug.
- **When the reasoner has moved on.** If applicability is "at the next declared boundary", staleness
  is bounded and irrelevant; if it is "whenever", coupling is reintroduced. **This decision determines
  whether the cycle is actually closed**, and it belongs in the schema, not a comment.
- **The proposal format's version story.** A run recorded against schema v3 must not replay against v4.
  Small, boring, genuinely hard, and it belongs to whoever writes the schema.
- **Dependency or component?** A dependency means no deterministic core, no hermetic tier and no
  reliable suite. A component means the hermetic answer is "replay a fixture". **Upstream of the
  others** — this is §3.3, decided.

**The hermetic question is retired, not deferred.** If the layer is optional, the hermetic run *is*
the no-provider run, and the with-provider path is covered by recorded proposals replayed through the
same seam. Neither gate is weakened and neither is skipped. A9 is where that lands.

---

## 6. Sequencing

```
A0 ─▶ A1 ─▶ A2 ─▶ A3 ─▶ ~~A5~~ ─▶ A4 ─┬─▶ A6 ─▶ A10 ─▶ A11
                              └─▶ A7 ─▶ A8
                    A9 (after A3, parallel thereafter)
                    A12 §5.12.1 (grammar alignment) → A12 reducers, after A4's baselines
```

**As of 2026-10-01: A0, A1, A2, A4 and A5 are done** (§0.8, §0.8.1, §0.8.6, §0.8.7, §0.8.8). A3's
eight protocol *decisions* are the next unanswered thing in the queue and nothing else blocks on
them; A3's *implementation* now waits only on A6's dispatch port, since the structural item it was
waiting behind has landed.

**The ordering rule: structural before behavioural.** A5, A2 and A6 are mechanical — they move code
and change no derived value. A1, A4 and A8 change what the system concludes or how fast it forgets.
Pairing a mechanical item with a behavioural one in the same window is what makes a behaviour delta
unattributable, and this plan has exactly one attribution to protect: A4's RL and parity baselines,
which every later item must hold stable.

- **A0** alone, first. Everything else is judged against it.
- **A1** alone, second, for the same reason as A4. Its acceptance is three short tests: a hanging
  provider, a zero-producer NAR, and a trace with no `propose` inside `reason`.
- **A2** immediately after A1, and **A3**'s *implementation* immediately after A2: the boundary is
  cheapest while the seam is fresh, and implementing against the queue's real behaviour (§4 row 9)
  rather than an assumed one is worth more than the days it costs. A3's eight protocol *decisions*
  are produced earlier — §0.6 item 2, before A1 — and only their landing is sequenced here.
- **A5** before A4, for the attribution reason, and because it makes A4 and A6 testable in
  milliseconds rather than through a NAR.
- **A4** alone, on the split structure, with the RL/parity baselines re-established and committed in
  the same change.
- **A6** after A4 — it changes dispatch order, so it is measured against A4's baselines.
- **A7 and A8** depend on A0 only and can be interleaved; A8 is the third and last behavioural item.
- **A9** lands once A3 has decisions worth replaying, and is orthogonal to the rest.
- **A10** follows A6, because it needs the dispatch port it registers through, and A3, because a rule
  must not enter the table mid-cycle. It is the last structural item and the most valuable one; if the
  sequence is cut short, cutting here costs the floor and keeping it costs the thesis.
- **A11** last of all. A capability available everywhere is only as safe as each call site, so it
  lands after the port's contract exists (A2) and after calls are bounded (A1).

> **A10 must not wait on performance evidence.** It is late for architectural reasons — it depends on
> A6's port and A3's boundary rule — and not because a measurement should precede it. TODO30 measures
> candidate counts and dispatch shapes through A6's port; nothing in A10 depends on any of it. **If
> TODO30 slips, A10 does not.** Letting TODO30 become a hidden prerequisite for the feature this plan
> exists to establish is the failure this sentence exists to prevent.

**A formal handoff to TODO30 follows A2 + A3:** at that point the architecture is what the rest of the
plan is measured through, and TODO30 §1 requires a fresh profile before it orders anything. This plan
carries no performance ordering forward, because §4 row 15 shows the old ordering came from a
profile of the wrong system.

---

## 7. Invariants that must not move

1. **NAL parity.** The suites are `tests/nar/nal1-rules`, `nal2-copula`, `nal7-temporal`,
   `nal8-procedural` and `nal9-self` — there is no `nal3`–`nal6` file, and that gap is narrower than
   this plan's language has implied for several passes (§11.1). Nothing here changes what is derived
   from what. A6 touches dispatch and is gated on those suites.
2. **Determinism.** `test:determinism` and `test:hermetic` green at every commit.
3. **`test:load-sensitive` green under full load.** This plan *adds* no timing assertions, deliberately
   — latency assertions in unit tests produced every load-sensitive flake in this repository.
4. **Every unbounded resource has an owner and a lifecycle policy** (A8). This replaces the older
   "the complexity budget ratchets downward and every change must lower `productionLOC`", which
   describes a gate that does not exist — `complexity:budget` is `mustNotIncrease` with ceilings.
   **Forcing production LOC downward during an architecture refactor optimises for the wrong thing.**
   The gate is left untouched.
5. **Each cycle-path quantity has one owner, and the type says so.** For `priority` this is
   representational — no public setter, writes confined to the attention owner's module — because an
   invariant that can only be enforced by review is not one. For everything else it is enumerable, and
   a test enumerates it. **Extended by A4, and now the tree's strongest invariant:** a quantity may
   have exactly one owner *and one writer per reason*, and **a read is a read** — `sample`,
   `sampleWindow` and `getGoals` return what is there and move nothing, so what a system concludes is
   a function of what it was told rather than of how often it was asked (§0.8.8).
6. **The core does not depend on the induction layer**, in either direction: `nar` core may not import
   the layer's directory, and the layer may not reach core internals by any route weaker than public
   API. Enforced by the dependency gate, not by review.
7. **The no-provider configuration is a real system, not a stub.** It must pass NAL parity, reason and
   produce derivations with zero producers registered. **This is the invariant most worth testing,
   because it is the one that would falsify the thesis** (§12).
8. **`lm.enabled` and `enableLMRules` disappear** rather than being extended. A boolean on an
   always-constructed component is a comment, and this repository is full of accurate comments about
   behaviour that is not what they say.
9. **Proposals enter through the kernel gates.** A proposal may not write `Truth.frequency` or
   `Truth.confidence` through a reward path. Pre-existing — listed because A1–A3 create a new way to
   reach state, and the new way must go through the same doors.
10. **The six workspace packages do not merge**, and the README's documented public surface is updated
    in the same commit that changes it.
11. **One inference path, many producers.** `InferenceController` is constructed in exactly one place
    (`cognitive/impls/CognitiveController.ts:167`) and `step` is called in exactly one place
    (`nar-execution.ts:234`). A1 adds producer assembly around the cycle, which is the moment this is
    most likely to be broken by accident — hence a gate.
12. **One budget system.** Budgets are `ReasoningBudget` scopes accounted by `KernelBudgetGate` (A7).
13. **The seam reaches state only through gates it was given.** The reasoner receives its
    `GateRegistry` by injection and holds no module-global. Today it violates this (§4 row 10).
14. **`J` and `P` are both optional, and both fail closed.** The model may not be provided: the system
    is a complete reasoner in all four configurations. *Failing* is not *degrading* — an answer that
    cannot be obtained is refused rather than assumed, and a model-backed rule that cannot call its
    model runs its symbolic fallback. The one thing a model may never do is **hang**. And `J` is a
    **reasoning participant, not a gate on `P`**: it may be consulted anywhere in the pipeline and it
    may produce derivations.
15. **The rule set is loaded data, never an import side effect** (A10). No module outside the
    `InferenceTable` port's implementation may register a rule; the table carries a schema version,
    every entry carries its identity (§5.10), it is enumerable at runtime, and it is revertable.
    **This is the invariant the thesis rests on**: while registration is a side effect of an import,
    the rule set is code, and "learnable, versioned artifact" is a claim about a message format.
16. **Only committed state is authoritative** (§1.2). Advisory computation and uncommitted producer
    state never become implicit cycle inputs, and a proposal has no authority until a committed,
    gated, recorded transition.
17. **A term has exactly one canonical form, and a claim has one spelling** (A12). **A canonical form is
   injective: no two distinct terms print alike**, which is what makes every key built from a printed form
   a sound identity (§0.8.2). `(a | (a | c))` and
    `(a | c)` are one claim; `(--x).f = 1 − f_x`, so `--x. %0.8%` and `x. %0.2%` are one claim and
    `--x. %1%` is `x. %0%`. Canonicalisation happens at construction, so interning, equality and memory
    dedup agree by construction rather than by which producer remembered to normalise.

---

## 8. What is being deleted

Named, so the plan is falsifiable by diff:

- ~~`processLMRulesImpl` from the cycle path, and its `await Promise.all` over model calls~~ —
  **done (A1)**: `DefaultDerivation` calls `stageLMRules`, and `processLMRulesImpl` survives only as
  `applyLMRules`, reached from `LMProposalProducer.pump`.
- ~~`RuleProcessor.stepScalars` and the shadowed `resetMetaBudget`~~ — **done (A1)**. The memo had no
  invalidator, so it was deleted rather than fixed; `NARExecution`'s own `resetMetaBudget` was dead
  with it, along with the `ruleProcessor` option nothing passed and the `meta_derivation_budget_used`
  summary field it fed — a field that always reported `0/5`.
- `enableLMRules` and `lm` from the core config schema, plus the README and `docs/api` references
  (A2).
- ~~`MemoryScorer`'s `novelty` and `relevance` factors, or the whole class~~ — **done (A4,
  §0.8.8): the whole class.** `addLink`, `removeLink`, `getLinks`, `forEachLink`,
  `getLinkedConcepts`, `updateLinks`, `split`, `addChildConcept`, `removeChildConcept`,
  `getChildConcepts`, `getParentConcepts` and `ConceptLink` went with it.
- ~~`Stamp.createInput()` from any getter~~ — **done (A4)**: `TaskData.stamp` is non-optional and
  minted in `Concept.addTask`.
- ~~The public `Concept.priority` setter itself, not just its external uses~~ — **done (A4)**; the
  invariant is enforced by the type, not by ten call sites. With it, `Concept.boost`,
  `Concept.decay`, `Concept.decayAttention`, `activation`, `activationValue`, `useCount` and
  `lastDecayTime`.
- ~~`Memory.sample` and `Memory.sampleWindow`, or their `decayAll` side effects~~ — **done (A4)**: the
  side effects, not the methods.
- ~~`Concept.linkedConcepts` / `subConcepts` / `parentConcepts`, and with them
  `SpreadingActivation.prime`, `Concept.updateLinks`, `findOrphanedLinks`~~ — **done (A4)**, on the
  *populate* branch: `SpreadingActivation` reads the link **port** instead of walking a graph only
  `mergeWith` wrote, and `findOrphanedLinks` reads `LinkManager`.
- The three wildcard lookups in `RuleIndex.candidatesFor` — `*:right`, `left:*`, `*:*` — and
  `createRulePattern`'s optional parameters. Measured safe: 0 of 55 registered rules use a wildcard
  bucket (A6).
- `RuleIndex.hitStats` with its tie-break, unless A6 makes them real.
- The `totalTasks === 0` candidate filter in `evictUnderPressure` (A8).
- The per-cycle `getGoals()` / `getStatistics()` calls from the summary and meta-goal steps, or their
  budgets (A7).
- **Canonical-form normalisation that does not exist** (A12): no flattening, no dedupe, no negation
  normal form, no frequency-extreme folding. Named because the inverse is the risk — a *silent* `|-`
  in the term factory would be worse than none.
- **Module-side-effect rule registration** (A10). This is the only deletion here that removes a
  *convenience*, and it is worth doing anyway, because that convenience is why the rule set cannot be
  versioned.

---

## 9. Not doing

- **No performance work.** Attention structures, premise indexes, dispatch compilation, eviction
  containers, admission indexes, statistics placement, population scaling, the cost gates and the
  definition of `k`. Naming a data structure in this document would be a scope error.
- **Not the capability thesis.** System One, the Judgment Manifold, governance, the game/RL loop and
  the `lm/` internals are out of scope, and so is any claim about SeNARS being better at anything.
  **This plan is substrate.** Whether that is worth more than a NAR-shaped reasoner is Q3's
  experiment (§11.1).
- **The induction layer's internals are not a target** — 15 226 lines, 25% of `nar/src`. A1 changes
  *where it is called from*; A2 changes *which way the dependency points*. Whether the 19 rule
  templates are the right granularity is a real question this plan deliberately does not answer.
- **The game and RL focus subsystems are not targets.** `game/` and `focus/` are an agent-side
  apparatus, and they are the only reason several of these APIs are shaped as they are.
- **No NAL changes.** Not one. If an item here appears to need one, that item is mis-specified.
- **No timing assertions in the default suite.**
- **No new abstraction where one already exists.** Three times in this plan the cheapest
  implementation was a mechanism the repository had already built: the kernel's gates (§3.3),
  `ReasoningBudget` (A7), and the event log with `replayCognitiveState` (A9). If a proposal needs a
  queue, a budget, a replay fixture or a gate decision, use the one that is there; a parallel
  mechanism is a second source of truth about the same fact.
- **UI untouched**, and the Judgment Manifold's heads, calibration and distillation loop are untouched.
  A2 moves *where* System One's adapter is constructed, not what it judges.

---

## 10. Gates

New gates are wired into `pnpm gates` (`scripts/lib/gates.ts`) **with the item that needs them, not
after** — that file records a gate present only in `ci.yml` staying red for a whole pass of TODO28
without anyone noticing, because the way these are run by hand is `typecheck && lint && test:unit`. A
gate listed here and not wired is the exact failure mode this plan is about.

| gate | asserts | lands with | tier |
|---|---|---|---|
| `cycle:no-provider` | **A0 form (landed):** every declared seam is probed with a never-resolving provider and its `bounded` declaration is true — bounded must not block, unbounded must. **A1 form:** a cycle completes with `J` and `P` backends that never resolve **and** derives identically; no `propose`-stage work appears inside a `reason` stage in a recorded trace. **Dependency, not presence** (§1.3); blocked on the live cycle having no stages (§0.8) | A0 + A1 | `gate` |
| `rule:has-fallback` | every registered `P` rule declares its symbolic fallback, and the fallback is what runs when the model call fails | A1 | `gate` |
| `config:model-matrix` | all four S/J/P configurations initialise, reason and pass NAL parity; a hung `J` is rejected on a timeout rather than awaited; every model call site is in the manifest with its profile, budget and position | A1, A11 | `gate` |
| `gates:one-cycle-path` | exactly one `InferenceController` construction site and one `.step(` call site | A1 | `gate` |
| `induction:inventory` | **A0 form (landed):** every cycle-path value import of the layer is a declared behaviour with a `boundary` / `synchronous` / `dropped` disposition and a *noticedBy*, and every declared `file:line` still holds its await. **A1 adds:** no disposition of `synchronous` claims a cycle-path dependence A1 has closed | A0 + A1 | `gate` |
| `core:no-lm` | **landed 2026-10-01, in a narrower form than stated:** no cycle-path module imports `nar/src/lm/` — relative, workspace-subpath, static, dynamic, value or type — and the shipped rule table is exactly the registered NAL rules (55, census in `tests/nar/todo29a-a2.test.ts`). **Not asserted:** literal removal of the layer directory from the build graph, since `nar/src/index.ts` re-exports it for assembly, which is the correct shape. See §0.8.6 | A2 | `gate` |
| `deps:gate` +1 row | **landed, in `deps:direction` rather than `deps:gate`.** `deps:gate` counts cycles and compares a number; a layering rule is not a number, and `deps:direction` is already the gate that reads manifests and reports named violations. Both gates call one implementation (`scripts/lib/layer-boundary.ts`), so the rule has one body and two places it can be caught. `core` imports only `util` and its own schemas — already true and already checked | A2 | `gate` |
| `memory:ports` | **landed 2026-10-01:** no cycle-path module imports `nar/src/memory/memory.ts` — by file, by directory or through the barrel — and the two sites that legitimately construct a store are declared in a ledger with reasons. §0.8.7 | A5 | `gate` |
| `attention:write-surface` | **landed 2026-10-01, in a narrower form than stated:** the compiler holds the primary invariant (no setter) and the gate holds the rest — no `set priority` in the owner, every declared reason written with somewhere in `nar/src` + `src`, no reason the union lacks, `sample` / `sampleWindow` contain no write, and the decay sweep has exactly one call site. §0.8.8 | A4 | `gate` |
| `dispatch:no-wildcard` | no registered rule sits under a wildcard bucket | A6 | `gate` |
| `resource:policy` | every production accumulator is in the ledger, and a memory at capacity with nothing evictable says so | A8 | `gate` |
| `rules:loaded-data` | no module-side-effect registration survives; the table is enumerable, versioned, revertable; two revisions are diffable and a prior one is restorable; an empty table is a runnable state | A10 | `gate` |
| `replay:proposal` | `replayCognitiveState` reconstructs the same state from `proposal.*` events, and a version mismatch fails loudly | A9 | `slow` |
| `terms:canonical` | **step 1 form (landed 2026-09-30) + §0.8.4 (landed 2026-10-01):** every variadic kind round-trips at 2, 3 and 4 members, flat and nested one level deep, comparing the **term** as well as the text — a canonical form must be *readable*, not only injective. **Reducer form (A12, not started):** `canonical(canonical(t)) === canonical(t)`, already-canonical terms are returned unchanged, `(--x).f = 1 − f_x` across the range (`--x. %0.8%` ≡ `x. %0.2%`, `--x. %1%` ≡ `x. %0%`), and the NAL suites derive what they derived before | A12 | `gate` |

Deliberately **not** here, and in TODO30: `cost:cycle`, the population-scaling matrix, and the
`bench:cycle` entry in the gate list. Note what that means for §5: **no item in this plan is verified
by a number of milliseconds**, and an item that needs one belongs to TODO30.

### 10.1 The intent-to-gate rule

The pattern behind §4 is general, and it is this repository's most expensive habit: **an
architectural intent lives in a doc comment, and nothing in the build can tell you when the code
stops implementing it.** Three instances today — a memo never invalidated (§4 row 7), a tie-break
nobody records into (§4 row 7), and a bounded, gated, tested `StreamReasoner` with one caller, a test
(§4 row 9).

Two rules follow, and they are cheap:

> **A gate ships with a test that proves it can fail, written before the gate exists.**

1. **When a metric's source can silently fail, that is a defect in the metric, not the source.**
2. **A doc comment that explains a bug the code still has is a failing test that was never written.**
   `RuleIndex.ts:131-140` is the clearest example in the tree: a precise, correct diagnosis of a
   comparator collapse, sitting next to the collapse.
3. **A correct, bounded, tested component that nothing calls is a failing test that was never
   written too.** The Stream Reasoner is that shape, and it is the most expensive instance in the
   tree, because the intent it encodes is the name of this architecture.

### 10.2 The architecture review gate

Before this document closes, review the dependency graph and answer these in writing. Each maps to a
test:

```text
Can the core be built without the induction layer?
Can the core be run without it?
Can the core be replayed without it?
Can a provider hang without blocking a cycle?
Can a provider mutate core state directly?
Can a provider write state without passing a gate?
Can a proposal be applied mid-cycle?
Can a proposal reference state that no longer exists, and what happens?
Can attention state be mutated without going through its owner?
Can a read silently change reasoning state?
Can any resource grow without a declared policy?
Is there a second inference path?
Can committed state and in-memory index disagree?
Can J authorize, gate or reject P?
```

The last two are new since v2.5 and are the two most likely to be violated by this plan's own work:
the second by A10's index reconstruction, the last by the vocabulary of §2.1.

---

## 11. Open questions

### 11.1 Must be answered here, before the named item

**Q1′ — the in-cycle induction inventory — ANSWERED, and it landed with A0.** The seven behaviours,
their dispositions and their *noticedBy* column are `nar/src/lm/in-cycle-inventory.ts`; the page is
`docs/induction-inventory.md` (not `docs/architecture/`, which is generated by
`scripts/generate-architecture.ts` and would drift on every run); the gate is
`pnpm induction:inventory`. The dispositions are decisions and remain A1's to revise — the gate
checks that they exist and that their references hold, not that they are right. The one behaviour
that *stays* synchronous by design is `ingress-judgment`: System One judging untrusted input before
admission is **gating, not learning**, and A1 gives it a timeout without moving it.

**Q3 — what is the falsifiable claim.** The experiment exists; the hypothesis, the aggregate and a
clean control do not. `scripts/arcade.ts` runs `nal` and `manifold` arms with the **same actuator**
(`EpsilonGreedyReflex`, `numArms: 10, epsilon: 0.1`), Brier-scores every decision, and forces the
`nal` arm into cognitive mode "so it is always a comparable row in the summary". So the controlled
comparison is one command:

```text
pnpm arcade -- --games snake,bandit,tictactoe --arms nal,manifold,lm --resume
```

What is missing is three things, not a programme: **a stated hypothesis**, written before the run or
it is a rationalisation afterwards; **an aggregate** — per-game Brier means exist, a single number
across the matrix with a variance estimate over seeds does not; and **a clean control** — the `nal` arm
is only a true no-`J`/no-`P` control *after* A1, because until the cycle stops calling
`processLMRules` the arm runs a constructed, fully registered layer with execution gated. **A
falsification experiment whose control arm has a vestigial inducer cannot falsify anything.** Q3 is
therefore sequenced after A1/A2 and after A10.

**Q8 — does the induction layer become a seventh workspace package?** Answered for the *contracts*
(§5.2); the rest stays open for the day the layer needs to be genuinely un-buildable rather than
merely un-importable.

**Q9 — what does the no-provider core's table contain?** Measurably answered: the 55 rules registered
by `nar/src/rules/impls/registration.ts`, 21 of them `inheritance:inheritance`, all NAL and
extended-NAL, none layer-typed. So "reduces to NARS-like capability" is literally true today. What is
missing is the test that says so, which is what makes the claim falsifiable rather than descriptive.
Cheap; lands with A2.

**Q10 — is the model the only proposal producer we expect?** Designing the contract for one producer
is how you get an interface that is really a call site. A rule-miner, a human author and a recorded
fixture are cheap to name now and expensive to retrofit.

**Does a configured `J` admit anything yet? — NO, and A1 measured it (2026-09-30).** With System One
enabled and no calibrated heads, `SystemOneIngressJudge` abstains and `KernelPerceptionGate` refuses the
observation. That is D1 working, not a bug, but it means `config:model-matrix` currently asserts the
four-way invariance on the `P` axis alone, and `S` and `S+J` do **not** commit the same state today.
**What closes it:** a judge that admits — a calibrated head set (A11's manifest binds one) or a declared
abstain-below-threshold path. Until then the honest statement is "the J profile is wired, bounded and
fails closed; it has not yet been shown to admit", and §2.6's claim is asserted only where it is true.

**Is NAL3–6 tested anywhere?** There is no `nal3`–`nal6` file in the tree, and — a correction A1 made —
there is no `nal1-rules` file either. The parity suites are `nal2-copula`, `nal7-temporal`,
`nal8-procedural`, `nal9-self`. Worth ten minutes before
A6, not after — and if they are not covered, the parity claim is narrower than this plan's language
has implied.

**Q11 — ~~what truth does a `J`-derived conclusion carry?~~ — answered by committed code, not by this
plan.** Every decision query must declare whether it is about a **Belief** or a **Goal** — the field
is `CognitiveAxis`, whose two values mean exactly that (`types.ts:63,70,82,126,134`). The safe side is
the default (`decide.ts:293`), the transducer refuses a mismatched write (`action-transducer.ts:37`),
and the schema validates it (`http-endpoint.ts:21,29`). A **Belief** answer is admitted to `Truth` at
the gate's source-quality ceiling; a **Goal** answer is confined to `Desire`. `TODO16.md` §2 records
the decision and its reasoning: *"mathematically forbidden from mutating factual `Truth` beliefs."*
A11's job is to make this reachable from the reasoning cycle and to gate it there, not to invent a
rule.

**Known-broken, inherited, not this plan's:** `docs/api/util.md` drifts from its generator on the
unmodified tree, so `docs:drift` is red independently of §5; `test:load-sensitive` has a wall-clock
assertion (`todo16-batching`, < 50 ms) that fails under load and passes in isolation; README names
`nar/src/rules/registration.ts` as the source of truth for the rule matrix and that path does not
exist (the real one is `nar/src/rules/impls/registration.ts`) — fixed in A2's documentation sweep,
and the matrix should be *generated*, for the reason §10.1 gives.

### 11.2 Deferred to TODO30, not unresolved here

These are questions this plan deliberately does **not** answer, and each is a measurement rather than
a decision:

- which attention structure maintains the order `topK` reads, and at what population size;
- which index answers similarity recall, and whether admission stays quadratic below some threshold;
- what `k` is — the working-set size — before anyone claims O(k) anything;
- the dispatch structure chosen from the measured candidate count after winnowing (trie, DAG,
  decision tree, or the union kept);
- the eviction container, the retention weights, and where the policy's cost lands;
- which `J` call sites are worth their budget, in what order, and what each costs;
- the population-scaling matrix and `cost:cycle`.

**Constraint carried into TODO30:** optimization may change **how** committed state is indexed or
retrieved; it may never change **what counts as** committed state (§1.2).

---

## 12. Risks, and what would make this plan wrong

| risk | likelihood | signal | response |
|---|---|---|---|
| **A1 is not the cheap change believed.** The committed channel is wired in and something *else* reaches the layer from the cycle | **medium** — the cycle path is `DefaultDerivation`, `RuleProcessor`, the tick bindings and `PerceptionGate`, and only part of it was traced | a cycle that does **not** complete with a hanging `J` and `P`, or derivations that change when a provider is added | widen A1 rather than declaring victory. The acceptance is a test and the test is the arbiter — not a call count, which §4 row 11 shows can be zero while a real dependency remains |
| **A2 is a swamp.** 39 files, and the layer reaches into core internals | medium | the diff stops being mechanical and starts having semantic content | A2 is after A1, so the `Proposal` interface is known. If it is still hard, take Q8 (seventh package) early — a compiler error is a better boundary than a review convention |
| ~~**A4 or A5 land as wrappers.**~~ **Both halves answered and gated.** A5: `Memory` is off the cycle path and a facade import fails the gate (§0.8.7). A4: the setter is gone, so an external writer does not compile, and `attention:write-surface` fails on a `set priority` returning, on a reason nothing writes, and on a read that writes (§0.8.8) | ~~medium~~ | `Memory` keeps its responsibilities behind a forwarding interface; or a new external `priority` writer appears and no test fails | The setter is a type, so the "new external writer" branch fails at compile time and the gate is the second line. Baselines were re-established and committed in the same change — gridworld unmoved, bandit −0.10, non-stationary −0.13, all above floor — so later drift is attributable to A6 and after |
| **A12's reducers are not sound and parity moves** | medium — six rewrites over every compound term the reasoner builds, and NAL axioms applied to truth-bearing terms are easy to get subtly wrong | any of the four parity suites changes what it derives | the gate is parity, and a parity change is a *finding about the reducer*, not a baseline to regenerate. Each reducer lands separately with the others disabled, so one soundness bug is one reducer |
| **A10 never lands and the thesis stays prose** | **medium** — the largest item, last in sequence, and the easiest to defer because the other nine all look like progress | the plan closes with A1–A9 done and "the rule set is a learnable artifact" still describing a message format | if the sequence is cut, cut here *explicitly*: record in §7 and §8 that the rule set is code, and stop claiming otherwise. A floor delivered honestly beats a thesis claimed and not built |
| **The thesis is negative.** S+J+P is not better than S alone | unknown — but no longer unknowable | the `nal` vs `manifold`/`lm` arcade run comes out flat or negative | Q3: write the hypothesis, run it with a seed count that survives the noise, publish the number either way. **A command, not a project** — but it needs A1 for a clean control and A10 for a meaningful with-`P` arm |
| **"Judgment" re-imports the gate reading** | medium — the vocabulary invites it | `J` starts authorizing, filtering or scoring `P` | §2.1's anti-drift note, the Belief/Goal-typed `CycleDecisionRequest`, and a test in A11's acceptance |
| **The plan measures the wrong thing** | already happened once | an ordering derived from a profile of the fused system | fixed by construction: this plan makes no ordering claims about cost, and TODO30 must re-profile before ordering anything |

**The kill criteria, plainly.** Two things would mean this is not the right plan. If the induction
layer turns out to be genuinely an *online* learner whose work cannot leave the cycle, the cycle
cannot close, §1.1 is unenforceable and the architecture is moot. And if §7 invariant 7 fails — the
no-provider core turns out inert, meaning the layer was load-bearing — then §2.7's falsifiability
argument was never true. Both are checkable before much is built, and both should be checked first.

---

## 13. Provenance

Every number this plan cites, and what it is worth. **A number with no commit in it is not
evidence**, and **the load-sensitive rows are the ones that will lie to you** — which is why
wall-clock figures are absent from this document and TODO30 §1 owns them.

| measurement | value | taken at | reproduced by |
|---|---|---|---|
| per-cycle counts with the layer "disabled" | **33 inducer invocations**, 8.2 `decayAll`, 8.0 `sample`, 5.0 `forEachConcept`; decay rate tracks `maxSampledConcepts` (5.2 → 9.0 as the knob goes 5 → 40) | `eb394d4a` | `pnpm bench:cycle` (counts, not times) and `-- --knob-sweep` |
| static facts, unchanged by this plan | 39 LM-importing core files · 10 external / 6 internal `priority` writers · 55 rules, 0 wildcard buckets, 21 in the hot cell · 1 `InferenceController` construction and 1 `.step(` call site | `919c21ab` | `grep`, call-site audit, `RuleRegistry.getAll()` census |
| NARchy reference | pinned `f3a9bcc` (2026-08-25) | — | `github.com/narchy/narchy` |
| term-layer round trip | **6 of 16 kinds could not be read back from their own output**; 3 further terms had a `kind` no operator declares (`'--'`, `'atom'` with arguments, and `('*',a,b)` and `(a&b)` interning to one term) | `919c21ab` | `pnpm terms:canonical` — one kind per entry, identity asserted |

**`scripts/cycle-bench.ts` is committed, with `--selftest` proving each hook observes its own
invocation** — because a hook that silently observes nothing produces a table of confident zeroes,
and this repository already had two of those (§4 rows 7 and 9).

**What was read of NARchy versus inferred.** Read and quoted: `nars/memory/Memory.java`,
`nars/focus/util/PriTree.java`, `nars/Focus.java`. **Stated by NARchy's author and load-bearing**:
the reaction "compilers" build a predicate trie that winnows the applicable rules, still interpreted,
with deeper bytecode compilation deliberately not taken; the rule set is selectable at runtime startup
by enabling chosen rulesets, with dynamic online recompile available and never necessary; the
`jcog`/`narchy`/`spacegraph` module split. **Inferred from the tree listing, not read:** the eight
`Memory` implementations' individual behaviour, the `table/` hierarchy, `control/exec/*`,
`TaskAttention`'s sampling, term interning — none load-bearing. **One obligation stands:** the
winnowing claim is still not read from source, and TODO30 §6 is scoped so nothing depends on the
difference — its first measurement is the candidate count after winnowing, which holds true
whichever way the question goes.

**Coverage limit.** The plan names 14 of the 47 `nar/src` directories. **Thirty-three were not
examined** — neither presumed clean nor presumed broken. A session that finds itself editing one
should treat that as new scope and say so.
