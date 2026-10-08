# TODO.ui.4.md — Work-Package Backlog

> **Relationship to prior plans.** Supersedes `TODO.ui.3.md` **for all open work**; v3 is retained as
> the **landed record** (product framing, `WorkspaceGraph`/`WorkspaceRenderer` contracts, keep/demote
> ledger, block-kind matrix, 35-entry log `(a)…(ag)`). This file is the **execution spine**: one home
> per open item, grouped into shippable work packages.
>
> **Stable ids.** Legacy phase/item ids (`0.4`, `3.3`, `4.3`, …) are kept as **tags** so old references
> and provenance resolve. Do not renumber. Provenance tags `(x)` point into v3 Appendix D.
>
> **Structure.** Every open task has exactly one home (§ Work Packages or § Awaiting). Opportunities
> are folded into their owning item as sweep bullets — there is no separate opportunities list.

## Principles & gates (unchanged — v3 §1–§3, §12, §13)

One workspace + overlays; blocks are primary; LM structure is System 1 annotation unless a gate admits
it; capabilities compose; validation is behavioural, not pixel. Definition of done: v3 §12.

## Dependency spine

```
WP1 ─┬─▶ WP2 ─┐
     │        ├─▶ WP6 ─▶ WP7 ─▶ WP8
WP3 ─┴────────┘
WP3 ─▶ WP4        WP3 ─▶ WP5 ─▶ WP6
```
Critical path: **WP1 → WP3 → WP5 → WP6 → WP7**. WP2 and WP4 can run in parallel after their deps.

Status legend: `[ ]` todo · `[~]` partial · `[x]` done · `!` blocked/awaiting.

---

## WP1 — Shell completion

*Outcome: no standing panels; overlay primitives complete. No deps.*

- [x] **0.4 inspector** — demote the auto-opening node-detail drawer (last standing side panel) to a
  contextual inspector popover / pinnable card; project workspace-node data into it or hide when
  contentless. `(b)`,`(af)`,`(ag)`,`(ae)`,`(n)`,`(o)` — landed as the `inspector` overlay
  (`s-inspector`): non-modal, follows `$selectedNodeId`/`$selectedEdgeId`, closing clears selection.
  Opens without stealing focus (new `autoFocus` overlay primitive). Pinning (4.5) still to do.
- [x] **0.4 telemetry** — move telemetry content into the HUD expansion (`s-sparkline` + `s-table-mini`)
  and retire the bottom panel; add a HUD "Panels" menu derived from `view.panel.*`. `(af)` — the
  standing bottom panel is gone; the HUD `📈` expands a range-switchable sparkline + latest-values
  `s-table-mini`, and the full panel moved to the `telemetry` overlay. Shared projection in
  `utils/telemetry-view.ts`. HUD `▾` is a Panels menu derived from `activeCommands()` `view.panel.*`.
  Fixed a latent `s-view` bug: `budget` was `attribute: false`, so `budget="embedded"` never took
  effect (cognitive metrics now correctly render `s-table-mini`).
- [x] **0.4 config demotion** — migrate the legacy config panel into the settings overlay, migrate the
  configuration e2e spec, then default it off. `(aa)`,`(c)`,`(af)` — `config` retired from `$panels`
  and `$configOpen`; the settings overlay is the one home; toolbar `Config` + HUD `⚙` open
  `overlay.settings`; e2e/visual migrated.
- [ ] **0.5 tool approval** — build the tool-approval dialog overlay. `(b)`,`(aa)`
- [ ] **4.5 pinning** — overlays pinnable as floating cards (manager seam `setPinned`/`pinned` exists);
  decide session-only vs URL-addressable. `(b)`,`(e)`,`(aa)`
- [ ] **0.6 backend seam** — land the `ReasoningBackend` contract + adapter seam (`LmProvider` façade;
  `lm.status`/`lm.switch` already real). Blocked on nothing; needed by WP5. `(c)`
- [ ] **Sweep — overlays/HUD/palette**:
  - `overlay.*` forwards all args to `overlay:open` (today only `ref`); generic anchor resolver in
    `OverlayHost` (pass the Cytoscape container, not the viewport element). `(v)`,`(e)`,`(o)`
  - palette modality decision (`modal: true`?); MRU group; `Announcer` bridge on open/close. `(f)`,`(b)`,`(e)`
  - HUD `⚙` → `overlay.settings`; provider switching as an overlay action; split Provider vs
    Configuration entries once the `LmProvider` façade lands; `config-hud` `embedded` mode. `(aa)`
  - one registry-derived action source shared by HUD and palette; derive renderer/layer controls from
    registries + capability flags (drop `active === 'graph'`). `(c)`,`(k)`,`(ab)`,`(ae)`
  - `capabilityGate`/`CapabilityHost` mixin for descriptor-declared capabilities; command `available()`
    `when` predicate. `(m)`,`(k)`,`(f)`
  - add budget/stop to the HUD once run-control (WP7) exists. `(c)`,`(f)`

## WP2 — State & URL consolidation

*Outcome: one state source; everything deep-linkable. Deps: WP1.*

- [ ] **2.6 mirrors** — `mirrorAtom(atom, pick, equals?)` helper; replace the ad-hoc mirror
  subscriptions (`renderer`, `focus`, `folded`, `layer`, `layout`, `lens`) and reflect `$panels`
  two-way into `$urlState.panels`. `(s)`,`(t)`,`(x)`,`(ac)`,`(af)`
- [ ] **2.6 validation** — validate `UrlState.renderer` (cycle-free allowlist) and `UrlState.layout`
  (vs `layoutRegistry`) on hydrate; mirror `$activeLens` → `urlState.lens`. `(s)`,`(t)`,`(x)`,`(ac)`
- [ ] **1.5 page** — URL-address `page` (`(page, block, disclosure)`), requiring the section model
  (roots + heading levels). `(s)`,`(t)`,`(h)`,`(q)`
- [ ] **2.6 scope** — make active layout scope-aware (concept vs conversation) and URL-address it;
  remember the graph layer per lens; debounce `folded` writes for fold-all. `(y)`,`(ac)`,`(w)`,`(t)`
- [ ] **2.5 selection atom** — make `$selectedNodeIds` derived from `$workspaceGraph.selection`. `(z)`
- [ ] **2.5 focus react** — Graph viewport centres/highlights on `$workspaceGraph.focus` (Notebook
  already scrolls). `(h)`,`(n)`,`(r)`,`(z)`
- [ ] **2.5 defaults** — derive the capability-aware default renderer from `$capabilities`
  (`language`→Notebook, `reasoning`→Graph). `(k)`
- [ ] **2.6 context** — extend `WorkspaceContext` (`overlays`, `renderer`, `setRenderer`; fold
  `openPalette` onto `activeCommands()`); retire `$viewportMode`/`$graphShape` shell atoms once
  `graph-surface` owns them. `(b)`,`(f)`,`(ae)`

## WP3 — View & artifact completion

*Outcome: full view matrix, clean artifact typing, embedded views. No deps.*

- [ ] **4.3 typing** — discriminated `Artifact` union on `SemanticBlock`/`Segment` (drop `data` casts);
  promote `Segment.data` to the `Artifact` contract. `(i)`,`(j)`,`(d)`
- [ ] **4.3 code** — add a `code` shape + `s-code` adapter (language, line numbers, highlighting). `(j)`,`(i)`,`(ad)`
- [ ] **4.3 diff** — add a `diff` representation/view (config-change + comparisons). `(ad)`
- [ ] **4.3 derivation-record** — `s-tree` provenance view. **Depends on WP5/3.3** for the
  `DerivationRecord` payload. `(ad)`
- [ ] **4.3 affordances** — Copy / Open-in-graph in the artifact overlay, reachable from ToC/inspector. `(j)`,`(ad)`
- [ ] **4.1/4.2 embedded views** — Notebook embedded graph block (derivation/contradiction/topic
  neighborhood); Graph node popover notebook card; graph edge popover derivation tree; wire the
  block-menu "embed" affordance; reuse `conversationPositions` and `projectWorkspaceGraph` in embedded
  graph shapes. `(n)`,`(y)`,`(e)`
- [ ] **2.4 graph inspection** — node/edge hover popovers reusing `explainModel`/`neighborhood`; artifact
  edge previews; richer inspector (link confidence + event refs); "Open related" from graph menu and
  ToC; remember neighborhood depth; ⌥-click a row to explain instead of navigate. `(r)`
- [ ] **1.5/1.1 notebook structure** — recurse nested `contains`/headings so pages/ToC aren't shallow;
  nested-section folding by heading `level`; fold-all/unfold-all command; folded-count badge; keep
  `j/k` consistent with folded visibility and decide whether it skips container roots; optional
  `clampStep`; "jump to related block" from breadcrumb/block menu. `(d)`,`(q)`,`(h)`
- [ ] **1.4 rich text** — inline tokenizer for paragraphs (links/emphasis/code spans); image intrinsic
  size `{width?,height?}`; optional inline full tables (`budget="full"`); ensure the view barrel is
  imported standalone / owned by `WorkspaceHost`. `(i)`,`(j)`
- [ ] **citations model** — `Source`/bibliography (stable citation key, `[n]` resolution) to split
  formal citations from plain links. `(i)`

## WP4 — Timeline present-anchoring

*Outcome: the timeline is a real present-anchored scrubber. Deps: WP3.*

- [ ] **4.4 controls** — explicit live/past/prospective controls ("now" resetting `t` to `Infinity`, a
  range readout) and announce the applied window. `(ag)`
- [ ] **4.4 anchor** — present-anchored cursor fading newly admitted blocks; thread `createdAt`/event
  time through `projectGraph`/projection. `(ag)`,`(y)`
- [ ] **4.4 gating** — gate the `⏱` HUD control on temporal availability (node with `occurrenceTime`
  or a capability flag). `(ag)`
- [ ] **5.1 scrub** — `ws.scrubTime` `ui.command` driving `$view.timeline.t` for agent demos. `(u)`,`(ag)`
- [ ] **ops sequencing** — carry engine `seq`/`eventRefs` on `WorkspaceOp` for ordering/provenance. `(Phase 0.1–0.3)`

## WP5 — Reasoning vertical slice

*Outcome: the `reasoning` capability end-to-end. Deps: WP3; needs WP1/0.6 seam.*

- [ ] **3.1 projection** — map NAR concepts/events → blocks/links: beliefs, goals, questions,
  derivations, revisions, contradictions, budget events, gate decisions. `(Phase 3)`
- [ ] **3.2 formalization** — claim → candidate → gate admission → belief/goal/question, visible in both
  renderers; route `claim`/`question` composer children through it; emit `asks`/`answers` links;
  special-case structured modes in `projectChat`; server `mode`/`contexts` consumption. `(g)`,`(l)`,`(k)`
- [ ] **3.3 provenance** — `derivation-record` blocks (premises/conclusion links, truth/confidence, rule
  id, evidence lineage, raw record); defines the payload WP3/4.3 needs. `(Phase 3)`
- [ ] **3.5 explanation** — extend the explanation popover to reasoning targets (claim/node/edge/event/
  belief/goal/derivation) with `summary · card · detail · raw`. `(Phase 3)`
- [ ] **3.4 layouts** — `reasoning-provenance`, `gate-pipeline`, `contradiction-neighborhood`,
  `budget-resource` as `layoutRegistry` rows with deterministic variants. `(Phase 3)`
- [ ] **3.6 steer/author** — retract/revise belief, add goal, adjust budget/provider from block/node
  actions; live reaction as new blocks/links. `(Phase 3)`
- [ ] **3.7 MeTTa** — adapter feeding the same substrate; one scenario through it. `(Phase 3)`
- [ ] **2.3 node ops** — node-creating ops from the graph ("Ask as question" / "Assert as claim" →
  `WorkspaceOp.block.add`); reconcile cross-fragment context refs in `projectWorkspace`. `(o)`,`(p)`,`(m)`

## WP6 — Parity & rendering quality

*Outcome: executable §10 parity; live graph. Deps: WP1, WP2, WP5.*

- [ ] **2.5 parity suite** — script the canonical loop per full renderer; per-pair continuity
  round-trips; make the §10 matrix **data** (`rendererParity`/`rendererSupports`) so palette/shell gate
  uniformly. `(z)`,`(ae)`
- [ ] **2.1 growth** — incremental animated growth of the workspace layer (today replace-by-diff). `(n)`,`(y)`
- [ ] **2.1 clusters** — compound clusters from chat `contains`/headings (set `children` on turns /
  infer). `(n)`
- [ ] **1.2/2.3 floating composer** — anchored to block/node/subgraph (summoned, not persistent) with
  capability-gated modes and cy→DOM coordinate handoff. `(k)`,`(g)`,`(o)`,`(p)`
- [ ] **1.2 composer sweep** — mode bar ↔ palette share one action source; `composer.prefill` signal;
  per-segment preview (fix kind, merge/split); guard `decomposeInput` against abbreviation/decimal
  over-splitting; optional context-excerpt reply; extract shared `ComposerFocus` type. `(m)`,`(k)`,`(g)`
- [ ] **2.x graph polish** — unify workspace-node lens/capability styling in the adapter; skip laying
  out / exclude hidden layer from `fit`; bind `graph.ask-selection` (e.g. `a`); HUD/palette layout group
  + `graph.layout.cycle`; register `chronological-flow`/`source-view` SpaceGraph surfaces when a
  storyboard adapter exists. `(n)`,`(w)`,`(ab)`,`(p)`,`(y)`
- [ ] **2.x pure-helper tests** — extract + unit-test `nodeTapAction`/`nodeGesture`, `workspaceRefs`; add
  a Graph-renderer unit test (import pulls Cytoscape) and an `app-layout` test. `(o)`,`(p)`,`(ae)`

## WP7 — Agent-operable

*Outcome: the agent drives the workspace. Deps: WP6.*

- [ ] **5.1 execution** — `ui.command` over the workspace (set renderer, focus, explain, highlight, open
  ToC/search, present artifact, embed view, compose, narrate, scrub); round-trip test through
  `applyServerMessage`; record executed commands in timeline/telemetry; engine emits `ui.command` for
  narrations/demos. `(u)`,`(v)`
- [ ] **5.1 args** — parameterised commands with a `params` descriptor (generated `parse` + palette
  prompt); type-check args against `UiCommandMsg.args`; `available()`-aware palette badge. `(u)`,`(v)`
- [ ] **5.2 control mode** — default off → suggestions; on → execution with a visible command log + HUD
  stop button. `(c)`,`(f)`
- [ ] **5.3 demonstrations** — "show me how you got that" switches renderers, focuses refs, opens
  provenance, narrates; no fake player. `(Phase 5)`
- [ ] **5.4 screen-record mode** — minimal HUD, focus highlight, captions/narration. `(Phase 5)`

## WP8 — Bridge, hardening, standalone, 3D

*Outcome: shippable product. Deps: WP7.*

- [ ] **0.7 bridge** — legacy graph nodes/events/chat render as overlays/embedded views; ViewSpec
  adapters usable inside overlays and `embedded-view` blocks. `(0.7)`
- [ ] **7.1 boundary** — package split (`semantic-graph` vs SpaceGraphJS umbrella; see open questions). `(7.1)`
- [ ] **7.2 standalone** — engine-free build: LM provider + segmentation + semantic links + Notebook/Graph. `(7.2)`
- [ ] **7.3 performance** — op batching, notebook/ToC virtualization, graph decimation, latency budgets;
  `mountWorkspaceProjection` incremental ops / microtask-rAF coalescing; `applyWorkspaceOp` batch
  publish; memoise `tocEntries`/`explainModel`/`activeCommands()`/segmentation; shared `linksByBlock`
  adjacency index for `linksTouching`/`neighborhood`/projection. `(b)`,`(e)`,`(f)`,`(d)`,`(r)`
- [ ] **7.3 quality** — error taxonomy; accessibility pass (keyboard-only walkthrough, canvas text
  alternatives via the table adapter); plugin/descriptor API for renderers/block kinds/link kinds;
  docs-as-code from descriptors; re-expand the visual-regression net. `(7.3)`
- [ ] **tests sweep** — parity: link-catalog `layouts` ⊆ `layoutRegistry`; segmentation round-trip
  property test; a Notebook `composer:focus` path test; regenerate visual baselines for the
  telemetry/timeline demotions; fix the stale e2e "default telemetry panel" comment and the
  timeline-overlay test-API registration note. `(Phase 0.1–0.3)`,`(d)`,`(q)`,`(af)`,`(ag)`
- [ ] **6 Graph3D** — `WorkspaceRenderer` over SpaceGraph, `parity: 'partial'`; only after Notebook/Graph
  are excellent. `(6)`

---

## Awaiting / deferred — not actionable yet

- **1.4 block-level streaming** — needs partial assistant text in `$chatMessages` (backend-coupled);
  child-id content hash for mid-stream stability. `(d)`,`(i)`
- **tool transport** for `uiControl` — in-process first, MCP later. `(Appendix C)`
- **LM-assisted enrichment defaults** — on/off, cost visibility, annotation vocabulary. `(Appendix C)`
- **artifact/block sandboxing** policy before untrusted content. `(Appendix C)`
- **multi-agent boundary** — future contract. `(Appendix C)`

## Open questions (carried from v3 Appendix C)

- Turn/page boundary policy: auto-page per turn pair with agent/user overrides.
- Block-id stability under streaming reparse (content-hash + position anchor).
- ToC scale: virtualization and outline-only mode for very long sessions.
- Composer defaults: which modes surface LM-only; how Believe/Goal degrade to suggestions.
- Pinning persistence: session-only vs URL-addressable.
- Package naming / umbrella placement at extraction.

---

## Progress log

Newest first. Pre-v4 history: `TODO.ui.3.md` Appendix D.

### (v4.3) — WP1 shell demotions: telemetry (WP1 complete)
- **0.4 telemetry** — retired the standing bottom panel. `telemetry-panel` is unchanged but now
  reached via the new `telemetry` overlay (`s-telemetry`); the HUD keeps a one-glance expansion.
  - **HUD expansion** (`workspace-hud`): the `📈` button toggles a popover above the pill with a
    range switcher (`1m`/`5m`/`15m`/`1h`) and two embedded `s-view`s — `s-sparkline` (series) over
    `s-table-mini` (latest values) — plus a "Full" action that opens the overlay.
  - **HUD "Panels" menu**: the `▾` button lists every `view.panel.*` command (derived from
    `activeCommands()`), so the menu stays in sync with the registry; toggling one closes the menu.
  - **DRY**: new `utils/telemetry-view.ts` owns ranges, default metrics, series projection and the
    snapshot table; `telemetry-panel` now reads it instead of re-deriving.
- **Latent bug fixed** — `s-view`'s `budget` was `@property({ attribute: false })`, so static
  `budget="embedded"` bindings were ignored and every embed fell back to the full adapter.
  `budget` is now attribute-observed; `cognitive-metrics` (the other `budget="embedded"` caller)
  correctly renders `s-table-mini` again.
- **Cleanup** — removed `telemetry` from `$panels`, its `PANEL_LABELS` entry, the graph-toolbar
  Telemetry button, and the `app-layout` bottom-panel block.
- **Tests** — `panel-commands` (telemetry/config retire to overlays), `workspace-hud` (expansion +
  Panels menu), new `telemetry-overlay.test.ts`.

### (v4.2) — WP1 shell demotions: inspector + config
- **0.4 inspector** — `node-detail-drawer` is now the `inspector` overlay (`s-inspector`): a
  non-modal popover that follows `$selectedNodeId`/`$selectedEdgeId` and closes when the selection
  clears. The standing right-side panel is gone from `app-layout`.
  - New overlay primitive: `autoFocus` threaded through `FocusTrap` → `OverlayManager` →
    `OverlayDescriptor` → `OverlayHost`, so a selection-following popover opens **without** stealing
    graph focus. Default remains `true`.
- **0.4 config demotion** — retired the legacy `config` panel (removed from `$panels` and the
  `$configOpen` alias/export); the settings overlay (0.5) is the one home. Toolbar `Config` and a new
  HUD `⚙` open `overlay.settings`. Migrated `tests/scenarios/configuration/adjust-parameters.spec.ts`
  (now drives the settings overlay through the toolbar) and the visual matrix cell (`overlay-settings`).
- **Tests** — added `app-layout.test.ts` (inspector wiring), `inspector-overlay.test.ts`; extended
  `focus-trap` (autoFocus off), `workspace-hud` (⚙ → settings), `panel-commands` (config retired).

### Discoveries / notes for the next session
- **HUD is obscured by the fixed composer (pre-existing).** `input-hud` is `position: fixed`, so its
  full-width host overlays the bottom of `graph-area` where `workspace-hud` floats. Its buttons
  (toc/timeline/telemetry/panels/settings/palette) are therefore **pointer-unreachable** in the app
  and by Playwright — only ⌘K works. Confirmed on pristine source:
  `tests/scenarios/cognitive/timeline.spec.ts` first case fails identically without these changes.
  Likely fix: drop `position: fixed` from `input-hud` so it occupies the `bottom` grid row and
  `graph-area` ends above it; needs visual-baseline regen. Worth doing before relying on HUD-summoned
  overlays (WP1 sweep).
- **`edit-edge` e2e (pre-existing).** `tests/scenarios/relational/edit-edge.spec.ts` uses
  `node-detail-drawer .tab-button` (real class is `.tab`) and its `clickEdge` path never opened a
  drawer because the old standing panel keyed only on `$selectedNodeId`. The `$selectedEdgeId`
  watcher added in v4.2 now opens the inspector for edges, but the stale selector remains; both cases
  are red on pristine.
- **Overlay sweep still open:** `overlay.*` arg forwarding and the generic `OverlayHost` anchor
  resolver (pass the Cytoscape container); palette modality/MRU/announcer bridge; the HUD expansion
  and Panels menu are now derived from the registry, but the layer/renderer controls still branch on
  `active === 'graph'` rather than capability flags (WP1 sweep).

### (v4.1) — restructured into work packages
- Rewrote the forward plan as work packages with a dependency spine; folded every improvement
  opportunity into its owning item (one home per task); moved blocked/ambiguous items to §Awaiting;
  pruned landed-prose (v3 holds history). No code change.
