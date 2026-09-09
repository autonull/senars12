# TODO6 — Performance & Refactoring Opportunities

Discovered via line-level V8 CPU profiling (`node --prof` over the full test suite) plus static
memory/allocation analysis of the hot files. Supersedes ad-hoc perf notes in TODO/TODO2-TODO5.

Priority key: `[P0]` hot-path, high frequency · `[P1]` meaningful · `[P2]` cleanup/low-risk.

---

## CPU — line-profiler hot paths

Ranked by observed tick share across worker profiles (full suite, 1245 tests / 111 files,
dominated by `nar/`).

### 1. `nar/src/terms/term-collection.ts` — `getIndex` `[P0]`
Hot at `:24` / `:26`. Highest single hotspot in the whole suite.

- Every call runs `term.toString()` **unconditionally** (`:27`), even on a ref-index hit — allocates
  a string per lookup.
- On ref miss it performs **two** full `findIndex` scans, each with a freshly-created `termsEqual`
  closure (`:28`), then a second `toString()`-compare scan (`:30`).
- The two scans are redundant: `termsEqual` on line 28 already falls through to `toString()`
  equality via `term.toString()`; the string scan rarely adds value and doubles cost.

**Actions:**
- Short-circuit on the ref-index hit *before* computing `term.toString()`.
- Collapse the double `findIndex` into a single pass; prefer reference equality first (frozen
  cached terms from `TermFactory`), then structural `termsEqual`.
- Hoist the closure / `getItem` calls out of the hot loop where possible.

### 2. `nar/src/terms/term-map.ts` — `get`/`set`/`has` `[P0]`
Hot at `:16`, `:20`; also `values()` `:53`. These all delegate to `getIndex` (item 1), so fixing
`getIndex` is the main win. `set()` calls `getIndex` then re-`setRef`s — verify no redundant work.

### 3. `nar/src/terms/accessors.ts` — `termsEqual`, accessors `[P0]`
Hot at `:53` (`termsEqual`), `:22`/`:16` (type guards), `:47`/`:48` (`getSubject`/`getPredicate`).

- `termsEqual` (`:60`) is recursive and called from every `getIndex`/`findIndex` closure in the
  term-collection layer. It already uses the `a === b` reference fast path — keep it, but ensure
  callers exploit the reference path first (see item 1) so the recursive walk is the exception.
- `getSubject`/`getPredicate`/`getAntecedent`/`getConsequent` (`:47-54`) repeat the
  `isSubjectPredicate`/`isAntecedentConsequent` kind checks inline; `createTypeGuard` (`:6`) is a
  generic factory used for 14 `isXxx` guards. Verify these are tree-shaken/not re-created at call
  time (they are module-level, so fine) and avoid calling them redundantly in inner loops.

### 4. `nar/src/terms/factory.ts` — `toString`, `containsTerm` `[P0]`
Hot at `:31`, `:56` (`toString`), `:65` (`containsTerm`). `toString()` is invoked implicitly by the
`term.toString()` calls in `getIndex` (item 1) and by `String(term)` coercions across memory. If a
serialized/cached string form can be stored on frozen cached terms, the repeated `toString()`
allocations collapse.

### 5. `nar/src/memory/concept.ts` — `addBeliefWithRevision`, `priority` `[P0]`
Hot at `:169` (`addBeliefWithRevision`), `:39` (`priority` getter), `:28` (constructor).

- `findMatchingBelief` (`:285`) calls `beliefBag.toArray()` — **allocates a full array copy on every
  belief add** just to linear-search for a matching term. Replace with an in-place scan / indexed
  lookup (the bag already tracks an ordered heap; expose a non-allocating `find`).
- `priority` is a clamped getter/setter pair (`:78-84`) wrapping `clamp01`. Called very frequently;
  ensure the clamping work is not duplicated at call sites and the getter is trivial (it is).

### 6. `nar/src/memory/bag.ts` — `add`, `removeMany`, `peek` `[P0]`
Hot at `:73` (`add`), `:148` (`removeMany`), `:153`/`:160` (anon helpers), `:73` re-index.

- `add` (`:115`) allocates a new `entry` object per call (necessary) but does `findIndex` + `splice`
  insertion = O(n) per add against a priority-sorted heap. If insertions dominate, consider a
  binary-search insert to cut the linear scan.
- `SAMPLE_FN.composite` (`:75`) allocates a `scored` array of wrapper objects, then spreads and
  sorts it on every composite sample. This is a sampling hot path — compute the arg-max in a single
  pass with no intermediate array.

### 7. `nar/src/memory/memory.ts` — `addTask`, `decayAll` `[P1]`
Hot at `:187` (anon in `sample`/`decayAll`), `:343` (`decayAll`), `:161` (`addTask`).

- `decayAll` (`:456`) iterates every concept every cycle. Fine structurally, but ensure the decay
  computation isn't allocating per concept (it mutates `priority`, good).
- `addTask` (`:219`) creates a stamp on every call when none passed (`Stamp.createInput()`); reuse
  where the caller already holds one.

### 8. `nar/src/rules/processor.ts` — `processSync`, `processLMRulesImpl` `[P1]`
Hot at `:135`, `:142`, `:191`. The rule-processing pipeline runs per inference cycle. Look for
per-call object allocation in rule matching / result building (e.g. `validateRuleOutput`,
`buildResult` in `rule-utils.ts` were also sampled).

### 9. `nar/src/terms/stamp.ts` — `derive` `[P1]`
Hot at `:31`. `derive` produces a new stamp per inference result. Check for avoidable allocation in
stamp composition (union of evidential bases).

---

## Memory — static allocation concerns

Heap profiling was dominated by test-framework bootstrap (chai/vitest matcher setup), so ranking
relied on static analysis of the CPU hot files.

### 1. `beliefBag.toArray()` per belief add — `concept.ts:289` `[P0]`
See CPU item 5. The single largest avoidable allocation: a full bag→array copy on every
`addBeliefWithRevision`. Fix first.

### 2. `term.toString()` per `getIndex` — `term-collection.ts:27` `[P0]`
See CPU item 1. String allocation on every term lookup (which is every `TermMap` get/set/has).
Cache string form on frozen cached terms if possible.

### 3. `SAMPLE_FN.composite` intermediate array — `bag.ts:75-81` `[P1]`
Allocates `{item, score}` wrappers + a spread copy + `sort`. Replace with single-pass arg-max.

### 4. `getGoals` task materialization — `memory.ts:152` `[P2]`
Builds a `Task` object per goal on every call. Called rarely vs the above; low priority but note the
allocation if invoked in a loop.

### 5. Recursive `termsEqual`/`visitTerms` closures — `accessors.ts` `[P1]`
Each `findIndex` callback allocates a closure. Prefer reference-equality fast paths and avoid
closure creation inside hot loops (see CPU item 1).

### 6. `wordOverlap` Set construction — `shared.ts:27-35` `[P2]`
Builds two `Set`s per call. Only relevant if called in a hot path; note for review.

---

## Refactoring uncovered by profiling

### 1. Two overlapping Bag implementations must be unified `[P1]`
- `nar/src/memory/BaseBag.ts` — abstract stats/overflow/consolidate base (`BagMetadata`,
  `BagStatistics`, `statsFromValues`, `AGE_BUCKETS`, `consolidate`, overflow/victim machinery).
- `nar/src/memory/bag.ts` — concrete priority-heap `Bag<T>` extending `BaseBag`.
The layering is duplicated and inconsistent: `bag.ts` re-implements overflow logic
(`shouldOverflow` `:269`) that `BaseBag.handleOverflow`/`selectVictim` already provide, and
re-declares stats/`trackX` semantics. There is overlap in `overflowBehavior`, victim selection, and
serialization shapes (`BoundedBagState` vs `BagStats`). **Unify into one coherent bag abstraction**
(one source of truth for capacity/overflow/stats), then apply the CPU/memory fixes (items 6) in the
unified implementation.

### 2. `term-collection` / `term-map` equality strategy consolidation `[P1]`
The reference-first + structural-fallback equality strategy is documented in both
`term-collection.ts` and `term-map.ts` headers and implemented in `getIndex`. Consolidate the
lookup/ref-index logic so `get`, `set`, `has`, `delete` share a single optimized primitive (fixes
CPU items 1-3 in one place).

### 3. `createTypeGuard` fan-out — `accessors.ts:6-40` `[P2]`
14 identical guard factories. Fine as-is (module-level, no per-call cost) but confirms the pattern
is already DRY; keep, do not inline into loops.

### 4. `getSubject`/`getPredicate` kind-check duplication `[P2]`
`isSubjectPredicate` and `isAntecedentConsequent` (`accessors.ts:42-45`) are private; the four
accessors duplicate the branch. Consider a single `getRole(term, idx)` primitive if call sites grow.

### 5. `memory.ts` require-in-body — `createAbstractConcept` `[P2]`
`require('../terms/factory.js')` at `memory.ts:328` is a dynamic require in a method. Hoist to a
top-level import for consistency with the rest of the module (Elegant/Organized guideline).

---

## Suggested execution order

1. **`term-collection.getIndex`** (CPU 1+2+3, memory 2) — biggest single CPU + allocation win.
2. **`findMatchingBelief` toArray** (CPU 5, memory 1) — biggest avoidable allocation.
3. **Unify `BaseBag`/`Bag`**, then apply `bag.ts` perf fixes (CPU 6, memory 3) in one place.
4. `factory.toString` caching if frozen-term string caching is feasible (CPU 4).
5. Sweep `processor.ts` / `stamp.ts` rule pipeline allocation (CPU 8+9).
6. `memory.ts` import hoist + `getGoals` (refactor 5, memory 4) — cleanup.