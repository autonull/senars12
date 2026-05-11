# SeNARS12 Development Plan

## Executive Summary

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| **Test Coverage** | ~60% estimated | 90%+ | Missing core component tests |
| **Type Safety** | Severe `any` overuse | Zero `any` | 50+ occurrences |
| **Code Duplication** | 3 similarity calcs, bag mismatch | DRY | Consolidation needed |
| **Error Handling** | `console.error` scattered | Structured errors | Custom error types needed |
| **RLFP Status** | Skeletal JSONL writer | Functional | Deprecate or complete |
| **Memory Management** | Unbounded caches | Bounded with eviction | Factory cache, patternHistory |

---

## 1. CRITICAL: Missing Test Coverage

### 1.1 Core NAR Components (ZERO Tests)

| File | Lines | Issue |
|------|-------|-------|
| `src/nar/nar-execution.ts` | 67 | No tests — core reasoning loop |
| `src/nar/nar-facade.ts` | 73 | No tests — returns `Promise<any>` |
| `src/nar/nar-io.ts` | 95 | No tests — serialization untested |
| `src/nar/stream/pipeline.ts` | ~300 | No tests — backpressure logic untested |

### 1.2 Memory System Tests

| File | Lines | Coverage |
|------|-------|----------|
| `src/nar/memory/memory-index.ts` | 300 | NO tests |
| `src/nar/memory/bounded-bag.ts` | 279 | NO tests (bag.test.ts tests only bag.ts) |
| `src/nar/memory/concept.ts` | 339 | Partial only |
| `src/nar/memory/archive.ts` | ~150 | NO tests |
| `src/nar/memory/consolidation.ts` | ~100 | NO tests |
| `src/nar/memory/scorer.ts` | ~80 | NO tests |
| `src/nar/memory/focus.ts` | ~100 | NO tests |

### 1.3 Self/Metacognitive System (Entirely Untested)

| File | Lines | Issue |
|------|-------|-------|
| `src/nar/self/SelfAnalyzer.ts` | 584 | NO tests + 20+ `any` types |
| `src/nar/self/MetacognitiveMonitor.ts` | ~250 | NO tests + untyped events |
| `src/nar/self/ReasoningAboutReasoning.ts` | ~150 | NO tests |
| `src/nar/self/Metacognition.ts` | ~100 | NO tests |

### 1.4 LM Module (Mostly Untested)

| File | Issue |
|------|-------|
| `src/nar/lm/enrichment.ts` | NO tests — uses `console.warn` instead of structured errors |
| `src/nar/lm/feedback.ts` | NO tests |
| `src/nar/lm/streaming.ts` | NO tests |
| `src/nar/lm/dynamic-rules.ts` | NO tests |
| `src/nar/lm/model-discovery.ts` | NO tests |
| `src/nar/lm/router.ts` | NO tests |

### 1.5 RLFP Module (NO Tests — Skeletal Implementation)

| File | Issue |
|------|-------|
| `src/nar/rlfp/RLFPLearner.ts` | Only appends JSONL, no actual training |
| `src/nar/rlfp/PolicyOptimizer.ts` | Minimal implementation |
| `src/nar/rlfp/RewardModel.ts` | Placeholder gradient computation |
| `src/nar/rlfp/PreferenceCollector.ts` | NO tests |
| `src/nar/rlfp/ReasoningTrajectoryLogger.ts` | NO tests |

### 1.6 Tool System (Insufficient Tests)

| File | Current | Needed |
|------|---------|--------|
| `src/nar/tools/TimerTool.ts` | NO tests | Isolation + cleanup tests |
| `src/nar/tools/ProcessTool.ts` | NO tests | Execution tests |
| `src/nar/tools/SearchTool.ts` | NO tests | Search functionality tests |
| `src/nar/tools/LearnTool.ts` | NO tests | Learning integration tests |

---

## 2. CRITICAL: Type Safety Gaps

### 2.1 SelfAnalyzer.ts — Most Severe (584 lines)

```typescript
// Line 66: monitorState?: any
// Line 154: async getSystemAnalysis(): Promise<any>
// Line 188: private analyzeTermPatterns(concepts: any[]): TermPattern[]
// Line 222-223: private getNeighboringTerms(concept: any): any[]
// Line 238: const monitorState = this.monitor.getMonitorState() as any
// Line 260: const ruleStats = this.metrics.getRuleStats() as any[]
// Line 268: private analyzePerformancePatterns(_metricsSummary: any): any
// Line 276: private analyzeResourceUsage(concepts: any[], _stats: any): any
// Line 286: private analyzeTaskPatterns(): any
// Line 359, 385, 487: (this.nar.memory as any).consolidate?.()
// Line 402: (concept as any).priority = ...
// Line 407-412: Return type Promise<any>
// Line 449: const monitorState = this.monitor.getMonitorState() as any
// Line 472: private async applyCorrections(issues: any): Promise<any>
// Line 541: const ruleStats = this.metrics.getRuleStats() as any[]
// Line 566, 574: Return type any
```

### 2.2 QueryAPI.ts — Memory Typed as `any`

```typescript
// Line 20: private readonly memory: any
// Line 22: constructor(memory: any)
// Line 83, 110: (belief as any).stamp
// Line 170-172: (item as any).stamp, .occurrenceTime, .derived
```

### 2.3 NARFacade — Returns `any`

```typescript
// Line 34: ask(question: string | Term): Promise<any>
// Line 22-23, 27: filter as any for getGoals/getQuestions
```

### 2.4 Other Type Safety Issues

| File | Line | Issue |
|------|------|-------|
| `src/nar/rules/nal.ts` | 159 | `c2.args.some((a2: any) =>` — unnecessary any |
| `src/nar/memory/bounded-bag.ts` | 184 | `objective: any` in sampleStrategies |
| `src/nar/tools/ExplainTool.ts` | 60 | `(this.memory as any).concepts` |
| `src/nar/tools/manager.ts` | 131, 192 | `as any` for tool tags |
| `src/nar/tools/manager.ts` | 50 | `completer: this.completer.bind(this) as any` |
| `src/nar/self/ReasoningAboutReasoning.ts` | 56 | `querySystemState(_query: any): any` |
| `src/nar/self/MetacognitiveMonitor.ts` | 39 | `private nar: any` |

---

## 3. CRITICAL: Code Duplication

### 3.1 Similarity Calculation — IDENTICAL in 3 Locations

| Location | Function | Lines |
|----------|-----------|-------|
| `src/nar/terms/utils.ts` | `calculateSimilarity` | 22-31 |
| `src/nar/memory/memory-index.ts` | `calculateClusterSimilarity` | 288-299 |
| `src/nar/memory/concept.ts` | `calculateTermSimilarity` | 314-323 |

**All three use identical Jaccard similarity pattern:**
```typescript
const thisSymbols = extractSymbols(concept.term);
const otherSymbols = extractSymbols(term);
const intersection = new Set([...thisSymbols].filter(s => otherSymbols.has(s)));
const union = new Set([...thisSymbols, ...otherSymbols]);
return union.size > 0 ? intersection.size / union.size : 0;
```

**Fix**: Extract to single function in `terms/utils.ts`, export and reuse.

### 3.2 Bag Class Hierarchy Mismatch

```
AbstractBag (32 lines)
    └── Bag<T> (45 lines) — extends AbstractBag ✓

BoundedBag<T> (279 lines) — Does NOT extend AbstractBag ✗
    └── Completely different interface
        - add(item, priority) — same signature but different internals
        - Uses heap array instead of items array
        - Has accessLog Map
        - Different overflow behavior implementation
```

**Fix**: Create common `BagInterface<T>` or make `BoundedBag` extend `AbstractBag`.

### 3.3 Rule Pattern Duplication

`nal.ts` and `nal-extended.ts` have similar patterns:
- `analogy` — similar structure
- `comparison` — similar structure
- `revision` — similar structure
- Both use `getSubject`/`getPredicate` extraction

**Fix**: Extract common higher-order inference patterns to `nal-helpers.ts`.

---

## 4. CRITICAL: Error Handling

### 4.1 Empty Catch Blocks / Silent Failures

| File | Line | Issue |
|------|------|-------|
| `src/nar/self/ReasoningAboutReasoning.ts` | 133 | `} catch { // Silently handle }` — swallows all errors |
| `src/nar/task/manager.ts` | 71 | `setTimeout` with no error handling |
| `src/nar/query/api.ts` | 140 | `} catch { return null; }` — silently fails |

### 4.2 Console.error Instead of Structured Error Handling

| File | Lines | Issue |
|------|-------|-------|
| `src/nar/lm/enrichment.ts` | 77, 99, 123, 186 | `console.warn` for failures |
| `src/nar/rlfp/RLFPLearner.ts` | 90 | `console.error` |
| `src/nar/rlfp/PreferenceCollector.ts` | 23 | `console.error` |
| `src/app.ts` | 33 | `console.error` |
| `src/bot/BotSession.ts` | 35 | `console.error` |
| `src/agent/Agent.ts` | 94, 109, 123 | Multiple `console.error` |

**Missing**: Custom error types (`NarRuntimeError`, `ToolExecutionError`, `MemoryPressureError`), structured error logging via eventBus.

---

## 5. CRITICAL: Memory Leaks / Resource Issues

### 5.1 Unbounded Caches

| File | Line | Issue |
|------|------|-------|
| `src/nar/terms/factory.ts` | 7 | `termCache: new Map<number, Term>()` — NO size limit, NO eviction |
| `src/nar/self/SelfAnalyzer.ts` | 92 | `patternHistory = new Map<string, number[]>()` — unbounded |
| `src/nar/lm/enrichment.ts` | 31 | `results: EnrichmentResult[]` — grows forever |

### 5.2 Timer Cleanup

| File | Issue |
|------|-------|
| `src/nar/tools/TimerTool.ts` | Timers created but `unref()` not always called |
| `src/nar/lm/enrichment.ts` | `enrichmentTimer` needs explicit clear on stop |

**Symptom**: "A worker process has failed to exit gracefully" warning.

---

## 6. HIGH: API Design Issues

### 6.1 QueryAPI Memory Typing

```typescript
// Line 20-22: memory typed as 'any' but should be Memory
constructor(memory: any) {
    this.memory = memory;  // Should be: private readonly memory: Memory
}
```

### 6.2 Inconsistent Return Types

| Method | Current Return | Should Be |
|--------|---------------|-----------|
| `NARFacade.ask()` | `Promise<any>` | `Promise<Answer>` |
| `NARFacade.getDerivationHistory()` | `unknown` | `DerivationPath[]` |
| `NARFacade.traceTerm()` | `unknown` | `TraceResult` |

### 6.3 Non-orthogonal APIs

- `NAR.input()`, `NAR.believe()`, `NAR.goal()`, `NAR.question()` — all call same internal method with different type
- `Memory.addConcept()` + `Memory.addTask()` — could be unified

---

## 7. HIGH: RLFP — Deprecate or Complete

### Current State
- `RLFPLearner.optimize()` — just calls `PolicyOptimizer.optimize()` which is minimal
- `RLFPLearner.updateModel()` — only appends JSONL to file
- No actual gradient updates or model training
- README claims "Phase 8 Complete" but implementation is skeletal

### Options
1. **Deprecate**: Mark as experimental, remove from NAR initialization, add `TODO` comments
2. **Complete**: Implement actual RL training loop connected to NAR reasoning
3. **Scaffold**: Keep structure but clearly document as incomplete

**Recommendation**: Option 1 or 3 until properly integrated.

---

## 8. MEDIUM: README / Documentation Corrections

| Claim | Reality |
|-------|---------|
| "~1.5K LOC" | ~15,442 LOC in nar/ alone |
| "100% test coverage" | Core components have NO tests |
| "Term System: 280 LOC" | terms/ subdirectory is much larger |
| "Phase 8 Complete" | RLFP is skeletal |
| "25 inference rules" | Actually 20 in nal.ts + ~20 extended |

### Missing Documentation
- [ ] API reference for NAR class public methods
- [ ] Tool creation guide
- [ ] LM client integration guide
- [ ] Migration guide

---

## 9. MEDIUM: Performance Issues

### 9.1 Hot Path Optimizations

| Location | Issue | Fix |
|----------|-------|-----|
| `Memory.sample()` line 168-176 | Creates intermediate arrays | Use iterator/generator |
| `Bag.add()` line 14-19 | O(n) scan for min | Use heap or maintain separate min |
| Term factory cache | Unbounded | Add LRU eviction |

### 9.2 Unnecessary Array Allocations

```typescript
// memory.ts line 169-175
const allConcepts = Array.from(this.concepts.values());  // Could iterate directly
const scored = allConcepts.map(concept => ({...}));  // Creates new array
scored.sort(...);  // Another allocation
return scored.slice(...).map(s => s.concept);  // Another
```

---

## Implementation Roadmap

### Phase 1: Type Safety (Week 1)
- [ ] Fix SelfAnalyzer.ts — replace all `any` types with proper interfaces
- [ ] Fix QueryAPI.ts — type memory properly as `Memory`
- [ ] Fix NARFacade.ask() return type
- [ ] Fix MetacognitiveMonitor.ts event typing
- [ ] Remove unnecessary `as any` casts throughout

### Phase 2: Test Coverage (Week 1-2)
- [ ] Add tests for `nar-execution.ts` — core reasoning loop
- [ ] Add tests for `nar-facade.ts` — facade layer
- [ ] Add tests for `stream/pipeline.ts` — backpressure logic
- [ ] Add tests for `memory/memory-index.ts` — indexing
- [ ] Add tests for `memory/bounded-bag.ts` — bounded priority queue

### Phase 3: Deduplication (Week 2)
- [ ] Extract similarity calculation to single function
- [ ] Unify bag class hierarchy (AbstractBag contract)
- [ ] Extract common rule patterns from nal.ts/nal-extended.ts

### Phase 4: Error Handling (Week 2)
- [ ] Create custom error types
- [ ] Replace `console.error` with structured error logging
- [ ] Fix empty catch blocks
- [ ] Add error events to eventBus

### Phase 5: Memory Management (Week 2-3)
- [ ] Add LRU eviction to term factory cache
- [ ] Bound SelfAnalyzer.patternHistory
- [ ] Fix timer cleanup in TimerTool
- [ ] Clear enrichment timer on stop

### Phase 6: Documentation (Week 3)
- [ ] Correct README LOC claims
- [ ] Update RLFP status (deprecate or complete)
- [ ] Add API reference
- [ ] Add tool creation guide

### Phase 7: RLFP Decision (Week 3)
- [ ] Either implement fully OR deprecate
- [ ] Remove from NAR initialization if deprecated
- [ ] Add clear TODO markers if incomplete

---

## Minimum Viable Test Suite

To ensure basic usability, these tests MUST exist:

```typescript
// nar-execution.test.ts — CRITICAL
describe('NARExecution', () => {
  it('should process pending tasks');
  it('should run reasoning step');
  it('should call memory.consolidate()');
  it('should respect maxDerivationDepth');
  it('should respect cpuThrottleMs');
  it('should trigger rlFP.optimize() on interval');
});

// nar-facade.test.ts — CRITICAL
describe('NARFacade', () => {
  it('should return beliefs filtered');
  it('should return typed ask() result');
  it('should execute tools');
  it('should track metrics');
});

// stream-pipeline.test.ts — CRITICAL
describe('Pipeline', () => {
  it('should apply backpressure');
  it('should respect maxQueueSize');
  it('should respect maxDepth');
  it('should yield derived tasks');
});

// memory-index.test.ts
describe('MemoryIndex', () => {
  it('should index atomic symbols');
  it('should query by atomic symbol');
  it('should query by time range');
  it('should calculate cluster similarity');
});

// bounded-bag.test.ts
describe('BoundedBag', () => {
  it('should reject on overflow when behavior is reject');
  it('should replace lowest when behavior is replace-lowest');
  it('should merge when behavior is merge');
  it('should sample by priority');
  it('should sample by recency');
});
```

---

## Verification Commands

```bash
# Before any changes (should pass)
pnpm run test
pnpm run typecheck
pnpm run lint

# After fixes, verify with:
pnpm run test:unit -- --coverage
pnpm run typecheck
pnpm run lint

# Check for any remaining 'as any' occurrences
rg 'as any' src/ --type=ts | wc -l  # Should be 0
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Test coverage | ~60% | >90% |
| `as any` occurrences | 50+ | 0 |
| Console.error calls | 20+ | 0 |
| Unbounded caches | 3+ | 0 |
| README accuracy | Poor | Accurate |
| RLFP status | Skeletal | Documented |
