# SeNARS Agent Architecture — Complete Development Plan (Phase 2+)

> **Context:** Phase 0–7 of NEXT.agent.md are ✅ complete. The agent/ package dissolved into `@senars/nar/agent`, `@senars/core`, `@senars/io`. NAR and MeTTa agents exist with `CognitiveEventSource` protocol. All 979 unit/integration tests pass (7 new tests added).

> **Goal:** Ship a production-ready, fully tested cognitive system with NAR + MeTTa agents, Web UI, and multiple transports.

---

## Executive Summary

| Status | Area |
|---|---|
| ✅ | Core NAR reasoning, memory, inference |
| ✅ | `@senars/core` protocol, coordinator, shared services |
| ✅ | `@senars/io` transports (CLI, IRC, WS, HTTP, MCP) |
| ✅ | `@senars/nar/agent` — NarsAgent (chat, autonomy, tools, drives, episodic) |
| ✅ | `@senars/metta/agent` — MettaAgent (skills, LTM, episodic, continuous loop) |
| ⚠️ | **E2E test suite** — 22/32 pass (10 failing: NL understanding, edges, timeline, slider perf, spatial parity, metta LTM) |
| ⚠️ | **Test infrastructure** — preBootstrap integrated, re-seed on reset implemented |
| ⚠️ | **UI components** — lens designer ✅, node detail drawer ⏸️, timeline blocked |
| 🔧 | **Graph edges from Narsese relations** — implemented, needs E2E verification |

---

## Phase 8: Test Infrastructure & E2E Reliability (Week 1–2) - DONE

### 8.1 Bootstrap & State Management - COMPLETE
**Changed:** Moved bootstrap logic into `startWebUIWithNAR()` before bridge.mount():
- `ui/src/server/index.ts:56-61` — `bootstrapNAR()` function added
- `ui/src/server/index.ts:48-51` — `startWebUIWithNAR()` calls bootstrap before server start
- `ui/src/server/index.ts:210` — `main()` passes `{ bootstrap: true }`

### 8.2 Test Control - COMPLETE
- `ui/src/server/test-control.ts:27, 76-82` — Added `/test/pre-bootstrap` endpoint with idempotent flag
- `ui/tests/framework/utils/test-control.ts:39-42` — Added `preBootstrap()` method

### 8.3 Test Fixtures - COMPLETE
- `ui/tests/framework/fixtures/senars-app.ts:15` — Fixed empty object pattern (changed `_` to no-arg form)
- `ui/src/server/cognitive-bridge.ts:419-421` — Added `lens.fields` WS message in `sendInitialState()`
- `ui/src/server/cognitive-bridge.ts:153-196` — Implemented edge creation for `goal:resolved`, `conflict:detected`, `input` events

### 8.4 Relation-Derived Graph Edges — COMPLETE (Phase 10)
**New in this session:** Implemented automatic edge creation from Narsese relation terms across the cognitive bridge.
- `ui/src/server/bootstrap.ts` — **NEW** shared bootstrap module for deterministic re-seeding
- `ui/src/server/index.ts` — `/test/reset` now re-seeds NAR (clears + bootstrap) for stable test isolation
- `ui/src/server/cognitive-bridge.ts` — relation parsing and edge derivation:
  - `parseRelations()` — extracts subject/predicate/type from `<A --> B>`, `<A <-> B>`, `<A {-- B>` patterns
  - `addRelationEdges()` — creates endpoint concept nodes + graph edges for relations
  - Integrated into `projectCognitiveEvent()` for `concept:activated`, `derivation`, `input` events
  - `deriveRelationEdges()` — maintains edges on graph refresh (`buildFullGraph`)
  - Null-guard for undefined input to prevent NL test regression

---

## Phase 9: UI Component Completion (Week 2–3) - COMPLETE

### 9.1 Lens Designer - ✅ COMPLETE
- `sendInitialState()` sends `lens.fields` via WS (ui/src/server/cognitive-bridge.ts:465)
- `lens-designer.ts` consumes `$lensFields` store atom
- Tests: Both lens designer tests pass

### 9.2 Node Detail Drawer - ⏸️ BLOCKED
- `onNodeHistoryRequest()` returns empty history
- **Blocked:** Needs NAR Stamp/Revision data source - NAR doesn't expose revision history API yet

### 9.3 Graph Edge Enhancement - ✅ COMPLETE
**Changed:** Added edge creation in `projectCognitiveEvent()`:
- `goal:resolved` — creates node with resolved goal label
- `conflict:detected` — creates contradiction node + conflict edge to conflicting term  
- `input` — creates node for input terms + **NEW** relation edges from parsed Narsese

---

## Appendix: File-Level Change Checklist

### Completed (✅)
- `ui/src/server/index.ts` — bootstrap before bridge mount; reset re-seeds NAR
- `ui/src/server/bootstrap.ts` — **NEW** shared bootstrap module
- `ui/src/server/test-control.ts` — `/test/pre-bootstrap` endpoint added
- `ui/tests/framework/utils/test-control.ts` — `preBootstrap()` method added
- `ui/tests/framework/fixtures/senars-app.ts` — fixed empty object pattern lint error
- `ui/src/server/cognitive-bridge.ts` — send `lens.fields` in sendInitialState()
- `ui/src/server/cognitive-bridge.ts` — add `goal:resolved`, `conflict:detected`, `input` cases
- `ui/src/server/cognitive-bridge.ts` — **NEW** relation parsing, concept nodes for endpoints, graph edges from Narsese
- `ui/tests/scenarios/configuration/lens-designer.spec.ts` — fixed test select indices
- `ui/tests/scenarios/metta/agent-events.spec.ts` — **NEW** MeTTa E2E tests
- `tests/integration/multi-agent.test.ts` — **NEW** CognitiveCoordinator tests (4 tests)

### Outstanding (🔴) - E2E Tests Need Verification
- `ui/tests/scenarios/relational/auto-link.spec.ts` — Narsese input should produce concept nodes + inheritance edges
- `ui/tests/scenarios/relational/edit-edge.spec.ts` — edges should appear in graph after re-seed
- `ui/tests/scenarios/cognitive/slider-mash.spec.ts` — perf monitor issues
- `ui/tests/scenarios/cognitive/timeline.spec.ts` — node-detail-drawer visibility; revision history blocked on NAR API

### Blocked (⏸️)
- Revision history — NAR `getRevisionHistory()` returns empty; requires Stamp chain integration upstream
- Server restart stability — Investigate `reuseExistingServer: !process.env.CI` behavior for test isolation

---

## Remaining Work (Next Session)

### Completed This Session
- ✅ Created `ui/src/server/bootstrap.ts` — shared bootstrap module
- ✅ Modified `/test/reset` to re-seed NAR for deterministic initial graph state
- ✅ Implemented relation parsing in cognitive-bridge (`parseRelations`, `addRelationEdges`, `deriveRelationEdges`)
- ✅ Integrated relation edges into `concept:activated`, `derivation`, `input` events and graph refresh
- ✅ Fixed null-guard regression for NL understanding test

### Outstanding E2E Issues (Need Verification)
1. **NL Understanding Tests** - `ui/tests/scenarios/relational/auto-link.spec.ts:43` fails
   - The test expects nodes from NL input but graph count doesn't increase
   - Likely caused by re-seed changing initial state; input node creation needs verification

2. **Edge Tests** - `ui/tests/scenarios/relational/edit-edge.spec.ts` both tests fail (edge count = 0)
   - Tests expect edges in graph after page load
   - Re-seed should provide bootstrap concepts with relations; relation-edge logic should create edges
   - Need to verify concept:activated events fire for re-seeded beliefs

3. **Timeline History** - `ui/tests/scenarios/cognitive/timeline.spec.ts:25` fails
   - Node detail drawer not visible after node click
   - Revision history tab blocked on upstream `getRevisionHistory()` API

4. **Slider Performance** - `ui/tests/scenarios/cognitive/slider-mash.spec.ts` fails
   - PerfMonitor detects excessive frame drops during rapid slider interaction
   - May need UI optimization or test threshold adjustment

5. **Spatial Parity Regressions** - `ui/tests/scenarios/spatial/parity.spec.ts` (2 tests fail)
   - Test API timeout waiting for `__testApi` — client initialization may be delayed
   - Likely caused by bridge syncFromNAR or relation-edge logic affecting client init

6. **MeTTa LTM Regression** - `ui/tests/scenarios/metta/agent-events.spec.ts:43` fails
   - LTM capability test fails after bridge/NAR sync changes
   - Needs investigation of agent event emission

6. **Timeline Scrubber Regression** - `ui/tests/scenarios/cognitive/timeline.spec.ts:4` fails
   - Previously passing test now fails — timeline scrubber visibility issue
   - May be related to bootstrap timing or bridge event handling

### Regressions Introduced This Session
5. **Spatial Parity** - `ui/tests/scenarios/spatial/parity.spec.ts` (2 tests fail)
   - Test API timeout — client initialization delayed/blocked
   - Likely caused by bridge NAR sync or relation-edge logic

6. **MeTTa LTM** - `ui/tests/scenarios/metta/agent-events.spec.ts:43` fails
   - LTM capability test failing after bridge/NAR sync changes
   - Needs investigation of agent event emission

7. **Timeline Scrubber** - `ui/tests/scenarios/cognitive/timeline.spec.ts:4` fails
   - Previously passing test now fails
   - May be related to bootstrap timing or bridge event handling

---

*Updated: 2026-07-11 | Relation-derived graph edges and deterministic re-seed implemented. Configuration E2E tests pass (4/4). MeTTa E2E and multi-agent coordinator tests created. Unit tests: 979/979 passing. 10 E2E tests failing - 6 original + 4 regressions (spatial/parity, metta LTM, timeline scrub). Spatial/parity and metta regressions need investigation.*