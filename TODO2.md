# TODO2.md — Codebase Cleanup & Refactoring Plan

> **Goal**: Fix all TypeScript compilation errors and ESLint issues prior to Phase 11 (Testing & Quality).
> Run `pnpm run lint` and `pnpm run typecheck` after each section to verify progress.

---

## Section A: Critical TypeScript Errors (compilation blockers)

### A1 — bounded-bag.ts: median type mismatch

**File**: `src/nar/memory/bounded-bag.ts:131-135`

**Issue**: `priorityDist.median` is `number | undefined` (array indexing with `noUncheckedIndexedAccess`), but `BagStatistics.priorityDistribution.median` requires `number`.

**Fix**: Add `?? 0`:
```ts
median: priorities.length > 0
  ? [...priorities].sort((a, b) => a - b)[Math.floor(priorities.length / 2)] ?? 0
  : 0,
```

---

### A2 — bounded-bag.ts: null checks in itemsMatch

**File**: `src/nar/memory/bounded-bag.ts:259-267`

**Fix**: Add `if (a == null || b == null) return a === b;` guard at top.

---

### A3 — forgetting.ts: hook function possibly undefined

**File**: `src/nar/memory/forgetting.ts:61`

**Fix**: Use local const: `const hooks = this.hooks; if (hooks?.beforeForget) { ... }`

---

### A4 — memory-index.ts: spread overrides defaults

**File**: `src/nar/memory/memory-index.ts:47-54`

**Fix**: Remove explicit defaults, just use: `this.config = { ...config } as Required<MemoryIndexConfig>;`

---

### A5 — memory-index.ts: representative assignment

**File**: `src/nar/memory/memory-index.ts:312`

**Fix**: Guard before assignment: `const first = cluster.concepts[0]; if (first) cluster.representative = first;`

---

### A6 — memory.ts: primary possibly undefined in mergeConcepts

**File**: `src/nar/memory/memory.ts:435-448`

**Fix**: `const primary = concepts[0]; if (!primary) return null;`

---

### A7 — premise/formation.ts and strategies/index.ts: subterms → args

**Files**:
- `src/nar/reason/premise/formation.ts:166-169`
- `src/nar/reason/strategies/index.ts:74-77`

**Fix**: Replace `.subterms` with `.args` (CompoundTerm has `args`, not `subterms`).

---

### A8 — PolicyOptimizer.ts: return type widening

**File**: `src/nar/rlfp/PolicyOptimizer.ts`

**A (line 78)**: Add `?? 'default'` fallback to random strategy selection.

**B (line 144)**: Guard destructuring:
```ts
const entry = strategyEntries[i % strategyEntries.length];
if (!entry) break;
const [strategyName, strategy] = entry;
```

---

### A9 — PreferenceCollector.ts: lastStep possibly undefined

**File**: `src/nar/rlfp/PreferenceCollector.ts:111-113`

**Fix**: `const lastStep = trajectory[trajectory.length - 1]!;`

---

### A10 — RewardModel.ts: sample possibly undefined

**File**: `src/nar/rlfp/RewardModel.ts:114-119`

**Fix**: `if (!sample) continue;`

---

### A11 — processor.ts: Stamp.derive Source type mismatch

**File**: `src/nar/rules/processor.ts:58,88,111`

**Fix**: `Stamp.derive([p1.stamp, p2.stamp])` (default is `'DERIVED'`)

---

### A12 — SelfAnalyzer.ts: metrics possibly undefined

**File**: `src/nar/self/SelfAnalyzer.ts:378-379`

**Fix**: `if (!metrics) return;`

---

### A13 — parser.ts: ParseError interface/class conflict

**File**: `src/nar/terms/parser.ts:13-45`

**Fix**: Delete the unused `ParseError` interface (lines 13-19).

---

### A14 — parser.ts: variable `t` not in scope

**File**: `src/nar/terms/parser.ts:305-306`

**Fix**: Replace `t` with `this.at(this.pos)`.

---

### A15 — types.ts: serializeTerm not found

**File**: `src/nar/terms/types.ts:146-147`

**Fix**: Rename local `serialize` → `serializeTerm` function and adjust export.

---

### A16 — unifier.ts: undefined not assignable to Substitution

**File**: `src/nar/terms/unifier.ts:111`

**Fix**:
```ts
const result = unify(first, second, subst);
if (!result) return undefined;
subst = result;
```

---

### A17 — benchmark.test.ts: missing stamp in RuleInput

**File**: `src/nar/tests/benchmark.test.ts:23-24`

**Fix**: Add `stamp: Stamp.createInput()` to test objects. Import `Stamp` from `'../terms'`.

---

### A18 — ReasonTool.ts: Truth field names

**File**: `src/nar/tools/ReasonTool.ts:45-46`

**Fix**: `truthValue.f` and `truthValue.c` (not `frequency`/`confidence`).

---

### A19 — Test files: @jest/globals not found

**Files**: `extended-rules.test.ts`, `rlfp.test.ts`, `lifecycle.test.ts`, `memory-integration.test.ts`, `memory-revision.test.ts`, `memory-serialization.test.ts`

**Fix**: `pnpm add -D @jest/globals`

---

### A20 — rlfp.test.ts: TrajectoryStep not exported

**File**: `src/nar/tests/rlfp.test.ts:2`

**Fix**: Add `export type { TrajectoryStep }` to `rlfp/index.ts`.

---

### A21 — types.ts: CJS `require()` in ESM project

**File**: `src/nar/terms/types.ts:99`

**Issue**: Uses `const { termParser } = require('./parser.js')` inside `deserializeTerm()`. This is CJS and incompatible with strict ESM. Also creates a lazy circular dependency risk.

**Fix**: Import `termParser` at top of file with ESM `import` (it's already exported from parser.ts). Remove the dynamic `require()`.

---

### A22 — NAR methods: missing return types

**File**: `src/nar/nar.ts:142,146,150,154,158`

**Issue**: `getConcept()`, `listConcepts()`, `clearMemory()`, `getStatistics()`, `getConfig()` all lack explicit return types.

**Fix**: Add return types: `Concept | undefined`, `Concept[]`, `void`, `MemoryStatistics`, `NARConfig`.

---

### A23 — nar.ts: export/import methods with `any`

**File**: `src/nar/nar.ts:282,293`

**Issue**: `export(): Record<string, any>` and `import(data: Record<string, any>)` use `any`.

**Fix**: Define proper serialized state interfaces and use those instead.

---

## Section B: ESLint Errors — Unused Variables/Imports

### B1 — Unused imports (prefix with `_` or remove)

| File | Line | Unused Name | Fix |
|---|---|---|---|
| `src/agent/http-server.ts` | 9 | `createHash` | Remove |
| `src/agent/http-server.ts` | 402 | `req` param | Prefix with `_` |
| `src/agent/irc-bot.ts` | 167 | `handler` param | Prefix with `_` |
| `src/agent/websocket-server.ts` | 131 | `error` | Prefix with `_` |
| `src/agent/websocket-server.ts` | 209 | `termStr` param | Prefix with `_` |
| `src/app.ts` | 45 | `config` | Remove or prefix with `_` |
| `src/cli/repl.ts` | 10 | `createRequire` | Remove |
| `src/cli/repl.ts` | 133, 142 | `e` | Prefix with `_` |
| `src/cli/repl.ts` | 292 | `filter` param | Prefix with `_` |
| `src/cli/repl.ts` | 337 | `config` | Remove or prefix with `_` |
| `src/cli/rlfp.ts` | 1 | `NAR` | Remove |
| `src/nar/lifecycle/Container.ts` | 23 | `T` | Remove or prefix with `_` |
| `src/nar/lm/dynamic-rules.ts` | 3 | `termParser` | Remove |
| `src/nar/lm/dynamic-rules.ts` | 4 | `Truth` | Remove |
| `src/nar/lm/model-discovery.ts` | 1 | `LMConfig` | Remove |
| `src/nar/lm/model-discovery.ts` | 191 | `client` | Remove |
| `src/nar/lm/router.ts` | 1 | `LMConfig` | Remove |
| `src/nar/lm/router.ts` | 62 | `context` param | Prefix with `_` |
| `src/nar/memory/gc.ts` | 58 | `term` destructure | Remove destructured name |
| `src/nar/memory/memory-index.ts` | 169 | `clusterHash` | Prefix with `_` |
| `src/nar/memory/memory.ts` | 192 | `hash` | Remove |
| `src/nar/memory/memory.ts` | 193 | `score` | Remove |
| `src/nar/memory/serialization.ts` | 6 | `Truth` type import | Remove |
| `src/nar/nar.ts` | 19 | `TermFilter`, `TruthFilter`, `QueryOptions` | Remove |
| `src/nar/nar.ts` | 23 | `Logger` | Remove |
| `src/nar/query/api.ts` | 2 | `QueryOptions` | Remove |
| `src/nar/query/api.ts` | 60 | `questionTasks` | Remove |
| `src/nar/query/trace.ts` | 3 | `Stamp` | Remove |
| `src/nar/reason/premise/formation.ts` | 3 | `Truth` | Remove |
| `src/nar/reason/reasoner.ts` | 5 | `Budget` | Remove |
| `src/nar/reason/reasoner.ts` | 10 | `Stamp` | Remove |
| `src/nar/reason/reasoner.ts` | 92-93 | `timeoutMs`/`startTime` | Use `timeoutMs` or prefix; remove `startTime` |
| `src/nar/reason/strategies/index.ts` | 183 | `weight` | Remove |
| `src/nar/rlfp/PolicyOptimizer.ts` | 71 | `context` param | Prefix with `_` |
| `src/nar/rlfp/PolicyOptimizer.ts` | 158 | `commonFeatures` | Remove |
| `src/nar/self/SelfAnalyzer.ts` | 118 | `corrections` | Remove |
| `src/nar/self/SelfAnalyzer.ts` | 260 | `metricsSummary` param | Prefix with `_` |
| `src/nar/self/SelfAnalyzer.ts` | 272 | `stats` param | Prefix with `_` |
| `src/nar/self/SelfAnalyzer.ts` | 376 | `monitorState` | Remove |
| `src/nar/self/SelfAnalyzer.ts` | 430 | `stats` | Remove |
| `src/nar/self/SelfAnalyzer.ts` | 431 | `memoryUsage` | Remove |
| `src/nar/self/MetacognitiveMonitor.ts` | 204 | `startTime` | Remove |
| `src/nar/rules/processor.ts` | 6 | `TruthFn` | Remove |
| `src/nar/terms/parser.ts` | 89 | `startPos` | Remove |
| `src/nar/tools/ExplainTool.ts` | 21 | `context` param | Prefix with `_` |
| `src/nar/tools/ExplainTool.ts` | 29 | `term` | Remove |
| `src/nar/tools/ExplainTool.ts` | 113,119 | `concept` params | Prefix with `_` |
| `src/nar/tools/FileTools.ts` | 3 | `join` | Remove |
| `src/nar/tools/LearnTool.ts` | 24 | `context` param | Prefix with `_` |
| `src/nar/tools/ProcessTool.ts` | 22 | `context` param | Prefix with `_` |
| `src/nar/tools/ReasonTool.ts` | 2 | `Memory` | Remove |
| `src/nar/tools/ReasonTool.ts` | 6 | `createBudget` | Remove |
| `src/nar/tools/ReasonTool.ts` | 24 | `context` param | Prefix with `_` |
| `src/nar/tools/SearchTool.ts` | 19 | `context` param | Prefix with `_` |
| `src/nar/tools/TimerTool.ts` | 21 | `context` param | Prefix with `_` |
| `src/nar/tools/registry.ts` | 22 | `filter` param | Prefix with `_` |
| `src/nar/tools/registry.ts` | 90 | `tool` param | Prefix with `_` |
| Test: `lifecycle.test.ts` | 1 | `beforeEach`, `afterEach` | Remove |
| Test: `lifecycle.test.ts` | 172 | `initOrder` | Remove |
| Test: `memory-serialization.test.ts` | 1 | `beforeEach` | Remove |
| Test: `property-based.test.ts` | 131 | `depth` param | Prefix with `_` |
| Test: `rlfp.test.ts` | 56 | `collector` | Remove |
| Test: `tools.test.ts` | 2 | `HTTPTool` | Remove |

---

## Section C: ESLint Warnings — `no-explicit-any`

### High-value targets (proper types available):

| File | Lines | What to replace `any` with |
|---|---|---|
| `src/nar/types/events.ts:14` | 14,18,25 | `unknown` |
| `src/nar/lm/types.ts:34-69` | All | Use defined types: `Term` for primary/secondary, `Record<string,unknown>` for context |
| `src/nar/lm/router.ts:62,179` | 62,179 | `Record<string, unknown>` |
| `src/nar/lm/dynamic-rules.ts:167,182` | 167,182 | `Record<string, unknown>` |
| `src/nar/rlfp/PolicyOptimizer.ts:197` | 197 | `Record<string, unknown>` |
| `src/nar/rlfp/PreferenceCollector.ts:65-113` | 65-113 | `Record<string, unknown>` |
| `src/nar/rlfp/RewardModel.ts:72,80,84` | 72,80,84 | `Record<string, unknown>` |
| `src/nar/rules/types.ts:9` | 9 | `(premises: Term[]) => Term \| null` |
| `src/nar/rules/nal.ts:327,334` | `fn` | `(premises: Term[]) => Term \| null` |
| `src/nar/rules/nal-extended.ts:196,203` | `fn` | `(premises: Term[]) => Term \| null` |
| `src/nar/nar.ts:282,293` | 282,293 | Define serialized state interfaces |
| `src/nar/nar.ts:167-171` | 167-171 | `TermFilter`, `TruthFilter`, etc. are defined in core.ts |

### Medium-value targets:

| File | Lines | Strategy |
|---|---|---|
| `src/nar/memory/bounded-bag.ts:262` | 262 | `(a as Record<string, unknown>).hash` |
| `src/nar/memory/memory-index.ts:265-286` | 265-286 | Proper `Term` accessors |
| `src/nar/memory/consolidation.ts:102,109` | 102,109 | `Term` accessors |
| `src/nar/memory/scorer.ts:44` | 44 | `unknown` or remove unused param |
| `src/nar/self/SelfAnalyzer.ts` | Many | Define `MonitorState` interface in MetacognitiveMonitor.ts |
| `src/nar/lm/LMRule.ts:157-162` | 157-162 | Replace with defined callback types |

---

## Section D: ESLint Warnings — `no-non-null-assertion`

| File | Lines | Suggested Fix |
|---|---|---|
| `src/nar/terms/truth.ts` | 51-156 | Replace `t1!`/`t2!` with proper null checks |
| `src/nar/terms/types.ts:160,183` | 160,183 | Use `??` fallback |
| `src/nar/terms/unifier.ts:33,107,110,123` | 33,107,110,123 | Guard with `if (x)` or `??` |
| `src/nar/terms/parser.ts:288-290` | 288-290 | Guard with null checks |
| `src/nar/memory/bounded-bag.ts:75,249-262` | 75,249-262 | Guard with null checks |
| `src/nar/rlfp/RewardModel.ts:51-62` | 51-62 | Config defaults set in constructor; use `!` or add checks |
| `src/nar/memory/forgetting.ts:61` | 61 | See A3 — use local const |
| `src/nar/reason/strategies/index.ts:230-240` | 230-240 | Guard `.get()` results |

---

## Section E: Code Quality & Patterns

### E1 — Refactor `self/SelfAnalyzer.ts` type safety

**File**: `src/nar/self/SelfAnalyzer.ts`

Pervasive `as any` casts. Define proper `MonitorState` interface in `MetacognitiveMonitor.ts` and export it. Use proper accessor methods on `NAR`/`Memory`.

### E2 — Remove ParseError interface (duplicate with class)

**File**: `src/nar/terms/parser.ts:13-19`

Delete the unused `ParseError` interface.

### E3 — Arrow function class properties vs methods

**File**: `src/nar/nar.ts:167-171`

**Issue**: `getBeliefs = (filter?: any) => ...` uses arrow function syntax, inconsistent with regular methods above (lines 142-160). Arrow functions are not on the prototype and behave differently with `this`.

**Fix**: Convert to regular methods to match the rest of the class.

### E4 — `LMRuleConfigInternal` should reuse named types

**File**: `src/nar/lm/types.ts:33-37`

**Issue**: `LMRuleConfigInternal` duplicates `promptTemplate`, `responseProcessor`, `taskGenerator` signatures inline with `any` instead of using the already-defined `LMPromptGenerator`, `LMResponseProcessor`, `LMTaskGenerator` type aliases (lines 67-69).

**Fix**: Replace inline `any` signatures with the named type aliases.

### E5 — parser.test.ts orphaned (not in jest config)

**File**: `src/nar/terms/parser.test.ts`

**Issue**: Located in `src/nar/terms/` not `src/nar/tests/`, so doesn't match `**/tests/**/*.test.ts` — it's never executed.

**Fix**: Move to `src/nar/tests/unit/parser.test.ts` or add to jest config.

---

## Section F: Refactoring & DRY Opportunities

### F1 — Create shared `createTaskFromConcept` helper

**Files**: `premise/formation.ts`, `strategies/index.ts`

Both files repeatedly construct task objects from concepts with identical boilerplate (6+ occurrences). Extract to shared utility.

### F2 — Deduplicate `extractSymbols` (3 identical copies)

**Files**:
- `src/nar/memory/memory.ts:473-487`
- `src/nar/memory/concept.ts:336-350`
- `src/nar/memory/memory-index.ts:330-343`

**Issue**: Three `private extractSymbols()` methods with identical implementation.

**Fix**: Extract to `src/nar/utils/helpers.ts` as a standalone function.

### F3 — Deduplicate `calculateSimilarity` / `calculateClusterSimilarity` (3 copies)

**Files**:
- `src/nar/memory/memory.ts:461-471` (`calculateSimilarity`)
- `src/nar/memory/concept.ts:312-322` (`calculateTermSimilarity`)
- `src/nar/memory/memory-index.ts:317-328` (`calculateClusterSimilarity`)

**Fix**: Extract shared Jaccard similarity computation to utils.

### F4 — Consolidate `itemsMatch` into utility

**File**: `bounded-bag.ts:259-267`

**Fix**: Move to `src/nar/utils/helpers.ts`.

### F5 — Standardize error response pattern in tools

**Files**: All `src/nar/tools/*.ts`

**Fix**: Create `errorResult(message: string)` helper in `tools/types.ts`.

### F6 — Consolidate duplicate NAL rules

**Files**: `src/nar/rules/nal.ts` vs `src/nar/rules/nal-extended.ts`

**Issue**: `comparison` and `analogy` rules are registered in both files with nearly identical implementations.

**Fix**: Remove duplicates from `nal-extended.ts` and import from `nal.ts`.

### F7 — Remove `isAtom` duplicate of `isAtomic`

**File**: `src/nar/terms/accessors.ts:18`

`isAtom(term)` is identical to `isAtomic(term)` from `types.ts:43`. Remove the duplicate and consolidate callers.

### F8 — Remove `getArgs`/`getTermArg` accessor duplicates

**File**: `src/nar/terms/accessors.ts:15` vs `types.ts:47-51`

**Issue**: `getArgs(term)` duplicates `getTermArgs(term)` with same functionality but different name.

**Fix**: Remove one, consolidate callers.

### F9 — Unify `toString()` access on Term objects

**File**: All files calling `.toString()` on Term (e.g. `src/nar/lm/LMRule.ts:150`)

**Issue**: The `Term` type doesn't define a `toString()` method. Calls like `primary.toString()` fall through to `Object.prototype.toString()` returning `[object Object]` — a runtime bug.

**Fix**: Either add `toString()` to the `Term` type union, or use `serializeTerm(primary)` instead.

---

## Section G: ESM Import Consistency

### G1 — Eliminate CJS `require()` call

**File**: `src/nar/terms/types.ts:99`

**Issue**: Dynamic `require()` inside `deserializeTerm` is incompatible with strict ESM.

**Fix**: Replace with top-level ESM `import` of `termParser`.

### G2 — Standardize `.js` extensions on all imports

**Issue**: ~80+ imports across the codebase mix bare module paths (`from '../memory'`) with explicit `.js` extensions (`from '../terms/truth.js'`). With `moduleResolution: "bundler"` both work, but inconsistency is a code quality issue.

**Files affected**: All sub-modules under `src/nar/` — see detailed list in analysis.

**Fix**: Choose one convention (prefer explicit `.js` for ESM compatibility) and apply consistently. High-priority files:
- `src/nar/nar.ts` (mixes both styles in same file)
- `src/nar/tools/index.ts` (all 14 re-exports missing `.js`)
- All tool files (use bare paths for `from './types'`)
- `src/nar/memory/memory.ts`, `src/nar/memory/concept.ts`

### G3 — Fix `src/nar/tools/index.ts` exports

**File**: `src/nar/tools/index.ts:1-14`

All 14 `export * from './...'` statements lack `.js` extensions.

---

## Section H: Missing Re-exports from Index Files

### H1 — `src/nar/terms/index.ts`

Missing re-exports:
- `deserializeTerm`, `getTermComplexity`, `getTermSimilarity`, `substituteVariables`, `improveNormalization` (from `types.ts`)
- `TermFactory` (alias for `TermBuilder`, from `factory.ts`)
- `unifyMultiple`, `composeBindings`, `clearUnificationCache`, `getUnificationCacheSize` (from `unifier.ts`)
- `ParseError` class, `ParserResult`, `ParserPosition` types (from `parser.ts`)

### H2 — `src/nar/rules/index.ts`

Missing re-exports:
- `NALRuleMetadata` (from `nal.ts`)
- `RuleStatistics`, `RuleDependency` (from `types.ts`)

### H3 — `src/nar/memory/index.ts`

Missing re-exports:
- `MemoryHealth` (from `memory.ts`)
- `SamplingObjective`, `OverflowBehavior`, `BagStatistics`, `BoundedBagState` (from `bounded-bag.ts`)
- `SerializedMemory`, `SerializedConcept` (from `serialization.ts`)

### H4 — `src/nar/types/index.ts`

Missing re-exports:
- `ToolError` (from `core.ts`)
- `TermFilter`, `TruthFilter`, `QueryOptions` (from `core.ts`)

### H5 — `src/nar/rlfp/index.ts`

Missing re-exports:
- `TrajectoryStep` type (from `ReasoningTrajectoryLogger.ts`)

---

## Section I: Error Handling Consistency

### I1 — Replace generic `Error` with typed errors

**Files** using generic `new Error()` where custom errors are available:

| File | Line | Current | Should be |
|---|---|---|---|
| `src/nar/nar.ts` | 295 | `throw new Error('Invalid import data')` | `throw new ValidationError(...)` |
| `src/nar/task/manager.ts` | 113 | `throw new Error('Failed to add task')` | `throw new OperationError(...)` |
| `src/nar/lm/rules.ts` | 34 | `throw new Error('LMRuleDefinition is required')` | `throw new ValidationError(...)` |
| `src/nar/memory/serialization.ts` | 89 | `throw new Error('Unsupported memory version')` | `throw new ValidationError(...)` |
| `src/nar/lifecycle/Container.ts` | 25,37,45,55 | `throw new Error(...)` | `throw new OperationError(...)` |
| `src/nar/lifecycle/BaseComponent.ts` | 52,61,68,75 | `throw new Error(...)` | `throw new OperationError(...)` |

### I2 — Replace `console.warn`/`console.error` with Logger

**Files** using console directly instead of injecting a Logger:

| File | Line | Context |
|---|---|---|
| `src/nar/rlfp/PreferenceCollector.ts` | 22,28-31 | Uses console for error/output |
| `src/nar/lm/model-discovery.ts` | 47,143 | `console.warn` |
| `src/nar/lm/dynamic-rules.ts` | 175 | `console.warn` |
| `src/nar/lm/model-registry.ts` | 98 | `console.warn` |
| `src/nar/reason/strategies/index.ts` | 171 | `console.warn` |
| `src/nar/rlfp/ReasoningTrajectoryLogger.ts` | 42 | `console.error` |
| `src/nar/rlfp/RLFPLearner.ts` | 66 | `console.error` |

**Fix**: Either inject a Logger instance or create a module-level logger. Low priority since Logger integration is complex.

---

## Section J: Remove Unused Utilities

### J1 — `src/nar/utils/helpers.ts` — unused exports

Remove the following exported functions that are never imported anywhere:
- `deepFreeze` (line 20)
- `isNil` (line 39)
- `ensureArray` (line 45)

### J2 — `src/nar/utils/throttle.ts` — entire file unused

**File**: `src/nar/utils/throttle.ts`

**Issue**: `Throttle`, `createThrottle` are exported but never imported anywhere.

**Fix**: Either remove or mark as available-for-future-use with an `@internal` annotation.

### J3 — `src/nar/utils/weak-cache.ts` — entire file unused

**File**: `src/nar/utils/weak-cache.ts`

**Issue**: `WeakCache`, `createWeakCache` never imported.

**Fix**: Same as J2.

---

## Section K: Naming Consistency

### K1 — `serialize` vs `serializeTerm`

**Issue**: Internal function is named `serialize` (types.ts:59), exported as `serializeTerm` (line 95). Should use one name throughout.

**Fix**: Rename internal function to `serializeTerm` and drop the export alias.

### K2 — `isAtomic` vs `isAtom`

**Files**: `types.ts:43` vs `accessors.ts:18`

Identical type guards with different names. Keep `isAtomic` (used more widely), remove `isAtom`.

### K3 — `getTermArgs` vs `getArgs`

**Files**: `types.ts:47` vs `accessors.ts:15`

Same functionality, different name. Consolidate.

### K4 — `focusMaxConcepts` vs `maxConcepts` config naming

**File**: `src/nar/memory/memory.ts:19,23`

Inconsistent prefix pattern. Rename `focusMaxConcepts` → `maxFocusConcepts` for consistency.

---

## Section L: Build & Configuration

### L1 — Fix `tsconfig.json` include path

**File**: `tsconfig.json:30`

**Issue**: Includes `"src/lm/adapters/**/*.ts"` which does not exist.

**Fix**: Change to `"src/nar/lm/**/*.ts"` or remove the entry.

### L2 — Add benchmark script to package.json

**File**: `benchmarks/rule-dispatch.ts`

**Issue**: Benchmark file exists but no npm script to run it. Also import paths are relative to `benchmarks/` (`../src/nar/...`) which would be wrong when running from project root.

**Fix**: Add `"benchmark": "tsx benchmarks/rule-dispatch.ts"` to package.json scripts. Fix import paths to be relative to project root.

### L3 — Wire e2e tests to package.json

**Issue**: 5 e2e test files in `src/nar/tests/e2e/` have no way to run (excluded from main jest config by `testPathIgnorePatterns`, not in unit config).

**Fix**: Add `"test:e2e": "NODE_NO_WARNINGS=1 NODE_OPTIONS='--experimental-vm-modules' pnpm exec jest --config jest.config.cjs --testPathPattern='e2e'"` script.

### L4 — Validate senars.config.json at startup

**Issue**: No runtime validation of the config file.

**Fix**: Add validation in `config/loader.ts` matching the `AppConfig` interface, with helpful error messages for missing/invalid fields.

---

## Section M: Performance & Best Practices

### M1 — Term `toString()` is broken

**Issue**: `Term` union type has no `toString()` method. All calls like `term.toString()` (e.g. LMRule.ts:150) silently get `[object Object]`.

**Fix**: Add `toString()` method to both `AtomicTerm` and `CompoundTerm` interfaces, or add to the `TermBuilder` factory. Callers should use `serializeTerm(term)` consistently.

### M2 — `nar.ts` is a hub with high coupling

**File**: `src/nar/nar.ts`

**Issue**: Imports from nearly every module (memory, reason, task, rules, types, terms, lm, query, metrics, logger, tools, lifecycle). Any change in any sub-module may require changes here.

**Fix**: Consider extracting LM initialization, tool initialization, and query/trace setup into separate methods that could be overridden or injected. Not a high-priority fix but worth noting.

---

## Execution Order

| Phase | Sections | Verification | Risk |
|---|---|---|---|
| 1 | **A1-A22** (all TypeScript errors) | `pnpm run typecheck` | High — compilation must pass |
| 2 | **E3** (arrow→method in nar.ts) | `pnpm run typecheck` | Medium — affects nar.ts |
| 3 | **G1** (remove require()) | `pnpm run typecheck` + tests | Medium — affects deserializeTerm |
| 4 | **M1** (add toString to Term) | `pnpm run typecheck` | Medium — type change |
| 5 | **B1** (all unused imports) | `pnpm run lint` | Low |
| 6 | **G2-G3** (fix .js extensions) | `pnpm run typecheck` | Low — bundler resolves either way |
| 7 | **C** (any → proper types) | `pnpm run lint` | Low-Medium |
| 8 | **D** (non-null assertions) | `pnpm run lint` | Low |
| 9 | **H1-H5** (missing re-exports) | `pnpm run typecheck` | Low — just adding exports |
| 10 | **E1, E2, E4, E5** (quality patterns) | Manual review | Medium |
| 11 | **F1-F9** (DRY refactoring) | `pnpm run test:unit` | Medium — behavioral equivalence |
| 12 | **I1** (typed errors) | `pnpm run typecheck` | Low |
| 13 | **J1-J3** (remove unused utils) | `pnpm run typecheck` | Low |
| 14 | **K1-K4** (naming consistency) | Manual review | Low |
| 15 | **L1-L4** (build/config) | Manual verification | Low |
| 16 | **I2** (console→Logger) | Manual review | Low — optional |

> **Final verification**: `pnpm run typecheck && pnpm run lint && pnpm run test:unit`
