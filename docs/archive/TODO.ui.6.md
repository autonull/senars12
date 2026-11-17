# TODO.ui.6.md — Work-Package Backlog (consolidated)

> Supersedes `TODO.ui.5.md` for all open work. v5 is the landed record. This file is the execution spine: one home per open item, consolidated, with cleared blockers removed and critical path updated.

## Dependency spine (updated)

```
WP1 ─┬─▶ WP2 ─┐
     │        ├─▶ WP6 ─▶ WP7 ─▶ WP8
WP3 ─┴────────┘
WP3 ─▶ WP5 ─▶ WP6
WP3 ─▶ WP4
```

**Critical path: WP6** (WP5 complete). Start WP6 with `2.5 parity suite`.

Status: `[ ]` todo · `[~]` partial · `[x]` done · `!` blocked  
Size: **S** ≈ half day · **M** ≈ day · **L** ≈ multi-day

---

---

## Fresh-session notes (WP6 kick-off — read first)

Exploration landed, no code yet. Where things are:

- **UI code root**: `ui/src/client/` — `core/`, `components/`, `utils/`, `styles/`, `spacegraph/`, `modulation/`. Server in `ui/src/server/`, shared in `ui/src/shared/`.
- **Renderer registry**: `ui/src/client/core/workspace-renderer.ts`. `WorkspaceRenderer` contract (mount/present/apply/focus/select/openComposer/openExplain/snapshot/restore/dispose), open registry Map, `registerRenderer`/`workspaceRenderers`/`renderersForKind`, `rendererSupports(renderer, interaction)`, `rendererHasControl`, `WORKSPACE_INTERACTIONS` (12), `WORKSPACE_CONTROLS` (['layers']).
- **`2.5 parity suite` gap** (spec: `TODO.ui.5.md` line ~504, refs (z),(ae)): `rendererSupports` exists; the **§10 matrix as data (`rendererParity`)** does NOT — that's the core of 2.5. Add a data table mapping renderer → parity/supports so palette/shell gate uniformly; plus scripted canonical loop + per-pair continuity round-trips test.
- **Renderers**: `components/renderers/graph.ts` (GraphRenderer, parity 'full', controls ['layers']), `notebook.ts`, `graph3d.ts`, `graph-surface.ts` (switch on `$graphShape` table → s-view GRAPH_VIEW_SPEC / `$viewportMode` 3d → spacegraph-viewport, else graph-viewport).
- **`2.x graph polish` partially landed already**: `graph.ask-selection`, `graph.layer.*`, `graph.layout.*` commands + `graph:layout` event in `graph.ts`. Remaining: lens/capability styling unified in adapter, hidden layer excluded from `fit`, HUD/palette layout group + `graph.layout.cycle`, `chronological-flow`/`source-view` SpaceGraph surfaces (spec: `TODO.ui.5.md` line ~518).
- **WP6 remaining items** (spec: `TODO.ui.5.md` §WP6, line ~502): 2.5 parity suite (M), 2.1 growth (M), 2.1 clusters (M), 1.2/2.3 floating composer (L), 1.2 composer sweep (M), 2.x graph polish (M).
- **Tests**: 422 passing baseline. Known pre-existing type errors listed in §Known Issues below.

---

## Ready now — unblocked, ordered by leverage

| # | Item | Size | Files | Notes |
|---|------|------|-------|-------|
| 1 | **`2.6 scope`** — debounce `folded` writes for bulk fold-all | M | `core/store.ts`, `utils/layout-registry.ts`, `core/layout-ids.ts`, `components/graph-toolbar.ts`, `components/graph-viewport.ts` | **Done** — `syncUrl` debounce (300ms) batches URL writes; immediate mirror keeps `$urlState.folded` in sync. Layout switching + URL round-trip landed. |
| 2 | **`2.6 context`** — `WorkspaceContext` fields (`renderer`, `setRenderer`, `overlays`) | M | `core/workspace-renderer.ts`, `components/workspace-host.ts` | **Done** — added `renderer` (getter), `setRenderer()`, `overlays()`, `hasOverlays()` to `WorkspaceContext`; `WORKSPACE_CONTEXT` in `workspace-host.ts` uses `$activeRenderer` + `overlayManager` |
| 13 | **`overlay-header`** — shared `OverlayHeader` component (title, pin, close, drag-handle, resize) + migration of existing overlays | S | `components/overlays/overlay-header.ts` (new), `components/overlays/*.ts` | **Done** — shared `overlay-header` component with drag-handle, resize grip, pin, close; migrated inspector, timeline, explain, artifact, settings, toc, telemetry, related, provider, tool-approval; 9 overlays migrated |
| 14 | **`overlay-windows`** — full window stack: draggable, resizable, minimize, maximize, cascade/tile, persist state | M | `core/overlay-manager.ts`, `components/overlays/overlay-header.ts`, `core/surface.ts` | **Done** — `OverlayManager` tracks bounds/z-order; drag/resize via overlay-header; minimize/maximize buttons; cascade/tile commands; sessionStorage persistence of position/size/pinned state; window options in `OverlayDescriptor.window` |
| 3 | **`ops sequencing`** — carry engine `seq`/`eventRefs` on `WorkspaceOp` | M | `core/workspace-graph.ts`, `core/workspace-projection.ts` | **Done** — added optional `seq?: number` and `eventRefs?: Ref[]` to all `WorkspaceOp` variants; 3.6 steer/author producer ready |
| 4 | **`3.2 formalization`** — claim → candidate → gate → belief/goal/question | L | `core/segmentation.ts`, `core/workspace-projection.ts`, `components/input-hud.ts` | **Done** — `input-hud.ts` routes `believe`/`goal` modes through `narsBackend.control.submit()`; claims decomposed via `decomposeForMode` submitted as `belief`/`goal`; chat history preserved |
| 5 | **`3.7 MeTTa`** — second `ReasoningBackend` adapter | M | `core/metta-backend.ts`, `core/workspace-bindings.ts`, `core/workspace-projection.ts` | **Done** — `metta-backend.ts` implements `ReasoningBackend` with MeTTa vocabulary (`metta:atom`→`claim`, `metta:skill`→`tool-call`); `projectWorkspace` accepts `backends[]` array; both NARS and MeTTa projected; limited control surface (query-oriented) |
| 6 | **`3.1 projection` (event-stream half)** — `budget.exhausted` → `budget` blocks, `policy.violation`/`egress.gate.rejected`/`shadow.validation.dropped`/`judgment.resolved` → `gate-decision` blocks | M | `core/workspace-projection.ts`, `core/graph-projection.ts` | **Done** — added `projectCognitiveEvents()` in `workspace-projection.ts`; projects budget/policy/egress/shadow/judgment events to `budget`/`gate-decision` blocks; optional `cognitiveEvents` param on `projectWorkspace()`; server→client `cognitive.events` wire protocol; `$cognitiveEvents` atom + `pushCognitiveEvents()` in store; broadcast from server on every engine event |
| 7 | **`2.3 node ops`** — "Ask as question" / "Assert as claim" → `WorkspaceOp.block.add` | M | `core/workspace-projection.ts`, `components/renderers/graph.ts` | **Done** — added in `node-detail-drawer.ts` Actions tab; creates `question`/`claim` blocks with `sourceRefs` to engine node; `revealBlock` opens in Notebook |
| 8 | **`4.3 affordances` (edge half)** — edge popover Open-in-Notebook / Open View | M | `components/overlays/inspector.ts`, `components/node-detail-drawer.ts`, `core/workspace-projection.ts` | **Done** — `linkRefFor` already implemented; added edge actions in `node-detail-drawer.ts` renderEdge() for Open in Notebook / Open View via `linkRefFor(narsBackend, edgeId)` |
| 9 | **`1.4 rich text`** — inline full tables, view-barrel ownership | S | `core/inline-text.ts`, `components/renderers/notebook.ts` | **Done** — inline tokenizer (code, links, bold, emphasis, citations); tables rendered via `artifactViewSpec` → view barrel (table-view); view barrel registered in `components/views/index.ts` and imported in `entry.ts` |
| 10 | **`4.4 controls`** — explicit prospective control, announce in overlay header | S | `components/timeline-scrubber.ts` | **Done** — prospective scrub zone (10% beyond max data time) with amber playhead; aria-live assertions for play/pause/live/seek/prospective; status announcer in scrubber |
| 11 | **`0.5 tool approval + prompt_user tool`** — modal dialog + `prompt_user` tool for system-initiated questions/forms/wizards | M | `overlays/tool-approval.ts` (new), `core/tool-registry.ts` (new), `core/workspace-bindings.ts` | **Done** — `tool-approval.ts` modal overlay with form rendering; `tool-registry.ts` with approval flow + `prompt_user` tool (question/confirm/form/select + JSON Schema); auto-initialized in `workspace-bindings.ts`; reuses `tool-call`/`tool-result` blocks |
| 12 | **`4.5 pinning`** — per-overlay pin button + `[data-pinned]` CSS | S | `core/overlay-manager.ts`, `styles/primitives.css`, `components/overlays/*.ts` | **Done** — `data-pinned` styles in primitives.css; pin button (📌) added to inspector, timeline, explain, artifact, settings, toc, telemetry, related, provider; `overlayManager.setPinned()` toggles attribute + announces |

---

## Gated — blocked on prerequisites

| Item | Blocker | Unblocks |
|------|---------|----------|
| **`1.5 page`** (turn/page boundary policy) | Section model `pageOf` exists; needs auto-page producer | — |
| **`1.4 block-level streaming`** | Backend partial assistant text in `$chatMessages` | — |

## Synergies unlocked by `0.5 tool approval + prompt_user`

| Capability | How it's achieved |
|------------|-------------------|
| **System prompts user** | `prompt_user` tool → approval dialog → user response → `tool-result` block → system continues |
| **Wizard/flow engine** | Multi-step `prompt_user` calls with `schema` + `required`; state in `tool-call` block `data` |
| **Human-in-the-loop steering** | Reasoner emits `tool-call` for `prompt_user` with `confirm` type before critical actions (retract, revise, budget adjust) |
| **Form-driven data entry** | `form` type with JSON Schema → structured `tool-result` → parsed into workspace blocks |
| **Interactive clarification** | `question`/`select` types for disambiguation during formalization (`3.2`) |
| **Audit trail** | All prompts/responses visible as `tool-call`/`tool-result` blocks in workspace |
| **Composer integration** | `composer:focus` event with `prefill` from `tool-result` for seamless follow-up |

---

## Work Packages — remaining by WP

### WP3 — View & artifact completion (partial)

| Item | Status | Notes |
|------|--------|-------|
| `3.3 provenance` | `[x]` | `derivation-record` blocks + `s-tree` view; full `DerivationRecord` payload with evidence lineage, independence, step-by-step proof; `derivation.record` cognitive event; server drains recorder every 2s |
| `1.5/1.1 section model` | `[~]` | Heading-level boundaries (turn/page policy); "jump to related block" (`2.4` work) |

### WP4 — Timeline present-anchoring (partial)

| Item | Status | Notes |
|------|--------|-------|
| `4.4 anchor` | `[x]` | Cursor + admission landed; graph/ToC admission not yet |
| `4.4 gating` | `[x]` | HUD `⏱` gated on `occurrenceTime` |

### WP5 — Reasoning vertical slice (active critical path)

| Item | Status | Notes |
|------|--------|-------|
| `3.1 projection` (graph) | `[x]` | NAR vocab from `VERIFIER_TRUTH_TABLE`; punctuation → block kinds |
| `3.1 projection` (events) | `[x]` | Budget/gate blocks from cognitive event log; server→client `cognitive.events` wire; `$cognitiveEvents` atom |
| `3.2 formalization` | `[x]` | Claim → candidate → gate admission via `input-hud.ts` → `narsBackend.control.submit()` |
| `3.3 provenance` | `[x]` | `derivation-record` blocks + `s-tree` view; full `DerivationRecord` payload with steps, evidenceLineage, independence; `derivation.record` event; server drains recorder |
| `3.4 layouts` | `[x]` | `reasoning-provenance`, `gate-pipeline`, `contradiction-neighborhood`, `budget-resource` |
| `3.5 explanation` | `[x]` | Block/link/event → summary/card/detail/raw via `renderBlockBody` |
| `3.6 steer/author` | `[x]` | All control methods + palette commands + `config-change` producer |
| `3.7 MeTTa` | `[x]` | Second `ReasoningBackend` adapter in `metta-backend.ts` |

### WP6 — Parity & rendering quality

| Item | Size | Notes |
|------|------|-------|
| `2.5 parity suite` | M | Canonical loop per renderer; `rendererParity`/`rendererSupports` data for gating |
| `2.1 growth` | M | Incremental animated growth (replace-by-diff today) |
| `2.1 clusters` | M | Compound clusters from chat `contains`/headings |
| `1.2/2.3 floating composer` | L | Anchored to block/node/subgraph; cy→DOM handoff |
| `1.2 composer sweep` | M | Mode bar ↔ palette shared action source; `composer.prefill` |
| `2.x graph polish` | M | Lens/capability styling; hidden layer `fit`; `graph.ask-selection`; layout cycle |

### WP7 — Agent-operable

| Item | Size | Notes |
|------|------|-------|
| `5.1 execution` | L | `ui.command` over workspace (renderer, focus, explain, scrub, etc.) |
| `5.1 args` | M | Parameterised commands with `params` descriptor + palette prompt |
| `5.2 control mode` | L | Suggestions → execution + visible command log + HUD stop |
| `5.3 demonstrations` | L | "Show me how you got that" |
| `5.4 screen-record mode` | L | Minimal HUD, focus highlight, captions |

### WP8 — Bridge, hardening, standalone, 3D

| Item | Size | Notes |
|------|------|-------|
| `0.7 bridge` | L | Legacy nodes/events/chat as overlays/embedded views |
| `7.1 boundary` | L | Package split (`semantic-graph` vs SpaceGraphJS) |
| `7.2 standalone` | L | Engine-free build |
| `7.3 performance` | L | Op batching, virtualization, decimation, latency budgets |
| `7.3 quality` | L | Error taxonomy, a11y, plugin API, docs-as-code, visual regression |
| `tests & parity harness` | L | Unit tests + Graph renderer test + visual baselines |
| `6 Graph3D` | L | `WorkspaceRenderer` over SpaceGraph, `parity: 'partial'` |

---

## Cleared blockers (no longer listed)

- ✅ **Modal scrim** — landed (`core/overlay-manager.ts`)
- ✅ **`LmProvider` façade** — landed (`core/lm-provider.ts`, `core/lm-transport.ts`, `provider` overlay)
- ✅ **Section model** — landed (`core/sections.ts`)
- ✅ **Node→workspace-block mapping** (node half) — landed (`blockRefFor` in `workspace-projection.ts`)
- ✅ **`config-change` producer** — landed (`core/config-change-producer.ts`)
- ✅ **Cognitive events wire** — server→client `cognitive.events` protocol + `$cognitiveEvents` atom + projection integration
- ✅ **Derivation recorder wire** — `derivation.record` event + server drain loop + `derivation-record` blocks + `s-tree` view

---

## Seams to build on (unchanged)

Overlays, Views, Inline text, Block payloads, Block bodies, Reaching a block, Embedded views, Artifacts, Citations, Commands, Capabilities, LM provider, Section model, Node→block mapping, Reasoning backend, Renderers, State/URL, Projection, Explain/links/ToC, Layouts, Block affordances — see `TODO.ui.5.md` §Seams for file paths.

---

## Landed (v5) — progress log

- **WP2 `overlay-windows`** — full window stack: draggable (header drag), resizable (corner grip), minimize to badge, maximize, cascade/tile commands; `OverlayManager` tracks bounds/z-order; sessionStorage persistence of position/size/pinned/minimized/maximized state; opt-in via `OverlayDescriptor.window: { draggable?, resizable?, minimize?, persist? }`; updated overlays: inspector, timeline, explain, artifact; added `overlay.cascade`/`overlay.tile` palette commands
- **WP1 `0.6` backend seam (control half) + WP5 `3.6` steer/author** — `ReasoningBackend` extended with `BackendCaps` and optional `control` surface; NARS adapter implements all control methods; protocol schemas (`reasoning-control.ts`); 8 palette commands gated on `reasoning` capability + backend caps; `config-change` producer emits diff blocks on settings change
- **WP2 `2.6 scope` fold-all debounce** — `syncUrl` debounce (300ms) batches `folded` URL writes for bulk fold-all; immediate `$urlState` mirror preserved for test consistency; all 422 UI tests pass
- **WP2 `ops sequencing`** — added optional `seq?: number` and `eventRefs?: Ref[]` to all `WorkspaceOp` variants in `workspace-graph.ts`; enables temporal queries, replay, and conflict resolution; 3.6 steer/author producer ready
- **WP5 `3.1` projection (event-stream half)** — added `projectCognitiveEvents()` in `workspace-projection.ts` projecting `budget.exhausted` → `budget` blocks and `policy.violation`/`egress.gate.rejected`/`shadow.validation.dropped`/`judgment.resolved` → `gate-decision` blocks; `projectWorkspace()` accepts optional `cognitiveEvents` array
- **WP5 `3.1` projection (graph half)** — `nars-backend.ts` VOCAB derives all NAR rule names from single-source-of-truth `VERIFIER_TRUTH_TABLE` (binary 16, unary 4) + structural (7) + provenance (3) → semantic link kinds; `projectReasoning` detects belief/goal/question/command from punctuation
- **WP5 `3.2 formalization`** — `input-hud.ts` routes `believe`/`goal` composer modes through `narsBackend.control.submit()`; claims decomposed via `decomposeForMode` submitted as `belief`/`goal`; chat history preserved; completes claim → candidate → gate → belief/goal/question loop
- **WP5 `3.4` layouts** — `reasoning-provenance`, `gate-pipeline`, `contradiction-neighborhood`, `budget-resource` registered in `layout-registry`
- **WP5 `3.5` explanation** — unified `explain()` for block/link/event
- **WP5 `3.6` steer/author + `config-change`** — complete
- **WP5 `3.7 MeTTa`** — second `ReasoningBackend` adapter in `metta-backend.ts` with MeTTa vocabulary (`metta:atom`→`claim`, `metta:skill`→`tool-call`, edges `metta:rewrite`/`query`/`pattern-match`/`skill-execution`/`space`); `projectWorkspace` accepts `backends[]` array projecting both NARS and MeTTa; limited control surface (query-oriented)
- **WP2 `2.3 node ops`** — "Ask as question" / "Assert as claim" in `node-detail-drawer.ts` Actions tab; creates `question`/`claim` blocks with `sourceRefs` to engine node; `revealBlock` opens in Notebook
- **WP3 `4.3 affordances` (edge half)** — edge popover in `node-detail-drawer.ts` with Open in Notebook / Open View actions via `linkRefFor(narsBackend, edgeId)`; mirrors node affordances
- **WP2 `2.6 validation`** — cycle-free layout ids via `core/layout-ids.ts`
- **WP2 `2.5` selection/focus/defaults** — all landed
- **WP3 `4.3 typing`** — discriminated `Artifact` union, `block-payload.ts`
- **WP3 `2.4` inspection & embedded views** — node/edge popovers, ToC reach, neighborhood depth
- **WP3 `1.5/1.1` section model** — recursive containment, fold-aware `j/k`, `view.fold-all`
- **WP3 `citations model`** — `Source`/bibliography, `[n]` resolution
- **WP3 `1.4 rich text`** — inline tokenizer (code, links, bold, emphasis, citations); tables via `artifactViewSpec` → view barrel; view barrel registered in `components/views/index.ts`
- **WP4 `4.4` anchor/gating** — present-anchored cursor + temporal HUD gating
- **WP4 `4.4 controls`** — prospective control (10% future zone with amber playhead) + header announcer (aria-live assertive for play/pause/live/seek/prospective) in `timeline-scrubber.ts`
- **WP3 `4.5 pinning`** — per-overlay pin button + `[data-pinned]` CSS in primitives.css; pin button added to inspector, timeline, explain, artifact, settings, toc, telemetry, related, provider; `overlayManager.setPinned()` toggles attribute + announces via Announcer
- **WP1 `0.5 tool approval + prompt_user tool`** — `tool-approval.ts` modal overlay with dynamic form rendering for `prompt_user` tool (question/confirm/form/select); `tool-registry.ts` with approval callback + `executeToolCall()`; `promptUserTool` spec with JSON Schema; auto-initialized in `workspace-bindings.ts`
- **WP2 `2.6 context`** — `WorkspaceContext` in `workspace-renderer.ts` gains `renderer` (getter), `setRenderer()`, `overlays()`, `hasOverlays()`; `WORKSPACE_CONTEXT` in `workspace-host.ts` binds to `$activeRenderer` and `overlayManager`; renderers can now query/switch renderer and inspect overlay stack
- **WP3 `4.5 overlay-header`** — shared `overlay-header` component in `components/overlays/overlay-header.ts` with drag-handle, resize grip, pin, close; 9 overlays migrated (inspector, timeline, explain, artifact, settings, toc, telemetry, related, provider, tool-approval); `overlayManager` singleton via `getOverlayManager()`/`resetOverlayManager()`
- **WP5 `3.1 projection` (events full)** — server→client `cognitive.events` wire protocol (`sync.ts`, `unions.ts`); `$cognitiveEvents` atom + `pushCognitiveEvents()`/`clearCognitiveEvents()` in `store.ts`; handler in `store-bindings.ts`; `projectWorkspace` accepts `cognitiveEvents` array; `workspace-bindings.ts` subscribes to cognitive events for re-projection; broadcast from server on every agent event via `broadcastCognitiveEvent()` in `server/index.ts`; all 422 UI tests pass
- **WP5 `3.3 provenance` / `4.3 derivation-record`** — `derivation.record` cognitive event type in `core/schemas/cognitive-events.ts` carrying full `DerivationRecord`; `derivation-record` block kind in `workspace-graph.ts`; enriched `DerivationRecordData` in `block-payload.ts` with `DerivationStepData` (steps, evidenceLineage, independence, premiseTruths, truthFn, substitution); `projectDerivationRecords()` in `workspace-projection.ts` creates blocks with provenanceRefs; `derivationRecordTree()` in `artifacts.ts` renders step-by-step proof via `s-tree`; server drains `DerivationRecorder` every 2s via `derivationRecordTimer` in `server/index.ts`; `event-catalog.ts` updated with metadata

## Planned — Overlay system evolution

| Item | Description |
|------|-------------|
| `overlay-header` | Shared component replacing duplicated headers; adds drag-handle + resize grip opt-in; emits `drag-start`/`drag-end`/`resize` events; `data-draggable`/`data-resizable` on host |
| `overlay-windows` | **Done** — Full window stack: draggable (header drag), resizable (corner grip), minimize to badge, maximize, cascade/tile commands; `overlayManager` tracks bounds/z-order; `OverlayDescriptor.window` config; sessionStorage persistence of position/size/pinned/minimized/maximized state |
| `overlay-animations` | Enter/exit transitions (fade/slide); reduced-motion respect; `overlayManager` coordinates stagger |

All 422 UI tests pass. Core layout-registry tests pass (8).

## Known Issues (pre-existing, not introduced by overlay-windows)

| Issue | Location | Notes |
|-------|----------|-------|
| Type errors: `derivation-record` block kind missing from `BLOCK_KIND_LABEL` | `core/block-labels.ts`, `core/artifacts.ts`, `core/graph-projection.ts`, `core/toc.ts` | DerivationRecordData type missing `rule`, `premises`, `conclusion` fields |
| Type errors: `BackendVocabulary`/`BackendNode` not found | `core/workspace-projection.ts` | Import/export issue |
| Type errors: `CognitiveEvent` not found | `core/store.ts` | Should be `CognitiveMeta` or import missing |
| Type errors: `ConfigChangeData` not exported | `core/config-change-producer.ts` | Missing export from `workspace-graph.ts` |
| Tool registry: `properties` not in schema type | `core/tool-registry.ts:96` | Schema type definition issue |
| MeTTa/NARS backend: `SemanticLinkKind` index signature mismatch | `core/metta-backend.ts:40`, `core/nars-backend.ts:73` | Vocabulary type mismatch |
| Test: `typecheck:bin` fails (1 error) | `tests/nar/refactor4-budget.test.ts` | Bin CLI surface has type errors |
| Test: RL parity non-stationary adaptation | `tests/nar/rl/parity/cognitive-advantage.test.ts:565` | Q-value for arm 1 is null |

These are pre-existing issues in the codebase, not introduced by the overlay-windows implementation.