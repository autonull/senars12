# SeNARS SpaceGraph UI Specification — v3

**Codename:** `UI.sg3` — supersedes `ui/UI.sg.md` and `ui/UI.sg2.md`
**Implementation root:** `ui/src/client/spacegraph/` (+ shared backbone in `ui/src/client/utils/modulation/`)
**2D reference & parity:** `ui/src/client/components/graph-viewport.ts`

---

## 0. What this spec decides, and what it doesn't

The decision is **the layer-stack abstraction**: a small, ordered set of `Layer`s, each contributing a partial visual patch, composited top-down with a deliberately **limited** set of per-channel blend operations. Bindings between NAR dimensions and visual parameters are *config*, not code — that part inherits v2's contract. Lens and Axis from v2 collapse into specialized `Layer`s: the engine generalizes, the surface shrinks.

This is **not** a feature list, not a Photoshop clone, and not a binding table. The contract is one abstraction. Everything else is configuration.

---

## 1. The Abstraction — the Layer

### 1.1 Signature

A **Layer** is a named, ordered, visibility-toggled component that, when active, emits a partial patch over the **closed Channel Set** `C` for a given `(Item, View)`:

```
L : (Item, View) → ΔDisplay  | null
```

A Layer **never branches on Lens, never branches on Item.kind**, and **never reads other Layers' output**. It sees only its own bindings and the Item's `Field Set`. Layer composition happens *above* the Layers, in the **Compositor** (§1.5), which is the only engine code that knows there is more than one Layer.

### 1.2 Why a layer stack (not lenses)

A lens is a *value swap* — one interpretation active at a time, the others invisible. A layer stack is *additive* — many interpretations active simultaneously, ordered, opacity-weighted, visibility-toggled. For SeNARS the win is concrete: truth, priority, time, contradiction, focus are **orthogonal dimensions** users want to read **at the same time**, not pick between. "Is this concept well-supported *and* contradictory *and* high-priority?" is one glance, not three lens switches.

The cost of a stack over a swap is ordering and blend math. v2 paid for an unrestricted `⊗` algebra to absorb that cost. v3 restricts the algebra to three cheap per-channel compositors (§1.5), keeps the Layer abstraction simple, and drops ⊗ as a first-class operation.

### 1.3 Channel Set — closed, typed, finite

| Channel | Type | Compositor |
|---|---|---|
| `visibility` | `bool` | **AND** (any layer can hide; none can force-show past hidden) |
| `position` | `[x,y,z]` | **stack of offset maps** — see §1.6 |
| `scale` | `ℝ⁺` (per-axis optional) | **max** |
| `opacity` | `[0,1]` | **multiply** |
| `color` | `{h, s, l}` (HSL — single space) | **stacked alpha-over**, layer α = layer.opacity × channel-implicit α → see §1.5 |
| `stroke` | `{ width, color, dash, cap }` | per-field: width=**sum**, color=**alpha-over**, dash=**last-wins**, cap=**last-wins** |
| `glow` | `{ intensity, radius, color }` | intensity=**sum** (clamped), radius=**max**, color=**last-wins** |
| `lod` | `'glyph' \| 'card' \| 'inspector'` | **max** in the discrete order `glyph < card < inspector` |
| `flow` | `{ enable, speed, color, direction }` | enable=**OR**, speed=**max**, color=**last-wins**, direction=**last-wins** |
| `label` | `{ text, weight, size }` | text=**last-wins**, weight=**max**, size=**last-wins** |
| `shape` | `'sphere' \| 'box' \| 'rod' \| 'ribbon' \| 'freeform'` | **last-wins** |
| `zIndex` | `int` | **max** |
| `pointer.hitAreaScale` | `ℝ⁺` | **max** (a11y never shrinks) |

**Closed**: adding a channel is a contract change (PR touches `channels.ts` + one renderer impl + Zod entry). **Open**: Layers emit Δ over any subset. **Total**: Layer output missing a channel = no opinion (compositor falls through to lower layer).

### 1.4 Field Access — the only read boundary

A Layer accesses Item dimensions through:

```
get<T>(field: FieldKey): T | undefined      // safe; undefined if Item doesn't expose
has(field: FieldKey): boolean
fields(): ReadonlySet<FieldKey>
```

`FieldKey` is a dotted path (`'truth.f'`, `'budget.priority'`, `'derivesFrom.confidence'`, `'lens.score'`, `'focus.intensity'`, `'t'`, `'pinned'`, `'nodeType'`, `'term'`, …). Field existence is Item-kind-typed at compile time; `get` returns `undefined` silently at runtime. A Layer that reads a missing field must degrade to `null` (no patch) — enforced via `When(has(f), …)` wrappers in the config DSL (§2.3).

### 1.5 Compositor — the engine's only stateful component

```
composite : (LayerStack, Item, View) → ΔDisplay_final
```

Per Item, per frame:

1. Initialize `acc` with the substrate defaults (layout positions, identity shape, neutral color).
2. Walk the stack **bottom-up** (lowest zIndex-active Layer first). For each active Layer:
   - Compute `patch = L(Item, View)`.
   - If `patch === null`: skip.
   - For each channel in `patch`, look up the Compositor (§1.3) and fold into `acc`.
3. Project `acc` to the renderer's vocabulary. Unknown channels degrade silently.

The Compositor is **stateless across frames** and **deterministic** given `(stack, Item, View)`. Layer order in the stack is user-editable (drag in HUD); changes there invalidate memo.

**Critical constraint — the cheap-blend rule (v3's only math compromise):**

`color` is the only channel that needs composition beyond `{max, sum, multiply, AND, OR}`. To keep it cheap:

- `color` is **always HSL** inside the engine. RGBA conversion happens once at the renderer boundary.
- Each Layer's `color` patch carries an implicit α = `layer.opacity` (a Layer-level scalar, not per-pixel).
- Compositing two `color` patches is a **single alpha-over** in HSL space: `out.h = blend.h`, `out.s = blend.s * α`, `out.l = lerp(base.l, blend.l, α)`. No hue rotation, no YCbCr detour, no HDR.
- Three or more overlapping color Layers perform **at most N−1 sequential alpha-overs** (one per active Layer that emits `color`), in stack order. N is ≤ ~8 in practice; cost is ~N float lerps per Item per frame. Negligible.
- If overlapping color Layers produce an unreadable composite (e.g., three saturated hues stack), the resolution is **not** a smarter blend — it is **a stack reorder or opacity reduction by the user**. The engine does no corrective blending.

This is the line v3 draws: the blend arithmetic is unambiguous, deterministic, near-free; **readability is a Layer authoring concern**, not an engine concern.

### 1.6 Position: layout owns absolutes, Layers offset

`position` composition is special: Layers **sum offsets**, never write absolutes (except one named "Grid Region" Layer for the pinned WM set, which is absolute and replaces layout output for pinned Items — see §3.2). Substrate/lower layers are assumed to write absolute positions computed by the layout. Topmost ordering holds:

```
position_final = position_layout + Σ offset_i   (for each Layer i in stack order)
```

This keeps `ForceLayout` etc. authoritative for spatial memory; Layers nudge.

### 1.7 Determinism & memoization

Layer output is memoized on `(Item.id, View.bucket, layer.opacity, layer.visibility)`; invalidation on `fields()` diff. Given a fixed stack and fixed atoms, the compositor output is **bit-identical across frames and across reconnects**. This is the contract that makes WS resilience (§2.7) and parity tests (§6.5) shippable.

---

## 2. Layer kinds

Layers are categorized by the *role* they play in the stack — config fragments, **not** subclasses. The kinds exist only to give future authors a vocabulary; the engine treats every Layer identically.

### 2.1 Identity Layer (always bottom)
Stable per-Item-kind baseline: concept → sphere, message → card, derivation → flow edge, thread → wire. No opinion about truth, priority, time. Emits `shape`, `lod='glyph'` (default), `color` neutral, `position` (none — layout owns it), `flow={enable:false}`.

### 2.2 Dimension Layer (the workhorse)
The shape of every binding v2 used as an example, recast as a Layer:
- A **Dimension Layer** binds a single Item Field to one or more channels via a `Map(field, fn, channels)` declaration (§2.3).
- Many can coexist (`truth-→-lightness`, `priority-→-scale`, `lens.score-→-opacity`, `derivesFrom.confidence-→-flow.speed`, `t-→-position.z` when axis=time, …). Each is independent, individually invisible.
- A Dimension Layer that depends on Item Fields the Item doesn't have degrades to `null` automatically.

### 2.3 Config DSL — declarative Layer authoring

```yaml
layer:
  name: "truth-lightness"
  kind: dimension
  opacity: 1.0
  visible: true
  when:
    field: truth.f           # gate: Item must expose truth.f
  emit:
    color.lightness: "35 + 35 * v"
```

The DSL compiles to a `Layer` instance. The full grammar is intentionally narrow:

```
Layer ::= name, kind, opacity, visible, when?, emit
when   ::= { field: <FieldKey> }                  # Item must expose Field
         | { axisMode: <'priority' | 'time' | 'none'> }    # axis-mode match
         | { viewFlag: <'reducedMotion' | 'forcedColors' | …> }
         | { all: [when, …] } | { any: [when, …] }
emit  ::= { <channel.path>: <expr string> | { value: expr, alpha?: expr } }
expr   ::= JS expression in $($field), $view.bucket, $layer.opacity, $item.id
```

That's it. No control flow. No function defs. New Layers are config; the engine never changes to add one.

### 2.4 Interaction Layer
Selection, multi-select, hover, focus glow, working-memory pin boost. Emits `glow`, `stroke`, `scale`. **Cannot** emit `position`, `color`, `flow`, `lod` — these are reserved for Identity / Dimension / LOD Layers to keep interaction from drowning analysis.

### 2.5 Accessibility Layer
Mandatory in the stack if any accessibility flag is set. Emits:
- `pointer.hitAreaScale = 1.5` under forced-colors
- `flow.enable = false` under `prefers-reduced-motion`
- redundant `stroke.dash` and `shape` signals whenever a Dimension Layer's binding relies on color alone (declared via a `colorblind-redundancy` manifest entry)

The a11y Layer is the **highest-priority writer** for the channels it owns — it sits **above** all others in the stack and uses "last-wins" compositors to override without negotiation.

### 2.6 LOD Layer
Maps `View.bucket` (quantized zoom) to the `lod` channel and optionally scales `label.size`, `label.weight`, `flow.enable`. Replaces v1/v2 bespoke LOD code as a single Layer that uses `lod`'s `max` compositor (so inspector-affordance Layers can promote an Item to `inspector` regardless of zoom).

### 2.7 Overlay Layer
Non-Item visual context: connection banner, minimap, hud, working-memory grid region. Only an Overlay Layer may write absolute `position`. There is exactly **one** Overlay Layer per active overlay element; the stack can hold several.

### 2.8 Mandatory Layer ordering

```
Identity → Dimension* → LOD → Interaction → Accessibility → Overlay*
```

Stack is sorted by kind on insertion (config can't accidentally shadow a11y with a Dimension). Within a kind, user-defined order applies. Drag-reorder in the HUD is permitted **within a kind** only — cross-kind reorder is forbidden to preserve the invariants in §6.

Order matters only when two Layers write the same channel with the **same** compositor-decision (e.g., two Dimension Layers both emit `color` → alpha-over stack per §1.5). Cross-kind Layers write largely disjoint channels, so ordering cost is low.

---

## 3. Volumes — the visible feature layer

This section enumerates concrete Layers Ship-the-volume. The intent is **only** to show the abstraction expresses the product; bindings remain *config*, not engine code.

### Volume 1 — Read substrate (L0)
- Identity Layer (concept/message/edge/wire)
- LOD Layer (zoom → glyph/card/inspector)
- WS-connect → snapshot → atoms → compositor pipeline

Result: a graph. Pan/zoom persists per axis-mode. Click → `node-detail-drawer`.

### Volume 2 — Truth & priority readable (L1)
- `truth.f → color.lightness` (Dimension)
- `truth.c → color.saturation` (Dimension)
- `budget.priority → scale` (Dimension)
- `budget.priority → position.z` when axisMode='priority' (Dimension, axis-gated)
- `lens.score → opacity` (Dimension — note: still per-lens, but `lens.score` is just a Field the server already computes; multiple Dimension Layers stacking for the same Item can produce the multi-lens-at-once effect that v1 couldn't)

Multi-lens-at-once: load two Dimension Layers binding `lens[belief].score → opacity` and `lens[contradiction].score → stroke.color:red-with-alpha`. The user sees well-attested beliefs vividly **and** contradictory ones outlined — simultaneously, no swap. This is the user-visible payoff of Layers vs. Lenses.

### Volume 3 — Derivations flow (L1)
- `derivesFrom.confidence → flow.speed` (Dimension)
- `derivesFrom → flow.enable=true, flow.color = source.lens.color` (Dimension)
- Only `derivesFrom` / `supports` edges carry a `flow` channel opinion via the Identity Layer.

### Volume 4 — Pin / working memory (L2)
- Overlay Layer: "WorkingMemoryGrid" positions pinned Items on a GridLayout region; emits absolute `position` for pinned Items only (gated by `has('pinned') && get('pinned')===true`).
- Interaction Layer: "PinBoost" emits `scale *= 1.4`, `glow.intensity += 2`, `stroke.width += 1`, `opacity = max(opacity, 0.85)` for pinned Items.
- Pin/unpin via `node-detail-drawer` — no drag-and-drop required in L2 (deferred).

### Volume 5 — Edit (L2)
- Inspector (L1's LOD `inspector` setting) reveals a form derived from `Item.fields()`:
  - String fields (term) → `contentEditable`, debounced 400ms → atom setter
  - Scalar fields (priority, truth.f, truth.c) → slider with live readouts `Truth.expectation`, `Truth.harshness` (imported from `nar/src/terms/truth.ts:73-77`)
  - Enum fields (nodeType, punctuation) → dropdown
- Edit is the **dual** of read: Items are read by Layers, written by affordances. No Layer ever writes Items.

### Volume 6 — Time axis + scrubber (L3)
- Dimension Layer `t → position.z` is gated by `when: { axisMode: 'time' }`; axis-mode toggled by `H` key independently of any "lens."
- Overlay Layer "HistoryScrubber" emits `visibility = false` for any Item with `t > scrubberT`.
- Camera does not travel; the user travels the data via the scrubber. Time is a ** Layer**, not a viewport.

### Volume 7 — Accessibility (mandatory)
- Accessibility Layer enabled by flags (§2.5). CI gate: any binding that emits only `color` must declare a redundant non-color channel; the a11y Layer auto-fills it.

Volumes are *shipped Layers*, not features bolted into a viewport. Volume 1 → Ship → Volume 2 → Ship → … Each volume gates before advancing (§7).

---

## 4. What the abstraction does **not** promise

- The most "beautiful" mesh of overlapping Layers is not guaranteed by the engine. **Readability is the author's problem.** The Compositor does what it's told, in order, with the cheapest math that honors the channels' semantically correct blend. If two color Layers stack into mud, that's a Layer-opacity tuning problem.
- "Lens-aware" behavior is not built-in. A v1 "lens" is just two or three Dimension Layers that happen to share their `lens.score` Field and are typically toggled one-at-a-time. Nothing in the engine treats them as mutually exclusive; the user can leave several on.
- "Multi-agent federation," "tunnels," "decks," "physics springs," "tours" — none of these are Layers, because none of them bind a Field to a Channel. They are spectacle and remain forbidden (§5).
- The engine does **not** auto-derive Layers from NAR Field introspection. Layers are explicitly authored in config and shipped. Introspection happens only at the inspector-form level (§3 Volume 5).

---

## 5. Forbidden — non-negotiable

- A Layer branching on `Lens.name` or `Item.kind` inside its emit function. Invariant #8 (§6).
- A Layer writing a channel it doesn't own per §2 (e.g., a Dimension Layer writing `position` absolute). The config DSL enforces this via typed Layer kinds.
- Custom node types beyond {HtmlNode, ShapeNode} in core. New types ship behind the same Layer interface, never ad-hoc.
- Custom layout algorithms — only the 11 built-ins (`ForceLayout`, `GridLayout`, `CircularLayout`, `HierarchicalLayout`, `TreeLayout`, `TimelineLayout`, `SpectralLayout`, `ClusterLayout`, `RadialLayout`, `GeoLayout`, `BaseLayout`).
- Tunnels, decks, gsap narrative tours, particle-burst resolutions — no Field→Channel derivation possible.
- PhysicsPlugin springs as visual ("contradiction tension"). Springs are allowed as a `position`-offset Layer only if proven useful; never as a "resolution" animation.
- Yjs/CRDT collaborative editing, plugin marketplace, theming, mobile, PWA, offline, in core.
- An a11y Layer emitting only color (must redundantly emit stroke/shape/pointer).
- Treating "form follows function" as decoration license — every channel must trace to a Field, axis-mode, view-flag, or Item-kind-marker.

---

## 6. Invariants — machine-checked per commit

1. **Layer totality** — For every `(Item, View)` and every active Layer, the Layer evaluates to `Δ | null` without throwing and without reading undefined Fields. Enforced by `when` gates + `Clamp`.
2. **Channel closure** — `Δ.keys() ⊆ C`. TS discriminated union + Zod at config boundary.
3. **Compositor determinism** — For fixed `(stack, Item, View)`, composite output is bit-identical across frames and runs. Memoized on the same key.
4. **Compositor purity** — The Compositor never mutates `Item`, `Layer`, `View`.
5. **Position-offset law** — Every Layer except Overlay emits `Δ.position` as offset (sum-composited); Overlay Layers emit absolutes; Layout output is the substrate absolute. Audit: for each Item, `|final_position − layout_position − Σ offset_i| < 1e-6`.
6. **Cheap-blend law** — `color` compositing performs only sequential HSL alpha-over per stack order; no other color-arithmetic is permitted in the codebase.
7. **2D/3D parity** — `2D.project(Δ_final) ≈ 3D.project(Δ_final)` modulo renderer-missing channels (documented per renderer). CI regression over a fixed (Items × stack) matrix.
8. **No lens/kind branching** — Codebase grep for `switch (lens.name)` or `switch (item.kind)` *outside* Layer definitions fails the build.
9. **Layer-kind channel ownership** — Interaction Layers must not emit `position | color | flow | lod`; Accessibility must not be below any non-Overlay kind in the stack; etc.
10. **Layer activation symmetry** — Toggling a Dimension Layer off then on produces bit-identical compositor output for the prior state.

---

## 7. Verification gates (cumulative, machine-checked)

| Volume | Gate |
|---|---|
| **V1 — Substrate** | WS connect → 300 nodes stable → toggle any Dimension Layer on/off produces zero layout invocations → pan/zoom persists per axis-mode → reconnect restores state bitwise |
| **V2 — Truth/Priority visible** | For a fixed snapshot, `truth.f` recoverable from `color.lightness` within 0.05; `truth.c` from `saturation` within 0.05; `budget.priority` from `scale` within 0.05 |
| **V3 — Derivation flow** | New `derivesFrom` op produces exactly one traversal particle first frame, layer-gated by flow.enable |
| **V4 — Pin/WM** | Pin 5 concepts → grid region populates → dimension layers above still apply → unpin → grid collapses; pin set survives WS reconnect |
| **V5 — Edit** | Inspector form contains exactly the Fields in `Item.fields()`, no more, no less; truth editor's live `expectation/harshness` use the exact formulas in `nar/src/terms/truth.ts:73-77`; edit round-trip via atom setter → server delta → compositor re-applies identical to local prediction |
| **V6 — Time** | Axis-mode `time` preserves X,Y of every Item; scrubber gate hides Items with `t > scrubberT` exactly |
| **V7 — Accessibility** | With `prefers-reduced-motion`, flow.enable=false on every Item with derivation; with forced-colors, `pointer.hitAreaScale = 1.5`; CI grep fails on any color-only Dimension Layer without a declared redundant channel |
| **Ship** | All algebra invariants green; parity diff green; a11y audit green; performance budget 300 nodes + 600 edges ≥30fps on a 2020-class laptop |

---

## 8. Implementation surface

| Piece | File | Responsibility |
|---|---|---|
| Channels + types | `utils/modulation/channels.ts` | Closed channel set, per-channel compositor, Zod schema |
| Fields | `utils/modulation/fields.ts` | FieldKey dotted-path; `get/has/fields`; per-ItemKind FieldSet |
| Layer | `utils/modulation/layer.ts` | `Layer` interface; DSL evaluator; `when` gates; `emit` to Δ |
| Compositor | `utils/modulation/compositor.ts` | Stack steering, per-channel composition, determinism + memo |
| Config schema | `utils/modulation/config.schema.json` (Zod) | Layer DSL schema; the only file non-engine authors edit |
| Built-in Layers | `utils/modulation/layers/*.ts` | Identity per ItemKind, LOD, a11y, PinBoost, WMPGrid, HistoryScrubber |
| Config catalog | `utils/modulation/config/*.yaml` | All Dimension Layers ship as YAML, not TS |
| 3D renderer | `spacegraph-viewport.ts` | Consumes `composite(stack, item, view)`, projects to SpaceGraph |
| 2D renderer | `components/graph-viewport.ts` | Consumes `composite(stack, item, view)`, projects to Cytoscape |
| HUD | `components/layer-stack-panel.ts` (new) | Drag-reorder within kinds, opacity sliders, visibility toggles |
| Inspector | `components/node-detail-drawer.ts` | Auto-form from `Item.fields()`; per-FieldKind renderers (slider/toggle/text/dropdown) |
| Tests | `tests/visual/compositor.test.ts`, `tests/visual/parity.test.ts`, `tests/visual/dsl.test.ts` | Algebra laws, parity diff, declared-Layer round-trip |

Finite and bounded: the abstraction ships in ~6 new core files + small edits to the two viewports + one new HUD panel. Layers themselves are config files.

---

## 9. Decision log

| Decision | Rationale |
|---|---|
| **Multi-Layer stack, not Lens swap** | SeNARS dimensions are orthogonal; users want several visible at once (truth **and** contradiction). Lens swap forced uni-modal reading; Layer stack lets orthogonal bindings stack. |
| **Restrict blend operations to a 5-function closed set** (`AND`, `sum`, `max`, `multiply`, `last-wins`, plus single-pass HSL alpha-over for `color`) | v2's general `⊗` algebra was implementable but bespoke blends risk muddy output and unbounded bug surface. A restricted compositor is implementable in a day and forces readability to be solved at authoring time, not by cleverer math. |
| **Cheap color blend: sequential HSL alpha-over** | One lerp per channel per Layer per Item per frame — well under 1% frame budget at 300 nodes × 8 layers. No HDR, no YCbCr, no hue rotation. Readability from N color Layers is the author's problem. |
| **Layer kind channels are restricted by the DSL** | Prevents a Dimension Layer writing `position` absolute and overwriting layout — kills the spatial-memory guarantee. |
| **Overlay Layers are the only absolute-position writers** | Confines layout-overriding behavior to one named kind; an Overlay Layer is per-element (WMP grid, scrubber), auditable. |
| **Layer ordering: `Identity → Dimension* → LOD → Interaction → Accessibility → Overlay*`** | a11y above Dimension so its overrides hold; Interaction above Dimension so selections read atop analysis; Overlay above all so screen-positioned elements win when relevant. |
| **Layer DSL is YAML, not TS** | Bindings are config; non-engine authors can add them without engine PRs. DSL is intentionally narrow (no control flow) to keep the engine's totality invariant verifiable. |
| **Multi-lens-at-once surfaces naturally** | No swap concept. Two `lens[<x>].score → channel` Layers active simultaneously; the user toggles instead of switching. v1/v2 lens switching collapses into a stack convention. |
| **Inspector auto-forms from `Item.fields()`** | Same Field Set feeds Layers and the editor — a new truth dimension is immediately editable, not engineered twice. |
| **10 invariants — machine-checked per commit** | The elegance claim is only credible if enforced. Invariant grep failures block the build. |
| **9 Layers (Volumes) are the prior product, not the spec** | The Layers in §3 are illustrative Ship volumes, not the contract; the contract is §1. New volumes are config. |
| **2D viewport kept as parity reference, not discarded** | Forces the abstraction to be renderer-agnostic. 3D spectacle features that can't reduce to 2D projections are surfaced as smell — a useful self-correcting signal. |

---

## 10. Diff against v2

| v2 element | v3 disposition |
|---|---|
| `M : (Item, Lens, View) → ΔDisplay` | `L : (Item, View) → ΔDisplay \| null`. Lens retired. |
| Lens as a "value swap" first-class concept | Becomes a *stack convention* — multiple `lens.score → channel` Layers active together. |
| Axis orthogonal to Lens | Axis becomes a `when.axisMode` gate inside a Layer. Same orthogonality, simpler surface. |
| `⊕` channel-union, `⊗` per-channel blend, `⟜` sequential override, `Lift`, `Permute`, `Scale`, `Clamp`, `Memo` | Compositor with 5 functions + sequential HSL alpha-over. No `⊕⊗⟜` operator algebra. `Lift/Permute/Scale/Clamp/Memo` collapse into the Compositor's per-channel fold. |
| Per-channel blend tables (associativity, distributivity checks) | Per-channel `Compositor` fn table (smaller; no algebra laws to verify). |
| "Modulation compile + apply" two-phase | "Layer emit + Compositor fold" two-phase. Same separation, simpler surface. |
| 10 invariants | 10 invariants (updated to Layer vocabulary; positions/blend/kind-ownership added). |
| §4 example bindings | Become Volume Layers in §3, still not the spec. |
| §5 implementation surface (~5 files) | ~6 core files + 1 HUD panel (+ config YAMLs as ship-time additions, not engine). |

---

*End of specification. The contract is a Layer stack with a restricted Compositor. Everything else is configuration.*
