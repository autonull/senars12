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
- [x] 0.2 Projection from current state: chat → turns/blocks; existing `GRAPH_REDUCERS`/`UnifiedGraphProjection` wrapped as a block/link producer (behavior-preserving; existing tests stay green).
  - Landed: pure `projectChat`/`projectGraph`/`projectWorkspace`, plus `workspace-bindings.ts` (`mountWorkspaceProjection`) which keeps `$workspaceGraph` live from `$chatMessages`/`$graphNodes`/`$graphEdges` (the existing `GRAPH_REDUCERS`/`UnifiedGraphProjection` path) while preserving session state. Wired in `entry.ts`. Behavior-preserving: bridge/reducers untouched; existing graph tests green.
- [x] 0.3 `WorkspaceRenderer` contract + registry (`notebook`, `graph`, `graph3d` stub); mode-switch state; capabilities.
  - Registry now holds `notebook` (`full`, `blockKinds: 'all'`), `graph` (`full`, wraps the landed Cytoscape viewport), and the honest `graph3d` stub (`partial`). `$activeRenderer` is store state (default `graph` to preserve current behavior until capability-composition defaults land).
- [~] 0.4 Main workspace shell: main area renders the active renderer; floating HUD (mode · provider/backend · budget · ⌘K · stop); permanent panels removed/default-hidden.
  - Landed: `app-layout` renders the active renderer (`<s-notebook>` vs graph/table/3D), a thin floating `workspace-hud` (registry-driven mode switch + provider chip) replaces graph-only chrome in notebook mode. The HUD now carries `☰` (ToC) and `⌘K` (palette), and `app-layout` binds `⌘/Ctrl+K` globally. The main area is now one `<workspace-host>` that mounts the active renderer through the registry (`mount`/`snapshot`/`dispose`/`restore`) and supplies the `WorkspaceContext`; Graph's table/2D/3D variants moved into `graph-surface` (see (ae)), so the shell no longer branches on renderer tags. Remaining: remove/default-hide the standing panels, and add budget/stop to the HUD once run-control exists (no silent no-ops). The active renderer is now URL-addressable (see (s)).
- [~] 0.5 Overlay manager + primitives: command palette, contextual inspector, explanation popover, semantic ToC, artifact viewer, settings/provider dialog, tool approval; focus trap, `Esc` stack, pinning seam.
  - Manager core landed (`overlay-manager.ts`): stacking + z-order, `Esc` closes topmost (skipping pinned), outside-click dismisses non-modals (modals protected), focus trap on every overlay, focus returns to the anchor, pinning seam (`setPinned`/`pinned`). The DOM outside-click check now reads `event.composedPath()`, so an anchor inside a shadow root is recognised as inside; the `FocusTrap` pierces shadow roots and retries focus on the next frame (every overlay is a Lit element, so its focusables live in a shadow root and render asynchronously). A real `OverlayHost` (`overlay-host.ts`) + data `overlay-registry.ts` now lazily instantiate a registered overlay element, assign the `Ref` it inspects, and open it under the manager; the shell (`app-layout`) owns one host and routes `overlay:open`/`overlay:close` signals. First concrete overlays landed: semantic ToC (1.5), explanation popover, contextual block menu (1.6), the command palette (⌘K), the artifact viewer (4.3), and the settings/provider dialog (aa). Tables now render through the landed `s-view`/`ViewSpec` view system (embedded budget) instead of bespoke markup, and `artifactViewSpec` maps a block's payload to a `ViewSpec`. Remaining: tool approval, timeline overlay (4.4), pinning (4.5).
- [~] 0.6 Carried contracts: `ReasoningBackend` + semantic substrate (NARS adapter behavior-preserving); `LmProvider` façade + real `lm.status`/`lm.switch`; capability registry + toggles; `ui.command` schema (dispatcher stub; execution Phase 5).
  - Landed the **capability registry + toggles** (`core/capabilities.ts`): the five capabilities (`language · reasoning · tools · memory · uiControl`) as an exhaustive catalog with labels/descriptions/defaults, the `$capabilities` composition atom (defaults to `{language}` — the LM-only product), and `capabilityEnabled`/`setCapability`. The composer modes consume it (1.2). Also landed the **`ui.command` contract + dispatcher stub**: `UiCommandMsg` (`core/src/protocol/ui-command.ts`, in `IncomingFromServer`), `dispatchCommand(id, args?)` over the one command registry (respecting `available()` and an optional per-command `parse(args)` validator, so every palette command is agent-settable — the derived `overlay.*` and `composer.focus` commands forward `ref`/`refs`/`mode`), and the `applyServerMessage` case that dispatches it. The remaining 0.6 contracts (`ReasoningBackend`, `LmProvider` façade — note `lm.status`/`lm.switch` are already real) and fuller `ui.command` execution (Phase 5) are still to come.
- [ ] 0.7 Compatibility bridge: existing graph nodes/events/chat still render (as overlays/embedded views); landed ViewSpec adapters usable inside overlays/embedded blocks.

**Verification:** user switches Notebook ↔ Graph over the same session data; focus/selection survives the switch; no required side panel exists; existing tests pass or are intentionally updated.

### Phase 1 — Semantic Notebook / standalone LM UI wedge
Goal: build the unique LM conversation UI first.
- [~] 1.1 Notebook renderer: vertical page renderer, block components, block affordances, folding, focus/selection, streaming-friendly.
  - Landed the `s-notebook` surface (`defineSurface`) + `notebookRenderer`: top-level blocks render as vertical pages with per-kind affordances (`BLOCK_KIND_LABEL`, now in `core/block-labels.ts`), role/status styling, uncertainty chips, empty-state slot, and focus/selection round-trip for renderer switches. Pages now walk `children`/`contains` and render heading/list/table/code blocks richly (static-tag headings to satisfy Lit). Every block now carries a `⋯` context-menu affordance (opens the block menu with the triggering element as anchor) and highlights when it is the workspace focus (set by the ToC or by clicking the block). **Section folding** is landed: a page with children gets a `▸`/`▾` toggle (`aria-expanded`) backed by the `$collapsedBlocks` session atom (`toggleCollapsed`), hiding/showing its children in place and preserved across renderer switches. Remaining: virtualization for long sessions (the "artifact rendering via the inner view system" is largely landed for tables via `s-view` and for image/citation/code).
- [~] 1.2 Composer overlay with modes; universal input (NL now; Narsese/structured seam).
  - Landed the mode substrate + a mode-aware universal composer. `core/capabilities.ts` (Phase 0.6 partial) is the one capability registry — `CAPABILITY_CATALOG`, `$capabilities`, `capabilityEnabled`/`setCapability`, defaulting to the LM-only `{language}` composition. `core/composer-modes.ts` is the §8.1 mode catalog as data (`ask · reply · question · command · explain · demonstrate · transform · believe · goal · tool`), each declaring the capability that makes it do work and whether it is a structured seam; `availableComposerModes(caps)` hides intents the composition cannot honour, and `decomposeForMode(text, mode)` reshapes the §8.2 split (`question` imposes the question kind, `command` collapses the input to one command, the rest use the lexical split). The `input-hud` composer now renders a mode bar over the available modes, uses the mode hint as placeholder, feeds the mode-aware decomposition, and sends `{ type:'chat.user', content, mode }`; a `composer.focus` command + `composer:focus` signal make it palette-reachable. The declared mode is now carried end-to-end: `core/protocol/chat.ts` accepts an optional `mode` on `ChatMessage`/`chat.user` (a free string so the protocol stays UI-agnostic), `addUserMessage(content, mode?)` stores it, and `projectChat` runs `decomposeForMode` on user turns (guarded by `isComposerMode`, falling back to the lexical split) — so the intent shows up as the block kinds in the WorkspaceGraph, not only in the composer preview. Remaining: the true *floating* composer anchored to a selected block/node/subgraph (§8.1) — that needs graph-native selection and a summoned rather than persistent dock — and the structured modes' producers (formalize/gate for believe/goal, tool transport).
- [x] 1.3 Input decomposition: deterministic claim/question/command split; raw preserved; extracted structure shown.
  - Landed `core/input-decomposition.ts` (`decomposeInput` + `isFaithfulDecomposition`): a slash line is one `command`, an interrogative (`?` or leading wh-word) is a `question`, every other sentence a `claim` — purely lexical, no LM. `projectChat` now expands **user** turns into these children linked by `contains`; a `raw` child is added only when the split is lossy, otherwise the turn block's `text` already preserves the raw verbatim. The legacy `input-hud` composer previews the extracted structure live as chips. Added `command` to `BlockKind` and the kind-label SSOT.
- [~] 1.4 Output segmentation: headings, paragraphs, lists, tables, code, images/links, citations; block-level streaming; stable ids.
  - Landed `core/segmentation.ts` (`segmentText`): deterministic, dependency-free Markdown parsing into heading/paragraph/list/table/code segments with table rows and fenced-code language, plus standalone images (`![alt](src)` → `image` with `{alt,src}`) and links (Markdown link or reference definition → `citation` with `{label|key,href}`); inline links stay in their paragraph. `projectChat` expands assistant turns into child blocks (`childId(msg,index)` position-anchor ids) linked by `contains`, with the raw turn text retained on the turn block. Notebook renders the children richly (including `<img>` and `<a>` for image/citation; tables render through `<s-view>` at the embedded budget via `artifactViewSpec`). Remaining: block-level streaming (`status: 'streaming'` re-parse).
- [x] 1.5 Semantic ToC overlay (headings, claims, tables, code, tool calls, reasoning events; search/filter) + kind filters + breadcrumbs + keyboard nav.
  - Landed `s-toc` overlay + pure `tocEntries` (`core/toc.ts`): walks page order and `children` in document order, keeps the navigable kinds, and offers search, present-kind filter chips, and focus-on-select (sets `$workspaceGraph.focus`, closes). Opened from the floating HUD (`☰`). Breadcrumbs (`core/navigation.ts` `breadcrumb`, rendered atop the notebook, clickable to an ancestor) and keyboard navigation (`j`/`k` blocks, `[ ]` pages via `navigationForKey`, bound in `app-layout`, ignored while an overlay is open or an editable is focused) are landed; the notebook scrolls the focused block into view. Remaining (deferred): URL-addressable `(page, block, disclosure)` is landed for the active renderer, the focused block and the disclosure (fold set) — `UrlState` carries `renderer`/`focus`/`folded`, mirrored by `$activeRenderer`/`$workspaceGraph.focus`/`$collapsedBlocks` subscriptions and hydrated on load and on `hashchange`; `page` remains (a page is a root/heading, so this wants the section model) — plus virtualization for long sessions (section folding is landed in 1.1).
- [~] 1.6 Contextual link menu: ask follow-up, explain, open related, view as graph, copy/export, (formalize-as-belief/goal/question seam).
  - Landed `s-block-menu` + `s-explain` overlays over the pure `explainModel` (`core/explain.ts`): **Ask follow-up** (focuses the composer with the block as context — see (m)), Explain, Open in graph, View provenance (only when the block has provenance links — hidden, not inert), Copy text, and — capability-gated — **Formalize as belief/goal** (shown only when `reasoning` is on; hidden otherwise, never inert). The explanation popover exposes the `summary · card · detail · raw` disclosure levels as data; an `Open artifact` affordance (only when the block has a typed artifact — table/code via `artifactViewSpec`, or an image) opens the artifact viewer. Remaining: **Open related** (semantic-neighborhood navigation) is landed — see 2.4; a dedicated "formalize as question" action is redundant with the composer `question` mode + follow-up.
- [~] 1.7 LM-only completeness: Notebook works with no reasoning backend; provider status in HUD; rich artifacts; conversation graph exists even without NARS.
  - Notebook, artifacts and provider status (`lm.status` chip) are in place; the remaining gap — the conversation graph existing without NARS — is closed by 2.1's additive workspace projection into Graph mode. Open follow-ups: the HUD stop/cancel control (still absent until streaming cancel is wired, per 0.4).

**Verification:** LM-only Notebook is a better-than-chat UI; a response with headings/table/code becomes navigable blocks; ToC and contextual actions are block-aware; no reasoning capability required.
**Deliverable:** a standalone semantic LM conversation workspace.

### Phase 2 — Graph renderer for semantic conversation
Goal: render the same semantic conversation as a flowing content graph.
- [~] 2.1 Graph projection: blocks → nodes, links → edges, sections → compound nodes/clusters; incremental animated growth.
  - Landed the pure projection + an additive Graph-mode layer. `core/graph-projection.ts` maps a `WorkspaceGraph` to renderer-agnostic `{ nodes, edges }` (`projectWorkspaceGraph`): one labelled node per block (`nodeType:'workspace'`, `term`=label so tooltip/search/lens cover it), one typed edge per link whose endpoints both exist (dangling links dropped), and `section`/`heading` blocks with `children` become Cytoscape compound `parent`s. `graph-viewport` now watches `$workspaceGraph` and diffs the projection into Cytoscape under the `workspace` class (concept nodes/edges keep their ids and lifecycle), with dedicated node/edge styles; concept-graph diffing and `applyGraphFilter` exclude the workspace layer. The two layers can be isolated with `$graphLayer` (`both · conversation · concepts`, pure `layerVisible`) and the `graph.layer.*` commands. So the conversation is navigable as a graph with no reasoning backend attached. Remaining: **incremental animated growth** (new blocks animate in rather than appearing at the next layout) and section clusters from chat `contains`/heading structure (chat turns don't set `children` today); graph-native selection is wired (see 2.3).
- [x] 2.2 Conversation layouts: `chronological-flow`, `semantic-map`, `artifact-map`, `source-view` (registry rows + deterministic variants).
  - Landed `core/conversation-layout.ts`: the four ids + an exhaustive catalog and the pure `conversationPositions(graph, id)` — deterministic positions for every block (`blockOrder` plus any detached block, so nothing is left at its old position). `chronological-flow` serpentines document order; `semantic-map` clusters blocks joined by `same-topic` links (union-find) and groups the rest by kind into a grid of lanes; `artifact-map` centres typed-output kinds and rings the rest; `source-view` lays one lane per `createdBy`. `layoutRegistry` gains a `scope` (`concept` default / `conversation`) and registers the four rows, each running the pure positions through a Cytoscape `preset` layout; `layoutsFor(scope)` reads them. The graph toolbar derives its layout options from the registry (grouped `Concept` / `Conversation`) instead of hardcoding them, and `graph.layout.<id>` commands expose the conversation layouts to the palette/agent (gated to Graph mode). See (y).
- [~] 2.3 Graph-native input: composer anchored to node/edge/canvas/selection; selected nodes become prompt context; create question/claim nodes.
  - Landed selection routing + selection-as-context. Tapping a `workspace` node focuses the block (`setWorkspaceFocus`); double-click opens Explanation; right-click opens the block menu. The Graph renderer's `openComposer(anchor?)` no longer calls the non-existent `composer` overlay — it emits `composer:focus` with the anchor (or the workspace subset of `$selectedNodeIds`), and a `graph.ask-selection` command does the same for the palette/agent. The composer carries a *list* of context refs end-to-end (`composer:focus { refs }` → `chat.user`/`ChatMessage.contexts: string[]` → composer chips → `projectChat` emits one `references` edge per known ref). Remaining: the composer is still the persistent dock (not a floating overlay anchored to the node/edge), and node-creating (question/claim) ops from the graph.
- [~] 2.4 Graph inspection: node/edge popovers, artifact preview popovers, "open in Notebook," semantic neighborhood navigation.
  - Landed semantic-neighborhood navigation. `core/neighborhood.ts` is a pure BFS (`neighborhood(graph, ref, depth)`) over `linksTouching`, returning each neighbor with its link and `in`/`out` direction; `s-related` (overlay `related`) groups them by relation+direction and navigating a row focuses the block and closes. The block menu's "Open related" appears only when the block has neighbors (hidden, not inert). Remaining: node/edge popovers on the graph itself (hover/click a link), artifact preview popovers on edges, and an explicit "open in Notebook" from a graph selection (selection currently focuses, which the Notebook reveals).
- [~] 2.5 Mode parity: shared focus/selection; actions work in both; switching preserves context; parity specs.
  - Landed the shared focus/selection spine + parity specs. The `notebook`/`graph` adapters now read and write the one session state (`$workspaceGraph.focus`/`selection`) in `focus`/`select`/`snapshot`/`restore` instead of private fields, so `snapshot()` → `restore()` is a real round-trip; the Graph adapter also mirrors selection into `$selectedNodeIds`/`$selectedNodeId` so multi-select styling and the detail drawer follow. The graph viewport writes every selection change (node/concept tap, background deselect, shift multi-select) into `setWorkspaceSelection`, so both renderers see the same selection. `renderer-parity` specs assert the full renderers share state, snapshot/restore round-trip, a Notebook↔Graph switch preserves focus/selection, and `graph3d` declares `partial`. See (z). Now completed: `WorkspaceHost` owns the registry-driven mount/switch (`mount`/`snapshot`/`dispose`/`restore`) and Graph's `graph-surface` owns the table/2D/3D variants, so the shell no longer hardcodes a tag per renderer — see (ae). Remaining: the canonical-loop behavioral parity suite (the §10 matrix) across renderers.

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
- [~] 4.3 Artifact viewer overlay: table/code/chart/image/diff/json/derivation-record; fullscreen and inline.
  - Landed the viewer + most of the matrix. `s-artifact` (0.5/4.3) renders a block's artifact at full budget through the shared `<s-view>` host (shape switcher/fullscreen for free) or an `<img>` for image blocks; the block menu's "Open artifact" appears only when the block has a typed artifact or image (hidden, not inert). `artifactViewSpec` maps `table` (table/text), `code` (text, titled by language), `chart` carrying a `SeriesDataset` (series/table/text), and a structured-JSON `text` fallback for payloads without a bespoke view (`chart` without a series, plus `derivation · gate-decision · budget · config-change · tool-call · tool-result`). See (j) and (ad). Remaining: bespoke `diff` and `derivation-record` views (a diff shape/two-column projection and an `s-tree` provenance view), and the overlay's own Copy/Open-in-graph affordances.
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

### 2026-10-08 (b) — Phase 0.2 live projection + Phase 0.5 overlay manager

**Landed**
- `ui/src/client/core/workspace-bindings.ts` — `syncWorkspaceGraph` (re-projects chat + engine graph
  into `$workspaceGraph`, carrying `focus`/`selection`/`timeCursor` across) and
  `mountWorkspaceProjection` (subscribes to `$chatMessages`/`$graphNodes`/`$graphEdges`, returns an
  unsubscribe). Wired once in `entry.ts`. Completes 0.2 on the client: the substrate is live from the
  existing bridge/`GRAPH_REDUCERS` path without touching it.
- `ui/src/client/core/overlay-manager.ts` — `OverlayManager`: stacking order + z-order, `Esc` closes
  the topmost unpinned overlay, outside-click dismisses only non-modals, a `FocusTrap` on every
  overlay, focus returns to the anchor, and the pinning seam (`setPinned`/`pinned`).
- Tests: `tests/components/{workspace-bindings,overlay-manager}.test.ts` (11 new; whole UI suite 108
  green; typecheck + biome clean).

**Notes for remaining work**
- `0.5` still needs the concrete overlay descriptors built on the manager: command palette, contextual
  inspector, explanation popover, semantic ToC, artifact viewer, settings/provider dialog, tool
  approval. Each should be a `defineSurface` descriptor (§1) and register with the shell's manager.
- `0.4` shell is the next structural step: render `$activeRenderer` into the main area, mount its
  `mount(host, ctx)` with an `OverlayManager`-backed `WorkspaceContext`, and demote panels.
- `mountWorkspaceProjection` re-projects the whole graph on every atom change; once streaming lands,
  switch to incremental `WorkspaceOp`s or coalesce with a microtask/rAF before `set`.

**New improvement opportunities**
- `WorkspaceContext` is currently `{ openOverlay, openPalette }`; the shell will likely want
  `overlays: OverlayManager`, `renderer`, and a `setRenderer` callback — extend the contract now that
  a real manager exists.
- Pin state is in-memory only; §Appendix C flags URL-addressable pinned cards — decide whether pin
  ids join the hash URL state alongside `panels`.
- Add an `OverlayManager`-driven announcement (`Announcer.announce` on open/close) so screen readers
  get the overlay title for free.

### 2026-10-08 (c) — Phase 0.3 complete, 0.4 shell + 1.1 Notebook

**Landed**
- `ui/src/client/components/renderers/notebook.ts` — `s-notebook` surface (`defineSurface`, bindings
  on `$workspaceGraph`) rendering top-level blocks as vertical pages with per-kind affordances
  (`BLOCK_KIND_LABEL`, exhaustive), role/status styling, uncertainty chips, empty-state slot; plus
  `notebookRenderer` (`parity: 'full'`, `blockKinds: 'all'`) with focus/selection round-trip and
  overlay routing. Registered with both `defineSurface` and `registerRenderer`.
- `ui/src/client/components/renderers/graph.ts` — `graphRenderer` adapter wrapping the landed
  Cytoscape `graph-viewport` into the contract; completes the registry (`notebook`/`graph`/`graph3d`).
- `ui/src/client/components/workspace-hud.ts` — thin floating HUD: registry-driven mode switch
  (`aria-pressed`) over `workspaceRenderers()` and an `lm.status` provider chip. No silent no-op
  controls (⌘K/stop deferred until palette/run-control exist).
- `app-layout.ts` — main area renders the active renderer (`<s-notebook>` vs graph/table/3D); the
  graph toolbar is hidden in notebook mode; `<workspace-hud>` embedded. `$activeRenderer` default set
  to `graph` to preserve current behavior until capability-composition defaults land.
- Tests: `tests/components/{notebook,workspace-hud}.test.ts` (9 new; whole UI suite 117 green;
  typecheck + biome clean; client build succeeds).

**Notes for remaining work**
- `0.4` still to do: demote/default-hide the standing panels, URL-address the active renderer, and add
  budget/stop/⌘K to the HUD once those features do real work.
- `1.1` next: block context menu (§4.2 affordances), section folding, and rendering table/code blocks
  through the inner view system (`s-table`/`s-sparkline`/`s-tree`) instead of the text fallback.
- Notebook currently renders only direct roots; when output segmentation produces `contains`-linked
  child blocks, page rendering should walk `contains`/headings rather than only `roots`.
- The `graph`/`notebook`/`graph3d` adapters ignore `present`/`apply` because they subscribe to the
  store directly; if a second consumer of an off-store `WorkspaceRenderer` appears, revisit whether
  renderers should own the data push instead of reading atoms.

**New improvement opportunities**
- Move the renderer mount/switch into a `WorkspaceHost` element that owns an `OverlayManager`, so
  `app-layout` stops hardcoding which element each renderer uses and the `WorkspaceContext` becomes
  real for all renderers.
- The HUD and the future command palette should share one action source (registry-derived), so a new
  renderer or overlay appears in both without edits.
- `$activeRenderer` should join `$urlState`/hash parsing next to `lens`/`panels` for shareable mode
  links.

### 2026-10-08 (d) — Phase 1.4 output segmentation + structured Notebook

**Landed**
- `ui/src/client/core/segmentation.ts` — `segmentText`: deterministic, dependency-free Markdown
  parsing into `heading`/`paragraph`/`list`/`table`/`code` segments (`Segment`), with `TableData`
  payloads and fenced-code language. Document-order preserved; unknown constructs degrade to a
  paragraph.
- `ui/src/client/core/workspace-projection.ts` — `projectChat` now expands assistant turns into child
  blocks via `childId(messageId, index)` with `contains` links; the raw turn text stays on the turn
  block for fidelity. `childId` exported.
- `ui/src/client/components/renderers/notebook.ts` — pages walk `children`/`contains` and render
  headings (static `<h1..h6>`, since Lit cannot interpolate tag names), lists, tables and code
  blocks richly.
- Tests: `tests/components/segmentation.test.ts` (7) + updated projection/notebook specs (whole UI
  suite 126 green; typecheck + biome clean).

**Notes for remaining work**
- Segment `image`/`link`/`citation` blocks and support block-level streaming: re-parse on each delta
  and reuse ids by position so a `status: 'streaming'` tail block settles into final kinds.
- Child ids are position anchors; the plan's "content-hash + position anchor" needs a content hash to
  stay stable when a block is inserted mid-stream — add when streaming re-parse lands.
- Notebook page composition still only understands direct `children`; nested `contains`/headings
  sections (§4.3 folding) should recurse or the ToC will be shallow.
- User input is still an unsegmented raw turn; Phase 1.3 (`claim`/`question`/command split) reuses
  `segmentText` plus sentence/command detection.

**New improvement opportunities**
- Promote `Segment.data` to the `Artifact` contract so code/table segments can carry a `ViewSpec` and
  render through `s-table`/`s-code` instead of bespoke notebook markup.
- `projectChat` segments on every re-projection; cache segmentation per message id + content hash so
  the live binding stays cheap under streaming.
- A segmentation property test (segment → reassemble loses no non-whitespace text) would guard the
  fidelity guarantee the raw turn block currently provides implicitly.

### 2026-10-08 (e) — Phase 0.5 overlay host + concrete overlays (ToC 1.5, block menu/explain 1.6)

**Landed**
- `ui/src/client/core/overlay-registry.ts` — `OverlayDescriptor` data catalog (`registerOverlay`/
  `overlayDescriptor`/`overlays`), so palette/shortcuts/tests enumerate overlays without importing
  their elements.
- `ui/src/client/core/overlay-host.ts` — `OverlayHost`: lazily instantiates a registered overlay's
  element into a container, assigns the `Ref` it inspects, and opens it through the one
  `OverlayManager`. The shell (`app-layout`) now owns one host and routes `overlay:open`/
  `overlay:close` signals (added to `UiSignals`); it exposes `window.__testApi.overlays`
  (`open`/`close`/`isOpen`/`stack`/`descriptors`).
- `ui/src/client/core/overlay-manager.ts` — outside-click now reads `event.composedPath()`, so an
  anchor inside a shadow root is recognised as inside (Escape and focus-return were already safe).
- `ui/src/client/core/block-labels.ts` — `BLOCK_KIND_LABEL` extracted from the notebook as the one
  exhaustive kind → label SSOT; ToC and inspector read it too.
- `ui/src/client/core/toc.ts` — pure `tocEntries`: page order + `children` in document order, keeping
  navigable kinds; `ui/src/client/core/explain.ts` — pure `explainModel`: a block plus every touching
  link labelled through `linkMeta`.
- `ui/src/client/components/overlays/{toc,explain,block-menu}.ts` + `index.ts` — the first concrete
  overlays: semantic ToC (search, present-kind filter chips, focus-on-select), the explanation
  popover (`summary · card · detail · raw`), and the contextual block menu (Explain, Open in graph,
  View provenance only when links exist, Copy text). Hidden-not-inert affordances that need a
  capability/producer not yet built.
- Store: `setWorkspaceFocus`/`setWorkspaceSelection` session-state helpers. Notebook: per-block `⋯`
  context menu (emits `overlay:open` with the triggering element as anchor) and focused-block
  highlight. HUD: `☰` ToC trigger. Barrel exports + `core/index.ts`.
- Tests (25 new across 5 files; whole UI suite 148 green; typecheck + biome clean; client build
  succeeds): `tests/components/{overlay-host,toc,explain,block-menu}.test.ts` + notebook affordance/
  focus specs.

**Notes for remaining work**
- Overlays are lazily created and appended to `document.body`; a renderer switch does not unmount
  them. Pin state and overlay stack are in-memory only (Appendix C URL-addressable pinned cards).
- Overlay trigger/anchor elements live inside a surface's shadow root; the manager resolves
  containment via `composedPath` but focus-return still calls `.focus()` on the inner element, which
  is correct. If overlays become anchored popovers, add an explicit anchor resolver to `OverlayHost`.
- `explainModel` labels the "other" end from `title`/first text line; when the graph grows, add a
  `blockLabel(block)` SSOT reused by ToC, explain and the block menu instead of the three private
  helpers that exist now.
- The block menu hides follow-up/formalize/embed; wire them when the composer (1.2), capability
  registry (0.6) and embedded views (Phase 4) land rather than shipping placeholders.

**New improvement opportunities**
- ⌘K command palette is now the only missing piece to make the HUD "complete"; derive its commands
  from the same registries (renderers, overlays, capabilities) so a new surface appears in both.
- Derive a `WorkspaceHost` element that owns the `OverlayHost` and mounts the active renderer, so
  `app-layout` stops hardcoding which element each renderer uses and `WorkspaceContext.openOverlay`
  becomes real for every renderer (currently renderers open overlays via the event bus).
- An `Announcer` bridge on `OverlayHost` open/close (emit the title) would give screen readers the
  overlay context for free and satisfy the earlier 0.5 a11y note.
- `tocEntries`/`explainModel` recompute on every store change; memoise per `$workspaceGraph` identity
  (the graph object is replaced on each projection, so an `identity` check is exact).

### 2026-10-08 (f) — Phase 0.5 command palette (⌘K)

**Landed**
- `ui/src/client/core/commands.ts` — `Command` + registry (`registerCommand`/`registeredCommands`) and
  `activeCommands()`: explicit commands plus ones **derived from the registries that already exist**
  (workspace renderers, overlays, graph view actions). A new renderer or overlay appears in the
  palette with no edit here; `OverlayDescriptor.hiddenInPalette` keeps the palette out of itself.
- `ui/src/client/core/command-match.ts` — pure tiered ranker (`matchCommands`): title prefix >
  word-prefix > substring > in-order subsequence, title order breaking ties.
- `ui/src/client/components/overlays/palette.ts` — `s-palette`: grouped list, fuzzy filter, arrow-key
  selection, Enter runs (closes then runs), reset-on-open via the host's new `overlay-open` event.
- `ui/src/client/core/focus-trap.ts` — now pierces shadow roots (overlay focusables live in the Lit
  element's shadow root) and re-focuses the first focusable on the next animation frame (Lit renders
  async), so every overlay autofocuses correctly; Tab cycling recomputes the focusables each keydown.
- `ui/src/client/core/overlay-host.ts` — dispatches `overlay-open` on the element after opening.
- HUD `⌘K` button; `app-layout` global `⌘/Ctrl+K` binding. `core/index.ts` + overlays barrel exports.
- Tests (21 new across 4 files; whole UI suite **161 green**; typecheck + biome clean; client build
  succeeds): `command-match`, `palette`, `focus-trap`, and an `overlay-open` case in `overlay-host`.

**Notes for remaining work**
- The palette is non-modal (outside-click dismisses), matching the ToC; if it should capture the
  background, set `modal: true` on its descriptor — the manager already enforces it.
- `activeCommands()` recomputes on every palette render and on each keydown; it re-derives from the
  registries each call. Memoise on the registry versions if command count grows.
- Renderer/overlay commands fire through the event bus / store; there is no run log yet, so the
  Phase 3 `ui.command` visible command-log + stop button remain unbuilt (0.4 budget/stop depends on
  run-control, not on the palette).
- `FocusTrap`'s frame focus uses `requestAnimationFrame`; in the rare case a surface renders after the
  frame, focus falls back to the element itself. The palette also focuses its input in the
  `overlay-open` handler, so it is doubly covered.

**New improvement opportunities**
- Fold `WorkspaceContext.openPalette` onto the same `activeCommands()` source and have renderers call
  it directly (via the future `WorkspaceHost`), so `⌘K` is one action rather than an event round-trip.
- Add a `recently used` MRU group to the palette (`registerCommand` timestamps) — the usual palette
  quality win, and it makes `activeCommands()` order meaningful.
- Command availability currently keys off `$activeRenderer`; a tiny `when` predicate over the store
  (block selected, streaming) would generalise this beyond graph-only commands.

### 2026-10-08 (g) — Phase 1.3 input decomposition

**Landed**
- `ui/src/client/core/input-decomposition.ts` — `decomposeInput(text)` + `isFaithfulDecomposition`:
  deterministic, LM-free split of raw input into ordered `claim`/`question`/`command` segments. A
  slash line is one command; an interrogative (`?` or leading wh-word) is a question; every other
  sentence a claim. Sentences are kept verbatim; classification does not depend on punctuation alone.
- `ui/src/client/core/workspace-projection.ts` — `projectChat` expands **user** turns into decomposed
  children linked by `contains` (mirroring the agent segmentation path, now via a shared `childBlock`
  helper). `childId` accepts a string index; `rawChildId(messageId) = childId(messageId,'raw')` is
  the raw-fidelity child. Raw is preserved by the turn block's `text`, and an explicit `raw` child is
  added only when the split is lossy (multi-segment or non-claim), so plain one-liners stay clean.
- `BlockKind` gains `command`; `BLOCK_KIND_LABEL` (the exhaustive SSOT) names it.
- `ui/src/client/components/input-hud.ts` — the composer previews the extracted structure live as
  per-kind chips while typing, satisfying "extracted structure shown" without a separate composer UI.
- `core/index.ts` exports. Tests (10 new across 3 files; whole UI suite **171 green**; typecheck +
  biome clean; client build succeeds): `input-decomposition`, user-decomposition cases in
  `workspace-projection`, and `input-hud` preview.

**Notes for remaining work**
- The composer is still the legacy full-width `input-hud` dock, not the §8.1 floating/anchored
  overlay with capability-gated modes — that is Phase 1.2 (`ComposerMode`). The decomposition is the
  reusable substrate, so 1.2 can call `decomposeInput` directly and replace the preview.
- `decomposeInput` splits on `[.!?]`, so abbreviations ("e.g.") over-split; a targeted guard (common
  abbreviations / decimals) is the obvious follow-up if it matters. It never drops text.
- The `raw` child is emitted only for lossy splits; if a future producer needs byte-exact child
  segmentation (whitespace-significant input), switch `isFaithfulDecomposition` to always-false and
  the raw child becomes unconditional.

**New improvement opportunities**
- Once reasoning is on, route `claim` children through the formalization/gate pipeline (3.2) and
  `question` children through formalized queries — the decomposition already carries the kind needed
  to choose the path.
- Add `asks`/`answers` links from question/answer children (e.g. assistant `answers` the parent user
  `question` child) so the graph shows Q→A structure, not only `contains`.
- The preview could offer per-segment affordances (fix kind, merge/split) — cheap with the current
  data and it makes the deterministic split user-correctable, honouring "annotations, not truth".

### 2026-10-08 (h) — Phase 1.5 breadcrumbs + keyboard navigation

**Landed**
- `ui/src/client/core/navigation.ts` — pure navigation projections over the WorkspaceGraph:
  `blockOrder` (depth-first document order), `parentMap`, `rootOf`, `stepBlock` (`j/k`, clamped),
  `stepPage` (`[ ]`), `breadcrumb`, and `navigationForKey` (key → target). No DOM, so movement rules
  are unit-tested directly and the shell only maps a key to a target.
- `ui/src/client/core/block-labels.ts` — `blockLabel(block)` is now the one label rule (heading text >
  title > first line > kind); `toc.ts` and `explain.ts` drop their private label helpers and use it.
- `ui/src/client/components/renderers/notebook.ts` — every block carries `data-id` (its `Ref`); a
  clickable breadcrumb bar renders the focus path (page → … → block) and focuses ancestors on click;
  the focused block scrolls into view on focus change (`updated`, guarded for jsdom).
- `ui/src/client/components/app-layout.ts` — the global key handler now also does workspace navigation:
  `j`/`k` step blocks, `[`/`]` step pages, ignored while an overlay is open or while an editable
  element (input/textarea/select/contenteditable, found through `composedPath`) has focus.
- Tests (12 new across 2 files; whole UI suite **179 green**; typecheck + biome clean; client build
  succeeds): `navigation` (order/step/clamp/page/breadcrumb/key-mapping/`blockLabel`) and notebook
  breadcrumb + `data-id`.

**Notes for remaining work**
- `stepBlock`/`stepPage` clamp at the ends (no wrap); if wrap is wanted, change only `clampStep`.
- `j/k` currently walks container turn/section roots as well as content; if navigation should skip
  containers, filter `blockOrder` by `(children ?? []).length === 0`.
- Navigation is unmodified by active renderer: in graph mode `j/k` still moves `$workspaceGraph.focus`
  (the graph does not yet scroll to it). Gating the binding on the notebook renderer, or teaching the
  graph renderer to react to `focus`, is the follow-up.
- `scrollIntoView` is called only when `focus` changes (tracked in `#scrolledFocus`), so re-renders do
  not fight the user's scroll position.

**New improvement opportunities**
- URL-address `(page, block, disclosure)` now that focus is a first-class store field: a small
  `history` sync in `app-layout` would make notebook state deep-linkable and complete the 1.5 line.
- A "jump to related block" action in the breadcrumb/block menu using `explainModel` links would turn
  navigation from linear to graph-aware without any new data.
- Section folding can key off `breadcrumb`/`parentMap`: collapse a container by hiding its descendants,
  and reuse `blockOrder` to keep `j/k` consistent with what is visible.

### 2026-10-08 (i) — Phase 1.4 image/link/citation segmentation

**Landed**
- `ui/src/client/core/segmentation.ts` — the parser now recognises, as standalone lines, Markdown
  images (`![alt](src)` → `image` block carrying `{alt, src}`) and links — both inline links
  (`[label](href)`) and reference definitions (`[key]: href`) → `citation` blocks carrying
  `{label|key, href}`. Inline links (a link not alone on its line) stay inside their paragraph, and
  `startsBlock` was extended so these lines break a preceding paragraph correctly.
- `ui/src/client/components/renderers/notebook.ts` — `image` renders as a lazy `<img>` and `citation`
  as an external `<a rel="noreferrer">`; both get typed styling.
- Tests (5 new across 2 files; whole UI suite **184 green**; typecheck + biome clean; client build
  succeeds): segmentation cases (image, link, reference definition, inline-link-stays-paragraph) and
  a notebook render case for image + citation.

**Notes for remaining work**
- Block-level streaming (`status: 'streaming'` re-parse as the assistant streams) is the only part of
  1.4 left; it needs partial assistant text to enter `$chatMessages` (currently `$streamingDelta` is
  a preview only), so it is backend-coupled rather than a parser change.
- `citation` is used for any labeled URL; a future `Source`/bibliography model could split formal
  citations from plain links by giving citations a stable key and resolving `[n]` references to them.
- Images keep no intrinsic size/aspect data; a `data: {alt, src, width?, height?}` extension would let
  the notebook reserve layout space and avoid reflow when artifacts render through the view system.

**New improvement opportunities**
- Route `code`/`table` children through the landed view adapters (`s-view` + `ViewSpec`) instead of
  bespoke notebook markup — the plan's "artifacts typed, not markdown spans" goal and the 0.5
  artifact-viewer overlay both become a thin `Segment.data → ViewSpec` adapter.
- Inline rich text is still a single `text` string; a lightweight inline tokenizer (links/emphasis/
  code spans) would let paragraphs render anchors without changing the block model.
- `Segment.data` is `unknown`; give `image`/`citation`/`table`/`code` a discriminated `Artifact`
  union so renderers narrow without casts (currently each does `as {…}`).

### 2026-10-08 (j) — artifact typing via the view system + artifact viewer

**Landed**
- `ui/src/client/core/artifacts.ts` — `tableFromColumns(headers, rows)` builds a `TableDataset`
  (padding missing cells), and `artifactViewSpec(block)` maps a `table` block to a `ViewSpec`
  (`shapes: ['table','text']`) or a `code` block to a `TextDataset` spec titled by language, returning
  `undefined` otherwise. Pure and total, so unsupported blocks never render a wrong shape.
- `ui/src/client/components/renderers/notebook.ts` — table children now render through
  `<s-view budget="embedded" chrome=false>` (the `s-table-mini` embedded adapter: key-value for one
  row, top-N for many) with the bespoke renderer kept as a fallback; code stays bespoke (keeps its
  language styling).
- `ui/src/client/components/overlays/artifact.ts` — `s-artifact` overlay (0.5/4.3): renders the block's
  artifact at full budget through the same `<s-view>` host (shape switcher + fullscreen for free) or an
  `<img>` for image blocks; registered with `hiddenInPalette` (it needs a `Ref`).
- `ui/src/client/components/overlays/block-menu.ts` — `Open artifact` affordance, shown only when the
  block has a typed artifact (table/code) or image data — hidden, not inert.
- `core/index.ts` exports. Tests (13 new across 4 files; whole UI suite green — 32 files; typecheck +
  biome clean; client build succeeds): `artifacts` (pure), `artifact` overlay, block-menu artifact
  affordance, and the notebook table now asserted through `s-view`.

**Notes for remaining work**
- The notebook embeds tables at the `embedded` budget, so long tables show top-N + "+N more" — the
  full table is one `Open artifact` away. If inline full tables are wanted, pass `budget="full"`.
- Code artifacts go through the `text` shape, which drops syntax highlighting; a dedicated `code`
  shape/adapter (`s-code`) is the natural home for highlighting and is also needed by 4.3's artifact
  matrix (chart/diff/json/derivation-record).
- `artifactViewSpec` reads `block.data` with casts; a discriminated `Artifact` union on
  `SemanticBlock`/`Segment` would remove them (see (i)).
- The `s-view` adapter registry is populated by `entry.ts` importing `views/index.js`; the notebook
  relies on the shell having done so. If the notebook is ever used standalone, it must import the view
  barrel (or the shell's `WorkspaceHost` should own that).

**New improvement opportunities**
- A `code` shape + `s-code` adapter would let both the notebook and the artifact viewer render code
  typed (language, line numbers, highlighting) with no bespoke markup.
- `artifactViewSpec` is the seam for 4.3's full artifact matrix: add `chart`(series)/`diff`/`json`
  mappings and the overlay gains them without change.
- The artifact overlay could offer "Copy" and "Open in graph" reusing the block-menu actions, and be
  reachable from the ToC/inspector, making artifacts first-class objects rather than block payloads.

### 2026-10-08 (k) — Phase 1.2 composer modes + capability registry (0.6 partial)

**Landed**
- `ui/src/client/core/capabilities.ts` — the capability registry (§0.3/§3.6, 0.6 partial): `CAPABILITY_IDS`
  and an exhaustive `CAPABILITY_CATALOG` (`{id,label,description,default}`) for
  `language · reasoning · tools · memory · uiControl`; `capabilityDescriptors()`;
  `defaultCapabilities()` (`{language}` — the standalone LM-only product); the `$capabilities`
  composition atom; `capabilityEnabled`/`setCapability`. The module imports only `atom` from `store`,
  so there is no store⇄capabilities cycle and no capability atom on the store test API.
- `ui/src/client/core/composer-modes.ts` — the §8.1 mode catalog as data: `COMPOSER_MODE_IDS` +
  exhaustive `COMPOSER_MODE_CATALOG` (`ask · reply · question · command · explain · demonstrate ·
  transform · believe · goal · tool`), each declaring its `capability`, label, hint, and `structured`
  flag; `composerModes()`, `availableComposerModes(caps)` (hides intents the composition cannot
  honour — no silent no-ops), `DEFAULT_COMPOSER_MODE = 'ask'`, and `decomposeForMode(text, mode)`
  which imposes the question kind in `question` mode, collapses the input to one command in `command`
  mode, and otherwise defers to the deterministic lexical split (§8.2). Structured modes fall back to
  the lexical split until their producer exists.
- `ui/src/client/components/input-hud.ts` — the universal composer is now mode-aware: it watches
  `$capabilities`, renders a `.modes` bar over `availableComposerModes` with `aria-pressed`, resets an
  unavailable mode to the default, uses the active mode's hint as the textarea placeholder, feeds
  `decomposeForMode`, and sends `{ type:'chat.user', content, mode }`. The old slash-hints footer is
  replaced by the mode bar (slash autocomplete is unchanged). A `composer.focus` command and a
  `composer:focus` `UiSignals` event make the composer palette-reachable and renderer-agnostic.
- `ui/src/client/core/events.ts` — `UiSignals` gains `'composer:focus': void`; `core/index.ts` exports
  the capability and composer-mode modules.
- Tests (10 new across 3 files; whole UI suite **204 green / 36 files**; typecheck + biome clean):
  `capabilities` (default composition, exhaustive ids, toggle immutability), `composer-modes`
  (catalog completeness, capability gating, mode-aware decomposition), and `input-hud` mode-bar/
  mode-reshape cases.

**Notes for remaining work**
- The composer is still the **persistent bottom dock**, not the §8.1 *floating overlay* anchored to a
  selected block/node/subgraph. The dock is the right UX for the LM wedge (an always-needed input; a
  focus-trapped modal overlay would fight typing and Tab). The anchored/summoned variant depends on
  graph-native selection (Phase 2.3) and should reuse `composer-modes` + `decomposeForMode` unchanged.
- `believe`/`goal`/`tool` are catalogued and gated but hidden by default (`{language}`), so they never
  render inert. Wiring them is Phase 3.2 (formalize→gate) and the tools transport; when they land,
  `decomposeForMode` gains their structured branches.
- The `mode` field on `chat.user` is currently ignored by the server (`ui/src/server/index.ts` only
  reads `content`). It is carried so a future server/projection can adopt the declared intent; today
  the client-side decomposition is what reflects the mode.
- `input-hud` now calls `eventBus.on('composer:focus', …)` and stores the unsubscribe; if a generic
  `BaseComponent.watchEvent` helper is added later, this and `palette`'s `overlay-open` listener should
  both use it.

**New improvement opportunities**
- ~~Thread the declared `mode` into `projectChat` …~~ **Done — see (l).** The declared intent now shapes
  the projected block kinds.
- Derive a capability-aware **default renderer** from `$capabilities` (§0.3: `language`→Notebook,
  `reasoning`→Graph) instead of the hardcoded `'graph'` default; this is the natural completion of the
  registry and removes the note on 0.3.
- The mode bar and the command palette should share one source (the mode catalog as commands, e.g.
  `composer.mode.<id>`), so a mode switch is an agent-settable `ui.command` for free.
- Gate overlays/commands on capabilities too (e.g. provenance/derivation affordances appear only with
  `reasoning`), now that the registry exists, replacing the per-surface `hidden-not-inert` checks.

### 2026-10-08 (l) — carry the composer mode into the workspace projection

**Landed**
- `core/src/protocol/chat.ts` — `ChatMessage` and `chat.user` gain an optional `mode: string`. It is a
  free string (not a `ComposerMode` enum) so the engine protocol stays UI-agnostic; the client narrows
  it with `isComposerMode`. Additive and backward-compatible (zod objects strip unknowns, and the field
  is optional).
- `ui/src/client/core/composer-modes.ts` — `isComposerMode(value)` guard (exported from `core/index`).
- `ui/src/client/core/store-bindings.ts` — `addUserMessage(content, mode?)` stores the declared mode on
  the optimistic user turn.
- `ui/src/client/core/workspace-projection.ts` — `projectChat` decomposes user turns with
  `decomposeForMode(content, isComposerMode(message.mode) ? message.mode : DEFAULT_COMPOSER_MODE)`, so a
  `question`/`command` mode changes the projected block kinds (the intent is now visible in the
  WorkspaceGraph, not just the composer preview). `decomposeInput` is no longer imported there.
- `ui/src/client/components/input-hud.ts` — passes `this.mode` to `addUserMessage`.
- Tests (3 new; **207 green / 36 files**; root + UI typecheck and biome clean): `composer-modes`
  (`isComposerMode` narrowing), `workspace-projection` (mode reshapes user-turn children; unknown carried
  mode falls back to the lexical split).

**Notes for remaining work**
- The `mode` now round-trips on the wire but the server still ignores it (`ui/src/server/index.ts` reads
  only `content`); nothing needs to change until an engine-side producer wants the intent.
- The capability-gated structured modes (`believe`/`goal`) project as their lexical fallback today; when
  3.2 lands, `projectChat` can special-case them alongside `decomposeForMode`.

**New improvement opportunities**
- The client could avoid re-parsing on every projection by memoising `decomposeForMode` per
  `(content, mode)`; only worth it once profiling shows segmentation in a hot path.
- Surface the active mode on the projected turn block (e.g. a `data`/`title` hint) so the Graph/Notebook
  can badge a turn with its declared intent without re-reading the message.

### 2026-10-08 (m) — complete 1.6 contextual actions (follow-up + capability-gated formalize)

**Landed**
- `core/src/protocol/chat.ts` — `ChatMessage`/`chat.user` gain an optional `context: string` (the block a
  turn follows up on). Free string, client-owned; additive like `mode`.
- `ui/src/client/core/events.ts` — `composer:focus` now carries `{ ref?: string; mode?: string }`, so a
  surface can focus the universal composer with a context block and/or a declared mode.
- `ui/src/client/components/overlays/block-menu.ts` — adds **Ask follow-up** (always; `composer:focus`
  with the block ref) and, gated on `$capabilities` (`reasoning`), **Formalize as belief** / **Formalize
  as goal** (`composer:focus` with the block ref + `believe`/`goal` mode). The menu watches
  `$capabilities` so the gated actions appear/disappear live; they are absent (not inert) when off.
- `ui/src/client/components/input-hud.ts` — listens for the richer `composer:focus`, sets the context
  ref/declared mode (guarding the mode against `availableComposerModes`), renders a dismissible
  "↳ Ask about <label>" context chip, and sends `context` on `chat.user` (cleared after send).
  `addUserMessage(content, mode?, context?)` stores it.
- `ui/src/client/core/workspace-projection.ts` — `projectChat` adds a `references` link from a turn to
  its `context` block when that block exists in the fragment (unknown targets are dropped), so a follow-up
  shows up as a real semantic edge in the WorkspaceGraph/Graph.
- Tests (5 new; **211 green / 36 files**; root + UI typecheck and biome clean): block-menu follow-up
  event, capability-gated formalize (hidden→shown on `reasoning`), formalize-as-belief mode; projection
  follow-up reference (and unknown-target drop).

**Notes for remaining work**
- The context reference is validated inside `projectChat`'s own fragment, so a follow-up on an engine
  `claim:` block (Phase 3) is not linked yet; `projectWorkspace` can reconcile cross-fragment references
  when the reasoning producer lands.
- "Open related"/semantic-neighborhood navigation remains for 2.4 (it wants graph ownership of neighbors).
- `composer:focus`'s `mode` is a free string on the signal (narrowed by `availableComposerModes`); if more
  signals start carrying modes, a shared `ComposerFocus` type is worth extracting.

**New improvement opportunities**
- The composer could echo the context block as a quoted excerpt in the sent content (a real "reply")
  rather than only linking it; gate on user preference to avoid polluting the transcript.
- A `composer.prefill` signal (text + ref + mode) would let ToC/graph actions seed a draft, reusing the
  context chip rather than a bespoke path.
- The block menu's capability gate is inline (`$capabilities.get().has('reasoning')`); once a few menus
  gate, extract a `capabilityGate`/`CapabilityHost` mixin so overlays declare required capabilities in
  their descriptors and the host filters/palette-hides them uniformly (the 0.6 follow-through).

### 2026-10-08 (n) — 2.1 graph projection (workspace blocks into Graph mode)

**Landed**
- `ui/src/client/core/graph-projection.ts` — the pure `projectWorkspaceGraph(graph)` → `{ nodes, edges }`:
  each block becomes a labelled node (`nodeType:'workspace'`, `term`=label so tooltip/search/lens apply),
  each link with both endpoints present becomes a typed edge (dangling links dropped), and
  `section`/`heading` blocks with `children` become compound `parent`s. `labelFor` falls back to the
  first text line then the kind label. Exported from `core/index`.
- `ui/src/client/components/graph-viewport.ts` — watches `$workspaceGraph` (`watchWith`, 2-arg form) and
  diffs the projection into Cytoscape under the `workspace` class (`syncWorkspaceLayer`), updating
  existing nodes by id and removing stale ones; the concept-graph node/edge diff and `applyGraphFilter`
  now exclude `.workspace` so the legacy bridge is untouched. Added `node.workspace`/`edge.workspace`
  styles and strip the generic inline styles the lens pass applies to workspace nodes.
- Tests (4 new; **215 green / 36 files**; root + UI typecheck and biome clean):
  `graph-projection` — block→labelled node + link→typed edge, first-line/kind-label fallback, section
  compound parent, dangling-link drop.

**Notes for remaining work**
- The workspace layer is fully replaced-by-diff on each sync (small N); streaming will re-project each
  message. **Incremental animated growth** is not done — new nodes appear at the next layout.
- Chat `contains` links (turn → child) are projected as edges, but chat turn blocks do not set
  `children`, so chat has no compound sections yet; only engine/notebook sections cluster.
- Clicking a workspace node previously ran the concept-graph `tap` handler (`focus.set` on `term`); now
  it routes to `setWorkspaceFocus` (see (o)), so the workspace-node click path is block-native. The
  detail drawer still reads `$graphNodes`, so a selected workspace node has no drawer content yet.
- `syncWorkspaceLayer` strips lens inline styles each sync so the class style wins; once workspace nodes
  adopt lens/capability styling this can be unified in the adapter.

**New improvement opportunities**
- Animate the diff (fade/spring new nodes, `layout` a sub-community) rather than reappearing at layout.
- Derive compound clusters from `contains` links generally (not just explicit `children`), so chat turns
  cluster once the projection sets `children` (or infers from `contains`).
- Give the graph a "conversation vs concepts" source toggle now that both layers coexist, so a user can
  isolate the thread or the semantic web (palette command + HUD affordance).
- Reuse `projectWorkspaceGraph` in `graph3d` and in the embedded-view graph shape so all three graph
  surfaces project the one substrate identically.

### 2026-10-08 (o) — 2.3 graph-native selection

**Landed**
- `ui/src/client/components/graph-viewport.ts` — the node tap/dblclick/cxttap handlers now branch on
  `node.hasClass('workspace')`:
  - tap → select + `setWorkspaceFocus(id)` (no engine `focus.set`);
  - dblclick → focus the block and open the Explanation overlay (`overlay:open` `explain`);
  - cxttap → focus the block and open the block menu (`overlay:open` `block-menu`, anchored to the
    viewport) instead of the concept-graph context menu.
  Concept nodes keep the existing `focus.set`/context-menu behavior, so the legacy bridge is unchanged.
- Imports `setWorkspaceFocus`; no new module, reuses 1.6's overlay/`composer:focus` path.
- Verified by root + UI typecheck, biome, and the full unit suite (**215 green / 36 files**). No new unit
  test: the decision lives in Cytoscape event handlers, which the jsdom suite does not exercise (the
  viewport has no unit harness) — worth a small extracted `nodeTapAction(node)` pure helper if this grows.

**Notes for remaining work**
- 2.3 is now half done: selection is block-native; the composer is still the persistent dock (not
  anchored to the node/selection), selected nodes are not yet turned into prompt context, and there are
  no node-creating (question/claim) ops from the graph.
- The detail drawer reads `$graphNodes` by id, so tapping a workspace node selects it but shows no
  drawer content; either project workspace node data into the drawer or hide the drawer for workspace
  selections.
- The `anchor` passed to `overlay:open` is the viewport element, so outside-click dismissal recognises
  any click inside the graph as "inside the anchor"; passing the Cytoscape container would be tighter.

**New improvement opportunities**
- Extract `nodeTapAction(node)` / `nodeGesture(node)` pure helpers in `core` and unit-test the
  workspace-vs-concept routing without a live Cytoscape instance.
- Feed the selected workspace node(s) into the composer as prompt context (reuse `composer:focus`
  `ref`, or a new `composer:focus` `refs` array) so "graph-native input" composes from a selection.
- Add context-menu entries that create blocks (question/claim) via `WorkspaceOp`s, so graph selection can
  author as well as navigate — the input half of 2.3.

### 2026-10-08 (p) — 2.3 selection becomes prompt context (multi-ref)

**Landed**
- `core/src/protocol/chat.ts` — `ChatMessage`/`chat.user` `context?: string` becomes `contexts?: string[]`
  (a turn can be prompted from several blocks). Still an optional, client-owned free-string array.
- `ui/src/client/core/events.ts` — `composer:focus` payload is `{ refs?: string[]; mode?: string }`.
- `ui/src/client/core/store-bindings.ts` — `addUserMessage(content, mode?, contexts?)`.
- `ui/src/client/core/workspace-projection.ts` — `projectChat` emits one `references` edge per
  `message.contexts` target present in the fragment (unknown targets dropped).
- `ui/src/client/components/input-hud.ts` — `contextRefs: string[]`; the composer renders a chip per ref
  (individually dismissible) and sends `contexts`; `onComposerFocus` replaces the ref list from the signal.
- `ui/src/client/components/overlays/block-menu.ts` — follow-up/formalize emit `{ refs: [this.ref], … }`.
- `ui/src/client/components/renderers/graph.ts` — `openComposer(anchor?)` now emits `composer:focus`
  instead of calling the never-registered `composer` overlay (a latent no-op now fixed); refs are the
  anchor or the workspace subset of `$selectedNodeIds`. New `graph.ask-selection` command exposes the same
  from the palette/agent.
- Tests updated for the array payload (block-menu, workspace-projection); full suite **215 green / 36
  files**; root + UI typecheck and biome clean.

**Notes for remaining work**
- The composer remains the persistent dock; "anchored" here means *context*, not geometry. A floating
  composer positioned at the node/edge still needs a summoned (not persistent) composer and cy→DOM
  coordinate handoff.
- `graph.ask-selection` reads the *live* `$selectedNodeIds`; concept-node ids are filtered out by the
  `$workspaceGraph.blocks` check, so mixed selections contribute only their blocks.
- No unit test covers the Graph renderer/command (importing `graph.ts` pulls the Cytoscape viewport);
  the pure parts (`workspaceRefs` guard, the projection) are tested.

**New improvement opportunities**
- Extract `workspaceRefs`/selection→context into `core` and unit-test it; the renderer then just wires it.
- Bind `graph.ask-selection` to a keystroke (e.g. `a` when a graph viewport is focused) so selection→prompt
  is one gesture; the command already exists.
- Echo context blocks as quoted excerpts in the sent content (an actual "reply"), gated by preference.
- Node-creating ops: a graph context-menu "Ask as question"/"Assert as claim" that dispatches a
  `WorkspaceOp` (block.add) and focuses the new block — closes the authoring half of 2.3.

### 2026-10-08 (q) — 1.1 section folding (+ fix the last dangling composer call)

**Landed**
- `ui/src/client/core/store.ts` — `$collapsedBlocks` session atom (`ReadonlySet<ref>`) + `toggleCollapsed(ref)`.
  Session state, like focus/selection, so folds survive a renderer switch; exported from `core/index`.
- `ui/src/client/components/renderers/notebook.ts` — a page with children renders a `▸`/`▾` fold toggle
  (`aria-expanded`, `stopPropagation` so it doesn't focus the block); folded pages hide their children in
  place and get a `data-folded` treatment. Watches `$collapsedBlocks` so folds re-render. Also fixed
  `NotebookRenderer.openComposer`, which still called the never-registered `composer` overlay — it now
  emits `composer:focus { refs }` (the same fix already applied to the Graph renderer).
- Tests (+1; **216 green / 36 files**; UI typecheck and biome clean): notebook folds/unfolds a page,
  toggles `aria-expanded`, and records the fold in `$collapsedBlocks`; suite resets the atom after each.

**Notes for remaining work**
- Folding is per-page (children hidden), not nested-section aware by heading level; fine for chat turns,
  may want level-based folding when engine sections land.
- The fold is UI state on `$collapsedBlocks`, not part of `WorkspaceGraph` (intentionally — it is session
  state like focus); 2.5's "switching preserves context" now covers folds too.
- `NotebookRenderer.openComposer` is untested (the renderer has no direct openComposer test); add one when
  a notebook `composer:focus` path is exercised.

**New improvement opportunities**
- Level-based folding (a heading folds everything until the next heading of equal/higher level) once
  segmentation emits `level` on sections, reusing `$collapsedBlocks`.
- A "fold all / unfold all" palette command over `$collapsedBlocks`, and remembering folds in the URL
  alongside `(page, block, disclosure)`.
- Surface a folded-count badge on collapsed pages ("3 blocks hidden") for scanability.

### 2026-10-08 (r) — 2.4 semantic-neighborhood navigation ("Open related")

**Landed**
- `ui/src/client/core/neighborhood.ts` — pure, deterministic BFS `neighborhood(graph, ref, depth)` over
  `linksTouching`: each `Neighbor` carries its `block`, the `link`, direction (`out` when the link points
  from the origin, else `in`) and hop `depth`; unknown origin returns `undefined`. Exported from
  `core/index`.
- `ui/src/client/components/overlays/related.ts` — `s-related` (overlay `related`): groups neighbors by
  relation + direction, each row focuses that block (`setWorkspaceFocus`) and closes; registered via the
  overlays barrel.
- `ui/src/client/components/overlays/block-menu.ts` — "Open related" action, shown only when
  `neighborhood(...).neighbors` is non-empty (hidden, not inert), emitting `overlay:open { id:'related', ref }`.
- Tests (+4; **220 green / 36 files**; UI typecheck and biome clean): `neighborhood` (unknown origin,
  direction + order, bounded BFS without revisiting) and the block-menu related gate/emit.

**Notes for remaining work**
- Navigation focuses the block; the Notebook reveals it via its existing focus-scroll, but in Graph mode a
  focused workspace node is highlighted only by selection, not auto-centered — 2.3/2.4 could center it.
- The overlay groups by `direction + link.label|kind`; a richer 2.4 inspector could also show link
  confidence and event refs (both already on `SemanticLink`).
- `neighborhood` calls `linksTouching` per frontier node (O(nodes·links)); fine at current sizes, and the
  obvious place to pre-index adjacency if it ever matters.

**New improvement opportunities**
- Node/edge hover popovers in Graph mode reusing `explainModel`/`neighborhood` (the "inspection" half of 2.4).
- "Open related" from the *graph* context menu too (currently only the block menu), and from the ToC.
- Remember the neighborhood depth/preference and let a row open the Explanation instead of navigating (or
  on ⌥-click), so exploration and drill-down share the popover.
- Extract a tiny adjacency index on `WorkspaceGraph` (`linksByBlock`) shared by `linksTouching`,
  `neighborhood` and the graph projection.

### 2026-10-08 (s) — URL-address the active renderer + focus (1.5 / 0.4)

**Landed**
- `ui/src/client/core/store.ts` — `UrlState` gains `renderer?: string`; `parseHash`/`serializeHash`
  round-trip it; `hydrateFromUrl` applies `renderer` (`$activeRenderer`) and `focus`
  (`setWorkspaceFocus`). Two module-level subscriptions mirror live state into `$urlState`:
  `$activeRenderer` → `renderer` and `$workspaceGraph` → `focus` (guarded, so no redundant writes), and
  the existing debounced `syncUrl` writes the hash. So switching renderer or focusing a block updates the
  URL, and a shared link restores it on load — `hydrateFromUrl` is already called from `entry.ts` and
  `spacegraph/main.ts`.
- Tests (+2; **222 green / 36 files**; UI typecheck and biome clean): `url-state` hydrates
  renderer+focus from the hash and mirrors renderer+focus changes into `$urlState`.

**Notes for remaining work**
- Still deferred from 1.5: `page` and `disclosure` in the URL (`(page, block, disclosure)`); `renderer` +
  `focus` cover the highest-value navigation and the mechanism (add a field → parse/serialize → mirror)
  is now a repeatable three-line pattern.
- `UrlState.renderer` is not validated against the renderer registry; an unknown id would set
  `$activeRenderer` to something the shell can't mount (it falls back to no renderer). Validate in
  `hydrateFromUrl` once the registry is importable without a store cycle.
- The mirror subscriptions run on every workspace update (guarded equality check + a Set allocation only
  when the focus actually changes), so the steady-state cost is one comparison per projection.
- `urlState.panels` sync is one-way (hydrate only); panel toggles are not reflected back into the hash.

**New improvement opportunities**
- Add `page`/`disclosure` (and the `$collapsedBlocks` fold set) to `UrlState` using the same pattern, so
  a link restores the exact reading position including folds.
- Reflect panel open/close into `$urlState.panels` (currently hydrate-only) for symmetry, and validate
  `renderer` against `workspaceRenderers()`.
- Replace the two ad-hoc mirror subscriptions with a tiny `mirrorAtom(atom, pick)` helper to keep the
  URL slice declarative as more fields join.
- ~~A route/hash change listener (`hashchange` → `hydrateFromUrl`) so back/forward and pasted hashes
  re-hydrate without a reload.~~ **Done — see (t).**

### 2026-10-08 (t) — URL disclosure (fold set) + hashchange (1.5)

**Landed**
- `ui/src/client/core/store.ts` — `UrlState` gains `folded?: string[]` (the disclosure/fold set);
  `parseHash`/`serializeHash` round-trip it (comma list); `hydrateFromUrl` applies it to
  `$collapsedBlocks`; a guarded `$collapsedBlocks` subscription mirrors live folds into `$urlState`
  (via a small `sameStringSet` check so it only writes on a real change). A module-level
  `window.addEventListener('hashchange', hydrateFromUrl)` re-hydrates on back/forward or a pasted hash
  (`replaceState` writes do not fire `hashchange`, so there is no loop).
- Tests (+2; **224 green / 39 files**; UI typecheck and biome clean): `url-state` hydrates + mirrors the
  fold set, and re-hydrates on `hashchange`.

**Notes for remaining work**
- Only `page` remains from `(page, block, disclosure)`: a "page" is a root/heading block, so it wants the
  section model (roots + heading levels); `focus` already covers "which block".
- `renderer` is still unvalidated against the registry (store cannot import `workspace-renderer` without a
  cycle); an unknown id leaves `$activeRenderer` pointing at an unmountable renderer.
- `urlState.panels` remains hydrate-only (not mirrored back) — the one field that may surprise.

**New improvement opportunities**
- Add `page` once roots/heading levels are first-class, reusing the same parse/serialize/mirror pattern.
- Replace the three ad-hoc mirror subscriptions with a `mirrorAtom(atom, pick, equals?)` helper as the URL
  slice grows.
- Reflect `$panels` open/close into `$urlState.panels`, and validate `renderer` in `hydrateFromUrl` via a
  registered-id allowlist exported from the registry (breaking the cycle with a plain array).
- Debounce write-once for `folded` when many folds toggle in one gesture (e.g. fold-all).

### 2026-10-08 (u) — `ui.command` contract + dispatcher stub (0.6)

**Landed**
- `core/src/protocol/ui-command.ts` — `UiCommandMsg = msg('ui.command', { command, args? })`; exported
  from the protocol barrel and added to the `IncomingFromServer` discriminated union (the engine can
  drive the UI).
- `ui/src/client/core/commands.ts` — `dispatchCommand(id)` runs a command by id from the one registry
  (explicit + derived), respecting `available()`; returns whether it ran. Exported from `core/index`.
- `ui/src/client/core/store-bindings.ts` — `applyServerMessage` gains a `ui.command` case that calls
  `dispatchCommand` (warns on unknown). So any palette renderer/overlay/focus command is agent-settable
  with no second registry.
- Tests (+3; **227 green / 40 files**; root + UI typecheck and biome clean): `dispatch` runs a registered
  command, returns false for unknown, and refuses an unavailable command.

**Notes for remaining work**
- `args` is parsed and reserved but ignored; per-command parameter schemas (and validation) are Phase 5.
- The server does not emit `ui.command` yet; the client path is ready for it. `ui.command` is
  server→client only (not in `IncomingFromClient`).
- `dispatchCommand` re-derives `activeCommands()` per call (walks registries); fine for occasional agent
  directives, not a hot path.

**New improvement opportunities**
- Give commands an optional `run(args)` + `params` schema, so `ui.command` can carry validated arguments
  (e.g. `overlay.open` with a ref, `composer.focus` with a mode/refs).
- Have the engine emit `ui.command` for narrations ("open the explanation", "switch to Graph") so
  demonstrations drive the UI and no longer need client-side special cases.
- Record executed `ui.command`s in the timeline/telemetry for a provenance trail of UI actions.
- An `available()`-aware palette badge and a `ui.command` round-trip test through `applyServerMessage`
  (a synthetic `IncomingFromServer` frame) to lock the wire contract.

### 2026-10-08 (v) — `ui.command` args + per-command validation (0.6)

**Landed**
- `ui/src/client/core/commands.ts` — `CommandArgs = Record<string, unknown>`; `Command.run(args?)` and an
  optional `Command.parse(args)` validator (`throw` rejects). `dispatchCommand(id, args?)` finds the
  active command, runs `parse` when present, and reports `false` (with a warn) if parse throws instead of
  propagating. The derived `overlay.<id>` command forwards `args.ref` into `overlay:open`, so an agent can
  open (e.g.) Explanation on a block.
- `ui/src/client/components/input-hud.ts` — the `composer.focus` command forwards `args.refs`/`args.mode`
  into `composer:focus`, so an agent can summon the composer with a context/mode.
- `ui/src/client/core/store-bindings.ts` — the `ui.command` case passes `msg.args ?? {}`.
- Tests (+2; **229 green / 40 files**; UI typecheck and biome clean): args flow through `parse` to `run`,
  and a throwing `parse` yields `false` without running.

**Notes for remaining work**
- Validation is a hand-rolled `parse` (no schema lib in the UI); a command needing structure writes its own
  guard. If several commands grow params, adopt a tiny shared validator (or reuse zod already in core).
- `overlay.*` forwards only `ref`; `explain`/`related` use it, but other overlays ignore args silently.
- `ui.command` args are not yet type-checked against `UiCommandMsg.args` (`z.record(z.string(), z.unknown())`
  is the wire shape); they align by construction.

**New improvement opportunities**
- Give each parameterised command a small `params` descriptor so the palette can prompt for missing args and
  `parse` is generated rather than hand-written.
- Round-trip test the wire: build a synthetic `ui.command` frame, run `applyServerMessage`, and assert the
  command fired — locks the client/server contract without the socket.
- Emit the executed `ui.command` id into the timeline/telemetry for an agent-action provenance trail.
- Let `overlay.*` forward all args to `overlay:open` (currently just `ref`) once overlays declare what they read.

### 2026-10-08 (w) — Graph conversation/concepts layer toggle (2.1)

**Landed**
- `ui/src/client/core/graph-layer.ts` — `GRAPH_LAYERS` (`both · conversation · concepts`), `GraphLayer`,
  and the pure `layerVisible(isWorkspace, layer)` predicate, so layer visibility is one testable rule.
- `ui/src/client/core/store.ts` — `$graphLayer` atom + `setGraphLayer` (session state); exported from
  `core/index`. (Restored `setWorkspaceSelection`, accidentally dropped while inserting the atom.)
- `ui/src/client/components/graph-viewport.ts` — `applyGraphFilter` now composes the layer with the
  capability/contradiction filter: workspace nodes/edges hide under `concepts`, concept nodes/edges hide
  under `conversation`, `both` is unchanged; edges respect the layer too. Watches `$graphLayer`.
- `ui/src/client/components/renderers/graph.ts` — `graph.layer.both` / `.conversation` / `.concepts`
  commands (palette + agent via `ui.command`).
- Tests (+4; **233 green / 41 files**; UI typecheck and biome clean): `graph-layer` truth table + default.

**Notes for remaining work**
- The layer is Graph-mode-only; the Notebook always shows the conversation (fine — it *is* the conversation).
- `$graphLayer` is not URL-addressable yet (could join `UrlState` like `renderer`/`folded`).
- Under `conversation`, concept edges that were never laid out may still influence the layout engine's
  bounding box; hiding is post-layout (`display: none`), not removal.

**New improvement opportunities**
- ~~Add `$graphLayer` to `UrlState` (three-line pattern) so a shared link restores the isolated layer.~~
  **Done — see (x).**
- A small HUD/segmented control next to the renderer switch for the layer, instead of palette-only.
- When a layer is hidden, skip laying it out / exclude from `fit` so `conversation`-only frames tightly.
- Remember the layer per lens (the lens already picks a layout), so switching lenses can imply a layer.

### 2026-10-08 (x) — URL-address the graph layer (2.1 / 1.5)

**Landed**
- `ui/src/client/core/store.ts` — `UrlState` gains `layer?: GraphLayer`; `parseHash` validates it against
  `GRAPH_LAYERS`, `serializeHash` emits it (omitting the default `both`), `hydrateFromUrl` applies it to
  `$graphLayer`, and a guarded subscription mirrors live layer changes into `$urlState`. Follows the same
  three-line pattern as `renderer`/`folded`.
- Tests (+1; **234 green / 41 files**; UI typecheck and biome clean): `url-state` hydrates `layer` from the
  hash and mirrors `setGraphLayer`.

**Notes for remaining work**
- `$graphLayer` now round-trips in the URL; a HUD segmented control for the layer is still pending
  (palette-only today).
- The `renderer` field remains unvalidated (unlike `layer`), since the renderer registry lives in a module
  the store would cycle through; the asymmetry is intentional for now.

**New improvement opportunities**
- A `mirrorAtom(atom, pick, equals?)` helper would collapse the four near-identical mirror subscriptions
  (`renderer`, `focus`, `folded`, `layer`) into declarations.
- Validate `renderer` the same way as `layer` once a cycle-free registry id list is available.
- A HUD layer control (segmented `both · conversation · concepts`) beside the renderer switch.

### 2026-10-08 (y) — Phase 2.2 conversation layouts

**Landed**
- `ui/src/client/core/conversation-layout.ts` — `ConversationLayoutId` + `CONVERSATION_LAYOUT_IDS`
  (tuple) + exhaustive `CONVERSATION_LAYOUT_CATALOG` (label/description) and the pure
  `conversationPositions(graph, layout)` returning a `Map<Ref, Point>` for every block. All four are
  pure functions of the WorkspaceGraph, so they are testable without Cytoscape and reproducible for
  captures. `blocksInOrder` = `blockOrder` plus any detached block, so no node is left unplaced.
  - `chronological-flow` — document order, serpentine columns of `FLOW_ROWS`.
  - `semantic-map` — union-find over `same-topic` links; linked blocks are one group, the rest group by
    `kind`; groups become lanes in a `ceil(sqrt)` grid (`+1` row gap so clusters never touch).
  - `artifact-map` — artifact kinds (table/code/math/chart/image/diagram/citation/tool-result/
    derivation/embedded-view) centred in a grid, the rest on a ring.
  - `source-view` — one lane per `createdBy` in `user · lm · reasoner · tool · system` order.
- `ui/src/client/utils/layout-registry.ts` — `LayoutDefinition.scope?: LayoutScope` (`concept` default /
  `conversation`), `layoutsFor(scope)`, and four registered rows that run the pure positions through a
  `preset` layout (`positions: (node) => positions.get(node.id()) ?? node.position()`, `fit`, no
  animation). Imports `$workspaceGraph`, the catalog, the ids and `conversationPositions` from core.
- `ui/src/client/components/graph-toolbar.ts` — the layout `<select>` now derives its options from
  `layoutRegistry` (grouped `Concept` / `Conversation`) instead of a hardcoded list, so a new registry
  row appears with no edit here.
- `ui/src/client/components/renderers/graph.ts` — `graph.layout.<id>` commands for the four conversation
  layouts (palette + `ui.command`), gated to Graph mode.
- `core/index.ts` exports. Tests (7 new; **241 green / 42 files**; UI typecheck and biome clean):
  `conversation-layout` — every layout positions every block deterministically, flow order, same-topic
  clustering, artifact centring, source lanes, and the registry rows/scopes.

**Notes for remaining work**
- Layout selection still flows through the lens-keyed `$lensLayout` (the `graph:layout` event stores it
  per lens), so a conversation layout is remembered as *the* layout for that lens. A scope-aware slot
  would keep concept and conversation selection independent and makes the choice URL-addressable.
- Positions are computed against `$workspaceGraph` at layout time; `syncWorkspaceLayer` runs before the
  relayout in `syncGraph`, so the workspace nodes exist. Concept nodes have no entry and keep their
  current position (the `node.position()` fallback).
- Cytoscape `preset` does not animate by design (positions are exact) — incremental animated growth
  (§2.1) is still separate.
- `semantic-map` groups by kind when there are no `same-topic` links (LM enrichment is not built yet);
  the union-find path is already exercised and only expects the links to be produced.

**New improvement opportunities**
- Add a HUD segmented control / palette group for layouts (they now carry a `scope`) and a
  `graph.layout.cycle` command.
- Make the active layout scope-aware state (see above) and URL-address it (`UrlState.layout`), so a
  shared link restores both mode and arrangement.
- Register `chronological-flow` / `source-view` as SpaceGraph surfaces once a 3D storyboard adapter
  exists (`surface: null` today), reusing the same pure positions.
- A timeline overlay (4.4) can filter the same projection by `createdAt`; `chronological-flow` already
  uses document order, so an event-time variant is a small addition.
- Reuse `conversationPositions` for embedded graph views (§7) so their arrangement matches the main
  Graph renderer.

### 2026-10-08 (z) — Phase 2.5 shared focus/selection + parity specs

**Landed**
- `ui/src/client/components/renderers/notebook.ts` and `renderers/graph.ts` — both adapters drop their
  private `#focus`/`#selection` and route `focus`/`select` through `setWorkspaceFocus`/
  `setWorkspaceSelection`; `snapshot()` reads the one `$workspaceGraph` session state and `restore()`
  writes it back, so a renderer switch is a true `snapshot()` → `restore()` round-trip. The Graph
  adapter additionally mirrors selection into `$selectedNodeIds`/`$selectedNodeId` (so graph
  multi-select styling and the node-detail drawer follow a restored selection).
- `ui/src/client/components/graph-viewport.ts` — every selection change now writes the shared set via
  `setWorkspaceSelection`: workspace/concept node tap, background deselect, and shift multi-select
  (`toggleMultiSelect`). Notebook and Graph therefore share focus *and* selection.
- `ui/tests/components/renderer-parity.test.ts` — the parity spec: the registry admits `notebook`,
  `graph` and a declared-partial `graph3d`; every full renderer keeps the shared state; every full
  renderer snapshots/restores focus+selection; a Notebook↔Graph switch preserves both (and syncs
  `$selectedNodeIds`).
- Tests (4 new; **245 green / 43 files**; UI typecheck and biome clean).

**Notes for remaining work**
- The shell (`app-layout`) still mounts the active renderer by hardcoded tag (`<s-notebook>` vs
  `<graph-viewport>`); it does not exercise the registry `mount`/`snapshot`/`restore` contract. A
  `WorkspaceHost` that owns the registry-driven mount/switch is the remaining structural step, and it
  is what makes `snapshot`/`restore` load-bearing rather than merely tested.
- `graph3d` keeps local focus/selection (honest for a stub); it joins the shared state when Phase 6
  gives it a real viewport.
- Graph focus is shared but the viewport does not yet react to `$workspaceGraph.focus` changes by
  centering/highlighting (noted in 2.1/2.4) — the Notebook scrolls to focus, the Graph does not.
- Selection is mirrored in two atoms (`$workspaceGraph.selection` and `$selectedNodeIds`); a future
  consolidation would make `$selectedNodeIds` derived from the workspace selection.

**New improvement opportunities**
- Build the `WorkspaceHost` element (repeated opportunity) so `app-layout` renders one host and the
  registry owns mount/dispose/snapshot/restore; it also makes `WorkspaceContext.openOverlay` real for
  every renderer and removes the per-renderer tag hardcoding.
- Script the canonical loop (§10) once and run it per full renderer, turning the parity matrix into an
  executable suite rather than a table plus per-renderer assertions.
- Make the Graph renderer react to shared focus (center + highlight the focused workspace node),
  closing the last focus asymmetry between the two renderers.
- Make the §10 capability matrix data (`rendererParity(interaction)`) so the palette and shell can gate
  actions on `rendererSupports` uniformly instead of the graph-only `available()` checks.

### 2026-10-08 (aa) — settings/provider dialog overlay (0.5 / panel migration)

**Landed**
- `ui/src/client/components/overlays/settings.ts` — `s-settings`, a modal, palette-visible overlay
  (`registerOverlay` `modal: true`) that hosts the existing config form (`<config-hud>`), so provider
  and region settings live in one focus-trapped dialog instead of a standing panel. The form's own
  close affordance (`s-close`) routes through the overlay host (`overlay:close { id:'settings' }`).
  Added to the overlays barrel, so the derived `overlay.settings` palette command appears with no edit.
- Tests (2 new; **247 green / 44 files**; UI typecheck and biome clean): `settings` — the descriptor is
  modal + palette-visible with the `s-settings` tag, and the overlay hosts `config-hud` and closes on
  `s-close`.

**Notes for remaining work**
- Additive: the legacy config panel (`app-layout` right panel + toolbar Config button) is untouched
  because e2e specs (`scenarios/configuration/adjust-parameters`) drive it; demoting it to the overlay
  is the remaining 0.4 step and should migrate those specs in the same change.
- The overlay reuses `config-hud` wholesale, so its header (title + Profiles) is the dialog's header;
  a follow-up could generalise `config-hud` with an `embedded` mode if the frame should own the title.
- Provider switching is not yet a first-class overlay action; the dialog surfaces whatever `llm.*` fields
  the config registry declares.
- 0.5 still needs the tool-approval dialog, timeline overlay (4.4) and pinning (4.5).

**New improvement opportunities**
- Migrate `config-hud`/`config-profiles` out of the panel into the settings overlay, update the
  configuration e2e specs to open the palette command, then default the config panel off entirely
  (finishing the panel-migration row).
- Generalise `config-hud` with an `embedded` mode (no duplicate header) so overlays can own the frame,
  and split "Provider" from "Configuration" into two palette entries once `LmProvider` (§3.4) lands.
- Add a HUD `⚙` affordance next to `⌘K` that opens `overlay.settings`, so the dialog is discoverable
  without the palette (and independent of the graph toolbar, which is hidden in Notebook mode).

### 2026-10-08 (ab) — HUD graph-layer control (2.1)

**Landed**
- `ui/src/client/components/workspace-hud.ts` — a `Both · Thread · Concepts` segmented control
  (`data-layer`, `aria-pressed`) beside the renderer switch, shown only when the active renderer is
  `graph` (the layer is Graph-only). Bound to `$graphLayer`/`setGraphLayer`, so it is the same state the
  palette `graph.layer.*` commands and the URL `layer` use — no second source. Labels via a
  `LAYER_LABELS` map over `GRAPH_LAYERS`.
- Tests (+1; **248 green / 44 files**; UI typecheck and biome clean): `workspace-hud` — the layer control
  lists `both · conversation · concepts`, switching sets `$graphLayer` and `aria-pressed`, and it
  disappears in Notebook mode.

**Notes for remaining work**
- The control duplicates the palette commands intentionally (glanceable chrome + agent-settable command);
  both read `$graphLayer`, so there is no divergence.
- Hiding a layer is still post-layout `display:none`; it is not yet skipped in layout/`fit` (the (w) note).

**New improvement opportunities**
- Generalise the `active === 'graph'` check to a renderer capability flag so any renderer that consumes
  layers gets the control, and derive the renderer/layer controls together from the registries.
- Skip laying out / exclude from `fit` the hidden layer so a `conversation`-only frame is tight.

### 2026-10-08 (ac) — URL-address the active graph layout (2.2 / 1.5)

**Landed**
- `ui/src/client/core/store.ts` — `UrlState.layout?: string`; `parseHash`/`serializeHash` round-trip it;
  `hydrateFromUrl` writes it into `$lensLayout` for the active lens; and a `mirrorLayout` subscription on
  `$lensLayout` **and** `$activeLens` mirrors the active lens's layout into `$urlState`, emitting the
  field only when it differs from that lens's default (`LENS_DEFAULT_LAYOUTS`), so the common case stays
  out of the URL. Switching a concept/conversation layout from the toolbar or the `graph.layout.*`
  commands now updates the hash, and a shared link restores it.
- Tests (+1; **249 green / 44 files**; UI typecheck and biome clean): `url-state` hydrates
  `layout=breadthfirst` into `$lensLayout.belief` and the URL slice, and clears the field when the active
  layout returns to its default.

**Notes for remaining work**
- The field is per active lens; switching lens recomputes it (goal's `concentric` default drops the
  field), so it URL-addresses "the layout of the current view", not all lenses at once. Mirroring every
  lens would need a compound field.
- `layout` is not validated against `layoutRegistry` ids (the store cannot import `utils/layout-registry`
  without a cycle); like `renderer`, an unknown id lands in `$lensLayout` and the graph falls back to no
  layout. A cycle-free id allowlist would fix both.
- `$activeLens` changes still do not mirror `urlState.lens` (pre-existing gap); the layout mirror watches
  the lens only to re-evaluate the layout field.

**New improvement opportunities**
- Validate `renderer` and `layout` in `hydrateFromUrl` against plain id allowlists exported from the
  registries (arrays, no cycle), removing the last unvalidated URL fields.
- Add a `mirrorAtom(atom, pick, equals?)` helper to collapse the now near-identical mirror subscriptions
  (`renderer`, `focus`, `folded`, `layer`, `layout`, plus `lens` once added).
- Mirror `$activeLens` into `urlState.lens` so the `lens` param also tracks UI changes.

### 2026-10-08 (ad) — artifact matrix: chart/series + structured JSON (4.3)

**Landed**
- `ui/src/client/core/artifacts.ts` — `artifactViewSpec` also maps a `chart` block carrying a
  `SeriesDataset` to a `series` spec (`shapes: ['series','table','text']`, rendered by the landed
  series/table projections) and maps a payload without a bespoke view — `chart` without a series, plus
  `derivation · gate-decision · budget · config-change · tool-call · tool-result` — to a structured JSON
  `text` spec. A small `specOf` builder and `JSON_KINDS` set keep the branches declarative; `table`/`code`
  are unchanged. The block menu's "Open artifact" gate reads `artifactViewSpec` and the artifact overlay
  renders through `<s-view>`, so both extend for free. No producer emits these kinds yet (Phase 3), so this
  lands the viewer contract ahead of the producer.
- Tests (+3; **252 green / 44 files**; UI typecheck and biome clean): `artifacts` — chart→series with the
  table/text alternatives, the JSON fallback for a reasoning payload, and chart-without-series /
  derivation-without-data.

**Notes for remaining work**
- `diff` and `derivation-record` are still not bespoke: a diff wants a two-column projection (or a `diff`
  shape) and a `DerivationRecord` wants `s-tree` (premises→conclusion) rather than JSON.
- The JSON fallback is `text`, so it is readable but not navigable; a `tree` mapping for `derivation` would
  make provenance browsable without a new shape.
- The artifact overlay has no "Copy"/"Open in graph" affordances yet (also noted in (j)).

**New improvement opportunities**
- Map `derivation`/`gate-decision` to `tree` (`s-tree`) once the `DerivationRecord` payload shape lands in
  Phase 3.3, so provenance is a first-class tree in the viewer and the notebook preview.
- Add a `diff` representation (two-column table projection or a `diff` shape) for `config-change` and
  artifact comparisons.
- Let the artifact overlay offer "Copy" and "Open in graph" by reusing the block-menu actions.

### 2026-10-08 (ae) — WorkspaceHost: registry-driven renderer mount/switch (0.4 / 2.5)

**Landed**
- `ui/src/client/components/workspace-host.ts` — `workspace-host` renders one `.stage` and mounts the
  active renderer through the registry: on an `$activeRenderer` change it `snapshot()`s the current
  renderer, `dispose()`s it, `mount()`s the next and `restore()`s the snapshot; it also supplies the
  `WorkspaceContext` (`openOverlay`/`openPalette`) so renderers never import shell chrome. An unknown id
  falls back to the first registered renderer.
- `ui/src/client/components/renderers/graph-surface.ts` — `graph-surface` owns Graph's internal
  table/2D/3D variants (`$graphShape`/`$viewportMode`), so the renderer's `mount` creates one
  `<graph-surface>` instead of the shell branching on tags. It references `spacegraph-viewport`/`s-view`
  by tag (registered by the shell/view barrel) rather than importing the 3D stack, keeping the Graph
  renderer importable in unit tests.
- `renderers/graph.ts` mounts `<graph-surface>`; `renderers/graph3d.ts` now mounts a real
  `<spacegraph-viewport>` and removes it on dispose (it was a silent no-op — clicking Graph3D showed the
  2D graph). `app-layout` now renders `<workspace-host>`; its per-renderer tag branch,
  `$graphShape`/`$viewportMode` watches and `GRAPH_VIEW_SPEC` import are gone.
- Tests (4 new; **256 green / 45 files**; UI typecheck + biome clean; **client build succeeds**):
  `workspace-host` uses a fake registry renderer to assert registry mount, snapshot/dispose/remount on a
  mode switch (with `s-notebook` mounted for the real Notebook), the shell context, and dispose on
  unmount.

**Notes for remaining work**
- Shared focus/selection already live in the store, so `snapshot()`/`restore()` around a switch is now
  load-bearing only for renderer-local viewport/camera state; the host still round-trips it as the
  contract requires.
- `spacegraph-viewport` remains registered by `app-layout`; if the workspace host is used without the
  shell, the 3D branch and graph3d need that import. A surface/registrar seam would decouple it.
- `app-layout` still owns the legacy panels (config/chat/telemetry/node-detail/lens-designer/timeline);
  demoting them is the remaining 0.4 work.
- No `app-layout` unit test exists; the host is tested directly, but the shell wiring is covered only by
  typecheck/build (and e2e, not run here).

**New improvement opportunities**
- Move the `spacegraph`/`s-view` imports behind a small surface registry so the host mounts renderers
  without the shell pre-importing their variant stacks.
- Drive the toolbar (currently shown for graph/graph3d via `active !== 'notebook'`) from renderer
  capabilities instead.
- Script the canonical loop (§10) per renderer using the host's switch path to make 2.5 an executable
  parity suite.
- Retire `$viewportMode`/`$graphShape` as shell-level shared atoms once `graph-surface` owns them
  exclusively.



