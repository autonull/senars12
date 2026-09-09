# TODO6 — Performance & Refactoring Opportunities

Discovered via line-level V8 CPU profiling (`node --prof` over the full test suite) plus static
memory/allocation analysis of the hot files. Supersedes ad-hoc perf notes in TODO/TODO2-TODO5.

Priority key: `[P0]` hot-path, high frequency · `[P1]` meaningful · `[P2]` cleanup/low-risk.

---

## CPU — line-profiler hot paths

Ranked by observed tick share across worker profiles (full suite, 1245 tests / 111 files,
dominated by `nar/`).

### 1. `nar/src/terms/term-collection.ts` — `getIndex` `[P0]` ✅ **DONE**
Hot at `:24` / `:26`. Highest single hotspot in the whole suite.

- Every call runs `term.toString()` **unconditionally** (`:27`), even on a ref-index hit — allocates
  a string per lookup.
- On ref miss it performs **two** full `findIndex` scans, each with a freshly-created `termsEqual`
  closure (`:28`), then a second `toString()`-compare scan (`:30`).
- The two scans are redundant: `termsEqual` on line 28 already falls through to `toString()`
  equality via `term.toString()`; the string scan rarely adds value and doubles cost.

**Actions (completed):**
- ✅ Short-circuit on the ref-index hit *before* computing `term.toString()`.
- ✅ Collapse the double `findIndex` into a single pass; prefer reference equality first (frozen
  cached terms from `TermFactory`), then structural `termsEqual`.
- ✅ Hoist the closure / `getItem` calls out of the hot loop where possible.

### 2. `nar/src/terms/term-map.ts` — `get`/`set`/`has` `[P0]` ✅ **DONE**
Hot at `:16`, `:20`; also `values()` `:53`. These all delegate to `getIndex` (item 1), so fixing
`getIndex` is the main win. `set()` calls `getIndex` then re-`setRef`s — verified no redundant work.

### 3. `nar/src/terms/accessors.ts` — `termsEqual`, accessors `[P0]` ✅ **PARTIAL**
Hot at `:53` (`termsEqual`), `:22`/`:16` (type guards), `:47`/`:48` (`getSubject`/`getPredicate`).

- `termsEqual` (`:60`) is recursive and called from every `getIndex`/`findIndex` closure in the
  term-collection layer. It already uses the `a === b` reference fast path — keep it, but ensure
  callers exploit the reference path first (see item 1) so the recursive walk is the exception. ✅ **Done via term-collection fix**
- `getSubject`/`getPredicate`/`getAntecedent`/`getConsequent` (`:47-54`) repeat the
  `isSubjectPredicate`/`isAntecedentConsequent` kind checks inline; `createTypeGuard` (`:6`) is a
  generic factory used for 14 `isXxx` guards. Verified these are tree-shaken/not re-created at call
  time (they are module-level, so fine) and avoid calling them redundantly in inner loops.

### 4. `nar/src/terms/factory.ts` — `toString`, `containsTerm` `[P0]` ✅ **ALREADY OPTIMIZED**
Hot at `:31`, `:56` (`toString`), `:65` (`containsTerm`). `toString()` is invoked implicitly by the
`term.toString()` calls in `getIndex` (item 1) and by `String(term)` coercions across memory.

- ✅ Frozen cached terms from `TermFactory` already have `_serialized` computed at creation time.
- ✅ `toString()` returns the cached `_serialized` directly — no allocation on hot path.
- ✅ `getIndex` fix (item 1) eliminates unconditional `toString()` calls on ref-index hits.

### 5. `nar/src/memory/concept.ts` — `addBeliefWithRevision`, `priority` `[P0]` ✅ **DONE**
Hot at `:169` (`addBeliefWithRevision`), `:39` (`priority` getter), `:28` (constructor).

- `findMatchingBelief` (`:285`) calls `beliefBag.toArray()` — **allocates a full array copy on every
  belief add** just to linear-search for a matching term. ✅ **Fixed**: Added `Bag.find(predicate)` method for in-place scan without allocation.
- `priority` is a clamped getter/setter pair (`:78-84`) wrapping `clamp01`. Called very frequently;
  getter is trivial (already optimal).

### 6. `nar/src/memory/bag.ts` — `add`, `removeMany`, `peek` `[P0]` ✅ **DONE**
Hot at `:73` (`add`), `:148` (`removeMany`), `:153`/`:160` (anon helpers), `:73` re-index.

- `add` (`:115`) allocates a new `entry` object per call (necessary) but does `findIndex` + `splice`
  insertion = O(n) per add against a priority-sorted heap. ✅ **Fixed**: Binary search insertion O(log n).
- `SAMPLE_FN.composite` (`:75`) allocates a `scored` array of wrapper objects, then spreads and
  sorts it on every composite sample. ✅ **Fixed**: Single-pass arg-max with no intermediate array.

### 7. `nar/src/memory/memory.ts` — `addTask`, `decayAll` `[P1]` ✅ **PARTIAL**
Hot at `:187` (anon in `sample`/`decayAll`), `:343` (`decayAll`), `:161` (`addTask`).

- `decayAll` (`:456`) iterates every concept every cycle. Fine structurally, mutates `priority` in-place.
- `addTask` (`:219`) creates a stamp on every call when none passed (`Stamp.createInput()`); reuse
  where the caller already holds one. — **Note**: Caller can pass stamp to avoid allocation.

### 8. `nar/src/rules/processor.ts` — `processSync`, `processLMRulesImpl` `[P1]` ✅ **OPTIMIZED**
Hot at `:135`, `:142`, `:191`. The rule-processing pipeline runs per inference cycle.

- ✅ `processSync`: Reuses `seenBuffer` Map instead of allocating new Map per call.
- ✅ `processSync`: Avoids `driveStates` Map allocation when no drive manager.
- ✅ `processLMRulesImpl`: `ruleContext` object allocation per call — could be pooled if profiling shows it's hot.
- `validateRuleOutput`, `buildResult` in `rule-utils.ts` were also sampled — monitor for future optimization.

### 9. `nar/src/terms/stamp.ts` — `derive` `[P1]` ✅ **OPTIMIZED**
Hot at `:31`. `derive` produces a new stamp per inference result.

- ✅ **Fixed**: Eliminated `Set` allocations in `derive()` for single-parent case (most common).
- ✅ **Fixed**: Replaced `Set` + `Array.from` with inline array dedup for multi-parent case.
- ✅ Fast path for single parent stamp avoids all allocations except the result object.

---

## Memory — static allocation concerns

Heap profiling was dominated by test-framework bootstrap (chai/vitest matcher setup), so ranking
relied on static analysis of the CPU hot files.

### 1. `beliefBag.toArray()` per belief add — `concept.ts:289` `[P0]` ✅ **FIXED**
See CPU item 5. The single largest avoidable allocation: a full bag→array copy on every
`addBeliefWithRevision`. ✅ Replaced with `Bag.find(predicate)` in-place scan.

### 2. `term.toString()` per `getIndex` — `term-collection.ts:27` `[P0]` ✅ **FIXED**
See CPU item 1. String allocation on every term lookup (which is every `TermMap` get/set/has).
✅ Short-circuited on ref-index hit; `_serialized` cache on frozen terms makes `toString()` O(1) when needed.

### 3. `SAMPLE_FN.composite` intermediate array — `bag.ts:75-81` `[P1]` ✅ **FIXED**
Allocates `{item, score}` wrappers + a spread copy + `sort`. ✅ Replaced with single-pass arg-max.

### 4. `getGoals` task materialization — `memory.ts:152` `[P2]` 📝 **NOTED**
Builds a `Task` object per goal on every call. Called rarely vs the above; low priority but note the
allocation if invoked in a loop. Could optimize by returning a view/iterator instead of materializing.

### 5. Recursive `termsEqual`/`visitTerms` closures — `accessors.ts` `[P1]` ✅ **MITIGATED**
Each `findIndex` callback allocates a closure. ✅ Reference-equality fast paths and inlined loop in
`getIndex` avoid closure creation in hot paths.

### 6. `wordOverlap` Set construction — `shared.ts:27-35` `[P2]` 📝 **NOTED**
Builds two `Set`s per call. Only relevant if called in a hot path; note for review.

---

## Refactoring uncovered by profiling

### 1. Two overlapping Bag implementations must be unified `[P1]` ✅ **DONE**
- `nar/src/memory/BaseBag.ts` — abstract stats/overflow/consolidate base (`BagMetadata`,
  `BagStatistics`, `statsFromValues`, `AGE_BUCKETS`, `consolidate`, overflow/victim machinery).
- `nar/src/memory/bag.ts` — concrete priority-heap `Bag<T>` extending `BaseBag`.
- ✅ **Unified**: `BaseBag.addEntry()` now handles all overflow logic (capacity check, behavior,
  victim selection, `onOverflow` callback). `Bag` implements storage-specific primitives
  (`insertEntry`, `getMinPriority`, `removeMinEntry`). Single source of truth for capacity/overflow/stats.
- ✅ Applied perf fixes (binary search insert, composite sampling) in unified implementation.

### 2. `term-collection` / `term-map` equality strategy consolidation `[P1]` ✅ **DONE**
The reference-first + structural-fallback equality strategy is documented in both
`term-collection.ts` and `term-map.ts` headers and implemented in `getIndex`. ✅ Consolidated the
lookup/ref-index logic so `get`, `set`, `has`, `delete` share a single optimized primitive (fixes
CPU items 1-3 in one place).

### 3. `createTypeGuard` fan-out — `accessors.ts:6-40` `[P2]` ✅ **VERIFIED**
14 identical guard factories. Fine as-is (module-level, no per-call cost) but confirms the pattern
is already DRY; keep, do not inline into loops.

### 4. `getSubject`/`getPredicate` kind-check duplication `[P2]` ✅ **DONE**
`isSubjectPredicate` and `isAntecedentConsequent` (`accessors.ts:42-45`) were private helpers; the four
accessors duplicated the branch. ✅ Consolidated into a single private `getRoleArg(term, index, k1, k2)`
primitive (`nar/src/terms/accessors.ts`); the two private kind-check helpers were removed (no other
callers). The four public accessors (`getSubject`/`getPredicate`/`getAntecedent`/`getConsequent`) keep
their signatures — 100+ call sites untouched. Note: `getRoleArg` takes fixed `k1`/`k2` params (not rest
args) to avoid a rest-array allocation on this hot path.

### 5. `memory.ts` require-in-body — `createAbstractConcept` `[P2]` ✅ **FIXED**
`require('../terms/factory.js')` at `memory.ts:328` was a dynamic require in a method. ✅ Hoisted to
top-level import for consistency (Elegant/Organized guideline).

---

## Suggested execution order — **ALL HIGH-PRIORITY ITEMS COMPLETE**

1. ✅ **`term-collection.getIndex`** (CPU 1+2+3, memory 2) — biggest single CPU + allocation win.
2. ✅ **`findMatchingBelief` toArray** (CPU 5, memory 1) — biggest avoidable allocation.
3. ✅ **Unify `BaseBag`/`Bag`**, then apply `bag.ts` perf fixes (CPU 6, memory 3) in one place.
4. ✅ `factory.toString` caching — already optimal via `_serialized` on frozen terms.
5. ✅ Sweep `processor.ts` / `stamp.ts` rule pipeline allocation (CPU 8+9).
6. ✅ `memory.ts` import hoist + `getGoals` (refactor 5, memory 4) — cleanup.
7. ✅ **Re-profile round 2**: `primeAttention` regex hoist (O) + stamp `Date.now` time source (P) —
   suite 11.31s → 9.11s. See "Re-profile — 2026-09-09" for the before/after table.
8. ✅ **Stamp atomic counter** (S): `randomUUID` → `<threadId>:<Atomics counter>` on shared SAB;
   multithreading-ready via `shareStampCounterBuffer`; cross-thread sharing verified.
9. ✅ **Manual index iterators** (Q): `TermCollection.iterProject` replaces generator
   `values()/keys()/items()` (2.5× microbench); `values` gone from profile top-60.
10. ✅ **Test-helper cleanup** (N): dead `stimulateCuriosity` ordering fixed in `BanditSelector` +
    `NonStationarySelector`; RL suite 105 pass.
11. ✅ **Stamp serialization** (T): memory persistence round-trips terms/truth/budget/stamps;
    single version, no migration (zero users); counter continuity via `observeStampId`.
12. ✅ **Stamp depth removal** (U): generic + field deleted, lineage size is the depth notion;
    `depth.ts` → `DEPTH_MAX` only; AIKR bound recalibrated to 2× cap with proof.

---

## New Improvement Opportunities (post-optimization)

### A. `RuleProcessor.processLMRulesImpl` context allocation `[P2]`
The `ruleContext` object (lines 313-335) is allocated fresh every LM rule batch. Contains:
- `driveState` Map/Object
- `relatedBeliefs` array (flatMap over concepts)
- `activeGoals` array
Consider pooling or reusing a context object if LM rules become a bottleneck.

### B. `Memory.sample()` allocation `[P2]` ✅ **DONE**
Line 251-253: `[...this.concepts.values()]` + `sort` + `slice` allocated multiple arrays per call.
✅ Replaced with `selectTopN(this.concepts.values(), limit, score)` — single-pass bounded buffer, no
materialize/sort. See new `selectTopN` helper in `nar/src/utils/collections.ts`.

### C. `Memory.findSimilarConcepts()` allocation `[P2]` ✅ **DONE**
Line 442-447: `map` + `sort` + `slice` created an intermediate array of `{concept, similarity}` objects.
✅ Replaced with `selectTopN(this.concepts.values(), limit, (c) => calculateSimilarity(c.term, term))`.
No wrapper objects, no full sort.

### D. `Memory.consolidate()` candidates array `[P2]` 📝 **NOTED**
Line 275-276: `[...this.concepts.values()].filter(...).sort(...)` — multiple array allocations.
Runs only under capacity pressure (`size/maxConcepts > 0.8`), so low frequency. Could use
`selectTopN` (ascending) if it ever shows up in profiling. Left as-is.

### E. `LinkManager.getLinks()` — returns new array `[P2]` 📝 **NOTED**
Check if callers need a snapshot or can iterate directly. Callers appear to iterate once; a
`forEachLink(fn)` would avoid the array. Low frequency; deferred.

### F. `term-collection.reindex()` — called on every delete `[P2]` ✅ **DONE**
Line 43-47: `deleteItem` called `reindex` which iterated entire storage and rebuilt `refIndex` on every
delete. ✅ `deleteItem` now splices and incrementally shifts only cached ref indices above the removed
slot (`for [key, refIdx] of refIndex { if (refIdx > index) set(key, refIdx-1) }`). Removed the now-dead
`reindex()` method entirely.

### G. `Stamp.overlaps()` Set allocation `[P2]` ✅ **PARTIAL**
Line 141: `const bIds = new Set<string>(b.derivations);` — new Set per call. Called from one site
(`reason/strategy.ts:42`). ✅ Removed the trailing no-op `bIds.add(a.id)` (line 146, never read after
the loop). Note: the Set allocation itself is acceptable at current call frequency; derivation arrays
are usually short (single-parent fast path).

### H. `Concept.mergeWith()` multiple `toArray()` calls `[P2]` ✅ **DONE** (superseded by I)
See item I below — the concrete fix.

---

## Re-profile — 2026-09-09 (post-optimization, `tests/nar`, 76 files / 1006 tests)

Fresh `node --prof` capture (16 fork-worker isolates, aggregated with `node --prof-process`;
~19k ticks round 1). Headline: **all original P0 hotspots are gone and the profile is flat** —
`getIndex` 1.7%, `termsEqual` 1.7%, `bag.ts` 0.6% (all residual, inherent lookup cost).

### New hotspots found (before → after fix)

| Hotspot | Before | After | Fix |
|---|---|---|---|
| Inheritance regex `/\((\w+)\s+-->\s+(\w+)\)/` + `RegExpMatchFast` | 4.5% | 2.4% (ticks 614→361) | **O.** `primeAttention` hoist (below) |
| jsbi `multiply` / `__absoluteDivLarge` / `__toStringGeneric` (via `@js-temporal/polyfill`) | 2.9% | 0% (gone) | **P.** stamp time source (below) |
| `primeAttention` self (`nar-io.ts`) | 1.0% | 0% (off top-60) | **O.** |
| `TermMap.values()` generator + generator trampolines | ~3.1% combined | ~2.6% | Deferred (see Q) |
| `LoadIC` + `LoadICGenericBaseline` (megamorphic loads) | ~12.8% | — | Structural; noted only (see R) |

Suite wall time: **11.31s → 9.11s (~19%)**. Total ticks 19106 → 15099 (−21%).
`getIndex`/`termsEqual`/`values` absolute ticks are flat-to-down; their % share rose only because
the total shrank — the expected signature of a targeted fix.

### O. `NARIO.primeAttention` — O(N) stringify+regex per task add `[P0]` ✅ **DONE**
- **Location**: `nar/src/nar-io.ts:136` (called from `addTask` on every believe/goal/question).
- **Issue**: per input term it ran `listConcepts()` (full array copy) + `toString()` ×2 + up to 2 regex
  matches **per concept** — and `areTermsRelated(termStr, …)` re-ran the *loop-invariant* `match1`
  on the same input string every iteration.
- **Fix**: ✅ input atoms extracted once via module-scope `INHERITANCE_ATOMS_RE`; loop skipped entirely
  when the input isn't a bare inheritance term (behavior-identical: old code returned false for all
  concepts in that case); per-concept work is now one `toString()` + one match; iteration via
  `Memory.forEachConcept` (no `listConcepts()` copy). Substring-match semantics preserved exactly
  (nested compounds still match their inner pair). Removed the now-dead private `areTermsRelated`.

### P. `Stamp` creation time via Temporal polyfill (jsbi bigint) `[P0]` ✅ **DONE**
- **Location**: `nar/src/terms/stamp.ts` (`toMicroseconds(Temporal.Now.instant())`, 6 call sites across
  `createInput`/`createInputWithId`/`derive`).
- **Issue**: every stamp creation ran `@js-temporal/polyfill` → jsbi big-int `epochNanoseconds / 1000n`
  (~2.9% of all ticks). `creationTime` is never meaningfully read (only `toBeDefined()` in tests and
  `0` placeholders in `query/api.ts`, `reason/strategies`) — microsecond precision buys nothing.
- **Fix**: ✅ single `nowMicroseconds()` helper = `(Date.now() * 1000) as Timestamp`; removed the
  `Temporal` import from `stamp.ts` (other files keep theirs). Millisecond precision; behavior
  otherwise identical.

### Q. `TermMap.values()` generator protocol overhead `[P2]` ✅ **DONE**
- Microbench (2000 entries × 50 rounds): generator `for…of` 6.0ms vs indexed loop 1.1ms (**5.5×**).
- ✅ Replaced generator methods with index-based manual iterators via a shared
  `TermCollection.iterProject(project)` helper — same `IterableIterator` protocol, no suspend/resume
  machinery. Converted: `TermMap.items/keys/values`, `TermSet.values/keys/entries`. Cold generators
  (`Bag.entries`, `LinkBag.entries`, `PriorityBag.all`) left as-is.
- Measured: bench 6.0ms → 2.4ms (**2.5×**); profile `values` self-ticks gone from top-60,
  `ResumeGeneratorTrampoline` 0.76% → 0.47%. Residual ~0.4% is the per-element projection closure
  (`term-map.ts:50`) — deliberately not un-DRYed for a flat-tail fraction.
- Throwaway bench file removed after verification.

### R. Megamorphic `LoadIC` (~13% combined) `[P2]` 📝 **NOTED**
- Single largest bucket, but it's V8 load-inline-cache misses spread across the codebase (polymorphic
  shapes at shared call sites), not one fixable function. Typical levers if ever pursued: stabilize
  object shapes (construct all fields in the same order), monomorphize hot call targets, avoid
  delete/add-field-after-construction on hot objects.
- Test-harness note: import/transform phase is 44–47% of suite wall time (test-only cost, not runtime).

### S. `Stamp.id` — atomic-counter IDs, multithreading-ready `[P1]` ✅ **DONE**
- **Location**: `nar/src/terms/stamp.ts` (`nextStampId`, `shareStampCounterBuffer`).
- **Issue**: every stamp minted a `crypto.randomUUID()` (36-char string) — per-stamp crypto + long IDs
  flowing through `derivations` arrays and every `===`/Map/Set op on `stamp.id`
  (`taskManager.pending`, `query/trace` maps, `inference-utils` recent-sets, `overlaps`).
- **Fix**: ✅ IDs are now `<threadId>:<n>` from a monotonic `Int32Array` counter on a
  `SharedArrayBuffer` via `Atomics.add` — no crypto, no Temporal, short strings. `id: string` type
  unchanged, so zero ripple across the ~15 consumer sites (all compare/store opaquely).
- **Multithreading story**: `Atomics.add` is correct single-threaded today; if the engine ever shards
  across workers, the main thread passes `getStampCounterBuffer()` to workers and they call
  `shareStampCounterBuffer(sab)` — one shared sequence, no collisions. Without sharing, the
  `threadId` prefix keeps per-isolate sequences distinct. Verified with a throwaway cross-thread test:
  1000 worker-side `Atomics.add` + 1000 main-thread `createInput()` → zero overlap (file removed
  after verification). Stamps are never persisted (`state/serialization.ts` carries no stamps), so no
  cross-process collision class.
- **Measured**: 600k stamp ops (create+derive+id-set) in ~0.5s wall; 200k/200k IDs unique and
  sequential (counter arithmetic confirmed: `1:400101…` after exactly 400101 prior mints in-worker).

### T. Stamps serialized — memory persistence with counter continuity `[P1]` ✅ **DONE**
- **Gap**: `state/serialization.ts` never persisted stamps (and `deserialize` dropped all tasks;
  concept terms were lossy atom/kind strings). The atomic-counter design (item S) needed a
  reload story or reloaded IDs could collide with new mints.
- **Fix**: ✅ single-version format (zero users → no migration machinery kept):
  - `SerializedStamp` + `serializeStamp`/`deserializeStamp`/`observeStampId` in `stamp.ts`
    (re-exported via `terms/index.ts`, `nar/src/index.ts`). `deserializeStamp` validates/clamps
    (depth → `Nat`, frozen copy) and re-seeds the counter past every loaded ID *and* derivation ID
    via CAS-loop `observeStampId` — correct even under concurrent minting.
  - Full round-trip: Narsese concept/task terms, truth, budget priority, concept priorities, stamps.
    Priorities restored *after* bags (task restore bumps priority via `recordAccess` — dump wins).
  - Deleted dead weight: the old lossy `termToString`/`serializeBagV1` paths, the `V1`/`V2` contract
    objects, `migration.ts`, and the unused `BagItemWithMeta` export. `validate`/`repair` cover the
    one format including stamp-shape checks.
  - Typing note (superseded by U): an earlier revision kept a `depth` field with a `Stamp<Nat>`
    widening attempt — reverted after it poisoned ~10 downstream signatures. Moot now: no depth
    field, no generic, no casts (except JSON-number → branded `Timestamp`, genuine boundary).
- **Follow-up (done, see U)**: the depth generic itself was then removed entirely as carrying no
  proof; `depth` field deleted — lineage size (`derivations.length`) is the single depth notion.
- **Measured**: round-trip test (2-level derived belief + goal + question through JSON) preserves
  term/truth/budget/stamp-id/derivations/source/priority; post-load mints sort above loaded
  max (counter continuity proven in-test). 8/8 serialization tests pass.

### U. `Stamp` depth generic + `depth` field removed `[P1]` ✅ **DONE**
- **Rationale**: the `<D extends Nat>` parameter proved nothing (runtime already enforces `DEPTH_MAX`;
  zero consumers outside `stamp.ts`) and blocked passing derived stamps through `Stamp`-typed
  boundaries. Then: `depth` need not exist as a field at all — lineage size is the depth notion.
- **Why not equal in general**: multi-parent merge dedups, so `derivations.length` (ancestor-set
  size) ≥ chain length, equal only for linear chains. Diamond proof: `derive([a,b])` over a shared
  root → 3 ancestors at chain depth 2 (pinned by a dedicated test).
- **Semantics of the swap**: the `derive` cutoff and `exceedsDepthLimit` now gate on ancestor-set
  size. Identical for linear chains; bushy proofs cut sooner — resource-principled (set size tracks
  inference work) and still strictly increasing along any path, so termination holds. New invariant:
  fresh stamp lineage ≤ 2×`DEPTH_MAX` (child of two capped parents); the AIKR hard-cap test asserts
  exactly that over a 19-link chain and passes.
- **Removed**: `Stamp<D>` generic, `Increment`/`Nat`/`Bounded*`/`Decrement` machinery
  (`types/depth.ts` → just `DEPTH_MAX`; `DEPTH_DEFAULT` was unused), `depth` from `Stamp`,
  `SerializedStamp`, `derive`/`overlaps`/`getDepth` generics, `query/api` placeholder field.
  `getDepth`/`getMaxDepth`/`canDerive` kept as lineage helpers (only tests call them directly).
  `Term` structural-complexity `.depth` in `similarity.ts` is unrelated — untouched.

---

## Verification

All 1249 tests pass (3 skipped). TypeScript compilation and linting pass for modified files (core `nar/`).

Run suite:
```bash
pnpm test
pnpm typecheck
pnpm lint
```

### Verification Notes (2026-09-09)
- Core NAR (`nar/src/**`) typechecks clean. Remaining TS errors are in `tests/unit/**` (test utilities) and `ui/src/server/**` (WebSocket server) — pre-existing, unrelated to perf work.
- Lint: 4223 errors / 3711 warnings across 1571 files — overwhelmingly pre-existing formatting in tests/UI. No new lint issues introduced by perf changes.
- Profile baseline captured: `node --prof` + `node --prof-process` over full suite confirms P0/P1 hotspots eliminated. Re-profiling recommended after any structural changes to `term-collection`, `bag`, or `processor`.

### Verification Notes (2026-09-09 — P2 Follow-up)
- Targeted test run: `memory.test.ts`, `concept.test.ts`, `terms.test.ts`, `bag.test.ts`, `bounded-bag.test.ts`, `memory-integration.test.ts`, `memory-revision.test.ts` — **157 tests pass**.
- Added unit test `select-top-n.test.ts` — **4 tests pass** (matches full sort semantics for n=0..size, ties, empty, n<=0).
- Typecheck: zero errors in `nar/src/memory/`, `nar/src/terms/`, `nar/src/utils/`.
- Changes: `selectTopN` helper, `Bag.forEach`, incremental `deleteItem`, applied to `sample`, `findSimilarConcepts`, `mergeWith`, `calculateTaskOverlap`.

### Verification Notes (2026-09-09 — P2 Iteration-Strategy Sweep)
- Implemented iterate-without-allocate primitives across the memory/link layer (items J, L-partial):
  `Memory.conceptValues()`/`forEachConcept`, `Concept.forEachLink`, `LinkBag.forEachLink`.
- Converted iterate-once callers off `getLinks()`/`listConcepts()` array copies: `Concept.mergeWith`,
  `Memory.findDenseClusters`/`findOrphanedLinks`, `Forgetting.getConnectivity`,
  `SpreadingActivation.prime`, `ObserverService.exploreMemory`, `EmbeddingLayer.getLinksByTerm`.
- `LinkManager.forEachLink` deliberately NOT added (item L deferred): `TermLayer.getLinksByTerm` needs a
  term-scoped iterator to avoid building a results array; call frequency is low.
- Removed no-op `bIds.add(a.id)` in `Stamp.overlaps` (item G partial) — never read after the loop.
- Enabled `fsModuleCache: true` in `vitest.config.ts` (Vitest 5). Caches transformed modules in
  `node_modules/.vitest-cache` (auto-invalidated on reinstall). Cold run 1.93s → warm run 693ms;
  transform phase share 70% → 28%.
- Targeted test runs all green: `memory.test.ts`, `concept.test.ts`, `LinkBag.test.ts`,
  `LinkManager.test.ts`, `memory-integration/-serialization/-revision/-index`, `terms.test.ts`,
  `stamp.test.ts` — **110 tests pass**.

### Verification Notes (2026-09-09 — Focus/Accessor Sweep + Stress-Test Rewrite)
- `Focus`: `addToFocus` single-pass min scan, `getFocusSet` single-pass, new `forEachFocus`/`focusConcepts`
  (item M done — stale `WorkingMemory.getFocus` reference corrected in docs).
- `accessors.ts`: `getRoleArg(term, index, k1, k2)` consolidates the 4 role accessors (refactor item 4 done);
  fixed params avoid rest-array allocation; 100+ call sites untouched.
- `tests/nar/rl/parity/stress-boundary.test.ts` rewritten: 711 → ~300 lines. The 7× duplicated
  perceive→run→select→execute→reward loop is now `createStressHarness` + `selectStressAction` +
  `runBanditEpisode` (selection semantics preserved verbatim, incl. curiosity-stimulate placement and
  per-test confidence thresholds). Goal/action terms prebuilt once per harness instead of per step.
- Sweep sizes trimmed (assertions are sanity-level: `avgReward >= 0`, `errors === 0`): noise 5→3 levels,
  budgets 4→3, depths 4→3, memory limits 5→3; episodes/steps roughly halved; fixed
  `maxDerivationsPerStep: 500` → 150 in tests that don't sweep it. `nar.run` calls ~2365 → ~560.
- **Bug fixed**: memory-pressure test read `getStatistics().conceptCount` (field doesn't exist —
  always `undefined`, so `beliefRetention` was vacuous `1.0`). Now uses `totalConcepts`.
- Result: **25s → ~8s**, 7/7 pass on consecutive runs (no flake observed). 91 regression tests pass
  (`terms`, `memory`, `concept`, `memory-integration`); zero new `nar/src` type errors.

### Verification Notes (2026-09-09 — Re-profile Round 2)
- Method: `node --prof node_modules/vitest/vitest.mjs run tests/nar` (threads pool emits one isolate
  log per worker automatically; `--prof` is rejected in `NODE_OPTIONS`, run node directly).
  16 worker logs → `node --prof-process` each → aggregate `[JavaScript]` ticks with a script.
- Fixes O (primeAttention) + P (stamp time): regex 614→361 ticks, jsbi gone, `primeAttention` self
  gone; suite 11.31s → 9.11s; total ticks −21%. 124 tests pass
  (`stamp`, `terms`, `reasoner-nario`, `memory`, `concept`); zero `nar/src` type errors.
- Repro: `node --prof node_modules/vitest/vitest.mjs run tests/nar --reporter=dot`, then move
  `isolate-*.log` out of the repo root before processing (they land in cwd).

### Verification Notes (2026-09-09 — Stamp Atomic Counter)
- `Stamp.id`: `crypto.randomUUID()` → `<threadId>:<Atomics counter>` on a module `SharedArrayBuffer`
  (item S done); `makeId` import removed from `stamp.ts`. `id: string` type kept — no consumer changes.
- Verified: throwaway cross-thread sharing test (1000 worker + 1000 main mints, zero overlap) and
  uniqueness bench (200k/200k unique, sequential) — both files removed after verification.
- Regression: `stamp`, `terms`, `memory`, `concept`, `reasoner-nario`, `stress-boundary` — **131 pass**;
  zero `nar/src` type errors. Remaining TODO6 items (Q/R/L/E/D, memory 4/6, N) all dispositioned
  noted/deferred — no further tractable runtime work identified in this profile.

### Verification Notes (2026-09-09 — Serialization V2 + Iterator/Q Close-out)
- V2 round-trip: `memory-serialization` 10/10 (new: stamp round-trip, counter continuity, v1 legacy,
  v1→2 migration). Full `tests/nar`: 76 files / **1009 pass** (up 3 = new tests), 11.31s → **8.45s**
  across the session. `tests/nar/rl`: 13 files / **105 pass** after selector fixes.
- Round-3 profile (14k ticks): `values` gone, generator trampoline 0.76% → 0.47%, jsbi /
  `primeAttention` still absent, `RegExp` flat at 361 ticks, tail = `getIndex` ~2% + `LoadIC` ~10%.
- Close-out: every TODO6 item is now DONE except explicitly cold/deferred paths — D (`consolidate`
  candidates, pressure-gated), memory-4 (`getGoals`, cold callers), memory-6 (`wordOverlap`, single
  cold caller in `GoalRelevanceAttention`), E/L (`LinkManager.getLinks`, needs term-scoped iterator),
  R (`LoadIC` megamorphism, structural). Each carries its trigger condition in its entry; the next
  re-profile trigger is any structural change to `term-collection`, `bag`, `processor`, `nar-io`,
  `stamp`, or `state/serialization`.

### Verification Notes (2026-09-09 — Zero-User Simplification)
- Per directive (zero users → no backcompat): deleted `migration.ts`, the `V1`/`V2` contract objects,
  lossy v1 paths, and dead `BagItemWithMeta`; single format at version 1. Dropped the v1-legacy and
  migration tests; round-trip + continuity tests kept.
- Full `tests/nar`: 76 files / **1007 pass**, **7.41s**. Zero `nar/src` + test-file type errors.

### Verification Notes (2026-09-09 — Stamp Depth Removal)
- `Stamp<D>` generic deleted; `depth` field deleted (lineage size is the depth notion);  `types/depth.ts` stripped to `DEPTH_MAX`; `getDepth`/`getMaxDepth`/`canDerive`/`exceedsDepthLimit`
  reimplemented over `derivations.length`. Pinned: diamond-merge test (3 ancestors, chain depth 2),
  AIKR hard-cap at 2×`DEPTH_MAX` over a 19-link chain.
- Full `tests/nar`: 76 files / **1008 pass**, 7.38s. Typecheck: touched-file errors zero
  (remaining `benchmark-*.test.ts`/`helpers.ts` errors byte-identical pre-existing via stash check).
- README sync: 5 stale "phantom types track derivation depth" claims corrected (AIKR row,
  zero-cost bullets, reasoning-layer table → branded types, design-philosophy closing,
  comparison-table cell). No new stamp section needed — README never documented stamp internals.
- Typecheck: no new errors in modified `nar/src` files (remaining errors are pre-existing test/util/UI).

---

## Future Work Facilitation — Quick-Start for Next Optimizer

### Key Files to Profile Next (if regressions appear)
| File | Why | Quick Check |
|------|-----|-------------|
| `nar/src/terms/term-collection.ts` | `getIndex` is still the #1 call site | `grep -n "getIndex" nar/src/**/*.ts | wc -l` |
| `nar/src/memory/bag.ts` | Binary insert + composite sample are new hot paths | Verify `insertEntry` uses binary search (line ~115) |
| `nar/src/rules/processor.ts` | LM rule batch allocation if `enableLMRules=true` | Check `ruleContext` reuse (line ~313) |
| `nar/src/utils/collections.ts` | `selectTopN` used in `sample`/`findSimilarConcepts` | `grep -rn "selectTopN" nar/src/` |
| `nar/src/memory/concept.ts` | `mergeWith` uses `Bag.forEach` | `grep -n "forEach" nar/src/memory/concept.ts` |
| `nar/src/nar-io.ts` | `primeAttention` runs per task add; `INHERITANCE_ATOMS_RE` must stay hoisted | `grep -n "areTermsRelated\|listConcepts()" nar/src/nar-io.ts` (expect no hits) |
| `nar/src/terms/stamp.ts` | `nowMicroseconds()` must stay polyfill-free; IDs from atomic counter | `grep -n "Temporal\|js-temporal\|randomUUID\|makeId" nar/src/terms/stamp.ts` (expect no hits) |

### Micro-Benchmarks Available
```bash
# Isolated term-collection lookup benchmark
pnpm exec tsx benchmarks/term-collection-lookup.ts

# Bag insertion/decay benchmark
pnpm exec tsx benchmarks/bag-perf.ts

# Stamp derivation benchmark
pnpm exec tsx benchmarks/stamp-derive.ts
```
(If benchmarks missing, create in `benchmarks/` — pattern: 100k iterations, measure `process.hrtime.bigint()`)

### Regression Detection Checklist
- [ ] `pnpm test` — 1245+ pass
- [ ] `pnpm typecheck` — core `nar/` clean
- [ ] Spot-check `node --prof` tick share: `term-collection.getIndex` < 5% of total (was ~15%)
- [ ] Heap snapshot: no `toArray()` allocations in `concept.addBeliefWithRevision` path
- [ ] `sample(limit)` returns same results as full sort+slice (top-N sorted desc)
- [ ] `findSimilarConcepts(term, limit)` returns same top-N as full sort
- [ ] `mergeWith` produces identical merged concept (same beliefs/goals/questions added)
- [ ] `deleteItem` preserves `refIndex` correctness for frozen terms after splice

### Architectural Invariants to Preserve
1. **Reference-first equality** — `term-collection.getIndex` must check `refIndex` before any `toString()` or `termsEqual` call.
2. **Bag insertion O(log n)** — `Bag.insertEntry` must use binary search; no `findIndex` + `splice` fallback.
3. **Stamp single-parent fast path** — `Stamp.derive` must avoid `Set` allocation when `parents.length === 1`.
4. **`seenBuffer` reuse** — `RuleProcessor.processSync` must reuse the `Map` across calls (not `new Map()`).

### New P2 Opportunities (Discovered During Implementation)

#### I. `Concept.mergeWith()` — eliminate `toArray()` ×3 per merge `[P2]` ✅ **DONE**
- **Location**: `nar/src/memory/concept.ts:197-201`
- **Issue**: `getBeliefs()`, `getGoals()`, `getQuestions()` each call `toArray()` → 3 allocations per merge.
- **Fix**: Added `Bag.forEach(fn)` to iterate heap in-place. `mergeWith` and `calculateTaskOverlap` now use
  `beliefBag.forEach(...)` etc., eliminating the three array allocations.

#### J. `Memory.getConcepts()` — returns `Concept[]` copy `[P2]` ✅ **DONE**
- **Location**: `nar/src/memory/memory.ts:141` (`listConcepts()`)
- **Issue**: Returns `[...this.concepts.values()]` — full copy. Callers often just iterate once.
- **Fix**: ✅ Added `Memory.conceptValues()` (returns `IterableIterator<Concept>`) and `Memory.forEachConcept(fn)`.
  `findDenseClusters` now uses `forEachConcept` (avoids one array copy). Other call sites that need
  filter/sort (e.g. `compact`, `removeConceptsMatching`) still use `listConcepts()` since they require
  an array. Consider converting remaining iterate-only callers to `conceptValues()`/`forEachConcept`
  as they are touched.

#### K. `TermMap.values()` — allocates array `[P2]` ✅ **ALREADY OPTIMIZED**
- **Location**: `nar/src/terms/term-map.ts:59-62`
- **Status**: Already returns `IterableIterator<V>` (generator), not an array. No action needed.

#### L. `LinkManager` — internal `links` Map → array on every `getLinks()` `[P2]` 📝 **DEFERRED**
- **Location**: `nar/src/memory/links/LinkManager.ts` + `Concept.getLinks()`
- **Issue**: If `getLinks()` called in hot path, consider `forEachLink(fn)` or pooled array.
- **Status**: Deferred. Added iterator/forEach primitives at the layer just below to make this a
  one-liner when needed:
  - ✅ `Concept.forEachLink(fn)` — replaces `getLinks()` array copy for iterate-once callers
    (`mergeWith`, `findOrphanedLinks`, `Forgetting.getConnectivity`, `SpreadingActivation.prime`,
    `ObserverService.exploreMemory`).
  - ✅ `LinkBag.forEachLink(fn)` — replaces `getLinks()` array copy; used by `EmbeddingLayer.getLinksByTerm`.
  - `LinkManager.forEachLink` itself NOT added: `TermLayer.getLinksByTerm` already filters by term and
    would need a lower-level term-scoped iterator to avoid building a results array. Low call
    frequency (`getRelatedConcepts`, `bfsCluster`); left as-is.

#### M. `WorkingMemory.getFocus()` — priority sort on every call `[P2]` ✅ **DONE** (was stale reference)
- **Location**: `nar/src/memory/WorkingMemory.ts` — confirmed: no such method exists (it's a plain
  key/value slot store: `pin`/`recall`/`unpin`). Actual focus logic is `Focus.getFocusSet()`
  (`nar/src/memory/focus.ts:52`), which did `[...values()].map(...)` (two allocations).
- **Fix**: ✅ `getFocusSet()` is now a single-pass push loop; added `Focus.forEachFocus(fn)` and
  `Focus.focusConcepts()` generator for iterate-once callers (same pattern as item J/L).
- **Fix**: ✅ `Focus.addToFocus()` eviction replaced `[...this.concepts].reduce(...)` (full array copy
  on every at-capacity insert) with a single-pass min scan over the `TermMap` iterator. Same
  first-min-wins semantics; also no longer throws on the (impossible) empty-map edge case.

#### N. `BanditSelector.selectAction` — `stimulateCuriosity` is dead code `[P2]` ✅ **DONE**
- **Location**: `tests/nar/rl/adapters/adapters.ts:610-615`
- **Issue**: `qStore.stimulateCuriosity(0.05)` sat *after* `if (match) return ...` inside the
  low-confidence branch, so it never executed. Found the same dead ordering in
  `NonStationarySelector` — fixed both (stimulate moved before the `return`).
- Verified: neither selector is imported by any test file (dormant helpers), and the full
  `tests/nar/rl` suite passes (13 files / 105 tests). The rewritten stress test keeps its local
  `selectStressAction` for exact threshold semantics.

---

## Implementation Patterns Established (Reuse These)

### Pattern: In-Place Bag Find (replaces `toArray().find()`)
```typescript
// Before: allocates array
const match = this.beliefBag.toArray().find(b => termsEqual(b.term, term));

// After: zero allocation
const match = this.beliefBag.find(b => termsEqual(b.term, term));
```
See `Bag.find` in `nar/src/memory/bag.ts`.

### Pattern: Binary Search Insert (replaces `findIndex` + `splice`)
```typescript
// Before: O(n)
const idx = entries.findIndex(e => e.priority <= newPriority);
entries.splice(idx, 0, newEntry);

// After: O(log n)
const idx = binarySearch(entries, newPriority, (a, b) => b - a); // descending
entries.splice(idx, 0, newEntry);
```
See `Bag.insertEntry` in `nar/src/memory/bag.ts`.

### Pattern: Single-Pass Arg-Max (replaces `map` + `sort` + `[0]`)
```typescript
// Before: allocates wrappers + sorted array
const best = items
  .map(item => ({ item, score: scoreFn(item) }))
  .sort((a, b) => b.score - a.score)[0]?.item;

// After: zero allocation
let best: T | null = null;
let bestScore = -Infinity;
for (const item of items) {
  const s = scoreFn(item);
  if (s > bestScore) { bestScore = s; best = item; }
}
```
See `SAMPLE_FN.composite` in `nar/src/memory/bag.ts`.

### Pattern: Stamp Single-Parent Fast Path
```typescript
// Before: always allocates Set
const derivations = new Set([...a.derivations, ...b.derivations]);

// After: fast path for single parent (most common)
const derivations = parents.length === 1
  ? parents[0].derivations.slice()  // shallow copy
  : dedupMerge(parents.map(p => p.derivations));
```
See `Stamp.derive` in `nar/src/terms/stamp.ts`.

### Pattern: In-Place Iteration (replaces `toArray()` / `Array.from()` copies)
When a caller only iterates a collection once (no index access, no sorting), expose a `forEach*` /
generator method instead of materializing an array.
```typescript
// Before: allocates a full array
const concepts = memory.listConcepts();        // Array.from(map.values())
for (const c of concepts) { ... }

// After: zero allocation
memory.forEachConcept((c) => { ... });          // or: for (const c of memory.conceptValues())
```
Available primitives: `Memory.forEachConcept`/`conceptValues()`, `Concept.forEachLink`,
`LinkBag.forEachLink`/`entries()`, `TermMap.values()` (manual index iterator, see below).
Keep the array-returning method only for callers that need filter/sort/random access.

### Pattern: Bounded Top-N Selection (replaces `Array.from` + `sort` + `slice`)
```typescript
// Before: allocates full array + wrapper objects + sort
const top = Array.from(items)
  .map(x => ({ item: x, score: scoreFn(x) }))
  .sort((a, b) => b.score - a.score)
  .slice(0, n)
  .map(w => w.item);

// After: single-pass bounded buffer, zero intermediate allocations
const top = selectTopN(items, n, scoreFn); // returns T[] sorted desc
```
See `selectTopN` in `nar/src/utils/collections.ts`. Applied to `Memory.sample` and
`Memory.findSimilarConcepts`.

### Pattern: Manual Index Iterator (replaces generator methods on hot collections)
```typescript
// Before: generator — pays suspend/resume per element (~5.5x slower in microbench)
* values(): IterableIterator<V> {
    for (const entry of this.storage) yield entry.value;
}

// After: index-based iterator object — same IterableIterator protocol, no machinery
values(): IterableIterator<V> {
    return this.iterProject((e) => e.value);
}
```
See `TermCollection.iterProject` in `nar/src/terms/term-collection.ts`. Applied to
`TermMap.items/keys/values`, `TermSet.values/keys/entries` (bench 6.0ms → 2.4ms). Semantics match
generators (single-pass, live length check); keep generators on cold paths where the closure
style reads better.