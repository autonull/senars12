# NEXT.agent9.md — Completing the Event-Sourced Capability Kernel

> **Status**: ✅ COMPLETE. All 6 phases implemented, typecheck passes across all 5 packages, 14 new tests pass. This plan document is now archived — future sessions should create a new plan (e.g., `NEXT.agent10.md`) for any follow-up work.

---

## ✅ Phase 1: EventBackend Base Class (Complete)

**Files created**:
- `core/src/backend/EventBackend.ts` — abstract class with background subscription loop, `initialize(log, config)`, `process(event)` abstract method

**Files modified**:
- `nar/src/backend/NarBackendV2.ts` — extends `EventBackend`, removed `#log`, `#processEvents()`, duplicate subscription loop (~20 lines removed)
- `metta/src/backend/MettaBackendV2.ts` — extends `EventBackend`, removed `#log`, `#processEvents()`, duplicate subscription loop (~15 lines removed)

**Not refactored**:
- `VisualizationBackend` — has a different subscription pattern (full-sync then `fromId`-based) and subscribes to all events (`handles: ['*']`). Keeping it as-is avoids unnecessary abstraction.

**Verification**: Core, nar, metta, ui all typecheck. Tests pass (pre-existing failures unchanged).

---

## ✅ Phase 2: ToolProvider Interface + Kernel Auto-Registration (Complete)

**Files created**:
- `core/src/capability/ToolProvider.ts` — interface with `getTools(): ToolDefinition[]`

**Files modified**:
- `core/src/kernel/Kernel.ts` — `register()` now detects `ToolProvider` backends via `isToolProvider()` type guard, auto-registers tools in `#tools` map. Added `getTool(name)`, `findToolBackend(name)`, `requestTool(name, args, cid)`, `tools` getter.
- `nar/src/backend/NarBackendV2.ts` — now `implements ToolProvider` (already had `getTools()`)
- `metta/src/backend/MettaBackendV2.ts` — now `implements ToolProvider` (already had `getTools()`)
- `core/package.json` — added `./tool-provider` export path

**Notes**:
- `tool:*` capability prefix approach not adopted because the `Capability` enum uses symbolic values incompatible with string prefixes

---

## ✅ Phase 3: Unified `FactProjection` (Complete)

**Files created**:
- `core/src/events/FactProjection.ts` — `projectFact(event): UnifiedFact[]` covering `belief.added`, `atom.derived`, `belief.retracted`, `atom.retracted`, `input.user`

**Files modified**:
- `core/src/events/Projections.ts` — `projectGraph()` now consumes `projectFact()` internally for fact nodes, keeping `derivation.made` edge logic. `projectChat()` unchanged.

**Migration**: Additive. Existing `belief.added`/`atom.derived` stay. `projectFact()` is the single source for fact projections. Graph/chat projections consume it.

---

## ✅ Phase 4: Health + Metrics in Kernel (Complete)

**Files modified**:
- `core/src/kernel/Kernel.ts` — Added `BackendHealth` and `KernelMetrics` interfaces, `health()` method aggregating from backends (detects optional `health()` via type guard), `onHealthChange()`, `onMetrics()` subscription methods, `#startTime` tracking for uptime

**Design decision**: Backends can optionally implement `health(): BackendHealth` (duck-typed check rather than interface change to avoid breaking existing implementations).

---

## ✅ Phase 5: Kernel Tool Dispatch (Complete)

**Problem**: `NarBackend.requestTool()` used `#pendingTools` map to create promises and emit `tool.request` events, but nothing actually listened for `tool.request` to execute the tool and emit `tool.response`. The tool dispatch loop was broken.

**Solution**: Replaced the async-pending-promise pattern with direct Kernel routing.

**Files modified**:
- `core/src/capability/ToolProvider.ts` — Added `executeTool(name, args, correlationId): Promise<ToolResult>` and `ToolResult` interface to the interface
- `core/src/kernel/Kernel.ts` — Added `requestTool(toolName, args, correlationId)` method that:
  1. Looks up the backend via `findToolBackend()`
  2. Calls `backend.executeTool()` directly
  3. Appends `tool.response` event to the event log for audit
  4. Returns the `ToolResult`
  Updated `isToolProvider()` type guard to check for both `getTools` and `executeTool`
- `nar/src/backend/NarBackendV2.ts` — Removed `#pendingTools`, `requestTool()` method. Added `executeTool()` delegating to `this.#nar.executeTool()`. Removed `tool.response` from `handles` and its `process()` case. (~20 lines removed, now ~90 lines)
- `metta/src/backend/MettaBackendV2.ts` — Added `executeTool()` implementation wrapping `#runtime.evaluate()` for metta-match / metta-rewrite / metta-query tools

**Design decision**: Kernel routes tool requests synchronously (call backend, return result) rather than through the event loop, because tool execution is inherently request-response. The `tool.response` event is still appended for audit trail and projections.

---

## ✅ Phase 6: SqliteEventLog Persistent Store (Complete)

**Native dependency**: `better-sqlite3` — synchronous SQLite bindings (C addon). Matches the "native" requirement and outperforms Redis for local single-process append-heavy workloads (no IPC, no network, WAL mode).

**Files created**:
- `core/src/eventlog/SqliteEventLog.ts` — Full `EventLog` implementation backed by SQLite with:
  - WAL mode + NORMAL sync for write performance
  - Monotonic ULIDs (`monotonicFactory`) for lexicographically sortable IDs
  - `events` and `snapshots` tables
  - Prepared statements for all queries
  - In-memory subscriber notification (same push-based pattern as `InMemoryEventLog`)
  - Range queries using SQL `id > ? AND id <= ?`

**Files modified**:
- `core/src/eventlog/EventLog.ts` — Added `saveSnapshot(projectionName, version, data)` to interface
- `core/src/eventlog/InMemoryEventLog.ts` — Implemented `saveSnapshot` + `getSnapshot` using in-memory `Map`
- `core/src/eventlog/index.ts` — Added `SqliteEventLog`, `SqliteEventLogConfig` exports
- `core/package.json` — Added `better-sqlite3` dependency, `@types/better-sqlite3` devDep, `./sqlite-eventlog` export path
- `core/src/index.ts` — Added `SqliteEventLog`, `SqliteEventLogConfig` exports

**Test file**: `tests/unit/core/eventlog/sqlite-eventlog.test.ts` — 14 tests covering:
- Append, validation, oversized events, close state
- Size tracking, getRange (with and without toId)
- Subscription delivery, fromId replay, type filtering, early return
- Cross-instance persistence
- Snapshot save/load

**Verification**: All 5 packages typecheck. 14/14 sqlite tests pass. Pre-existing test failures unchanged.

---

## ⏳ Phase 7: Config Rollback/Replay — *Not started, nice to have*

`EventLog` already has `getSnapshot()`. `replay()` would need adding to the interface and implementations.

---

## Known Issues / Future Work

1. **UnifiedFact type refinement**: `UnifiedFact.truth` uses `{ frequency, confidence }` — the plan sketch used `{ f, c }`. Existing NAR backend emits `{ frequency, confidence }`. Keep current shape.
2. **Test fixes**: 30 test files have pre-existing failures unrelated to these changes (v1 backend tests calling `initialize({})` without EventLog mock, testing against `@senars/nar` which now exports NarBackendV2).
3. **`fact.added` event type**: Not added as an actual event type (keeping additive approach). `projectFact()` is a pure projection function, not an event emitter. If needed, a future session could add `fact.added` as a derived event.
4. **Metta tool execution**: The `executeTool` implementation in MettaBackendV2 parses inputs as MeTTa programs and evaluates them. A future session could add more robust tool-specific logic (space-aware matching, rewrite rule application, etc.).
5. **EventLog subscription in Kernel**: The Kernel does not subscribe to the event log. If the Kernel needs to react to events (e.g., tool.request from external sources), it would need its own subscription loop.

---

## Migration Order (updated)

| Phase | Status | Task | Files |
|-------|--------|------|-------|
| 1 | ✅ Done | `EventBackend` base class | `core/src/backend/EventBackend.ts` + 2 backend refactors |
| 2 | ✅ Done | `ToolProvider` + kernel auto-router | `core/src/capability/ToolProvider.ts`, `Kernel.ts` |
| 3 | ✅ Done | `FactProjection` + switch projections | `core/src/events/FactProjection.ts`, `Projections.ts` |
| 4 | ✅ Done | Kernel health/metrics | `Kernel.ts` interfaces + aggregation |
| 5 | ✅ Done | Kernel tool dispatch | `ToolProvider.ts`, `Kernel.ts`, `NarBackendV2.ts`, `MettaBackendV2.ts` |
| 6 | ✅ Done | `SqliteEventLog` persistent store | `core/src/eventlog/SqliteEventLog.ts`, tests |
| 7 | ⏳ Future | Config snapshot/replay | manual |
| — | **✅ ALL PHASES COMPLETE** | **Archive this document.** | — |

---

## Non-Goals (unchanged)

- ❌ Delete NAR modules — they are load-bearing for `createNAR()`.
- ❌ Inline "MinimalNAR" — false premise; backend uses full engine.
- ❌ Breaking event schema — `belief.added`/`atom.derived` remain.
- ❌ Distributed systems complexity — single-process kernel first.

### Exceptions

- `better-sqlite3` added as native dependency for SqliteEventLog. Rationale: persistent event storage is a core infrastructure concern that cannot be met by workspace packages alone. The C-native SQLite addon provides better performance than Redis for local append-heavy workloads.

---

## Result

| Metric | Before | After (agent9) | After (this session) |
|--------|--------|----------------|----------------------|
| Backend boilerplate (NarBackendV2) | ~115 lines | ~95 lines | ~90 lines |
| Backend boilerplate (MettaBackendV2) | ~93 lines | ~78 lines | ~88 lines (added executeTool) |
| Tool registration | Manual per-backend | Auto via Kernel `register()` | Auto via Kernel `register()` |
| Tool dispatch | Broken (requestTool emitted event with no listener) | Broken | Fixed: Kernel.requestTool() routes to backend, returns result |
| Fact projection | Embedded in `projectGraph` | Unified `projectFact()` | Unified `projectFact()` |
| Event systems | 2 parallel projections | 1 source of truth + unified projection | 1 source of truth + unified projection |
| Health/observability | Missing | Built into Kernel with `BackendHealth` detection | Built into Kernel |
| Event persistence | In-memory only | In-memory only | **SQLite** (`better-sqlite3`, WAL mode, monotonic ULIDs, snapshots) |
| Snapshot support | `getSnapshot` returns null | `getSnapshot` returns null | `getSnapshot` + `saveSnapshot` on all EventLog implementations |
