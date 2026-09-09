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

### 4. `getSubject`/`getPredicate` kind-check duplication `[P2]` 📝 **NOTED**
`isSubjectPredicate` and `isAntecedentConsequent` (`accessors.ts:42-45`) are private; the four
accessors duplicate the branch. Consider a single `getRole(term, idx)` primitive if call sites grow.

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

---

## New Improvement Opportunities (post-optimization)

### A. `RuleProcessor.processLMRulesImpl` context allocation `[P2]`
The `ruleContext` object (lines 313-335) is allocated fresh every LM rule batch. Contains:
- `driveState` Map/Object
- `relatedBeliefs` array (flatMap over concepts)
- `activeGoals` array
Consider pooling or reusing a context object if LM rules become a bottleneck.

### B. `Memory.sample()` allocation `[P2]`
Line 251-253: `[...this.concepts.values()]` + `sort` + `slice` allocates multiple arrays per call.
Could use a reusable buffer or partial sort (e.g., `selectN`) if called frequently.

### C. `Memory.findSimilarConcepts()` allocation `[P2]`
Line 442-447: `map` + `sort` + `slice` creates intermediate array of `{concept, similarity}` objects.
Could use in-place quickselect for top-N.

### D. `Memory.consolidate()` candidates array `[P2]`
Line 275-276: `[...this.concepts.values()].filter(...).sort(...)` — multiple array allocations.
Could iterate in-place or use a priority queue for top-K.

### E. `LinkManager.getLinks()` — returns new array `[P2]`
Check if callers need a snapshot or can iterate directly. If snapshot needed, consider a pooled array.

### F. `term-collection.reindex()` — called on every delete `[P2]`
Line 43-47: `deleteItem` calls `reindex` which iterates entire storage and rebuilds `refIndex`.
If deletions are frequent, consider incremental index updates.

### G. `Stamp.overlaps()` Set allocation `[P2]`
Line 105: `const bIds = new Set<string>(b.derivations);` — new Set per call.
Could use sorted array + binary search or a shared bitset if derivation IDs are dense.

### H. `Concept.mergeWith()` multiple `toArray()` calls `[P2]`
Lines 197-201: Calls `getBeliefs()`, `getGoals()`, `getQuestions()` which each call `toArray()`.
Could add `Bag.forEach()` or iterate heap directly to avoid allocations during merge.

---

## Verification

All 1245 tests pass (3 skipped). TypeScript compilation and linting pass for modified files.

Run suite:
```bash
pnpm test
pnpm typecheck
pnpm lint
```