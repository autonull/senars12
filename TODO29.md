# TODO29: Runtime — the cycle's cost model, and the retrieval engine underneath it

**Version:** 1.3 (2026-09-30) · **Predecessor:** TODO28 (phases A–P; structure, the package graph, the
barrels, the gate list), which closed the structural axis and left the runtime. TODO28's own §4.4
declined to shrink `nar.ts` and §7.11 closed with "what is left" one line long. This is the other
axis: not what the tree looks like, but what a cycle costs and why.

**Status: open.** Nothing here has landed. §1 is the diagnosis and it is measured, not asserted —
every number in it comes from a CPU profile of the inference loop or a counter run against the
live engine, and the commands are in §11 so the numbers can be re-derived rather than trusted.
§2 is the reference architecture. §3 is the target. §4 is the work. §12 is the set of questions a
fresh session should resolve before it starts.

> **A fresh session should read §1.1, §1.10, §4/W0 and §15 first.** §15 says what would make
> this plan wrong, and two of its checks should be run before anything is built.

### The thesis, stated so it can be wrong

> SeNARS is a NAR-like reasoner whose **rule set is a learnable, versioned artifact rather than
> code**, with pluggable producers — one of which is a language model. The core is closed,
> bounded, deterministic, and useful on its own. The model is what makes the rule set grow, and
> the system is better than NAR without it and better than an LM without it.

Every part of that is a claim with a measurement or a gate attached in §10, and the last sentence
names the experiment that could refute it (§12 Q3 — which does not exist yet, and building it is
arguably more important than any workstream in §4).

### What the fourth pass added

An audit of this document against the question "could a fresh session act on this alone?" found
six gaps, and the first was disqualifying for a *seed*.

- **The instrument did not exist.** §11 said "reproduce the §1 findings" and described four
  procedures whose scripts were throwaway. An accurate account of a measurement with no apparatus
  behind it is §1.8's failure mode at the document level. `scripts/cycle-bench.ts` is now
  committed, with a `--selftest` that refuses to print a number it cannot show it measured, and
  it reproduced §1.1 and §11.2 independently on first run.
- **It immediately paid for itself.** `processLMRules` runs **33 times per cycle with
  `enableLMRules: false`** — §3.5's "absent, not disabled" claim, now measured rather than
  asserted, and the row `cost:cycle` will gate on.
- **§11.5 (provenance)** — every number with its date, its commit, how to reproduce it, and
  whether it is load-sensitive. Three are, and they are the ones that will lie to a future session.
- **§11.6** — what was read of NARchy versus inferred from its file listing, with the SHA pinned
  to `f3a9bcc`. The claim that NARchy precompiles inference is *inferred from filenames* and is
  flagged as the least-read load-bearing claim in the plan.
- **§4.0** — a finding → workstream → deletion → gate trace, so a workstream picked up cold can
  see what it is for. Four findings are each closed by exactly one workstream.
- **§14 and §15** — measured versus believed versus unexamined, the risk register, and two stated
  **kill criteria** that should be checked before anything is built.

### What the third pass added

The LM must be **optional**: with none provided the system reduces to NARchy-like capability, and
LM support sits *beyond* the core rather than inside it. That is not a packaging preference, and
this pass is mostly about why.

- **New §3.5** — what "optional" has to mean to be worth anything, what the boundary costs today
  (**36 files** outside `nar/src/lm/` import from it, and `nar/src/strategies/types.ts:1` puts
  `LMRule` in the *strategy extension contract*, so the core's extension points are typed in terms
  of the LM), and why the requirement turns out to be the forcing function for the one
  architectural improvement worth having.
- **New W1b** — move the LM beyond the core. Deliberately *not* a separate letter: the seam and
  the boundary are one change, and you cannot have a core-owned seam interface while the core
  still imports the LM's rule type.
- **§4.1's hardest question is retired.** Whether a background model can survive `test:hermetic`
  was open last pass. If the LM is optional, the hermetic run *is* the no-LM run plus replayed
  fixtures, and the question has an answer by construction.
- **Two new invariants (§7)** — the core has no dependency on the LM, and the no-LM
  configuration passes NAL1–8. **A new gate (§10)** and a **new ledger row (§10.1)**.

The load-bearing consequence, stated once because it changes how §1 should be read: `lm.enabled:
false` and `enableLMRules: false` are **not** optionality. `initializeLMRules` is called
unconditionally at construction (`nar.ts:18`) and every rule is registered via
`facade/index.ts:98`, so the 24 test files and the `FAST_COGNITIVE_CONFIG` preset that set those
flags are all running a fully-constructed LM with execution gated. A component that is present,
wired and registered is not optional, however false its switch is. §3.5 names the two gates that
tell the difference.

### What the second pass added

v1.0 was written from a profile of the tree as it stands, and diagnosed it as an architecture
problem. That diagnosis was half right and half misaimed, and the correction is the most useful
thing in this document.

**The Stream Reasoner — LM asynchronous, reasoner synchronous — was the intended design.** §1's
worst findings are not evidence against it. They are evidence that **nothing in the repository can
tell you when the implementation stops being it.** The intent lives in prose; the gates measure
something else; the closure invariant has no test. So this is not a rearchitecture, it is the
mechanisation of a design that was already correct — which is a much cheaper programme, and the
one §4/W1 now leads with.

Three consequences, and the plan is different because of them:

- **New §1.10** — which of the eight findings survive the split, and which do not. The contract
  violations are architecture-independent and stand. **The profile shares and the §5 predictions
  are measurements of a system in the wrong state, and must be retaken after W1.** Optimising
  against them is how you spend a month making the wrong thing fast.
- **New §3.4 and §4/W1** — the online/offline split, as the spine of §3 rather than one
  workstream among ten, and as the first thing built after instrumentation.
- **New §4.1** — the questions the async design will actually be decided by (backpressure, commit
  semantics, cancellation, and how it survives `test:hermetic`), written down before they are
  answered by accident.
- **New §10.1** — the intent-to-gate ledger. Three architectural intents in this repository are
  prose, one is a string check, and one is mechanical. The pattern generalises past this plan.

Workstreams shift: W0 stays, the old W1–W9 are now W2–W10.

### v1.0's framing, for the record

The one-line version: SeNARS is a *retrieval system that reasons*, and the retrieval half is a
linear scan with a re-computed score. NARchy — and OpenNARS before it — is a *reasoner with an
index*, where retrieval is a table lookup and attention is a maintained order rather than a field
that nineteen places write. Nothing about the NAL has to change to get there. Almost everything in
§4 is a data-structure and ownership change, not a semantics change — with exactly one deliberate
exception, §4/W2, which is called out as such because it moves learned values.

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
389`). Only the third is a clock tick. Moving the other two to the cycle boundary is W2.

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
| 17.1% | `TermCollection` iterator, from `selectTopN`/`decayAll`/`forEachConcept` | §1.1, §1.2 — partly landed as a sweep change, the rest is §4/W3 |
| 12.0% | `get priority` (`concept.ts:90`) | §1.6 — 19 writers, inlined into 3 call sites |
| 8.9% | `RegExp /\((\w+)\s+-->\s+(\w+)\)/` | landed — now `bareInheritancePair` |
| 6.8% | `nar-io.ts` relevance scan callback | landed |
| 4.4% | `SimpleAttention.decay` | §1.1 |
| 4.2% | `MemoryScorer.scoreFor` | §1.3 — allocation removed, collapse not |
| 4.0% | `BoundedMap.#reinsert` (via `LruCache` for the term interner) | §4/W9 |
| 2.4% | `selectTopN` | §4/W9 |
| 2.6% | GC | |

The landed column is the two commits of 2026-09-30: the sweep is now index-based and the regex is
gone, which is worth ~14% on the rollout. Everything in the right-hand "§4" column is the
remaining ~20%, and the ceiling it addresses is the 9× multiplier, not the constant factors.

### 1.10 Which of these survive the split

v1.0 profiled a tree in which the LM sits inside the cycle, so it is worth being explicit about
which findings are properties of the *design* and which are properties of that particular failure
to reach it. This matters because §5 is a prediction table and §1.9 is a profile: if they
are measurements of the wrong state, optimising against them is how a month goes missing.

| § | finding | survives the split? | why |
|---|---|---|---|
| 1.1 | decay rate is `rate × min(sampleSize, N)` | **yes** | nothing about an LM causes a read path to mutate the heap. The LM makes it expensive, not wrong |
| 1.2 | every memory read is a full scan | **yes** | and the split *removes one of the callers* — `processLMRulesImpl:393` — rather than adding one |
| 1.3 | the scorer is decorative | **yes** | no caller ever passed the inputs; the split does not create one |
| 1.4 | eviction measures the wrong resource | **yes** | independent of reasoning architecture |
| 1.5 | `getGoals()` mints a stamp per call | **yes** | a getter that fabricates identity |
| 1.6 | nineteen writers on `priority` | **partly** | the meta / self-optimiser / LM writers leave with the split; the input-path, replay and deserialisation writers do not |
| 1.7 | the growth arithmetic | **yes** | every structure named there is on a path the split leaves running |
| 1.8 | frozen `stepScalars` | **no — resolved by the split** | it exists because LM context needed O(N)+2-sorts 500× a cycle. With the LM out, the memo has no reason to exist and the shadowed `resetMetaBudget` can simply be deleted rather than fixed |
| 1.9 | the profile shares | **no — retake** | a profile of the fused system. Its *ranking* is probably right and its *magnitudes* are not |
| 5 | the prediction table | **no — retake** | same, and the workstream order in §6 is derived from it |

Counting: of the eight findings in §1.1–§1.8, **seven stand regardless of the split** and the
eighth (§1.8) is *resolved* by it rather than needing a fix of its own. §1.9 is a profile, not a
finding, and it does not survive. So the two items in this document that are purely symptoms of
the failed split are both downstream of the split itself.

That is a materially better position than v1.0 implied, and it changes what the plan *is*: not a
redesign, but the mechanisation of a design that was already chosen, plus the repair of a
retrieval substrate that was never the LM's fault in the first place.

The practical instruction is in §6: **build W1, then re-run `bench:cycle` and re-derive the order.**
W0 exists so that this is possible.

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

SeNARS's `Memory` is one class, 646 lines, and it is the *only* one. Making it a port is W4; it is
what allows W3, W5 and W8 to be tested without standing up a NAR.

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

That is checkable, and §4/W10 makes it a gate. Concretely, for a cycle over a working set of `k`
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

### 3.4 The spine: the Stream Reasoner, and the seam it runs through

The cycle above has no LM in it, and that is the point. The Stream Reasoner is the reason the
cycle can be closed, and closing it is what makes every row of §3.1 enforceable. The cycle in
§3.3 is already the intended architecture; §4/W1 is the work of making the tree match it.

```
                       ┌──────────────────────────────────────────┐
   input ──▶ gate ──▶  │  ONLINE REASONER — closed, bounded, sync  │
                       │  deterministic · no LM · no I/O · no wall │
                       │  clock · O(1)/O(log n) per operation       │
                       └───────────────┬──────────────────────────┘
                                       │ commits only
                                       ▼
                            ┌─────────────────────┐
                            │  THE SEAM           │  versioned · diffable
                            │  reaction table     │  validated · revertable
                            │  abstractions       │  gated
                            └──────────┬──────────┘
                                       │ proposes
                                       ▼
                       ┌──────────────────────────────────────────┐
   un-committed ──────▶│  OFFLINE INDUCER — the LM, out of band   │
   derivations          │  bounded queue · own budget · no cycle   │
                        │  participation · every output a proposal │
                       └──────────────────────────────────────────┘
```

Three properties fall out of drawing it this way, and each is a test:

1. **The online reasoner completes even if the LM never answers.** This is the single most
   valuable test in the whole plan, it costs one line, and it is what would have caught §1.8 on
   day one: inject an LM that never resolves, call `run()`, assert the cycle still finishes. If it
   doesn't, the LM is in the cycle. No profiler, no cost model, no architecture review required.
2. **The seam is the only channel.** The reasoner reads committed artifacts and nothing else. This
   is what makes an inducer output *reviewable like a schema migration* rather than deployable only
   as code — and NARchy's rules are code, so this is the axis on which SeNARS is meant to be
   better, not merely different.
3. **The split buys the improvement NARchy cannot have, not just the discipline.** NARchy assumes
   a fixed rule set forever; NAL1–8 is small and hand-written and cannot learn a new inference form
   from experience. Here the rule set is the primary learnable artifact — grown, gated, versioned.
   That is the thesis. Everything else in this document is the cost of being able to state it.

What the seam does **not** do: it does not let the reasoner read the inducer's intermediate state,
and it does not let a proposal land mid-cycle. A proposal applies at a declared boundary — the
next consolidation, or the next episode — or not at all. §4.1 is where that boundary is decided
rather than discovered.

### 3.5 The LM is a plugin, not a feature

The requirement is that SeNARS runs, usefully, with no language model at all, and that the model
sits *beyond* the core. Three properties, and the first is the one that is usually got wrong.

**1. Absent, not disabled.** `lm.enabled: false` and `enableLMRules: false` are not optionality.
Today `initializeLMRules` is called unconditionally at construction (`nar.ts:18`) and every rule is
registered through `facade/index.ts:98`, so the 24 test files and the `FAST_COGNITIVE_CONFIG` preset
that set those flags all run a fully constructed, fully registered LM with only *execution* gated.
A component that is present, wired and registered is not optional, however false its switch is. The
test that tells the difference is trivial to write and does not exist:

```ts
const nar = buildNAR(/* zero plugins registered */);
await nar.run(100);
expect(derivations).toBeGreaterThan(0);   // the core reasons with no LM at all
```

**2. The core has no compile-time dependency on the LM.** This one is currently violated 36 times
over — 36 files outside `nar/src/lm/` import from it. The deepest is not a convenience import:

```
nar/src/strategies/types.ts:1    import type { LMRule } from '../lm/rule/LMRule.js';
nar/src/strategies/types.ts:74   select(rules: LMRule[], context: LMRuleSelectionContext): LMRule[];
```

The core's *strategy extension contract* is typed in terms of the LM's rule type. A strategy can
therefore not be written without naming the LM, and `LMRuleSelector` is one of the five strategy
types. That is the boundary being absent, not merely porous. §4/W1b is the work of inverting it:
the core declares a `Proposal`/`ProposalSource` contract of its own, and the LM becomes a producer
that implements it.

**3. Adding a model is purely additive.** It may submit proposals; it may not change the core's
control flow, and the core may not read its intermediate state. That is §3.4's seam restated as a
layering rule, and it is what makes the no-LM core and the with-LM core *the same program* with a
different set of producers.

```
        ┌───────────── nar (core) ─────────────┐
        │  terms · truth · stamps · memory     │  ◄── nothing here imports the
        │  cycle · reactions · attention        │      induction layer. Ever.
        │                                     │
        │  Proposal / ProposalSource           │  ◄── the seam, declared by
        └───────────────┬─────────────────────┘      the core, in core vocabulary
                        │ implements (optional)
        ┌───────────────▼──────────────────┐
        │  induction provider               │   may be: none · recorded fixture ·
        │  (LM, rule-miner, hand-written)   │   live model · a plain table
        └──────────────┬────────────────────┘
                       │ assembled only in the composition root (src/),
                       │ and it sees the core's public API only
```

This is §3.4's seam drawn as a dependency direction, and the two views constrain each other. A
seam that is only a diagram is a function call; a boundary that is only an import rule is a
convention. Both are needed, and only together do they make the core independent of its
producers.

### 3.6 Why this requirement is the right one

It is worth being explicit that optionality is not a concession, because it is easy to read it as
one — the core is "just" NARchy, and the interesting part is bolted on. It is the reverse:

- **The core becomes falsifiable.** A NARchy-like core can be held to NAR's own standards —
  NAL1–8, determinism, a cost model — and the induction layer earns its place by beating them. If
  the core is inseparable from the model, neither claim can be tested.
- **Optionality is a deployment requirement, not a nicety.** Not every system that wants SeNARS
  can run a model: latency budgets, air-gapped deployments, regulated environments, and the
  deterministic test tier. A core that requires one is unusable in all four.
- **It forces the interface that is the actual innovation.** NARchy's rule set is code, fixed at
  build time, with no extension point at runtime. If the rule set is instead a *versioned artifact
  the core loads*, and producers of that artifact are pluggable, then the improvement over NARchy
  is precisely: **NARS assumes a fixed rule set forever; this treats the rule set as the primary
  learnable artifact.** The model is one producer of it. That capability belongs to the *core*, not
  to the model, and it survives the model's absence.
- **It makes the hermetic tier free.** §4.1's hardest question — how does a background model survive
  `test:hermetic` — answers itself: the hermetic run is the no-LM run plus a recorded fixture
  replayed through the same seam. No gate weakening, no skipped tests, no special-casing.

The requirement and §3.4 are the same requirement seen from two sides. Optionality is what forces
the seam to be an interface rather than a function call, and the seam is what makes optionality
achievable.

---

## 4. The work

Ten workstreams and one sub-phase. **W0 first and separately** — it is the harness that decides
whether the rest worked, and landing it before anything else is what keeps this plan falsifiable.
**W1 second, alone** — it is the split the design always intended, and it is what makes the rest
of the cost model enforceable. **W1b immediately after**, because the seam and the layer boundary
are one change and only the first half of it is testable on its own. §1.10 explains why W1 also
invalidates the workstream order below, which is why §6 puts a profile re-derivation between W1b
and W2.

### 4.0 Which finding justifies which workstream

A workstream picked up cold should be able to see what it is for. This is the trace; if a row
here is empty, that workstream is either unstarted or unjustified, and both are worth noticing.

| workstream | findings it closes | deletes (§8) | gate it enables |
|---|---|---|---|
| W0 | — (makes the rest measurable) | — | `bench:cycle` |
| W1 | §1.8, and the cause of §1.1's cost | `processLMRulesImpl` from the cycle path, `stepScalars`, the shadowed `resetMetaBudget` | hanging-LM test; the `processLMRules` column → 0 |
| W1b | §3.5's properties 1 and 2 | `enableLMRules`, `lm` from the core config schema | `core:no-lm`; the `deps:gate` row |
| W2 | **§1.1** (the decay/sampling coupling), **§1.5** (`getGoals` stamps) | `Stamp.createInput()` from getters | `decayAll` call-site count == 1 |
| W3 | **§1.3** (the scorer), **§1.6** (nineteen writers) | the scorer's two constant factors; `Memory.sample`/`sampleWindow` | `cost:cycle`'s selection rows |
| W4 | enables W3/W5 to be tested in milliseconds | — | — |
| W5 | **§1.2**'s rule-dispatch half | the `*:*` bucket, its per-miss sort, `hitStats` | rule applications per cycle bounded |
| W6 | §1.8's remaining half, §1.2's per-cycle-caller half | the per-cycle `getGoals`/`getStatistics` calls | step cost model |
| W7 | **§1.4** (eviction), §1.7's aggregate | the `totalTasks === 0` candidate filter | memory-pressure monotonicity |
| W8 | **§1.7** in full | by-score `BoundedMap` eviction, `selectTopN`'s O(n·k) | per-structure tests |
| W9 | (unbounded) §1.7's `BoundedMap` scan | the textual `LruCache` check | `cost:cycle`; the cost ledger |
| W10 | the meta-problem of §10.1 | every gate that cannot fail | all of the above |

**§1.4, §1.5, §1.6 and §1.7 are each closed by exactly one workstream.** If one of those is
deferred, its finding is not covered anywhere else, and that is worth knowing before deferring it.

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

**Acceptance:** `pnpm bench:cycle` reproduces §11.1 and §11.2 to within 10%, and the report is
what every later acceptance is measured against. These are the **fused** baseline — §1.10 says
they do not survive W1, and re-deriving them is §6's step between W1b and W2.

**Already done, on 2026-09-30:** the first half. `scripts/cycle-bench.ts` is committed and
reproduces both tables, and its `--selftest` proves each hook observes its own invocation. What
remains is the `bench:cycle` entry in `scripts/lib/gates.ts` and the `cost:cycle` gate itself,
which is W9's last bullet.

**Risk:** none. Pure instrumentation.

### W1 — Close the cycle: the Stream Reasoner split

*The design was already this. This workstream makes the tree match it, and puts a test where the
intent used to be a comment.*

Nothing in §1.8 and none of the `cpuThrottleMs` / `maxRulesPerCycle` / `callTimeoutMs` /
`Promise.all` machinery in the LM path is a design decision — it is the cost of an LM living
inside a cycle that is supposed to close in microseconds. `inferenceController.step(5000, …)` is a
five-second deadline on a step whose unbudgeted cost should be tens of microseconds. That is the
tell, and it is measurable today.

- `applySyncRules` stops calling `processLMRules` (`DefaultDerivation.ts:26`). The cycle does not
  call the LM.
- `processLMRulesImpl` becomes a **proposal producer**, reached from the cycle boundary at most
  once per consolidation, writing to a bounded queue. `await Promise.all` over up to five model
  calls per rule application goes away entirely.
- The proposal artifact is defined before any machinery is built (§4.1). It is data, versioned,
  and validated at the seam.
- §1.8's `stepScalars` memo and the shadowed `resetMetaBudget` at
  `nar-execution.ts:76`/`:116`/`:179`/`:368` are **deleted**, not fixed — with the LM out of the
  cycle there is no reason for the memo to exist.
- `cpuThrottleMs` and `callTimeoutMs` lose their reason to exist. Decide whether they go or
  become properties of the *offline* pass; do not leave them bounding a cycle that no longer
  contains the thing they were written for.

**Acceptance, in order of how cheap they are to check:**

1. **A test that injects an LM which never resolves, calls `run()`, and asserts the cycle
   finishes.** One line, no profiler, and it is the test that would have caught §1.8 on day one.
   It goes in **failing-first**, like §4/W10's.
2. `run()` performs zero LM invocations, asserted with a call counter on the LM port.
3. `run()`'s wall time is independent of whether an LM is configured or what it returns.
4. A proposal that arrives is applied at a declared boundary, or not at all — never mid-cycle.
5. A NAR built with **zero** proposal producers registered still reasons. This is §3.5's
   first property, and it is the cheapest test in the plan after the hanging-LM one.

**Risk: medium, and the only workstream that changes reasoning behaviour** — not because the
derivations change, but because the *timing* of when rules exist changes, so the derivation
*sequence* over a fixed episode changes. This is a different kind of change from W2: W2 moves
learned values, W1 moves ordering. W1 does not touch truth revision, so the NAL parity tests are
the gate and should hold.

**Do not** fold W1 in with W2. Two behaviour changes in one commit is how the first one of them
becomes unreviewable, and W1's whole value is that it is independently verifiable by a one-line
test.

### W1b — Move the LM beyond the core

*Deliberately not a separate letter: the seam and the boundary are one change. You cannot have a
core-owned seam interface while the core still imports the LM's rule type.*

W1 gives the seam an owner. W1b makes the owner the core rather than the LM.

- The core declares `Proposal` and `ProposalSource` in its own vocabulary. A proposal is data:
  a proposed reaction, a proposed abstraction, a proposed weight — never a closure over NAR
  internals, because a closure would re-create the coupling the type boundary just removed.
- `nar/src/strategies/types.ts` stops importing `LMRule`. The five strategy types are re-expressed
  so that a proposal producer is one of them, or is not a strategy type at all (the latter is
  cleaner — selection is a proposal-time concern, not a reasoning-cycle concern, and §1 shows what
  happens when it is the latter).
- `nar.ts`'s unconditional `initializeLMRules` / `LMRules` / `NARLM` / `wireSystemOne`
  (`:18, :34, :48, :55, :268`) become assembly in the composition root (`src/`), which already
  exists for exactly this purpose.
- The 36 imports from `nar/src/lm/` are either inverted (the LM imports the core — already true in
  the other direction in places) or removed because the thing they reached for moved down.
- `lm` leaves the core config schema, on the precedent of `bagSize` and `interactionGuide` in the
  last pass — both of which left the schema for the same reason: an optional component must not
  shape a required one. It becomes plugin configuration, validated where the plugin is assembled.

**Acceptance:**

1. `dpdm` / `deps:direction` extended with a rule that **`nar` core may not import `nar/src/lm/`**.
   This is expressible as data in the existing dependency gate, so it is a one-line addition to a
   ledger rather than a new mechanism.
2. A test asserting the no-LM NAR of §3.5 reasons, green with the LM package deleted.
3. NAL1–8 green with no LM registered.
4. `enableLMRules: false` is gone — replaced by "absent", because a flag that is set on a component
   that is always constructed is a comment (§10.1).

**Risk: medium-high, and it is a large mechanical diff** — 36 files. That is the price of a
boundary that cannot be crossed by accident. The mitigation is that it is *mechanical*: a
dependency inversion with no semantic content, reviewable by compiler rather than by reading.

**Open, and worth deciding before starting (§12 Q8):** whether the LM becomes a seventh workspace
package. That is the only enforcement that cannot be bypassed by a well-meaning import, but it
requires everything the LM reads to be public API, and the LM reads concepts, memory statistics
and derivation chains — i.e. it would force those to be public, which is probably *good* pressure
and definitely a lot of surface. The sequencing that falls out either way is the same: the seam
first (W1), the boundary second (W1b), the package question last, because the interface is not
known until the seam is.

### W2 — Stop read paths from mutating the heap

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
W3 means W3–W9 are measured against a settled reference.
**Do not** fold W2 in with anything else. A behaviour change disguised as a refactor is
unreviewable.

### W3 — Attention becomes an index, not a field

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
**Risk: medium.** Retrieval order changes, so RL results move — but W2 already re-established
them, so the delta here is attributable and must be small. If it is not small, the scorer decision
in this workstream is wrong and that is the finding.

### W4 — `Memory` becomes a port

Split the 646 lines along the responsibilities already listed in §1.2: storage → `ConceptStore`,
per-concept beliefs → `BeliefTable`, links → `LinkStore`, statistics → `Statistics`. Two
implementations to start (`MapConceptStore`, `TieredConceptStore` — hot/working/cold) plus a test
double; the other six NARchy has are not the point.

**Acceptance:** the cycle depends on the port, not on `Memory`; the cycle-path tests construct
their store directly and run in milliseconds.
**Risk: low.** Mechanical, and the boundary is already implied by `MemoryView` (`memory/view.ts`).

### W5 — The premise source stops being a scan

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
**Risk: medium.** Premise sets change, so derivations change. Bounded by W2's baselines.

### W6 — Inference dispatch becomes a table

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

### W7 — The control loop gets a budget

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

### W8 — Bounded is bounded

- Retention becomes policy (recency × frequency) rather than a capacity constant, so a
  high-traffic concept and an abandoned one are not treated the same way.
- A global task-count bound, and `capacityPressure()` accounts for the dominant consumer rather
  than only `concepts.size`.
- `evictUnderPressure`'s candidate filter stops being anti-correlated with pressure: concepts
  must be able to age out while holding tasks, ranked by age × value, and eviction must be able to
  report that it could not free anything rather than returning a silent zero.
- The accumulator ledger grows from 2 sites to the 42 bounded containers in production, and the
  textual `LruCache`/`maxSize` check is replaced by a detection rule that can fail (§4/W10).

**Acceptance:** memory pressure is monotonically related to every bounded resource; a memory at
99% with no evictable concept reports that, rather than reporting success.

### W9 — Retrieval structures stop degrading to scans

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

### W10 — The gate learns to see cost

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

### 4.1 The questions W1 will be decided by

The split is easy to half-do. These are the decisions that a half-done split defers, listed so
that they get answered deliberately rather than by whoever happens to touch the queue first. Each
is a real fork with real consequences, and none of them has an obvious default.

**What is the unit of asynchronous work?** A proposal over what scope — one derivation, one
consolidation window, one episode? This determines what an inducer can usefully do, and it is the
question most worth answering before writing the schema. If the unit is too small the LM is
prompted into trivia; too large and its latency becomes the wall.

**What triggers the inducer?** Not a rate — a *trigger*. Three candidates, and they are not
mutually exclusive: a budget of un-committed derivations has accumulated; a consolidation interval
elapsed; or a salience signal fired. Whichever it is, express the balance as **cycles per
proposal**, which makes it measurable and gateable. "Run the LM every N seconds" is not a
contract; "one proposal per 10 000 cycles of un-committed derivations, dropping the oldest when
full" is.

**What is the backpressure policy when the queue fills?** The LM is slower than the reasoner by
orders of magnitude, so a bounded queue will fill. Drop-oldest is wrong — it drops stale *context*.
Drop-lowest-confidence needs a confidence the proposal format must then carry. Drop-newest is
simplest and probably right initially. **This cannot be left implicit**: a queue with no policy is
an unbounded queue with extra steps.

**What happens to a proposal that arrives referencing evicted concepts?** The memory evicts
(W8/W3); the inducer's input is a past state; the seam validates. The question is whether
validation *rejects* the proposal or *salvages* what still resolves. Rejecting is simpler and
more honest. Say so before the first eviction bug.

**What happens when the reasoner has moved on?** Is a stale proposal still applicable? If
applicability is "at the next consolidation boundary", staleness is bounded and irrelevant. If it
is "whenever", you have reintroduced coupling. **This is the decision that determines whether the
cycle is actually closed**, and it belongs in the schema, not in a comment.

**How does the hermetic run survive this?** — **retired by §3.5, decided rather than deferred.**
A background model call is ambient entropy by definition, which is why this was the dangerous
question last pass. If the LM is optional, the hermetic run *is* the no-LM run, and the with-LM
path is covered by **recorded proposals replayed through the same seam** as a fixture. Neither
gate is weakened and neither is skipped, so the failure mode that produced §1.8 — gates quietly
deferred until they get bypassed — has no room to occur. The `--cognitive-params` replay facility
is the natural home for the fixture.

**What is the proposal format's *version* story?** The one question §3.5 raises and this list does
not yet answer: proposals are a versioned artifact (§3.4), so a run recorded against reaction
table v3 must not be replayed against v4. This is a small, boring, and genuinely hard problem,
and it belongs to whoever writes the schema.

**Is the LM a dependency or a component?** If it is a dependency — the system cannot run without
it — then no deterministic core is possible, the whole cost model in §3.1 is moot, and the gates
in §10 cannot exist. If it is a component, the answer to the question above is "disabled under
hermetic runs". **This one is upstream of all the others** and belongs in §12.

---

## 5. What this is expected to buy

Predictions, to be measured by W0's harness, not promised. **The "measured now" column is a
profile of the fused system and does not survive W1** (§1.10) — treat it as the baseline to beat,
not as the expected shape afterwards.

| | measured now, fused | predicted after W2–W5 |
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

**One row is missing and it is the important one: `LM invocations per cycle`, measured at up to
2 500 (500 rule applications × 5 rules) and predicted at 0.** That is the row that says the
Stream Reasoner exists, and it is a count rather than a duration, so it is cheap and exact.

---

## 6. Sequencing

```
W0 ──▶ W1 ──▶ W1b ──▶ [re-profile] ──┬─▶ W2 ──▶ W3 ──┬─▶ W5 ──▶ W6
                                     │              └─▶ W4
                                     └─▶ W10 (independent, any time after W0)
W7, W8, W9 depend on W0 only; W9 is independent of W2–W6.
```

- **W0** alone, first. Everything else is measured against it.
- **W1** alone, second, and alone for the same reason as W2: each is a behaviour change and each
  must be independently reviewable. W1's acceptance is a two-line test — a hanging LM, and a NAR
  with no producers at all — which makes it the cheapest behaviour change in the plan.
- **W1b** immediately after W1, and before the re-profile: it is mechanical, and finishing the
  boundary while the seam is fresh is cheaper than returning to it.
- **Re-profile between W1b and W2.** Not optional. §1.10 argues that the workstream order below
  was derived from a profile of the wrong architecture; taking it at face value optimises the
  wrong thing. W0's harness exists so this costs one command.
- **W2** alone, third, with the RL baselines re-established and committed in the same change.
- **W4** can land any time after W0; it is mechanical and it is what makes W3/W5 testable in
  milliseconds rather than through a NAR.
- **W3 → W5 → W6** is the substantive sequence: index, then retrieval, then dispatch.
- **W7, W8, W9** are independent and can be interleaved or deferred without blocking anything.

Land W4 before W3 if the test time is the binding constraint; land W3 before W4 if correctness is.
Either order works, which is the point of W4 existing.

---

## 7. Invariants that must not move

1. **NAL1–8 parity.** Nothing in §4 changes what is derived from what. W6 touches dispatch and
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
6. **The core does not depend on the LM.** Neither direction, in the source. `nar/src` core may
   not import `nar/src/lm/`, and the LM layer may not reach into core internals by any route
   weaker than its public API. Enforced by the dependency gate (W1b acceptance 1), not by review.
7. **The no-LM configuration is a real system, not a stub.** It must pass NAL1–8, reason under the
   cost model, and produce derivations with zero proposal producers registered. If removing the LM
   leaves something inert, then the LM was not optional — it was load-bearing — and §3.6's argument
   does not hold. This is the invariant most worth testing, because it is the one that would
   expose the claim as false.
8. **`lm.enabled` and `enableLMRules` disappear** rather than being extended (W1b acceptance 4).
   A boolean on an always-constructed component is a comment, and this repository is full of
   accurate comments about behaviour that is not what they say.

---

## 8. What is being deleted

Named, so the plan is falsifiable by diff:

- `MemoryScorer`'s `novelty` and `relevance` factors, or the whole class (W3's decision).
- `PREMISE_SOURCES.concepts`, `NoveltySampling`, `DiverseSampling` — all three enumerate the
  population to then discard it.
- The `*:*` bucket in `RuleIndex.candidatesFor`, and its per-miss sort.
- `RuleIndex.hitStats` and the tie-break, unless W6 makes them real.
- `RuleProcessor.stepMemoryScalars`' permanent memo (W7).
- `Stamp.createInput()` from any getter (W2).
- `selectTopN`'s O(n·k) insertion path (W9).
- `Concept.linkedConcepts` / `subConcepts` / `parentConcepts`, and with them
  `SpreadingActivation.prime`, `Concept.updateLinks`, `findOrphanedLinks` — unless W3 populates
  them (W3).
- `Memory.sample` and `Memory.sampleWindow` (W3).
- By-score eviction in `BoundedMap` (W9).
- The `activationDecayRate`-is-also-a-sample-count coupling (W2).
- `processLMRulesImpl`'s `await Promise.all` over model calls, from the cycle path (W1).
- `RuleProcessor.stepScalars` and `RuleProcessor.resetMetaBudget` — deleted, not fixed (W1).
- The shadowed `resetMetaBudget` on the `ruleProcessor` port and `NARExecution` (W1).

## 9. Not doing

- **The `lm/` subsystem's internals are not a target.** 15 226 lines, 25% of `nar/src`, and the
  largest directory in the tree. W1 changes *where it is called from* and deletes two lines of it;
  W1b changes *which direction the dependency points*. Neither restyles it. The rule templates and
  the adapters are real work and stay. Making the LM layer itself fast, or better, is a separate
  plan with a different question — and the right time to ask it is after W1, when its cost is no
  longer hidden inside a cycle.
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
  and measures otherwise. This is §3.1 as a ratchet, and it is the gate that makes W10's
  accumulator work unnecessary to trust.
- `bench:cycle` joins the `slow` tier.
- `core:no-lm` — runs the NAL tests and a reasoning episode with **zero** proposal producers, and
  with the LM package removed from the build graph. Green means §7's invariant 7 is mechanical
  rather than aspirational. Cheap, and it is the gate that makes the optionality claim falsifiable.
- `deps:gate` gains a row: `nar` core may not import `nar/src/lm/`. One line in a ledger, and it
  is the only enforcement that cannot be crossed by a well-meaning import.

### 10.1 The intent-to-gate ledger

The pattern that produced §1.8 and most of §1 is not specific to the LM, and it generalises past
this plan. It is: **an architectural intent lives in a doc comment, and nothing in the build can
tell you when the code stops implementing it.** Three of the four gates in this repository are in
that state, and the fourth is the only reason any of them work.

| architectural intent | where it is stated | is it mechanical? | what makes it so |
|---|---|---|---|
| The Stream Reasoner — LM async, reasoner sync | design intent; `cpuThrottleMs` implies the opposite | **no** | W1's hanging-LM test |
| The LM is optional; the core is NARchy-like | nowhere | **no** — and 36 core files import `lm/` | W1b: a `deps:gate` row, and a no-LM NAR that reasons |
| Decay has one owner, on one cadence | nowhere | **no** | W2: count `decayAll` call sites |
| Attention has one owner | nowhere; 19 writers | **no** | W3: seven named operations |
| Every bounded container is bounded | `scripts/lib/accumulator-ledger.ts` | **partly** — a *string* check over 2 of 42 sites | W10: a detection rule, and a failing test first |
| NAL1–8 parity | the NAL tests | **yes** | already works |
| Cost model: no O(population) on a cycle path | nowhere | **no** | W0 + W10's `cost:cycle` |

The rule this suggests, and the one worth taking from this pass even if none of §4 lands:

> **A gate ships with a test that proves it can fail, written before the gate exists.**

Every ratchet in this repository was set *above* its measurement — `productionLOC: 71 333`
against a measured 70 604 — so none of them could have failed in any pass, and all of them were
green. `appendOnlyPersistenceSites` had been reporting its `catch` fallback for the life of the
gate. A gate that cannot fail is a comment, and this repository is full of accurate comments
about behaviour that is not what they say. TODO28 §8.10 reached the same conclusion independently,
which is the encouraging part: the lesson is already in the tree's own history, and the next pass
is to apply it to the *runtime* rather than to the structure.

Two rules that follow, and they are cheap:

1. **When a metric's source can silently fail, that is a defect in the metric, not the source.**
   The broken shell quoting in the persistence grep was a `catch` that returned a plausible number.
2. **A doc comment that explains a bug the code still has is a failing test that was never
   written.** `RuleIndex.ts:132-140` is the clearest example in the tree: a precise, correct
   diagnosis of a comparator collapse, sitting next to the collapse.

## 11. Reproducing the numbers

`scripts/cycle-bench.ts`, committed, `pnpm bench:cycle`. It reports §3.1's cost model as a table
at several population sizes, and it has a `--selftest` that proves each hook observes its own
invocation — because a hook that silently observes nothing produces a table of confident zeroes,
and this repository already has two of those (§1.8). Everything below is a command and its
recorded result.

```
pnpm bench:cycle -- --selftest                              # prove the instrument
pnpm bench:cycle -- --size 500,2000,8000 --repeat 2          # §3.1 table
pnpm bench:cycle -- --knob-sweep --size 5,10,20,40            # §1.1 coupling
node --cpu-prof --cpu-prof-dir=/tmp/cp --import tsx scripts/cycle-bench.ts --size 5000 --repeat 1
```

### 11.1 The §3.1 cost table

Per cycle, at three populations, min of two:

| population | ms/step | derived/step | decayAll | sample | forEachConcept | getGoals | getStatistics | **processLMRules** |
|---|---|---|---|---|---|---|---|---|
| 548 | 3.18 | 100 | **8.20** | **8.00** | **5.00** | 1.10 | 0.10 | **33.00** |
| 2 048 | 5.13 | 100 | **8.20** | **8.00** | **5.00** | 1.10 | 0.10 | **33.00** |
| 5 000 | 43.49 | 100 | **8.20** | **8.00** | **5.00** | 1.10 | 0.10 | **33.00** |

The bold columns are the §3.1 violations: work per cycle that does not shrink when the operation
stops being O(population). `ms/step` climbing 5.13 → 43.49 at `maxConcepts` is the eviction path
engaging, which is §1.4 and §1.7 rather than a surprise.

**The `processLMRules` column is the newest number in this document and it is the worst one.**
Thirty-three LM-rule invocations per cycle, measured with `enableLMRules: false`. The flag gates
*execution*; the selection machinery around it runs regardless. That is §3.5's "absent, not
disabled" claim, measured rather than asserted, and it is the row `cost:cycle` will gate on:
it goes to 0 in §4/W1 and stays there.

### 11.2 The decay/sampling coupling

`--knob-sweep`, varying only `maxSampledConcepts`:

| maxSampledConcepts | population | decayAll per cycle |
|---|---|---|
| 5 | 86 | 5.2 |
| 10 | 139 | 8.4 |
| 20 | 164 | 9.0 |
| 40 | 164 | 9.0 |

A retrieval-breadth knob is a decay-rate knob. §4/W2 should collapse this table to one row, and
that is its acceptance criterion stated as a number.

### 11.3 CPU profile of a 300-step rollout

`node --cpu-prof` over the bench, aggregating self time by `(functionName, file:line)` and
separately attributing callers. Nine runs, report the **minimum**: on this machine the median
carried 25% more noise than the minimum. §1.9's table is the result. **This is the one measurement
that does not survive §1.10** — it is a profile of the fused system, and it must be retaken after
W1 before W2 onward is ordered from it.

### 11.4 The suite

`pnpm test:unit`, timed, min of two runs **in one session**. Read any first baseline with
suspicion: on 2026-09-30 an early run read 150.9s and a clean re-measurement of the same commit
read 90.6s, because the machine was carrying someone else's load. Two runs in one session, or the
number is not a number.

### 11.5 Provenance

Every number in §1 and §11, and what it is worth.

| measurement | value | taken | at | reproducible by | load-sensitive? |
|---|---|---|---|---|---|
| per-cycle work | §11.1 | 2026-09-30 | `eb394d4a` | `pnpm bench:cycle` | low — counts, not times |
| decay/sampling coupling | §11.2 | 2026-09-30 | `eb394d4a` | `--knob-sweep` | low — counts |
| LM invocations per cycle | 33.00 | 2026-09-30 | `eb394d4a` | `pnpm bench:cycle` | none |
| profile shares | §1.9 | 2026-09-30 | `d542d5ee` | `node --cpu-prof` | **yes** — take the min |
| 3 635-concept rollout | 17.3s → 14.8s | 2026-09-30 | `d542d5ee`/`77c4e4f4` | rollouts, min-of-9 | **yes** |
| `test:unit` wall | 90.6s → 75.5s | 2026-09-30 | `d542d5ee`/`77c4e4f4` | `pnpm test:unit` ×2 | **very** — see §11.4 |
| `nar/src` size | 60 757 lines / 513 files | 2026-09-30 | `eb394d4a` | `find nar/src -name '*.ts'` | none |
| core files importing `lm/` | 36 | 2026-09-30 | `eb394d4a` | `grep` (§3.5) | none |
| cycle-budget test | 88.7s → ~6s | 2026-09-30 | `d542d5ee` | vitest, isolated | **yes** |
| NARchy reference | — | 2026-08-25 | `narchy@narchy` @ `f3a9bcc` | see §2 | none |

Two rules this table exists to enforce. **A number with no commit in it is not evidence.** And
**the load-sensitive rows are the ones that will lie to you** — three of them, all measured on a
machine that was carrying someone else's load at some point during this work.

### 11.6 What was read of NARchy, and what was inferred

The reference is `github.com/narchy/narchy` at **`f3a9bcc66a348a8bf7c741aa21485c075f89b070`**
(2026-08-25). Pin that SHA; `main` moves, and a plan that cites a moving tree is a plan whose
evidence expires.

**Read, and quoted from:** `nars/memory/Memory.java` (the 123-line port and its six abstract
methods), `nars/focus/util/PriTree.java` (the priority DAG and its `commit`), `nars/Focus.java`
(`commit`/`_commit`/`commitTime` and the duration-derived cadence), plus the module tree.

**Inferred from the tree listing, not read:** the eight `Memory` implementations' behaviour; the
`deriver/reaction/compile/*` compilers; the `table/` belief-table hierarchy; `control/exec/*`;
`TaskAttention`'s sampling; term interning. §2.5's claim that inference is *precompiled* rests on
the existence and naming of those compilers, not on having read one. **A future session should
verify §2.5 against the source before treating it as established** — it is the load-bearing half
of the argument that SeNARS is behind NARchy on dispatch, and it is the least-read claim in §2.

---

## 12. Open questions for the next session

These are ordered by how much they change the plan. The first three should be answered *before*
W0, because each of them can invalidate work that has not started yet — which is cheaper than
discovering it in W1.

**Q1. Is the LM an episodic learner, an online learner, or both at different rates?** The honest
answer determines the architecture, and conflating the two is most of what produced the current
state. If it is genuinely online — reasoning *with* the model inside the loop — then the cycle
cannot close, §3.1 is unenforceable, §10's gates cannot exist, and this plan is the wrong plan. If
it is episodic or consolidation-time, W1 is exactly right and cheap. **This is the question that
decides whether the rest of the document is sound.**

**Q2. Is the LM a dependency or a component?** A dependency means no deterministic core, hence no
cost gate, hence no way to run the suite reliably — the `todo16-batching` latency assertion in
§11.4 is that problem in miniature. A component means the answer to §4.1's last question is
"disabled under hermetic runs".

**Q3. What is the falsifiable claim?** "NARS plus acquired rules is more capable than either
alone" is a thesis, and a thesis needs an experiment that could come out the other way. Nothing in
the current suite can falsify it: the RL benches assert that SeNARS beats random, not that it
beats a NARS-shaped reasoner with no inducer. If this plan lands and the answer is still
unknowable, it will have been 60 000 lines of very good engineering pointed at nothing.

**Q4. What is the unit of asynchronous work?** §4.1's first question, and the one most worth
settling before the schema is written. Too small and the model is prompted into trivia; too large
and its latency is the wall.

**Q5. Does W3 (attention index) or W4 (`Memory` port) come first?** Either, per §6. The tie-breaker
is whether test wall time or confidence is currently the binding constraint — and given §11.4,
that is measurable in a minute.

**Q6. What happens to the 19 LM rule templates?** W1 relocates the call site and changes nothing
else. Whether the *templates* are the right granularity is a real question that W1 deliberately
does not answer, and it should not be answered by whoever next opens that file.

**Q7. Which of §1.7's structures does W9 actually need?** The table lists six; some may fall out
of W3 and W5 for free once the calls disappear. Re-derive it after W1 rather than working from
this list — the same §1.10 caveat applies.

**Q8. Does the LM become a seventh workspace package?** The only enforcement that cannot be
bypassed by a well-meaning import — and it requires everything the LM reads (concepts, memory
statistics, derivation chains) to be public API. That is probably good pressure and definitely a
lot of surface. Answer after W1, because the interface is not known until the seam exists.

**Q9. What does the no-LM core's built-in reaction table contain?** If the core ships with only
NAL1–8, "reduces to NARchy-like capabilities" is literally true and the claim is modest. If it
ships with more, the claim needs a specification and a test. Either is defensible; leaving it
undecided is not, because the answer determines whether §3.6's falsifiability argument holds.

**Q10. Is the LM the *only* proposal producer we expect?** Designing `ProposalSource` for one
producer is how you get an interface that is really a call site. A rule-miner, a human author, and
a recorded fixture are cheap to name now and expensive to retrofit.

## 13. Pass log

### Fourth pass (v1.3)

- Audited this document as a handoff rather than as prose, against "can a fresh session act on
  this alone". Six gaps, listed above. The serious one was that §11 described a measuring
  apparatus that no longer existed — which is §1.8's failure mode one level up.
- Committed `scripts/cycle-bench.ts` and `pnpm bench:cycle`, so §11 is executable. It reproduces
  §1.1 (8.2 / 8.0 / 5.0) and §11.2 (5.2 / 8.4 / 9.0 / 9.0) on first run, from a different
  implementation than the hand-written scripts that produced the originals.
- Found, by building it, that `processLMRules` runs 33× per cycle with `enableLMRules: false`.
  The flag gates execution; the machinery around it does not run at all. This is the strongest
  evidence yet for §3.5's "absent, not disabled".
- Added §4.0 (finding → workstream trace), §11.5 (provenance and load-sensitivity), §11.6
  (NARchy read-versus-inferred, SHA pinned), §14 (measured / believed / unexamined / inherited
  breakage), §15 (risk register with two kill criteria), and a statement of the thesis at the top.
- **Named the plan's coverage limit:** 14 of 47 `nar/src` directories examined. 33 are not, and a
  session editing one is doing new scope, not finishing this.

### Third pass (v1.2)

- Recorded the requirement that the LM be **optional** and sit beyond the core, and worked out
  what that has to mean operationally. The answer is not a flag: `lm.enabled: false` and
  `enableLMRules: false` are false friends, because `initializeLMRules` runs at construction
  (`nar.ts:18`) and every rule is registered (`facade/index.ts:98`). A component that is wired is
  not optional, and the two tests that tell the difference — a hanging LM, and a NAR with zero
  producers — did not exist.
- Measured the boundary's current cost: **36 files** outside `nar/src/lm/` import from it, and
  `nar/src/strategies/types.ts:1` puts `LMRule` in the strategy extension contract, so a strategy
  cannot be written without naming the LM.
- Added §3.5 and §3.6, and W1b. W1b is a sub-phase rather than a new letter on purpose: the seam
  and the layer boundary are one change, and only the first half is independently testable.
- **Retired §4.1's hardest question.** Whether a background model could survive
  `test:hermetic` was the risk I flagged last pass as most likely to be quietly deferred. If the
  LM is optional the hermetic run is the no-LM run plus replayed fixtures, so the question has an
  answer by construction — which is the clearest single argument for the requirement.
- Added §7 invariants 6–8, the `core:no-lm` and dependency gates, and a ledger row for the
  optionality intent.
- Noted the inversion this exposes: optionality is not a concession, it is what makes the core
  claim falsifiable, and it is the forcing function for the one capability NARchy lacks.

### Second pass (v1.1)

- Established that the Stream Reasoner was the intended design and that §1's findings diagnose a
  failure to reach it, not the design. This moved W1 from "the highest-leverage change" to "the
  design that was always intended, plus the test that was never written", and it is why the plan
  got cheaper.
- Added §1.10 (which findings survive the split), which invalidated §1.9 and §5 as measurements
  and forced a re-profile into §6.
- Added §3.4 (the split as the spine, with the hanging-LM test as its first property) and §4/W1
  as the first buildable workstream.
- Added §4.1: six decisions a half-done split defers, of which the staleness boundary determines
  whether the cycle is actually closed, and the hermetic question determines whether any of it
  survives the gates.
- Added §10.1: the intent-to-gate ledger, and the rule that a gate ships with a test proving it
  can fail. Named two instances — the metrics that fail silently, and the doc comment that
  diagnoses a live bug beside the bug.
- Renumbered W1–W9 to W2–W10.
- Noted that the plan's central mistake was optimising a profile of a system in the wrong state,
  and put the correction in the document rather than in a session that no longer exists.

### First pass (v1.0)

- Profiled the inference loop; eight findings, all measured, seven of them contract violations.
- Read `narchy/narchy` and extracted the port/attention/clock/compiled-dispatch contrast (§2).
- Ten workstreams, a cost model (§3.1), a prediction table (§5), and four reproduction commands
  (§11).
- Diagnosed the fused cycle as an architecture problem, which was half right — see above.

---

## 14. What is measured, what is believed, and what is unexamined

A plan that does not separate these gets them all treated the same way, and a future session
then either re-litigates the measurements or inherits the beliefs as fact.

### 14.1 Measured — do not re-derive

| claim | how it is known | §  |
|---|---|---|
| 8.2 decay passes, 8.0 rankings, 5.0 sweeps per cycle | `pnpm bench:cycle` | §11.1 |
| **33 LM-rule invocations per cycle with `enableLMRules: false`** | `pnpm bench:cycle` | §11.1 |
| decay rate tracks `maxSampledConcepts` | `--knob-sweep` | §11.2 |
| 36 core files import `nar/src/lm/` | `grep` | §3.5 |
| `LMRule` is in the strategy extension contract | `strategies/types.ts:1,74` | §3.5 |
| `initializeLMRules` runs at construction | `nar.ts:18`, `facade/index.ts:98` | §3.5 |
| the scorer's factors are constant on every path | no caller supplies `relatedConcepts`; `lastAccessTime` unread | §1.3 |
| `recordRuleHit` has no callers | `grep` | §1.8 |
| `resetMetaBudget` has no callers; `:368` hits `NARExecution`'s own | `grep` + call resolution | §1.8 |
| `linkedConcepts` is never written outside `mergeWith` | call-site trace | §1.6 |
| the profile's shape | `--cpu-prof`, min-of-9 | §1.9 |

### 14.2 Believed — argued, not established

These are design positions. They are defensible and the plan proceeds on them, but a future
session is entitled to disagree, and should say so rather than quietly inherit them.

| belief | where it comes from | how you would know it is wrong |
|---|---|---|
| Premise retrieval should be **indexed, not scanned** | NARchy's `Memory` is a port with 8 impls and an index per impl (§2.1) | the derivation *quality* falls measurably when indexed retrieval replaces scanning — quality and cost traded, not cost alone |
| Attention should be a **maintained order, not a field** | `PriTree` + a duration-derived commit (§2.2–2.3) | O(k) top-k does not beat an O(N) scan at the working-set sizes the system actually runs |
| Inference should be **compiled, not pattern-matched** | `deriver/reaction/compile/*` — **inferred from filenames, not read** (§11.6) | read the source and find it is not precompiled; this is the least-read load-bearing claim in the plan |
| A NARchy-like core makes the LM **falsifiable** | argument, §3.6 | the no-LM core turns out inert, in which case §7 invariant 7 fails and the argument is void |
| Rule acquisition is the **right** thing to add to NARS | thesis, §3.6 | Q3's experiment comes out negative against a no-inducer baseline |

### 14.3 Unexamined — do not assume the plan is comprehensive

The plan names **14 of the 47 directories** in `nar/src`: `facade`, `focus`, `game`, `kernel`,
`lifecycle`, `lm`, `memory`, `reason`, `rules`, `self`, `state`, `strategies`, `tools`, `utils`.
`nar/src` is 60 757 lines and 25% of it is `lm/`, which this plan deliberately does not examine
beyond the boundary.

**Thirty-three directories were not looked at.** They are not presumed clean and not presumed
broken. A session that finds itself editing one should treat that as new scope and say so, rather
than assuming the diagnosis reaches it. The largest unexamined ones by size are `lm` (15 226),
`game` (2 713), `cognitive` (2 342), `rules` (2 573), `kernel` (2 087) and `focus` (1 909) — of
which only `rules` and `kernel` are touched, and only incidentally.

### 14.4 Known-broken, inherited, not this plan's

Carry these so they are not rediscovered as if they were new:

- **`docs/api/util.md` drifts from its generator** on the unmodified tree — pre-existing before
  this work. `docs:drift` is therefore red independent of anything in §4, and
  `tests/nar/todo20-docs.test.ts` may be the reason.
- **`test:load-sensitive` has a wall-clock assertion** (`todo16-batching`, "judgeBatch processes
  64 queries in single joint pass", asserts < 50 ms) that fails under load and passes in
  isolation. It is the smallest possible illustration of §10.1.
- **`docs/api/nar.md` is regenerated** by this work's commits; `docs/api/util.md` was
  deliberately left at its committed state.

## 15. Risk register, and what would make this plan wrong

The plan has ten workstreams and one thesis. This is the list of ways it fails, so that a failure
is recognised as information rather than as bad luck.

| risk | likelihood | signal that it is happening | response |
|---|---|---|---|
| **W3 makes things worse.** The attention index does not beat an O(N) scan at real working-set sizes, and RL quality drops | **medium** | the `cost:cycle` selection rows do not improve, or retrieval-order changes move the RL baselines by more than noise | the deletion list in §8 is reversible; restore `Memory.sample` and the field. The §8 named-deletions design exists for this |
| **W5 breaks NAL parity.** Compiled dispatch derives something different | medium | the NAL1–8 tests move | W5 is gated on parity specifically, and NARchy's `deriver` is the reference. Stop and re-read before changing anything else |
| **The thesis is negative.** NARS-plus-acquired-rules is *not* better | unknown, and unknowable from inside this repo | Q3's experiment does not exist, or comes out flat | the honest response is to build the experiment (§12 Q3) and publish the result either way. This is the risk that no amount of engineering removes |
| **W1b is a swamp.** 36 files, and the LM reaches into core internals | medium | the diff stops being mechanical and starts having semantic content | W1b is deliberately after W1, so the `Proposal` interface is known. If it is still hard, take §12 Q8 (seventh package) early — a compiler error is a better boundary than a review convention |
| **Cost gates make the suite unusable** | low-medium | `cost:cycle` starts failing on a loaded machine | §10's `bench:cycle` is a script and `cost:cycle` gates on *ratios and counts*, never on absolute milliseconds |
| **The plan is measuring the wrong thing** | **already happened once** | §1.10: §1.9 and §5 were a profile of the fused system | fixed by the re-derivation step in §6. If W1b's profile inverts the workstream order *again*, the model in §3.1 is wrong and that is the finding |

**The kill criteria, stated plainly.** Two things would mean this plan is not the right plan: if
**Q1** resolves to "the LM is genuinely an *online* learner" — the cycle cannot close, §3.1 is
unenforceable and the whole cost model is moot. And if **§7 invariant 7** fails — the no-LM core
turns out inert, which would mean the LM was load-bearing and §3.6's falsifiability argument was
never true. Both are checkable before much is built, and both should be checked first.
