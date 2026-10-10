# TODO.ui.9.md — The Cognitive Workspace (paradigm, usability & craft)

> **Relationship.** Supersedes `TODO.ui.8.md` for all open work. v8 is the landed record:
> **P0** (harness), **P1** (agent-driven UI), **P2** (interaction quality), **P3** (control &
> narration), **P4** (productization), and the cross-cutting **X/C/A** workstreams are complete.
> v9 does not add features for their own sake — it makes the *existing* substance real: one knowledge
> substrate seen through several projections, made **discoverable, recoverable, legible, inclusive,
> and continuously bridged**. It treats the v8 capabilities as a **floor**, keeps the visual contract
> and `ui:verify` as standing invariants, and holds a hard line on **restraint**.
> Stable id tags (`2.x`, `5.x`, `7.x`) are kept so old provenance still resolves.

---

## The paradigm: one substrate, many projections

**The claim.** In SeNARS there is no "chat" and no "graph" — there is one `WorkspaceGraph` (blocks ·
links · roots · kinds · truth · provenance), projected into several views. **Chat** is its
temporal/linear projection. The **Notebook** is its document/hierarchical projection. The **Graph**
is its spatial/relational projection. They are the same data seen three ways, and a block keeps one
identity across all of them.

```
                    ┌──────────────────────────────────────┐
                    │            WorkspaceGraph             │
                    │   blocks · links · roots              │
                    │   kind · truth(f,c) · provenance      │
                    └───────────────────┬──────────────────┘
          ┌────────────────────┬────────┴────────┬────────────────────┐
          ▼                    ▼                 ▼                    ▼
    ┌───────────┐        ┌───────────┐     ┌───────────┐       (future projections)
    │   Chat    │ ⇄⇄⇄⇄⇄  │ Notebook  │ ⇄⇄  │   Graph   │
    │  linear   │        │ document  │     │  spatial  │
    │ temporal  │        │hierarchic │     │relational │
    └───────────┘        └───────────┘     └───────────┘
          └───────── semantic zoom · shared focus/selection ─────────┘
```

**Why it matters.** A chatbot forgets; a graph is inert; a document is flat. SeNARS keeps the
*structure* — kinds, truth values, derivations, links — so the UI can let a user move fluidly between
**saying**, **reading**, and **seeing**. The interface's job is not to place features side by side,
but to make one substance legible through several lenses.

**The bridge is the paradigm.** The bridge is not a feature; it is the *property* that a block, its
selection, its focus, and its provenance are continuous across projections. Everything else in v9
serves that continuity being real, legible, and delightful. **Chat is where you speak; the graph is
where the knowledge lives; the notebook is where you read the argument — and moving between them is
one motion, not three modes.**

**The cognitive workspace.** The user is not "chatting with a bot." They are co-reasoning with an
auditable machine: speaking claims and questions, watching the knowledge graph grow, inspecting
derivations, curating concepts, and steering inference. The UI must make the cognitive architecture
*legible* — beliefs vs goals, truth values, contradiction, budget — without becoming a control panel.

---

## Design principles (HCI, applied — not decoration)

Every item in this plan is accepted by *how it obeys these*, not only what it does.

| Principle | Concrete, testable property |
|---|---|
| **Progressive disclosure** | Advanced affordances appear only when their prerequisite exists; the default surface is quiet. |
| **Recognition over recall** | Every action is discoverable from a visible affordance or the generated `?` help; nothing requires an undocumented key. |
| **Direct manipulation** | Graph/notebook are editable in place (fold · link · retitle · revise truth); effects are immediate and reversible. |
| **Overview first, detail on demand** | Minimap + semantic zoom + lens; full detail only on selection. |
| **Semantic zoom / object constancy** | Chat ⇄ Notebook ⇄ Graph morph continuously; a block keeps its identity and interpolates position. |
| **Visibility of system status** | Connection, streaming, budget, retry always visible, never modal. |
| **User control & freedom** | Undo/redo, Escape closes, cancel for every long operation, no dead ends. |
| **Consistency** | One component per role; one command source for palette/keys/agent; one token vocabulary. |
| **Error prevention** | Invalid input is blocked inline with a fix hint; destructive actions confirm or are undoable. |
| **Aesthetic, minimalist design** | Restraint: no ornament without function; one icon set; quiet color. |
| **Help & documentation** | Generated at runtime from the registries, contextual, online — never a stale manual. |
| **Fitts / target sizing** | Primary targets ≥ 32px; destructive targets separated from common ones. |
| **Miller / chunking** | HUD chrome ≤ ~7 primary controls; the rest lives in the palette and help. |

---

## The design system (craft foundation — everything sits on this)

This is what makes it *feel* like a product rather than a prototype. It is built once (phase **D**)
and every later item inherits it.

- **Iconography.** Replace emoji chrome (`☰ ⏱ 📈 🗺 ⚙ ⌘K ⬢ ■`) with **one monochrome line-icon set**:
  `currentColor`, a consistent grid, one stroke weight. Emoji survive only in empty-state
  illustrations. One `<s-icon name="…">` primitive + a name→path registry, capability-agnostic.
- **Color.** Semantic tokens exist; add a **truth-value scale** (f,c → hue/opacity), **lens colors**,
  **status**, and a **high-contrast** variant. Contrast is asserted (AA body / AAA large).
- **Borders & shape.** One radius scale (input · button · panel · pill), 1px subtle borders, **no
  nested double borders**; the focus ring is always visible and never removed.
- **Spacing & density.** One spacing scale; comfortable/compact tokens. Vertical rhythm consistent
  across chrome, panels, and overlays.
- **Typography.** Three families (UI · data/mono · prose), one scale, line-length caps, tabular
  numerals for data. Hierarchy earns attention; nothing shouts.
- **Motion.** Short (≤200ms), purposeful, `reducedMotion`-gated. Continuity (FLIP) is reserved for
  the bridge; there is no decorative motion.
- **Legibility.** Reading order, contrast, and focus visibility are audited per surface at three
  breakpoints.

---

## Gates (must stay green)

| Gate | Command | Guards |
|---|---|---|
| Types | `pnpm --dir ui typecheck` | compile-time invariants |
| Units | `pnpm --dir ui test:unit` | projection, registries, commands, coverage |
| Behaviour | `pnpm --dir ui test:e2e` | real boot path scenarios (offline LM, O5) |
| Visual | `pnpm --dir ui test:visual:ci` | baselines + `ui:gallery` contact sheet |
| A11y | `pnpm --dir ui test:a11y` | generated `surfaceA11y` targets (**I.1**, now in scope) |
| Craft | `pnpm --dir ui test:craft` | icon/emoji lint, contrast, motion-scale (**D.5**) |
| **One command** | `pnpm ui:verify` | typecheck + unit + visual:ci + a11y + craft + gallery |

CI/GitHub stays off (O4). `pnpm ui:gate` remains the fast type+unit gate.

## Dependency spine

```
   D ─▶ B ─▶ H ─▶ R
   │    │    │    │
   ▼    ▼    ▼    ▼
   S    P    I    T        (D is the foundation; B is the paradigm;
    ╲   ╲   ╱   ╱           M ends every item)
       M M M M
```

- **D Design system** — the craft foundation; land first, quietly.
- **B Bridge** — chat ⇄ notebook ⇄ graph continuity; the paradigm.
- **H Help** — dynamic, online discoverability and onboarding.
- **R Recover** — feedback, retry, specific recovery.
- **S Scale · P Portability · I Inclusivity · T Touch** — the delivery envelope.
- **M Maintainability** — the invariant every item ends on.

---

## D — Design System & Legibility (M×5)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| D.1 | **Icon primitive + registry** — one `<s-icon>`; monochrome, `currentColor`, one grid/stroke; emoji removed from chrome. | ⬜ | `components/primitives/icon.ts` (new), `core/icons.ts` (new) | every chrome control uses `<s-icon>`; a lint forbids emoji in chrome; cells |
| D.2 | **Token completeness** — truth-value scale, lens colors, status, focus ring, radius scale audited and generated. | ⬜ | `styles/tokens.*`, `scripts/build-tokens.ts`, `utils/theme.ts` | tokens generated; contrast asserted (AA/AAA); cells |
| D.3 | **Chrome audit & restraint** — every chrome pixel earns its place; HUD ≤ 7 primary controls; the rest moves to palette/help. | ⬜ | `components/workspace-hud.ts`, `components/graph-toolbar.ts`, `components/app-layout.ts` | a control-count check; before/after cells |
| D.4 | **Motion system** — one motion vocabulary (duration/easing tokens), `reducedMotion`-gated; continuity reserved for the bridge. | ⬜ | `styles/tokens.*`, `components/renderers/graph.ts`, `components/graph-viewport.ts` | motion tokens used everywhere; reduced-motion test; cells |
| D.5 | **Legibility & craft gate** — typography scale, line length, focus visibility, z-index order, icon/emoji lint, contrast, motion scale — one `test:craft`. | ⬜ | `tests/craft/*` (new), `package.json` | `test:craft` green; a violation fails it |

---

## B — The Bridge: chat ⇄ notebook ⇄ graph continuity (M×7)

> The paradigm made real. Chat is the temporal projection; the notebook the document projection; the
> graph the spatial projection. The bridge is the property that these are **one substance**.

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| B.1 | **Cross-view identity & sync** — a block's selection/focus/hover is the same object across projections; selecting in chat highlights in graph and vice versa; an optional *linked-focus* mode scrolls the peer to the focused block. | 🟡 | `core/store.ts`, `components/renderers/*`, `components/app-layout.ts` | select in one → highlight/scroll in the other; unit test on the shared selection atom; cell |
| B.2 | **Semantic zoom (the morph)** — a continuous control/gesture morphs Chat ⇄ Notebook ⇄ Graph, interpolating block positions with object constancy; no hard mode switch. | ⬜ | `components/workspace-host.ts`, `core/semantic-zoom.ts` (new), `components/renderers/*` | a motion cell shows the morph; reduced-motion crossfades; positions interpolate deterministically |
| B.3 | **Inline manifestations** — chat turns embed live micro-visualizations (truth-value chip · provenance sparkline · inline mini-graph for a referenced subgraph); a graph node reveals its originating turn in a popover. | ⬜ | `components/renderers/notebook.ts`, `components/graph-popover.ts`, `components/views/*` | a tool-result turn shows its inline artifact; a node popover shows its source turn; cells |
| B.4 | **Anchored inquiry** — selecting nodes and asking composes a context-anchored turn (exists as `graph.ask-selection`); the answer highlights/creates the nodes it references and carries provenance. | 🟡 | `components/renderers/graph.ts`, `components/composer-focus.ts`, `core/commands.ts` | ask-from-selection round-trips; answer links to created nodes; cell |
| B.5 | **Provenance walk** — from any claim, *trace* opens the derivation subgraph and narrates it step-by-step (truth algebra per step) with a step scrubber. | 🟡 | `core/graph-projection.ts`, `components/overlays/explain.ts`, `components/timeline-scrubber.ts` | a `graph.trace` command opens the derivation; each step shows premises→conclusion; cell |
| B.6 | **Curation & modeling** — the graph is an *editor*: promote a turn to a concept, annotate, retitle, revise truth (f,c), merge/split, draw a new link. Every edit is a reversible workspace action. | ⬜ | `components/graph-viewport.ts`, `components/overlays/*`, `core/store.ts`, `core/undo.ts` (new) | edit truth/link/annotation in place; undo reverses; unit + cell |
| B.7 | **Timeline binds both projections** — scrubbing time filters chat *and* graph to the same moment; playback animates both in lockstep. | 🟡 | `components/timeline-scrubber.ts`, `core/store.ts`, `components/renderers/*` | scrub updates both projections; playback is synchronized; cell |

---

## H — Help, Discoverability & Onboarding (M×6)

> The keyboard/command reference is **generated at runtime from the registries** and shown in a
> popup/help system. It is never a static, hand-written documentation file — adding a command or
> shortcut updates the help with no doc edit, so help cannot drift from behavior.

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| H.1 | **Dynamic help system** — `?` opens a runtime-generated overlay built from `paletteCommands()` + a `shortcuts.ts` source of truth: searchable, grouped, each row showing shortcut · description · live availability. | ⬜ | `components/overlays/help.ts` (new), `core/shortcuts.ts` (new), `core/commands.ts` | help reflects live commands/shortcuts; adding a command updates help with no file edit; cell |
| H.2 | **Contextual help** — `?` is context-sensitive (composer help in the composer, graph help in the graph); `explain <command>` narrates a command's behavior and args. | ⬜ | `components/overlays/help.ts`, `core/commands.ts` | context changes help contents; explain works; cells |
| H.3 | **Interactive tour** — first-run tour of the core loop (send → see → inspect → ask-selection → palette → bridge), from `demo`-style chaining; skippable and replayable from help. | ⬜ | `core/tours.ts` (new), `components/overlays/help.ts`, `core/commands.ts` | tour runs; first-run prompt; replay from `?`; cell |
| H.4 | **Empty-state teaching** — every empty state (graph · notebook · search · chat · palette-no-match · panel) offers the *next* action as a button/shortcut, not prose; shared action slot. | ⬜ | `components/primitives/empty-state.ts`, `components/app-layout.ts`, `components/chat-history-panel.ts`, `components/overlays/palette.ts` | each empty state has a keyboard-reachable action; cells |
| H.5 | **Contextual hints & progressive disclosure** — dismissible first-use hints (graph · composer · timeline); advanced affordances appear only once their prerequisite exists; a "reset hints" action in Settings. | ⬜ | `core/hints.ts` (new), `components/graph-toolbar.ts`, `components/input-hud.ts`, `components/timeline-scrubber.ts` | hints show once, persist, reset; affordances gated on availability; cells |
| H.6 | **Docs generated from data** — the runtime help *and* `docs/readme/ui-gallery.md` both read the registries; a check fails if a surface/command lacks help metadata. | ⬜ | `core/surface-codegen.ts`, `scripts/build-gallery.ts`, `scripts/generate-visual-cells.ts` | docs-as-code check; no stale docs; help metadata required |

---

## R — Recover & Feedback (M×4)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| R.1 | **Toast / notification system** — a non-modal transient surface (`zIndex.layers.toast` already reserved) with severity, auto-dismiss, action slot, stacking manager; the sink every non-fatal event routes to. | ⬜ | `components/toast-host.ts` (new), `core/toasts.ts` (new), `core/error-taxonomy.ts` | `toast.show(...)` stacks, auto-dismisses, runs an action; `role=status`; cell |
| R.2 | **Auto-retry with visible status** — transient errors (connection, network) retry with exponential backoff, surfacing attempt count and Cancel in the banner/toast, not a modal. | ⬜ | `core/retry.ts` (new), `core/ws-client.ts`, `components/connection-banner.ts` | a transient failure retries N times, visible, cancellable; terminal failure escalates; unit test |
| R.3 | **Specific recovery actions** — audit the 16 error classes so each action is concrete (`Reconnect` · `Reload provider` · `Open Settings: <field>` · `Retry command`) rather than generic; add *copy diagnostics*. | ⬜ | `core/error-taxonomy.ts`, `components/error-boundary.ts` | each class maps to a specific action; copy-diagnostics copies code+surface+detail; unit test per class |
| R.4 | **Inline validation, commit-blocking** — Settings and composer surface validation errors inline with fix hints and block the commit until valid (no silent degrade). | 🟡 | `components/config-hud.ts`, `components/composer-focus.ts`, `core/command-schemas.ts` | invalid config shows inline error + hint and is not committed; invalid args show why; unit test |

---

## S — Scale & Performance (M×4)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| S.1 | **Graph virtualization / LOD** — above a threshold, render aggregate clusters/decimated edges and detail on demand, reusing `decimate`/`virtualize`; a 10k-node graph stays interactive. | ⬜ | `core/graph-lod.ts` (new), `components/graph-viewport.ts`, `core/performance-budget.ts` | threshold engages LOD; interaction under budget; large-graph cell |
| S.2 | **Progressive projections** — large projections yield in time-sliced chunks so streaming never janks a frame. | ⬜ | `core/workspace-projection.ts`, `core/workspace-bindings.ts`, `core/performance-budget.ts` | a large workspace projects without a >16ms block; unit test; budget asserted |
| S.3 | **Worker offload** — layout/decimation/similarity run in a Web Worker when available, main-thread fallback; the worker boundary is a capability, not a requirement. | ⬜ | `workers/graph.worker.ts` (new), `core/worker-client.ts` (new), `components/graph-viewport.ts` | layout offloads when supported; identical output either way; fallback tested |
| S.4 | **Interaction budgets** — assert `PerformanceBudget` for input latency and frame budget; a dev-only live overlay. | 🟡 | `core/performance-budget.ts`, `tests/visual/matrix.ts`, `components/telemetry-panel.ts` | latency/frame budgets asserted; dev overlay; cell |

---

## P — Portability & Action (M×5)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| P.1 | **Session export/import** — serialize the whole session (graph · chat · config · lens/layout · panel state) to portable JSON, and import it back; complements config-only Profiles. | ⬜ | `core/session-serialize.ts` (new), `components/overlays/settings.ts`, `core/commands.ts` | `session.export`/`session.import` round-trip a workspace; shareable link restores it; unit + cell |
| P.2 | **Deep-link completeness** — every URL-addressable slice round-trips (renderer · lens · layout · selection · timeline · panels · config). | 🟡 | `core/store.ts`, `core/url-state.ts` | a link restores the exact view; round-trip survives reload; cell |
| P.3 | **Advanced selection** — box/lasso select, additive/invert, and *create subgraph from selection*. | 🟡 | `components/graph-viewport.ts`, `components/graph-toolbar.ts` | box/lasso works; subgraph extraction; cell |
| P.4 | **Undo/redo journal** — a bounded action journal over workspace mutations (fold · selection · layout · hide · edit) with `⌘Z`/`⌘⇧Z`. | ⬜ | `core/undo.ts` (new), `core/store.ts`, `components/app-layout.ts` | workspace actions undo/redo; keys bound; unit + cell |
| P.5 | **Command history panel** — executed commands (from `command-history.ts`) with re-run and argument recall, distinct from the palette MRU. | ⬜ | `components/command-history-panel.ts` (new), `core/command-history.ts` | panel lists history; re-run replays; args recalled; cell |

---

## I — Inclusivity (M×4)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| I.1 | **Fold `surfaceA11y` into `test:a11y`** — every surface declares role/label/focus order; the gate asserts them from descriptors. | ⬜ | `core/surface-codegen.ts`, `tests/a11y/*` (new), `package.json` | `test:a11y` green; a surface without targets fails |
| I.2 | **Focus management across dynamic content** — overlays, streaming content, and new blocks move focus predictably and restore it on close; the overlay manager owns a focus stack. | ⬜ | `core/overlay-manager.ts`, `core/overlay-host.ts`, `components/app-layout.ts` | focus returns to opener on close; new content announced; test |
| I.3 | **Live-region vocabulary** — one `announce()` seam (extend `announcer.ts`) for streaming, timeline, toast, errors; role chosen by severity. | 🟡 | `core/announcer.ts`, `components/*` | screen readers hear streaming/status/errors; no duplicates; test |
| I.4 | **High-contrast + reduced-motion end-to-end** — a `contrast: 'normal' | 'high'` config with tokens; all animations gate on reduced motion. | ⬜ | `core/store.ts`, `styles/tokens.*`, `utils/theme.ts` | `state-contrast` cell; motion no-ops under reduce; tokens generated |

---

## T — Touch & Responsive (M×3)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| T.1 | **Touch gestures for the graph** — pinch-zoom, two-finger pan, tap-select, long-press context, over the existing viewport events. | ⬜ | `components/graph-viewport.ts`, `components/renderers/graph.ts` | gestures work on touch; no pointer regression; test where feasible |
| T.2 | **Mobile composer & HUD** — collapse to a mobile layout at the narrow breakpoint; mode bar scrolls; send is thumb-reachable. | ⬜ | `components/input-hud.ts`, `components/composer-focus.ts`, `components/workspace-hud.ts` | narrow cell shows mobile layout; all actions reachable; a11y targets |
| T.3 | **Swipe panels** — left/right panels open/close by swipe at the narrow breakpoint. | ⬜ | `components/app-layout.ts` | swipe toggles panels; keyboard parity; test |

---

## M — Maintainability (the invariant every item ends on)

- **Every new surface/state/scenario ends with a committed cell** (`visual-coverage.test.ts`).
- **Every cross-cutting axis ends with a contract test** (session round-trip, a11y targets, bridge
  sync, retry, craft).
- **Budgets** (S) are asserted, not aspirational.
- **`ui:verify` is the one gate**; a red `typecheck`/coverage/baseline/a11y/craft blocks a commit.

---

## What we will NOT do (restraint)

Design includes saying no. These are deliberate non-goals with revisit conditions:

| Won't | Why | Revisit when |
|---|---|---|
| **O6 3D renderer** | 2D + LOD (S.1) covers scale; 3D adds cost without unlocking a usability gap. | A 3D affordance proves to do something 2D cannot. |
| **O11 External plugin loader** | The in-repo contribution point (X.4) covers extensibility; no external consumer yet. | A third-party plugin consumer exists. |
| **O12 Arbitrary token overrides** | dark + light + high-contrast (I.4) covers inclusivity; free overrides risk incoherence. | A validated theme editor is justified. |
| **O13 i18n** | No locale requirement yet; strings are centralized enough to extract later. | A locale is required. |
| **Ornamental animation** | Motion must convey state or continuity. | Never. |
| **New top-level chrome** | Every addition must remove one; HUD stays ≤ 7 primaries (D.3). | Never without a removal. |
| **Modal for recoverable errors** | Recoverable failures route to toast/retry (R). | Never. |

---

## Architectural Recommendations (from this review)

| Rec | Description | Related |
|-----|-------------|---------|
| **PR1** | Build the help overlay and the global key handler from one `shortcuts.ts` table, so the reference can never drift from behavior. | H.1, H.2 |
| **PR2** | Route every non-fatal event through one `toasts.ts` sink; the boundary stays for fatal/promoted errors only. | R.1, R.2 |
| **PR3** | Time-slice heavy projections and offload layout to a worker behind a capability gate; never block the frame. | S.2, S.3 |
| **PR4** | Own the bridge as first-class store state: shared focus/selection + a semantic-zoom coordinate; projections render it, they do not own it. | B.1, B.2 |
| **PR5** | Serialize the whole session behind a versioned Zod schema; config Profiles stay a subset. | P.1, P.2 |
| **PR6** | One `announce()` seam for all live regions; severity chooses the role. | I.3 |
| **PR7** | One icon registry + one token vocabulary; a craft gate forbids drift. | D.1, D.2, D.5 |
| **PR8** | Generate help and docs from the same descriptors the palette/keys read. | H.1, H.6 |

---

## Current State (this review)

### What's Working (Green)
- **Registry-driven architecture**: surface, overlay, renderer, command, lens, layout, view-adapter
- **Workspace substrate**: pure, deterministic `WorkspaceGraph` projection with budgets
- **Command system**: one registry; palette + agent `ui.command` share source; Zod args
- **Visual contract**: `VISUAL_CELLS` + coverage + gallery — 51/51 cells
- **Config/URL**: unified Zod schema, persistence, URL mirroring, Settings-generated form, Profiles
- **Control & narration**: floating composer, control mode w/ HUD stop + abort, demonstrations
- **Interaction quality**: incremental graph growth, chat clusters w/ fold, graph polish
- **Error taxonomy**: 16 typed error classes with recovery affordances
- **Adaptability**: dark/light/auto, density, reduced motion, responsive

### What's Partial (Yellow)
- **Bridge**: `graph.ask-selection` and block `children` exist; cross-view sync, morph, provenance walk, and curation are not yet continuous (B)
- **Inline validation**: schema validates, but composer/settings don't always block invalid input (R.4)
- **Advanced selection / timeline binding**: multi-select via toolbar; box/lasso, subgraph, and lockstep scrub missing (P.3, B.7)
- **Interaction budgets & live regions**: projection budgets asserted; latency/frame and one announce seam not (S.4, I.3)

### What's Missing (Red)
- **Craft**: emoji chrome, no icon system, token gaps, no craft gate (D)
- **Discoverability**: help is a static `/help` label; no generated reference, tour, or hints (H)
- **Non-modal feedback**: no toast system, no auto-retry (R)
- **Scale**: no graph LOD, progressive projections, or worker offload (S)
- **Portability**: no session export/import, undo/redo, or command-history panel (P)
- **Inclusivity gate**: targets generated but not gated; no focus stack or high-contrast (I)
- **Touch**: no gestures or mobile composer (T)

---

## Immediate Next Steps (Priority Order)

### W0 — Craft & paradigm footholds (do first, quietly)
1. **D.1 Icon primitive + registry** — the cheapest, highest-visibility craft win; replaces emoji chrome.
2. **H.1 Dynamic help system** — the highest discoverability win; one `shortcuts.ts` drives both the handler and the `?` overlay.
3. **R.1 Toast system** — the `zIndex.layers.toast` slot is reserved; a sink unblocks all later feedback.
4. **B.1 Cross-view identity & sync** — the paradigm's foundation: one shared focus/selection across projections.

### D — Design system
5. **D.2–D.5** Token completeness · chrome audit · motion system · craft gate.

### B — The bridge
6. **B.2–B.7** Semantic zoom · inline manifestations · anchored inquiry · provenance walk · curation/modeling · timeline binding.

### H — Help
7. **H.2–H.6** Contextual help · tour · empty-state teaching · hints · docs-from-data.

### R — Recover
8. **R.2–R.4** Auto-retry · specific recovery · inline validation.

### S — Scale
9. **S.1–S.4** LOD · progressive projections · worker offload · interaction budgets.

### P — Portability
10. **P.1–P.5** Session · deep links · selection · undo/redo · command history.

### I / T — Inclusivity & touch
11. **I.1–I.4** a11y gate · focus stack · announce seam · high-contrast.
12. **T.1–T.3** Gestures · mobile composer/HUD · swipe panels.

### Deferred (revisit deliberately)
13. **O6** Graph3D · **O11** plugin loader · **O12** token overrides · **O13** i18n.

---

## Key Files Reference

| Area | Files |
|------|-------|
| **Substrate** | `core/workspace-projection.ts`, `core/workspace-graph.ts`, `core/performance-budget.ts` |
| **Bridge** | `core/store.ts`, `core/semantic-zoom.ts` (new), `components/workspace-host.ts`, `core/undo.ts` (new) |
| **Design** | `components/primitives/icon.ts` (new), `core/icons.ts` (new), `styles/tokens.*`, `scripts/build-tokens.ts` |
| **Help** | `core/shortcuts.ts` (new), `core/tours.ts` (new), `core/hints.ts` (new), `components/overlays/help.ts` (new) |
| **Commands** | `core/commands.ts`, `core/command-schemas.ts`, `core/command-history.ts` |
| **Feedback** | `core/error-taxonomy.ts`, `core/toasts.ts` (new), `core/retry.ts` (new), `components/error-boundary.ts` |
| **Graph** | `components/graph-viewport.ts`, `components/renderers/graph.ts`, `core/graph-lod.ts` (new) |
| **Inclusivity** | `core/announcer.ts`, `core/surface-codegen.ts`, `tests/a11y/*` (new) |
| **Tests** | `tests/visual/matrix.ts`, `tests/components/visual-coverage.test.ts`, `tests/craft/*` (new) |

---

## Commands Reference

```bash
pnpm --dir ui dev:client          # Vite dev server
pnpm --dir ui typecheck           # TypeScript check
pnpm --dir ui test:unit           # Vitest unit tests
pnpm --dir ui test:e2e            # Playwright E2E
pnpm --dir ui test:visual:ci      # Visual CI + gallery
pnpm --dir ui test:a11y           # Accessibility gate (I.1)
pnpm --dir ui test:craft          # Icon/emoji · contrast · motion gate (D.5)
pnpm --dir ui ui:verify           # One gate: typecheck + unit + visual:ci + a11y + craft + gallery
pnpm --dir ui ui:gallery          # Build contact sheet
```

---

## Decisions & open questions

Carried from v7/v8 (still in force): **O1** Linux-only baselines · **O2** commit baselines, gallery
local · **O3** `ENABLE_WEB_UI=true pnpm bot` is the usability bar · **O4** no CI, local gates · **O5**
real offline LM in scenarios, no mocks · **O9** typecheck clean is hard · **O10** one commit per item.

New / revisited — see **What we will NOT do** for O6/O11/O12/O13 revisit conditions. Additionally:

- **O15 Extend, do not reinvent** — v9 extends v8: the registries, command source, projection, and
  visual contract are sound. v9 adds *craft* (D), *the bridge* (B), *generated help* (H), *feedback*
  (R), *scale* (S), *portability* (P), *inclusivity* (I) and *touch* (T) — it does not re-architect.
- **O16 The bridge is one coordinate, not three modes** — semantic zoom is store state, so every
  projection renders the same focus/selection/zoom; no view owns the bridge.

---

## Priority Execution Order

| Priority | Actions | Rationale |
|---|---|---|
| **W0** | D.1 (icons) + H.1 (dynamic help) + R.1 (toasts) + B.1 (cross-view sync) | Craft + discoverability + feedback + the paradigm foothold, for the least surface |
| **D** | D.2–D.5 (tokens, chrome audit, motion, craft gate) | The foundation every later item inherits |
| **B** | B.2–B.7 (morph, inline, anchored, provenance, curation, timeline) | The paradigm: one substance, three lenses |
| **H** | H.2–H.6 (contextual help, tour, empty states, hints, docs) | Learnability: a first-run user self-serves |
| **R** | R.2–R.4 (retry, specific recovery, validation) | Recoverability: failures are actionable |
| **S** | S.1–S.4 (LOD, progressive, worker, budgets) | Scale: large workspaces stay interactive |
| **P** | P.1–P.5 (session, deep links, selection, undo, history) | Portability & control |
| **I/T** | I.1–I.4, T.1–T.3 | Inclusivity & touch fold into the phases |
| **Deferred** | O6, O11, O12, O13 | Revisit deliberately (conditions above) |

---

## Session Start Checklist

- [ ] `pnpm --dir ui typecheck` — green
- [ ] `pnpm --dir ui test:unit` — 440 passing
- [ ] `pnpm --dir ui test:visual:ci` — 51 cells, all passing
- [ ] `pnpm --dir ui test:a11y` / `test:craft` — gates exist (I.1/D.5) once wired
- [ ] `pnpm --dir ui ui:verify` — green
- [ ] Review `TODO.ui.9.md` for current priority

---

## First move

**v8 is landed.** All P0–P4, X/C/A and P2/P3 items are complete. v9 opens the **cognitive workspace**:
craft (D) → the bridge (B) → help (H) → recovery (R) → scale (S) → portability (P), with inclusivity
(I) and touch (T) folded in.

**Next: W0.** Four footholds, taken together because each is cheap and each unblocks a phase:
**D.1** (one icon set replaces emoji chrome), **H.1** (one `shortcuts.ts` drives both the key
handler and the generated `?` overlay), **R.1** (a toast sink for every non-fatal event), and **B.1**
(one shared focus/selection across projections). Craft, discoverability, feedback, and the paradigm's
foundation — for the least surface. Together they set the bar the bridge is then built to.

---

## Landed in v8 (for provenance)

**P0** harness unblocking · **P1** agent-driven UI (floating composer, command execution, Zod args) ·
**P2** interaction quality (incremental graph growth, chat clusters, composer sweep, graph polish) ·
**P3** control & narration (control mode w/ HUD stop + abort, demonstrations) · **P4** productization
(bridge, standalone, performance budgets, error taxonomy) · **X** extensibility · **C**
configurability · **A** adaptability. 51/51 cells, 440/440 units, `ui:verify` green.
