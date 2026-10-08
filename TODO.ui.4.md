# TODO.ui.4.md — Consolidated Forward Backlog

> **Relationship to prior plans.** This document **supersedes `TODO.ui.3.md` for all open work**.
> `TODO.ui.3.md` is retained as the **landed record** — its product framing, the full `WorkspaceGraph`
> / `WorkspaceRenderer` contracts, the keep/demote ledger, the block-kind matrix, and the 35-entry
> implementation log `(a)…(ag)` remain authoritative for *what exists*. This file carries only the
> **still-open backlog, merged improvement opportunities, and the ordering for the next arcs**, so a
> work session does not have to read ~1,900 lines of history.
>
> **Stable IDs.** Phase/item ids are preserved from v3 (`0.4`, `3.1`, `4.3`, …) so old references and
> log provenance (`see (ag)`) still resolve. Do not renumber. New items get the next free id in their
> arc.
>
> **What is done.** Phases 0.1–0.3, 1.1–1.7, 2.1–2.5 (partials below), 4.3–4.4 (demotion), and the
> overlay manager/palette/primitives all landed; see v3 Appendix D. The product now renders one
> workspace (Notebook/Graph) over one `WorkspaceGraph` with a floating HUD and summoned overlays, and
> works LM-only with no reasoning backend.

---

## 0. Working principles (unchanged — full text in v3 §1–§3)

- **One workspace + overlays.** No permanent diagnostic panels by default; pinning is user-driven;
  every overlay is a `defineSurface` descriptor.
- **One semantic substrate.** Blocks are primary; renderers project them. Blocks carry `Ref`s that are
  simultaneously graph ids, popover anchors, URL targets, and engine refs.
- **Epistemic firewall.** LM-proposed structure is System 1 annotation (`createdBy:'lm'`), never truth;
  beliefs only via formalization → gates when `reasoning` is on.
- **Capabilities compose, none privileged** (`language · reasoning · tools · memory · uiControl`).
- **Behavioural, not pixel, validation.** The pixel harness is a demoted design-regression net.

Definition of done and validation gates: v3 §12. Keep/demote ledger and panel-migration table: v3 §13.

---

## 1. Arc A — Finish the shell

- [~] **0.4** No permanent side panel; thin floating HUD.
  - Landed: shell, HUD (`mode · provider · ☰ ToC · ⏱ timeline · ⌘K`), standing diagnostic panels
    default-closed + palette-reachable, timeline scrubber demoted to an overlay.
  - **Gap:** the auto-opening **node-detail drawer** is still the last standing side panel → convert to
    a contextual inspector popover / pinnable card. The legacy config panel is still docked; migrate it
    to the settings overlay (and the config e2e spec), then default it off. Move telemetry content into
    the HUD expansion (sparkline + `s-table-mini`) and retire the bottom panel. Add a HUD "Panels" menu
    derived from `view.panel.*`. Add budget/stop to the HUD once run-control (5.2) exists.
- [~] **0.5** Overlay manager + primitives.
  - Landed: manager (stacking, `Esc` stack skipping pinned, outside-click, focus trap, anchor return,
    pinning seam), `OverlayHost`, palette, ToC, block menu, explanation, artifact viewer, settings.
  - **Gap:** build the **tool-approval dialog** overlay; land **pinning** (4.5); decide palette
    modality (`modal: true`?); let `overlay.*` forward all args to `overlay:open` (today only `ref`);
    add a generic anchor resolver so anchored popovers pass the Cytoscape container.
- [~] **0.6** Carried contracts.
  - Landed: capability registry/toggles; `ui.command` schema + dispatcher stub over the one registry.
  - **Gap:** `ReasoningBackend` contract + adapter seam; `LmProvider` façade (note `lm.status`/
    `lm.switch` are already real); fuller `ui.command` execution is Phase 5.

## 2. Arc B — Compatibility bridge

- [ ] **0.7** Bridge: existing graph nodes/events/chat render as overlays/embedded views; the landed
  ViewSpec adapters are usable inside overlays and `embedded-view` blocks. Fold the last legacy
  consumers onto the workspace substrate.

## 3. Arc C — Notebook & Graph excellence

- [~] **1.1** Notebook renderer.
  - **Gap:** virtualization for long sessions.
- [~] **1.2** Composer overlay with modes; universal input.
  - **Gap:** the true **floating composer** anchored to a selected block/node/subgraph (needs 2.3);
    structured-mode producers (`believe`/`goal`/`tool`) once 3.2 + tool transport land.
  - Related opportunities: mode-bar ↔ palette share one action source; `composer.prefill` signal;
    per-segment preview (fix kind, merge/split); guard `decomposeInput` against abbreviation/decimal
    over-splitting; echo the context block as a quoted excerpt in a reply.
- [~] **1.4** Output segmentation.
  - **Gap:** block-level streaming (`status:'streaming'` re-parse) — backend-coupled (needs partial
    assistant text in `$chatMessages`); add a content hash to child ids for stability mid-stream.
  - Opportunities: promote `Segment.data` to the `Artifact` contract; add a `code` shape + `s-code`;
    segmentation round-trip property test.
- [~] **1.5** Semantic ToC + navigation.
  - **Gap:** URL-addressable `page` (needs the section model); ToC virtualization / outline-only mode.
  - Opportunities: `fold all / unfold all` palette command; folded-count badge; nested-section folding
    by heading `level`; keep `j/k` consistent with folded visibility; `jump to related block`.
- [~] **1.6/1.7** Contextual link menu / LM-only completeness — largely landed; keep LM-only green as
  the primary product gate.
- [~] **2.1** Graph projection.
  - **Gap:** incremental **animated growth** of the workspace layer (today replace-by-diff);
    compound clusters from chat `contains`/headings (chat turns don't set `children`).
- [~] **2.3** Graph-native input.
  - **Gap:** floating/anchored composer at the node/edge (shared with 1.2); node-creating ops
    ("Ask as question" / "Assert as claim" → `WorkspaceOp.block.add`).
- [~] **2.4** Graph inspection.
  - **Gap:** node/edge hover popovers reusing `explainModel`/`neighborhood`; artifact preview popovers
    on edges; explicit "Open in Notebook" from a graph selection.
  - Opportunities: richer inspector (link confidence + event refs); "Open related" from graph context
    menu and ToC; remember neighborhood depth; ⌥-click a row to explain instead of navigate.
- [~] **2.5** Mode parity.
  - **Gap:** the **canonical-loop behavioural parity suite** (the §10 matrix) scripted per full
    renderer, plus per-pair continuity round-trips.
  - Opportunities: make the §10 matrix **data** (`rendererParity(interaction)`) so palette/shell gate
    uniformly via `rendererSupports`; derive capability-aware default renderer from `$capabilities`;
    Graph viewport should react to `$workspaceGraph.focus` by centering/highlighting; consolidate
    selection into one atom (`$selectedNodeIds` derived).
- [~] **2.6** URL/state consolidation (cross-cutting; see §5).
- [~] **2.7** Graph3D — deferred (Phase 6); keep the honest `partial` declaration.

## 4. Arc D — Artifacts, embedded views, timeline, pinning

- [~] **4.1** Embedded graph block in Notebook (derivation/contradiction/topic neighborhood). Wire the
  block-menu "embed" affordance when it lands; reuse `conversationPositions`.
- [ ] **4.2** Embedded notebook card in Graph popovers (block sequence for node/cluster); Graph edge
  popover shows a derivation tree.
- [~] **4.3** Artifact viewer.
  - **Gap:** bespoke **`diff`** view (two-column projection / `diff` shape) and **`derivation-record`**
    view (`s-tree`), once the `DerivationRecord` payload lands (3.3); add Copy / Open-in-graph
    affordances.
- [~] **4.4** Timeline overlay.
  - Landed: demotion — the scrubber is a summoned overlay writing `$view.timeline.t`; the existing
    modulation/gate filters already do live/past/prospective filtering.
  - **Gap:** explicit live/past/prospective controls (a "now" reset to `Infinity` + range readout);
    announce the applied window; a present-anchored cursor fading newly admitted blocks; gate the `⏱`
    HUD control on temporal availability; a `ws.scrubTime` `ui.command` for agent demos.
- [ ] **4.5** Pinning: overlays pinnable as floating cards (manager seam `setPinned`/`pinned` exists).
  Decide persistence: session-only vs URL-addressable.

## 5. Arc E — The reasoning half (Phase 3)

> The whole Phase 3 matrix is unstarted. It reuses the landed `GRAPH_REDUCERS` bridge as the producer
> and the `SemanticBlock`/`SemanticLink` substrate as the target. This is the next big arc and the
> point of the `reasoning` capability.

- [ ] **3.1** Map NAR concepts/events → blocks/links: beliefs, goals, questions, derivations,
  revisions, contradictions, budget events, gate decisions.
- [ ] **3.2** Formalization flow: conversational claim → candidate → gate admission → belief/goal/
  question; visible in both renderers (System 1 → 2 → gate pipeline blocks). Route `claim`/`question`
  children through it (ties to 1.2).
- [ ] **3.3** Provenance blocks: `derivation-record` (premises/conclusion links, truth/confidence, rule
  id, evidence lineage, raw record). This defines the `DerivationRecord` payload 4.3 needs.
- [ ] **3.4** Reasoning layouts: `reasoning-provenance`, `gate-pipeline`, `contradiction-neighborhood`,
  `budget-resource` as `layoutRegistry` rows with deterministic variants.
- [ ] **3.5** Contextual explanation popover for claim/block/node/edge/event/belief/goal/derivation;
  disclosure levels `summary · card · detail · raw` as data (mostly landed for conversation blocks —
  extend to reasoning targets).
- [ ] **3.6** Steer/author: retract/revise belief, add goal, adjust budget/provider from block/node
  actions; live reaction as new blocks/links.
- [ ] **3.7** Generality probe: MeTTa adapter feeding the same substrate; one scenario through it.

## 6. Arc F — Agent-operable (Phase 5)

- [ ] **5.1** `ui.command` over the workspace: set renderer, focus, explain, highlight, open ToC/search,
  present artifact, embed view, compose, narrate, scrub.
  - Opportunities: engine emits `ui.command` for narrations/demos; record executed commands in the
    timeline/telemetry (provenance trail); round-trip test through `applyServerMessage`; parameterised
    commands with a `params` descriptor + generated `parse`/prompt; type-check args against
    `UiCommandMsg.args`; `available()`-aware palette badge.
- [ ] **5.2** UI Control Mode: default off → suggestions; on → execution with visible command log +
  stop button in the HUD.
- [ ] **5.3** Demonstrations ("show me how you got that"): switch renderers, focus refs, open
  provenance, narrate — no fake player.
- [ ] **5.4** Screen-record mode: minimal HUD, visible focus highlight, captions/narration.

## 7. Arc G — Standalone product & hardening

- [ ] **7.1** Package boundary (`semantic-graph` vs umbrella; see open questions).
- [ ] **7.2** Standalone engine-free build: LM provider + segmentation + semantic links + Notebook/
  Graph.
- [ ] **7.3** Hardening: op batching + virtualization + graph decimation + latency budgets; error
  taxonomy; accessibility pass (keyboard-only walkthrough, canvas text alternatives via the table
  adapter, `aria-live`/Announcer); plugin/descriptor API for new renderers/block kinds/link kinds;
  docs-as-code from descriptors; re-expand the visual-regression net.
- [ ] **6** Graph3D renderer over SpaceGraph (deferred until Notebook/Graph are excellent).

---

## 8. Consolidated improvement opportunities

Merged from the v3 log; provenance in parentheses. These are not blockers — schedule into the arcs.

### URL / state consolidation
- Add `page` to the URL (`(page, block, disclosure)`) — needs the section model (`(s)`,`(t)`,`(h)`,`(q)`).
- Validate `UrlState.renderer` against the renderer registry via a cycle-free allowlist (`(s)`,`(t)`,`(x)`,`(ac)`).
- Validate `UrlState.layout` against `layoutRegistry` ids (`(ac)`).
- Mirror `$activeLens` into `urlState.lens` (`(ac)`).
- Reflect `$panels` open/close into `$urlState.panels` (today hydrate-only) (`(s)`,`(t)`,`(af)`).
- Replace ad-hoc mirror subscriptions with a `mirrorAtom(atom, pick, equals?)` helper (`(s)`,`(t)`,`(x)`,`(ac)`).
- Make active layout scope-aware (concept vs conversation) and URL-address it (`(y)`,`(ac)`).
- Remember the graph layer per lens (`(w)`); debounce `folded` writes for fold-all gestures (`(t)`).

### Overlays / HUD / palette
- Add an `Announcer` bridge on overlay open/close (`(b)`,`(e)`).
- Add "recently used" (MRU) group to the palette (`(f)`).
- HUD `⚙` affordance → `overlay.settings`; provider switching as a first-class overlay action;
  generalise `config-hud` with an `embedded` mode (`(aa)`).
- Extract a `capabilityGate`/`CapabilityHost` mixin so overlays declare required capabilities in
  descriptors (`(m)`,`(k)`).
- Generalise command `available()` with a small `when` predicate (`(f)`); derive renderer/layer
  controls from registries/capabilities instead of `active === 'graph'` (`(ab)`,`(ae)`).

### Graph
- Detail drawer reads `$graphNodes`, so workspace nodes have no content — project workspace node data
  or hide the drawer (`(n)`,`(o)`).
- Unify workspace-node lens/capability styling in the adapter (`(n)`); reuse `projectWorkspaceGraph` in
  `graph3d` and the embedded-view graph shape (`(n)`).
- Skip laying out / exclude the hidden layer from `fit` (`(w)`,`(ab)`).
- Bind `graph.ask-selection` to a keystroke (e.g. `a`) (`(p)`).
- Reuse `conversationPositions` for embedded graph views (`(y)`).
- HUD/palette group for layouts + `graph.layout.cycle` (`(y)`).
- Register `chronological-flow`/`source-view` as SpaceGraph surfaces once a storyboard adapter exists (`(y)`).

### Notebook
- Recurse nested `contains`/headings sections so pages/ToC aren't shallow (`(d)`).
- Inline rich-text tokenizer (links/emphasis/code spans) for paragraphs (`(i)`).
- Image intrinsic size/aspect `{width?,height?}` to reserve layout space (`(i)`).
- Optional inline full tables (`budget="full"`); optional end-clamped `j/k`; decide whether `j/k` skip
  container roots (`(j)`,`(h)`).
- Notebook must import the view barrel standalone / `WorkspaceHost` owns it (`(j)`).

### Performance
- `mountWorkspaceProjection` re-projects the whole graph per change → incremental ops or microtask/rAF
  coalescing (`(b)`); `applyWorkspaceOp` copies whole `Map`s per op → publish a batch op (`(Phase 0.1–0.3)`).
- Memoise `tocEntries`/`explainModel` per graph identity (`(e)`); memoise `activeCommands()` on registry
  versions (`(f)`); cache segmentation per `(id, hash)` (`(d)`).
- Pre-index adjacency: shared `linksByBlock` used by `linksTouching`/`neighborhood`/projection (`(r)`).
- Carry engine `seq`/`eventRefs` on `WorkspaceOp` for ordering/provenance (`(Phase 0.1–0.3)`).
- Thread `createdAt`/event time through `projectGraph` for exact chronology and present-anchoring (`(y)`,`(ag)`).

### Protocol / contracts
- Discriminated `Artifact` union on `SemanticBlock`/`Segment` so renderers narrow `data` without casts
  (`(i)`,`(j)`,`(d)`); add the `code` shape + `s-code` (`(j)`,`(ad)`); add the `diff` representation (`(ad)`).
- Introduce a `Source`/bibliography model (stable citation key, `[n]` resolution) (`(i)`).
- Align CLI/`ui.command` arg typing.

### Testing
- Script the canonical loop per full renderer (executable parity suite) (`(z)`,`(ae)`).
- No unit test for the Graph renderer/command (import pulls Cytoscape) (`(p)`); no `app-layout` unit
  test (`(ae)`); add a Notebook `composer:focus` path test (`(q)`).
- Extract and unit-test pure graph helpers `nodeTapAction`/`nodeGesture`, `workspaceRefs` (`(o)`,`(p)`).
- Parity test: link-catalog `layouts` ⊆ `layoutRegistry` (`(Phase 0.1–0.3)`).
- Regenerate visual baselines for the telemetry-closed + timeline demotions (intentional diffs);
  update the stale e2e "default telemetry panel" comment (`(af)`,`(ag)`).
- Timeline test API registers only after the overlay opens — helpers must open it first (`(ag)`).

### Streaming / contracts (blocked)
- Block-level streaming needs partial assistant text (backend); child-id content hash for stability
  (`(d)`,`(i)`).

---

## 9. Open questions (carried from v3 Appendix C)

- Turn/page boundary policy: auto-page per turn pair, with agent/user overrides.
- Block id stability under streaming reparse (content-hash + position anchor).
- ToC scale: virtualization and outline-only mode for long sessions.
- Composer defaults: which modes surface LM-only; how Believe/Goal degrade to suggestions.
- LM-assisted enrichment: default on/off, cost visibility, annotation styling vocabulary.
- Pinning persistence: session-only vs URL-addressable pinned cards.
- Tool transport for `uiControl`: in-process first, MCP later.
- Artifact/block sandboxing policy before any untrusted content.
- Multi-agent boundary remains a future contract.
- Package naming and whether `semantic-graph` ships inside the SpaceGraphJS umbrella at extraction.

---

## 10. Immediate implementation order (updated)

1. **0.4 finish** — inspector overlay (demote node-detail drawer); HUD telemetry expansion.
2. **0.5 finish** — tool-approval overlay; **4.5 pinning**.
3. **4.3 finish** — `diff` view; Copy/Open-in-graph in the artifact overlay. **4.4** present-anchoring.
4. **§8 URL/state consolidation** — `mirrorAtom`, validation, `page` (a contained, high-leverage pass).
5. **Phase 3.1–3.3** — engine projection, formalization flow, provenance blocks (the reasoning arc).
6. **2.x parity suite** — script the canonical loop; make §10 matrix data.
7. **Phase 5** — `ui.command` execution + UI Control Mode + demonstrations.
8. **0.7 bridge**, then **7.x hardening/standalone**, then **6 (Graph3D)**.

---

## Progress log

Newest first. Historical detail for everything before this file lives in `TODO.ui.3.md` Appendix D.

### (v4) — extracted & consolidated from `TODO.ui.3.md`
- Split the open backlog, merged improvement opportunities, open questions, and a re-ordered plan out
  of v3; v3 frozen as the landed record and implementation log. No code change.
