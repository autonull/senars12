# TODO.ui.9.md — Total UI Usability (the polish & completeness spine)

> **Relationship.** Supersedes `TODO.ui.8.md` for all open work. v8 is the landed record:
> **P0** (harness), **P1** (agent-driven UI), **P2** (interaction quality), **P3** (control &
> narration), **P4** (productization), and the cross-cutting **X/C/A** workstreams are complete.
> v9 reframes what remains around a single axis v8 left implicit — **total usability**: not just
> "can a power user do this?" but "can *anyone* discover, learn, recover, and operate it, on any
> device, with any input method?" It treats the v8 capabilities as a **floor**, not a ceiling, and
> keeps the visual contract and `ui:verify` as standing invariants.
> Stable id tags (`2.x`, `5.x`, `7.x`) are kept so old provenance still resolves.

## The two axes (carried from v8, sharpened)

**Capability** — the end-to-end session a non-developer can complete without tooling:
open & connect · converse · see · inspect · steer · navigate · operate by keyboard.

**Usability bar** — the property each capability must satisfy for *total* usability. v8 proved
each capability exists; v9 proves each is *discoverable, recoverable, and inclusive*.

| Quality | Concrete, testable property |
|---|---|
| **Complete** | Every screen, state and scenario has a committed gallery cell; no surface can be registered without one (enforced via `visual-coverage.test.ts`). |
| **Discoverable** | Every feature is reachable from the palette **or** a visible affordance **or** a documented shortcut; a `?` shortcut opens a generated keyboard/command reference. No hidden-only capability. |
| **Recoverable** | Every failure surfaces a typed error with a *specific* recovery action, and transient failures auto-retry with visible status; non-modal feedback (toast/inline) exists beside the modal boundary. |
| **Inclusive** | Keyboard-only and screen-reader paths complete; focus is managed across overlays/dynamic content; touch/pointer gestures work; high-contrast + reduced-motion honored. |
| **Performant** | Large graphs/workspaces virtualize or decimate; heavy projections don't block input; budgets asserted in tests. |
| **Learnable** | Empty states teach the next action; an interactive tour covers the core loop; contextual help (`?`) is one keystroke away. |
| **Portable** | Session (graph + chat + config) export/import round-trips; a shareable link restores the workspace. |
| **Consistent** | One vocabulary for actions/tokens/errors; the same command source drives palette, keys, agent, and menus. |

## Gates (must stay green)

| Gate | Command | Guards |
|---|---|---|
| Types | `pnpm --dir ui typecheck` | compile-time invariants |
| Units | `pnpm --dir ui test:unit` | projection, registries, commands, coverage |
| Behaviour | `pnpm --dir ui test:e2e` | real boot path scenarios (offline LM, O5) |
| Visual | `pnpm --dir ui test:visual:ci` | baselines + `ui:gallery` contact sheet |
| A11y | `pnpm --dir ui test:a11y` | generated `surfaceA11y` targets (O7/O13, now in scope) |
| **One command** | `pnpm ui:verify` | typecheck + unit + visual:ci + a11y + gallery |

CI/GitHub stays off (O4). `pnpm ui:gate` remains the fast type+unit gate.

## Dependency spine

```
U1 ─▶ U2 ─▶ U3 ─▶ U4
  ╲     ╲     ╲     ╲
   I     P     T     D     (cross-cutting: pull into whichever phase needs it;
   ╲     ╲     ╱     ╱      M is the invariant that ends every item)
    M  M  M  M  M  M
```

- **U1 Discover & Learn** — help, shortcuts, onboarding, empty-state teaching.
- **U2 Recover & Feedback** — toasts, auto-retry, typed recovery, inline status.
- **U3 Perform & Scale** — virtualization, progressive rendering, worker offload.
- **U4 Port & Polish** — session export/import, advanced graph interaction, sharing.
- **I Inclusivity · P Portability · T Touch · D Data · M Maintainability** — cross-cutting
  workstreams; an item in U1–U4 should also advance the axis it touches (e.g. the help overlay is
  I+Discoverability).

---

## U1 — Discover & Learn (M×4)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| 1.1 | **Keyboard & command reference** (`?`) — a generated overlay listing every active command with its shortcut and group, built from `paletteCommands()` + a shortcut table, so it can never drift from the registry. | ⬜ Not started | `components/overlays/help.ts` (new), `core/shortcuts.ts` (new), `core/commands.ts` | `?` opens a searchable reference; every command appears with its keys; shortcut table is the one source the global handler also reads; gallery cell |
| 1.2 | **Interactive tour** — a first-run tour that walks the core loop (send → see graph → inspect → ask selection → palette) via the existing `demo.play` chaining, skippable and replayable from the help overlay. | ⬜ Not started | `core/tours.ts` (new), `components/overlays/help.ts`, `core/commands.ts` | `tour.start` runs a scripted sequence; first-run shows a non-blocking prompt; replay from `?`; cell captures the prompt |
| 1.3 | **Empty-state teaching** — every empty state (graph, notebook, search, chat, palette-no-match, panel) offers the *next* action as a button/shortcut, not just prose; a shared `empty-state` variant carries the action slot. | ⬜ Not started | `components/primitives/empty-state.ts`, `components/app-layout.ts`, `components/chat-history-panel.ts`, `components/overlays/palette.ts` | each empty state has a primary action that is keyboard-reachable; a11y target present; cells for each |
| 1.4 | **Contextual hints & progressive disclosure** — dismissible inline hints on first use of graph/composer/timeline (stored per-user), plus menu/affordance labels that reveal advanced actions only once their prerequisite exists. | ⬜ Not started | `core/hints.ts` (new), `components/graph-toolbar.ts`, `components/input-hud.ts`, `components/timeline-scrubber.ts` | hints show once then persist dismissal; advanced affordances gated on availability; a "reset hints" action in Settings; cells |

---

## U2 — Recover & Feedback (M×4)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| 2.1 | **Toast / notification system** — a non-modal transient surface (`zIndex.layers.toast` already reserved) with severity, auto-dismiss, action slot, and a stacking manager; the sink every non-fatal event routes to. | ⬜ Not started | `components/toast-host.ts` (new), `core/toasts.ts` (new), `core/error-taxonomy.ts` | `toast.show(...)` renders stacked, auto-dismisses, action runs; wired to command success/failure; a11y `role=status`; gallery cell |
| 2.2 | **Auto-retry with visible status** — transient errors (connection, network) retry with exponential backoff, surfacing attempt count and a Cancel in the banner/toast instead of a modal; readable from `error-taxonomy.recoverable`. | ⬜ Not started | `core/retry.ts` (new), `core/ws-client.ts`, `components/connection-banner.ts`, `core/error-taxonomy.ts` | a transient failure retries N times with backoff, visible, cancellable; terminal failure escalates to the boundary; unit test |
| 2.3 | **Specific recovery actions** — audit the 16 error classes so each recovery action is concrete (`Reconnect`, `Reload provider`, `Open Settings: <field>`, `Retry command`) rather than generic `Retry`/`Dismiss`; add a "copy diagnostics" action. | ⬜ Not started | `core/error-taxonomy.ts`, `components/error-boundary.ts` | each error class maps to a specific action; `copy diagnostics` copies code+surface+detail; unit test per class |
| 2.4 | **Inline field/section errors** — Settings and the composer already validate; surface validation errors inline with fix hints and block the commit until valid (no silent degrade). | 🟡 Partial | `components/config-hud.ts`, `components/composer-focus.ts`, `core/command-schemas.ts` | invalid config shows inline error + hint and is not committed; invalid command args show why; unit test |

---

## U3 — Perform & Scale (M×4)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| 3.1 | **Graph virtualization / level-of-detail** — above a node-count threshold, render aggregate clusters/decimated edges and detail on demand, so a 10k-node graph stays interactive; reuse `decimate`/`virtualize` from `performance-budget.ts`. | ⬜ Not started | `core/graph-lod.ts` (new), `components/graph-viewport.ts`, `core/performance-budget.ts` | threshold engages LOD; interaction stays under budget; a large-graph scenario cell; budget asserted |
| 3.2 | **Progressive/incremental projections** — large projections yield in chunks (time-sliced) so streaming updates never jank a frame; `projectWorkspace`/`projectChat` gain a yielding path. | ⬜ Not started | `core/workspace-projection.ts`, `core/performance-budget.ts`, `core/workspace-bindings.ts` | a large workspace projects without a >16ms block; unit test measures slice sizes; budget asserted |
| 3.3 | **Worker offload for heavy compute** — layout/decimation/similarity run in a Web Worker when available, with a main-thread fallback; the worker boundary is a capability, not a requirement. | ⬜ Not started | `workers/graph.worker.ts` (new), `core/worker-client.ts` (new), `components/graph-viewport.ts` | layout offloads when supported; identical output with/without; fallback tested; capability-gated |
| 3.4 | **Interaction budget guardrails** — define and assert a `PerformanceBudget` for input latency and frame budget, failing `test:visual:ci` when a surface exceeds it; surface a dev-only overlay of the live budget. | 🟡 Partial | `core/performance-budget.ts`, `tests/visual/matrix.ts`, `components/telemetry-panel.ts` | budgets for latency/frame asserted; dev overlay shows live numbers; a visual cell |

---

## U4 — Port & Polish (M×4)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| 4.1 | **Session export/import** — serialize the whole session (workspace graph, chat, config, lens/layout, panel state) to a portable JSON, and import it back; complements the config-only Profiles. | ⬜ Not started | `core/session-serialize.ts` (new), `components/overlays/settings.ts`, `core/commands.ts` | `session.export`/`session.import` round-trip a workspace; a shareable URL restores state; unit + cell |
| 4.2 | **Advanced graph selection** — box/lasso select, additive select, invert, and "create subgraph from selection"; the toolbar multi-select bar gains these verbs. | 🟡 Partial | `components/graph-viewport.ts`, `components/graph-toolbar.ts`, `core/store.ts` | box/lasso select works; subgraph extraction reachable; multi-select verbs tested; cell |
| 4.3 | **Undo/redo for workspace actions** — a bounded action journal over workspace mutations (fold, selection, layout, hide, subgraph) with `⌘Z`/`⌘⇧Z`; the store owns the journal. | ⬜ Not started | `core/undo.ts` (new), `core/store.ts`, `components/app-layout.ts` | workspace actions undo/redo; a command-history panel lists them; keys bound; unit + cell |
| 4.4 | **Command history panel** — a panel listing executed commands (from `command-history.ts`) with re-run and argument recall, distinct from the palette MRU. | ⬜ Not started | `components/command-history-panel.ts` (new), `components/overlays/settings.ts`, `core/command-history.ts` | panel lists history; re-run replays; args recalled; cell |

---

## Cross-cutting workstreams

### I — Inclusivity (a11y becomes first-class, not deferred)

The generated `surfaceA11y` targets already exist (`core/surface-codegen.ts`); v9 wires them into a gate.

| # | Item | Acceptance |
|---|------|------------|
| I.1 | **Fold `surfaceA11y` into `test:a11y`** — every surface declares role/label/focus order; the gate asserts them from descriptors. | `pnpm --dir ui test:a11y` green; a surface without targets fails. |
| I.2 | **Focus management across dynamic content** — opening/closing overlays, streaming content, and new blocks move focus predictably and restore it on close; the overlay manager owns a focus stack. | focus returns to opener on close; new content announced; keyboard path complete; test. |
| I.3 | **Live-region vocabulary** — one `announce()` seam (extend `announcer.ts`) for streaming, timeline, toast, errors; `role=status`/`alert` chosen by severity. | screen readers hear streaming/status/errors; no duplicate announcements; test. |
| I.4 | **High-contrast + reduced-motion end-to-end** — a `contrast: 'normal' | 'high'` config with tokens; all cross-cutting animations gate on `reducedMotion` (extends A.3). | `state-contrast` cell; motion items no-op under reduce; tokens generated. |

### P — Portability

| # | Item | Acceptance |
|---|------|------------|
| P.1 | **Session schema + versioning** — a versioned `SessionSchema` (Zod) for export/import with migration; boundary fragments from `util/src/config/boundary.ts`. | old sessions migrate or refuse loudly; unit test. |
| P.2 | **Deep-link completeness** — every URL-addressable slice round-trips (renderer, lens, layout, selection, timeline, panels, config); `hydrateFromUrl` covers all. | a link restores the exact view; round-trip survives reload; cell. |

### T — Touch & Responsive

| # | Item | Acceptance |
|---|------|------------|
| T.1 | **Touch gestures for the graph** — pinch-zoom, two-finger pan, tap-select, long-press context; implemented over the existing viewport events. | gestures work on touch; no regression on pointer; test where feasible. |
| T.2 | **Mobile composer & HUD** — the composer and HUD collapse to a mobile layout at the narrow breakpoint; mode bar scrolls; send is thumb-reachable. | narrow cell shows mobile layout; all actions reachable; a11y targets. |
| T.3 | **Swipe panels** — left/right panels open/close by swipe at the narrow breakpoint. | swipe toggles panels; keyboard parity; test. |

### M — Maintainability (the invariant every item ends on)

- **Every new surface/state/scenario ends with a committed cell** (`visual-coverage.test.ts`).
- **Every cross-cutting axis** ends with a contract test (session round-trip, a11y targets, touch, retry).
- **Budgets** (U3) are asserted, not aspirational — `PerformanceBudget` in visual tests.
- **`ui:verify` is the one gate**; a red `typecheck`/coverage/baseline/a11y blocks a commit (O9/O10).

---

## Deferred (carried from v8, still deferred — revisit deliberately)

These remain out of scope for v9's usability mandate, kept here so provenance resolves:

| # | Item | Why deferred | Acceptance when taken |
|---|------|--------------|-----------------------|
| O6 | **`renderer:graph3d`** — the last `KNOWN_GAPS` entry. | 3D adds cost without unlocking a usability gap; 2D + LOD covers scale (U3.1). | Graph3D ships as a declared `partial` renderer with a parity row + cells; `KNOWN_GAPS` empties. |
| O11 | **Third-party plugin loader** — full external plugin loading vs. the in-repo contribution point (X.4). | No external plugin consumer yet; the in-repo seam covers extensibility. | A plugin loads from a manifest at boot with validation; sandboxed; documented. |
| O12 | **User token overrides** — beyond dark/light/high-contrast. | Two themes + high-contrast cover inclusivity (I.4); arbitrary overrides risk incoherent surfaces. | A token editor writes a validated theme; previews live; exportable. |
| O13 | **i18n** — internationalization beyond English. | No locale requirement yet; strings are centralized enough to extract later. | Message catalog + locale switch; all UI strings externalized; test. |

---

## Architectural Recommendations (from usability review)

These are implementation patterns to follow, not separate TODO items:

| Rec | Description | Related Items |
|-----|-------------|---------------|
| **PR1** | Build the help overlay and the global key handler from one `shortcuts.ts` table, so the reference can never drift from behavior. | U1.1, U1.2 |
| **PR2** | Route every non-fatal event through one `toasts.ts` sink; the error boundary stays for fatal/promoted errors only. | U2.1, U2.2 |
| **PR3** | Time-slice heavy projections and offload layout to a worker behind a capability gate; never block the frame. | U3.2, U3.3 |
| **PR4** | Serialize the whole session behind a versioned Zod schema; config Profiles stay a subset. | U4.1, P.1 |
| **PR5** | Own a bounded action journal in the store for workspace undo/redo; the command history is a read view over it. | U4.3, U4.4 |
| **PR6** | One `announce()` seam for all live regions; severity chooses the role. | I.3 |
| **PR7** | Fold generated `surfaceA11y` targets into a real gate — inclusivity is asserted, not aspirational. | I.1 |

---

## Current State (usability review)

### What's Working (Green)
- **Registry-driven architecture**: 7 registries (surface, overlay, renderer, command, lens, layout, view-adapter) — data-driven, no shell edits for extensions
- **Workspace substrate**: pure, deterministic `WorkspaceGraph` projection with performance budgets
- **Command system**: single registry; palette + agent `ui.command` share source; Zod-validated args
- **Visual contract**: `VISUAL_CELLS` + coverage test + gallery — 51/51 cells
- **Config/URL**: unified Zod schema, persistence, URL mirroring, Settings-generated form, Profiles
- **Capabilities**: 5 capabilities gate modes/overlays/commands/renderer default
- **Control & narration**: floating composer, control mode w/ HUD stop + abort, demonstrations
- **Interaction quality**: incremental graph growth, chat clusters w/ fold, graph polish
- **Error taxonomy**: 16 typed error classes with recovery affordances
- **Adaptability**: dark/light/auto, comfortable/compact density, reduced motion, responsive

### What's Partial (Yellow)
- **Inline validation surfacing**: schema validates, but composer/settings don't always block on invalid input (U2.4)
- **Advanced graph selection**: multi-select exists via toolbar; box/lasso and subgraph extraction missing (U4.2)
- **Interaction budgets**: projection budgets asserted; input-latency/frame budgets not (U3.4)

### What's Missing (Red)
- **Discoverability**: no help/shortcut reference, no tour, no hint system (U1)
- **Non-modal feedback**: no toast system, no auto-retry (U2)
- **Scale**: no graph LOD, no progressive projections, no worker offload (U3)
- **Portability**: no session export/import, no undo/redo, no command-history panel (U4)
- **Inclusivity gate**: a11y targets exist but aren't gated; no focus-stack, one announce seam, high-contrast (I)
- **Touch/responsive**: no touch gestures, no mobile composer (T)

---

## Immediate Next Steps (Priority Order)

### U0 — Quick Wins (do first, unblock cleanly)
1. **U1.1 Keyboard & command reference** — one `shortcuts.ts` table drives both the global handler and the `?` overlay; highest discoverability win for the least surface.
2. **U2.1 Toast system** — the `zIndex.layers.toast` slot is already reserved; a sink unblocks every later non-modal feedback item.
3. **I.1 Fold `surfaceA11y` into a gate** — targets are generated; wiring the gate makes inclusivity a floor, not a goal.

### U1 — Discover & Learn
4. **U1.2 Interactive tour** — chain the core loop via `demo.play`; replayable from `?`.
5. **U1.3 Empty-state teaching** — shared action slot; every empty state teaches the next action.
6. **U1.4 Contextual hints** — dismissible, persisted, resettable.

### U2 — Recover & Feedback
7. **U2.2 Auto-retry with visible status** — transient errors retry with backoff, visible, cancellable.
8. **U2.3 Specific recovery actions** — audit the 16 classes; concrete actions + copy diagnostics.
9. **U2.4 Inline validation** — block invalid commits with fix hints.

### U3 — Perform & Scale
10. **U3.1 Graph LOD** — aggregate above threshold; stay interactive at 10k nodes.
11. **U3.2 Progressive projections** — time-sliced; no >16ms block.
12. **U3.3 Worker offload** — layout in a worker behind a capability, with fallback.
13. **U3.4 Interaction budgets** — assert latency/frame; dev overlay.

### U4 — Port & Polish
14. **U4.1 Session export/import** — versioned, round-trips, shareable link.
15. **U4.2 Advanced graph selection** — box/lasso, subgraph extraction.
16. **U4.3 Undo/redo** — bounded action journal over workspace mutations.
17. **U4.4 Command history panel** — read view over the journal.

### I/P/T — Cross-cutting (fold into the phase that needs them)
18. **I.2–I.4** Focus stack · announce seam · high-contrast.
19. **P.1–P.2** Session schema/versioning · deep-link completeness.
20. **T.1–T.3** Touch gestures · mobile composer/HUD · swipe panels.

### Deferred (revisit deliberately)
21. **O6** Graph3D · **O11** plugin loader · **O12** token overrides · **O13** i18n.

---

## Key Files Reference

| Area | Files |
|------|-------|
| **Projection** | `core/workspace-projection.ts`, `core/performance-budget.ts` |
| **Commands** | `core/commands.ts`, `core/command-schemas.ts`, `core/command-history.ts` |
| **Composer** | `components/composer-focus.ts`, `components/input-hud.ts`, `core/composer-modes.ts` |
| **Registries** | `core/surface-registry.ts`, `core/overlay-registry.ts`, `core/workspace-renderer.ts`, `core/view-adapter.ts`, `core/capabilities.ts` |
| **Store** | `core/store.ts` — atoms, URL, lenses, panels, view, undo (new) |
| **Graph** | `components/graph-viewport.ts`, `components/renderers/graph.ts`, `core/graph-layer.ts`, `core/graph-lod.ts` (new) |
| **Feedback** | `core/error-taxonomy.ts`, `components/error-boundary.ts`, `core/toasts.ts` (new), `core/retry.ts` (new) |
| **Discover** | `core/shortcuts.ts` (new), `core/tours.ts` (new), `core/hints.ts` (new), `components/overlays/help.ts` (new) |
| **A11y** | `core/announcer.ts`, `core/surface-codegen.ts`, `tests/visual/matrix.ts` |
| **Visual Tests** | `tests/visual/matrix.ts`, `tests/components/visual-coverage.test.ts`, `tests/visual/reporter.ts` |

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
pnpm --dir ui test:a11y           # Accessibility gate (I.1)
pnpm --dir ui ui:verify           # One gate: typecheck + unit + visual:ci + a11y + gallery
pnpm --dir ui ui:gallery          # Build contact sheet
```

---

## Architectural Decisions to Respect

1. **Data-first**: New surface/renderer/lens/layout/command/help/shortcut = `register*` of a descriptor
2. **Pure projections**: `projectWorkspace`, `sectionTree`, `decomposeInput` — no DOM, no store, unit-testable
3. **Single sources**: Commands = palette + agent + keys; `sectionTree` = notebook + ToC + navigation; `WorkspaceGraph` = all renderers; **`shortcuts.ts` = help + handler** (new)
4. **Capability-gated**: `capabilityGate(id)` is the one gate — modes, overlays, commands, renderer default, worker offload
5. **Visual contract invariant**: Every registration → gallery cell (generated or curated)
6. **Inclusivity is asserted**: `surfaceA11y` targets → `test:a11y` gate
7. **No mocks in tests**: Real stores, real projection, test-API seam

---

## Decisions & open questions

Carried from v7/v8 (still in force): **O1** Linux-only baselines · **O2** commit baselines, gallery
local · **O3** `ENABLE_WEB_UI=true pnpm bot` is the usability bar · **O4** no CI, local gates · **O5**
real offline LM in scenarios, no mocks · **O9** typecheck clean is hard · **O10** one commit per item.

New / revisited:
- **O6 Graph3D** — still deferred; 2D + LOD (U3.1) is assumed to cover scale. Revisit only if a 3D
  affordance proves to unlock a usability gap 2D cannot.
- **O11 Extensibility scope** — in-repo contribution point stands; a full loader is deferred until an
  external consumer exists.
- **O12 Theming breadth** — dark + light + high-contrast (I.4); arbitrary token overrides deferred.
- **O13 i18n** — deferred; strings are centralized enough to extract when a locale is required.
- **O15 Rethink vs. extend** — v9 **extends** v8 rather than rethinking: the registries, command
  source, projection and visual contract are sound; v9 closes the discover/recover/scale/port gaps
  around them.

---

## Priority Execution Order

| Priority | Actions | Rationale |
|---|---|---|
| **U0** | U1.1 (help/shortcuts) + U2.1 (toasts) + I.1 (a11y gate) | Highest discoverability + feedback + inclusivity for the least surface |
| **U1** | U1.2–U1.4 (tour, empty-state teaching, hints) | Learnability: a first-run user can self-serve |
| **U2** | U2.2–U2.4 (auto-retry, specific recovery, inline validation) | Recoverability: failures are actionable, not dead ends |
| **U3** | U3.1–U3.4 (LOD, progressive projections, worker, budgets) | Scale: large workspaces stay interactive |
| **U4** | U4.1–U4.4 (session, selection, undo, history) | Portability & power: sessions move, actions reverse |
| **I/P/T** | I.2–I.4, P.1–P.2, T.1–T.3 | Inclusivity, portability, touch fold into the phases above |
| **Deferred** | O6, O11, O12, O13 | Revisit deliberately when a consumer or requirement appears |

---

## Session Start Checklist

- [ ] `pnpm --dir ui typecheck` — green
- [ ] `pnpm --dir ui test:unit` — 440 passing
- [ ] `pnpm --dir ui test:visual:ci` — 51 cells, all passing
- [ ] `pnpm --dir ui test:a11y` — gate exists (I.1) once wired
- [ ] `pnpm --dir ui ui:verify` — green
- [ ] Review `TODO.ui.9.md` for current priority

---

## First move

**v8 is landed.** All P0–P4, X/C/A and P2/P3 items are complete. v9 opens the **total-usability**
workstream: discover → recover → scale → port, with inclusivity/portability/touch folded in.

**Next: U0 — U1.1 Keyboard & command reference** — one `shortcuts.ts` table drives both the global
key handler and a generated `?` overlay, so the reference can never drift from behavior.

---

## Landed in v8 (for provenance)

**P0** harness unblocking (drain recorder, real scenarios, codegen cells) · **P1** agent-driven UI
(floating composer, command execution, Zod args) · **P2** interaction quality (incremental graph
growth, chat clusters, composer sweep, graph polish) · **P3** control & narration (control mode with
HUD stop + abort, demonstrations) · **P4** productization (bridge, standalone, performance budgets,
error taxonomy) · **X** extensibility (descriptor validation, surface-codegen, docs-as-code, plugin
point) · **C** configurability (typed config, persistence/URL, Settings-driven, profiles) ·
**A** adaptability (light theme, density, reduced motion, responsive, standalone degradation).
51/51 cells, 440/440 units, `ui:verify` green.
