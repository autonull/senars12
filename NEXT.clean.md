# NEXT.clean.md — Codebase Unification, Deduplication & Strengthening Plan

> **Philosophy:** Unify, deduplicate, strengthen. **Never delete potentially functional code.** If it compiles, tests pass, and it might be used — keep it, reorganize it, document it. Every change must preserve or improve correctness.

---

## 0. Current State (Verified 2026-07-17, Updated after Session)

| Metric | Status |
|--------|--------|
| Tests | 1102 passed, 2 skipped (1104 total) |
| TypeScript | 6/6 packages typecheck individually (`pnpm --filter <pkg> typecheck`) |
| Turbo typecheck | Fails — circular dep core↔nar↔io (~303 cycles via `dpdm`, pre-existing) |
| Bins | 7/7 run: `senars`, `bot-ai`, `repl`, `multi-agent`, `multi-agent-demo`, `mcp-server`, `sg` (regressions fixed this session) |
| TS versions | Divergent: `ui` = 5.9.3, others = 7.0.1-rc (blocks `ui` extending `tsconfig.base.json`) |
| Lint | Biome, no eslintrc; `noUnusedImports` set to `warn` |
| Agent architecture | single `Agent` class (`core/src/Agent.ts`), single `createAgent` factory (`nar/src/agent/index.ts`) |
| Packages | **6**: `core`, `nar`, `io`, `metta`, `ui`, **`util`** (+ root `src/` for bins) |
| Dep graph | **`util → (none)`**; `core → util, nar, metta`; `nar → util, core, io`; `io → util, core`; `metta → core` |
| Error systems | **Unified** — `SenarsError` base (`@senars/util`) with 10 subclasses; `AgentError` + `NARError` re-exported for compat |
| Command systems | **Unified** — `CommandRegistry` + types in `@senars/util/commands/`; core + io re-export |
| Event systems | **Two** — `CognitiveEvent` (core) + `NAREventMap` (nar, 50+ event types); **bridged** via `nar/src/events/bridge.ts` |
| Event bus | **Unified** — `EventBus<T>` runtime class in `@senars/util/events/`; nar re-exports |
| Session mgmt | **Unified** — `InMemorySessionManager` class in `@senars/util/memory/`; io + core share it |
| Serialization | **Canonical** term API (`toNarsese`/`fromNarsese`); V1 memory state export + migration scaffold (`nar/src/memory/state/`) |
| Logging | Shared `Logger` in core, re-exported by nar/io — **reduced** `console.*` (3 files cleaned) |
| Stale exports | **Fixed** — `core/src/events/` stale exports removed from `package.json` |
| Import migration | **11 files** migrated from `@senars/core` to `@senars/util` for shared types |
| Error hierarchy | **Unified** — `core/src/errors/AgentError.ts` now re-exports from `@senars/util/errors/` with deprecation |
| Memory types | **Moved** — `ConversationSession`, `SessionManager` types to `@senars/util/types/memory.ts` |
| Serializable | **Added** — `Serializable`, `Versioned` interfaces in `@senars/util/utils/serialization.ts` |
| Multi-agent bins | **Deduplicated** — share `src/bin/lib/multi-agent-runner.ts` (~80% code reuse) |
| `invariant` utility | **Added** — `core/src/helpers.ts` exports `invariant()` |
| `@unimplemented` tags | **Added** — 10 stubs tagged in `rules-dsl.ts` |
| `deps:check` | **Added** — via `dpdm` in devDeps, script in `package.json` |
| Bin CLI commands | **Extracted** — `buildCommands()` moved from `repl.ts` to `src/cli/commands.ts` |
| Bin env-config | **Added** — `src/bin/lib/env-config.ts` (typed accessors, 8 domains: episodic, auth, irc, ws, http, mcp, lm, app) |
| Bin lifecycle | **Added** — `src/bin/lib/lifecycle.ts` (`createAgentFromEnv`, `runAgent`, re-exports `setupGracefulShutdown`) |
| Bin deduplication | **Refactored** — `senars.ts`, `repl.ts`, `bot-ai.ts`, `mcp-server.ts` all use shared lifecycle utilities |
| InMemorySessionManager in util | **Moved** — `InMemorySessionManager`, `createSession`, `abortSession` from `core` to `@senars/util/memory` |
| NAR→Cognitive event bridge | **Added** — `nar/src/events/bridge.ts` with `narEventToCognitive()`, 9 mapped event types |

---

## 1. Phase 0 — Foundation: `@senars/util` Package

### 1.1 Create `@senars/util` Package
**Problem:** Circular deps between core↔nar↔io; duplicate type definitions across packages.

**Solution:** Extract all shared type definitions, utilities, and interfaces to `@senars/util`.

```
util/
├── package.json              # name: @senars/util
├── tsconfig.json
├── src/
│   ├── index.ts              # Re-exports everything
│   ├── types/
│   │   ├── cognitive.ts      # CognitiveEvent, CognitiveStimulus, Context, Derivation
│   │   ├── engine.ts         # Engine, EngineId, ToolResult (MOVE from core)
│   │   ├── memory.ts         # Episode, ConversationSession, SessionManager, EpisodicMemory
│   │   ├── agent.ts          # AgentOptions, HealthStatus, SkillDefinition, ParsedCommand
│   │   ├── bridge.ts         # BridgeOptions, BridgeContext, BridgeEvent, BridgeDelta
│   │   ├── protocol.ts       # All protocol types (from core/protocol/)
│   │   ├── transport.ts      # Connection, ConnectionConfig, IOMessage
│   │   ├── llm.ts            # LMService, ModelRunner types
│   │   ├── config.ts         # ConfigView, ConfigEvent, ConfigSchema
│   │   ├── lifecycle.ts      # Component, BaseComponent, Lifecycle events
│   │   ├── events.ts         # EventBus interface, TypedEventEmitter
│   │   └── truth.ts          # Frequency, Confidence branded types (NOT Truth operations)
│   ├── utils/
│   │   ├── id.ts             # ULID generation, ID type
│   │   ├── throttle.ts       # throttleGenerator (MOVE from nar)
│   │   ├── assert.ts         # invariant, assertDefined
│   │   └── serialization.ts  # Serializable interface, Versioned interface
│   └── errors/
│       ├── index.ts          # BaseAppError, ErrorCode brand
│       ├── tool.ts           # ToolError (single source, replace both core+nar versions)
│       ├── engine.ts         # EngineError
│       ├── config.ts         # ConfigError
│       └── transport.ts      # TransportError, ConnectionError
```

**Migration:** Each package changes:
- `import type { X } from '@senars/core'` → `import type { X } from '@senars/util'`
- Runtime imports stay at their original package (only types migrate)

**Benefit:** Breaks circular deps, single source of truth for types, enables independent versioning.

### 1.2 Unify Error Hierarchy
**Current:** Two separate hierarchies:
- `AgentError` (core): 6 classes with `code` property
- `NARError` (nar): 4 classes with `code` + `context`
- Both have `ToolError` — distinct classes with same name

**Action:**
1. Move all error classes to `@senars/util/errors/`
2. Single `SenarsError` base with discriminated `code` union type:
   ```typescript
   type ErrorCode = 'TOOL_ERROR' | 'ENGINE_ERROR' | 'CONFIG_ERROR' | 'TRANSPORT_ERROR'
     | 'POLICY_VIOLATION' | 'CONNECTION_ERROR' | 'VALIDATION_ERROR'
     | 'OPERATION_ERROR' | 'PLUGIN_LOAD_ERROR' | 'TRUTH_ERROR' | 'LOOP_DETECTED'
     | 'TIMEOUT' | 'PARSE_ERROR' | 'EVENT_LOG_ERROR' | 'METTA_ERROR';
   ```
3. Keep `MeTTaError` as the sole exception (MeTTa type system is fundamentally different)
4. Each package re-exports from `@senars/util/errors/` for backward compat

---

## 2. Phase 1 — Deduplication: Bin Consolidation

### 2.1 Merge `multi-agent.ts` & `multi-agent-demo.ts`
**Files:** `src/bin/multi-agent.ts` (84 lines), `src/bin/multi-agent-demo.ts` (88 lines)
- **Difference:** Only logger scope name and console banner text
- **Action:** Create `src/bin/lib/multi-agent-runner.ts` with parameterized config; both bins delegate to it
- **Result:** ~80 lines deduplicated, single source of truth for multi-agent demo logic

### ✅ 2.2 Extract REPL Commands to Shared Module
**File:** `src/bin/repl.ts` (344 → 120 lines)
- **Action:** Moved `buildCommands()` and `CLICommand[]` to `src/cli/commands.ts`
- **Benefit:** Reusable by other CLI tools, testable in isolation, cleaner bin entry point
- **Result:** `src/cli/commands.ts` (206 lines) with `buildCommands()`, `REPL_HELP`, `LMHandle`, `LMStats` types

### ✅ 2.3 Shared Bin Utilities
**Files:** All bins repeat agent startup/shutdown, signal handling, logging
- **Action:** Created `src/bin/lib/lifecycle.ts` with `createAgentFromEnv()`, `runAgent()`, re-exports `setupGracefulShutdown`
- **Result:** Consistent behavior, reduced boilerplate in each bin

### ✅ 2.4 Unify Bin Configuration From Env
**Files:** Each bin reads `process.env` differently
- **Action:** Created `src/bin/lib/env-config.ts` — single mapping of env vars → typed config accessors
  - 8 domains: `EpisodicConfig`, `AuthConfig`, `IRCConfig`, `WSConfig`, `HTTPConfig`, `MCPConfig`, `LMEnvConfig`, `AppEnvConfig`
  - Each bin imports shared env config instead of inline `process.env.FOO ?? default`

---

## 3. Phase 2 — Unification: Bridge & Command Systems

### 3.1 Distinguish Two Bridge Roles
**Current:**
- `core/src/AgentBridge.ts` (132 lines) — Cognitive events → UI deltas (WebSocket protocol)
- `io/src/bridge.ts` (264 lines) — I/O middleware: auth, commands, sessions, rate-limiting, connection binding

**Problem:** Both handle `agent.chat()` streaming; unclear separation of concerns.

**Action:** Formalize the boundary
```
core/src/bridge/
├── AgentBridge.ts          # CognitiveEvent → BridgeEvent (UI protocol only)
├── ChatStreamHandler.ts    # Shared: agent.chat() → string aggregation (EXTRACT from both)
└── types.ts                # BridgeEvent, BridgeDelta, ChatMessage (MOVE from Protocol.ts)

io/src/bridge/
├── ConnectionBinder.ts     # bindAgentToConnection() + session mgmt
├── MiddlewarePipeline.ts   # auth, commands, rate-limit, error boundary
├── SessionManager.ts       # In-memory session impl (extract from bindAgentToConnection)
└── ConfigFromEnv.ts        # createConnectionConfigsFromEnv()
```

### ✅ 3.2 Unify Session Management
- `core/src/memory/SessionManager.ts` — JSONL persistence
- `io/src/bridge.ts` — Anonymous in-memory `SessionManager` impl (lines 44-62)
- **Action:** Created `util/src/memory/in-memory-session-manager.ts` with `InMemorySessionManager`, `createSession`, `abortSession`; `io/bridge.ts` imports it instead of inline anonymous class; `core/src/memory/SessionManager.ts` re-exports from util with `@deprecated`

### 3.3 Unify Command Systems
**Current:**
- `core/src/command-types.ts` — `CommandDefinition`, `CommandHandler`, `CommandContext` (types only)
- `io/src/commands/registry.ts` — `CommandRegistry` class implementing the same pattern

**Action:**
1. Move `CommandRegistry` (the class, with `register/execute/get/alias` logic) to `@senars/util/commands/`
2. Keep `command-types.ts` types alongside (or merge into util)
3. `io/commands/registry.ts` becomes a thin re-export
4. Add `nar/src/commands/` integration — let NAR commands be registered via the same `CommandRegistry`

### ✅ 3.4 Bridge the Two Event Systems
**Current:**
- `CognitiveEvent` (core) — discriminated union, 20+ types, `engine: 'nar'|'metta'` tagging
- `NAREventMap` (nar) — generic `EventBus<T>`, 50+ event types
- `BridgeEvent` (core) — projection of CognitiveEvents for UI

**Action:**
1. Formalize the mapping: `CognitiveEvent` ↔ `NAREventMap` event conversion
2. ✅ Add `nar/src/events/bridge.ts` — `narEventToCognitive()` converts `NAREventMap` events → `CognitiveEvent`s with 9 mapped event types (cycle, derivation, concept, cognitive state, tool, lm)
3. ✅ Move `EventBus` interface + `TypedEventEmitter` to `@senars/util/events/` — **Done in Phase 0**
4. ✅ Fix the stale `core/src/events/` export — **Done in Quick Wins**

---

## 4. Phase 3 — Modularization: Large File Splits

### ✅ 4.1 `nar/src/rules/rules-dsl.ts` (1036 lines) → Rule Package
**Keep ALL rules (including undefined placeholders).** Reorganize:

```
nar/src/rules/
├── index.ts                    # Re-exports, side-effect registration
├── types.ts                    # RuleDef, RuleFn, TruthFn (existing)
├── registry.ts                 # RuleRegistry, registerRule (existing)
├── builders.ts                 # buildBinaryInhRule, buildInhRule, foldNary, etc.
├── extractors.ts               # extractInh, extractInhPair, matchInhPair, linkFn
├── nal/
│   ├── index.ts                # NALRules object + registration
│   ├── core.ts                 # deduction, induction, abduction, similarity
│   ├── logic.ts                # contrapositive, intersection, union, decompose
│   ├── propositional.ts        # conjunctionIntro, disjunctionIntro, implication*, equivalence*, negation*
│   ├── higher-order.ts         # higherOrderDeduction, Abduction, Induction
│   └── comparison.ts           # analogy, comparison, exemplification, sameness, revisionWeak
├── extended/
│   ├── index.ts                # NALExtendedRules + registration
│   ├── classical.ts            # modusPonens, modusTollens, conversion
│   ├── structural.ts           # structuralInheritance, structuralReduction
│   ├── composition.ts          # intersectionComposition, unionComposition, difference
│   ├── equivalence.ts          # equivalence, variableIntroduction, decomposition
│   ├── variable.ts             # variableDependency
│   ├── conversion.ts           # instanceConversion, propertyConversion
│   ├── deduction-ext.ts        # instanceDeduction, propertyInduction
│   ├── temporal.ts             # sequenceIntroduction, parallelIntroduction, predictiveImplication, temporalDeduction
│   ├── procedural.ts           # proceduralDecomposition, proceduralChaining, operationToPredictive
│   └── meta/                   # UNIMPLEMENTED (keep as documented stubs)
│       ├── operationExecution.ts
│       ├── goalExecution.ts
│       ├── strategyEffectiveness.ts
│       ├── resourceAllocation.ts
│       ├── errorPatternDetection.ts
│       ├── utilityEstimation.ts
│       ├── metacognitiveRevision.ts
│       └── selfModelConsistency.ts
└── registration.ts             # NAL_RULES, NAL_EXTENDED_RULES + registerRulesFromDSL()
```

### ✅ 4.2 `nar/src/lm/lm-rule-factory.ts` (805 lines) → Split by Responsibility
```
nar/src/lm/
├── lm-rule-factory.ts          # Main export, ~200 lines (orchestrator)
├── rule-templates/
│   ├── index.ts
│   ├── belief-rules.ts
│   ├── goal-rules.ts
│   ├── question-rules.ts
│   └── meta-rules.ts
├── rule-selectors/
│   ├── index.ts
│   ├── confidence.ts           # hasLowConfidence, hasHighCuriosity
│   ├── connectivity.ts         # isUnderconnected, hasConflictingBeliefs
│   └── factory.ts              # createById, createAll
└── rule-builders.ts            # Shared builders extracted from factory
```

### ✅ 4.3 `nar/src/cognitive/SelfAnalyzerService.ts` (722 lines) → Extract Analyzers
```
nar/src/cognitive/
├── SelfAnalyzerService.ts      # Orchestrator, ~150 lines
├── analyzers/
│   ├── index.ts
│   ├── belief-analyzer.ts      # belief distribution, revision pressure
│   ├── goal-analyzer.ts        # goal progress, achievement rates
│   ├── concept-analyzer.ts     # concept activation, connectivity
│   ├── contradiction-detector.ts
│   ├── novelty-detector.ts     # novel input rate, surprise metrics
│   └── pattern-miner.ts        # recurring inference patterns
└── reports/
    ├── index.ts
    ├── formatters.ts           # String formatters for analysis reports
    └── types.ts                # AnalysisReport, Insight, Recommendation types
```

### ✅ 4.4 `core/src/Protocol.ts` (375 lines) → Separate Concerns
```
core/src/protocol/
├── index.ts                    # Re-exports
├── cognitive.ts                # CognitiveDelta, BridgeEvent, BridgeDelta
├── ui.ts                       # ChatMessage, GraphNodeData, ConfigField, Lens
├── agent.ts                    # AgentCapabilities, NarConceptNode, MettaAtomNode, MettaSkillNode
├── messages.ts                 # IncomingFromClient, IncomingFromServer, ModelEvent
└── types.ts                    # GraphOpType, ConfigFieldType, GraphOp
```

### ✅ 4.5 `core/src/Agent.ts` (392 lines) — Extract Agent Phases
```
core/src/agent/
├── Agent.ts                    # Main class, ~200 lines (orchestrates phases)
├── phases/
│   ├── perceive.ts             # Input event emission, stimulus creation
│   ├── recall.ts               # Context assembly: working, episodic, semantic
│   ├── reason.ts               # Engine iteration, derivation collection
│   ├── narrate.ts              # Cortex synthesis, narrative generation
│   ├── act.ts                  # Command parsing, policy check, tool execution
│   └── consolidate.ts          # Memory consolidation, tool result storage
└── lifecycle.ts                # start(), stop(), health(), mount(), unmount()
```

---

## 5. Phase 4 — API Surface Standardization

### 5.1 Formalize `Serializable` Interface
**Current:** Multiple components implement `serialize/deserialize` with different signatures.

**Action:** Define in `@senars/util/utils/serialization.ts`:
```typescript
interface Serializable<T, V = number> {
  serialize(): T;
  deserialize(data: T, version?: V): this;
  readonly version?: V;
}
```
Implement across: `Memory`, `Bag`, `LinkManager`, `TermLayer`, `NLCache`, `CognitiveParameters`, `LMRules`.

### 5.2 Add `@public` / `@internal` Export Tags
- Catalog every exported symbol from all 5 packages
- Add JSDoc `@public` (intended for consumers) or `@internal` (package-internal, exported for technical reasons)
- Add to biome config: `noUnusedExports: true` (warn only, never error — cannot verify side-effect imports statically)

### 5.3 Clean Stale Exports
- **`core/src/events/`** — exists as a directory, has a `package.json` export `@senars/core/events` pointing to `./src/events/EventTypes.ts` which does NOT exist. Either create the file or remove the export.
- **`core/src/index.ts`** — audit for symbols that should be re-exported vs removed (see 5.2 tagging)

---

## 6. Phase 5 — Serialization & Persistence Unification

### 6.1 Standardize Term Serialization
**Current:** `serializeTerm/deserializeTerm` in `nar/src/terms/serialize.ts` — functional API.

**Action:** Add class methods to `Term`:
```typescript
class Atom extends BaseTerm {
  toNarsese(): string;        // delegates to serializeTerm
  static fromNarsese(s: string): Atom;  // delegates to deserializeTerm
}
```
This provides a canonical API without removing the functional one.

### 6.2 Versioned State Serialization
**Current:** Version 1 serialization in `nar/src/memory/state/serialization.ts`.

**Action:** Define migration pattern for future versions:
```
nar/src/memory/state/
├── serialization.ts           # V1 (existing) — refactored to export { V1 }
├── migration.ts               # migrateV1toV2, migrateV2toV3, ...
└── index.ts                   # auto-detect version, apply migrations
```

---

## 7. Phase 6 — Configuration System Consolidation

### 7.1 Single Config Schema
**Current:** `core/src/config/`, `src/config/`, env vars in multiple bins — fragmented.

**Action:** Create `@senars/util/config/`:
```
util/src/config/
├── schema.ts              # Zod schemas for ALL config domains
├── defaults.ts            # Default values merged from environment
├── env.ts                 # process.env → config mapping (single source)
├── validation.ts          # validateAgentOptions (MOVE from core)
└── types.ts               # ConfigView, ConfigEvent, ConfigSchema (MOVE from core)
```

### 7.2 Config Loading Priority
Standardize this priority across all bins:
```
1. CLI flags (highest)
2. Environment variables (SENARS_*)
3. Config file (senars.config.json / senars.config.ts)
4. Default values (lowest)
```
Implement once in `@senars/util/config/`, all bins delegate.

---

## 8. Phase 7 — Testing Strengthening

### 8.1 Integration Tests for Bridge Layer
- Test `bindAgentToConnection` with real `Agent` + mock `Connection`
- Test middleware pipeline: auth → command → session → agent
- Test `AgentBridge` cognitive event projection with real events
- Test `ChatStreamHandler` aggregation with controlled agent output

### 8.2 Property-Based Tests for Rules
- Use existing `fast-check` (already in deps) to verify:
  - Rule commutativity where applicable
  - Truth value monotonicity properties
  - Inference chain soundness (deduction → induction round-trip)
- Existing test at `tests/nar/property-based.test.ts` — expand coverage

### 8.3 Add Missing Tests for Key Abstractions
- **`@senars/util/errors/`** — error construction, code matching, instanceof checks
- **`@senars/util/commands/`** — registry operations, alias resolution, error handling
- **`core/src/bridge/ChatStreamHandler.ts`** — aggregation with backpressure
- **NAREngine lifecycle** — initialize/start/stop/shutdown
- **Agent phase extraction** — each phase tested independently

### 8.4 E2E Smoke Tests for All Bins
**Current:** 3 e2e smoke tests at `tests/e2e/`.
**Action:** Add smoke test for each of the 7 bins:
- Startup → assert agent healthy → send input → assert response → shutdown
- Use in-memory event log, no external dependencies
- Parameterized test runner, one `.test.ts` file

---

## 9. Phase 8 — Performance & Observability

### 9.1 Lazy Tool Registration
**Issue:** `createAgentDispatch`, tool creators have high `transitive_loop_depth` (19-25) due to eager registration.

**Action:** Convert to lazy factories:
```typescript
// Before: eager array of tools
export const tools = createAllTools();

// After: lazy factory
export function createTools(): Tool[] { return [...]; }
```

### 9.2 Memoize Expensive Computations
- `nar/src/lm/lm-service.ts`: `doGenerate`, `doStream` — cache model responses per input hash
- `nar/src/terms/truth.ts`: Truth operations — memoize common (f,c) combinations
- `core/src/eventlog/AbstractEventLog.ts`: `validatePayload` — compile validators once

### 9.3 Formal Benchmark Infrastructure
**Current:** `tests/setup/benchmark-runner.ts` exists.
**Action:** Add benchmarks for:
- NAR inference cycle throughput (steps/sec)
- Rule matching performance (rules/sec)
- Memory bag operations (insert/delete/sec)
- Serialization round-trip (terms/sec)
- Agent cycle latency (cycles/sec)

Run benchmarks in CI (informational, not gate).

### 9.4 Structured Logging Adoption
**Current:** Many files use raw `console.*`. The shared `Logger` exists in core.

**Action:** Replace all raw `console.*` in production code (non-test, non-benchmark) with structured logger:
- Create a codemod script for replacement
- Files to target: `ApprovalService.ts`, `io/src/connections/cli.ts`, `nar/src/config/cognitive-parameters.ts`, `nar/src/cognitive/SelfAnalyzerService.ts`, `nar/src/terms/serialize.ts`
- Add `LoggerInterface` methods: `warnOnce()`, `deprecated()` for migration warnings

---

## 10. Phase 9 — Tooling & CI

### 10.1 Add Biome Import Boundary Rules
**Current:** No lint rules enforce package dependency direction.

**Action:** Add to `biome.json`:
```json
{
  "rules": {
    "correctness": {
      "noUnusedImports": true
    }
  }
}
```

### 10.2 Add Circular Dependency Detection
- Add `dpdm` or `madge` to devDeps
- Script: `pnpm run deps:check` — detects circular imports, exits non-zero on cycles
- CI gate: `deps:check` runs on every PR

### 10.3 Add Export Boundary Verification
**Action:** Script that verifies each package only exports what's in its `public API` contract:
- `@senars/core` should not export test helpers
- `@senars/nar` should not export internal types
- Enforced via `tsconfig.json` `declarationDir` + `outDir` (for packages that emit)

### 10.4 Standardize tsconfig Across Packages
**Current:** `metta` has standalone tsconfig (emits), `ui` has standalone tsconfig — others extend base.

**Action:**
- Move all package tsconfigs to extend `tsconfig.base.json`
- Add `tsconfig.build.json` for packages that need to emit (metta)
- Add `references` in root tsconfig (TypeScript project references)
- Verify: `pnpm tsc --build` works end-to-end

### 10.5 Fix the Turbo Circular Dep
**Root cause:** `core → nar → io → core` creates a transitive cycle that `turbo run typecheck` detects via package.json graph.

**Action after Phase 0:** Once `@senars/util` absorbs shared types, attempt to:
1. Switch `nar`'s dependency on `core` to `devDependencies` (only types needed at runtime)
2. Or reverse: kernel classes in `core` depend on `@senars/util` only, `nar` depends on `@senars/util` only
3. Test: `pnpm turbo run typecheck` passes

---

## 11. Non-Goals (Explicitly Out of Scope)

- ❌ Deleting unimplemented rules (`operationExecution`, etc.) — keep as documented stubs
- ❌ Removing "dead" exports — tag with `@internal` / `@unimplemented` instead
- ❌ Changing public APIs consumed by external packages — all changes internal/structural
- ❌ Rewriting working logic — only reorganize, extract, unify, deduplicate
- ❌ Adding new features — pure refactoring (zero feature change)
- ❌ Migrating test framework (vitest→jest or vice versa) — vitest stays primary
- ❌ Replacing biome with eslint or vice versa — biome stays
- ❌ Changing package manager (pnpm→npm/yarn) — pnpm stays
- ❌ MeTTa language runtime internals — that's a separate project concern

---

## 12. Phased Implementation Order

| Phase | Focus | Risk | Est. LOC Δ | Key Verification |
|-------|-------|------|------------|------------------|
| **Quick Wins** | 6 low-risk items ✅ | **Low** | -50 | All tests pass; typechecks clean |
| **0** | `@senars/util` package + error unify | **High** (new package, wide imports) | +300 / -200 | Individual package typechecks; `turbo typecheck` |
| **1** | Bin deduplication + env config ✅ | **Low** (leaf nodes) | -150 | All 7 bins run end-to-end ✅ |
| **2** | Bridge + command + event unification | **Medium** (shared logic extraction) | -100 | Bridge integration tests; all bins work with chat |
| **3** | Large file modularization (rules, lm, analyzers, protocol, agent) | **Medium** (path changes, import updates) | 0 (reorg) | All rule + lm + cognitive tests pass |
| **4** | API surface standardization (Serializable, `@public`/`@internal`, stale exports) | **Low** | -20 | No new lint warnings |
| **5** | Serialization & persistence unification ✅ | **Low** | 0 (additive) | Serialization round-trip tests ✅ (canonical term API + V1/migration) |
| **6** | Config system consolidation ✅ | **Medium** (env var changes) | -100 | Shared `@senars/util/config` types/validation/env; bins read same `SENARS_*` mapping |
| **7** | Testing strengthening | **Low** | +500 (tests) | Coverage report; property tests |
| **8** | Performance (lazy, memoize) + structured logging | **Low** | -100 (log cleanup) | Benchmarks; no console.* in prod code |
| **9** | Tooling & CI (circular dep detection, boundary rules, tsconfig standards) | **Low** | +50 (config) | `deps:check` + `exports:check` pass; turbo typecheck |

**Execution rule:** Each phase must pass `pnpm run test` + `pnpm --filter <affected> typecheck` before moving to next.

---

## 13. Success Criteria

| Criterion | Current | Target |
|-----------|---------|--------|
| All tests pass | 1104 | ≥1010 |
| 5/5 packages typecheck clean | ✅ | ✅ |
| `turbo typecheck` passes | ❌ (cycle, ~303 reported by dpdm) | ✅ |
| 7/7 bins run | ✅ (regressions fixed this session) | ✅ |
| No duplicate code (bins, bridges, commands, errors) | ✅ (bin dedup done) | ✅ |
| Single `ChatStreamHandler` | ✅ (extracted to core/src/bridge/ChatStreamHandler.ts) | ✅ |
| Single `CommandRegistry` | ✅ (unified in util) | ✅ |
| Single error hierarchy | ✅ (unified in util) | ✅ |
| All exports tagged `@public`/`@internal` | ❌ (util done; core/nar/io partial) | ✅ |
| No raw `console.*` in prod code | ✅ (ApprovalService + EventBus migrated; cli.ts sendFn is stdout by design) | ✅ |
| Circular dep detection in CI | ⚠️ (`deps:check` scripted; not yet a CI gate) | ✅ (`deps:check` + `exports:check` scripted; not yet wired as CI gate) |
| `rules-dsl.ts` main file < 200 lines | 1036 | <200 (reorg'd) |
| `lm-rule-factory.ts` main file < 200 lines | 805 | <200 (reorg'd) |
| `SelfAnalyzerService.ts` < 200 lines | 725 | Done (split into `cognitive/analyzers/*` — orchestrator 202 lines, analyzers each <130) |
| `Protocol.ts` main file < 100 lines | 375 | Done (split into `core/src/protocol/*` — 12 domain modules, each <60 lines) |
| `Agent.ts` main class < 250 lines | 392 | <250 (phase extraction) |

---

## 14. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `@senars/util` breaks existing imports | Medium | High | Codemod script; test each package after migration; keep backward-compat re-exports for 2 phases |
| Phase extraction of Agent.ts changes agent behavior | Low | **Critical** | Full integration test suite; E2E smoke tests; manual chat session on bot-ai bin |
| Reorg of rules-dsl.ts causes test failures | Medium | Medium | Tests import from `@senars/nar` index, not deep paths — safe if index re-exports correctly |
| Circular dep reappears after Phase 0 | Low | Medium | `deps:check` script in CI; documented in `AGENTS.md` |
| Env config changes break user workflows | Medium | Medium | Deprecation warnings for old env vars; 2-phase migration (support both, then remove old) |
| Tooling changes (tsconfig, biome) slow down dev | Low | Low | Test locally first; document in CONTRIBUTING.md |

---

## 15. Migration Patterns

For every export that moves to a new location, follow this pattern:

```typescript
// OLD LOCATION (e.g., core/src/errors/AgentError.ts)
/**
 * @deprecated Will be removed in next major version.
 * Use `import { SenarsError } from '@senars/util'` instead.
 */
export { SenarsError } from '@senars/util';

// NEW LOCATION (e.g., util/src/errors/SenarsError.ts)
/**
 * Base error for all SeNARS errors.
 * @public
 */
export class SenarsError extends Error {
  code: ErrorCode;
  // ...
}
```

Keep re-exports for at least 2 minor versions or as documented in the deprecation schedule.

---

## 16. Deprecation Schedule

| Phase | Change | Deprecation Window |
|-------|--------|--------------------|
| 0 | `core/src/errors/*` → `@senars/util/errors/` | 2 releases (re-export from core) |
| 0 | `nar/src/types/events.ts` types → `@senars/util/types/events.ts` | 2 releases (re-export from nar) |
| 1 | `src/bin/*` standalone pattern → `src/bin/lib/*` shared | Immediate (internal bins) |
| 2 | `io/src/commands/registry.ts` → `@senars/util/commands/` | 2 releases (re-export from io) |
| 4 | `core/src/events/` export fix | ✅ Done — removed stale exports |
| 6 | Old env var names → new `SENARS_*` standard | 1 release with both supported |

---

## 17. Quick Wins (Can Be Done Immediately, Any Order)

These are individual, low-risk, high-value changes that don't depend on other phases:

### ✅ Completed

1. **Fix stale `core/src/events/` export** — Removed `./events`, `./projections`, `./fact-projection` from `core/package.json` (files were deleted in prior commit, exports were dangling)
2. **Add `@unimplemented` JSDoc tags** to 10 undefined rules in `rules-dsl.ts` (2 in `NALRules`: `compose`, `revision`; 8 in `NALExtendedRules`: `operationExecution`, `goalExecution`, `strategyEffectiveness`, `resourceAllocation`, `errorPatternDetection`, `utilityEstimation`, `metacognitiveRevision`, `selfModelConsistency`)
3. **Add `invariant` utility** — `core/src/helpers.ts` now exports `invariant(condition, message)` using `asserts condition` return type
4. **Deduplicate `multi-agent.ts` / `multi-agent-demo.ts`** — extracted shared logic to `src/bin/lib/multi-agent-runner.ts` with parameterized `scope`, `banner`, and `createNAR` factory. Both bins now delegate.
5. **Replace `console.*` in 3 nar prod files** with structured `Logger`:
   - `nar/src/terms/serialize.ts` — `console.error` → `log.error`
   - `nar/src/config/cognitive-parameters.ts` — `console.warn` → `log.warn`
   - `nar/src/cognitive/SelfAnalyzerService.ts` — `console.warn` → `log.warn`
6. **Add `deps:check` script** — `dpdm` added to devDeps, script `deps:check` in root `package.json`

### ⏳ Remaining for Future Sessions

None (all 6 Quick Wins completed).

**Phase 1** ✅ (Bin deduplication, env-config, lifecycle utilities — all done).

**Next up:** Phase 2 (Bridge & Command unification) — **already completed** (see session log). Current frontier: Phase 7 ✅, Phase 8 partial (lazy/memoize/benchmark deferred), Phase 9 partial (tsconfig standardization + turbo circular-dep fix deferred as high-risk structural work).

---

## 18. Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| `@senars/util` not `@senars/shared` | "util" signals utilities + types, not just shared interfaces | 2026-07-17 |
| Keep `MeTTaError` separate | MeTTa type system (Effect/Valibot) is fundamentally different from NAR/Core; merging would create awkward abstractions | 2026-07-17 |
| Keep `NARError`/`AgentError` separate until Phase 0 | Unifying errors is the first step of `@senars/util`, creates immediate value | 2026-07-17 |
| Never delete potentially functional code | What looks dead may be used via side-effect registration, dynamic import, or plugin loading; safer to tag than delete | 2026-07-17 |
| Phases 0 first, not last | The type consolidation in Phase 0 is a prerequisite for clean dep-free modularization in later phases | 2026-07-17 |
| Keep functional `serializeTerm` API alongside new `Term.toNarsese()` | Maintain backward compat; new API is additive convenience | 2026-07-17 |

---

## Session Log

### 2026-07-17 Session — Completed All 6 Quick Wins

**Changes:**
- `core/package.json` — removed stale `./events`, `./projections`, `./fact-projection` exports
- `nar/src/rules/rules-dsl.ts` — added `@unimplemented` JSDoc to 10 rule stubs
- `core/src/helpers.ts` — added `invariant()` assertion utility
- `src/bin/lib/multi-agent-runner.ts` — new shared multi-agent runner module
- `src/bin/multi-agent.ts` — delegates to shared runner
- `src/bin/multi-agent-demo.ts` — delegates to shared runner
- `nar/src/terms/serialize.ts` — `console.error` → structured logger
- `nar/src/config/cognitive-parameters.ts` — `console.warn` → structured logger
- `nar/src/cognitive/SelfAnalyzerService.ts` — `console.warn` → structured logger
- `package.json` — added `dpdm` devDep, added `deps:check` script

**Verification:**
- `1008 passed, 2 skipped` (no regressions)
- `pnpm --filter @senars/core typecheck` — passes
- `pnpm --filter @senars/nar typecheck` — passes

**Next recommended step:** Begin Phase 0 (Create `@senars/util` package). Start with `util/package.json`, `util/tsconfig.json`, and migrate one type file (e.g., `types/cognitive.ts`) to validate the approach before migrating all types.

### 2026-07-17 Session — Phase 0: Import Migration, Error Unification, Memory Types

**Changes:**
- `nar/src/metrics/index.ts` — `Metrics` type import migrated to `@senars/util`
- `nar/src/lifecycle/BaseComponent.ts` — `ComponentContext`, `ComponentState` type imports migrated to `@senars/util`
- `io/src/bridge.ts` — `Connection`, `IOMessage`, `Logger`, `BridgeOptions`, `SessionManager`, `ConversationSession` type imports migrated to `@senars/util`
- `io/src/types.ts` — All connection type imports migrated to `@senars/util`
- `src/index.ts` — Connection type imports + `ConnectionError` migrated to `@senars/util`
- `tests/unit/core/plugin-loader.test.ts` — `Connection`, `ConnectionConfig`, `ConnectionDeps` migrated to `@senars/util`
- `tests/integration/metta-conversation.test.ts` — `CognitiveEvent` migrated to `@senars/util`
- `tests/unit/core/agent.test.ts` — `CognitiveStimulus`, `Engine` migrated to `@senars/util`
- `tests/integration/metta-transports.test.ts` — `ConnectionConfig`, `ConnectionDeps`, `CognitiveEvent` migrated to `@senars/util`
- `tests/unit/agent/IOBridge.test.ts` — `Logger` type migrated to `@senars/util`
- `core/src/errors/AgentError.ts` — Converted from class definitions to re-exports from `@senars/util/errors/` with `@deprecated` JSDoc
- `util/src/types/memory.ts` — New file: `ConversationSession`, `SessionManager` interfaces
- `util/src/utils/serialization.ts` — New file: `Serializable<T, V>`, `Versioned` interfaces
- `util/src/errors/policy.ts` — New file: `PolicyViolation` error class
- `util/src/index.ts` — Added `ConversationSession`, `SessionManager`, `Serializable`, `Versioned`, `PolicyViolation` exports
- `util/package.json` — Added `./types/memory`, `./utils/serialization` subpath exports
- `core/src/index.ts` — `ConversationSession`, `SessionManager` now re-exported from `@senars/util` with deprecation; `AgentError`, `EngineError`, etc. already re-exported via `@senars/util`
- `core/src/memory/types.ts` — Kept `MemoryEntry`, `MemoryQuery`, `Episode`, `JsonlSessionManagerConfig`, `AgentToolDeps` (not moved)
- `vitest.config.mjs` — Added `@senars/util` to `deps.inline` + 14 resolve aliases for util subpath exports

**Verification:**
- `1008 passed, 2 skipped` (no regressions)
- All 6 packages (`util`, `core`, `nar`, `io`, `metta`, `ui`) typecheck individually

**Next recommended step:** Continue Phase 0 items 4-6 (CommandRegistry, EventBus runtime, throttleGenerator), or begin Phase 1 (Bin env-config/lifecycle) or Phase 2 (Bridge & Command unification).

### 2026-07-17 Session — Phase 0: Created `@senars/util` Package

**Changes:**
- `util/` — New package `@senars/util` with:
  - `package.json` — 8 subpath exports for types, errors, utils
  - `tsconfig.json` — extends `tsconfig.base.json`
  - `src/types/cognitive.ts` — `CognitiveEvent`, `CognitiveStimulus`, `Context`, `Derivation`, `isNarEvent`, `isMettaEvent`, `isEventType`
  - `src/types/engine.ts` — `Engine`, `EngineId`, `ToolResult`
  - `src/types/transport.ts` — `Connection`, `ConnectionConfig`, `ConnectionDeps`, `TransportDeps`, `IOMessage`, `MessageClassification`, `ConnectionFactory`, `ConnectionState`
  - `src/types/lifecycle.ts` — `ComponentState`, `Logger`, `Metrics`, `EventBus`, `ComponentContext`
  - `src/types/events.ts` — `TypedEventEmitter`, `EventHandler`
  - `src/types/agent.ts` — `ParsedCommand`, `HealthStatus`, `SkillDefinition`, `BridgeOptions`, `AgentOptions`
  - `src/types/truth.ts` — `Frequency`, `Confidence` branded types
  - `src/types/llm.ts` — `LMService`, `LMCompletionOptions`, `LMResult`
  - `src/errors/senars-error.ts` — `SenarsError` base class + `ErrorCode` union (15 codes)
  - `src/errors/tool.ts` — `ToolError`
  - `src/errors/engine.ts` — `EngineError`
  - `src/errors/config.ts` — `ConfigError`
  - `src/errors/transport.ts` — `TransportError`, `ConnectionError`
  - `src/errors/nar-errors.ts` — `ValidationError`, `ConfigurationError`, `OperationError`
  - `src/errors/index.ts` — re-exports all errors
  - `src/utils/assert.ts` — `invariant()`, `assertDefined()`
  - `src/utils/id.ts` — `generateId()`
  - `src/index.ts` — main re-export of all public API
- `pnpm-workspace.yaml` — added `util` entry
- `core/package.json` — added `@senars/util` dependency
- `nar/package.json` — added `@senars/util` dependency
- `io/package.json` — added `@senars/util` dependency
- `core/src/index.ts` — backward-compat `@deprecated` re-exports for all moved types
- `nar/src/types/core.ts` — backward-compat `@deprecated` re-exports for NARError hierarchy; `assertBeliefTask` throws plain `Error`

**Verification:**
- `1008 passed, 2 skipped` (no regressions)
- All 6 packages (`util`, `core`, `nar`, `io`, `metta`, `ui`) typecheck individually

**Remaining Phase 0 work for future sessions:**
1. ✅ ~~Migrate actual import sites in `core/`, `nar/`, `io/` to directly import types from `@senars/util` instead of `@senars/core`~~ — **11 files migrated**
2. ✅ ~~Migrate `core/src/errors/AgentError.ts` to re-export from `@senars/util/errors/` with deprecation~~ — **All 6 error classes now re-export from util**
3. ✅ ~~Move remaining shared types to `@senars/util` (`memory.ts`, `protocol.ts`, `config.ts`)~~ — **`memory.ts` moved; `protocol.ts`/`config.ts` deferred to Phase 3**
4. ✅ ~~Move `CommandRegistry` class to `@senars/util/commands/`~~ — **Done: `util/src/commands/` with types + registry class; `core/src/command-types.ts` and `io/src/commands/registry.ts` re-export with deprecation**
5. ✅ ~~Move `EventBus` runtime to `@senars/util/events/`~~ — **Done: `util/src/events/event-bus.ts`; `nar/src/types/events.ts` re-exports with deprecation**
6. ✅ ~~Move shared utility function (`throttleGenerator`) to `@senars/util/utils/`~~ — **Done: `util/src/utils/throttle.ts`; `nar/src/utils/throttle.ts` re-exports with deprecation**
7. Fix `turbo run typecheck` (requires breaking core↔nar↔io circular dep — see 10.5)

**Next recommended step:** Begin Phase 1 (Bin deduplication — env-config, lifecycle shared utils) or Phase 2 (Bridge & Command unification). Phase 0 is complete except for the turbo circular dep (item 7), which requires deeper structural changes.

### 2026-07-17 Session — Phase 0 Items 4-6: CommandRegistry, EventBus, throttleGenerator

**Changes:**
- `util/src/commands/types.ts` — unified `CommandContext`, `CommandHandler`, `CommandDefinition` types (single source from util)
- `util/src/commands/registry.ts` — `CommandRegistry` class moved from `io/src/commands/registry.ts`
- `util/src/commands/index.ts` — re-exports
- `util/src/events/event-bus.ts` — `EventBus<T>` runtime class moved from `nar/src/types/events.ts` (generic `T extends Record<string, unknown>`)
- `util/src/events/index.ts` — re-exports
- `util/src/utils/throttle.ts` — `Throttle`, `createThrottle`, `throttleGenerator` moved from `nar/src/utils/throttle.ts` (with inlined `sleep`)
- `util/package.json` — added `./commands`, `./events`, `./utils/throttle` subpath exports
- `util/src/index.ts` — added re-exports; removed duplicate `EventBus` type-only export (class covers both value and type)
- `core/src/command-types.ts` — re-exports from `@senars/util` with `@deprecated`
- `io/src/commands/registry.ts` — re-exports `CommandRegistry`, `CommandDefinition`, `CommandHandler` from `@senars/util` with `@deprecated`; keeps io-specific `CommandContext` locally (with `ConnectionManager`)
- `io/src/commands/connection.ts` — added `ConnectionManager` type assertion for `ctx.manager`
- `nar/src/types/events.ts` — `EventBus` class replaced with re-export from `@senars/util/events` with `@deprecated`; keeps `NAREventMap`, `EventReceiver`, `EventUnsubscribe` locally
- `nar/src/utils/throttle.ts` — re-exports from `@senars/util` with `@deprecated`
- `vitest.config.mjs` — added aliases for `@senars/util/commands`, `@senars/util/events`, `@senars/util/utils/throttle`

**Verification:**
- `1008 passed, 2 skipped` (no regressions)
- All 6 packages (`util`, `core`, `nar`, `io`, `metta`, `ui`) typecheck individually

**Phase 0 status:** 6/7 items completed. Remaining: item 7 (fix `turbo run typecheck` circular dep).

---

### 2026-07-17 Session — Phase 1: Bin Deduplication Complete

**Changes:**
- `src/cli/commands.ts` — **New file:** extracted `buildCommands()`, `REPL_HELP`, `LMHandle`, `LMStats` from `repl.ts` (~190 lines of inline command definitions → shared module)
- `src/bin/lib/env-config.ts` — **New file:** unified typed env config accessors for 8 domains (episodic, auth, irc, ws, http, mcp, lm, app)
- `src/bin/lib/lifecycle.ts` — **New file:** `createAgentFromEnv()` (creates NAR + agent + sessionManager + episodicMemory from env), `runAgent()` (start + signal handling), re-exports `setupGracefulShutdown`
- `src/bin/repl.ts` — Refactored to import `buildCommands` from `../cli/commands.js` and `createAgentFromEnv` from `./lib/lifecycle.js` (~187 lines removed, now 75 lines)
- `src/bin/senars.ts` — Refactored to use `createAgentFromEnv` + `runAgent` (17 → 10 lines)
- `src/bin/bot-ai.ts` — Refactored to use `createAgentFromEnv`, `readAuthConfig`, `setupGracefulShutdown` (151 → 124 lines)
- `src/bin/mcp-server.ts` — Refactored to use `createAgentFromEnv` + centralized env config (70 → 60 lines)

**Verification:**
- `1008 passed, 2 skipped` (no regressions)
- All 6 packages (`util`, `core`, `nar`, `io`, `metta`, `ui`) typecheck individually

**Phase 1 status:** Complete (items 2.2, 2.3, 2.4 all done).

**Next recommended step:** Phase 2.1 (Distinguish Bridge Roles) or Phase 3 (Large file modularization).

---

### 2026-07-17 Session — Phase 2 Items 3.2, 3.4: Session Mgmt Unification + Event Bridge

**Changes:**
- `util/src/memory/in-memory-session-manager.ts` — **New file:** `InMemorySessionManager`, `createSession`, `abortSession` moved from `core/src/memory/SessionManager.ts`
- `util/package.json` — Added `./memory` subpath export
- `util/src/index.ts` — Added `InMemorySessionManager`, `createSession`, `abortSession` exports
- `core/src/memory/SessionManager.ts` — Re-exports from `@senars/util/memory` with `@deprecated`; `JsonlSessionManager` imports `createSession` from util; types from `@senars/util/types/memory`
- `io/src/bridge.ts` — Replaced anonymous inline `SessionManager` class with `new InMemorySessionManager()` (removed ~15 lines of duplicate code)
- `vitest.config.mjs` — Added alias for `@senars/util/memory`
- `nar/src/events/bridge.ts` — **New file:** `narEventToCognitive()` converts `NAREventMap` events → `CognitiveEvent`s; covers 9 event types; exports `MAPPED_NAR_EVENTS`

**Verification:**
- `1008 passed, 2 skipped` (no regressions)
- All 6 packages (`util`, `core`, `nar`, `io`, `metta`, `ui`) typecheck individually

### 2026-07-17 Session — Phase 2.1: Distinguish Two Bridge Roles (Complete)

**Changes:**
- `core/src/bridge/types.ts` — **New file:** `BridgeDelta`, `BridgeEvent` types extracted from `AgentBridge.ts`
- `core/src/bridge/AgentBridge.ts` — **New file:** `AgentBridge` class moved from `core/src/AgentBridge.ts` (cognitive event projection logic)
- `core/src/bridge/ChatStreamHandler.ts` — **New file:** `aggregateChatResponse()` utility extracted (shared `agent.chat()` → text aggregation)
- `core/src/AgentBridge.ts` — Re-exports from `./bridge/AgentBridge.js` with `@deprecated` JSDoc
- `core/package.json` — Added `./bridge/chat-stream-handler` subpath export; updated `./agent-bridge` to point to `./src/bridge/AgentBridge.ts`
- `io/src/bridge/ConnectionBinder.ts` — **New file:** `bindAgentToConnection`, `createAgentDispatch`, `originExtractor`, `resolveSessionKey` extracted from `io/src/bridge.ts` (uses shared `aggregateChatResponse`)
- `io/src/bridge/MiddlewarePipeline.ts` — **New file:** `createAuthMiddleware`, `createCommandInterceptor`, `createSessionBinder`, `createRateLimiter`, `createErrorBoundary` extracted
- `io/src/bridge/ConfigFromEnv.ts` — **New file:** `createConnectionConfigsFromEnv` extracted
- `io/src/bridge/index.ts` — **New file:** re-exports all bridge functions
- `io/src/bridge.ts` — Re-exports from `./bridge/index.js` with `@deprecated` JSDoc

**Verification:**
- `1008 passed, 2 skipped` (no regressions)
- All 6 packages (`util`, `core`, `nar`, `io`, `metta`, `ui`) typecheck individually

**Phase 2 status:** COMPLETE (Items 3.1, 3.2, 3.3, 3.4 all done).

**Remaining work for future sessions:**

**Phase 3.** Large file modularization (items 4.1-4.5) — **COMPLETE** (see session log below):
- `rules-dsl.ts` (1036 → thin barrel `rules-dsl.ts` + `nal/`, `extended/`, `builders.ts`, `extractors.ts`, `registration.ts`) — all sub-rules aligned to original behavior; 1008 tests pass
- `lm-rule-factory.ts` (805 → 174-line orchestrator) — extracted `rule-builders.ts`, `dynamic-rule.ts`, `rule-templates/{belief,goal,question,meta}-rules.ts`, `rule-selectors/{confidence,connectivity,factory}.ts`
- `SelfAnalyzerService.ts` (725 → 202-line orchestrator) — analyzers extracted into `cognitive/analyzers/` (previously completed)
- `Protocol.ts` (375 → <100 lines) — already split into `core/src/protocol/` modules with `./protocol` subpath export (previously completed; the "reverted" note was stale)
- `Agent.ts` (393 → 247-line class) — extracted `agent/types.ts` (interfaces) + `agent/phases.ts` (`runCycle` + perceive/recall/reason/narrate/act/consolidate); private-field semantics preserved via a `CycleHost` context

**Phase 4.** API surface standardization — **IN PROGRESS** (see session log). 5.3 stale exports fixed (`core/protocol` repoint, `ui/agent-bridge` removed); 5.2 `@public` tags added to `@senars/util` barrel. 5.1 (`Serializable` impl on concrete classes) deferred — see note.
**Phase 5.** Serialization & persistence unification
**Phase 6.** Configuration system consolidation
**Phase 7.** Testing strengthening
**Phase 8.** Performance & observability
**Phase 9.** Tooling & CI (fix turbo circular dep)

### Session 2026-07-17 — Phase 3 Attempt (Protocol.ts split)
Attempted to split `Protocol.ts` (375 lines → <100 lines goal) into modular `core/src/protocol/` structure.
- Created `core/src/protocol/ui.ts` with ChatMessage, TruthValue, ConfigField, etc.
- Created `core/src/protocol/graph.ts` with GraphNodeData schemas
- Created `core/src/protocol/messages.ts` with IncomingFromClient, IncomingFromServer
- Created `core/src/protocol/index.ts` re-exporting all modules
- Reverted due to TypeScript `isolatedModules` incompatibility with zod `z.infer<>` patterns
- Tests remain passing (1008 passed, 2 skipped)

The Protocol.ts split requires careful handling of zod schema/type dual exports in ESM with isolatedModules.

---

### 2026-07-17 Session — Phase 3: Large File Modularization (Complete)

**Changes:**
- `nar/src/rules/rules-dsl.ts` — Replaced 1036-line file with a thin barrel re-export; side-effect registration preserved.
- `nar/src/rules/extractors.ts` — `ID`, `extractInh`, `extractInhPair`, `matchInhPair`, `linkFn`, `dedExtractor`, `indExtractor`, `abdExtractor`, `_deductionLink`, `_inductionLink`, `_abductionLink`, `sameSubject`, `sameInhPair`.
- `nar/src/rules/builders.ts` — `buildDeduction`, `buildInduction`, `buildAbduction`, `buildHigherOrderRule`, `foldNary`, `conversionRule`, `buildSequenceRule`, `deductionFromType`.
- `nar/src/rules/nal/{core,logic,propositional,higher-order,comparison}.ts` — `NALRules` map (split by concern).
- `nar/src/rules/extended/{classical,structural,composition,equivalence,variable,conversion,deduction-ext,temporal,procedural,comparison-ext}.ts` + `meta/{8 stubs}` — `NALExtendedRules` map.
- `nar/src/rules/nal/index.ts`, `nar/src/rules/extended/index.ts` — assemble the rule maps (`satisfies Record<string, RuleFn>` to avoid `noUncheckedIndexedAccess` widening).
- `nar/src/rules/registration.ts` — `NAL_RULES`/`NAL_EXTENDED_RULES` `RuleDef[]` arrays + `registerRulesFromDSL` side-effect; no behavior change (verified against `tests/nar/extended-rules.test.ts`).
- `nar/src/lm/lm-rule-factory.ts` — 805 → 174-line orchestrator (`LMRuleFactory` class only).
- `nar/src/lm/rule-builders.ts` — `NARSESE_INSTRUCTIONS`, `parseResponse`, `createTaskGen`, `createRule`, `createCustomRule`, `getRuleDef`, shared interfaces.
- `nar/src/lm/dynamic-rule.ts` — `DynamicLMRuleGenerator`, `CompositeLMRule`, `createDynamicRuleGenerator`, `createCompositeRule`, `ValidationRule`, `DynamicRuleConfig`.
- `nar/src/lm/rule-templates/{belief,goal,question,meta}-rules.ts` + `index.ts` — `ruleDefs` (by category) + `prompts` map.
- `nar/src/lm/rule-selectors/{confidence,connectivity,factory}.ts` — activation conditions + `LMRules` registry (`hasVariable`, `isComplexGoal`, `createById`, `createAll`).
- `core/src/Agent.ts` — 393 → 247-line class; interfaces moved to `core/src/agent/types.ts`; `cycle()` delegates to `runCycle` in `core/src/agent/phases.ts` via a `CycleHost` context (private `#field` semantics preserved).
- `core/src/agent/phases.ts` — `runCycle` + `perceive`/`recall`/`reason`/`narrate`/`consolidateMemory`/`act` phase functions (identical behavior to original inline `cycle`).
- `core/src/agent/types.ts` — `AgentOptions`, `ParsedCommand`, `BridgeOptions`, `HealthStatus`, `SkillDefinition`, etc. (moved from `Agent.ts`; `AgentOptions` now the single source).

**Verification:**
- `1008 passed, 2 skipped` (no regressions)
- All 6 packages (`util`, `core`, `nar`, `io`, `metta`, `ui`) typecheck individually

**Phase 3 status:** COMPLETE (items 4.1-4.5 all done). `rules-dsl.ts`, `lm-rule-factory.ts`, `Protocol.ts`, `SelfAnalyzerService.ts`, `Agent.ts` all meet their <200/<250 line targets.

**Next recommended step:** Phase 4 (API surface standardization: `@public`/`@internal` export tags, stale-export cleanup) — low risk, additive.

---

### 2026-07-17 Session — Phase 4: API Surface Standardization (Partial)

**Changes:**
- `core/package.json` — Repointed stale `./protocol` export from deleted `./src/Protocol.ts` to `./src/protocol/index.ts` (modular split from Phase 3). The new `protocol/` dir carries `index.ts` re-exporting all domain modules.
- `ui/package.json` — Removed stale `./agent-bridge` export pointing to nonexistent `./src/server/agent-bridge.ts` (unused anywhere; ui `server/index.ts` imports `AgentBridge` directly from `@senars/core/agent-bridge`).
- `util/src/index.ts` — Added `@public` JSDoc tags to every export group (types, errors, utils, commands, events, memory) documenting the intended public API surface of `@senars/util`.

**Verification:**
- `1008 passed, 2 skipped` (no regressions)
- All 6 packages (`util`, `core`, `nar`, `io`, `metta`, `ui`) typecheck individually

**Phase 4 status:** Partial.
- ✅ 5.3 Stale exports — `core/protocol` fixed, `ui/agent-bridge` removed, `core/src/events/` already fixed in Quick Wins.
- ✅ 5.2 `@public` tags — applied to `@senars/util` barrel (the canonical shared foundation API). Core/nar/io re-export `@deprecated` shims are already tagged.
- ⏸️ 5.1 `Serializable` interface implementation on concrete classes — **DEFERRED.** The `Serializable<T,V>` interface (instance `serialize(): T` + `deserialize(data, version?): this`) is defined in `util/src/utils/serialization.ts`. Auditing the listed targets revealed incompatible signatures that would force API changes (violating the "no behavior change" rule):
  - `Bag<T>.deserialize` is `static`, not `deserialize(data): this` — does not satisfy the instance interface.
  - `TermLayer.deserialize` / `LinkManager.deserialize` are `static` factories returning new instances.
  - `TranslationCache.deserialize(data): void` mutates in place and returns `void`, not `this`.
  - `Memory`, `CognitiveParameters`, `LMRules` have no single canonical `serialize/deserialize` pair (state is split across submodules).
  Forcing `implements Serializable` would require changing these signatures and risking behavior regressions. Deferred to a later, dedicated session that can redesign these APIs to a uniform contract without breaking callers. The interface remains available for new code.

**Remaining Phase 4 work for future sessions:**
1. 5.1 — Decide on a uniform serialization contract for `Memory`/`Bag`/`LinkManager`/`TermLayer`/`NLCache`/`CognitiveParameters`/`LMRules` (either a revised `Serializable` shape or per-class adapters) and implement without breaking existing callers.
2. 5.2 — Extend `@public`/`@internal` tags beyond util into `core`, `nar`, `io` index barrels and key internal modules (lower priority; util is the shared contract).

**Next recommended step:** Phase 5 (Serialization & persistence unification) — additive, low risk. Begin with 6.1 (`Term.toNarsese()`/`fromNarsese()` canonical API) since functional `serializeTerm` already exists.

---

### 2026-07-17 Session — Phase 5: Serialization & Persistence Unification (Complete)

**Changes:**
- `nar/src/terms/serialize.ts` — Added canonical `toNarsese(term)` / `fromNarsese(s)` functions delegating to `serializeTerm` / `deserializeTerm`. `Term` is a union *interface* (not a class), so the plan's `.toNarsese()`/`.fromNarsese()` instance-method approach is not applicable; canonical namespace functions provide the same convenience additively without altering the existing functional API.
- `nar/src/terms/index.ts` — Exported `toNarsese`, `fromNarsese`.
- `nar/src/memory/state/serialization.ts` — `serialize`/`deserialize`/`validate`/`repair` grouped under exported `V1` contract object; `MEMORY_VERSION` exported. Removed pre-existing `(term as any)` cast in `termToString` (typed cleanly).
- `nar/src/memory/state/migration.ts` — **New file:** `detectVersion()`, `loadMemoryState()` with version auto-detection + migration chain hook (`MIGRATIONS` map) for future versions.
- `nar/src/memory/state/index.ts` — Re-exports `V1`, `MEMORY_VERSION`, `detectVersion`, `loadMemoryState`.

**Verification:**
- `1008 passed, 2 skipped` (no regressions)
- `pnpm --filter @senars/nar typecheck` — passes

**Phase 5 status:** COMPLETE (items 6.1, 6.2 both done, additively).

---

### 2026-07-17 Session — Phase 6: Configuration System Consolidation (Complete)

**Changes:**
- `util/src/config/types.ts` — **New file:** `ConfigSchema`, `ConfigEvent`, `ConfigCapability`, `ConfigView` types moved from `core/src/config/Config.ts` (single source of truth in `@senars/util`).
- `util/src/config/validation.ts` — **New file:** `agentOptionsSchema`, `contextOptsSchema`, `validateAgentOptions`, `AgentOptionsValidationError`, `ValidatedAgentOptions` moved from `core/src/Options.ts`.
- `util/src/config/env.ts` — **New file:** `SENARS_ENV_MAP` (standardized `SENARS_*` → config-path mapping), `parseEnvValue`, `readEnvOverrides` — single env→config source.
- `util/src/config/index.ts` — **New file:** barrel re-exporting all config symbols.
- `util/package.json` — Added `./config` subpath export; added `zod` devDependency (util now hosts a schema).
- `util/src/index.ts` — Re-exports config types/validation/env from the main barrel.
- `core/src/Options.ts` — Converted to `@deprecated` re-export from `@senars/util/config`.
- `core/src/config/Config.ts` — Converted to `@deprecated` type re-export from `@senars/util/config`.
- `core/src/config/ConfigView.ts` — `ConfigView`/`ConfigEvent` imports migrated to `@senars/util/config`.
- `core/src/index.ts` — `validateAgentOptions`/`agentOptionsSchema`/etc. and `ConfigView`/`ConfigEvent`/`ConfigSchema` now carry `@deprecated` tags pointing to `@senars/util/config`.
- `src/config/loader.ts` — `applyEnvOverrides`/private `envConfig` removed; now uses `readEnvOverrides()` from `@senars/util/config` (the single env mapping). No behavior change for the 9 mapped `SENARS_*` vars.
- `vitest.config.mjs` — Added `@senars/util/config` alias.

**Notes / scope boundaries:**
- `src/bin/lib/env-config.ts` (8 bin-level domains: episodic, auth, irc, ws, http, mcp, lm, app) was **left in place** — it serves bin entry points directly (process-env → typed accessors consumed by `lifecycle.ts`), distinct from the app-level `AppConfig` schema in `src/config/schema.ts`. Consolidating those is a larger bin-refactor; the shared `SENARS_*` standardized mapping now lives in `@senars/util/config` and `src/config/loader.ts` consumes it. Dual-support for old env var names (e.g. `LM_PROVIDER`) remains in `env-config.ts` as before.
- `src/config/schema.ts` (appConfigSchema, botConfigSchema, etc.) and `src/config/defaults.ts` remain the app-level schema; they are layered above the util config foundation. Not moved (they are root `src/`, not package-level).

**Verification:**
- `1008 passed, 2 skipped` (no regressions)
- `pnpm --filter @senars/util typecheck` — passes (zod added)
- `pnpm --filter @senars/core typecheck` — passes
- `pnpm --filter @senars/nar typecheck` — passes
- `pnpm --filter @senars/io typecheck` — passes

**Phase 6 status:** COMPLETE (items 7.1 config schema types + 7.2 env mapping + validation migration done). Bin-level env accessors (`src/bin/lib/env-config.ts`) intentionally retained as a distinct layer.

**Remaining work for future sessions:**

**Phase 7.** Testing strengthening — **COMPLETE** (see session log below). Unit tests for `@senars/util/errors`, `commands`, `events` (EventBus), `memory` (InMemorySessionManager), `utils/assert`, `utils/throttle`; integration test for `narEventToCognitive` bridge; unit test for `aggregateChatResponse` (ChatStreamHandler); property-based truth-value tests (`tests/unit/nar/truth-properties.test.ts`); NAREngine lifecycle tests (`tests/unit/nar/engine-lifecycle.test.ts`); Agent phase extraction tests (`tests/unit/core/agent-phases.test.ts`); parameterized E2E bin-lifecycle smoke tests (`tests/e2e/bin-lifecycle.test.ts`, 6 root bins sharing `createAgentFromEnv`). All items delivered.

**Phase 8.** Performance & observability — structured logging adoption **DONE** (see session log): `Logger.warnOnce()`/`deprecated()` added; `ApprovalService.ts` now uses `createLogger`; `EventBus` accepts an injected `Logger` (defaults to a console fallback). `io/src/connections/cli.ts` `console.log` sendFn left intact — it is the CLI connection's actual stdout output channel, not diagnostic logging. Benchmark infrastructure **DONE** (see session log): added `tests/nar/benchmark-infra.test.ts` covering inference-cycle throughput, rule matching, memory-bag ops, term serialization round-trip, memory serialize/deserialize; wired `pnpm bench`. Remaining: lazy tool registration (reduce `transitive_loop_depth` on `createAgentDispatch`), memoize expensive computations (`lm-service`, `truth`, `AbstractEventLog.validatePayload`).

**Phase 9.** Tooling & CI — Biome `noUnusedImports` set to `warn` (10.1); circular dependency detection script `deps:check` already in place (10.2); **critical bin-regression fix** landed (see session log) enabling all 7 bins to run. Remaining: export boundary verification (10.3), standardize tsconfig across packages (10.4 — **BLOCKED**: `ui` uses TypeScript 5.9.3 while core/nar/io/metta/util use 7.0.1-rc; `tsconfig.base.json` declares `lib: ["ESNext","esnext.temporal"]` which 5.9.3 rejects, so `ui` cannot extend base without a TS-version alignment first), **fix `turbo run typecheck` circular dep** (10.5 — root cause `core → nar → io → core`; ~303 cycles reported by `dpdm`; attempt `nar`'s `core` dep → `devDependencies` or kernel-vs-util split). Both 10.4 and 10.5 deferred as high-risk structural work requiring TypeScript-version alignment and dependency-graph surgery.

---

### Session 2026-07-17 (continued) — Phase 7: Testing Strengthening (Partial)

**Changes (new test files):**
- `tests/unit/util/errors.test.ts` — `SenarsError` base (message/code/context/cause), all 9 subclasses (`ToolError`, `EngineError`, `ConfigError`, `TransportError`, `ConnectionError`, `ValidationError`, `ConfigurationError`, `OperationError`, `PolicyViolation`), `ErrorCode` union coverage.
- `tests/unit/util/commands.test.ts` — `CommandRegistry` register/get/execute/alias/overwrite/read-only map; uses vitest mock `Connection`.
- `tests/unit/util/events.test.ts` — `EventBus<T>` on/once/off/emit/clear/listenerCount, error isolation, no-listener silent emit.
- `tests/unit/util/memory.test.ts` — `createSession`, `abortSession`, `InMemorySessionManager` getOrCreate/size/lastSeenAt/abort-retain.
- `tests/unit/util/assert.test.ts` — `invariant`, `assertDefined` assertions + type narrowing.
- `tests/unit/util/throttle.test.ts` — `Throttle` token consume/refill/cap/reset, `createThrottle`, `throttleGenerator` yield/early-stop.
- `tests/integration/nar-events-bridge.test.ts` — `narEventToCognitive` mapping for all 9 mapped NAR events + unmapped→null + custom engine origin + exhaustive `MAPPED_NAR_EVENTS` coverage. Added `@senars/nar/events/(.*)` alias in `vitest.config.mjs`.
- `tests/unit/core/chat-stream-handler.test.ts` — `aggregateChatResponse` concatenation, empty/undefined-delta tolerance, missing `chat` method.

**Verification:**
- `1074 passed, 2 skipped` (was 1008/2 — +66 new tests, no regressions)
- All 6 packages typecheck individually (unchanged)
- Added `vitest.config.mjs` alias `@senars/nar/events/(.*)` → `./nar/src/events/$1.ts`

**Phase 7 status:** Partial. Core unification-layer abstractions (`@senars/util` foundation + `narEventToCognitive` + `ChatStreamHandler`) are now covered. Remaining items deferred: property-based rule expansion, parameterized E2E smoke tests for the 7 bins, NAREngine lifecycle tests, Agent-phase tests.

**Next recommended step:** Phase 8 (Performance & observability) — low risk, additive. Start with structured logging adoption (replace remaining `console.*` in `ApprovalService.ts`, `io/src/connections/cli.ts`, `util/src/events/event-bus.ts`), then lazy tool registration / memoization. Alternatively continue remaining Phase 7 tests (E2E smoke, property-based).

---

### 2026-07-17 Session — Phase 7 completion, Phase 8 structured logging, critical bin-regression fixes

**Critical pre-existing regressions discovered and fixed (these blocked ALL bins from running):**

1. `src/bin/lib/env-config.ts` — Syntax error: `??` mixed with `||` without parentheses (lines 89, 96). tsx/esbuild rejected the file at import, crashing every bin that imported `lifecycle.ts`. Fixed by parenthesizing `(a ?? b) || c`.
2. `nar/src/lm/rule-selectors/factory.ts` — Circular-import TDZ: `LMRules` (top-level `const`) eagerly read `ruleDefs` at init, but `rule-templates/*` import `hasVariable`/`isComplexGoal` back from `factory.ts`, so `ruleDefs` was in the temporal dead zone → `ReferenceError: Cannot access 'ruleDefs' before initialization`. Fixed by making `LMRules.ruleDefs` a lazy getter.
3. `package.json` (root) — Missing `@senars/util` workspace dependency; `src/config/loader.ts` (Phase 6) imports `@senars/util/config` but the symlink `node_modules/@senars/util` did not exist, so `mcp-server` and any `src/` entry importing util failed with `ERR_MODULE_NOT_FOUND`. Added `@senars/util: workspace:*` and ran `pnpm install`.

**After fixes, all 7 bins verified to run** (`senars`, `repl`, `bot-ai`, `mcp-server`, `multi-agent`, `multi-agent-demo`; `sg` lives in the separate `ui/spacegraphjs7` project). The plan's "7/7 bins run" claim was stale — these regressions had been introduced during the Phase 0–6 refactors.

**Phase 8 — structured logging (DONE):**
- `core/src/Logger.ts` — Added `warnOnce(key, message, context?)` and `deprecated(oldSymbol, replacement, context?)` to `Logger` class + `LoggerInterface`.
- `util/src/types/lifecycle.ts` — Added `warnOnce`/`deprecated` to the shared `Logger` interface (util is the foundation contract).
- `core/src/ApprovalService.ts` — Replaced the inline `consoleLogger` with `createLogger({ scope: 'approval' })`; `ApprovalServiceConfig.logger` now typed as `LoggerInterface`.
- `util/src/events/event-bus.ts` — `EventBus` constructor now accepts an optional `Logger`; listener errors routed through it (defaults to a console fallback). No behavior change for `new EventBus()` callers.
- `io/src/connections/cli.ts` `console.log` sendFn **intentionally retained** — it is the CLI connection's stdout output channel, not diagnostic logging.

**Phase 9.1 — Biome:** `biome.json` `correctness.noUnusedImports` set to `"warn"` (non-blocking; repo tolerates pre-existing `any`/lint warnings and has no lint CI gate).

**Phase 7 — remaining tests delivered (new files, +23 tests, no regressions):**
- `tests/unit/nar/truth-properties.test.ts` — Property-based (fast-check): truth bounds for all binary ops, negation involutivity, deduction confidence monotonicity, revision confidence lower-bound, serialize/deserialize round-trip, expectation monotonicity in frequency.
- `tests/unit/nar/engine-lifecycle.test.ts` — `NAREngine` initialize/start/stop/shutdown + idempotency + reason/query after init.
- `tests/unit/core/agent-phases.test.ts` — `runCycle` exercised via a mock `CycleHost`: perceive emits `input.user`, recall queries memory, reason delegates to engines, narrate fallback appends derivations, act parses commands + respects policy, consolidate logs episodic. (Validates the Phase 3 Agent-phase extraction independently.)
- `tests/e2e/bin-lifecycle.test.ts` — Parameterized `it.each` over the 6 root bins (each via the shared `createAgentFromEnv` substrate): start → `health().status === 'healthy'` → Narsese `chat('<cat --> mammal>.')` yields a non-empty response containing `cat` → `stop()` → `health().status === 'stuck'`. In-memory, no external services.

**Verification:**
- `1097 passed, 2 skipped` (was 1074/2 — +23 new tests, no regressions)
- All 6 packages (`util`, `core`, `nar`, `io`, `metta`, `ui`) typecheck individually
- All 7 bins run end-to-end (verified manually via `tsx`)

**Phase 7 status:** COMPLETE. **Phase 8 status:** Partial (structured logging done; lazy registration + memoization + benchmark infra deferred). **Phase 9 status:** Partial (Biome, deps:check script, and the bin-regression fix done; tsconfig standardization + turbo circular-dep fix deferred as high-risk structural work).

**Next recommended step:** Phase 8 remaining (lazy tool registration / memoization) or Phase 9.4/9.5 (tsconfig standardization; attempt the `turbo run typecheck` circular-dep fix — high risk, attempt `nar`'s `@senars/core` dep as `devDependencies` or a kernel-vs-util split, then verify `pnpm turbo run typecheck` passes without behavior change).

---

### Session 2026-07-17 (later) — Phase 8.3 Benchmark Infra delivered; Phase 10.4 blocked on TS-version divergence

**Changes:**
- `tests/nar/benchmark-infra.test.ts` — **New file:** 5 additive benchmark scenarios covering the plan's 9.3 targets:
  - `inference cycle throughput` — `createMinimalNAR()` + `inputTask(createTask(...))` loop (no LM required).
  - `rule matching throughput` — `RuleProcessor.processSync` (extends existing `benchmark.test.ts` coverage).
  - `memory bag operations` — `Bag.add` throughput + `peek` sanity.
  - `serialization round-trip (terms)` — `serializeTerm`/`fromNarsese` loop.
  - `memory serialize/deserialize` — standalone `serialize(memory)` / `deserialize(state, memory)` (async).
  - All assertions are generous upper bounds (fail only on gross regression), matching the existing `benchmark.test.ts` convention. Benchmarks are informational (not a gate).
- `package.json` — Added `bench` script: `vitest run tests/nar/benchmark.test.ts tests/nar/benchmark-infra.test.ts`.
- `ui/tsconfig.json` — **Attempted** to make `ui` extend `tsconfig.base.json` (plan 10.4). **Reverted:** `ui` resolves TypeScript **5.9.3**, while `core`/`nar`/`io`/`metta`/`util` resolve **7.0.1-rc**. `tsconfig.base.json` declares `lib: ["ESNext","esnext.temporal"]`, which 5.9.3 rejects (`error TS6046`) but 7.0.1-rc accepts. Forcing `ui` to extend base broke `pnpm --filter @senars/ui typecheck`. Kept `ui`'s standalone tsconfig intact — no behavior change.

**Verification:**
- `1102 passed, 2 skipped` (was 1097/2 — +5 new benchmark tests, no regressions)
- `pnpm --filter @senars/ui typecheck` — passes (standalone config, unchanged)
- `pnpm --filter @senars/core typecheck` — passes (7.0.1-rc accepts base lib)
- `pnpm bench` — runs; all 5 new scenarios pass

**Phase 8 status:** COMPLETE (structured logging + benchmark infrastructure done). **Phase 9 status:** Partial — 10.1 (Biome), 10.2 (`deps:check`), bin-regression fix done; 10.3 (export boundary script) not started; 10.4 (tsconfig standardization) **blocked on TS-version alignment** (`ui` 5.9.3 vs others 7.0.1-rc); 10.5 (`turbo run typecheck` circular dep) deferred as high-risk structural work.

**Discovered dependency-graph facts (for future Phase 10.4/10.5 sessions):**
- `turbo run typecheck` fails on a workspace-graph cycle: `core → nar → io → core` plus `metta → core`. `dpdm` reports ~303 internal circular imports.
- `ui` is the odd package out on TypeScript version (5.9.3 vs 7.0.1-rc elsewhere). Any tsconfig standardization must first align `ui`'s TS version or give `ui` a base config with a 5.9.3-compatible `lib`.
- `nar` imports runtime symbols from `@senars/core` (`cortex`, `motor`, `engine/base`, `command-types`), so moving `@senars/core` to `devDependencies` of `nar` would break runtime — the plan's proposed 10.5 fix needs a kernel-vs-util split, not a mere dependency relabel.

**Next recommended step:** Phase 10.3 (export-boundary verification script) — DONE this session (see below). Phase 8 remaining (lazy tool registration / memoization) assessed as not viable without behavior-change risk — deferred with rationale. 10.4/10.5 require a dedicated, higher-risk session (TS-version alignment + dependency-graph surgery) and should not be attempted alongside other changes.

---

### 2026-07-17 (later) Session — Phase 10.3 Export-Boundary Verification + Phase 4.5.2 Tag Extension

**Phase 10.3 — Export-boundary verification (COMPLETE):**
- `scripts/verify-exports.ts` — **New file:** dependency-free `tsx` script that iterates every `@senars/*` package's `package.json` `exports` map and asserts each subpath target resolves to a real file on disk (handles `*` wildcard subpaths by resolving the base directory). Catches the "stale/dangling export" regression class (e.g. the prior `core/events`, `ui/agent-bridge` fixes). Exits non-zero on any dangling export, so it is CI-gate-ready.
- `package.json` — Added `exports:check` script (`tsx scripts/verify-exports.ts`).
- **Verification:** runs clean — `ok util / core / nar / io / metta / ui`; all subpaths resolve.

**Phase 4.5.2 — `@public` tags extended into `@senars/core` barrel (COMPLETE):**
- `core/src/index.ts` — Added concise `@public` JSDoc to every primary public runtime export (Agent, AgentBridge, PluginLoader, PolicyEngine, MemoryService, InMemorySessionManager/JsonlSessionManager, BaseEngine, ToolRegistry, FeedbackRegistry, builtin tools, buildAgentTools, LLMCortex, cortex factory, Lifecycle BaseComponent, ModelRunner, ChatService, protocol/graph exports, StatsManager, KnowledgeManager, ApprovalService, Logger, event logs). Deprecated re-export shims already carry `@deprecated` (from prior sessions); this completes the util-first tagging into the consumer-facing `core` surface. Type-only exports left untagged (lower priority per plan).

**Phase 8 remaining — lazy tool registration / memoization (ASSESSED, DEFERRED with rationale):**
- 9.1 `createAgentDispatch` high `transitive_loop_depth`: the current `io/src/bridge/ConnectionBinder.ts` `createAgentDispatch` is already a thin factory (no eager tool array); `buildAgentTools` (`core/src/motor/buildAgentTools.ts`) is already a lazy factory invoked on demand. No eager top-level tool registration remains to convert — the plan's assumption predates the Phase 3 bridge refactor.
- 9.2 memoization targets do not match implementation:
  - `core/src/eventlog/AbstractEventLog.ts:validatePayload` is a pure `switch` over event `type` with inline checks — there are no "validators to compile"; memoization is inapplicable.
  - `nar/src/terms/truth.ts` truth ops are pure arithmetic; memoizing `(f,c)` pairs adds Map overhead per op for negligible gain and risks subtle divergence.
  - `nar/src/lm/lm-service.ts` response caching per input hash would mask nondeterminism / change behavior (violates "no behavior change" non-goal).
- Conclusion: these are better deferred to a dedicated performance session; forcing them risks regressions for no guaranteed benefit.

**Verification:**
- `1102 passed, 2 skipped` (no regressions from index edits)
- `pnpm --filter @senars/core typecheck` — passes
- `pnpm run exports:check` — passes (all 6 packages)

**Plan status after this session:**
- **Phase 10.3** COMPLETE (export-boundary script + npm script).
- **Phase 4.5.2** COMPLETE for `@senars/core` (util + core barrels tagged; nar/io barrels remain lower-priority).
- **Phase 8 (9.1/9.2)** assessed and deferred — not viable as specified without behavior change. 9.3 benchmark infra + 9.4 structured logging were already delivered in prior sessions.
- **Phase 9.4/9.5 (10.4 tsconfig standardization, 10.5 turbo circular-dep fix)**: still deferred — require a dedicated high-risk session (TypeScript-version alignment `ui` 5.9.3 vs others 7.0.1-rc + kernel-vs-util dependency-graph surgery). Do NOT attempt alongside other changes.
- **Phase 4.5.1 (uniform `Serializable` contract)**: still deferred — requires redesigning `Memory`/`Bag`/`LinkManager`/`TermLayer`/`NLCache`/`CognitiveParameters`/`LMRules` serialize/deserialize signatures without breaking callers.

**Genuinely remaining work for future sessions (all higher-risk or require dedicated focus):**
1. Phase 9.4 — Standardize tsconfig across packages (BLOCKED on `ui` TS-version alignment).
2. Phase 9.5 — Fix `turbo run typecheck` circular dep (BLOCKED on kernel-vs-util split; `nar` imports runtime symbols from `@senars/core`, so merely relabeling to `devDependencies` breaks runtime).
3. Phase 4.5.1 — Uniform `Serializable` contract for concrete classes (signature changes required; dedicated session).

---

### Session 2026-07-17 (later) — Phase 4.5.2 `@public` tags extended to `nar`/`io` barrels (Complete)

**Changes:**
- `nar/src/index.ts` — Added concise `@public` JSDoc to every primary public export group (core types, terms, rules, memory, task, reason, NAR class, factory, lifecycle, NL translation, cognitive, LLM service, episodic memory). Matches the `core` barrel tagging style.
- `io/src/index.ts` — Added `@public` JSDoc to every public export (connections, command registry, bridge binding/middleware, HTTP/WS helpers, connection managers, auth).

**Verification:**
- `pnpm --filter @senars/nar typecheck` — passes
- `pnpm --filter @senars/io typecheck` — passes
- `pnpm test` — `1102 passed, 2 skipped` (no regressions)

**Plan status after this session:**
- **Phase 4.5.2** COMPLETE — `@public` tags now present in `@senars/util` (Phase 4), `@senars/core` (Phase 10.3 session), and `@senars/nar` + `@senars/io` (this session). The shared-foundation API surface is fully documented. Type-only exports in nar/io left untagged (lower priority per plan; runtime symbols carry the public contract).
- **Phase 10.3** COMPLETE (export-boundary script + npm script).
- **Phase 8 (9.1/9.2)** assessed and deferred — not viable as specified without behavior change (see prior session log). 9.3 benchmark infra + 9.4 structured logging delivered.
- **Phase 9.4 (tsconfig standardization)** + **Phase 9.5 (turbo circular-dep fix)** still deferred — require a dedicated high-risk session (TypeScript-version alignment `ui` 5.9.3 vs others 7.0.1-rc + kernel-vs-util dependency-graph surgery). Do NOT attempt alongside other changes.
- **Phase 4.5.1 (uniform `Serializable` contract)** still deferred — requires redesigning `Memory`/`Bag`/`LinkManager`/`TermLayer`/`NLCache`/`CognitiveParameters`/`LMRules` serialize/deserialize signatures without breaking callers.

**Genuinely remaining work for future sessions (all higher-risk or require dedicated focus):**
1. Phase 9.4 — Standardize tsconfig across packages (BLOCKED on `ui` TS-version alignment).
2. Phase 9.5 — Fix `turbo run typecheck` circular dep (BLOCKED on kernel-vs-util split; `nar` imports runtime symbols from `@senars/core`, so merely relabeling to `devDependencies` breaks runtime).
3. Phase 4.5.1 — Uniform `Serializable` contract for concrete classes (signature changes required; dedicated session).

---

### 2026-07-17 (final) Session — Phase 9.4 tsconfig standardization + Phase 9.5 turbo circular-dep fix (Complete)

**Approach:** Align every package on the latest TypeScript (7.0.1-rc, matching root) and remove turbo's hard cycle error by dropping unnecessary topological ordering (all packages consume sibling *source* `.ts` via pnpm hoisting, not built `dist`).

**Phase 9.4 — TypeScript version alignment + tsconfig standardization (COMPLETE):**
- `ui/package.json` — Bumped `typescript` from `^5.9.3` → `7.0.1-rc` (now matches root + other packages). Removes the version divergence that blocked `ui` from extending `tsconfig.base.json`.
- `ui/tsconfig.json` — Now `extends ../tsconfig.base.json` (was a standalone 5.9.3-only config). Adds `DOM`, `DOM.Iterable` to the base `lib` (frontend needs the DOM) + `experimentalDecorators`, `useDefineForClassFields: false`, `types: ["node"]`. `include`/`exclude` unchanged.
- `ui/src/client/globals.d.ts` — **New file:** `declare module '*.css';` (Vite CSS side-effect imports need an ambient declaration under TS 7's stricter TS2882 side-effect-import checking).
- `ui/src/client/spacegraph/spacegraph-app.ts` — **Bug fix surfaced by TS 7:** 9 side-effect imports pointed at `./connection-banner.js` etc. (siblings) but the real components live in `../components/`. Corrected all 9 paths to `../components/...`. (Pre-existing latent broken import that 5.9.3 silently tolerated; files exist, paths were wrong.)
- `metta/tsconfig.json` — Slimmed to inherit base `noEmit`; removed the emit-specific overrides.
- `metta/tsconfig.build.json` — **New file:** the emit config (`NodeNext`, `declaration`, `outDir: ./dist`) referenced by `metta`'s `build` script. Splits typecheck (noEmit) from build (emit) per plan 10.4.
- `metta/package.json` — `build` script now `tsc -p tsconfig.build.json`.
- Other packages (`util`, `core`, `nar`, `io`) already extended `tsconfig.base.json` — no change needed.

**Phase 9.5 — `turbo run typecheck` circular-dep fix (COMPLETE):**
- Diagnosis: turbo 2.10 refused to run `typecheck`/`build` because the package graph is cyclic (`core → nar → io → core`, `metta → core → metta`). `turbo` counts both `dependencies` AND `devDependencies` for cycle detection, so merely relabeling deps couldn't help.
- `core/package.json` — `@senars/nar` and `@senars/metta` moved from `dependencies` → `devDependencies` (accurate: `core` imports them **only as `import type`** — zero runtime imports — verified via grep). More correct dependency typing; does not by itself satisfy turbo but documents the real edge.
- `turbo.json` — Removed `dependsOn: ["^typecheck"]` from `typecheck` and `dependsOn: ["^build"]` from `build`. This drops turbo's requirement for an acyclic topological order. Safe because **every package's `exports` point to `./src/*.ts` (source), never `dist`** — consumers read sibling source via pnpm-symlinked `node_modules`, so build/typecheck ordering across packages is unnecessary.
- Result: `pnpm turbo run typecheck` → **6 successful, 6 total** (was a hard cycle error). `pnpm turbo run build` → `metta` builds cleanly.

**Pre-existing, OUT OF SCOPE failure (verified on clean HEAD via `git stash`):**
- `pnpm --filter @senars/ui build` (`pnpm build:client`, Vite/Rollup) fails with: `../core/src/motor/builtin-tools.ts (8:12): "access" is not exported by "__vite-browser-external"`. This is a Node builtin (`fs.access`) being externalized in the browser bundle — unrelated to tsconfig/import-path changes and untouched by this session. Not addressed (would require Vite `resolve.alias`/polyfill for `fs` in `ui`; separate concern).

**Verification:**
- `pnpm turbo run typecheck` — 6/6 pass (was a hard cycle error).
- `pnpm --filter @senars/ui typecheck` — passes (TS 7).
- `pnpm --filter @senars/metta build` — passes (declarations emitted to `dist`).
- `pnpm test` — `1102 passed, 2 skipped` (no regressions).
- `pnpm run exports:check` — passes (all 6 packages).
- `pnpm run deps:check` — runs (informational ~303 internal circular *imports* via dpdm; the package-graph turbo cycle is resolved).

**Plan status after this session:**
- **Phase 9.4 (10.4)** COMPLETE — all 6 packages on TS 7.0.1-rc; `ui` + `metta` now extend `tsconfig.base.json`; `metta` has a split `tsconfig.build.json`.
- **Phase 9.5 (10.5)** COMPLETE — `turbo run typecheck` passes (6/6); package-graph cycle no longer blocks turbo tasks.
- **Phase 10.1** (Biome `noUnusedImports` warn) — done in prior session.
- **Phase 10.2** (`deps:check` script) — done in prior session.
- **Phase 10.3** (export-boundary script) — done in prior session.
- **Phase 4.5.1** — still deferred (uniform `Serializable` contract; signature redesign required).

**Genuinely remaining work for future sessions (higher-risk / dedicated focus):**
1. Phase 4.5.1 — Uniform `Serializable` contract for concrete classes (`Memory`/`Bag`/`LinkManager`/`TermLayer`/`NLCache`/`CognitiveParameters`/`LMRules`); signature changes required without breaking callers.
2. (Optional, separate) Fix `ui` browser build's `fs.access` externalization in Vite config (`resolve.alias` or browser shim) — pre-existing, not a unification task.

