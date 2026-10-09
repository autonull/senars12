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
| **Complete** | Every screen, state and scenario has a committed gallery cell; no surface can be registered without one (already enforced). |
| **Functional** | Engine-emitted `ui.command` drives the UI; control mode and demonstrations run through the same command registry as the palette. |
| **Usable / ergonomic** | The composer is summonable in context; the palette is argument-aware and keyboard-complete; a blind run of one task needs no mouse. |
| **Flexible / modular** | A new surface/renderer/lens/command/view-adapter/layout is added by `register*` of a **descriptor** — no shell edit — and the gallery cell, story, a11y target and doc stub are generated from it. |
| **Configurable** | One typed UI config (theme, density, motion, default renderer/lens/layout, panels, provider, budgets), schema-validated, persisted, URL-addressable, edited from Settings, import/exportable. |
| **Adaptable** | Dark **and** light themes, density, responsive breakpoints, honored `prefers-reduced-motion`, and graceful degradation to an engine-free build. |
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

| # | Item | Files | Acceptance |
|---|------|-------|------------|
| 2.1 | **Incremental growth** — animate new workspace blocks in (replace today's replace-by-diff), no full relayout | `core/workspace-projection.ts`, `components/renderers/graph.ts` | a still cell shows stable topology; a motion cell (2.6) shows blocks entering |
| 2.2 | **Chat clusters** — compound clusters from `contains`/headings; set `children` on turns | `core/workspace-projection.ts` | a multi-turn chat collapses into a cluster cell |
| 2.3 | **Floating composer** — anchored to block/node/subgraph; summoned, not persistent; cy→DOM handoff; capability-gated modes | `components/input-hud.ts`, `core/commands.ts`, `core/composer-modes.ts` | composer opens anchored; mode gating observable; cell |
| 2.4 | **Composer sweep** — mode bar ↔ palette share one action source; `composer.prefill`; per-segment preview; guard `decomposeInput` over-splitting; extract `ComposerFocus` | `components/input-hud.ts`, `core/commands.ts`, `core/input-decomposition.ts` | one action source; prefill from `tool-result`; decimal/abbrev safe |
| 2.5 | **Graph polish** — unify lens/capability styling in the adapter; exclude the hidden layer from `fit`; bind `graph.ask-selection` (`a`); HUD/palette layout group + `graph.layout.cycle`; register the `chronological-flow`/`source-view` SpaceGraph surfaces when the storyboard adapter exists | `components/renderers/graph.ts`, `core/workspace-renderer.ts`, `core/graph-layer.ts` | hidden layer not fitted; layout cycle reachable; suite green (new surfaces get cells) |
| 2.6 | **Motion capture support** (O8) — let the harness snapshot a settled frame of an interaction (or a storyboard strip), so animation is contract-tested | `tests/visual/reporter.ts`, `tests/visual/matrix.ts` | one motion item captured deterministically |

## P3 — Control & narration (M/L)

| # | Item | Files | Acceptance |
|---|------|-------|------------|
| 3.1 | **`5.1 execution`** — `ui.command` over the workspace (renderer, focus, explain, highlight, ToC/search, artifact, embed, compose, narrate, scrub); round-trip through `applyServerMessage`; visible in timeline/telemetry | `core/commands.ts`, `core/ws-client.ts`, `core/workspace-bindings.ts` | engine-emitted command drives UI; one round-trip test + cell |
| 3.2 | **`5.1 args`** — parameterised commands with a `params` descriptor; type-checked args; `available()`-aware palette badge | `core/commands.ts`, `components/overlays/palette.ts` | palette prompts for args; invalid args rejected |
| 3.3 | **`5.2 control mode`** — off → suggestions; on → execution + visible command log + HUD **stop**; budget/stop in HUD | `components/workspace-hud.ts`, `core/commands.ts` | toggle observable; stop halts an in-flight run |
| 3.4 | **`5.3 demonstrations`** — "show me how you got that" switches renderers, focuses refs, opens provenance, narrates | `core/commands.ts` | one narrative sequence scripted + cell |

## P4 — Productization (L)

| # | Item | Files | Acceptance |
|---|------|-------|------------|
| 4.1 | **`0.7 bridge`** — legacy nodes/events/chat as overlays/embedded views; ViewSpec adapters usable in overlays | `components/overlays/*`, `components/views/*` | legacy surfaces reachable; cells |
| 4.2 | **`7.2 standalone`** — engine-free build (LM provider + segmentation + semantic links + Notebook/Graph), no NARS backend (O3) | build config, `entry.ts` | UI runs engine-free; a smoke cell |
| 4.3 | `renderer:graph3d` — deferred (O6) | `components/renderers/graph3d.ts` | last `KNOWN_GAPS` entry closes |
| 4.4 | **`7.3 performance`** — op batching, virtualization, decimation, latency budgets; memoise ToC/explain/commands; shared adjacency index | `core/workspace-projection.ts`, `core/toc.ts` | budgets asserted under a high-throughput scenario |
| 4.5 | **Error taxonomy** — typed error classes per surface, rendered by `error-boundary` with recovery affordances (folded from v7 4.5) | `components/error-boundary.ts`, `core/*` | each error class has a captured state |

## Cross-cutting workstreams

### X — Extensibility (the modularity backbone)

The registries already exist (`surface`, `overlay`, `view-adapter`, layout ids, renderer, panel, lens,
commands). v8 closes the loop from **registration → contract → docs** so extension is data, not surgery.

| # | Item | Acceptance |
|---|------|------------|
| X.1 | **Unified descriptor + validation** — one `registerContribution`-shaped contract over the existing registries; boot-time validation (unique ids, resolvable tags, declared bindings); a bad contribution fails loud | registering an unknown shape/tag fails a unit test |
| X.2 | **Wire `surface-codegen` into the matrix** — generate the base gallery cell from `SurfaceDescriptor`, keep hand-curated cells as overrides | adding a surface updates coverage without editing `VISUAL_CELLS` |
| X.3 | **Docs-as-code for surfaces** — emit the surface reference from descriptors (feeding `docs/readme/ui-gallery.md`) | a surface with no generated doc stub fails a check |
| X.4 | **Plugin contribution point** — a `plugins.ts` seam where a module contributes surfaces/commands/lenses; contains no shell edits | one demo plugin registered and captured |

### C — Configurability

| # | Item | Acceptance |
|---|------|------------|
| C.1 | **Typed UI config** — one schema (theme, density, motion, default renderer/lens/layout, panels, provider, budgets), defaults + validation | invalid config rejected; typecheck covers it |
| C.2 | **Persistence + URL** — persist to `localStorage`, mirror the URL-addressable slice, hydrate on boot (extends `hydrateFromUrl`) | deep link restores the workspace; cell |
| C.3 | **Settings-driven** — Settings renders from the config schema, not hand-written fields | a new option needs no Settings markup edit |
| C.4 | **Profiles + import/export** — named profiles over `config-profiles.ts`, copy/paste JSON | switch profile restores a workspace; cell |

### A — Adaptability

| # | Item | Acceptance |
|---|------|------------|
| A.1 | **Light theme** — generate `light` tokens alongside `dark`; `setTheme` already reflects `data-theme` | a `state-light` cell; all surfaces legible |
| A.2 | **Density** — comfortable/compact spacing via tokens | a `state-compact` cell |
| A.3 | **Reduced motion honored end-to-end** — animations gate on `matchMedia('(prefers-reduced-motion)')` | motion items (2.1/2.6) no-op under reduce; test |
| A.4 | **Responsive contract** — breakpoints documented and captured (narrow/medium/wide) | cells at 640/1024/1920 |
| A.5 | **Standalone degradation** — capabilities (X/`capabilities.ts`) drive what renders when the engine is absent; no dead affordances | engine-free cell shows only supported surfaces |

### M — Maintainability (the invariant every item ends on)

- **Every new surface/state/scenario ends with a committed cell** (the P1 contract already enforces this).
- **Every cross-cutting axis** ends with a contract test (config round-trip, theme switch, plugin load).
- **Budgets** (P4.4) are asserted, not aspirational.
- **`ui:verify` is the one gate**; a red `typecheck`/coverage/baseline blocks a commit (O9/O10).

---

## Newly surfaced (this session) — do early, they unblock cleanly

| # | Item | Why | Acceptance |
|---|------|-----|------------|
| N.1 | **Drain the derivation recorder in `/test/pause`** | The server's 2s recorder timer outlives `pause()`, forcing a 2.2s "quiet window" in every engine-free cell | quiet-window removed from `matrix.ts`; suite still green |
| N.2 | **Replace fixtures with real scenarios** | `metta`/`budget-gate` and the view cells are seeded from client stores; make the block kinds seedable server-side | cells load through the real engine path |
| N.3 | **Codegen the base cells** (see X.2) | `VISUAL_CELLS` is hand-curated; registration should imply a cell | coverage grows with registration |

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

## Landed in v7 (for provenance)

P0: green typecheck; §10 renderer parity as a data view. P1: the visual contract — registry-driven
`VISUAL_CELLS` with coverage + stale-gap guards; all `overlay:*`, `renderer:*` (bar graph3d), `layout:*`,
`view:*`, `panel:*` surfaces captured; state matrix (empty/connecting/disconnected/reconnecting/
error-boundary/wide) and scenario matrix (bootstrap/derivation/conflicting-evidence/metta/budget-gate/
tool-approval/error-empty/disconnected); deterministic capture (engine paused before boot; recorder
quiet-window); generated `docs/readme/ui-gallery.md`; `ui:verify`. 44/44 cells, 425/425 units.

## First move

Start with **N.1 + N.2** (small, unblock the harness and remove test-only fixtures), then **P2.1 + X.2**
(the live graph and the codegen loop) — the pair that most improves feel *and* maintainability, and the
one all later P2 items build on.
