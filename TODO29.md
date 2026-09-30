# TODO29: Runtime Architecture — a closed core, an explicit induction boundary, and owned state

**Version:** 2.0 (2026-09-30) · **Predecessor:** TODO28 (phases A–P; structure, the package graph, the
barrels, the gate list), which closed the structural axis and left the runtime. **Successor:**
TODO30 (the cost model of whatever this lands), which is blocked on this document.

**Status: open. Scope: architecture and semantics.** Nothing here has landed. **No latency,
throughput, complexity, population-scaling, or index-shape requirement appears in this
document's acceptance criteria** — every one of those moved to TODO30, deliberately, because
they are measurable only after the seams they will be measured through exist. What remains here
is the part that is testable on a tree in its current state: dependency direction, proposal
semantics, state ownership, read purity, and declared resource lifecycle.

> **A fresh session should read §1.10, §4.0, §4/A1 and §15 first.** §1.10 says which findings
> survive the split into this document and which belong to TODO30; §4.0 is the
> finding → workstream trace; §15 lists the two kill criteria, and both are checkable before
> anything is built.

### What v2.0 changed, and why this document is smaller than v1.3

v1.3 was one plan with two jobs. It wanted to close the reasoning cycle *and* make the closed
cycle fast, and it inherited v1.0's cost model (§3.1) as an acceptance criterion. That coupling
is what produced the plan's own central mistake, which v1.2 already identified and v1.3 still
carried: **the workstream order was derived from a CPU profile of the fused system**, in which
the language model ran 33 times per cycle inside the cycle. Optimising against that profile is
how a month goes missing.

So the work is split **by architectural responsibility**, not by whether a line mentions
performance:

| v1.3 workstream | this document | TODO30 | why |
|---|---|---|---|
| W0 instrumentation | **reduced** (A0) | population-scaling bench, cost gates | reproducibility is needed to judge architecture; scaling claims are not |
| W1 Stream Reasoner split | **kept** (A1) | — | lifecycle and ownership boundary |
| W1b LM beyond the core | **kept** (A2) | — | dependency inversion |
| W2 decay + getter purity | **kept, narrowed** (A4) | — | read purity and clock ownership are semantics |
| W3 attention | **interface only** (A4/A7) | index structure, `topK` cost, scaling | one owner is architecture; a heap is a decision |
| W4 `Memory` ports | **kept** (A5) | — | decomposition and dependency inversion |
| W5 retrieval indexes | — | **moved** | data-structure optimisation |
| W6 compiled dispatch | **port only** (A6) | trie/DAG/codegen, sort removal | the abstraction is architectural, its speed is not |
| W7 control-loop budgets | **budget semantics** (A7) | scheduling and tuning | explicit bounds are architecture |
| W8 bounded-resource policy | **contracts** (A8) | eviction structures, heaps | limits are architecture; containers are not |
| W9 retrieval structures | — | **moved** | explicitly performance |
| W10 cost gate | — | **moved** | the performance governance layer |

The architectural half has a stronger claim than the performance half did, and it is the one
this repository's gates can enforce: *"the core does not depend on the induction layer"*, *"a
provider cannot block or mutate a cycle"*, *"proposals cross one versioned boundary and only at
a declared one"*, *"priority and decay have one owner each"*, *"no resource grows without a
declared policy"*. None of those needs a benchmark to verify and all of them are currently
false, which is why they are the exit criteria.

**§3.1, the cost model, is not weakened here — it is relocated.** TODO30 §2 asks a sharper
version of the same question: not "is the cycle O(k)" but "what is `k`, exactly, and can it
silently grow to `N`?" That question is unanswerable until A5 and A6 have replaced the god-object
with ports, because until then there is no seam at which to count anything.

### Corrections to v1.3's own numbers, re-measured at `919c21ab`

v1.3's provenance table existed to enforce "a number with no commit in it is not evidence".
Applying it to v1.3's numbers found four that had drifted or were imprecise. They are corrected
here rather than carried, because a plan that quotes its own stale numbers teaches the next
session to quote its own stale numbers.

| v1.3 said | measured at `919c21ab` | how |
|---|---|---|
| 36 core files import `nar/src/lm/` | **39** | `grep -rlE "from '[^']*lm(/|')" nar/src --include=*.ts \| grep -v '^nar/src/lm/'` — same tree, wider pattern |
| "`initializeLMRules` is called at construction (`nar.ts:18`)" | `:18` is the **import**; the calls are `nar.ts:762` and `:823`, the private method `:837` | the claim stands, the citation did not |
| "the only call site of `score()` is `lifecycle/forgetting.ts:67`" | `nar/src/memory/lifecycle/forgetting.ts:46`, `scorer.scoreForForgetting(c)` | the file moved under `memory/`; the claim stands |
| "19 writers on `Concept.priority`" | **10 sites** write `Concept.priority` outside the class; 6 more assign an unrelated `priority` field (`links/Layer.ts:64,118`, `memory/focus.ts:80`, `bag/Bag.ts:170`, `rlfp/PolicyOptimizer.ts:132`, `lm/lm-rule-factory.ts:46`) that a grep cannot tell apart | the finding is stronger, the number was a conflation |

Also corrected, and load-bearing: v1.3's `§7 invariant 4` requires every change to lower
`productionLOC`, describing a downward ratchet. The gate is `mustNotIncrease` and its own
comment says so (`scripts/lib/complexity-budget.ts:9-13`); the baselines are ceilings. The
invariant is replaced in §7 below, and the gate is left exactly as it is.

### The thesis, stated so it can be wrong

> SeNARS is a deterministic reasoning core with explicit state ownership and an optional
> asynchronous induction layer. The core is closed, bounded, and useful on its own; the
> induction layer proposes rules and other artifacts, and the system is better than a
> NAR-shaped reasoner without it **and** better than a language model without it.

The last clause is the falsifiable half, and no test in this repository currently addresses it
(§12 Q3). Building that experiment is more important than any workstream in §4 and is not
scheduled here, which is a real gap in this plan rather than a decision.

---

## 0. What this is

Eight findings from a profiling and contract-audit pass, in order of how much they cost, plus
one that costs nothing and is the most important. §1.9 is last because it is not a performance
finding at all.

**§1.1 A read mutates the heap.** `Memory.sample()` sweeps the entire concept population to decay
it and is itself reached once per sampled concept, so one inference cycle performs **eight decay
writes over the whole population and eight whole-population ranking passes** (measured, §11.1).
The decay clock therefore advances `min(sampleSize, population)` times per cycle, which means
`activationDecayRate` does not mean what the configuration says: the effective rate is
`activationDecayRate × min(sampleSize, population)`. `maxSampledConcepts` is documented as *how
many concepts to sample for inference* and is in fact a decay-rate knob (§11.2).

**§1.2 Every read of memory is a full scan, and the index that exists is bypassed.** `sample`,
`decayAll`, `forEachConcept`, `listConcepts`, `findConcepts`, `findSimilarConcepts`,
`removeConceptsMatching`, `getGoals`, `getRevisionHistory` and `getStatistics` are all
population-sized, and `getStatistics` additionally materialises a priority array and sorts it
twice for two terciles (`util/src/utils/format.ts:24-28`, called from
`memory/state/statistics.ts:36-37`). `Memory.totals()` (`memory.ts:467`) exists precisely as the
cheap alternative — "totals without the tercile pass" — and the cycle path calls the expensive
one anyway. Meanwhile `LinkManager` + `EmbeddingLayer` + `AssociativeRegistry` exist to provide
indexed recall, and the *default* premise source (`PREMISE_SOURCES.bag`,
`strategies/premise/primitives.ts:56`) is `memory.sample(n)`: a full scan and a sort.

**§1.3 The thing that decides what to attend to decides nothing.** `MemoryScorer` has four
factors. Its only call site supplies no context
(`memory/lifecycle/forgetting.ts:46` → `scorer.scoreForForgetting(c)`), so `noveltyOf(0) ≡ 1`
and `relevanceOf(0) ≡ 0` on every path, and the three per-concept scorers reduce to
`clamp01(0.5 + w·priority)` — strictly monotone in `concept.priority`, never clipping
(`memory/pressure/scorer.ts:22-36, 84-88`). **Ranking by retrieval score is exactly ranking by
priority.** `lastAccessTime` and `lastAccessedAt` appear in the context type at `:48-49` and
are read nowhere.

**§1.4 Eviction measures the wrong resource, and its candidate filter is anti-correlated with
pressure.** `memory/pressure/consolidation.ts:24` measures `capacityPressure()` =
`occupancy(concepts.size, maxConcepts)` (`memory.ts:462`). But every concept gets
`beliefBag` 100 + `goalBag` 50 + `questionBag` 20 (`memory/concept.ts:76-80`), so the reachable
ceiling is `maxConcepts × 170` tasks with no aggregate bound, `totals()` already reports
`totalTasks`, and eviction does not read it. The candidate filter is `totalTasks === 0`
(`memory.ts:519`): under pressure, the concepts holding tasks are the valuable ones and are all
protected, so the only evictable concepts are empty shells that cost nothing to keep. **Memory
becomes unshrinkable precisely when it is most full, and it fails silently.**

**§1.5 `getGoals()` mints a stamp on every call.** `memory.ts:253` is
`stamp: g.stamp ?? Stamp.createInput()`, and `Stamp.createInput()` takes a fresh
monotonically-increasing id. `getGoals()` is a population scan reached from five call sites, so
the same goal returns a different stamp on successive calls — and `noStampOverlap`
(`strategies/premise/primitives.ts`) reasons about stamp overlap. **Anything keyed on stamp
overlap is reasoning about an id that by construction never repeats.** The same method
allocates a fresh `Task` per goal per call, on a path that is already population-sized.

**§1.6 `Concept.priority` has no owner.** Ten sites outside `concept.ts` write it:
`memory.ts:569` (the decay sweep), `reason/inference-controller.ts:110` (a relevance boost),
`strategies/attention/SpreadingActivation.ts:17`, `nar-io.ts:327` and `:341` (an O(N) relevance
scan), `focus/Focus.ts:211`, `kernel/replay.ts:185` (a deserialiser writing a *replayed* value),
`memory/state/serialization.ts:110`, `self/SelfOptimizer.ts:136`, and
`tools/adapters/coverage-concept.ts:65`. Inside the class there are six more: the setter (`:95`),
`boost` (`:138`), `decay` (`:142`), `decayAttention` (`:149`), `mergeWith` (`:247`) and
`recordAccess` (`:277`). A write from a strategy, a replay, a deserialiser
and a population sweep land in the same field, and §1.1's cost depends on how many of them ran
this cycle. The same audit found `Concept.addLink` called from exactly one place (its own
`mergeWith`) and `addChildConcept` with zero callers, so `linkedConcepts` / `subConcepts` /
`parentConcepts` are never populated — which makes `SpreadingActivation.prime` and
`Concept.updateLinks` no-ops and `findOrphanedLinks` trivially empty. Dead structure, still
maintained.

**§1.7 The growth arithmetic.** `maxConcepts` 1 000 × 170 tasks; term-layer capacity 1 000 with
`eviction: { by: entry => entry.priority }` and a `BoundedMap.#selectVictim` that scans the whole
map for the lowest score (`util/src/utils/bounded-map.ts:210-216`); `EmbeddingLayer.neighborsOf`
is population-sized and `Memory.adoptConcept` calls `indexConcept` for every new concept
(`memory.ts:308-314`), so admission is quadratic; `TermCollection.deleteItem` shifts every index
above the removed slot (`terms/impls/term-collection.ts:57-65`); `selectTopN` is a bounded
buffer with an insertion sort (`util/src/utils/collections.ts:126`). None is catastrophic alone.
Together they mean the system's cost per cycle grows with its memory, which is the one property
a reasoning system cannot have. **This finding is entirely TODO30's** — A4 fixes *who* may
write `priority`, not with what structure it is read.

**§1.8 Two rules that document a fix they did not get.** `rules/impls/RuleIndex.ts:131-140` —
the comment names the exact hazard (weighting priority by a success rate that starts at zero
collapses the comparator) and reorders the comparator to avoid it, while `recordRuleHit`, the
only writer of `hitStats`, has no callers outside `RuleIndex` itself; the tie-break is the
constant the comment describes having moved away from. `rules/impls/processor.ts:156-181` — the
`stepScalars` memo is never invalidated, because the `resetMetaBudget()` call at
`nar-execution.ts:368` resolves to `NARExecution`'s *own* private method (`:179`) through the
structurally identical port declaration at `:76`/`:116`, so every LM rule ever run reasons about
`totalConcepts`, `memoryPressure` and `conflictCount` as of one instant in the life of the
process. A shadowed method name, a memo with no invalidator, and an aggregate that costs two
sorts to compute once — all within 40 lines, and §1.8 is a *frozen* value, not a slow one.

**§1.9 The seam already exists, is bounded, is gate-checked, and has no caller.** This is the
finding v1.3 got wrong in the direction that mattered: v1.2 concluded the Stream Reasoner "lives
in prose". It does not. `nar/src/stream/reasoner.ts` is a committed, exported, tested class:

```ts
export class StreamReasoner {
  private readonly queue: LMRequest[] = [];                       // pushCapped, maxPending 256
  private readonly provisionals: BoundedMap<string, ProvisionalBelief>;
  pressure(): number { return occupancy(...); }                    // backpressure signal
  async flush(backend: LMBackend, pressure: number) { ... }         // the async boundary
  reasonHook(backend, pressureOf)                                  // a tick-stage hook
}
```

It defers at `highPressure`, asks the kernel `BudgetGate` for an `lm-call` budget before it
touches a backend (`reasoner.ts:80`), keeps provisional beliefs at `provisionalConfidence` 0.3,
and is wired into the tick stage contract (`tick/bindings.ts:116`). **Its only caller in the
whole repository is `tests/nar/todo5b-phase1.test.ts`.** Meanwhile the cycle reaches the language
model by a completely different route: `strategies/derivation/DefaultDerivation.ts:26,30` calls
`processor.processLMRules` directly, inside the synchronous derivation, and
`inferenceController.step(5000, …)` (`nar-execution.ts:234`) puts a five-second deadline on a
step whose unbudgeted cost should be tens of microseconds.

So the split is not a design to be invented. It is a **wiring change plus a payload change**:
make the bounded, gated, asynchronous channel the only channel, and give its payload a version.
The overflow policy is already written — `pushCapped` drops the **oldest**
(`util/src/utils/collections.ts:33-36`) and so does the budget-denied path via `trimCapped`
(`:43-47`) — which is *drop-oldest*, and §4.1's own reasoning says drop-oldest is wrong because
it discards exactly the context the inducer needed. That is a decision with an existing
implementation to change, not an open question.

---

## 1. The diagnosis

The findings are stated once in §0, in order of cost. This section is the evidence.

### 1.1 A read mutates the heap

`nar/src/memory/memory.ts:355`

```ts
sample(limit: number): Concept[] {
  this.decayAll();                 // mutates every resident concept
  return this.topConcepts(limit);  // ranks every resident concept
}
```

A method named `sample` has a whole-heap side effect, and it is on the read path. Its callers,
per inference cycle:

| caller | count per cycle | source |
|---|---|---|
| `InferenceController.cycle` → `samplingStrategy.sample` | 1 | `reason/inference-controller.ts:100` |
| `PREMISE_SOURCES.bag` → `memory.sample(n)` | 1 per sampled concept | `strategies/premise/primitives.ts:56` |
| `WindowedRoulette` → `sampleWindow` | 1 per cycle when selected | `strategies/sampling/WindowedRoulette.ts:40` |

Measured at 164 resident concepts, 40 cycles, defaults otherwise: **8.2 `decayAll` calls, 8.0
`memory.sample` calls and 5.0 `forEachConcept` calls per cycle** (§11.1). `decayAll`'s three call
sites are `sample`, `sampleWindow` and `consolidate` (`memory.ts:355, 371, 389`) — only the third
is a clock tick.

The coupling is not incidental. The premise *source* decides how many decay passes happen, and
the premise source is chosen by configuration:

```
maxSampledConcepts= 5   population=86    decayAll per cycle=5.2
maxSampledConcepts=10   population=139   decayAll per cycle=8.4
maxSampledConcepts=20   population=164   decayAll per cycle=9.0
maxSampledConcepts=40   population=164   decayAll per cycle=9.0
```

Four runs, identical `activationDecayRate: 0.01`. A retrieval-breadth knob is a decay-rate
knob, and the number saturates only because the population runs out.

### 1.2 Reads are full scans, and the index is bypassed

`Memory` is 646 lines and does storage, decay, ranking, eviction, archiving, focus maintenance,
link management, indexing and statistics. The population-sized members on or near the cycle
path:

| member | cost | note |
|---|---|---|
| `sample` / `sampleWindow` / `decayAll` | O(N) + O(N) | §1.1 |
| `forEachConcept` (`:216`) | O(N) | 5×/cycle; `nar-io.ts:337` is one caller |
| `listConcepts` (`:206`) | O(N) + array alloc | `GoalBiasedSampling:18`, `pressure/consolidation.ts:24`, `NoveltySampling`, `DiverseSampling` |
| `getGoals` (`:253`) | O(N × goals) + a `Task` per goal | `rules/impls/processor.ts:393`, `nar-execution.ts:417, 455`, `context-assembler.ts:153` |
| `getStatistics` (`:471`) | O(N) + array materialisation + **two sorts** | `nar-execution.ts:424` every 10 cycles; `processor.ts` step scalars |
| `findSimilarConcepts` (`:542`) | O(N) over indexed concepts | — |
| `LinkManager.applyDecay` (`links/LinkManager.ts:83`) | O(total links) | every consolidation (`memory.ts:393`) |
| `EmbeddingLayer.neighborsOf` (`links/EmbeddingLayer.ts:70`) | O(embedding count) | on every `indexConcept` ⇒ **admission is O(n²)** |

`AssociativeRegistry` is the thing that knows which concepts are related, and two of five
premise sources (`links`, `graph`) and one of four samplers reach through it. The default premise
source is `bag` — a scan.

**What this section is not saying:** that the fixes are index swaps. A4 and A5 decide who owns
what; which structure answers which query is TODO30 §4, and it is decided from a post-A6
profile, not from this table.

### 1.3 The scorer is decorative

`nar/src/memory/pressure/scorer.ts`. The only call site in the tree is
`memory/lifecycle/forgetting.ts:46` — `scorer.scoreForForgetting(c)`, with no context — so
`novelty` is always `1`, `relevance` always `0`, and the three per-concept scorers reduce to

```
retrieval      = clamp01(0.5 + 0.20 · priority)
consolidation  = clamp01(0.5 + 0.10 · priority)
forgetting     = clamp01(0.5 + 0.06 · priority)
```

which is what `FACTORS` (`:22-28`) and `scoreFor` (`:84-88`) actually compute. The abstraction
also costs a `.map` + two `.filter`s + a sort copy at its call sites, on a path the cycle walks
once per concept.

### 1.4 Eviction measures the wrong resource

`nar/src/memory/pressure/consolidation.ts:24`

```ts
const pressure = memory.capacityPressure();          // occupancy(concepts.size, maxConcepts)
if (pressure <= PRESSURE.ARCHIVE) return ...;
const idle = sortBy(memory.listConcepts().filter((c) => c.totalTasks === 0), c => c.priority);
if (idle.length === 0) return { archived: 0, forgotten: 0 };
```

See §0. The two failures are independent and both are silent: the trigger watches the wrong
quantity, and when it does fire the candidate set is empty for a reason correlated with pressure
rather than anti-correlated with it. A memory at 99% with nothing evictable returns
`{ archived: 0, forgotten: 0 }`, which every caller reads as "nothing to do".

### 1.5 `getGoals()` mints a stamp on every call

`nar/src/memory/memory.ts:253`. See §0. The severity is not the allocation: it is that a getter
fabricates identity, which means every downstream uniqueness argument built on `Stamp` is
unsound for goals specifically.

### 1.6 `Concept.priority` has no owner

The ten external writers and six internal ones are listed in §0. The additional finding —
`linkedConcepts` / `subConcepts` / `parentConcepts` are never populated outside `mergeWith` — is
what makes `SpreadingActivation.prime` and `Concept.updateLinks` no-ops wearing a real cost:
`inference-controller.ts:104-110` calls `prime` and then applies whatever boost it returns,
forever, to a graph with no edges.

### 1.7 The growth arithmetic

Listed in §0 and **owned by TODO30 §4 and §7**. It is recorded here because A5 and A8 must not
redesign storage in a way that forecloses the structures TODO30 will want — the ports are chosen
so that each one can be re-implemented behind its interface.

### 1.8 Two rules that document a fix they did not get

**The rule-ranking tie-break.** `nar/src/rules/impls/RuleIndex.ts:131-140`

```ts
// Declared priority is the primary order. Observed success only breaks
// ties: weighting priority by a success rate that starts at zero for
// every rule collapses the comparator to a constant and orders nothing,
// so a rule with no track record would never be ranked at all.
const byPriority = b.priority - a.priority;
if (byPriority !== 0) return byPriority;
return (
  (this.hitStats.get(b.id)?.successRate ?? 0) - (this.hitStats.get(a.id)?.successRate ?? 0)
);
```

The comment is a correct description of a bug that is still present, because the measurement
that would populate the field is never taken. Per §10.1's second rule, **a doc comment that
explains a bug the code still has is a failing test that was never written.**

**Frozen LM-rule context.** `nar/src/rules/impls/processor.ts:156-181`, with the shadowed
port at `nar-execution.ts:76`/`:116`, the implementation at `:179`, and the call at `:368`. The
doc comment says "at most once per inference step (prompt hints may be a step stale)"; it is not
a step stale, it is a process stale.

### 1.9 The seam exists, is bounded, is gated, and has no caller

Full statement in §0. Three consequences the work depends on:

1. **A1 is a wiring change, not an invention.** The bounded queue, the backpressure signal, the
   budget-gate check and the provisional-truth discipline are committed, exported, and tested.
   What is missing is (a) the cycle uses a different path, and (b) the payload is a prompt and a
   truth value rather than a versioned artifact.
2. **The architecture is testable against an object that already exists.** The "provider hangs
   forever" test does not need a fake LM port invented for it; it needs a `StreamReasoner` whose
   backend never resolves, and an assertion that the cycle still completes.
3. **The overflow policy is already chosen and is the wrong one.** Drop-oldest, twice. §4.1
   turns that from a question into a one-line change with a test.

### 1.10 Which findings survive, and who owns each

v1.0 profiled a tree in which the induction layer sat inside the cycle, so it is worth being
explicit about which findings are properties of the *design* and which are properties of that
particular failure to reach it. The right column matters more than it did: this document and
TODO30 are different plans with different gates, and a finding with no owner is a finding with
no gate.

| § | finding | survives the split? | owner |
|---|---|---|---|
| 1.1 | decay rate is `rate × min(sampleSize, N)` | **yes** — nothing about induction makes a read path mutate the heap | **A4** |
| 1.2 | every memory read is a full scan | **yes** — and the split *removes* one caller (`processor.ts:393`) | **A5**, structures → **TODO30 §4** |
| 1.3 | the scorer is decorative | **yes** — no caller ever passed the inputs | **A4** (the decision) |
| 1.4 | eviction measures the wrong resource | **yes** — independent of reasoning architecture | **A8** |
| 1.5 | `getGoals()` mints a stamp per call | **yes** — a getter that fabricates identity | **A4** |
| 1.6 | `priority` has no owner | **partly** — the meta / self-optimiser writers leave with the split; input-path, replay and deserialisation writers do not | **A4** |
| 1.7 | the growth arithmetic | **yes** — every structure named is on a path the split leaves running | **TODO30 §4, §7** |
| 1.8 | frozen `stepScalars`; inert tie-break | **no — resolved by the split** | **A1** (delete), **A6** (the tie-break decision) |
| 1.9 | the seam exists and is unused | **yes** — and it is the whole of A1 | **A1** |
| 5 (v1.3) | the prediction table | **no — retake** | **TODO30 §1** |
| 1.9 (v1.3) | the profile shares | **no — retake** | **TODO30 §1** |

Of the eight findings in §1.1–§1.8, **seven stand regardless of the split** and the eighth is
*resolved* by it rather than needing a fix. The profile and the prediction table do not survive
and live in TODO30, which is the formal handoff: TODO30 §1 requires a fresh profile before it
orders anything, because a profile of the fused system is a ranking of the wrong thing.

---

## 2. Architectural precedent: what NARchy does instead

Reference: `github.com/narchy/narchy`, module `narchy/nar`, pinned at **`f3a9bcc`**
(2026-08-25). §11.3 records what was read and what was inferred. The load-bearing observation
is not any single data structure — it is **where the responsibility sits**. Nothing in this
section is a performance target; the comparative numbers live in TODO30 §1.

### 2.1 `Memory` is a port

`nars/memory/Memory.java` is 123 lines and its whole abstract surface is `get`, `set`, `clear`,
`size`, `summary`, `remove`. No decay, no scoring, no sampling, no eviction, no archive, no
focus, no links — those live in `concept/` (beliefs), `focus/` (attention), `control/`, and
`deriver/` (inference). Eight implementations ship. SeNARS's `Memory` is one class, 646 lines,
and it is the only one. **This is A5, and it is dependency inversion, not a rewrite:** reasoning
code should depend on the concept of storage, not on one concrete all-purpose implementation.

### 2.2 Attention is owned, not a field

`nars/focus/util/PriTree.java` ("hierarchical priority distribution graph") with a `commit()`
that walks nodes once per system duration; `PriNode`/`PriSource`/`PriAmp` give a node its
priority and its sources; `TaskAttention` and `TaskBagAttentionSampler` replace "sample 100
concepts and re-rank". The structural consequence is the part that matters here: **priority has
exactly one owner**, and nineteen writers become a handful of typed operations.

### 2.3 Focus commits on a clock derived from system duration

`nars/Focus.java:239-262` — `commit(now)` fires when `now >= commitNext`, and
`commitTime` sets the next commit one `commitDurs × durSys` interval out. Attention advances on
a timer, not once per read and not once per sampled concept; `nars/focus/time/` carries 15
pluggable timings so *when* is a policy. **This is the direct answer to §1.1:** one owner, one
cadence, and the cadence is not a retrieval-breadth knob.

### 2.4 Beliefs are retained by policy, and the container is a port

`BagForget` + `AbstractBagSustain` implement retention as recency × frequency; `nars/table/`
has `BeliefTables` with `eternal/`, `temporal/`, `question/` and eight `dynamic/`
implementations. The eternal-vs-temporal distinction SeNARS papers over with one `Bag<TaskData>`
and three capacity constants is a *table type* in NARchy. This is A8's precedent: a declared
retention policy, behind a port.

### 2.5 Inference is compiled, and control execution is pluggable

`nars/deriver/reaction/` holds `NativeReaction`, `PatternReaction`, `TaskReaction`,
`MutableReaction` and `ReactionModel`, with `compile/TrieReactionCompiler`,
`DAGReactionCompiler`, `DecisionTreeReactionCompiler`, `ANDCompiler` and
`JaninoPredicateCompiler`; `deriver/util/memoize/` memoises the predicates they call.
`nars/control/exec/` (`UniExec`, `WorkQueueExec`, `ThreadedExec`, `WorkerExec`, `FiberExec`)
makes *how* the cycle executes a choice behind an interface.

**Only the shape is inherited by this plan.** That the rule set is turned into a structure keyed
by what it matches is architectural — it is why `InferenceTable` is a port in A6. *Which*
compiler, and whether a generated dispatch beats a table at this workload, is TODO30 §6, and
§11.3 flags that the compiler claim here is **inferred from filenames, not read**.

### 2.6 The contrast

Architecture columns only. The speed comparison is deliberately absent; TODO30 §1 owns it, and
a plan that quotes it here will be quoted after the architecture changes.

| | SeNARS today | NARchy |
|---|---|---|
| concept store | one 646-line class doing 9 jobs | a port, 6 abstract methods, 8 implementations |
| priority | a field with 10 external writers, re-ranked on read | one owner, committed on a clock |
| top-k | rank the population on every read | read a maintained order |
| decay | swept inside `sample()`, 8× per cycle | committed on a duration-derived timer |
| beliefs | 3 fixed capacity constants × concepts | policy-based bags, 8 table types |
| rule dispatch | 4-bucket union + full sort per application | compiled reactions, keyed by match shape |
| what a cycle selects from | the whole population | a declared working set |
| eviction trigger | concept count | per-container, by policy |

The last column is a *responsibility* column. Reading it as a speed table is how the previous
pass mistook a profile for an architecture.

---

## 3. The target

### 3.1 The architecture contract

v1.3's §3.1 was a table of target complexities. It is gone from this document and its content
lives in TODO30 §2, where `k` is defined rather than asserted. What replaces it is the property
that makes the cost model *implementable*:

> **Every cycle-path responsibility has exactly one owner and an interface through which its
> implementation can be replaced. No cycle-path component may require an induction provider,
> hidden global state, or an implicit traversal of the whole population.**

Three clauses, each falsifiable, none of which needs a stopwatch:

- **one owner** — a mutation of `Concept.priority` or of the decay clock is reachable from one
  owner only, and the write surface is enumerable (§7 invariant 4).
- **replaceable** — each cycle-path responsibility is reached through a port, and the port's
  contract does not mention the concrete type (§4/A5, A6).
- **no implicit population traversal** — a read that must consider the whole population is a
  *declared* decision with a named owner and a budget, not a side effect of a getter
  (§4/A4, A8).

This is a weaker sentence than v1.3's and a more useful one: it holds for a tree that is
currently O(N) everywhere, and it is the thing TODO30 needs in place before it can measure.

### 3.2 The ports

Five, in dependency order. Each replaces part of the god-object rather than adding a layer.
None of these is an index, and choosing implementations is TODO30's.

```
ConceptStore     get(term, create) · set · remove · size · summary · clear
Attention        touch(term, event) · topK(n) · commit(now) · forget(term)
BeliefTable      per-concept: insert · peek · size · retention policy
InferenceTable   lookup(antecedentKind, consequentKind) · dispatch(...)
CycleExecutor    one cycle, under a budget, with a pluggable concurrency strategy
```

`ConceptStore` and `Attention` are the two that matter; the other three are consequences of
their existing. The change of shape from v1.3 is deliberate in one place: `Attention` is an
*interface with a mutation surface* (`touch(event)`, `commit(now)`), not an index with an
update method, because "one owner" is the property and "index" is an implementation.

### 3.3 The cycle

The shape, with no cost claims attached:

```
input ──▶ attention.touch(term, event)          replaces the O(N) relevance scan
      ──▶ admission                            through the store's neighbour port
      ──▶ attention.commit(now)                 the only decay in the system, on a clock
      ──▶ workingSet = attention.topK(n)       replaces sample() + the decorative scorer
      ──▶ for each premise pair:
             inference.dispatch(...)
      ──▶ budgeted admit of conclusions
      ──▶ drive / meta / self — on a budget, opt-in
```

One owner per quantity, one cadence per clock, one write path per fact, one seam for induction.

### 3.4 The spine: the online reasoner and the seam it runs through

The cycle above has no induction in it, and that is what makes every row of §3.1 checkable.
§1.9 is the good news: the offline side already exists, bounded and gated. This section is the
contract the two halves must satisfy.

```
                       ┌──────────────────────────────────────────┐
   input ──▶ gate ──▶  │  ONLINE REASONER — closed, bounded, sync  │
                       │  deterministic · no provider · no I/O     │
                       │  no wall clock on the reasoning path      │
                       └───────────────┬──────────────────────────┘
                                       │ commits only
                                       ▼
                            ┌─────────────────────┐
                            │  THE SEAM           │  versioned · validated
                            │  reaction table     │  gated · revertable
                            │  proposals          │  replayable
                            └──────────┬──────────┘
                                       │ proposes
                                       ▼
                       ┌──────────────────────────────────────────┐
   un-committed ──────▶│  OFFLINE INDUCER — out of band          │
   derivations          │  bounded queue · its own budget · no    │
                        │  cycle participation · every output a   │
                        │  proposal · provisional until applied   │
                        └──────────────────────────────────────────┘
```

Three properties fall out of drawing it this way, and each is a test:

1. **The online reasoner completes even if the inducer never answers.** One line, no profiler,
   no cost model, no review: wire a backend that never resolves, run a cycle, assert it
   finishes. **This is the single most valuable test in the plan** and it is the test that
   would have caught §1.8 on day one.
2. **The seam is the only channel.** The reasoner reads committed artifacts and nothing else.
   This is what makes an inducer's output reviewable like a schema migration rather than
   deployable only as code — and it is the axis on which SeNARS is meant to be better than
   NARchy, whose rule set *is* code.
3. **The split buys the improvement NARchy cannot have, not just the discipline.** NARchy
   assumes a fixed rule set forever; NAL is small and hand-written and cannot acquire a new
   inference form. Here the rule set is the primary learnable artifact — grown, gated,
   versioned. That is the thesis (§0), and everything else in this document is the cost of
   being able to state it.

What the seam does **not** do: it does not let the reasoner read the inducer's intermediate
state, and it does not let a proposal land mid-cycle. A proposal applies at a declared
boundary or not at all. §4.1 is where that boundary is decided rather than discovered.

**The seam runs through the kernel gates, not around them.** This is a README-level invariant
that the split must not erode: `PerceptionGate` admits, `BudgetGate` accounts, `RewardGate`
holds the epistemic firewall, `ActionGate` authorises, and *"four gates mediate every state
mutation; every subsystem operates through them; none can bypass them."* `StreamReasoner` already
asks `BudgetGate` for an `lm-call` budget (`reasoner.ts:80`). A2's requirement is therefore
strictly stronger than "a provider proposes": **a proposal is a request to a gate, and the gate
is the only thing that may write state.** In particular a proposal may propose a rule, an
abstraction, or an attention weight; it may never propose a truth value to be written without
`PerceptionGate`'s source-quality ceiling, and it may never reach `Truth.frequency` or
`Truth.confidence` through a reward path. The existing `provisionalConfidence` 0.3 is the
correct instinct and it must survive the payload change.

### 3.5 The induction layer is a component, not a dependency

Optionality has to mean something operational, and the first property is the one usually got
wrong.

**1. Absent, not disabled.** `lm.enabled: false` and `enableLMRules: false` are not optionality.
`nar.ts:837` defines a private `initializeLMRules` that is called unconditionally at `:762` and
`:823`, and every rule is registered through `facade/index.ts:98`, so the 25 files across
`tests/` and `src/` that set those flags run a fully constructed, fully registered layer with
only *execution* gated. A component that is present, wired and registered is not optional,
however false its switch is. The test that tells the difference is trivial and does not exist:

```ts
const nar = buildNAR(/* zero proposal producers registered */);
await nar.run(100);
expect(derivations).toBeGreaterThan(0);   // the core reasons with no inducer at all
```

**2. The core has no compile-time dependency on the induction layer.** Violated **39** times
(§0 correction table). The deepest is not a convenience import:

```
nar/src/strategies/types.ts:1    import type { LMRule } from '../lm/rule/LMRule.js';
nar/src/strategies/types.ts:71   interface LMRuleSelector { … select(rules: LMRule[], …): LMRule[] }
```

The core's *strategy extension contract* is typed in terms of the induction layer's rule type,
and `LMRuleSelector` is one of the five strategy types (`:22`). A strategy therefore cannot be
written without naming the layer, which is the boundary being absent rather than porous. A2
inverts it: the core declares a `Proposal` / `ProposalSource` contract of its own and the layer
becomes a producer that implements it.

**3. Adding a producer is purely additive.** It may submit proposals; it may not change the
core's control flow, and the core may not read its intermediate state.

```
        ┌───────────── nar (core) ─────────────┐
        │  terms · truth · stamps · memory     │  ◄── nothing here imports the
        │  cycle · reactions · attention        │      induction layer. Ever.
        │  Proposal / ProposalSource             │  ◄── the seam, declared by the
        └───────────────┬──────────────────────┘      core, in core vocabulary
                        │ implements (optional)
        ┌───────────────▼──────────────────┐
        │  induction provider               │   may be: none · recorded fixture ·
        │  (model, rule-miner, hand-written)│   live model · a plain table
        └──────────────┬────────────────────┘
                       │ assembled only in the composition root (src/),
                       │ and it sees the core's public API only
```

A seam that is only a diagram is a function call; a boundary that is only an import rule is a
convention. §1.9 is the encouraging part: in this repository both already exist as code, and
the job is to make the committed one the only one.

### 3.6 Why this requirement is the right one

It is easy to read optionality as a concession — the core is "just" a reasoner and the
interesting part is bolted on. It is the reverse.

- **The core becomes falsifiable.** A NAR-shaped core can be held to NAR's own standards —
  NAL parity, determinism, a replay — and the induction layer earns its place by beating them.
  If the two are inseparable, neither claim can be tested.
- **Optionality is a deployment requirement.** Latency budgets, air-gapped deployments,
  regulated environments, and the deterministic test tier all need a core that runs with no
  model. A core that requires one is unusable in all four.
- **It forces the interface that is the actual innovation.** If the rule set is a *versioned
  artifact the core loads* and producers of that artifact are pluggable, the improvement over
  NAR is precise: **NARS assumes a fixed rule set forever; this treats the rule set as the
  primary learnable artifact.** That capability belongs to the *core*, and it survives the
  layer's absence.
- **It makes the hermetic tier free.** The question "how does a background model survive
  `test:hermetic`" answers itself: the hermetic run is the no-provider run plus a recorded
  proposal stream replayed through the same seam. No gate is weakened and no test is skipped —
  which removes the failure mode that produced §1.8, gates quietly deferred until bypassed.

---

## 4. The work

Ten items. **A0 first and separately** — it is the harness that decides whether the rest
worked. **A1 second, alone** — §1.9 makes it a wiring change, and a one-line test makes it the
cheapest behaviour change available. **A2 immediately after**, because the seam and the
dependency direction are one change and only the first half is testable on its own.

### 4.0 Which finding justifies which item

A workstream picked up cold should be able to see what it is for. This is the trace; an empty
row means the item is either unstarted or unjustified, and both are worth noticing.

| item | v1.3 | findings it closes | deletes (§8) | gate it enables |
|---|---|---|---|---|
| A0 | W0 (reduced) | — makes the rest observable | — | — |
| A1 | W1 | **§1.9**, §1.8's frozen scalars, and the cause of §1.1's cost | `processLMRulesImpl` from the cycle path; `stepScalars`; the shadowed `resetMetaBudget` | `core:no-provider`; the `processLMRules` column → 0 |
| A2 | W1b | §3.5's properties 1–3 | `enableLMRules`; `lm` from the core config schema | `core:no-lm`; the `deps:gate` row |
| A3 | W1's tail | the seam's undecided semantics | — | the proposal replay fixture |
| A4 | W2 + W3's interface | **§1.1**, **§1.3**, **§1.5**, **§1.6** | `Stamp.createInput()` from getters; the writable `priority` field | `decayAll` call sites == 1; the write-surface test |
| A5 | W4 | enables A4 and A6 to be tested without a NAR | — | — |
| A6 | W6's port | §1.8's inert tie-break, made a decision | the `*:*` bucket's semantics, once recorded | rule applications per cycle bounded |
| A7 | W7's semantics | §1.2's per-cycle-caller half | the per-cycle `getGoals` / `getStatistics` calls | budget enforcement tests |
| A8 | W8's contracts | **§1.4** | the `totalTasks === 0` candidate filter | memory-pressure monotonicity |
| A9 | new | makes A3's decisions testable | — | `core:no-lm` hermetic replay |

**§1.1, §1.4, §1.5, §1.6 and §1.7 are each closed by exactly one item or by TODO30.** If one
is deferred, nothing else covers it.

### A0 — Reduce the instrumentation baseline

Keep only what is needed to verify architectural changes:

- cycle and phase counters;
- proposal producer count, and proposal application count;
- derivation count;
- deterministic replay identifiers;
- **LM-in-cycle detection** — a counter incremented by any induction call reached from the
  synchronous path, which is the mechanism that makes §3.4's first property mechanical.

`scripts/cycle-bench.ts` stays, with its `--selftest`, because TODO30 consumes the same
instrument rather than building a second harness. **What moves to TODO30 §3:** the
population-scaling matrix, the `cost:cycle` gate, and the `bench:cycle` entry in
`scripts/lib/gates.ts`.

**Acceptance**

- the instrument has a self-test that refuses to print a number it cannot show it measured;
- a test can prove whether a provider ran *during* the synchronous cycle (not merely whether it
  was configured);
- `test:determinism` and `test:hermetic` stay green, and a rerun of the same command produces
  the same counts.

**Risk: none.** Pure instrumentation.

### A1 — Close the cycle: make the committed seam the only seam

*§1.9: the bounded, gated, asynchronous channel exists and is unused. This item wires it in and
deletes the other route.*

Nothing in `cpuThrottleMs` / `maxRulesPerCycle` / `callTimeoutMs` / `Promise.all` in the
induction path is a design decision — it is the cost of a model living inside a cycle that is
supposed to close in microseconds. `inferenceController.step(5000, …)`
(`nar-execution.ts:234`) is a five-second deadline on such a step, and that is the tell.

1. `strategies/derivation/DefaultDerivation.ts:26,30` stops calling `processor.processLMRules`.
   The synchronous path is `applySyncRules` (`rules/impls/processor.ts:246`) and nothing else.
2. The production path constructs a `StreamReasoner` (or its A2 generalisation) at the cycle
   boundary and reaches a provider only through `flush` / `reasonHook`.
3. `stepScalars` and the shadowed `resetMetaBudget` are **deleted, not fixed** — with the layer
   out of the cycle the memo has no reason to exist, and the shadowed name at
   `nar-execution.ts:76`/`:116`/`:179`/`:368` becomes deletable rather than resolvable.
4. `cpuThrottleMs` and `callTimeoutMs` lose their reason to exist. Either they go, or they
   become properties of the *offline* pass. Do not leave them bounding a cycle that no longer
   contains the thing they were written for.
5. Overflow policy moves from drop-oldest to the decided policy (A3), in `StreamReasoner`, with
   a test that fills the queue and asserts what survives.

**Acceptance, in order of cheapness**

1. **A test that injects a provider that never resolves, calls `run()`, and asserts the cycle
   finishes.** One line. Written failing-first (§10.1).
2. The in-cycle provider counter from A0 reads 0 across a fixed episode.
3. A cycle's outcome is identical with and without a producer registered, and identical when
   the producer returns nothing.
4. A proposal that arrives is applied at a declared boundary or not at all — never mid-cycle.
5. A NAR with **zero** proposal producers registered still reasons (§3.5 property 1).
6. NAL parity, `test:determinism` and `test:hermetic` green.

**Risk: medium, and the only item that changes reasoning behaviour** — not the derivations, but
the *timing* of when rules exist, which changes the derivation *sequence* over a fixed episode.
v1.3's W1 was called "the only workstream that changes reasoning behaviour"; A1 inherits that
exactly. **Do not fold A1 into A4.** Two behaviour changes in one commit make the first one
unreviewable, and A1's whole value is that one line of test verifies it independently.

### A2 — Move the induction layer beyond the core

*Deliberately not a separate letter from A1's third step: the seam and the layer boundary are
one change, and you cannot have a core-owned seam interface while the core still imports the
layer's rule type.*

- The core declares the proposal contract in core vocabulary. A proposal is **data**: a
  proposed reaction, a proposed abstraction, a proposed attention weight. Never a closure over
  NAR internals — a closure would re-create the coupling the type boundary just removed.
- `nar/src/stream/reasoner.ts` is generalised in place rather than duplicated: `LMRequest` /
  `ProvisionalBelief` are already a request/response pair with a provisional-truth discipline,
  which is the shape a `Proposal` needs. The seam gets a schema version and a base revision; it
  does not get a second class.
- `nar/src/strategies/types.ts` stops importing `LMRule`. The five strategy types are
  re-expressed so a proposal producer is not typed in the layer's vocabulary — the cleaner
  answer is that selection is a *proposal-time* concern and `LMRuleSelector` is not a
  reasoning-cycle strategy type at all (§1 shows what happens when it is).
- `nar.ts`'s unconditional `initializeLMRules` / `LMRules` / `NARLM` / `wireSystemOne`
  (`:18, :34, :48, :55, :268` and the private at `:837`) become assembly in the composition root
  (`src/`), which already exists for that purpose.
- The 39 imports are inverted or removed because the thing they reached for moved down.
- `lm` leaves the core config schema, on the precedent of `bagSize` and `interactionGuide` in
  the previous pass — an optional component must not shape a required one. It becomes plugin
  configuration, validated where the plugin is assembled.
- **`enableLMRules` disappears from the public surface.** It is documented in `README.md`'s
  `NARConfig` block, so this item also updates the README and regenerates `docs/api/nar.md`;
  `docs:drift` is a gate and a stale doc is a red gate, not a footnote.

**Acceptance**

1. `deps:gate` gains a row: `nar` core may not import `nar/src/lm/`. One line in a ledger, and
   it is the only enforcement a well-meaning import cannot cross.
2. A no-provider NAR reasons, green with the layer's directory removed from the build graph.
3. NAL parity green with no producer registered.
4. `enableLMRules` is gone — replaced by absence, because a flag on an always-constructed
   component is a comment (§10.1).
5. No provider implementation can reach private core state, and no layer-typed value appears in
   a core extension contract.
6. `README.md`, `docs/api/nar.md` and the export index no longer advertise `enableLMRules` or a
   `lm` config block; `pnpm docs:drift` is green.

**Risk: medium-high — a large mechanical diff (39 files).** That is the price of a boundary
that cannot be crossed by accident, and the mitigation is that it is mechanical: a dependency
inversion with no semantic content, reviewable by the compiler rather than by reading.

**Open, and worth deciding before starting (§12 Q8):** whether the induction layer becomes a
seventh workspace package. It is the only enforcement a well-meaning import cannot bypass, and
it requires everything the layer reads — concepts, memory statistics, derivation chains — to be
public API. The sequencing is the same either way: the seam first, the boundary second, the
package question last, because the interface is not known until the seam is.

### A3 — Specify the proposal lifecycle

*This is the one area this pass expands rather than contracts, because it is the boundary the
whole plan exists to make real, and prose is not a protocol.*

Decide, before the queue grows any further:

- unit of work (one derivation, one consolidation window, one episode);
- trigger semantics — a trigger, not a rate, expressed as **cycles per proposal**;
- the maximum number of pending proposals and the **overflow policy**;
- the stale-proposal policy;
- behaviour when referenced concepts no longer exist;
- schema and version compatibility;
- cancellation semantics;
- replay semantics.

Two of these are already partly answered by the committed implementation, which is the best
possible starting position and should be read before the rest is argued about:

| question | what the code does today | what must be decided |
|---|---|---|
| overflow | drop-oldest, twice (`pushCapped`, `trimCapped`) | drop-oldest discards the context the inducer needed; pick drop-newest, or drop-lowest-priority with a carried confidence, and say which |
| backpressure | defer above `highPressure`; refuse when `BudgetGate` denies `lm-call`, re-queueing the batch at the head and trimming the tail | what happens to a *denied* batch — retry, drop, or convert to a recorded rejection event; and does a denial emit a `TerminationReason`? |
| provisionality | `provisionalConfidence` 0.3, revised by `Truth.revision` on settle | whether a proposal is a *truth claim* at all (it should be a claim about a rule, not about the world) |
| staleness | none — `ProvisionalBelief` carries no revision | the rule in the box below |

**The recommended initial rule, and the one to write into the schema:**

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

Do not allow "apply whenever it arrives"; that reopens the cycle.

**Acceptance**

- each of the eight decisions above is written in the schema document, not in a comment;
- a recorded proposal stream replays deterministically against a recorded core state, through
  the same seam (A9);
- a test fills the queue past capacity and asserts the chosen overflow policy, including what
  happens to a denied batch;
- a test applies a proposal whose `baseRevision` is stale and asserts rejection rather than
  silent application;
- a test applies a proposal referencing an evicted concept and asserts rejection.

### A4 — Establish state ownership, and make reads observational

*The one deliberate behaviour change in this plan.* Everything else is a data structure or a
wiring change.

For attention:

```ts
interface Attention {
  touch(term: Term, reason: AttentionEvent): void
  topK(limit: number): readonly Term[]
  commit(now: number): void
}
```

For the clock:

```ts
interface DecayClock { tick(now: number): void }
```

The important part is not the interface; it is that callers stop writing `Concept.priority` and
stop invoking decay as a side effect of reading.

- `decayAll` leaves `sample()` and `sampleWindow()` (`memory.ts:355, 371`). Both become pure
  reads. `consolidate` (`:389`) is the only clock tick left, called from one place.
- `activationDecayRate` means what the configuration says. §11.2's table collapses to one row.
- `getGoals()` stops minting stamps: minted at write, stored, read on get. `Stamp.overlaps` and
  the `noStampOverlap` filter become well-defined for goals, which they are not today.
- The eleven external `priority` writers become a small set of named operations. The suggested
  set is the one §1.6's audit implies: input touch, related touch, decay, reinforce, replay,
  deserialise, self-tune. Each has one caller and one reason type.
- **Decide the scorer's fate** (§1.3): either wire novelty and relevance to real signals —
  relatedness from the link port, recency from `lastAccessedAt` — and keep four factors, or
  delete two and select by attention order. The current answer is neither, and this is a
  *design* decision to be recorded with its reason, not an optimisation. It belongs here
  because it decides what `topK` means, and `topK` is the contract TODO30 will measure.
- `SpreadingActivation` and `Concept.updateLinks` either get a populated link graph or are
  deleted. §1.6 showed `linkedConcepts` is written only by `mergeWith`, so today they are no-ops
  wearing a cost, and `inference-controller.ts:104-110` applies their boost regardless.

**Acceptance**

- every `Concept.priority` write outside `concept.ts` is reachable from exactly one named
  operation, and a test enumerates the write surface so a new one fails;
- `decayAll` has exactly one call site, and `maxSampledConcepts` appears in no decay
  measurement;
- reading a concept twice without an intervening write returns the same identity and the same
  stamp;
- the attention and clock implementations are replaceable without changing any caller;
- the RL/parity baselines are re-established **here, once**, and committed in the same change.

**Risk: high, and confined to this item.** Every learned value moves, which is why it is alone
and why the baselines are regenerated here rather than left to drift through A5–A8. Everything
after it must hold them stable.

### A5 — Make `Memory` a set of ports

Split the 646 lines along the responsibilities §1.2 already enumerates: storage →
`ConceptStore`, per-concept beliefs → `BeliefTable`, links → a link port, goals → a goal
enumeration port, statistics → a statistics view. **Start with the simplest correct
implementation plus a test double.** Do not build sophisticated backends here — that is TODO30
§4 and §7, and it is only possible once the ports exist.

The purpose is dependency inversion:

> reasoning code depends on the concept of storage, not on one concrete all-purpose
> implementation.

`MemoryView` (`memory/view.ts`, 34 lines) is already the seam the strategies use; this widens
it rather than inventing a parallel one.

**Acceptance**

- cycle code depends on ports, not on `Memory`;
- storage details do not leak into reasoning code;
- each port has focused unit tests that construct it directly;
- existing semantic tests still cover the current behaviour through the ports;
- the port contracts mention no concrete type, so an implementation can be swapped without
  touching a caller.

**Risk: low.** Mechanical, and the boundary is already implied by `MemoryView`.

### A6 — Define inference dispatch as an architectural port

```text
InferenceTable
  lookup(antecedentKind, consequentKind)
  dispatch(...)
```

Three decisions, and none of them is "make it faster":

- the rule representation and the dispatch implementation become separate, so a replacement
  costs one file;
- the `*:*` catch-all bucket's fate is a **recorded semantic decision** — either it is part of
  the contract and tested, or it is deleted. Today it is neither;
- the `RuleIndex` tie-break (§1.8) is either exercised by a test — `recordRuleHit` is called
  and the field has data — or deleted. It is currently a comparator that orders nothing, wearing
  a comment that explains why it orders nothing.

**Do not** require tries, DAGs, decision trees, or generated code here. TODO30 §6 chooses among
them from a measured workload.

**Acceptance**

- inference code depends on the dispatch interface;
- the catch-all and the tie-break are each either specified-and-tested or gone;
- NAL parity green;
- existing rule-ordering behaviour is either explicitly preserved or explicitly recorded as a
  semantic change, with the NAL suites as the gate.

**Risk: medium.** This touches inference semantics, so parity is the gate and must not move.

### A7 — Define control budgets as semantics

Retain explicit bounds for work that is conceptually bounded:

- derivations per step;
- secondary premise consideration;
- proposal application;
- control/meta work.

`NARExecution.run` (`nar-execution.ts:184-379`) runs a fixed sequence of control and meta steps
per cycle, including two population-sized `getGoals()` calls (`:417` in
`emitCognitiveStateSummary`, `:455` in `injectMetaGoals`) and an O(N)-plus-two-sorts
`getStatistics()` (`:424`). **The bound is architectural — "a step may not be unbounded merely
because no cost model has been written yet" — and how cheaply the budget is executed is
TODO30's.** The point of naming them now is that A4's read-purity work and A6's dispatch work
both need a place to *stop*.

**Acceptance**

- every budget has a named owner, a default, a configuration source, a defined overflow
  behaviour, and a test demonstrating enforcement;
- the shadowed `resetMetaBudget` name is gone from one of the two places it exists;
- the per-cycle `getGoals` / `getStatistics` callers are budgeted or removed, and the decision
  is recorded.

**Risk: low-medium.** The behaviour change is "steps stop running by default", which is visible
to whatever depended on the free behaviour.

### A8 — Define memory and resource contracts

The architectural requirement is narrow and testable:

> **Every unbounded resource has an explicit owner and a declared lifecycle policy** — what it
> holds, who owns it, its capacity, its retention rule, its overflow behaviour, and the signal
> it raises when capacity cannot be reclaimed.

For each resource, a reviewable record:

```text
resource · owner · capacity · retention policy · overflow behaviour · pressure signal
```

Specifically for memory:

- `capacityPressure()` accounts for the dominant consumer, not only `concepts.size`.
  `totals()` already reports `totalTasks`; eviction does not read it (§1.4).
- the candidate filter stops being anti-correlated with pressure: a concept must be able to age
  out *while holding tasks*, ranked by age × value.
- eviction must be able to **report that it could not free anything** rather than returning a
  silent `{ archived: 0, forgotten: 0 }`.
- the accumulator ledger grows from its 2 declared sites to every production container that can
  grow, and the textual `LruCache`/`maxSize` check is replaced by gating the *declaration* (see
  §10). Do **not** redesign the eviction data structures here; that is TODO30 §7.

**Acceptance**

- a reviewable inventory exists for every production accumulator that can grow without an
  explicit bound;
- memory pressure is monotonically related to every bounded resource it reports;
- a memory at 99% with nothing evictable says so, and a test asserts it says so;
- the ledger covers every site the accumulator gate declares as cycle-path.

**Risk: medium.** Retention policy is behaviour; changing policy and structure together is how
a semantic change hides inside a refactor, so the policy lands here and the structure lands in
TODO30 §7.

### A9 — Deterministic replay

Make recorded proposals first-class fixtures. A hermetic run must be able to use

```text
core state
+ recorded proposal stream
+ configuration
+ deterministic inputs
```

with no live provider involved, which is the same shape as the event log the kernel already
replays (`kernel/replay.ts`, `replayCognitiveState`). A proposal stream is an event stream
writ by an untrusted producer, and it should be stored as one.

Schema/version mismatches must fail explicitly rather than silently replaying against
incompatible state — and the proposal schema is the *first* thing in this repository that a
recorded fixture from a future commit would silently mis-apply.

**Acceptance**

- a live provider is unnecessary for the hermetic tier;
- a recorded proposal stream replays identically, twice;
- an incompatible proposal version fails loudly, with a test that asserts the failure;
- a proposal stream recorded against revision *R* is rejected against *R+1*.

---

## 4.1 The questions A1–A3 will be decided by

The split is easy to half-do. These are the decisions a half-done split defers, listed so they
get answered deliberately rather than by whoever next opens the queue. Each is a real fork;
none has an obvious default.

**What is the unit of asynchronous work?** A proposal over one derivation, one consolidation
window, or one episode. Too small and the model is prompted into trivia; too large and its
latency becomes the wall. This is the question most worth answering before the schema is
written.

**What triggers the inducer?** Not a rate — a *trigger*. Three candidates, not mutually
exclusive: a budget of un-committed derivations has accumulated; a consolidation interval
elapsed; a salience signal fired. Whichever it is, express the balance as **cycles per
proposal**, which makes it measurable and gateable. "Run every N seconds" is not a contract;
"one proposal per 10 000 cycles of un-committed derivations, dropping X when full" is.

**What is the overflow policy?** §1.9: the code already drops the oldest, twice, and §0 argues
that is wrong. Drop-newest is simplest and probably right initially. Drop-lowest-priority needs
a priority the payload must then carry. **This cannot be left implicit**: a queue with no
declared policy is an unbounded queue with extra steps.

**What happens to a proposal whose budget was denied?** `StreamReasoner` re-queues at the head
and trims. Is that a retry, a drop, or a recorded rejection? The `BudgetGate` already has a
`backpressure` `TerminationReason` in its vocabulary; whether a denied proposal produces one is
a decision, and it is the difference between "the queue is full" being visible and being
inferred.

**What happens to a proposal that arrives referencing evicted concepts?** The memory evicts
(A8), the producer's input is a past state, the seam validates. Whether validation *rejects* or
*salvages* what still resolves is a choice. Rejecting is simpler and more honest. Say so
before the first eviction bug.

**What happens when the reasoner has moved on?** If applicability is "at the next declared
boundary", staleness is bounded and irrelevant. If it is "whenever", coupling is reintroduced.
**This decision determines whether the cycle is actually closed**, and it belongs in the
schema, not in a comment.

**How does the hermetic run survive this?** — **retired, decided rather than deferred.** If the
layer is optional, the hermetic run *is* the no-provider run, and the with-provider path is
covered by recorded proposals replayed through the same seam. Neither gate is weakened and
neither is skipped. A9 is where that lands.

**What is the proposal format's version story?** A run recorded against schema v3 must not
replay against v4. Small, boring, genuinely hard, and it belongs to whoever writes the schema.

**Is the layer a dependency or a component?** A dependency means no deterministic core, no
hermetic tier, and no way to run the suite reliably. A component means the answer to the
hermetic question above is "replay a fixture". **This is upstream of the others** and is §3.5.

---

## 5. What this architecture makes possible

This replaces v1.3's prediction table. v1.3 §5 predicted `0` read-path decay passes, `O(k)`
selection and flat rollout scaling — performance hypotheses, and therefore TODO30's. What
belongs here is what the seams buy regardless of how fast anything is:

- **Decoupling.** The core can be built, run, tested, deployed and audited without the
  induction layer. `device`-profile deployments, latency budgets and the deterministic tier all
  become deployable configurations rather than workarounds.
- **Determinism and replay.** One synchronous path, one clock per quantity, one write path per
  fact, and proposals as recorded events. `test:hermetic` becomes a property of the design
  rather than a special case.
- **Replaceability.** Storage, attention, dispatch and cycle execution are ports. Each can be
  re-implemented — including by TODO30 — without a caller changing, and each can be tested in
  isolation in milliseconds instead of through a NAR.
- **Test isolation.** A cycle-path test constructs its store, its attention and its dispatch
  table directly. That is the difference between a 6-second test and a 90-second one
  (`tests/nar` carries both).
- **Optional producers.** A recorded fixture, a hand-written rule table, a rule-miner and a
  live model are the same interface, so a new producer is additive rather than architectural.
- **Gates that can fail.** Every architectural intent in §10.1 currently lives in a comment or
  nowhere. This plan converts the load-bearing ones into tests, and it does so *before* the
  code that would satisfy them exists.

**The one prediction worth keeping here is a count, not a duration:** proposal invocations
inside a cycle go from **33** (measured, §11.1) to **0**, and stay there. That row says the
Stream Reasoner exists. It is exact, cheap to measure, and it is a property of the wiring
rather than of any data structure.

---

## 6. Sequencing

```
A0 ──▶ A1 ──▶ A2 ──▶ A3 ──┬─▶ A4 ──┬─▶ A6
                        │         └─▶ A5
                        └─▶ A9
A7, A8 depend on A0; A5 may land any time after A0.
```

- **A0** alone, first. Everything else is judged against it.
- **A1** alone, second, and alone for the same reason as A4: a behaviour change that must be
  independently reviewable. Its acceptance is two short tests — a hanging provider, and a NAR
  with no producers at all.
- **A2** immediately after A1, and A3 immediately after A2: the boundary is cheapest while the
  seam is fresh, and A3's decisions are cheaper once the queue's real behaviour (§1.9) is known
  rather than assumed.
- **A4** alone, with the RL/parity baselines re-established and committed in the same change.
- **A5** can land any time after A0; it is mechanical and it is what makes A4 and A6 testable in
  milliseconds rather than through a NAR.
- **A7 and A8** are independent of the above and can be interleaved.
- **A9** lands once A3 has decisions worth replaying.

Land A5 before A4 if test wall time is the binding constraint; land A4 before A5 if
correctness is. Either order works, which is the point of A5.

**A formal handoff to TODO30** follows A2 + A3: at that point the architecture is what the rest
of the plan is measured through, and TODO30 §1 requires a fresh profile before it orders
anything. TODO29 does not carry a performance ordering forward, because its own §1.10 says the
old ordering was derived from a profile of the wrong system.

---

## 7. Invariants that must not move

1. **NAL parity.** The suites are `tests/nar/nal1-rules`, `nal2-copula`, `nal7-temporal`,
   `nal8-procedural` and `nal9-self` (there is no `nal3`–`nal6` file; see §14.3). Nothing here
   changes what is derived from what. A6 touches dispatch and is gated on those suites, not on
   a rewrite of them.
2. **Determinism.** `test:determinism` and `test:hermetic` green at every commit.
3. **`test:load-sensitive` green under full load.** The timing discipline gets better, not
   worse: this plan *adds* no timing assertions, which is deliberate.
4. **Every unbounded resource has an owner and a lifecycle policy** (A8). This replaces v1.3's
   "the complexity budget ratchets downward and every change must lower `productionLOC`", which
   describes a gate that does not exist — `complexity:budget` is `mustNotIncrease` with
   ceilings, and the obligation to move a baseline is a commit-time one. **Forcing production
   LOC downward during an architecture refactor optimises for the wrong thing** and is a
   performance requirement wearing an architectural costume. The gate is left untouched.
5. **Each cycle-path quantity has one owner.** Enumerable, and a test enumerates it.
6. **The core does not depend on the induction layer.** Neither direction in the source: `nar`
   core may not import the layer's directory, and the layer may not reach core internals by any
   route weaker than public API. Enforced by the dependency gate (A2 acceptance 1), not by
   review.
7. **The no-provider configuration is a real system, not a stub.** It must pass NAL parity,
   reason, and produce derivations with zero producers registered. **This is the invariant most
   worth testing, because it is the one that would falsify the thesis.** If removing the layer
   leaves something inert, the layer was load-bearing and §3.6's argument is void.
8. **`lm.enabled` and `enableLMRules` disappear** rather than being extended (A2 acceptance 4).
   A boolean on an always-constructed component is a comment, and this repository is full of
   accurate comments about behaviour that is not what they say.
9. **Proposals enter through the kernel gates.** Perception, budget, reward and action gating is
   not bypassable by a provider, and a proposal may not write `Truth.frequency` or
   `Truth.confidence` through a reward path (README: the epistemic firewall). This is a
   pre-existing invariant; it is listed because A1–A3 create a new way to reach state, and the
   new way must go through the same doors.
10. **The six workspace packages do not merge**, and the README's documented public surface is
    updated in the same commit that changes it (`docs:drift` is a gate).

---

## 8. What is being deleted

Named, so the plan is falsifiable by diff:

- `processLMRulesImpl` from the cycle path, and its `await Promise.all` over model calls (A1).
- `RuleProcessor.stepScalars` and `RuleProcessor.resetMetaBudget` — deleted, not fixed (A1).
- The shadowed `resetMetaBudget` on the `ruleProcessor` port and on `NARExecution` (A1).
- `enableLMRules` and `lm` from the core config schema, plus the README and `docs/api`
  references to them (A2).
- `MemoryScorer`'s `novelty` and `relevance` factors, or the whole class — A4's recorded
  decision, one or the other.
- `Stamp.createInput()` from any getter (A4).
- The direct `Concept.priority` setter at every external site (A4).
- `Memory.sample` and `Memory.sampleWindow`, or their `decayAll` side effects (A4).
- `Concept.linkedConcepts` / `subConcepts` / `parentConcepts`, and with them
  `SpreadingActivation.prime`, `Concept.updateLinks`, `findOrphanedLinks` — unless A4 populates
  them (A4).
- The `*:*` bucket in `RuleIndex.candidatesFor`, and `RuleIndex.hitStats` with its tie-break,
  unless A6 makes them real (A6).
- The `totalTasks === 0` candidate filter in `evictUnderPressure` (A8).
- The per-cycle `getGoals()` / `getStatistics()` calls from the summary and meta-goal steps,
  or their budgets (A7).

---

## 9. Not doing

- **The induction layer's internals are not a target.** 15 226 lines, 25% of `nar/src`, the
  largest directory in the tree. A1 changes *where it is called from*; A2 changes *which way
  the dependency points*. Neither restyles it, and the rule templates and adapters are real
  work that stays. Making the layer itself fast or better is a separate plan — and the right
  time to ask is after A1, when its cost is no longer hidden inside a cycle.
- **No performance work.** Attention structures, premise indexes, dispatch compilation, eviction
  containers, admission indexes, statistics placement, population scaling, and the cost gates
  are TODO30. Naming a data structure in this document would be a scope error.
- **The game and RL focus subsystems are not targets.** `game/` and `focus/` are an agent-side
  apparatus, not the reasoning core, and they are the only reason several of these APIs are
  shaped as they are. Touching them makes the core changes harder to land.
- **No NAL changes.** Not one. If an item here appears to need one, that item is mis-specified.
- **The six workspace packages do not merge.** `util` / `core` / `io` / `metta` boundaries are
  load-bearing and TODO28 spent itself defending them.
- **No timing assertions in the default suite.** Latency assertions in unit tests produced
  every load-sensitive flake in this repository's history; `bench:cycle` is a script.
- **UI untouched**, and the System One manifold's heads, calibration and distillation loop are
  untouched. A2 moves *where* System One's adapter is constructed, not what it judges.

---

## 10. Gates

New, and wired into `pnpm gates` (`scripts/lib/gates.ts`), so they run in the same command as
everything else:

- `core:no-lm` — runs the NAL suites and a reasoning episode with **zero** proposal producers,
  and with the layer removed from the build graph. Green means §7 invariant 7 is mechanical
  rather than aspirational. Cheap, and it makes the optionality claim falsifiable.
- `core:no-provider` — the same episode with a provider registered whose backend never
  resolves, asserting the cycle completes. One test, and it is the one that would have caught
  §1.8 on day one.
- `deps:gate` gains a row: `nar` core may not import the induction layer's directory. One line
  in a ledger, and the only enforcement a well-meaning import cannot cross.
- `cycle:no-provider` — asserts the in-cycle provider counter reads 0 over a fixed episode
  (A0's instrument, wired to a gate).

Deliberately **not** here, and in TODO30: `cost:cycle`, the population-scaling matrix, and the
`bench:cycle` entry in the gate list. They belong to the plan that has a cost model to enforce.

### 10.1 The intent-to-gate ledger

The pattern that produced §1.8 and most of §1 is not specific to the induction layer, and it
generalises: **an architectural intent lives in a doc comment, and nothing in the build can
tell you when the code stops implementing it.** Three of the rows below are in that state today,
and one of them is now a *class* with no caller, which is a new and sharper version of the same
failure.

| architectural intent | where it is stated | mechanical? | what makes it so |
|---|---|---|---|
| The Stream Reasoner — async inducer, sync reasoner | §3.4, and `nar/src/stream/reasoner.ts` | **no** — the class is bounded and gated and has one caller, a test | A1: the in-cycle counter reads 0 |
| The layer is optional; the core is a reasoner | nowhere in docs; **39** core files import it | **no** | A2: a `deps:gate` row, and a no-provider NAR that reasons |
| Decay has one owner, on one cadence | nowhere | **no** — 8 calls per cycle from 3 sites | A4: count `decayAll` call sites |
| Attention has one owner | nowhere; 10 external writers | **no** | A4: an enumerated write surface |
| Reads do not change reasoning state | nowhere; a getter mints stamps | **no** | A4: identity and stamp stability |
| Every bounded container is bounded | `scripts/lib/accumulator-ledger.ts` | **partly** — a *string* check over 2 of 42 sites | A8: gate the declaration, failing test first |
| NAL parity | the NAL suites | **yes** | already works |
| No O(population) on a cycle path | nowhere | **no** | **TODO30 §3**, not here |

The rule this suggests, and the one worth taking from this pass even if none of §4 lands:

> **A gate ships with a test that proves it can fail, written before the gate exists.**

Every ratchet in this repository was set *above* its measurement for a pass or more, so none of
them could have failed, and all of them were green. `appendOnlyPersistenceSites` had been
reporting its `catch` fallback for the life of the gate. A gate that cannot fail is a comment,
and this repository is full of accurate comments about behaviour that is not what they say.
TODO28 §8.10 reached the same conclusion independently.

Two rules that follow, and they are cheap:

1. **When a metric's source can silently fail, that is a defect in the metric, not the source.**
   The persistence grep's broken quoting was a `catch` that returned a plausible number.
2. **A doc comment that explains a bug the code still has is a failing test that was never
   written.** `RuleIndex.ts:131-140` is the clearest example in the tree — a precise, correct
   diagnosis of a comparator collapse, sitting next to the collapse.
3. **A correct, bounded, tested component that nothing calls is a failing test that was never
   written too.** §1.9 is that shape, and it is the most expensive instance in the tree,
   because the intent it encodes — the Stream Reasoner — is the name of the architecture.

### 10.2 The architecture review gate

Before this document closes, review the dependency graph and answer these in writing. They are
worth more than any benchmark number, and each maps to a test:

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
```

The last one is there because `runStream` used to have one, and it was removed by deleting code
(`nar/src/stream/index.ts` records the removal). "One inference path" is an invariant worth
restating at every pass, and this plan adds a second channel's worth of wiring, so it is worth
checking rather than assuming.

---

## 11. The instrument, and the provenance of its numbers

`scripts/cycle-bench.ts`, committed, `pnpm bench:cycle`, with a `--selftest` that proves each
hook observes its own invocation — because a hook that silently observes nothing produces a table
of confident zeroes, and this repository already has two of those (§1.8, §1.9).

```
pnpm bench:cycle -- --selftest                              # prove the instrument
pnpm bench:cycle -- --size 500,2000,8000 --repeat 2          # the per-cycle work table
pnpm bench:cycle -- --knob-sweep --size 5,10,20,40            # the decay/sampling coupling
node --cpu-prof --cpu-prof-dir=/tmp/cp --import tsx scripts/cycle-bench.ts --size 5000 --repeat 1
```

### 11.1 The per-cycle work table

Per cycle, at three populations, min of two:

| population | ms/step | derived/step | decayAll | sample | forEachConcept | getGoals | getStatistics | **processLMRules** |
|---|---|---|---|---|---|---|---|---|
| 548 | 3.18 | 100 | **8.20** | **8.00** | **5.00** | 1.10 | 0.10 | **33.00** |
| 2 048 | 5.13 | 100 | **8.20** | **8.00** | **5.00** | 1.10 | 0.10 | **33.00** |
| 5 000 | 43.49 | 100 | **8.20** | **8.00** | **5.00** | 1.10 | 0.10 | **33.00** |

The bold columns are the violations: work per cycle that does not shrink when the operation
stops being population-sized. `ms/step` climbing 5.13 → 43.49 at `maxConcepts` is the eviction
path engaging, which is §1.4 and §1.7 rather than a surprise. **The counts are the
architectural evidence and the milliseconds are TODO30's** — v1.3 used this table for both,
which is the coupling this revision removes.

**The `processLMRules` column is the worst number in this document.** Thirty-three inducer-rule
invocations per cycle, measured with `enableLMRules: false`. The flag gates *execution*; the
selection machinery around it runs regardless. That is §3.5's "absent, not disabled", measured
rather than asserted, and it is the row that goes to 0 in A1.

### 11.2 The decay/sampling coupling

`--knob-sweep`, varying only `maxSampledConcepts`:

| maxSampledConcepts | population | decayAll per cycle |
|---|---|---|
| 5 | 86 | 5.2 |
| 10 | 139 | 8.4 |
| 20 | 164 | 9.0 |
| 40 | 164 | 9.0 |

A retrieval-breadth knob is a decay-rate knob. A4 should collapse this to one row, and that is
its acceptance criterion stated as a count.

### 11.3 Provenance, and what was read of NARchy

Every number in §1 and §11, and what it is worth.

| measurement | value | taken | at | reproducible by | load-sensitive? |
|---|---|---|---|---|---|
| per-cycle work | §11.1 | 2026-09-30 | `eb394d4a` | `pnpm bench:cycle` | counts, not times |
| decay/sampling coupling | §11.2 | 2026-09-30 | `eb394d4a` | `--knob-sweep` | counts |
| inducer invocations per cycle | 33.00 | 2026-09-30 | `eb394d4a` | `pnpm bench:cycle` | none |
| LM-importing core files | 39 | 2026-09-30 | `919c21ab` | `grep` (§0 corrections) | none |
| `Concept.priority` writers | 10 external / 6 internal | 2026-09-30 | `919c21ab` | call-site trace (§1.6) | none |
| scorer factors constant | — | 2026-09-30 | `919c21ab` | `memory/pressure/scorer.ts` + its one call site | none |
| `StreamReasoner` has no production caller | — | 2026-09-30 | `919c21ab` | `grep -rn StreamReasoner` outside `nar/src/stream` | none |
| profile shares | moved to TODO30 §1 | 2026-09-30 | `d542d5ee` | `node --cpu-prof` | **yes** — take the min |
| `nar/src` size | 60 757 lines / 513 files / 47 dirs | 2026-09-30 | `919c21ab` | `find nar/src -name '*.ts'` | none |
| NARchy reference | — | 2026-08-25 | `narchy@narchy` @ `f3a9bcc` | see below | none |

Two rules this table exists to enforce. **A number with no commit in it is not evidence** — and
applying that rule to v1.3 found four stale numbers, corrected at the top of this document. And
**the load-sensitive rows are the ones that will lie to you**: the profile and the wall-clock
rows were all measured on a machine that was carrying someone else's load at some point, which
is why they moved to a plan whose first step is re-measuring.

**Read and quoted from NARchy:** `nars/memory/Memory.java` (the 123-line port and its six
abstract methods), `nars/focus/util/PriTree.java` (the priority DAG and its `commit`),
`nars/Focus.java` (`commit` / `_commit` / `commitTime` and the duration-derived cadence), plus
the module tree.

**Inferred from the tree listing, not read:** the eight `Memory` implementations' behaviour; the
`deriver/reaction/compile/*` compilers; the `table/` belief-table hierarchy; `control/exec/*`;
`TaskAttention`'s sampling; term interning. §2.5's claim that inference is *precompiled* rests
on the existence and naming of those compilers, not on having read one. **A future session
should verify §2.5 against the source before treating it as established** — it is the
least-read claim in this document, and TODO30 §6 makes a decision that depends on it.

---

## 12. Open questions for the next session

Ordered by how much they change the plan. The first two should be answered *before* A0, because
each can invalidate work that has not started.

**Q1. Is the induction layer an episodic learner, an online learner, or both at different
rates?** The honest answer determines the architecture. If it is genuinely online — reasoning
*with* the model inside the loop — then the cycle cannot close, §3.1 is unenforceable, §10's
gates cannot exist, and this is the wrong plan. If it is episodic or consolidation-time, A1 is
exactly right and cheap. **This is the question that decides whether the rest of this document
is sound**, and `inferenceController.step(5000, …)` is evidence for the wrong answer.

**Q2. Is it a dependency or a component?** A dependency means no deterministic core, hence no
hermetic tier, hence no reliable suite — the `todo16-batching` latency assertion is that problem
in miniature. A component means §4.1's hermetic question is answered by A9. **Upstream of all
the others.**

**Q3. What is the falsifiable claim?** "NARS plus acquired rules is more capable than either
alone" is a thesis, and a thesis needs an experiment that could come out the other way. Nothing
in the current suite can falsify it: the RL benches assert SeNARS beats random, not that it
beats a NARS-shaped reasoner with no inducer. **If this plan lands and the answer is still
unknowable, it will have been tens of thousands of lines of good engineering pointed at
nothing.** Building the experiment is more important than any item in §4 and is not scheduled
here.

**Q4. What is the unit of asynchronous work?** §4.1's first question, and the one most worth
settling before the schema is written.

**Q5. Does A4 (ownership) or A5 (ports) come first?** Either, per §6. The tie-breaker is
whether test wall time or confidence is the binding constraint, and that is measurable in a
minute.

**Q6. What happens to the 19 rule templates?** A1 relocates the call site and changes nothing
else. Whether the *templates* are the right granularity is a real question that A1 deliberately
does not answer, and it should not be answered by whoever next opens that file.

**Q7. Should `StreamReasoner` be generalised in place, or replaced by a new seam type?** A2
assumes in place (`LMRequest` / `ProvisionalBelief` are already a request/response pair with a
provisional-truth discipline). The alternative — a new `ProposalSource` alongside it — creates
two seams, and §10.2's last question exists precisely to catch that shape.

**Q8. Does the induction layer become a seventh workspace package?** The only enforcement a
well-meaning import cannot bypass, and it requires everything the layer reads to be public API.
Probably good pressure, definitely a lot of surface. Answer after A1, because the interface is
not known until the seam is.

**Q9. What does the no-provider core's built-in reaction table contain?** If the core ships with
only the NAL rules, "reduces to NARS-like capability" is literally true and the claim is modest.
If it ships with more, the claim needs a specification and a test. Either is defensible; leaving
it undecided is not, because the answer determines whether §3.6's falsifiability argument holds.

**Q10. Is the model the *only* proposal producer we expect?** Designing the contract for one
producer is how you get an interface that is really a call site. A rule-miner, a human author
and a recorded fixture are cheap to name now and expensive to retrofit.

---

## 13. Pass log

### Fifth pass (v2.0) — the split

- **Split the plan by architectural responsibility.** The cost model, indexed retrieval,
  compiled dispatch and data-structure work moved to TODO30; the Stream Reasoner boundary, layer
  optionality, proposal semantics, state ownership, `Memory` decomposition and the boundedness
  contracts stayed. §3.1's complexity table became an architecture contract; §5's prediction
  table became "what this architecture makes possible"; §7's LOC ratchet was replaced.
- **Found the thing v1.3 said was in prose.** The Stream Reasoner is a committed, exported,
  bounded, gate-checked class with **no production caller** (§1.9). A1 is therefore a wiring
  change plus a payload version, not an invention — and the overflow policy is already chosen,
  and already the one §0 argues is wrong. This is a materially better position than v1.3
  described and it changes what the first workstream *is*.
- **Re-measured v1.3's own numbers and corrected four** (§0): 36 → 39 importing files,
  `nar.ts:18` is an import rather than a call, the scorer's call site path, and nineteen →
  eleven `Concept.priority` writers. The LOC-ratchet invariant described a gate that does not
  exist.
- **Aligned the seam with the kernel gates** (§3.4, §7 invariant 9), which v1.3 never mentioned:
  four gates mediate every state mutation, a proposal is a request to a gate, and the epistemic
  firewall applies to proposals like everything else. The committed channel already asks
  `BudgetGate` for an `lm-call` budget; the requirement is to keep that.
- **Expanded A3 into a protocol** — eight decisions with a written applicability rule, two of
  them answered by reading the existing implementation instead of guessing.
- Named the plan's coverage limit, unchanged and still true: 14 of 47 `nar/src` directories
  examined; 33 are not (§14.3).

### Fourth pass (v1.3)

- Audited this document as a handoff rather than as prose. Six gaps; the serious one was that
  §11 described a measuring apparatus that no longer existed.
- Committed `scripts/cycle-bench.ts` and `pnpm bench:cycle`, so §11 is executable.
- Found, by building it, that `processLMRules` runs 33× per cycle with `enableLMRules: false`.
- Added §4.0 (finding → workstream trace), §11.5 (provenance and load-sensitivity), §11.6
  (NARchy read-versus-inferred, SHA pinned), §14, §15, and a statement of the thesis.

### Third pass (v1.2)

- Recorded that the layer must be **optional** and sit beyond the core, and worked out what that
  has to mean operationally: not a flag, since the component is constructed and registered
  unconditionally. The two tests that tell the difference — a hanging provider, and a NAR with
  zero producers — did not exist.
- Added §3.5, §3.6, and the dependency-inversion workstream; retired the hermetic question by
  deciding it rather than deferring it.

### Second pass (v1.1)

- Established that the Stream Reasoner was the intended design and that §1's findings diagnose a
  failure to reach it, not the design. That made the first workstream "the design that was
  always intended, plus the test that was never written", and the plan got cheaper.
- Added §1.10 (which findings survive), which invalidated the profile and the prediction table
  and forced a re-measurement. **v2.0 completes that correction by moving them out of this
  document entirely.**
- Added the intent-to-gate ledger, and the rule that a gate ships with a test proving it can
  fail.

### First pass (v1.0)

- Profiled the inference loop; eight findings, all measured. Read `narchy/narchy` and extracted
  the port / attention / clock / compiled-dispatch contrast. Diagnosed the fused cycle as an
  architecture problem, which was half right.

---

## 14. What is measured, what is believed, and what is unexamined

A plan that does not separate these gets them all treated the same way, and a future session
then either re-litigates the measurements or inherits the beliefs as fact.

### 14.1 Measured — do not re-derive

| claim | how it is known |
|---|---|
| 8.2 decay passes, 8.0 rankings, 5.0 sweeps per cycle | `pnpm bench:cycle` (§11.1) |
| **33 inducer invocations per cycle with `enableLMRules: false`** | `pnpm bench:cycle` (§11.1) |
| decay rate tracks `maxSampledConcepts` | `--knob-sweep` (§11.2) |
| **39** core files import the layer's directory | `grep` (§0 corrections) |
| `LMRule` is in the strategy extension contract | `strategies/types.ts:1,71` |
| `initializeLMRules` runs at construction | `nar.ts:762,823,837`; `facade/index.ts:98` |
| the scorer's factors are constant on every path | `memory/pressure/scorer.ts` + its one call site |
| `getGoals()` mints a stamp per call | `memory.ts:253` |
| `recordRuleHit` has no callers | `grep` |
| `resetMetaBudget` is shadowed across port and implementation | `nar-execution.ts:76,116,179,368` |
| `linkedConcepts` is never written outside `mergeWith` | call-site trace |
| **`StreamReasoner` has no caller outside its own test** | `grep -rn StreamReasoner` |
| the overflow policy is drop-oldest on both paths | `util/src/utils/collections.ts:33-47` |

### 14.2 Believed — argued, not established

Design positions. Defensible, and the plan proceeds on them, but a future session is entitled
to disagree and should say so rather than quietly inherit them.

| belief | where it comes from | how you would know it is wrong |
|---|---|---|
| `Memory` should be a **port** | NARchy's `Memory` is a port with 8 implementations (§2.1) | the ports cannot express what reasoning code actually needs, and the seam becomes a wrapper over the god-object |
| Attention should have **one owner** | `PriTree` + a duration-derived commit (§2.2–2.3) | the ownership surface cannot be enumerated — a new writer appears and nothing fails |
| Inference dispatch should be a **separate subsystem** | `deriver/reaction/compile/*` — **inferred from filenames, not read** (§11.3) | read the source and find it is not precompiled; the least-read claim in the plan |
| A NARS-like core makes the layer **falsifiable** | argument, §3.6 | the no-provider core turns out inert — §7 invariant 7 fails and the argument is void |
| Rule acquisition is the **right** thing to add to NARS | thesis, §0 | Q3's experiment comes out negative against a no-inducer baseline |

### 14.3 Unexamined — do not assume the plan is comprehensive

The plan names **14 of the 47 directories** in `nar/src`: `facade`, `focus`, `game`, `kernel`,
`lifecycle`, `lm`, `memory`, `reason`, `rules`, `self`, `state`, `strategies`, `tools`, `utils`.
`nar/src` is 60 757 lines and 25% of it is `lm/`, which this plan deliberately does not examine
beyond the boundary. **Thirty-three directories were not looked at.** They are neither presumed
clean nor presumed broken. A session that finds itself editing one should treat that as new
scope and say so.

**And one gap inside the examined set:** the NAL parity suites are `nal1`, `nal2`, `nal7`,
`nal8` and `nal9`. There is no `nal3`–`nal6` file, and v1.3's repeated phrase "NAL1–8" was
shorthand for a suite set that does not exist in that shape. §7 invariant 1 names the five
files that do exist. Whether NAL3–6 are covered elsewhere, or are simply not tested, is
unexamined — and if they are not, the parity claim is narrower than the plan's language has
implied for several passes. **This is worth ten minutes and should be resolved before A6, not
after.**

### 14.4 Known-broken, inherited, not this plan's

- **`docs/api/util.md` drifts from its generator** on the unmodified tree, so `docs:drift` is
  red independently of anything in §4.
- **`test:load-sensitive` has a wall-clock assertion** (`todo16-batching`, "judgeBatch processes
  64 queries in single joint pass", < 50 ms) that fails under load and passes in isolation. It
  is the smallest possible illustration of §10.1, and this plan's decision to add no timing
  assertions is partly a response to it.
- **`docs/api/nar.md` is regenerated** by this work's commits; `docs/api/util.md` is left at
  its committed state.

---

## 15. Risk register, and what would make this plan wrong

This is the list of ways it fails, so that a failure is recognised as information rather than as
bad luck.

| risk | likelihood | signal that it is happening | response |
|---|---|---|---|
| **A1 is not the cheap change v2.0 believes.** The committed channel is wired in and something *else* turns out to reach the layer from the cycle | **medium** — the cycle path is `DefaultDerivation`, `RuleProcessor` and the tick bindings, and only part of it was traced | the in-cycle counter from A0 does not reach 0 after the wiring; `grep` for every layer import reachable from `applySyncRules` before assuming the call graph is small | widen A1 rather than declaring victory; the acceptance is a count, and the count is the arbiter |
| **A2 is a swamp.** 39 files, and the layer reaches into core internals | medium | the diff stops being mechanical and starts having semantic content | A2 is deliberately after A1, so the `Proposal` interface is known. If it is still hard, take Q8 (seventh package) early — a compiler error is a better boundary than a review convention |
| **A4 breaks NAL parity.** Attention order changes | medium | the NAL suites move | A4 is gated on parity, and its baselines are re-established in the same change so later drift is attributable |
| **A4's write surface is unenforceable.** The "one owner" invariant is a comment | medium | a new external `priority` writer appears and no test fails | the enumerated write-surface test is the mitigation and must land with A4, not after |
| **The thesis is negative.** NARS-plus-acquired-rules is *not* better | unknown, and unknowable from inside this repo | Q3's experiment does not exist, or comes out flat | build the experiment and publish the result either way. No amount of engineering removes this risk |
| **The plan measures the wrong thing** | **already happened once** | v1.3's ordering came from a profile of the fused system | fixed by construction in v2.0: this document makes no ordering claims about cost, and TODO30 must re-profile before ordering anything |
| **A5's ports become wrappers.** The split adds a layer without removing the god-object | medium | `Memory` keeps its responsibilities and a new interface forwards to it | A5's acceptance is that the cycle depends on ports; if `Memory` is still on the cycle path, it is not done |
| **Deleting the drop-oldest policy is the wrong call** | low-medium | A3's overflow choice makes the queue starve a slow producer | it is a one-line change with a test, and it is reversible by design — which is the point of A3 being a decision rather than a default |

**The kill criteria, stated plainly.** Two things would mean this is not the right plan. If
**Q1** resolves to "the induction layer is genuinely an *online* learner" — the cycle cannot
close, §3.1 is unenforceable, and the whole architecture is moot. And if **§7 invariant 7**
fails — the no-provider core turns out inert, which would mean the layer was load-bearing and
§3.6's falsifiability argument was never true. Both are checkable before much is built, and both
should be checked first.
