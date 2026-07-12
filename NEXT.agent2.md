# SeNARS Agent Architecture — Complete Development Plan (Phase 2+)

> **Context:** Phase 0–7 of NEXT.agent.md are ✅ complete. The agent/ package dissolved into `@senars/nar/agent`, `@senars/core`, `@senars/io`. NAR and MeTTa agents exist with `CognitiveEventSource` protocol. All 988 unit/integration tests pass (7 bridge + 2 bridge-NAR integration).

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
| ⚠️ | **E2E Playwright suite** — not run this session; 5 scenarios still blocked (see Remaining Work) |
| ✅ | **Server boot repaired** — `syncFromNAR` try/catch fixed; graph populates from bootstrap |
| ✅ | **Bridge mount lifecycle fixed** — `mount()` idempotent + `unmount()` removes the handler |
| ✅ | **Broadcast sendFn fixed** — bridge mounted once with single broadcast function |
| ✅ | **Autonomy engine paused during bootstrap** — prevents event flooding during server startup |
| ✅ | **Fundamental unit tests** — `cognitive-bridge.test.ts` (7) + `bridge-nar-integration.test.ts` (2) prove graph growth, relation-edge projection, idempotent mount, real-NAR edge bootstrap |
| ✅ | **Test infrastructure** — preBootstrap integrated, re-seed on reset implemented; `vitest` glob + `test:unit` script repaired |
| ✅ | **UI components** — lens designer ✅, node detail drawer ⏸️ (NAR revision API not exposed), timeline ⏸️ (same) |
| ✅ | **Graph edges from Narsese relations** — implemented + server-boot fixed; bridge-level behavior unit-verified; client propagation verified for auto-link tests |
| ✅ | **`tsc --noEmit` PASSES in `ui/`** — this session: removed stray debug logs that referenced `event.term` on non-term events; introduced `withAutonomy()` helper for the NAR-agent-only `getAutonomyEngine` |


## Phase 10.5: Relation-Edge Bugfix & Server Boot Repair (Completed)

### Root-Cause Fix — `ui/src/server/cognitive-bridge.ts`
- **CRITICAL:** `syncFromNAR()` had a malformed `try` block — the `if (ops.length > 0)` statement sat outside the `try` with the `catch` dangling, producing a hard `TransformError` (esbuild) that crashed the server on boot. This was the primary cause of the empty-graph E2E failures (auto-link, edit-edge, spatial/parity all saw `getGraphNodeCount() === 0`).
- Fixed `try { ... } catch (err) { ... }` structure so the `if (ops.length > 0)` lives inside the try.
- Added missing `type NAR` import (line 14): `import { termParser, type NAR } from '@senars/nar';`
- Renamed non-existent `termParser.parseTerm(...)` → `termParser.parse(...)` (used at the two `getConcept` call sites).
- `tsc --noEmit` now passes. Server boots and bootstrap populates the graph (81+ nodes from `BOOTSTRAP_BELIEFS` via `syncFromNAR`).

### Bridge Mount Lifecycle Fix — `ui/src/server/cognitive-bridge.ts` + `ui/src/server/index.ts`
- **CRITICAL:** `mount()` previously added a *new* anonymous `'*'` listener on every call while `unmount()` did `off('*', () => {})` — a fresh fn ref that removed nothing. Result: listeners stacked per socket and deltas were duplicated. Refactored to a single stable `#onEvent` handler: `mount()` re-binds only when the source changes and merely updates `sendFn` otherwise; `unmount()` removes the exact handler. Verified by `tests/unit/server/cognitive-bridge.test.ts`.
- **CRITICAL:** `bindSocket` in `index.ts` was calling `bridge.mount(source, socketSendFn)` for each WebSocket connection, overwriting the bridge's broadcast `sendFn` with a per-socket function. Fixed by mounting the bridge ONCE at server startup with the broadcast function, and having `bindSocket` only call `sendInitialState()` for new connections.

### Bootstrap & Autonomy Engine Fix
- **CRITICAL:** The autonomy engine was running during bootstrap, generating thousands of derivation events that flooded the bridge and crashed the server. Fixed by:
  - Mounting bridge BEFORE bootstrap (so it captures bootstrap events)
  - Pausing autonomy engine during bootstrap (`autonomyEngine?.pause()`)
  - Running `nar.run(3)` in bootstrap to generate edges from bootstrap relations
  - Resuming autonomy engine after bootstrap (`autonomyEngine?.resume()`)
- Same pause/resume applied to `/test/reset` handler for test isolation.

### Status After Fix
- Graph now receives initial nodes/edges from `bootstrapNAR` + `syncFromNAR` on server startup and `/test/reset`.
- **Bridge mount lifecycle fixed.** Verified by `tests/unit/server/cognitive-bridge.test.ts` (idempotent mount, correct unmount, clean re-bind on source change).
- **Broadcast sendFn fixed.** Verified by auto-link E2E tests passing — live input now grows the rendered graph.
- **Autonomy engine pause/resume** prevents event flooding during bootstrap/reset.
- **Bootstrap runs reasoning cycles** (`nar.run(3)`) to generate initial edges from bootstrap relations.
- **Fundamental behavior unit-verified.** A fake `CognitiveEventSource` drives the bridge: an `input`/`concept:activated` Narsese relation (`<bird --> animal>`, `<cat <-> dog>`, `<sparrow {-- bird>`) grows the concept set and emits the correct inheritance/similarity/instance edge.

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
- `ui/src/server/index.ts` — bootstrap before bridge mount; reset re-seeds NAR; pause/resume autonomy engine; broadcast sendFn fix
- `ui/src/server/bootstrap.ts` — **NEW** shared bootstrap module; runs `nar.run(3)` for edges
- `ui/src/server/test-control.ts` — `/test/pre-bootstrap` endpoint added; pause/resume in reset handler
- `ui/tests/framework/utils/test-control.ts` — `preBootstrap()` method added
- `ui/tests/framework/fixtures/senars-app.ts` — **FIXED** `testControl` fixture (`async (_, use)`); prior `async (use)` broke `use`
- `ui/src/server/cognitive-bridge.ts` — send `lens.fields` in sendInitialState()
- `ui/src/server/cognitive-bridge.ts` — add `goal:resolved`, `conflict:detected`, `input` cases
- `ui/src/server/cognitive-bridge.ts` — **NEW** relation parsing, concept nodes for endpoints, graph edges from Narsese
- `ui/src/server/cognitive-bridge.ts` — **FIXED** `mount()`/`unmount()` to stable `#onEvent` (idempotent, removable)
- `ui/src/server/cognitive-bridge.ts` — removed stray debug `console.error` lines
- `ui/vitest.config.ts` — repaired test glob; `ui/package.json` gained `test:unit`
- `tests/unit/server/cognitive-bridge.test.ts` — **NEW** bridge unit tests (7 tests)
- `ui/tests/scenarios/configuration/lens-designer.spec.ts` — fixed test select indices
- `ui/tests/scenarios/metta/agent-events.spec.ts` — **NEW** MeTTa E2E tests
- `tests/integration/multi-agent.test.ts` — **NEW** CognitiveCoordinator tests (4 tests)
- `ui/tests/scenarios/relational/auto-link.spec.ts` — **FIXED** test input to use concepts not in bootstrap

### Outstanding (🔴) - E2E Tests Still Failing
- `ui/tests/scenarios/relational/edit-edge.spec.ts` — edges should appear in graph after re-seed (initial edge count = 0)
- `ui/tests/scenarios/cognitive/slider-mash.spec.ts` — perf monitor issues; `node-detail-drawer input[type="range"]` not visible
- `ui/tests/scenarios/metta/agent-events.spec.ts` — LTM test fails: `graph-viewport` not visible (different agent setup)
- `ui/tests/scenarios/cognitive/timeline.spec.ts` — node history tab blocked on `getRevisionHistory()` returning `[]`
- `ui/tests/scenarios/spatial/parity.spec.ts` — `__testApi` spacegraph API not ready / node count 0

### Blocked (⏸️)
- Revision history — NAR `getRevisionHistory()` returns empty; requires Stamp chain integration upstream
- Server restart stability — Investigate `reuseExistingServer: !process.env.CI` behavior for test isolation

---

## Remaining Work (Next Session)

### ✅ Completed This Session (Refactor + Typecheck Repair)
- ✅ **`tsc --noEmit` now PASSES in `ui/`** — it was silently failing (the prior "✅ tsc passes" claim was wrong). Two real errors fixed:
  - `cognitive-bridge.ts` had three stray `console.error` debug logs (`[bridge] INPUT EVENT:`, `[bridge] #onEvent: … '->' N ops`, `… '-> NO OPS'`) that referenced `event.term` — but `event.type === 'cycle'` has no `term`, a TS2339. Removed all three; kept the legitimate `[bridge] syncFromNAR error` log.
  - `index.ts` called `source.getAutonomyEngine?.()` on a `CognitiveEventSource` — but `getAutonomyEngine` exists only on the NAR `Agent` interface (`nar/src/agent/types.ts:298`), not on `CognitiveEventSource` (`core/src/CognitiveCoordinator.ts:12`). Added a minimal `AutonomyCapableSource` interface + `withAutonomy()` helper so the runtime cast is explicit and type-safe.
- ✅ **Refactored `syncFromNAR()`** — collapsed ~80 lines of duplicated subject/predicate `ConceptLike` construction (5 near-identical blocks) into a single `ensureRelConcept(endpoint)` closure + a `#lookupConceptPriority(term)` helper. Behavior unchanged (verified by `bridge-nar-integration.test.ts`).
- ✅ **Cleaned `/test/reset` handler** — removed 4 `[TestControl] …` `console.log` diagnostics and the inner shadowed `autonomyEngine` declaration (renamed outer to `autonomy`, inner to `resetAutonomy`).
- ✅ **Removed unrelated stray debug logs** in `chat.ts` (`[chat] onChat:`) and `gateway.ts` (`[gateway] chat.user:`).
- ✅ **Verified:** root `pnpm test` → **988 pass** (no regression); `pnpm typecheck` → **5/5 tasks green**.

### Previously Completed (Sessions 1–3)
- ✅ **FIXED** `syncFromNAR()` syntax error (malformed `try`/`catch`) — server boots; graph populates from bootstrap
- ✅ Added `type NAR` import to `cognitive-bridge.ts`; fixed `termParser.parseTerm` → `termParser.parse` (2 sites)
- ✅ Created `ui/src/server/bootstrap.ts` — shared bootstrap module
- ✅ `/test/reset` re-seeds NAR for deterministic initial graph state
- ✅ Relation parsing in cognitive-bridge (`parseRelations`, `addRelationEdges`, `deriveRelationEdges`)
- ✅ Relation edges integrated into `concept:activated`, `derivation`, `input` events and graph refresh
- ✅ **`mount()`/`unmount()`** refactored to a single stable `#onEvent` handler — idempotent re-mount, correct listener removal (was stacking 3× per socket, `unmount` removed nothing)
- ✅ **Broadcast sendFn fixed** — `bindSocket` no longer calls `bridge.mount()`; bridge mounted once with broadcast function
- ✅ **Pause/resume autonomy engine** during bootstrap and reset to prevent event flooding
- ✅ **Bootstrap runs reasoning cycles** (`nar.run(3)`) to generate initial edges
- ✅ **Fixed Playwright `testControl` fixture** (`async (use)` → `async (_, use)`) — unblocks metta LTM fixture
- ✅ **Auto-link E2E tests PASS** — live Narsese input grows graph with new nodes and relation edges

### Remaining E2E (Playwright) — Blocked, NOT Run This Session
> The 5 scenarios below live under `ui/tests/scenarios/**` (excluded from `pnpm test`/vitest) and require a running server + browser + real NAR agent. The server-side projection they depend on is unit-verified (`cognitive-bridge.test.ts`, `bridge-nar-integration.test.ts`), so any failure is **client-side rendering / component wiring**, not a bridge regression. Recommended next steps are listed; do not retry blind — reproduce in a browser first.

1. **`relational/edit-edge.spec.ts`** — needs initial edges from bootstrap present client-side before it can edit one.
   - First confirm the WS `cognitive.delta` ops carrying bootstrap edges actually reach the client (`getGraphEdgeCount()` in browser console). Server side they are emitted (`bridge-nar-integration.test.ts` proves edges exist post-`syncFromNAR`).
   - Likely fix: the test should `expect.poll(() => testApi.getGraphEdgeCount()).toBeGreaterThan(0)` instead of asserting immediately.
2. **`cognitive/slider-mash.spec.ts`** — `node-detail-drawer input[type="range"]` not visible after node click.
   - Drawer/CSS issue. Unrelated to the bridge. Inspect the drawer's render path for the truth slider when a node has a `truth` field.
3. **`cognitive/timeline.spec.ts`** (2 tests) — node history tab blocked on `getRevisionHistory()` returning `[]`.
   - **Upstream blocker:** NAR's Stamp chain doesn't expose a revision API. `onNodeHistoryRequest()` returns `[]` by design until NAR exposes one. The "scrubber visible" test may pass on its own; the history-tab test stays red until the NAR API lands.
4. **`metta/agent-events.spec.ts`** — `graph-viewport` not visible in the LTM test; likely a different agent/fixture setup than the other tests. Reproduce in a browser; the `testControl` fixture fix from session 3 is verified for other suites.
5. **`spatial/parity.spec.ts`** (2 tests) — `__testApi.spacegraph` not registered or node count 0. The spacegraph web component isn't exposing its test API. Component-level fix in the spacegraph element.

### Blocked (⏸️ — needs upstream work)
- **Revision history** — NAR `getRevisionHistory()` returns `[]` until a Stamp-chain revision API exists upstream. Blocks `timeline` history tab and the node-detail-drawer history view.
- **`pnpm lint` (biome)** — seas of pre-existing diagnostics in `.turbo/cache/**` JSON and elsewhere (~2400 errors, mostly format). Not introduced this session; orthogonal cleanup. Consider adding `.turbo` to biome's ignore list as a separate pass.

### Test Commands
- Unit suite: `pnpm test` (root, 988 pass) — covers `tests/unit/**`, `tests/nar/**`, `tests/integration/**`, `tests/cli/**`.
- Unit-only subset: `pnpm test -- tests/unit/server/` (the bridge + bridge-NAR integration tests).
- Typecheck: `pnpm typecheck` (turbo: 5/5 green).
- E2E (Playwright, `ui/`): not invoked this session — run with the UI's playwright config after the items above are addressed.

---

*Updated: 2026-07-12 (session 4) | Typecheck failure unseen by prior sessions repaired (debug logs referenced `event.term` on non-term events; `getAutonomyEngine` typed via a `withAutonomy` helper). `syncFromNAR` de-duplicated. Stray debug logs removed. 988 unit tests pass; `tsc --noEmit` green. Remaining work is E2E/client-side + the NAR revision-history upstream.*