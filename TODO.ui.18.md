# UI.18 — The Backend Contract

**Status:** plan (settled) · supersedes UI.17 as the *organising* model. UI.16 built the plumbing
(surfaces are dumb, one shell, compositions are data). UI.17 decided **what the plumbing is for**
(one focus, four coordinates, the fractal). UI.18 decides **where each concern lives**: one neutral
contract, many renderer backends, SeNARS as the reference application, and the same contract as a
generic library that grows beyond SeNARS.

**Thesis.** SeNARS is not the product; the **contract** is. SeNARS is the first — and most demanding —
consumer of a neutral UI substrate: a `WorkspaceRenderer` + modulation-channel + view-adapter contract
over an arbitrary semantic graph. Cytoscape and SpaceGraphJS are two backends of that one contract.
The contract is what makes SpaceGraphJS reusable by *every other application*; SeNARS is what proves it
is real.

> **One workspace, one contract, many renderers. A renderer is a projection; the workspace is the
> invariant. Add a backend without touching the app; add an app without touching the backends.**

**Delivers immediately.** Phase 1 ships the *vivisection bench* on the existing 2D backend — mounting
the already-built Instrument and re-homing UI.17's aspects — with **no SpaceGraphJS dependency**. The
fractal backend and the ecosystem extraction grow behind the same stable seam.

---

## 0. What this crystallises (all potentials at once)

Five threads, each already present in the codebase, are fused into one architecture:

| Thread | Where it exists today | Its fate in UI.18 |
|---|---|---|
| **Multi-backend renderers** | `core/workspace-renderer.ts` — `WorkspaceRenderer`, `registerRenderer`, `rendererParity()` | becomes **the** seam; the organising axis |
| **Neutral visual vocabulary** | `modulation/types.ts` — `CHANNELS`, `Delta`, `Item` | becomes the **modulation contract** backends negotiate against |
| **Content shapes** | `core/view-adapter.ts` + `view-spec.ts` — `Shape` ∈ {graph, series, table, tree, text, code, diff}, `Budget` ∈ {full, embedded} | becomes the **Content aspect** half of the flat↔graph continuum |
| **The four coordinates** | `framework/coordinates.ts`, `kernel/state.ts` (`$focus`), UI.17 §1 | re-homed as a **projection over the contract**, not a parallel layer |
| **Attention economy** | `framework/attention.ts` + `attention-runtime.ts` over the shared `PriorityBag` | the **one substrate** both UI and mind spend (§0 of UI.17) |

**What UI.18 retires:** the *third, parallel render path* UI.17 accreted — `framework/arrangement.ts`,
`framework/composer.ts`, the Focus+Context cell renderer, and the orphaned `components/instrument/*` —
re-parented onto the two registries that already implement the same ideas (renderers + view adapters).

---

## 1. Ground truth (what already exists — no invention required)

UI.18 is a **consolidation**, not a greenfield. The seam is real and partially populated:

| Contract | File | Shape |
|---|---|---|
| Renderer backend | `core/workspace-renderer.ts` | `mount · present · apply · focus · select · openComposer · openExplain · snapshot · restore · dispose` + `capabilities()` |
| View content | `core/view-adapter.ts`, `core/view-spec.ts` | `shape → tag`, `budget`-aware, `capabilitiesFor(shape)` |
| Modulation | `modulation/types.ts` | `CHANNELS`: color · opacity · size · label · stroke.dash · z · flow.enable · line-style · width · edge-color |
| Capability negotiation | `utils/renderer-capabilities.ts` | `RENDERER_CAPABILITIES['2d'/'3d']`, `unsupportedChannels` |
| Surface | `core/surface.ts` | `defineSurface`, `SurfaceComponent`, `surfaceState()` |
| Arrangement | `framework/composition.ts` | `Composition`, `Globals.mode '2d'|'3d'`, `Globals.shape 'graph'|'table'` |
| Dispatch | `core/intent-registry.ts` | every palette command / shortcut / `ui.command` is an `Intent` |

**Backends registered today:** `graph` (2D, Cytoscape, `parity:'full'`), `graph3d` (3D, SpaceGraphJS,
`parity:'partial'`), `notebook` (content, `parity:'full'`). **Content adapters registered today:**
`graph`, `series`, `table`, `tree`, `text`, `code`, `diff`.

**Consequence:** the flat↔graph continuum (UI.17 §5) is **already** the renderer-vs-view split. No new
axis is needed; the axis exists. UI.18 names it, completes it, and opens it up.

---

## 2. The three-layer law (protects both goals)

The single rule that lets a practical app and a generic library coexist:

| Layer | Owns | Reusable by others? | Rule |
|---|---|---|---|
| **Neutral** | `WorkspaceRenderer`, `CHANNELS`/`Delta`, `ViewAdapter`, `Shape`, `Budget`, `Intent` | **yes — published** | no domain vocabulary may enter |
| **Semantic** | SeNARS: block kinds → `FocusRef`, truth→color, attention→size, origin→dash, aspect projections (`resolveFocus`) | no — the adapter | no rendering decisions here |
| **Backend** | how zoom/depth/hit-testing actually work (Cytoscape compound nodes; SpaceGraphJS fractal LOD) | per backend | no semantics here; declare honest capability |

Enforced by review and by the Definition of Done (§10). **Semantics in SeNARS · rendering in backends ·
contract in neutral.**

---

## 3. The four coordinates, re-homed

UI.17's coordinates remain the vocabulary; they stop being a parallel implementation and become a
*projection* of SeNARS semantics onto the neutral contract:

| Coordinate | Contract mechanism (exists) |
|---|---|
| **Focus** | `WorkspaceRenderer.focus(ref)` — already in the interface |
| **Aspect** | Neighborhood → **renderer** selection; Content/History/Origin/Provenance → **view** (`Shape`) + overlays; Ambient → a surface; Direct → `Intent`s |
| **Depth** | a backend parameter — Cytoscape compound nodes vs SpaceGraphJS fractal nest; resolved via `resolveFocus` containment |
| **Time** | `snapshot()/restore()` + event-log replay; a backend reads `occurrenceTime` |

`framework/coordinates.ts` stays as the **shared vocabulary** (`FocusRef`, `Aspect`, `TimeRef`,
`DEPTHS`, `focusKey`/deep-link encoding) — this is the neutral-ish semantic bridge. `framework/resolver.ts`
(`resolveFocus → content · neighborhood · provenance · history · trace`) becomes the **one projection the
backends and views consume** — finally load-bearing, not shelf-ware.

`framework/link-kinds.ts` (`LINK_KIND_PURPOSES`) stays: it is the shared meaning table the resolver and
future breakpoints agree on.

---

## 4. Backends — one contract, honest parity

A backend is a `WorkspaceRenderer` over the **same** `WorkspaceGraph`; switching round-trips
`snapshot()` → `restore()` and is URL-addressable (`$activeRenderer`).

### Backend #1 — 2D / Cytoscape · the reference (full parity, ships now)

**Not debt. The proof.** Two independent implementations of one contract is what makes a contract a
*library* rather than an integration. Cytoscape is the guaranteed **full-parity** backend and the
practical **vivisection bench**: mature interaction, layers, translucent overlays, and table/tree/code
content via the view layer. SeNARS never loses a complete renderer while the fractal backend matures.

### Backend #2 — 3D / SpaceGraphJS · the fractal (partial → full)

The ambitious backend. It already ships `parity:'partial'`. Its growth path is the **same** contract:
map depth→fractal nest, focus→camera, and expand `RENDERER_CAPABILITIES['3d']` as capability lands.
SpaceGraphJS is the fractal/continuum realization **and** the reusable graphics primitive (§7).

### Backend #3 — Notebook · content (full)

Unchanged; already a full `WorkspaceRenderer`.

### Parity as data

`rendererParity()` already emits the §10 matrix (parity, interactions, controls, surface, gaps). UI.18
adds **channel parity** — the union `RENDERER_CAPABILITIES` × `rendererParity()` — so the shell can offer
a control only where a backend honours it, and *show the gap honestly* where it does not.

| Backend | parity | renders Depth via | fractal? | modulation channels |
|---|---|---|---|---|
| `graph` (Cytoscape) | full | compound nodes / LOD | ✗ | full §10 grammar |
| `graph3d` (SpaceGraphJS) | partial → full | `GroupNode` nest / LOD | → yes | grows with §7 |
| `notebook` | full | document depth | ✗ | content-relevant subset |

---

## 5. The modulation contract (the visual grammar, backend-neutral)

UI.17 §10's grammar becomes the neutral `CHANNELS` negotiation:

| Channel (neutral) | Encodes (semantic layer) |
|---|---|
| `size` | attention / priority |
| `color` | truth frequency / desire / conflict (Lens AST) |
| `opacity` | confidence |
| `stroke.dash` / `line-style` | **system origin** — proposed (dashed) vs derived (solid) |
| edge style | relation kind |
| motion (via `flow.enable`) | liveness |

A backend **declares** what it can render (`RENDERER_CAPABILITIES`); the semantic layer **never** knows
which backend is active. When a channel is unsupported, `unsupportedChannels` reports it and the shell
degrades honestly — the same mechanism that keeps Cytoscape and SpaceGraphJS comparable.

---

## 6. Practical results now — the Instrument on Backend #1 (Phase 1)

**Ships immediately, zero SpaceGraphJS dependency.** The Instrument components already exist but are
**unreachable** (`components/instrument/{cycle-controls,trace-viewer,gate-inspector}.ts` — no importers).
UI.17's aspects exist as pure functions but are **unmounted**. Phase 1 makes the vivisection bench real:

- **Mount the Instrument** — register `s-cycle-controls`, `s-trace-viewer`, `s-gate-inspector` in the
  surface registry and `entry.ts`; drive cycle state (`$cycleState`/`stepCycle`/`rewindCycle`, already in
  `kernel/state.ts`).
- **Re-home the aspects** — Provenance / Origin / History / Ambient as **overlays + view shapes** on the
  2D backend, consuming `resolveFocus`. Translucent drill-down over context (UI.17 invariant 9).
- **Attention already wired** — `$focus` → `attendFocus` → `tierOf` LOD + ambient glyphs work today;
  they become the *depth/fidelity* input to both backends.
- **Cycle-driven decay already wired** — `decayAttentionField()` on `cognitive.delta`; the UI and the
  reasoner age attention identically (UI.17 §18.2).

This is the practical SeNARS value, delivered on the existing, complete renderer.

---

## 7. Upstreaming the fractal primitive (the generic library)

The one capability UI.17 needs that SpaceGraphJS does not yet have is **already on SpaceGraphJS's
near-term roadmap** — a P1 item, unbuilt:

- **Fractal LOD zooming** — a `GroupNode` whose children reveal as a nested graph when zoomed
  (`spacegraphjs7/ROADMAP.md:95`).
- **Semantic edge navigation** — double-click an edge → camera traverses to the target
  (`spacegraphjs7/ROADMAP.md:96`).

These are **UI.17 §8's fractal** and **UI.17 §5's continuum**, expressed as *generic* features. Building
them in SpaceGraphJS — not in SeNARS on Cytoscape — makes the fractal free for SeNARS (nest + connect)
and valuable to every other consumer. SeNARS's job shrinks to: **nest the containment (`resolveFocus`),
build the edges, and encode the channels.**

Prerequisite for parity: SeNARS already embeds SpaceGraphJS via `ui/vite.aliases.ts:14-15`
(`spacegraphjs` → `spacegraphjs7/src/index.ts`) and the 3D viewport (`spacegraph/spacegraph-viewport.ts`,
`spacegraph/adapter-3d.ts`). The integration is natural, not a leap.

---

## 8. Extraction — the ecosystem interface (Phase 4)

The neutral layer is published so other applications consume it **without SeNARS**:

```
@<org>/ui-contract      WorkspaceRenderer · ViewAdapter · CHANNELS/Delta · Shape/Budget/Intent
@<org>/ui-backend-2d    Cytoscape reference backend
@<org>/ui-backend-fractal  SpaceGraphJS backend (fractal LOD, semantic edge nav)
@<org>/ui-shell         surface registry · composition · shell chrome (SeNARS-agnostic)
senars-ui               the reference application (semantic layer + projections)
```

An outside app implements one semantic adapter (its domain → `WorkspaceGraph`-like blocks/links) and one
projection (`its FocusRef`), then gets every backend, every shape, every aspect, the attention economy,
and the vision gate for free. **Adding a backend never touches an app; adding an app never touches a
backend.**

---

## 9. Phasing — every goal, iteratively

Each phase is independently shippable and leaves the system coherent.

### Phase 0 — Consolidate the seam (no visual change)

| Action | Files |
|---|---|
| Declare the neutral contract explicitly (docs + JSDoc as contract, not implementation detail) | `core/workspace-renderer.ts`, `core/view-adapter.ts`, `modulation/types.ts` |
| Re-home UI.17 coordinates as a projection over the contract; keep `coordinates.ts` vocabulary | `framework/coordinates.ts`, `kernel/state.ts` |
| **Delete/park** the parallel render path | `framework/arrangement.ts`, `framework/arrangement-strategies.ts`, `framework/composer.ts` |
| Reconcile id drift | catalog `'2d'/'3d'` vs registry `'graph'/'graph3d'` vs `defaultRendererFor('graph'|'notebook')` |

**Acceptance:** one way to register a backend, one way to register content; no third path remains.

### Phase 1 — The vivisection bench on Backend #1 (ships now)

| Action | Files |
|---|---|
| Mount **Instrument** (cycle / trace / gate) | `components/instrument/*`, `entry.ts`, surface registry |
| Re-home **aspects** (Provenance · Origin · History · Ambient) as overlays + views on 2D | views layer + `resolveFocus` |
| Attention → fidelity input for both backends | `attention-runtime.ts` (already wired) |

**Acceptance:** a user can step the cycle, watch a trace, stand at a gate, inspect provenance, and see
attention-allocated fidelity — **on the current 2D backend**.

### Phase 2 — Grow Backend #2 to parity (the fractal ideal)

| Action | Files |
|---|---|
| Upstream fractal LOD + semantic edge nav into SpaceGraphJS | `ui/spacegraphjs7/src/nodes/GroupNode.ts`, `plugins/LODPlugin`, `InteractionPlugin` |
| Map depth→fractal nest, focus→camera in the 3D backend | `components/renderers/graph3d.ts`, `spacegraph/adapter-3d.ts` |
| Expand `RENDERER_CAPABILITIES['3d']` as capability lands; parity partial→full | `utils/renderer-capabilities.ts` |

**Acceptance:** the same workspace is explorable as a fractal in 3D; `snapshot()/restore()` round-trips
between 2D and 3D without loss.

### Phase 3 — Aspects × backends matrix

| Action |
|---|
| Every aspect (Neighborhood·Content·Provenance·Origin·History·Ambient·Direct) renders on **≥1 backend**, declared via parity |
| Direct aspect = `Intent`s (already registry-driven); Ambient = attention field + drives + vitals, noise-budgeted |

**Acceptance:** the parity matrix has no accidental holes; gaps are declared, not silent.

### Phase 4 — Extract the ecosystem

| Action |
|---|
| Split neutral packages (§8); publish; document SeNARS as the reference app |
| A non-SeNARS sample app implements one adapter + one projection and uses both backends |

**Acceptance:** an external app runs on the contract with no SeNARS dependency.

---

## 10. Definition of Done (the gate that stops shelf-ware)

Every prior iteration's failure mode was **modules merged and unit-tested but never mounted**. UI.18
makes that impossible to repeat:

> **A capability is "landed" only when (a) ≥1 registered backend or view renders it, (b) it is reachable
> from the running shell, and (c) the visual/integration gate asserts it.**

- Reuse the existing harness: the visual gallery + `settleZoom` legibility floor (§T.4) + the
  `renderError` guard.
- Adopt the SpaceGraphJS vision assertions (`spacegraphjs7/src/vision/assert.ts`:
  `visionAssert.noOverlap()`, `.isLegible()`) as the shared **visual gate** — the same loop the library
  uses to see what it builds.
- **No capability merges without a mounted consumer and a passing assertion.** This single rule is worth
  more than any section above.

---

## 11. What is retired / re-parented (the shelf-ware resolution)

| Artifact | Today | UI.18 |
|---|---|---|
| `framework/arrangement.ts`, `arrangement-strategies.ts` | 0 consumers | **retired** — duplicated by layouts + renderers + composition |
| `framework/composer.ts` | 0 consumers | **re-targeted** onto `Intent` registry (controls = derived intents) |
| `framework/prompt-perception.ts` | 0 consumers | **wired** into the 2D/notebook `apply(ops)` path (turn = perceived concept) |
| `framework/resolver.ts` | orphaned | **load-bearing** — the one projection backends/views consume |
| `components/instrument/*` | 0 importers | **mounted** (Phase 1) |
| `components/composer-focus.ts` | 0 importers | **reconciled** with the live `input-hud` prompt path |
| `framework/coordinates.ts`, `link-kinds.ts` | partial | **kept** as the shared vocabulary |

Nothing is deleted that carries signal; everything that was a *parallel* path is folded into a contract.

---

## 12. Risks & de-risking

1. **Two backends diverge.** → The contract + `CHANNELS` + parity matrix are the forcing function;
   capability is declared, never assumed. Carrier: the shared visual gate.
2. **SpaceGraphJS is alpha** (dummy ONNX models; fractal primitive unbuilt). → Backend #1 keeps SeNARS
   fully functional; the fractal backend grows behind the seam and is *opt-in*. Shared roadmap = shared
   incentive.
3. **Semantics leak into the neutral layer.** → The three-layer law (§2) + review; a neutral package that
   imports a SeNARS type fails CI.
4. **Over-coupling distorts SpaceGraphJS toward SeNARS.** → The interface is the narrow `GraphSpec`
   projection + channels; SpaceGraphJS keeps its own roadmap (SpaceGraphOS).
5. **The coordinates fragment again.** → One `focus(ref)` in the contract; one `resolveFocus`; delete
   parallel paths (§11).

---

## 13. The stake, restated

UI.16 built the plumbing. UI.17 said what it was for. **UI.18 makes it a substrate.**

- **For SeNARS:** a vivisection bench on a complete backend *today* — step the cycle, stand at the gates,
  inspect provenance, watch attention allocate fidelity.
- **For SpaceGraphJS:** a demanding reference application that drives its fractal primitive as a *generic*
  feature.
- **For everyone else:** a neutral contract — renderer, view-adapter, modulation channel, intent — that
  turns any semantic graph into a zoomable, multi-backend, attention-allocated workspace, reducible to any
  conventional UI.

The UI is not a picture of the mind, and not a bespoke graph. **It is a contract: one workspace, many
renderers, and an endless ecosystem of applications that share it.** That is the stake. This document is
the contract.

---

## 14. Progress log

_(fresh — to be filled as phases land, in the UI.17 style: file-by-file, with verification commands.)_
