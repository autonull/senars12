# UI.16 — The Composition Framework: One Shell, Dumb Surfaces, Data-Driven Apps

**Goal:** Ship a **working workspace** this week *and* a **framework** for building a vast
variety of UIs — by making composition a first-class, data-driven concept. Every app becomes
a named *composition*; every surface becomes dumb content; the shell owns all chrome.

---

## The Core Insight

We already have `defineApp`, `SurfaceDescriptor` (with `Placement`), and `s-app-shell`.
But **viewport surfaces mount into one slot with no layout**, and **each surface carries
its own header/toolbar/status**. That duplication (~2000 lines across 7 apps) is what
blocks variety, not feature gaps.

> **An app is a *composition*: an ordered set of dumb surfaces arranged by a layout,
> under global controls, addressed by URL. The shell owns the chrome.**

---

## Architectural Principles

1. **One shell** — `s-app-shell` provides chrome (header, status, controls) + a composition
   viewport. Every app uses it. No app re-implements a header again.
2. **Surfaces are dumb content** — no outer chrome; they read atoms and render. The same
   surface composes anywhere.
3. **Compositions are data** — a composition is `{ cells, layout, globals }`. An "app" is a
   registered composition + metadata. Adding an app is adding a row of data.
4. **Controls are contextual** — the shell renders only the controls relevant to the
   surfaces present (graph controls appear iff a graph surface is present).
5. **Everything is URL-addressable** — any composition is a shareable, bookmarkable link.
6. **Compositions are recursive** — a cell may itself be a composition, so variety is
   unbounded without new components.
7. **Registries are truth** — surfaces, compositions, projectors each have one registry.

---

## Data Model (the new core)

```ts
// framework/composition.ts

export type LayoutId = 'auto' | 'h' | 'v' | 'grid' | 'hero' | 'rail'; // + 'rows3','cols3','mosaic'

/** Global controls applied to a composition (subset are graph-specific). */
export interface Globals {
  readonly lens?: string;        // belief | goal | contradiction | temporal
  readonly layer?: string;       // both | conversation | concepts
  readonly shape?: 'graph' | 'table';
  readonly mode?: '2d' | '3d';
  readonly fit?: 'legible' | 'fit';
  readonly filter?: string;
}

/** One slot in a composition. A cell is a surface OR a nested composition. */
export type Cell =
  | { readonly surface: string }             // surface id from the surface registry
  | { readonly composition: Composition };   // recursion → vast variety

export interface Composition {
  readonly id: string;
  readonly name: string;
  readonly cells: readonly Cell[];
  readonly layout: LayoutId;
  readonly globals?: Globals;
}

// One registry for compositions (presets).
registerComposition(comp); compositionFor(id); getCompositions();
```

```ts
// framework/layout.ts  (pure — move + generalize `layoutTemplate` from lab/compose.ts)

/** Composition → CSS grid template. Recursive cells flatten to their own areas. */
export function layoutOf(comp: Composition): { columns: string; rows: string; areas: string };
```

**This replaces `lab/compose.ts`'s `Spec`/`layoutTemplate`/`specToVariant`** — generalized and
moved to the framework where every app can use it. The Lab becomes a thin consumer.

---

## Components (the new shell)

```
components/
├── s-app-shell.ts      # ENHANCE: chrome + composition viewport + slotting (already mounts panels/overlays)
└── composition-view.ts # NEW: renders a Composition into a CSS grid (recursive)
```

```
apps/shared/
├── app-chrome.ts        # NEW: header (wordmark/title/status) + controls slot
├── composer-controls.ts # NEW: extracted from lab-app; contextual (graph controls iff graph present)
├── config-sync.ts       # NEW: URL ↔ Composition ↔ atoms (extracted from lab-app)
├── graph-toolbar.ts     # exists — graph controls (used by composer-controls)
├── createGraphProjector # exists — projection logic
└── base-app-surface.ts  # DEPRECATED → superseded by s-app-shell + composition-view
```

**Mount flow:**
```
s-app-shell[app-id]
  ├── app-chrome            (wordmark · title · connection status · composer-controls)
  └── composition-view      (grid of surface elements; globals applied to atoms)
        └── <ask-surface> <graph-surface> …   (dumb content)
```

---

## Code-Sharing Inventory (what gets unified)

| Shared thing | Before | After |
|--------------|--------|-------|
| App header / status | 7 copies | 1 (`app-chrome`) |
| Global toolbar | 4+ copies | 1 (`composer-controls`) |
| Graph controls | goals/explore/lab copies | 1 (`graph-toolbar`) |
| Layout math | lab only | 1 (`layout.ts`) |
| URL ↔ config | lab only | 1 (`config-sync`) |
| Grid rendering | per-app flex hacks | 1 (`composition-view`) |
| Projection | per-surface `watch` | 1 (`createGraphProjector`) |
| Surface metadata | scattered `WIDGETS`/`VARIANTS` | 1 (surface + composition registries) |
| Per-app CSS chrome | ~2000 lines | ~0 (surfaces keep only content CSS) |
| App definition | ~370-line files | ~10-line composition registrations |

---

## Phased Plan (usable fast, elegant throughout)

### Phase 0 — Framework core (0.5 day) → lays the keystone
Move/generalize what the Lab already proved:
- `framework/composition.ts` — `Composition`, `Cell`, `Globals`, registry
- `framework/layout.ts` — `layoutOf` (from `lab/compose.ts#layoutTemplate`)
- `apps/shared/config-sync.ts` — `parseComposition` / `compositionToSearch` (from `parseSpec`/`specToSearch`)
- `apps/shared/composer-controls.ts` — extracted from `lab-app.ts`
- `apps/shared/app-chrome.ts` — extracted from `BaseAppSurface` header
- `components/composition-view.ts` — grid renderer (from `lab-app.ts#renderGrid`)

### Phase 1 — Studio app (Day 1) → **working URL**
- `apps/studio/` — `s-app-shell` + `composition-view`, URL-driven, default `chat-graph`
- Register 4 compositions: `chat-graph`, `reasoning-desk`, `graph-3d`, `dashboard`
- **Deliverable:** `/apps/studio/?preset=chat-graph` works end-to-end, fully parametric.

### Phase 2 — Strip chrome → migrate surfaces (Day 2, incremental, low risk)
For each surface, remove outer chrome; let the shell provide it:
| Surface | Keep (content) | Remove (→ shell) |
|---------|----------------|------------------|
| `ask-surface` | messages + input | header, status, wordmark |
| `notebook-surface` | breadcrumb + blocks | outer header |
| `console-surface` | output + prompt | header, status |
| `goals-surface` | goal input + stats | header, toolbar |
| `explore-surface` | content | header, toolbar |
| `hud-surface` | panel grid | outer header |

Migrate apps to compositions: `ask`→`[{chat}]`, `notebook`→`[{notebook}]`, etc.
Old routes stay valid; they just render `studio` with a different default composition.

### Phase 3 — Recursion + variety (Day 3) → **framework payoff**
- `composition-view` handles nested cells (a cell whose content is a sub-composition)
- Register rich presets: `mosaic`, `study`, `command-deck`, `telemetry-wall`
- Lab = `studio` + catalogue + randomize (one implementation, two faces)

### Phase 4 — Verify + dogfood (Day 3–4)
- e2e: `studio` renders each preset; both surfaces mount; controls mutate URL
- Dogfood `chat-graph` for daily reasoning

---

## Directory Layout (target)

```
src/client/
├── framework/
│   ├── composition.ts      # NEW  Composition model + registry
│   ├── layout.ts           # NEW  pure layout engine
│   ├── app.ts              # +composition field on AppDefinition
│   ├── surface.ts          # (exists) add `kind: content|chrome` hint
│   └── …
├── components/
│   ├── s-app-shell.ts      # ENHANCED  chrome + composition viewport
│   └── composition-view.ts # NEW  grid renderer (recursive)
├── apps/
│   ├── shared/             # the reusable shell pieces
│   │   ├── app-chrome.ts
│   │   ├── composer-controls.ts
│   │   ├── config-sync.ts
│   │   ├── graph-toolbar.ts
│   │   └── workspace-graph-projector.ts
│   ├── studio/             # NEW  the one parametric app
│   ├── ask/  notebook/  console/  goals/  explore/  …  # become thin: shell + composition
│   └── lab/                # = studio + catalogue + randomize
└── …
```

**`s-app-shell` gains a `composition` property** (or reads `appFor(appId).composition`);
`AppDefinition` gains an optional `composition: Composition`.

---

## What Makes This Elegant

- **Adding an app = one `registerComposition` call.** No component, no CSS, no bundle.
- **Adding a surface = one dumb content element.** It composes into any app instantly.
- **Changing chrome = one file** (`app-chrome`), and every app updates.
- **Unbounded variety** via recursion — a "dashboard" cell can itself be a composition.
- **The Lab and the Studio are the same mechanism** with different faces.
- **URL is the config language** — every composition is shareable and reproducible.

**Capability preserved:** every existing surface, panel, overlay, atom, and behavior stays;
we only relocate chrome and generalize layout. Nothing is dropped.

---

## Deliberate Cuts (effort saved, capability kept)

| Skip | Why |
|------|-----|
| Per-preset bundles | One entry; presets are query params |
| localStorage persistence | URL-only ⇒ bookmarkable + stateless |
| Resizable splitters / drag-dock now | Add later on `Presentation.size`; grid first |
| Rewriting panel/overlay shell | Already works; only viewport composition is new |
| Force-migrating all apps before Studio ships | Migrate incrementally; Studio works on day 1 |

---

## Success Criteria

- [ ] `studio` renders `?preset=chat-graph` (and 3 more) end-to-end
- [ ] `s-app-shell` renders a composition; `composition-view` is the only grid code
- [ ] `ask` and one more surface are chromeless; their apps are composition registrations
- [ ] Adding a preset = one data entry (no component code)
- [ ] Nested composition renders (recursion proven)
- [ ] Lab reuses `composer-controls` + `composition-view` (no duplicate composer)
- [ ] typecheck ✓ · unit ✓ · golden ✓ · app e2e ✓ (old routes still green)
- [ ] `chat-graph` dogfoodable

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Chrome-stripping breaks app e2e (header/select assertions) | Update assertions to target shell chrome; migrate one surface at a time behind green tests |
| Surfaces depend on atoms the shell must set | `config-sync` applies `Globals` → atoms before/on mount; watch pattern unchanged |
| `s-app-shell` retry/mount timing | Studied: it retries `appFor` up to 2.5s; composition mounts after app resolves |
| Recursion blew scope | Implement flat first; recursion is a `Cell` variant + one render branch |
| Custom-element registration order (Lab↔shared cycle) | Learned already: keep registries in `framework/`, import atoms from kernel |

---

## Dependencies (already done ✅)

- `defineApp` / `defineBundle` / `SurfaceDescriptor(Placement)` — `framework/`
- `s-app-shell` mounts surfaces by placement — `components/`
- Shared `GraphToolbar`, `createGraphProjector`, `ToolbarSelect` — `apps/shared/`
- `GraphFit` policy + `settleZoom` fix
- Lab composer logic (`Spec`, `layoutTemplate`, `parseSpec`, `specToSearch`) — to be generalized
- Atoms exported via `kernel/index`; `VIEWPORT_MODES` decoupled

---

## Immediate Next Step (Phase 0)

Generalize the Lab's proven composer into `framework/composition.ts` + `framework/layout.ts`,
extract `composer-controls` + `app-chrome` + `composition-view`, then stand up `apps/studio/`
with `?preset=chat-graph`. Everything else follows from that keystone.

---

## References

- `ui/src/client/framework/{app,bundle,surface}.ts` — existing app model
- `ui/src/client/components/s-app-shell.ts` — the shell to enhance
- `ui/src/client/apps/shared/` — current shared pieces
- `ui/src/client/apps/lab/{compose,variants,lab-app}.ts` — the composer to generalize
- `ui/src/client/kernel/index.ts` — atoms
