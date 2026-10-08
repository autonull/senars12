# TODO.ui.5.md — Work-Package Backlog

> **Relationship.** Supersedes `TODO.ui.4.md` **for all open work**; v4 (and v3) is the **landed
> record** (product framing, `WorkspaceGraph`/`WorkspaceRenderer` contracts, keep/demote ledger,
> block-kind matrix, provenance tags `(a)…(ag)` → v3 Appendix D, and the v4 progress log). This file
> is the **execution spine**: one home per open item, **consolidated from v4** — landed `[x]` items
> pruned to §Landed (v4), cross-cutting prerequisites lifted to §Blockers, and overlapping items
> merged (each merged item notes its sources).
>
> **Stable ids.** Legacy phase/item ids (`0.4`, `3.3`, `4.3`, …) are kept as **tags** so old
> references and provenance resolve. Do not renumber. Provenance tags `(x)` point into v3 Appendix D.
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
WP3 ─▶ WP5 ─▶ WP6
WP3 ─▶ WP4
```
Critical path: **WP3 → WP5 → WP6 → WP7**. WP-level edges are **soft** (v4 already ran WP2/WP3 ahead of
WP1); §Ready queue reflects *item-level* blockers, not WP order.

Status legend: `[ ]` todo · `[~]` partial · `[x]` done · `!` blocked.
Size legend: **S** ≈ under half a day · **M** ≈ about a day · **L** ≈ multi-day / cross-cutting.

## Ready queue — unblocked now

Ordered by leverage on the critical path; `→` files are the likely edit surface.

1. **`0.6 backend seam`** (L) — opens WP5 and the WP1 sweep. `→ core/` backend contract + `LmProvider`
   façade, `shared/`, `workspace-renderer.ts`
2. **`4.3 typing`** (M) — unblocks the `data` casts and `3.3 derivation-record`. `→ workspace-graph.ts`,
   `segmentation.ts`, `artifacts.ts`
3. **`1.5/1.1 section model`** (L) — unblocks `1.5 page` and notebook depth. `→ toc.ts`,
   `workspace-graph.ts`, `renderers/notebook.ts`
4. **`2.6 context`** (M) · **`2.6 scope`** (M) — state/URL consolidation.
5. **`2.4 inspection & embedded views`** (L) ·
   **`citations model`** (M). (`4.5 pinning` is partially landed — manager/command pinning; see WP4.) (`1.4 rich text` is partially landed — inline tokenizer; see WP1.)
6. **`4.4 anchor`** (M) · **`ops sequencing`** (M) — timeline/ops, independent of WP3 completion.
   (`4.4 controls` is partially landed — live reset + readout; see WP4.)

*(The three small state wins — `2.5 defaults`, `2.5 selection atom`, `2.5 focus react` — are landed.)*

**Gated** (see §Blockers): `0.5`; `1.5 page` (needs the section model); the inspector half of
`4.3 affordances`; WP5 `3.3` → `4.3 derivation-record`; WP5 `3.6` → the `config-change` producer.

## Blockers / prerequisites

Cross-cutting constraints that gate multiple items — each is a work order: first step + done-when.

- **Modal scrim** — blocks **`0.5`**. *First step:* paint a scrim element in
  `core/overlay-manager.ts` and set `pointer-events` capture so background clicks are swallowed.
  *Done when:* a `modal` overlay traps focus and blocks interaction behind it, with a manager test.
- **`LmProvider` façade** — the `0.6` contract; blocks WP1 sweep + **WP5**. *First step:* define the
  backend/provider interface and adapt the real `lm.status`/`lm.switch`. *Done when:* provider
  switching, the Provider/Config split, and `config-hud` `embedded` are wired against the façade.
- **Section model** — blocks **`1.5 page`**. *First step:* recurse `roots` + heading `level`s into a
  section tree in `core/toc.ts`. *Done when:* pages/ToC are non-shallow and `page` is URL-addressable.
- **Node→workspace-block mapping** — blocks the inspector half of **`4.3 affordances`** and richer
  **`2.4`**. *First step:* decide where a selected engine node/edge resolves to a block `ref`. *Done
  when:* the inspector can open an artifact for the selected node.
- **`DerivationRecord` payload** — defined by WP5 **`3.3`**; blocks **`4.3 derivation-record`**.
- **`config-change` producer** — nothing emits `config-change` yet (segmentation/**`3.6`**); the diff
  view reads `{ before, after, language?, from?, to? }` (JSON fallback meanwhile).

## Seams you can build on

Landed extension points — wire features here instead of re-deriving them.

- **Overlays** — `core/overlay-registry.ts` (`registerOverlay`, `OverlayDescriptor`: `tag`,
  `capability`, `hiddenInPalette`, `autoFocus`); `core/overlay-manager.ts` + `core/overlay-host.ts`
  (open/close/stack/anchor, `containsFocus`/`hasModal`); `core/surface.ts`.
- **Views** — `core/view-spec.ts` (`Shape`, `ViewDataset`, `ViewSource`); `core/view-adapter.ts`
  (`registerViewAdapter`, `viewAdapterFor`, `supportedShapes`); `core/view-projection.ts`
  (`projectDataset`, `projectableShapes`, `datasetIsEmpty`); `components/views/index.ts` barrel;
  `components/views/token-render.ts` (`highlightLine`/`highlightStyles`).
- **Inline text** — `core/inline-text.ts` (`tokenizeInline`) — the safe inline Markdown subset the
  Notebook renders as Lit nodes (no `innerHTML`); reuse it instead of adding a second renderer.
- **Artifacts** — `core/artifacts.ts` (`artifactViewSpec`); `core/diff.ts` (`diffLines`).
- **Commands** — `core/commands.ts` (`activeCommands`/`dispatchCommand`/`paletteCommands`,
  `available`/`params`); `core/command-history.ts` (MRU); `core/command-match.ts`.
- **Capabilities** — `core/capabilities.ts` (`capabilityGate`, `$capabilities`).
- **Renderers** — `core/workspace-renderer.ts` (`registerRenderer`, caps/`controls`,
  `workspaceRendererIds`); `components/renderers/*`.
- **State / URL** — `core/store.ts` (`$urlState`, `setUrlState`, `mirrorAtom`, `hydrateFromUrl`,
  `$panels`, `$activeRenderer`, `$activeLens`, `$graphLayer`, `$lensLayer`, `$layoutScope`,
  `$conversationLayout`, `setActiveLayout`, `$collapsedBlocks`, `setWorkspaceFocus`).
- **Projection** — `core/workspace-projection.ts`, `core/graph-projection.ts`, `core/segmentation.ts`.
- **Explain / links / ToC** — `core/explain.ts`, `core/neighborhood.ts`, `core/toc.ts`,
  `utils/link-catalog.ts`.
- **Layouts** — `utils/layout-registry.ts`, `utils/lens-catalog.ts`; the pure position projections
  `core/conversation-layout.ts` and `core/reasoning-layout.ts` (`reasoningPositions`); `core/layout-ids.ts`
  (`registerLayoutId`/`isRegisteredLayoutId`) — the cycle-free id leaf the store validates against.
- **Block affordances** — `components/overlays/block-menu.ts` (Copy / Open-in-graph / artifact /
  provenance / formalize).

---

## WP1 — Shell completion (finish)

*Outcome: no standing panels; overlay primitives complete; backend seam landed. No deps.*

- [ ] **0.5 tool approval** — build the tool-approval dialog overlay; needs the **modal scrim**
  blocker. `→ overlays/tool-approval.ts` (new), `core/overlay-manager.ts`. `(b)`,`(aa)`
- [~] **4.5 pinning** — overlays pinnable as floating cards (manager seam `setPinned`/`pinned` exists);
  decide session-only vs URL-addressable. Landed: **session-only** pinning through the manager —
  `setPinned` reflects `data-pinned` on the element and announces; `overlay:pin {id,pinned}` and
  `overlay:pin-toggle` events; app-layout wires them; an `overlay.pin` palette command toggles the top
  overlay. Remaining: a per-overlay pin *button* (the command is the current affordance) and CSS for
  `[data-pinned]`. `→ core/overlay-manager.ts`, `core/events.ts`, `core/commands.ts`,
  `components/app-layout.ts`. `(b)`,`(e)`,`(aa)`
- [ ] **0.6 backend seam** — land the `ReasoningBackend` contract + adapter seam (`LmProvider` façade;
  `lm.status`/`lm.switch` already real). Needed by WP5. Sweep once it lands:
  - provider switching as an overlay action; split Provider vs Configuration entries.
  - `config-hud` `embedded` mode.
  - `CapabilityHost` mixin form, once a component gates its whole presence. `→ core/` contract,
    `components/overlays/settings.ts`/`config-hud.ts`. `(c)`,`(aa)`,`(m)`,`(k)`,`(f)`

## WP2 — State & URL consolidation

*Outcome: one state source; everything deep-linkable. Deps: WP1 (soft).*

- [x] **2.6 validation** — renderer validation (cycle-free `workspaceRendererIds()`),
  `$activeLens` → `urlState.lens`, and now `UrlState.layout` vs the registry are done. The
  **cycle-free layout-id source** is `core/layout-ids.ts`: `layout-registry` publishes each id at
  `register()` and `hydrateFromUrl` drops an id the leaf does not know (a stale link cannot seed
  `$lensLayout`). `→ core/store.ts`, `core/layout-ids.ts`, `utils/layout-registry.ts`.
  `(s)`,`(t)`,`(x)`,`(ac)`
- [ ] **1.5 page** — URL-address `page` (`(page, block, disclosure)`); needs the **section model**
  blocker. `→ core/store.ts` (url-state), `core/toc.ts`. `(s)`,`(t)`,`(h)`,`(q)`
- [~] **2.6 scope** — scope-aware active layout (concept vs conversation) + URL-address it; remember
  the graph layer per lens; debounce `folded` writes for fold-all. Landed: `$layoutScope` +
  `$conversationLayout` (concept layouts keep the per-lens `$lensLayout`, conversation gets its own
  slot), `setActiveLayout(id)` routes a pick to its scope's slot, both viewports lay out via
  `layoutRegistry.getForScope(scope)`, and `UrlState.scope`/`layout` round-trip a link; `$lensLayer` +
  `setGraphLayer` remember the layer per lens (a lens switch restores it). Remaining: debounce `folded`
  writes for a bulk fold-all (no fold-all command exists yet). `→ core/store.ts`,
  `utils/layout-registry.ts`, `core/layout-ids.ts`, `components/graph-toolbar.ts`,
  `components/graph-viewport.ts`, `spacegraph/spacegraph-viewport.ts`. `(y)`,`(ac)`,`(w)`,`(t)`
- [x] **2.5 selection atom** — `$selectedNodeIds` is now derived from `$workspaceGraph.selection`: a
  store-level projection subscription mirrors the set (value-compared, so re-projection carrying the
  selection over does not churn), and every former writer (`graph-viewport`, `graph` renderer,
  `graph-toolbar`, `node-detail-drawer`) now routes through `setWorkspaceSelection`. This removes the
  dual-write footgun; `$selectedNodeIds` stays a readable-compatible atom for the flat-set consumers.
  `→ core/store.ts`. `(z)`
- [x] **2.5 focus react** — Graph viewport centres/highlights on `$workspaceGraph.focus` (Notebook
  already scrolls). Landed as `GraphViewport.reactToFocus()` at the end of `syncGraph`: it tracks the
  last focus and calls `centerOnNode` for an outside focus (ToC/breadcrumb/block-menu/URL), while a
  focus equal to the live selection is left to the existing `$selectedNodeId` watch; `setWorkspaceFocus`
  now skips same-value writes. The 3D viewport is not yet wired (see opportunities).
  `→ core/store.ts`, `components/graph-viewport.ts`. `(h)`,`(n)`,`(r)`,`(z)`
- [x] **2.5 defaults** — capability-aware default renderer (`language`→Notebook, `reasoning`→Graph).
  `defaultRendererFor(caps)` plus `setCapability` reframing the active renderer when a renderer-bearing
  capability (`language`/`reasoning`) toggles; unrelated capabilities (tools/memory/uiControl) leave the
  renderer alone. Deliberately *not* applied at boot — the shell's `graph` default stands so the e2e
  suite's `graph-viewport` assertions hold. `→ core/capabilities.ts`. `(k)`
- [ ] **2.6 context** — extend `WorkspaceContext` (`overlays`, `renderer`, `setRenderer`; fold
  `openPalette` onto `activeCommands()`); retire `$viewportMode`/`$graphShape` shell atoms once
  `graph-surface` owns them. `→ core/workspace-renderer.ts`, `components/workspace-host.ts`,
  `core/commands.ts`. `(b)`,`(f)`,`(ae)`

## WP3 — View & artifact completion

*Outcome: full view matrix, clean artifact typing, embedded views, section model. No deps.*

- [ ] **4.3 typing** *(promoted)* — discriminated `Artifact` union on `SemanticBlock`/`Segment` (drop
  `data` casts); promote `Segment.data` to the `Artifact` contract. Now has concrete consumers:
  `codeLanguage` (`artifacts.ts`), `config-change`, and the image `data` cast. Migration: add the
  union *alongside* `data`, migrate consumers one by one, then remove casts.
  `→ core/workspace-graph.ts`, `core/segmentation.ts`, `core/artifacts.ts`. `(i)`,`(j)`,`(d)`
- [ ] **1.5/1.1 section model** *(merged: `1.5 page` model + `1.5/1.1 notebook structure`)* — recurse
  nested `contains`/headings so pages/ToC aren't shallow; nested-section folding by heading `level`;
  fold-all/unfold-all command; folded-count badge; keep `j/k` consistent with folded visibility and
  decide whether it skips container roots; optional `clampStep`; "jump to related block" from
  breadcrumb/block menu. Provides the model `1.5 page` needs. `→ core/toc.ts`,
  `core/workspace-graph.ts`, `components/renderers/notebook.ts`. `(d)`,`(q)`,`(h)`,`(s)`,`(t)`
- [ ] **2.4 inspection & embedded views** *(merged: `2.4 graph inspection` + `4.1/4.2 embedded
  views`)* — node/edge hover popovers reusing `explainModel`/`neighborhood`; artifact edge previews;
  richer inspector (link confidence + event refs); "Open related" from graph menu and ToC; remember
  neighborhood depth; ⌥-click a row to explain instead of navigate. Plus: Notebook embedded graph block
  (derivation/contradiction/topic neighborhood); Graph node popover notebook card; graph edge popover
  derivation tree; wire the block-menu "embed" affordance; reuse `conversationPositions` and
  `projectWorkspaceGraph` in embedded graph shapes. `→ core/explain.ts`, `core/neighborhood.ts`,
  `components/overlays/{inspector,block-menu,related}.ts`, `components/node-detail-drawer.ts`,
  `components/views/graph-*.ts`. `(r)`,`(n)`,`(y)`,`(e)`
- [~] **4.3 affordances** — the artifact overlay **Copy** / **Open in graph** and the ToC per-row
  artifact button are done. Remaining: inspector reach — needs the **node→block mapping** blocker.
  `→ components/overlays/inspector.ts`, `components/node-detail-drawer.ts`. `(j)`,`(ad)`
- [~] **1.4 rich text** — inline tokenizer for paragraphs (links/emphasis/code spans), unified with the
  landed `tokenizeCode` seam where possible; image intrinsic size `{width?,height?}`; optional inline
  full tables (`budget="full"`); ensure the view barrel is imported standalone / owned by
  `WorkspaceHost`. Landed: `core/inline-text.ts` (`tokenizeInline` — code/strong/em/link, pure and
  escaped-by-construction, no `innerHTML`) rendered by the Notebook for headings, paragraphs and list
  items. Remaining: image intrinsic size, inline full tables, view-barrel ownership.
  `→ core/inline-text.ts`, `components/renderers/notebook.ts`. `(i)`,`(j)`
- [ ] **citations model** — `Source`/bibliography (stable citation key, `[n]` resolution) to split
  formal citations from plain links. `→ core/segmentation.ts`, `core/artifacts.ts`,
  `components/views/text-view.ts`. `(i)`

## WP4 — Timeline present-anchoring

*Outcome: the timeline is a real present-anchored scrubber. Deps: WP3 (soft).*

- [~] **4.4 controls** — explicit live/past/prospective controls ("now" resetting `t` to `Infinity`, a
  range readout) and announce the applied window. Landed: a `Now` button returning to the present
  (`t = Infinity`) and a `role="status"` readout ("Live · all events" vs the scrubbed time); the range
  now renders the present as `maxTime` instead of the invalid `Infinity`, so the default live state is
  usable. Remaining: an explicit *prospective* control (the temporal gate has no future term today) and
  moving the announce region to the overlay header. `→ components/timeline-scrubber.ts`. `(ag)`
- [ ] **4.4 anchor** — present-anchored cursor fading newly admitted blocks; thread `createdAt`/event
  time through `projectGraph`/projection. `→ core/workspace-graph.ts`,
  `core/workspace-projection.ts`, `components/overlays/timeline.ts`. `(ag)`,`(y)`
- [x] **4.4 gating** — gate the `⏱` HUD control on temporal availability (node with `occurrenceTime`
  or a capability flag). Landed as `hasTemporalData()` in `core/store.ts` (any `$graphNodes` entry with
  `occurrenceTime`); the HUD watches `$graphNodes` and only paints `⏱` when true. The capability-flag
  alternative is unused — engine nodes are the honest signal today.
  `→ components/workspace-hud.ts`, `core/store.ts`. `(ag)`
- [ ] **ops sequencing** — carry engine `seq`/`eventRefs` on `WorkspaceOp` for ordering/provenance.
  `→ core/workspace-graph.ts`, `core/workspace-projection.ts`. `(Phase 0.1–0.3)`

## WP5 — Reasoning vertical slice

*Outcome: the `reasoning` capability end-to-end. Deps: WP3; needs `0.6`.*

- [ ] **3.1 projection** — map NAR concepts/events → blocks/links: beliefs, goals, questions,
  derivations, revisions, contradictions, budget events, gate decisions.
  `→ core/workspace-projection.ts`, `core/graph-projection.ts`. `(Phase 3)`
- [ ] **3.2 formalization** — claim → candidate → gate admission → belief/goal/question, visible in both
  renderers; route `claim`/`question` composer children through it; emit `asks`/`answers` links;
  special-case structured modes in `projectChat`; server `mode`/`contexts` consumption.
  `→ core/segmentation.ts`, `core/workspace-projection.ts`, `components/input-hud.ts`. `(g)`,`(l)`,`(k)`
- [ ] **3.3 provenance** — `derivation-record` blocks (premises/conclusion links, truth/confidence, rule
  id, evidence lineage, raw record); defines the `DerivationRecord` payload. **Absorbs
  `4.3 derivation-record`** — the `s-tree` provenance view consumes this payload.
  `→ core/workspace-projection.ts`, `components/views/tree-view.ts`. `(Phase 3)`,`(ad)`
- [ ] **3.5 explanation** — extend the explanation popover to reasoning targets (claim/node/edge/event/
  belief/goal/derivation) with `summary · card · detail · raw`. `→ core/explain.ts`,
  `components/overlays/explain.ts`. `(Phase 3)`
- [x] **3.4 layouts** — `reasoning-provenance`, `gate-pipeline`, `contradiction-neighborhood`,
  `budget-resource` as `layoutRegistry` rows with deterministic variants. Landed as
  `core/reasoning-layout.ts` (`reasoningPositions`, pure, reusing `blocksInOrder` and `Point`) +
  concept-scope registry rows with `recommendedFor` lenses; the link-catalog parity test now passes
  without an allowlist. `→ core/reasoning-layout.ts`, `utils/layout-registry.ts`. `(Phase 3)`
- [ ] **3.6 steer/author** — retract/revise belief, add goal, adjust budget/provider from block/node
  actions; live reaction as new blocks/links. Also the **`config-change` producer** (emit the landed
  diff payload on settings changes). `→ core/commands.ts`, `components/overlays/block-menu.ts`,
  `core/workspace-graph.ts`. `(Phase 3)`
- [ ] **3.7 MeTTa** — adapter feeding the same substrate; one scenario through it. `→ core/` adapter. `(Phase 3)`
- [ ] **2.3 node ops** — node-creating ops from the graph ("Ask as question" / "Assert as claim" →
  `WorkspaceOp.block.add`); reconcile cross-fragment context refs in `projectWorkspace`.
  `→ core/workspace-projection.ts`, `components/renderers/graph.ts`. `(o)`,`(p)`,`(m)`

## WP6 — Parity & rendering quality

*Outcome: executable §10 parity; live graph. Deps: WP1, WP2, WP5.*

- [ ] **2.5 parity suite** — script the canonical loop per full renderer; per-pair continuity
  round-trips; make the §10 matrix **data** (`rendererParity`/`rendererSupports`) so palette/shell gate
  uniformly. `→ core/workspace-renderer.ts`, `components/renderers/*`. `(z)`,`(ae)`
- [ ] **2.1 growth** — incremental animated growth of the workspace layer (today replace-by-diff).
  `→ core/workspace-projection.ts`, `components/renderers/graph.ts`. `(n)`,`(y)`
- [ ] **2.1 clusters** — compound clusters from chat `contains`/headings (set `children` on turns /
  infer). `→ core/workspace-projection.ts`. `(n)`
- [ ] **1.2/2.3 floating composer** — anchored to block/node/subgraph (summoned, not persistent) with
  capability-gated modes and cy→DOM coordinate handoff. `→ components/input-hud.ts`,
  `core/commands.ts`. `(k)`,`(g)`,`(o)`,`(p)`
- [ ] **1.2 composer sweep** — mode bar ↔ palette share one action source; `composer.prefill` signal;
  per-segment preview (fix kind, merge/split); guard `decomposeInput` against abbreviation/decimal
  over-splitting; optional context-excerpt reply; extract shared `ComposerFocus` type.
  `→ components/input-hud.ts`, `core/commands.ts`. `(m)`,`(k)`,`(g)`
- [ ] **2.x graph polish** — unify workspace-node lens/capability styling in the adapter; skip laying
  out / exclude hidden layer from `fit`; bind `graph.ask-selection` (e.g. `a`); HUD/palette layout group
  + `graph.layout.cycle`; register `chronological-flow`/`source-view` SpaceGraph surfaces when a
  storyboard adapter exists. `→ components/renderers/graph.ts`, `core/workspace-renderer.ts`,
  `components/graph-toolbar.ts`. `(n)`,`(w)`,`(ab)`,`(p)`,`(y)`

## WP7 — Agent-operable

*Outcome: the agent drives the workspace. Deps: WP6.*

- [ ] **5.1 execution** — `ui.command` over the workspace (set renderer, focus, explain, highlight, open
  ToC/search, present artifact, embed view, compose, narrate, **scrub** — `ws.scrubTime` driving
  `$view.timeline.t`); round-trip test through `applyServerMessage`; record executed commands in
  timeline/telemetry; engine emits `ui.command` for narrations/demos.
  `→ core/commands.ts`, `core/ws-client.ts`, `core/workspace-bindings.ts`. `(u)`,`(v)`,`(ag)`
- [ ] **5.1 args** — parameterised commands with a `params` descriptor (generated `parse` + palette
  prompt); type-check args against `UiCommandMsg.args`; `available()`-aware palette badge.
  `→ core/commands.ts`, `components/overlays/palette.ts`. `(u)`,`(v)`
- [ ] **5.2 control mode / run-control** — default off → suggestions; on → execution with a visible
  command log + HUD **stop** button; then add budget/stop to the HUD.
  `→ components/workspace-hud.ts`, `core/commands.ts`. `(c)`,`(f)`
- [ ] **5.3 demonstrations** — "show me how you got that" switches renderers, focuses refs, opens
  provenance, narrates; no fake player. `→ core/commands.ts`. `(Phase 5)`
- [ ] **5.4 screen-record mode** — minimal HUD, focus highlight, captions/narration.
  `→ components/workspace-hud.ts`. `(Phase 5)`

## WP8 — Bridge, hardening, standalone, 3D

*Outcome: shippable product. Deps: WP7.*

- [ ] **0.7 bridge** — legacy graph nodes/events/chat render as overlays/embedded views; ViewSpec
  adapters usable inside overlays and `embedded-view` blocks. `→ components/overlays/*`,
  `components/views/*`. `(0.7)`
- [ ] **7.1 boundary** — package split (`semantic-graph` vs SpaceGraphJS umbrella; see open questions). `(7.1)`
- [ ] **7.2 standalone** — engine-free build: LM provider + segmentation + semantic links + Notebook/Graph. `(7.2)`
- [ ] **7.3 performance** — op batching, notebook/ToC virtualization, graph decimation, latency budgets;
  `mountWorkspaceProjection` incremental ops / microtask-rAF coalescing; `applyWorkspaceOp` batch
  publish; memoise `tocEntries`/`explainModel`/`activeCommands()`/segmentation and the ToC per-row
  artifact lookup; shared `linksByBlock` adjacency index for `linksTouching`/`neighborhood`/projection.
  `→ core/workspace-projection.ts`, `core/toc.ts`, `components/overlays/toc.ts`. `(b)`,`(e)`,`(f)`,`(d)`,`(r)`
- [ ] **7.3 quality** — error taxonomy; accessibility pass (keyboard-only walkthrough, canvas text
  alternatives via the table adapter); plugin/descriptor API for renderers/block kinds/link kinds;
  docs-as-code from descriptors; re-expand the visual-regression net. `→ core/`, `tests/visual`. `(7.3)`
- [ ] **tests & parity harness** *(merged: `2.x pure-helper tests` + `tests sweep`)* — extract +
  unit-test `nodeTapAction`/`nodeGesture`, `workspaceRefs`; Graph-renderer unit test (import pulls
  Cytoscape) and an `app-layout` test; segmentation round-trip property test; Notebook `composer:focus`
  path test; regenerate visual baselines for the telemetry/timeline demotions; fix the stale e2e
  "default telemetry panel" comment and the timeline-overlay test-API registration note. Landed:
  `tests/components/layout-registry.test.ts` — link-catalog `layouts` ⊆ registry (now complete; the
  WP5 `3.4` ids register in `core/reasoning-layout.ts`), scope partitioning, and per-primary-lens
  resolution. `→ tests/`.
  `(o)`,`(p)`,`(ae)`,`(Phase 0.1–0.3)`,`(d)`,`(q)`,`(af)`,`(ag)`
- [ ] **6 Graph3D** — `WorkspaceRenderer` over SpaceGraph, `parity: 'partial'`; only after Notebook/Graph
  are excellent. Sweep: mirror the Graph's `reactToFocus` (centre on an outside `$workspaceGraph.focus`)
  once the surface exposes a camera primitive. `→ components/renderers/graph3d.ts`. `(6)`

---

## Awaiting / deferred — not actionable yet

- **1.4 block-level streaming** — needs partial assistant text in `$chatMessages` (backend-coupled);
  child-id content hash for mid-stream stability. `(d)`,`(i)`
- **tool transport** for `uiControl` — in-process first, MCP later. `(Appendix C)`
- **LM-assisted enrichment defaults** — on/off, cost visibility, annotation vocabulary. `(Appendix C)`
- **artifact/block sandboxing** policy before untrusted content. `(Appendix C)`
- **multi-agent boundary** — future contract. `(Appendix C)`

## Open questions (carried from v3 Appendix C) — and where they gate work

- Turn/page boundary policy: auto-page per turn pair with agent/user overrides. → **`1.5/1.1 section
  model`**, **`1.5 page`**
- Block-id stability under streaming reparse (content-hash + position anchor). → **`1.4` streaming**
  (awaiting)
- ToC scale: virtualization and outline-only mode for very long sessions. → **`7.3 performance`**
- Composer defaults: which modes surface LM-only; how Believe/Goal degrade to suggestions. →
  **`1.2 composer sweep`**, **`3.2 formalization`**
- Pinning persistence: session-only vs URL-addressable. → **`4.5`**
- Package naming / umbrella placement at extraction. → **`7.1`**

---

## Landed (v4) — rolled up

v4 is the landed record; its full per-version progress log lives in `TODO.ui.4.md` (provenance `(a)…(ag)`
in v3 Appendix D). Rolled up:

- **WP1 shell** — inspector/telemetry/config demoted to overlays; `autoFocus` + generic anchor-resolver
  overlay primitives; palette MRU + non-modal decision + `Announcer` bridge; unified HUD↔palette
  `dispatchCommand` with `paletteHidden`; capability-derived HUD controls; `capabilityGate` + descriptor
  capabilities; HUD clears the composer (`--composer-height`).
- **WP2 state** — `setUrlState`/`mirrorAtom` own every URL mirror (`renderer`, `lens`, `focus`, `layer`,
  `folded`, `panels` two-way); hydrate rejects an unregistered renderer.
- **WP3 views** — `code` shape + `s-code`; `diff` shape + `s-diff` (+ `diffLines`, shared
  `highlightLine`/`highlightStyles`); `config-change` → diff; artifact overlay Copy/Open-in-graph + ToC
  artifact button. Component suite **283 green**.

## Landed (v5) — progress log

- **WP2 state** — `core/layout-ids.ts` is the cycle-free layout-id leaf; `layout-registry` publishes each
  id on `register()`, and `hydrateFromUrl` drops an unregistered `UrlState.layout`. Closes the
  **cycle-free layout-id source** blocker and completes **`2.6 validation`**. `setWorkspaceFocus` skips a
  same-value write; `GraphViewport.reactToFocus()` centres/highlights an outside focus (ToC/breadcrumb/
  block-menu/URL) while leaving selection-driven centring to the existing watch — completes
  **`2.5 focus react`** (2D only). Component suite **305 green** (new: unregistered-layout rejection).
- **WP2 state (cont.)** — `$selectedNodeIds` is derived from `$workspaceGraph.selection` via a value-
  compared store projection; all former dual writers route through `setWorkspaceSelection` — completes
  **`2.5 selection atom`**. `setCapability` reframes the active renderer to the composition default when
  `language`/`reasoning` toggles (`defaultRendererFor`, not applied at boot) — completes
  **`2.5 defaults`**. Suite **307 green** (new: capability renderer reframing).
- **WP4 timeline** — the `⏱` HUD control is gated on temporal availability (`hasTemporalData()` over
  `$graphNodes`; HUD watches `$graphNodes`) — completes **`4.4 gating`**. The scrubber gained a `Now`
  reset (`t = Infinity`) and a live/scrubbed `role="status"` readout, and renders the present as
  `maxTime` rather than the invalid `Infinity` — **`4.4 controls`** partially landed (prospective
  control still open). Suite **310 green**. NOTE: regenerate visual baselines that capture the timeline
  overlay (new `Now` control).
- **Tests** — `tests/components/layout-registry.test.ts`: link-catalog `layouts` ⊆ registry (the WP5
  `3.4` ids allowlisted as pending), scope partitioning, per-primary-lens resolution. Suite **313 green**.
- **WP2 state** — scope-aware layout selection: `$layoutScope` + `$conversationLayout` (conversation
  slot independent of the per-lens concept slots), `setActiveLayout` routing, `getForScope` in both
  viewports, and `UrlState.scope`/`layout` round-trip; `$lensLayer` remembers the graph layer per lens.
  `2.6 scope` except the fold-all debounce. Suite **316 green**.
- **WP1 rich text** — `core/inline-text.ts` (`tokenizeInline`: code/strong/em/link, pure, escaped by
  construction) rendered by the Notebook for headings, paragraphs and list items — **`1.4 rich text`**
  partially landed (image intrinsic size, inline full tables, view-barrel ownership remain). Suite
  **319 green**.
- **WP5 layouts** — `core/reasoning-layout.ts` (`reasoningPositions`: provenance depth, gate stages,
  contradiction neighbourhood, resource lanes — pure and deterministic) registered as four concept-scope
  `layoutRegistry` rows with `recommendedFor` lenses — completes **`3.4 layouts`**. The link-catalog
  parity test no longer needs its pending allowlist. Suite **325 green**.
- **WP4 pinning** — session-only overlay pinning wired through the manager: `setPinned` reflects
  `data-pinned` + announces, `overlay:pin`/`overlay:pin-toggle` events, app-layout handlers, and an
  `overlay.pin` palette command that toggles the top overlay — **`4.5 pinning`** partially landed
  (per-overlay button + `[data-pinned]` CSS remain). Suite **326 green**.
