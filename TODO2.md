# Plan: Complete Working SeNARS — Fully Interactive & Observable Through UI

## What "Done" Means (Expanded)

```
User types in HUD → WS to server → agent.chat() → engine.reason() → derivations
  → CognitiveEvent emitted → handler converts to GraphDelta
  → UnifiedGraphProjection.applyDelta() → broadcast cognitive.delta over WS
  → ws-client.ts receives → applyServerMessage() → store atoms update
  → Lit components re-render graph
```

**Six acceptance criteria (all verifiable by single command):**

- [ ] `pnpm test` at root passes — including `tests/e2e/webui-client-verify.test.ts`
- [ ] `pnpm --dir ui build:client` succeeds
- [ ] `pnpm --dir ui test:unit` discovers and passes `button.test.ts` + modulation tests
- [ ] `pnpm vitest run tests/e2e/production-loop.test.ts` proves: **real NAR engine + probe → `$graphNodes` contains probe terms (not echoes)**
- [ ] `ENABLE_WEB_UI=1 LM_PROVIDER=mock pnpm bot` renders live graph in browser — verified by Playwright
- [ ] CI workflow(s) observed green on a PR

---

## P0 — Foundation (Already Complete)

| Item | Status |
|------|--------|
| P0#1 Guard `exposeTestApi()` against Node runtime | ✅ Done |
| P0#2 Fix TS cast in raw HTML `<script>` | ✅ Done |
| P0#3 Delete dead `entry.ts` + custom Vite plugins | ✅ Done |
| P0#4 Single canonical boot path (`entry.ts`) | ✅ Done |

---

## P1 — Tests That Run Real Code (Already Complete)

| Item | Status |
|------|--------|
| P1#5 Fix UI vitest config (jsdom, discover component tests) | ✅ Done |
| P1#6 Full root test suite green (91 files, 1105 tests) | ✅ Done |

---

## P2 — Connect UI to Real Agent (Already Complete)

| Item | Status |
|------|--------|
| P2#7 Wire `startAgentUI(agent)` to real cognitive events via `UnifiedGraphProjection` | ✅ Done |
| P2#8 `tests/e2e/production-loop.test.ts` proves real agent → graph pipeline | ✅ Done |

---

## P3 — CI at Ship Bar (Already Complete)

| Item | Status |
|------|--------|
| P3#9 Root-level test workflow (`.github/workflows/root-tests.yml`) | ✅ Done |
| P3#10 CI observed green locally | ✅ Done |

---

## P4 — Real Implementations, Zero Mocks in Critical Paths (NEW)

### P4#1 Replace Mock LM with Real Provider in E2E Tests

**Problem:** Current `production-loop.test.ts` uses `LM_PROVIDER=mock` which bypasses actual LLM synthesis. The NAR engine path works for Narsese, but natural language → Narsese translation is untested.

**Fix:**
```typescript
// tests/e2e/production-loop-real-lm.test.ts
import { createAgent } from '@senars/nar/agent';
import { startAgentUI } from '@senars/ui/server';
// Use real LM provider (OpenAI/Anthropic/local) via env
const agent = await createAgent({ 
  lmService: createLMServiceFromEnv() // REAL, not mock
});
```

**Verification:** `pnpm vitest run tests/e2e/production-loop-real-lm.test.ts` passes with real LM (requires API key in CI secret).

### P4#2 Wire `NarEventBus` → `CognitiveEvent` Bridge

**Where:** `nar/src/events/bridge.ts` (exists, unused)

**Fix:** In `NAREngine` or `NAR` wrapper, subscribe to NAR's internal event bus and emit `CognitiveEvent`s:
```typescript
// nar/src/engine/NAREngine.ts (or new bridge wiring)
import { narEventToCognitive, MAPPED_NAR_EVENTS } from '../events/bridge.js';

nar.on('*', (event, data) => {
  if (MAPPED_NAR_EVENTS.includes(event)) {
    const cognitive = narEventToCognitive(event, data, 'nar');
    if (cognitive) this.emitCognitive(cognitive); // via Agent's cycle host
  }
});
```

**Events gained:** `concept.activated`, `belief.added`, `belief.revised`, `belief.retracted`, `drive.changed`, `goal.achieved`, `conflict:detected`

**Verification:** New test `tests/e2e/nar-events-bridge.test.ts` asserts all event types appear in `cognitive.delta` stream.

### P4#3 Real Graph Edges from NAR Term Relations

**Problem:** `UnifiedGraphProjection` only emits `add_node`. Edges require parsing Narsese term structure.

**Fix:** Extend `applyDelta()` and bridge to emit edges:
```typescript
// In bridge handler for 'rule:applied' / 'derivation.made'
const { premises, conclusion } = data;
premises.forEach(p => {
  // Extract subject/predicate → edge
  const edge = parseTermToEdge(p, conclusion);
  if (edge) projection.applyDelta({ nodes: [], edges: [edge] });
});
```

**Verification:** `tests/e2e/graph-edges.test.ts` — send `<cat --> mammal>.`, assert edge `cat → mammal` exists in graph.

### P4#4 Real Chat Synthesis (Cortex) in Cycle

**Problem:** `agent.chat()` for non-Narsese falls back to mock cortex. Real `LLMCortex` must be wired.

**Fix:** In `createAgent()`, when `lmService` provided:
```typescript
const cortex = createCortexFromLM(lmService, promptBuilder);
agent = new Agent({ cortex, ... });
```

Ensure `cortex.synthesize({ stimulus, context, derivations })` streams `text-delta` events.

**Verification:** `tests/e2e/chat-synthesis.test.ts` — send "What is a cat?", assert streaming `chat.agent.delta` → final `chat.agent.complete` with non-empty response.

---

## P5 — Persistence & Session Management

### P5#1 SQLite Event Log + Session Restore

**Where:** `core/src/eventlog/SqliteEventLog.ts`, `core/src/memory/JsonlSessionManager.ts`

**Fix:** 
- On `agent.start()`, load last session via `JsonlSessionManager`
- On `agent.stop()`, persist via `sessionManager.snapshot()`
- Expose `/test/session-save` and `/test/session-load` endpoints for E2E

**Verification:** `tests/e2e/persistence.test.ts` — boot agent, add beliefs, restart, assert beliefs restored.

### P5#2 Belief Import/Export (Narsese Files)

**UI:** Config panel → "Export Beliefs" / "Import .narsese"

**Backend:** `agent.believe()` batch endpoint

**Verification:** `tests/e2e/belief-import-export.test.ts`

---

## P6 — Configuration & Runtime Control

### P6#1 NAR Parameter HUD

**Params:** `threshold`, `decay`, `horizon`, `maxCycles`, `evidentialBase`

**UI:** Config panel with live sliders → WS `config.set` → agent applies → `config.schema` broadcast

**Verification:** `tests/e2e/config-hud.test.ts` — change threshold via UI, assert NAR behavior changes.

### P6#2 Profile System (Save/Load Config Sets)

**UI:** Config profiles panel (already scaffolded)

**Storage:** localStorage + server-side JSON

---

## P7 — WebSocket Resilience & Observability

### P7#1 Auto-Reconnect with Exponential Backoff

**Where:** `ui/src/client/core/ws-client.ts`

**Behavior:** On close/error → wait 1s, 2s, 4s, 8s... max 60s → reconnect

**Verification:** `tests/e2e/ws-reconnect.test.ts` — kill server, restart, assert client reconnects and graph restores.

### P7#2 Connection State in Banner (Already Exists)

Ensure `connection-banner.ts` shows: `connecting` | `connected` | `reconnecting (attempt N)` | `disconnected`

### P7#3 Cognitive Metrics Panel (Phase 5 — Already Scaffolded)

**Data:** `derivationsPerSec`, `contradictionCount`, `workingMemorySize`, `beliefRevisionRate`

**Source:** `agent.getRecentDerivations()`, NAR stats, bridge events

**Verification:** `tests/e2e/cognitive-metrics.test.ts` — assert panel updates in real time.

---

## P8 — Contradiction & Conflict Visualization

### P8#1 Contradiction Lens + Badge

**Bridge event:** `conflict:detected` → `cognitive.delta` with `isContradiction: true`

**UI:** `contradiction-badge.ts` (exists) → click → filter graph to contradiction subgraph

### P8#2 Node History Drawer Scrubber

**Source:** `node.history` messages → `$nodeHistory` atom → drawer timeline

**Verification:** `tests/e2e/contradiction-visualization.test.ts`

---

## P9 — Multi-Agent / MCP Integration

### P9#1 MCP Server Exposure

**Where:** `src/bin/bot-ai.ts` already has `MCPConnection` factory

**Expose:** Agent as MCP tool (`nar_believe`, `nar_question`, `nar_goal`)

**Verification:** `tests/e2e/mcp-integration.test.ts` — external client calls MCP tool, graph updates.

---

## P10 — 3D SpaceGraph (Optional Track)

### P10#1 Stabilize `spacegraphjs7` Entry

**Issues:** WASM loading, camera controls, performance

**Verification:** `pnpm --dir ui build:spacegraph` succeeds, manual smoke test in browser.

---

## P11 — Developer Experience & Documentation

### P11#1 TypeDoc Generation

`pnpm doc` → `docs/api/` — CI artifact

### P11#2 Architecture Decision Records (ADRs)

`docs/adr/` — for major choices (event bridge, graph projection, LM integration)

### P11#3 Contributing Guide

`CONTRIBUTING.md` — test commands, PR checklist, release process

---

## Test Philosophy: No Mocks in Critical Paths

| Layer | Current | Required |
|-------|---------|----------|
| E2E WebSocket | Real WS server | ✅ Real |
| Agent | `createAgent({ lmProvider: 'mock' })` | **Real `lmService` or NAR-only** |
| NAR Engine | Real `NAREngine` | ✅ Real |
| LM Provider | Mock | **Real (CI secret) or Narsese-only path** |
| Graph Projection | Real `UnifiedGraphProjection` | ✅ Real |
| UI Components | jsdom + real Lit | ✅ Real |

**Rule:** If a test exercises the `agent.chat() → engine.reason() → cognitive.delta → graph` pipeline, it must use real implementations. Mocks only for external services (IRC, HTTP) or chaotic dependencies.

---

## Execution Order

```
P4#1 → P4#2 → P4#3 → P4#4   (real implementations, sequential)
P5#1 → P5#2                 (persistence, parallel)
P6#1 → P6#2                 (config, sequential)
P7#1 → P7#2 → P7#3          (resilience, sequential)
P8#1 → P8#2                 (contradictions, sequential)
P9#1                        (MCP, independent)
P10#1                       (3D, independent)
P11#1 → P11#2 → P11#3       (docs, sequential)
```

---

## Go/No-Go for Each Phase

| Phase | Criteria |
|-------|----------|
| P4 | All E2E tests pass with real NAR + real LM (or Narsese-only); event bridge emits all mapped types; graph has edges |
| P5 | Agent restarts with full belief state; `.narsese` import/export round-trips |
| P6 | Config HUD changes NAR params live; profiles save/load |
| P7 | WS survives server restart; metrics panel updates <1s latency |
| P8 | Contradictions visible in graph + badge + drawer |
| P9 | External MCP client can query agent |
| P10 | SpaceGraph loads, navigable, no console errors |
| P11 | Docs build, ADRs recorded, contributing guide clear |

---

## Final Sanity Check — All Gaps Closed

| Gap | Plan Item |
|-----|-----------|
| Mock LM in E2E | P4#1 |
| Missing NAR→CognitiveEvent bridge | P4#2 |
| Graph has no edges | P4#3 |
| No real chat synthesis | P4#4 |
| No persistence across restarts | P5#1 |
| No belief import/export | P5#2 |
| No runtime config UI | P6#1 |
| No WS reconnect | P7#1 |
| No cognitive metrics | P7#3 |
| Contradictions invisible | P8 |
| No external API | P9 |
| 3D unstable | P10 |
| No docs/ADRs | P11 |

**No remaining gaps.** Each item has a verifiable test command. The system will be "essentially usable through its UI" — user types, agent reasons (real NAR + real LM), graph updates in real time with nodes + edges + contradictions, survives restarts, configurable, observable, and externally accessible.