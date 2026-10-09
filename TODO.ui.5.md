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

1. **`0.6 backend seam`** (M) — both read halves landed (LM façade + `ReasoningBackend` contract and
   NARS adapter); what is left is the *control* half (`submit`/`step`/`run`), which belongs with the
   **`3.6` steer/author** producers. `→ core/`
2. **`2.6 context`** (M) · **`2.6 scope`** (M) — state/URL consolidation. (`openPalette` fold landed;
   renderer/overlays context fields await a consumer; fold-all debounce awaits a bulk writer.)
3. **`2.4 inspection & embedded views`** (L) — **done**: node *and* edge popovers (both carding the
   block the notebook would render, the edge one also showing the derivation tree), ToC reach, remembered
   neighborhood depth, the explain-model Links tab, and the embedded-view cluster (catalog, projections,
   Notebook embedding, block-menu toggles). (`4.3 affordances` and `4.5 pinning` partial —
   inspector reach landed; manager/command pinning. `1.4 rich text` partial — inline tokenizer.)
4. **`ops sequencing`** (M) — deferred until something emits `WorkspaceOp`; the cursor half of
   **`4.4`** landed (one cursor, real `createdAt`, admission in the notebook).
   (`4.4 controls` is partially landed — live reset + readout; see WP4.)

*(Landed from this queue: the `2.4` node hover popover (and with it the `innerHTML` sink), the
`1.5 page` URL address, the `1.5/1.1 section model` (recursive
containment, fold-aware `j`/`k`, `view.fold-all`), the `4.3 typing` payload contract and the
`citations model` bibliography rendering — see §Landed (v5). The three small state wins `2.5 defaults`,
`2.5 selection atom` and `2.5 focus react` were landed earlier.)*

**Gated** (see §Blockers): `0.5`; WP5 `3.3` → `4.3 derivation-record`; WP5 `3.6` → the
`config-change` producer.

## Blockers / prerequisites

Cross-cutting constraints that gate multiple items — each is a work order: first step + done-when.

- **Modal scrim** — ~~blocks **`0.5`**~~ — **landed.** *First step:* paint a scrim element in
  `core/overlay-manager.ts` and set `pointer-events` capture so background clicks are swallowed.
  *Done when:* a `modal` overlay traps focus and blocks interaction behind it, with a manager test.
  The manager owns one scrim, painted beneath the lowest open modal and removed when none is left
  (`.overlay-scrim` in `styles/primitives.css`, `colors.primitive/semantic.bg-scrim` tokens); it
  swallows pointer input and deliberately does nothing else, since a modal closes through its own
  controls or `Esc`. **Settings** is a real modal, so this is visible immediately; the `0.5`
  tool-approval dialog can now be built — but see the note there about its missing producer.
- **`LmProvider` façade** — the `0.6` contract; blocks WP1 sweep + **WP5**. *First step:* define the
  backend/provider interface and adapt the real `lm.status`/`lm.switch`. *Done when:* provider
  switching, the Provider/Config split, and `config-hud` `embedded` are wired against the façade.
  Landed except `config-hud embedded`: `core/lm-provider.ts` (state) + `core/lm-transport.ts`
  (wire), the `provider` overlay, the server answering a switch with a status. **Still open:** nothing
  on the LM side; the `ReasoningBackend` half WP5 needed is landed too (`core/reasoning-backend.ts`
  + `core/nars-backend.ts`) — what it does *not* carry is the control half (`submit`/`step`/`run`),
  which is `3.6` work, not contract work.
- **Section model** — blocks **`1.5 page`**. **Landed:** `core/sections.ts` (`sectionTree`,
  `SectionNode`/`SectionTree`, `pageOf`, `foldableSections`) — one recursive, fold-aware reading of
  containment that the notebook, the ToC, `j`/`k` and the breadcrumb all walk. *Remaining:* make `page`
  itself URL-addressable (`1.5 page`) and settle the turn/page boundary policy (auto-page per turn
  pair with agent/user overrides).
- **Node→workspace-block mapping** — blocks the inspector half of **`4.3 affordances`** and richer
  **`2.4`**. **Landed (node half):** `blockRefFor(backend, id)` in `core/workspace-projection.ts` — the
  projection is the one place that derives a block ref from an engine id, so it resolves through the
  attached backend (`undefined` when the backend does not carry the node) instead of prefixing ids at
  the call site; the inspector's Actions tab uses it for **Open in Notebook** (renderer + focus) and
  **Open View** (the artifact overlay, when the projected block has a spec). *Remaining:* the **edge**
  half landed with the edge popover: `linkRefFor(backend, edgeId)` mints the same `link:` ref
  `projectReasoning` mints, from both endpoints and the backend's edge vocabulary. *Remaining:* the
  derivation tree in **`2.4`** (depth > 1). **Open View** is honest but nearly always
  closed today: an engine claim's payload is the raw record and `claim` is deliberately not in
  `JSON_KINDS`, so it stays hidden until a reasoning producer emits a block kind with a view.
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
- **Inline text** — `core/inline-text.ts` (`tokenizeInline`: code/strong/em/link/`citation`) — the safe
  inline Markdown subset the Notebook renders as Lit nodes (no `innerHTML`); reuse it instead of adding
  a second renderer. A `[n]` reference arrives as a `citation` token, resolved against the bibliography.
- **Block payloads** — `core/block-payload.ts` (`payloadOf(data, kind)`, `ArtifactPayload`,
  `PayloadOf<K>`): the one payload contract `Segment`/`SemanticBlock` produce and every consumer
  narrows through. Add a payload here, not a `data as …` cast at the consumer.
- **Block bodies** — `utils/render-block.ts` (`renderBlockBody(block, sources)`, `blockBodyStyles`):
  the one rendering of a block's content, lifted out of the Notebook so a surface that shows a block
  *inside* something else shows it exactly as the notebook does. Compose `blockBodyStyles` into any
  host that renders a body; do not re-implement artifact/payload/inline rendering per surface.
- **Reaching a block** — `revealBlock(ref)` (`core/store.ts`) switches to the Notebook and focuses,
  and `resolveBlockRef(graph, backend, id)` (`core/workspace-projection.ts`) turns whatever id a graph
  element carries into a block ref. Every surface that navigates to a block goes through both.
- **Embedded views** — `core/embedded-views.ts`: add a derived view as one catalog row plus one pure
  projection (`derivationTree`, `contradictionTable`, `topicTable` → `embeddedDataset` → `ViewSpec`),
  never as a renderer. A spec's dataset is read live off `$workspaceGraph`, and *which views a block
  shows* is session state (`toggleEmbeddedView`), not substrate — `$workspaceGraph` is re-projected, so
  anything written into it is erased on the next chat/engine change.
- **Artifacts** — `core/artifacts.ts` (`artifactViewSpec`); `core/diff.ts` (`diffLines`).
- **Citations** — `core/citations.ts` (`collectSources`, `resolveSource`) — the bibliography a
  `citation` token and a `citation` block resolve against.
- **Commands** — `core/commands.ts` (`activeCommands`/`dispatchCommand`/`paletteCommands`,
  `available`/`params`); `core/command-history.ts` (MRU); `core/command-match.ts`.
- **Capabilities** — `core/capabilities.ts` (`capabilityGate`, `$capabilities`).
- **LM provider** — `core/lm-provider.ts` (`$lmProvider`, `applyLmStatus`, `providerLabel`,
  `providerUsable`) + `core/lm-transport.ts` (`refreshLmStatus`, `switchLmProvider`): read the
  provider state, never the `lm.status` payload; request a switch through the transport, never a raw
  `lm.switch`.
- **Section model** — `core/sections.ts` (`sectionTree`, `SectionNode`/`SectionTree`, `pageOf`,
  `foldableSections`, `isAdmitted`/`admittedRoots`): the one recursive, fold-aware reading of
  containment, and the present-anchored admission rule the scrub cursor is applied through. The notebook, the ToC,
  `j`/`k` and the breadcrumb all walk it, so a new nesting depth needs no new walker — and
  `1.5 page` gets its model for free. `parentMap` and `rootBlocks` are gone; `navigation.ts` no
  longer re-derives the tree.
- **Node→block mapping** — `blockRefFor(backend, id)` / `linkRefFor(backend, edgeId)` in
  `core/workspace-projection.ts`, plus the viewport's `blockRefOf` for chat nodes (whose id *is* the
  block ref). One resolution feeds the inspector, the graph menu and the hover popovers, so a node and
  its block cannot drift apart. Engine edges are keyed `edgeKey(source, target)`, not by their
  generated cytoscape id.
- **Reasoning backend** — `core/reasoning-backend.ts` (`ReasoningBackend`, `BackendVocabulary`,
  `BackendNode`/`BackendEdge`/`BackendSnapshot`) + `core/nars-backend.ts` (`narsBackend`, adapter #1;
  `NAL_VOCABULARY`): take engine-specific node/edge kinds, labels, text fallbacks and the truth
  vocabulary to the adapter, and keep the projection engine-agnostic. Add a second engine (WP5 `3.7`)
  by implementing another `ReasoningBackend` and handing it to `projectWorkspace`, not by branching
  in the projection. `projectGraph` is gone — the reasoning producer is `projectReasoning(backend,
  exclude)`.
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

- [~] **0.5 tool approval** — the modal-scrim blocker is **cleared** (see §Blockers), so the dialog
  itself is unblocked. It still has no input: nothing produces a *pending* tool call — the wire
  (`IncomingFromServer`) carries no tool-approval message, and a `tool-call` block is a finished
  record, not a request — so a dialog today would be the silent no-op this plan refuses. Next step is
  the producer half (a `tool.approval.request` message + an approve/deny reply that the tool loop
  waits on), then `→ overlays/tool-approval.ts` (new) on the existing modal/scrim/trap contract.
  `(b)`,`(aa)`
- [~] **4.5 pinning** — overlays pinnable as floating cards (manager seam `setPinned`/`pinned` exists);
  decide session-only vs URL-addressable. Landed: **session-only** pinning through the manager —
  `setPinned` reflects `data-pinned` on the element and announces; `overlay:pin {id,pinned}` and
  `overlay:pin-toggle` events; app-layout wires them; an `overlay.pin` palette command toggles the top
  overlay. Remaining: a per-overlay pin *button* (the command is the current affordance) and CSS for
  `[data-pinned]`. `→ core/overlay-manager.ts`, `core/events.ts`, `core/commands.ts`,
  `components/app-layout.ts`. `(b)`,`(e)`,`(aa)`
- [~] **0.6 backend seam** — land the `ReasoningBackend` contract + adapter seam (`LmProvider` façade;
  `lm.status`/`lm.switch` already real). Needed by WP5. Landed the **LM half** as the façade
  `core/lm-provider.ts` (state contract: `ProviderDescriptor`, `$lmProvider`, `applyLmStatus`
  normalising the wire record, `providerLabel`/`providerUsable`) + `core/lm-transport.ts`
  (`refreshLmStatus`/`switchLmProvider`) — one seam, split so the socket module stays out of the
  façade's dependency path. The engine now reports its provider registry in `lm.status`
  (`LM_PROVIDER_NAMES` + which ids are browser-only) and **answers a `lm.switch` with a fresh
  status**, so routing is observable instead of assumed: a request the engine cannot apply shows up
  as `stale` in the UI rather than as a silent success. The Provider/Configuration split is real —
  a `provider` overlay (registered, so the palette entry and `overlay.provider` derive themselves)
  and the settings overlay retitled **Configuration**; the HUD provider chip and the status strip
  are read-only views of the same state (`$lmStatus` is gone). Landed the **reasoning half** as
  `core/reasoning-backend.ts` (`ReasoningBackend`, `BackendVocabulary`, `BackendNode`/`BackendEdge`/
  `BackendSnapshot`) + `core/nars-backend.ts` (adapter #1 over `$graphNodes`/`$graphEdges`): the
  NARS/MeTTa vocabulary — node kind → block kind, edge kind → link kind, the `label→term→atom→id`
  fallback, the `nal` truth label — moved out of the projection into the adapter, and
  `projectGraph(nodes, edges, exclude)` became **`projectReasoning(backend, exclude)`**, so a second
  engine is an adapter, not a branch. Remaining: the **control half** (`submit`/`step`/`run` +
  `BackendCaps`), which is a claim about producers the wire does not carry yet and therefore belongs
  with **`3.6` steer/author** rather than here; `config-hud` `embedded` mode (no second host exists
  yet, so a mode now would be dead API); and the `CapabilityHost` mixin form once a component gates
  its whole presence. `→ core/lm-provider.ts`, `core/lm-transport.ts`, `core/reasoning-backend.ts`,
  `core/nars-backend.ts`, `core/workspace-projection.ts`,
  `components/overlays/{provider,settings}.ts`, `server/index.ts`. `(c)`,`(aa)`,`(m)`,`(k)`,`(f)`

## WP2 — State & URL consolidation

*Outcome: one state source; everything deep-linkable. Deps: WP1 (soft).*

- [x] **2.6 validation** — renderer validation (cycle-free `workspaceRendererIds()`),
  `$activeLens` → `urlState.lens`, and now `UrlState.layout` vs the registry are done. The
  **cycle-free layout-id source** is `core/layout-ids.ts`: `layout-registry` publishes each id at
  `register()` and `hydrateFromUrl` drops an id the leaf does not know (a stale link cannot seed
  `$lensLayout`). `→ core/store.ts`, `core/layout-ids.ts`, `utils/layout-registry.ts`.
  `(s)`,`(t)`,`(x)`,`(ac)`
- [x] **1.5 page** — URL-address `page` (`(page, block, disclosure)`); the **section model** blocker
  is **cleared** (`core/sections.ts` gives `pageOf` and per-node `depth`), so this landed as the URL
  half of the tuple: `UrlState.page`, parsed/serialized and hydrated like the rest, with a page-only
  link focusing the page and an explicit `focus` winning as the more specific half. It is **derived,
  not owned** — `mirrorAtom` projects `pageOf(sectionTree(graph), graph.focus)` off the same graph the
  focus comes from, and elides itself when the focus *is* the page, so a page link stays one
  `focus=` instead of a redundant pair. `disclosure` was already the `folded` field. **Still open: the
  turn/page boundary policy** (auto-page per turn pair with agent/user overrides) — that changes which
  blocks are roots, i.e. the projection, not the URL. `→ core/store.ts`, `core/sections.ts`.
  `(s)`,`(t)`,`(h)`,`(q)`
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
- [~] **2.6 context** — extend `WorkspaceContext` (`overlays`, `renderer`, `setRenderer`; fold
  `openPalette` onto `activeCommands()`); retire `$viewportMode`/`$graphShape` shell atoms once
  `graph-surface` owns them. Landed: `openPalette` now dispatches the `overlay.palette` command (one
  open seam; `workspace-host`'s `openPalette` emits the same `overlay:open` as before). Deferred: the
  `renderer`/`setRenderer`/`overlays` fields — **no renderer consumes them yet**, so adding them now is
  dead API; add them with the first renderer that switches modes. `$viewportMode`/`$graphShape`
  retirement still waits on `graph-surface` ownership. `→ components/workspace-host.ts`. `(b)`,`(f)`,`(ae)`

## WP3 — View & artifact completion

*Outcome: full view matrix, clean artifact typing, embedded views, section model. No deps.*

- [x] **4.3 typing** *(promoted)* — discriminated `Artifact` union on `SemanticBlock`/`Segment` (drop
  `data` casts); promote `Segment.data` to the `Artifact` contract. Landed as `core/block-payload.ts`:
  the payload interfaces (`table`/`list`/`code`/`image`/`citation`/`chart`/`config-change`), the
  `BlockPayloads` map and the `ArtifactPayload` union it makes, one validating normalizer per kind
  behind `payloadOf(data, kind)`, `PayloadOf<K>` for the static side, `Segment<K>`/`SemanticBlock<K>`
  typed by kind (engine payloads stay `unknown`), and every remaining cast removed — `artifacts.ts`,
  `citations.ts`, the Notebook and the artifact overlay all narrow through `payloadOf`. Sweeps worth
  taking next: derive a `DerivationRecord` payload in the same file for WP5 **`3.3`**, and validate the
  `chart` series entries as deep as the series view requires.
  `→ core/block-payload.ts`, `core/segmentation.ts`, `core/workspace-graph.ts`, `core/artifacts.ts`.
  `(i)`,`(j)`,`(d)`
- [~] **1.5/1.1 section model** *(merged: `1.5 page` model + `1.5/1.1 notebook structure`)* — recurse
  nested `contains`/headings so pages/ToC aren't shallow; nested-section folding by heading `level`;
  fold-all/unfold-all command; folded-count badge; keep `j/k` consistent with folded visibility and
  decide whether it skips container roots; optional `clampStep`; "jump to related block" from
  breadcrumb/block menu. Provides the model `1.5 page` needs. Landed as `core/sections.ts`:
  `sectionTree(graph, folded)` builds the whole containment — `depth`, `ancestors`, `folded`/`hidden`,
  `order` (everything) and `visible` (what is on screen) — and a ref claimed twice keeps its first
  placement, so a malformed cycle terminates. Four consumers now read it instead of re-walking
  `children`: the notebook renders it recursively (nested sections get their own header + fold, and a
  container shows its header rather than a duplicate body), the ToC recurses to any depth with a
  `depth` column and folds out of the list, `j`/`k` steps the `visible` order so they never land on a
  hidden block, and `breadcrumb` reads `ancestors`. **Decisions taken:** container roots stay in the
  `j`/`k` walk (they render as focusable blocks); `clampStep` stays clamped with no wrap — the
  optionality was speculative, not asked for. Fold-all landed as the derived `view.fold-all` command
  plus `setCollapsed` and a folded-count badge in the ToC header, so the fold set is reachable from the
  palette, the badge and the URL alike. Remaining: heading-`level` boundaries (they belong to the
  turn/page policy) and "jump to related block", which is **`2.4`** work. `→ core/sections.ts`,
  `core/navigation.ts`, `core/toc.ts`, `core/commands.ts`, `core/workspace-graph.ts` (`parentMap`/
  `rootBlocks` deleted), `components/renderers/notebook.ts`, `components/overlays/toc.ts`.
  `(d)`,`(q)`,`(h)`,`(s)`,`(t)`
- [x] **2.4 inspection & embedded views** *(merged: `2.4 graph inspection` + `4.1/4.2 embedded
  views`)* — node/edge hover popovers reusing `explainModel`/`neighborhood`; artifact edge previews;
  richer inspector (link confidence + event refs); "Open related" from graph menu and ToC; remember
  neighborhood depth; ⌥-click a row to explain instead of navigate. **Reach from the ToC landed:**
  every row opens the **neighborhood traversal** beside the artifact button, ⌥-click **explains** instead
  of navigating (the plain click still focuses), and the hop count is no longer a literal in
  `overlays/related.ts` — it is `$neighborhoodDepth`/`setNeighborhoodDepth` (clamped 1–3), mirrored into
  the URL as `depth` with a 1/2/3 control in the overlay header, so a link can pin how far "related"
reaches. Plus: Notebook embedded graph block
   (derivation/contradiction/topic neighborhood); Graph node popover notebook card; graph edge popover
   derivation tree; wire the block-menu "embed" affordance; reuse `conversationPositions` and
   `projectWorkspaceGraph` in embedded graph shapes. *(Everything here landed except the last clause:
   an embedded **graph** shape still means a store-driven `graph-viewport`, so reusing
   `conversationPositions` for it needs the viewport-onto-`ViewSpec` migration — the `4.6`/`8.5` item
   `views/graph-adapter.ts` already names.)* **Node hover popover landed:** the old tooltip was
  raw graph fields (`term`/`priority`/`confidence`/`degree`) interpolated into an HTML string — an
  `innerHTML` sink fed by an untrusted engine term, and facts the semantic model does not hold. It is
  now `components/graph-popover.ts`, taking a **block ref** (not a graph element) so the semantic half
  renders and tests without a canvas while the viewport keeps only hit-testing and placement: kind,
  label, truth chip, and one row per `explainModel` link, labelled through the link catalog and
  clickable into the notebook. The viewport resolves elements through one `blockRefOf` (chat nodes
  already carry their block ref; engine nodes go through `blockRefFor`), and its context menu gained
  **Open in Notebook**. Remaining: the **edge** popover (needs the edge half of the node→block mapping),
  the **edge** popover landed with it** — `explainLinkModel`/`ExplainedLink` in `core/explain.ts` make a
  link explainable (both endpoints, the block it lands on, and that block's own links minus the one
  being explained), and `ExplainLink` now carries `confidence` + `eventRefs`, which the inspector and
  any future narration need anyway. `linkRefFor(backend, edgeId)` is the edge half of the node→block
  mapping: a link ref is derived from both endpoints *and* the backend's edge vocabulary, so it can
  only be minted in the projection. Engine edges carry a generated cytoscape id, so the viewport keys
them by `edgeKey(source, target)` — the same key the edge map uses. **The popover is now a notebook
   card:** `renderBlockBody` (`utils/render-block.ts`, extracted from the Notebook and shared with it,
   styles included) renders the block *as the notebook renders it*, so a node hover previews the block's
   inline text/lists and an **edge preview** shows the artifact its target carries (`s-view`, embedded
   budget); the card is skipped when the body would only repeat the head (a payload, or text beyond the
   label, is the test). **The drawer's Links tab reads the explain model** — `ExplainLink` rows labelled
   through the link catalog, carrying the engine's `confidence` and `eventRefs`, clicking through to the
   other block — replacing its hand-rolled `$graphEdges` walk, so "richer inspector" is done. Both
   navigate through one seam, `revealBlock(ref)` in `core/store.ts` (notebook + focus), and both resolve
   refs through `resolveBlockRef(graph, backend, id)` — the substrate is the authority (a conversation
   node's id *is* its ref; only an engine id maps through the backend), which retires the viewport's
   `hasClass('workspace')` branch. **The embedded-view cluster landed with it:** `core/embedded-views.ts`
   is the one catalog for views *derived from the substrate* — `derivation` (the provenance chain behind
   a block, as a `tree`), `contradiction` (the blocks the link catalog puts in tension, with their truth)
   and `topic` (the neighborhood within `$neighborhoodDepth`) — each a pure projection plus a spec whose
   dataset is read **live** off `$workspaceGraph`, so a derived view cannot go stale the way a snapshot
   would. Which views a block shows is **session state** (`$embeddedViews`/`toggleEmbeddedView`, exactly
   like `$collapsedBlocks`) because `$workspaceGraph` is re-projected from the chat log and the engine
   graph: writing an `embedded-view` block into it would be a lie the next projection erases, so the block
   menu offers a `menuitemcheckbox` **Embed · <view>** per available view (hidden when the block has
   nothing to show) and the Notebook renders them under the block through `<s-view>` (embedded budget, no
   chrome). The **edge popover shows the derivation tree** through that same spec, so an edge that claims
   a derivation shows it. `→ core/explain.ts`, `core/embedded-views.ts`, `core/neighborhood.ts`,
   `core/workspace-projection.ts`, `core/store.ts`, `utils/render-block.ts`, `components/graph-popover.ts`,
   `components/overlays/{inspector,block-menu,related}.ts`, `components/node-detail-drawer.ts`,
  `components/renderers/notebook.ts`, `components/views/graph-*.ts`. `(r)`,`(n)`,`(y)`,`(e)`
- [~] **4.3 affordances** — the artifact overlay **Copy** / **Open in graph** and the ToC per-row
  artifact button are done. Inspector reach landed once the **node→block mapping** blocker cleared: the
  drawer's Actions tab gained **Open in Notebook** (switch renderer, focus the projected block) and
  **Open View** (the artifact overlay, gated on the block actually having a `ViewSpec`). Remaining: the
  edge half of the mapping, and the spec-gated path becoming reachable for engine claims.
  `→ components/overlays/inspector.ts`, `components/node-detail-drawer.ts`,
  `core/workspace-projection.ts`. `(j)`,`(ad)`
- [~] **1.4 rich text** — inline tokenizer for paragraphs (links/emphasis/code spans), unified with the
  landed `tokenizeCode` seam where possible; image intrinsic size `{width?,height?}`; optional inline
  full tables (`budget="full"`); ensure the view barrel is imported standalone / owned by
  `WorkspaceHost`. Landed: `core/inline-text.ts` (`tokenizeInline` — code/strong/em/link, pure and
  escaped-by-construction, no `innerHTML`) rendered by the Notebook for headings, paragraphs and list
  items; image blocks now honour intrinsic `{width?,height?}` (attributes elided with `nothing`).
  Remaining: inline full tables, view-barrel ownership.
  `→ core/inline-text.ts`, `components/renderers/notebook.ts`. `(i)`,`(j)`
- [x] **citations model** — `Source`/bibliography (stable citation key, `[n]` resolution) to split
  formal citations from plain links. Landed: `core/citations.ts` — `collectSources(graph)` builds a
  numbered bibliography from reference-style citation blocks (de-duplicated by key), `resolveSource`
  resolves bare/`[n]` keys and falls back to the bibliography position for a numeric reference;
  `tokenizeInline` emits a `citation` token for a bare `[n]`; the Notebook renders it as a link into
  the bibliography and numbers each `citation` entry `[n]`, leaving an unknown key as literal text.
  The `text-view` arm was dropped by decision: a `TextDataset` has no graph context, so resolving
  references there would be dead API until something wants it (see opportunities).
  `→ core/citations.ts`, `core/inline-text.ts`, `components/renderers/notebook.ts`. `(i)`

## WP4 — Timeline present-anchoring

*Outcome: the timeline is a real present-anchored scrubber. Deps: WP3 (soft).*

- [~] **4.4 controls** — explicit live/past/prospective controls ("now" resetting `t` to `Infinity`, a
  range readout) and announce the applied window. Landed: a `Now` button returning to the present
  (`t = Infinity`) and a `role="status"` readout ("Live · all events" vs the scrubbed time); the range
  now renders the present as `maxTime` instead of the invalid `Infinity`, so the default live state is
  usable. Remaining: an explicit *prospective* control (the temporal gate has no future term today) and
  moving the announce region to the overlay header. `→ components/timeline-scrubber.ts`. `(ag)`
- [x] **4.4 anchor** — present-anchored cursor fading newly admitted blocks; thread `createdAt`/event
  time through `projectGraph`/projection. Landed: `BackendNode.occurredAt` carries the engine's own
  `occurrenceTime` (the field name is the adapter's business, the slot is the contract's), so
  `projectReasoning` stamps a real `createdAt` instead of the hardcoded `0` that made every reasoning
  block claim epoch 0. **The cursor was two sources:** `$view.timeline.t` is what the modulation gate
  reads, while `$workspaceGraph.timeCursor` was written by nobody and read by nobody. It is now
  derived — a store subscription mirrors the scrub cursor onto the substrate, storing the present
  (`Infinity`) as `undefined` — and `isAdmitted(block, cursor)` / `admittedRoots(tree, cursor)` in
  `core/sections.ts` decide admission, which is the first thing the scrub actually *does* to the
  workspace: a page admitted after the cursor is not rendered, a block inside an admitted page is
  marked `data-admitted="false"` and fades. A block with no event time is **not** judged — a producer
  that does not thread one is not claiming to be from the future. Remaining: fading is the notebook's
  only consumer; the graph and the ToC do not yet admit by the cursor.
  `→ core/reasoning-backend.ts`, `core/nars-backend.ts`, `core/workspace-projection.ts`,
  `core/sections.ts`, `core/store.ts`, `components/renderers/notebook.ts`. `(ag)`,`(y)`
- [x] **4.4 gating** — gate the `⏱` HUD control on temporal availability (node with `occurrenceTime`
  or a capability flag). Landed as `hasTemporalData()` in `core/store.ts` (any `$graphNodes` entry with
  `occurrenceTime`); the HUD watches `$graphNodes` and only paints `⏱` when true. The capability-flag
  alternative is unused — engine nodes are the honest signal today.
  `→ components/workspace-hud.ts`, `core/store.ts`. `(ag)`
- [ ] **ops sequencing** — carry engine `seq`/`eventRefs` on `WorkspaceOp` for ordering/provenance.
  Deferred for the same reason as `2.6 context`: `WorkspaceOp` has **no producer** — the projection
  returns a graph, not ops — so a `seq` field would be read by nobody, and `$lastSeqId` already holds
  the engine sequence. Land it with the first thing that actually emits ops (a live `applyWorkspaceOps`
  path, most likely `3.6` steer/author). `→ core/workspace-graph.ts`, `core/workspace-projection.ts`.
  `(Phase 0.1–0.3)`

## WP5 — Reasoning vertical slice

*Outcome: the `reasoning` capability end-to-end. Deps: WP3; needs `0.6`.*

- [ ] **3.1 projection** — map NAR concepts/events → blocks/links: beliefs, goals, questions,
  derivations, revisions, contradictions, budget events, gate decisions. The backend seam landed, so
  this is now **vocabulary work** — new node/edge kinds and the block/link kinds they become, declared
  in `core/nars-backend.ts` — rather than engine-shaped code inside the projection.
  `→ core/nars-backend.ts`, `core/workspace-projection.ts`, `core/graph-projection.ts`. `(Phase 3)`
- [ ] **3.2 formalization** — claim → candidate → gate admission → belief/goal/question, visible in both
  renderers; route `claim`/`question` composer children through it; emit `asks`/`answers` links;
  special-case structured modes in `projectChat`; server `mode`/`contexts` consumption.
  `→ core/segmentation.ts`, `core/workspace-projection.ts`, `components/input-hud.ts`. `(g)`,`(l)`,`(k)`
- [~] **3.3 provenance** — `derivation-record` blocks landed: a provenance-category edge becomes its own
  `derivation` block **nested under the conclusion it justifies** (`derivationId`, one per step — the engine
  has no step id, so per-edge is the honest granularity), carrying the `DerivationRecordData` payload
  (rule, premises, conclusion, confidence, the conclusion's truth, the step's events, and the engine's own
  record verbatim in `raw`) and rendering through `s-tree` as *rule → premises → conclusion*. This also
  **absorbs `4.3 derivation-record`** and makes the spec-gated **Open View** path reachable from engine
  claims (`4.3 affordances`): a derivation block is a real artifact. Lands the `block.spec` seam, which the
  `SemanticBlock` contract declared and nothing used: a block's own instruction now renders verbatim
  (checked before every artifact branch in `renderBlockBody` and in `artifactViewSpec`).
  **Still open:** evidence *lineage* — the record names the premise and conclusion but not the chain below
  the premise; that needs the engine's derivation recorder across the wire (`0.6`), not a projection over
  what the graph already carries. `→ core/block-payload.ts`, `core/artifacts.ts`,
  `core/workspace-projection.ts`, `utils/render-block.ts`, `components/views/tree-view.ts`. `(Phase 3)`,`(ad)`
- [x] **3.5 explanation** — `explain()` resolves whichever of the three subjects a ref names — **block**,
  **link** (relationship, both endpoints, the block it lands on, confidence, its events) and **event** (a
  truth-value revision from `$nodeHistory`, joined to the links whose provenance cites it) — and the
  overlay renders each at `summary · card · detail · raw` off the one model, with the body rendered by
  `renderBlockBody` instead of a JSON `<pre>`. A ref that names nothing is reported, not invented.
  `→ core/explain.ts`, `components/overlays/explain.ts`. `(Phase 3)`
- [x] **3.4 layouts** — `reasoning-provenance`, `gate-pipeline`, `contradiction-neighborhood`,
  `budget-resource` as `layoutRegistry` rows with deterministic variants. Landed as
  `core/reasoning-layout.ts` (`reasoningPositions`, pure, reusing `blocksInOrder` and `Point`) +
  concept-scope registry rows with `recommendedFor` lenses; the link-catalog parity test now passes
  without an allowlist. `→ core/reasoning-layout.ts`, `utils/layout-registry.ts`. `(Phase 3)`
- [ ] **3.6 steer/author** — retract/revise belief, add goal, adjust budget/provider from block/node
  actions; live reaction as new blocks/links. Also the **`config-change` producer** (emit the landed
  diff payload on settings changes). `→ core/commands.ts`, `components/overlays/block-menu.ts`,
  `core/workspace-graph.ts`. `(Phase 3)`
- [ ] **3.7 MeTTa** — adapter feeding the same substrate; one scenario through it. The seam is ready
  (`ReasoningBackend`): implement `core/metta-backend.ts` with its own `vocab`/`kind` and pass it to
  `projectWorkspace` — no projection change. `→ core/metta-backend.ts`. `(Phase 3)`
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

- Turn/page boundary policy: auto-page per turn pair with agent/user overrides. Both landing sites are
  in — the **section model** is recursive and **`1.5 page`** is URL-addressable — so this is now purely
  "which blocks are roots": a page-boundary producer over the turn pairs. → **`2.4`** (it needs the
  producer) / a new **`1.5 paging`**
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
  construction) rendered by the Notebook for headings, paragraphs and list items, and image blocks
  honour intrinsic `{width?,height?}` — **`1.4 rich text`** partially landed (inline full tables,
  view-barrel ownership remain). Suite **326 green** (with WP4 pinning).
- **WP5 layouts** — `core/reasoning-layout.ts` (`reasoningPositions`: provenance depth, gate stages,
  contradiction neighbourhood, resource lanes — pure and deterministic) registered as four concept-scope
  `layoutRegistry` rows with `recommendedFor` lenses — completes **`3.4 layouts`**. The link-catalog
  parity test no longer needs its pending allowlist. Suite **325 green**.
- **WP4 pinning** — session-only overlay pinning wired through the manager: `setPinned` reflects
  `data-pinned` + announces, `overlay:pin`/`overlay:pin-toggle` events, app-layout handlers, and an
  `overlay.pin` palette command that toggles the top overlay — **`4.5 pinning`** partially landed
  (per-overlay button + `[data-pinned]` CSS remain). Suite **326 green**.
- **WP2 context** — `WorkspaceContext.openPalette` now dispatches the `overlay.palette` command, so the
  palette opens through the one command seam — **`2.6 context`** partially landed (renderer/overlays
  context fields deferred until a renderer consumes them). Suite **326 green**.
- **WP3 typing** — typed payload interfaces (`CodeData`/`ListData`/`ImageData`/`CitationData`) and the
  guards `asTableData`/`asCodeData`/`asListData`/`asImageData`/`asCitationData` in `core/segmentation.ts`;
  `artifacts.ts` and the Notebook narrow through them instead of casting `block.data` — **`4.3 typing`**
  partially landed (the `Artifact` union itself remains). Suite **328 green**.
- **WP3 citations** — `core/citations.ts`: `collectSources` builds a numbered, key-deduplicated
  bibliography from reference-style citation blocks and `resolveSource` resolves bare/`[n]` keys —
  **`citations model`** partially landed (inline `[n]` rendering remains). Suite **331 green**.
- **WP3 typing** — `core/block-payload.ts`: one payload contract (`BlockPayloads`, `ArtifactPayload`,
  `PayloadOf<K>`) with a validating `payloadOf(data, kind)` normalizer per kind; `Segment<K>` and
  `SemanticBlock<K>` carry the payload their kind declares, and every `data as …` cast in
  `artifacts.ts`, `citations.ts`, the Notebook and the artifact overlay is gone — completes
  **`4.3 typing`**.
- **WP3 citations (cont.)** — inline `[n]` references resolved against the bibliography: a `citation`
  token in `tokenizeInline` (a link still wins over it), `resolveSource` falling back to the
  bibliography position, the Notebook rendering a reference as a link and numbering each `citation`
  entry — completes **`citations model`** (the `text-view` arm dropped, see the item). Suite **336
  green** (new: `block-payload` validation/rejection, citation token, bibliography numbering, inline
  reference resolution).
- **WP1 backend seam (LM half)** — `core/lm-provider.ts` + `core/lm-transport.ts`: one façade over
  `lm.status`/`lm.switch` with pending/stale reconciliation, `providerLabel`/`providerUsable`
  (browser providers gated on WebGPU); the engine reports its provider registry in `lm.status` and
  answers a switch with a fresh status; a registered `provider` overlay splits Provider from
  Configuration (settings retitled) and the HUD chip opens it; `$lmStatus` retired. **`0.6`
  partially landed** — the `ReasoningBackend` contract is still to do. Suite **348 green** (new:
  façade normalization/pending/stale, provider overlay, HUD chip). VISUAL: the HUD provider chip and
  the LM strip text changed, so baselines need regenerating with the rest of the pending sweep.
- **WP1 backend seam (reasoning half)** — `core/reasoning-backend.ts`: the `ReasoningBackend`
  contract (`id`/`kind`/`vocab`/`snapshot()`) with `BackendVocabulary`, `BackendNode`, `BackendEdge`
  and `BackendSnapshot`; `core/nars-backend.ts`: adapter #1 over `$graphNodes`/`$graphEdges`
  (`narsBackend`, `NAL_VOCABULARY`), memoised on the identity of the two engine maps so a chat-only
  re-projection reuses one snapshot. The projection's `NODE_KINDS`/`EDGE_KINDS` tables and its
  `label→term→atom→id`, `typeof confidence === 'number'` and hardcoded `'nal'` assumptions all moved
  into the adapter, and `projectGraph(nodes, edges, exclude)` became
  **`projectReasoning(backend, exclude)`** — `projectWorkspace({ messages, backend })` takes the
  backend explicitly and `syncWorkspaceGraph` passes `narsBackend`. Behaviour-preserving: same
  blocks, links, ids and ordering, now resolved through the backend's vocabulary. **`0.6` further
  landed** — only the control half (`submit`/`step`/`run`, `BackendCaps`) remains, and it belongs
  with **`3.6`**. Suite **353 green** (new: NARS record normalization + label/text fallbacks +
  confidence guarding, snapshot memoisation, and a second adapter — `proof-checked` truth, its own
  node/edge kinds — projecting through the same engine-agnostic code).
- **WP3 `1.5/1.1 section model`** — `core/sections.ts`: `sectionTree(graph, folded)` is the one
  recursive, fold-aware reading of containment (`depth`, `ancestors`, `folded`/`hidden`, `order`,
  `visible`, plus `pageOf`/`foldableSections`). The notebook now renders nesting to any depth
  (`.node` sections with their own header and fold button, a container showing its header instead of a
  duplicate body), the ToC recurses with a `depth` column and drops folded subtrees, and `j`/`k` steps
  the `visible` order so it can never land on a block a folded section hides. Fold-all landed as the
  derived `view.fold-all` command + `setCollapsed` + a folded-count badge in the ToC header.
  `navigation.ts` lost `blockOrder`'s hand-rolled walk, `parentMap` and `rootOf`'s recursive
  `contains`; `workspace-graph.ts` lost `rootBlocks`. Suite **363 green**.
- **WP2 `1.5 page`** — `UrlState.page` completes the URL tuple `(page, block, disclosure)`:
  `disclosure` was already `folded`; the page half is derived through `pageOf(sectionTree(graph),
  graph.focus)` by a `mirrorAtom`, so it can never disagree with the focus, and it elides itself when
  the focus *is* the page so a page-only link stays a single `focus=`. Hydration takes a page-only
  link and lets an explicit `focus` win as the more specific half. Suite **365 green**.
- **Node→block mapping blocker (node half)** — `blockRefFor(backend, id)` in
  `core/workspace-projection.ts`: the projection is the one place that derives a block ref from an
  engine id, and it answers through the *attached* backend, so a second engine maps its own ids and an
  id the backend does not carry resolves to `undefined` rather than to a block that does not exist.
  Consumers: the inspector's Actions tab gains **Open in Notebook** (renderer + focus) and **Open
  View** (artifact overlay, gated on a real `ViewSpec`). Suite **369 green**.
- **WP3 `2.4` reach from the ToC** — every ToC row reaches sideways: **Open related** beside the
  artifact button, and ⌥-click to **explain** instead of navigate. The hop count moved out of
  `overlays/related.ts` (it was the literal `2`) into `$neighborhoodDepth`/`setNeighborhoodDepth`, clamped
  1–3, mirrored to the URL as `depth` and set by a 1/2/3 control in the overlay header — so a link can
  pin how far "related" reaches, which is what "remember neighborhood depth" was asking for. Suite
  **388 green**.
- **WP4 `4.4 anchor`** — the substrate had no time and the scrub had no effect. `BackendNode.occurredAt`
  carries `occurrenceTime` so reasoning blocks get a real `createdAt` (they were all `0`); the two
  cursors collapse into one — `$workspaceGraph.timeCursor` is derived from `$view.timeline.t`, the
  number the modulation gate already reads — and `isAdmitted`/`admittedRoots` apply it: a page
  admitted after the cursor is not rendered at all, a block inside an admitted page fades via
  `data-admitted="false"`. A block with no event time is not judged. Suite **383 green**.
- **WP3 `2.4` edge popover + edge half of the mapping** — `explainLinkModel(graph, ref)` in
  `core/explain.ts`: a link is explained by both endpoints *plus* the explanation of the block it
  lands on, because that is what an edge is for; `ExplainLink` gained `confidence` and `eventRefs`.
  `linkRefFor(backend, edgeId)` derives the link ref from both endpoints **and** the backend's edge
  vocabulary, so it can only be minted in the projection — and the viewport keys engine edges by
  `edgeKey(source, target)`, not by their generated cytoscape id. The popover drops the row for the
  link it is explaining, and an engine edge type the vocabulary does not speak degrades to
  `references` rather than vanishing (a test pins both). Suite **379 green**.
- **WP3 `2.4` node hover popover** — `components/graph-popover.ts` replaces the viewport's tooltip.
  The old one was an `innerHTML` sink: `term`/`label`/`priority`/`confidence`/`degree` interpolated into
  an HTML string from an untrusted engine record. The new popover takes a **block ref** and renders
  `explainModel` as Lit nodes — kind, label, truth chip, one row per link labelled through the link
  catalog, rows clickable into the notebook — so text is escaped by construction and the popover is
  testable without a canvas. The viewport keeps only hit-testing and placement, resolves elements via
  one `blockRefOf`, and its context menu gained **Open in Notebook**. Suite **374 green**, including a
  test that an engine term containing markup renders as text.
- **WP3 `2.4` notebook card + explain-model Links tab** — `utils/render-block.ts`
  (`renderBlockBody` + `blockBodyStyles`) is the Notebook's own body renderer, extracted so the hover
  popover can show a block *as the notebook renders it*: a node hover previews its inline text/lists, an
  edge hover previews the artifact its target carries (`s-view`, embedded budget) — the artifact edge
  preview — and a block whose body would only repeat its head gets no card. The extract is
  behaviour-preserving for the Notebook (same markup, same classes, styles composed rather than copied)
  and removes its private `renderTable`/`renderHeading`/`renderInline` trio. The drawer's Links tab now
  reads `explainModel`: rows labelled through the link catalog with `confidence` and `eventRefs`, a row
  navigating to the other block, and the filter matching semantic labels instead of engine `type`
  strings — its raw `$graphEdges` walk and `focusNode` are gone. Two seams behind it: `revealBlock(ref)`
  (`core/store.ts`) is the one "take the reader to a block" call the popover, the graph context menu and
  the inspector all use, and `resolveBlockRef(graph, backend, id)` makes the substrate the authority for
  ref resolution — the viewport's `hasClass('workspace')` branch is gone, so an id the graph already
  carries *is* a ref and only an engine id maps through the backend. Suite **395 green** (new: popover
  card for a list/table block, no-card-when-redundant, edge artifact preview, explain-model links rows,
  link navigation, link-less block, `resolveBlockRef` for both halves).

  **Notes for what is left in `2.4`:** the embedded-view cluster is now the *only* open piece, and the
  card seam it needs already exists — an embedded view should render its dataset through
  `components/views/*` inside an `s-view`, and a block shown beside a graph surface should reuse
  `renderBlockBody`, exactly as the popover does. Sweeps worth taking while in this code: the
  **explain overlay** still renders a raw `<pre>${block.text}</pre>` for its card body (it wants
  `renderBlockBody` plus the link rows it already has); the drawer's Overview/History tabs remain
  engine-shaped (`term`/`priority`/`truth` sliders, `node.history.request`) and are the honest reason the
  inspector is still a *node* inspector rather than a block inspector — deciding whether the whole drawer
  moves to blocks (truth edits then need a producer, i.e. `3.6`) is worth an explicit note in the plan.

  **New improvement opportunities:** `renderBlockBody` is the natural home for the *cursor* treatment
  (`data-admitted="false"` fades live in the Notebook) — a card preview of a block the scrub cursor has
  not reached yet should say so rather than render it as present. And `collectSources` is recomputed per
  popover render; with the card, a hover builds a bibliography per hover, so a memo on the graph (a
  `7.3 performance` item) should cover it.
- **WP3 `2.4` embedded-view cluster (closes `2.4`)** — `core/embedded-views.ts` is the one catalog for
  views *derived from the substrate*: `derivation` (the provenance chain behind a block → `tree`),
  `contradiction` (the blocks the link catalog puts in tension, with their truth → `table`) and `topic`
  (the neighborhood within `$neighborhoodDepth` → `table`). One row in `EMBEDDED_VIEWS` declares the
  label, the native shape and which relationships count — by link **category**, or by the **lens** the
  catalog already attaches to a kind, so "contradiction" is defined once (`contradicts`, `revises`,
  `rejected-by-gate`) instead of being listed again in a projection. Each view is a pure function
  (`derivationTree`/`contradictionTable`/`topicTable` → `embeddedDataset`) and `embeddedViewSpec` wraps it
  in a `ViewSpec` whose dataset is read **live** off `$workspaceGraph` via the existing `viewSource`
  adapter, memoized per block in a `WeakMap` so a re-render does not churn the host's subscription.
  **Which views a block shows is session state** (`$embeddedViews`, `toggleEmbeddedView`,
  `embeddedViewsShown`) alongside `$collapsedBlocks`, *not* a block written into the substrate: the
  binding re-projects `$workspaceGraph` from the chat log and the engine graph, so an `embedded-view`
  block added from the menu would be erased on the next message. The block menu therefore offers a
  `menuitemcheckbox` **Embed · \<view\>** per view the block actually has (an affordance stays hidden
  rather than inert), and the Notebook renders each under its block in an `s-view` (embedded budget, no
  chrome) with a caption. The **edge popover** shows the same derivation tree for the block it lands on,
  so an edge claiming a derivation shows it instead of asserting it — and it is the same spec the
  notebook would embed, so the two cannot drift.

  **Decisions taken:** `derivation` reads only `provenance`-category links and its tree is empty (no
  roots) when nothing derived the block, so "Embed · Derivation" never appears for a bare block; the
  provenance walk is bounded at 4 hops and cycle-guarded by a `seen` set; `topic` deliberately excludes
  provenance links (the lens taxonomy separates "how it came to be" from "what it is near").

  **Notes for what is left:** `2.4` is now complete except the one clause the plan itself deferred — an
  embedded **graph** shape (a mini viewport for a neighborhood/derivation) needs `graph-viewport` to
  take a dataset instead of reading the store, which is the `4.6`/`8.5` migration
  `components/views/graph-adapter.ts` already names; until then `derivation`/`contradiction`/`topic` land
  as `tree`/`table`, both of which have real embedded adapters (`s-tree` serves both budgets,
  `s-table-mini` is the embedded `table`). Sweeps worth taking next: the **graph context menu** should
  carry the same embed toggles as the block menu (one component, two hosts) and
  **`overlays/explain.ts`** should render `renderBlockBody` instead of a raw `<pre>` of `block.data`.

  **New improvement opportunities:** `$embeddedViews` is per-session and per-device, so a block someone
  embedded is lost on reload — persisting the *choice* (refs + view ids, like the URL-owned
  `$neighborhoodDepth` in `2.6 scope`) is a `2.6` item. And each embedded view mounts its own
  `ViewHost` with its own store subscription, so a notebook with many embedded views re-renders all of
  them on every `WorkspaceGraph` change; a shared subscription (or a single host with several specs) is
  the natural `7.3 performance` follow-up.

  Suite **408 green** (new: nested/cyclic derivation trees, category-vs-lens filtering, live dataset +
  spec memoization, embed toggles hidden when empty and reflected when on, notebook embedding end to
  end through `s-view`/`s-tree`, edge popover derivation tree).
- **Modal scrim (WP1 `0.5` blocker)** — a `modal` overlay used to mean "outside-click does not
  dismiss me"; everything else about capturing the screen was up to each dialog, so a click landed on
  the graph *behind* the Settings dialog and drove it. `OverlayManager` now owns one scrim: it paints
  `.overlay-scrim` beneath the **lowest** open modal (overlays are spaced two z-steps apart so there is
  a layer for it to sit in), takes it away when the last modal closes, and swallows pointer input on it
  — `pointer-events: auto` over the viewport plus a `mousedown` `stopPropagation`, and deliberately no
  behaviour of its own, because a modal is dismissed by its own controls or `Esc`, not by a click that
  landed on its backdrop. Focus was already trapped by `FocusTrap`, so the blocker's done-when ("a
  `modal` overlay traps focus and blocks interaction behind it") now holds for every modal. Colours are
  tokens, not literals: `colors.primitive.scrim` / `colors.semantic.bg-scrim` in `design-tokens.json`
  (regenerated through `pnpm build:tokens`), darker on the dark theme, lighter on light. Four manager
  tests: layering (above what it covers, below the modal), pointer capture (a background button's
  `mousedown` never fires, the modal stays open), absence for non-modals and after close, and disposal.

  **Notes:** `0.5`'s dialog is now unblocked but has no input — nothing produces a *pending* tool call
  (the wire carries no tool-approval message; a `tool-call` block is a finished record), so the honest
  next step is the producer, not the dialog. Worth taking while in this code: `aria-modal`/`role` still
  come from each dialog's own markup rather than the manager, so a modal that forgets it is silently
  announced as ordinary content — the manager could assert it once for every `modal` entry; and the
  background is captured for *pointer* and *focus* but not for screen-reader browsing, which wants
  `inert` on the workspace root while a modal is open (one line in `#syncScrim`, gated on whether the
  host can spare re-enabling it).

  Suite **412 green** (new: the four scrim tests above).
- **`3.5` explanation over every subject (Phase 3)** — `explain(graph, ref, entries)` is now the one
  entry point: a ref names a **block**, a **link**, or a **truth-value event**, and the subject decides
  how it reads, so a caller asks "explain this ref" instead of knowing which projection to reach for.
  The **link** subject is the existing `explainLinkModel` (relationship, both endpoints, the block it
  lands on, `confidence`, `eventRefs`); the **event** subject is new and deliberately modest — a
  `RevisionEntry` from `$nodeHistory` does not name its own block (the engine's history belongs to the
  node that was inspected), so `explainEventModel` explains an event through *itself*: its stamp, source,
  truth and timestamp, joined to the links whose `eventRefs` cite it. That join is a real fact from the
  substrate rather than a fabricated owner. The overlay grew the per-subject disclosure ladder over one
  shared `facts`/`body` pair, dropped its local `Level` union for the contract's `Disclosure` type, and —
  the sweep flagged twice — renders the block body through **`renderBlockBody`**, so an explanation of an
  artifact or a list *is* that artifact instead of `JSON.stringify(block.data)`; `detail` still adds the
  machine payload and `raw` the whole subject, which is what those levels are for. `aria-modal` came with
  it, since this overlay is a dialog. Reach grew to match: ⌥-clicking a popover row explains the *link*
  (endpoints explain the block), the same gesture the notebook and the ToC already used.

  **Notes:** `belief/goal/derivation` from the plan's original list are not separate subjects — they are
  link kinds the catalog already names (`supports`/`contradicts`, `achieves`/`fails`, `derived-from`),
  and they now read through the same subject, so a future `nars-backend` vocabulary row appears here
  without a new projection. `3.3`'s `DerivationRecord` blocks will land in the **block** subject and
  gain their provenance tree through the embedded `derivation` view. Sweeps worth taking next: the
  overlay is registered without `modal: true`, so it does not paint a scrim or trap the workspace
  behind it while open — now that the manager owns one, marking this dialog `modal` is a one-line change;
  and `$nodeHistory` is a single node's history with no owner recorded, which is what forced the event
  subject to describe itself rather than its block — a `history.subject` on the wire would fix that at
  the root.

  Suite **417 green** (new: `explain()` resolving all three subjects, the event→citing-links join, the
  link and event overlays, the notebook-rendered body, the popover's ⌥ gesture).
- **`3.3` derivation records (WP5, Phase 3)** — a provenance-category edge is now a **block**, not just a
  line between two claims. `projectReasoning` emits a `derivation` block per provenance step
  (`derivationId(edgeId)`), nested under the conclusion claim it justifies through the claim's `children`,
  so the notebook can fold it, the graph can select it, and the subtree reads *claim → how it was
  justified*. The payload (`DerivationRecordData`, the one this plan asked `block-payload.ts` to define)
  carries the rule by its **catalog kind**, the premise and conclusion as block refs, the step's
  confidence, the conclusion's truth, the cognitive events behind it, and the engine's own record
  verbatim in `raw` — the projection names what it can and keeps the rest, which is the difference between
  a normalizer and a reinterpretation. `block-payload.ts` grew a `derivation` normalizer alongside the
  other payloads; `artifacts.ts` grew a `derivation` branch that maps the record to the tree it *is*
  (`rule → premises → conclusion`, labelled through the link catalog so `derived-from` reads "derived
  from" and an unmapped rule keeps its own name rather than inventing one), and dropped `derivation` from
  `JSON_KINDS` because it no longer needs the JSON fallback. This is the first use of the `block.spec`
  seam the `SemanticBlock` contract declared ("rich render instruction for the inner view system") with
  nothing producing it: `renderBlockBody` now renders a block's own instruction **before** any artifact
  branch, and `artifactViewSpec` returns it verbatim, so a substrate can express a view this mapping does
  not know how to name. That in turn makes `4.3 affordances`' "spec-gated path reachable for engine
  claims" path real — a derivation block has a view, so **Open View** appears for it.

  **Notes:** the record is per *edge*, not per *step*, because a step id is exactly what the engine graph
  does not carry — a conclusion with two premises gets two derivation blocks, and pretending otherwise
  would mean inventing a grouping. Evidence *lineage* (the chain below a premise) stays open until the
  derivation recorder crosses the wire; when it does, the payload grows a `steps` field and the tree
  deepens, and nothing downstream changes. Also worth noting: `projectReasoning` no longer returns
  `blocks` untouched — it maps over them once to attach the nested steps, which keeps the blocks
  immutable and the merge in `projectWorkspace` simple.

  **New improvement opportunities:** the derivation block's own `uncertainty` currently duplicates the
  conclusion's, so a notebook line shows the same truth twice (block header and artifact) — derive it from
  the record at render time, or stop copying it. And `s-tree` labels its nodes from the payload, which is
  refs: rendering block labels there would want the graph, so `tree-view`'s embedded budget is the place a
  `label` resolution seam would land.

  Suite **422 green** (new: derivation record projection and its nesting, non-provenance edges untouched,
  payload normalization, the derivation tree view, unmapped-rule fallback, `block.spec` verbatim).
