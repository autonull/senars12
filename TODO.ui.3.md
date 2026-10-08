# TODO.ui.3.md — One Workspace, Many Renderers

**Relationship to prior plans.** This integrates and supersedes both `TODO.ui.2.md` and the "Revised Core Direction" memo. Nothing landed is discarded: the SSOT registries (`theme`, `eventCatalog`, `fieldCatalog`, `lensCatalog`, `layoutRegistry`, `idSource`), the reactive core/store, the `ViewSpec`/adapter view system (`s-series`/`s-table`/`s-table-mini`/`s-sparkline`/`s-tree`/`s-text`), the protocol + event bridge + `GRAPH_REDUCERS` catalogs, `defineSurface`/surface registry, the scenario catalog, and the `/test/*` harness are the **existing baseline**. `TODO.ui.md` remains the progress log; `TODO.ui.2.md` remains the source of the carried-forward contracts (§3.2, §3.4, §3.5).

**Why v3 — the product pivot.** The UI is not a shell with standing panels. It is **one main workspace** with switchable renderers over one semantic substrate, plus overlays:

> Not: chat panel + graph panel + config panel + telemetry panel + inspector panel.
> But: one main view — Notebook / Graph / Graph3D — with popups and overlays.

| Replace | With |
|---|---|
| IA from panels and surfaces | IA from one semantic workspace and multiple renderers |
| Chat + graph + telemetry + inspector | Semantic conversation/cognition graph rendered as Notebook or Graph, with overlays |
| Markdown chat | Typed semantic content blocks and links |
| Graph only for cognition | Graph for conversation, artifacts, reasoning, tools, provenance, and cognition |
| 3D as a major near-term objective | 3D as a later renderer once the substrate and 2D modes are excellent |

This also creates a separate product opportunity: an innovative **semantic LM conversation UI** that works without SeNARS reasoning enabled, reusable in or alongside SpaceGraphJS (§14, Phase 7).

---

## 0. Product pivot

### 0.1 The abstraction

The important abstraction is not "panel." It is:

```
Semantic Conversation/Cognition Graph (WorkspaceGraph)
        ↓
Workspace Renderer
        ↓
Notebook | Graph | Graph3D | future renderers
```

The same session renders as:

- a **Notebook** — flat, vertically sequenced semantic pages;
- a **Graph** — flowing semantic network of turns, claims, sections, artifacts, questions, derivations, tool calls, gate decisions;
- a **Graph3D** — spatial semantic/cognitive environment, later, same contract.

### 0.2 What every renderer must be capable of

Each renderer is nearly fully capable, not a display:

- receiving input (composer),
- displaying LM output,
- displaying reasoning output,
- showing artifacts,
- supporting inspection/explanation,
- invoking actions (steer/author),
- navigating semantic structure,
- focusing/selection,
- embedding or popping up alternate views.

Future renderers are admitted, but they must render the same substrate and declare their capabilities honestly (§10).

### 0.3 Capabilities → products (unchanged from v2 §0.1, new manifestation)

Capabilities (`language`, `reasoning`, `uiControl`, `tools`, `memory`) toggle independently; none is privileged. They no longer add zones — they change **what enters the WorkspaceGraph**, **the default renderer**, **composer modes**, and **overlay availability**.

| Composition | Default renderer | Product identity |
|---|---|---|
| `language` only | Notebook | **Semantic LM Workspace** — the standalone product |
| `reasoning` only | Graph | symbolic reasoning workbench |
| `language` + `reasoning` | Notebook, Graph one keystroke away | SeNARS Reasoning-OS surface |
| `+ uiControl` | any | self-demonstrating / agent-operable |
| `+ tools` / `+ memory` | any | agentic / persistent sessions |

### 0.4 Non-goals

- Not a bespoke UI per domain — domains arrive as data (descriptors/adapters/block kinds).
- Not a fixed finite feature set — the surface is open-ended; the contracts are not.
- Not a single-engine tool — NARS is the first backend, not the definition.
- Not byte-deterministic or pixel-gated — narrative reproducibility (pixel harness stays as a demoted design-regression net).
- Not 3D-first, now explicit: Graph3D receives no bespoke product work until Notebook and Graph are excellent.
- Not a dashboard — no permanent diagnostic wall by default; anything can be pinned, but pinning is user-driven.

---

## 1. Main UX principle: one workspace + overlays

The UI has one primary object: **the active semantic workspace**. Everything else is an overlay on it.

```text
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                   MAIN WORKSPACE VIEW                       │
│                                                             │
│        Notebook | Graph | Graph3D | future renderers        │
│                                                             │
│   floating HUD: mode · model/backend · budget · ⌘K · stop   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Transient overlays:
- command palette (⌘K)          - explanation popover
- semantic ToC                   - artifact viewer
- contextual inspector           - search results
- composer (input dock)          - provider/config dialog
- tool approval dialog           - timeline scrubber
- embedded graph/notebook        - notifications/announcer
```

Rules:

- No permanent diagnostic panels by default. The full viewport is the working surface.
- One overlay manager: stacking order, `Esc` closes topmost, focus returns to anchor, outside-click dismisses non-modals, focus trap for dialogs. Every overlay is focus-trapped and keyboard-operable.
- **Pinning is user-driven:** any overlay may be pinned as a floating card — still not a permanent default panel.
- Every overlay is a `defineSurface` descriptor (test API, story, gallery cell, a11y metadata for free).
- The floating HUD is the only always-present chrome, and it is thin: mode switcher · provider/backend chip · budget/health · ⌘K · stop/cancel. It expands (as an overlay) to telemetry detail via the existing embedded views (`s-sparkline`, key-value `s-table-mini`).

---

## 2. Core substrate: WorkspaceGraph

The existing ViewSpec/Event/Field/Lens work remains, but repositioned (§3.3). The central substrate is a typed semantic graph of conversation, artifacts, reasoning, and actions.

### 2.1 Content blocks

LM conversation is not raw Markdown. Markdown is an interchange/rendering format; the substrate segments input and output into semantic blocks.

```ts
type BlockKind =
  | 'turn' | 'section' | 'heading' | 'paragraph'
  | 'claim' | 'question' | 'answer' | 'list'
  | 'table' | 'code' | 'math' | 'image' | 'diagram' | 'chart'
  | 'citation' | 'tool-call' | 'tool-result'
  | 'derivation' | 'gate-decision' | 'budget' | 'config-change'
  | 'error' | 'embedded-view' | 'raw';

interface SemanticBlock {
  id: Ref;
  kind: BlockKind;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'reasoner';
  title?: string;
  text?: string;
  level?: number;                    // heading depth / grouping
  data?: unknown;                    // structured payload (rows, chart spec, DerivationRecord, …)
  artifact?: Artifact;               // v2 §2.3 artifact contract
  spec?: ViewSpec;                   // rich render instruction (inner view system, §3.3)
  children?: Ref[];
  sourceRefs?: Ref[];                // who/what produced it
  eventRefs?: Ref[];                 // cognitive events behind it
  provenanceRefs?: Ref[];            // derivations/records
  uncertainty?: Uncertainty;         // engine-declared; rendered via fieldCatalog
  status?: 'streaming' | 'complete' | 'error' | 'rejected' | 'partial';
  createdAt: number;
  createdBy: 'user' | 'lm' | 'reasoner' | 'tool' | 'system';
}
```

- **Notebook pages = top-level blocks.** `WorkspaceGraph.roots` in order gives the vertical sequence; pages are typically `turn` and standalone `section` blocks. Pages stay flat; internal structure is `contains` links + headings (the ToC and the Graph both read them).
- Known kinds render richly; unknown kinds degrade to text/JSON (`raw`).

### 2.2 Semantic links

```ts
type SemanticLinkKind =
  | 'contains' | 'next'
  | 'responds-to' | 'answers' | 'asks'
  | 'references' | 'supports' | 'contradicts' | 'revises'
  | 'elaborates' | 'summarizes' | 'achieves'
  | 'uses-tool' | 'produced-by-tool'
  | 'derived-from' | 'admitted-by-gate' | 'rejected-by-gate'
  | 'formalizes' | 'cites' | 'focuses' | 'same-topic';

interface SemanticLink {
  id: Ref;
  source: Ref; target: Ref;
  kind: SemanticLinkKind;
  label?: string;
  confidence?: number;
  uncertainty?: Uncertainty;
  eventRefs?: Ref[];
  createdBy: 'user' | 'lm' | 'reasoner' | 'system';
}
```

The link-kind catalog is **data** (like `eventCatalog`): each kind declares label, category, graph edge style, notebook link style, and which lenses/layouts feature it. Adding a kind is one catalog row.

### 2.3 WorkspaceGraph + ops

```ts
interface WorkspaceGraph {
  blocks: Map<Ref, SemanticBlock>;
  links: Map<Ref, SemanticLink>;
  roots: Ref[];                  // notebook page order
  focus?: Ref;                   // client/session state
  selection: Set<Ref>;           // client/session state
  timeCursor?: number;           // present-anchored scrub position
}

type WorkspaceOp =               // event-sourced; seq monotonicity from UnifiedGraphProjection
  | { op: 'block.add'; block: SemanticBlock; after?: Ref }
  | { op: 'block.patch'; id: Ref; patch: Partial<SemanticBlock> }
  | { op: 'block.remove'; id: Ref }
  | { op: 'link.add'; link: SemanticLink }
  | { op: 'link.remove'; id: Ref }
  | { op: 'roots.set'; roots: Ref[] };
```

The WorkspaceGraph is a projection of an op stream, exactly as SeNARS state is a projection of its event log. `blocks`/`links` are event-sourced; `focus`/`selection`/`timeCursor` are session state that survives renderer switches.

### 2.4 Identity policy

One id namespace everywhere: a block's `Ref` is simultaneously a graph node id, a popover anchor, a citation target, a URL target, and an engine `Ref` when it represents a reasoning object. **Blocks are the primary representation** of beliefs/derivations/goals; graph nodes are those blocks projected. A `derivation` block's `data` is the engine's `DerivationRecord`; its `derived-from` links point at the premises — so "the explanation equals the backend's `DerivationRecord`" holds structurally in every renderer.

### 2.5 Producers

| Producer | Emits |
|---|---|
| Composer + input decomposition (§8.2) | user `turn` with `claim`/`question`/command children |
| Output segmentation pipeline (§9) | assistant turns: headings, paragraphs, tables, code, images, citations, artifacts; `responds-to`/`contains`/`references` links |
| Engine projection (Phase 3; wraps the landed `GRAPH_REDUCERS` bridge) | `claim`/`derivation`/`gate-decision`/`budget` blocks; `derived-from`/`admitted-by-gate`/`contradicts`/`revises` links with engine uncertainty |
| LM-assisted enrichment (§9.2) | annotations only — `same-topic`/`summarizes`/labels with `createdBy:'lm'` and `confidence` |

**Epistemic rule (mirrors the kernel's firewall):** LM-proposed structure — claim boundaries, topics, summaries, contradiction candidates — is **System 1 annotation**, rendered distinctly, never truth. Extracted claims become beliefs only through formalization → gates when `reasoning` is on (§3.2 in Phase 3).

---

## 3. Contracts

### 3.1 `WorkspaceRenderer` (new spine)

```ts
interface WorkspaceRenderer {
  readonly id: 'notebook' | 'graph' | 'graph3d' | string;
  readonly label: string;
  capabilities(): WorkspaceRendererCaps;
  mount(host: HTMLElement, ctx: WorkspaceContext): void;
  present(blocks: SemanticBlock[], links: SemanticLink[]): void;   // snapshot (re)hydration
  apply(ops: WorkspaceOp[]): void;                                 // incremental streaming
  focus(ref: Ref): void;
  select(refs: Ref[]): void;
  openComposer(anchor?: Ref): void;
  openExplain(ref: Ref): void;
  snapshot(): RendererSnapshot;   // viewport/scroll/camera + focus/selection
  restore(snap: RendererSnapshot): void;
  dispose(): void;
}

type WorkspaceRendererCaps = {
  interactions: Array<'compose'|'stream'|'artifacts'|'inspect'|'explain'
    | 'select-context'|'follow-up'|'steer'|'run-control'|'palette'
    | 'structure-nav'|'embed'>;
  blockKinds: BlockKind[] | 'all';
  parity: 'full' | 'partial';    // graph3d ships partial, declared honestly
};
```

Open renderer registry (`registerRenderer`); active renderer is store state, URL-addressable, palette-switchable, agent-settable. **Switch continuity:** `snapshot()` → mount → `restore()`; focus/selection/timeCursor carry across; a behavioral spec asserts round-trips per renderer pair.

### 3.2 `ReasoningBackend` + semantic substrate — carried forward unchanged from v2 §2.1/2.2 (NARS adapter #1 behavior-preserving; MeTTa adapter #2 proves generality in Phase 3.7).

### 3.3 `ViewSpec` repositioned — retained, one level down

Previous framing: many surfaces/panels each render views. New framing: **one workspace renderer uses ViewSpecs internally** for artifacts, embedded views, and popovers.

- `WorkspaceRenderer` is top-level; `ViewAdapter` is inner/embedded.
- Notebook and Graph are workspace renderers; table/tree/series/code/chart/text are artifact adapters (the landed `s-*` elements).
- Popovers, artifact viewers, and `embedded-view` blocks use ViewSpecs via `<s-view>`; lens/modulation vocabulary (`lensCatalog`) stays the graph renderer's visual-channel language.

This keeps all landed infrastructure while preventing the UI from becoming a dashboard of panels.

### 3.4 `LmProvider` + routing — carried forward from v2 §2.4 (real `lm.status`/`lm.switch`, per-provider params, observable routing).

### 3.5 `ui.command` over the workspace

```ts
type UiCommand =
  | { type: 'ws.setRenderer'; renderer: string }
  | { type: 'ws.focus'; ref: Ref }
  | { type: 'ws.explain'; ref: Ref }
  | { type: 'ws.highlight'; refs: Ref[] }
  | { type: 'ws.openToc' } | { type: 'ws.search'; query: string }
  | { type: 'ws.present'; artifact: Artifact }
  | { type: 'ws.embed'; renderer: 'graph'|'notebook'|'table'|'tree'|'timeline';
      sourceRefs: Ref[]; budget: 'inline'|'overlay' }
  | { type: 'ws.compose'; mode: ComposerMode; anchor?: Ref }
  | { type: 'ws.scrubTime'; t: number }
  | { type: 'ws.narrate'; text: string }
  | { type: 'ui.setCapability'; id: string; enabled: boolean };
```

Gated behind **UI Control Mode** (default off): when off, agent UI intentions surface as *suggestions* the user confirms; when on, commands execute with a **visible command log** and a **stop button** in the HUD. One channel = self-demonstration + self-explanation + agent-operable interface.

### 3.6 Capability registry + toggles — carried forward from v2 §0.1/Phase 0.5.

---

## 4. Notebook mode

Not "Markdown chat" — a semantic page renderer.

### 4.1 What it looks like

```text
User request (turn page)
  ├─ extracted intent / claims
  ├─ constraints
  ├─ referenced entities
  └─ formalization candidates (when reasoning is enabled)

Assistant response (turn page)
  ├─ heading
  ├─ explanation paragraph
  ├─ claim cards
  ├─ table artifact
  ├─ code artifact
  ├─ reasoning trace preview (derivation block)
  └─ follow-up actions
```

### 4.2 Block affordances (gutter menu + contextual link menu)

focus · explain · ask follow-up · convert to belief · make goal · cite/reference · open in graph · view provenance · copy/export · embed related graph. (Believe/goal/formalize affordances appear when `reasoning` is on; otherwise hidden, not inert.)

### 4.3 Navigation

Because output is segmented: popup ToC (headings, claims, tables, code, tool calls, reasoning events; searchable) · section folding · semantic breadcrumb · kind filters ("claims only", "tables only", "tool calls only", "reasoning events only") · contextual link menu (ask follow-up, explain, open related, view as graph, copy/export) · jump to related block · jump to graph neighborhood · `j/k` block, `[ ]` page, URL-addressable `(page, block, disclosure)`.

### 4.4 LM-only behavior

With only `language` enabled, Notebook resembles a modern LM UI, but improved: input and output semantically decomposed; artifacts typed, not markdown spans; headings, claims, tables, code, images, citations, actions navigable; relationships explicit; **the conversation can be re-rendered as a graph** (Phase 2). This is the standalone product (§14).

### 4.5 Reasoning-enabled behavior

With `reasoning` on, the same mode additionally shows: formalization candidates, admitted beliefs/goals/questions, derivations, truth/confidence, gate decisions, provenance links, budget events, contradictions, retractions/revisions. **Reasoning enriches the WorkspaceGraph; it does not require a different UI.**

---

## 5. Graph mode

Renders the same WorkspaceGraph through Cytoscape. Not just the NAR concept graph — a **semantic content graph**: turns, intents, sections, claims, questions, answers, tables, code, images, artifacts, tool calls, derivations, beliefs, goals, gate decisions, budgets, contradictions.

### 5.1 Conversation as flowing network

```text
[user question]
      │ asks
      ▼
[main answer] ──contains──▶ [claim A]
      │                       │ supports
      │                       ▼
      │                [derivation/provenance]
      ├─contains──▶ [table artifact]
      ├─contains──▶ [code block]
      └─references▶ [prior claim]
```

LM-only still works (`intent → section → claim → example → table`); reasoning adds the formal derivation/provenance layer. Streaming output grows the network live.

### 5.2 Graph interactions (nearly fully capable, not passive)

type prompt in graph · create question/claim node · select subgraph as context for next prompt · ask follow-up from any node · inspect/explain node or edge · open artifact viewer · expand/collapse sections · switch layouts · filter by block/link kind · chronological flow · semantic clusters · provenance graph · contradiction neighborhood · open Notebook focused on node.

### 5.3 Layouts (projections over the same substrate)

| Layout | Purpose | Phase |
|---|---|---|
| `chronological-flow` | conversation/event sequence | 2 |
| `semantic-map` | topic/claim clustering | 2 |
| `artifact-map` | outputs as central objects | 2 |
| `source-view` | user/LM/tool/reasoner/system sources | 2 |
| `reasoning-provenance` | derivation/evidence chains | 3 |
| `gate-pipeline` | proposal → derivation → gate → event log | 3 |
| `contradiction-neighborhood` | competing claims and evidence | 3 |
| `budget-resource` | spend vs limits, terminations | 3 |

Each is a `layoutRegistry` row with a deterministic variant (landed seed/layout machinery) for tests and captures.

---

## 6. Graph3D mode (deferred, same contract)

Low priority: no bespoke product work until Notebook and Graph are excellent. When it returns it implements `WorkspaceRenderer` over SpaceGraph, consumes the same WorkspaceGraph, supports focus/select/explain/composer, reuses semantic layouts via `layoutRegistry` surface maps, provides 2D/table fallback, and ships `parity: 'partial'` honestly. Graph3D is another renderer of the same workspace graph, not a second app.

---

## 7. Embedded and overlay views

A main mode can contain or summon another mode, without returning to panel sprawl:

- Notebook block embeds a graph of a derivation/contradiction/topic neighborhood.
- Notebook block embeds a mini graph of related claims.
- Graph node popover shows a Notebook-style card sequence for a cluster.
- Graph edge popover shows a derivation tree.
- Notebook section: "view this section as graph." Graph selection: "view selected subgraph as notebook."

Represented as `embedded-view` blocks:

```ts
interface EmbeddedViewBlock extends SemanticBlock {
  kind: 'embedded-view';
  data: { renderer: 'notebook'|'graph'|'table'|'tree'|'timeline';
          sourceRefs: Ref[]; mode?: string };
}
```

Embedded views share the same focus/selection model as the main renderer.

---

## 8. Input model

### 8.1 Floating composer

An overlay anchored to: workspace bottom · selected block · selected graph node · selected subgraph · current focus · command-palette action.

Modes: **Ask · Reply · Believe · Goal · Question · Command · Tool · Explain · Demonstrate · Transform selected.** Modes gated by capabilities (Believe/Goal require `reasoning` or offer formalization when on; Tool requires `tools`).

### 8.2 Input decomposition

User input also becomes semantic blocks:

> "Robins are birds. Birds are animals. What is a robin?"

```text
Turn
  ├─ claim: Robins are birds.
  ├─ claim: Birds are animals.
  └─ question: What is a robin?
```

With `reasoning`: claim → formalization candidate → admitted belief; question → formalized query. Language-only: claim/question blocks remain conversational content. The raw input is always preserved as a child block (fidelity). Both Notebook and Graph gain rich structure immediately.

---

## 9. Output segmentation pipeline

```text
streaming text/artifacts
   ↓ block parser (deterministic)
   ↓ artifact detector
   ↓ semantic segmenter (LM-assisted, optional)
   ↓ linker (references/citations/topic)
   ↓ WorkspaceGraph ops
   ↓ renderer projection
```

### 9.1 Deterministic first

Markdown headings → heading/section blocks · tables → table artifacts · fenced code → code artifacts · lists → list blocks · links/citations → citation/reference blocks · tool events → tool-call/tool-result blocks · reasoning events → derivation/gate/budget blocks. Block ids stable under streaming reparse (content-hash + position anchor).

### 9.2 LM-assisted enrichment (annotations, not truth)

The LM may propose claim boundaries, topic links, summaries, contradiction candidates, semantic labels, ToC labels, graph grouping — rendered as System 1 annotations (`createdBy:'lm'`, `confidence` on links, distinct style). If `reasoning` is on, extracted claims may be routed through formalization/gates before becoming beliefs. Enrichment is a toggle with visible cost.

### 9.3 Streaming behavior

```text
assistant turn starts
  heading block appears
  paragraph block streams
  table block materializes
  claim nodes are linked
  artifact cards appear
  finalization links all blocks
```

Notebook shows structured streaming, not one monolithic text delta; Graph shows the network growing live.

---

## 10. Capability parity matrix

| Capability | Notebook | Graph | Graph3D later |
|---|---:|---:|---:|
| enter prompt | yes | yes | yes |
| stream output | yes | yes | yes |
| show typed artifacts | yes | yes | yes |
| inspect object | yes | yes | yes |
| explain provenance | yes | yes | yes |
| select context | yes | yes | yes |
| ask follow-up from object | yes | yes | yes |
| add belief/goal/question | yes | yes | yes |
| run/step/pause | yes | yes | yes |
| open command palette | yes | yes | yes |
| navigate ToC/structure | yes | graph outline | graph outline |
| render table/code/chart | yes | node/popup/embed | node/popup/embed |
| show event/provenance | yes | yes | yes |
| embedded graph/notebook | yes | yes | yes |

Graph3D may lag, but the contract and declared gaps are explicit. **Parity suite:** the canonical loop scripted once, executed per renderer (or per declared partial subset); continuity round-trip specs per renderer pair.

---

## 11. Delivery phases

Each phase is small, verifiable, leaves the app working, and reorders around the workspace + semantic-LM-UI wedge.

### Phase 0 — Main workspace contract
Goal: replace panel-first architecture with one workspace renderer contract.
- [x] 0.1 WorkspaceGraph substrate: `SemanticBlock`, `SemanticLink`, `WorkspaceOp`, store atoms; link-kind catalog as data.
- [~] 0.2 Projection from current state: chat → turns/blocks; existing `GRAPH_REDUCERS`/`UnifiedGraphProjection` wrapped as a block/link producer (behavior-preserving; existing tests stay green).
  - Client half landed (`projectChat`/`projectGraph`/`projectWorkspace`: chat turns + discourse links; engine nodes → claim/tool blocks with `derived-from`/`references` links and NAL uncertainty). Remaining: wrap the server `GRAPH_REDUCERS`/`UnifiedGraphProjection` as an op-emitting producer and drive `$workspaceGraph` reactively.
- [~] 0.3 `WorkspaceRenderer` contract + registry (`notebook`, `graph`, `graph3d` stub); mode-switch state; capabilities.
  - Contract, registry, `$activeRenderer` state and the honest `graph3d` stub (parity `partial`) landed. Real `notebook`/`graph` renderers land in Phases 1–2.
- [ ] 0.4 Main workspace shell: main area renders the active renderer; floating HUD (mode · provider/backend · budget · ⌘K · stop); permanent panels removed/default-hidden.
- [ ] 0.5 Overlay manager + primitives: command palette, contextual inspector, explanation popover, semantic ToC, artifact viewer, settings/provider dialog, tool approval; focus trap, `Esc` stack, pinning seam.
- [ ] 0.6 Carried contracts: `ReasoningBackend` + semantic substrate (NARS adapter behavior-preserving); `LmProvider` façade + real `lm.status`/`lm.switch`; capability registry + toggles; `ui.command` schema (dispatcher stub; execution Phase 5).
- [ ] 0.7 Compatibility bridge: existing graph nodes/events/chat still render (as overlays/embedded views); landed ViewSpec adapters usable inside overlays/embedded blocks.

**Verification:** user switches Notebook ↔ Graph over the same session data; focus/selection survives the switch; no required side panel exists; existing tests pass or are intentionally updated.

### Phase 1 — Semantic Notebook / standalone LM UI wedge
Goal: build the unique LM conversation UI first.
- [ ] 1.1 Notebook renderer: vertical page renderer, block components, block affordances, folding, focus/selection, streaming-friendly.
- [ ] 1.2 Composer overlay with modes; universal input (NL now; Narsese/structured seam).
- [ ] 1.3 Input decomposition: deterministic claim/question/command split; raw preserved; extracted structure shown.
- [ ] 1.4 Output segmentation: headings, paragraphs, lists, tables, code, images/links, citations; block-level streaming; stable ids.
- [ ] 1.5 Semantic ToC overlay (headings, claims, tables, code, tool calls, reasoning events; search/filter) + kind filters + breadcrumbs + keyboard nav.
- [ ] 1.6 Contextual link menu: ask follow-up, explain, open related, view as graph, copy/export, (formalize-as-belief/goal/question seam).
- [ ] 1.7 LM-only completeness: Notebook works with no reasoning backend; provider status in HUD; rich artifacts; conversation graph exists even without NARS.

**Verification:** LM-only Notebook is a better-than-chat UI; a response with headings/table/code becomes navigable blocks; ToC and contextual actions are block-aware; no reasoning capability required.
**Deliverable:** a standalone semantic LM conversation workspace.

### Phase 2 — Graph renderer for semantic conversation
Goal: render the same semantic conversation as a flowing content graph.
- [ ] 2.1 Graph projection: blocks → nodes, links → edges, sections → compound nodes/clusters; incremental animated growth.
- [ ] 2.2 Conversation layouts: `chronological-flow`, `semantic-map`, `artifact-map`, `source-view` (registry rows + deterministic variants).
- [ ] 2.3 Graph-native input: composer anchored to node/edge/canvas/selection; selected nodes become prompt context; create question/claim nodes.
- [ ] 2.4 Graph inspection: node/edge popovers, artifact preview popovers, "open in Notebook," semantic neighborhood navigation.
- [ ] 2.5 Mode parity: shared focus/selection; actions work in both; switching preserves context; parity specs.

**Verification:** the same LM-only conversation is usable in Notebook and Graph; follow-up from a graph node; output appears as a network; selected subnetwork becomes next prompt context.
**Deliverable:** an innovative graph-native LM conversation UI.

### Phase 3 — Reasoning integration into the workspace graph
Goal: SeNARS reasoning enriches the same Notebook/Graph substrate.
- [ ] 3.1 Map NAR concepts/events into blocks/links: beliefs, goals, questions, derivations, revisions, contradictions, budget events, gate decisions.
- [ ] 3.2 Formalization flow: conversational claim → candidate formalization → gate admission → belief/goal/question; visible in both renderers (System 1→2→gate pipeline blocks).
- [ ] 3.3 Provenance blocks: derivation-record block with premises/conclusion links, truth/confidence, rule id, evidence lineage, raw record.
- [ ] 3.4 Reasoning layouts: `reasoning-provenance`, `gate-pipeline`, `contradiction-neighborhood`, `budget-resource`.
- [ ] 3.5 Contextual explanation popover for claim/block/node/edge/event/belief/goal/derivation; disclosure levels `summary · card · detail · raw` as data.
- [ ] 3.6 Steer/author: retract/revise belief, add goal, adjust budget/provider from block/node actions; live reaction as new blocks/links.
- [ ] 3.7 Generality probe: MeTTa backend adapter feeding the same substrate; one scenario through it (two engines, one workspace).

**Verification:** basic derivation scenario visible in both renderers; explanation equals backend `DerivationRecord`; contradiction scenario shows both conversational and formal structure; budget exhaustion appears as a real semantic event.
**Deliverable:** Notebook and Graph become full SeNARS reasoning workspaces.

### Phase 4 — Embedded views and overlays
Goal: local Graph-in-Notebook and Notebook-in-Graph without panel sprawl.
- [ ] 4.1 Embedded graph block in Notebook (selected refs: derivation, contradiction, topic neighborhood).
- [ ] 4.2 Embedded notebook card in Graph popovers (block sequence for node/cluster).
- [ ] 4.3 Artifact viewer overlay: table/code/chart/image/diff/json/derivation-record; fullscreen and inline.
- [ ] 4.4 Timeline overlay: present-anchored scrubber (live/past/prospective) filtering the current renderer projection by time.
- [ ] 4.5 Pinning: overlays pinnable as floating cards; still not permanent defaults.

**Verification:** a Notebook page contains a live graph; a graph node opens local Notebook context; embedded views use the same selection/focus model.

### Phase 5 — Agent-operable workspace
Goal: the agent drives the same main workspace through governed UI commands.
- [ ] 5.1 `ui.command` over the workspace: set renderer, focus, explain, highlight, open ToC/search, present artifact, embed view, compose, narrate, scrub.
- [ ] 5.2 UI Control Mode: default off → suggestions; on → execution with visible command log + stop button.
- [ ] 5.3 Demonstrations: "show me how you got that" — the agent switches renderers, focuses refs, opens provenance, narrates; no fake player.
- [ ] 5.4 Screen-record mode: minimal HUD, visible focus highlight, captions/narration.

**Verification:** commands never execute silently when UI Control Mode is off; the agent demonstrates a real derivation when enabled; transcripts reference real blocks/events/provenance.

### Phase 6 — Graph3D later
- [ ] `WorkspaceRenderer` for Graph3D over SpaceGraph; same WorkspaceGraph; focus/selection/explain/composer; semantic layouts via surface maps; 2D/table fallback; parity tests only after usable.
**Verification:** no 3D-only state; switch preserves focus/selection; core actions work.

### Phase 7 — Extract reusable semantic LM UI (+ hardening)
Goal: make the semantic LM UI separable, possibly SpaceGraphJS-adjacent.
- [ ] 7.1 Package boundary:
```text
semantic-workspace-core   — SemanticBlock, SemanticLink, WorkspaceGraph,
                            segmentation pipeline, artifact contract, renderer contract
semantic-notebook         — Notebook renderer
semantic-graph            — Cytoscape renderer
senars-ui                 — SeNARS reasoning/event/provenance adapters,
                            kernel/gate/budget integrations
```
- [ ] 7.2 Standalone product build: LM provider + segmentation + semantic links + Notebook/Graph, engine-free (candidate names: SpaceGraph Chat · Semantic Notebook · Conversation Graph · SpaceGraph Workspace · Semantic LM Workspace).
- [ ] 7.3 Hardening: performance (op batching, virtualization, graph decimation, latency budgets); error taxonomy; accessibility pass (keyboard-only walkthrough, canvas text alternatives via the table adapter, `aria-live`); plugin/descriptor API for new renderers/block kinds/link kinds; docs-as-code from descriptors; visual-regression net re-expanded.

**Verification:** `semantic-workspace-core` imports nothing engine-specific; the LM-only product runs headless end-to-end; gates clean.

---

## 12. New definition of done

A feature is not done because it appears in a panel. It is done when:

- it is represented in the workspace graph;
- it appears meaningfully in Notebook;
- it appears meaningfully in Graph, or has a documented fallback;
- it can be focused/searched/navigated;
- it has contextual actions;
- it can be inspected as summary/detail/raw;
- it survives renderer switch;
- it works with keyboard;
- it does not require a permanent side panel;
- it uses real events/artifacts/provenance where available.

Validation gates remain behavioral, not pixel: the canonical loop completes end-to-end against a real LM (+ real backend when `reasoning` on), headless-drivable; CI runs an **LM-only matrix** (no backend) and a reasoning matrix; curated design-intent shots and screen-recorded demos are acceptance artifacts; the pixel harness stays a demoted regression net.

---

## 13. Keep / demote / reuse ledger

**Keep & build on:** SSOT registries (`theme`, `eventCatalog`, `fieldCatalog`, `lensCatalog`, `layoutRegistry`, `idSource`); `defineSurface` + surface registry + reflective generators; `ViewSpec`/adapters (`s-series`, `s-table`, `s-table-mini`, `s-sparkline`, `s-tree`, `s-text`, `viewSource`, `$viewSelection`); protocol + event bridge + `GRAPH_REDUCERS`; scenario catalog (S1–S5 re-expressed as workspace scenarios); `/test/*` harness (repositioned as the workspace steering API); tokens/themes; seeded id/clock/rng seam.

**Reposition:** ViewSpec system becomes the inner/artifact view layer under `WorkspaceRenderer` (§3.3). `UnifiedGraphProjection` is wrapped by the workspace projection; graph ops become a derived view (behavior-preserving).

**Panel migration (content survives, chrome demoted):**

| Existing panel | Becomes |
|---|---|
| chat-history-panel | the Notebook renderer itself |
| input-hud | floating composer overlay |
| node-detail-drawer | contextual inspector popover / pinnable card |
| config-hud / config-profiles | settings dialog overlay (palette-launched; forms from `fieldCatalog`/`renderField`) |
| lens-controller / lens-designer | graph-renderer overlays/dialogs (lenses still apply) |
| telemetry-panel / cognitive-metrics | HUD expansion + embedded sparkline/key-value views |
| timeline-scrubber | timeline overlay (4.4) |
| lm-status-panel | HUD model/backend chip |
| graph-toolbar / graph-minimap | renderer-local transient chrome/overlay |
| contradiction-badge | block/link annotations + `contradiction-neighborhood` layout |

**Demote:** Graph3D (Phase 6); pixel baselines as a gate (design-regression net only); Storybook as a blocker (kept as tooling fed by reflective generators); every standing diagnostic panel.

---

## 14. The standalone product

The `language`-only composition is deliberately shippable on its own: a conversation that can be **read as a notebook, navigated as semantic structure, and explored as a graph.** The standalone product runs with an LM provider, artifact segmentation, semantic links, and Notebook/Graph modes; SeNARS adds reasoning, gates, provenance, truth, uncertainty, budgets, and event sourcing through `senars-ui`. Natural home: alongside/inside SpaceGraphJS — document ↔ graph ↔ space is one continuum, with Graph3D as the same substrate's third renderer.

---

## Appendix A — Immediate implementation order

1. Define `SemanticBlock`, `SemanticLink`, `WorkspaceGraph`.
2. Add workspace store atoms.
3. Build main workspace shell with floating HUD and mode switch.
4. Implement Notebook renderer over current chat/session data.
5. Add deterministic output segmentation for headings, paragraphs, lists, tables, code.
6. Add semantic ToC overlay.
7. Add block context menu.
8. Project the same blocks into Cytoscape Graph mode.
9. Add graph-native composer from selected node/subgraph.
10. Map SeNARS events/derivations into blocks/links.
11. Add contextual explanation popover.
12. Add embedded graph block inside Notebook.
13. Add UI command support over workspace.
14. Defer Graph3D until Notebook and Graph are compelling.

## Appendix B — Block kind ↔ renderer mapping (registry preview)

| Block kind | Notebook renderer | Graph treatment | Inner view adapter |
|---|---|---|---|
| turn / section / heading | page + ToC hierarchy | cluster hub / compound node | — |
| paragraph / list / quote | text renderer (semantic, not raw md) | label-bearing node | — |
| claim / question / answer | statement card + truth chip (when reasoning) | belief-lens node | — |
| table | `s-table` (embedded: `s-table-mini`) | node; rows expandable | table |
| chart / series | `s-series` (embedded: `s-sparkline`) | node with glyph | series |
| code / math | highlighted / math renderer | node | text |
| image / diagram | image renderer | node | — |
| citation | inline link | `cites`/`references` edge | — |
| tool-call / tool-result | `s-tree` / `s-text` + status | node + `uses-tool`/`produced-by-tool` edges | tree/text |
| derivation | provenance preview → popover `s-tree`/`s-table` | node + `derived-from` edges | tree/table |
| gate-decision | verdict row (admitted/rejected + reason) | pipeline node | table |
| budget | meter row (`fieldCatalog` fields) | resource view node | series/table |
| config-change | diff row | node | table |
| error | callout | node (severity from `eventCatalog`) | text |
| embedded-view | nested renderer (§7) | nested renderer (§7) | per `data.renderer` |
| raw | text/JSON fallback | node | text |

## Appendix C — Open questions

- Turn/page boundary policy: auto-page per turn pair, with agent/user overrides.
- Block id stability under streaming reparse (content-hash + position anchor proposal).
- ToC scale: virtualization and outline-only mode for very long sessions.
- Composer defaults: which modes surface LM-only; how Believe/Goal degrade to suggestions.
- LM-assisted enrichment: default on/off, cost visibility, and annotation styling vocabulary.
- Pinning persistence: session-only vs URL-addressable pinned cards.
- Tool transport for `uiControl`: in-process first, MCP later (carried).
- Artifact/block sandboxing policy before any untrusted content (carried).
- Multi-agent boundary remains a future contract (carried).
- Package naming and whether `semantic-graph` ships inside the SpaceGraphJS umbrella at extraction time.

---

## Appendix D — Implementation log

### 2026-10-08 — Phase 0.1–0.3 substrate + contract (client)

**Landed**
- `ui/src/client/core/workspace-graph.ts` — `Ref`, `Uncertainty`, `Artifact`, `BlockKind`,
  `SemanticBlock`, `SemanticLinkKind`, `SemanticLink`, `WorkspaceGraph`, `WorkspaceOp`;
  copy-on-write `applyWorkspaceOp`/`applyWorkspaceOps` plus `rootBlocks`/`linksTouching`.
- `ui/src/client/utils/link-catalog.ts` — `LINK_CATALOG` as data, exhaustive over
  `SemanticLinkKind` (`satisfies Record<…>`), with category / edge style / notebook style /
  layouts / lenses; `linksByCategory|Layout|Lens`.
- `ui/src/client/core/workspace-renderer.ts` — `WorkspaceRenderer`, `WorkspaceRendererCaps`
  (`parity: 'full' | 'partial'`), `RendererSnapshot`, `WorkspaceContext`, `WORKSPACE_INTERACTIONS`,
  and the open `registerRenderer` registry (`renderersForKind`, `rendererSupports`).
- `ui/src/client/components/renderers/graph3d.ts` — honest `parity: 'partial'` stub registered on
  import; wired into `entry.ts` so the third renderer exists end-to-end.
- `ui/src/client/core/workspace-projection.ts` — deterministic client projection: chat → ordered
  `turn` blocks + `responds-to`/`supports`/`contradicts`/`derived-from` links; engine graph →
  `claim`/`tool-call` blocks + `derived-from`/`references` links; `projectWorkspace` merges and
  excludes chat-message nodes. Stable ids via `turnId`/`claimId`/`linkId`.
- Store: `$workspaceGraph`, `$activeRenderer` atoms (session state explicitly outside the op stream);
  barrel exports; `core/index.ts`.
- Tests (24 new, whole UI suite 97 green, typecheck + biome clean):
  `tests/components/{workspace-graph,link-catalog,workspace-renderer,workspace-projection}.test.ts`.

**Notes for remaining work**
- `0.2` client projection is pure; it is not yet wired to `$workspaceGraph`. Next: subscribe the
  projection to `$chatMessages`/`$graphNodes`/`$graphEdges` (or emit ops from `applyServerMessage`)
  and wrap the server `GRAPH_REDUCERS`/`UnifiedGraphProjection` as an op producer, keeping
  behavior-preserving (existing graph tests untouched).
- `0.4` shell: render `$activeRenderer` into the main area and demote panels to overlays; the
  registry and `$activeRenderer` are ready for it.
- `Session state` (`focus`/`selection`/`timeCursor`) currently lives on `WorkspaceGraph`; the shell
  must keep it out of `present()`/`apply()` and carry it through `snapshot()`/`restore()` on switch.
- `graph3d` stub ignores `present`/`apply` by design; do not treat as a real renderer until Phase 6.

**New improvement opportunities**
- `WorkspaceOp` could carry the engine `seq`/`eventRefs` so `$lastSeqId` ordering and provenance
  fall out of the op stream rather than being re-derived.
- `projectGraph` currently discards `createdAt` (engine nodes have no timestamp); threading event
  time through would make the future `chronological-flow` layout and timeline overlay exact.
- The link catalog's `layouts` rows reference Phase 2/3 layout ids not yet registered; a parity test
  (catalog layouts ⊆ `layoutRegistry` ids, once those layouts land) would prevent drift.
- `applyWorkspaceOp` copies whole `Map`s per op; batch streaming should fold ops before a single
  `set` — revisit when the projection is wired.


