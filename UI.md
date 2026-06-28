# SeNARS UI — Complete Analysis & Development Plan

> **Status:** Updated after `ui/` fix pass (Jun 28, 2026). Items marked **[DONE]** are implemented.
> Remaining work is concentrated in the engine layer (`src/nar/`), not the UI layer.

## 1. Critical Architecture: The Event Bus Problem

The UI updates via WebSocket messages triggered by **system event bus** events. The core engine has two event buses:

| Bus | Type | Purpose |
|-----|------|---------|
| `NarEventBus` | `src/nar/types/events.ts` | Internal NAR events (rule processor, tools, etc.) |
| `AgentEventBus` | `src/agent/EventBus.ts` | System events for UI + cross-component communication |

**The bridge** (`wrapNarEventBus` in `AgentEventBus.ts:128-134`) is meant to relay `NarEventBus` events to `AgentEventBus`. But it's **dead code** — none of the bridged events (`rule:applied`, `concept:created`, `lm-rule:executed`, `lm-rule:failed`) are ever emitted in production.

### What Actually Fires on the System Bus

| Event | Emitted By | When | Works? |
|-------|-----------|------|--------|
| `nar:derivation` | `NARIO.addTask()` (for new concepts), `NARExecution.run()` | Per new concept via input OR derived belief during reasoning cycle | ✅ Works for all input types |
| `nar:reasoning:cycle` | `NARExecution.run()` at `src/nar/nar-execution.ts:84` | Per cycle | ✅ Only during `nar.run()` |
| `system:lm.rule:*` | `LMRule.apply()` | When LM rules fire | ✅ |
| `agent:process:*` | `LMChatService` | Agent chat lifecycle | ✅ |
| `nar:concept:activated` | `NARIO.addTask()` (for new concepts) | When new concepts are added via input | ✅ Now works |

### What SHOULD Fire but NEVER Does

| Event | Supposed Source | Why Missing |
|-------|----------------|-------------|
| `nar:drive:changed` | DriveManager / AutonomyEngine | Never emitted in production code |
| `nar:task:added` | — | Defined in type but never emitted |
| `nar:goal:resolved` | — | Defined in type but never emitted |
| `nar:conflict:detected` | — | Defined in type but never emitted |

### Consequences

**`BEFORE:** `nar.believe("bird. %0.9;0.9%")` → no system events.

**`AFTER:** `nar.believe("bird. %0.9;0.9%")` → emits `nar:concept:activated` + `nar:derivation` → UI updates.

---

## 2. Data Flow: Narsese Input → UI Update

### Current (Working) Path

```
User inputs Narsese (via chat or API):
  nar.believe("bird. %0.9;0.9%")
   → NARIO.believe()
     → NARIO.input()
       → memory.addTask()      // concept added to memory
       → emit 'nar:concept:activated' + 'nar:derivation' on system bus
   → Server WebSocket handlers receive events
   → Graph updates, focus panel updates
```

---

## 3. Complete UI Component Inventory & Data Flow

(See original UI.md for unchanged store/component tables)

---

## 4. Missing / Broken Functionality

### 4.1 Critical Bugs

| # | Bug | Root Cause | Files | Status |
|---|-----|-----------|-------|--------|
| 1 | Narsese input doesn't update graph | `nar.believe()` emits no system events | `src/nar/nar-io.ts` | **[DONE]** — system events now emitted from `addTask()` |
| 2 | Focus panel never updates | `nar:concept:activated` never fires | `src/nar/**`, `ui/src/server/connection.ts` | **[DONE]** — fixed with P0 event emission |
| 3 | `stream_reasoner` module messages ignored | Protocol defined, client ignores it | `ui/src/client/core/store-bindings.ts` | **[DONE]** — now merged into graph |
| 4 | `focus.set` not sent or handled | Client never sent it, server had no handler | `ui/src/server/gateway.ts`, `chat-console.ts`, `belief-graph.ts` | **[DONE]** — both client send + server handler implemented |
| 5 | `lens` field on `CognitiveDelta` never read | Protocol includes it, client ignores it | `ui/src/client/core/store-bindings.ts` | Still open — low impact |
| 6 | `state.snapshot` missing graph meta | handleSync sends incomplete snapshot | `ui/src/server/gateway.ts` | Partially fixed — nodes now include label/nodeType |

### 4.2 Missing Features

| # | Feature | Priority | Current State |
|---|---------|----------|--------------|
| 1 | Graph updates on ANY concept change | P0 | ✅ Works now |
| 2 | Focus panel shows active concepts | P0 | ✅ Works now |
| 3 | Status bar shows cycle count, derivation rate | P1 | Shows only connection state and lens |
| 4 | Telemetry panel shows live data | P1 | Canvas renders but server never sends `telemetry` messages |
| 5 | Contradiction count works | P1 | ContradictionBadge counts magenta nodes but server never marks contradictions |
| 6 | User can configure LM provider/API key at runtime | P1 | Config fields exist, but no wiring to agent |
| 7 | Concept thread shows messages for focused term | P1 | Works but only filters client-side `$chat` |
| 8 | Lens switching changes graph visual encoding | P1 | Works for existing nodes |
| 9 | Error messages displayed to user | P2 | Errors from agent.chat() shown |
| 10 | Keyboard shortcuts | P2 | None implemented |

---

## 5. Rename: Working Memory → Focus **[DONE]**

(See original UI.md for unchanged table)

---

## 6. User Flows — Complete

### Flow 2: Narsese Input → Graph Update ✅ FIXED

```
User inputs Narsese (via chat or API):
  nar.believe("bird. %0.9;0.9%")

Expected:
  → Concept "bird" appears in graph
  → Focus panel updates with bird as active concept

Current status: ✅ Works - system events emitted from NARIO.addTask()
```

---

## 7. Protocol — Missing Server Handlers

(See original UI.md - unchanged)

---

## 8. Immediate Fixes Completed

### P0 — Event Bus Wiring ✅ DONE

**A. Emit events from `NARIO.input()`** (`src/nar/nar-io.ts`):
```ts
// In addTask(), after adding concept:
if (wasNew) {
    this._systemEventBus?.emit('nar:concept:activated', {
        term: term.toString(),
        priority: budget.priority,
        timestamp: Date.now(),
    });
    this._systemEventBus?.emit('nar:derivation', {
        term: term.toString(),
        confidence: truth.f,
        timestamp: Date.now(),
    });
}
```

This ensures ANY input (Narsese, belief, goal, question) triggers UI updates.

---

## 9. Remaining Work (Engine Layer)

All remaining fixes are in the **engine layer** (`src/nar/`). The UI is fully wired and will work once these are fixed.

| # | Fix | File | Impact | Status |
|---|-----|------|--------|--------|
| 1 | Emit `concept:created` on NarEventBus | `src/nar/memory/memory.ts` | Unblocks `wrapNarEventBus` bridge | Still open |
| 2 | Emit `nar:drive:changed` | `src/agent/AutonomyEngine.ts` | Working memory ("Focus") shows drive state | Still open |
| 3 | Wire `LLM config` changes to runtime | `src/nar/lm/providers.ts` + adapter | Provider/model changes take effect | Still open |

---

## 10. Completed Work (This Pass)

### UI Layer (`ui/src/client/`)

| File | Change |
|------|--------|
| `vite.config.ts` | Added explicit `hmr: { port: 5173 }` |
| `entry.ts` | Removed `onboarding` import; added `focus-panel` |
| `components/app-layout.ts` | Removed `$userLevel`; added `focus-panel`, `telemetry-panel` |
| `components/chat-console.ts` | Now sends `{ type: 'focus.set', term }` on message click |
| `components/belief-graph.ts` | Now sends `{ type: 'focus.set', term }` on node tap |
| `components/focus-panel.ts` (renamed) | WorkingMemory → FocusPanel; `$workingMemory` → `$focus` |
| `core/store.ts` | Removed `$userLevel`; renamed `$workingMemory` → `$focus` |
| `core/store-bindings.ts` | Added `stream_reasoner` handler; `$workingMemory` → `$focus` |
| `core/ws-client.ts` | Removed client-side ping |

### UI Server (`ui/src/server/`)

| File | Change |
|------|--------|
| `gateway.ts` | Silently drops invalid client messages; added `focus.set` handler |
| `index.ts` | Added `onFocusChange` callback in `bindSocket` |
| `nar-adapter.ts` | Added LM provider config fields |
| `test-control.ts` | Removed manual `nar:derivation` emission |

### Engine Layer (`src/nar/`)

| File | Change |
|------|--------|
| `nar-io.ts` | Added `setSystemEventBus()`; emit events in `addTask()` for new concepts |
| `nar.ts` | Initialize `AgentEventBus` before `NARIO`, pass via `setSystemEventBus()` |

### Tests

| File | Change |
|------|--------|
| `05-events-errors.test.ts` | Added 4 tests verifying system event bus emission on believe/goal/question |