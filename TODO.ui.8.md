# TODO.ui.8.md — A Product-Grade Cognitive UI (execution spine)

> **Relationship.** Supersedes `TODO.ui.7.md` for all open work. v7 is the landed record: **P0** (green
> typecheck) and **P1** (the visual contract) are complete. This file reframes what remains around two
> axes v7 left implicit — **capability** (what a user can do) and a **quality bar** (how the UI is
> built) — and treats the visual contract as a standing invariant, not a phase.
> Stable id tags (`2.x`, `5.x`, `7.x`) are kept so old provenance still resolves.

## The two axes

**Capability** — the end-to-end session a non-developer can complete without tooling (carried from v7):
open & connect · converse · see · inspect · steer · navigate · operate by keyboard.

**Quality bar** — the property each capability must satisfy. This is the part v7 named in prose and
v8 makes testable; every item below is accepted by *how it is built*, not only what it does.

| Quality | Concrete, testable property |
|---|---|
| **Complete** | Every screen, state and scenario has a committed gallery cell; no surface can be registered without one (already enforced via `visual-coverage.test.ts`). |
| **Functional** | Engine-emitted `ui.command` drives the UI; control mode and demonstrations run through the same command registry as the palette (`core/commands.ts:282`, `core/ws-client.ts:170`). |
| **Usable / ergonomic** | The composer is summonable in context; the palette is argument-aware and keyboard-complete; a blind run of one task needs no mouse. |
| **Flexible / modular** | A new surface/renderer/lens/command/view-adapter/layout is added by `register*` of a **descriptor** — no shell edit — and the gallery cell, story, a11y target and doc stub are generated from it (`core/surface-codegen.ts`, `core/surface-registry.ts`). |
| **Configurable** | One typed UI config (theme, density, motion, default renderer/lens/layout, panels, provider, budgets), schema-validated, persisted, URL-addressable, edited from Settings, import/exportable. |
| **Adaptable** | Dark **and** light themes, density, responsive breakpoints, honored `prefers-reduced-motion`, and graceful degradation to an engine-free build (`core/capabilities.ts`, `core/store.ts:249`). |
| **Maintainable** | A typed error taxonomy surfaced per surface; performance budgets asserted in tests; surfaces documented from data; `ui:verify` is the one gate. |

## Gates (must stay green)

| Gate | Command | Guards |
|---|---|---|
| Types | `pnpm --dir ui typecheck` | compile-time invariants |
| Units | `pnpm --dir ui test:unit` | projection, registries, commands, coverage |
| Behaviour | `pnpm --dir ui test:e2e` | real boot path scenarios (offline LM, O5) |
| Visual | `pnpm --dir ui test:visual:ci` | baselines + `ui:gallery` contact sheet |
| **One command** | `pnpm ui:verify` | typecheck + unit + visual:ci + gallery |

CI/GitHub stays off (O4). `pnpm ui:gate` remains the fast type+unit gate.

## Dependency spine

```
P2 ─▶ P3 ─▶ P4
   ╲    ╲    ╲
    X    C    A     (cross-cutting: pull into whichever phase needs it;
    ╲    ╲    ╱      M is the invariant that ends every item)
      M  M  M
```

- **P2 Interaction & rendering quality** — make the live surface feel live and ergonomic.
- **P3 Control & narration** — the functional leap: the engine, not just the human, drives the UI.
- **P4 Productization** — bridge, standalone, performance, error taxonomy.
- **X Extensibility · C Configurability · A Adaptability · M Maintainability** — cross-cutting
  workstreams; an item in P2–P4 should also advance the axis it touches (e.g. the composer is X+C+ergonomics).

---

## P2 — Interaction & rendering quality (M×5)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| 2.1 | **Incremental growth** — animate new workspace blocks in (replace today's replace-by-diff), no full relayout. **Implemented**: `GraphRenderer.present()` computes diff via `workspace-diff.ts` and emits `WorkspaceOp` stream; `applyWorkspaceOps` in `graph-viewport.ts:778` animates enter/exit/move. | ✅ Done | `core/workspace-diff.ts`, `components/renderers/graph.ts:78-97`, `components/graph-viewport.ts:778-859` | `present` computes diff → emits enter/exit/move ops; `apply` animates each op; still cell stable; motion cell shows FLIP/GSAP |
| 2.2 | **Chat clusters** — compound clusters from `contains`/headings; set `children` on turns. **Implemented**: `isContainer` in `graph-projection.ts` treats `turn` blocks with children as compound parents; `syncWorkspaceLayer` in `graph-viewport.ts` handles fold state via `$collapsedBlocks`; block menu has Collapse/Expand action; double-click on cluster node toggles fold. | ✅ Done | `core/graph-projection.ts:49-50`, `components/graph-viewport.ts:884-940`, `components/overlays/block-menu.ts:68-78` | multi-turn chat collapses into cluster cell; fold/unfold in notebook; graph shows cluster as single node with expand affordance |
| 2.3 | **Floating composer** — anchored to block/node/subgraph; summoned, not persistent; cy→DOM handoff; capability-gated modes. **Implemented** in `composer-focus.ts`. | ✅ Done | `components/composer-focus.ts`, `core/composer-modes.ts`, `core/events.ts` | composer opens anchored to selection; mode bar reflects `availableComposerModes($capabilities)`; prefill from `tool-result`; cell in gallery |
| 2.4 | **Composer sweep** — mode bar ↔ palette share one action source; `composer.prefill`; per-segment preview; guard `decomposeInput` over-splitting; `ComposerFocus` extracted. | 🟡 Partial | `components/composer-focus.ts`, `components/input-hud.ts`, `core/input-decomposition.ts:30-47`, `core/commands.ts` | one action source (mode bar = palette subset); prefill from `tool-result` block; decimal/abbrev safe in `isFaithfulDecomposition` |
| 2.5 | **Graph polish** — unify lens/capability styling; exclude hidden layer from `fit`; bind `graph.ask-selection` (`a`); HUD/palette layout group + `graph.layout.cycle`; register `chronological-flow`/`source-view` SpaceGraph surfaces. | ⬜ Not started | `components/renderers/graph.ts`, `core/graph-layer.ts`, `core/workspace-renderer.ts` | hidden layer not fitted; layout cycle reachable via palette; `graph.ask-selection` (`a`) opens composer with selection refs; new surfaces get cells |
| 2.6 | **Motion capture support** (O8) — let the harness snapshot a settled frame of an interaction (or a storyboard strip), so animation is contract-tested. | ⬜ Not started (O8) | `tests/visual/reporter.ts`, `tests/visual/matrix.ts`, `scripts/build-gallery.ts` | one motion item captured deterministically; storyboard strip support; gallery shows motion cells |

---

## P3 — Control & narration (M/L)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| 3.1 | **`5.1 execution`** — `ui.command` over the workspace (renderer, focus, explain, highlight, ToC/search, artifact, embed, compose, narrate, scrub); round-trip through `applyServerMessage`; visible in timeline/telemetry. **Implemented**: `dispatchCommand` in `commands.ts:293`. | ✅ Done | `core/commands.ts:267-313`, `core/ws-client.ts:170-174`, `core/store-bindings.ts` | engine-emitted command drives UI; one round-trip test + cell; timeline shows command log |
| 3.2 | **`5.1 args`** — parameterised commands with `params` descriptor; type-checked args; `available()`-aware palette badge. **Implemented**: Zod schemas in `command-schemas.ts`. | ✅ Done | `core/command-schemas.ts`, `core/commands.ts:49-52`, `components/overlays/palette.ts` | palette prompts for args (Zod schema); invalid args rejected with context; badge shows `available()` state; OpenAPI-compatible descriptors for agent `ui.command` |
| 3.3 | **`5.2 control mode`** — off → suggestions; on → execution + visible command log + HUD **stop**; budget/stop in HUD. Toggle observable; stop button needs wiring to engine `abort` signal. | ⬜ Not started | `components/workspace-hud.ts`, `core/commands.ts:180-274`, `core/nars-backend.ts` | toggle observable in HUD; stop halts in-flight run (`reasoning.step`/`run`); budget/stop visible; cell |
| 3.4 | **`5.3 demonstrations`** — "show me how you got that" switches renderers, focuses refs, opens provenance, narrates. Narrative sequence scriptable via command chaining. | ⬜ Not started | `core/commands.ts`, `core/workspace-renderer.ts:88-89` | one narrative sequence scripted + cell; demo command chains renderer switch → focus → explain → provenance |

---

## P4 — Productization ✅ COMPLETE

| # | Item | Files | Acceptance |
|---|------|-------|------------|
| 4.1 | **`0.7 bridge`** — legacy nodes/events/chat as overlays/embedded views; ViewSpec adapters usable in overlays. Overlay/ViewSpec infrastructure exists (`core/view-adapter.ts`, `core/overlay-registry.ts`). | `components/overlays/*`, `components/views/*`, `core/view-spec.ts` | legacy surfaces reachable as overlays/embedded views; cells for each; ViewSpec adapters work in overlay host. ✅ Done |
| 4.2 | **`7.2 standalone`** — engine-free build (LM provider + segmentation + semantic links + Notebook/Graph), no NARS backend (O3). `capabilityGate` drives degradation (`capabilities.ts:66`). | `build config`, `src/client/entry.ts`, `core/capabilities.ts:74-75` | UI runs engine-free; a smoke cell; only `language`/`tools`/`memory` capabilities active; no dead affordances. ✅ Done |
| 4.3 | `renderer:graph3d` — deferred (O6) | `components/renderers/graph3d.ts` | last `KNOWN_GAPS` entry closes (`tests/components/visual-coverage.test.ts:20`). |
| 4.4 | **`7.3 performance`** — Done: Created `performance-budget.ts` with `PerformanceBudgetTracker`, op batching (`batched`), virtualization (`virtualize`), decimation (`decimate`), shared `AdjacencyIndex`, `MemoCache`. Added assertions to `projectWorkspace`, `projectChat`, `projectReasoning`, `projectCognitiveEvents`, `projectDerivationRecords` via `perfTracker.assertProjection`. | `core/performance-budget.ts`, `core/workspace-projection.ts` | budgets tracked per projection; `PerformanceBudget` per surface; `test:visual:ci` can assert budgets. |
| 4.5 | **Error taxonomy** — Done: Created `error-taxonomy.ts` with 16 typed error classes (ConnectionError, ConfigError, EngineError, BudgetExhaustedError, GateRejectedError, ProjectionError, GraphRenderError, LayoutError, CommandError, StorageError, NetworkError, etc.) each with `code`, `surface`, `severity`, `recoverable`, and `getRecoveryActions()`. Updated `error-boundary.ts` to render typed errors with per-class recovery affordances (Retry, Reload, Open Settings, Open Palette, View Details, Report Bug, Dismiss). | `core/error-taxonomy.ts`, `components/error-boundary.ts`, `core/events.ts` | each error class has a captured state; recovery affordances per error class; error boundary renders appropriately. |

---

## Cross-cutting workstreams

### X — Extensibility (the modularity backbone)

The registries already exist (`surface`, `overlay`, `view-adapter`, layout ids, renderer, panel, lens,
commands). v8 closes the loop from **registration → contract → docs** so extension is data, not surgery.

| # | Item | Acceptance |
|---|------|------------|
| X.1 | **Unified descriptor + validation** — one `registerContribution`-shaped contract over the existing registries; boot-time validation (unique ids, resolvable tags, declared bindings); a bad contribution fails loud. `ContributionValidator` runs at boot; unit test registers invalid contribution → expects failure. | registering an unknown shape/tag fails a unit test; all registries validated at boot. ✅ Done |
| X.2 | **Wire `surface-codegen` into the matrix** — generate the base gallery cell from `SurfaceDescriptor`, keep hand-curated cells as overrides. `generateSurfaces` exists (`core/surface-codegen.ts:78`). | adding a surface updates coverage without editing `VISUAL_CELLS`; hand-curated cells remain as overrides. ✅ Done |
| X.3 | **Docs-as-code for surfaces** — emit the surface reference from descriptors (feeding `docs/readme/ui-gallery.md`). `surfaceDoc` generator exists (`core/surface-codegen.ts:69`). | a surface with no generated doc stub fails a check; `docs/readme/ui-gallery.md` auto-generated. ✅ Done |
| X.4 | **Plugin contribution point** — a `plugins.ts` seam where a module contributes surfaces/commands/lenses; contains no shell edits. In-repo contribution point (not full third-party loader per O11). | one demo plugin registered and captured; contributes surface + command + lens. ✅ Done |

### C — Configurability ✅ COMPLETE

| # | Item | Status | Acceptance |
|---|------|--------|------------|
| C.1 | **Typed UI config** — one Zod schema (theme, density, motion, default renderer/lens/layout, panels, provider, budgets), defaults + validation. Drives Settings + URL + Profiles. | ✅ Done | invalid config rejected; typecheck covers it; schema is single source of truth |
| C.2 | **Persistence + URL** — persist to `localStorage`, mirror the URL-addressable slice, hydrate on boot (extends `hydrateFromUrl` in `store.ts:573`). | ✅ Done | deep link restores the workspace; cell; round-trip survives reload |
| C.3 | **Settings-driven** — Settings renders from the config schema, not hand-written fields (`components/overlays/settings.ts:31` uses `config-hud`). | ✅ Done | a new option needs no Settings markup edit; form generated from schema |
| C.4 | **Profiles + import/export** — named profiles over `config-profiles.ts`, copy/paste JSON. | ✅ Done | switch profile restores a workspace; cell; import/export round-trips |

### A — Adaptability ✅ COMPLETE

| # | Item | Acceptance |
|---|------|------------|
| A.1 | **Light theme** — generate `light` tokens alongside `dark`; `setTheme` already reflects `data-theme` (`store.ts:249` detects `prefers-color-scheme`). | a `state-light` cell; all surfaces legible; tokens generated via `scripts/build-tokens.ts`. ✅ Done |
| A.2 | **Density** — comfortable/compact spacing via tokens. | a `state-compact` cell; density token affects all spacing. ✅ Done |
| A.3 | **Reduced motion honored end-to-end** — animations gate on `matchMedia('(prefers-reduced-motion)')` (`store.ts:254` reads it into `View.flags`). | motion items (2.1/2.6) no-op under reduce; test; `View.flags.reducedMotion` gates all animations. ✅ Done |
| A.4 | **Responsive contract** — breakpoints documented and captured (narrow/medium/wide). Narrow cell exists (`matrix.ts:659`). | cells at 640/1024/1920; breakpoints documented in `docs/readme/ui-gallery.md`. ✅ Done |
| A.5 | **Standalone degradation** — capabilities (`capabilities.ts`) drive what renders when the engine is absent; no dead affordances. | engine-free cell shows only supported surfaces; capability-gated UI hidden. ✅ Done |

### M — Maintainability (the invariant every item ends on)

- **Every new surface/state/scenario ends with a committed cell** (the P1 contract already enforces this via `visual-coverage.test.ts`).
- **Every cross-cutting axis** ends with a contract test (config round-trip, theme switch, plugin load).
- **Budgets** (P4.4) are asserted, not aspirational — `PerformanceBudget` in visual tests.
- **`ui:verify` is the one gate**; a red `typecheck`/coverage/baseline blocks a commit (O9/O10).

---

## Newly surfaced (this session) — do early, they unblock cleanly

| # | Item | Why | Acceptance | Status |
|---|------|-----|------------|--------|
| N.1 | **Drain the derivation recorder in `/test/pause`** | The server's 2s recorder timer outlives `pause()`, forcing a 2.2s "quiet window" in every engine-free cell (`matrix.ts:203`). | quiet-window removed from `matrix.ts`; suite still green; `waitForTimeout(2200)` eliminated. | ✅ Done |
| N.2 | **Replace fixtures with real scenarios** | `metta`/`budget-gate` and the view cells are seeded from client stores; make the block kinds seedable server-side. | cells load through the real engine path; higher fidelity; fixtures removed. | ✅ Done (metta/budget-gate) |
| N.3 | **Codegen the base cells** (see X.2) | `VISUAL_CELLS` is hand-curated; registration should imply a cell. | coverage grows with registration; `scripts/generate-visual-cells.ts` creates base cells from `getSurfaces()`. | ✅ Done |

---

## Architectural Recommendations (from codebase review)

These are implementation patterns to follow, not separate TODO items:

| Rec | Description | Related Items |
|-----|-------------|---------------|
| **R1** | Extract `ComposerFocus` as first-class component for anchor resolution, capability-gated modes, prefill, cy→DOM handoff. | P2.3, P2.4 |
| **R2** | Unify command `parse`/`available` with Zod schemas → type-safe args, auto palette prompting, OpenAPI descriptors. | P3.2, X.1 |
| **R3** | Make `WorkspaceRenderer.present/apply` non-no-op for animation: `present` computes diff → emits ops; `apply` animates (GSAP/FLIP). | P2.1 |
| **R4** | Add `ContributionValidator` for boot-time registry validation (unique ids, resolvable tags, bindings, capability mismatches). | X.1 |
| **R5** | Implement `ConfigSchema` (Zod) as single source driving Settings + URL + Profiles; form generated from schema. | C.1–C.4 |
| **R6** | Add `PerformanceBudget` assertions to visual tests; regression blocks commit. | P4.4, M |
| **R7** | Create `ErrorTaxonomy` with per-surface error classes + recovery affordances in error boundary. | P4.5 |
| **R8** | Wire `surface-codegen` → `VISUAL_CELLS` generation; hand-curated cells as overrides. | X.2, N.3 |

---

## Current State (from architecture review)

### What's Working (Green)
- **Registry-driven architecture**: 7 registries (surface, overlay, renderer, command, lens, layout, view-adapter) — all data-driven, no shell edits for extensions
- **Workspace substrate**: `WorkspaceGraph` (blocks + links + roots) — pure, deterministic projection in `core/workspace-projection.ts`
- **Command system**: Single registry (`core/commands.ts`), palette + agent `ui.command` share source, `parse`/`available` for args + Zod schemas (`core/command-schemas.ts`)
- **Visual contract**: `VISUAL_CELLS` + coverage test (`visual-coverage.test.ts`) + gallery generator (`scripts/build-gallery.ts`) — 51/51 cells
- **Config/URL**: Unified `UiConfigSchema` (Zod), `localStorage` persistence, URL mirroring, Settings generated from schema, Profiles import/export — `core/config-schema.ts`, `core/store.ts`
- **Capabilities**: 5 capabilities gate modes/overlays/commands/renderer default — `core/capabilities.ts`
- **Testing gates**: `ui:verify` = typecheck + unit + visual:ci + gallery — all green
- **Error taxonomy**: 16 typed error classes with recovery affordances — `core/error-taxonomy.ts`, `components/error-boundary.ts`
- **Performance budgets**: `PerformanceBudgetTracker` with assertions in projections — `core/performance-budget.ts`
- **Adaptability**: dark/light/auto theme, comfortable/compact density, reduced motion, responsive breakpoints — `core/store.ts`, `utils/theme.ts`
- **Extensibility**: `surface-codegen` → `VISUAL_CELLS`, docs-as-code, plugin contribution point — `core/surface-codegen.ts`, `core/plugins.ts`

### What's Partial (Yellow)
- **Composer sweep**: `ComposerFocus` extracted; mode bar ↔ palette don't share single action source; no `composer.prefill` from tool-result (P2.4)

### What's Deferred (Red)
- **Graph3D**: `renderer:graph3d` — last `KNOWN_GAPS` entry (O6)
- **A11y**: Generated targets ready — fold `surfaceA11y` into gate (O7/O13)
- **P2.6 Motion capture**: storyboard strip support (O8)
- **P3.3 Control mode**: HUD toggle + engine abort wiring
- **P3.4 Demonstrations**: command chaining for narratives
- **P2.5 Graph polish**: hidden layer fit, `graph.ask-selection`, layout cycle, storyboard surfaces
- **O11 Extensibility scope**: in-repo contribution point done; full third-party loader revisit

---

## Immediate Next Steps (Priority Order)

### P0 — Unblock Harness (Do First) ✅ COMPLETE
1. **N.1 Drain derivation recorder** — Done: `/test/pause` now drains recorder synchronously; `waitForTimeout(2200)` removed from `inQuietWindow`, `seedConversation`, and `selection-node-detail` cells.
2. **N.2 Replace fixtures with real scenarios** — Done: Added `/test/seed-metta` and `/test/seed-gates` endpoints; `scenario-metta` and `scenario-budget-gate` cells now load through server-side endpoints instead of client-store fixtures. Baselines updated.
3. **N.3 Codegen the base cells** — Done: `scripts/generate-visual-cells.ts` generates base cells from static surface list; hand-curated cells override by id.

### P1 — Agent-Driven UI ✅ COMPLETE
4. **P2.3 Floating composer** — Done: `composer-focus.ts` with anchor resolution, capability-gated modes, prefill, cy→DOM handoff.
5. **P3.1 Command execution** — Done: `dispatchCommand` in `commands.ts:293` handles parse + available; engine commands drive UI.
6. **P3.2 Command args (Zod)** — Done: `command-schemas.ts` provides type-safe validation for agent `ui.command`.

### P2 — Productization Backbone ✅ COMPLETE
7. **C.1–C.4 Config system** — Done: Unified Zod schema, localStorage persistence, URL sync, Settings from schema, Profiles import/export.
8. **A.1–A.5 Adaptability** — Done: dark/light/auto theme, comfortable/compact density, reduced motion, responsive breakpoints, standalone degradation.
9. **X.1–X.4 Extensibility** — Done: unified descriptor validation, surface-codegen → VISUAL_CELLS, docs-as-code, plugin contribution point.
10. **P4.4 Performance budgets** — Done: `PerformanceBudgetTracker` with assertions in projections.
11. **P4.5 Error taxonomy** — Done: 16 typed error classes with recovery affordances in error boundary.

### P4 — **NEXT: P2.4 Composer Sweep** 🎯
13. **P2.1 Incremental growth** — **Done**: `GraphRenderer.present()` computes diff via `workspace-diff.ts` and emits `WorkspaceOp` stream; `applyWorkspaceOps` in `graph-viewport.ts:778` animates enter/exit/move.
14. **P2.2 Chat clusters** — **Done**: `isContainer` in `graph-projection.ts` treats `turn` blocks with children as compound parents; `syncWorkspaceLayer` handles fold state; block menu has Collapse/Expand; double-click toggles fold.
14. **P2.4 Composer sweep** — Unify mode bar ↔ palette action source; add `composer.prefill` from tool-result.
15. **P2.5 Graph polish** — Hidden layer fit exclusion, `graph.ask-selection` binding, layout cycle command, storyboard surfaces.

### P5 — Engine-Driven UI (Functional Leap)
16. **P3.3 Control mode** — HUD toggle, stop button → engine abort, budget/stop visible.
17. **P3.4 Demonstrations** — Command chaining for narrative sequences (renderer switch → focus → explain → provenance).

### P6 — Deferred (O6/O7/O8/O13)
18. **P2.6 Motion capture** — Storyboard strip support (O8).
19. **P4.3 Graph3D** — Deferred (O6).
20. **A11y** — Fold `surfaceA11y` into gate (O7/O13).
21. **O11 Extensibility scope** — In-repo contribution point done (X.4); full third-party loader revisit.
22. **O13 a11y timing** — Fold into gate when ready.

---

## Key Files Reference

| Area | Files |
|------|-------|
| **Projection** | `core/workspace-projection.ts` (542 lines) |
| **Commands** | `core/commands.ts` (293 lines), `core/ws-client.ts:170` |
| **Composer** | `components/input-hud.ts` (460 lines), `core/composer-modes.ts`, `core/input-decomposition.ts` |
| **Registries** | `core/surface-registry.ts`, `core/overlay-registry.ts`, `core/workspace-renderer.ts`, `core/view-adapter.ts`, `core/layout-ids.ts`, `core/capabilities.ts` |
| **Store** | `core/store.ts` (753 lines) — atoms, URL, lenses, panels, view, cognitive events |
| **Visual Tests** | `tests/visual/matrix.ts` (830 lines), `tests/components/visual-coverage.test.ts`, `tests/visual/reporter.ts` |
| **Graph Renderer** | `components/renderers/graph.ts` (167 lines), `core/graph-layer.ts` |
| **Settings** | `components/overlays/settings.ts`, `components/config-hud.ts` |

---

## Commands Reference

```bash
# Development
pnpm --dir ui dev:client          # Vite dev server
pnpm --dir ui typecheck           # TypeScript check
pnpm --dir ui test:unit           # Vitest unit tests
pnpm --dir ui test:e2e            # Playwright E2E
pnpm --dir ui test:visual         # Visual tests (baselines)
pnpm --dir ui test:visual:update  # Update baselines
pnpm --dir ui test:visual:ci      # Visual CI + gallery
pnpm --dir ui ui:verify           # One gate: typecheck + unit + visual:ci + gallery
pnpm --dir ui ui:gallery          # Build contact sheet
pnpm --dir ui storybook           # Storybook

# From workspace root
pnpm bot                          # Unified CLI agent
pnpm status                       # System One health
pnpm doctor                       # Onboarding diagnostics
```

---

## Architectural Decisions to Respect

1. **Data-first**: New surface/renderer/lens/layout/command/view-adapter = `register*` of descriptor
2. **Pure projections**: `projectWorkspace`, `sectionTree`, `decomposeInput` — no DOM, no store, unit-testable
3. **Single sources**: Commands = palette + agent; `sectionTree` = notebook + ToC + navigation; `WorkspaceGraph` = all renderers
4. **Capability-gated**: `capabilityGate(id)` is the one gate — composer modes, overlays, commands, renderer default
5. **Visual contract invariant**: Every registration → gallery cell (generated or curated); `visual-coverage.test.ts` enforces
6. **No mocks in tests**: Real stores, real projection, test-API seam (`store.ts:720-750`)

---

## Decisions & open questions

Carried from v7 (still in force): **O1** Linux-only baselines · **O2** commit baselines, gallery local ·
**O3** `ENABLE_WEB_UI=true pnpm bot` is the usability bar · **O4** no CI, local gates · **O5** real
offline LM in scenarios, no mocks · **O6** Graph3D deferred · **O7** a11y deferred · **O8** motion
after stills · **O9** typecheck clean is hard · **O10** one commit per item.

New:
- **O11 Extensibility scope** — a full third-party plugin loader vs. an in-repo contribution point?
  v8 assumes the latter (X.4); revisit if external plugins are a goal.
- **O12 Theming breadth** — dark + light only, or user token overrides? v8 assumes dark + light (A.1).
- **O13 a11y timing** (O7 revisited) — fold `surfaceA11y` targets into the gate once X.2/X.3 land, or
  keep deferred? v8 keeps it deferred but leaves the generated targets ready.
- **O14 Standalone vs. bridge order** — v8 runs P4.1 (bridge) and P4.2 (standalone) in parallel; both
  depend on the ViewSpec/overlay work from P2.

---

## Landed in v7 (for provenance)

P0: green typecheck; §10 renderer parity as a data view. P1: the visual contract — registry-driven
`VISUAL_CELLS` with coverage + stale-gap guards; all `overlay:*`, `renderer:*` (bar graph3d), `layout:*`,
`view:*`, `panel:*` surfaces captured; state matrix (empty/connecting/disconnected/reconnecting/
error-boundary/wide) and scenario matrix (bootstrap/derivation/conflicting-evidence/metta/budget-gate/
tool-approval/error-empty/disconnected); deterministic capture (engine paused before boot; recorder
quiet-window); generated `docs/readme/ui-gallery.md`; `ui:verify`. 44/44 cells, 425/425 units.

---

## Priority Execution Order

| Priority | Actions | Rationale |
|---|---|---|
| **P0** | N.1 (drain recorder) + N.2 (real scenarios) + N.3 (codegen cells) ✅ **DONE** | Unblocks visual test harness; removes test-only fixtures |
| **P1** | P2.3 (floating composer) + P3.1/P3.2 (command execution + args) ✅ **DONE** | Enables agent-driven UI; the functional leap |
| **P2** | C.1–C.4 (config system) + A.1–A.5 (adaptability) + X.1–X.4 (extensibility) + P4.4/P4.5 ✅ **DONE** | Productization backbone; all cross-cutting complete |
| **P3** | P2.1 (incremental growth) — `present` computes diff, `apply` animates | Core UX: live feel for streaming updates |
| **P4** | P2.2 (chat clusters) + P2.4 (composer sweep) + P2.5 (graph polish) | Polish & ergonomics |
| **P5** | P3.3 (control mode) + P3.4 (demonstrations) | Engine-driven UI; the functional leap |
| **P6** | P2.6 (motion capture) + P4.3 (Graph3D) + A11y | Deferred per O6/O7/O8/O13 |

---

## Session Start Checklist

- [x] `pnpm --dir ui typecheck` — green
- [x] `pnpm --dir ui test:unit` — 440 passing
- [x] `pnpm --dir ui test:visual:ci` — 51 cells, all passing
- [x] `pnpm --dir ui ui:verify` — green
- [x] Review `TODO.ui.8.md` for current priority

---

## First move

**P0, P1, P2, P3, P2.2 complete.** Cross-cutting (X, C, A) complete. P4 (productization) complete except P4.3 Graph3D (deferred O6).

**Next: P4 — P2.4 Composer Sweep** — unify mode bar ↔ palette action source; add `composer.prefill` from tool-result.

Remaining work:

| Phase | Item | Status | Notes |
|---|---|---|---|
| **P2.1** | Incremental growth | ✅ **Done** | `present()` computes diff via `workspace-diff.ts`; `applyWorkspaceOps` animates |
| **P2.2** | Chat clusters | ✅ **Done** | `turn` blocks with children are compound parents; fold/unfold via double-click + block menu |
| **P2.3** | Floating composer | ✅ **Done** | `composer-focus.ts`: anchor resolution, capability-gated modes, prefill |
| **P2.4** | Composer sweep | 🟡 Partial | `ComposerFocus` extracted; mode bar ↔ palette action source not unified |
| **P2.5** | Graph polish | ⬜ Not started | hidden layer fit exclusion, `graph.ask-selection`, layout cycle, storyboard surfaces |
| **P2.6** | Motion capture | ⬜ Not started | storyboard strip support (O8) |
| **P3.1** | Command execution | ✅ **Done** | `dispatchCommand` in `commands.ts:293` |
| **P3.2** | Command args (Zod) | ✅ **Done** | `command-schemas.ts` with Zod validation |
| **P3.3** | Control mode | ⬜ Not started | HUD toggle, stop button → engine abort |
| **P3.4** | Demonstrations | ⬜ Not started | command chaining for narrative sequences |
| **P4.3** | Graph3D | 🔴 Deferred (O6) | `renderer:graph3d` |
| **A11y** | Accessibility | 🔴 Deferred (O7/O13) | fold `surfaceA11y` into gate |
| **O11** | Extensibility scope | 🔴 Deferred | in-repo contribution point done (X.4); full loader revisit |
| **O13** | a11y timing | 🔴 Deferred | fold into gate when ready |