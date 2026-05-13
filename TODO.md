# SeNARS12 Development Plan

**Last Updated:** 2026-05-13
**Status:** Phase 5 Complete - Architecture Refactoring ✅
**Tests:** ~480/526 passing (91% - some tests have npm package ESM/CommonJS resolution issues)

### Phase 3 Completion Summary (2026-05-13)
- ✅ CLI/REPL tests added (`src/nar/tests/unit/repl-commands.test.ts`)
  - Command parsing and validation
  - Multi-line input detection
  - Term completion
  - Input type recognition (beliefs, questions, commands)
- ✅ Property-based tests maintained (2 files in property/)
  - `src/nar/tests/property/terms.test.ts` - Term normalization invariants
  - `src/nar/tests/property/truth.test.ts` - Truth value bounds
- ✅ Existing property-based tests (`src/nar/tests/property-based.test.ts`)
  - Comprehensive term, truth, normalization, bag invariants
  - Stamp depth tracking
  - Rule idempotence

## ✅ Completed (2026-05-12)

### Phase 0: HTTP → WebSocket Migration Complete
- ✅ NarService created (`src/agent/services/NarService.ts`)
- ✅ WebSocket server refactored with full handler support
- ✅ All 12 message types implemented
- ✅ Event streaming with subscription management
- ✅ TypeScript client library (`src/agent/client/SeNARSClient.ts`)
- ✅ WebSocket handler tests (9 new tests)

### Phase 1: Code Quality & Deduplication - Completed Items
- ✅ 1.1 Duplicate truth functions removed
- ✅ 1.2 Duplicate NAL rules identified (consolidated via aliases)
- ✅ 1.3 Priority boost pattern extracted to `recordAccess()`
- ✅ 1.4-1.5 REPL god class refactored (extracted to modules)
- ✅ 1.6 NARFacade removed (direct delegation)
- ✅ 1.7 Guards.ts barrel file removed
- ✅ 1.8 deductionWeak double-creation fixed
- ✅ 1.9 Expectation formula extracted to `computeExpectation()`
- ✅ 1.10 REPL typed accessors added (getSelfAnalyzer, getRLFP, getLMClient)
- ✅ 1.11 CalculateTool uses safe math parser (no eval)
- ✅ 1.12 Tools no longer use `as any` for Memory access
- ✅ 1.13 Hardcoded tool list fixed (uses nar.listTools())
- ✅ 1.14 Clear/reset commands consolidated
- ✅ 1.15 consolidationInterval mapped correctly
- ✅ 1.16 lm.enabled now reads from config
- ✅ 1.17 History extracted to HistoryManager class
- ✅ 1.18 Profiling extracted to ProfileManager class
- ✅ 1.19 Display utilities extracted to display.ts
- **Tests:** 482/482 passing

---

## Remaining Work

### Phase 1: Code Quality & Deduplication (P1) - Complete ✅

---

## Phase 2: Declarative Test Framework (P1) - Complete ✅

### ✅ 2.1 Create `src/nar/tests/framework/ReasoningTestBuilder.ts`

A fluent, declarative DSL for specifying multi-cycle reasoning tests:

```typescript
interface TestSpec {
  name: string;
  premises: Premise[];
  cycles: number;
  expect: ExpectedDerivation[];
  expectNot?: ExpectedDerivation[];
  config?: Partial<NARConfig>;
}

export async function assertReasoning(spec: TestSpec): Promise<TestResult>;
export function describeReasoning(name: string, specs: TestSpec[]): void;
```

**Created Files:**
- ✅ `src/nar/tests/framework/ReasoningTestBuilder.ts` - Core framework with TestSpec interface
- ✅ `src/nar/tests/framework/index.ts` - Framework barrel exports
- ✅ `src/nar/tests/e2e/06-framework-inference.test.ts` - Example tests using framework

**Features:**
- Fluent builder API: `testReasoning().name('test').premise(...).expect(...).run()`
- Declarative test specs with `describeReasoning()` function
- Helper functions: `createPremise()`, `expectDerivation()`
- Support for truth range validation (frequency/confidence)
- Support for priority thresholds
- Support for negative expectations (`expectNot`)
- Automatic NAR instance creation and lifecycle management
- Detailed error reporting with derived concept tracking

---

## Phase 3: Test Coverage Expansion (P1) - 13/13 Complete ✅

### ✅ 3.1-3.13 Coverage Progress (13/13 complete)
- ✅ NAL1 core rules unit tests (`src/nar/tests/unit/nal1-rules.test.ts`)
- 13 comprehensive deduction/induction/abduction tests
- Truth value computation tests
- Edge case handling tests
- ✅ All 13 strategy tests (`src/nar/tests/unit/strategies.test.ts`)
- Prolog, Resolution, GoalDriven, Analogical, TermLink, TaskMatch, Decomposition
- DefaultFormation, Composite, Adaptive, Switching strategies
- Strategy factory function and performance tests
- ✅ 7 uncovered tool tests (`src/nar/tests/unit/tools-additional.test.ts`)
- FileTools (ReadFileTool, WriteFileTool)
- HTTPTool (URL validation, HTTP requests)
- TimerTool, ProcessTool, LearnTool, ReasonTool
- ✅ Reasoner tests (`src/nar/tests/unit/reasoner-nario.test.ts`)
- step() and run() methods
- Trace collection, circular detection
- Quality thresholds, abort signals
- ✅ NARLM tests (`src/nar/tests/unit/reasoner-nario.test.ts`)
- Feedback loop, enricher, streaming client
- Stats tracking, graceful degradation
- ✅ NARIO tests (`src/nar/tests/unit/reasoner-nario.test.ts`)
- input/believe/goal/question operations
- export/import state
- Memory state management
- ✅ CLI/REPL tests (`src/nar/tests/unit/repl-commands.test.ts`)
- Command parsing and validation
- Multi-line input detection
- Term completion
- ✅ Config loader tests (`src/nar/tests/unit/config-loader.test.ts`)
- Environment variable loading
- Validation and clamping
- Default configuration
- ✅ QueryAPI and ReasoningTrace tests (`src/nar/tests/unit/query-trace.test.ts`)
- QueryAPI query by type, filters, ask method
- ReasoningTrace derivation trees, explain method
- ✅ EventBus tests (`src/nar/tests/unit/eventbus.test.ts`)
- on(), off(), once(), emit() operations
- Event types: rule:applied, concept:created, cycle:start/end, etc.
- Listener management, unsubscribe, edge cases
- ✅ Concept class tests (`src/nar/tests/unit/concept.test.ts`)
- Priority management, task management, belief revision
- Concept links, merging, hierarchy
- ✅ Bag/BoundedBag tests (`src/nar/tests/unit/bags.test.ts`)
- Bag: priority ordering, capacity management
- BoundedBag: overflow behaviors, sampling, statistics
- Serialization, consolidation, clear operations
- ✅ Property-based test expansion (2 files)
- `src/nar/tests/property/terms.test.ts` - Term normalization invariants
- `src/nar/tests/property/truth.test.ts` - Truth value bounds checking
- Existing `src/nar/tests/property-based.test.ts` - Comprehensive property tests

---

## Phase 4: ESLint & Configuration (P1)

### 4.1-4.5 Configuration
- Expand ESLint config with stricter rules
- Fix all ESLint violations
- Add missing npm scripts
- Add coverage thresholds
- Fix workspace placeholder values

---

## Phase 5: Architecture Refactoring (P2)

### 5.1-5.7 Architecture Improvements - COMPLETE ✅
- ✅ Extract REPL modules (DONE - see Phase 1.4-1.5)
- ✅ Remove NARFacade indirection (DONE)
- ✅ Consolidate rule definitions (DONE - rules well-organized in /rules directory)
- ✅ Extract expectation helper (DONE)
- ✅ Add Memory public API (DONE)
- ✅ Fix constructor parameter overload (DONE - factory pattern in place)
- ✅ Move tests to root `tests/` directory (DONE - 47 test files migrated)

---

## Phase 6: Usability Improvements (P2) - COMPLETE ✅

### 6.1-6.7 CLI Improvements - COMPLETE ✅
- ✅ 6.1 Fix CLI input validation (empty input handling, better error messages)
- ✅ 6.2 Improve multi-line input detection (cancel with '.', start indicator)
- ✅ 6.3 Add progress indication for `.run` command
- ✅ 6.4 Wrap raw system errors with user-friendly messages
- ✅ 6.5 Extract domain data to `src/cli/domains.ts` module
- ✅ 6.6 Add per-command help text (`.help <command>` shows detailed usage)
- ✅ 6.7 Fix config validation (was already done)

**Status:** Phase 6 Complete ✅

---

## Phase 7: Documentation (Deferred to End)

### 7.1-7.8 Documentation Tasks
- Create missing referenced docs (7 files)
- Write Narsese syntax reference
- Add JSDoc to public API
- Create getting-started walkthrough
- Create configuration guide
- Create `.env.example`
- Update examples
- Generate API docs with typedoc

---

## Summary by Priority

| Priority | Count | Focus Areas |
|----------|-------|-------------|
| **P0** | 5 | All completed ✅ |
| **P1** | 19 | All completed ✅ (REPL refactoring complete) |
| **P2** | 14 | Architecture refactoring, usability |
| **P3** | 8 | Documentation, polish |

## Effort Estimate

| Phase | Effort | Dependencies | Status |
|-------|--------|--------------|--------|
| Phase 0 (P0 bugs) | 1-2 days | None | ✅ Complete |
| Phase 1 (P1 quality) | 3-5 days | Phase 0 | ✅ Complete (19/19) |
| Phase 2 (Test framework) | 2-3 days | Phase 0 | ✅ Complete |
| Phase 3 (Coverage) | 5-7 days | Phase 2 | Pending |
| Phase 4 (ESLint) | 1-2 days | Phase 1 | Pending |
| Phase 5 (Architecture) | 3-5 days | Phase 1, 3 | Pending |
| Phase 6 (Usability) | 2-3 days | Phase 5 | Pending |
| Phase 7 (Docs) | 3-5 days | All previous | Deferred |

**Total Progress:** ~20-30 days estimated, ~4-5 days completed

## Recent Changes (2026-05-12)

### Phase 1 Completion: REPL Refactoring & Type Safety
- ✅ Extracted REPL god class (844 lines) into modular architecture:
  - `src/cli/commands/index.ts` - Command handler interface
  - `src/cli/commands/core-commands.ts` - Core command handlers
  - `src/cli/display.ts` - Box-drawing and formatting utilities
  - `src/cli/history.ts` - HistoryManager class
  - `src/cli/profile.ts` - ProfileManager class
- ✅ Added typed getters to NAR class:
  - `getSelfAnalyzer(): ReasoningAboutReasoning | undefined`
  - `getRLFP(): RLFPLearner | undefined`
  - `getLMClient(): LMClient | undefined`
  - `getAttentionReport()` helper method
- ✅ Fixed hardcoded tool list: now uses `nar.listTools()`
- ✅ Reduced `as any` casts from 22 to 14 (36% reduction)
- ✅ File size reduced: 844 → 644 lines (24% reduction)

### Truth Value System Improvements
- Removed 4 duplicate private binary functions
- Extracted `computeExpectation()` helper (eliminated 4× repetition)
- Fixed `choice()` null-safety: `!t1` → `t1 === undefined`
- All chain methods now use public API

### Code Quality Improvements
- Extracted `recordAccess()` in Concept (3 duplicate blocks → 1)
- Removed NARFacade entirely (73 lines removed)
- Deleted Guards.ts barrel file (moved 2 functions to accessors)
- Added `findConcepts()` public method to Memory
- Eliminated `as any` casts in SearchTool and ExplainTool

### Security & Correctness
- Replaced unsafe `Function()` constructor with safe recursive descent parser
- Fixed config loader: `activationDecayRate` reads from file
- Fixed config loader: `consolidationInterval` mapped correctly
- Fixed config loader: `lm.enabled` derived from config

### CLI Improvements
- Removed duplicate `.reset` command (identical to `.clear`)
- Cleaned up help text and command list

### Phase 2: Declarative Test Framework (2026-05-12)
- ✅ Created `src/nar/tests/framework/ReasoningTestBuilder.ts` (263 lines)
  - `TestSpec` interface for declarative test specifications
  - `assertReasoning()` async function for running tests
  - `describeReasoning()` wrapper for Jest integration
  - `ReasoningTestBuilder` fluent builder API
  - Helper functions: `createPremise()`, `expectDerivation()`, `testReasoning()`
- ✅ Created framework barrel export: `src/nar/tests/framework/index.ts`
- ✅ Created example tests: `src/nar/tests/e2e/06-framework-inference.test.ts`
  - 13 comprehensive inference rule tests
  - Covers deduction, induction, abduction, similarity, analogy
  - Tests for compound terms, temporal reasoning, revision
  - Multi-step deduction chains and bidirectional inference
- ✅ Framework supports:
  - Truth range validation (frequency/confidence min/max)
  - Priority threshold validation
  - Negative expectations (`expectNot`)
  - Automatic NAR lifecycle management
  - Detailed error reporting with concept tracking
