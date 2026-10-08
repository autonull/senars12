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
  - [x] `overlay.*` forwards all args (`ref`/`anchor`) to `overlay:open`; [x] generic anchor resolver
    in `OverlayHost` — defaults to the element focused at open time, and the graph canvas is now
    focusable (`tabindex=0`), so graph/shortcut-triggered overlays restore focus without callers
    passing `this`. `(v)`,`(e)`,`(o)`
  - [x] palette modality decision — keep **non-modal** (outside-click dismiss); a true modal needs a
    scrim the manager does not yet render (see opportunities); [x] MRU group; [x] `Announcer` bridge
    on open/close for focus-less popovers. `(f)`,`(b)`,`(e)`
  - [x] HUD `⚙` → `overlay.settings`; [ ] provider switching as an overlay action; [ ] split Provider
    vs Configuration entries once the `LmProvider` façade lands; [ ] `config-hud` `embedded` mode. `(aa)`
  - [x] derive renderer/layer controls from registries + capability flags (drop `active === 'graph'`);
    [x] share one registry-derived action source between HUD and palette — HUD buttons and ⌘K now
    dispatch the `overlay.*` commands, and the palette itself is a `paletteHidden` command (out of its
    own list, still dispatchable). `(c)`,`(k)`,`(ab)`,`(ae)`
  - [x] `capabilityGate`/descriptor capabilities — `capabilityGate(cap)` replaces inline
    `$capabilities.get().has(...)`, `OverlayDescriptor.capability` makes the host refuse a gated
    overlay and the derived `overlay.*` command hide via its `available()` `when` predicate; the
    `CapabilityHost` mixin form is deferred until a component gates its whole presence. `(m)`,`(k)`,`(f)`
  - add budget/stop to the HUD once run-control (WP7) exists. `(c)`,`(f)`

## WP2 — State & URL consolidation

*Outcome: one state source; everything deep-linkable. Deps: WP1.*

- [x] **2.6 mirrors** — `mirrorAtom(source, key, project, equals?)` + the `setUrlState`
  no-op-skipping primitive now own every URL mirror (`renderer`, `focus`, `folded`, `layer`,
  `layout`, `lens`), and `$panels` reflects two-way (open ids → `urlState.panels`, hash →
  `$panels`). `(s)`,`(t)`,`(x)`,`(ac)`,`(af)`
- [~] **2.6 validation** — done: reject an unregistered `UrlState.renderer` on hydrate
  (cycle-free via `workspaceRendererIds()`) and mirror `$activeLens` → `urlState.lens`.
  Remaining: validate `UrlState.layout` vs `layoutRegistry` — blocked on a **cycle-free
  layout-id source**, since `store` cannot import `layout-registry` (it already imports
  `core/index` → `store`). `(s)`,`(t)`,`(x)`,`(ac)`
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
- [x] **4.3 code** — added a `code` shape + `s-code` adapter (language, line-number gutter,
  light token highlighting via a pure line-local `tokenizeCode`); `artifactViewSpec` now maps
  `code` blocks to a `CodeDataset` (`shapes: ['code','text']`) and the Notebook renders them
  through `s-view`, so code has one rendering path in the notebook and the artifact overlay. `(j)`,`(i)`,`(ad)`
- [x] **4.3 diff** — added a `diff` shape + `s-diff` adapter (unified sign gutter, add/del tint,
  token-highlighted body) over a `DiffDataset`; `core/diff.ts` (`diffLines`, LCS) builds it and
  projects to `text`/`table`. `config-change` blocks with a `{ before, after }` payload map to a
  diff (labelled, language-aware) and the Notebook renders them through `s-view`; JSON stays the
  fallback. `(ad)`
- [ ] **4.3 derivation-record** — `s-tree` provenance view. **Depends on WP5/3.3** for the
  `DerivationRecord` payload. `(ad)`
- [~] **4.3 affordances** — done: the artifact overlay header gains **Copy** (image src / the
  dataset's `text` projection / block text) and **Open in graph** (`$activeRenderer='graph'` +
  `setWorkspaceFocus`, then close), and the ToC offers a per-row artifact button for blocks that
  have one. Remaining: **reachable from the inspector** — the inspector is engine-node based and has
  no node→workspace-block mapping; add one (or route a selected block's ref through) before it can
  open an artifact. `(j)`,`(ad)`
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

### (v4.14) — WP3: artifact affordances (Copy / Open-in-graph) + ToC reach
- **Artifact overlay** — a `resolve(block)` helper centralises `{ image, spec }`, and the header now
  carries **Copy** and **Graph** actions. Copy writes the image `src`, else the artifact's `text`
  projection (`projectDataset(source, 'text')`), else the block text, and announces; Graph switches
  the renderer, focuses the block and closes the overlay.
- **ToC** — rows are restructured from a bare `.entry` button to `li.row` (entry + optional
  `.artifact` button, so no nested buttons). The button appears only for blocks with an artifact
  (`image` or a non-null `artifactViewSpec`) and opens `overlay:open { id:'artifact', ref }`.
- **Tests** — `artifact.test.ts` (copy source, open-in-graph); `toc.test.ts` (affordance only when
  present, opens the artifact). 283 component tests green.
- **Deferred** — inspector reachability (no node→block mapping yet); see the `4.3 affordances` note.

### (v4.13) — WP3: the `diff` shape + `s-diff` adapter
- **Contract** — `Shape` gained `'diff'`; new `DiffLine { kind:'add'|'del'|'context'; text }` and
  `DiffDataset { kind:'diff'; language?; from?; to?; lines }` join `ViewDataset`.
- **Representation** — `core/diff.ts` `diffLines(before, after)` is a pure LCS line differ (bounded
  for config/comparison payloads). `view-projection` renders `diff` → signed `text` and → `table`;
  `projectableShapes`/`datasetIsEmpty` cover it.
- **Adapter** — `components/views/diff-view.ts` (`s-diff`) draws a unified sign gutter with add/del
  tints (`status-connected`/`status-disconnected`) and a token-highlighted body; embedded keeps the
  first 12 lines plus a count. The token palette/highlight moved to `views/token-render.ts`
  (`highlightStyles`/`highlightLine`), now shared by `s-code` and `s-diff` (DRY).
- **Config-change** — `artifactViewSpec` maps a `config-change` block whose data is
  `{ before, after, language?, from?, to? }` to a `DiffDataset` (`shapes: ['diff','text']`, default
  title "Config change") and falls back to structured JSON otherwise; the Notebook routes
  `config-change` through `s-view`.
- **Tests** — new `diff-view.test.ts` (differ + element); projection/adapter/artifacts updated;
  279 component tests green.

### (v4.12) — WP3 start: the `code` shape + `s-code` adapter
- **Contract** — `Shape` gained `'code'`; new `CodeDataset { kind:'code'; language?; lines }` joins
  `ViewDataset`. `view-projection` projects `code` → `text` and → single-column `table`;
  `projectableShapes`/`datasetIsEmpty` cover it.
- **Adapter** — `components/views/code-view.ts` (`s-code`) renders a line-number gutter (CSS grid,
  `user-select: none`) and `components/views/code-highlight.ts` (`tokenizeCode`) is a pure,
  line-local tokenizer (strings / comments / numbers / keywords, with `#` comments gated to
  hash-comment languages and a round-trip invariant). Embedded budget keeps the first 8 lines plus
  an "… N more lines" count.
- **One rendering path** — `artifactViewSpec` maps a `code` block to a `CodeDataset`
  (`shapes: ['code','text']`, title = language); the Notebook routes `code` through `s-view` like
  `table`, keeping the `<pre class="code">` only as a no-spec fallback.
- **Tests** — new `code-view.test.ts` (tokenizer + element); projection/adapter/artifacts updated;
  272 component tests green.

### (v4.11) — WP2 start: one URL mirror primitive + renderer validation
- **2.6 mirrors** — added `setUrlState(key, value, equals?)` (write-if-changed) and
  `mirrorAtom(source, key, project, equals?)`; every ad-hoc subscription now goes through
  `mirrorAtom`: `renderer`, `lens` (new), `focus`, `layer`, `folded`, `panels`. `layout`
  stays a two-atom derived mirror but shares `setUrlState`. Folded/panels compare with a
  shared order-insensitive `sameStringList`, so a re-serialised set does not churn the URL.
- **2.6 validation (partial)** — `hydrateFromUrl` now drops a `renderer` that no registered
  renderer claims (`workspaceRendererIds()`, cycle-free), and `$activeLens` mirrors into
  `urlState.lens`. `layout` validation deferred (see the `2.6 validation` note).
- **Tests** — `url-state.test.ts`: unregistered-renderer ignored, active-lens mirror, panels
  two-way. 266 component tests green.

### (v4.10) — WP1 sweep: capability gate (WP1 complete)
- **`capabilityGate`** — renamed `capabilityEnabled` to `capabilityGate(cap)`, the one predicate
  capability-aware surfaces/commands read; `block-menu` now uses it instead of inline
  `$capabilities.get().has('reasoning')`.
- **Descriptor-declared capabilities** — `OverlayDescriptor.capability`; `OverlayHost.open` refuses a
  gated overlay, and the derived `overlay.*` command carries `available: () => capabilityGate(cap)`
  so the palette/HUD hide it uniformly. The `CapabilityHost` mixin form waits for a component that
  gates its whole presence.
- **Tests** — `capabilities` (gate), `overlay-host` (gated open refused + gated command hidden);
  263 component tests green.

### (v4.9) — WP1 sweep: one action source (HUD dispatches commands)
- **Unified dispatch** — the HUD buttons (toc/timeline/settings/telemetry-full/palette) and the `⌘K`
  shortcut now `dispatchCommand('overlay.*', { anchor })` instead of emitting `overlay:open` directly,
  so HUD, palette, and agent share one registry-derived action source (and HUD use feeds MRU).
- **Palette self-exclusion** — the palette overlay keeps `hiddenInPalette`, so a new explicit
  `overlay.palette` command is marked `paletteHidden`: `activeCommands()`/`dispatchCommand` still find
  it, `paletteCommands()` (new) omits it from the palette list.
- **Tests** — `workspace-hud` loads the overlay registry and asserts the dispatch path; `dispatch`
  covers `paletteHidden`; 261 component tests green; e2e timeline/smoke/focus-concept/keyboard green.

### (v4.8) — WP1 sweep: capability-derived HUD controls
- **Renderer controls by capability** — `WorkspaceRendererCaps` gained an optional `controls:
  readonly WorkspaceControl[]` (`'layers'`), with `rendererHasControl()`. The graph renderer declares
  `controls: ['layers']`; `workspace-hud` shows the layer filter iff the active renderer opts in, so
  `active === 'graph'` is gone. Notebook/graph3d declare none and show no layer filter.
- **Tests** — `workspace-hud` now asserts graph3d and notebook both hide the layer control.

### (v4.7) — WP1 sweep: anchor resolver + graph focus
- **Generic anchor resolver** — `OverlayHost.open` now defaults the focus-return anchor to
  `document.activeElement` when the caller does not name one, so overlays opened from the graph or a
  shortcut restore focus without each caller passing an element. HUD/notebook callers still pass the
  explicit button.
- **Graph canvas is focusable** — `#cy-container` gained `tabindex="0"` (+ `:focus-visible` ring), so
  clicking the graph focuses it and overlays restore focus there; `graph-viewport` no longer passes
  `anchor: this`.
- **Fixed a v4.2 regression** — the global `j`/`k` guard bailed whenever *any* overlay was open, so
  the focus-less inspector disabled graph navigation. The guard now yields only when an overlay
  `containsFocus()` or `hasModal()`. New `OverlayManager.containsFocus()`/`hasModal()`.
- **Tests** — `overlay-host` (anchor default), `overlay-manager` (focus/modal); e2e
  `timeline`/`focus-concept`/`keyboard-navigation`/`smoke` green.

### (v4.6) — WP1 sweep: overlay announcer + modality decision
- **Announcer bridge** — `OverlayEntry` gained `title`; `OverlayManager` announces `"{title} opened"`
  / `"{title} closed"` for focus-less popovers (`autoFocus: false`, e.g. the inspector), while
  focus-moving overlays keep relying on their dialog semantics. Re-opening an existing overlay
  (restack) stays silent, so graph `j`/`k` navigation does not spam the live region.
- **Palette modality** — decided **non-modal** (outside-click dismisses). `modal` currently only
  means "ignore outside-click"; a true modal needs a scrim the manager does not render, recorded as
  an opportunity (needed by 0.5 tool approval).
- **Tests** — `overlay-manager` covers announce/don't-announce; suite 258 green.

### (v4.5) — WP1 sweep: overlay args + palette MRU
- **`overlay.*` args** — the derived overlay commands now forward the caller's `ref`/`anchor`
  (previously only `ref`) to `overlay:open` via spread, so an agent/palette caller can pass an anchor.
- **Palette MRU** — new `core/command-history.ts` records every successful `dispatchCommand`; the
  palette fronts a "Recent" group (max 5, most-recent first, de-duplicated) when the query is empty,
  and `run()` now goes through `dispatchCommand`, so palette/HUD/agent usage all share one recorder.
- **Tests** — `palette` covers the Recent ordering; full component suite 257 green.

### (v4.4) — HUD clears the composer (unblocks HUD-summoned overlays)
- **Problem** (found in v4.3): `input-hud` is `position: fixed`, so its full-width host overlaid the
  bottom of `graph-area` and made every `workspace-hud` button pointer-unreachable; only the `⌘K`
  palette could summon overlays.
- **Fix** — kept the composer fixed (so the graph does not resize while typing), and instead:
  - `input-hud` publishes `--composer-height` (via `ResizeObserver`) to `documentElement`, and sets
    `pointer-events: none` on its host with `auto` on `.hud-input`, so only the visible bar captures
    clicks and the rest of the fixed band passes through.
  - `workspace-hud` floats at `bottom: calc(var(--composer-height, 0px) + …)`, so the pill and its
    popovers sit above the composer and update as it grows (up to the 200px textarea max).
- **Validated**: `timeline` HUD-click case (previously red on pristine) and
  `smoke`/`focus-concept`/`slider-mash`/`keyboard-navigation` all pass on chromium.
- **Follow-up**: visual baselines are now stale — run `pnpm test:visual:update`.

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
- **Visual baselines are stale.** The HUD moved above the composer, and earlier demotions renamed
  cells (`panel-config` → `overlay-settings`, telemetry removal), so `pnpm test:visual:update`
  should be run (and the gallery refreshed) before relying on `test:visual`.
- **`edit-edge` e2e (pre-existing).** `tests/scenarios/relational/edit-edge.spec.ts` uses
  `node-detail-drawer .tab-button` (real class is `.tab`) and its `clickEdge` path never opened a
  drawer because the old standing panel keyed only on `$selectedNodeId`. The `$selectedEdgeId`
  watcher added in v4.2 now opens the inspector for edges, but the stale selector remains; both cases
  are red on pristine.
- **Overlay/command sweep still open:** `config-hud` `embedded` mode + provider switching as an
  overlay action (await the `LmProvider` façade); a `CapabilityHost` mixin once a component gates its
  whole presence. `overlay.*` arg forwarding, anchor resolver, capability-derived layer control,
  `capabilityGate`/descriptor capabilities, palette MRU/modality/announcer, and unified HUD↔palette
  dispatch are done (v4.5–v4.10). WP1's sweep is otherwise complete.
- **Modal scrim (new).** The manager treats `modal` as "ignore outside-click" but does not block
  background interaction or paint a scrim, so nothing is marked modal. If a true modal is needed
  (tool approval, 0.5), add a scrim element + `pointer-events` capture to `OverlayManager`.
- **Code highlighting is line-local (new).** `tokenizeCode` deliberately carries no state across
  lines, so multi-line block comments, template-literal interpolation and heredocs are not tracked.
  Upgrade paths if wanted: a tokenizer with carry (still dependency-free), or reuse the landed
  inline-tokenizer seam from `1.4 rich text`. `codeLanguage` in `artifacts.ts` still casts
  `block.data`; landing `4.3 typing` removes that cast and lets the language ride the typed contract.
- **`config-change` payload has no producer yet (new).** The landed diff view reads
  `{ before, after, language?, from?, to? }`, but nothing emits `config-change` blocks today
  (segmentation/projection/3.6). Whoever produces them first must match that payload, or adjust
  `artifacts.ts`; the JSON fallback keeps an unmatched shape renderable meanwhile. `diffLines` is
  O(n·m), fine for config/comparison sizes but not for large file diffs — a Myers/edit-script or a
  side-by-side shape would be the upgrade path.
- **ToC artifact lookup is per-render (new).** `hasArtifact` calls `artifactViewSpec` for every
  rendered row on each update; fine at current scale but a candidate for the WP8 `7.3 performance`
  memoisation pass (alongside `tocEntries`/`explainModel`/`activeCommands()`). Inspector
  reachability for artifacts waits on a node→workspace-block mapping, which no producer emits yet.

### (v4.1) — restructured into work packages
- Rewrote the forward plan as work packages with a dependency spine; folded every improvement
  opportunity into its owning item (one home per task); moved blocked/ambiguous items to §Awaiting;
  pruned landed-prose (v3 holds history). No code change.
