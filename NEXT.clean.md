# NEXT.clean.md — Comprehensive Codebase Unification & Strengthening Plan

> **Philosophy:** Unify, deduplicate, strengthen. **Never delete potentially functional code.** If it compiles, tests pass, and it might be used — keep it, reorganize it.

---

## 0. Current State (Verified 2026-07-17)

| Metric | Status |
|--------|--------|
| Tests | 1008 passed, 2 skipped (1010 total) |
| TypeScript | 5/5 packages clean |
| Bins | 7/7 run: `senars`, `bot-ai`, `repl`, `multi-agent`, `multi-agent-demo`, `mcp-server`, `sg` |
| Architecture | Single `Agent` class (`core/src/Agent.ts`), single `createAgent` factory (`nar/src/agent/index.ts`) |

---

## 1. Deduplication — Bin Consolidation

### 1.1 Merge `multi-agent.ts` & `multi-agent-demo.ts`
**Files:** `src/bin/multi-agent.ts` (84 lines), `src/bin/multi-agent-demo.ts` (88 lines)
- **Difference:** Only logger scope name and console banner text
- **Action:** Create `src/bin/lib/multi-agent-runner.ts` with parameterized config; both bins delegate to it
- **Result:** ~80 lines deduplicated, single source of truth for multi-agent demo logic

### 1.2 Extract REPL Commands to Shared Module
**File:** `src/bin/repl.ts` (344 lines)
- **Action:** Move `buildCommands()` and `CLICommand[]` to `src/cli/commands.ts`
- **Benefit:** Reusable by other CLI tools, testable in isolation, cleaner bin entry point

### 1.3 Shared Bin Utilities
**Files:** All bins repeat agent startup/shutdown, signal handling, logging
- **Action:** Create `src/bin/lib/lifecycle.ts` with `runAgent()`, `gracefulShutdown()`, `createAgentFromEnv()`
- **Result:** Consistent behavior, reduced boilerplate in each bin

---

## 2. Unification — Bridge Layer Clarification

### 2.1 Distinguish Two Bridge Roles
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

**Shared Extraction:** `ChatStreamHandler.ts` — single implementation of:
```typescript
async function collectChatStream(agent: Agent, input: string): Promise<string>
```

### 2.2 Unify Session Management
- `core/src/memory/SessionManager.ts` — JSONL persistence
- `io/src/bridge.ts` — Anonymous in-memory `SessionManager` impl (lines 44-62)
- **Action:** Export `InMemorySessionManager` from core; io bridge imports it instead of inline class

---

## 3. Strengthening — Large File Modularization

### 3.1 `nar/src/rules/rules-dsl.ts` (1036 lines) → Package Structure
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
│   └── meta/                   # UNIMPLEMENTED (keep as stubs with TODO comments)
│       ├── operationExecution.ts
│       ├── goalExecution.ts
│       ├── strategyEffectiveness.ts
│       ├── resourceAllocation.ts
│       ├── errorPatternDetection.ts
│       ├── utilityEstimation.ts
│       ├── metacognitiveRevision.ts
│       └── selfModelConsistency.ts
└── registration.ts             # NAL_RULES, NAL_EXTENDED_RULES arrays + registerRulesFromDSL()
```

**Benefits:**
- Each rule category in its own file — easier to navigate, test, extend
- Unimplemented rules clearly marked in `meta/` with JSDoc `@todo`
- No code deleted — just reorganized
- Tree-shaking friendly for future bundle optimization

### 3.2 `nar/src/lm/lm-rule-factory.ts` (805 lines) → Split by Responsibility
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

### 3.3 `nar/src/cognitive/SelfAnalyzerService.ts` (722 lines) → Extract Analyzers
```
nar/src/cognitive/
├── SelfAnalyzerService.ts      # Orchestrator, ~150 lines
├── analyzers/
│   ├── index.ts
│   ├── belief-analyzer.ts
│   ├── goal-analyzer.ts
│   ├── concept-analyzer.ts
│   ├── contradiction-detector.ts
│   └── pattern-miner.ts
└── reports/
    ├── index.ts
    └── formatters.ts
```

### 3.4 `core/src/Protocol.ts` (375 lines) → Separate Concerns
```
core/src/protocol/
├── index.ts                    # Re-exports
├── cognitive.ts                # CognitiveDelta, BridgeEvent, BridgeDelta
├── ui.ts                       # ChatMessage, GraphNodeData, ConfigField, Lens
├── agent.ts                    # AgentCapabilities, NarConceptNode, MettaAtomNode, MettaSkillNode
├── messages.ts                 # IncomingFromClient, IncomingFromServer, ModelEvent
└── types.ts                    # GraphOpType, ConfigFieldType, GraphOp
```

### 3.5 `core/src/Agent.ts` (392 lines) — Already Clean, Optional Phase Extraction
```
core/src/agent/
├── Agent.ts                    # Main class, ~200 lines
├── phases/
│   ├── perceive.ts
│   ├── recall.ts
│   ├── reason.ts
│   ├── narrate.ts
│   ├── act.ts
│   └── consolidate.ts
└── lifecycle.ts                # start(), stop(), health()
```

---

## 4. Type Consolidation — Shared Types Package

### 4.1 Create `@senars/shared` Package
**Problem:** Circular deps between core↔nar↔metta↔io; duplicate types across packages.

**Solution:** Extract all shared type definitions to `@senars/shared`:
```
shared/
├── package.json
├── src/
│   ├── index.ts
│   ├── cognitive.ts           # CognitiveEvent, CognitiveStimulus, Context, Derivation
│   ├── engine.ts              # Engine, EngineId, ToolResult
│   ├── memory.ts              # Episode, ConversationSession, SessionManager, EpisodicMemory
│   ├── agent.ts               # AgentOptions, HealthStatus, SkillDefinition, ParsedCommand
│   ├── bridge.ts              # BridgeOptions, BridgeContext, BridgeEvent, BridgeDelta
│   ├── protocol.ts            # All protocol types (from core/protocol/)
│   ├── transport.ts           # Connection, ConnectionConfig, IOMessage
│   ├── llm.ts                 # LMService, ModelRunner types
│   └── config.ts              # ConfigView, ConfigEvent, ConfigSchema
```

**Migration:** Each package changes `import { X } from '@senars/core'` → `import { X } from '@senars/shared'` for types only. Runtime imports stay.

**Benefit:** Breaks circular deps, single source of truth for types, enables independent versioning.

---

## 5. Dead Export Audit — Conservative Approach

### 5.1 Catalog All `in_degree=0, out_degree=0` Exports
From graph analysis, these appear unused but **MAY be used via side-effects or dynamic imports**:

| Package | Function | Likely Status | Action |
|---------|----------|---------------|--------|
| `core` | `createChatService` | Exported from index, may be used | **Keep**, add `@public` JSDoc |
| `core` | `lensSpecToJsonSchema` | Exported, UI may use | **Keep** |
| `core` | `createToolPlugin` | Exported from plugins | **Keep** |
| `nar` | `throttleGenerator` | Utility, may be imported elsewhere | **Keep**, move to `shared/utils` |
| `nar` | `isUnderconnected` etc. | Rule factory internals | **Keep** (used by factory) |
| `nar` | Command `execute` fns | Registered via side-effect | **Keep** |
| `nar` | Truth helpers (`harshness`, `choice`, etc.) | Used in truth calculations | **Keep** |

**Action:** Add `@public` or `@internal` JSDoc tags to clarify intent. Do NOT delete.

### 5.2 Mark Explicitly Unimplemented Rules
In `nar/src/rules/extended/meta/*.ts`:
```typescript
/**
 * @unimplemented — Placeholder for future NAL procedural reasoning
 * @see https://github.com/senars/senars/issues/XXX
 */
export const operationExecution: RuleFn = () => undefined;
```

---

## 6. Performance — Call Chain Optimization

### 6.1 Lazy Tool Registration
**Issue:** `createAgentDispatch`, tool creators have high `transitive_loop_depth` (19-25) due to eager registration.

**Action:** Convert to lazy getters:
```typescript
// Before: eager array of tools
export const tools = createAllTools();

// After: lazy factory
export function createTools(): Tool[] { return [...]; }
```

### 6.2 Memoize Expensive Computations
- `nar/src/lm/lm-service.ts`: `doGenerate`, `doStream` — cache model responses
- `nar/src/terms/truth.ts`: Truth operations — memoize common combinations
- `core/src/eventlog/AbstractEventLog.ts`: `validatePayload` — compile validators once

---

## 7. Testing — Strengthen Without Mocks

### 7.1 Add Integration Tests for Bridge Layer
- Test `bindAgentToConnection` with real `Agent` + mock `Connection`
- Test middleware pipeline: auth → command → session → agent
- Test `AgentBridge` cognitive event projection with real events

### 7.2 Property-Based Tests for Rules
- Use `fast-check` to verify rule properties (commutativity, associativity where applicable)
- Test NALRules + NALExtendedRules against known inference patterns

### 7.3 E2E Bin Tests
- Each bin: startup → send message → verify response → shutdown
- Use real NAR + in-memory event log (no external deps)

---

## 8. Configuration — Single Source of Truth

### 8.1 Consolidate Config Schema
**Current:** `core/src/config/`, `src/config/`, env vars in multiple bins
**Action:** 
```
config/
├── schema.ts              # Zod schema for all config
├── defaults.ts            # Default values
├── env.ts                 # process.env → config mapping
└── validation.ts          # validateAgentOptions (existing)
```
All packages and bins import from `@senars/config` (new package or shared).

---

## 9. Phased Implementation Plan

| Phase | Focus | Files Changed | Est. LOC Delta | Verification |
|-------|-------|---------------|----------------|--------------|
| **1** | Bin deduplication | `multi-agent*.ts`, `repl.ts`, new `bin/lib/` | -150 | All 7 bins run |
| **2** | Bridge unification | `core/bridge/`, `io/bridge/`, shared `ChatStreamHandler` | -80 | Tests pass, bot-ai works |
| **3** | Rules-dsl modularization | `nar/src/rules/` restructure | 0 (reorg) | All rule tests pass |
| **4** | LM rule factory split | `nar/src/lm/` restructure | 0 (reorg) | LM tests pass |
| **5** | Shared types package | New `@senars/shared`, update imports | +200 (types) | Typecheck clean, no circular deps |
| **6** | Protocol split | `core/src/protocol/` | 0 (reorg) | UI server works |
| **7** | Config consolidation | New `@senars/config` | -100 | All bins use single config |
| **8** | Performance & testing | Lazy tools, memoization, new tests | +300 (tests) | Benchmarks, coverage |

---

## 10. Non-Goals (Explicitly Out of Scope)

- ❌ Deleting unimplemented rules (`operationExecution`, etc.) — keep as documented stubs
- ❌ Removing "dead" exports — tag with `@internal` instead
- ❌ Changing public APIs — all changes internal/structural
- ❌ Rewriting working logic — only reorganize, extract, unify
- ❌ Adding new features — pure refactoring

---

## 11. Success Criteria

| Criterion | Target |
|-----------|--------|
| All 1010 tests pass | ✅ |
| 5/5 packages typecheck clean | ✅ |
| 7/7 bins run | ✅ |
| Zero circular dependencies (turbo) | ✅ |
| No duplicate code (bins, bridges, rules) | ✅ |
| All exports documented (`@public`/`@internal`) | ✅ |
| Rules-dsl.ts < 200 lines (main) | ✅ |
| Single `ChatStreamHandler` used everywhere | ✅ |
| Single `SessionManager` implementation | ✅ |

---

## 12. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking dynamic imports | Search for `import()` patterns before moving files |
| Test failures from path changes | Update test imports in same PR; run full suite |
| Circular dep resolution | Use `import type` for all type-only imports; shared package for runtime types |
| Bin behavior changes | Manual smoke test each bin after Phase 1-2 |

---

**Next Step:** Begin Phase 1 (Bin Deduplication) — lowest risk, immediate LOC reduction, validates approach.