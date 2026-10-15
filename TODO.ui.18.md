# UI.18 — The Backend Contract

**Status:** plan (settled) · supersedes UI.17 as the *organising* model. UI.16 built the plumbing
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

### Phase 0 — Declare the seam (no visual change)

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

_(fresh — to be filled as phases land, in the UI.17 style: file-by-file, with verification commands.)_

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

---

## 19. Fresh-session execution plan

**Status: READY.** Decisions resolved (§19.5). Start at §19.0.

### 19.0 Start here (first session, first commit)

Preconditions: read §1, §7, §8, §19.1; confirm D1/D2/D3 (§19.5). Then:

1. Branch: `git switch -c ui18-phase0`.
2. Execute §19.2 (Phase 0) — no behavior change; one logical commit per numbered task.
3. Run the verification battery (§19.6) before each commit.
4. Stop and report if an anticipated issue (§19.4) needs a decision.

The first concrete change is §19.2.1 (canonicalize renderer identity); nothing else starts until Phase 0
is green.

### 19.1 Orientation (verified facts a fresh session must not re-discover)

- **App entry:** `ui/src/client/index.html` → `entry.ts` → `app-layout.ts` (which imports
  `overlays/index.js`) → `<workspace-host>` mounts the active `WorkspaceRenderer` via `registerRenderer`.
- **Coordinate state today:** only **`$focus`** exists (derived from `$focusStack`). There are **no
  `$aspect` / `$depth` / `$time` atoms**; the shell instead has `$viewportMode` (`'2d'|'3d'`),
  `$graphShape` (`'graph'|'table'`), `$neighborhoodDepth` (1–3). **UI.17 Step 3 was done for focus only.**
- **Two 2D hosts, one viewport:** `graph-surface` switches among `<graph-viewport>` (2D),
  `<spacegraph-viewport>` (3D), `<s-view>` (table); `graph-viewport` is also the shape-`graph` view
  adapter tag. Not a file merge — a selector unification.
- **Modulation bypasses the contract:** `graph-viewport.ts:210` calls `applyDelta(cy, delta)` directly;
  structural data goes through `present/apply`. `Patch` (§5) is what brings visuals *into* the contract.
- **`spacegraphjs7` is a nested git repo** (a gitlink; root tracks one entry). Edits there are a separate
  commit; the Vite alias `spacegraphjs → spacegraphjs7/src/index.ts` (`ui/vite.aliases.ts:14-15`) makes
  local edits live in dev.

### 19.2 Phase 0 — task list (no behavior change)

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

**Verify:** `pnpm typecheck`, `pnpm --dir ui typecheck`, `pnpm test:unit`, `pnpm deps:gate`,
`pnpm exports:check`, `pnpm --dir ui test:unit`.

### 19.3 Phase 1 — task list (the bench, on Backend #1)

1. **Introduce the missing coordinates.** Add `$aspect`, `$depth`, `$time` atoms (defaults
   `content`/`0`/`live`) beside `$focus`; derive from / sync with the focus stack; deep-link via
   `encodeFocusFragment`/`decodeFocusFragment`. *This is the real UI.17 Step 3.*
2. **Thread the projection.** Give `RendererContext` the projection (focus·aspect·depth·time) + `theme` +
   `flags`; `workspace-host` passes it on mount and on change.
3. **Mount the Instrument (D2 = cosmetic-first).** Register `s-cycle-controls`, `s-trace-viewer`,
   `s-gate-inspector`; render them in a shell rail/overlay. Declare each control's honesty:
   - `cycle.state` — reads kernel state (`$cycleState`); fine.
   - `cycle.step` / `cycle.rewind` — **stubs**: messages are sent, no server handler exists.
   - `s-gate-inspector` — **stub** until the kernel exposes gate observation.
4. **Re-home the aspects.** Wire `s-explain` (Provenance), `s-timeline` (History), and the ambient pair —
   the **`s-ambient-layer`** background (already inside `graph-viewport`) **plus** the `s-events` overlay
   (Ambient) — to `$focus` + `$aspect` + `resolveFocus`.
5. **Wire prompt perception.** Route submitted utterances through `framework/prompt-perception.ts`
   (`perceivePrompt`) so a `turn` is a perceived concept (UI.17 §6); its test already passes.
6. **Origin (may ship empty).** Build an `Origin` surface only if a Judgment Manifold source exists;
   otherwise render its empty state and declare the gap (`ASPECT_SURFACES.origin === undefined`).

**Kernel companion (separate task; not a Phase 1 blocker).** No server handler exists for `cycle.step` /
`cycle.rewind`, and pause is local-only (`$reasoningRunning` is set from a server `cycle.state`).
Implement kernel handling + `cycle.state` emission, or keep the controls declared `partial`. This is what
turns the bench from cosmetic into real.

**Verify:** `pnpm --dir ui test:unit`, `pnpm --dir ui test:e2e:smoke`, a manual cycle-step smoke, and the
visual gallery (`test:visual:update` → `ui:gallery`).

### 19.4 Anticipated issues & mitigations

| # | Issue | Mitigation |
|---|---|---|
| I0.1 | 4 overlapping renderer/shape/mode selectors | pick one canonical id; derive the rest; keep URL param stable |
| I0.2 | `coordinates.ts` depends on `arrangement.ts` type | inline `ArrangementKind` or drop the table before deleting the module |
| I0.3 | retiring modules breaks root tests | prune `arrangement`/`composer` tests in the same commit |
| I0.4 | `RENDERER_CAPABILITIES` name collision | rename both; grep tests |
| I0.5 | "two 2D paths" is really two hosts, one viewport | unify selectors, not files |
| I0.6 | `graph-viewport.applyDelta` bypasses the contract | defer to Phase 2 (`Patch`), do **not** touch in Phase 0 |
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

### 19.6 Verification battery (run per phase)

```bash
pnpm typecheck && pnpm --dir ui typecheck
pnpm test:unit && pnpm --dir ui test:unit
pnpm deps:gate && pnpm exports:check && pnpm exports:barrels
pnpm --dir ui test:visual:update && pnpm --dir ui ui:gallery   # the DoD gate (§13)
```
