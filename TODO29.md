# TODO29: Runtime Architecture — a closed core, an explicit induction boundary, and owned state

**Version:** 2.5 (2026-09-30) · **Predecessor:** TODO28 (phases A–P; structure, the package graph, the
barrels, the gate list), which closed the structural axis and left the runtime. **Successor:**
TODO30 (the cost model of whatever this lands), which is blocked on this document.

**Status: open. Scope: architecture and semantics.** Nothing here has landed. **No latency,
throughput, complexity, population-scaling, or index-shape requirement appears in this
document's acceptance criteria** — every one of those moved to TODO30, deliberately, because
they are measurable only after the seams they will be measured through exist. What remains here
is the part that is testable on a tree in its current state: dependency direction, proposal
semantics, state ownership, read purity, and declared resource lifecycle.

> **A fresh session should read §Status, §1.11, §3.7, §4.0, §4/A1, §4/A10 and §15 first.** §1.11
> is the finding the diagnosis was missing, §3.7 is the shape the whole plan converges on, §1.12
> says which findings survive the split into this document and which belong to TODO30; §4.0 is
> the finding → workstream trace; **§4/A10 is the item the thesis rests on and the one the
> diagnosis does not point at**; §15 lists the two kill criteria, and both are checkable before
> anything is built.

## Status — where this plan stands

**Nothing has landed.** This is a plan; the architecture it describes does not exist yet. Five
revision passes have reshaped it, and the last two changed its centre rather than its details.

### Decided, and load-bearing

| decision | where | why it is settled |
|---|---|---|
| The thesis is **composition**, not optionality: symbolic and model reasoning must coexist in one system | §0 | stated by the project's author |
| The cycle must never **depend** on a provider — a model may be called anywhere, but its result is optional, budgeted and timeout-bounded | §3.7, §7 | a call-count-of-zero rule was too strict *and* passed while a real dependency remained |
| The model-reasoning capability has **one boundary and two profiles** — fast/point and deep/open — and they are *not* in a gate relationship | §3.7 | **the fast profile is a first-class reasoning participant, usable anywhere in the pipeline, and it can produce derivations** |
| Both profiles are **optional** (the model may not be provided) and both **fail closed** | §7 inv. 14 | stated by the author; and a judged input that cannot be judged must not be admitted unjudged (D1) |
| The rule set is **loaded data**, admitted through a port, versioned and revertable — never mutated by an import | §7 inv. 15, A10 | the alternative leaves the rule set as code, which makes the learnability claim a claim about a message format |
| NARchy **winnows** rules with a predicate trie and stays interpreted; its rule set is **selectable at startup** | §2.5, §11.3 | stated by NARchy's author — the earlier "precompiles" reading came from filenames and was wrong |
| NARchy's structures live in a **separate module** (`jcog`) from its reasoning | §2, §11.3 | the monorepo layout; makes "storage is a port" a module-boundary precedent |
| Structural work precedes behavioural work, so the one attribution (RL/parity baselines) is measured on the final shape | §6 | replaces v2.0's "either order works" |

### Open, and needing a decision from the project's author

| question | why it is blocking | where |
|---|---|---|
| **Q3's hypothesis** — which arm should beat which, by how much, on which games, and what result would count as "the model does not earn its place" | the thesis has no measurement; the experiment exists as a command (`pnpm arcade -- --arms nal,manifold,lm`, same actuator, Brier-scored) and needs only the hypothesis, an aggregate with variance, and A1 for a clean control | §12 Q3 |
| **Q1′ — the in-cycle induction inventory**: which behaviours the layer performs *inside* a cycle today, and where each goes (`boundary` / `synchronous` / `dropped`), with a "who would notice its absence" column | A1 is mostly this work; the dispositions are a decision, not a derivation | §12 Q1 |
| **A3's eight protocol decisions** — unit of work, trigger, overflow per proposal kind, denied-batch behaviour, staleness, evicted references, versioning, cancellation | A1's cost is these; A2's contract shape depends on them | §4/A3 |
| **The fast profile's placement order** — "anywhere in the pipeline" needs a priority order and a budget, decided by measurement rather than enthusiasm | §3.7 lists candidate sites; none is mandated yet | §3.7 |
| **Q8** — whether the induction layer ever becomes a seventh package (answered *for the contracts*; the rest is open) | not blocking | §12 Q8 |
| **Q9** — the census test asserting the core's shipped table is exactly the registered NAL rules | small; belongs with A2 | §12 Q9 |

### Next actions, in order

1. **A0** — instrumentation, including provider-dependency detection (not presence detection). Pure, no risk.
2. **Q1′ and A3** — decide them, because A1 is mostly their output.
3. **A1** — close the cycle's *dependency* on the model, give the J/point profile a timeout, and
   require a symbolic fallback on every model-backed rule. Now materially cheaper than v2.3
   claimed: it makes calls optional rather than moving the model out.
4. **A2** — the dependency inversion, with the seam contracts in `@senars/core/schemas`.
5. **A5 → A4** — the mechanical split, then the one deliberate behaviour change.

### What this plan is not

It is **substrate**. System One, the Judgment Manifold, governance, the game/RL loop and the
`lm/` internals are out of scope (§9), so no claim here is a claim about SeNARS being better at
anything. Q3 is the only thing that would support such a claim, and it is last.

### How this document is organised

- **§0 the thesis, §1 the diagnosis, §2 the reference system, §3 the target** — what and why.
- **§4 the work (A0–A11), §6 sequencing** — what to build, in what order.
- **§5 what it makes possible · §7 invariants · §8 deletions · §9 not doing · §10 gates** — the
  constraints and the checks.
- **§11 instrument and provenance · §12 open questions · §13 pass log · §14 measured/believed/
  unexamined · §15 risks** — the honesty section. §12 is where to pick the work back up.
- A fresh session should read **§1.11, §3.7, §4.0, §4/A1, §4/A10 and §15** first.

### Revision log

Detail is in §13. The two passes that changed the plan's centre are **v2.0** (split the
performance work out to TODO30, leaving architecture) and **v2.4** (the thesis became
composition, and the model-reasoning boundary became two profiles rather than a gate and a
proposer). v2.1–v2.3 corrected measurements, found two hidden globals, and retired a wrong
question.

| version | changed |
|---|---|
| v2.0 | split by architectural responsibility; performance deferred to TODO30; the profile and prediction tables moved out |
| v2.1 | found the seam bypasses gate isolation; made the dispatch question a measurement; put the seam contracts in `core`; structural before behavioural |
| v2.2 | added A10 (the rule table is code, not an artifact); Q3's experiment located in the arcade; Q1 made mechanical |
| v2.3 | corrected NARchy: **winnowed, not compiled**; **selected vs learned**, not fixed vs configurable; retired Q1 as a category error |
| v2.4 | the thesis is composition; the invariant is *never depends on a provider*; found that perception blocks with no bound; split content and rule proposals; both model-dependent tiers optional and fail-closed; **the fast profile is a reasoning participant, not a gate on the deep one** |

---

### The thesis, stated so it can be wrong

> SeNARS reasons symbolically **and** with a language model, and the architecture makes those
> compose instead of compete: a closed, deterministic core whose derivations are NAL rules, an
> untrusted induction layer whose every output is judged before it can touch state, and a
> versioned rule table the system can grow while it runs. The core is a complete reasoner with
> no model present; the model makes the judgments and the rule set better; and neither can
> corrupt the other.

**The innovation is the LM integration as a whole, not the optionality of it.** Three passes of
this document framed the thesis as "the core does not depend on the LM", which is *necessary* and
reads as the claim. It is the floor. The claim is **composition**: the best of a NAR-shaped
symbolic reasoner *and* a model, which requires the two to have different representations,
different schedules and different trust levels, and to meet at exactly one place. §3.7 is that
architecture; §3.7's two model-dependent tiers are both **optional**, because the model may not be
provided, and both **fail closed**, because a judged input that cannot be judged must not be
admitted unjudged.

The falsifiable half — that this composition is *better* than either alone — still has no test in
this repository (§12 Q3). The experiment exists as a command; the hypothesis, the aggregate and a
clean control do not, and a clean control depends on A1. That remains a real gap.

---

## 0. What this is

Eight findings from a profiling and contract-audit pass, in order of how much they cost, plus
two that cost nothing and are the most important — the seam that already exists and the gate
isolation it does not have (§1.9, §1.10). Neither is a performance finding at all, and between
them they are most of what §4 actually is.

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

**The four-bucket dispatch union is three-quarters empty, and the census is cheap.** `RuleIndex`
keys rules by `pattern.left.op : pattern.right.op`, defaulting a missing op to `*`
(`rules/impls/RuleIndex.ts:9-10`), and `candidatesFor` unions four buckets — exact, `*:right`,
`left:*`, `*:*` — before sorting the result (`:107-125`). The defaulting is what makes `*:*` look
like a catch-all. It is not one: it is the *default registration key*. Counting what is actually
registered, at `919c21ab`:

```ts
import { RuleRegistry } from '../nar/src/rules/impls/rule-registry.js';
import '../nar/src/rules/impls/registration.js';
// RuleRegistry.getAll() → 55 rules, 21 of them `inheritance:inheritance`,
// and zero under any bucket containing a wildcard.
```

So the three wildcard lookups match nothing, `*:*` is not load-bearing for the shipped rule set,
and the structure that matters is the exact 2-tuple table with a hot cell of 21. `RuleDef.pattern`
is already `[Term['kind'], Term['kind']]` — non-optional — so the type forbids a wildcard for
every DSL rule; the only door is `createRulePattern(leftOp?: string, rightOp?: string)`.

**So A6's catch-all decision is a measurement, not a design debate**: make both parameters
required, delete the three wildcard lookups, and let the census be the test that fails if a
future rule arrives without a kind pair. README names `nar/src/rules/registration.ts` as the
source of truth for the rule matrix; the real path is `nar/src/rules/impls/registration.ts`
(§14.3).

**And the same file contains the positive example.** `RuleIndex.ordered` is a candidate cache
whose entries carry the `rankingEpoch` they were ordered at, and a stale entry is re-ordered
rather than served (`:11-23`) — a cache that *tracks* the state its ordering depended on, which
is the exact defect `stepScalars` is. A6 should copy that shape rather than invent one.

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

### 1.10 The seam bypasses the kernel's own gate isolation

`nar/src/stream/reasoner.ts:2` imports the module-global registry:

```ts
import { gateRegistry } from '../kernel/index.js';
…
gateRegistry.getBudgetGate().check({ operation: 'lm-call', estimatedCost: batch.length })
```

`kernel/GateRegistry.ts:117` exports that global, and `:120` exports `createGateRegistry()` —
annotated *"per-instance gate registry factory (TODO19 F2): each NAR/agent owns its own
registry, enabling gate isolation in one process"* — which `nar.ts:136` uses
(`config.gateRegistry ?? createGateRegistry()`). The isolation pattern is not aspirational here:
TODO19 shipped a bench for it, and README's promise that "none can bypass them" is a per-NAR
promise.

**So the one production consumer of the kernel's budget gate is not the gate registry the NAR
owns.** Three consequences, all of them real today:

1. Two NARs in one process charge their LM budget to the same registry.
2. A NAR constructed with an injected `gateRegistry` (the documented way to get isolation) has
   a producer that spends against a *different* registry than its own RewardGate and BudgetGate.
3. `resetGateRegistry()` exists for test isolation, which is how a suite that mutates the
   global can affect a `StreamReasoner` it never configured.

This is a two-line defect and a design constraint worth keeping: **the seam takes its gates by
injection.** It also happens to be the cleanest available demonstration that §3.1's "no hidden
global state" clause is real, because here is a place the code violates it in the subsystem the
plan is about to make load-bearing.

### 1.11 The model capability is reachable from two places, and the one with no bound is the one nobody was looking at

A1, and every version of this document before v2.4, examined one thing: the induction layer inside
the *reasoning* cycle. Both model-dependent tiers are a second and third place, and the second
one turns out to be nearly right already.

**The point profile is already optional at ingress, and fails closed on purpose.** `KernelPerceptionGate` holds
`judge?: IngressJudge`, keeps it in `private judge: IngressJudge | null`, and sets it only when
`config.systemOne?.enabled && config.systemOne.judge` (`:72-73`). Admission is guarded the same
way (`:117`), so **with no model provided, input takes the unjudged path** — which is the
shipped `systemOne.enabled: false` behaviour. And when a judge *is* present and throws,
`admitViaJudge` catches, records a policy violation, and **rejects**:

```ts
// :154-170  — Fail-closed (D1): a System One fault must never bypass the injection
// veto via legacy admission — reject and emit ingress-error telemetry.
catch (error) { recordPolicyViolation(this.eventLog, { policyId: 'systemone-ingress',
  violationType: 'epistemic-firewall', ... }); return { admitted: false, ... } }
```

That is deliberate, and **v2.4 was wrong to propose degrading it**. Falling back to unjudged
admission on failure would bypass the injection veto — precisely what that comment forbids. So
the three cases are not one case, and conflating them is the mistake:

| case | behaviour at ingress | verdict |
|---|---|---|
| model not provided | unjudged admission path (`:117` guard) | **correct today** — absent, not disabled |
| judge throws | fail closed, reject, log an `epistemic-firewall` violation | **correct today** — deliberate (D1) |
| judge hangs | `await` with no bound | **the actual defect** |

**The gap is a missing timeout, not a missing fallback.** A present-but-hung judge has no catch,
so the hang is unbounded and the input path waits forever. That is the one thing to fix, and it is
the opposite of what v2.4 proposed.

**The open profile's failure path exists too.** `LMRule.apply` is `async` (`:135`) with a body of
`await executeStructured/executeLM` (`:213,215`) behind a circuit breaker (`:367`), and
`executeLM` returns `Promise<string | null>` — a failure yields `null` and
`lm/rule-templates/fallbacks.ts` supplies the symbolic body. So "every cognitive function has a
symbolic path" is implemented, **but nothing requires it**: no schema check, no test, and a new
P-tier rule with no fallback would be accepted silently.

Two further facts from the same reading, and together they are the architecture:

1. **An LM rule body cannot be made synchronous.** `LMRule.apply` is `async` (`:135`) and its body
   is `await executeStructured(...)` / `await executeLM(...)` (`:213,215`) behind a circuit breaker
   (`:367`). It is grammar-constrained (`grammar` passthrough, `:363`). It is not a rule that
   *could* be synchronous and currently isn't; it is a bounded, optional, fallible call.
2. **Every LM rule already has a second, symbolic body.** `nar/src/lm/rule-templates/fallbacks.ts`
   exists so that "every cognitive function has a symbolic path; none depends on LM availability".
   **That is the best-of-both seam, and it is already built.** Nobody had to choose between
   symbolic and LM reasoning — the choice was made per rule, at design time, as a fallback.

**The finding is therefore not "the LM is in the cycle".** It is that both call sites lack the
one property that matters: neither is *optional*. Neither has a budget the cycle's completion
depends on, and neither is instrumented as a dependency. §1.10's framing ("provider execution
cannot block the synchronous cycle") was the right instinct with the wrong test — it should be
**cannot block**, not **cannot run**.

### 1.12 Which findings survive, and who owns each

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
| 1.8 | frozen `stepScalars`; inert tie-break; three empty dispatch buckets | **no — resolved by the split** | **A1** (delete), **A6** (the tie-break and the bucket decisions) |
| 1.9 | the seam exists and is unused | **yes** — and it is the whole of A1 | **A1** |
| 1.10 | the seam spends against the global gate registry | **yes** — and A1 makes that registry load-bearing | **A1** |
| 1.11 | a hung judge has no timeout; a model-backed rule body is inherently async, and its symbolic fallback exists but nothing requires it | **yes** — and it reframes A1 from "move the model out" to "make every model call optional and bounded" | **A1**, **A3**, **A11** |
| 5 (v1.3) | the prediction table | **no — retake** | **TODO30 §1** |
| 1.9 (v1.3) | the profile shares | **no — retake** | **TODO30 §1** |

Of the eight findings in §1.1–§1.8, **seven stand regardless of the split** and the eighth is
*resolved* by it rather than needing a fix. The profile and the prediction table do not survive
and live in TODO30, which is the formal handoff: TODO30 §1 requires a fresh profile before it
orders anything, because a profile of the fused system is a ranking of the wrong thing.

---

## 2. Architectural precedent: what NARchy does instead

Reference: `github.com/narchy/narchy`, pinned at **`f3a9bcc`** (2026-08-25). §11.3 records what
was read, what was inferred, and what was stated by NARchy's author — the last category is the
one this section now leans on most, and it was previously mislabelled as inference.

**Why NARchy and not OpenNARS.** NARchy is derived from OpenNARS and modifies it substantially,
so the contrast below is a contrast between a system and its own deliberately-modified
lineage: every divergence is a decision someone made, which is a much stronger reference than
two unrelated systems. OpenNARS is the substrate NARchy departs from, and the interesting
question is never "is SeNARS better than OpenNARS" but "which of NARchy's departures is the one
worth copying, and which is the one worth going further on".

The repository is also now a monorepo of three projects — `jcog` (foundation: data structures,
graph algorithms, ML), `narchy` (the reasoner), `spacegraph` (UI) — and that split is itself
part of the precedent. **The data structures NARchy reasons with live in a different module from
the reasoning.** `MapNodeGraph`, the node-graph types behind `PriTree`, are `jcog`. So NARchy's
separation of "how memory is stored" from "what memory means" is a *module boundary*, not a
convention inside one package, which is a stronger form of the same claim A5 makes.

The load-bearing observation is not any single data structure — it is **where the responsibility
sits**. Nothing in this section is a performance target; the comparative numbers live in
TODO30 §1.

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

### 2.5 Inference is *winnowed* by a predicate trie — not compiled to bytecode

Corrected in v2.3, and the correction matters more than the section's length suggests.

`nars/deriver/reaction/` holds `NativeReaction`, `PatternReaction`, `TaskReaction`,
`MutableReaction` and `ReactionModel`, with `compile/TrieReactionCompiler`,
`DAGReactionCompiler`, `DecisionTreeReactionCompiler`, `ANDCompiler` and
`JaninoPredicateCompiler`; `deriver/util/memoize/` memoises the predicates they call. But the
word "compile" invites the wrong picture, and v1.3–v2.2 repeated it: **NARchy's compilation
stays interpreted.** What it builds is a **trie over rule predicates that winnows the applicable
rules for a given premise** — a candidate selector, not a code generator. Deeper bytecode
compilation was available in the design space and was deliberately not taken.

That is a much better fit for SeNARS than "compiled dispatch" ever was, for three reasons:

1. **SeNARS already has the depth-1 case of exactly this structure.** `RuleIndex` keys rules by
   `(pattern.left.op, pattern.right.op)` and looks them up by a term-kind pair (§1.8). A
   predicate trie is the generalisation of that key. So the change is *extend a 2-tuple table
   into a shape trie* — incremental, reviewable, and parity-gated — rather than "adopt a
   compiler", which would have been a rewrite with a fabricated justification.
2. **The winnowing target is measurable before it is built.** "How many of the 55 rules survive
   a given premise's predicate shape" is a count, and TODO30 §6 is now specified to measure it
   before choosing a structure.
3. **It keeps the semantics obviously unchanged.** Winnowing selects candidates; it does not
   transform meaning. A generated dispatch would have put NAL parity at risk for a benefit nobody
   has measured, which is the failure mode TODO29 exists to avoid.

**What is inherited here is the shape, not a technique**: the rule set is turned into a structure
keyed by what it matches, and evaluation walks it. That is why `InferenceTable` is a port in
A6. **What is explicitly not inherited is code generation** — and the author of NARchy confirms
deeper compilation was never necessary, so TODO30 §6 must not smuggle it back in as ambition.

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

And each clause prefers the strongest available mechanism, in this order, because a rule nobody
enforces is a comment:

```text
representational   the type forbids it           (Concept.priority has no public setter)
structural         the package graph forbids it   (seam contracts in @senars/core/schemas)
declarative        a ledger of the sites          (accumulator ledger, write-surface census)
mechanical         a gate that can fail           (attention:write-surface, deps:gate)
```

Three of the four already have a precedent in this repository: `verify-derivation`'s dependency
floor, the accumulator ledger's "declare it as data", and `deps:gate` itself. The one this plan
has to build from nothing is the first row.

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
                       │  deterministic · no I/O · no model        │
                       │  dependency: a model may answer or not,    │
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
   deployable only as code — and it is the axis on which SeNARS is meant to beat NARchy, whose
   rules are chosen from a compiled library at startup and never revised while the system runs.
3. **The split buys the improvement NARchy does not have, not just the discipline.** NARchy
   selects *rulesets* — an existing, hand-written library, enabled at boot. Nothing in it
   acquires a new inference form, and a rule that turned out to be wrong is corrected by
   restarting with a different selection. Here the rule set is the primary learnable artifact:
   grown while the system runs, through gates, versioned, and revertable. **That is a narrower
   claim than "NAR has a fixed rule set" and a stronger one than "it is configurable"** — it is
   the difference between *selected* and *learned*. It is also the claim §14.2 records a
   falsifier for, and the one A10 exists to make true.

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
- **It forces the interface that is the actual innovation** — and the axis is *selected versus
  learned*, not *fixed versus configurable*. NARchy's rule set is **not** fixed at build time: it
  is selectable at runtime startup, by enabling chosen rulesets, and a fully dynamic
  online-recompile path was available and never became necessary. Anyone who knows NARchy will
  catch the looser version of this claim, so the sharp one is: **NARchy lets you choose which
  pre-written rules to enable; the claim here is that rules are produced, admitted through gates,
  versioned, and revertable while the system is running.** Loading a table is not novel —
  NARchy does that at startup. *Admitting a rule into a running system through a gated,
  recorded, revertable path* is the difference, and it is a smaller and more defensible claim
  than "NARS has a fixed rule set". That capability belongs to the *core*, and it survives the
  layer's absence.
- **It makes the hermetic tier free.** The question "how does a background model survive
  `test:hermetic`" answers itself: the hermetic run is the no-provider run plus a recorded
  proposal stream replayed through the same seam. No gate is weakened and no test is skipped —
  which removes the failure mode that produced §1.8, gates quietly deferred until bypassed.

### 3.7 One model-reasoning boundary, two profiles

**Corrected in v2.5, and this is the correction that matters most to the design.**

v2.4 modelled the model-dependent capability as two things in a relationship: a fast tier that
*judges* untrusted input at the perception gate, and a slow tier that *proposes* new content or
rules at a boundary — with the first acting as a checkpoint on the second. **That is wrong, and it
is the model the project's author does not hold.** The correct shape is **one capability with two
call profiles**, differing in scope and latency and in nothing else:

- the **point profile** answers a specific, bounded question, fast enough to be useful *inline*;
- the **open profile** answers an open-ended request — explain, propose, generalise, derive — and
  runs at a boundary.

Three consequences, and the first two undo v2.4 explicitly:

1. **The point profile is not a gate on the open profile.** "Judge" and "gate" are not names for
   tiers. A judgment is an answer, and what the core does with an answer — admit it, derive from
   it, select with it, prioritise with it — is a separate decision belonging to the consumer.
2. **The point profile can produce derivations, not only gate other behaviour.** It is a
   reasoning participant. A fast answer that concludes something is a conclusion, admitted through
   the normal derivation path, and it is not second-class for having come from a model.
3. **The point profile is available anywhere in the pipeline.** Not at ingress because ingress is
   where untrusted input happens — *anywhere a decision could be improved*, and the ordering is a
   measurement question, not an architectural one (see below).

**This is only safe because of the corrected invariant.** Every model call is optional, budgeted
and timeout-bounded, and the cycle's completion never depends on one. That is precisely what
licenses placing the point profile *inside* the cycle, and therefore anywhere: without it, "use
it everywhere" is a liveness bug, and with it, "use it everywhere" is bounded by construction.
**The invariant and this section are the same decision.** A plan that forbade model calls in the
cycle would have forbidden the thing the system is for.

| | **S — symbolic** | **model-reason, point profile** | **model-reason, open profile** |
|---|---|---|---|
| question answered | — | one specific question, bounded | an open-ended request |
| result | a conclusion, computed | a bounded answer | proposals, abstractions, derivations |
| latency | microseconds | must be cheap enough to be inline; budgeted | unbounded; boundary only |
| **may produce derivations** | yes | **yes** | yes |
| where it may run | anywhere in the cycle | **anywhere in the pipeline**, including the cycle | at a declared boundary |
| trust | trusted: in the shipped table | untrusted: judged on arrival, and admitted through a gate | untrusted: provisional until admitted |
| lifecycle | fixed; changed by a release | shares the model's configuration | runtime, versioned, **revertable** (A10) |
| absent | n/a | **no point answers; the consumer proceeds on its own path** | **no proposals; the system reasons unchanged** |
| failing | must be total; NAL parity is the gate | **fail closed**, bounded, cycle unaffected | **fail closed**; nothing applied |
| hanging | must be impossible | **timeout, then treated as failing** (§1.11 — the one real gap today) | timeout, then nothing applied |

**Both profiles are optional for the same reason, and it is the reason the author gave: the model
may not be provided.** "Optional" is not "degrade gracefully on failure" — it is absence:

- **absent** ⇒ the consumer takes its own path, unchanged. With no model at all the core is a
  complete NARS-like reasoner, and this is the `systemOne.enabled: false` path that already ships.
- **failing** ⇒ **fail closed**. An answer that cannot be obtained is not treated as a negative or
  a pass; the consumer refuses the decision and records why (the epistemic firewall exists for
  this). A model-backed *rule* that cannot call its model runs its **symbolic fallback**, which is
  a deterministic body rather than a degraded one.
- **hanging** ⇒ bounded by a timeout, then treated as failing. Never awaited.

**So the design must be defined for four configurations**, {point present or absent} ×
{open present or absent}, and the system must initialise, reason and pass NAL parity in all four.
The consequence worth stating because it is counter-intuitive: **S must be invariant across all
four, while the whole system's derivations may legitimately differ** — the point profile changes
what is admitted and decided, the open profile changes what the rule table contains. A test
demanding identical derivations across configurations would be demanding that the profiles do
nothing. `config:model-matrix` gates the four.

**Where the point profile could earn its place, ordered by what is measurable rather than by what
is imaginable.** None of this is mandated by this plan; the point is that the *capability* is
general and the *placement* is an experiment:

| site | question it would answer | already exists? |
|---|---|---|
| ingress | what is this observation, what task type, is it an injection | **yes** — `KernelPerceptionGate` + System One |
| premise formation | which premises should be paired, given this task | partly — a `PremiseSource` slot exists |
| rule selection | which of the applicable rules to try first | partly — `LMRuleSelector` is exactly this shape |
| contradiction | which of two conflicting beliefs to prefer, and why | no |
| goal handling | is this goal worth decomposing now | partly — drive/decompose strategies exist |
| attention | a bounded priority suggestion, applied **by the owner**, never written directly | no — and it must go through A4's owner |
| consolidation | what is worth keeping, what is worth forgetting | partly — the pressure/consolidation path |
| explanation | explain this derivation, on demand | partly — NL generation |

Three constraints on all of them, from this plan rather than from taste: the answer is **advisory
until a gate admits it**; anything that writes state writes through the owner that A4 establishes,
never directly; and anything in the cycle is bounded by the invariant above. A point profile that
could write `Concept.priority` directly would undo A4, and a point profile in the cycle without a
budget would undo A1.

**Three further consequences of the tier split, and they are the whole design.**

1. **S and the model profiles cannot share a representation.** A symbolic rule is a total function
   from premises to conclusion. A model-backed call is a bounded request whose result may be
   absent. Modelling them uniformly is how you get either an `async` hole in a supposedly
   synchronous engine, or a prompt-shaped wrapper around NAL. They share the *seam* and the *event
   log*, not the type.
2. **Fusion is preserved by sharing derivation context, not by sharing an execution path.** The
   model is told what the symbolic tier concluded — after the fact, or inline if the point profile
   answered within budget. Both are arrangements in which the reasoner stays closed while the
   model sees the reasoning.
3. **Content and rule proposals are different acts** and may not share a queue, an overflow policy
   or an admission path (A3). A content proposal is a task to be admitted; a *rule* proposal
   mutates the table every future derivation depends on. A wrong belief poisons one derivation; a
   wrong rule poisons all of them — that asymmetry is the design, and one `Proposal` interface with
   one overflow policy erases it.

**And the last piece of "ideal" is that every model-backed rule keeps its symbolic body.** That
already exists as `lm/rule-templates/fallbacks.ts`, and it is the most valuable single thing in
the model layer that three passes of this plan had not noticed. It is now load-bearing:
**every model-backed rule declares its fallback, and the fallback is what runs when the model is
absent, over budget, or refused.** A rule with no fallback is not in this architecture, and that
is checkable — one line of the rule schema, and `rule:has-fallback`.

---

## 4. The work

Twelve items (A0–A11). **A0 first and separately** — it is the harness that decides whether the rest
worked. **A1 second, alone** — §1.9 makes it a wiring change, and a one-line test makes it the
cheapest behaviour change available. **A2 immediately after**, because the seam and the
dependency direction are one change and only the first half is testable on its own.

**A10 is the item that makes the rest worth having**, and it is deliberately numbered last: A0–A9
make the existing system closed, bounded, owned and replaceable — a good floor. A10 is what
makes the rule set a loadable, versioned artifact, which is the claim in §0 that nothing else in
this plan delivers. Read the sequence as *"build the floor, then the thing the floor is for"*.

### 4.0 Which finding justifies which item

A workstream picked up cold should be able to see what it is for. This is the trace; an empty
row means the item is either unstarted or unjustified, and both are worth noticing.

| item | v1.3 | findings it closes | deletes (§8) | gate it enables |
|---|---|---|---|---|
| A0 | W0 (reduced) | — makes the rest observable | — | — |
| A1 | W1 | **§1.9**, **§1.10**, §1.8's frozen scalars, and the cause of §1.1's cost | `processLMRulesImpl` from the cycle path; `stepScalars`; the shadowed `resetMetaBudget`; the global `gateRegistry` in the seam | `core:no-provider`; the `processLMRules` column → 0 |
| A2 | W1b | §3.5's properties 1–3 | `enableLMRules`; `lm` from the core config schema | `core:no-lm`; the `deps:gate` row |
| A3 | W1's tail | the seam's undecided semantics | — | the proposal replay fixture |
| A4 | W2 + W3's interface | **§1.1**, **§1.3**, **§1.5**, **§1.6** | `Stamp.createInput()` from getters; the public `priority` setter | `decayAll` call sites == 1; the write-surface test |
| A5 | W4 | enables A4 and A6 to be tested without a NAR | — | — |
| A6 | W6's port | §1.8's inert tie-break, the three empty buckets | the wildcard lookups; `hitStats`, once recorded | rule applications per cycle bounded |
| A7 | W7's semantics | §1.2's per-cycle-caller half | the per-cycle `getGoals` / `getStatistics` calls | budget enforcement tests |
| A8 | W8's contracts | **§1.4** | the `totalTasks === 0` candidate filter | memory-pressure monotonicity |
| A9 | new | makes A3's decisions testable | — | `core:no-lm` hermetic replay |
| A10 | new | **the thesis**: the rule set can only be changed by an import, never by admission | module-side-effect rule registration; the global `RuleRegistry` | `rules:loaded-data` |
| A11 | new | §3.7: the point profile is reachable only from ingress, so "anywhere in the pipeline" is aspirational | the single injection point in `PerceptionGate` | `config:model-matrix` |

**§1.1, §1.4, §1.5, §1.6 and §1.7 are each closed by exactly one item or by TODO30.** If one
is deferred, nothing else covers it. And **A10 is not justified by a finding in §1** — it is
justified by §0's thesis, and §1 has no entry for "the rule set is code" because the obvious way
to find it is to read the plan rather than the tree. It is the only item here whose absence is
invisible from the diagnosis, which is why it carries the risk row in §15 that it does.

### A0 — Reduce the instrumentation baseline

Keep only what is needed to verify architectural changes:

- cycle and phase counters;
- proposal producer count, and proposal application count;
- derivation count;
- deterministic replay identifiers;
- **provider-dependency detection, not provider-presence detection** — and it should be a **trace
  assertion over the spans the kernel already emits**. `instrumentPipeline` already labels all
  eleven micro-tick stages with `cognitive.stage` (`perceive | recall | attend | reason | propose |
  negotiate | authorize | act | validate | learn | consolidate`). Two distinct facts fall out,
  and v2.3 conflated them into one:

  - **`propose` must not be nested inside `reason`.** A proposal is a different act from a
    judgment, and only the former is out-of-cycle. This is structural and it is checkable from a
    recorded trace rather than from a variable.
  - **A `reason` or `perceive` stage may depend on a model, and the trace must say so.** The
    property to assert is that the *cycle completed*, not that the call count was zero (§3.7).
    So the instrument records, per cycle, which stages consulted a provider and how long the
    stage waited — and the budget is on *the wait*, because a wait nobody bounds is the defect.

  The trace lands in the OTel stream a production operator already has, and a count still backs
  the cheap assertion. **What must not come back is a gate on "zero in-cycle calls"**: that
  number is a proxy for the property, and §1.11 shows the proxy passes while a real dependency
  sits in `PerceptionGate`.

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

**Verified by:** `pnpm bench:cycle -- --selftest && pnpm test:hermetic`.
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
3. **The seam takes its gates by injection** (§1.10). Replace the module-global `gateRegistry`
   import with a `GateRegistry` passed at construction, taken from the same place `nar.ts:136`
   takes it, so the budget a producer spends is the budget the NAR owns. Two lines, and it is the
   difference between the seam being usable in a process with two agents and not being.
4. `stepScalars` and the shadowed `resetMetaBudget` are **deleted, not fixed** — with the layer
   out of the cycle the memo has no reason to exist, and the shadowed name at
   `nar-execution.ts:76`/`:116`/`:179`/`:368` becomes deletable rather than resolvable.
5. `cpuThrottleMs` and `callTimeoutMs` lose their reason to exist. Either they go, or they
   become properties of the *offline* pass. Do not leave them bounding a cycle that no longer
   contains the thing they were written for.
6. Overflow policy moves from drop-oldest to the decided policy (A3), in `StreamReasoner`, with
   a test that fills the queue and asserts what survives.
7. **The point profile gets a bound, not a fallback** (§1.11, §3.7). Its optionality is already correct
   — absent ⇒ unjudged path, throws ⇒ fail closed (D1). What is missing is the third case: a
   judge that hangs has no timeout, so `nar.input()` waits forever. Add one, and on expiry take
   the **same** fail-closed path a throw takes. **Do not degrade to unjudged admission on
   timeout** — that bypasses the injection veto, which is the one thing D1 exists to prevent.
8. **Every model-backed rule keeps its symbolic body, and the schema requires it.** `fallbacks.ts`
   exists and `executeLM` already returns `null` on failure, so the path is implemented; nothing
   *requires* it, so a new rule with no fallback would be accepted silently. Make it a
   rule-schema requirement with a test.

**Acceptance, in order of cheapness**

1. **A test that injects a provider that never resolves, calls `run()`, and asserts the cycle
   finishes.** One line. Written failing-first (§10.1).
2. **A cycle completes, and derives the same conclusions, with a judge and a rule backend that
   both never resolve.** This is the test the corrected invariant is built on, and it replaces
   v2.3's assertion of a call count of zero, which forbade the fusion §3.7 is about and would
   have passed while `PerceptionGate` still blocked on a model. The recorded trace must also show
   no `propose`-stage work inside a `reason` stage — that part stands.
3. A producer's `lm-call` budget is charged to the NAR's own `GateRegistry` (§1.10): two NARs in
   one process each see their own `BudgetGate` accounting, and a NAR built with an injected
   registry spends against that registry rather than the process global.
4. A cycle's outcome is identical with and without a producer registered, and identical when
   the producer returns nothing.
5. A proposal that arrives is applied at a declared boundary or not at all — never mid-cycle.
6. A NAR with **zero** proposal producers registered still reasons (§3.5 property 1).
7. There is still exactly one `InferenceController` construction site and one `.step(` call
   site (§7 invariant 11) — A1 adds producer assembly around the cycle, and this is the item
   most likely to introduce a second entry point by accident.
8. **All four configurations are complete systems** — {point, open} profiles each present or
   absent, four runs, each initialising, reasoning, and passing NAL parity (§3.7). What must match
   across the four is the *core's* behaviour, not the derivations.
9. A hung judge is rejected on a timeout, and the rejection is the fail-closed one.
10. NAL parity, `test:determinism` and `test:hermetic` green.

**Verified by:** `pnpm run core:no-provider` (new), `pnpm test:determinism`, and the NAL suites.
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
- **The contracts live in `@senars/core/schemas/proposal`, with a dependency floor of `util`.**
  Not "somewhere in `nar/src`, policed by a gate row". Two precedents are already in the tree
  and this is the second use of the first one: `core/verify-derivation` exists precisely so that
  "a verifier bug cannot hide behind an engine bug", and README documents that independence as
  *measured rather than asserted*; and the induction layer **already imports from
  `@senars/core/schemas`** (`lm/system-one/types.ts:2` imports `ReasoningBudget` and
  `SourceQuality`), so both sides of the seam have a working, precedented place to meet that the
  package graph already permits. The boundary then stops being a lint rule and becomes a
  structural fact: `core` imports `util` and its own schemas, `nar` imports `core`, and a
  provider that reaches into `nar` internals breaks the build.
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
- **`enableLMRules` disappears from the public surface** — and the public surface is bigger than
  one flag. This item has a documented blast radius, and finding it by `typecheck` is a waste of
  a day:

  | surface | where | consequence |
  |---|---|---|
  | `NARConfig.enableLMRules` | `facade/config.ts`, `README.md` config block, `docs/api/nar.md` | removed, docs regenerated |
  | the `lm` config category | `config/cognitive-parameters.ts` (`maxRulesPerCycle`, `callTimeoutMs`) | moves out of `CognitiveParameters` into plugin config |
  | the four presets | `DEFAULT_` / `FAST_` / `LM_HEAVY_` / `RESEARCH_COGNITIVE_CONFIG` | `FAST_COGNITIVE_CONFIG` and `LM_HEAVY_CONFIG` exist *because* of the layer; they leave or narrow |
  | the strategy slots | `cognitive/registrations.ts` + README's five-category table | `LMRuleSelector` ceases to be a cycle strategy; the registry and the README table change together |
  | the export index | `README.md`'s "Complete API Export" block | `LMRule`, `LMRuleFactory`, `lmCommands` move to the plugin side |

  `docs:drift` is a gate, so a stale doc is a red gate rather than a footnote — but every row
  above is a place the change can *break* rather than merely mislead, and the last two are the
  ones a reader of the README will notice first.

**Acceptance**

1. `deps:gate` gains a row: `nar` core may not import `nar/src/lm/`. One line in a ledger, and
   it is the only enforcement a well-meaning import cannot cross.
1a. The seam contracts are in `@senars/core/schemas`, and `core`'s import list still contains
   only `util` and its own schemas — the floor `verify-derivation` already holds.
2. A no-provider NAR reasons, green with the layer's directory removed from the build graph.
3. NAL parity green with no producer registered.
4. `enableLMRules` is gone — replaced by absence, because a flag on an always-constructed
   component is a comment (§10.1).
5. No provider implementation can reach private core state, and no layer-typed value appears in
   a core extension contract.
6. `README.md`, `docs/api/nar.md` and the export index no longer advertise `enableLMRules` or a
   `lm` config block; `pnpm docs:drift` is green. Every row of the blast-radius table above is
   either changed or consciously left, in the same commit.

**Verified by:** `pnpm run core:no-lm` (new), `pnpm run deps:gate`, `pnpm run docs:drift`.
**Risk: medium-high — a large mechanical diff (39 files).** That is the price of a boundary
that cannot be crossed by accident, and the mitigation is that it is mechanical: a dependency
inversion with no semantic content, reviewable by the compiler rather than by reading.

**Settled in v2.1: no seventh package, for the contracts.** Moving `Proposal` /
`ProposalSource` to `@senars/core/schemas` (§ above) makes the boundary structural for the
thing that matters, at the price of one directory. A seventh package would additionally force
everything the layer *reads* — concepts, memory statistics, derivation chains — to be public
API, which is a much larger change to a much larger surface, and the layer would then not be
able to read the internals it currently reads without a second round of work. If the layer ever
needs to be genuinely un-buildable, that is a later question with a later answer; §12 Q8 keeps
it open for exactly that, and the seam-first sequencing means nothing about it is foreclosed.

### A3 — Specify the proposal lifecycle

*This is the one area the plan expands rather than contracts, because it is the boundary the
whole plan exists to make real, and prose is not a protocol.*

**There are two kinds of proposal and v2.0–v2.3 wrote one protocol for both, which was wrong.**
§3.7's tiers make the difference load-bearing: a *content* proposal is a task to be admitted, and
a *rule* proposal mutates the table every future derivation depends on. They differ in frequency,
in trust, in what dropping one costs, and in what "reversible" means — so they may not share a
queue, an overflow policy, or an admission path.

| | **content proposal** | **rule proposal** |
|---|---|---|
| payload | a formalized term / provisional belief / goal / abstraction | a reaction: pattern + truth function + priority |
| frequency | continuous, driven by ingress and derivation | rare, and deliberate |
| trust | untrusted, admitted through `PerceptionGate` at the source-quality ceiling | untrusted, and must clear the rule schema |
| cost of dropping one | low — the next derivation produces another | high — it *is* the learned capability |
| overflow | drop-oldest is acceptable; the context is regenerable | **never silently dropped**; overflow must be reported |
| reversibility | n/a — a task's provenance is its admission event | must be revertable, and the version recorded (A10) |
| where it lands | memory, via a gate | the rule table, behind `InferenceTable` (A6/A10) |

**One queue with one policy for both is the specific mistake to avoid**, and it is the mistake a
single `Proposal` interface invites. The type system should make the distinction, not a field.

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
| overflow (content) | drop-oldest, twice (`pushCapped`, `trimCapped`) | acceptable for regenerable context; say so explicitly so it is a decision rather than an accident |
| overflow (rule) | **nothing exists** | a rule proposal must never be dropped silently — a bounded queue with an explicit refusal event, and a refusal the operator can see |
| backpressure | defer above `highPressure`; refuse when `BudgetGate` denies `lm-call`, re-queueing the batch at the head and trimming the tail | what happens to a *denied* batch — retry, drop, or convert to a recorded rejection event; and does a denial emit a `TerminationReason`? |
| provisionality | `provisionalConfidence` 0.3, revised by `Truth.revision` on settle | whether a content proposal is a *truth claim* at all (it should be a claim about a term, judged at admission — not a direct write) |
| staleness | none — `ProvisionalBelief` carries no revision | the rule in the box below |
| **symbolic fallback** | exists per rule (`lm/rule-templates/fallbacks.ts`) but is not required by anything | it becomes a schema requirement: no P-tier rule registers without one, and the fallback is what runs when the provider is absent (§3.7, `rule:has-fallback`) |

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
- the content/rule distinction is in the *type*, and a rule proposal cannot be routed down the
  content path — with a test that tries;
- every registered P-tier rule has a symbolic fallback that runs with no provider present;
- a recorded proposal stream replays deterministically against a recorded core state, through
  the same seam (A9);
- a test fills the queue past capacity and asserts the chosen overflow policy, including what
  happens to a denied batch;
- a test applies a proposal whose `baseRevision` is stale and asserts rejection rather than
  silent application;
- a test applies a proposal referencing an evicted concept and asserts rejection.

**Verified by:** `pnpm test:unit` (the new seam tests) and `pnpm run core:no-provider`.

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
- **Make the invariant a type before making it a rule.** `Concept.priority`'s public setter is
  the root of §1.6: sixteen sites compile against it, so "one owner" can only be policed by a
  review or a grep. The fix is representational, and it is the repository's own stated
  philosophy — *"TypeScript enforces internal representational invariants at compile-time"*:
  `priority` becomes a read-only getter, and mutation moves behind an internal writer that only
  the attention owner holds. A new writer then fails to compile rather than failing a gate, and
  the write-surface test becomes a *backstop* instead of the primary mechanism. README's
  "Branded Types" and discriminated-union rows are the same idea applied to other fields.
- The ten external `priority` writers become a small set of named operations. The suggested
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

- `Concept.priority` has no public setter, and the only module that can write it is the
  attention owner's — asserted by the compiler, with a test enumerating the surface as a
  backstop;
- `decayAll` has exactly one call site, and `maxSampledConcepts` appears in no decay
  measurement;
- reading a concept twice without an intervening write returns the same identity and the same
  stamp;
- the attention and clock implementations are replaceable without changing any caller;
- the RL/parity baselines are re-established **here, once**, and committed in the same change.

**Verified by:** `pnpm test:unit` plus the committed baseline (the artefacts are the evidence,
so this item's command is the unit suite and a diff on the baseline file).
**Risk: high, and confined to this item.** Every learned value moves, which is why it is alone,
why it lands **after** A5 (§6), and why the baselines are regenerated here rather than left to
drift through A6–A8. Everything after it must hold them stable.

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

**This item lands before A4, and the reason is attribution, not risk.** A4 is the plan's one
deliberate behaviour change and A5 is its largest mechanical diff; doing them in one window
makes the behavioural delta unattributable, because every learned value moves *and* every call
site moves. Splitting the 646 lines first costs nothing — it is mechanical and parity-guarded —
and leaves A4 as a small diff against a structure that is already final, with its RL baselines
measured on the shape that will ship. The old "either order works, land A5 first if test time is
binding" hedge is replaced by that rule.

**Acceptance**

- cycle code depends on ports, not on `Memory`;
- storage details do not leak into reasoning code;
- each port has focused unit tests that construct it directly;
- existing semantic tests still cover the current behaviour through the ports;
- the port contracts mention no concrete type, so an implementation can be swapped without
  touching a caller.

**Verified by:** `pnpm test:unit` — parity is the only gate, because this item changes nothing.
**Risk: low.** Mechanical, and the boundary is already implied by `MemoryView`.

### A6 — Define inference dispatch as an architectural port

```text
InferenceTable
  lookup(antecedentKind, consequentKind)
  dispatch(...)
```

Three decisions, and none of them is "make it faster". Two of the three are already made by
measurement (§1.8), which is the point of recording them:

- the rule representation and the dispatch implementation become separate, so a replacement
  costs one file;
- **`*:*` goes, and it is safe to say so**: zero of 55 registered rules use a wildcard bucket,
  so the three wildcard lookups are dead work on the innermost path. Make `createRulePattern`'s
  two parameters required — the type already forbids wildcards for DSL rules — delete the three
  lookups, and keep the census as the test that fails when a rule arrives without a kind pair.
  The durable invariant is *"a rule declares its kinds or it does not register"*, which is a
  better contract than "there is a catch-all";
- the `RuleIndex` tie-break (§1.8) is either exercised by a test — `recordRuleHit` is called
  and the field has data — or deleted. It is currently a comparator that orders nothing, wearing
  a comment that explains why it orders nothing. This is the one decision left, and it is a
  semantic one about rule priority, not a structural one.

**Do not** require tries, DAGs, decision trees, or generated code here. TODO30 §6 chooses among
them from a measured workload.

**Acceptance**

- inference code depends on the dispatch interface;
- `createRulePattern` requires both kinds, and a test fails if any registered rule sits under a
  wildcard key — the census, as a gate;
- the tie-break is either specified-and-tested or gone;
- NAL parity green;
- existing rule-ordering behaviour is either explicitly preserved or explicitly recorded as a
  semantic change, with the NAL suites as the gate;
- any cache keyed on rule ordering invalidates on the state its ordering depended on — the
  shape `RuleIndex.ordered` already gets right with `rankingEpoch`, and the shape `stepScalars`
  gets wrong.

**Verified by:** `pnpm test:unit` (NAL suites plus the new dispatch tests).
**Risk: medium.** This touches inference semantics, so parity is the gate and must not move.

### A7 — Define control budgets as semantics

**Use the budget system the kernel already has.** `ReasoningBudget` is a schema in
`@senars/core/schemas/reasoning-budget`; `KernelBudgetGate` accounts it per-focus by `scopeId`
and already names its failure modes — `cycle-budget`, `depth-budget`, `llm-budget`, `deadline`,
`backpressure` — as a `TerminationReason` enum. A second budget concept would be a second
accounting of the same resource, and the two would drift, which is the defect class this plan
exists to remove. So the four bounds below are **`ReasoningBudget` scopes with named
`scopeId`s**, not a new mechanism:

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

- every budget is a `ReasoningBudget` scope with a named owner, a default, a configuration
  source, a `TerminationReason` for overflow, and a test demonstrating enforcement;
- the shadowed `resetMetaBudget` name is gone from one of the two places it exists;
- the per-cycle `getGoals` / `getStatistics` callers are budgeted or removed, and the decision
  is recorded;
- `proposal-application` is a budget scope with the overflow behaviour A3 decides, so a queue
  that is full and a budget that is spent are the same kind of event with the same kind of
  reason.

**Verified by:** `pnpm test:unit` (the new budget-enforcement tests).
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
- the ledger covers every site the accumulator gate declares as cycle-path;
- `capacityPressure()` and the policy it names are the same quantity, asserted by a test rather
  than by a comment — §1.4 is a disagreement between a signal and a policy, and it survived
  because nothing compared them.

**Verified by:** `pnpm test:unit` (the resource-policy tests).
**Risk: medium.** Retention policy is behaviour; changing policy and structure together is how
a semantic change hides inside a refactor, so the policy lands here — after A5 and A4, on a
structure that has stopped moving — and the structure lands in TODO30 §7.

### A9 — Deterministic replay

**A proposal is a `CognitiveEvent`, and the fixture is the event log the kernel already keeps.**
The repository is event-sourced — README: "the event log is the cryptographic source of truth",
with `SqliteEventLog` / `InMemoryEventLog` and pure reducers (`kernel/replay.ts`,
`replayCognitiveState`, `EventLogPersistence.ts`). A proposal *is* an untrusted write attempt,
so inventing a parallel fixture format would be the same mistake as inventing a parallel budget
system in A7: a second representation of state that can disagree with the first. A9 therefore
extends the existing reducer with `proposal.*` event kinds and nothing else, and a hermetic run
is

```text
core state
+ recorded proposal events
+ configuration
+ deterministic inputs
```

with no live provider involved.

Schema/version mismatches must fail explicitly rather than silently replaying against
incompatible state — and the proposal schema is the *first* thing in this repository that a
recorded fixture from a future commit would silently mis-apply.

**Acceptance**

- a live provider is unnecessary for the hermetic tier;
- `replayCognitiveState` reconstructs the same state from an event log containing
  `proposal.*` events, and the reduction is a pure function of the log;
- a recorded proposal stream replays identically, twice;
- an incompatible proposal version fails loudly, with a test that asserts the failure;
- a proposal stream recorded against revision *R* is rejected against *R+1*.

**Verified by:** `pnpm test:hermetic` — which is the tier this item exists to make possible.

### A10 — The rule path: the reaction table is admitted data, not an import side effect

*This is the item that carries the thesis, and v2.3 recalibrated it after the author of NARchy
pointed out that selecting a ruleset at startup is something NARchy already does. The novel part
is not **loading** the table; it is **admitting a rule into a running system**, through gates,
recorded and revertable. Everything else in §4 makes the existing system well-bounded. This is
the one that makes the rule set grow while the system runs. It is numbered last because it is the
largest change here, not because it is the least important.*

Today `rules/impls/registration.ts` assembles the 55 NAL and extended-NAL rules and registers
them on a global `RuleRegistry` **as a module side effect** — importing the module changes the
rule set. Three consequences, and they compound:

1. **The rule set cannot be loaded, versioned, swapped or rolled back.** It is code, and it is
   whatever the import graph happened to contain. A schema migration has no meaning for it.
   (Startup *selection* of rulesets is what NARchy does instead, and it is strictly less than
   this: you choose from what was written, at boot, and nothing learns.)
2. **A proposal can carry a perfectly well-formed new reaction and there is no path by which it
   becomes one.** A3 delivers bytes to a door with nothing on the other side. Until this item
   lands, "the rule set is a learnable, versioned artifact" is a claim about a transport.
3. **It is the same hidden-global defect A1 fixes for the gate registry**, in the place where it
   is most consequential: a global mutated by an import, which no test can distinguish from a
   global mutated by a caller.

- **Registration moves behind the `InferenceTable` port** (A6). No module other than the port's
  implementation may mutate the rule set, and the port can enumerate it.
- **The built-in table becomes a versioned artifact** with a schema version, loaded through the
  seam: validated, recorded, revertable. `README.md`'s rule matrix is then *generated* from it
  rather than transcribed, which closes the second hand-maintained source of truth named in
  §14.3.
- **This is the rule-proposal path of A3, and only that path.** A content proposal (§3.7, J and P
  content) lands in memory through `PerceptionGate` and needs none of this. A *rule* proposal is
  the only thing in the system that changes what every future derivation can conclude, which is
  why it is the only thing that gets versioning, a schema, a refusal event on overflow, and a
  revert. The asymmetry is the design: a wrong belief poisons one derivation, a wrong rule poisons
  all of them.
- **Absence becomes a value.** "No table loaded" is a state the core runs in — the same
  "absent, not disabled" property §3.5 demands of the induction layer, applied to the rules. A
  NAR with an empty table initialises, runs cycles and reports zero derivations; it does not
  fall over, and it does not silently reach the NAL rules through some other import.
- **Learned rules are revertable.** A seam whose outputs cannot be undone is a deployment, not an
  artifact, and the whole claim in §3.4 is that inducer output is reviewable like a schema
  migration. This is the specific thing A10 has that startup selection does not: *roll the rule
  set back* is an operation, not a restart.
- **A rule may not change the rule set mid-cycle.** That is A3's boundary rule, and it is why
  this item follows A3 rather than preceding it.

**Acceptance**

- deleting the registration import leaves a core with an empty rule table that still
  initialises, runs a cycle, and reports zero derivations — absence, not a crash;
- a rule added at runtime through the seam appears in dispatch, is in the event log, and can be
  reverted;
- a table artifact with an incompatible schema version fails loudly at load, and a recorded
  artifact replays identically;
- the loaded table and the code-registered table produce **identical derivations** on the NAL
  suites — this item adds a capability, and parity is how you prove it added one without
  changing anything else;
- the table is enumerable at runtime: ids, kinds, and the artifact version.

**Verified by:** `pnpm run rules:loaded-data` (new), `pnpm test:unit`.
**Risk: medium-high, and the only item in this plan that changes what the system can do rather
than how it is arranged.** It is last in the sequence for that reason. If it is deferred, say so
explicitly in §15 and stop describing the rule set as an artifact in the meantime — and note
that a deferred A10 leaves SeNARS where NARchy already is, which is a perfectly good system and
not the one this document is about.

---

### A11 — The point profile is a port the whole pipeline may consult

*Small, and it is what makes §3.7's central claim true rather than aspirational. It follows A1,
because the port is only safe once every call through it is bounded.*

The correction in §3.7 is that the point profile is **not** a gate on the open profile: it is a
first-class reasoning participant, usable anywhere a decision could be improved, and it can
produce derivations. Today the only such capability is reachable from one place — the ingress
judge injected into `PerceptionGate` — so "anywhere in the pipeline" is currently "at ingress,
and only there".

- The core declares **one optional port** for model reasoning, with a fast/point call and an
  open call, alongside the proposal contract A2 places in `@senars/core/schemas`. One capability,
  two profiles, one boundary — not two subsystems.
- Every stage that could use a fast answer takes the port **injected and optional**: premise
  formation, rule selection, contradiction adjudication, goal handling, attention, consolidation,
  explanation. A stage with no port configured behaves exactly as it does now, and that is the
  four-configuration matrix in miniature, per stage.
- **The port is advisory.** An answer never writes state directly: it is admitted through a gate,
  applied by the owner A4 establishes, or used as a selection. A port reachable from every stage
  that can also write is the shape of the bug this whole plan is about, so the port's return type
  is a decision, not an effect.
- **Every call site declares its budget and its position** — cycle-path or boundary — because the
  invariant is enforced per call site, not globally.

**Acceptance**

- a stage that has the port injected and a point profile configured can use it, and a stage without
  one is byte-identical to today;
- the port is unreachable from any write path without going through a gate (a test, not a review);
- a point-profile call that returns a *conclusion* is admitted as a derivation, and the NAL
  suites still pass with the profile configured;
- every call site is in a declared list with its budget and its position, and a new one fails
  `config:model-matrix`;
- a stage that is given a point profile and a hanging backend still completes.

**Verified by:** `pnpm run config:model-matrix` (new), `pnpm test:unit`.
**Risk: medium, and it is the item that can spread.** A capability available everywhere is exactly
as safe as the constraint on each call site, so this item's acceptance is mostly *declarations* —
and a declaration that is not gated is a comment. It is deliberately after A1 and after A2: the
port's contract is known only once the seam exists, and it is only safe once calls are bounded.

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
- **A rule set that is an artifact (A10).** Loaded, versioned, enumerable, revertable — so the
  difference from a NAR-shaped reasoner is not a claim about the transport but a property of
  the system, and so "roll back the rules" is an operation rather than a revert.
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
A0 ─▶ A1 ─▶ A2 ─▶ A3 ─▶ A5 ─▶ A4 ─┬─▶ A6 ─▶ A10 ─▶ A11
                              └─▶ A7 ─▶ A8
                    A9 (after A3, parallel thereafter)
```

**The ordering rule that replaces v2.0's "either order works": structural before behavioural.**
A5, A2 and A6 are mechanical — they move code and change no derived value. A1, A4 and A8 change
what the system concludes or how fast it forgets. Pairing a mechanical item with a behavioural
one in the same window is what makes a behaviour delta unattributable, and this plan has
exactly one attribution to protect: A4's RL and parity baselines, which every later item must
hold stable. So the mechanical split lands first, and each behavioural item is measured on the
final structure.

- **A0** alone, first. Everything else is judged against it.
- **A1** alone, second, and alone for the same reason as A4: a behaviour change that must be
  independently reviewable. Its acceptance is three short tests — a hanging provider, a zero-
  producer NAR, and a trace with no `propose` inside `reason`.
- **A2** immediately after A1, and A3 immediately after A2: the boundary is cheapest while the
  seam is fresh, and A3's decisions are cheaper once the queue's real behaviour (§1.9) is known
  rather than assumed.
- **A5** before A4, for the attribution reason above, and because it is what makes A4 and A6
  testable in milliseconds rather than through a NAR. Nothing blocks A5 after A3.
- **A4** alone, on the split structure, with the RL/parity baselines re-established and
  committed in the same change.
- **A6** after A4 — it changes dispatch order, so it must be measured against A4's baselines.
- **A7 and A8** depend on A0 only and can be interleaved; A8 is the third and last behavioural
  item, so it is measured on a structure that has already stopped moving.
- **A9** lands once A3 has decisions worth replaying, and is orthogonal to the rest.
- **A10** follows A6, because it needs the dispatch port it registers through, and A3, because a
  rule must not enter the table mid-cycle. It is the last structural item and the most valuable
  one; if the sequence has to be cut short, cutting here costs the floor and keeping it costs the
  thesis.
- **A11** last of all. A capability available everywhere is only as safe as each call site, so it
  lands after the port's contract exists (A2) and after calls are bounded (A1) — and its
  acceptance is mostly *declarations*, which are worthless ungated.

**A formal handoff to TODO30** follows A2 + A3: at that point the architecture is what the rest
of the plan is measured through, and TODO30 §1 requires a fresh profile before it orders
anything. TODO29 does not carry a performance ordering forward, because its own §1.12 says the
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
5. **Each cycle-path quantity has one owner, and the type says so.** For `priority` this is
   representational — no public setter, writes confined to the attention owner's module (A4) —
   because an invariant that can only be enforced by review is not one. For everything else it
   is enumerable, and a test enumerates it.
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
11. **One inference path, many producers.** `InferenceController` is constructed in exactly one
    place (`cognitive/impls/CognitiveController.ts:167`) and `step` is called in exactly one
    place (`nar-execution.ts:234`) — checked, not assumed, because `runStream` used to have a
    second one and it was found by reading rather than by a test. A1 adds producer assembly
    around the cycle, which is the moment that invariant is most likely to be broken, so it
    becomes a gate: producers are many, cycles begin in one place.
12. **One budget system.** Budgets are `ReasoningBudget` scopes accounted by `KernelBudgetGate`
    (A7). A second accounting of the same resource is a defect, and every one of them is
    eventually wrong in a different direction.
13. **The seam reaches state only through gates it was given.** A `StreamReasoner` receives its
    `GateRegistry` by injection (§1.10) and holds no module-global. This is the general form of
    §3.1's "no hidden global state", and the reason it is an invariant rather than a note is
    that the only production consumer of the budget gate today violates it.
14. **Both model profiles are optional, and both fail closed** (§3.7). The model may not be
    provided: the point and open profiles are each absent-able, and the system is a complete
    reasoner in all four configurations. *Failing* is not *degrading* — an answer that cannot be
    obtained is refused rather than assumed, and a model-backed rule that cannot call its model
    runs its symbolic fallback. The one thing a model may never do is **hang**: every call is
    timeout-bounded, and a timeout is handled as a failure. And the point profile is a *reasoning
    participant*, not a gate on the open profile: it may be consulted anywhere in the pipeline and
    it may produce derivations.
15. **The rule set is loaded data, never an import side effect** (A10). No module outside the
    `InferenceTable` port's implementation may register a rule, the table carries a schema
    version, it is enumerable at runtime, and its entries are revertable. **This is the invariant
    the thesis rests on**: while registration is a side effect of an import, the rule set is
    code, and "the rule set is a learnable, versioned artifact" is a claim about a message
    format rather than about the system. It is also the second instance of §3.1's
    no-hidden-globals clause, after the gate registry.

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
- The public `Concept.priority` setter itself, not just its external uses: the invariant is
  enforced by the type, not by ten call sites (A4).
- `Memory.sample` and `Memory.sampleWindow`, or their `decayAll` side effects (A4).
- `Concept.linkedConcepts` / `subConcepts` / `parentConcepts`, and with them
  `SpreadingActivation.prime`, `Concept.updateLinks`, `findOrphanedLinks` — unless A4 populates
  them (A4).
- The three wildcard lookups in `RuleIndex.candidatesFor` — `*:right`, `left:*`, `*:*` — and
  `createRulePattern`'s optional parameters. Measured safe: zero of 55 registered rules use a
  wildcard bucket (A6, §1.8).
- `RuleIndex.hitStats` with its tie-break, unless A6 makes them real.
- The `totalTasks === 0` candidate filter in `evictUnderPressure` (A8).
- The per-cycle `getGoals()` / `getStatistics()` calls from the summary and meta-goal steps,
  or their budgets (A7).
- **Module-side-effect rule registration** (A10): importing a module no longer changes the rule
  set. This is the only deletion in this list that removes a *convenience* — the ability to
  import a file and have the system's behaviour change as a side effect — and it is worth doing
  anyway, because that convenience is why the rule set cannot be versioned.

---

## 9. Not doing

- **The induction layer's internals are not a target.** 15 226 lines, 25% of `nar/src`, the
  largest directory in the tree. A1 changes *where it is called from*; A2 changes *which way
  the dependency points*. Neither restyles it, and the rule templates and adapters are real
  work that stays. Making the layer itself fast or better is a separate plan — and the right
  time to ask is after A1, when its cost is no longer hidden inside a cycle.
- **Not the capability thesis.** System One, the Judgment Manifold, governance, the game/RL
  loop and the `lm/` internals are out of scope, and so is any claim about SeNARS being better
  at anything. **This plan is substrate**: A0–A9 make the core closed, bounded, owned and
  replaceable, and A10 makes the rule set learnable. Whether that is worth more than a
  NAR-shaped reasoner is §12 Q3's experiment, and this plan does not schedule it — it sequences
  it last. Read this plan as the floor, not as the claim.
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
- **No new abstraction where one already exists.** Three times in this plan the cheapest
  implementation was a mechanism the repository had already built: the kernel's gates (§3.4),
  `ReasoningBudget` (A7), and the event log with `replayCognitiveState` (A9). If a proposal
  needs a queue, a budget, a replay fixture or a gate decision, the answer is to use the one
  that is there; a parallel mechanism is a second source of truth about the same fact, and this
  repository has spent four passes removing exactly those.
- **UI untouched**, and the System One manifold's heads, calibration and distillation loop are
  untouched. A2 moves *where* System One's adapter is constructed, not what it judges.

---

## 10. Gates

New, and wired into `pnpm gates` (`scripts/lib/gates.ts`), so they run in the same command as
everything else. **The rule for this section is that a gate lands with the item that needs it,
not after** — `scripts/lib/gates.ts` has a comment recording that a gate present only in `ci.yml`
was red for a whole pass of TODO28 without anyone noticing, because the way these are run by
hand is `typecheck && lint && test:unit`. A gate listed here and not wired is the exact failure
mode this plan is about.

| gate | asserts | lands with | tier |
|---|---|---|---|
| `core:no-provider` | a cycle completes with a provider registered whose backend never resolves | A1 | `gate` |
| `cycle:no-provider` | a cycle completes and derives identically with a judge and a rule backend that never resolve, **and** no `propose`-stage work appears inside a `reason` stage in a recorded trace. **Dependency, not presence** (§3.7) | A0 + A1 | `gate` |
| `rule:has-fallback` | every registered P-tier rule declares its symbolic fallback, and the fallback is what runs when the model call fails | A1 | `gate` |
| `config:model-matrix` | all four of {point present/absent} × {open present/absent} initialise, reason, and pass NAL parity; a hung point-profile call is rejected on a timeout rather than awaited | A1 | `gate` |
| `core:no-lm` | NAL suites plus a reasoning episode with **zero** producers, with the layer removed from the build graph | A2 | `gate` |
| `deps:gate` +1 row | `nar` core may not import the layer's directory; `core` imports only `util` and its own schemas | A2 | `gate` |
| `gates:one-cycle-path` | exactly one `InferenceController` construction site and one `.step(` call site (§7 invariant 11) | A1 | `gate` |
| `attention:write-surface` | every `Concept.priority` write is inside the attention owner's module; a new one fails | A4 | `gate` |
| `dispatch:no-wildcard` | no registered rule sits under a wildcard bucket | A6 | `gate` |
| `resource:policy` | every production accumulator is in the ledger, and a memory at capacity with nothing evictable says so | A8 | `gate` |
| `replay:proposal` | `replayCognitiveState` reconstructs the same state from `proposal.*` events, and a version mismatch fails loudly | A9 | `slow` |
| `rules:loaded-data` | no module-side-effect rule registration survives; the table is enumerable, versioned, revertable, and an empty table is a runnable state | A10 | `gate` |
| `induction:inventory` | every behaviour the induction layer currently performs inside a cycle is declared with a disposition — `boundary` / `synchronous` / `dropped` — and an item left unaccounted for fails | A0 + A1 | `gate` |

**Verified by:** `pnpm gates`.

Deliberately **not** here, and in TODO30: `cost:cycle`, the population-scaling matrix, and the
`bench:cycle` entry in the gate list. They belong to the plan that has a cost model to enforce.
Note what that means for §4: **no item in this plan is verified by a number of milliseconds**,
and an item that needs one is an item that belongs to TODO30.

### 10.1 The intent-to-gate ledger

The pattern that produced §1.8 and most of §1 is not specific to the induction layer, and it
generalises: **an architectural intent lives in a doc comment, and nothing in the build can
tell you when the code stops implementing it.** Three of the rows below are in that state today,
and one of them is now a *class* with no caller, which is a new and sharper version of the same
failure.

| architectural intent | where it is stated | mechanical? | what makes it so |
|---|---|---|---|
| The Stream Reasoner — async inducer, sync reasoner | §3.4, and `nar/src/stream/reasoner.ts` | **no** — the class is bounded and gated and has one caller, a test | A1: a cycle completes with both a judge and a rule backend hanging; a trace shows no `propose` inside `reason` |
| The cycle never *depends* on a model | §3.7, and nothing anywhere — the old claim was "no model in the cycle", which is a proxy | **no** — `PerceptionGate:118,154` awaits one with no timeout, though absence and throw *are* handled | A1: the hanging-provider test, plus `rule:has-fallback` |
| The seam spends the *NAR's* budget, not a process global | §3.4 says "through the gates"; `stream/reasoner.ts:2` imports the global | **no** — TODO19 shipped the factory and the bench; the seam does not use it | A1: two NARs in one process see their own accounting |
| There is one inference path | nowhere; it held until `runStream` had a second one | **no** | A1: `gates:one-cycle-path` |
| The layer is optional; the core is a reasoner | nowhere in docs; **39** core files import it | **no** | A2: a `deps:gate` row, and a no-provider NAR that reasons |
| Decay has one owner, on one cadence | nowhere | **no** — 8 calls per cycle from 3 sites | A4: count `decayAll` call sites |
| Attention has one owner | nowhere; 10 external writers | **no** | A4: an enumerated write surface |
| Reads do not change reasoning state | nowhere; a getter mints stamps | **no** | A4: identity and stamp stability |
| Every bounded container is bounded | `scripts/lib/accumulator-ledger.ts` | **partly** — a *string* check over 2 of 42 sites | A8: gate the declaration, failing test first |
| Attention has one owner, at the type level | nowhere; 10 external writers against a public setter | **no** | A4: no public setter, plus `attention:write-surface` |
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
| the seam spends against the process-global `gateRegistry` | — | 2026-09-30 | `919c21ab` | `stream/reasoner.ts:2` vs `GateRegistry.ts:117,120` | none |
| rule registration census | 55 rules, 0 wildcard buckets, 21 `inheritance:inheritance` | 2026-09-30 | `919c21ab` | `RuleRegistry.getAll()` after importing `rules/impls/registration.js` (§1.8) | none |
| exactly one `InferenceController.step` call site | 1 | 2026-09-30 | `919c21ab` | `grep '\.step('` | none |
| profile shares | moved to TODO30 §1 | 2026-09-30 | `d542d5ee` | `node --cpu-prof` | **yes** — take the min |
| `nar/src` size | 60 757 lines / 513 files / 47 dirs | 2026-09-30 | `919c21ab` | `find nar/src -name '*.ts'` | none |
| NARchy reference | — | 2026-08-25 | `narchy@narchy` @ `f3a9bcc` | see below | none |

Two rules this table exists to enforce. **A number with no commit in it is not evidence** — and
applying that rule to v1.3 found four stale numbers, corrected at the top of this document. And
**the load-sensitive rows are the ones that will lie to you**: the profile and the wall-clock
rows were all measured on a machine that was carrying someone else's load at some point, which
is why they moved to a plan whose first step is re-measuring.

Three provenance classes, because conflating them is how a plan ends up citing a filename as if
it were a design decision.

**Read and quoted from NARchy:** `nars/memory/Memory.java` (the 123-line port and its six
abstract methods), `nars/focus/util/PriTree.java` (the priority DAG and its `commit`),
`nars/Focus.java` (`commit` / `_commit` / `commitTime` and the duration-derived cadence), plus
the module tree.

**Stated by NARchy's author, and now load-bearing** (v2.3, after this document cited filenames
as evidence three times over):

- *what the reaction "compilers" build* — a **predicate trie that winnows the applicable rules
  for a given premise, still interpreted**; deeper bytecode compilation was available in the
  design space and deliberately not taken;
- *the rule set's mutability* — **selectable at runtime startup by enabling chosen rulesets**,
  with fully dynamic online recompile available and never necessary;
- *the lineage and the module shape* — NARchy is derived from OpenNARS and modifies it
  substantially, and the repository is a monorepo of `jcog` (foundation data structures) /
  `narchy` (reasoner) / `spacegraph` (UI), so the structures NARchy reasons with live in a
  **different module** from the reasoning.

**Inferred from the tree listing, not read, and not author-stated:** the eight `Memory`
implementations' individual behaviour; the `table/` belief-table hierarchy; `control/exec/*`;
`TaskAttention`'s sampling; term interning. None of these is load-bearing.

**What v2.3 retired:** the claim that NARchy *precompiles* inference, which three passes carried
as "inferred from filenames, not read" while treating it as this document's weakest load-bearing
claim. It was wrong in the direction that matters — not compiled, but **winnowed** — and it is now
author-stated rather than filename-guessed. **A remaining obligation:** the winnowing claim is
still not read from source. It is the strongest evidence available short of reading it, and
TODO30 §6 is scoped so that nothing depends on the difference: its first measurement is the
candidate count after winnowing, which holds true whichever way the question goes.

---

## 12. Open questions for the next session

Ordered by how much they change the plan. The first two should be answered *before* A0, because
each can invalidate work that has not started.

**Q1. ~~Is the induction layer an episodic learner or an online learner?~~ — retired in v2.3.
It was my framing, not the system's, and it does not survive contact with the author.**

Asked "which is it", the answer was that the distinction does not mean anything here: there is
no intended *mode* to declare, and the system was not built around one. That is worth recording
plainly, because three passes of this document treated the question as load-bearing and it was
carrying an imported literature framing rather than a fact about the code. A question whose
answer is "the distinction is not meaningful" was never the question.

The real question is enumerable, and A1 has to answer it regardless of what anyone calls the
system:

> **Which behaviours currently happen *inside a cycle* because of the induction layer, and what
> happens to each of them once the cycle is closed?**

That is a migration inventory, not a philosophical stance, and it is answerable by reading the
code:

1. **Enumerate the behaviour**, not the call sites. The candidates are already visible: LM rule
   application per rule pair (`processor.ts:207-223`, `DefaultDerivation.ts:26,30`); the goal
   context that path builds (`processor.ts:393`); the frozen `stepScalars` context; bidirectional
   feedback; proactive enrichment; NL understanding on input; System One's `proposeAndJudge`;
   the dialogue capture path. For each: *what does it contribute, and who would notice its
   absence?*
2. **Give each a disposition**, declared as data the way `scripts/lib/accumulator-ledger.ts`
   does: **moves to a declared boundary** (the common case — a proposal over a derivation becomes
   a proposal from the boundary), **stays synchronous because it is not induction** (input
   parsing, System One judging untrusted input before admission — that is gating, not
   learning, and it belongs *inside* the cycle by design), or **dropped** (and then said out
   loud, because dropping a capability is a decision with a name).
3. **Gate it**: after A1, no item on the inventory is unaccounted for. The gate is the
   inventory, not a mode declaration — `induction:inventory` replaces v2.2's
   `induction:mode-ledger`, which was a gate with a category error in it.
4. **Record the dispositions** in `docs/architecture/`, one page, dated, with the "who would
   notice" column filled in. That column is the whole point: it is the difference between moving
   a behaviour and losing one.

What survives from the old Q1 is only this: **`inferenceController.step(5000, …)` is evidence
that something is currently being done in a cycle that a cycle should not be doing.** That is a
finding about the tree, not a question about intent, and A1 is the fix either way.

**Q2. Is it a dependency or a component?** A dependency means no deterministic core, hence no
hermetic tier, hence no reliable suite — the `todo16-batching` latency assertion is that problem
in miniature. A component means §4.1's hermetic question is answered by A9. **Upstream of all
the others.**

**Q3. What is the falsifiable claim? — the experiment exists; the hypothesis and the bench do
not.** v2.2 looked for a research project here and found a command.

`scripts/arcade.ts:45` defines the arms `manifold | lm | replica | heuristic | random | nal`,
Brier-scores every decision against the realised outcome, and forces the `nal` arm into
cognitive mode "so it is always a comparable row in the summary" (`:317-320`). Critically, the
`nal` arm and the `manifold`/`replica` arms **share the actuator**: both construct
`EpsilonGreedyReflex` with `numArms: 10, epsilon: 0.1` (`:106-111`, and the `incumbent` inside
the manifold branch), differing only in whether NAL rules plus the Negotiator's veto are in the
loop or the System One manifold scores instead. The script's own comment states the intent —
"the falsifiable question is whether the Negotiator's vetoes help, not whether the reflex is
smart".

So the controlled comparison is:

```
pnpm arcade -- --games snake,bandit,tictactoe --arms nal,manifold,lm --resume
# same games, same seeds, same actuator, Brier-scored to .reports/arcade.{json,md}
```

What is missing, and it is three things rather than a programme:

1. **A stated hypothesis** — which arm should win, by how much, on which games, and what result
   would count as "the induction layer does not earn its place". Written down *before* the run,
   or it is a rationalisation afterwards.
2. **An aggregate** — per-game Brier means exist; a single number across the matrix, with a
   variance estimate over seeds, does not. Ten seeds and a mean is a weak instrument, and the
   load-sensitivity lesson of §11.3 applies to seeds as much as to machines.
3. **A clean control.** This is the catch, and it is a dependency: the `nal` arm is only a true
   no-inducer control **after A1**, because until the cycle stops calling `processLMRules` the
   arm is running a fully constructed, fully registered layer with execution gated — §3.5's
   "absent, not disabled", measured at 33 invocations per cycle. **A falsification experiment
   whose control arm has a vestigial inducer cannot falsify anything**, which is the most
   expensive kind of wrong. So Q3 is sequenced after A1/A2 and after A10: the with-inducer arm
   is only meaningfully with-inducer once proposals become rules.

**If this plan lands and Q3 is still unanswered, it will have been tens of thousands of lines of
good engineering pointed at an unmeasured claim.** It is the last item in the plan and the only
one whose completion criterion is a *number that could come out the other way*.

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

**Q8. Does the induction layer become a seventh workspace package? — answered for the
contracts in v2.1; the rest stays open.** The *seam contracts* move to
`@senars/core/schemas` (A2), which makes the boundary structural at the price of one directory
and on a precedent the tree already has. What a seventh package would *additionally* require is
that everything the layer reads — concepts, memory statistics, derivation chains — becomes
public API, which is a much larger surface change and would need its own plan. Keep the
question for the day the layer needs to be genuinely un-buildable rather than merely
un-importable; nothing about A1–A3 forecloses it.

**Q9. What does the no-provider core's built-in reaction table contain? — measurably answered
in v2.1; the *claim* still needs a sentence.** The census in §1.8 answers the mechanical half:
it is the 55 rules registered by `nar/src/rules/impls/registration.ts`, of which 21 are
`inheritance:inheritance`, all NAL and extended-NAL, none layer-typed. So "reduces to
NARS-like capability" is literally true today and the claim is modest, which is the defensible
answer. What is still missing is a test that says so — a census assertion that the core's
shipped table is exactly these 55 and grows only through a proposal — because that assertion is
what makes the claim falsifiable rather than descriptive. Cheap; belongs with A2.

**Q10. Is the model the *only* proposal producer we expect?** Designing the contract for one
producer is how you get an interface that is really a call site. A rule-miner, a human author
and a recorded fixture are cheap to name now and expensive to retrofit.

---

## 13. Pass log

### Tenth pass (v2.5) — the model capability is one thing with two profiles, not a gate and a proposer

- **Corrected the central model of §3.7.** v2.4 described a fast tier that *judges* untrusted
  input and a slow tier that *proposes* rules, with the first acting as a checkpoint on the second.
  The author's model is different and better: **one model-reasoning capability with two call
  profiles** — a fast/point profile that answers specific questions inline, and an open profile
  that answers open-ended requests at a boundary. The only difference is scope and latency.
- **Undone the subordination.** The point profile is not a gate on the open profile; it is a
  first-class reasoning participant, it **can produce derivations** rather than only gate other
  behaviour, and it should be available **anywhere in the pipeline** — not at ingress because
  ingress is where untrusted input happens.
- **Added A11**, because "anywhere in the pipeline" is currently "at ingress, and only there":
  the only reachable capability is the judge injected into `PerceptionGate`. A11 makes the core
  declare one optional model-reasoning port that every stage may consult, advisory only, with each
  call site's budget and position declared and gated.
- **Recorded why this is safe, which is the corrected invariant.** "Use it everywhere" is a
  liveness bug without a bound and a bounded design with one — so the invariant and the capability
  are the same decision, and a plan that forbade model calls in the cycle would have forbidden the
  thing the system is for.
- **Added a placement table** — ingress, premise formation, rule selection, contradiction, goals,
  attention, consolidation, explanation — explicitly *not mandated*, ordered by what is
  measurable. "Anywhere" needs a priority order and a budget, and that is an experiment.
- **Recorded the confusion honestly.** The author reported losing the thread of a document that had
  grown through nine revisions. The response was structural rather than cosmetic: a **§Status**
  block at the top (decided / open-and-needs-you / next actions / what this is not), a compact
  revision log replacing five narrative "what changed" sections, and §3.7 rewritten as a single
  table with the corrections stated inline. A plan nobody can navigate is not a plan.

### Ninth pass (v2.4) — stated the actual goal, and stopped optimising the wrong sentence

- **Took the goal as given** — NARchy-like NAL rules *and* LM rules, needing different
  representation and apply behaviour, some fixed and some dynamic, for the best of symbolic and
  LM, with the LM integration as the innovation — and measured the plan against it. Three passes
  had been making the core *independent* of the LM, which is the floor.
- **Added §3.7, the three tiers of rule**, and with it the reason S and P cannot share a type: a
  symbolic rule is a total function from premises to conclusion, a model-backed rule is a bounded
  call whose result may be absent. Fusing them means sharing the seam and the event log, not the
  representation.
- **Corrected the central invariant** from *no model in the cycle* to *the cycle never depends on
  one*, with a test that hangs both a judge and a rule backend. The old form forbade the fusion
  the project wants, and — see §1.11 — would have gone green with a live dependency in the
  perception path.
- **Found the dependency the old framing could not see** (§1.11):
  `KernelPerceptionGate:118,154` awaits a judge on the input path, with no fallback, so a manifold
  outage stops input. Also established that `LMRule.apply` is inherently `async` and that every
  LM rule already ships a symbolic body — the best-of-both seam, already built and previously
  unnoticed by this plan.
- **Split the proposal protocol** into content and rule, with separate queues, overflow policies,
  admission paths and reversibility, and pointed A10 at the rule path only. One `Proposal`
  interface with one overflow policy was erasing the asymmetry that matters: a bad belief poisons
  one derivation, a bad rule poisons all of them.
- **Made the symbolic fallback a schema requirement** (`rule:has-fallback`) rather than a
  convention in one directory, because "every cognitive function has a symbolic path" is the
  sentence the whole architecture depends on and it was not enforced anywhere.
- **The lesson, recorded because it is the third instance:** v2.1, v2.3 and v2.4 each found the
  plan optimising something adjacent to the goal — a defensible neighbouring claim that nobody had
  actually asked for. A plan inherits its goal from the person who owns the project, and a
  document that has been polished for four passes can still be answering a question its author
  was never asked.

### Eighth pass (v2.3) — asking the author of the reference implementation

- **Corrected §2.5 from "compiled" to "winnowed".** NARchy's reaction trie narrows the applicable
  rules for a premise and evaluation remains interpreted. Three passes had this wrong, in the
  direction that made it sound more impressive than it is, and TODO30 §6 was built on it. The
  correction improves the target: SeNARS's 2-tuple rule key is the depth-1 case of a predicate
  trie, so the work is incremental and parity-gated rather than a rewrite.
- **Corrected §3.6's differentiation claim.** NARchy selects rulesets at startup, so "NARS
  assumes a fixed rule set forever" was false as written. Replaced with **selected vs learned**,
  which is both true and a smaller claim — and A10 is rescoped from "the table is loaded" to "a
  rule is admitted while the system runs, through gates, revertably", since loading is not novel.
- **Retired Q1.** The episodic/online distinction is not a fact about this system, and treating
  it as load-bearing was an imported framing. Replaced with the in-cycle induction inventory,
  which is enumerable from the code and is the work A1 must do regardless. `induction:mode-ledger`
  became `induction:inventory`.
- **Added a provenance class.** NARchy claims are now marked read / author-stated / inferred, and
  the load-bearing ones moved to author-stated. Also recorded the monorepo shape: `jcog` holds the
  data structures and `narchy` the reasoning, which makes §2.1's "storage is a port" a *module
  boundary* precedent rather than a convention.
- **Recorded the lesson, because it is the second time:** v2.1 and v2.3 both found a load-bearing
  claim that three passes had been building on, and both times the fix came from asking rather
  than from reading more. A plan that cites a reference implementation's *filenames* as design
  intent is making a claim it cannot support, and the cheapest correction is the author.

### Seventh pass (v2.2) — does landing it produce the thesis?

v2.0 decided the shape. v2.1 asked whether it would land. v2.2 asked whether landing it produces
the architecture the thesis is about, and the answer was: everything except the thesis.

- **Found the load-bearing omission.** The rule set is registered as a module side effect on a
  global registry (`rules/impls/registration.ts`), so it cannot be loaded, versioned, swapped or
  reverted — and a proposal that proposes a reaction has no path to becoming one. A3 was a
  transport to a door with nothing behind it. **A10** closes it: registration behind the
  `InferenceTable` port, the built-in table as a versioned artifact, absence as a runnable value,
  learned rules revertable, parity against the code-registered table as the proof that nothing
  else changed.
- **Turned Q1 into a gate.** A four-step procedure (enumerate, classify, gate, record) using the
  accumulator-ledger pattern, because the plan's central claim was an assumption and
  `step(5000, …)` is evidence for the wrong answer.
- **Found that Q3's experiment already exists.** `scripts/arcade.ts` runs `nal` and `manifold`
  arms with the *same* `EpsilonGreedyReflex` actuator, Brier-scored, with `nal` forced comparable
  — so the controlled comparison is one command. What is missing is a written hypothesis, an
  aggregate with variance, and — the real catch — a control that is only clean once A1 makes
  absence real, since the `nal` arm currently runs a constructed-and-registered layer with
  execution gated.
- **Added §7 invariant 14** (the rule set is loaded data, never an import side effect) and the
  `rules:loaded-data` and `induction:mode-ledger` gates, and added A10 to the trace, the
  sequence, and the risk register — including what to do if it is the item that gets cut.

### Sixth pass (v2.1) — will it actually land?

v2.0 decided what the architecture is. v2.1 asked the two questions a plan should ask about its
own target: *does anything in it contradict what the tree already does*, and *could a fresh
session execute it*.

- **Found a defect in the seam the plan was about to make load-bearing** (§1.10). The only
  production consumer of the kernel's budget gate imports the *process-global* `gateRegistry`,
  while `createGateRegistry()` exists for precisely this and has a bench behind it. A1 now takes
  the registry by injection, and §7 invariant 13 makes it general.
- **Made A6's hardest decision a measurement** (§1.8). The rule census — 55 rules, zero
  wildcard buckets — retires the "is the `*:*` catch-all load-bearing?" debate, and the durable
  form is a required parameter rather than a catch-all. The same file also provided the
  positive example the plan was missing: `RuleIndex.ordered` invalidates on the `rankingEpoch`
  its ordering depended on, which is what `stepScalars` does not do.
- **Put the seam contracts in `@senars/core/schemas`** (A2) on two existing precedents —
  `verify-derivation`'s dependency floor, and the induction layer's own imports from
  `@senars/core/schemas` — which makes the boundary structural instead of policed, and answers
  Q8 for the contracts.
- **Enumerated A2's public-surface blast radius** (six surfaces, five of which can *break*
  rather than merely mislead) and found that README's rule-matrix path is wrong while A6 works
  in the real one.
- **Reused instead of reinvented, three times**: the kernel's gates for the seam (§3.4),
  `ReasoningBudget`/`KernelBudgetGate` for budgets (A7), and the event log with
  `replayCognitiveState` for proposal replay (A9). §9 now states the rule.
- **Made the ownership invariant representational**: `Concept.priority` loses its public setter,
  so "one owner" is enforced by the compiler and the write-surface gate is a backstop.
- **Replaced v2.0's "either order works" with a rule** — structural before behavioural, so A4's
  one attribution (the RL and parity baselines) is measured on the final structure.
- **Turned in-cycle detection into a trace assertion** over the `cognitive.stage` spans the
  kernel already emits, and gave every item a single verifying command plus a gate that lands
  with it rather than after.
- Answered Q8 (contracts: `core`; the rest open) and Q9 (the built-in table is the 55 registered
  NAL rules; the claim still needs a census test).

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
  ten-or-so `Concept.priority` writers. (This pass recorded eleven; v2.1 re-counted to ten
  after separating `memory/focus.ts:80` and `links/Layer.ts:118`, which write another object's
  `priority`.) The LOC-ratchet invariant described a gate that does not exist.
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
| the seam uses the process-global `gateRegistry`, not the per-instance one | `stream/reasoner.ts:2`, `GateRegistry.ts:117,120`, `nar.ts:136` |
| the overflow policy is drop-oldest on both paths | `util/src/utils/collections.ts:33-47` |
| **no registered rule uses a wildcard bucket**; 55 rules, 21 in the hot cell | `RuleRegistry.getAll()` census (§1.8) |
| one `InferenceController` construction site, one `.step(` call site | `cognitive/impls/CognitiveController.ts:167`, `nar-execution.ts:234` |

### 14.2 Believed — argued, not established

Design positions. Defensible, and the plan proceeds on them, but a future session is entitled
to disagree and should say so rather than quietly inherit them.

| belief | where it comes from | how you would know it is wrong |
|---|---|---|
| `Memory` should be a **port** | NARchy's `Memory` is a port with 8 implementations (§2.1) | the ports cannot express what reasoning code actually needs, and the seam becomes a wrapper over the god-object |
| Attention should have **one owner** | `PriTree` + a duration-derived commit (§2.2–2.3) | the ownership surface cannot be enumerated — a new writer appears and nothing fails |
| Rule selection should be **winnowed by a predicate-shaped selector**, not union-and-sort | NARchy's reaction trie's stated purpose: narrow the applicable set for a premise, still interpreted (§2.5, §11.3) | the candidate count after winnowing is not materially smaller than the union, or is smaller only above a size this system never reaches |
| A NARS-like core makes the layer **falsifiable** | argument, §3.6 | the no-provider core turns out inert — §7 invariant 7 fails and the argument is void |
| The differentiator is **admission, not loading** — NARchy already selects rulesets at startup | the NARchy author (§11.3), and v2.3's correction of §3.6 | if NARchy's startup selection is in practice equivalent to gated runtime admission — rulesets routinely composed, reloaded, admitted incrementally — then A10 is an increment on an existing capability and §3.6's claim is too small |
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
- **README names `nar/src/rules/registration.ts` as the source of truth for the NAL rule
  matrix, and that path does not exist.** The real one is
  `nar/src/rules/impls/registration.ts`. This is not cosmetic: A6 works in exactly that file,
  and the census in §1.8 comes from it. Fixed as part of A2's documentation sweep, and the
  README's rule matrix should be generated rather than transcribed, for the reason §10.1 gives.
- **Two seams of documentation for the rule set** exist — README's matrix and the registry — and
  they are maintained by hand on both sides. The census is a third, and this time it is
  executable; the cheapest durable answer is a bench that compares the two, which does not exist.

---

## 15. Risk register, and what would make this plan wrong

This is the list of ways it fails, so that a failure is recognised as information rather than as
bad luck.

| risk | likelihood | signal that it is happening | response |
|---|---|---|---|
| **A1 is not the cheap change v2.0 believed.** The committed channel is wired in and something *else* turns out to reach the layer from the cycle | **medium** — the cycle path is `DefaultDerivation`, `RuleProcessor`, the tick bindings and now `PerceptionGate`, and only part of it was traced | a cycle still completes with a hanging judge and a hanging rule backend — so the signal is a cycle that *does not complete*, or derivations that change when a provider is added. `grep` every layer import reachable from `applySyncRules` before assuming the call graph is small | widen A1 rather than declaring victory; the acceptance is a test, and the test is the arbiter — not a call count, which §1.11 shows can be zero while a real dependency remains |
| **A2 is a swamp.** 39 files, and the layer reaches into core internals | medium | the diff stops being mechanical and starts having semantic content | A2 is deliberately after A1, so the `Proposal` interface is known. If it is still hard, take Q8 (seventh package) early — a compiler error is a better boundary than a review convention |
| **A4 breaks NAL parity.** Attention order changes | medium | the NAL suites move | A4 is gated on parity, and its baselines are re-established in the same change so later drift is attributable |
| **A4's write surface is unenforceable.** The "one owner" invariant is a comment | medium | a new external `priority` writer appears and no test fails | the enumerated write-surface test is the mitigation and must land with A4, not after |
| **The thesis is negative.** NARS-plus-acquired-rules is *not* better | unknown — but no longer unknowable | the `nal` vs `manifold`/`lm` arcade run comes out flat or negative | Q3: write the hypothesis, run `pnpm arcade -- --games … --arms nal,manifold,lm` with a seed count that survives the noise, and publish the number either way. **This is now a command, not a project** — but it needs A1 for a clean control and A10 for a meaningful with-inducer arm, so it is the last thing the plan does |
| **A10 never lands and the thesis stays prose** | **medium** — it is the largest item, last in the sequence, and the easiest to defer because the other nine all look like progress | the plan closes with A1–A9 done and "the rule set is a learnable artifact" still describing a message format | if the sequence is cut, cut here *explicitly*: record in §5 and §15 that the rule set is code, and stop claiming otherwise. A floor delivered honestly beats a thesis claimed and not built |
| **The plan measures the wrong thing** | **already happened once** | v1.3's ordering came from a profile of the fused system | fixed by construction in v2.0: this document makes no ordering claims about cost, and TODO30 must re-profile before ordering anything |
| **A5's ports become wrappers.** The split adds a layer without removing the god-object | medium | `Memory` keeps its responsibilities and a new interface forwards to it | A5's acceptance is that the cycle depends on ports; if `Memory` is still on the cycle path, it is not done |
| **Deleting the drop-oldest policy is the wrong call** | low-medium | A3's overflow choice makes the queue starve a slow producer | it is a one-line change with a test, and it is reversible by design — which is the point of A3 being a decision rather than a default |

**The kill criteria, stated plainly.** Two things would mean this is not the right plan. If
**Q1** resolves to "the induction layer is genuinely an *online* learner" — the cycle cannot
close, §3.1 is unenforceable, and the whole architecture is moot. And if **§7 invariant 7**
fails — the no-provider core turns out inert, which would mean the layer was load-bearing and
§3.6's falsifiability argument was never true. Both are checkable before much is built, and both
should be checked first.
