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
Critical path: **WP3 → WP5 → WP6 → WP7**. WP1 (finishing), WP2, and WP4 run in parallel where deps
allow.

Status legend: `[ ]` todo · `[~]` partial · `[x]` done · `!` blocked.

## Blockers / prerequisites

Cross-cutting constraints that gate multiple items — fixing one unblocks many.

- **Modal scrim** — `OverlayManager` renders no scrim; `modal` only means "ignore outside-click". Add
  a scrim element + `pointer-events` capture. Unblocks **`0.5`**.
- **`LmProvider` façade** — the `0.6` contract. Unblocks the WP1 sweep (provider switching, Provider vs
  Configuration split, `config-hud` `embedded`) and **WP5**.
- **Section model** — recursion over `roots` + heading `level`s. Unblocks the **`1.5 page`** URL and
  the WP3 section/structure item.
- **Cycle-free layout-id source** — `store` cannot import `layout-registry` (which imports `core/index`
  → `store`). Unblocks the layout half of **`2.6 validation`**.
- **Node→workspace-block mapping** — no producer maps an engine node/edge to a block `ref`. Unblocks
  the inspector half of **`4.3 affordances`** and richer **`2.4`**.
- **`DerivationRecord` payload** — defined by WP5 **`3.3`**. Unblocks **`4.3 derivation-record`**.
- **`config-change` producer** — nothing emits `config-change` blocks yet (segmentation/**`3.6`**); the
  landed diff view reads `{ before, after, language?, from?, to? }` (JSON fallback meanwhile).

---

## WP1 — Shell completion (finish)

*Outcome: no standing panels; overlay primitives complete; backend seam landed. No deps.*

- [ ] **0.5 tool approval** — build the tool-approval dialog overlay; needs the **modal scrim**
  blocker. `(b)`,`(aa)`
- [ ] **4.5 pinning** — overlays pinnable as floating cards (manager seam `setPinned`/`pinned` exists);
  decide session-only vs URL-addressable. `(b)`,`(e)`,`(aa)`
- [ ] **0.6 backend seam** — land the `ReasoningBackend` contract + adapter seam (`LmProvider` façade;
  `lm.status`/`lm.switch` already real). Needed by WP5. Sweep once it lands:
  - provider switching as an overlay action; split Provider vs Configuration entries.
  - `config-hud` `embedded` mode.
  - `CapabilityHost` mixin form, once a component gates its whole presence. `(c)`,`(aa)`,`(m)`,`(k)`,`(f)`

## WP2 — State & URL consolidation

*Outcome: one state source; everything deep-linkable. Deps: WP1.*

- [~] **2.6 validation** — renderer validation (cycle-free `workspaceRendererIds()`) and
  `$activeLens` → `urlState.lens` are done. Remaining: validate `UrlState.layout` vs `layoutRegistry`
  — needs the **cycle-free layout-id source** blocker. `(s)`,`(t)`,`(x)`,`(ac)`
- [ ] **1.5 page** — URL-address `page` (`(page, block, disclosure)`); needs the **section model**
  blocker (WP3). `(s)`,`(t)`,`(h)`,`(q)`
- [ ] **2.6 scope** — scope-aware active layout (concept vs conversation) + URL-address it; remember
  the graph layer per lens; debounce `folded` writes for fold-all. `(y)`,`(ac)`,`(w)`,`(t)`
- [ ] **2.5 selection atom** — derive `$selectedNodeIds` from `$workspaceGraph.selection`. `(z)`
- [ ] **2.5 focus react** — Graph viewport centres/highlights on `$workspaceGraph.focus` (Notebook
  already scrolls). `(h)`,`(n)`,`(r)`,`(z)`
- [ ] **2.5 defaults** — capability-aware default renderer (`language`→Notebook, `reasoning`→Graph). `(k)`
- [ ] **2.6 context** — extend `WorkspaceContext` (`overlays`, `renderer`, `setRenderer`; fold
  `openPalette` onto `activeCommands()`); retire `$viewportMode`/`$graphShape` shell atoms once
  `graph-surface` owns them. `(b)`,`(f)`,`(ae)`

## WP3 — View & artifact completion

*Outcome: full view matrix, clean artifact typing, embedded views, section model. No deps.*

- [ ] **4.3 typing** *(promoted)* — discriminated `Artifact` union on `SemanticBlock`/`Segment` (drop
  `data` casts); promote `Segment.data` to the `Artifact` contract. Now has concrete consumers:
  `codeLanguage` (`artifacts.ts`), `config-change`, and the image `data` cast. `(i)`,`(j)`,`(d)`
- [ ] **1.5/1.1 section model** *(merged: `1.5 page` model + `1.5/1.1 notebook structure`)* — recurse
  nested `contains`/headings so pages/ToC aren't shallow; nested-section folding by heading `level`;
  fold-all/unfold-all command; folded-count badge; keep `j/k` consistent with folded visibility and
  decide whether it skips container roots; optional `clampStep`; "jump to related block" from
  breadcrumb/block menu. Provides the model `1.5 page` needs. `(d)`,`(q)`,`(h)`,`(s)`,`(t)`
- [ ] **2.4 inspection & embedded views** *(merged: `2.4 graph inspection` + `4.1/4.2 embedded
  views`)* — node/edge hover popovers reusing `explainModel`/`neighborhood`; artifact edge previews;
  richer inspector (link confidence + event refs); "Open related" from graph menu and ToC; remember
  neighborhood depth; ⌥-click a row to explain instead of navigate. Plus: Notebook embedded graph block
  (derivation/contradiction/topic neighborhood); Graph node popover notebook card; graph edge popover
  derivation tree; wire the block-menu "embed" affordance; reuse `conversationPositions` and
  `projectWorkspaceGraph` in embedded graph shapes. `(r)`,`(n)`,`(y)`,`(e)`
- [~] **4.3 affordances** — the artifact overlay **Copy** / **Open in graph** and the ToC per-row
  artifact button are done. Remaining: inspector reach — needs the **node→block mapping** blocker. `(j)`,`(ad)`
- [ ] **1.4 rich text** — inline tokenizer for paragraphs (links/emphasis/code spans), unified with the
  landed `tokenizeCode` seam where possible; image intrinsic size `{width?,height?}`; optional inline
  full tables (`budget="full"`); ensure the view barrel is imported standalone / owned by
  `WorkspaceHost`. `(i)`,`(j)`
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

*Outcome: the `reasoning` capability end-to-end. Deps: WP3; needs `0.6`.*

- [ ] **3.1 projection** — map NAR concepts/events → blocks/links: beliefs, goals, questions,
  derivations, revisions, contradictions, budget events, gate decisions. `(Phase 3)`
- [ ] **3.2 formalization** — claim → candidate → gate admission → belief/goal/question, visible in both
  renderers; route `claim`/`question` composer children through it; emit `asks`/`answers` links;
  special-case structured modes in `projectChat`; server `mode`/`contexts` consumption. `(g)`,`(l)`,`(k)`
- [ ] **3.3 provenance** — `derivation-record` blocks (premises/conclusion links, truth/confidence, rule
  id, evidence lineage, raw record); defines the `DerivationRecord` payload. **Absorbs
  `4.3 derivation-record`** — the `s-tree` provenance view consumes this payload. `(Phase 3)`,`(ad)`
- [ ] **3.5 explanation** — extend the explanation popover to reasoning targets (claim/node/edge/event/
  belief/goal/derivation) with `summary · card · detail · raw`. `(Phase 3)`
- [ ] **3.4 layouts** — `reasoning-provenance`, `gate-pipeline`, `contradiction-neighborhood`,
  `budget-resource` as `layoutRegistry` rows with deterministic variants. `(Phase 3)`
- [ ] **3.6 steer/author** — retract/revise belief, add goal, adjust budget/provider from block/node
  actions; live reaction as new blocks/links. Also the **`config-change` producer** (emit the landed
  diff payload on settings changes). `(Phase 3)`
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

## WP7 — Agent-operable

*Outcome: the agent drives the workspace. Deps: WP6.*

- [ ] **5.1 execution** — `ui.command` over the workspace (set renderer, focus, explain, highlight, open
  ToC/search, present artifact, embed view, compose, narrate, scrub); round-trip test through
  `applyServerMessage`; record executed commands in timeline/telemetry; engine emits `ui.command` for
  narrations/demos. `(u)`,`(v)`
- [ ] **5.1 args** — parameterised commands with a `params` descriptor (generated `parse` + palette
  prompt); type-check args against `UiCommandMsg.args`; `available()`-aware palette badge. `(u)`,`(v)`
- [ ] **5.2 control mode / run-control** — default off → suggestions; on → execution with a visible
  command log + HUD **stop** button; then add budget/stop to the HUD. `(c)`,`(f)`
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
  publish; memoise `tocEntries`/`explainModel`/`activeCommands()`/segmentation and the ToC per-row
  artifact lookup; shared `linksByBlock` adjacency index for `linksTouching`/`neighborhood`/projection.
  `(b)`,`(e)`,`(f)`,`(d)`,`(r)`
- [ ] **7.3 quality** — error taxonomy; accessibility pass (keyboard-only walkthrough, canvas text
  alternatives via the table adapter); plugin/descriptor API for renderers/block kinds/link kinds;
  docs-as-code from descriptors; re-expand the visual-regression net. `(7.3)`
- [ ] **tests & parity harness** *(merged: `2.x pure-helper tests` + `tests sweep`)* — extract +
  unit-test `nodeTapAction`/`nodeGesture`, `workspaceRefs`; Graph-renderer unit test (import pulls
  Cytoscape) and an `app-layout` test; parity link-catalog `layouts` ⊆ `layoutRegistry`; segmentation
  round-trip property test; Notebook `composer:focus` path test; regenerate visual baselines for the
  telemetry/timeline demotions; fix the stale e2e "default telemetry panel" comment and the
  timeline-overlay test-API registration note. `(o)`,`(p)`,`(ae)`,`(Phase 0.1–0.3)`,`(d)`,`(q)`,`(af)`,`(ag)`
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
