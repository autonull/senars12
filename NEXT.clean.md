# NEXT.clean.md — Codebase Unification, Deduplication & Strengthening Plan

> **Philosophy:** Unify, deduplicate, strengthen. **Never delete potentially functional code.** If it compiles, tests pass, and it might be used — keep it, reorganize it, document it. Every change must preserve or improve correctness.

---

## 0. Current State (Verified 2026-07-17)

| Metric | Status |
|--------|--------|
| Tests | 1008 passed, 2 skipped (1010 total) |
| TypeScript | 5/5 packages typecheck individually (`pnpm --filter <pkg> typecheck`) |
| Turbo typecheck | Fails — circular dep core↔nar↔io (pre-existing) |
| Bins | 7/7 run: `senars`, `bot-ai`, `repl`, `multi-agent`, `multi-agent-demo`, `mcp-server`, `sg` |
| Lint | Biome, no eslintrc, no import boundary rules |
| Agent architecture | single `Agent` class (`core/src/Agent.ts`), single `createAgent` factory (`nar/src/agent/index.ts`) |
| Packages | 5: `core`, `nar`, `io`, `metta`, `ui` (+ root `src/` for bins) |
| Dep graph | `core → nar, metta`; `nar → core, io`; `io → core`; `metta → core` |
| Error systems | **Two** — `AgentError` (core, 6 classes) and `NARError` (nar, 4 classes) |
| Command systems | **Two** — `CommandRegistry` (io) + `command-types.ts` (core) |
| Event systems | **Two** — `CognitiveEvent` (core) + `NAREventMap` (nar, 50+ event types) |
| Serialization | Distributed across nar (terms, memory, bag, links, cache, params) — no shared interface |
| Logging | Shared `Logger` in core, re-exported by nar/io — but many raw `console.*` calls remain |

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

### 2.2 Extract REPL Commands to Shared Module
**File:** `src/bin/repl.ts` (344 lines)
- **Action:** Move `buildCommands()` and `CLICommand[]` to `src/cli/commands.ts`
- **Benefit:** Reusable by other CLI tools, testable in isolation, cleaner bin entry point

### 2.3 Shared Bin Utilities
**Files:** All bins repeat agent startup/shutdown, signal handling, logging
- **Action:** Create `src/bin/lib/lifecycle.ts` with `runAgent()`, `gracefulShutdown()`, `createAgentFromEnv()`
- **Result:** Consistent behavior, reduced boilerplate in each bin

### 2.4 Unify Bin Configuration From Env
**Files:** Each bin reads `process.env` differently
- **Action:** Create `src/bin/lib/env-config.ts` — single mapping of ALL env vars → config
  - `SENARS_AGENT_ID`, `SENARS_LOG_LEVEL`, `SENARS_NAR_PATH`, `SENARS_LLM_MODEL`, etc.
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

### 3.2 Unify Session Management
- `core/src/memory/SessionManager.ts` — JSONL persistence
- `io/src/bridge.ts` — Anonymous in-memory `SessionManager` impl (lines 44-62)
- **Action:** Export `InMemorySessionManager` from `@senars/util/memory`; io bridge imports it instead of inline class

### 3.3 Unify Command Systems
**Current:**
- `core/src/command-types.ts` — `CommandDefinition`, `CommandHandler`, `CommandContext` (types only)
- `io/src/commands/registry.ts` — `CommandRegistry` class implementing the same pattern

**Action:**
1. Move `CommandRegistry` (the class, with `register/execute/get/alias` logic) to `@senars/util/commands/`
2. Keep `command-types.ts` types alongside (or merge into util)
3. `io/commands/registry.ts` becomes a thin re-export
4. Add `nar/src/commands/` integration — let NAR commands be registered via the same `CommandRegistry`

### 3.4 Bridge the Two Event Systems
**Current:**
- `CognitiveEvent` (core) — discriminated union, 20+ types, `engine: 'nar'|'metta'` tagging
- `NAREventMap` (nar) — generic `EventBus<T>`, 50+ event types
- `BridgeEvent` (core) — projection of CognitiveEvents for UI

**Action:**
1. Formalize the mapping: `CognitiveEvent` ↔ `NAREventMap` event conversion
2. Add `nar/src/events/bridge.ts` — converts `NAREventMap` events → `CognitiveEvent`s (for NAR-internal events to flow up)
3. Move `EventBus` interface + `TypedEventEmitter` to `@senars/util/events/`
4. Fix the stale `core/src/events/` export — either populate `EventTypes.ts` or remove the dangling `package.json` export

---

## 4. Phase 3 — Modularization: Large File Splits

### 4.1 `nar/src/rules/rules-dsl.ts` (1036 lines) → Rule Package
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

### 4.2 `nar/src/lm/lm-rule-factory.ts` (805 lines) → Split by Responsibility
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

### 4.3 `nar/src/cognitive/SelfAnalyzerService.ts` (722 lines) → Extract Analyzers
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

### 4.4 `core/src/Protocol.ts` (375 lines) → Separate Concerns
```
core/src/protocol/
├── index.ts                    # Re-exports
├── cognitive.ts                # CognitiveDelta, BridgeEvent, BridgeDelta
├── ui.ts                       # ChatMessage, GraphNodeData, ConfigField, Lens
├── agent.ts                    # AgentCapabilities, NarConceptNode, MettaAtomNode, MettaSkillNode
├── messages.ts                 # IncomingFromClient, IncomingFromServer, ModelEvent
└── types.ts                    # GraphOpType, ConfigFieldType, GraphOp
```

### 4.5 `core/src/Agent.ts` (392 lines) — Extract Agent Phases
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
| **0** | `@senars/util` package + error unify | **High** (new package, wide imports) | +300 / -200 | Individual package typechecks; `turbo typecheck` |
| **1** | Bin deduplication + env config | **Low** (leaf nodes) | -150 | All 7 bins run end-to-end |
| **2** | Bridge + command + event unification | **Medium** (shared logic extraction) | -100 | Bridge integration tests; all bins work with chat |
| **3** | Large file modularization (rules, lm, analyzers, protocol, agent) | **Medium** (path changes, import updates) | 0 (reorg) | All rule + lm + cognitive tests pass |
| **4** | API surface standardization (Serializable, `@public`/`@internal`, stale exports) | **Low** | -20 | No new lint warnings |
| **5** | Serialization & persistence unification | **Low** | 0 (additive) | Serialization round-trip tests |
| **6** | Config system consolidation | **Medium** (env var changes) | -100 | All bins read same config sources |
| **7** | Testing strengthening | **Low** | +500 (tests) | Coverage report; property tests |
| **8** | Performance (lazy, memoize) + structured logging | **Low** | -100 (log cleanup) | Benchmarks; no console.* in prod code |
| **9** | Tooling & CI (circular dep detection, boundary rules, tsconfig standards) | **Low** | +50 (config) | `deps:check` passes; turbo typecheck |

**Execution rule:** Each phase must pass `pnpm run test` + `pnpm --filter <affected> typecheck` before moving to next.

---

## 13. Success Criteria

| Criterion | Current | Target |
|-----------|---------|--------|
| All tests pass | 1010 | ≥1010 |
| 5/5 packages typecheck clean | ✅ | ✅ |
| `turbo typecheck` passes | ❌ (cycle) | ✅ |
| 7/7 bins run | ✅ | ✅ |
| No duplicate code (bins, bridges, commands, errors) | ❌ (bin dup, cmd dup, error dup) | ✅ |
| Single `ChatStreamHandler` | ❌ (2 impls) | ✅ |
| Single `CommandRegistry` | ❌ (2: io + core types) | ✅ |
| Single error hierarchy | ❌ (2: AgentError + NARError) | ✅ |
| All exports tagged `@public`/`@internal` | ❌ | ✅ |
| No raw `console.*` in prod code | ❌ (~5 files) | ✅ |
| Circular dep detection in CI | ❌ | ✅ |
| `rules-dsl.ts` main file < 200 lines | 1036 | <200 (reorg'd) |
| `lm-rule-factory.ts` main file < 200 lines | 805 | <200 (reorg'd) |
| `SelfAnalyzerService.ts` < 200 lines | 722 | <200 (reorg'd) |
| `Protocol.ts` main file < 100 lines | 375 | <100 (reorg'd) |
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
| 4 | `core/src/events/` export fix | Immediate (stale export, no consumers) |
| 6 | Old env var names → new `SENARS_*` standard | 1 release with both supported |

---

## 17. Quick Wins (Can Be Done Immediately, Any Order)

These are individual, low-risk, high-value changes that don't depend on other phases:

1. **Fix stale `core/src/events/` export** — either create `EventTypes.ts` or remove the `package.json` export
2. **Add `@unimplemented` JSDoc tags** to the 13 undefined NALExtendedRules
3. **Add `invariant` utility** — use for pre/post-condition checks instead of inline `if(!x) throw`
4. **Deduplicate `multi-agent.ts` / `multi-agent-demo.ts`** — pure extraction, no risk
5. **Replace `console.*` in prod files** with structured logger — mechanical change, low risk
6. **Add `deps:check` script** with `dpdm` — no code changes, just config

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

**Next recommended step:** Begin Phase 0 (Create `@senars/util` package). Start with `util/package.json`, `util/tsconfig.json`, and migrate one type file (e.g., `types/cognitive.ts`) to validate the approach before migrating all types.
