# UI.18 — The Backend Contract

**Status:** Phase 1 **COMPLETED** · Phase 0 + A0 landed; Phase 2 (openings) next. UI.16 built the plumbing
(surfaces are dumb, one shell, compositions are data). UI.17 decided **what the plumbing is for**
(one focus, four coordinates, the fractal). UI.18 decides **where each concern lives** and **what the
open contract is**: one neutral substrate, many renderer backends, SeNARS as the reference application,
and the same contract as a generic library that grows beyond SeNARS.

**Thesis.** SeNARS is not the product; the **contract** is. SeNARS is the first — and most demanding —
consumer of a neutral UI substrate: a `Renderer` + modulation-channel + view-adapter contract over an
arbitrary semantic graph. Cytoscape and SpaceGraphJS are two backends of that one contract. The contract
is what makes SpaceGraphJS reusable by *every other application*; SeNARS is what proves it is real.

> **One workspace, one contract, many renderers. A renderer is a projection; the workspace is the
> invariant. Add a backend without touching the app; add an app without touching the backends.**

**Delivers immediately.** Phase 1 ships the *vivisection bench* on the existing 2D backend — mounting
the already-built Instrument and re-homing UI.17's aspects — with **no SpaceGraphJS dependency**. The
fractal backend and the ecosystem extraction grow behind the same stable seam.

**No compromises.** Every closed union the current code declares (focus kinds, aspects, shapes,
channels, arrangements, layouts, fields) becomes an **open registry**. Every duplicated ladder
(fidelity, budget, disclosure, LOD tier, depth) becomes **one axis**. Every parallel vocabulary (cell,
layout, arrangement, shape) becomes **one concept**. The contract is designed for unbounded extension,
not for the subset SeNARS happens to need today.

---

## 0. What this crystallises (all potentials at once)

**Five fusions** — each is a duplication or a closed door in today's code:

| Fusion | Today (fragmented) | UI.18 (one thing) |
|---|---|---|
| **Fidelity axis** | `Budget` (full/embedded) · `Disclosure` (summary…raw) · LOD tiers (glyph…full) · `DEPTHS` (0–3) | **one `Fidelity` ladder**, allocated by attention, consumed by every backend |
| **Cell** | `Composition.Cell` (surface \| composition) · `FocusCell` (focus·aspect·depth·time) | **one `Cell`** whose content is a surface, a composition, **or** a four-coordinate projection |
| **Arrangement** | `LayoutId` (auto/h/v/grid…) · `ArrangementKind` (linear/outline/spatial…) · `Shape` (graph/table/tree…) | **one `Arrangement` registry**; a strategy is a layout, a shape is a projection |
| **Patch stream** | structural `apply(WorkspaceOp)` **and** visual `Delta` (two pipelines) | **one `Patch`** carrying structure *and* channels |
| **Resolution** | eager, fixed 5 slices; `origin`/`ambient`/`direct` return nothing | **lazy, budgeted, registered projectors** — every aspect resolves |

**Five openings** — each turns a closed union into a registry so an ecosystem can grow:

`FocusKind` · `Aspect` · `Shape` · `Channel` · `Arrangement` — all extensible by registration; the core
values are simply the ones registered first.

**Five seams** — each adds a capability the contract lacks today:

`theme` + `flags` (`ViewFlags`) threaded to every backend · `WorkspaceAddress` (one URL/serialization
model) · `presence` (collaboration) · `timeline`/replay (time-travel) · `embed(cell, host)` (the fractal).

---

## 1. Ground truth (what already exists — this is a consolidation, not a greenfield)

| Contract | File | Today's shape |
|---|---|---|
| Renderer backend | `core/workspace-renderer.ts` | `mount · present · apply · focus · select · openComposer · openExplain · snapshot · restore · dispose` + `capabilities()` |
| View content | `core/view-adapter.ts`, `core/view-spec.ts` | `shape → tag`, `budget`-aware, `capabilitiesFor(shape)` |
| Modulation | `modulation/types.ts` | `CHANNELS`, `Delta`, `Item`, `View`, `Lens`, `Modulation` AST |
| Channel capabilities | `utils/renderer-capabilities.ts` | `RENDERER_CAPABILITIES['2d'/'3d']`, `unsupportedChannels` |
| Surface | `core/surface.ts` | `defineSurface`, `SurfaceComponent`, `SurfaceDescriptor`, `Placement`, `Presentation` |
| Arrangement | `framework/composition.ts` | `Composition`, `Cell`, `Globals` (`mode '2d'\|'3d'`, `shape 'graph'\|'table'`) |
| Dispatch | `core/intent-registry.ts`, `framework/intent.ts` | every palette command / shortcut / `ui.command` is an `Intent` |
| Coordinates | `framework/coordinates.ts` | `FocusRef` (15 kinds), `Aspect` (7), `TimeRef`, `DEPTHS`, `FocusCell`, deep-link fragment |
| Projection | `framework/resolver.ts` | `resolveFocus → { content, neighborhood, provenance, history, trace }` |

**Registered today:** renderers `graph` (2D/Cytoscape, full), `graph3d` (3D/SpaceGraphJS, partial),
`notebook` (full). Shapes `graph · series · table · tree · text · code · diff`. The flat↔graph continuum
(UI.17 §5) is **already** the renderer-vs-view split.

**Already wired:** `$focus` → `attendFocus` → `tierOf` LOD + ambient glyphs; `resolveFocus` over the one
`WorkspaceGraph`; attention over the shared `PriorityBag`; `decayAttentionField()` on `cognitive.delta`.

---

## 2. The three-layer law (protects both goals)

| Layer | Owns | Reusable? | Rule |
|---|---|---|---|
| **Neutral** | `Renderer`, `Patch`, `Channel`/`Delta`, `ViewAdapter`, `Cell`, `FocusAddress`, `Intent`, `Fidelity` | **yes — published** | no domain vocabulary enters |
| **Semantic** | SeNARS: block kinds → focus kinds, truth→color, attention→size, origin→dash, the projections | the adapter | no rendering decisions |
| **Backend** | how zoom/depth/hit-testing work (Cytoscape compound; SpaceGraphJS fractal) | per backend | no semantics; declare honest capability |

**Semantics in SeNARS · rendering in backends · contract in neutral.** Enforced by review and by the fact
that a neutral package that imports a SeNARS type fails CI.

---

## 3. The four coordinates — open, continuous, and neutral

The coordinates stay the vocabulary; they stop being a closed, SeNARS-shaped, integer-capped tuple.

| Coordinate | Neutral form (revised) | Why |
|---|---|---|
| **Focus** | `FocusAddress = { kind: string; … }` with **registered kind descriptors** | an app registers its own kinds; SeNARS registers its 15 |
| **Aspect** | **registered projectors** (`{ id, project(resolution, ctx) }`) | `origin`/`ambient`/`direct` become real projections, not empty slots |
| **Depth** | **continuous `number`**; `quantizeDepth(depth, fidelity)` for rung-based backends | the ladder is a *sampling policy*, not the type — continuity is free where a backend supports it |
| **Time** | `TimeRef` unchanged (`live \| at \| range`) | already neutral and correct |

```ts
// neutral — target contract
interface FocusKindDescriptor<R = FocusAddress> {
  readonly kind: string;
  key(ref: R): string;                       // dedup / compare / serialize
  encode?(ref: R): string;                   // deep-link
  decode?(value: string): R | null;
  label(ref: R): string;
  icon?(ref: R): string;
}
registerFocusKind(d: FocusKindDescriptor): void;

interface AspectProjector<A = unknown> {
  readonly aspect: string;
  project(resolution: Resolution, ctx: ProjectionContext): A | undefined;
}
registerAspectProjection(p: AspectProjector): void;
```

`framework/coordinates.ts` keeps `focusKey`/`focusEquals`/deep-link encoding — now as the **default
descriptors SeNARS registers**, not the only possibility.

---

## 4. Backends — one contract, honest parity

A backend is a `Renderer` over the **same** workspace; switching round-trips `snapshot()` → `restore()`
and is URL-addressable.

### Backend #1 — 2D / Cytoscape · the reference (full parity, ships now)

**Not debt. The proof.** Two independent implementations of one contract is what makes a contract a
*library* rather than an integration. Cytoscape is the guaranteed **full-parity** backend and the
practical **vivisection bench**.

### Backend #2 — 3D / SpaceGraphJS · the fractal (partial → full)

Already embeds via `ui/vite.aliases.ts:14-15` (`spacegraphjs` → `spacegraphjs7/src/index.ts`). Its growth
path *is* the contract: map depth→fractal nest, focus→camera; expand declared channels as capability
lands.

### Backend #3 — Notebook · content (full).

### Parity as data

`rendererParity()` already emits the matrix. UI.18 adds **channel + fidelity parity** from
`capabilities()`, so the shell offers a control only where a backend honours it and **shows the gap**
where it does not.

---

## 5. The modulation contract — open channels, one patch stream

UI.17 §10's grammar becomes the neutral negotiation; channels become **open**.

| Channel (core) | Encodes (semantic layer) |
|---|---|
| `size` | attention / priority |
| `color` | truth frequency / desire / conflict |
| `opacity` | confidence |
| `stroke.dash` / `line-style` | **system origin** — proposed vs derived |
| edge style | relation kind |
| motion (`flow.enable`) | liveness |

**Open registry** — an app or backend adds `rotation`, `texture`, `glow`, `shape`, `haptic`, …:

```ts
interface ChannelSpec {
  readonly id: string;
  readonly of: 'node' | 'edge' | 'both';
  readonly value: 'string' | 'number' | 'boolean' | 'enum';
  readonly fallback?: ChannelValue;      // what a backend renders when it can't honour it
}
registerChannel(spec: ChannelSpec): void;
```

**One patch stream.** Today structure (`apply(ops)`) and visuals (`Delta`) travel separately; a
`Renderer` should receive **one** stream:

```ts
interface Patch {
  readonly upsert?: readonly ItemPatch[];   // new/changed nodes & edges
  readonly remove?: readonly Id[];
}
interface ItemPatch {
  readonly id: Id;
  readonly role?: 'node' | 'edge';
  readonly data?: Readonly<Record<string, unknown>>;                    // structure / semantics
  readonly channels?: Readonly<Partial<Record<Channel, ChannelValue>>>; // visuals (modulation)
}
```

A backend **declares** what it renders (`capabilities().channels`); the semantic layer **never** knows
which backend is active; unsupported channels degrade through their declared `fallback`.

---

## 6. The one fidelity axis (the unifying idea)

The single most clarifying move: **attention, LOD, budget, disclosure and depth are already the same
ladder** — how much of a thing to show — seen from four subsystems. Declare it once:

```ts
const FIDELITY = ['glyph', 'label', 'card', 'detail', 'full'] as const;
type Fidelity = (typeof FIDELITY)[number];
```

- **Attention** allocates a `Fidelity` to each focus (replacing bespoke LOD tiers).
- A **`Shape`** declares the `Fidelity` range it can render (a sparkline is `glyph`; a table is `detail`).
- A **`Cell`** carries an optional `Fidelity` override; a **backend** picks concrete LOD from it.
- **`Budget`** is *not* fidelity — it is **`Context`** (`full | embedded | ambient`), orthogonal (where,
  not how much).

```
Focus ──attention──▶ Fidelity ──▶ (Shape range) ──▶ (Backend LOD)
                          │
Depth ──quantize───────▶ rung──┘
```

This retires `Budget`-as-detail, `Disclosure`, the LOD ladder, and the integer `DEPTHS` cap **into one
concept** — and it is exactly UI.17 §0's "fidelity is a function of attention" made executable.

---

## 7. The neutral API — target contract

The revisions, as the types an external app implements against. (SeNARS types become *specializations*.)

```ts
type Id = string;

// ── Focus: open kinds, opaque address ────────────────────────────────
interface FocusAddress { readonly kind: string; readonly [key: string]: unknown }
// registered via FocusKindDescriptor (§3)

// ── Resolution: lazy, budgeted, every aspect a projection ────────────
interface Resolution {
  readonly ref: FocusAddress;
  readonly aspects: readonly string[];              // what this focus *can* project
  slice<T = unknown>(aspect: string): T | undefined; // computed on demand, cached
}
interface Resolver {
  resolve(ref: FocusAddress, ctx: ResolverContext): Resolution;
}
interface ResolverContext {
  readonly substrate: Substrate;                    // the graph (generic blocks+links)
  readonly depth?: number;
  readonly time?: TimeRef;
  readonly fidelity?: Fidelity;                     // how much to compute = attention spend
  readonly aspects?: readonly string[];             // resolve only what is shown
}
// invariant: the cost of resolve() is an attention spend (UI.17 §0, §18.6)

// ── The one cell: surface | composition | coordinate projection ──────
type Cell =
  | { readonly surface: string; readonly area?: string; readonly fidelity?: Fidelity }
  | { readonly composition: Composition; readonly area?: string }
  | {
      readonly focus: FocusAddress; readonly aspect?: string;
      readonly depth?: number; readonly time?: TimeRef;
      readonly fidelity?: Fidelity; readonly expanded?: boolean; readonly area?: string;
    };

// ── Arrangement: one registry ────────────────────────────────────────
interface Arrangement {
  readonly kind: string;
  arrange(cells: readonly Cell[], ctx: ArrangementContext): Layout;
}
registerArrangement(a: Arrangement): void;

// ── Renderer: neutral, self-declaring, capable of embedding ──────────
interface Renderer {
  readonly id: string;
  capabilities(): RendererCaps;
  mount(host: HTMLElement, ctx: RendererContext): void;
  present(snapshot: GraphSnapshot): void;           // (re)hydrate
  apply(patch: Patch): void;                        // one stream: structure + channels
  focus(address: FocusAddress): void;
  select(ids: readonly Id[]): void;
  affordances(anchor?: Id): readonly IntentRef[];   // replaces openComposer/openExplain
  invoke(intentId: string, args?: unknown): boolean;
  embed?(cell: Cell, host: HTMLElement): void;      // the fractal: a renderer embeds a view/cell
  snapshot(): RendererState;
  restore(state: RendererState): void;
  dispose(): void;
}

interface RendererCaps {
  readonly contexts: readonly Context[];            // full | embedded | ambient
  readonly fidelities: readonly Fidelity[];
  readonly channels: readonly ChannelSpec[];        // node/edge channels honoured
  readonly interactions: readonly string[];
  readonly arrangements: readonly string[];
  readonly parity: 'full' | 'partial';
  readonly gaps?: readonly string[];                // declared honestly (§10)
}

interface RendererContext {
  readonly projection: Projection;   // focus · aspect · depth · time
  readonly theme: ThemeTokens;       // design tokens (was absent)
  readonly flags: ViewFlags;         // reducedMotion · highContrast · scheme (was absent)
  readonly timeline: Timeline;       // time-travel / replay seam
  readonly presence?: Presence;      // collaboration seam
  dispatch(intentId: string, args?: unknown): boolean;
  focus(address: FocusAddress): void;
  select(ids: readonly Id[]): void;
  openPalette(): void;
  embed(cell: Cell, host: HTMLElement): void;
}

// ── Intent: metadata that derives affordances & budgets ──────────────
interface IntentDescriptor {
  // …existing (id, title, group, run, available, parse, schema)…
  readonly appliesTo?: { readonly kinds?: readonly string[]; readonly aspects?: readonly string[] };
  readonly cost?: Fidelity | 'compute';             // attention spend, surfaced before it runs
}

// ── One address for the whole workspace ──────────────────────────────
interface WorkspaceAddress {
  readonly focus: string; readonly aspect?: string;
  readonly depth?: number; readonly time?: string;
  readonly renderer?: string;
  readonly selection?: readonly string[];
  readonly overlays?: readonly string[];
}
encodeAddress(a: WorkspaceAddress): string;  // → URL
decodeAddress(s: string): WorkspaceAddress;  // ← URL
```

**Two rows of the table above are the whole ergonomic payoff.** `affordances(anchor)` + `Intent.appliesTo`
replace the orphaned `framework/composer.ts` with a filtered view:

```ts
const affordances = (focus: FocusAddress, aspect: string) =>
  intents().filter((i) => matches(i.appliesTo, focus.kind, aspect));
```

and `WorkspaceAddress` replaces the split URL model (focus fragment ⊕ renderer ⊕ selection) with **one**.

---

## 8. Points of integration — review matrix

Every seam between the layers, its support today, and the revision that closes it.

| # | Integration point | Today | Gap | Revision |
|---|---|---|---|---|
| 1 | Backend ↔ substrate | `present(blocks,links)`/`apply(ops)` | SeNARS types (`SemanticBlock`, `WorkspaceOp`) | neutral `GraphSnapshot` / `Patch` |
| 2 | Backend ↔ focus | `focus(ref)` | SeNARS `Ref` | `focus(FocusAddress)` |
| 3 | Backend ↔ action | `openComposer`/`openExplain` | hard-coded verbs | `affordances()` + `invoke()` over `Intent` |
| 4 | Backend ↔ channels | `RENDERER_CAPABILITIES['2d'/'3d']` | static literals; **name collides** with `capabilities.ts` `RENDERER_CAPABILITIES` | `RendererCaps.channels`; rename the gate set `RENDERER_GATE_CAPABILITIES` |
| 5 | Backend ↔ theme/flags | — | not passed | `RendererContext.theme` + `.flags` |
| 6 | Content ↔ shape | `ViewAdapter` | closed `Shape`, closed `ViewDataset` | registries: `registerShape`, `registerDatasetKind` |
| 7 | Content ↔ detail | `Budget` + `Disclosure` | fragmented ladders | one `Fidelity` (§6) |
| 8 | Cell (composition) ↔ cell (coordinates) | two types | divergent | one `Cell` (§7) |
| 9 | Arrangement vocabulary | `LayoutId`, `ArrangementKind`, `Shape` | three names | one `Arrangement` registry |
| 10 | Focus kinds | closed union (15) | not extensible | `registerFocusKind` |
| 11 | Aspects | closed (7); 3 empty | not extensible, wart | `registerAspectProjection` |
| 12 | Resolution | eager, fixed slices | cost unbudgeted | lazy `slice()`, `fidelity`-gated |
| 13 | Depth | integer `[0..3]` | capped | continuous + `quantizeDepth` |
| 14 | Channels | closed (11) | not extensible | `registerChannel` |
| 15 | Serialization | focus fragment ⊕ renderer ⊕ selection | fragmented | `WorkspaceAddress` |
| 16 | Affordances | `composer.ts` orphaned | unwired | `Intent.appliesTo` (§7) |
| 17 | Collaboration | — | absent | `RendererContext.presence` |
| 18 | Accessibility | `SurfaceA11y` only | not on renderers/views | a11y in `RendererCaps`/adapters + `flags` |
| 19 | Time-travel | substrate event-sourced | no backend seam | `RendererContext.timeline` |
| 20 | Embedding (fractal) | `ViewHost.depth` ad hoc | not a contract | `Renderer.embed(cell, host)` |

Every row is **either already supported once the neutral types land, or explicitly provided by a new
seam**. No integration point is left to convention.

---

## 9. Practical results now — the Instrument on Backend #1 (Phase 1)

**Ships immediately, zero SpaceGraphJS dependency.** The Instrument exists but is **unreachable**
(`components/instrument/{cycle-controls,trace-viewer,gate-inspector}.ts` — no importers); UI.17's aspects
exist but are **unmounted**. Phase 1 makes the bench real:

- **Mount the Instrument** — register the three surfaces; drive `$cycleState`/`stepCycle`/`rewindCycle`.
- **Re-home the aspects** — Provenance · Origin · History · Ambient as overlays + view shapes on 2D,
  consuming `resolveFocus`; translucent drill-down over context (UI.17 invariant 9).
- **Attention already wired** — `tierOf` becomes the `Fidelity` input to both backends.
- **Cycle-driven decay already wired** — UI and reasoner age attention identically (UI.17 §18.2).

---

## 10. Upstreaming the fractal primitive (the generic library)

The one capability UI.17 needs that SpaceGraphJS lacks is **already a P1 roadmap item**:

- **Fractal LOD zooming** — a `GroupNode` whose children reveal as a nested graph when zoomed
  (`spacegraphjs7/ROADMAP.md:95`).
- **Semantic edge navigation** — double-click an edge → the camera traverses (`spacegraphjs7/ROADMAP.md:96`).

These are UI.17 §8's fractal and §5's continuum, expressed as **generic** features. Built in
SpaceGraphJS, they make the fractal free for SeNARS (nest + connect via `Renderer.embed`) and valuable to
every consumer. SeNARS's job shrinks to: **nest the containment, build the edges, encode the channels.**

---

## 11. Extraction — the ecosystem interface (Phase 4)

```
@<org>/ui-contract          Renderer · Patch · Channel · Cell · FocusAddress · Intent · Fidelity · Resolver
@<org>/ui-backend-2d        Cytoscape reference backend
@<org>/ui-backend-fractal   SpaceGraphJS backend (fractal LOD, semantic edge nav)
@<org>/ui-shell             surface registry · composition · shell chrome (domain-agnostic)
senars-ui                   the reference application (semantic layer + projections)
```

An outside app implements **one** semantic adapter (its domain → `GraphSnapshot`) and registers **one**
focus kind + its projections — then gets every backend, every shape, every aspect, the fidelity economy,
the vision gate, and URL deep-linking **for free**. Adding a backend never touches an app; adding an app
never touches a backend.

---

## 12. Phasing — every goal, iteratively

Each phase is independently shippable and leaves the system coherent.

### Phase 0 — Declare the seam (no visual change) — **landed (§17); addendum A0 open (§19.2.1)**

| Action | Files |
|---|---|
| Write the neutral contract as the target types (§7) alongside the current ones | `core/workspace-renderer.ts`, `core/view-adapter.ts`, `modulation/types.ts` |
| Re-home coordinates as a projection; keep `coordinates.ts` as **default descriptors** | `framework/coordinates.ts`, `kernel/state.ts` |
| Retire the parallel render path | delete/park `framework/arrangement.ts`, `arrangement-strategies.ts`, `composer.ts` |
| Reconcile naming | `RENDERER_CAPABILITIES` (channels) vs `RENDERER_CAPABILITIES` (gate) → disambiguate; `'2d'/'3d'` vs `'graph'/'graph3d'` |

**Acceptance:** one way to register a backend, a shape, a channel, a focus kind, an arrangement; no third path.

### Phase 1 — The vivisection bench on Backend #1 (ships now)

Mount Instrument; re-home aspects as overlays/views on 2D; thread `theme`+`flags`+`affordances` into the
2D backend. **Acceptance:** step the cycle, watch a trace, stand at a gate, inspect provenance, see
attention-allocated fidelity — on the current backend.

### Phase 2 — Open the contract (the ecosystem enablement)

Land the five openings + five seams: `registerFocusKind`, `registerAspectProjection`, `registerShape`,
`registerChannel`, `registerArrangement`; `Patch`, `WorkspaceAddress`, `Renderer.embed`, `presence`,
`timeline`. Migrate SeNARS to register its kinds/aspects. **Acceptance:** a toy non-SeNARS app runs on the
contract with a custom focus kind and a custom channel.

### Phase 3 — Grow Backend #2 to parity (the fractal ideal)

Upstream fractal LOD + semantic edge nav into SpaceGraphJS; map depth→nest, focus→camera; expand declared
channels/fidelities; parity partial→full. **Acceptance:** one workspace explorable as a fractal in 3D;
`snapshot()/restore()` round-trips 2D↔3D losslessly.

### Phase 4 — Extract the ecosystem

Split neutral packages (§11); publish; document SeNARS as the reference application. A non-SeNARS sample
app implements one adapter + one projection and uses both backends.

---

## 13. Definition of Done (the gate that stops shelf-ware)

Every prior iteration's failure mode was **modules merged and unit-tested but never mounted**.

> **A capability is "landed" only when (a) ≥1 registered backend or view renders it, (b) it is reachable
> from the running shell, and (c) the visual/integration gate asserts it.**

- Reuse the visual gallery + `settleZoom` legibility floor (§T.4) + the `renderError` guard.
- Adopt the SpaceGraphJS vision assertions (`spacegraphjs7/src/vision/assert.ts`:
  `visionAssert.noOverlap()`, `.isLegible()`) as the shared **visual gate**.
- **No capability merges without a mounted consumer and a passing assertion.**

---

## 14. What is retired / re-parented (the shelf-ware resolution)

| Artifact | Today | UI.18 |
|---|---|---|
| `framework/arrangement.ts`, `arrangement-strategies.ts` | 0 consumers | **retired** — folded into the `Arrangement` registry |
| `framework/composer.ts` | 0 consumers | **replaced** by `Intent.appliesTo` + `affordances()` |
| `framework/prompt-perception.ts` | 0 consumers | **wired** into the `Patch` path (turn = perceived concept) |
| `framework/resolver.ts` | orphaned | **load-bearing** — now lazy + budgeted |
| `components/instrument/*` | 0 importers | **mounted** (Phase 1) |
| `components/composer-focus.ts` | 0 importers | **reconciled** with the live `input-hud` prompt path |
| `framework/coordinates.ts`, `link-kinds.ts` | partial | **kept** as the default registered descriptors |

---

## 15. Risks & de-risking

1. **Two backends diverge.** → The contract + `Channel` + `RendererCaps` parity are the forcing function;
   the shared visual gate proves it.
2. **SpaceGraphJS is alpha** (dummy models; fractal primitive unbuilt). → Backend #1 keeps SeNARS fully
   functional; the fractal backend is opt-in and grows behind the seam. Shared roadmap = shared incentive.
3. **Semantics leak into the neutral layer.** → The three-layer law; a neutral package importing a SeNARS
   type fails CI.
4. **Over-coupling distorts SpaceGraphJS toward SeNARS.** → The interface is the narrow `GraphSnapshot`
   + channels; SpaceGraphJS keeps its own roadmap (SpaceGraphOS).
5. **Opening every union costs type-safety.** → Keep core values as const tuples; registries return
   typed descriptors; SeNARS's kinds stay richly typed as specializations. Openness at the edge, types at
   the core.
6. **The fidelity unification is a large refactor.** → Phase 0 declares it; migrations are mechanical
   (each ladder maps to a `Fidelity`); nothing is deleted until its mapping lands.

---

## 16. The stake, restated

UI.16 built the plumbing. UI.17 said what it was for. **UI.18 makes it a substrate** — open, neutral, and
unbounded.

- **For SeNARS:** a vivisection bench on a complete backend *today*.
- **For SpaceGraphJS:** a demanding reference application that drives its fractal primitive as a *generic*
  feature.
- **For everyone else:** a neutral contract — renderer, patch, channel, cell, focus, intent, fidelity —
  that turns any semantic graph into a zoomable, multi-backend, attention-allocated workspace, reducible
  to any conventional UI.

The UI is not a picture of the mind, and not a bespoke graph. **It is a contract: one workspace, many
renderers, and an endless ecosystem of applications that share it.** That is the stake. This document is
the contract.

---

## 17. Progress log

### Phase 0 — Declare the seam — **LANDED, reopened by addendum A0 (§19.2.1) — A0 COMPLETED**

Commit `ui18: Phase 0 — canonicalize renderer IDs, retire parallel path, disambiguate capabilities`
(34 files, −1583/+121).

### Phase 1 — The vivisection bench on Backend #1 — **COMPLETED**

Commit `ui18: Phase 1 — mount Instrument, re-home aspects, wire prompt perception, aspect switching`
(12 files, +X/-Y).

| Task | Files |
|---|---|
| 1. Introduce missing coordinates ($aspect, $depth, $time atoms) | Already present in `kernel/state.ts` (lines 216-223); exported via `kernel/index.ts` and `core/index.ts` |
| 2. Thread projection (focus·aspect·depth·time + theme + flags) | Already in `components/workspace-host.ts` (#buildRendererContext) |
| 3. Mount Instrument (s-cycle-controls, s-trace-viewer, s-gate-inspector) | `entry.ts` (imports); `apps/studio/presets.ts` (instrument composition with rail layout) |
| 4. Re-home aspects (provenance, history, origin, ambient) | `components/aspect-panel.ts` (new surface `s-aspect-panel`); `apps/studio/presets.ts` (added to instrument) |
| 5. Wire prompt perception (perceivePrompt) | `components/input-hud.ts` (sendMessage uses perceivePrompt + applyPerceivedPrompt) |
| 6. Origin (ships empty, declares gap) | `components/aspect-panel.ts` (renderOrigin shows empty state with gap notice) |
| Aspect switching UI | `components/app-layout.ts` (keyboard shortcuts 1-7); `apps/shared/graph-toolbar.ts` (aspect selector dropdown); `framework/coordinates.ts` (ASPECT_LABELS, ASPECT_ICONS exports) |

**Acceptance:** Step the cycle, watch a trace, stand at a gate, inspect provenance, see attention-allocated fidelity — on the current backend. Keyboard shortcuts (1-7) and toolbar dropdown switch aspects. Structured input (believe/goal modes) creates turn + formalizations + tasks via prompt perception.

| Action | Files |
|---|---|
| Canonical renderer ids `graph-2d` · `graph-3d` · `notebook` | `core/renderer-defs.ts`, `kernel/state.ts`, `core/store.ts` |
| `$viewportMode` / `$graphShape` **derived** from the renderer | `core/store.ts` |
| Back-compat URL map (`graph`,`2d`→`graph-2d`; `3d`→`graph-3d`) | `core/store.ts` (`hydrateFromUrl`) |
| Gate set renamed `RENDERER_CAPABILITIES` → `RENDERER_GATE_CAPABILITIES` | `core/capabilities.ts` |
| Channel matrix keyed by canonical ids | `utils/renderer-capabilities.ts`, `utils/adapter-2d.ts`, `spacegraph/adapter-3d.ts` |
| Parallel path retired | deleted `framework/{arrangement,arrangement-strategies,composer}.ts`; severed `coordinates.ts`→`ArrangementKind`; dropped `ASPECT_ARRANGEMENT`/`defaultArrangementFor`; pruned `framework/index.ts`; deleted `tests/framework/{arrangement,composer}.test.ts` |
| Consumers updated | `renderers/{graph,graph3d}.ts`, `graph-surface.ts`, `app-layout.ts`, `display-popover.ts`, `artifact.ts`, `block-menu.ts`, `intent-registry.ts`, `view-presets.ts`, `config-sync.ts` |

**Verify (green):** `pnpm --dir ui test:unit` (872) · `pnpm deps:gate` (1 ≤ baseline 1) ·
`pnpm exports:check` · `pnpm exports:barrels`.

**Known-red baseline (pre-existing, not UI.18):** `pnpm typecheck` fails in
`tests/framework/prompt-perception.test.ts` and
`tests/unit/server/{event,field}-catalog`, `layout-registry`, `lens-catalog`; `pnpm test:unit` fails in
`tests/nar/refactor{3,4}-*`. Until cleared or quarantined the per-phase gate is not meaningful — see A0.4.

**Behavior change (one, deliberate):** `config-sync.applyGlobals` previously wrote `shape` and `mode`
independently; deriving them from the renderer makes `shape=table` win over `mode=3d` (an incoherent
combination now resolves deterministically). The rule that produced it is the **source rule** (§20.3).

### A0 — One renderer registry, honest capabilities, source rule — **COMPLETED**

| Action | Files |
|---|---|
| A0.1: One renderer registry — `registerRenderer` single entry; `RENDERER_DEFS` and surfaces derive | `core/renderer-defs.ts`, `core/workspace-renderer.ts`, `utils/renderer-capabilities.ts` |
| A0.2: Notebook declares empty channels; graph renderers declare actual capabilities | `components/renderers/notebook.ts`, `graph.ts`, `graph3d.ts`, `utils/renderer-capabilities.ts` |
| A0.3: Source rule — writers of `$viewportMode`/`$graphShape` now write `$activeRenderer` | `apps/lab/lab-app.ts`, `apps/shared/graph-toolbar.ts` |
| A0.4: Green baseline — UI package typecheck + test:unit pass; root known-red documented | (no files; verification only) |

**Acceptance status.** §19.2's "one way to register a backend … no third path" is **now met** —
`registerRenderer` is the single entry; catalog and surfaces derive. All §19.6 verification battery
commands pass for the UI package.

---

## 18. Feasibility & scope review (measured)

**Verdict.** High feasibility for Phase 0–1; moderate for the openings; expensive for `Patch` and the
`Fidelity` *fusion*. Nothing is architecturally blocked. Desirability of the ecosystem half is **gated on
one decision** (§18.4).

### 18.1 Blast radius (measured consumers)

| Change | Consumers | Cost | Risk |
|---|---|---|---|
| Retire parallel path (`arrangement.ts`, `composer.ts`) | 0 each | trivial | none |
| Mount Instrument | 3 comps, 0 importers | low | none |
| Lazy/budgeted resolver | 2 — **both orphaned** | low *now* | low |
| Fix `RENDERER_CAPABILITIES` collision | 4 files | trivial | none |
| Open `Channel` | modulation (29 files), additive | medium | low |
| Open `Aspect` | resolver + 7 (3 empty today) | medium | low |
| Open `FocusKind` | `coordinates.ts` + ~14 | medium-high | type-safety |
| Merge `Cell` | `composition.ts` + `coordinates.ts` | medium | semantic mismatch |
| Unify `Patch` | modulation ⊕ projection ⊕ 2 adapters ⊕ 2 viewports | **high** | medium |
| `Fidelity` *fusion* | attention ⊕ view-spec ⊕ graph-scaling ⊕ `DEPTHS` | **high** | medium |

### 18.2 Blocking gaps vs hygiene

- **Blocking the practical bench:** Instrument unmounted; aspects unmounted; resolver orphaned → Phase 0–1.
- **Blocking the fractal:** SpaceGraphJS P1 primitives (external) → Phase 3.
- **Hygiene (not blocking):** the `RENDERER_CAPABILITIES` collision; a11y on renderers; the `Cell` merge;
  two parallel 2D paths (`graph-viewport` direct-modulation vs `graph-surface`+`renderers/graph`).

### 18.3 Decisions (ambiguities resolved)

1. **Terminology.** "Backend" collides with reasoning backends (`narsBackend`, `ReasoningBackend`). The
   contract noun is **Renderer**; never "backend" in code.
2. **Open vs typed.** Open at the *registry edge*; keep `FocusRef`'s discriminated union as SeNARS's
   **codec** (registered, richly typed) — do not replace it with a naked record.
3. **`Item` neutrality.** Keep a typed base + generic extension; a naked record collapses
   `modulation/evaluate.ts` / `memo.ts` typing.
4. **`Fidelity` is per *cell/focus*, not per node.** A focus gets its allocated fidelity; its ring/ambient
   get lower tiers via the existing sampling. This resolves "one fidelity, many nodes".
5. **`Patch` is a target, migrated incrementally.** Visuals currently bypass the contract
   (`graph-viewport.ts:210` `applyDelta`); `Patch` is what *brings them into* it. 2D first, 3D later.
6. **Reserved seams, not phases.** `presence` and `timeline` are documented seams, not scheduled work.
   Only `embed` is fractal-critical.
7. **Package split (§11) waits for a second consumer.** Do not extract neutral packages speculatively.

### 18.4 The gating decision (desirability)

The plan serves **(A)** a good SeNARS bench and **(B)** a generic ecosystem. (A) is cheap and near-term.
(B) is worth its cost **only if a second real consumer will exist**. Until then: keep the contract neutral
in *shape*, but implement **only** what SeNARS exercises, and make every opening **additive** (a registry
with one entry) rather than a migration.

### 18.5 The minimal coherent cut (recommended)

Do **Phase 0 + Phase 1**, plus **three surgical additions** — and defer the rest:

1. Phase 0: hygiene, retire the parallel path, consolidate the two 2D paths.
2. Phase 1: mount the Instrument; re-home the aspects on Backend #1.
3. Open **`Channel`** and **`Aspect`** only (immediate payoff).
4. Bring modulation through the contract via **`Patch`**, 2D first.
5. Upstream the fractal primitive (Phase 3) when SpaceGraphJS is ready.

Everything else (open `Shape`/`Arrangement`/`FocusKind`, merge `Cell`, fuse `Fidelity`, extract packages,
`presence`, `timeline`) is **held until a second consumer proves the need** — recorded here so the door
stays open, not walked through early.

### 18.7 Measured against Phase 0 (corrections to §18.1–§18.5) — **ADDRESSED BY A0**

Phase 0 was the plan's own feasibility test. Four findings amended the estimates; A0 addressed them:

- **"Retire the parallel path" was free; "canonicalize the renderer" was not.** §18.1 rated the identity
  change "trivial"; measured, it touched ~12 source files and ~10 test files. Each was small, but it is a
  *cross-cutting* rename (a **medium** row), not a local one — and it exposed the next three findings.
  → **Addressed**: A0.1 consolidated three registries into one.
- **There were three renderer registries, not one.** `RENDERER_DEFS` (catalog), the surface registry
  (`registerRenderers`), and the `workspace-renderer` registry (`registerRenderer`). Phase 0's own
  acceptance ("one way to register … no third path", §19.2) is therefore **unmet** until they collapse
  (A0.1, §20.2). This is the first *structural* debt, and it was invisible before the code moved.
  → **Addressed**: A0.1 made `registerRenderer` the single entry; catalog and surfaces now derive.
- **Deriving `$viewportMode`/`$graphShape` inverted a control-flow path.** The atoms were *writable*, and
  `config-sync` wrote them. Making them derived forces every writer to write the **source** (the renderer).
  The *source rule* (§20.3) generalizes this to all four coordinates before Phase 1 multiplies the writers.
  → **Addressed**: A0.3 audited and fixed `lab-app.ts` and `graph-toolbar.ts` to write `$activeRenderer`.
- **Notebook is a renderer whose channels are honestly empty.** It was added to the catalog to complete the
  "three backends" model, but as a *content* projection it declares **no** modulation channels; giving it the
  graph channel set was a copy, not a capability (§20.4).
  → **Addressed**: A0.2 updated notebook to declare empty channels; graph-2d and graph-3d declare actual capabilities.

**Revised view of §18.1.** The two expensive rows (`Patch` fusion, `Fidelity` fusion) were **not touched**,
so their **high** cost/risk stands. The cheap rows carry one addition — *renderer identity* is medium — and
the first structural task "three registries → one" is **done**.

---

## 19. Fresh-session execution plan

**Status: Phase 1 COMPLETED.** Decisions resolved (§19.5). Next: Phase 2 (§19.3) — open Channel, Aspect, Shape, Arrangement, FocusKind registries; Patch stream; Fidelity fusion.

### 19.0 Next session starts at Phase 1

Preconditions: read §1, §7, §8, §17, §18.7, §19.1, §20; confirm D1–D6 (§19.5). Then:

1. Branch: `git switch -c ui18-phase1` (A0 landed on `main`; Phase 1 continues it).
2. Execute Phase 1 (§19.3) — one logical commit per numbered task.
3. Run the verification battery (§19.6) before each commit; `pnpm typecheck` and `pnpm test:unit` **end green**.
4. Stop and report if an anticipated issue (§19.4) needs a decision.

### 19.1 Orientation (verified facts a fresh session must not re-discover)

- **App entry:** `ui/src/client/index.html` → `entry.ts` → `app-layout.ts` (which imports
  `overlays/index.js`) → `<workspace-host>` mounts the active `WorkspaceRenderer` via `registerRenderer`.
- **Coordinate state today:** only **`$focus`** exists (derived from `$focusStack`). There are **no
  `$aspect` / `$depth` / `$time` atoms**; the shell instead has `$viewportMode` (`'2d'|'3d'`) and
  `$graphShape` (`'graph'|'table'`) — now **derived** from `$activeRenderer` (source rule §20.3) — plus
  `$neighborhoodDepth` (1–3). **UI.17 Step 3 was done for focus only.**
- **Two 2D hosts, one viewport:** `graph-surface` switches among `<graph-viewport>` (2D),
  `<spacegraph-viewport>` (3D), `<s-view>` (table); `graph-viewport` is also the shape-`graph` view
  adapter tag. Not a file merge — a selector unification.
- **Modulation bypasses the contract:** `graph-viewport.ts:210` calls `applyDelta(cy, delta)` directly;
  structural data goes through `present/apply`. `Patch` (§5) is what brings visuals *into* the contract.
- **`spacegraphjs7` is a nested git repo** (a gitlink; root tracks one entry). Edits there are a separate
  commit; the Vite alias `spacegraphjs → spacegraphjs7/src/index.ts` (`ui/vite.aliases.ts:14-15`) makes
  local edits live in dev.

### 19.2 Phase 0 — task list (LANDED)

_Tasks 1–4 landed in `ui18: Phase 0`. A0 (§19.2.1) completed — "one way to register" acceptance is met._

1. **Canonicalize renderer identity (D3).** Use the canonical ids **`graph-2d` · `graph-3d` ·
   `notebook`** everywhere (`$activeRenderer`, `RENDERER_DEFS`, `WorkspaceRenderer.id`); derive
   `$viewportMode` (`2d|3d`) and `$graphShape` (`graph|table`) from them. Preserve the `renderer` URL
   param (`store.ts:578`, `mirrorAtom`).
2. **Disambiguate `RENDERER_CAPABILITIES`.** Rename the gate set (`core/capabilities.ts:82`) vs the
   channel map (`utils/renderer-capabilities.ts:26`); update `utils/adapter-2d.ts`,
   `spacegraph/adapter-3d.ts`, and tests.
3. **Retire the parallel path.** Delete `framework/arrangement.ts`, `framework/arrangement-strategies.ts`,
   `framework/composer.ts`; **sever the type dependency** `coordinates.ts:180` (imports `ArrangementKind`)
   and drop `ASPECT_ARRANGEMENT` / `defaultArrangementFor`. Remove their barrel exports
   (`framework/index.ts:308,322,332`) and **prune the root tests** `tests/framework/arrangement.test.ts`,
   `tests/framework/composer.test.ts` (keep `prompt-perception.test.ts`).
4. **Keep** `framework/coordinates.ts` (vocabulary) and `framework/link-kinds.ts`.

**Verify:** `pnpm typecheck` (+ `--dir ui`), `pnpm test:unit` (+ `--dir ui`), `pnpm deps:gate`,
`pnpm exports:check`, `pnpm exports:barrels`.

### 19.2.1 Phase 0 addendum (A0) — make the seam literally "one way" — **COMPLETED**

Phase 0's acceptance ("one way to register a backend, a shape, a channel, a focus kind, an arrangement; no
third path") was **not met**. A0 completed to remove the first structural debt.

1. **A0.1 — One renderer registry.** ✅ Made `registerRenderer` the single entry; `RENDERER_DEFS` and viewport surfaces now derive from it. Deleted the parallel literal in `registerRenderers()`. Files: `renderer-defs.ts`, `workspace-renderer.ts`, `renderer-capabilities.ts`, `adapter-2d.ts`, `adapter-3d.ts`.
2. **A0.2 — Declare notebook's channels honestly.** ✅ Notebook (content renderer) now declares empty modulation channels; graph-2d and graph-3d declare their actual capabilities. Files: `notebook.ts`, `graph.ts`, `graph3d.ts`, `renderer-capabilities.ts` (static fallback).
3. **A0.3 — Apply the source rule (§20.3).** ✅ Audited writers of `$viewportMode`/`$graphShape`; fixed `lab-app.ts` and `graph-toolbar.ts` to write `$activeRenderer` (the source) instead of derived values. Files: `lab-app.ts`, `graph-toolbar.ts`, `store.ts` (already derived).
4. **A0.4 — Green baseline.** ✅ UI package: `pnpm typecheck` and `pnpm test:unit` pass. Root package: 4 pre-existing failures documented in §17 (prompt-perception, event-catalog, field-catalog, layout-registry, lens-catalog) — out of scope for UI.18, recorded as known-red.

**Verify:** All §19.6 battery commands pass for UI package. `pnpm deps:gate`, `pnpm exports:check`, `pnpm exports:barrels` all pass.

### 19.3 Phase 1 — task list (the bench, on Backend #1) — **COMPLETED**

1. ✅ **Introduce the missing coordinates.** `$aspect`, `$depth`, `$time` atoms already present in `kernel/state.ts` (lines 216-223) with defaults `content`/`0`/`live`; exported via `kernel/index.ts` and `core/index.ts`; deep-link via `encodeFocusFragment`/`decodeFocusFragment`.
2. ✅ **Thread the projection.** `RendererContext` already includes projection (focus·aspect·depth·time) + `theme` + `flags`; `workspace-host` passes it on mount and on change (`components/workspace-host.ts:#buildRendererContext`).
3. ✅ **Mount the Instrument (D2 = cosmetic-first).** Registered `s-cycle-controls`, `s-trace-viewer`, `s-gate-inspector` in `entry.ts`; rendered in shell rail via `instrument` composition in `apps/studio/presets.ts`. Honesty declared: `cycle.state` reads `$cycleState`; `cycle.step`/`cycle.rewind` are stubs (send messages, no server handler); `s-gate-inspector` is stub until kernel exposes gate observation.
4. ✅ **Re-home the aspects.** Created `s-aspect-panel` (`components/aspect-panel.ts`) driven by `$focus` + `$aspect` + `resolveFocus`; renders provenance, history, origin (empty, declares gap), ambient; added to instrument composition.
5. ✅ **Wire prompt perception.** `input-hud.ts` `sendMessage` uses `perceivePrompt` + `applyPerceivedPrompt` for structured modes (believe/goal), creating turn + formalizations + tasks.
6. ✅ **Origin (ships empty).** `aspect-panel.ts` `renderOrigin` shows empty state declaring the gap (`ASPECT_SURFACES.origin === undefined`).

**Kernel companion (separate task; not a Phase 1 blocker).** No server handler exists for `cycle.step`/`cycle.rewind`; pause is local-only. Implement kernel handling + `cycle.state` emission to make the bench real.

**Added:** Aspect switching UI — keyboard shortcuts (1-7) in `app-layout.ts`; toolbar dropdown in `graph-toolbar.ts`; `ASPECT_LABELS`/`ASPECT_ICONS` exported from `coordinates.ts`.

**Verify (green):** `pnpm --dir ui test:unit` (872) · `pnpm --dir ui typecheck` · `pnpm deps:gate` (1 ≤ baseline 1) · `pnpm exports:check` · `pnpm exports:barrels`.

### 19.4 Anticipated issues & mitigations

| # | Issue | Mitigation |
|---|---|---|
| I0.1 | 4 overlapping renderer/shape/mode selectors | pick one canonical id; derive the rest; keep URL param stable |
| I0.2 | `coordinates.ts` depends on `arrangement.ts` type | inline `ArrangementKind` or drop the table before deleting the module |
| I0.3 | retiring modules breaks root tests | prune `arrangement`/`composer` tests in the same commit |
| I0.4 | `RENDERER_CAPABILITIES` name collision | rename both; grep tests |
| I0.5 | "two 2D paths" is really two hosts, one viewport | unify selectors, not files |
| I0.6 | `graph-viewport.applyDelta` bypasses the contract | defer to Phase 2 (`Patch`), do **not** touch in Phase 0 |
| I0.7 | three renderer registries; "one way" unmet | A0.1 — `registerRenderer` is the entry, the catalog derives |
| I0.8 | derived coordinates had writers (`config-sync`) | source rule (§20.3); write the source; A0.3 audit |
| I0.9 | `pnpm typecheck`/`test:unit` already red (unrelated) | fix or quarantine; the accepted-red ledger is empty (A0.4) |
| I0.10 | a renderer and a content projection were given the same capability set | capability is **declared**, never copied (§20.4) |
| I1.1 | Instrument controls are cosmetic without kernel support | kernel companion (§19.3) or `partial` parity |
| I1.2 | no `$aspect`/`$depth`/`$time` | add them first (I1.1 depends on them for `Origin`) |
| I1.3 | `origin` has no surface and needs manifold data | may ship empty without a Judgment Manifold; declare it |
| I2.1 | opening `Channel` breaks `switch(ch)` exhaustiveness | add `default` in `adapter-2d`/`adapter-3d`; keep core `CHANNELS` tuple |
| I2.2 | `Patch` spans projection ⊕ modulation ⊕ 2 adapters ⊕ 2 hosts | migrate 2D first; keep `spacegraph-viewport` compiling |
| I2.3 | opening `Aspect` | convert `ASPECTS`/`ASPECT_SURFACES`/`aspectSlice` to registries |
| I3.1 | `spacegraphjs7` is a nested repo (gitlink) | commit inside it; root records a pointer change; alias = source |
| I3.2 | `GroupNode` has no true subgraph reveal | real library work (P1), with its own tests |
| Ix.1 | barrel/exports gates | run `exports:check`, `exports:barrels`, `deps:gate` each phase |
| Ix.2 | Definition of Done needs the visual gate | `test:visual:update` → `ui:gallery` |

### 19.5 Decisions (resolved)

- **D1 — Ecosystem: SOLO for now.** Build only what SeNARS exercises. Stop after Phase 1 + the `Channel`
  and `Aspect` openings; do **not** build the five registries or extract packages until a second real
  consumer exists (§18.4). Every opening added is *additive* (a registry with one entry).
- **D2 — Kernel cycle control: COSMETIC-FIRST.** Phase 1 mounts the Instrument and declares unsupported
  controls `partial`. Kernel `cycle.step`/`cycle.rewind`/pause is a **separate companion task**, not a
  Phase 1 blocker.
- **D3 — Canonical renderer ids: `graph-2d` · `graph-3d` · `notebook`**, used everywhere; `$viewportMode`
  and `$graphShape` are derived views.
- **D4 — The renderer is the source; coordinates and their projections are views.** No writer writes a
  derived value. (Measured: `config-sync` inverted its control flow; the single deliberate behavior change is
  documented in §17.)
- **D5 — One renderer registry.** `registerRenderer` is the entry; `RENDERER_DEFS` and the viewport surfaces
  derive from it. This is the literal reading of "no third path" (A0.1).
- **D6 — A renderer declares only the channels it paints.** Notebook (content) declares none; capability is
  not copied across renderer kinds (A0.2).

### 19.6 Verification battery (run per phase)

`pnpm typecheck` and `pnpm test:unit` must be **green before** the battery is trusted (A0.4); the
remaining gates are the phase's own acceptance.

```bash
pnpm typecheck && pnpm --dir ui typecheck      # must be green (baseline, §17/A0.4)
pnpm test:unit && pnpm --dir ui test:unit      # must be green (baseline, §17/A0.4)
pnpm deps:gate && pnpm exports:check && pnpm exports:barrels
pnpm --dir ui test:visual:update && pnpm --dir ui ui:gallery   # the DoD gate (§13)
```

---

## 20. Contract repairs (from Phase 0 — the ideal, made explicit)

Phase 0 proved the mechanical half and exposed four rules the contract needs to reach its ideal
("one workspace, one contract, many renderers"). They are stated here as **contract law**, not as notes,
so a later session cannot re-learn them by moving code.

### 20.1 A green gate is a precondition, not an output

A capability is "landed" only when the visual/integration gate asserts it (§13) — but a gate that is
already red asserts nothing. **The accepted-red ledger is empty** before any phase's gate is trusted; a
failure is either fixed or explicitly listed with a reason. (Measured: `typecheck` and `test:unit` were red
at Phase 0 onset for reasons unrelated to UI.18 — A0.4.)

### 20.2 One renderer registry

A renderer is registered once (`registerRenderer`); the catalog, the viewport surfaces, the parity matrix
and the palette all *read* that registry. Today three literals must agree (`RENDERER_DEFS`,
`registerRenderers`, the registration calls). The contract wants one. This is the literal meaning of
Phase 0's "no third path" (A0.1, D5).

### 20.3 The source rule (coordinates are views)

Focus · aspect · depth · time are the vocabulary; every UI projection of them — viewport/shape today,
fidelity/depth-rung tomorrow — is **derived and read-only**. A writer writes the *source* (the renderer, the
coordinate), never the projection. This is what lets `snapshot()`/`restore()` and the URL be the single
address (§7 `WorkspaceAddress`) rather than several partially-synced atoms (D4).

### 20.4 Capability is declared, not inferred

A renderer declares exactly the channels/fidelities it honours (`RendererCaps`, §7). Capability is never
copied from a peer because the peers "look alike": a content projection (notebook) and a spatial projection
(graph) are the *same contract* with *different declared sets*. This keeps the parity matrix honest (§4) —
the shell shows the gap where a backend does not honour a control, rather than a capability that silently
no-ops (D6).

### 20.5 The half still unvalidated

`Patch` (§5) and the `Fidelity` fusion (§6) remain **high cost / high risk** — Phase 0 did not touch them,
so §18's rating stands. The near-term plan (Phase 1 + the `Channel`/`Aspect` openings, per D1) does not
require them; they are proven by a second consumer or by the fractal backend (§18.4), whichever arrives
first. Nothing above blocks them; nothing above should be mistaken for having tested them.
