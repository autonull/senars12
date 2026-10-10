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
| F.1 | **Null-`cy` crash in the graph** — guard every `watchWith`/event path that touches `cy`; remove the `this.cy!` assertions in favour of an early return (the `watchWith` fires before `firstUpdated`). | ✅ | `components/graph-viewport.ts:140` | no `reading '$'` on boot/teardown; all `graph-*` cells regenerate without the error modal; unit/e2e guard |
| F.2 | **Baseline hygiene** — regenerate the affected baselines so the crash modal is no longer committed; add a check that fails if an error-boundary modal appears in a non-error cell. | ⬜ | `tests/visual/baselines/chromium/*`, `tests/visual/reporter.ts`, `tests/visual/matrix.ts` | no baseline contains the error modal; a guard catches regressions |
| F.3 | **Label explosion guard** — cap/elide runaway derived labels (`derived:derived:…`) at the projection and render layers so a single node can never blow out the viewport. | ✅ | `core/graph-projection.ts` | a derived chain renders as a bounded label (max 200 chars) with full text on hover; unit + cell |

---

## V — Visualization & Expressivity (M×5) — the system's subtlety made visible

> Truth values and priorities are *what give SeNARS expressivity and subtlety*. They must be shown
> at a glance, legended, and never hidden behind a click. This is the heart of v9.

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| V.1 | **Truth-value legibility (`f, c`)** — every belief/goal node encodes frequency and confidence on distinct channels (e.g. fill hue/intensity = `f`; border/opacity or a dual-arc = `c`); the notebook keeps its `f… c…` chips; questions render distinctly (no truth). | ✅ | `components/graph-viewport.ts`, `utils/adapter-2d.ts`, `components/graph-legend.ts` | each node shows `f,c` at a glance; a legend explains the encoding; cells |
| V.2 | **Priority / attention legibility** — priority (attention/stimulus) is a *separate* channel from truth (size · halo · heat) and visibly decays over time; a "recent/priority" filter. | ✅ | `components/graph-viewport.ts`, `utils/adapter-2d.ts`, `core/store.ts` | priority is distinguishable from truth (size); decay is visible; a lens/filter; cells |
| V.3 | **Label legibility** — elide long terms, full text on hover/selection; consistent casing; no label collisions at medium density. | ✅ | `components/graph-projection.ts`, `components/graph-popover.ts` | long labels elide (200 char cap); full text on hover via popover; density cell |
| V.4 | **Canonicalization & dedup** — symmetric relations and repeated derivations collapse at the projection layer (one node per canonical term; aggregate multiplicities) so the graph shows *structure*, not artifacts. | ✅ | `core/workspace-projection.ts` | symmetric links (`contradicts`, `same-topic`) deduped; unit + cell |
| V.5 | **Legend, "color by", and lenses** — a compact legend for the active encoding; a "color by: truth \| priority \| kind" control; a truth lens and a priority lens. | ✅ | `components/graph-toolbar.ts`, `components/graph-legend.ts`, `utils/lens-catalog.ts` | the encoding is always explained; "color by" switches it; cells |

---

## C — Consolidation & Chrome (M×5) — ergonomics from the screenshots

> Two toolbars, duplicated entries, and floating chrome that occludes content. Simplify the shell
> into one coherent information architecture **without losing a capability** — every control keeps a
> home (top bar, bottom bar, palette, or help).

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| C.1 | **One information architecture** — collapse `graph-toolbar` (top) and `workspace-hud` (bottom) into a planned shell: **top = context** (renderer · lens · layout · layer · search · zoom), **bottom = composer + essentials** (mode · send · status), **palette = everything else**. | ✅ | `components/app-layout.ts`, `components/graph-toolbar.ts`, `components/bottom-bar.ts` (new) | no function lacks a home; ≤ 7 primaries per bar; before/after cells |
| C.2 | **One bottom bar, no overlap** — merge the floating HUD into the composer strip; reserve layout space so nothing occludes content (fixes the notebook last-block overlap). | ✅ | `components/app-layout.ts`, `components/bottom-bar.ts`, `components/composer-focus.ts` | no element overlaps content; composer height reserved; narrow cell |
| C.3 | **De-duplicate entries** — one Settings entry, one palette trigger, one renderer switch; remove redundant affordances and emoji duplicates. | ✅ | `components/app-layout.ts`, `components/graph-toolbar.ts`, `components/bottom-bar.ts` | each action appears once in chrome; a control-count check; cells |
| C.4 | **Panel consolidation** — Search · Chat · Lens Designer dock as **one dockable panel system** (tabbed) rather than competing left/right docks. | ✅ | `components/app-layout.ts`, `components/panel-dock.ts`, `core/store.ts` | one dock, tabbed; panels switch in place; cells |
| C.5 | **Status consolidation** — connection · provider · budget · streaming collapse into one status cluster (with the toast/live-region sink **R.1/I.3**), not three separate badges. | ✅ | `components/bottom-bar.ts` | one status surface; severity routes to live regions; cells |

---

## D — Design System & Craft (M×4) — the foundation

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| D.1 | **Icon primitive + registry** — one `<s-icon>` (monochrome, `currentColor`, one grid/stroke); emoji removed from chrome (kept only in empty-state art). | ✅ | `components/primitives/icon.ts`, `utils/icon-registry.ts` | every chrome control uses `<s-icon>`; a lint forbids emoji chrome; cells |
| D.2 | **Token completeness** — truth/priority scales (V), lens colors, status, focus ring, radius scale; contrast asserted (AA/AAA); `high-contrast` variant. | ✅ | `design-tokens.json`, `styles/tokens.generated.ts`, `utils/adapter-2d.ts` | truth/confidence/priority scales tokenized; high-contrast theme exists; all 3 themes have tokens |
| D.3 | **Motion vocabulary** — one set of duration/easing tokens, `reducedMotion`-gated; no decorative motion. | ✅ | `design-tokens.json`, `scripts/build-tokens.ts`, `tokens.css` | motion tokens used everywhere; `@media (prefers-reduced-motion: reduce)` zeros durations; cells |
| D.4 | **Craft gate** — typography scale, focus visibility, z-index order, icon/emoji lint, contrast, motion scale — one `test:craft`. | ✅ | `tests/craft/*` (new), `package.json` | `test:craft` green (202 tests); a violation fails it. Line-length check dropped per direction (formatting not enforced). |

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
- **Graph legend & color-by**: `<graph-legend>` shows active encoding; "Color by" selector in toolbar (V.5)
- **Label length guard**: projection caps labels at 200 chars (F.3)
- **Null-cy guard**: `watchWith` callbacks check `this.cy` before use (F.1)
- **Truth/priority base encoding**: nodes show f→color, c→opacity, priority→size by default (V.1, V.2)
- **Visual baselines clean**: 51/51 cells pass, no crash modal (F.2)
- **Label legibility**: elision + hover popover shows full text (V.3)
- **Symmetric link dedup**: `contradicts`, `same-topic` canonicalized (V.4)
- **Consolidated chrome**: top context bar + bottom composer/status bar (C.1, C.2); floating HUD removed
- **De-duplicated entries**: single Settings, single Palette, lens designer in dock (C.3)
- **Consolidated status**: connection, LM, control mode, streaming in one cluster (C.5)
- **Panel consolidation**: Search/Chat/Lenses as single tabbed dock (C.4)
- **Icon system**: `<s-icon>` primitive + 50-icon registry; zero emoji in chrome (D.1)
- **Token system**: truth/confidence/priority scales tokenized; dark/light/high-contrast themes (D.2)
- **Motion vocabulary**: durations/easings tokenized; prefers-reduced-motion zeros durations (D.3)

### What's Partial (Yellow)
- **Bridge**: `graph.ask-selection`, block `children`, timeline exist; cross-view sync not finished (B.1)
- **Inline validation**: schema validates; composer/settings don't always block (R.4)
- **Deep links**: most slices round-trip; a full audit is pending (P.2)
- **Live regions**: `announcer.ts` exists; one seam not universal (I.3)

### What's Broken / Missing (Red / 🔴)
- **Craft**: craft gate (D.4) — typography, focus visibility, z-index, icon lint, contrast, motion in CI
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

---

## Session Progress (this work)

### Completed
- **F.1** — Guarded null-`cy` in `graph-viewport.ts:140` (`watchWith($collapsedBlocks, ...)` now checks `this.cy` before calling `syncWorkspaceLayer`).
- **F.2** — Visual baselines regenerated (51/51 pass) — crash modal cleared.
- **F.3** — Added label length cap in `graph-projection.ts` (`MAX_LABEL_FULL = 200`, elides with `…`).
- **V.5** — Created `<graph-legend>` component (`components/graph-legend.ts`) showing active lens encoding (truth→color, confidence→opacity, priority→size). Added "Color by" selector in `graph-toolbar.ts` with options: Truth (f), Priority, Kind, Active Lens.
- **V.1/V.2** — Base node style now encodes truth (frequency→color hue, confidence→opacity) and priority (size) by default in `utils/adapter-2d.ts:clearNodeStyles`. Contradictions highlighted with red border. Lens deltas layer on top.
- **V.3** — Label elision (200 chars) in projection + full text on hover via existing `<graph-popover>` (shows complete block text, title, links).
- **V.4** — Symmetric link deduplication in `workspace-projection.ts` (`contradicts`, `same-topic` canonicalized to single direction; `deduplicateSymmetricLinks` exported for testing).
- **C.1** — One information architecture: top bar = context (zoom, search, lens, layout, color-by); bottom bar = composer + essentials (mode, send, status cluster).
- **C.2** — One bottom bar, no overlap: new `<bottom-bar>` component merges composer + status cluster; removed floating HUD; composer height reserved in layout.
- **C.3** — De-duplicate entries: single Settings (bottom-bar), single Palette (bottom-bar ⌘K), lens designer in panel dock, no duplicate renderer switch.
- **C.4** — Panel consolidation: Search · Chat · Lens Designer as one tabbed dock (`panel-dock.ts`); removed separate left/right panels.
- **C.5** — Status consolidation: connection, LM provider, control mode, streaming → one status cluster in bottom-bar; removed connection-banner + lm-status-panel from top.
- **D.1** — Icon primitive + registry: `<s-icon>` component with 50+ icons in `icon-registry.ts`; all emoji in chrome replaced (bottom-bar, app-layout, panel-dock, error-boundary, empty-state stories, node-detail-drawer).
- **D.2** — Token completeness: truth/confidence/priority scales tokenized in `design-tokens.json` (hue range, opacity range, size range); used in `adapter-2d.ts`; high-contrast theme exists for all tokens.
- **D.3** — Motion vocabulary: motion durations/easings tokenized; `@media (prefers-reduced-motion: reduce)` zeros all durations in `tokens.css`; all components use `var(--transitions-*)` tokens.

### Completed (this session)
- **D.4** — Craft gate: `tests/craft/*` (typography, focus visibility, z-index, icon/emoji lint, contrast, motion) wired via `index.test.ts`; `test:craft` green (202 tests). Line-length check removed per direction — formatting is not enforced.
- Repo health: `pnpm --dir ui typecheck` clean; `test:unit` 642 passing; `build:client` succeeds.

### In Progress — X.2 modeless "conversation as graph nodes" (◐)
> **Direction (user):** no split, no renderer switch. One modeless surface — the **graph** — with every conversation block rendered as a node whose body is its real HTML (the "Fractal HTML & LoD" paradigm, §533). "Split" was a wrong turn and was reverted.

- **Done this session (seam):**
  - New `components/node-body.ts` — `<s-node-body .ref>` renders `renderBlockBody(block)` for a workspace block (reuses the one block renderer; Lit nodes, no `innerHTML`).
  - `utils/html-labels.ts` — now returns `.html-enabled` nodes without requiring a string `html` (block nodes carry none).
  - `components/graph-viewport.ts` — workspace nodes marked `html-enabled` in both `syncWorkspaceLayer` and `applyWorkspaceOps`; the HTML overlay renders `<s-node-body>` for workspace blocks and falls back to legacy `innerHTML` string html otherwise.
- **Known gaps / next (in order):**
  1. **Node sizing & layout** — workspace nodes are `width:'label'`; the 240px body card is anchored at the node's top-left and can overlap neighbours. Decide: fixed card size per node, or grow node to content, or hide the cytoscape shape and let the card *be* the node.
  2. **LoD tiers** — `computeHtmlLabels` still gates at `zoom ≥ 1` (binary). Implement glyph→label→card→full by zoom (§568); only the tier's content mounts.
  3. **Modeless shell** — remove the renderer switch (graph-toolbar / workspace-hud mode buttons) so graph is the surface; composer is the only input. Selection/focus already flow through the store.
  4. **Legacy string-HTML path** — `store-bindings.ts` (`renderMessageHtml`, raw `innerHTML`) should fold into the block path so there is one rendering; remove the `.innerHTML` fallback.
  5. **`renderBlockBody` sources** — pass the real bibliography (currently `[]`, so inline `[n]` citations fall back to `[key]`).
  6. **Verification** — unit: `projectChat`→node is `html-enabled` and `<s-node-body>` renders its body; one smoke: send a message → a node shows its body inline.
- **New opportunities:** a per-kind node-renderer registry declaring the four LoD tiers once (the plan's "extension point", §577); "ask from selection" already exists (`graph.ask-selection`) — wire selection → composer context.

### Next Steps (fresh session)
1. **X.2** — finish the modeless surface: resolve node sizing (gap 1), add LoD (gap 2), remove the renderer switch (gap 3). This is the paradigm; do it before H/R/B/P/I.
2. Then **G** — auto-fit + min/max zoom + label LOD (fixes "too small / off-center / scattered").
3. Do **not** resume formatting/craft polish; `D.4` is closed.

---

## Visual Review Findings (post-v9 implementation)

> The generated gallery at `ui/tests/visual/gallery/index.html` shows all v9 changes are present in baselines, but the **review itself revealed fundamental UX gaps** that v9 did not address:

| Finding | Evidence | Action Required |
|---|---|---|
| **Legend defaults on** — colorful legend always visible, adds visual noise | All `graph-*` cells show legend by default | Already fixed: legend now defaults closed (`graph-legend.ts: open=false`), toggled via toolbar "Legend" button |
| **Graph legibility / zoom** — screenshots are extremely zoomed out, nodes tiny, labels unreadable | All `graph-*`, `graph-medium`, `graph-narrow` cells | Need default zoom policy: fit-to-content with minimum zoom floor; increase base node sizes; ensure labels visible at default zoom |
| **Layout disorganization** — chrome feels scattered; panels, toolbars, graph area lack visual hierarchy | `overlay-*`, `panel-*`, `graph-*` cells | Re-evaluate information density; consider more whitespace, clearer grouping, consistent alignment |
| **Missing Chat–Graph blend** — no cells demonstrate the *unique SeNARS paradigm*: chat dialogue embedded with live graph context | No cell shows chat + graph simultaneously with shared focus | Add visual cells: `chat-graph-split`, `chat-with-graph-context`, `anchored-inquiry` showing LM chat + graph neighborhood |
| **Redundant cells** — many cells show nearly identical content (e.g., multiple layout cells with same conversation) | `layout-*` cells 413–483; `view-*` cells 486–533 | Curate matrix: one representative per projection type; remove duplicates; add missing paradigm demonstrations |
| **Pixel comparison limits** — baseline diffs catch regressions but don't validate *design quality* | `test:visual:ci` passes but UX feels broken | Add **qualitative review gates**: design review checklist, heuristic evaluation, not just pixel parity |
| **No LM interaction visible** — screenshots show static state, not the chat→reasoning→graph loop | No cell captures streaming, tool use, or belief/goal revision | Add scenario cells: `chat-streaming`, `chat-tool-approval`, `chat-belief-revision` with live indicators |

### Revised Next Steps (post-review)

| Priority | Action | Rationale |
|---|---|---|
| **Graph UX** | Default zoom fit with floor; base node sizes from tokens; label visibility at default zoom | Legibility is the #1 blocker to "usable and intuitive" |
| **Chat–Graph cells** | Add 3–4 visual matrix cells: chat+graph split, anchored inquiry, streaming chat, tool approval | Demonstrate the *actual product differentiation* (paradigm §19) |
| **Cell curation** | Audit `VISUAL_CELLS`; collapse redundant layout/view cells; keep one per projection type | Reduce gallery noise; each cell must earn its place |
| **Design review gate** | Add `test:design` — manual checklist run pre-commit (typography, hierarchy, focus, density, paradigm visibility) | Pixel tests ≠ design quality; need human gate |
| **Scenario richness** | Seed scenarios with multi-turn chat + active reasoning (beliefs, goals, contradictions) | Static graphs don't show the system working |

---

## Architectural Question for Next Session

> **Should the visual testing strategy be restructured?**
> - Current: 51 pixel-diff cells, many redundant, none showing the *live* SeNARS loop
> - Alternative: Fewer baseline cells (10–15) covering shell + projections + error states, plus **scenario recordings** (video/GIF) for chat–graph interaction, streaming, tool use
> - The "blend/embed" paradigm (§19) cannot be verified by static screenshots alone

---

## Strategic Review: from feature-complete to experience-complete

> This section supersedes the phase *ordering* below. v9 as written is a strong reliability + craft
> plan (F/V/C/D). It is **component-complete, not experience-complete**: it never states what a user
> does or how the interface makes the system's genius obvious. The screenshot review is a symptom of
> that gap. Before continuing to polish, v9 must be front-loaded with **experience architecture** and
> a **viewport/scaling policy**, and its visual testing must become **journey-oriented**.

### The core contradiction to resolve

The paradigm (§19) says Chat, Notebook, Graph are **one substance**. The implementation exposes them
as a **mutually exclusive `renderer` switch** — "switch to graph." That *contradicts the thesis*.

**The ultimate SeNARS UI does not make you leave the conversation to see the knowledge; it shows the
knowledge *through* the conversation.** The headline feature is not "a graph tab" — it is a **linked
workspace** where speaking, reading, and seeing are simultaneous. This must move from B.1–B.3
(yellow, "harden") to a **first-class phase**.

### X — Experience Architecture (do before more polish)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| X.1 | **Journeys as first-class artifacts** — name the 5 core use cases (Q&A/research · knowledge-building · goal-planning · teaching · audit) and specify each as a *flow* (steps + surfaces + transitions), not a tab. | ⬜ | `docs/ux/journeys.md` (new) | each journey has a diagram + a visual cell; a journey that can't be shown is a missing feature |
| X.2 | **Linked workspace (the paradigm, built)** — Chat and Graph visible *together* by default (split or ambient side-canvas); selection/focus/provenance continuous; asking composes context from the selected neighborhood. | ⬜ | `components/app-layout.ts`, `components/renderers/*`, `core/store.ts` | chat + graph simultaneous; select in one → highlight in other; ask-from-selection; cells |
| X.3 | **View presets + Display popover** — collapse `renderer · lens · layout · layer · shape · color-by` into **Ask · Explore · Read · Plan · Split** presets; expose the raw knobs in one "Display" popover (progressive disclosure L2). | ⬜ | `components/graph-toolbar.ts`, `core/store.ts` | ≤3 primary controls; presets set renderer+layout+lens+encoding; cells |
| X.4 | **Progressive-disclosure ladder** — L0 composer+canvas · L1 view+search+zoom · L2 Display popover · L3 palette; advanced affordances appear only when their prerequisite exists. | ⬜ | `components/app-layout.ts`, `core/hints.ts` | a new user sees only L0; power grows on demand; cells |
| X.5 | **First-run / empty-state design** — the default state teaches the next action and seeds a *legible* example (not a blank canvas); "first 5 minutes" is designed, not incidental. | ⬜ | `components/app-layout.ts`, `components/primitives/empty-state.ts` | empty state is a legible, actionable invitation; cells |
| X.6 | **Delight / moments of insight** — one purposeful motion vocabulary for: derivation forming, contradiction surfacing, graph responding to a new turn, truth revising. Motion conveys state, never decorates. | ⬜ | `styles/*`, `components/renderers/*` | a derivation forming is *visible*; reduced-motion gated; cells/recording |

### G — Viewport, Auto-Scaling & Legibility (the missing phase)

> The screenshots are "too small / off-center / scattered" because there is **no scaling policy**.
> This is a design-system concern (belongs with D) and a graph concern (belongs with V), but it is
> currently owned by neither. It gets its own phase because *nothing above an illegible view counts*.

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| G.1 | **Auto-scaling node size** — node size = `f(viewport area, visible count, importance)` from tokens, not fixed px; legible on a phone and on 4K. | ⬜ | `utils/adapter-2d.ts`, `design-tokens.json` | node size adapts; a legibility assertion at default view; cells |
| G.2 | **Zoom policy (floor/ceiling/center)** — auto-fit on load with a **minimum legible zoom** and a **maximum "one-node" zoom**; **auto-center on content** (not origin). | ⬜ | `components/graph-viewport.ts` | default view is centered and legible; floor/ceiling honored; unit + cells |
| G.3 | **Label LOD by importance × zoom** — labels appear by importance and zoom; the graph is legible *at rest*; no label collisions at medium density. | ⬜ | `components/graph-viewport.ts`, `utils/html-labels.ts` | labels readable at default zoom; collisions prevented; density cell |
| G.4 | **Density-aware layout** — layout adapts to node count/degree (auto), not a manual dropdown; the default is always tidy. | ⬜ | `utils/layout-registry.ts`, `core/store.ts` | sparse and dense graphs both tidy by default; cells |

### Visual testing restructure (see also "Architectural Question")

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| T.1 | **Curate to ~12–15 baseline cells** — one per shell state + projection + error state; each cell earns its place; remove redundant layout/view cells. | ⬜ | `tests/visual/matrix.ts` | ≤15 baselines; every cell shows something unique; gallery is reviewable at a glance |
| T.2 | **Journey recordings** — video/GIF (or multi-frame) for chat⇄graph, streaming, tool approval, belief revision — what static screenshots cannot prove. | ⬜ | `tests/visual/*` | a recording shows the live loop; linked from the gallery |
| T.3 | **`test:design` qualitative gate** — checklist: hierarchy, density, focus visibility, legibility at default zoom, paradigm visibility. | ⬜ | `tests/design/*` (new) | a human checklist runs pre-commit; regressions in *quality* are caught |
| T.4 | **Legibility assertion cell** — fails if nodes render below a legibility threshold at default view. | ⬜ | `tests/visual/*` | an illegible default view fails CI |

### Revised priority order (supersedes "Priority Execution Order")

```
F (floor) ─▶ X (experience architecture) ─▶ G (scaling/legibility) ─▶ V (encoding) ─▶ C (chrome)
          ─▶ D (craft) ─▶ H/R/B/P/I (envelope) ─▶ T (visual-testing restructure)
```

Rationale: **fix the floor (F)**, then decide *what the experience is* (X) and *make it legible* (G)
before adding more encoding (V) or consolidating chrome (C). Polish (D) and the envelope (H/R/B/P/I)
follow. Visual testing (T) is restructured once the experience stabilizes, so baselines stop churning.

### Simplification ledger (capability kept, complexity removed)

| Remove / merge | Keep capability via |
|---|---|
| 6 view selectors (renderer/lens/layout/layer/shape/color-by) | **View presets** (X.3) + Display popover |
| Mutually-exclusive renderer switch | **Linked workspace / Split** (X.2) |
| Always-on legend | Legend toggle, default **off** (done) |
| 51 component cells | ~12–15 **journey/state** cells + recordings (T.1/T.2) |
| Manual "Fit" as the only scaling | **Auto-scaling policy** (G.1/G.2) |

---

## Fractal HTML & LoD — the recursive content paradigm

> **The insight.** We can already render arbitrary HTML inside graph nodes (`html-enabled`,
> `utils/html-labels.ts`, and the SpaceGraph 3D nodes). That is not a detail — it is the enabler of a
> **recursive** paradigm. A node can render a `<s-view>`, which renders a projection, whose nodes
> render HTML, and so on. Combined with **Level-of-Detail**, the graph becomes a *fractal, zoomable
> canvas of rich content* — and the "one substrate, many projections" thesis becomes *recursive*.

### The recursive projection diagram (supersedes §19's flat diagram)

```
External content                    ┌───────────────────────────────┐
(files · source · control-flow ·    │  Content Adapters             │
 charts · docs · datasets)  ──────▶ │  (AST→graph · tree→graph ·    │
                                    │   series→graph · doc→graph)   │
                                    └───────────────┬───────────────┘
                                                    ▼
                              ┌──────────────────────────────────────┐
                              │            WorkspaceGraph             │
                              └───────────────────┬──────────────────┘
          ┌────────────────────┬────────┴────────┬────────────────────┐
          ▼                    ▼                 ▼                    ▼
    ┌───────────┐        ┌───────────┐     ┌───────────┐
    │   Chat    │ ⇄⇄⇄⇄⇄  │ Notebook  │ ⇄⇄  │   Graph   │
    └─────┬─────┘        └─────┬─────┘     └─────┬─────┘
          │ rich frames        │                 │  LoD: glyph→label→card→full
          │                    │                 ▼
          │                    │          ┌──────────────────┐   fractal:
          └────────────────────┴────────▶ │  HTML-in-node    │──┐ a node may embed
                                          │  (text · table · │◀─┘ a projection (or
                                          │  code · chart ·  │     another graph),
                                          │  form · <s-view>)│     to a bounded depth
                                          └──────────────────┘
```

### LoD — one tier vocabulary, one renderer registry

| Tier | Trigger | Renders |
|---|---|---|
| **glyph** | far | kind icon + truth/priority dot |
| **label** | mid | label + `f/c` chips |
| **card** | near | compact fields (title · type · truth · links) |
| **full** | closest | the block's HTML — text · table · code · chart · form · **or an embedded projection** |

**A node-renderer registry**: each block *kind* declares its four tiers in one place; every renderer
(2D Cytoscape, 3D SpaceGraph, chat, notebook) reads the same descriptors. This is the extension point
that makes rich content *scale* without bespoke per-kind code.

### Fractal guards (this can explode — treat it like any budget)

- **Max depth** (a projection inside a projection inside … stops at N).
- **Max rendered HTML nodes** (a global cap; beyond it, a node shows a `card` + "expand" affordance).
- **Interaction mode**: HTML nodes are inert until focused, so pan/zoom never fights the content;
  an explicit "engage" affordance enters interaction.
- **Reduced-motion + reduced-detail** honored from the same tokens.

### What this unlocks (capability inventory)

| Direction | Examples | Where it lives |
|---|---|---|
| **Content-as-graph** | filesystem trees · source AST · call graph · control-flow graph · dependency graph · data series/charts · document structure | Content adapters → WorkspaceGraph (view-adapter registry) |
| **Rich chat frames** | rendered Markdown · forms/wizards (generalize tool-approval) · realtime charts/plots · **embedded mini-graphs** · inline artifact viewers | Chat projection (block `full` tier) |
| **Chat-dialog *as* graph** | the conversation's turn/responds-to structure shown as a graph; discourse edges; thread roots | Conversation layouts (exist) + LoD |
| **Embedded graph in chat, chat in graph** | a turn whose `full` tier is a live neighborhood; a node whose `full` tier is the originating dialogue | Fractal HTML (X.2 + R) |

### Overlays, popups & menus *as* information architecture

Overlays are not just modals — they are the **progressive-disclosure surface**. One overlay system
should support: anchored popovers, drill-down panels, inline expanders, and a focus stack with
breadcrumbs — so detail appears *near* its anchor, never as a full-screen context switch.

| Pattern | Use |
|---|---|
| **Anchored popover** | node detail, truth editor, link inspector (at the node) |
| **Drill-down panel** | provenance walk, related blocks (breadcrumbed) |
| **Inline expander** | reveal a nested projection in place (fractal) |
| **Wizard** | multi-step input (tool approval, import, goal definition) |

### R — Rich Content & Fractal HTML (proposed phase)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| R.1 | **Node-renderer registry + LoD tiers** — glyph/label/card/full per kind; one descriptor source; wired into 2D + 3D + chat + notebook. | ⬜ | `core/node-renderers.ts` (new), `utils/adapter-2d.ts`, `spacegraph/*` | every kind has four tiers; zoom changes tier; cells |
| R.2 | **Fractal HTML runtime** — HTML-in-node with depth/node budgets, inert-until-focused interaction, expand affordance. | ⬜ | `utils/html-labels.ts`, `components/graph-viewport.ts` | nested projection renders to a bounded depth; pan/zoom unaffected; cell |
| R.3 | **Content adapters** — filesystem · source AST · call/control-flow · series/chart · document → WorkspaceGraph. | ⬜ | `core/adapters/*` (new), `view-adapter` registry | a source file or dataset becomes a navigable graph; cells |
| R.4 | **Rich chat frames** — Markdown (exists) + forms/wizards + charts + **embedded mini-graphs** + artifact viewers as the `full` tier of a turn. | ⬜ | `components/renderers/*`, `components/*-frame.ts` (new) | a turn can embed a live graph/chart/form; cells |
| R.5 | **Conversation-as-graph** — surface the dialogue structure (turns · responds-to · threads) as a first-class graph view with LoD. | ⬜ | `components/renderers/graph.ts`, `utils/graph-layout.ts` | the chat's structure is a graph; cell |
| R.6 | **Overlay-as-IA** — anchored popovers, drill-down panels, inline expanders, wizards; focus stack + breadcrumbs. | ⬜ | `core/overlay-manager.ts`, `components/overlays/*` | detail appears near its anchor; breadcrumbed drill-down; cells |

### v9 vs v10 split for this direction

| v9 (tractable, high-leverage) | v10 (research) |
|---|---|
| LoD **node rendering** (glyph→label→card→full) | Semantic-zoom **morph** (continuous interpolation between projections) — E.1 |
| Fractal HTML with **budgets** | Unbounded nesting / arbitrary composition |
| Content adapters for **static** content (files, AST, charts) | **Live** code execution / editing graphs |
| Embedded mini-graphs in chat (bounded) | Full bidirectional inline editing |

### Risks & guards

| Risk | Guard |
|---|---|
| Performance (HTML in many nodes) | node budget + `card` fallback + virtualization research (v10 E.5) |
| Interaction conflict (pan vs. content) | inert-until-focused + explicit engage |
| Visual noise (too much detail at once) | LoD means detail is *earned* by zoom; default is `label` |
| Fractal explosion | depth cap + node cap + expand affordance |
| Coherence loss (many content types) | one node-renderer registry; one LoD vocabulary |

### Strategic takeaway

The paradigm should be restated as: **one substrate · many projections · *recursively embeddable* ·
LoD-scaled**. This is SeNARS's differentiator versus a chatbot (forgets), a graph tool (inert), or a
document (flat): **a living, zoomable, reasoning canvas** where any cell can reveal its content, its
provenance, or another projection — to a depth you control.

---

## North Star (restated for the fresh session)

> **SeNARS UI is not a chat app with a graph tab. It is a *living, zoomable, reasoning canvas* — one
> substrate, many projections, recursively embeddable, LoD-scaled.** Any cell can reveal its content,
> its provenance, or another projection, to a depth the user controls. Chat is where you speak;
> projections are how you see; the canvas is where the knowledge lives; and every surface is a
> doorway into every other.

**The one-line test for every decision:** *does it make the system's reasoning more visible, more
legible, or more enjoyable — without adding a control the user must learn?*

This restatement **supersedes** the flatter framing in §19 and upgrades the deliverable from
"polish what exists" to "**realize the paradigm**." Bold exploration is in scope; the guards are
budgets and progressive disclosure, not timidity.

---

## Bold commitments (v9.x — explore AND implement)

These move from "proposal" / "v10 backlog" into the committed arc. Each is a headline capability,
not a nice-to-have.

| # | Capability | Why it is bold | First proof |
|---|-----------|----------------|-------------|
| **B-1** | **Fractal HTML nodes with real budgets** — a node's `full` tier renders rich HTML, including a nested `<s-view>`. | Turns nodes into living cells; no competitor does recursive projections. | A graph node that contains a mini-graph, bounded to depth 2. |
| **B-2** | **LoD node rendering** as a first-class system (`glyph→label→card→full`, one registry, all renderers). | Makes fractal detail survive scale; "overview first, detail on demand" becomes literal. | One block kind with four tiers, zoom-driven. |
| **B-3** | **Content adapters** — files · source AST · call/control-flow · datasets/charts · documents → graph. | Expands the substrate beyond conversation; SeNARS reasons over *any* structure. | A source file rendered as a navigable call graph. |
| **B-4** | **Rich chat frames** — Markdown · forms/wizards · charts · **embedded live graphs** · artifacts. | The chat becomes a workspace, not a transcript. | A turn embedding a live graph neighborhood. |
| **B-5** | **Conversation-as-graph** — dialogue structure (turns · responds-to · threads) as a first-class graph. | Proves chat and graph are one substrate, visibly. | The seeded conversation laid out as a discourse graph. |
| **B-6** | **Linked workspace (Split)** — chat + graph simultaneous by default; selection/focus/provenance continuous. | Resolves the plan's core contradiction; the paradigm is *built*, not asserted. | Select a claim in chat → it highlights in the graph beside it. |
| **B-7** | **Overlay-as-IA** — anchored popovers · drill-down panels w/ breadcrumbs · inline expanders · wizards. | Detail appears *at its anchor*; no context-switching. | Provenance walk as a breadcrumbed drill-down. |
| **B-8** | **Semantic-zoom morph (spike then build)** — continuous interpolation Chat⇄Notebook⇄Graph. | The endgame of "one substance." | A design spike proving a shared coordinate space. |

**Guardrails, not brakes:** node/depth budgets (fractal), inert-until-focused (interaction),
one registry per concern (coherence), reduced-motion + reduced-detail (accessibility), and the
legibility assertion (G.4/T.4).

---

## Updated backlog (promotions & what truly stays deferred)

| Item | Was | Now | Note |
|---|---|---|---|
| **E.2 Inline micro-visualizations in chat** | v10 | **v9 (B-4)** | Promoted; rich chat frames are core. |
| **E.5 Graph LOD / virtualization** | v10 | **v9 node-LoD (B-2); node-count virtualization stays v10** | Detail-LoD is tractable now; 10k-node virtualization is not. |
| **E.3 Provenance walk** | v10 | **v9 (B-7)** | Promoted; it is an overlay-as-IA drill-down. |
| **E.4 Graph as editor** | v10 | **v9 partial (forms/wizards via B-4/B-7)** | Structured input lands; free-form editing stays v10. |
| **E.1 Semantic-zoom morph** | v10 | **v9 spike (B-8)** | Spike now; full build gated on B-6. |
| **E.6 Worker offload** | v10 | v10 | Needs a new engine. |
| **E.7 Undo/redo journal** | v10 | v10 (unblocked by B-4/B-7 input) | Revisit once editing input lands. |
| **E.8 Touch & mobile** | v10 | v10 | Auto-scaling (G) makes it cheaper later. |
| **O6 `renderer:graph3d`** | v10 | **v9 candidate** | 3D + fractal HTML + LoD is a *reason* 3D does something 2D cannot. |

---

## Next Session Kickoff (do these first, in order)

> The fresh session should **start here** and read the North Star + Strategic Review + Fractal HTML
> sections before touching code. No more pixel-polishing until the experience is legible and the
> paradigm is visible.

**Move 1 — See the truth (G + T, half a day).**
- Make the default view **auto-fit with a zoom floor/ceiling and auto-center** (G.2).
- Make **node size auto-scale** to viewport/count (G.1) and ensure labels are legible at rest (G.3).
- Curate the matrix to **~12–15 cells** and add a **legibility assertion** (T.1, T.4).
- *Definition of done:* the default graph screenshot is legible, centered, and pleasant.

**Move 2 — Build the paradigm (X, 2–3 days).**
- **Linked workspace / Split** (B-6/X.2): chat + graph side by side, shared selection/focus.
- **View presets + Display popover** (X.3): collapse the six selectors to Ask/Explore/Read/Plan/Split.
- **Progressive-disclosure ladder** (X.4) and **first-run design** (X.5).
- *Definition of done:* a cell shows chat *and* graph reacting to one another; ≤3 primary controls.

**Move 3 — Make it fractal (R, 3–5 days).**
- **Node-renderer registry + LoD tiers** (B-2/R.1).
- **Fractal HTML runtime with budgets** (B-1/R.2): one node embedding a mini-graph.
- **Conversation-as-graph** (B-5/R.5) and **rich chat frames** (B-4/R.4).
- *Definition of done:* a recording shows a node zooming from glyph → full, embedding a live projection.

**Move 4 — Expand the substrate (R.3, 3–5 days).**
- **Content adapters**: filesystem → graph; source AST/call-graph → graph; dataset/chart → graph.
- *Definition of done:* a source file becomes a navigable, LoD-aware graph.

**Move 5 — Envelope & polish (V/C/D/H/R/B/P/I + T).**
- Return to the existing V/C/D items with the new legible/fractal foundation, then the envelope.
- Restructure visual testing to journeys + recordings (T.2/T.3).

**Standing rules for the fresh session**
- Read North Star first; every change is judged by the one-line test.
- **No pixel polishing before legibility**; no new chrome without removing one.
- Every new capability ends with a **cell or recording** and a **budget/guard**.
- Prefer **one registry** per concern (renderers, adapters, overlays, tokens) so it scales.
- Commit after each Move; keep `typecheck` + `unit` green; regenerate baselines deliberately.

---

## Fresh-Session Checklist

- [ ] Read: North Star · Strategic Review (X/G/T) · Fractal HTML & LoD (R) · Bold commitments.
- [ ] Confirm the revised spine: `F → X → G → R → V → C → D → H/R/B/P/I → T`.
- [ ] Start with **Move 1 (G+T)**: auto-scale, zoom policy, legible default view, curated cells.
- [ ] Then **Move 2 (X)**: linked workspace + view presets + disclosure ladder + first-run.
- [ ] Then **Move 3–4 (R)**: fractal HTML + LoD registry + chat frames + content adapters.
- [ ] Keep `pnpm --dir ui typecheck` and `test:unit` green each commit; regenerate baselines on purpose.
- [ ] End each capability with a cell/recording + a guard.

---

## Neurosymbolic Synergy — NL × Symbolic, *demonstrated* (no mocks)

> **The differentiator.** SeNARS is not "an LLM" and not "a reasoner" — it is the **synergy**: the
> Language Model turns ambiguous human language into symbols, the symbolic engine (NARS/MeTTa)
> reasons, revises, contradicts, and plans, and the Language Model turns the symbols back into
> language a human trusts. The UI must make *this loop* the thing you see.

### The loop (one pipeline, shown on screen)

```
  "Robins are usually birds;      ┌─────────────┐   <robin --> bird>. [f=0.9 c=0.6]
   birds are animals, so          │  NL → Symbol │──────────────────────────────┐
   robins are…? What about        │  (LM-assisted│                              ▼
   swans — I thought white?"      │   parse)     │                    ┌──────────────────┐
        ▲                         └─────────────┘                    │  Symbolic engine │
        │                                                            │  NARS (NAL) ·    │
        │  natural-language                                          │  MeTTa (rewrite) │
        │  explanation +                                             └────────┬─────────┘
        │  uncertainty wording                                                │
  ┌─────┴──────────┐   derivation, revision, contradiction, plan   cognitive.delta
  │  Symbol → NL   │◀──────────────────────────────────────────────────────┘
  │  (LM-assisted  │
  │   verbalize)   │
  └────────────────┘
```

**Both directions are observable.** The produced Narsese/MeTTa is shown *before/while* it is
submitted (and is editable), so the translation is never a black box — it is part of the graph, with
provenance from the NL span to the symbolic term.

### No mocks — use the compact offline models we already support

| Provider | Where | Role in demos |
|---|---|---|
| **`webllm`** (WebGPU, in browser) | client | default offline NL↔symbolic translator + verbalizer |
| **`transformers`** (Transformers.js, in browser) | client | lightweight offline fallback |
| **`llamacpp-embedded` / `llamacpp`** | engine/server | deterministic offline LM for reproducible cells/recordings |
| `mock` | — | **unit tests only**; never used to "demonstrate" a capability |

**Policy:** every neurosymbolic **demo, cell, and recording runs a real compact model** with a fixed
seed (reproducible), offline, no network. `mock` is confined to non-capability unit tests.

### Scenario catalog (engine-backed, offline, reproducible)

| # | Scenario | NL in | Symbolic work | NL out | Shows |
|---|---|---|---|---|---|
| NS.1 | **Grounded syllogism** | "Robins are birds; birds are animals — what about robins?" | parse → `<robin-->bird>`, `<bird-->animal>` | derive `<robin-->animal>` | verbalized conclusion + truth (`f,c`) |
| NS.2 | **Defeasible revision** | "Swans are white… but this swan is black." | two beliefs + `contradiction` | revise with confidence | contradiction surfaced, truth revised, narrated |
| NS.3 | **Hedged uncertainty** | "It's *probably* going to rain; the sky is *usually* grey when…" | map hedges → `f/c` | reason with uncertainty | NL hedges become truth values; output reflects them |
| NS.4 | **Goal → plan** | "Make tea — I have leaves, water, a kettle." | goals + plan derivation | summarize the plan | NL goal → NARS goals → ordered plan |
| NS.5 | **MeTTa rewrite** | "Refactor: rename `foo` to `bar` where safe." | MeTTa atoms + rewrite rules | explain the rewrite | NL → MeTTa → rewrite → NL, symbolically checked |
| NS.6 | **Cross-checks** | "If A implies B and B implies C, does A imply C? Verify my logic." | proof/consistency | confirm/deny with the chain | LM proposes, symbolic *verifies*, LM explains |
| NS.7 | **Disambiguation** | "Bank (river? money?) — which fits this sentence?" | LM → candidate atoms → context filter | state the chosen reading | LM + symbolic jointly disambiguate |

Scenarios may chain (a turn can trigger several). Every scenario ends with a **visible delta** on the
graph (new beliefs/goals/links) and, where temporal, a **recording** (T.2).

### UI surfaces that make the synergy legible

| Surface | What it shows |
|---|---|
| **Bilingual turn** | NL text ⇄ the Narsese/MeTTa it produced, side by side (the block's `full` LoD tier). |
| **Translation trace** | anchored popover: source span → term → kind → truth; the mapping is data, inspectable. |
| **Symbolic provenance** | NL span ↔ node links (`asserts`, `translates-to`), so clicking a claim shows the sentence it came from. |
| **Combined graph** | NL turn-nodes + symbolic concept-nodes in one graph, distinct kinds, linked; LoD shows NL content. |
| **Uncertainty chips** | LM-assigned priors and NARS-revised `f/c` shown together; revision is visible over time. |
| **Reasoning HUD** | the live loop: parse → submit → derive → verbalize, with step/stop/abort (control mode exists). |

### N — Neurosymbolic Synergy (proposed phase)

| # | Item | Status | Files | Acceptance |
|---|------|--------|-------|------------|
| N.1 | **Offline LM for demos** — pin real `webllm`/`transformers`/`llamacpp-embedded`; a seeded, deterministic "demo LM" profile; `mock` forbidden in capability cells. | ⬜ | `core/lm-*.ts`, `tests/visual/*`, `core/config-schema.ts` | a cell runs end-to-end offline with a real model; deterministic; no mock |
| N.2 | **Bilingual turn + translation trace** — every NL turn carries its symbolic form and the span→term mapping, both inspectable. | ⬜ | `core/workspace-projection.ts`, `components/renderers/*` | a turn shows NL ⇄ symbolic; trace is data; cells |
| N.3 | **Synergy scenarios (NS.1–NS.7)** as engine-backed scenarios + cells/recordings. | ⬜ | `tests/framework/*`, `tests/visual/matrix.ts` | each scenario reproduces offline; recordings show the loop |
| N.4 | **Combined graph** — NL turn-nodes and symbolic concept-nodes in one projection, linked, LoD-aware. | ⬜ | `core/workspace-projection.ts`, `utils/adapter-2d.ts` | one graph shows language *and* logic; cells |
| N.5 | **Uncertainty legibility across NL↔symbolic** — hedges → `f/c`; revision visible over time; wording reflects truth. | ⬜ | `core/workspace-projection.ts`, `components/*` | hedged NL yields correct `f/c`; revision narrated; cells |
| N.6 | **MeTTa synergy** — NL → MeTTa atoms/rewrites → NL, with the rewrite chain shown. | ⬜ | `core/metta-backend.ts`, `components/*` | a rewrite scenario runs offline; chain visible; cell |
| N.7 | **Symbolic verification of LM output** — LM proposes, symbolic engine checks consistency/derivation, LM explains the verdict. | ⬜ | `core/*-backend.ts`, `components/*` | a false LM implication is caught symbolically and explained; cell |

### Guardrails

- **Determinism**: seeded demo-LM profile so NS cells/recordings are reproducible.
- **Honesty**: never label a mock output as a model result; the provider chip always shows what ran.
- **Time budget**: settle/download once, cache the model; a scenario declares its model + budget.
- **Legibility**: the translation is shown, not hidden; low confidence is *shown*, not smoothed over.

### Strategic takeaway

This is the **headline** of SeNARS's UI: a user speaks in language, watches it become *logic*,
watches the logic *reason*, and hears the reasoning back in language — with every step inspectable.
Combined with the Fractal-HTML/LoD canvas (R), the synergy is not a claim in a README; it is a
*visible, offline, reproducible loop* on screen.

---

## Kickoff addendum — the neurosymbolic move (fold into Move 3–4)

The **N** phase (Neurosymbolic Synergy) is a first-class headline, run **alongside** the fractal
canvas (R) because they compound: R makes rich content visible; N makes the *language↔logic loop*
visible. Suggested insertion once Move 2 (linked workspace) lands:

- **N.1 (half a day):** pin a **real compact offline model** (`webllm` / `transformers` /
  `llamacpp-embedded`) as a seeded, deterministic "demo LM" profile; forbid `mock` in capability cells.
- **N.2 + N.4 (1–2 days):** **Bilingual turn** (NL ⇄ symbolic) + **combined graph** (language nodes
  and logic nodes in one projection, linked).
- **N.3 (2–3 days):** implement **NS.1–NS.7** as engine-backed scenarios with recordings — the
  syllogism, defeasible revision, hedged uncertainty, goal→plan, MeTTa rewrite, cross-check,
  disambiguation.
- **N.7 (1 day):** **symbolic verification of LM output** — the LM proposes, the engine checks, the
  LM explains the verdict.

**Definition of done:** an offline recording shows a natural-language question becoming Narsese,
NARS/MeTTa reasoning over it, and a natural-language answer — with the translation and truth values
inspectable at every step, and **no mock in the path**.

**Standing rule added:** *capability demonstrations always run a real compact offline model; `mock`
is for unit tests only.*
