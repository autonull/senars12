# TODO30: Runtime Performance — the cost model of whatever TODO29 lands

**Version:** 1.0 (2026-09-30) · **Predecessor:** TODO29 v2.0 (runtime *architecture*: a closed
core, an explicit induction boundary, and owned state) · **Successor:** undetermined.

**Status: planned, and blocked on TODO29.** Nothing here has landed, and nothing here should be
started before TODO29's A2 and A3 are done — and §6 additionally waits on A6 and A10, because a
dispatch structure measured against a static 55-rule table is not a result. The reason is not politeness: every optimisation in
this document is applied *through* a seam, and the seams are the deliverable of the other plan.
A cost model measured on a tree that still has a 646-line god-object and a model inside the
cycle is a model of the wrong system — which is precisely the mistake TODO29 v1.3 made, and the
reason v1.3's workstream order was derived from a ranking that v2.0 discarded.

> **A fresh session should read §1, §2 and §15 first.** §1 says what to measure before ordering
> anything, §2 says what a claim of `O(k)` is obliged to define, and §15 is the list of ways this
> plan could be the wrong plan.

**The one exception to the block:** TODO29's A0 instrumentation is a prerequisite for §1 and is
the only thing from that plan needed to start.

### What this document is, and what it is not

It is **not** the rest of TODO29. It is a measurement-first programme whose output is a *measured
and enforced* cost model, plus a short honest report of the scaling costs that remain. It is not
a prediction table, and it does not carry TODO29's forward: the profile that produced the old
ranking is a profile of the fused system, and §1 requires a fresh one before any ordering.

It is also not an optimisation of the induction layer's internals (15 226 lines, 25% of
`nar/src`). After TODO29's A1 the layer's cost is no longer hidden inside a cycle, which is
exactly when it becomes worth asking as its own question.

### The seams this plan works through

Every item below is applied through a port that TODO29 introduces. If one of these does not
exist, the correct response is to finish TODO29, not to work around it:

| TODO29 | port / contract | what this document does through it |
|---|---|---|
| A4 | `Attention` (`touch` / `topK` / `commit`) | §4 replaces the implementation behind the interface |
| A4 | `DecayClock` (`tick(now)`) | §4's commit cadence; one owner, one clock |
| A5 | `ConceptStore`, `BeliefTable`, goal enumeration, statistics view | §5, §7, §9 |
| A6 | `InferenceTable` (`lookup` / `dispatch`) | §6 chooses the implementation |
| A7 | named budgets with declared overflow | §2's `k` bounds and §6's branch-factor budget |
| A8 | declared resource lifecycle policies | §7 implements them, without changing the policy |
| A10 | the rule set as loaded, versioned data | §6's dispatch structures are indexed by the same kind pairs, and the table becomes enumerable rather than a side effect — so the dispatch measurement finally has a stable key space |
| A0 | the shared instrument (`scripts/cycle-bench.ts`) | §1 consumes it rather than building a second harness |
| the corrected invariant (TODO29 §3.7) | a cycle completes when a point-profile call and a rule backend both never resolve | this plan measures the *wait* a model causes on a cycle path, because that — not the call — is the cost TODO29's gate bounds |
| A11 | one optional model-reasoning port, consultable pipeline-wide | §1 measures the per-stage cost of a point-profile call, and §2 requires every cycle-path call site to declare its budget; a capability available everywhere is only as cheap as its cheapest call site |

---

## 0. Purpose

TODO29 makes the core closed, the induction layer optional, state ownership explicit, and every
resource policy declared. This plan makes that architecture **cost what we intend**.

Two sentences, because the second is the one that is easy to get wrong:

> The goal is not to make the old implementation fast. The goal is to establish, measure, and
> enforce the cost model of the new one.
>
> A total-speed improvement that hides a semantic or memory regression is not an improvement,
> and is not accepted.

---

## 1. First: re-profile, and resolve the contradiction

**Do not carry any ranking forward from TODO29 v1.3.** Its order was derived from a CPU profile
of the fused system, and TODO29 §1.12 exists to say so.

### 1.1 The profile that does not survive, kept for the record

`--cpu-prof` on a 300-step rollout, 3 635 resident concepts, 900 cycles, self time, min of nine
runs (2026-09-30, `d542d5ee`):

| share | site | TODO29 finding | owner now |
|---|---|---|---|
| 17.1% | `TermCollection` iterator, from `selectTopN` / `decayAll` / `forEachConcept` | §1.1, §1.2 — the sweep is now index-based; the rest is attention | §4, §5 |
| 12.0% | `get priority` (`concept.ts:90`) | 10 external writers | §4 |
| 8.9% | `RegExp /\((\w+)\s+-->\s+(\w+)\)/` | landed — now `bareInheritancePair` | — |
| 6.8% | `nar-io.ts` relevance scan callback | landed | — |
| 4.4% | `SimpleAttention.decay` | §1.1 | §4 |
| 4.2% | `MemoryScorer.scoreFor` | §1.3 — allocation removed, collapse not | §4 |
| 4.0% | `BoundedMap.#reinsert` (term interner `LruCache`) | §1.7 | §7 |
| 2.4% | `selectTopN` | §1.7 | §7 |
| 2.6% | GC | | |

Its *shape* is probably right and its *magnitudes* are not: the two commits of 2026-09-30
already removed ~14% of the rollout, and TODO29's A1–A4 remove the multiplier rather than the
constant factors.

### 1.2 The contradiction to resolve before trusting any new profile

`docs/adr/018-c3-hotpath-profiling.md` (2026-09-27, Accepted, "no action needed") measured
`InferenceController.step()` at **87.77 ns/op** and every hot-path candidate at under 1 µs, and
concluded there was no ≥5% win available. TODO29's bench measures the same step at
**3.18 ms/step at 548 concepts and 43.49 ms/step at 5 000**.

**These cannot both describe the same thing, and the difference is the most valuable thing in
this document.** The likely explanation is that ADR-018 measured a small, warm, single-cycle
path while the rollout measures a populated memory with a real input stream — in which case the
cost is entirely in the population-sized operations, and the microbenchmark was measuring a
system in a state the product never runs in. It is also possible that the two harnesses differ
in what they include. **Either way, "the hot paths are all sub-microsecond" is not a claim this
plan may rely on until it is resolved**, and resolving it is the first hour of work in §1.

Note also that ADR-018's own re-profile triggers are written and were not met — "cycle time
increases >2×" happened, and the LM was added. A decision record with a trigger is only worth
what its trigger is worth; this one fired and was not acted on.

### 1.3 What to measure

Against the post-TODO29 tree, at several populations with a fixed logical workload:

- wall time per cycle, and per phase;
- concepts touched, premises considered, rule dispatches, rule applications;
- derivations, admissions, evictions;
- provider calls, split by profile (§3.7): out-of-cycle open-profile requests, and in-cycle
  point-profile calls with the **time waited**, per call site. The cycle may never depend on a
  model's *answer*, but it may legitimately pay for one, and that wait is the quantity with a
  budget. **Per call site**, because A11 makes the capability available everywhere and a single
  aggregate would hide the one that is too slow;
- allocations (objects and bytes) per cycle;
- resident memory, and memory per resident concept.

### 1.4 How to measure it

The rules are inherited from TODO29 §11 because they are the difference between a number and a
suspicion:

1. **Counts, not milliseconds, for anything load-sensitive.** `decayAll` calls per cycle is a
   fact; 3.18 ms/step is a measurement of a machine.
2. **Minimum of N runs in one session.** The median of nine CPU-profile runs carried 25% more
   noise than the minimum on this machine. A first baseline read with suspicion: the same commit
   read 150.9 s and 90.6 s in `test:unit` on one afternoon, because the machine was carrying
   someone else's load.
3. **A number with no commit in it is not evidence.** Every baseline row gets a commit, a date
   and the command that reproduces it.
4. **A hook that silently observes nothing produces a table of confident zeroes.** Keep
   `--selftest`; it is the only reason `scripts/cycle-bench.ts` is trusted, and two rows in
   TODO29's tables were previously produced by hooks that observed nothing.

Record the result as the new baseline, and record it *in this document* — a performance plan
whose baseline lives in a terminal scrollback is a plan whose baseline will be re-derived
differently by the next session.

---

## 2. Define the working set before claiming anything

Before any `O(k)` is written down, define `k`:

```text
N = total resident population
k = maximum live working set consulted by the operation
```

For each cycle-path operation, document how `k` is bounded and by what configuration. **A
claimed `O(k)` operation is not accepted if `k` can silently grow to `N`** — and "silently" is
the operative word: a bound that holds only while a particular sampler is selected is a
conditional bound, and it must be written as one.

The target model, carried over from TODO29 v1.3 §3.1 (where it belonged) and to be *derived*
rather than assumed:

| operation | measured now (fused) | target |
|---|---|---|
| attention decay | O(N), 8× per cycle | O(k), on a commit clock |
| top-k selection | O(N) scoring + O(N·k) | O(k) from a maintained order |
| premise retrieval | O(N) scan + sort | indexed by the task's symbols, O(1 + k) |
| relevance propagation on input | O(N) | through the link index, O(1 + k) |
| rule dispatch | union 4 buckets + full sort | O(1) lookup + O(matches) |
| concept admission | O(n) embedding scan | O(k) nearest neighbours from a maintained index |
| goal enumeration | O(N × goals) + a `Task` per goal | maintained goal set, O(k) |
| cycle context statistics | frozen for the process | computed on a budget, invalidated per step |

Each row is a hypothesis with a measurement attached, not a requirement, and the ones that turn
out to be wrong are findings worth as much as the ones that are right.

---

## 3. The cost model, its ledger, and its gates

### 3.1 The performance ledger

One row per cycle-path operation, in data rather than prose:

```text
operation
cycle-path: yes | no
expected complexity
working-set definition (k, and what bounds it)
benchmark
baseline (commit + date)
ratchet
semantic guard
```

### 3.2 The gates

- `cost:cycle` — runs `bench:cycle` and fails when a cycle-path operation **declared** O(1)/O(log
  n) measures otherwise. It gates on **counts and ratios, never on absolute milliseconds**,
  because a gate that fails on a loaded machine is a gate people disable.
- `bench:cycle` joins the `slow` tier in `scripts/lib/gates.ts`. It is a script, not a test:
  timing assertions in the default unit suite produced every load-sensitive flake in this
  repository's history, and `docs/adr/018` is the counterpart lesson.
- **Every performance gate ships with a failing measurement first.** The rule from TODO29
  §10.1, and it applies with more force here, because performance work is where a ratchet set
  above its measurement is most tempting and least noticed.

### 3.3 Two measurement defects to fix, inherited from TODO29 v1.3's W10

- **The LOC counter is not pinned the way `dpdm` is**, and `productionLOC` shells out to
  `pnpm dlx cloc` inside the same table, so a baseline is defined by a tool version rather than
  by the ledger. Pin it or replace it with an in-process counter. (This is a *measurement*
  defect, so it belongs here rather than in TODO29 — TODO29 §7 invariant 4 deliberately stopped
  requiring production LOC to fall.)
- **The accumulator check is a string match.** The previous attempt at a real detection rule
  was measured and rejected: scanning for instance fields assigned `new Map` / `new Set` / `[]`
  yields 574 candidates, 302 unpruned. A heuristic that noisy cannot be a gate. The fix is to
  declare the cost-sensitive sites as data — the way the accumulator ledger already does — and
  gate the *declaration*: a site on a cycle path must appear in the ledger. TODO29 A8 grows that
  ledger; this plan gates on it.

---

## 4. Attention: a maintained order

Replace global ranking with a maintained structure behind TODO29's `Attention` interface. The
interface is already decided; only the implementation is open.

Candidates: a min/max heap with lazy deletion; an ordered tree; a bucketed priority structure
(ADRs 006 and 009 in this repository are about bounded bags and multi-root focus trees, and are
worth reading before inventing a fourth thing); a NARchy-style `PriTree`.

**The implementation is selected from measurements, not from preference.** Requirements:

- explicit owner (TODO29 A4);
- bounded update cost per `touch`;
- efficient `topK`;
- correct deletion, and correct handling of stale entries;
- deterministic tie-breaking — the system is replayable, so a heap's internal order is part of
  the contract;
- the commit cadence is a clock owned by `DecayClock`, not a count of sampled concepts.

**Acceptance**

- no population-wide ranking on the normal cycle path, asserted by a count in `cost:cycle`;
- `topK` results preserve the ordering the semantics intend — the scorer's fate was decided in
  TODO29 A4, and this plan may not reopen it;
- scaling data demonstrates the claimed working-set behaviour, or the claim is withdrawn;
- `decayAll` call sites remain 1 and `maxSampledConcepts` remains absent from decay.

**Stop rule:** if the index does not beat the scan at the working-set sizes the system actually
runs, the correct outcome is the scan behind the same interface, recorded with the measurement.
The interface is the deliverable; the structure is a decision.

---

## 5. Retrieval: indexes instead of scans

Replace population scans with indexes appropriate to the query, starting from the §1 profile
rather than from TODO29's list of O(population) members.

Candidate structures: symbol index (exists — `ConceptStore.queryBySymbol`,
`memory/memory.ts:503`); link index; goal index; similarity index; maintained candidate sets.

**Do not build every index preemptively.** A real detection rule for "this should be indexed" was
measured and rejected in this repository (574 candidates, 302 unpruned) for being too noisy to
be a gate; the same mistake is available here at design time. For each index that is built,
record:

```text
query · candidate source · expected candidate bound · maintenance cost · semantic fallback
```

**Acceptance**

- representative premise queries do not enumerate the full population, measured by a counter
  rather than by a duration;
- candidate recall is measured against the pre-index implementation, and the tolerance is
  declared before the change lands;
- the derivation and regression corpus stays within the agreed envelope, with A4's committed
  RL baselines as the reference.

---

## 6. Dispatch: implement the port TODO29 defined

TODO29 A6 defines `InferenceTable` and settles the two structural questions by measurement: the
wildcard buckets go (all 55 registered rules declare a kind pair — TODO29 §1.8), and the inert
tie-break is either made real or deleted. This section chooses the implementation from the
measured workload.

**The reference is winnowing, not compilation.** NARchy's reaction layer builds a **predicate
trie that narrows the applicable rules for a given premise**, and evaluation stays interpreted —
deeper bytecode compilation was available in its design space and deliberately not taken (TODO29
§2.5, stated by its author). So codegen is off the table here, and that is a decision with a
precedent rather than a lack of ambition. The consequence is that this section is *smaller* than
it looked: SeNARS's existing `(leftKind, rightKind)` key **is a depth-1 predicate trie**, so the
work is extending a key from two term kinds to a predicate shape, behind a port, gated on NAL
parity.

**Start from what the census already says.** The exact 2-tuple table has 55 entries and a hot
cell of 21 (`inheritance:inheritance`), and the three wildcard lookups A6 removes were dead
work. So measure in this order, and stop as soon as the answer is good enough:

1. **Candidate count after winnowing**, per premise shape. This is the number that decides
   everything else, and it is a count rather than a duration. If winnowing a predicate shape
   leaves 4 candidates out of 55, the 2-tuple table plus a stable partial selection is the answer
   and this section is finished — do not build a trie to solve a problem the count says you do
   not have.
2. **Only if the count stays large**: extend the key to a predicate shape — one more trie level
   per structural feature (commutativity, product arity, variable presence), which is
   incremental and reviewable.
3. **Never**: generated dispatch, bytecode, or a decision tree over the rule set. There is no
   measurement in this repository that asks for one, and NARchy's author considered deeper
   compilation and did not need it.

**Do not retain the full sort per memo miss because it is familiar.** 100 primaries × 5
secondaries is 500 rule applications per cycle, and `maxDerivationsPerStep` bounds the *output*,
not the *work*.

**One thing to re-check after A10, because it invalidates a measurement:** the census in §1.1 is
of a rule table that is registered by importing a module. Once the table is loaded data (A10), the
rule set changes shape mid-experiment, candidate counts change, and any dispatch structure chosen
against the static 55-rule table has to be re-validated against a growing one. That is a feature
— a dispatch structure that only works at 55 rules was never going to be the answer — but it
means §6 is not complete until it has been measured against a table that learned something.

Measure: candidate count, matching work, dispatch time, rule application count. Add an explicit
branch-factor budget with a named owner (TODO29 A7's overflow rule applies).

**Two dependencies to be honest about.** The winnowing claim is **stated by NARchy's author and
still not read from source** (TODO29 §11.3) — which is why the ordering above measures the
candidate count first and lets that number, not the reference, decide. And ADR-018's "no action
needed" (§1.2) covered `rankDerivations`, not dispatch, so there is no prior measurement here
either way.

**Acceptance**

- no full candidate sort on the normal dispatch path;
- rule applications per cycle are bounded by a named budget with a test;
- NAL parity and the inference fixtures green, with rule ordering either preserved exactly or
  recorded as an intentional semantic change **before** the change lands, not after;
- the choice is justified by the **measured candidate count**, and the section stops at the
  simplest structure the count supports;
- no code generation was introduced, and if one ever is, it comes with a measurement that
  winnowing cannot satisfy — the reference implementation's author considered deeper compilation
  and did not need it (TODO29 §2.5).

---

## 7. Resource structures: implement the declared policies

TODO29 A8 declares the policies. This plan picks the containers, one subsystem at a time, and
**never changes a policy and a structure in the same change** unless unavoidable — otherwise the
behavioural diff is unattributable and the regression matrix in §11 cannot tell them apart.

The candidate list, from TODO29's growth arithmetic. Re-derive it after TODO29's A1 rather than
working from this table: several entries may disappear with the callers.

| today | cost | becomes | note |
|---|---|---|---|
| by-score eviction in `BoundedMap` (`util/src/utils/bounded-map.ts:210-216`) | O(capacity) per insert into a full layer | min-heap keyed by score, lazy deletion | ADR 006 is about the bounded bag; read it first |
| `EmbeddingLayer.neighborsOf` (`nar/src/memory/links/EmbeddingLayer.ts:70`) | O(n) per `indexConcept` ⇒ O(n²) admission | maintained top-k or a spatial index | also §8 |
| `TermCollection.deleteItem` (`terms/impls/term-collection.ts:57-65`) | O(n) index shift | swap-with-last, tombstone map for the rare indexed case | |
| `selectTopN` (`util/src/utils/collections.ts:126`) | O(n·k) insertion | bounded min-heap | measured at 2.4% in §1.1 |
| `LruCache` for the term interner (`nar/src/terms/impls/factory.ts:11`) | delete+set on every read | an interner wants a set, not a recency cache; `touchOnRead: false` is the honest setting | 4.0% in §1.1 |
| `TermMap` key building | `termKey` walked per `set` | key computed once per `set` | |

**Cross-plan note — canonical term form is NOT here (TODO29.a A12, added 2026-09-30).** A12 owns what
a term *is*: flattening nested commutative compounds, dropping repeated args, negation normal form,
`--x. %1% |- x. %0%`. It lands with the term layer's construction path and a `terms:canonical` gate,
because a canonical form is a semantic contract and deferring it to a performance pass is how a
correctness change ends up reviewed as an optimisation. **What belongs here is the storage
consequence:** re-keying terms and concepts *already persisted* under the old canonicalisation, and the
concept-count effect — `(a | (a | c))` and `(a | c)` are two concepts today, and a migration collapses
them. Do not re-key anything before A12 has landed and bumped the term schema version; before that
there is nothing to migrate *to*.

**Acceptance**

- every structure named above has a test that **fails on the current implementation and passes
  after** — written failing-first, per §3.2;
- resource occupancy is observable, and pressure is monotonic in the quantity the policy names
  (TODO29 A8 fixed the quantity; this plan makes it true);
- no container scan remains where the chosen policy requires a maintained ordering;
- eviction work is measured, and the "could not free anything" path stays loud.

---

## 8. Admission and similarity

Optimise admission only after §1 confirms it is still material. After the sweep and the index
work, `EmbeddingLayer.neighborsOf` may not be on the path at all — and "not on the path" is a
better outcome than a faster neighbour search.

Measure index maintenance cost, neighbour lookup cost, admission latency, and total memory
overhead, and compare the last one against the baseline: a maintained index that makes admission
faster and memory unbounded has moved the cost, not removed it, and AIKR makes that a failure
rather than a trade.

The objective is bounded admission cost in the actual reasoning workload, not "fast embeddings"
in isolation.

---

## 9. Statistics and meta work off the critical path

TODO29 A7 declares the budgets. This plan decides where the work happens. Candidates:
invalidation, incremental aggregation, periodic snapshots, budgeted computation, an explicit
diagnostic mode.

The specific offender is measured: `getStatistics()` materialises a priority array and sorts it
twice for two terciles (`util/src/utils/format.ts:24-28` via
`memory/state/statistics.ts:36-37`), and `Memory.totals()` (`:467`) is the cheap alternative
that already exists and is not what the cycle calls.

**Do not weaken observability.** Define when a diagnostic is current versus sampled, and say so
in the type: a `sampledAt` timestamp on a statistics view is part of its contract, not a
detail. A diagnostic that lies about its freshness is a §10.1 comment.

---

## 10. The benchmark matrix

```
population:   10², 10³, 10⁴, 10⁵
working set:  fixed
cycles:       fixed
input stream: fixed
producers:    none / recorded proposal stream
```

Measure both the total cycle cost **and** the cost of each architectural subsystem. A total
improvement with a subsystem regression inside it is not an improvement.

Two of the four population sizes are not reachable today without a long run; the honest response
is to record the largest size that completes and say so, rather than to report a 10⁵ number that
was extrapolated.

---

## 11. The semantic regression matrix

Every major optimisation gets two classes of tests.

**Exact semantic tests — must not move:** NAL parity (`nal1`, `nal2`, `nal7`, `nal8`, `nal9`),
`test:determinism`, `test:hermetic`, proposal replay (TODO29 A9), and the inference fixtures.

**Behavioural equivalence tests — old versus new, per subsystem:** candidate-set recall, top-k
overlap, derivation counts, conclusion and truth-value differences, eviction decisions, proposal
applicability.

**The tolerance is declared before the optimisation is merged, and it differs by subsystem.** An
index may legitimately change which candidates a premise query returns; it may not change what
is derived from a given premise pair. Writing that down first is what stops "the derivations
changed but the tests were still green" from being discovered by a user.

---

## 12. Order of work

```
re-profile (§1)  ── resolve the ADR-018 contradiction first
      ↓
define k, and the ledger (§2, §3)
      ↓
attention (§4)          ← the 8× multiplier lives here
      ↓
retrieval (§5)
      ↓
dispatch (§6)
      ↓
resource / eviction (§7)
      ↓
admission / similarity (§8)
      ↓
statistics and meta work (§9)
      ↓
final scaling gates (§10, §13)
```

After each subsystem: re-run the benchmark, re-profile, and update the ledger's baseline in this
document in the same commit. **Stop optimising a subsystem when its measured contribution is no
longer material**, and record that it was stopped — a plan that optimises everything is a plan
that cannot say which change mattered.

---

## 13. Exit criteria

TODO30 is complete when the post-TODO29 architecture has a **measured and enforced** cost model.
Required evidence:

1. No unexplained population-wide operation on any declared cycle path.
2. Working-set bounds are explicit for every cycle-path operation, and no `k` can silently grow
   to `N`.
3. Attention, retrieval, dispatch and resource-management costs are each measured and recorded.
4. Scaling behaviour is demonstrated empirically at the reachable population sizes, with the
   unreachable ones named as such.
5. Performance gates are reproducible, fail when they should, and run in `pnpm gates`.
6. The semantic regression suite is green, and every tolerance was declared before its change.
7. Resource usage is bounded by declared policy rather than by accidental container behaviour.
8. **This document reports the achieved measurements and the remaining known scaling costs** —
   not a claim that the architecture is "fast", which is unfalsifiable and which this repository
   has enough accurate comments about already.

---

## 14. Not doing

- **No semantics.** If an optimisation changes what is derived, it is not this plan; it is a
  semantic change with a NAL gate, and it belongs in a proposal of its own.
- **No NAL changes.** Not one.
- **No policy changes.** TODO29 A8 owns the lifecycle policies; this plan implements them.
- **No interface changes.** If a port cannot be optimised behind its interface, the port is
  wrong and that is a TODO29 finding to be recorded, not a signature to be widened here.
- **The induction layer's internals are out of scope.** 15 226 lines. A separate plan, after
  A1, when its cost is visible instead of hidden.
- **No timing assertions in the default unit suite.** `slow` tier only.
- **No UI, no System One heads, no MeTTa, no transport layer.**
- **No speculative index.** 574 candidates, 302 unpruned, was this repository's own measured
  answer to "can we detect these automatically". The answer was no, and the answer is still no.

---

## 15. Risks, and what would make this plan wrong

| risk | likelihood | signal | response |
|---|---|---|---|
| **The maintained order does not beat the scan at real working-set sizes** | **medium** — the working sets in this system may be small enough that an O(N) pass is simply fast | `cost:cycle`'s selection counts do not improve, or quality moves with them | the interface is the deliverable; revert the implementation, keep the port, record the measurement. This is the designed outcome, not a failure |
| **Indexed retrieval trades quality for cost** | medium | derivation quality falls on the regression corpus | the tolerance from §11 is exceeded; recall is restored (a semantic fallback), or the index is withdrawn |
| **A maintained structure's memory is unbounded in practice** | medium | memory per resident concept grows with population | AIKR makes this a failure, not a trade: bound the structure, or choose a smaller one |
| **Cost gates make the suite unusable** | low-medium | `cost:cycle` fails on a loaded machine | it gates on counts and ratios, never absolute milliseconds (§3.2) |
| **The ADR-018 contradiction resolves the wrong way** — the microbenchmark was right and the rollout harness is measuring something unintended | **low-medium, and unknown until measured** | a re-profile cannot reproduce the rollout's per-step cost | stop and fix the harness before optimising anything. A cost model measured through a harness that is itself wrong is the exact failure this repository has already paid for twice |
| **The old profile's ranking inverts again after TODO29** | medium | §1's profile disagrees with §1.1's ordering | that is the finding, and it is worth more than the ordering would have been. Re-derive, do not defend the old list |

**The kill criteria.** If §1 shows the population-sized operations are *not* material at the
sizes this system actually runs, then the cost model is not the bottleneck, the thesis of this
document is false, and the honest response is to say so and stop. The one thing that must not
happen is optimising a ranking that was never measured.

---

## 16. Open questions

1. **Which of the six structures in §7 are still needed after TODO29 A1?** Some fall out for
   free once the callers disappear. Re-derive the table; do not work from this one.
2. **What is `k`, actually, for each operation** — and is it bounded by configuration or by
   hope? §2 is the first real work item, not a formality.
3. **Is a maintained attention order the right structure, or is a bucketed one enough?** ADR 006
   and ADR 009 already exist in this repository; read them before adding a fifth design.
4. **Does the repo want a microbenchmark tier, or only end-to-end harnesses?** ADR-018's failure
   is a microbenchmark that measured a state the product never runs in. The alternative is
   end-to-end only, at the cost of attributing a regression to a subsystem.
5. **Should `test:load-sensitive` be re-scoped?** It holds a wall-clock assertion that fails
   under load and passes in isolation. This plan adds more measurement, not more timing
   assertions, so the answer may be "leave it" — but it should be a decision rather than an
   inheritance.

---

## 17. Baseline provenance

| measurement | value | taken | at | reproducible by | load-sensitive? |
|---|---|---|---|---|---|
| per-cycle work (counts) | TODO29 §11.1 | 2026-09-30 | `eb394d4a` | `pnpm bench:cycle` | low — counts |
| inducer invocations per cycle | 33.00 → **must reach 0** in TODO29 A1 | 2026-09-30 | `eb394d4a` | `pnpm bench:cycle` | none |
| profile shares | §1.1 | 2026-09-30 | `d542d5ee` | `node --cpu-prof` | **yes** — min of 9 |
| 3 635-concept rollout | 17.3 s → 14.8 s | 2026-09-30 | `d542d5ee` / `77c4e4f4` | rollouts, min-of-9 | **yes** |
| `InferenceController.step` | 87.77 ns/op | 2026-09-27 | ADR-018 | `tests/nar/c3-hotpath-perf.test.ts` | **yes** — and contradicts the rollout; see §1.2 |
| `test:unit` wall | 90.6 s → 75.5 s | 2026-09-30 | `d542d5ee` / `77c4e4f4` | `pnpm test:unit` ×2 | **very** |

**The post-TODO29 baseline row does not exist yet and must be the first thing added to this
table**, with its commit, before any optimisation begins.

---

## 18. Pass log

### First pass (v1.0)

- Created by splitting TODO29 v1.3 by architectural responsibility: the cost model, the
  complexity targets, indexed retrieval, dispatch winnowing, data-structure work and the cost
  gates moved here; the boundary, the proposal protocol, state ownership, the ports and the
  lifecycle contracts stayed. **No ranking from the old profile is carried forward**, because
  that profile is of a system this plan's predecessor exists to change.
- Moved the fused-system profile and the prediction table here verbatim, marked as not
  surviving.
- Recorded the ADR-018 contradiction (87.77 ns/op against 3.18 ms/step) as the first thing to
  resolve, on the grounds that a cost model measured through a harness that is itself wrong is
  the failure mode this repository has already paid for twice — once in a metric that returned a
  plausible number from a `catch`, and once in a `RuleIndex` comparator whose tie-break was a
  constant.
- Added §3.3 (two inherited measurement defects), §11 (two classes of regression test with
  pre-declared tolerances), §15 (six risks, including the one that says the premise of the
  document may be false), and §17 (provenance with the load-sensitive rows marked).
