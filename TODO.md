# SeNARS12 Development Plan

**Last Updated:** 2026-05-12
**Status:** Phase 1 Complete - 16/16 items done ✅
**Tests:** 482/482 passing

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

## Phase 2: Declarative Test Framework (P1)

### 2.1 Create `src/nar/tests/framework/ReasoningTestBuilder.ts`

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

export async function assertReasoning(spec: TestSpec): Promise<void>;
export function describeReasoning(name: string, specs: TestSpec[]): void;
```

### 2.2-2.6 Test Framework Implementation
- Create framework index and parser
- Rewrite core NAL tests using new framework
- Migrate existing e2e tests to framework

---

## Phase 3: Test Coverage Expansion (P1)

### 3.1-3.13 Coverage Goals
- NAL1 core rules unit tests
- All 13 strategy tests
- 7 uncovered tool tests
- CLI/REPL tests
- Config loader tests
- Reasoner, nar-lm, nar-io tests
- QueryAPI and ReasoningTrace tests
- EventBus tests
- Concept class tests
- Memory submodule tests (7 files)
- Property-based test expansion (4 files)

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

### 5.1-5.7 Architecture Improvements
- ✅ Extract REPL modules (DONE - see Phase 1.4-1.5)
- ✅ Remove NARFacade indirection (DONE)
- Consolidate rule definitions
- ✅ Extract expectation helper (DONE)
- ✅ Add Memory public API (DONE)
- Fix constructor parameter overload
- Move tests to root `tests/` directory

---

## Phase 6: Usability Improvements (P2)

### 6.1-6.7 CLI Improvements
- Fix CLI input validation
- Improve multi-line input detection
- Add progress indication for `.run`
- Wrap raw system errors
- Extract domain data
- Add per-command help text
- Fix config validation (DONE)

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
| Phase 2 (Test framework) | 2-3 days | Phase 0 | Pending |
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
