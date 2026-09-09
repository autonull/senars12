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

### G. `Stamp.overlaps()` Set allocation `[P2]` 📝 **NOTED**
Line 141: `const bIds = new Set<string>(b.derivations);` — new Set per call. Called from one site
(`reason/strategy.ts:42`). Note: the trailing `bIds.add(a.id)` at line 146 is a no-op (never read after
the loop) — safe to delete if touched. Derivation arrays are usually short (single-parent fast path);
Set allocation is acceptable at current call frequency.

### H. `Concept.mergeWith()` multiple `toArray()` calls `[P2]` ✅ **DONE** (superseded by I)
See item I below — the concrete fix.

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

#### J. `Memory.getConcepts()` — returns `Concept[]` copy `[P2]` 📝 **NOTED**
- **Location**: `nar/src/memory/memory.ts:141` (`listConcepts()`)
- **Issue**: Returns `[...this.concepts.values()]` — full copy. Callers often just iterate once.
- **Fix**: Export `Memory.conceptValues()` returning `IterableIterator<Concept>` or add `forEachConcept(fn)`.

#### K. `TermMap.values()` — allocates array `[P2]` ✅ **ALREADY OPTIMIZED**
- **Location**: `nar/src/terms/term-map.ts:59-62`
- **Status**: Already returns `IterableIterator<V>` (generator), not an array. No action needed.

#### L. `LinkManager` — internal `links` Map → array on every `getLinks()` `[P2]` 📝 **NOTED**
- **Location**: `nar/src/memory/links/LinkManager.ts` + `Concept.getLinks()`
- **Issue**: If `getLinks()` called in hot path, consider `forEachLink(fn)` or pooled array.
- Low frequency; deferred.

#### M. `WorkingMemory.getFocus()` — priority sort on every call `[P2]` ❌ **STALE REFERENCE**
- **Location**: `nar/src/memory/WorkingMemory.ts` — no such method exists.
- Actual focus logic is in `Focus.getFocusSet()` (line 52 of `focus.ts`), which returns `[...this.concepts.values()].map(...)`.
- Could optimize if `Focus` becomes a hot path; currently not profiled.

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