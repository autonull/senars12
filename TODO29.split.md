I would make the split **by architectural responsibility**, not simply by moving every performance-related line into TODO30.

The current TODO29 has a strong architectural core: the Stream Reasoner boundary, LM optionality, proposal semantics, state ownership, and decomposition of the 646-line `Memory`. Those should remain. The cost model, indexed retrieval, compiled dispatch, and data-structure optimization should move to TODO30. ([GitHub][1])

There are also two changes I would make to TODO29 itself before splitting it:

1. **Remove performance targets from its acceptance criteria.** The current plan makes `O(k)`, flat scaling, and benchmark ratchets hard requirements. Those should become TODO30 requirements. ([GitHub][1])
2. **Retain architectural boundedness as a semantic contract.** “The core does not depend on the LM,” “proposals only apply at explicit boundaries,” “one owner for attention/decay,” and “no unbounded queues” are architecture, even though they have performance consequences. ([GitHub][1])

Below is the split I would actually use.

---

## Recommended ownership of the current work

| Current work                        |                                TODO29 |                                 TODO30 | Why                                                                           |
| ----------------------------------- | ------------------------------------: | -------------------------------------: | ----------------------------------------------------------------------------- |
| W0 instrumentation                  |                            **Reduce** |                                      — | Keep basic reproducibility/observability; move scaling benchmark into TODO30. |
| W1 Stream Reasoner                  |                              **Keep** |                                      — | Fundamental lifecycle/ownership boundary.                                     |
| W1b LM plugin boundary              |                              **Keep** |                                      — | Fundamental dependency inversion.                                             |
| W2 decay + getter purity            |                    **Keep, narrowed** |                                      — | Read purity, clock ownership, and stable stamps are semantics/architecture.   |
| W3 attention ownership              |          **Keep interface/ownership** |          **Move index implementation** | “One owner” is architecture; heap/tree/index optimization is performance.     |
| W4 Memory ports                     |                              **Keep** |                                      — | Pure decomposition and dependency inversion.                                  |
| W5 retrieval indexes                |                                     — |                               **Move** | Primarily performance/data-structure optimization.                            |
| W6 compiled dispatch                | **Keep interface; move optimization** | **Move compiler/index implementation** | The dispatch abstraction is architectural; making it faster is TODO30.        |
| W7 control-loop budget              |             **Keep budget semantics** |             **Move scheduling/tuning** | Explicit budgets are architecture; optimizing their execution is performance. |
| W8 bounded resource policy          |                    **Keep contracts** | **Move optimized eviction structures** | Resource limits are architecture; heap/index implementations are performance. |
| W9 retrieval-structure optimization |                                     — |                      **Move entirely** | Explicitly performance work.                                                  |
| W10 cost gate                       |                                     — |                      **Move entirely** | It is the performance governance layer.                                       |

That preserves the plan's important insight that **architecture must establish the seams first, then performance work should operate within those seams**. The document itself already recognizes that profiling the pre-split architecture can cause later work to optimize the wrong thing. ([GitHub][1])

---

# TODO29 — revised architecture plan

# TODO29: Runtime Architecture — a closed core, explicit induction boundary, and owned state

**Status:** open
**Scope:** architecture and semantics only
**Performance work:** deferred to TODO30

## 0. Purpose

TODO29 establishes the runtime architecture that the performance work will optimize later.

The desired architecture is:

> **SeNARS is a deterministic reasoning core with explicit state ownership and an optional asynchronous induction layer.**

The core must be a complete reasoner without an induction provider. An induction provider may propose new rules or other artifacts, but it must not participate in the synchronous reasoning cycle, mutate core state directly, or make the core depend on its implementation.

This plan does **not** prescribe latency, throughput, asymptotic complexity, population scaling, or a particular index/data structure. Those belong in TODO30.

## 1. Architectural invariants

These are the hard requirements for TODO29.

### 1.1 Core independence

`nar/src` must not depend on `nar/src/lm/`.

The LM/induction layer may depend on the core only through public core interfaces.

This is an architectural dependency rule, not a packaging preference.

### 1.2 The no-provider core is a complete system

A NAR constructed with zero proposal producers must:

* initialize successfully;
* run inference;
* produce derivations;
* pass NAL1–8;
* pass determinism and hermetic replay.

The absence of an induction provider must mean **absence**, not construction followed by a disabled flag.

### 1.3 Synchronous reasoning is closed

A reasoning cycle has an explicit beginning and end.

No external provider may:

* block the cycle;
* await model work inside the cycle;
* mutate state during a cycle;
* change the rule set halfway through a cycle.

External proposals are considered only at declared synchronization boundaries.

### 1.4 Proposals are data

The core owns the proposal contract.

A proposal must be serializable and versioned. It must contain enough information for the core to determine whether it is applicable to the current state.

A proposal must not contain:

* callbacks into core objects;
* closures over mutable NAR state;
* provider-specific objects;
* references that require the provider to remain alive.

### 1.5 State ownership is explicit

Each mutable subsystem has one architectural owner.

At minimum:

* cycle time has one owner;
* decay has one owner;
* attention has one owner;
* proposal admission has one owner;
* concept storage has one owner;
* inference dispatch has one owner.

Callers request state transitions through owned interfaces instead of writing shared fields directly.

### 1.6 Reads are observational

Public reads must not silently create reasoning identifiers, mutate attention state, advance decay, or otherwise alter semantics.

Repeated reads of the same logical object must return stable identity unless an explicit write occurred.

### 1.7 Bounded resources have explicit lifecycle policies

Queues, caches, bags, histories, and other accumulators must declare:

* ownership;
* capacity policy;
* insertion behavior;
* overflow behavior;
* retention/eviction policy;
* observability when capacity cannot be reclaimed.

TODO29 does not require an optimized implementation of those policies.

## 2. Work

### A0 — Reduce the instrumentation baseline

Keep only the instrumentation required to verify architectural changes:

* cycle/phase counters;
* proposal producer count;
* proposal application count;
* derivation count;
* deterministic replay identifiers;
* LM-in-cycle detection.

Keep `scripts/cycle-bench.ts` as a diagnostic tool, but move population-scaling and latency gates to TODO30.

**Acceptance**

* instrumentation has a self-test;
* architectural tests can prove whether an LM/provider ran during the synchronous cycle;
* deterministic/hermetic tests remain reproducible.

### A1 — Close the cycle: Stream Reasoner

Separate the synchronous reasoner from asynchronous induction.

1. Remove LM execution from `applySyncRules`.
2. Define the proposal submission boundary.
3. Make the synchronous cycle independent of provider latency.
4. Remove cycle-local LM timeout/throttle machinery whose only purpose was to control model execution.
5. Ensure a provider can hang indefinitely without blocking the reasoner.

**Acceptance**

* a deliberately hanging provider does not prevent the core from advancing;
* a zero-provider core advances normally;
* proposal application occurs only at a declared boundary;
* NAL1–8, determinism, and hermetic tests pass.

### A2 — Move induction beyond the core

Introduce core-owned contracts such as:

```ts
interface Proposal {
  schemaVersion: string
  baseRevision: string
  kind: string
  payload: unknown
}

interface ProposalSource {
  request(context: ProposalContext): Promise<Proposal[]>
}
```

The exact schema should be finalized before implementation, but the architectural properties are non-negotiable.

Move:

* LM construction;
* LM registration;
* LM-specific configuration;
* LM-specific strategy types

out of the core.

Replace `enableLMRules` / `lm.enabled` with composition-time registration.

**Acceptance**

* dependency gate forbids core → LM imports;
* the LM can be removed from the build without making the core unusable;
* no LM-specific type appears in core extension contracts;
* no provider implementation can reach private core state.

### A3 — Specify proposal lifecycle

Before implementing provider queues, decide:

* unit of work;
* trigger semantics;
* maximum number of pending proposals;
* overflow policy;
* stale proposal policy;
* behavior when referenced concepts no longer exist;
* version compatibility;
* cancellation semantics;
* replay semantics.

Recommended initial rule:

> proposals are evaluated against an explicit core revision and either applied at the next permitted synchronization boundary or rejected as stale.

Do not allow “apply whenever it arrives”; that would reopen the cycle.

**Acceptance**

A recorded proposal stream can be replayed deterministically against a recorded core state.

### A4 — Establish state ownership

Refactor shared mutable fields so that ownership is explicit.

For attention:

```ts
interface Attention {
  touch(term: Term, reason: AttentionEvent): void
  topK(limit: number): readonly Term[]
  commit(now: number): void
}
```

For decay:

```ts
interface DecayClock {
  tick(now: number): void
}
```

The important change is not the implementation. It is that callers no longer directly mutate `Concept.priority` or invoke decay as a side effect of reading.

**Acceptance**

* every attention mutation passes through one owner;
* decay has one architectural owner;
* read paths do not advance decay;
* the implementation can later be replaced without changing callers.

### A5 — Make `Memory` a set of ports

Split the current `Memory` god-object along responsibility boundaries.

Recommended core interfaces:

```text
ConceptStore
BeliefTable
LinkStore
GoalStore
StatisticsView
```

Do not prematurely implement multiple sophisticated storage backends.

Start with the simplest correct implementation plus a test double.

The purpose is dependency inversion:

> reasoning code depends on concepts of storage, not on one concrete all-purpose memory implementation.

**Acceptance**

* cycle code depends on ports/interfaces;
* storage implementation details do not leak into reasoning code;
* each port has focused unit tests;
* the current behavior remains covered by existing semantic tests.

### A6 — Define inference dispatch as an architectural port

Introduce an abstraction for selecting applicable reactions/rules:

```text
InferenceTable
  lookup(antecedentKind, consequentKind)
  dispatch(...)
```

Do not optimize it yet.

Do not require tries, DAGs, decision trees, heaps, or generated code in TODO29.

The architecture should make it possible to replace the implementation later without changing inference semantics.

**Acceptance**

* inference code depends on the dispatch interface;
* rule representation and dispatch implementation are separate;
* NAL1–8 remains green;
* existing rule-ordering behavior is either explicitly preserved or explicitly specified as a semantic change.

### A7 — Define control budgets as semantics

Retain explicit budgets for work that is conceptually bounded:

* derivations per step;
* secondary premise consideration;
* proposal application;
* control/meta work.

Do not prescribe how cheaply those budgets are executed.

The purpose is to prevent an operation from being semantically unbounded merely because a downstream performance plan has not been written yet.

**Acceptance**

Every budget has:

* a named owner;
* a default;
* a configuration source;
* a defined overflow behavior;
* a test demonstrating enforcement.

### A8 — Define memory/resource contracts

Retain the architectural requirement that every bounded container has an explicit policy.

For each resource, document:

```text
resource
owner
capacity
retention policy
overflow behavior
failure/pressure signal
```

Do not redesign the eviction data structures in TODO29.

**Acceptance**

A reviewable inventory exists for all production accumulators that can grow without explicit bounds.

### A9 — Deterministic replay

Make recorded proposals first-class test fixtures.

A hermetic run must be able to use:

```text
core state
+ recorded proposal stream
+ configuration
+ deterministic inputs
```

with no live provider involved.

Proposal schema/version mismatches must fail explicitly rather than silently replaying against incompatible state.

**Acceptance**

* live provider is unnecessary for hermetic tests;
* recorded proposals replay identically;
* incompatible proposal versions fail loudly.

## 3. Explicitly out of scope

TODO29 does not optimize:

* attention indexes;
* nearest-neighbor structures;
* premise retrieval;
* heap-based eviction;
* `selectTopN`;
* rule-dispatch indexing;
* compiler choice;
* cache implementation;
* population-scaling behavior;
* latency/throughput targets.

Those are TODO30.

## 4. Architectural exit criteria

TODO29 is complete when:

1. the core builds and runs with no induction provider;
2. no core package imports the LM layer;
3. provider execution cannot block the synchronous cycle;
4. proposals cross a single explicit, versioned boundary;
5. proposal replay is deterministic;
6. read operations are observational;
7. state ownership is explicit for attention, decay, storage, and dispatch;
8. memory/resource policies are explicit;
9. NAL1–8 and existing semantic tests remain green;
10. performance has been re-profiled only as information, not as an acceptance criterion.

No latency or asymptotic target is required to close TODO29.

---

# TODO30 — performance plan

I would make TODO30 deliberately **measurement-first and architecture-aware**. It should not repeat the old diagnosis. TODO29 changes the system enough that the existing profile is no longer a reliable ordering of bottlenecks; the current document already calls for a re-profile after W1b for exactly that reason. ([GitHub][1])

# TODO30: Runtime Performance — bounded work on the architecture established by TODO29

**Status:** planned
**Prerequisite:** TODO29 architecture complete

## 0. Purpose

TODO30 optimizes the runtime **after** the core/induction boundary, ownership model, and storage interfaces have stabilized.

The goal is not to make the old implementation fast.

The goal is to establish, measure, and enforce the cost model of the new architecture.

## 1. First step: re-profile

Do not carry TODO29's old hot-path ranking forward.

Run a fresh profile against the post-TODO29 architecture.

Measure:

* wall time per cycle;
* work per phase;
* concepts touched;
* premises considered;
* rule dispatches;
* rule applications;
* derivations;
* admissions;
* evictions;
* provider calls outside the cycle;
* allocations;
* memory usage.

Run at multiple population sizes while keeping the logical workload fixed.

Record the results as the new baseline.

## 2. Define the working-set model

Before claiming `O(k)`, define exactly what `k` means.

For each operation identify:

```text
N = total resident population
k = maximum live working set consulted by the operation
```

Document how `k` is bounded.

A claimed `O(k)` operation is not accepted if `k` can silently grow to `N`.

## 3. Attention index

Replace global ranking with a maintained attention structure.

Candidate implementations may include:

* heap;
* ordered tree;
* bucketed priority structure;
* NARchy-inspired priority structure.

The implementation is selected from measurements, not architecture preference.

Requirements:

* explicit owner;
* bounded update cost;
* efficient top-k;
* correct deletion;
* correct stale-entry handling;
* deterministic tie-breaking.

**Acceptance**

* no population-wide ranking on the normal cycle path;
* top-k results preserve the intended semantic ordering;
* scaling data demonstrates the claimed working-set behavior.

## 4. Indexed retrieval

Replace population scans with indexes appropriate to the query.

Start from actual post-TODO29 profiles.

Potential structures:

* symbol index;
* link index;
* goal index;
* similarity index;
* maintained candidate sets.

Do not build every index preemptively.

For each index record:

```text
query
candidate source
expected candidate bound
maintenance cost
semantic fallback
```

**Acceptance**

* representative premise queries do not enumerate the full population;
* candidate recall is measured against the old implementation;
* derivation/regression corpus remains within the agreed semantic envelope.

## 5. Rule dispatch

Implement the dispatch port using the measured workload.

Possible implementations:

* direct table;
* trie;
* DAG;
* generated dispatch;
* decision tree.

Do not retain the current catch-all-plus-sort merely because it is familiar.

Measure:

* candidate count;
* matching work;
* dispatch time;
* rule application count.

Add an explicit branch-factor budget.

**Acceptance**

* no full candidate sort on the normal dispatch path;
* rule applications are bounded;
* NAL1–8 and inference regression fixtures remain green.

## 6. Resource/eviction optimization

Implement the policies specified in TODO29 using suitable data structures.

Targets include:

* container eviction;
* task retention;
* aggregate task bounds;
* bounded caches;
* history storage.

Candidate structures include heaps, intrusive lists, generation counters, and indexed expiration.

Do not change semantic retention policy and data structure in the same change unless unavoidable.

**Acceptance**

* resource occupancy is observable;
* pressure is monotonic with resource usage;
* eviction work is measured;
* no container scan remains where the chosen policy requires maintained ordering.

## 7. Admission and similarity lookup

Optimize concept admission only after confirming it remains a material cost.

Measure:

* index maintenance cost;
* neighbor lookup cost;
* admission latency;
* total memory overhead.

Possible implementations:

* maintained nearest-neighbor structure;
* approximate search;
* bounded candidate index.

The objective is not "fast embeddings" in isolation; it is bounded admission cost in the actual reasoning workload.

## 8. Statistics and meta work

Move nonessential statistics out of the critical path where justified by measurements.

Possible techniques:

* invalidation;
* incremental aggregation;
* periodic snapshots;
* budgeted computation;
* explicit diagnostic mode.

Do not weaken observability. Define when diagnostics are current versus sampled.

## 9. Performance gates

Add a performance ledger containing:

```text
operation
cycle-path status
expected complexity
working-set definition
benchmark
baseline
ratchet
semantic guard
```

Every performance gate must first have a failing test or failing measurement.

Use separate slow-tier benchmarks rather than timing assertions in the default unit suite.

## 10. Required benchmark matrix

At minimum:

```text
population:   10², 10³, 10⁴, 10⁵
working set:  fixed
cycles:       fixed
input stream: fixed
providers:    none / recorded proposals
```

Measure both:

1. total cycle cost;
2. cost of each architectural subsystem.

Do not accept a total-speed improvement that hides a semantic or memory regression.

## 11. Semantic regression matrix

Every major optimization gets two classes of tests.

### Exact semantic tests

* NAL1–8;
* deterministic replay;
* proposal replay;
* inference fixtures.

### Behavioral equivalence tests

Compare old and new implementations for:

* candidate-set recall;
* top-k overlap;
* derivation counts;
* conclusion/truth-value differences;
* eviction decisions;
* proposal applicability.

The exact equivalence requirement may differ by subsystem, but the tolerance must be explicit before the optimization is merged.

## 12. Optimization sequence

```text
re-profile
   ↓
define k and cost ledger
   ↓
attention
   ↓
retrieval
   ↓
dispatch
   ↓
resource/eviction
   ↓
admission/similarity
   ↓
statistics/meta work
   ↓
final scaling gates
```

After each major subsystem, repeat the benchmark and profile.

Stop optimizing a subsystem when its measured contribution is no longer material.

## 13. Final exit criteria

TODO30 is complete only when the post-TODO29 architecture has a measured and enforced cost model.

Required evidence:

* no unexplained population-wide operations on declared cycle paths;
* working-set bounds are explicit;
* attention, retrieval, dispatch, and resource-management costs are measured;
* scaling behavior is demonstrated empirically;
* performance gates are reproducible;
* semantic regression suite remains green;
* memory/resource usage is bounded by policy rather than accidental container behavior.

The final document should report both the achieved measurements and the remaining known scaling costs rather than declaring the architecture "fast" in the abstract.

---

## A few changes I would make to TODO29 beyond the split

### 1. Change the title

The current title is:

> “Runtime — the cycle's cost model, and the retrieval engine underneath it”

That makes performance sound like the primary purpose. ([GitHub][1])

I would rename it:

> **TODO29: Runtime Architecture — a closed core, explicit induction boundary, and owned state**

Then TODO30 can own the cost model.

### 2. Replace §3.1 entirely

The current §3.1 is a detailed complexity target covering decay, top-k, retrieval, relevance propagation, dispatch, admission, goals, and statistics. ([GitHub][1])

In TODO29, replace it with an **architecture contract**:

> Every cycle-path responsibility must have an explicit owner and an interface through which its implementation can be replaced. No cycle-path component may require an external provider, hidden global state, or an implicit population traversal.

That gives TODO30 a clean surface to optimize.

### 3. Move §5 “expected to buy”

The current table predicts `0` decay read-path passes, `O(k)` selection, flat rollout scaling, etc. ([GitHub][1])

That entire section belongs in TODO30 because it is performance hypotheses, not architecture.

TODO29 should instead have:

> **What this architecture makes possible**

That section should discuss decoupling, determinism, replaceability, testing isolation, and optional providers.

### 4. Keep the NARchy comparison, but change its purpose

The current comparison is partly performance-oriented: index, priority structures, bags, compiled reactions, and bounded working sets. ([GitHub][1])

Keep it as **architectural precedent**, not as a performance benchmark:

> NARchy demonstrates that storage, attention, inference dispatch, and control can be separate architectural concerns.

Move statements such as “slower in every row” and quantitative comparisons to TODO30.

### 5. Make proposal semantics much more explicit

This is the one area I would expand, not contract.

The current plan correctly identifies unit of work, trigger, backpressure, stale proposals, evicted references, and version compatibility as unresolved questions. ([GitHub][1])

I would make those **A3 acceptance criteria**, because otherwise the most important architectural boundary remains prose.

In particular, define:

```text
Provider observes revision R
        ↓
Provider emits proposal P based on R
        ↓
Core reaches synchronization boundary
        ↓
Core checks P.schemaVersion
Core checks P.baseRevision
Core checks referenced objects
        ↓
apply(P) OR reject(P)
```

That gives the Stream Reasoner a real semantic protocol rather than merely an async function call.

### 6. Split W3 rather than delete it

The current W3 combines two very different ideas: **attention ownership** and **an efficient attention index**. ([GitHub][1])

Keep this in TODO29:

> `Concept.priority` has one owner; callers issue typed attention events.

Move this to TODO30:

> heap/tree/PriTree/ordered structure; `topK` complexity; scaling measurements.

This is an important distinction because the first determines the architecture while the second determines the implementation.

### 7. Do the same with W6

Keep:

> “Inference dispatch is a replaceable architectural subsystem.”

Move:

> “Use trie/DAG/decision tree / remove catch-all / eliminate sort.”

The current TODO29 already recognizes compiled reactions as NARchy's architectural shape, but the actual choice among compilation strategies is a performance engineering decision. ([GitHub][1])

### 8. Change the hard invariant about boundedness

The current invariant says the complexity budget ratchets downward and every change must lower production LOC. ([GitHub][1])

I would remove that entirely.

Replace it with:

> **Every unbounded resource must have an explicit owner and lifecycle policy.**

That is architectural and testable without forcing developers to optimize code before the architecture stabilizes.

### 9. Keep `W0`, but shrink it dramatically

The existing W0 is mostly a performance harness: multiple population sizes, cost tables, wall-clock measurements, and scaling reproduction. ([GitHub][1])

For TODO29, only keep:

* self-validating instrumentation;
* cycle/phase counters;
* LM-in-cycle detection;
* proposal application counters;
* deterministic replay hooks.

Then TODO30 can consume the same instrumentation instead of building a second harness.

### 10. Add an explicit “architecture review” gate

Before TODO29 closes, review the dependency graph and answer:

```text
Can the core be built without LM?
Can the core be run without LM?
Can the core be replayed without LM?
Can a provider hang without blocking the core?
Can a provider mutate core state directly?
Can a proposal be applied mid-cycle?
Can attention state be mutated without going through its owner?
Can a read silently change reasoning state?
Can any resource grow without an explicit policy?
```

Those questions are much more valuable to the architecture plan than a benchmark number.

---

## The resulting project boundary

The cleanest overall structure is:

```text
TODO29
──────
Define what the runtime IS.

Core
  → deterministic
  → synchronous
  → provider-independent
  → explicit state ownership
  → explicit proposal protocol
  → explicit resource lifecycle
  → replaceable storage/attention/dispatch ports

        ↓

TODO30
──────
Make that architecture COST what we intend.

  → profile
  → define N vs k
  → index
  → optimize attention
  → optimize retrieval
  → optimize dispatch
  → optimize eviction
  → optimize admission
  → add scaling gates
```

That split should make both documents **stronger**: TODO29 becomes easier to review for architectural correctness, while TODO30 becomes a focused performance program whose assumptions are based on the architecture that actually landed, rather than on the pre-refactor profile. The current TODO29 explicitly identifies that re-profiling point as necessary; this split makes it the formal handoff between the two plans. ([GitHub][1])

[1]: https://github.com/autonull/senars12/blob/main/TODO29.md "senars12/TODO29.md at main · autonull/senars12 · GitHub"
