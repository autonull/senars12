# TODO.ui.9.md — The Cognitive Workspace (paradigm, expressivity & craft)

> **Relationship.** Supersedes `TODO.ui.8.md` for all open work. v8 is the landed record:
> **P0** (harness), **P1** (agent-driven UI), **P2** (interaction quality), **P3** (control &
> narration), **P4** (productization), and the cross-cutting **X/C/A** workstreams are complete.
> v9 makes the *existing* substance real: one knowledge substrate seen through several projections,
> made **expressive, legible, discoverable, recoverable, and continuously bridged** — without adding
> features for their own sake. It keeps the visual contract and `ui:verify` as standing invariants
> and holds a hard line on **restraint**.
> Stable id tags (`2.x`, `5.x`, `7.x`) are kept so old provenance still resolves.
>
> **v9 is a delivery plan, not a wish-list.** Research-grade items (semantic-zoom morph, graph
> editor, LOD, worker offload, undo/redo, touch) are moved to a **v10 exploration backlog** with
> revisit conditions. The v9 phases below are the ~8–10 week scope that makes the product feel
> complete against what is already built.

---

## The paradigm: one substrate, many projections

**The claim.** In SeNARS there is no "chat" and no "graph" — there is one `WorkspaceGraph` (blocks ·
links · roots · kinds · **truth(f,c)** · **priority** · provenance), projected into several views.
**Chat** is its temporal/linear projection. The **Notebook** is its document/hierarchical
projection. The **Graph** is its spatial/relational projection. They are one substance seen three
ways, and a block keeps one identity across all of them.

```
                    ┌──────────────────────────────────────┐
                    │            WorkspaceGraph             │
                    │  blocks · links · roots               │
                    │  kind · truth(f,c) · priority · prov. │
                    └───────────────────┬──────────────────┘
          ┌────────────────────┬────────┴────────┬────────────────────┐
          ▼                    ▼                 ▼                    ▼
    ┌───────────┐        ┌───────────┐     ┌───────────┐       (future projections)
    │   Chat    │ ⇄⇄⇄⇄⇄  │ Notebook  │ ⇄⇄  │   Graph   │
    │  linear   │        │ document  │     │  spatial  │
    │ temporal  │        │hierarchic │     │relational │
    └───────────┘        └───────────┘     └───────────┘
          └───────── shared focus/selection · timeline ─────────┘
```

**Why it matters.** A chatbot forgets; a graph is inert; a document is flat. SeNARS keeps the
*structure* — kinds, **truth values, priorities**, derivations, links — so the UI can let a user move
fluidly between **saying**, **reading**, and **seeing**. The interface's job is not to place features
side by side, but to make one substance legible through several lenses.

**The bridge is the paradigm.** The bridge is the *property* that a block, its selection, its focus,
and its provenance are continuous across projections. **Chat is where you speak; the graph is where
the knowledge lives; the notebook is where you read the argument.**

**The cognitive workspace.** The user is not "chatting with a bot." They are co-reasoning with an
auditable machine. The UI must make the cognitive architecture *legible* — beliefs vs goals, **truth
and priority**, contradiction, budget — without becoming a control panel.

---

## Design principles (HCI, applied — not decoration)

| Principle | Concrete, testable property |
|---|---|
| **Progressive disclosure** | Advanced affordances appear only when their prerequisite exists; the default surface is quiet. |
| **Recognition over recall** | Every action is discoverable from a visible affordance or the generated `?` help; nothing requires an undocumented key. |
| **Overview first, detail on demand** | Minimap + lens; full detail (truth, priority, provenance) on selection. |
| **Expressivity is visible, never hidden** | Truth (f,c) and priority are encoded at a glance and legended; the system's subtlety is shown, not buried. |
| **Visibility of system status** | Connection, streaming, budget, retry always visible, never modal. |
| **User control & freedom** | Escape closes; cancel for every long operation; no dead ends. |
| **Consistency** | One component per role; one command source for palette/keys/agent; one token vocabulary. |
| **Error prevention** | Invalid input blocked inline with a fix hint. |
| **Aesthetic, minimalist design** | Restraint: no ornament without function; one icon set; quiet color. |
| **Help & documentation** | Generated at runtime from the registries, contextual, online — never a stale manual. |
| **Miller / chunking** | HUD chrome ≤ ~7 primary controls; the rest lives in the palette and help. |

---

## Findings from the visual review (evidence, not opinion)

Reviewing the generated gallery artifacts surfaced concrete, fixable problems that v9 must own:

| Finding | Evidence (cells) | v9 item |
|---|---|---|
| **Graph crashes and the crash is baked into the baseline** — `Uncaught TypeError: Cannot read properties of null (reading '$')`. Root cause: `graph-viewport.ts:140` runs `this.syncWorkspaceLayer(this.cy!)` via `watchWith`, which fires on subscribe *before* `firstUpdated()` creates `cy`; the non-null assertion defeats the `syncGraph` guard at line 713. | `graph-belief-bootstrap`, `graph-medium` | **F.1** |
| **Truth values are invisible on graph nodes** — node labels show terms only; the notebook header shows `f1.00 c0.42` but the graph shows nothing. The system's core expressivity is hidden. | all `graph-*` cells | **V.1** |
| **Priority / attention is invisible** — node size/heat does not encode priority or decay. | all `graph-*` cells | **V.2** |
| **Runaway / duplicate labels** — `derived:derived:derived:…` exploded labels, and symmetric duplicates (`(cat<->dog)` & `(dog<->cat)`, `(fish<->robin)` & `(robin<->fish)`). Legibility collapses at medium density. | `graph-*`, `graph-medium` | **V.3, V.4** |
| **Two competing toolbars** — top `graph-toolbar` (zoom · Fit · search · layout · Minimap · 3D · Table · Config · Design · status) and bottom `workspace-hud` (TOC · panels · renderers · Thread/Concepts · settings · palette · provider) duplicate entry points (Settings as "Config" *and* "⚙"; palette twice). | `overlay-palette`, `overlay-settings`, `graph-*` | **C.1, C.2, C.3** |
| **Floating chrome occludes content** — the bottom HUD floats above the composer and overlaps the last notebook block. | `notebook`, `overlay-settings` | **C.2, C.5** |
| **Emoji chrome** — `☰ ⏱ 📈 🗺 ⚙ ⌘K ⬢ ■ ≡ ▪▾` render inconsistently and read as prototype. | all cells | **D.1** |
| **Good and to keep** — the palette, the Settings overlay (sectioned, generated), and the notebook body (readable, `f/c` chips, fold) are clean. | `overlay-palette`, `overlay-settings`, `notebook` | — |

> The rest of this plan is organized around fixing these, in the order that earns the most usability
> for the least surface.

---

## Gates (must stay green)

| Gate | Command | Guards |
|---|---|---|
| Types | `pnpm --dir ui typecheck` | compile-time invariants |
| Units | `pnpm --dir ui test:unit` | projection, registries, commands, coverage |
| Behaviour | `pnpm --dir ui test:e2e` | real boot path scenarios (offline LM, O5) |
| Visual | `pnpm --dir ui test:visual:ci` | baselines + `ui:gallery` contact sheet |
| A11y | `pnpm --dir ui test:a11y` | generated `surfaceA11y` targets (**I.1**) |
| Craft | `pnpm --dir ui test:craft` | icon/emoji lint, contrast, motion scale (**D.4**) |
| **One command** | `pnpm ui:verify` | typecheck + unit + visual:ci + a11y + craft + gallery |

CI/GitHub stays off (O4). `pnpm ui:gate` remains the fast type+unit gate.

## Dependency spine

```
   F ─▶ V ─▶ C ─▶ D          (F fix the floor · V expressivity · C consolidate · D craft)
   │    │    │    │
   ▼    ▼    ▼    ▼
   H    R    B    P          (H help · R recover · B bridge-hardening · P portability)
    ╲   ╲   ╱   ╱
      I   M   (I inclusivity · M the invariant every item ends on)
```

- **F Fix** — the crash and label floor; nothing above a broken baseline counts.
- **V Visualization & expressivity** — make truth and priority legible; the system's subtlety.
- **C Consolidation & chrome** — one information architecture; ergonomics from the screenshots.
- **D Design system & craft** — icons, tokens, motion, the craft gate.
- **H Help · R Recover · B Bridge (harden) · P Portability · I Inclusivity** — the envelope.
- **M Maintainability** — the invariant every item ends on.

---

## F — Fix the floor (M×3) — do first

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| F.1 | **Null-`cy` crash in the graph** — guard every `watchWith`/event path that touches `cy`; remove the `this.cy!` assertions in favour of an early return (the `watchWith` fires before `firstUpdated`). | ⬜ (verified) | `components/graph-viewport.ts:140,207,499-503` | no `reading '$'` on boot/teardown; all `graph-*` cells regenerate without the error modal; unit/e2e guard |
| F.2 | **Baseline hygiene** — regenerate the affected baselines so the crash modal is no longer committed; add a check that fails if an error-boundary modal appears in a non-error cell. | ⬜ | `tests/visual/baselines/chromium/*`, `tests/visual/reporter.ts`, `tests/visual/matrix.ts` | no baseline contains the error modal; a guard catches regressions |
| F.3 | **Label explosion guard** — cap/elide runaway derived labels (`derived:derived:…`) at the projection and render layers so a single node can never blow out the viewport. | ⬜ | `core/workspace-projection.ts`, `components/graph-viewport.ts` | a derived chain renders as a bounded label with full text on hover; unit + cell |

---

## V — Visualization & Expressivity (M×5) — the system's subtlety made visible

> Truth values and priorities are *what give SeNARS expressivity and subtlety*. They must be shown
> at a glance, legended, and never hidden behind a click. This is the heart of v9.

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| V.1 | **Truth-value legibility (`f, c`)** — every belief/goal node encodes frequency and confidence on distinct channels (e.g. fill hue/intensity = `f`; border/opacity or a dual-arc = `c`); the notebook keeps its `f… c…` chips; questions render distinctly (no truth). | ⬜ | `components/graph-viewport.ts`, `components/renderers/notebook.ts`, `utils/theme.ts` | each node shows `f,c` at a glance; a legend explains the encoding; cells |
| V.2 | **Priority / attention legibility** — priority (attention/stimulus) is a *separate* channel from truth (size · halo · heat) and visibly decays over time; a "recent/priority" filter. | ⬜ | `components/graph-viewport.ts`, `core/store.ts`, `utils/theme.ts` | priority is distinguishable from truth; decay is visible; a lens/filter; cells |
| V.3 | **Label legibility** — elide long terms, full text on hover/selection; consistent casing; no label collisions at medium density. | ⬜ | `components/graph-viewport.ts`, `components/graph-popover.ts` | long labels elide; full text on demand; density cell |
| V.4 | **Canonicalization & dedup** — symmetric relations and repeated derivations collapse at the projection layer (one node per canonical term; aggregate multiplicities) so the graph shows *structure*, not artifacts. | ⬜ | `core/workspace-projection.ts`, `core/graph-projection.ts` | `(a<->b)` and `(b<->a)` are one node; duplicates aggregate; unit + cell |
| V.5 | **Legend, "color by", and lenses** — a compact legend for the active encoding; a "color by: truth \| priority \| kind" control; a truth lens and a priority lens. | ⬜ | `components/graph-toolbar.ts`, `utils/lens-catalog.ts` | the encoding is always explained; "color by" switches it; cells |

---

## C — Consolidation & Chrome (M×5) — ergonomics from the screenshots

> Two toolbars, duplicated entries, and floating chrome that occludes content. Simplify the shell
> into one coherent information architecture **without losing a capability** — every control keeps a
> home (top bar, bottom bar, palette, or help).

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| C.1 | **One information architecture** — collapse `graph-toolbar` (top) and `workspace-hud` (bottom) into a planned shell: **top = context** (renderer · lens · layout · layer · search · zoom), **bottom = composer + essentials** (mode · send · status), **palette = everything else**. | ⬜ | `components/app-layout.ts`, `components/graph-toolbar.ts`, `components/workspace-hud.ts` | no function lacks a home; ≤ 7 primaries per bar; before/after cells |
| C.2 | **One bottom bar, no overlap** — merge the floating HUD into the composer strip; reserve layout space so nothing occludes content (fixes the notebook last-block overlap). | ⬜ | `components/app-layout.ts`, `components/input-hud.ts`, `components/composer-focus.ts` | no element overlaps content; composer height reserved; narrow cell |
| C.3 | **De-duplicate entries** — one Settings entry, one palette trigger, one renderer switch; remove redundant affordances and emoji duplicates. | ⬜ | `components/*` | each action appears once in chrome; a control-count check; cells |
| C.4 | **Panel consolidation** — Search · Chat · Lens Designer dock as **one dockable panel system** (tabbed) rather than competing left/right docks. | ⬜ | `components/app-layout.ts`, `components/primitives/panel.ts` | one dock, tabbed; panels switch in place; cells |
| C.5 | **Status consolidation** — connection · provider · budget · streaming collapse into one status cluster (with the toast/live-region sink **R.1/I.3**), not three separate badges. | ⬜ | `components/connection-banner.ts`, `components/lm-status-panel.ts`, `components/workspace-hud.ts` | one status surface; severity routes to live regions; cells |

---

## D — Design System & Craft (M×4) — the foundation

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| D.1 | **Icon primitive + registry** — one `<s-icon>` (monochrome, `currentColor`, one grid/stroke); emoji removed from chrome (kept only in empty-state art). | ⬜ | `components/primitives/icon.ts` (new), `core/icons.ts` (new) | every chrome control uses `<s-icon>`; a lint forbids emoji chrome; cells |
| D.2 | **Token completeness** — truth/priority scales (V), lens colors, status, focus ring, radius scale; contrast asserted (AA/AAA); `high-contrast` variant. | ⬜ | `styles/tokens.*`, `scripts/build-tokens.ts`, `utils/theme.ts` | tokens generated; contrast passes; `state-contrast` cell |
| D.3 | **Motion vocabulary** — one set of duration/easing tokens, `reducedMotion`-gated; no decorative motion. | ⬜ | `styles/tokens.*`, `components/*` | motion tokens used everywhere; reduced-motion test; cells |
| D.4 | **Craft gate** — typography scale, line length, focus visibility, z-index order, icon/emoji lint, contrast, motion scale — one `test:craft`. | ⬜ | `tests/craft/*` (new), `package.json` | `test:craft` green; a violation fails it |

---

## H — Help, Discoverability & Onboarding (M×5)

> The keyboard/command reference is **generated at runtime from the registries** and shown in a
> popup/help system — never a static documentation file, so it cannot drift from behavior.

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| H.1 | **Dynamic help system** — `?` opens a runtime-generated overlay from `paletteCommands()` + one `shortcuts.ts`: searchable, grouped, each row showing shortcut · description · live availability. | ⬜ | `components/overlays/help.ts` (new), `core/shortcuts.ts` (new) | help reflects live commands; adding a command updates help with no doc edit; cell |
| H.2 | **Contextual help** — `?` is context-sensitive (composer vs graph); `explain <command>` narrates behavior and args. | ⬜ | `components/overlays/help.ts`, `core/commands.ts` | context changes contents; explain works; cells |
| H.3 | **Empty-state teaching** — every empty state offers the *next* action (button/shortcut), not prose. | ⬜ | `components/primitives/empty-state.ts`, `components/app-layout.ts`, `components/chat-history-panel.ts`, `components/overlays/palette.ts` | each empty state has a keyboard-reachable action; cells |
| H.4 | **Contextual hints (progressive disclosure)** — dismissible first-use hints (graph · composer · timeline); advanced affordances appear only once their prerequisite exists; "reset hints" in Settings. | ⬜ | `core/hints.ts` (new), `components/*` | hints show once, persist, reset; affordances gated; cells |
| H.5 | **Docs generated from data** — runtime help *and* `docs/readme/ui-gallery.md` read the registries; a check fails if a surface/command lacks help metadata. | ⬜ | `core/surface-codegen.ts`, `scripts/build-gallery.ts` | docs-as-code check; no stale docs |

---

## R — Recover & Feedback (M×4)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| R.1 | **Toast / notification system** — non-modal transient surface (`zIndex.layers.toast` reserved) with severity, auto-dismiss, action slot; the sink for every non-fatal event. | ⬜ | `components/toast-host.ts` (new), `core/toasts.ts` (new) | `toast.show(...)` stacks/auto-dismisses/acts; `role=status`; cell |
| R.2 | **Auto-retry with visible status** — transient errors retry with backoff, surfacing attempts and Cancel in the status cluster, not a modal. | ⬜ | `core/retry.ts` (new), `core/ws-client.ts`, `components/connection-banner.ts` | transient failure retries visibly, cancellable; terminal escalates; unit test |
| R.3 | **Specific recovery actions** — audit the 16 error classes for concrete actions (`Reconnect` · `Reload provider` · `Open Settings:<field>` · `Retry command`); add *copy diagnostics*. | ⬜ | `core/error-taxonomy.ts`, `components/error-boundary.ts` | each class maps to a specific action; unit test per class |
| R.4 | **Inline validation, commit-blocking** — Settings and composer surface errors inline with fix hints and block the commit until valid. | 🟡 | `components/config-hud.ts`, `components/composer-focus.ts` | invalid input shows inline error + hint and is not committed; unit test |

---

## B — The Bridge (harden only) (M×3)

> Harden what exists; the research-grade bridge (morph, editor, inline mini-graphs) is **v10**.

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| B.1 | **Cross-view identity & sync** — a block's selection/focus is the same object across projections; selecting in chat highlights in graph and vice versa; optional linked-focus scrolls the peer. | 🟡 | `core/store.ts`, `components/renderers/*`, `components/app-layout.ts` | select in one → highlight/scroll in the other; unit test; cell |
| B.2 | **Anchored inquiry (harden)** — selecting nodes and asking composes a context-anchored turn (`graph.ask-selection` exists); the answer highlights the nodes it references. | 🟡 | `components/renderers/graph.ts`, `components/composer-focus.ts` | ask-from-selection round-trips; answer links to nodes; cell |
| B.3 | **Timeline binds both projections** — scrubbing time filters chat *and* graph to the same moment. | 🟡 | `components/timeline-scrubber.ts`, `core/store.ts` | scrub updates both; cell |

---

## P — Portability (M×2)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| P.1 | **Session export/import** — serialize the whole session (graph · chat · config · lens/layout · panels) to portable JSON; import it back; complements config-only Profiles. | ⬜ | `core/session-serialize.ts` (new), `components/overlays/settings.ts`, `core/commands.ts` | round-trips a workspace; shareable link restores it; unit + cell |
| P.2 | **Deep-link completeness** — every URL-addressable slice round-trips (renderer · lens · layout · selection · timeline · panels · config). | 🟡 | `core/store.ts`, `core/url-state.ts` | a link restores the exact view; cell |

---

## I — Inclusivity (M×3)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| I.1 | **Fold `surfaceA11y` into `test:a11y`** — every surface declares role/label/focus order; the gate asserts them from descriptors. | ⬜ | `core/surface-codegen.ts`, `tests/a11y/*` (new) | `test:a11y` green; a surface without targets fails |
| I.2 | **Focus management** — overlays, streaming content, and new blocks move focus predictably and restore it on close; the overlay manager owns a focus stack. | ⬜ | `core/overlay-manager.ts`, `components/app-layout.ts` | focus returns to opener; content announced; test |
| I.3 | **Live-region vocabulary** — one `announce()` seam (extend `announcer.ts`) for streaming, timeline, toast, status; role by severity; feeds **C.5**. | 🟡 | `core/announcer.ts`, `components/*` | screen readers hear streaming/status/errors; no duplicates; test |

---

## M — Maintainability (the invariant every item ends on)

- **Every new surface/state/scenario ends with a committed cell** (`visual-coverage.test.ts`).
- **Every cross-cutting axis ends with a contract test** (session round-trip, a11y targets, bridge
  sync, retry, craft, no-error-modal-in-cell).
- **`ui:verify` is the one gate**; a red `typecheck`/coverage/baseline/a11y/craft blocks a commit.

---

## v10 — Exploration backlog (deferred research; revisit deliberately)

Moved out of v9 because each is research-grade or lacks a requirement. Kept here with **revisit
conditions** so provenance resolves and the ambition is not lost.

| # | Item | Why deferred | Revisit when |
|---|------|--------------|--------------|
| E.1 | **Semantic-zoom morph** (Chat ⇄ Notebook ⇄ Graph) | Needs a shared coordinate space and layout interpolation across three layout engines; no prior art. | B.1 sync is solid and a design spike proves convergence. |
| E.2 | **Inline micro-visualizations in chat** (mini-graphs, sparklines) | Novel components; marginal utility at current densities. | The chat is the primary projection for a real workflow. |
| E.3 | **Provenance walk** (full derivation scrubber) | Needs engine cooperation for step-level traces in the UI. | Derivation records are exposed to the client. |
| E.4 | **Graph as editor** (revise truth, draw links, merge/split) | Changes the trust model (user edits vs engine derivations) and needs an edit-provenance model. | Editing is a user requirement. |
| E.5 | **Graph LOD / virtualization** (10k nodes) | Cytoscape doesn't virtualize; needs clustering research or an engine swap. | A real workload exceeds ~2k nodes. |
| E.6 | **Worker offload** (layout/decimation) | Layout is main-thread Cytoscape; offload means a new engine. | E.5 is taken. |
| E.7 | **Undo/redo journal** | The atom store isn't transactional; needs a bounded action journal. | Editing (E.4) lands. |
| E.8 | **Touch & mobile** (gestures, mobile composer, swipe panels) | No mobile requirement. | A touch/mobile target is set. |
| O6 | **`renderer:graph3d`** | 2D + LOD covers scale; adds cost without a gap. | A 3D affordance does something 2D cannot. |
| O11 | **External plugin loader** | The in-repo contribution point (X.4 of v8) covers extensibility. | A third-party consumer exists. |
| O12 | **User token overrides** | dark/light/high-contrast covers inclusivity. | A validated theme editor is justified. |
| O13 | **i18n** | No locale requirement; strings are centralized enough to extract. | A locale is required. |

---

## What we will NOT do (restraint)

| Won't | Why |
|---|---|
| **Modal for recoverable errors** | Recoverable failures route to the status cluster/toast (R). |
| **New top-level chrome** | Every addition must remove one; bars stay ≤ 7 primaries (C.1). |
| **Emoji in chrome** | Inconsistent rendering; one icon set instead (D.1). |
| **Ornamental animation** | Motion must convey state or system status (D.3). |
| **Hidden expressivity** | Truth and priority are always legended, never buried (V). |

---

## Architectural Recommendations (from this review)

| Rec | Description | Related |
|-----|-------------|---------|
| **PR1** | Guard every `cy` touch path with an early return; never assert `this.cy!` across a `watchWith` boundary. | F.1 |
| **PR2** | Encode truth and priority on disjoint channels, legended once in one token/legend source. | V.1, V.2, V.5, D.2 |
| **PR3** | Canonicalize/dedup at the projection layer, so every renderer sees structure, not artifacts. | V.3, V.4 |
| **PR4** | Build help and the global key handler from one `shortcuts.ts`; generate docs from the same descriptors. | H.1, H.5 |
| **PR5** | Route every non-fatal event through one `toasts.ts`/`announce()` sink; the boundary stays for fatal only. | R.1, I.3, C.5 |
| **PR6** | One shell IA: top = context, bottom = composer + essentials, palette = the rest. No duplicate entries. | C.1, C.2, C.3 |
| **PR7** | Serialize the whole session behind a versioned Zod schema; config Profiles stay a subset. | P.1, P.2 |

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
- **Notebook & overlays**: readable notebook w/ `f/c` chips; clean palette and Settings
- **Error taxonomy**: 16 typed error classes with recovery affordances
- **Adaptability**: dark/light/auto, density, reduced motion, responsive

### What's Partial (Yellow)
- **Bridge**: `graph.ask-selection`, block `children`, timeline exist; cross-view sync not finished (B.1)
- **Inline validation**: schema validates; composer/settings don't always block (R.4)
- **Deep links**: most slices round-trip; a full audit is pending (P.2)
- **Live regions**: `announcer.ts` exists; one seam not universal (I.3)

### What's Broken / Missing (Red / 🔴)
- 🔴 **Graph crash baked into a baseline** — `Cannot read properties of null (reading '$')` (F.1, F.2)
- 🔴 **Expressivity hidden** — truth and priority are not shown on graph nodes (V.1, V.2)
- 🔴 **Label explosion / duplicates** — `derived:derived:…`, symmetric duplicates (F.3, V.3, V.4)
- **Craft**: emoji chrome, no icon system, token gaps, no craft gate (D)
- **Chrome**: two toolbars, duplicated entries, floating overlap (C)
- **Discoverability**: no generated `?` help, no hints, empty states are prose (H)
- **Non-modal feedback**: no toast system, no auto-retry (R)
- **Inclusivity gate**: targets generated but not gated; no focus stack (I)

---

## Priority Execution Order

| Priority | Actions | Rationale |
|---|---|---|
| **F** | F.1 crash · F.2 baseline hygiene · F.3 label guard | Nothing above a broken baseline counts; the crash is committed today |
| **V** | V.1 truth · V.2 priority · V.3 labels · V.4 dedup · V.5 legend | The system's expressivity + the worst legibility defects |
| **C** | C.1 IA · C.2 one bottom bar · C.3 dedup entries · C.4 panels · C.5 status | Ergonomics and simplicity from the screenshots |
| **D** | D.1 icons · D.2 tokens · D.3 motion · D.4 craft gate | The foundation every later item inherits |
| **H** | H.1 dynamic help · H.2 contextual · H.3 empty states · H.4 hints · H.5 docs | Discoverability: a first-run user self-serves |
| **R** | R.1 toasts · R.2 retry · R.3 recovery · R.4 validation | Recoverability: failures are actionable |
| **B** | B.1 sync · B.2 anchored inquiry · B.3 timeline | Harden the bridge that already half-works |
| **P** | P.1 session · P.2 deep links | Portability |
| **I** | I.1 a11y gate · I.2 focus · I.3 announce | Inclusivity, folded into the shell |
| **v10** | E.1–E.8, O6/O11/O12/O13 | Research; revisit conditions above |

**Estimated v9 scope: ~8–10 weeks** (F 1w · V 2w · C 2w · D 2w · H 1w · R 1w · B/P/I 1w). v10 is
open-ended and scheduled only when a revert condition is met.

---

## Session Start Checklist

- [ ] `pnpm --dir ui typecheck` — green
- [ ] `pnpm --dir ui test:unit` — 440 passing
- [ ] `pnpm --dir ui test:visual:ci` — 51 cells (F.2 clears the crash modal from baselines)
- [ ] `pnpm --dir ui test:a11y` / `test:craft` — gates exist (I.1/D.4) once wired
- [ ] `pnpm --dir ui ui:verify` — green
- [ ] Review `TODO.ui.9.md` for current priority

---

## First move

**F first, then V.** The graph currently ships a *crash* in a committed baseline, and the system's
core expressivity — **truth values and priorities** — is invisible on nodes. So the first work is
**F.1** (guard the null-`cy` paths), **F.2** (regenerate the affected baselines so the error modal is
gone and guarded against), **F.3** (bounded labels), then **V.1/V.2** (encode `f,c` and priority on
disjoint, legended channels), **V.3/V.4** (elide and canonicalize so the graph shows structure, not
artifacts), and **V.5** (legend + "color by"). Then **C** consolidates the shell so this richer graph
sits in a calm, single-IA surface.

---

## Landed in v8 (for provenance)

**P0** harness unblocking · **P1** agent-driven UI (floating composer, command execution, Zod args) ·
**P2** interaction quality (incremental graph growth, chat clusters, composer sweep, graph polish) ·
**P3** control & narration (control mode w/ HUD stop + abort, demonstrations) · **P4** productization
(bridge, standalone, performance budgets, error taxonomy) · **X** extensibility · **C**
configurability · **A** adaptability. 51/51 cells, 440/440 units, `ui:verify` green.

> **Caveat on the green.** The green is real but incomplete: two `graph-*` baselines contain a crash
> modal (`reading '$'`), so "passing" did not mean "correct". **F.2** exists precisely to make a
> green suite mean a correct suite.
