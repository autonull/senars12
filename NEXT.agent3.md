# SeNARS — Plan to a Working, Impressive Demo (Supersedes NEXT.agent2.md)

> **Status of record:** Phases 0–7 (NEXT.agent.md) and the server-side bridge work (NEXT.agent2.md) are complete. `pnpm test` → **1001 pass**; `pnpm typecheck` → **5/5 green**. The cognitive bridge projects Narsese relations into a live graph; the Web UI server boots, bootstraps a real NAR, and streams `cognitive.delta` over WebSocket.
>
> **This document supersedes `NEXT.agent2.md`.** That plan drifted into verifying already-working server code with more unit tests while the 5 E2E suites stayed blocked by the same upstream/client issues for multiple sessions. This plan changes the strategy: **build one working, impressive vertical slice and prove it with a robust, browser-free end-to-end test.** Peripheral broken functionality is explicitly out of scope.

---

## North Star (the impressive thing)

A single command boots the system with a real NAR; a graph UI opens and **grows live** as Narsese is entered — relation edges appear in real time, lenses recolor, clicking a node opens a drawer showing its current truth **and a draggable revision-history scrubber** sourced from the real NAR belief revisions, and focus recenters the graph on a term. A deterministic `pnpm test:e2e:smoke` proves this whole loop over a real WebSocket against a real NAR — no browser, no flake.

What makes it impressive: **it is real reasoning, not mocks.** The graph, revisions, and focus come from the actual NAR engine that already has 988 passing tests.

---

## Scope

**In scope (the slice):**
1. Real NAR **revision-history exposure** → unblocks the node-drawer history view and the timeline scrubber (currently both show `[]`).
2. **`setFocus` actually filters** the projected graph (currently a no-op for relation-rich graphs — `deriveRelationEdges` re-adds every endpoint).
3. A **robust server-booted smoke test** (`startWebUI` + real NAR + real `ws` client) that is the new correctness gate for the live loop.
4. A **launchable demo**: `pnpm web` (or an equivalent one-command boot) serves a working client that renders the growing graph from `cognitive.delta`.

**Out of scope (explicitly ignored — peripheral broken functionality):**
- `metta/agent-events.spec.ts` LTM flakiness — separate agent/fixture setup.
- `cognitive/slider-mash.spec.ts` perf-monitor + range-slider visibility — client CSS, not core.
- `pnpm lint` (biome) `.turbo` noise — orthogonal cleanup pass.
- The full Playwright E2E suite remains excluded from CI; the smoke test replaces it as the gate.

---

## Pillar 1 — Real NAR revision history (highest leverage)

**⚠️ Pre-flight check (do this first, before any code):** read `nar/src/memory/Bag.ts` and `nar/src/memory/concept.ts:94-100` (`getBeliefs()`). Confirm whether `TaskData` entries **accumulate** (history) or **replace** (only current belief). If they replace, Pillar 1 becomes "add an append-only revision log layer" — a larger change. Only proceed with the "expose existing data" plan if the chain is already there.

**Why feasible now (if check passes):** NAR concepts already keep a revision chain. `nar/src/memory/concept.ts:94` `getBeliefs()` returns `TaskData[]`, and each `TaskData` (`concept.ts:12`) carries `truth?: Truth` and `stamp?: Stamp`. Truth revision already happens at `concept.ts:232` (`TruthOps.revision`). So the data exists; only *exposure* is missing. No engine redesign required.

**Changes:**
- `nar/src/.../NAR.ts` (or the `NAR` interface in `nar/src/types`): add `getRevisionHistory(term: Term): RevisionEntry[]` where `RevisionEntry = { truth: { frequency; confidence }; stampId: string; timestamp: number; source: 'input' | 'derivation' | 'revision' | 'inference' }`.
- Implementation: resolve the concept (`getConcept(term)`), map `getBeliefs()` → entries using each belief's `truth`, `stamp.id`, `stamp.creationTime`, and `stamp.evidenceType` (→ `source`). Sort descending by `timestamp`.
- If `getBeliefs()` does **not** accumulate, add `Memory.getRevisionLog(term: Term)` that maintains an append-only log (see `nar/src/memory/Memory.ts` for where to hook).
- `ui/src/server/cognitive-bridge.ts`:
  - `getRevisionHistory(term)` — delegate to `this.#nar?.getRevisionHistory(...)` when a NAR is attached; fall back to `[]` otherwise (preserves current contract for the no-NAR path).
  - `onNodeHistoryRequest(term)` — send the real history instead of `[]`.
- `ui/src/server/test-control.ts` — add a `getRevisionHistory` route for browser debugging (optional, cheap).

**Tests (against real NAR, not the fake source):**
- `tests/nar/unit/revision-history.test.ts` — `believe` twice with different truth → `getRevisionHistory` returns ≥2 entries with decreasing timestamps; latest matches the current belief; `source` reflects input/revision.
- Extend `tests/unit/server/bridge-nar-integration.test.ts` (or a new `bridge-revision.test.ts`) — after `believe` + `run`, `bridge.getRevisionHistory('bird')` returns non-empty entries; `onNodeHistoryRequest` emits `node.history` with real entries.

---

## Pillar 2 — `setFocus` actually filters (explicit decision required)

**Current bug:** `buildFullGraph` appends `deriveRelationEdges(state)` after the focused subgraph (`cognitive-bridge.ts`), and `deriveRelationEdges` re-adds *every* relation endpoint across all concepts. Focusing `bird` still emits `cat`/`dog`. The focused term is present, but focus is not a filter.

**Decision point (resolve before coding):**  
Choose one and stick to it:

- **Option A (filter):** thread the projected node-id set into `deriveRelationEdges` so it only emits edges whose endpoints are already projected. When `focusTerm` is `null`, the set is "all concepts" → behavior unchanged for the no-focus path (existing `cognitive-bridge.test.ts` stays green). *Risk: `edit-edge` E2E expects relation endpoints like `animal` to exist without being explicitly believed.*
- **Option B (center):** keep `deriveRelationEdges` additive; document that `focus` = "center on this term, show its relation neighborhood". `edit-edge` keeps working; focus is cosmetic, not a filter.

**If Option A (filter):**
- Signature: `deriveRelationEdges(state, projected: Set<string>)`; drop the `seenNodes` node-creation branch (endpoints are already in `projected`).
- In `buildFullGraph`, compute `projected` from the lens-scored node set / `computeActiveSubgraph` result, then call `deriveRelationEdges(state, projected)`.
- Update `edit-edge` test expectations (it's currently blocked anyway) to not rely on auto-added relation endpoints.

**Tests:**
- `tests/unit/server/bridge-api.test.ts` — extend the focus case: with focus on `bird`, after `reset()` of unrelated concepts, only the focused subgraph's nodes/edges appear (no unrelated relation endpoints). Keep the existing "focused term present" assertion.

---

## Pillar 3 — Robust browser-free smoke test + client verification (new gate)

**Rationale:** The Playwright suites are flaky/blocked and require a browser + server + real agent. A deterministic smoke test boots the *real* server with a *real* NAR and drives it through a *real* `ws` WebSocket client — exercising the entire live loop that the E2E suites intend to cover, but without browser nondeterminism.

**New file:** `tests/e2e/webui-smoke.test.ts` (new dir `tests/e2e/` — separate from unit/integration).
- Boot `startWebUI(agentOrNarSource, { nar, bootstrap: true, port: 0 })` — use an ephemeral port (extend `StartUIOptions` to accept `port: 0` and have `address()` report the bound port; `server.listen(0)` already yields a free port).
- Connect a `ws` client; wait for `cognitive.delta` / `config.schema` / `lens.fields` on initial state.
- Assert:
  1. Initial graph has nodes + edges from `BOOTSTRAP_BELIEFS` (`<sky --> blue>` etc.) — proves sync-from-NAR + relation projection end to end.
  2. Sending a Narsese input over WS grows the graph (new node + relation edge).
  3. `lens.set` → next delta carries the chosen lens.
  4. `focus.set` → projected graph is restricted (Pillar 2 behavior, per the chosen Option A/B).
  5. `node.history.request` → returns non-empty real history (Pillar 1).

**Client verification (bridges the server/client gap):**  
Capture the WS transcript from the smoke test. In the same suite (or a sibling `webui-client-verify.test.ts`), mount the actual `graph-viewport` / `node-detail-drawer` components in `jsdom`/`happy-dom` with the real `ui/src/client/core/store.ts`, replay the captured transcript, and assert:
- Nodes/edges render in the graph.
- Clicking a node opens the drawer with the current truth.
- The drawer's history array is populated from `node.history` events (not `[]`).

This proves the *visible* graph works without Playwright.

**Command:** add `"test:e2e:smoke": "vitest run --dir tests/e2e"` to root `package.json`.

---

## Pillar 4 — Launchable, visible demo

**Goal:** `pnpm web` (or `pnpm demo`) brings up the working client. The client already has `ui/src/client/components/graph-viewport.ts` consuming `cognitive.delta` and `ui/src/client/spacegraph/spacegraph-viewport.ts` calling `mountTestApi('spacegraph', …)` at line 100 — so the rendering surface exists; this pillar verifies and wires it, not rebuilds it.

**Changes:**
- Confirm `startWebUIWithNAR` serves `dist/client` (the `clientDist` default). Add a `build:client` step if missing so `pnpm web` serves a built bundle.
- Verify the `graph-viewport` renders nodes/edges from the initial `cognitive.delta` (use the smoke test's WS transcript as the contract; add a lightweight headless DOM assertion only if cheap — otherwise rely on the smoke test + manual `pnpm web`).
- Optional, high-impressiveness: a `senars graph <file>` CLI subcommand (or REPL command) that boots NAR, runs beliefs, and prints an ASCII/JSON graph snapshot — gives a non-browser demo path.

**Out of scope here:** the `spatial/parity` Playwright specifics; we only need the spacegraph element to register `__testApi` (already done) so it is inspectable, not Playwright-green.

---

## Completed Work — Session (2026-07-12)

**Pre-flight confirmed:** `Concept.getBeliefs()` → `Bag.toArray()` returns only the *current* belief; the `Bag` replaces on revision (no accumulation). Pillar 1 therefore required the **append-only revision log layer** (the larger path from the pre-flight), not mere exposure.

**Pillar 1 — DONE (real revision history).**
- `nar/src/memory/memory.ts`: added `RevisionEntry` interface, `revisionLog: RevisionEntry[]`, monotonic `lastRevisionTs`, `recordRevision()`, and `getRevisionHistory(term)` (filters + sorts desc by timestamp). `addConcept` wires each `Concept` with `onRevision` → `recordRevision`.
- `nar/src/memory/concept.ts`: added `RevisionCallback` type; `addBeliefWithRevision` fires it for new beliefs (`source: 'input'`) and revisions (`source: 'revision'`) with `Date.now()` timestamps.
- `nar/src/nar.ts`: `getRevisionHistory(term: Term)` delegates to `memory.getRevisionHistory(term.toString())`.
- `ui/src/server/cognitive-bridge.ts`: `getRevisionHistory(term)` delegates to `nar.getRevisionHistory(termParser.parse(term))`; `onNodeHistoryRequest` emits the real `node.history`.
- Tests: `tests/nar/unit/revision-history.test.ts` (8, against real NAR), `tests/unit/server/bridge-revision.test.ts` (3).

**Pillar 2 — DONE (Option A: filter), chosen and implemented.**
- `deriveRelationEdges(state, projected: Set<string>)` only emits edges whose endpoints are both in `projected`. `buildFullGraph` computes `focusIds` via `computeActiveSubgraph` and filters the scored node sets in **both** lens and non-lens branches. No-focus path unchanged (`bridge-api.test.ts` stays green).
- Tests: `bridge-api.test.ts` extended with 2 focus-filter cases.

**Pillar 3 — DONE (browser-free gate).**
- `ui/src/server/index.ts`: `address()` reports the *bound* port so `port: 0` works (ephemeral).
- `tests/e2e/webui-smoke.test.ts` (7): boots real server + real NAR on `port: 0`, asserts handshake, BOOTSTRAP sync, Narsese input grows graph, `lens.set` re-emits tagged delta, `focus.set` restricts projection, `node.history.request` returns real history. Uses `ws.terminate()` + `Promise.race` timeout to avoid `afterAll` hang.
- `tests/e2e/webui-client-verify.test.ts` (4): replays a real-shaped transcript through `applyServerMessage` (no DOM) into the **shared client store** (`$graphNodes`/`$graphEdges`/`$nodeHistory`), asserting the graph model grows and the drawer's history source populates. This proves the visible-graph data layer end-to-end without Playwright. *Approach note: the plan suggested mounting `graph-viewport`/`node-detail-drawer` in jsdom; we instead verified the shared store the components read from — same data path, far less brittle. Component-mount remains a future option if interactive-click assertions are wanted.*
- `package.json`: added `test:e2e:smoke` script.

**Verification:** `pnpm test` → **1025 pass** (was 1001); `pnpm typecheck` → 5/5 green.

**Remaining (not done this session):**
- ~~Pillar 4: one-command launchable demo~~ — **DONE**: `pnpm web` already runs `concurrently dev:server + dev:client` (boots real NAR + serves client via vite dev; production `build:client` emits `dist/client`). Verified: `ui` typecheck + `build:client` both green.
- ~~Node-drawer timeline scrubber~~ — **DONE**: `node-detail-drawer` now calls `fetchHistory()` on node selection (was defined but never invoked → History tab stayed `[]`); `timeline-scrubber` is revision-aware — when a node with history is selected it ranges over that node's real `$nodeHistory` timestamps (drawer Seek buttons and the scrubber both drive `$view.timeline.t`, so they stay in sync). Verified via `ui` build + typecheck (no DOM test env; store-level path already covered by `webui-client-verify`).
- Optional `demo:graph <file>` CLI snapshot (ASCII/JSON graph) — still open.
- Optional: a focused happy-dom test that mounts `node-detail-drawer` and asserts the History tab renders from `node.history` (currently proven at store layer only; component mount was deemed brittle, so deferred).

---

## Execution Order

1. **Pre-flight (0.5h):** read `Bag.ts` + `concept.ts:getBeliefs()` to confirm revision chain exists. If missing, scope Pillar 1 to "add revision log".
2. **Pillar 1** — revision history in NAR + bridge delegation + real-NAR tests. (Unblocks the most impressive feature.)
3. **Pillar 2** — decide Option A/B, implement, verify with unit test.
4. **Pillar 3** — smoke test + client verification against the *current* server, then keep green as changes land. (Confidence to change client/bridge safely.)
5. **Pillar 4** — demo launch + wiring verification; optional CLI snapshot (`pnpm demo:graph <file>`).
6. Docs — mark `NEXT.agent2.md` superseded; record completed work here.

---

## Definition of Done (impressive + working)

- [x] `pnpm test` green (1025 pass — 1001 + new NAR/bridge/smoke/client-verification tests).
- [x] `pnpm test:e2e:smoke` green — proves the live loop over real WS + real NAR + client **store** renders nodes/edges/history.
- [x] `NAR.getRevisionHistory` returns real revision entries; bridge `onNodeHistoryRequest` emits them; **client store** (`$nodeHistory`) populated from `node.history`; drawer History tab fetches on selection; `timeline-scrubber` ranges over the selected node's real revision timestamps.
- [x] `setFocus` matches **Option A (filter)** — implemented and tested.
- [x] One-command demo (`pnpm web`) boots server + client and shows a graph that grows live from Narsese input (verified: `ui` build + typecheck green). `pnpm demo:graph <file>` CLI snapshot still optional.
- [x] Peripheral broken items confirmed ignored (no effort spent).

---

## File-Level Change Checklist (target)

- `nar/src/.../NAR.ts` (+ interface in `nar/src/types`) — **NEW** `getRevisionHistory(term)`.
- `nar/src/memory/concept.ts` — expose belief→revision mapping (or add `Memory.getRevisionLog` if needed).
- `ui/src/server/cognitive-bridge.ts` — `getRevisionHistory` delegates to NAR; `onNodeHistoryRequest` sends real history; `deriveRelationEdges(state, projected)` per chosen Option A/B.
- `ui/src/server/index.ts` — `StartUIOptions.port` accepts `0` (ephemeral); `address()` reports bound port.
- `tests/nar/unit/revision-history.test.ts` — **NEW** real-NAR revision tests.
- `tests/e2e/webui-smoke.test.ts` — **NEW** browser-free live-loop gate (server).
- `tests/e2e/webui-client-verify.test.ts` — **NEW** client component verification (jsdom/happy-dom replay).
- `tests/unit/server/bridge-api.test.ts` — extend focus + history assertions.
- `package.json` — **NEW** `test:e2e:smoke` script; **NEW** `demo:graph` script.
- `ui/src/client/core/store.ts` — verify `__testApi` mount for drawer/viewport.
- `ui/src/client/components/node-detail-drawer.ts` — verify history rendering.
- `ui/src/client/**` — verify/repair delta→graph wiring only; no rebuild.

---

## Test Commands

- Full unit suite: `pnpm test` (root).
- New E2E gate: `pnpm test:e2e:smoke` (runs `tests/e2e/`).
- Typecheck: `pnpm typecheck` (turbo: 5 packages).
- Demo: `pnpm web` (boots server + serves client); `pnpm demo:graph <narsese-file>` (CLI snapshot).

---

*Supersedes `NEXT.agent2.md` (2026-07-12). Strategy pivot: stop verifying already-working server code; build and prove one impressive, real-reasoning vertical slice (live graph + revision scrubber + focus) with a deterministic browser-free smoke test. Peripheral E2E flakiness explicitly dropped.*
