# SeNARS SpaceGraph UI Specification — v2

**Codename:** `UI.sg2` — supersedes `ui/UI.sg.md`
**Implementation root:** `ui/src/client/spacegraph/` (+ shared backbone in `ui/src/client/utils/modulation/`)
**2D reference & parity check:** `ui/src/client/components/graph-viewport.ts`

---

## 0. Orientation

This document defines **one abstraction** and the architectural guarantees that let it express any visual encoding the product will ever need. Bindings between NAR dimensions and visual parameters are not part of the contract; they are *phrases* of the language defined here. The spec's job is to make the language complete, closed, cheap to speak, and impossible to misuse.

---

## 1. The Abstraction — Modulation

### 1.1 Signature

A **Modulation** is a pure function:

```
M : (Item, Lens, View) → ΔDisplay
```

with:

- **Item** — anything that has an identity a graph vertex represents: a concept, a message, a derivation, an edge, a working-memory pin, a focus mark. An Item exposes its **Field Set** `F(I)`: the set of named scalar/enum/vector dimensions NAR knows about it (`priority`, `truth.f`, `truth.c`, `durability`, `cycles`, `depth`, `term`, `nodeType`, `punctuation`, `t`, `links[].strength`, `lens.score`, `focus.intensity`, `pinned`, `derivesFrom.confidence`, …open-ended).
- **Lens** — a named interpretation *mode*, fully defined by: (a) a `score` expression over `F(I)`, (b) which Fields it deems salient, (c) which axis-time semantics are in force (`axis.z := priority` vs `axis.z := time`, etc.). Lens is a value, not a code branch.
- **View** — the renderer-agnostic projection context: zoom `d`, viewport bounds,.ItemInside flag, motion budget, current axis-mode, accessibility flags (`prefers-reduced-motion`, forced-colors, etc.). The View never inspect Item internals; it is the user's window onto the graph.
- **ΔDisplay** — a partial patch over the universal **Channel Set** `C`: `position`, `scale`, `rotation`, `color`, `opacity`, `stroke` (width, color, dash), `glow`, `lod`, `flow` (speed, color, enable), `label` (text, weight), `shape`, `z-index`, `pointer` (hit-area scale). All channels are optional; a Modulation writes only the channels it changes.

### 1.2 Algebraic shape — what makes this the *epitome of elegance*

A Modulation is **first-class**, **composable**, **pure**, and **total**:

```
M ≜ Leaf f          — f : (Item, Lens, View) → ΔDisplay
  | Const Δ          — emit fixed patch
  | M₁ ⊕ M₂         — channel-union; later wins on conflict (⊕ associative, identity = ε)
  | M₁ ⟜ M₂         — M₂ applied first, M₁ overrides on overlap (sequential semantic)
  | M₁ ⊗ M₂         — element-wise blend on each overlapping channel with a weighter (see §1.5)
  | Field k ⇒ M      — only applies when Item exposes Field k; else ε
  | When p M         — only applies when predicate p(View, Lens) holds; else ε
  | Lens L ⇒ M       — only under lens L (specialization of When)
  | Axis X ⇒ M       — only under axis-mode X (specialization of When)
  | Lift c M         — projects M's output onto channel c only (discard others)
  | Permute π M      — M's output channels renamed by permutation π
  | Scale α M        — multiplies scalar-valued channels by α
  | Clamp M          — clamps channel values to validated ranges (type-safe)
  | Memo M           — K=(Item.id, Lens, View.d-bucket) cache; invalidates on Item.field change only
  | ε                — identity Modulation
```

There are exactly **two operations** the system ever invokes at runtime:

1. **Construct** a Modulation tree from declarative config (one-time per render pass).
2. **Apply** it: `M(I, L, V)` returns a `ΔDisplay` patch that the renderer consumes.

No rendering code branches on lens/type/field. Every visual effect in any future feature is expressible as `Building block ⊕ Combining rule`. This is the contract.

### 1.3 The Channel Set — closed, total, type-safe

| Channel | Type | Range / Notes |
|---|---|---|
| `position` | `[x,y,z] ∈ ℝ³` | modulator may write any axis; layout owns defaults |
| `scale` | `ℝ⁺` (per-axis optional: `[sx,sy,sz]`) | |
| `rotation` | `Quaternion \| [yaw,pitch,roll]` | rarely used — defer unless required |
| `color` | `{h?,s?,l?,a?} \| {r,g,b,a}` | all encodings after alpha-composite resolve to rgba |
| `opacity` | `[0,1]` | multiplies with color.a |
| `stroke` | `{ width?, color?, dash?, cap?}` | edges, strokes around nodes |
| `glow` | `{ intensity, radius?, color? }` | additive |
| `lod` | `'glyph' \| 'card' \| 'inspector'` | renderer-mapped final level |
| `flow` | `{ enable, speed?, color?, direction? }` | only derivation-class edges use this |
| `label` | `{ text?, weight?, size? }` | |
| `shape` | `'sphere' \| 'box' \| 'rod' \| 'ribbon' \| 'freeform'` | |
| `zIndex` | `int` | for DOM-overlay layering |
| `pointer` | `{ hitAreaScale }` | accessibility-relevant: enlarge hit targets independent of visual scale |

A Modulation may emit Δ over **any subset**; the renderer is contractually obligated to accept the union over all channels and ignore `undefined`. The Set is closed: a new channel needs one PR adding a field + a renderer impl — **no modulator code changes**.

### 1.4 Field Access — the only `Read` boundary

Modulations never inspect Item shape directly. They use three primitives:

```
get<T>(field: FieldKey): T | undefined      // safe; undefined if Item doesn't expose
has(field: FieldKey): boolean
fields(): ReadonlySet<FieldKey>
```

`FieldKey` is a dotted path (`'truth.f'`, `'budget.priority'`, `'links[0].strength'`, `'lens.score'`). Field existence is *Item-level*, known and typed per Item-kind at compile time via the `FieldSet<T>` interface; runtime access falls through silently — no exceptions, no sentinels. A Modulation that reads a Field the Item doesn't have evaluates to `ε` (per `Field k ⇒ M`). This is what keeps Lenses portable across Item kinds.

### 1.5 Blending operators — channels don't clobber, they compound

To support multiple Modulations cooperating — and emergent encodings from many weak signals — the channel set defines an algebra per channel:

| Channel | Blend semantics |
|---|---|
| `position` | **sum** (offsets compose physically) |
| `scale` | **product** (intensifiers compose multiplicatively) |
| `opacity` | **product** |
| `color` | **alpha-over compositing** (Premul; declared source α) |
| `stroke.width` | **sum**; `stroke.color` = alpha-over |
| `glow.intensity` | **sum** (additive in HDR space); `glow.color` = alpha-over at the *last* write |
| `lod` | **max** in the discrete order `glyph < card < inspector` |
| `flow.speed` | **max** (fastest derivation wins); `flow.enable` = OR; `flow.color` = source-lens |
| `label.weight` | **max** |
| `zIndex` | **max** |
| `shape` | **last-wins** (explicit `Lift`/`Permute` output only) |
| `pointer.hitAreaScale` | **max** (a11y never shrinks) |

`M₁ ⊗ M₂` reads each channel's op from the table. `M₁ ⊕ M₂` is "merge with later-wins on channels where blend is undefined" (e.g., `shape`); ⊕ and ⊗ are associative, commutative; ε is the identity.

This makes "two Modulations agree" a flat algebraic statement — not a review-time graphic-design decision.

### 1.6 Composition Law — the render pipeline

Per frame, the system constructs a **single Modulation per Item**:

```
M_item = clamp( axis ⊗ lens ⊗ topology ⊗ interaction ⊗ accessibility ⊗ identity )
      ⊕  forced_overrides(V)
```

where (each is a Modulation whose internal structure is configuration-defined):

- **identity** — stable per-Item-kind baseline (concept-sphere, message-card, derivation-flow). Never expresses an opinion about NAR truth.
- **lens** — emits from `lens.score` and a lens config (which Fields it deems salient, which channels it touches, which axis-mode it sets).
- **axis** — applies an axis-mode (e.g., `z := priority` or `z := time`); only writes position.z and only when axis-mode is set.
- **topology** — positionals influenced by neighbors (repulsion by term similarity, thread spine on Y=time, grid region for pinned set). Writes only `position`.
- **interaction** — selection, multi-select, hover, focus glow. **Cannot** change topology, stroke, or flow (separation of visualization interaction from Item state).
- **accessibility** — lifts `pointer.hitAreaScale`, dampens motion under reduced-motion, enforces high-contrast, suppresses pure-color encodings by emitting redundant `stroke.dash` / `shape` signals.
- **forced_overrides(V)** — non-negotiable View-level overrides (e.g., `pointer.hitAreaScale=1.5` under forced-colors).

The act of *adding a lens* is now a configuration object: a score expression, a salience list, an axis-mode, and lens-local Modulation fragments. The act of *adding a feature* is a new Modulation fragment inserted into the composition. The engine code never changes.

### 1.7 Render parity — the 2D/3D invariant

The Cytoscape-based `graph-viewport.ts` and the SpaceGraph-based `spacegraph-viewport.ts` are **both** consumers of `M_item`. Modulations emit Δ over the *closed* Channel Set; each renderer projects Δ onto its own visual vocabulary:

```
3D renderer :  position→worldVec3,  color→material,  flow→FlowEdge particles,  glow→emissive,  lod→HtmlNode LOD
2D renderer :  position→pan/pann+offset, color→cytoscape bg, flow→animated dashed edge, glow→drop-shadow, lod→css label
```

Channel values the renderer cannot express (rotation in 2D; zIndex-decimated shape) degrade silently to the renderer's nearest supported interpretation. **Determinism gate**: For any (Item, Lens, View) snapshot, both renderers' output trace through the same Modulation tree. Tests diff Modulation deltas, not pixels.

---

## 2. Lifecycle & Substrate

These are the operational guarantees that make the abstraction shippable.

### 2.1 Atoms are the only input source
All graph state lives in atoms (`$graphNodes`, `$graphEdges`, `$activeLens`, `$viewport`, `$selectedNodeId`, `$selectedNodeIds`, `$lensViewport`, `$graphFilter`, `$workingMemory`, `$focusTerm`, …). SpaceGraph holds no authoritative graph state. `syncGraph()` does diff-and-apply, *position-preserving* (existing logic in `spacegraph-viewport.ts:240`).

### 2.2 Lens = value, never a branch
A Lens is `{ name, scoreExpr, salientFields, axisMode, modulations: { lens: Modulation } }`. Switching the active lens swaps the value bound to `$activeLens`; nothing inspects the name in a switch-case.

### 2.3 Axis is a separate concern from Lens
Axis-mode is `{ 'priority' | 'time' | 'none' }` for `position.z`, plus `{ 'time' | 'none' }` for `position.y`. Set by Lens config *or* a direct user toggle (`H` key). The **Same lens, different axis** combination is legal. Decouples "how I see" from "what I see."

### 2.4 Layout owns defaults; Modulations offset
`ForceLayout` etc. produce baseline `position`. The `axis` and `topology` Modulations write *offsets* (§1.5 sum-blend), not absolutes — except the `grid` region for the pinned Working-Memory set, which is absolute. The lattice is: layout → axis offset → topology offset → interaction offset.

### 2.5 Edit is a Modulation reverse-mapping, not a UI primitive
Writes go from Modulation-derived affordances → field setters → atoms → server. The inspector (§3) computes form values directly from `Item.fields()`. Editing is not coupled to Modulation; it's the dual: Items are read by Modulations, Items are written by affordances.

### 2.6 Determinism & memoization
Each Modulation receives a `View` with a quantized zoom bucket (`d-bucket`) and a stable `Item.id`. Memo at `(id, lens.name, axisMode, d-bucket, accessibilityFlags)`; invalidate on `Item.fields()` diff per id. Modulations never call `Date.now()` or read globals — they're stateless.

### 2.7 Resilience
WS drop, reconnect, snapshot re-apply must produce an identical modulation stream. Pinpoint gate: replay of recorded `cognitive.delta` events yields bit-identical Δ sequences per item.

---

## 3. Affordances — what the abstraction is *used for*

Affordances are functions of displayed Items and user inputs — not of Modulations. The list is intentionally short and frozen per Layer; new affordances require a Modulation fragment and not a viewport change.

### L0 — Read-only substrate
- Click → `$selectedNodeId`; opens `node-detail-drawer`.
- Shift-click → toggle in `$selectedNodeIds`.
- `Esc` → deselect; close drawer.
- `1/2/3` → set `$activeLens`.
- `H` → toggle `axis.z := time` axis-mode.
- Pan/zoom persists per `(lens, axisMode)` in `$viewportByLens`.

### L1 — Density-driven reveal
- LOD by `view.d-bucket` (drives `lod` channel via a Modulation; renderer maps the discrete `glyph/card/inspector`).
- Long-press / hover ≥ 600ms at card LOD promotes to inspector for that Item only — no global state change; no tooltip popover.
- Edge flow visible only at `d-bucket ≥ card`; auto-dimmed otherwise (a Modulation, not a viewport branch).

### L2 — Edit / steer
- Inspector exposes a form built from `Item.fields()` (read) and writes atoms back (write). Truth editor lives here; uses `Truth.expectation`/`harshness` from `nar/src/terms/truth.ts:73-77` purely as live-computed readouts.
- Pin/unpin via drawer; "pin" ⇒ membership in `$workingMemory` ⇒ `identity ⊗ lens ⊗ pinned-boost` Modulation.
- `focus.set` carries optional `intensity ∈ [0,1]`; the `focus` Modulation reads it as a multiplier on `glow.intensity`.

### L3 — Time
- Axis-mode `H` swaps `axis.z := time`. A scrubber ribbon gates *which Items have `t ≤ scrubberT`* — implemented as a Modulation overriding `opacity` to 0 (and excluding from pointer) for newer Items. No "camera time-travel" concept — the camera holds still.

---

## 4. Binding language — how to *speak* a Modulation (illustrative)

Because the abstraction is the contract, not a binding. The following are **example sentences** demonstrating coverage; they are *not* the spec. They are kept only to validate the abstraction both directions (anything NAR says about an Item → some Δ on some channel).

> **Reading note:** every block below is of the form *X dimension → Y channel*. The point is not "we chose this mapping" — the point is "the abstraction **accepts** this mapping and infinitely many others, with zero engine changes." Swap any cell for any other and the system behaves identically.

- `truth.f → color.lightness`                        — `Lens.modulation = Field('truth.f')  ⇒ Map fn(v) → {color:{l: 35 + 35*v}}`
  *(demonstrates scalar→channel sub-key with a smooth map; `truth.c → color.saturation` is a sibling fragment blended by ⊕ → color composites in HSL)*
- `priority → scale`                                 — `Field('budget.priority') ⇒ Map(v) → {scale: 0.6 + 0.8*v}`
- `priority → position.z (axis:priority)`            — `Axis('priority') ⇒ Field('budget.priority') ⇒ Map(v) → {position:[0,0,(v−0.5)*200]}`
  *(same Field, two different channels, two different axis-modes — proves non-canonicalization)*
- `lens.score → opacity`                              — `Lens(name) ⇒ Field('lens.score') ⇒ Map(v) → {opacity: 0.25 + 0.7*v}`
- `focus.intensity → glow.intensity`                  — `Field('focus.intensity') ⇒ Map(v) → {glow:{intensity: 3*v}}`
- `derivesFrom.confidence → flow.speed`               — `Lens('belief') ∧ Field('derivesFrom.confidence') ⇒ Map(v) → {flow: {enable:true, speed: 250+750*v}}`
- `punctuation → stroke.dash`                         — `Field('punctuation') ⇒ Match({ '!':'long', '?':'dot', '.':null }) ⇒ Map(d → {stroke:{dash:d}})`
  *(a11y-redundant with color encoding — proves the closed-channel constraint: extra signal is **free**, never invention)*
- `t → position.z (axis:time)`                        — `Axis('time') ⇒ Field('t') ⇒ Map(v) → {position:[0,0,(v−t0)*k]}`
- `links[].strength (max) → stroke.width`             — `topology Modulation` aggregates neighbors
- `forceZ similarities repulsion → position.x,y`     — emitted by layout, blend semantics = `position` is sum-of-offsets
- `prefers-reduced-motion → flow.enable=false`        — `When(V.flags.reducedMotion) ⇒ Const({flow:{enable:false}})`

Each example phrase is one Modulation fragment placed into the `identity ⊗ axis ⊗ lens ⊗ topology ⊗ interaction ⊗ accessibility` composite. They compose automatically via ⊗ per-channel. **No engine code is modified.** New bindings can be added by a config object at runtime.

This is why the abstraction is the spec's **only** decision.

---

## 5. Implementation surface ( pieces of contract — *not* project plan )

| Piece | File | Responsibility |
|---|---|---|
| Channel + Field typing | `utils/modulation/channels.ts`, `utils/modulation/fields.ts` | Closed channel set; per-channel blend op; FieldKey dotted-path with compile-time narrowing per ItemKind |
| Modulation algebra | `utils/modulation/modulation.ts` | Operators (Leaf, Const, ⊕ ⊗ ⟜, When, Axis/Lens/Field ⇒, Lift, Permute, Scale, Clamp, Memo, ε) + evaluator |
| Composition root | `utils/modulation/compose.ts` | `composeIdentityLensAxisTopologyInteractionA11y(config)` |
| Declarative config schema | `utils/modulation/config.schema.json` (Zod) | One file describing Lens/Axis/Modulation fragment config; the *only* file non-engine authors edit |
| Renderers | `spacegraph-viewport.ts` (3D), `components/graph-viewport.ts` (2D) | Both consume Modulation Δ; both emit only via projectΔ |
| Tests | `tests/visual/modulation.algebra.test.ts`, `tests/visual/configuration.from.spec.test.ts` | Algebra laws (assoc, identity, distributivity of ⊗ over ⊕); parity diff; regression of past configurations |
| Inspector | `components/node-detail-drawer.ts` | Form generated from `Item.fields()`; calls atom setters |
| Scrubber | `components/history-scrubber.ts` (new) | Gates `t ≤ scrubberT`; only host of axis-mode `time` |

Total surface ≈ 5 new files + minimal edits to two viewports. Everything in §3 (affordances) and §4 (bindings) lives *outside* this surface.

---

## 6. Invariants (machine-checkable; not aspirations)

1. **Totality** — For every valid `(Item, Lens, View)`, every Modulation fragment in the active composition evaluates without throwing and without reading undefined Fields. Enforced by `Field k ⇒ M` and by `Clamp` at the composition root.
2. **Closed channels** — `ΔDisplay` keys ∈ `Channel Set`. TypeScript discriminated-union + Zod schema at config boundary.
3. **Pure** — Modulations are stateless, deterministic, memoizable on `(id, lens, axis, d-bucket, a11y)`.
4. **Side-effect** — Modulations never mutate `Item`, `Lens`, or `View`; they emit Δ only.
5. **Commutativity on channel-blends** — `For any two fragments writing different channels, fragment order is irrelevant` — verified by algebra test over every pairwise channel-blend op.
6. **Parity** — `2D.project(Δ) === 3D.project(Δ)` modulo renderer-missing channels (documented). CI regression.
7. **Lens≠topology** — Lens Switch never causes a layout invocation; gate tested via layout call counter.
8. **Axis≠Lens** — There exists a configuration with `Lens=name_a, Axis=time` that is feasible and tested.
9. **No bespoke rendering branches** — Search of the codebase for any switch on `Lens.name` *outside* `Lens` definition or any switch on `Item.kind` *inside* Modulations fails the build.
10. **No new channels without contract change** — Adding a channel is one PR touching `channels.ts` + one renderer impl + one Zod entry; *modulators keep running unchanged*.

These invariants are the contract that makes the abstraction win. Every commit runs invariant checks.

---

## 7. Non-goals (still forbidden)

- Specific visual bindings baked into the engine — bindings are *config*, never *code*.
- Lens as topology; axis must not force relayout.
- Custom node types beyond {HtmlNode, ShapeNode} in core; new ones behind the same Modulation interface, never ad-hoc.
- Custom layout algorithms — only the 11 built-ins (`ForceLayout`, `GridLayout`, `CircularLayout`, `HierarchicalLayout`, `TreeLayout`, `TimelineLayout`, `SpectralLayout`, `ClusterLayout`, `RadialLayout`, `GeoLayout`, `BaseLayout`).
- Tunnels, decks, gsap narrative tours — pure decoration, no Item-axis encoding, no Modulation for them.
- PhysicsPlugin springs as visual: they may affect topology layout only if a `topology` Modulation proves benefit; never as a "resolution" animation.
- Multi-agent federation / `InterGraphEdge` in core — single NAR session.
- Yjs/CRDT collaborative editing, plugin marketplace, theming, mobile, PWA, offline.
- VisionPlugin CI, AutoColor/AutoLayout as core products (kept as demo-track investigations in `ui/spacegraphjs7/demo/`).
- Treating "form follows function" as decoration license — every Δ on every channel must trace to a Field, an Axis-mode, a Lens, or an Accessibility flag; otherwise it's a forbidden Const Modulation.

---

## 8. Verification gates (cumulative, machine-checked)

| Layer | Gate |
|---|---|
| **L0 — Substrate** | WS connect → 300 nodes stable → lens switch `<100ms`, zero layout invocations → pan/zoom persists per `(lens, axisMode)` → reconnect restores state bitwise |
| **L1 — Algebra** | Invariant checks pass on algebra tests; Lens config ↔ (Lens value) round-trip exact; every published example phrase extractable from the config schema verifies; **2D/3D parity** test over a 32-Item 4-Lens 2-Axis matrix diff overlaps |
| **L2 — Edit** | Inspector form is derivable from `Item.fields()` for every ItemKind; truth editor's live `expectation/harshness` use exact formulas from `nar/src/terms/truth.ts`; pin state survives lens × axis × layout permutations; graded `focus.intensity` produces graded `glow.intensity` exactly |
| **L3 — Time** | axis-mode `time` preserves X,Y of every Item; scrubber gate hides Items with `t > scrubberT` exactly; cross-lens history permutations preserve Item-anchor positions |
| **Ship** | All algebra invariants green; parity diff green; a11y audit (keyboard, reduced-motion, redundancy-of-color-encodings, contrast tokens from `ui/design-tokens.json`) green; performance budget 300 nodes + 600 edges ≥30fps on 2020-class laptop |

---

## 9. Decision log

| Decision | Rationale |
|---|---|
| **A Modulation algebra — not a binding table — is the contract** | A table must grow with each new lens/feature and grows faster as bindings entangle. An algebra absorbs future bindings as config without engine change. Future lenses, edge types, derived fields, user-tunable weights — all Modulation fragments. |
| **Closed Channel Set, open Field Set** | Renderers cannot accept unknown channels (forces ad-hoc branches → entropy). Fields naturally grow as NAR exposes more truth/op dimensions — Modulations stay total via `Field ⇒ M`. |
| **One algebra, two projections (3D + 2D)** | Forces the abstraction to be renderer-agnostic. 3D "spectacle" features that cannot reduce to a 2D projection are surfaced as implementation hints that something is decorative — a useful self-correcting signal. |
| **Lens ⊥ Axis** (orthogonal) | v1 conflated them; decoupling gives `same lens different axis` and `same axis different lens` as natural, doubling expressivity at no cost. |
| **Layout owns absolute positions; Modulations write offsets (except pinned grid)** | Keeps layout Verantwortung clean; lets a feature tweak positions without overwriting the layout the user's spatial memory depends on. |
| **Blend ops defined per channel** | `position` sums, `scale`/`opacity` multiply, `color` composites, `glow` sums, `lod`/`flow.speed`/`zIndex` max. Picked so that *relevance signals compose, identity signals preserve, intensities scale* — chosen for semantics, not aesthetics. |
| **Inspector form derived from `fields()`** | Same Field Set feeds renderer and editor — a truth dimension once introduced is *immediately accessible to both view and edit* with zero plumbing. |
| **Invariants machine-checked per commit** | The algebra's elegance becomes a liability the moment interpretive drift sets in. Compile-time + test-time enforcement keeps the abstraction honest across contributors. |
| **Examples admitted as §4 but explicitly *not* the spec** | The v1 table became the spec by accident. v2 separates the abstraction (contract) from instance phrases (illustrative). |
| **Channels all type-safe; config Zod-validated** | Love of elegance without discipline quickly becomes cleverly wrong. |
| **5 new files + 2 viewport edits deliver the entire abstraction** | Forces the team to *not* balloon surface area; features post-L0 are config additions, not code. |

---

## 10. Disposition of `UI.sg.md` (v1)

| v1 element | v2 disposition |
|---|---|
| Foundational principle (§0, §1.1, §1.2, §1.5, §1.6) | Absorbed as substrate guarantees §2.1–2.6 |
| LOD (§2.1), Lens-as-projection (§2.2) | Special cases of Modulation (`lod` channel; Lens value). Generalized. |
| Derivation Flow (§2.4) | One example phrase in §4: `derivesFrom.confidence → flow.speed`. |
| WM panel + physics (§2.3) | Replaced — `$workingMemory` is a Set; pinned Items get a `pinned-boost` Modulation; grid region for pinned set. No springs. |
| Decks, tunnels, springs, narrative tours (§3.1–3.3, §4.3) | Dropped — pure decoration with no Field/Axis origin; cannot be expressed as a Modulation without a contrived Const. |
| Conversation backbone (§3.4) | Reduces to `axis.y := time` (always on); lens-independent. |
| Z = time archaeology (§4.1) | Reduces to `axis.z := time` axis-mode + scrubber opacity gate. |
| Concept as living doc (§4.2) | Becomes the inspector (§3 L2); form auto-derives from `Item.fields()`. |
| Multi-agent federation (§4.4) | Dropped (`InterGraphEdge` stays in the library demo track). |
| Vision/AutoColor/AutoLayout CI (§5.1) | Deferred to investigative track `ui/spacegraphjs7/demo/`; not product. |
| Perf-at-scale targets (§5.2) | Replaced by single perf gate (§8 Ship). |
| A11y (§5.3) | Promoted to L0 invariant; the `accessibility` Modulation is mandatory in the composition root. |
| Decision log (§9) | All v1 decisions resolve to: "the Modulation algebra already encodes this; if not, the binding was a Const pent-up trying to sneak decoration past form-follows-function." |

---

*End of specification. The contract is one abstraction. Everything else is configuration.*
