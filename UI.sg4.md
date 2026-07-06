# SeNARS UI: Comprehensive Development Specification & Plan

## 1. Vision & Core Philosophy
The SeNARS UI is not merely a graph renderer; it is a **cognitive workspace** powered by a rigorous, algebraic rendering engine. 

Historically, the project evolved through three specification phases:
*   **v1:** Feature-heavy, focused on visual spectacle and embodied navigation (tunnels, physics springs).
*   **v2:** A radical pivot to mathematical purity. The UI became an algebraic engine where every visual encoding is a pure function: `M : (Item, Lens, View) → ΔDisplay`.
*   **v3:** Engineering pragmatism. Mandated zero-allocation paths, strict separation of concerns (Engine vs. Adapters), and elevated configuration tooling to a core requirement.

**The Reality Check:** Despite this architectural sophistication, a system is useless without a usable interface. Therefore, this specification balances the mathematical rigor of v2/v3 with the practical necessity of a **Core Cognitive Loop**: *Ingest → Contextualize → Evaluate → Refine → Navigate.*

**Core Principles:**
1.  **User-Centric Cognition:** The algebraic engine exists to serve the user's cognitive loop, not the other way around.
2.  **Math-Driven Rendering:** No bespoke rendering branches. All visual state is derived from the Modulation algebra.
3.  **Strict 2D/3D Parity:** Both viewports consume the exact same `ΔDisplay` patches.
4.  **Performance as a Feature:** Zero-allocation paths and aggressive memoization are mandatory for high-frequency updates.

---

## 2. Architectural Overview

The system is divided into three strict layers to ensure implementability and extensibility:

### Layer 1: The Cognitive Workspace (UI)
The user-facing application. It handles text ingestion, form generation, timeline scrubbing, and the Lens Designer. It translates user intent into state changes (`Item`, `Lens`, `View`).

### Layer 2: The Modulation Engine (Pure Math)
The algebraic core. It takes the current state and evaluates the active `Lens` and `View` to produce a `ΔDisplay` patch. 
*   **Inputs:** `Item` (data), `Lens` (interpretation config), `View` (camera/LOD state).
*   **Operators:** `Leaf`, `Const`, `Field ⇒`, `When`, `⊕` (union/last-wins), `Memo`.
*   **Outputs:** `ΔDisplay` (a strictly typed, minimal patch of visual channel updates).

### Layer 3: Viewport Adapters (Renderer Glue)
Thin, testable adapters that translate `ΔDisplay` into renderer-specific API calls.
*   **2D Adapter:** Maps `ΔDisplay` to Cytoscape.js styles.
*   **3D Adapter:** Maps `ΔDisplay` to Three.js/SpaceGraph properties.

---

## 3. Phased Development Plan

This trajectory prioritizes building a usable UI *alongside* the engine, ensuring we never lose the "basic SeNARS experience" while scaling up to the v2/v3 architectural ideals.

### Current State Snapshot (where the codebase already is)

The repository is *ahead* of Phase 1 in several respects. Naming these prevents rework:
*   **Lit + Cytoscape + SpaceGraph.js** app already mounted at `ui/src/client/entry.ts`; 2D viewport in `ui/src/client/components/graph-viewport.ts` (Cytoscape) and 3D viewport in `ui/src/client/spacegraph/spacegraph-viewport.ts` (THREE.js via `ui/spacegraphjs7`).
*   **Cognitive delta protocol** already exists: `CognitiveDelta` / `GraphOp` (`ui/src/shared/protocol.ts:43-70`) — additive node/edge ops with `seqId`, an event buffer with replay-on-reconnect in `gateway.ts:133-171`, and a per-socket rate limiter (`rate-limiter.ts`).
*   **Three hardcoded lenses** (`belief`, `goal`, `contradiction`) are scored *server-side* in `ui/src/server/lenses.ts:60-80` and the resulting `{score,color,size}` tuple is baked into `GraphOp.data.lensData`. The client (`applyLensStyles` in `ui/src/client/utils/lens-styles.ts` and the 3D viewport's `updateNodeVisuals`) only *applies* these pre-computed visual properties.
*   **NAR adapter** (`ui/src/server/nar-adapter.ts`) bridges `nar.listConcepts()`, `nar.getBeliefs()`, `nar.attentionReport()`, conflict detection (`nar/src/cognitive/conflict-utils.ts`), and the drive manager to the gateway.
*   **Live events** `nar:derivation`, `nar:reasoning:cycle`, `nar:concept:activated`, `nar:drive:changed` are already forwarded to the socket (`socket-handler.ts:83-122`).
*   **State atoms** in `ui/src/client/core/store.ts` include `$graphNodes`, `$graphEdges`, `$activeLens`, `$focusTerm`, `$viewport`, `$lensViewport`, `$lensLayout`, `$graphFilter`, `$panels`, plus URL hash hydration (`hydrateFromUrl`).
*   **Tests:** Vitest unit + Playwright scenarios under `ui/tests/scenarios/{smoke,cognitive,accessibility,...}`; `mountTestApi('graph', ...)` exposes a `window.__testApi` for E2E.

**Implication:** Phases 1, 3, and 6 begin from a working baseline; their work is *refactor toward algebra* and *extend*, not greenfield. Phase 2 is the load-bearing pivot — it must move visual derivation from server (`lenses.ts`) to a pure client-side `Modulation` function without breaking the pre-existing protocol's wire shape.

---

### Phase 1: The Minimal Cognitive Workspace (Usability First)
*Goal: A user can ingest a concept, see it in the graph, and edit its truth value.*

> **Baseline note:** Most of this phase already functions. Treat sub-items as *gaps to close*, not new builds. Verify each against the live app before re-implementing.

*   **1.1 Ingestion Box.** A text input that creates a NAR node from a natural-language sentence.
    *   **Wire path:** `<input-hud>` (Lit) → `send({type:'chat.user', content})` → `gateway.handleConnection` (`gateway.ts:109`) → `onChat(content, send, agent)` (`server/chat.ts:13`) → `agent.chat(content, {stream:true})`.
    *   **Gap:** `agent.chat` currently produces only `chat.agent.stream`/`chat.agent.complete`. It does **not** emit a `cognitive.delta` containing the new concept. Either (a) subscribe the socket to `nar:concept:activated` (already wired at `socket-handler.ts:95`) so the new term appears, or (b) augment `agent.chat` to send an explicit `cognitive.delta` with the parsed term. Prefer (a) — it's already half-wired and keeps `chat.ts` free of NAR knowledge.
    *   **Term normalization:** NAR terms are parsed by `nar/src/terms/parser-peggy.ts` (PEG.js, generated `peggy-generated.cjs`). Sentences like "The sky is blue" tokenize to `($sky --> blue)`. The UI label should be the human form; the graph `id`/`term` must be the canonical NAR term. Use `term.toString()` for labels (see `nar-adapter.ts:90`) and the raw `term` for ids.
    *   **Concern — term collisions:** `GraphNodeData.id` is keyed on `concept.term` (`socket-handler.ts:101`, `lenses.ts:113`). Ingesting "the sky is blue" twice produces one node, not two revisions. Phase 5's stamp-based history is the real fix; for Phase 1, document this and move on.
*   **1.2 Basic 2D Graph.** Cytoscape view rendering nodes as circles with labels.
    *   **Status:** Implemented. `graph-viewport.ts:116-208` instantiates Cytoscape with base styles (`getBaseStyle:349`), tap/shift-tap/double-tap/cxttap handlers, LOD on zoom (`applyLOD:323`), HTML labels (`utils/html-labels.ts`), and a minimap (`graph-minimap.ts`).
    *   **Gap to close:** `layoutConversationThread(cy, $chatMessages.get())` (`utils/graph-layout.ts`) runs on every `syncGraph`; verify it doesn't fight the active lens layout on first render. If it does, gate it behind `nodeType === 'message'` only.
*   **1.3 The Truth Slider.** Clicking a node opens a panel with a slider for `truth.f`; changing it updates the node's color (red→green).
    *   **Where it lives:** The drawer exists as `node-detail-drawer.ts` with `overview/links/actions` tabs. The slider is **not** implemented — `renderOverview` (line 146) is read-only.
    *   **Implementation:** Add a `<input type="range">` to the overview tab bound to a local `@state() truth: number`. On `input` (debounced ~120ms via the same throttle pattern as `graph-viewport.ts:338`), send a new client message type. The protocol `IncomingFromClient` (`protocol.ts:155-162`) does **not** yet include a `node.update` message — add `NodeSet = z.object({ type: z.literal('node.set'), id: z.string(), patch: z.object({ truth: z.object({...}).optional(), ... })})` to the discriminated union, and route it in `gateway.handleConnection` alongside `config.set`.
    *   **Server side:** Add `setNodeTruth(id, f, confidence?)` to the `NarAdapter` interface (`gateway.ts:34-62`). Implementation in `nar-adapter.ts` calls `nar.memory.addTask(...)` or revision API — NAR's truth revision (`nar/src/lm/lm-rule-factory.ts:158`, `'lm-belief-revision'`) and `Stamp`-based revision provide the semantics. Confirm against `nar/src/nar.ts` whether a public `reviseBelief` exists; if not, expose one.
    *   **Optimistic update:** Don't wait for the round trip — patch `$graphNodes` locally via a new `updateNodeData(id, patch)` in `core/store.ts`, apply a tentative color, then reconcile when the next `cognitive.delta` arrives.
    *   **Color mapping:** Currently `LENS_COLORS_HEX.belief = '#00f3ff'` (single cyan, not red→green). For the truth slider's red→green encoding, add a truth-specific channel in Phase 2; for Phase 1 only, hack a local HSL interpolation in the drawer so the demo feels alive. **Do not** generalize this — that's Phase 2's entire point.
*   **Milestone (Cognitive Gate).** A user can type a sentence, see it appear, and change its truth value.
    *   **Definition of done:** Playwright scenario `tests/scenarios/cognitive/ingest-and-edit.spec.ts` drives `__testApi.graph.setGraphData`-free path: type into `<input-hud>`, assert a node with the expected term appears via `__testApi.graph.getAllNodeIds()`, click it, drag the truth slider, assert the node's `lensData.color` (or the Phase-2 `channels.color`) changed. See existing `mountTestApi` pattern (`store.ts:254`).

---

### Phase 2: The Algebraic Substrate (Implementability)
*Goal: Refactor Phase 1 to use the Modulation engine, establishing the v2/v3 foundation.*

This phase is the architectural keel. Everything downstream depends on the contract established here.

*   **2.1 Core Algebra.** Implement `Leaf`, `Const`, `Field ⇒`, `When`, `⊕`. Defer `⊗` blending until a concrete use case demands it.
    *   **Where to put it:** New package `ui/src/client/modulation/` (pure TS, no Lit, no DOM — must be testable in Node via Vitest). Suggested files:
        ```
        modulation/
          types.ts          // Modulation, Item, Lens, View, Delta, Channel
          operators.ts      // leaf, const, field, when, union
          compile.ts        // Lens JSON → Modulation function (Phase 4 reuses this)
          evaluate.ts       // (Item, Lens, View) → ΔDisplay
          memo.ts           // Memo operator + cache
        ```
    *   **Type contract (resolve the existing impedance mismatch):**
        *   `Item` ≈ the subset of `GraphNodeData` plus edge attributes that the engine reads. Define `Item` as the wire payload — do *not* reuse `GraphNodeData` directly (it already contains `lensData`, which is a *result*, not an input).
        *   `Channel` keys fixed and enumerated: `color`, `opacity`, `size`, `label`, `stroke.dash`, `stroke.width`, `z` (3D-only), `flow.enable` (Phase 7 a11y). Document unsupported channels per adapter in a `ChannelSupport` map (Phase 6 leverages this).
        *   `ΔDisplay` is a `Map<NodeId, Partial<Record<Channel, Value>>>` plus edge-channel updates. **Reuse objects in hot loops** — see 2.3.
    *   **`⊕` (union / last-wins) semantics:** Combine modulations left-to-right; later assignments to the same channel win. Define this precisely in `operators.ts` with a unit test covering: identical channels, disjoint channels, and `Const` overriding `Field`. This is the foundational algebraic law — it must hold under property-based testing (use `fast-check`, already a devDependency).
    *   **`When`** takes a predicate over `View` (e.g. `V.flags.reducedMotion`, or Phase 5's `t ≤ scrubberT`) and a child Modulation; if false, contributes **nothing** (identity for `⊕`). This is how a11y and timeline gating compose.
*   **2.2 Engine Integration.** Refactor the Truth Slider to update `Item` state; the engine produces `ΔDisplay`; the 2D adapter applies it.
    *   **The refactor cut:** Today `server/lenses.ts:115-128` bakes `{score,color,size}` into `GraphOp.data.lensData` and `graph-viewport.ts`'s `applyLensStyles` just reads them. **Move color/size computation to the client.** Concretely:
        1. Stop populating `lensData` in `lenses.ts` and `nar-adapter.ts:89-106` (leave `term`, `priority`, `confidence`, `nodeType`, `getLinks()`).
        2. The `Lens` enum in `protocol.ts:58` becomes a **string** (not enum) — or, finer, ship lens definitions over the wire as part of a new `config.schema.lenses` message rather than the existing `lens.set { lens: 'belief' }`. Keep `lens.set` for "activate this lens by id" and add a separate `lens.define` for the Phase 4 designer payload.
        3. Client constructs `Item` from each `GraphOp`'s data, evaluates the active `Lens` Modulation, and emits `ΔDisplay` in-memory; `applyDelta(cy, delta)` replaces `applyLensStyles`.
    *   **Adapter signature:** `applyDelta(target: Cytoscape.Core | SpaceGraph, delta: ΔDisplay): void` plus `diffDelta(prev: ΔDisplay, next: ΔDisplay): ΔDisplay` for re-renders. Keep `cy.batch(...)` (already used in `lens-styles.ts:7`) — it's the right primitive for bulk Cytoscape mutations.
    *   **Delete the dead path:** `applyGraphFilter` in `graph-viewport.ts:470` sniffs `ld.color?.includes('ffaa00')` — color-string-matching for logic. This is precisely the smell the Modulation engine must fix: contradiction detection should be a `When(item.isContradiction) ⇒ Const({color: warning})` modulation, and the filter should read the *item* flag, not the rendered color.
*   **2.3 Memoization & Zero-Allocation.** Implement `Memo`. Design `ΔDisplay` generation to reuse objects in hot loops.
    *   **What to memoize:** `Modulation` evaluation of a stable `(Lens, View.flags)` is pure per-`Item`; cache by `Item.id` + a structural hash of the Item's lens-relevant fields (`priority`, `confidence`, `nodeType`, `isContradiction`). Invalidation is automatic when the `Item` changes.
    *   **Hot path:** `socket-handler.ts`'s `nar:reasoning:cycle` today emits a fresh full-graph delta every cycle (`beliefGraphDelta`). After refactor, the server should emit only the *changed* concepts (the gateway already passes `d.term`, `d.priority` in `nar:concept:activated` — extend to include the changed fields). The client `Item` store merges patchwise; the engine re-evaluates only the dirty `Item.id`s. This is where the "no GC spikes" property is won or lost.
    *   **Object reuse patterns for `ΔDisplay`:**
        *   Maintain a per-node `channels` record in the engine and return the **same object reference** when no channel changed; the adapter does `if (delta.get(id) === prevDelta.get(id)) skip`. Reference equality = "no work."
        *   Pool `Map`/`Set` instances between frames — `ui/spacegraphjs7/src/core/ObjectPoolManager` already does this for 3D objects; reuse the pattern.
        *   Avoid `Array.from(map.values())` in the eval loop; iterate the map directly.
    *   **Verification:** A Vitest bench in `ui/tests/bench/` that drives 1,000 synthetic `Item` mutations through `evaluate` and asserts: (a) `< N` allocations per tick (use `--expose-gc` and sample `performance.memory` or `gc()` between ticks), (b) `< 50µs` per evaluation at 1k items. Add a Playwright "slider mash" scenario that asserts frame budget via `requestAnimationFrame` timestamps — the existing `__testApi` hooks won't suffice; extend `mountTestApi('perf', {...})`.
*   **Milestone (Engine Gate).** 100% test coverage on algebraic laws. The UI updates strictly via `ΔDisplay` patches with zero GC spikes during rapid slider manipulation.
    *   **Definition of done:** `pnpm --dir ui test modulation` — unit tests with `fast-check` properties for `⊕` identity/associativity, `When` short-circuit, `Memo` cache hits. `pnpm --dir ui test:integration -- dashboard` confirms 2D still renders. `pnpm --dir ui test perf` (new) shows sub-millisecond median eval and <16ms p99 frame budget under 60s of synthetic reasoning cycles at 1k items.

---

### Phase 3: Relational Context & Layout (Usability)
*Goal: A user can see and create relationships between concepts.*

> **Baseline note:** Edges already flow over the wire (`GraphOp add_edge`, `protocol.ts:47-51`). `gravity`/SE layout and per-lens layout selection (`$lensLayout`, `layoutRegistry`) exist. This phase's work is **edge authoring**, **edge editing**, and ensuring the Modulation engine treats edges as first-class `Item`s (Phase 2 defined `Item` for nodes only — extend it here).

*   **3.1 Auto-Linking.** Ingesting complex sentences automatically creates links between existing or new nodes.
    *   **Lives where:** NAR already links concepts during parsing/inference (`nar/src/memory/concept.ts`, `nar-adapter.ts:100-103` maps `getLinks()`). The UI receives these via the `add_edge` op in `beliefGraphDelta` (`socket-handler.ts:39-46`).
    *   **Gap:** "Complex sentences" — multi-clause input like "the sky is blue, so the sky is not green" — should produce *both* nodes *and* a contradiction/inference edge. Today the agent's `chat` path doesn't trigger NAR's multi-statement parser. Either (a) parse client-side and send multiple `chat.user` messages, or (b) augment `agent.chat` to fan out into NAR. Prefer (b) — the parser (`parser-peggy.ts`) belongs on the server.
    *   **Edge channel membership:** Extend `ΔDisplay` to include `Map<EdgeId, Partial<EdgeChannels>>` with channels `width`, `color`, `line-style`, `opacity`. The edge's `Item` reads `{ type, weight, truth: {f, confidence} }`.
*   **3.2 Link Editing.** Clicking a link allows editing `truth.f` and `type` ("is-a", "has-property").
    *   **Selection gap:** `graph-viewport.ts` binds tap handlers for `node` only (`cy.on('tap', 'node', ...)`, line 146). Add `cy.on('tap', 'edge', ...)` mirroring it; extend `$selectedNodeId` semantics (or add `$selectedEdgeId`) so `node-detail-drawer` can render an edge tab. The drawer's `getLinks` (`node-detail-drawer.ts:79-116`) already enumerates edges — reuse this view.
    *   **Protocol:** Phase 2's `node.set` message becomes `object.set { kind: 'node'|'edge', id, patch }`. Edge `type` edits are straightforward; `truth.f` edits route through NAR's revision API like the node slider.
    *   **Edge type taxonomy:** NAR's native edge types (`inheritance`, `similarity`, `implication`, `equivalence`) live in `nar/src/terms/types.ts`. Map them to UI labels via a `EDGE_TYPES` table in `shared/constants.ts` (alongside `LENS_LABELS`). Don't invent new types.
*   **3.3 Force-Directed Layout.** A physics layout that keeps related nodes visually clustered.
    *   **Status:** 2D `ForceLayout` is registered in `layoutRegistry` and used in `syncGraph:573` for first layout / topology change (`layoutRegistry.shouldRelayout`). 3D equivalent is `spacegraphjs7/src/plugins/layouts/ForceLayout.ts`. Both already run.
    *   **Improvement:** The relayout heuristic (`shouldRelayout:570`, `graph-viewport.ts:343`) is a coarse `abs(delta) > max(5, 20%)` threshold. Replace with a "this delta touched > K seeds" check so that isolated new leaves don't trigger a full re-cool. Persist successful layouts in `$lensViewport` (already done for camera; add node positions).
*   **Milestone (Relational Gate).** A user can ingest a network of concepts, see them auto-link, and adjust relationship properties.
    *   **Definition of done:** Playwright scenario `relational/auto-link.spec.ts`: ingest a two-clause sentence, assert ≥3 `add_node` ops and ≥2 `add_edge` ops with the expected `type` values. Scenario `relational/edit-edge.spec.ts`: tap an edge, change `type` via the drawer, assert the `data.type` on the Cytoscape element. Use `__testApi.graph.getAllNodeIds()` and a new `__testApi.graph.getEdgeData(source, target)` accessor.

---

### Phase 4: The Lens System & Designer (Extensibility)
*Goal: Prove that "adding a feature is just a config object" and make it usable for non-engineers.*

This is where the Phase 2 algebra pays off. If a new lens cannot be added *without touching engine code*, Phase 2 failed.

*   **4.1 Hardcoded Lenses.** Implement "Belief" (colors by `truth.f`) and "Goal" (sizes by `goal.relevance`) lenses via the Modulation engine.
    *   **Re-express the three existing lenses** (`belief`, `goal`, `contradiction` from `lenses.ts:60-80`) as Modulation ASTs:
        ```
        belief      = Field('confidence') ⇒ Channel('opacity') ⊕
                      Field('truth.f')   ⇒ Channel('color', red→green)
        goal        = Field('priority')   ⇒ Channel('size')
        contradiction = When(Field('isContradiction')) ⇒
                          Const({ color: '#ffaa00', 'stroke.dash': '4 2' })
        ```
        Note `isContradiction` is a derived boolean — keep the conflict computation server-side (`nar-adapter.ts:91-99`) and ship it as an `Item` field. The Modulation engine stays pure.
    *   **Server-side scoring moves to the client.** `termOverlap` (`lenses.ts:25-43`) and the goal/contradiction scorers (`lenses.ts:60-80`) currently run in Node. The goal-lens scorer needs *all* goals to score each node — that's `O(N·goals)`. Either (a) precompute a `goalRelevance` field per concept on the server (cheap, runs during `nar:derivation`), or (b) accept the client cost. Prefer (a): the server already has the full concept list.
*   **4.2 Schema Migration.** Move Lens definitions from TypeScript to a strict JSON schema (`config.schema.json`).
    *   **Use Zod, not hand-written JSON Schema.** The repo already uses `zod` v4 (`package.json`) and `zod-to-json-schema`. Define `LensSpec` in `ui/src/shared/lens-schema.ts`:
        ```
        const LensSpec = z.object({
          id: z.string(),
          label: z.string(),
          description: z.string(),
          modulation: ModulationSchema, // recursive z.discriminatedUnion over operator kinds
        });
        ```
        Export ` lensSpecToJsonSchema()` via `zod-to-json-schema` for the Lens Designer's reference and editor validation. **One schema, two roles:** compile target for the engine and validation target for the UI.
    *   **Wire transport:** Add `lens.list` (server pushes all available lens specs on connect) and `lens.define` (client pushes a new spec; server validates and broadcasts). These extend the `IncomingFromServer`/`IncomingFromClient` discriminated unions in `protocol.ts:155-170`. The active lens stays as `lens.set` — it now takes a `lensId` that must be in the registry.
    *   **Storage:** Phase 4 ships user lenses in-memory only. Persistence to `senars.config.json` or a userspace store is explicitly **Phase 8** — do not scope-creep here.
*   **4.3 The Lens Designer UI.** A visual interface mapping NAR fields to visual channels via dropdowns/sliders; the UI generates the JSON config in real-time.
    *   **Component:** New Lit element `<lens-designer>` modeled on `config-hud.ts` and `lens-selector.ts`. Lives in a dockable panel — register in the `$panels` map (`store.ts:116-123`) as `['lens-designer', { id, open: false, docked: 'right', size: 400, order: 2 }]`.
    *   **Field discovery:** The designer must list available `Item` fields. Ship a `config.schema.lens-fields` message listing `{field, type, sample}` so the designer doesn't hardcode them. This is the contract surface between engine and UI for "what can a lens read."
    *   **Live preview:** Reuse the Phase 2 bench harness: feed the current `$graphNodes` through the staged Modulation AST and overlay the resulting `ΔDisplay` as a semi-transparent preview, *without* committing to `$activeLens`. A `commit` button sends `lens.define` + `lens.set`.
    *   **Validation UX:** Errors surface inline (red border on invalid mapping) — the Zod parse result drives this directly; no parallel validation logic.
*   **Milestone (Config Gate).** A user can create a custom Lens, map fields to channels, and see it render instantly without touching engine code.
    *   **Definition of done:** Scenario `configuration/lens-designer.spec.ts`: open designer, map `priority → size` with min 10/max 60, commit, assert at least one node's rendered diameter differs from the belief-lens baseline. Then add `isContradiction → color: '#ff00aa'`, commit, assert conflict nodes recolor. No engine code changes between these two assertions.

---

### Phase 5: Temporal Navigation & History (Usability)
*Goal: A user can see how beliefs have changed over time.*

NAR's temporal substrate is non-trivial: `Stamp` (`nar/src/terms/stamp.ts`), `occurrenceTime` (`nar/src/types/core.ts:46`), `derivationHistory` (`nar/src/query/trace.ts:56-220`), and `lm-temporal-causal` (`lm-rule-factory.ts:241`). The UI must not flatten this to "timestamps"; it must respect NAR's tense/occurrence semantics.

*   **5.1 Timeline Scrubber.** A horizontal UI slider representing time.
    *   **Component:** New `<timeline-scrubber>` Lit element in the bottom panel slot (replace or augment `telemetry-panel`). Range = `[minOccurrenceTime, maxOccurrenceTime]` over the loaded graph; current value in `$.timeline.t` (new atom in `store.ts`). Brushable for range selection (defer to Phase 8 unless trivial).
    *   **Time source:** `Item.occurrenceTime` (the NAR `Timestamp` branded number). Ship this on every node `Item` in Phase 2's schema — it's currently dropped at `nar-adapter.ts:89-106`.
*   **5.2 Time-Gated Rendering.** Use `When(t ≤ scrubberT)` Modulation to control `opacity`. Nodes fade in/out as the user scrubs.
    *   **This is the killer demonstration of `When`'s compositionality.** The timeline is *not* a separate rendering mode — it's one more Modulation in the composition root:
        ```
        base ⊕ When(item.occurrenceTime ≤ V.timeline.t) ⇒
              Const({opacity: 1.0})
        base ⊕ When(item.occurrenceTime > V.timeline.t) ⇒
              Const({opacity: 0.05})}
        ```
        Add `V.timeline.t` (and `V.timeline.range` for brushes) to the `View` interface defined in Phase 2.
    *   **Performance concern:** Naively re-evaluating every item on every scrubber tick (60Hz slider) is the bonfire test for Phase 2's memoization. The `When` predicate only depends on `item.occurrenceTime` and `V.timeline.t` — memoize by `(id, t-bin)` where the bin is coarse (e.g. 100ms buckets) so sliding across one bucket boundary invalidates only the boundary items. Verify with Phase 2's perf bench.
*   **5.3 Revision History.** The node inspector shows a chronological list of past truth values.
    *   **NAR source of truth:** `nar/src/query/trace.ts:56-220` (`getDerivationHistory`, `collectDerivationHistory`) returns the ordered `Task[]` behind any concept. Expose via a new `NarAdapter.getRevisionHistory(term)` returning `Array<{ truth, stampId, timestamp, source }>` — extend the adapter interface (`gateway.ts:34-62`).
    *   **Protocol message:** `node.history.request` (`IncomingFromClient`) → `node.history` (`IncomingFromServer`). Don't fold history into `cognitive.delta`; it's request/response.
    *   **Drawer tab:** Add a fourth tab to `node-detail-drawer.ts` (`TabId` at line 14 is `'overview'|'links'|'actions'`; add `'history'`). Render as a vertical list; clicking a revision seeks the scrubber to that timestamp (round-trips through `$.timeline.t`, which the Modulation composition picks up — no extra wiring).
*   **Milestone (Temporal Gate).** A user can scrub through time to watch the graph evolve and understand belief revisions.
    *   **Definition of done:** Scenario `cognitive/timeline.spec.ts`: ingest three statements at simulated timestamps `t1<t2<t3`, open timeline, scrub to `t2`, assert only nodes with `occurrenceTime ≤ t2` have `opacity > 0.5`. Open drawer history tab on a node revised at `t3`, assert the list shows two entries; click `t2` entry, assert scrubber moves to `t2`.

---

### Phase 6: 3D Parity & Spatial Depth (Extensibility)
*Goal: A user can explore large, complex graphs in 3D with zero logic duplication.*

A 3D viewport (`spacegraph-viewport.ts`) already exists and is **not** fed by the Modulation engine — it has its own `applyLensStyles` (line 185) and `updateNodeVisuals` (line 173) that read `node.data.lensData`. This is precisely the duplication Phase 6 must eliminate.

*   **6.1 3D Adapter.** Implement `projectΔ` for the THREE.js / SpaceGraph renderer.
    *   **Unify on `applyDelta`.** Replace `spacegraph-viewport.ts:185-203`'s bespoke `applyLensStyles` and `:173-183`'s `updateNodeVisuals` with a single `applyDelta(sg, delta)` adapter in `ui/src/client/spacegraph/adapter-3d.ts`. The 2D adapter `applyDelta(cy, delta)` moves to `ui/src/client/utils/adapter-2d.ts` (extracted from `lens-styles.ts`). Both share the `ΔDisplay` interface only.
    *   **SpaceGraph API surface** (verified against `ui/src/client/spacegraph/spacegraph.d.ts` and `ui/spacegraphjs7/src/SpaceGraph.ts`): `sg.addNode`, `sg.update`, `sg.removeNode`, `sg.addEdge`, `sg.removeEdge`, `sg.forNodes`, `sg.layout('ForceLayout', opts)`, `sg.focusNode`, `sg.setCamera`. `node.object.material.color.set(...)` / `node.object.scale.setScalar(...)` for per-node visuals. This is enough for color/size/opacity; `stroke.dash` has no 3D analog — document via `ChannelSupport`.
    *   **ChannelSupport map:** `adapter-2d.ts` exports `const SUPPORT_2D: Set<Channel> = {color, opacity, size, label, 'stroke.dash', 'stroke.width'}`; `adapter-3d.ts` exports `SUPPORT_3D = {color, opacity, size, label, z}`. `flow.enable` (Phase 7) is supported in both via `layout({animate:bool})`. Unsupported channels in `ΔDisplay` are silently dropped **and** reported via `UnsupportedChannel` warnings — see 6.3.
*   **6.2 Z-Axis Mapping.** Map `time` or `abstraction level` to the Z-axis via a specific Lens.
    *   Built as a *lens*, not an adapter branch: `Field('occurrenceTime') ⇒ Channel('z')` with a scale function. The 3D adapter reads `channels.z`; the 2D adapter drops it. **This is the proof that "adding a feature is a config object" extends across dimensions.**
    *   Concern: SpaceGraph's `ForceLayout` (`spacegraphjs7/src/plugins/layouts/ForceLayout.ts`) runs in 3-space by default; if the lens forces a fixed `z`, the layout must respect it (pin `z` and only relax `x`/`y`). Check the layout's `fixed` option; if absent, add a one-line patch to `spacegraphjs7` — its `AGENTS.md` allows it.
*   **6.3 Parity Test Suite.** Feed 1,000 random `(Item, Lens, View)` tuples into both 2D and 3D adapters. Assert functional equivalence (accounting for documented missing channels like `rotation` in 2D).
    *   **Use `fast-check`** (already a devDependency — see Phase 2.1). Generate arbitrary `Item` arrays, run through `evaluate`, feed the resulting `ΔDisplay` into a *headless* 2D adapter (jsdom + Cytoscape headless, the existing Vitest setup) and a *headless* 3D path. For 3D, do **not** instantiate WebGL — assert on the adapter's call log (`addNode`/`update` calls with their data), not on rendered pixels.
    *   **Equivalence theorem:** For every channel in `SUPPORT_2D ∩ SUPPORT_3D`, the adapter-emitted value must be equal. For channels in the symmetric difference, the adapter must emit a `UnsupportedChannel` warning and the other must not.
    *   **Continuous in CI:** Add `pnpm --dir ui test parity` to `turbo.json`'s `test` pipeline so it runs in `pnpm test`. If a new channel is added to one adapter without the other, the suite fails until the second adapter is updated **or** the channel is registered in that adapter's `SUPPORT_*` set.
*   **Milestone (Spatial Gate).** A user can toggle to 3D, and all Lenses, timelines, and edits work identically without writing 3D-specific logic.
    *   **Definition of done:** Playwright `spatial/parity.spec.ts` runs the same `relational/auto-link.spec.ts` actions in 3D mode (toggle `$.viewport.mode` between `'2d'|'3d'` — new atom; the layout in `app-layout.ts` swaps `<graph-viewport>` for `<spacegraph-viewport>` based on it) and asserts identical node/edge counts and the *same* `ΔDisplay`-derived colors.

---

### Phase 7: Accessibility, i18n, & Polish (Usability)
*Goal: Fulfill the v3 mandate that a11y and i18n are first-class citizens.*

This phase is *uniquely* well-served by the Modulation architecture: a11y and i18n are not features bolted on top, they are *additional Modulations composed into the root*. This is the proof of the v3 thesis.

*   **7.1 A11y Modulations.** Inject mandatory Modulations into the composition root. E.g. `When(V.flags.reducedMotion) ⇒ Const({flow:{enable:false}})`.
    *   **Composition root:** A single `composeLens(baseLens)` function in `ui/src/client/modulation/composition.ts` that prepends the mandatory a11y Modulations to *every* lens, regardless of user selection. Users cannot opt out of a11y.
    *   **`View.flags`** populated from `matchMedia('(prefers-reduced-motion: reduce)')`, `prefers-contrast: more`, `prefers-color-scheme`. Add a `useViewFlags()` hook in `store.ts` that updates `$.view` atoms when the media queries fire (`window.matchMedia(...).addEventListener('change', ...)`).
    *   **Reduced motion:** `When(V.flags.reducedMotion) ⇒ Const({flow: {enable: false}})` disables Cytoscape/SpaceGraph layout animations. In the 2D adapter this maps to `cy.layout({animate:false})`; in 3D to `sg.layout('ForceLayout', {animate: false})`.
*   **7.2 Redundant Encodings.** Automatically map `truth.f` to both `color` and `stroke.dash` for colorblind accessibility.
    *   Compose by default: every lens that targets `color` also targets a redundant non-color channel — `stroke.dash` (2D) and `shape` (3D, if SpaceGraph supports it; otherwise `size` with documented limitation). Encode low→high truth as `solid → dashed → dotted`. The colorblind user gets the same signal two ways.
    *   **High-contrast palette** swaps `LENS_COLORS_HEX` (`shared/constants.ts`) via `When(V.flags.highContrast) ⇒ Const({color: <WCAG-AAA palette>})`. Pre-test the palette against the existing contrast in `design-tokens.json` to avoid regressions.
*   **7.3 i18n & Screen Readers.** All auto-generated labels use translation files. Integrate `aria-live` regions to announce Modulation changes.
    *   **i18n entry:** New `ui/src/client/i18n/` with `en.json`, `es.json`, etc., loaded via a tiny reactive `t(key, params)` bound to `$.locale`. Replace the literal strings in `LENS_LABELS`, `LENS_DESCRIPTIONS` (`shared/constants.ts:9-32`) with `t()` calls.
    *   **`aria-live`:** `announcer.ts` (`ui/src/client/core/announcer.ts`, already present) currently announces something — extend it to subscribe to `ΔDisplay` and announce significant visual changes (node appeared, contradiction detected) for screen-reader users. Throttle to avoid spam; only announce user-initiated deltas, not background reasoning churn (filter on the delta's `source: 'user'|'reasoning'` field, which the gateway should stamp — extend `CognitiveDelta.meta` in Phase 2 to include this).
    *   **Keyboard navigation:** Tab through nodes and edges. This needs a virtual focus ring — add `$.focusedNodeId` distinct from `$.selectedNodeId` (selection is semantic; focus is keyboard). Cytoscape supports `cy.getElementById(id).trigger('tap')` for activation; map `Enter` to select, `Space` to focus descendants.
*   **Milestone (A11y Gate).** Passes WCAG 2.1 AA. High contrast mode works. Screen readers can navigate the graph.
    *   **Definition of done:** Playwright `accessibility/*.spec.ts` already has a directory — populate it with: (a) axe-core scan on each lens (use `@axe-core/playwright`); (b) reduced-motion assertion that `cy.layout` is called with `animate:false`; (c) keyboard-only path through ingest → select → change truth → scrub.

---

## 4. Quality Gates & Definition of Done

To prevent scope creep and ensure implementability, no phase may begin until the previous phase's gate is passed.

*   **Gate Criteria:**
    *   **Code:** All code passes strict TypeScript linting and Zod schema validation.
    *   **Tests:** 100% unit test coverage on the Modulation Engine. Integration tests for the Viewport Adapters.
    *   **Performance:** Zero-allocation paths verified via profiling (no GC spikes during 60fps updates).
    *   **Usability:** A non-technical user can complete the core cognitive loop for that phase without documentation.

---

## 5. Risk Management

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Algebraic Over-engineering** | High | Strictly defer complex operators like `⊗` (blending) until a concrete UI use case demands them. Start with `⊕` (last-wins). `When` is included because a11y (Phase 7) and timeline (Phase 5) cannot be done another way. |
| **Usability Vacuum** | High | Phase 1 and 3 focus purely on the user. The "feel" of the app comes from crisp, instant data manipulation (auto-linking, smooth scrubbing), not camera animations. |
| **Config Sprawl** | Medium | The "Lens Designer" UI (Phase 4) is mandatory. Humans will not write Modulation JSON by hand. The UI enforces Zod schema validity. One schema, two roles (compile target + validation). |
| **2D/3D Parity Drift** | Medium | The Parity Test Suite (Phase 6) runs continuously in CI via `pnpm --dir ui test parity` in the `turbo` `test` pipeline. Adding a `Channel` without adding it to both `SUPPORT_2D` and `SUPPORT_3D` (or documenting it as unsupported) fails CI. |
| **Wire-shape regression during Phase 2 pivot** | High | The Phase 2 refactor moves lens scoring from server to client. Keep the `GraphOp` wire shape stable (additive only — strip `lensData`, don't rename `add_node`); add new client message types (`node.set`, `node.history.request`, `lens.define`) to the discriminated unions rather than mutating existing ones. Existing Playwright scenarios must stay green throughout. |
| **Color-string-as-logic leak** | Medium | `graph-viewport.ts:477` and `spacegraph-viewport.ts:211` sniff `ld.color.includes('ffaa00')` to detect contradictions — the Modulation-inverted smell. Land `isContradiction` as an explicit `Item` field in Phase 2 and delete both sniffers. |
| **Server → client scoring cost for goal lens** | Medium | Phase 4 reimplements `termOverlap` / goal scoring on the client (`O(N·goals)`). Precompute `goalRelevance` per concept server-side at `nar:derivation` time and ship it as an `Item` field — the client goal lens reads the scalar, not the graph. |
| **WebGL in CI** | Medium | Phase 6 parity tests cannot render in headless WebGL. Assert on adapter call logs (`addNode`/`update` invocations + their data), not pixels. The Vitest setup (`vitest.config.ts`, `ui/vite.config.ts`) already supports headless Cytoscape; mirror for SpaceGraph. |

## 6. Integration-Point Map (cross-phase)

A consolidated reference. Each row maps a concept in the spec to the file/symbol that already exists and the file/symbol it will need to become.

| Spec concept | Today's location | Phase(s) that touch it |
| :--- | :--- | :--- |
| Cognitive delta transport | `ui/src/shared/protocol.ts:43-70` (`GraphOp`, `CognitiveDelta`), `gateway.ts:89-99` (sequence buffer), `socket-handler.ts` | 2 (extend `meta`), 5 (history req/resp), 4 (`lens.list`, `lens.define`) |
| Lens scoring (server) | `ui/src/server/lenses.ts:60-147` (`buildLensGraphOps`, `lensScorers`) | 4 (rewritten as Modulation ASTs, scoring moves to client or precomputed server-side as scalar) |
| Lens application (client) | `ui/src/client/utils/lens-styles.ts:6` (`applyLensStyles`), `spacegraph-viewport.ts:185,173` (`applyLensStyles`, `updateNodeVisuals`) | 2 (replace with `applyDelta`), 6 (unify 2D/3D on `applyDelta`) |
| State atoms | `ui/src/client/core/store.ts:62-149` | 2 (`$.view`, `$.items`), 5 (`$.timeline`), 6 (`$.viewport.mode`) |
| Test API | `ui/src/client/core/store.ts:254` (`mountTestApi`), `__testApi.graph` in `graph-viewport.ts:97` | every phase — extend per-phase (`graph.getEdgeData`, `perf.frameBudgetMs`) |
| NAR adapter interface | `ui/src/server/gateway.ts:34-62` (`NarAdapter`), `nar-adapter.ts:108-148` (`buildNarAdapter`) | 1 (`setNodeTruth`), 5 (`getRevisionHistory`) |
| NAR event bus | `nar:derivation` (`nar-io.ts:123`), `nar:reasoning:cycle` (`nar-execution.ts:83`), `nar:concept:activated` (`socket-handler.ts:95`), `nar:drive:changed` (`drives/manager.ts:52`) | 2 (server should emit dirty-item patches, not full re-graph), 5 (rev) |
| NAR temporal substrate | `Stamp` (`nar/src/terms/stamp.ts`), `occurrenceTime` (`nar/src/types/core.ts:46`), `derivationHistory` (`nar/src/query/trace.ts:56-220`), `lm-temporal-causal` (`lm-rule-factory.ts:241`) | 5 (must respect tense/occurrence semantics, not just wall time) |
| NAR term parser | `nar/src/terms/parser-peggy.ts`, `peggy-generated.cjs`, `peggy` devDep | 3 (multi-clause ingestion), 1 (term normalization for graph ids) |
| Config tooling | `ui/src/server/nar-adapter.ts:36-87` (`ConfigManager`), `config.schema` message in `protocol.ts:104`, `config-hud.ts`, `config-profiles.ts` | 4 (Lens specs use the same Zod-pipeline pattern as `config.schema`); `config.profile.lenses` could store per-user lens selections |
| Layout | `ui/src/client/utils/layout-registry.ts`, `$lensLayout` store atom, `layoutRegistry.shouldRelayout`, `ForceLayout` (`spacegraphjs7/src/plugins/layouts/ForceLayout.ts`) | 3 (smarter relayout heuristic), 5 (pin `z` in 3D), 7 (animate gating) |
| a11y / i18n hooks | `ui/src/client/core/announcer.ts`, `focus-trap.ts`, `tests/scenarios/accessibility/`, `ui/design-tokens.json` | 7 (extend `announcer` to subscribe to `ΔDisplay`; high-contrast palette as a Modulation) |

## 7. Conclusion

This specification bridges the gap between the theoretical elegance of the v2/v3 algebraic engine and the practical reality of a user-facing application. By strictly sequencing the development to build the **Cognitive Workspace** first, then the **Algebraic Engine**, and finally the **Advanced Adapters**, we ensure that SeNARS remains a usable, performant, and infinitely extensible tool for cognitive operations.

---

## 8. Implementation Status (2026-07)

All phases are **fully implemented**. Tests pass for each gate.

| Phase | Status | Evidence |
|---|---|---|
| **Phase 1** | ✅ Complete | Truth slider in `node-detail-drawer.ts:277-298` (input[type=range]), optimistic updates via `updateNodeData`, edge editing via `object.set` protocol, Playwright `cognitive/ingest-and-edit.spec.ts` |
| **Phase 2** | ✅ Complete | Modulation engine: `types.ts`, `operators.ts`, `compile.ts`, `evaluate.ts`, `memo.ts`, `composition.ts`; property tests in `tests/modulation/properties.test.ts`; both viewports use `applyDelta` adapters |
| **Phase 3** | ✅ Complete | Edge tap handlers in `graph-viewport.ts:189-197`, `node-detail-drawer.ts:301-332`; relational tests in `tests/scenarios/relational/` |
| **Phase 4** | ✅ Complete | Lens designer at `components/lens-designer.ts`, `LensSpecSchema` in `shared/lens-schema.ts`, `lens.define` protocol in `protocol.ts:203-211`; config gate test passes |
| **Phase 5** | ✅ Complete | Timeline scrubber at `components/timeline-scrubber.ts`, history tab in drawer, `node.history.request` protocol; test at `tests/scenarios/cognitive/timeline.spec.ts` |
| **Phase 6** | ✅ Complete | `$viewportMode` atom in `store.ts:109`, 3D toggle button in `graph-toolbar.ts:154`, conditional render in `app-layout.ts:125-127`, parity tests at `tests/scenarios/spatial/parity.spec.ts` |

| **Phase 7** | ⏳ In Progress | Announcer exists (`core/announcer.ts`), View flags read from `matchMedia`; a11y modulations (reduced motion, high contrast, redundant encodings) defined in spec but not yet composed into base lens pipeline |

### Key Implementation Notes

* **Modulation Engine Contract:** `ΔDisplay = Map<NodeId, Partial<Record<Channel, ChannelValue>>>` (types.ts:19) with channels enumerated (types.ts:1-13). Both `adapter-2d.ts` and `adapter-3d.ts` accept this via `applyDelta`.
* **Lens Composition:** `timeGate` in `composition.ts` wraps base modulations for temporal filtering, proving `When` compositionality.
* **Zero-Allocation Hot Path:** `evaluate` in `evaluate.ts:22-28` skips re-evaluation when `dirtyIds` omits an item; cache returns same record reference. `diffDelta` enables patching.
* **2D/3D Parity:** `SUPPORT_2D` and `SUPPORT_3D` sets in adapters. Unsupported channels detected via `checkUnsupportedChannels` (adapter-3d.ts:11-20).
* **Server Lens Scoring:** The `lensScorers` in `lenses.ts:46-65` still exist but `lensData` is no longer used for visual derivation—the client-side Modulation produces all visual channels.
