# TODO.ui.md — SeNARS Web UI: the AI Reasoning Explorer

> Phased development plan. **No time estimates.** Each phase is small, verifiable, and leaves the
> application working. Consolidates and supersedes `docs/plan/ui*.md`.
>
> Architectural spine: **single source of truth → reflection → descriptors → dynamic UI.** Components
> and panels are *data*, not bespoke markup. One dataset renders as **graph, chart, table, or tree** in
> **full-screen or embedded** contexts without duplication.

---

## Progress log

### Session 1 — Phase 0: server contract + transport (2026-10-07)

**Landed**

- **0.1 — inbound contract.** The server now validates every client frame with
  `IncomingFromClient.safeParse` and replies to a rejection with a typed
  `server.error` frame (`invalid_message` / `unsupported` / `not_available` / `internal`).
  Previously only `chat.user` / `config.set` / two LM messages were read by name and every
  other declared message was silently ignored. One `handleClientMessage` switch now dispatches
  `lens.set`, `focus.set`, `viewport.set`, `object.set`, `node.set`, `lens.define`,
  `node.history.request`, `sync.request`, `lm.status.request`, `lm.switch` (protocol constant
  `LMSwitchMsg` was missing from `IncomingFromClient`), `config.set`, `chat.user`.
- **0.2 — outbound emissions.** `state.snapshot` (graph + working-memory terms + config),
  `node.history` (real engine `NAR.getRevisionHistory(termParser.parse(term))` — the e2e history
  test's source, previously never emitted), `lens.defined` on `lens.define`, and `telemetry`
  (1 Hz: `reasoning_hz` from a derivation window, `memory_mb` from `process.memoryUsage()`,
  `ws_latency_ms` from WS ping RTT, plus a `cognitive` block from the projection/`attentionReport`).
- **Seq monotonicity.** `UnifiedGraphProjection` now owns an integer `#seq` (`#nextSeq()`);
  every delta carries it. It was `Date.now()`, which cannot order two same-ms deltas.
- **Bridge honesty (partial 0.3).** The `agent.on('*')` bridge now handles
  `derivation.made` (truth looked up from `nar.getBeliefs()` instead of a nonexistent
  `payload.truth`; hardcoded `priority: 0.7/confidence: 0.9` removed), `concept.activated`
  (real priority), `belief.retracted` / `atom.retracted` (removal), `atom.derived` (metta nodes),
  `conflict:detected` (contradiction flag). The `seenTerms` dedup that suppressed every revision is
  gone; the projection now emits `update_node` when a known term is re-derived.
- **0.4 — dead wiring.** `graph:zoom-in|out|fit|search|pan-to` now have subscribers in
  `graph-viewport` (they emitted with none); the redundant `lens:changed` signal and its only
  emit were deleted (`$activeLens` already drives the renderers).
- **0.5 — transport.** Client derives `wss:` from `location.protocol`, guards `JSON.parse`, and
  caps the offline queue at 100 (oldest dropped). Server serves `/health` + `/ready`,
  resolves static paths through `relative(DIST_DIR, …)` (traversal-safe), gates `/test/*` behind
  `SENARS_TEST_ENDPOINTS` (default on unless `NODE_ENV=production`), and answers raw `ping` with
  `pong`.
- **0.6 — alias drift.** Fixed the pre-existing broken client build: the Vite/Storybook aliases
  replaced `spacegraphjs` and `@senars/core` by prefix, so `spacegraphjs/core` resolved to
  `index.ts/core` and `@senars/core/lens-schema` to `index.ts/lens-schema`; Storybook also pointed
  at `/home/me/senars12b/...`. One shared `ui/vite.aliases.ts` now feeds Vite, Vitest, and
  Storybook. `ui/src/shared/index.ts` takes `edgeKey`/`estimateTokens`/`extractTerm`/`generateId`
  from `@senars/util` so the `@senars/core` → protocol alias holds. `ui/tsconfig.json` now
  typechecks `src/server/**` (it was excluded, so server type errors were invisible).
- Also fixed: `$lmStatus` was imported by `lm-status-panel` but absent from the core barrel.

**Verification**

- `pnpm --dir ui exec tsc --noEmit` clean (now includes the server); `pnpm --dir core exec tsc --noEmit` clean.
- `pnpm --dir ui build` succeeds (previously failed on the alias bug).
- `vitest`: UI unit suite 21/21; `tests/unit/server/unified-graph-projection.test.ts` extended with
  seq-monotonicity, `update_node`-on-revision, `applyObjectPatch`, `removeNode`, `markContradiction` (9/9).
- In-process WS smoke (real `Agent` + `NAREngine` + `startAgentUI`): `sync.request` ⇒ snapshot
  (11 nodes, 10 working-memory terms); `node.history.request "(animal-->robin)"` ⇒ 6 real revision
  entries; `lens.set` ⇒ delta tagged `goal`; bogus message ⇒ `server.error invalid_message`;
  `object.set` ⇒ an update delta. *(Playwright itself could not run here — browsers are not installed.)*

**Still open in Phase 0** *(as of Session 1)*

- 0.3 — the bridge covers 6 event types; still to route `belief.added/revised`,
  `derivation.accepted`, `judgment.resolved`, `proposal.admitted/rejected`, `goal.*`,
  `skill.executed`, `budget.exhausted`, `policy.violation`, `task.admitted`, and to carry
  `rule/cpuMs/lmCalls/lmTokens` into provenance-shaped node data.
- 0.4 — real config reset, `<export-import>`, `focusNode` id-vs-term, `exportSubgraph` scope,
  `workingMemory` test namespace, 3D `graph:zoom/search/pan-to` parity.
- 0.5 — user-triggered reconnect reset (only `disconnect()` resets today), and queue expiry.
- 0.6 — remove `lens-selector.ts`, `core/theme.css`, unused `styles/tokens.ts`,
  `components/index.ts` barrel, `spacegraph-app.ts`, `src/stories/` cruft.
- 0.7 — the full command contract (`test:visual`, `ui:gallery`); server-inclusive typecheck is now real.

**New opportunities spotted** *(Session 1)*

- The no-agent `startTestServer` branch bypasses `handleClientMessage` entirely — it still emits
  unvalidated `cognitive.delta` and never answers `sync.request`. Unify the two connection paths
  behind the projection so the "test server" is the agent server with an empty engine.
- `telemetry` runs a 1 Hz timer even with zero clients; gate it on `wss.clients.size > 0`.
- The projection's `#edgeData` drops `truth`/`priority` even though `GraphEdge` now carries them
  (they only survive in the map, not on the wire op) — wire them once the lens needs edge truth.
- `ui/vitest.config.ts` `__dirname` warning and the regenerated `styles/tokens.css` churn on
  every `pnpm build` are both determinism debt (Phase 1/3).

---

### Session 2 — Phase 0: contract completion + dead-artifact removal (2026-10-07)

**Landed**

- **0.3 — bridge widened.** The `agent.on('*')` bridge now folds in the graph-relevant slice of
  every engine family: `derivation.made` (+ `rule/cpuMs/lmCalls/lmTokens`), `derivation.accepted`
  (rule id + premise edges), `belief.added`, `belief.revised` (new truth, `update_node` on a known
  term), `concept.activated`, `goal.achieved/failed` (`goal:` nodes), `skill.executed`
  (`metta:skill` node with args/result/durationMs), `proposal.admitted/rejected`
  (`proposal:` nodes with verdict), `task.admitted`, `atom.derived/retracted`,
  `belief.retracted`, `conflict:detected`. `GraphNodeDataView` gained optional
  `rule/cpuMs/lmCalls/lmTokens`; `makeNode` takes an extras bag so provenance rides the wire.
- **0.4 — real config reset.** New `config.reset` client→server message (optional `category`);
  the server restores the mapped NAR fields to `DEFAULT_CONFIG` via `resetConfigFields` and
  rebroadcasts `config.schema`. `config-hud`'s per-category and reset-all buttons now send it
  instead of only clearing dirty flags. `config.set`/`config.reset` share `applyConfigUpdates`.
- **0.4 — `<export-import>` implemented.** A focused `export-import` Lit element (export button,
  paste textarea, import button, inline error) now backs `config-profiles`; the old undefined tag
  was inert. `handleImport` returns an error string so the child owns the error slot.
- **0.4 — remaining wiring.** `focusNode`/context-menu focus send the target's `term` (not id);
  `exportSubgraph` exports the selected node's 1-hop neighborhood instead of the whole graph; the
  `workingMemory.getTerms()` test namespace is mounted; the 3D viewport subscribes to
  `graph:fit/search/pan-to/zoom-in/out` (camera-distance zoom, term search + `focusNode`, center
  pan) and exposes `spacegraph.focusNode`.
- **0.6 — dead artifacts removed.** `lens-selector.ts` (plus both side-effect imports),
  `core/theme.css`, `styles/tokens.ts` (and `build-tokens` no longer emits it),
  `components/index.ts`, `spacegraph-app.ts`, and `src/stories/` (+ its biome ignore). The
  standalone `spacegraph/index.html` now mounts `<spacegraph-viewport>` — it previously mounted an
  unregistered `<spacegraph-app>` tag and rendered nothing. All removed files are preserved
  path-for-path under `docs/archive/ui-dead-artifacts/` (see its `INDEX.md` for per-file
  resurrection notes and the removal commit).

**Verification**

- `pnpm --dir core exec tsc --noEmit` clean; `pnpm --dir ui exec tsc --noEmit` clean.
- `pnpm --dir ui build` succeeds (tokens.css regenerated, tokens.ts not).
- UI unit 21/21; root `tests/unit/server` 11/11 (new `config-reset.test.ts` + projection);
  `biome lint` clean on all 12 changed files.

**Still open in Phase 0**

- 0.3 — the *stream-only* events are not graph-foldable and remain unwired:
  `judgment.resolved`, `budget.exhausted`, `policy.violation`, `egress.gate.rejected`,
  `shadow.validation.dropped`. They need the append-only event stream (Phase 6.6), not node ops.
- 0.3 — edge `truth`/`priority` still do not survive `#edgeData` onto the wire (Phase 6.1/8.2).
- 0.4 — the standalone `graph-test.html` harness still calls `focus.set` with ids; benign because
  the server uses terms as ids for concepts, but inconsistent with the prefixed signal nodes.
- 0.5 — user-triggered reconnect reset and offline-queue expiry remain.
- 0.7 — `test:visual`/`ui:gallery` deferred to Phase 2 (baselines, `build-gallery.ts`, visual
  config are Phase 2 deliverables).

**New opportunities spotted** *(Session 2)*

- The 3D zoom handlers move the camera, and `onCameraChange` derives the persisted zoom proxy as
  `cameraDistance / 500`; the two can fight on rapid zoom. A single `setCamera`-level zoom model
  would make 2D↔3D viewport state honestly equivalent (Phase 8.5).
- `proposal:`/`goal:`/`skill:`/`task:` nodes are added but never removed; they will accumulate.
  Once the event stream lands they belong there, with the graph showing only believed/derived state.
- `resetConfigFields` already filters by category, but only `nars` fields are mapped today —
  LLM/system categories become real resets as their fields are added (Phase 9.3).
- `config-profiles.ts` still uses `prompt()` for "Save as profile" (Phase 5.6 replaces prompts
  with dialogs).
- `build-tokens` now only writes CSS; `design-tokens.json` should still be the single source for
  the future runtime `theme` facade (Phase 3.1).

---

### Session 3 — Phase 0 close-out + Phase 1 foundation (2026-10-07)

**Landed**

- **0.5 — reconnect + queue expiry (closed).** `ws-client` exports `reconnect()` (clears the
  reconnect timer and attempt budget, keeps the offline queue) and the Retry buttons in
  `connection-banner`/`error-boundary` use it, so a manual retry after the attempt limit no longer
  dead-ends. Pending messages carry a timestamp and expire after 60 s; backoff jitter was removed so
  the schedule is a pure function of the attempt. Every handler guards on socket identity, so a
  superseded socket's late `onclose` cannot reschedule the connection that replaced it.
- **0.7 / E2E unblock — the browser app could not load at all.** `agentOptionsSchema.knowledgePath`
  evaluated `cachePath('agent-knowledge.json')` (→ `node:path.join`) at module init; `@senars/util`'s
  barrel is in the client bundle, so the externalized `node:path` proxy threw and aborted the entry
  bundle — no custom element registered and *every* Playwright spec failed for reasons unrelated to
  its subject. Fixed with a lazy zod default. `spacegraph-viewport` now imports `SpaceGraph` from
  `spacegraphjs/SpaceGraph` instead of the barrel (whose `VisionSystem` export eagerly pulls
  `child_process`/`fs`/`path`). The real `agent-server` + Playwright smoke is now green.
- **0.3 follow-on — belief truth shape.** `derivation.made` emitted raw NAR belief truth `{f,c}`
  where the wire contract is `{frequency,confidence}`, so the client's
  `IncomingFromServer.safeParse` dropped the *whole* delta silently. Mapped through `asBeliefTruth`;
  `/test/export-beliefs` likewise.
- **1.1 — deterministic reset.** `UnifiedGraphProjection.reset()` clears nodes/edges/lenses/focus and
  rewinds `#seq` to 0. `/test/reset` restores the active scenario baseline; `/test/reset-all` forces
  bootstrap for parallel isolation; `/test/scenarios` lists ids; `/test/scenario` clears the engine
  and loads a named scenario through the real engine.
- **1.2 — seeded identity/time.** `agent-server` builds the NAR config from `SENARS_SEED` (default 1;
  `off` disables): `ids: sequentialIdSource()`, `rng: new SeededRNG(seed)`, `clock: fixedClock(…)`.
  `Math.random` removed from the reconnect backoff and the minimap's missing-layout fallback
  (FNV-1a hash of the node id into [-200, 200)).
- **1.3 — engine control.** `/test/step` (`nar.run(n)`), `/test/pause`/`/test/resume`
  (`getSelfAnalyzer().stop()/start()`), `/test/inject-event` (tagged `synthetic`, test-only), plus
  `/test/scenario`.
- **1.5 — scenario catalog.** New `ui/src/server/scenarios.ts`: typed `Scenario`, `SCENARIOS`
  (`bootstrap`, `basic-derivation` S1, `conflicting-evidence` S2) and `loadScenario` (real
  `believe`/`goal` + `run`). Exported as `@senars/ui/scenarios`; test-side view in
  `ui/tests/framework/fixtures/scenarios.ts`. `agent-server` now seeds bootstrap from the catalog
  rather than a hardcoded list.
- **1.4 — test API parity (partial).** `store.setState(path, value)`; `telemetry.getSeries()`;
  `spacegraph.getEdgeData/clickEdge/setGraphData` to match the 2D API. `graph.getProvenance` and
  `events.recent` were deliberately deferred — there is no client provenance or event log yet
  (Phases 6.1/6.6).

**Verification**

- `pnpm --dir ui exec tsc --noEmit`, `pnpm --dir core exec tsc --noEmit`, `pnpm --dir util exec tsc
  --noEmit` clean; `pnpm --dir ui build` succeeds.
- UI unit 21/21; root `tests/unit/server` 18/18 — added `scenarios.test.ts` and `test-endpoints.test.ts`
  (the latter boots a real `Agent` + `NAREngine` + `startAgentUI` and drives
  reset/scenario/step/inject over HTTP); `unified-graph-projection.test.ts` extended with reset.
- Playwright chromium: smoke `app-loads` now passes. A cognitive+spatial subset ran 6 pass / 6 fail;
  the failures are the 3D-parity, timeline, ingest and frame-budget specs. The base build aborted on
  load, so these specs never ran before this session — the failures are pre-existing gaps being
  surfaced, not regressions from Session 3.

**Still open / newly visible** *(Session 3)*

- **Phase 1.6 untouched** — the placeholder specs still need wiring to scenarios or deletion. The
  first honest runs surface real gaps to triage: the toolbar's 3D toggle leaves `$viewportMode` at
  `2d` under a synthesized click, the 3D `spacegraph-viewport` never becomes visible, ingest's send
  flow opens the error boundary, and the timeline/frame-budget specs fail. Resolve before Phase 8
  (2D/3D parity) and 6.7 (timeline).
- `/test/reset` now reloads the baseline through the engine, changing the E2E fixture contract:
  `testControl.reset()` is a real reset, not a `testState` wipe. `fullyParallel` specs still share one
  server, so `reset-all` isolation only pays off once specs use it per-test (or servers are scoped).
- 1.3 proposal scenarios (`LM_PROVIDER=mock`) and 1.5 `invariants`/proposal fields are not in the
  `Scenario` type yet.
- `inject-event` tags synthetic events with a non-schema `synthetic` field (double cast); fold it
  into the event base schema when the append-only stream lands (6.6).
- `startUI`'s no-agent branch still bypasses `handleClientMessage` (Session 1 note) — the test server
  remains a second connection path.

**New opportunities spotted** *(Session 3)*

- **Guard the browser bundle.** The client was broken by two eager Node-only imports reachable
  through barrels (`@senars/util`'s agent schema, spacegraph's vision export). Add a build guard
  (import the client entry in jsdom, or assert no externalized `node:` access runs at load) so the
  next such regression fails CI instead of the first Playwright run.
- `testControl.reset()` reloads the scenario on every test setup; if that proves slow, make reset
  projection-only and reserve the engine reload for `/test/reset-all`.

---

### Session 4 — Phase 1.6 close-out + client-render integrity (2026-10-07)

**Landed**

- **Client-load crash fixed (belief-lens color).** `isItemField` omitted `truth`, so the belief
  lens's `color` channel resolved to the number `0`; cytoscape's color parser called
  `.toLowerCase()` on it, threw, and opened the `error-boundary` overlay — which (via
  `preventDefault`) also hid the exception from the `errorMonitor` fixture. `compile.ts` now derives
  the runtime field set from a `satisfies readonly (keyof Item)[]` list including `truth`;
  `adapter-2d` only assigns type-valid channel values (color/label/line-style strings; numeric
  size/opacity/width) so a malformed lens can no longer crash the renderer.
- **Graph edge integrity fixed.** `derivation.made` emitted structural edges (`parseTermToEdges`)
  whose endpoints were bare terms (`robin`→`animal`) that were never concept nodes, so
  `cy.add({group:'edges'})` threw *Can not create edge … nonexistent source*.
  `UnifiedGraphProjection.applyDelta` now drops edges whose endpoints are not known nodes;
  `graph-viewport.syncGraph` and `store-bindings.applyGraphOps` guard edge insertion by endpoint
  existence. Edges now actually render (bootstrap 30, after `basic-derivation` 62).
- **Invalid cytoscape style removed.** `clearNodeStyles` set `border-style: 'none'` (not a valid
  cytoscape enum), logging a warning every render; replaced with `border-width: 0` only.
- **E2E browser test API repaired.** `TestApiClient.getNodeData/clickNode/clickEdge/getEdgeData`
  called `page.evaluate` with a callback that accepted an argument but never forwarded it, so
  `id`/`source`/`target` were `undefined` — node/edge clicks and data reads were silent no-ops.
  All four now pass their argument, unblocking the node/edge-driven specs.
- **1.6 — placeholder specs wired.** The 14 placeholder specs now assert real scenario/surface
  behaviour and carry tags. `@smoke`: `smoke/app-loads`, `full-bot`. `@critical`:
  `keyboard-navigation`, `focus-concept` (loads `basic-derivation`, selects the derived concept,
  asserts `focusTerm`), `fusion` (premises + derivation edge), `graph-updates`
  (`/test/import-beliefs` + step grows the graph), `high-throughput` (sustained cycles, no error
  overlay), `adjust-parameters` (dirty + reset via a URL-opened config panel),
  `switch-llm-provider` (LM status strip renders; real switching is 9.2), `first-message`,
  `markdown-rendering`, `streaming-response`, `backpressure`, `long-session`, `network-drop`
  (`routeWebSocket` drops the first socket; the client self-heals), `xss-protection`.
  `@visual`: `impressive-demo`.
- **New test helpers:** `tests/framework/utils/interactions.ts` (`waitConnected`, `openPanels` via
  URL hash + reload — a hash-only `goto` does not re-run boot hydration, `sendMessage`,
  `chatMessageCount`); `TestControl.importBeliefs`.
- **Archived dead artifacts (§2.2):** `tests/impressive-screenshot.spec.ts` (outside `testDir`,
  port-3000 drift) and `scripts/ready-check.ts` (unreferenced, port-3000 drift); archive `INDEX.md`
  updated.

**Verification**

- `pnpm --dir ui exec tsc --noEmit` clean.
- UI unit 22/22 (`tests/components`, `tests/modulation`, incl. new truth→color compile test); root
  `tests/unit/server/unified-graph-projection.test.ts` 11/11 (incl. new dangling-edge test).
- Chromium Playwright: the 14 rewritten specs 14/14; smoke `app-loads` green.
- Firefox/WebKit cannot run here — installed browser revisions don't match Playwright 1.62
  (only chromium is); CI uses chromium only.

**Still open / newly visible** *(Session 4)*

- The broader chromium scenario suite is still partly red; the honest specs now surface real gaps:
  `cognitive/timeline` (2), `configuration/lens-designer` (2), `metta` LTM (1),
  `relational/auto-link` (2), `relational/edit-edge` (2), `spatial/parity` edge-editing (1). Not
  regressions from this session — the test-API + render fixes moved several from "silently no-op"
  to "runs and reveals the next gap". Triage next (likely Phase 6.7 timeline, 3.4 lens designer,
  8.3 edge parity).
- `switch-llm-provider` only asserts the status strip renders; real `lm.switch` is 9.2.
- 1.3 mock-LM proposal scenarios and 1.5 proposal/invariant scenario fields remain.
- The error boundary calls `preventDefault()` on uncaught errors, so `errorMonitor`/Playwright
  `pageerror` never observe them; the load crash hid behind this for full runs.

**New opportunities spotted** *(Session 4)*

- Add a test asserting the reflective test-API methods actually receive their arguments (the
  argument-forwarding bug was invisible and defeated every node/edge spec).
- Scenario-mutating specs share one server and `testControl.reset()` reloads the active scenario
  per test, so parallel specs can clobber each other; run them with `--workers=1` or move to
  per-test `/test/reset-all` + scoped servers (Phase 2.6/10.2).
- `border-style: 'none'` hints that lens/capability channel values are not validated against the
  cytoscape enum; a channel→property capability matrix (3.4) would reject them at the source.

---

### Session 5 — Phase 2: automated visual-validation workflow (2026-10-07)

**Landed**

- **2.1 — deterministic screenshot config.** New `ui/tests/visual/playwright.config.ts` owns the
  snapshot contract, separate from the behavioural E2E config: fixed `1440×900` viewport,
  `deviceScaleFactor:1`, dark color scheme, `workers:1` (one shared scenario server, so a cell's
  engine state cannot race another), `snapshotPathTemplate`
  `{testDir}/baselines/{projectName}/{arg}-{platform}{ext}`, and
  `expect.toHaveScreenshot { animations:'disabled', caret:'hide', scale:'css',
  maxDiffPixelRatio:0.01 }`. The project re-applies the viewport *after* `devices['Desktop Chrome']`
  — the device spread was silently overriding it.
- **2.2 — curated matrix.** `ui/tests/visual/matrix.ts` declares `VisualCell[]` as data
  (`id · group · title · scenario · hash · viewport · layout · mask · prepare`). First cut: 10 cells
  across Graph (bootstrap, derivation), Lenses (goal/concentric, conflict/breadthfirst),
  Responsive (narrow), Panels (config, lens-designer, chat, search), Selection (node detail).
  Cells drive the app through its **real boot path** (URL-hash hydration) and load scenarios through
  the **real engine** (`/test/reset-all` + `/test/scenario`), never synthetic state.
- **2.2 — graph determinism.** cytoscape `cose` seeds node positions from `Math.random`, so raw
  graph captures were unstable. `graph-viewport` gained a `graph.setLayout(name, {fit})` test-API
  method; captures force a topology-derived layout (`breadthfirst`/`concentric`) with animation off.
  The remaining flake (a uniform horizontal shift on the conflict cell) was a **font-metrics race**:
  the layout ran before `document.fonts.ready`, so node sizing differed. The spec now awaits
  `document.fonts.ready` before laying out; the cell is pixel-stable across repeated runs.
- **2.3/2.4 — gallery + report.** A custom reporter (`tests/visual/reporter.ts`) emits
  `tests/visual/visual-report.json` (per-cell status, baseline path, actual/diff paths from the
  run's attachments, group from a test annotation). `ui/scripts/build-gallery.ts` renders the report
  + images into `tests/visual/gallery/index.html` (grouped contact sheet, status badges, links to
  actual/diff, inline error). Committed baselines live in `tests/visual/baselines/chromium/`;
  run artifacts (`.artifacts/`, `gallery/`, `visual-report.json`) are gitignored.
- **2.6 — commands + CI wrapper.** `ui/package.json`: `test:visual`, `test:visual:update`,
  `ui:gallery`, and `test:visual:ci` (run suite, then build the gallery regardless of pass/fail,
  preserving the suite exit code). With `test:visual`/`ui:gallery` present, **Phase 0.7 is closed**
  (the full command contract now exists).

**Verification**

- `pnpm test:visual:update` generated 10 baselines; `pnpm test:visual` then passed **clean three
  consecutive times** (no diffs), confirming pixel stability for this environment.
- Failure path validated: corrupting one baseline made exactly that cell fail with a localized diff;
  the report recorded it and the gallery staged `actual`/`diff` for that cell only, then all 10
  passed again after restore.
- `pnpm --dir ui exec tsc --noEmit` clean; `biome lint` on the new files clean; `pnpm --dir ui
  build:client:test` succeeds. (Only chromium is installed here — matches the plan's CI scope.)

**Still open in Phase 2**

- **2.5 Storybook repair + coverage** — untouched. The `ui/.storybook` aliases/port drift and
  primitive/feature story coverage (a11y addon, story→screenshot sweep) remain.
- **2.7 descriptor-derived matrix** — the matrix is hand-curated; it becomes generated from
  `defineSurface` + adapter capabilities once Phase 3 lands.
- The telemetry surface is not baselined: its charts update at 1 Hz from a live timer, so a
  deterministic cell needs a "freeze telemetry" fixture (or masking).
- 3D/SpaceGraph is not baselined: headless WebGL is unreliable here and 2D↔3D parity gaps (Phase 8)
  are still open, so a 3D cell would capture a known-broken surface.
- `#panels=none` is a sentinel to close every panel (the empty-string form is ignored by
  `parseHash`); a first-class "no panels" URL state would be cleaner.

**New opportunities spotted** *(Session 5)*

- Promote layout determinism into `layoutRegistry` (Phase 3.5): a `deterministic:boolean`/seed on
  layouts would let product captures be stable without a test-only `setLayout` call.
- `graph-viewport.ts` still carries two pre-existing dead locals (`LOD_EDGE_THIN_ZOOM`,
  `graphFilter` in `syncGraph`) flagged by biome — fold into the Phase 11.5 dedup pass.
- `ui/tests/tsconfig.json` is not part of any gate and is far from clean (many pre-existing
  `window as Record<string,unknown>` cast errors); the new visual files follow the existing pattern.
  Adding a tests-inclusive typecheck to the gate would catch this class of drift.
- The reporter reads actual/diff from `result.attachments` by path suffix because
  `TestCase.outputDir` was `undefined` at `onTestEnd`; worth revisiting if Playwright exposes it
  later.

---

### Session 6 — Phase 3.1: theme facade (2026-10-07)

**Landed**

- **3.1 — generated runtime token facade.** `ui/scripts/build-tokens.ts` now derives everything from
  `design-tokens.json` and emits **two** artifacts from the one source: `styles/tokens.css` (three
  `:root` / `:root[data-theme=…]` blocks) and the new `styles/tokens.generated.ts`
  (`ThemeName`, `DEFAULT_THEME`, `THEME_NAMES`, and `TOKENS: Record<ThemeName, token→value>`). Added
  `themes.light` / `themes.high-contrast` override sets to `design-tokens.json`; semantic aliases
  resolve per theme (e.g. `--colors-semantic-bg-base` is `#000000` dark / `#ffffff` light / `#000000`
  high-contrast). The default `:root` block is byte-identical to the previous `tokens.css`, so this is
  purely additive — committed visual baselines are unaffected.
- **3.1 — `theme` facade.** New `ui/src/client/utils/theme.ts` is the one runtime reader: `token(path)`
  (active theme, default-theme fallback), `setTheme`/`getTheme` (also mirrors `<html data-theme>`),
  `cssVar`, `cssToken` (live computed-property read for canvas), and a `theme.colors` object whose
  entries are **getters** so reads track the active theme rather than import time.
- **3.1 — consumers migrated off `TOKEN_COLORS` + inline hex.** `adapter-2d`, `adapter-3d`
  (`'#00f3ff'`), `graph-viewport`, `graph-minimap` (`'#ffaa00'`), `cognitive-metrics`,
  `telemetry-panel`, `spacegraph-viewport` now import `theme`; `node-detail-drawer` uses
  `theme.colors.accentAmber`; `lm-status-panel` uses `var(--colors-primitive-success/error)` +
  `color-mix`. `utils/token-colors.ts` archived path-for-path under
  `docs/archive/ui-dead-artifacts/ui/src/client/utils/` and removed (INDEX.md entry added).
- **Tests.** `ui/tests/theme.test.ts`: independent re-flatten/resolve of `design-tokens.json` compared
  against `TOKENS` and against the generated `tokens.css` for every theme (parity), plus facade
  default/fallback/switch assertions.

**Verification**

- `pnpm --dir ui exec tsc --noEmit` clean; `pnpm --dir ui build` succeeds.
- UI unit **27/27** (was 22; +5 theme parity/facade). `biome lint` clean on all new files; the only
  warnings on touched files are pre-existing (`node-detail-drawer` `hasTruth`, `spacegraph-viewport`
  `any`).
- `git diff` of `tokens.css` is **290 insertions, 0 deletions** — the default theme is unchanged, so
  no baseline regeneration is implied.

**Still open in Phase 3**

- **3.2–3.10 untouched** — `eventCatalog`, `fieldCatalog`, `lensCatalog`, `layoutRegistry` SSOT,
  `idSource`, `SurfaceComponent`/`defineSurface`/`renderField`, reflective generators, guard scripts.
- **3.1 follow-ons** — light/high-contrast exist as data + CSS but no UI surfaces `setTheme` (no
  `prefers-color-scheme` wiring, no toggle; Phase 5.6/7.1). `cssToken` still reads `getComputedStyle`
  on every canvas paint (uncached); a renderer may prefer `token()` now that it is theme-aware.
  Storybook backgrounds are not yet fed from `THEME_NAMES`.

**New opportunities spotted** *(Session 6)*

- Wire `prefers-color-scheme` + a persisted preference into `setTheme` and re-run each viewport's
  style application on change (Cytoscape `cy.style()`, Three materials) — the getters make the
  values live but the renderers cache styles at first paint.
- Fold the other static palettes into tokens as they appear: `graph-viewport`'s `'JetBrains Mono,
  monospace'` font string and the `rgba(255,176,0,0.1)` warning tint are still literals.
- The `themes` map is a generic override tree, so a `tokens.generated.ts` consumer can type the token
  paths (`keyof typeof TOKENS.dark`) to make a misspelled path a compile error instead of a silent
  fallback.

---

### Session 7 — Phase 3.2: event catalog (2026-10-08)

**Landed**

- **3.2 — the event presentation registry.** New `ui/src/client/utils/event-catalog.ts` is the one
  presentation registry for the cognitive vocabulary: `EVENT_CATALOG` carries a `label`, `category`,
  `severity`, `provenanceRole` and `shapes` hint for **all 34** `CognitiveEventSchema` discriminants.
  Exhaustiveness is a type, not a review catch — `satisfies Record<CognitiveEvent['type'], EventMeta>`
  makes a schema variant without metadata (and a metadata typo) a compile error. Helpers:
  `eventMeta`, `EVENT_TYPES`, `EVENT_CATEGORIES`, `eventsByCategory`, `eventsByShape`,
  `eventsBySeverity`; `ViewShape` is the §3.3 shape union, declared here until Phase 4 owns it.
- **3.2 — the bridge is catalog-keyed.** The 15-case `agent.on('*')` switch moved out of
  `ui/src/server/index.ts` into `ui/src/server/event-reducers.ts`: `GRAPH_REDUCERS` is a
  `[K in CognitiveEvent['type']]?` map whose per-key `event` is narrowed to `CognitiveEventOf<K>`,
  dispatched by `dispatchGraphEvent`. The derivations-per-second window now rides the single `*`
  subscription. The "which events are graph-relevant" decision is no longer the switch's:
  `EVENT_CATALOG[*].shapes` includes `'graph'` for exactly the 15 reducers.
- **Guard test.** `tests/unit/server/event-catalog.test.ts` compares catalog keys to
  `CognitiveEventSchema.options` discriminants, validates every category/severity/role/shape and the
  category partition, and asserts the graph-shaped event set **equals** `GRAPH_REDUCERS`' keys — so a
  newly graph-shaped event cannot be silently dropped by the bridge.

**Verification**

- `pnpm --dir ui exec tsc --noEmit` clean; root `tests/unit/server` **24/24** (5 files; +5 event-catalog
  tests, and the refactored bridge still passes the real-agent `test-endpoints` suite); `biome lint`
  clean on all 4 files.

**Still open in Phase 3**

- **3.3–3.10 untouched** — `fieldCatalog`, `lensCatalog` + capability matrix, `layoutRegistry` SSOT,
  `idSource`, `SurfaceComponent`/`defineSurface`/`renderField`, reflective generators, guard scripts.
- **3.2 consumption is partial.** The bridge is catalog-keyed, but the client has no consumer yet:
  the event log (6.6), timeline (6.7), provenance (6.2) and narration (5.3) still to read it. The
  metadata is currently exercised only by the guard test.

**New opportunities spotted** *(Session 7)*

- `ViewShape` here duplicates the `Shape` union Phase 4.1 introduces (`ViewSpec`/`ViewAdapter`); when
  it lands, keep one definition in the view system and have `EventMeta.shapes` reference it.
- `severity` is static, so `health` (degraded vs ok) and `policy.violation`
  (`warn`/`block`/`quarantine`) always report their worst case. A per-event severity resolver
  (`severityOf(event)`) would let the status strip (5.3) and log (6.6) reflect the actual payload.
- `CognitiveEventOf` is only exported from `@senars/core/schemas`, not the core root; the reducers
  import the subpath. Re-export it from `@senars/core` so consumers stop reaching past the barrel.
- The vite `@senars/core` alias still matches by prefix (the Session 1/3 bug class), so a client
  value import of `@senars/core/schemas` would resolve to `protocol/index.ts/schemas`. The catalog
  sidesteps it with a type-only import (erased before resolution); a real client consumer of the
  schema (or the catalog) needs a regex alias like the `lens-schema` one.
- `proposal:`/`goal:`/`skill:`/`task:` nodes still accumulate (Session 2 note); the catalog now tags
  them `category: 'proposal'|'goal'|'skill'`, which is the grouping a future memory-eviction or
  event-stream surface will filter on.

---

### Session 8 — Phase 3.3: field catalog (2026-10-08)

**Landed**

- **3.3 — the field presentation registry.** New `ui/src/client/utils/field-catalog.ts` is the one
  reader for a data field's presentation. `FieldId` is spelled from the schema-inferred key spaces
  (`TelemetryMetrics`, `CognitiveMetricsData`, `TruthValue`, `ConsumedBudget`) plus the explicit
  budget scalars and node metrics, and `FIELD_CATALOG satisfies Record<FieldId, FieldDescriptor>`
  makes a schema metric without a descriptor (and a descriptor for a field the schema lacks) a
  compile error. `FieldDescriptor` carries `label · short · kind · unit · range · precision ·
  description · color`; helpers `fieldMeta`, `fieldCategory`, `fieldKey`, `fieldsByCategory`,
  `formatField`, plus `TELEMETRY_FIELDS`/`COGNITIVE_FIELDS` for the panels.
- **3.3 — schema-derived key spaces.** `core` now exports the inferred metric types the catalog is
  keyed against: `TelemetryMetrics` + `CognitiveMetricsData` (declared in `protocol/sync.ts`, re-exported
  from the protocol barrel and the core root) and `ConsumedBudget`/`ReasoningBudget`/`TruthValue` from
  the root. They are the external union that gives the catalog its exhaustiveness, exactly as
  `CognitiveEvent['type']` does for `eventCatalog`.
- **3.3 — consumers migrated off per-panel field code.** `telemetry-panel` (metric labels, colors,
  hover formatting, export columns), `cognitive-metrics` (the five cards) and `node-detail-drawer`
  (priority/confidence + the truth frequency/confidence rows) now read the catalog. The metric→color
  map that was duplicated between the toolbar and the series now lives once, as a `theme.colors` key
  on the descriptor. Labels and precision are byte-identical for the baselined surfaces.
- **Guard test.** `tests/unit/server/field-catalog.test.ts` asserts the telemetry/cognitive/truth/
  consumed id sets **equal** the live schema shapes, that every budget scalar exists on
  `ReasoningBudgetSchema`, that the node set is exact, that descriptors are well-formed and partition
  across categories, and that `formatField` applies per-kind precision + units.

**Verification**

- `pnpm --dir core exec tsc --noEmit` and `pnpm --dir ui exec tsc --noEmit` clean.
- UI unit **27/27**; root `tests/unit/server` **35/35** (6 files; +11 field-catalog tests).
- `pnpm --dir ui build` succeeds — the catalog imports `@senars/core` **type-only**, so the client
  bundle is unchanged (the Session 7 alias hazard does not apply).
- `biome lint` clean on the new file; the only warnings on touched files are pre-existing
  (`telemetry-panel` `hoverTimer`/`y`/non-null assertions, `node-detail-drawer` `hasTruth`).

**Still open in Phase 3**

- **3.4–3.10 untouched** — `lensCatalog` + capability matrix, `layoutRegistry` SSOT, `idSource`,
  `SurfaceComponent`/`defineSurface`/`renderField`, reflective generators, guard scripts.
- **3.3 coverage is the scalar metrics only.** The config form still rides the server's parallel
  `ConfigField` metadata (`server/config-schema.ts`); provenance fields (`cpuMs`/`lmCalls`/`lmTokens`,
  `totalCycles`/`maxDepthReached`) and record-valued fields (`goalUrgencyDistribution`) are not yet
  descriptors.

**New opportunities spotted** *(Session 8)*

- Fold the config form's `ConfigField` (label/min/max/step/description) into the same registry once
  LLM/system categories become real resets (9.3) — today it is a second field-metadata system.
- Add a record/map `FieldDescriptor` variant so `goalUrgencyDistribution` (and future per-engine
  health maps) render through the catalog instead of a bespoke branch in `cognitive-metrics`.
- `renderField` (3.8) can consume `FieldDescriptor.kind`/`range`/`options` directly; the catalog is
  now the source it should read.
- `ThemeColor` (`keyof theme.colors`) is the catalog's color vocabulary; the minimap/adapter palettes
  can adopt the same keying to finish the token migration started in 3.1.
- The `FieldId` union is deliberately `category.leaf`; a `fieldPath` resolver over a schema object
  would let a form be generated from an object schema (e.g. `ReasoningBudget`) rather than a flat id
  list.

---

### Session 9 — Phase 3.4: lens catalog + renderer capability matrix (2026-10-08)

**Landed**

- **3.4 — `lensCatalog`.** New `ui/src/client/utils/lens-catalog.ts` is the one presentation +
  validation registry for the lens vocabulary. `LENS_CATALOG` carries
  `label · description · color · defaultLayout · primary · spec` for every `BuiltinLens`:
  presentation comes from core `LENS_VOCABULARY` (label/description/color), the modulation and
  `requires` from core `builtinLensSpecs()`. `LENS_DEFAULT_LAYOUTS`/`LENS_PRIMARY` are
  `satisfies Record<BuiltinLens, …>`. Helpers `lensMeta`/`builtinLensSpec`/`LENS_IDS`/`PRIMARY_LENSES`.
  `validateLens(spec)` is the one *client* validation path (accept returns the parsed spec, reject a
  path-qualified error string); the wire schema still validates inbound on the server.
- **3.4 — renderer capability matrix.** New `ui/src/client/utils/renderer-capabilities.ts`:
  `RENDERER_CAPABILITIES` (`satisfies Record<RendererId, …>`) declares node/edge channel support for
  `2d`/`3d`; `supportsChannel` and `unsupportedChannels(delta, renderer, isEdge)` read it.
  `adapter-2d` now declares `SUPPORT_2D`/`SUPPORT_2D_EDGES` and skips undeclared channels;
  `adapter-3d`'s `SUPPORT_3D*` and `checkUnsupportedChannels` are thin reads over the same matrix
  (identical behavior — the modulation property test still passes).
- **3.4 — channel + scale-map vocabulary.** `CHANNEL_CATALOG satisfies Record<Channel, …>` labels
  every modulation channel with its target (`node`/`edge`/`both`); `SCALE_MAP_CATALOG
  satisfies Record<ScaleMapId, …>` labels each scale map; `compile.ts`'s runtime map is typed
  `satisfies Record<ScaleMapId, …>`, so an implementation without a label (or vice-versa) fails the
  build.
- **3.4 — consumers de-duplicated.** `lens-controller` renders `PRIMARY_LENSES` (labels/descriptions/
  colors from the catalog; the local `LensDef` + `buildLensDefs` are deleted). `store.ts`'s
  `$lensLayout` seeds from `LENS_DEFAULT_LAYOUTS`, `getLensIds` from `PRIMARY_LENSES`, and
  `getLensSpec` from `builtinLensSpec` (the hand-written builtin fallback map is gone).
  `layout-registry.getForLens` falls back to `lensMeta(lens).defaultLayout` instead of a hardcoded
  `goal→concentric`/`contradiction→breadthfirst` switch. `lens-designer` **generates** its field
  (core `LENS_FIELDS`), channel (`CHANNEL_CATALOG`) and scale-map (`SCALE_MAP_CATALOG`) options
  instead of hand-listing them, and uses `validateLens` for both preview and commit.
- **Dead artifact archived.** `ui/src/client/constants.ts` was a four-symbol barrel whose only
  importer was `lens-controller`; archived under `docs/archive/ui-dead-artifacts/ui/src/client/` with
  an INDEX entry (§2.2).
- **Guard test.** `tests/unit/server/lens-catalog.test.ts` (14) asserts catalog ↔
  `BUILTIN_LENS_IDS`/`builtinLensSpecs` coverage, `primary` flags, `validateLens` accept/reject,
  `CHANNEL_CATALOG` ↔ `CHANNELS`, `SCALE_MAP_IDS`, and the capability matrix / `supportsChannel` /
  `unsupportedChannels` behavior.

**Verification**

- `pnpm --dir ui exec tsc --noEmit` and `pnpm --dir core exec tsc --noEmit` clean; `pnpm --dir ui
  build` succeeds.
- UI unit **27/27**; root `tests/unit/server` **49/49** (7 files; +14 lens-catalog). `biome lint`
  clean on all new/changed files (only pre-existing warnings remain: `layout-registry` unused `cy`,
  `adapter-3d`/`store` `any`, `store` `isNaN`).
- Lens presentation is byte-identical (same core labels/descriptions/hex, same default layouts), so
  no visual baseline is implied; the designer's added `time-to-depth`/`edgeType`/`weight` options are
  non-rendering option-list additions.

**Still open in Phase 3**

- **3.5–3.10 untouched** — `layoutRegistry` SSOT name maps + single `shouldRelayout`, `idSource`,
  `SurfaceComponent`/`defineSurface`, `renderField`, reflective generators, guard scripts.
- **3.4 follow-ons** — the capability matrix is declared but not yet *surfaced*: the designer neither
  warns about nor disables a mapping whose channel the active renderer cannot paint (2D has no
  `checkUnsupportedChannels` wired into the viewport like 3D), and edge-only channels still appear in
  the node-oriented mapping rows. The `supportsChannel` data is the seam for 4.1/8.2.

**New opportunities spotted** *(Session 9)*

- Filter/annotate the designer's channel options by the active viewport and element kind from
  `RENDERER_CAPABILITIES`/`CHANNEL_CATALOG` (4.1, 8.2) so an inert `flow.enable` or edge-only channel
  is labelled rather than silently no-op'ing.
- Core still holds two lens presentation sources — `LENS_VOCABULARY` in `constants.ts` and the
  label/description in `builtinLensSpecs()`. The catalog reads both; consolidating core on the spec
  list would remove the last in-core lens duplication.
- `getLensSpec`/`getLensIds` are exported but have no consumer (only the barrel re-exports them);
  retire them or let the command palette (5.2) index lenses through them.

---

### Session 10 — Phase 3.5: layout registry SSOT (2026-10-08)

**Landed**

- **3.5 — one layout source with 2D/3D name maps.** `LayoutDefinition` now carries both renderers:
  `getLayout(cy, opts)` (Cytoscape) and `surface` (SpaceGraph plugin name; `null` = keep positions).
  New `surfaceFor(id)`/`surfaceForLens(lens)`/`runSurface(sg, …)` mirror `runLayout(cy, …)`, and both
  runners are keyed by layout id (the lens is resolved once via `getForLens`). Registered maps:
  `cose→ForceLayout`, `concentric`/`concentric-urgency→RadialLayout`, `breadthfirst→HierarchicalLayout`,
  `preset→null`.
- **3.5 — the 3D layout no-op is fixed.** `spacegraph-viewport` passed Cytoscape ids (`cose`, …)
  straight to `sg.layout(...)`, none of which are SpaceGraph plugins — every explicit layout selection
  (and the goal lens default) silently did nothing. It now resolves through
  `layoutRegistry.surfaceFor`/`runSurface`, so the 3D viewport actually moves nodes; the default
  relayout uses the lens-resolved surface instead of a hardcoded `ForceLayout`.
- **3.5 — single relayout heuristic.** The three copies (`GraphRenderer.shouldRelayout` +
  `relayoutIfNeeded` + its two `LAYOUT_RELAYOUT_*` constants; `spacegraph-viewport.shouldRelayout`;
  `layoutRegistry.shouldRelayout`) are now one `layoutRegistry.shouldRelayout(prev, curr)`. The dead
  `GraphRenderer.relayoutIfNeeded`/`prevNodeCount` and the `RendererApi.onLayout` seam (its only
  caller) are removed; both viewports call the registry directly. Semantics are the `max(5, 20%)`
  form the two viewports already used.
- **Guard test.** `tests/unit/server/layout-registry.test.ts` (8) asserts the exact registered id set,
  that every `LENS_DEFAULT_LAYOUTS` value resolves to a registered layout, that `$lensLayout`
  overrides win, the id→SpaceGraph name map (incl. `preset→null`), and the relayout threshold behavior.

**Verification**

- `pnpm --dir ui exec tsc --noEmit` clean; `biome lint --diagnostic-level=error` clean on all 5 files.
- Root `tests/unit/server` **57/57** (8 files; +8 layout-registry); UI unit **27/27**; `pnpm --dir ui
  build` succeeds.
- Chromium visual suite **10/10** unchanged — no baseline regeneration (the default layout path and
  `getForLens` resolution are byte-identical; only the dynamic relayout threshold and the
  previously-dead 3D names changed).

**Still open in Phase 3**

- **3.6–3.10 untouched** — `idSource` unification, `SurfaceComponent`/`defineSurface`, `renderField`,
  reflective generators, guard scripts.
- **3.5 follow-ons** — the `graph-toolbar` layout `<select>` still hand-lists
  `cose|concentric|concentric-urgency|breadthfirst|preset` instead of generating options from
  `layoutRegistry.getAll()` (the registry is now the source; the toolbar is the last hand-listed
  layout consumer). The `globe`/`grid`/`timeline`/`cluster`/`spectral`/`circular` SpaceGraph plugins
  exist but have no registry rows, so 3D is limited to the four mapped topologies.

**New opportunities spotted** *(Session 10)*

- Generate the toolbar's layout options (and the future command palette entries) from
  `layoutRegistry.getAll()`, removing the `graph-toolbar` `$lensLayout` local fallback duplication.
- Add SpaceGraph-native rows for `timeline→TimelineLayout`, `cluster→ClusterLayout`,
  `grid→GridLayout` so temporal/other lenses get honest 3D topologies (Phase 8.1).
- Carry the Session 5 note forward: a `deterministic`/seed hint on a layout would let product
  captures stabilize without the test-only `graph.setLayout`.

---

## 0. Purpose & north star

The UI is a **major product surface**: an **AI Reasoning Explorer** that lets any audience —
researcher, developer, educator, curious non-expert, future application builder — see and control
what SeNARS *knows, considers, derives, remembers, forgets, proposes, rejects, verifies, and does
under limited resources.*

North star: **observable real state and event provenance beat scripted/fake/mocked animation.** Every
surface is backed by a real engine event or a real snapshot. Transparency and inspectability are the
product, not a chatbot veneer.

Success: coherent information architecture with progressive disclosure; excellent defaults and
discoverable affordances; meaningful empty/loading/error states; readable reasoning explanations that
never hide expert detail; one consistent visual language; responsive, keyboard- and screen-reader-usable
interactions; polished 2D/3D cognition; observability of state, events, provenance, resources and
uncertainty; reusable components and fixtures; and **automated visual validation + screenshots as a
normal part of development** — no manual UI audit gate.

---

## 1. Assessment of the existing UI

### 1.1 What already exists (reuse — do not rebuild)

- **Reactive core:** `ui/src/client/core/{store,store-bindings,ws-client,graph-renderer,base-component,events,announcer}.ts`.
  Atoms, URL hydration, panel + lens registries, `window.__testApi` mount, `eventBus`.
- **Protocol:** zod discriminated unions in `core/src/protocol/*` (`unions.ts` is the contract).
- **Shared renderer bridge:** `core/graph-renderer.ts` drives both viewports via a `RendererApi` — the seed of the unified view host.
- **2D:** Cytoscape in `components/graph-viewport.ts`. **3D:** SpaceGraph (`ui/spacegraphjs7/`) via `spacegraph/spacegraph-viewport.ts` + `utils/adapter-3d.ts`.
- **Lens/modulation algebra:** `src/client/modulation/*` + `core/src/lens-schema.ts` (`belief|goal|contradiction|temporal`), rendered through `adapter-2d`/`adapter-3d`.
- **Panels:** node detail, chat, input HUD, config HUD + profiles, lens controller/designer, telemetry, cognitive metrics, timeline, contradiction badge, connection banner, error boundary.
- **Primitives + tokens:** `components/primitives/*`, `styles/*`, `design-tokens.json` → `scripts/build-tokens.ts`.
- **Server projection:** `server/UnifiedGraphProjection.ts`, `server/config-schema.ts`, `server/index.ts` (HTTP + WS + `/test/*`).
- **Testing:** Playwright, real-engine `scripts/agent-server.ts`, Storybook, fixtures `tests/framework/*`.

### 1.2 Broken or dead (reliability debt)

- **Controls that do nothing:** `graph:zoom-in/out|fit|search|pan-to` emit with no subscribers (`graph-toolbar.ts:259-271`, `graph-minimap.ts:182`).
- **Server ignores declared client messages:** `lens.set`, `focus.set`, `viewport.set`, `object.set`, `node.set`, `lens.define`, `node.history.request`, `sync.request` (`core/src/protocol/unions.ts:26-38`).
- **Server never emits:** `state.snapshot`, `telemetry`, `node.history`, `lens.defined` → telemetry/cognitive/history permanently empty.
- **Reasoning signal dropped at the bridge:** only `derivation.made` consumed (`server/index.ts:265`); `rule/cpuMs/lmCalls/lmTokens` discarded; `truth` read from a nonexistent field; `priority/confidence` hardcoded 0.7/0.9; dedup never emits `update_node` (no revisions).
- **Contract bugs:** `lm.switch` absent from `IncomingFromClient`; config reset cosmetic; undefined `<export-import>`; `focusNode` id-vs-term and `exportSubgraph` whole-graph; `getWorkingMemoryTerms()` targets an unmounted namespace.
- **2D/3D divergence:** layout names mismatch (`cose` vs `ForceLayout`) → 3D layout no-op; `size`/`z` semantics differ; capability filter hides all 3D nodes; no 3D click→selection/drawer; camera orientation discarded.
- **Transport:** hardcoded `ws://`, unguarded `JSON.parse`, unbounded offline queue, permanent give-up; server path traversal + always-on unauthenticated `/test/*`.
- **Port/path drift:** `tests/impressive-screenshot.spec.ts` (`:3000`, outside `testDir`), `scripts/ready-check.ts` (`:3000`), Storybook aliases at `/home/me/senars12b/...`.

### 1.3 Missing (product surface)

- No provenance/lineage view, revision diff, contradiction explanation, uncertainty explanation, budget/resource panel, or "why did it reject/forget this" view.
- No command palette, global search, onboarding/help, glossary.
- No loading/skeletons; `s-spinner` and `FocusTrap` unused.
- No deterministic reset/seeded RNG/clock/ids; no screenshot baselines, gallery, or story→screenshot pipeline.
- Storybook covers 4/29 components; `src/stories/` is unused scaffolding.

### 1.4 Functional redundancy & single-source-of-truth violations (to unify)

| Concept | Today | Target |
|---|---|---|
| Color | `tokens.css` **and** `TOKEN_COLORS` **and** inline hex (`lm-status-panel.ts:18`, `graph-minimap.ts:132`) | one generated `theme` facade read by CSS, canvas, Three, Chart |
| Event vocabulary | schema variants exist, but UI hardcodes strings; server bridge handles one variant | one `eventCatalog` consumed by bridge, reducers, log, timeline, provenance, narration, tests |
| Field metadata | each panel hand-codes labels, units, ranges | one `fieldCatalog` from schema metadata → forms, axes, columns |
| Lens validation | duplicated in `lens-designer` and `lens-controller`; capability list separate from adapters | one `lensCatalog` + renderer capability matrix |
| Layouts | `layout-registry` vs SpaceGraph plugin names; relayout heuristic triplicated | one `layoutRegistry` + name maps |
| Data presentation | 2 bespoke graph viewports + bespoke telemetry canvas + bespoke history lists; graph/chart/table not interchangeable | one `ViewSpec`/`ViewAdapter` system measuring one dataset many ways |
| Forms | `config-hud`, `lens-designer`, `node-detail-drawer`, `input-hud`, `graph-toolbar` each hand-roll inputs | one `renderField` + primitives |
| Component registration | per-component test API, (absent) story, (absent) gallery entry | `defineSurface` derives all of it |
| Shells | `app-layout` and `spacegraph-app` duplicate the shell | one shell; mode is a view spec |
| ID/sequence | `crypto.randomUUID`, `Math.random`, `Date.now()` | one seeded `idSource` |

### 1.5 Highest-leverage improvements (ordered)

1. Make existing controls work + complete the WS contract (trust in the instrument).
2. **Deterministic fixtures + automated visual validation/gallery first**, so no manual UI testing is required for any later phase.
3. **Establish SSOT registries + a reflective component contract + a unified view host** so every later surface is declared once and rendered everywhere.
4. Widen the event bridge to surface provenance, revision, uncertainty, contradiction, budget.
5. Unify the visual language on generated tokens + primitives; real empty/loading/error states.
6. Canonical real-engine scenarios that grow into autonomous demo episodes.
7. Close 2D/3D parity; make the graph keyboard- and screen-reader-usable.
8. IA + progressive disclosure + command palette + responsive layout.

---

## 2. Principles & architectural pillars

### 2.1 Pillars

- **Single source of truth.** Each concept has exactly one definition, and everything else is derived
  or checked against it: tokens, event vocabulary, field metadata, lens schema, layouts, IDs, scenarios,
  and surface descriptors. Drift is a build failure, not a review catch.
- **Reflection & metaprogramming to minimize boilerplate.** Components, forms, tests, stories, docs,
  gallery cells, and the IA are *generated* from descriptors and registries; adding a surface means
  declaring it, not wiring six files.
- **Descriptors are data.** Views, panels, fields, disclosure levels, and demo episodes are plain
  serializable specs. The URL, the command palette, tests, and demos all address the same specs.
- **Unified views, not parallel ones.** One `ViewSpec` over one dataset renders as graph / chart / table /
  tree / text, full-screen or embedded, by selecting an adapter. Functional redundancy is deleted.
- **Progressive disclosure as a property.** Every descriptor declares `summary · card · detail · raw`;
  the level is state, not bespoke markup.
- **Real over fake.** Surfaces render engine events or server snapshots. Synthetic injectors are test-only.
- **No manual QA gate.** Deterministic fixtures + a visual baseline per surface are acceptance.
- **Accessibility is definition-of-done**, declared in each descriptor and verified automatically.

### 2.2 Guardrails

- Reuse `store`, `GraphRenderer`, `UnifiedGraphProjection`, `RendererApi`, lenses, tokens, Playwright fixtures. No rewrite, no second state system.
- Keep `main` green: `pnpm --dir ui build`, `typecheck`, `test:unit`, and relevant `test:e2e` at each phase boundary.
- Terse syntax, named imports, focused functions, specific error types, no empty catches, no dead code (per `AGENTS.md`).
- **Archive before deleting.** Removing a file/artifact is never a bare `rm`: preserve it path-for-path under `docs/archive/ui-dead-artifacts/`, add an `INDEX.md` entry (why removed, removal commit, last-live revision, restore steps), and exclude it from tooling. Applies to every phase, including 11.5.
- No secrets/logs; no PR/commit unless asked.

---

## 3. Target architecture

### 3.1 SSOT registries

| Registry | Source of truth | Consumed by | Replaces |
|---|---|---|---|
| `theme` | `design-tokens.json` → `tokens.css` + generated runtime facade | CSS, Cytoscape/Three/Chart adapters, primitives | `TOKEN_COLORS`, inline hex, `styles/tokens.ts` |
| `eventCatalog` | `core/src/schemas/*` variants + exhaustive presentation metadata keyed by discriminant | bridge, reducers, event log, timeline, provenance, narration, tests, docs | scattered string literals |
| `fieldCatalog` | zod metadata (`describe`/`meta`) → label, unit, range, kind, format | inspector, config form, lens designer, chart axes, table columns, provenance | per-panel field code |
| `lensCatalog` | `core/src/lens-schema.ts` + renderer capability matrix | controller, generated designer form, modulation compile, adapters | duplicated validation |
| `layoutRegistry` | one registry + per-renderer name maps | 2D/3D viewports, relayout | registry/plugin mismatch; 3 heuristics |
| `idSource` | seeded providers in `util/src/utils/id.ts` | client, projection, tests | `crypto.randomUUID`/`Math.random`/`Date.now` |
| `scenarioCatalog` | one `Scenario` type | server, E2E, gallery, demo runner | hardcoded bootstrap in `agent-server` |
| `surfaceCatalog` | one `SurfaceDescriptor` per surface | shell, gallery matrix, Storybook, a11y/docs, test API | per-component registration |

Enforced by `satisfies` exhaustiveness and guard scripts: adding a token/event/field/schema without
metadata fails the build.

### 3.2 Reflective component contract (minimize boilerplate)

```ts
type SurfaceDescriptor = {
  id: string; title: string; icon: string;
  source: SourceRef;                       // store atom / query
  shapes: Shape[];                         // 'graph'|'series'|'table'|'tree'|'text'
  levels: Record<Disclosure, TemplateFn>;  // summary · card · detail · raw
  budgets: Budget[];                       // 'full'|'embedded'
  interactions: Interaction[]; a11y: A11yMeta; states: StateSlots;
};

defineSurface(descriptor); // wraps @customElement; derives registration, test API, story, gallery cell, docs
```

- `SurfaceComponent` (evolution of `BaseComponent`): declarative `static bindings`, `descriptor`,
  `renderBody`; lifecycle, store wiring, reflection test API, and empty/loading/error slots handled once.
- `renderField(fieldDescriptor, value, onChange)` renders every input (config, lens, inspector, filters);
  no panel hand-codes a control.
- Each surface exposes a reflective `getState/snapshot/interact` API from its descriptor, so Playwright,
  the gallery, Storybook, and docs read one contract.

### 3.3 Unified data views (graph/chart/table/tree — full-screen & embedded)

```ts
type ViewSpec = {
  source: SourceRef; shape: Shape; lens?: LensRef;
  disclosure: Disclosure; budget: Budget;
  interactions: Interaction[];                 // select · filter · zoom · link · highlight
};
interface ViewAdapter { mount(host, spec); update(delta); dispose(); capabilities(): ShapeCaps; }
```

- Adapters: **graph** (wraps the existing 2D/3D `RendererApi`), **series** (chart/sparkline), **table**
  (sortable/filterable/virtualized), **tree** (provenance), **text** (event/log).
- `ViewHost` (`<s-view spec=…>`): resolves the adapter by shape + budget, supplies chrome (title, export,
  fullscreen toggle, shape switcher), container-query sizing, and descriptor-driven empty/loading/error.
- **Full-screen and embedded are the same component** at different budgets: embedded picks compact adapter
  variants (sparkline, key-value, mini-graph, top-N table); full-screen picks full variants. Nothing is
  implemented twice.
- **One dataset → many shapes.** Telemetry = series|table; provenance = tree|table|graph; graph = graph|table;
  config = form|table. The user switches shape in place without losing context.
- **One selection model.** `ViewSelection` flows through the store, so selecting a row highlights the graph,
  clicking a node scrolls the table, and the inspector follows in every context.

### 3.4 Dynamic UI & progressive disclosure as data

- `s-disclosure` renders `descriptor.levels[level]`; a per-surface `disclosure` atom sets the level.
  Embedded defaults to `card`; full-screen defaults to `detail`; `raw` is always one action away; the
  command palette can jump any surface to any level.
- The shell renders zones from `surfaceCatalog`, so IA changes are data, not code.
- Compact graph embedding inherits lens/modulation automatically (same `ViewSpec`, same `lens`).

### 3.5 Target information architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│ Global bar: connection · mode(2D/3D) · lens · shape · search/⌘K · runs │
├───────────────┬───────────────────────────────────────┬───────────────┤
│ LEFT rail     │ CENTER: active view (any shape)        │ RIGHT inspect │
│ surfaces ·    │ graph 2D/3D · timeline · provenance ·  │ fields · prov │
│ runs · lenses │ chat · comparison · events             │ history ·     │
│ · filters     │                                        │ uncertainty · │
│               ├───────────────────────────────────────┤ resources     │
│               │ BOTTOM drawer: embedded views (spark-  │               │
│               │ line · mini-graph · top-N table · log) │               │
└───────────────┴───────────────────────────────────────┴───────────────┘
```

- Addressable: view, shape, lens, filter, selection, time, disclosure level, panels — all in the URL hash.
- Command palette (⌘K) indexes registries reflectively: surfaces, shapes, fields, events, terms, scenarios, actions.
- Empty/loading/error/degraded are descriptor slots with copy, so no surface can omit them.

---

## 4. Delivery phases

Each phase: **Goal · Tasks · Verification · Deliverable.** Task IDs are stable handles.

### Phase 0 — Trustworthy baseline

**Goal:** make every visible control functional or removed; finish the contract. Credibility floor.

- [x] **0.1** Server handlers for `lens.set`, `focus.set`, `object.set`, `node.set`, `lens.define`, `node.history.request`, `sync.request`, wired to projection/engine; validate inbound with `IncomingFromClient.safeParse`, reject with a typed error frame.
- [x] **0.2** Emit `state.snapshot` (graph + working memory + config + seq), `node.history`, `lens.defined`, `telemetry`; monotonic `seqId`, never `Date.now()`.
- [ ] **0.3** Widen the bridge: translate every relevant engine event into projection ops + append-only stream — `derivation.made/accepted`, `belief.added/retracted/revised`, `concept.activated`, `conflict:detected`, `goal.achieved/failed`, `skill.executed`, `atom.derived/retracted`, `proposal.admitted/rejected`, `judgment.resolved`, `budget.exhausted`, `policy.violation`, `task.admitted`. Carry rule/cpuMs/lmCalls/lmTokens/truth; real priority/confidence; emit `update_node` on revision. *(partial: 15 graph-relevant event types wired + provenance fields on the wire; `judgment.resolved`/`budget.exhausted`/`policy.violation`/`egress.gate.rejected`/`shadow.validation.dropped` remain — they need the append-only event stream, see log)*
- [ ] **0.4** Fix dead wiring: implement-or-remove `graph:zoom-in/out|fit|search|pan-to`, `lens:changed`; real config reset; resolve `<export-import>`; add `lm.switch` to the union; fix `focusNode` term/id, `exportSubgraph` scope, `workingMemory` test namespace. *(partial: real `config.reset` + `<export-import>` + `focusTerm`/export/`workingMemory` fixed; 2D+3D zoom/fit/search/pan wired, `lens:changed` removed, `lm.switch` added)*
- [x] **0.5** Transport: derive `wss:`; guard `JSON.parse`; cap/expire offline queue; user-triggered reconnect reset; `/health` + `/ready`; traversal-safe static; gate `/test/*` by env flag while keeping Playwright enabled. *(done: `reconnect()` + queue TTL + socket-identity guards; cap + `/health`/`/ready` + traversal-safe + gate)*
- [x] **0.6** Remove/integrate dead artifacts: `lens-selector.ts`, `core/theme.css`, unused `styles/tokens.ts`, `components/index.ts` barrel, `spacegraph-app.ts`, `src/stories/` cruft; fix Storybook aliases + port drift. *(done: all six removed; standalone `spacegraph/index.html` now mounts `<spacegraph-viewport>`)*
- [x] **0.7** Establish the UI command contract (`build`, `typecheck`, `test:unit`, `test:e2e`, `test:visual`, `storybook`, `build-storybook`, `ui:gallery`). *(done: `test:visual`/`test:visual:update` + `ui:gallery` landed in Session 5; server-inclusive typecheck and runnable `test:e2e` earlier)*

**Verification:** every declared client message round-trips in a test; telemetry/history render non-empty against the real server; no `eventBus` emit lacks a listener; build/typecheck/unit/e2e green.
**Deliverable:** the app stops lying.

### Phase 1 — Determinism & test-hook foundation

**Goal:** reproducible state byte-for-byte — prerequisite for visual validation and demos.

- [x] **1.1** Deterministic reset: `/test/reset` clears engine tasks, projection, seq counter, telemetry, event log, `testState`; `/test/reset-all` for parallel isolation. *(done: projection `reset()`; reset restores the active scenario baseline, reset-all forces bootstrap; `/test/scenarios` + `/test/scenario`)*
- [x] **1.2** Seeded identity/time via `installIdSource`/`sequentialIdSource`; fake clock; remove `Math.random` (reconnect jitter, minimap fallback → deterministic id hashing). *(done: seeded `ids`/`rng`/`clock` in `agent-server`, deterministic backoff + minimap hash)*
- [x] **1.3** Engine control: `/test/step|pause|resume|inject-event`; a `scenario` endpoint loading named belief/proposal sets through the **real** engine (`believe`+`run`; `LM_PROVIDER=mock` proposals). `/test/inject-derivation` stays explicitly synthetic. *(partial: all endpoints + real-engine scenario loading done; mock-LM proposal sets pending)*
- [ ] **1.4** Browser test API parity: `workingMemory.getTerms()`, `store.setState`, `events.recent(filter)`, `graph.getProvenance(id)`, `spacegraph.getEdgeData/clickEdge/setGraphData`, `telemetry.getSeries`. *(partial: `store.setState`, `spacegraph` edge ops, `telemetry.getSeries` done; the `graph` namespace's `getNodeData/clickNode/clickEdge/getEdgeData` argument-forwarding fixed in Session 4 so node/edge specs actually drive the UI; `events.recent`/`graph.getProvenance` blocked on the client event log + provenance, Phases 6.6/6.1)*
- [x] **1.5** `tests/framework/fixtures/scenarios.ts`: typed scenario definitions (beliefs, proposals, steps, invariants) shared by E2E and the gallery. *(done: `@senars/ui/scenarios` catalog + test-side re-export; proposal/invariant fields pending)*
- [x] **1.6** Wire the 14 placeholder specs to real scenarios or delete; tag `@smoke/@critical/@visual`. *(done: Session 4 — all 14 rewritten to scenario/surface-backed assertions and tagged; a few pre-existing red specs surfaced for triage)*

**Verification:** same scenario twice ⇒ identical graph JSON, event seq, pixel-stable screenshot; `fullyParallel` has zero contamination.
**Deliverable:** reproducibility.

### Phase 2 — Automated visual-validation workflow

**Goal:** gallery/contact sheet + regression suite, reviewable at a glance.

- [x] **2.1** `expect.toHaveScreenshot` config: `snapshotPathTemplate` (`visual/baselines/{project}/{arg}{ext}`), `animations:'disabled'`, `caret:'hide'`, `deviceScaleFactor:1`, fixed viewports, tuned thresholds, per-browser scoping, `updateSnapshots:'none'` on CI. *(done: dedicated `tests/visual/playwright.config.ts`, fixed 1440×900, serial, `{arg}-{platform}` template)*
- [x] **2.2** Visual matrix (`tests/visual/matrix.ts`): empty, populated (small/dense), selected, multi-select, edge, loading, error, disconnected, long content, lens designer (valid/invalid), each lens, timeline mid-scrub, telemetry, config (open/dirty), chat (streaming/complete), palette, 2D/3D, breakpoints, high-contrast, reduced-motion. *(partial: 10 curated cells across graph/lenses/responsive/panels/selection; telemetry, 3D, empty/loading/error, palette, multi-select, a11y states remain — Session 5)*
- [x] **2.3** Gallery: `tests/visual/gallery.spec.ts` captures each cell; `ui/scripts/build-gallery.ts` renders `tests/visual/gallery/index.html` with captions, parameters, diff status, links to full images + diff overlays. *(done: cells are captured from `tests/visual/visual.spec.ts`; reporter writes the report; `build-gallery.ts` renders the grouped contact sheet)*
- [x] **2.4** Regression: assert cells vs committed baselines; emit HTML diff + `visual-report.json`; `test:visual` / `test:visual:update`. *(done: baselines committed under `baselines/chromium`; `visual-report.json` + gallery diff links; scripts wired)*
- [ ] **2.5** Storybook repair + coverage: fix aliases; stories for all primitives and feature components with deterministic fixtures; a11y addon; story→Playwright screenshot sweep feeds the same corpus.
- [x] **2.6** CI wrapper: seeds → screenshots → contact sheet → diff report; upload as artifact; fail on missing baseline/threshold. *(partial: `test:visual:ci` runs the suite then builds the gallery, preserving the exit code; artifact upload is a GitHub-workflow concern, not yet wired)*
- [ ] **2.7** Because the matrix is descriptor-derived (§3.2), every later `defineSurface` auto-adds its cells; no manual matrix edits. *(blocked on Phase 3; matrix is hand-curated in Session 5)*

**Verification:** `test:visual` passes clean; contact sheet renders all cells; one broken component ⇒ localized diff.
**Deliverable:** at-a-glance gallery + regression net; **no manual UI auditing.** *(workflow landed; corpus coverage toward this deliverable continues in 2.2/2.5/2.7)*

### Phase 3 — SSOT registries & reflective component core

**Goal:** one source per concept, and a component contract that generates its own wiring, tests, stories, docs.

- [x] **3.1** `theme` facade: generate a runtime reader from `design-tokens.json`; migrate CSS, Cytoscape/Three/Chart adapters off `TOKEN_COLORS`/inline hex; add light + high-contrast sets; token parity test. *(done: `tokens.generated.ts` + `utils/theme.ts`; all `TOKEN_COLORS`/inline-hex consumers migrated; `tokens.css` emits dark/light/high-contrast blocks; `tests/theme.test.ts` parity. Not yet wired to a theme switcher — Session 6)*
- [x] **3.2** `eventCatalog`: presentation metadata keyed exhaustively by event discriminant (label, category, severity, provenance role, shape hints); bridge/reducers/log/timeline/narration read it. *(done: `ui/src/client/utils/event-catalog.ts` covers all 34 discriminants with `satisfies Record<CognitiveEvent['type'], EventMeta>`; `GRAPH_REDUCERS` in `ui/src/server/event-reducers.ts` is catalog-keyed with a parity guard. Client consumers — event log/timeline/provenance/narration — remain, Phases 5.3/6.2/6.6/6.7)*
- [x] **3.3** `fieldCatalog`: derive label/unit/range/kind/format from schema metadata; single reader for forms, axes, columns, provenance. *(done: `ui/src/client/utils/field-catalog.ts` keyed exhaustively off the schema-inferred metric types; telemetry/cognitive/node/truth panels migrated; guard test; config form + provenance fields remain, see log)*
- [x] **3.4** `lensCatalog` + renderer capability matrix; one validation path; generated designer form; adapters declare supported channels. *(done: `ui/src/client/utils/lens-catalog.ts` + `renderer-capabilities.ts`; `LENS_CATALOG` (`satisfies Record<BuiltinLens,…>`), `validateLens`, `CHANNEL_CATALOG`, `SCALE_MAP_CATALOG`; controller/store/layout-registry/designer migrated off duplicated lists; `adapter-2d`/`adapter-3d` declare from the matrix; guard test. Matrix not yet surfaced — see log)*
- [x] **3.5** `layoutRegistry` SSOT with 2D/3D name maps; single `shouldRelayout`; delete the three duplicate heuristics. *(done: `LayoutDefinition.getLayout` + `surface` per-renderer names; `runLayout`/`runSurface`/`surfaceFor`/`surfaceForLens`; one `shouldRelayout`; `GraphRenderer`'s dead copy + `RendererApi.onLayout` removed; 3D layout no-op fixed; guard test. Toolbar option list still hand-listed — see log)*
- [ ] **3.6** `idSource` unification across client/projection/tests.
- [ ] **3.7** `SurfaceComponent` + `defineSurface` + declarative `bindings`; derive registration, reflective test API, empty/loading/error slots.
- [ ] **3.8** `renderField` generic input renderer; migrate `config-hud`, `lens-designer`, `node-detail-drawer`, filters.
- [ ] **3.9** Reflective generators: `defineSurface` emits Storybook params, gallery matrix entries, a11y targets, and docs stubs.
- [ ] **3.10** Guard scripts: exhaustive `satisfies` checks for every registry; CI fails on missing metadata.

**Verification:** adding a token/event/field/schema without metadata fails the build; a new surface needs only a descriptor + `renderBody`; no duplicated validation/heuristics remain.
**Deliverable:** SSOT + reflective core.

### Phase 4 — Unified multi-shape views (full-screen & embedded)

**Goal:** one dataset, many shapes, both contexts — delete the bespoke presentation stack.

- [ ] **4.1** `ViewSpec` + `ViewAdapter` + adapter registry; generalize `RendererApi` into the graph adapter.
- [ ] **4.2** Adapters: graph (wrap existing 2D/3D), series (chart/sparkline), table (sort/filter/virtualize), tree (provenance), text (event/log).
- [ ] **4.3** `ViewHost` (`<s-view>`): adapter resolution by shape+budget, shared chrome (title/export/fullscreen/shape switcher), container-query sizing, descriptor-driven states.
- [ ] **4.4** Compact adapter variants for `embedded` (sparkline, key-value, mini-graph, top-N table) selected by capability.
- [ ] **4.5** Unified `ViewSelection` through the store: cross-shape highlight/link (table row ↔ graph node ↔ inspector).
- [ ] **4.6** Migrate surfaces to views: telemetry→series/table, provenance→tree/table/graph, graph→graph/table, metrics→cards/table, event log→text/table, config→form/table.
- [ ] **4.7** Embed views everywhere: inspector cards, left rail, bottom drawer, chat (inline sparkline/mini-graph/top-N), demo player.
- [ ] **4.8** Matrix coverage for shape × budget × state; determinism + visual baselines for each adapter.

**Verification:** the same dataset renders identically in full-screen and embedded; switching shape preserves selection/lens/time; zero bespoke chart/table/list renderers remain for migrated surfaces.
**Deliverable:** one view system for graphs, charts, tables, and trees, in any context.

### Phase 5 — IA, dynamic composition & discoverability

**Goal:** coherent, self-explaining navigation generated from `surfaceCatalog`.

- [ ] **5.1** Shell (§3.5) composed from descriptors; zones/panels from `$panels` + URL; container-query responsive.
- [ ] **5.2** Command palette (⌘K) indexing registries reflectively (surfaces, shapes, fields, events, terms, scenarios, actions); keyboard-only.
- [ ] **5.3** Global status strip: plain-language reasoning summary + uncertainty + budget; expands via `s-disclosure`.
- [ ] **5.4** Descriptor-driven state slots for every surface: empty (with the populating action), loading, error (retry/report), degraded/offline, long-content virtualization.
- [ ] **5.5** Onboarding/help/glossary generated from `eventCatalog`/`fieldCatalog`/`lensCatalog`; real `/help`.
- [ ] **5.6** Defaults & affordances: per-task default lens/layout/shape/disclosure; keyboard hints; replace `prompt()` with dialogs.

**Verification:** every surface has empty/loading/error baselines; palette covers all actions; URL round-trips exact view + disclosure; no surface can omit a state slot.
**Deliverable:** the app explains itself; no blank/silent/dead screens.

### Phase 6 — Observable reasoning

**Goal:** surface provenance, revision, uncertainty, contradiction, goals, bounded resources — reusing views.

- [ ] **6.1** Inspector 2.0: truth-history series, revision diff, provenance tree (`derivation-records`/`evidenceLineage`), verification status, activation trend — as embedded views.
- [ ] **6.2** Provenance surface: derivation chains with rule ids, `truthFn`, substitutions, `cpuMs/lmCalls/lmTokens`, independence — tree/table/graph subscriptions.
- [ ] **6.3** Contradiction/conflict view: `conflict:detected` pairs, competing beliefs, resolution, explaining lens.
- [ ] **6.4** System 1→2→gate pipeline: `proposal.admitted/rejected`, `judgment.resolved`, `derivation.accepted`, `egress.gate.rejected`, `policy.violation` with verdicts/reasons.
- [ ] **6.5** Resource/uncertainty panel: `ReasoningBudget` vs limits, `TerminationReason`, `budget.exhausted`, and honest forgetting via `belief.retracted`/`atom.retracted`/`shadow.validation.dropped`.
- [ ] **6.6** Event log/stream: filterable append-only timeline with seq + provenance links + export.
- [ ] **6.7** Timeline 2.0: added/revised/retracted/derived discrimination, loop/reset, deterministic speed, synced cursor.

**Verification:** each surface renders asserted content from a real scenario; provenance equals the engine `DerivationRecord` in tests.
**Deliverable:** users can explain *what SeNARS did and why*, at any expertise level.

### Phase 7 — Visual language, responsiveness & accessibility

**Goal:** one consistent, inclusive system across graph, panels, dialogs, timelines, telemetry, SpaceGraph.

- [ ] **7.1** Tokens everywhere (from 3.1) with light/high-contrast; no hardcoded color.
- [ ] **7.2** Primitive consolidation: migrate remaining hand-rolled controls; add dialog, tabs, toast, menu, resizable panel, data-table, sparkline, key-value, timeline track; Storybook variants.
- [ ] **7.3** Focus & keyboard: `FocusTrap` for dialogs/drawers/overlays; roving tabindex for tablists/toolbars; full keyboard graph navigation; palette-first shortcuts.
- [ ] **7.4** ARIA & semantics: labels everywhere; `aria-live` for telemetry/status/chat; canvas text alternatives (hidden table via the table adapter); named icon buttons; announce state changes.
- [ ] **7.5** Motion & contrast: honour `prefers-reduced-motion`; WCAG AA status colors; never color-only meaning.
- [ ] **7.6** Responsive: container-query rail/drawer collapse, wrapping toolbar with overflow menu, touch targets, `ResizeObserver`-driven canvases.
- [ ] **7.7** Automated a11y checks derived from descriptor `a11y` metadata; keyboard-only walkthrough spec; responsive baselines.

**Verification:** a11y checks pass on covered surfaces; keyboard-only walkthrough; responsive baselines; contrast/token tests.
**Deliverable:** a coherent, inclusive visual system.

### Phase 8 — 2D/3D cognitive visualization: parity & polish

**Goal:** 3D is a first-class explorer surface; 2D/3D are interchangeable views of one cognition.

- [ ] **8.1** Layout name maps end-to-end; shared relayout via `layoutRegistry` (from 3.5).
- [ ] **8.2** Channel semantics unified (`size`; documented `z`), `label` in 3D; unsupported channels surfaced by `lensCatalog`.
- [ ] **8.3** 3D interaction parity: selection→inspector, edge selection, context menu, hover, focus/fly-to, pin/hide — all through the shared store/`ViewSelection`.
- [ ] **8.4** Capability filter in 3D; incident-edge handling in 2D.
- [ ] **8.5** Camera/lens viewport continuity (position + orientation per lens); smooth 2D↔3D toggle preserving selection/focus.
- [ ] **8.6** Performance: batched updates, label decimation, unified LOD thresholds, resize handling; frame-budget assertions.

**Verification:** `spatial/parity.spec.ts` asserts behavioural parity in both modes; dense-graph frame baselines.
**Deliverable:** two windows into the same cognition.

### Phase 9 — Chat, LLM & configuration

**Goal:** transparent conversation and trustworthy settings — all rendered through the view/form system.

- [ ] **9.1** Reasoning-transparent chat: answers link to used derivations/provenance; inline System 1→2→gate; streamed answers never clobber input; one HTML sanitization path (marked + DOMPurify) including deltas.
- [ ] **9.2** LM status/switching: real `lm.status`, valid `lm.switch`, in-app confirm; WebLLM bound to real atoms.
- [ ] **9.3** Config 2.0: form from `fieldCatalog`, all categories/types, real dirty-clearing on ack, working reset, non-blocking profiles, working export/import, per-field docs, `config` events in the log.
- [ ] **9.4** Session persistence: save/load/restore surfaced as scenario snapshots.

**Verification:** chat links resolve to provenance; config round-trips with visible events; profile export→import lossless.
**Deliverable:** the conversational surface remains an explorer; settings are trustworthy.

### Phase 10 — Canonical scenarios & Demo/Experiment system

**Goal:** repeatable scenarios driving the **real** engine, growing into autonomous episodes.

- [ ] **10.1** `Scenario` type (id, narrative, seed, engine mode, step plan, invariants, narration) in `scenarioCatalog`, shared by server/E2E/gallery/demo.
- [ ] **10.2** Scenario runner endpoint + Run view: launch/pause/step/replay against the real engine; deterministic seeds; capture screenshots, event transcript, provenance per beat.
- [ ] **10.3** Episode mode: start→beats→conclusion with live real state, narration, pause, exportable transcript; **no fake animation**.
- [ ] **10.4** Implement the five canonical scenarios (§5) with E2E assertions and gallery baselines.
- [ ] **10.5** Demo library UI: browse/preview/replay, inspect provenance, embeddable for educators and app builders.
- [ ] **10.6** ViewSpec-native episodes: each beat sets a `ViewSpec` + disclosure level, so demos reuse the live UI, not a separate player.

**Verification:** each scenario passes end-to-end in CI with gallery output; transcripts contain only real events; same seed ⇒ same episode.
**Deliverable:** a repeatable, transparent demonstration system.

### Phase 11 — Hardening, performance & contribution workflow

**Goal:** maintainable and self-serve.

- [ ] **11.1** Performance: batched store updates, stop cloning whole `Map`s, virtualized lists, telemetry decimation, memoized `getItems`/lens eval, batched filters; budgets in `PerfMonitor`.
- [ ] **11.2** Error taxonomy: specific error types with context, surfaced in log + error boundary; optional client telemetry behind a flag.
- [ ] **11.3** Docs as code: `docs/ui/` — architecture map, registry/descriptor catalog (generated from Storybook), test/visual workflow, scenario authoring; `README.md` stays generated via `docs/readme/*`.
- [ ] **11.4** UI gate: typecheck + unit + scenario seeds + visual regression, wired into `pnpm gates`.
- [ ] **11.5** Remove residual duplication/dead code; keep one source per concept. Every removal is archived (`docs/archive/ui-dead-artifacts/`, §2.2), not deleted outright.

**Verification:** gates clean; a contributor adds a surface (descriptor + `renderBody`) and gets story + gallery + a11y + docs automatically.
**Deliverable:** an evolvable product surface with a self-serve quality loop.

---

## 5. Canonical UI scenarios (real engine)

Each is a `Scenario` (§10.1) with narration, seed, steps, invariants, gallery cells, and an E2E spec.
Presented through `ViewSpec`s, so each maps to concrete shapes/levels.

| ID | Scenario | Drives (real) | Shapes shown | Key invariants |
|----|----------|---------------|--------------|----------------|
| **S1** | Basic derivation | `<bird-->animal>. <robin-->bird>.` + `run` | graph (detail) · provenance tree · table (raw) | conclusion truth matches rule algebra; provenance links both premises |
| **S2** | Conflicting evidence / revision | two competing beliefs for one term | graph · inspector series + revision diff · event table | history shows both revisions; contradiction resolves visibly |
| **S3** | System 1 proposal vs System 2 derivation | `LM_PROVIDER=mock` proposal + judgment + NAL derivation | pipeline view · proposal/gate table · graph | proposal never shown as a conclusion; derivation only after admission |
| **S4** | Provenance / verification | multi-step chain | provenance tree · step table · graph | displayed chain equals `DerivationRecord`; final truth algebraically consistent |
| **S5** | Bounded-resource reasoning | small `maxCycles/maxDepth/maxMemoryOps/maxLMCalls` | budget meters · `budget.exhausted` · forgetting table | termination reason explicit; no silent truncation |

Extension candidates (same machinery): goal lifecycle, skill/tool execution, memory eviction, peer
proposal, MeTTa rewrite, temporal ordering.

---

## 6. Visual-validation system (spec)

- **Determinism:** seeded ids/clock/seq; `/test/reset-all` per capture; seeds loaded through the real engine.
- **Matrix is derived:** `defineSurface` + adapter capabilities emit cells (surface × shape × budget × state × disclosure × breakpoint) into `tests/visual/matrix.ts`; humans curate, not enumerate.
- **Baselines:** committed per browser+platform; `snapshotPathTemplate`; disabled animations; tuned threshold.
- **Gallery:** `tests/visual/gallery/index.html` — one tile per cell with parameters, diff status, and links to full image + overlay; regenerated each run, uploaded as a CI artifact.
- **Storybook:** repaired; deterministic fixtures; a11y addon; story sweep feeds the same corpus.
- **Commands:** `storybook`, `build-storybook`, `test:unit`, `test:e2e`, `test:visual`, `test:visual:update`, `ui:gallery`.
- **Review loop:** a broken component yields a localized diff and a flagged tile.

---

## 7. Demo/Experiment system (spec)

- **Engine-backed beats:** every beat is an engine event or snapshot; the runner owns seed, step plan, capture.
- **ViewSpec-native:** beats set view/shape/disclosure, reusing the live UI.
- **Observable provenance:** each beat records its events, projection delta, and provenance slice; transcripts exportable/replayable.
- **No deception:** narration explains real state; visuals are live views.
- **Deterministic:** scenario + seed ⇒ identical episode, enabling visual regression of demos.
- **Composable:** scenarios are data — educators and app builders author and embed their own.

---

## 8. Definition of done (per phase & program)

- Builds, typechecks, unit + affected E2E pass; `main` stays working.
- Every new/changed surface is a `defineSurface` descriptor with: deterministic fixture, Storybook story, gallery/baseline cell, a11y metadata (or a documented exception).
- No `eventBus` emit without a subscriber; no declared WS message without both handlers; no silent no-op control.
- Every interactive element keyboard-operable and named; every canvas has a text alternative (table adapter).
- Empty/loading/error/degraded slots present and baselined.
- No fake state on a product surface; synthetic injectors test-only and labelled.
- No duplicated concept: color, events, fields, lens validation, layouts, IDs, scenarios each have one source.
- No bare deletions: every removed artifact is archived under `docs/archive/ui-dead-artifacts/` with an index entry (§2.2).
- The gallery reflects the current UI and is reviewable without opening a browser interactively.

---

## Appendix A — Key file map

- Client core: `ui/src/client/core/{store,store-bindings,ws-client,graph-renderer,base-component,events,announcer,focus-trap}.ts`
- New core: `core/{registries,descriptors,views}/*` (theme · eventCatalog · fieldCatalog · lensCatalog · layoutRegistry · idSource · surfaceCatalog · defineSurface · ViewHost/adapters)
- Viewports: `components/graph-viewport.ts`, `spacegraph/spacegraph-viewport.ts`, `utils/adapter-2d.ts`, `spacegraph/adapter-3d.ts`
- Panels: `components/{node-detail-drawer,input-hud,chat-history-panel,config-hud,config-profiles,lens-controller,lens-designer,telemetry-panel,cognitive-metrics,timeline-scrubber,contradiction-badge,connection-banner,error-boundary,lm-status-panel,graph-toolbar,graph-minimap,app-layout}.ts`
- Primitives/styles: `components/primitives/*`, `styles/*`, `design-tokens.json`, `scripts/build-tokens.ts`
- Modulation/lenses: `src/client/modulation/*`, `core/src/lens-schema.ts`, `shared/lens-schema.ts`
- Server/protocol: `ui/src/server/{index,config-schema,UnifiedGraphProjection}.ts`, `core/src/protocol/*`
- Events/budgets: `core/src/schemas/{nar-events,cognitive-events,proposal,derivation-records,reasoning-budget}.ts`, `core/src/budget-{otel,resources}.ts`
- Tests: `ui/tests/framework/*`, `ui/tests/scenarios/*`, `ui/tests/visual/*`, `ui/tests/playwright.config.ts`, `ui/scripts/{agent-server,build-gallery}.ts`
- Storybook: `ui/.storybook/*`, `src/client/**/*.stories.ts`

## Appendix B — Event catalog → surfaces (descriptor-derived)

`eventCatalog` metadata drives these; the table is a view of the registry, not a hand-maintained list.

| Event | Surfaces / shapes |
|---|---|
| `derivation.made`, `derivation.accepted` | graph · provenance tree · event table |
| `belief.added/retracted/revised` | inspector series + diff · forgetting table |
| `conflict:detected` | contradiction view · explaining lens |
| `proposal.admitted/rejected`, `judgment.resolved` | System 1 pipeline · verdict table |
| `budget.exhausted`, `TerminationReason` | resource meters · status strip · degraded state |
| `policy.violation`, `egress.gate.rejected`, `shadow.validation.dropped` | gate/verification view · log |
| `goal.achieved/failed`, `skill.executed`, `tool.request/response` | goal/skill/tool views (extensions) |
| `concept.activated`, `atom.derived/retracted` | graph activity · timeline · memory view |
| `cycle`, `health` | telemetry series · status strip |

## Appendix C — Descriptor & adapter sketches

```ts
type Disclosure = 'summary' | 'card' | 'detail' | 'raw';
type Budget = 'full' | 'embedded';
type Shape = 'graph' | 'series' | 'table' | 'tree' | 'text';

type SourceRef = { atom: TestApiStorePath } | { query: string };
type Interaction = 'select' | 'multi-select' | 'filter' | 'zoom' | 'link' | 'highlight';
type A11yMeta = { role: string; label: string; keyboard: string[]; textAlternative?: Shape };
type StateSlots = { empty: TemplateFn; loading: TemplateFn; error: TemplateFn; degraded?: TemplateFn };

type ViewSelection = { nodes: Set<string>; edges: Set<string>; focus?: string };
```

Graph/chart/table/tree share one selection and one source; the host chooses an adapter by
`(shape, budget)` and the adapter advertises `capabilities()` so the shape switcher only offers
supported shapes and the gallery only emits capturable cells.
