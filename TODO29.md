# TODO29: Runtime — the cycle's cost model, and the retrieval engine underneath it

**Version:** 1.0 (2026-09-30) · **Predecessor:** TODO28 (phases A–P; structure, the package graph, the
barrels, the gate list), which closed the structural axis and left the runtime. TODO28's own §4.4
declined to shrink `nar.ts` and §7.11 closed with "what is left" one line long. This is the other
axis: not what the tree looks like, but what a cycle costs and why.

**Status: open.** Nothing here has landed. §1 is the diagnosis and it is measured, not asserted —
every number in it comes from a CPU profile of the inference loop or a counter run against the
live engine, and the commands are in §11 so the numbers can be re-derived rather than trusted.
§2 is the reference architecture. §3 is the target. §4 is the work.

> **A fresh session should read §1.1 and §4/W0 first.** The one-line version: SeNARS is a
> *retrieval system that reasons*, and the retrieval half is a linear scan with a re-computed
> score. NARchy — and OpenNARS before it — is a *reasoner with an index*, where retrieval is a
> table lookup and attention is a maintained order rather than a field that nineteen places write.
> Nothing about the NAL has to change to get there. Everything in §4 is a data-structure and
> ownership change, not a semantics change — with exactly one deliberate exception, §4/W1, which
> is called out as such because it moves learned values.

---

## 0. What this is

Three findings from a profiling pass, in order of how much they cost.

**§1.1 The cycle re-derives what it already knows.** `Memory.sample()` sweeps the entire concept
population — decaying it — and it is reached once per sampled concept, so a single inference
cycle performs **nine full-population decay writes and nine full-population ranking passes**
(measured, §11.2). Worse, the decay clock therefore advances `min(sampleSize, population)` times
per cycle, which means `activationDecayRate` does not mean what the configuration says it means:
the effective rate is `activationDecayRate × min(sampleSize, population)`, and changing
`maxSampledConcepts` — a knob documented as *how many concepts to sample for inference* — silently
changes how fast memory forgets (measured table, §11.3).

**§1.2 Every read of memory is a full scan, and the index that exists is bypassed.** `sample`,
`decayAll`, `forEachConcept`, `listConcepts`, `findConcepts`, `findSimilarConcepts`,
`removeConceptsMatching`, `getGoals`, `getRevisionHistory`, `getStatistics` and
`EmbeddingLayer.neighborsOf` are all O(population). Meanwhile `LinkManager` + `EmbeddingLayer` +
`AssociativeRegistry` exist to provide indexed recall — and the *default* premise source
(`PREMISE_SOURCES.bag`) uses none of them, choosing a full scan and a sort instead. The
infrastructure for the thing the system is for is unused on the default path.

**§1.3 The thing that is supposed to decide what to attend to decides nothing.**
`MemoryScorer` has four factors. No caller anywhere supplies `relatedConcepts`, and
`lastAccessTime`/`lastAccessedAt` are declared in its context type and never read by its body. So
novelty is always `1` and relevance is always `0`, and the three per-concept scorers reduce to

```
retrieval      = clamp01(0.5 + 0.20 · priority)
consolidation  = clamp01(0.5 + 0.10 · priority)
forgetting     = clamp01(0.5 + 0.06 · priority)
```

all strictly monotone in `concept.priority` and never clipping. **Ranking by retrieval score is
exactly ranking by priority.** The O(N log N) pass on every sample computes `concept.priority`,
which the concept already stores.

Those three are the expensive ones. §1.4–§1.8 are cheaper to fix and worse to keep, and §1.8 is
worse than all of them: a rule-ranking tie-break that was documented as fixed and is not.

---

## 1. The diagnosis

### 1.1 The cycle re-derives what it already knows

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
| `PREMISE_SOURCES.bag` → `memory.sample(n)` | 1 per sampled concept | `strategies/premise/primitives.ts:56`, reached from `samplePremisesFromConfig` at `:375` |
| `WindowedRoulette` → `sampleWindow` | 1 per cycle when selected | `strategies/sampling/WindowedRoulette.ts:33` |

Measured at 164 resident concepts, 40 cycles, defaults otherwise: **9.0 `decayAll` calls, 8.8
`memory.sample` calls and 5.0 `forEachConcept` calls per cycle** (§11.2). At the 3 635 concepts of
the §11.1 benchmark that is ~9 × 3 635 priority writes and ~9 × 3 635 scorings per cycle, 900
times over a single 300-step rollout.

`decayAll`'s three call sites are `sample`, `sampleWindow` and `consolidate` (`memory.ts:355, 371,
389`). Only the third is a clock tick. Moving the other two to the cycle boundary is W1.

The coupling is not incidental. The premise *source* decides how many decay passes happen, and the
premise source is chosen by configuration:

```
maxSampledConcepts= 5   population=86    decayAll per cycle=5.2
maxSampledConcepts=10   population=139   decayAll per cycle=8.4
maxSampledConcepts=20   population=164   decayAll per cycle=9.0
maxSampledConcepts=40   population=164   decayAll per cycle=9.0
```

Four runs, identical `activationDecayRate: 0.01`. A retrieval-breadth knob is a decay-rate knob,
and the number saturates only because the population runs out.

### 1.2 Every memory read is a full scan, and the index is bypassed

`Memory` is 646 lines and does storage, decay, ranking, eviction, archiving, focus maintenance,
link management, indexing and statistics. From the survey, the O(population) members on or near
the cycle path:

| member | cost | note |
|---|---|---|
| `sample` / `sampleWindow` / `decayAll` | O(N) + O(N) | §1.1 |
| `forEachConcept` | O(N) | called 5×/cycle; `nar-io.ts:338` is one caller |
| `listConcepts` | O(N) + array alloc | `GoalBiasedSampling:18`, `evictUnderPressure:29`, `NoveltySampling`, `DiverseSampling` |
| `getGoals` | O(N × goals) + a `Task` per goal | `RuleProcessor.processLMRulesImpl:393`, `nar-execution.ts:417, 455`, `context-assembler.ts:153` |
| `getStatistics` | O(N) + **two percentile sorts** | `nar-execution.ts:424` every 10 cycles; `RuleProcessor.stepMemoryScalars:174` |
| `findSimilarConcepts` | O(N) over indexed concepts | `memory.ts:542` |
| `LinkManager.applyDecay` | O(total links) | every consolidation |
| `EmbeddingLayer.neighborsOf` | O(embedding count) | on every `indexConcept` ⇒ **admission is O(n²)** |

And the sources of truth for *which* concepts are related — `term` layer, `embedding` layer,
`graph` — are reachable through `AssociativeRegistry` and used by two of five premise sources
(`links`, `graph`) and one of four samplers. The default premise source is `bag`.

### 1.3 The scorer is decorative

`nar/src/memory/pressure/scorer.ts`. The only call site of `score()` in the whole tree is
`lifecycle/forgetting.ts:67`, `scorer.score(c)`, with no context. `relatedConcepts` is therefore
always `0`, `noveltyOf(0) ≡ 1` and `relevanceOf(0) ≡ 0` on every path, and the derivation in §0
applies. `lastAccessTime` and `lastAccessedAt` appear in the context type at `:48-49` and nowhere
else.

The abstraction also costs a `.map` + two `.filter`s + a sort copy per call site, on a path that
runs `N × 9` times a cycle.

### 1.4 Eviction measures the wrong resource, and its candidate filter is anti-correlated with pressure

`nar/src/memory/pressure/consolidation.ts:24`

```ts
const pressure = memory.capacityPressure();          // occupancy(concepts.size, maxConcepts)
if (pressure <= PRESSURE.ARCHIVE) return ...;
const idle = sortBy(memory.listConcepts().filter((c) => c.totalTasks === 0), c => c.priority);
if (idle.length === 0) return { archived: 0, forgotten: 0 };
```

Pressure is **concept count**. But the dominant consumer of memory is task volume: every concept
gets `beliefBag` 100 + `goalBag` 50 + `questionBag` 20 (`concept.ts:79-81`), so the reachable
ceiling is `maxConcepts × 170` tasks with no global aggregate bound anywhere. `totals()` reports
`totalTasks` (`memory.ts:467`) and eviction does not read it.

The candidate filter is `totalTasks === 0`. Under real pressure the concepts holding tasks are the
valuable ones, so all of them are protected; the only evictable concepts are empty shells, which
cost nothing to keep. **Memory becomes unshrinkable precisely when it is most full**, and it fails
silently rather than loudly.

### 1.5 `getGoals()` mints a stamp on every call

`nar/src/memory/memory.ts:253`

```ts
stamp: g.stamp ?? Stamp.createInput(),
```

`Stamp.createInput()` takes a fresh monotonically-increasing id. `getGoals()` is a full scan
reached from five places, so the same goal returns a different stamp on successive calls. Stamps
are what `noStampOverlap` (`primitives.ts:150`) and circular detection reason about, so anything
keyed on stamp overlap is reasoning about an id that by construction never repeats. The same
method also allocates a fresh `Task` per goal per call, on a path that is itself O(N).

### 1.6 `Concept.priority` has nineteen writers

`concept.ts:95` (setter), `:138` `boost`, `:142` `decay`, `:149,151` `decayAttention`, `:247`
`mergeWith`, `:277` `recordAccess`; `memory.ts:569` `decayAll`; `reason/inference-controller.ts:110`;
`strategies/attention/SpreadingActivation.ts:17`; `nar-io.ts:327, 341`; `focus/Focus.ts:211`;
`kernel/replay.ts:185`; `self/SelfOptimizer.ts:136`; `state/serialization.ts:110`;
`tools/adapters/coverage-concept.ts:65`.

There is no owner. A write from a strategy, a replay, a deserializer and an O(N) relevance scan
land in the same field, and §1.1 depends on how many of them have run. The survey also found that
`Concept.addLink` is called from exactly one place (its own `mergeWith`) and `addChildConcept` has
zero callers, so `linkedConcepts` / `subConcepts` / `parentConcepts` are never populated — which
makes `SpreadingActivation.prime` and `Concept.updateLinks` no-ops and `findOrphanedLinks` trivially
empty. Dead structure, still maintained.

### 1.7 The growth arithmetic

`maxConcepts` 1 000, bags 100/50/20 ⇒ 170 000 tasks reachable, no aggregate bound. Term layer
capacity 1 000 with `eviction: { by: entry => entry.priority }` (`Layer.ts:21`), and `BoundedMap.#selectVictim` **scans the whole
map** to find the lowest score (`util/src/utils/bounded-map.ts:210-224`) ⇒ every link insert into a
full layer is O(capacity). `EmbeddingLayer.neighborsOf` is O(n) on every `indexConcept`, which
`Memory.adoptConcept` calls per new concept (`memory.ts:313`) ⇒ admission O(n²).
`TermCollection.deleteItem` is O(n) because it shifts every index above the removed slot
(`term-collection.ts:57-67`). `selectTopN` is a bounded buffer with an insertion sort, O(n·k)
(`collections.ts:126`).

None of these are catastrophic alone. Together they mean the system's cost per cycle grows with
its memory, which is the one property a reasoning system cannot have.

### 1.8 Two rules that document a fix they did not get

**The rule-ranking tie-break.** `rules/impls/RuleIndex.ts:132-140`

```ts
// Declared priority is the primary order. Observed success only breaks
// ties: weighting priority by a success rate that starts at zero for
// every rule collapses the comparator to a constant and orders nothing,
// so a rule with no track record would never be ranked at all.
const byPriority = b.priority - a.priority;
if (byPriority !== 0) return byPriority;
return (this.hitStats.get(b.id)?.successRate ?? 0) - (this.hitStats.get(a.id)?.successRate ?? 0);
```

The comment identifies the exact hazard and reorders the comparator to avoid it. But
`recordRuleHit` — the only writer of `hitStats` — has **zero callers outside `RuleIndex` itself**.
`successRate` is therefore always `0`, the tie-break is always `0`, and the comparator is the
constant the comment describes having moved away from. The comment is a correct description of a
bug that is still present, because the measurement that would populate the field is never taken.

**Frozen LM-rule context.** `rules/impls/processor.ts:156-181`

```ts
resetMetaBudget(): void { …; this.stepScalars = null; }     // zero callers
private stepMemoryScalars() { if (this.stepScalars) return this.stepScalars; … }
```

`nar-execution.ts:368` calls `this.resetMetaBudget()` — which resolves to `NARExecution`'s **own**
private method at `:179`, resetting a different pair of counters, because the injected
`ruleProcessor` port at `:76`/`:116` structurally declares the same name. So `stepScalars` is
computed once per `RuleProcessor` instance, at the first LM rule that asks, and never recomputed
for the life of the process. Every LM rule ever run reasons about `totalConcepts`,
`memoryPressure` and `conflictCount` as of that single instant. The doc comment says "at most once
per inference step (prompt hints may be a step stale)"; it is not a step stale, it is a process
stale.

A shadowed method name, a memo with no invalidator, and an aggregate that costs two full sorts to
compute once. All three are in the same 40 lines.

### 1.9 What the profile actually said

`--cpu-prof` on a 300-step rollout, 3 635 resident concepts, 900 inference cycles. Self time:

| share | site | verdict |
|---|---|---|
| 17.1% | `TermCollection` iterator, from `selectTopN`/`decayAll`/`forEachConcept` | §1.1, §1.2 — partly landed as a sweep change, the rest is §4/W2 |
| 12.0% | `get priority` (`concept.ts:90`) | §1.6 — 19 writers, inlined into 3 call sites |
| 8.9% | `RegExp /\((\w+)\s+-->\s+(\w+)\)/` | landed — now `bareInheritancePair` |
| 6.8% | `nar-io.ts` relevance scan callback | landed |
| 4.4% | `SimpleAttention.decay` | §1.1 |
| 4.2% | `MemoryScorer.scoreFor` | §1.3 — allocation removed, collapse not |
| 4.0% | `BoundedMap.#reinsert` (via `LruCache` for the term interner) | §4/W8 |
| 2.4% | `selectTopN` | §4/W8 |
| 2.6% | GC | |

The landed column is the two commits of 2026-09-30: the sweep is now index-based and the regex is
gone, which is worth ~14% on the rollout. Everything in the right-hand "§4" column is the
remaining ~20%, and the ceiling it addresses is the 9× multiplier, not the constant factors.

---

## 2. What NARchy does instead

Reference: `github.com/narchy/narchy`, module `narchy/nar` (1 814 Java files across the monorepo).
Read directly, not from memory of OpenNARS. The load-bearing observation is not any single data
structure — it is **where the responsibility sits**.

### 2.1 `Memory` is a port, with eight implementations

`nars/memory/Memory.java` is 123 lines and its whole abstract surface is:

```java
public abstract Concept get(Term key, boolean createIfMissing);
public abstract void set(Term src, Concept target);
public abstract void clear();
public abstract int size();
public abstract String summary();
public abstract @Nullable Concept remove(Term entry);
```

There is no decay, no scoring, no sampling, no eviction, no archive, no focus and no links in it.
Those live in `concept/` (beliefs), `focus/` (attention), `control/` (control), `deriver/`
(inference). Eight implementations ship: `MapMemory`, `SimpleMemory`, `CaffeineMemory`,
`RadixTreeMemory`, `TierMemory`, `FSMemory`, `HijackMemory`, `ProxyMemory`, `NullMemory`.

SeNARS's `Memory` is one class, 646 lines, and it is the *only* one. Making it a port is W3; it is
what allows W2, W4 and W7 to be tested without standing up a NAR.

### 2.2 Attention is a maintained order, not a field

`nars/focus/util/PriTree.java` — "hierarchical priority distribution graph", a
`MapNodeGraph<PriNode, Object>` with a `commit()` that walks nodes in DFS order once per system
duration. `nars/focus/PriNode.java`, `PriSource.java`, `PriAmp.java` give a node its priority and
its sources. `nars/focus/util/TaskAttention.java` (336 lines) and
`TaskBagAttentionSampler.java` are the samplers that replace "sample 100 concepts and re-rank".

The consequence is the whole point: top-k attention is `O(k)` from a structure that is *already
ordered*, and priority has exactly one owner. Nineteen writers become a handful of typed touches
on an index.

### 2.3 Focus commits on a clock derived from system duration

`nars/Focus.java:239-262`

```java
public final boolean commit(long now) { if (now >= this.commitNext) { … _commit(now); … } }
private void _commit(long now) { commitTime(now); input.commit(); attn.commit(); }
private void commitTime(long now) {
    this.durSys = nar.dur();
    var durCommit = Math.max(1, durSys * commitDurs.floatValue());
    this.commitNext = now + Math.round(durCommit);
}
```

Attention advances on a *timer whose period is the system duration* — not once per read, and not
once per sampled concept. `nars/focus/time/` carries 15 pluggable timings
(`BasicTimeFocus`, `TemporalTaskTiming`, `MultiFocusTiming`, …) so "when" is a policy.

This is the direct answer to §1.1: the decay clock has one owner and one cadence, and the cadence
is derived from the system's own notion of time rather than from a retrieval-breadth knob.

### 2.4 Beliefs are retained by policy, and the container is a port

`nars/focus/BagForget.java` + `AbstractBagSustain.java` implement retention as
recency × frequency. `nars/table/` has `BeliefTables` with `eternal/`, `temporal/`, `question/` and
eight `dynamic/` implementations. The permanent-permanent / eternal-vs-temporal distinction — which
SeNARS papers over with one `Bag<TaskData>` and three capacity constants — is a *table type* in
NARchy.

### 2.5 Inference is compiled, and control execution is pluggable

`nars/deriver/reaction/` holds `NativeReaction`, `PatternReaction`, `TaskReaction`, `MutableReaction`
and `ReactionModel`, compiled ahead of time by `compile/TrieReactionCompiler`,
`DAGReactionCompiler`, `DecisionTreeReactionCompiler`, `ANDCompiler`, `JaninoPredicateCompiler`.
`nars/deriver/util/memoize/` memoises the predicates those reactions call.

So: the rule set is turned into a compiled structure keyed by what it matches, and evaluation
walks that structure. SeNARS's `RuleIndex.candidatesFor` unions four buckets including a `*:*`
catch-all and **fully sorts the union on every memo miss**, per rule application, and there are up
to 500 rule applications per cycle (100 primaries × 5 secondaries, `processor.ts:246`).

`nars/control/exec/` — `UniExec`, `WorkQueueExec`, `ThreadedExec`, `WorkerExec`, `FiberExec` —
makes *how* the cycle executes a choice behind an interface.

### 2.6 The contrast

| | SeNARS | NARchy |
|---|---|---|
| concept store | one 646-line class doing 9 jobs | `Memory` port, 6 abstract methods, 8 impls |
| priority | a field with 19 writers, re-ranked on read | `PriTree` + `TaskAttention`, one owner, committed on a clock |
| top-k | `selectTopN` over the population, O(n·k) | O(k) from a maintained order |
| decay | swept inside `sample()`, 9× per cycle | committed on a duration-derived timer |
| beliefs | 3 fixed capacity constants × concepts | policy-based bags, 8 table types |
| rule dispatch | 4-bucket union + full sort per application | precompiled reactions, trie/DAG/decision-tree |
| what the cycle selects from | the whole population | a bounded working set |
| eviction trigger | concept count | per-container, by policy |

SeNARS has *more* machinery than NARchy in every row above and is slower in every row above. The
extra machinery is what is costing the time.

---

## 3. The target

### 3.1 The cost model

One sentence: **no operation on a cycle path may be O(population); every cycle-path operation is
O(1) or O(log n) in the live working set.**

That is checkable, and §4/W9 makes it a gate. Concretely, for a cycle over a working set of `k`
concepts in a memory of `N`:

| operation | now | target |
|---|---|---|
| attention decay | O(N), 9× per cycle | O(k), on a commit timer |
| top-k selection | O(N) scoring + O(N·k) | O(k) from the maintained order |
| premise retrieval | O(N) scan + sort | indexed by the task's symbols, O(1 + k) |
| relevance propagation on input | O(N) | via the link index, O(1 + k) |
| rule dispatch | union 4 buckets + full sort | O(1) table lookup + O(matches) |
| concept admission | O(n) embedding scan | O(k) nearest neighbours from a maintained index |
| goal enumeration | O(N × goals) + a `Task` per goal | maintained goal queue, O(k) |
| cycle context statistics | frozen forever | computed on a budget, invalidated per step |

### 3.2 The ports

Five, in dependency order. Each replaces part of the god-object rather than adding a layer.

```
ConceptStore     get(term, create) · set · remove · size · summary · clear
AttentionIndex   touch(term, delta) · topK(n) · commit() · forget(term)
BeliefTable      per-concept: insert · peek · size · policy-driven retention
InferenceTable   by (antecedentKind, consequentKind) → precompiled reactions
CycleExecutor    one cycle, under a budget, with a pluggable concurrency strategy
```

`ConceptStore` and `AttentionIndex` are the two that matter. Everything else is a consequence of
their existing.

### 3.3 The cycle

```
input ──▶ attention.touch(term)            O(1)          replaces the O(N) scan
      ──▶ admission (indexed neighbours)    O(1 + k)     replaces EmbeddingLayer.neighborsOf
      ──▶ attention.commit()                O(k)          the only decay in the system
      ──▶ workingSet = attention.topK(n)    O(k)          replaces sample() + scorer
      ──▶ for each premise pair:            O(1)          replaces RuleIndex union+sort
             inference.dispatch(...)
      ──▶ budgeted admit of conclusions
      ──▶ drive / meta / self — on a budget, opt-in
```

One owner per quantity, one cadence per clock, one write path per fact.

---

## 4. The work

Nine workstreams. **W0 first and separately** — it is the harness that decides whether the rest
worked, and landing it before anything else is what keeps this plan falsifiable.

### W0 — Make the cycle measurable, before changing it

The repo already has `phaseTimer` (`nar-execution.ts:191`) and a `c3-hotpath-perf.test.ts` that
prints ns/op. Neither answers "what does a cycle cost as memory grows".

- Extend the per-cycle cost report: cycles, concepts admitted, attention commits, premises
  sampled, rule dispatches, rule applications, derivations, admissions rejected — and wall time
  per phase, already partly there.
- Add `bench:cycle` (`scripts/cycle-bench.ts`): a fixed 300-step workload at four memory sizes
  (10², 10³, 10⁴, 10⁵ concepts), reporting the §3.1 table and the wall time. A script, not a
  test — a test that asserts latency is what produced the two flaky load-sensitive files.
- Ratchet what is already knowable and unmeasured: a `cost` section in the budget ledger
  declaring which operations may not be O(population) on a cycle path.

**Acceptance:** `pnpm bench:cycle` reproduces §1.1 and §1.9's numbers to within 10%, and the
report is what every later acceptance is measured against.
**Risk:** none. Pure instrumentation.

### W1 — Stop read paths from mutating the heap

*The one deliberate behaviour change in this plan.* Everything else is a data structure.

- `decayAll` leaves `sample()` and `sampleWindow()`. Both become pure reads.
- Decay becomes a clock: one call per cycle from the cycle boundary, and
  `activationDecayRate` means what it says (§11.3's table becomes a single row).
- `getGoals()` stops minting stamps. Stamps are minted at write and stored; the getter reads.
  `getGoals()` reads a maintained goal queue instead of scanning every concept's bag.
- `Stamp.overlaps` and the `noStampOverlap` filter become well-defined, which they are not today.

**Acceptance:** `decayAll` is called exactly once per cycle, from exactly one place, and
`maxSampledConcepts` no longer appears in any decay measurement. The RL/parity baselines are
re-established **here, once**, and committed — the rest of the plan must then hold them stable.
**Risk: high, and confined to this workstream.** Every learned value moves. This is why it is
first and alone: it is the only change that needs the baselines regenerated, and doing it before
W2 means W2–W8 are measured against a settled reference.
**Do not** fold W1 in with anything else. A behaviour change disguised as a refactor is
unreviewable.

### W2 — Attention becomes an index, not a field

- Introduce `AttentionIndex`. `Concept.priority` stops being writable by nineteen places and
  becomes owned by the index, with typed touches: `PrimeInput`, `PrimeRelated`, `Decay`,
  `Reinforce`, `Replay`, `Deserialize`, `SelfTune`. §1.6's nineteen sites become seven named
  operations, each with one caller.
- `topK` comes from the index, in `O(k)`. `Memory.sample` and `sampleWindow` go.
- **Decide the scorer's fate.** Either wire novelty and relevance to real signals — relatedness
  from the link index, recency from `lastAccessedAt` — and keep four factors, or delete two and
  sort by attention order. §1.3 shows the current answer is neither: it is four factors of which
  two are constants. This is a design decision, not an optimisation, and it should be recorded
  with its reason.
- `SpreadingActivation` and `Concept.updateLinks` either get a populated link graph or are
  deleted. §1.6 showed `linkedConcepts` is never written outside `mergeWith`, so today they are
  no-ops wearing a cost.

**Acceptance:** zero O(population) work on the cycle path except the attention commit, which is
O(k) on a timer; `bench:cycle` shows cycles/sec flat from 10³ to 10⁵ concepts. The nineteen
writers are seven named operations.
**Risk: medium.** Retrieval order changes, so RL results move — but W1 already re-established
them, so the delta here is attributable and must be small. If it is not small, the scorer decision
in this workstream is wrong and that is the finding.

### W3 — `Memory` becomes a port

Split the 646 lines along the responsibilities already listed in §1.2: storage → `ConceptStore`,
per-concept beliefs → `BeliefTable`, links → `LinkStore`, statistics → `Statistics`. Two
implementations to start (`MapConceptStore`, `TieredConceptStore` — hot/working/cold) plus a test
double; the other six NARchy has are not the point.

**Acceptance:** the cycle depends on the port, not on `Memory`; the cycle-path tests construct
their store directly and run in milliseconds.
**Risk: low.** Mechanical, and the boundary is already implied by `MemoryView` (`memory/view.ts`).

### W4 — The premise source stops being a scan

- `PREMISE_SOURCES.bag` resolves premises through the index — the task's own symbols first
  (`memory-index.ts` already has `queryBySymbol`), then the link layers — and never enumerates.
- `PREMISE_SOURCES.concepts` returns *all* concepts and is unreachable behind
  `minScore: 0.6` today; either it becomes bounded or it goes. `NoveltySampling` and
  `DiverseSampling` sort the entire population to then discard most of it; both go.
- `getRelatedConcepts` and `findSimilarConcepts` get indexes. `GoalBiasedSampling`'s
  `concepts × goals × containsSubterm` becomes an indexed join.

**Acceptance:** every premise source is O(1 + k); no source enumerates the population;
`graph` and `links` — the two that exist to be the default — are reachable without opting out of
the `bag` source's scan.
**Risk: medium.** Premise sets change, so derivations change. Bounded by W1's baselines.

### W5 — Inference dispatch becomes a table

- `RuleIndex.candidatesFor` loses the `*:*` catch-all and the per-miss full sort. Reactions are
  keyed by `(antecedentKind, consequentKind)` and their bodies precompiled, in the shape of
  `deriver/reaction/compile/`.
- `recordRuleHit` gets called, so the tie-break in §1.8 is either real or deleted. Right now it
  is neither.
- The branch factor gets an explicit global cap. 100 primaries × 5 secondaries = 500 rule
  applications per cycle, and `maxDerivationsPerStep` bounds the *output*, not the *work*.

**Acceptance:** rule dispatch is O(1) + O(matches); no sort on the rule path; rule applications
per cycle are bounded by a named budget; the rule-ordering tie-break is either exercised by a
test or gone.
**Risk: medium-high.** This touches inference semantics. NAL1–8 parity is the gate and must not
move.

### W6 — The control loop gets a budget

`nar-execution.ts:184-379` runs twenty-one steps per cycle, including two O(N) `getGoals()` calls
(`:417` in `emitCognitiveStateSummary`, `:455` in `injectMetaGoals`), an O(N)-plus-two-sorts
`getStatistics()` (`:424`), `DriveManager.updateCycle()` injecting Narsese goals every cycle, and
`SelfOptimizer` every tenth. §1.8's frozen `stepScalars` lives here too, because the call at `:368`
that was supposed to invalidate it does not.

- Every step declares a cost and a budget; anything that cannot be met from the budget is opt-in.
- `RuleProcessor.resetMetaBudget` is actually called — and the shadowed name at
  `nar-execution.ts:76`/`:116`/`:179`/`:368` is resolved, so the port and the implementation are
  not two methods that answer to one name.
- The cycle's own budget covers cycle context, so `stepScalars` is a per-step value again and the
  doc comment is true.

**Acceptance:** the cycle has a declared cost model; `stepScalars` is invalidated per step and a
test asserts it changes when memory changes; no two same-named methods on the port and its
implementation.
**Risk: low-medium.** Behaviour is "steps stop running by default", which is a visible change to
whatever was depending on the free behaviour.

### W7 — Bounded is bounded

- Retention becomes policy (recency × frequency) rather than a capacity constant, so a
  high-traffic concept and an abandoned one are not treated the same way.
- A global task-count bound, and `capacityPressure()` accounts for the dominant consumer rather
  than only `concepts.size`.
- `evictUnderPressure`'s candidate filter stops being anti-correlated with pressure: concepts
  must be able to age out while holding tasks, ranked by age × value, and eviction must be able to
  report that it could not free anything rather than returning a silent zero.
- The accumulator ledger grows from 2 sites to the 42 bounded containers in production, and the
  textual `LruCache`/`maxSize` check is replaced by a detection rule that can fail (§4/W9).

**Acceptance:** memory pressure is monotonically related to every bounded resource; a memory at
99% with no evictable concept reports that, rather than reporting success.

### W8 — Retrieval structures stop degrading to scans

Each of these was measured in §1.7 and is a one-line structural fix:

| today | cost | becomes |
|---|---|---|
| `BoundedMap` by-score eviction (`bounded-map.ts:204`) | O(capacity) per insert into a full layer | a min-heap keyed by score, lazy deletion |
| `EmbeddingLayer.neighborsOf` (`EmbeddingLayer.ts:70`) | O(n) per `indexConcept` ⇒ O(n²) admission | k-d tree or maintained top-k over the index |
| `TermCollection.deleteItem` (`term-collection.ts:57`) | O(n) index shift | swap-with-last, plus a tombstone map for the rare indexed case |
| `selectTopN` (`collections.ts:126`) | O(n·k) insertion | bounded min-heap |
| `LruCache` for the term interner (`factory.ts:11`) | delete+set on every read | an interner wants a set, not a recency cache; `touchOnRead: false` is the honest setting |
| `TermMap` key building | `termKey` walked per `set` | key computed once per `set`, not once in `getIndex` and again in `setRef` |

**Acceptance:** every structure named in the table has a test that fails on the current
implementation, then passes.

### W9 — The gate learns to see cost

The budget currently audits 2 of 42 bounded containers and decides boundedness by grepping the
source for `LruCache` and `maxSize` — a string check, so renaming the class passes. `dpdm` is
pinned through `createRequire` with a long comment explaining that an unpinned analyzer makes a
baseline unreproducible, and `productionLOC` shells out to `pnpm dlx cloc` in the same table.

- Pin the LOC counter the way dpdm is pinned, or replace it with an in-process counter that is
  defined by the ledger rather than by a tool's version.
- Replace the textual accumulator check with a real rule. The previous attempt was rejected for
  noise (574 candidates, 302 unpruned) and that rejection was right; the fix is to declare the
  cost-sensitive sites as data, the way the accumulator ledger is, and gate the *declaration* —
  a site on a cycle path must appear in the ledger.
- Add the §3.1 cost model as a ratchet, so the property this plan is about cannot silently lapse.

**Acceptance:** a deliberately unbounded accumulator on a cycle path fails the gate. That is the
test, and it is written first, failing, before the rule exists.

---

## 5. What this is expected to buy

Predictions, to be measured by W0's harness, not promised:

| | measured now | predicted after W1–W4 |
|---|---|---|
| `decayAll` per cycle | 9.0 | 0 on read paths; 1 on the commit timer |
| `memory.sample` per cycle | 8.8 | 0 (index-driven top-k) |
| `forEachConcept` per cycle | 5.0 | 0 (indexed relevance propagation) |
| effective decay rate | `rate × min(sampleSize, N)` | `rate` |
| O(population) ops per cycle | 23 | 0 |
| 300-step rollout, 3 635 concepts | 14.8s | flat in N beyond the working set |
| `concept.priority` writers | 19 | 7 named operations |
| suite critical path | one 70s RL rollout | the benchmark suite, as a gate rather than as the wall |

The rollout number is the one to watch. If it does not flatten as N grows, the cost model in §3.1
is wrong and the work is not done — which is the point of having written it down.

---

## 6. Sequencing

```
W0 ──┬─▶ W1 ──▶ W2 ──┬─▶ W4 ──▶ W5
     │              └─▶ W3
     └─▶ W9 (independent, can run any time after W0)
W6, W7, W8 depend on W0 only; W8 is independent of W1–W5.
```

- **W0** alone, first. Everything else is measured against it.
- **W1** alone, second, with the RL baselines re-established and committed in the same change.
- **W3** can land any time after W0; it is mechanical and it is what makes W2/W4 testable in
  milliseconds rather than through a NAR.
- **W2 → W4 → W5** is the substantive sequence: index, then retrieval, then dispatch.
- **W6, W7, W8** are independent and can be interleaved or deferred without blocking anything.

Land W3 before W2 if the test time is the binding constraint; land W2 before W3 if correctness is.
Either order works, which is the point of W3 existing.

---

## 7. Invariants that must not move

1. **NAL1–8 parity.** Nothing in §4 changes what is derived from what. W5 touches dispatch and
   must be gated on the NAL tests, not on a rewrite of them.
2. **Determinism.** `test:determinism` and `test:hermetic` green at every commit, as today.
3. **`test:load-sensitive` green under full load.** The three load-sensitive files exist because
   timing assertions under contention are unreliable; the new cost work adds *more* timing
   assertions, so the discipline has to get better, not worse.
4. **The complexity budget ratchets downward only.** Every §4 change should lower
   `productionLOC`, and the baseline moves with it in the same commit — which is what the gate's
   own failure message asks for, and what `appendOnlyPersistenceSites` needed in the last pass.
5. **Every accepted workstream is measured before and after by `bench:cycle`,** and the numbers
   go in the commit message. A cost change without a before/after is a refactor.

---

## 8. What is being deleted

Named, so the plan is falsifiable by diff:

- `MemoryScorer`'s `novelty` and `relevance` factors, or the whole class (W2's decision).
- `PREMISE_SOURCES.concepts`, `NoveltySampling`, `DiverseSampling` — all three enumerate the
  population to then discard it.
- The `*:*` bucket in `RuleIndex.candidatesFor`, and its per-miss sort.
- `RuleIndex.hitStats` and the tie-break, unless W5 makes them real.
- `RuleProcessor.stepMemoryScalars`' permanent memo (W6).
- `Stamp.createInput()` from any getter (W1).
- `selectTopN`'s O(n·k) insertion path (W8).
- `Concept.linkedConcepts` / `subConcepts` / `parentConcepts`, and with them
  `SpreadingActivation.prime`, `Concept.updateLinks`, `findOrphanedLinks` — unless W2 populates
  them (W2).
- `Memory.sample` and `Memory.sampleWindow` (W2).
- By-score eviction in `BoundedMap` (W8).
- The `activationDecayRate`-is-also-a-sample-count coupling (W1).

## 9. Not doing

- **The `lm/` subsystem is not a target.** 15 226 lines, 25% of `nar/src`, and the largest
  directory in the tree. It is where §1.8's frozen context lives, and W6 fixes that one line.
  Rearchitecting the LM layer is a separate plan with a different question.
- **The game and RL focus subsystems are not targets.** `game/` (2 713) and `focus/` (1 909) are
  an agent-side apparatus, not the reasoning core, and they are the only reason several of these
  APIs are shaped the way they are. Touching them makes the core changes harder to land.
- **No NAL changes.** Not one. If a §4 workstream appears to need one, that workstream is
  mis-specified.
- **The six workspace packages do not merge.** `util`/`core`/`io`/`metta` boundaries are
  load-bearing and TODO28 spent itself defending them.
- **`bench:cycle` is a script, not a test.** Latency assertions in the default suite are what
  produced every load-sensitive flake in this repo's history.
- **UI untouched.**

## 10. Gates

New, and wired into `pnpm gates`:

- `cost:cycle` — runs `bench:cycle`, fails if any cycle-path operation is declared O(1)/O(log n)
  and measures otherwise. This is §3.1 as a ratchet, and it is the gate that makes W9's
  accumulator work unnecessary to trust.
- `bench:cycle` joins the `slow` tier.

## 11. Reproducing the numbers

The §1 figures came from these. All are cheap to re-run, and re-running them is how a future
session checks that this document is still true.

### 11.1 CPU profile of a 300-step rollout

A standalone tsx script — 20 episodes × 15 steps, `BanditGame`, `maxConcepts: 5000`,
`cpuThrottleMs: 0` — under `node --cpu-prof --cpu-prof-dir=<dir> --import tsx <script>`, then
aggregate self time by `(functionName, file:line)` and separately attribute callers. Nine runs,
report the **minimum**: the median carried 25% more noise than the minimum on a loaded machine.

### 11.2 Per-cycle call counts

Monkey-patch `Memory.prototype.decayAll` / `sample` / `forEachConcept` with counting wrappers,
run 40 `believe` + `run(1)` cycles against the defaults, and divide by 40. Result:
`{ decay: 9.0, sample: 8.8, scan: 5.0 }` at 164 resident concepts.

### 11.3 The decay/sampling coupling

The same harness, varying only `cognitiveParams.inference.maxSampledConcepts` over
{5, 10, 20, 40}. Result is the four-row table in §1.1. This is the single most important
experiment in this document and it takes about a minute to reproduce.

### 11.4 The suite

`pnpm test:unit`, timed, min of two runs in one session. Read the **first** baseline with
suspicion: on 2026-09-30 an early run read 150.9s and a clean re-measurement of the same commit
read 90.6s, because the machine was carrying someone else's load. Two runs in one session, or
the number is not a number.
