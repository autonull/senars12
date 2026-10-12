# TODO.ui.13.md — Normalize the UI substrate

> **North star:** *One substrate, one contribution model, one surface model, one view
> system, one app model. Every fact has exactly one source; every new capability UI is a
> descriptor + a body, not a new subsystem.*

> **The one-line test:** *Can a new SeNARS capability get a UI by adding data to one
> catalog and one surface — with the type system, not review, catching drift?* If not,
> the abstraction is missing and this plan exists to add it.

> **This plan replaces the "keep polishing the HUD" backlog of `TODO.ui.12.md`.** It is
> the aggressive refactor the pivot called for: do not add features to the old surface
> while the substrate is being normalized.

---

## ▶ How to execute this plan (self-contained)

**The only trigger needed is the phrase: "implement TODO.ui.13.md".**

**The agent's mandate — execute autonomously, one slice at a time:**

1. **Read this file top to bottom.** It is self-contained; you do not need any other
   `TODO.ui.*` to proceed.
2. **Resume at the first unchecked slice in §4.** If every slice is checked, the plan is
   complete — stop and report.
3. For **each slice**, do exactly this and nothing more:
   - **Implement** the change (the substrate + at least one *real consumer*).
   - **Guard** it: a focused unit test (no mocks; test objects directly, per `AGENTS.md`).
   - **Prove it on the real app** — run a real app (`ui/src/client/apps/*`), not only the
     old HUD. A green cell is not proof.
   - Run `pnpm --dir ui typecheck` + `pnpm --dir ui test:unit`, and the golden-path e2e.
     Keep them green. The full contract is `pnpm ui:gate`.
   - **Commit** (Conventional Commits, per repo) and append a §4 Progress Log entry.
4. **Then take the next slice.** Do not batch slices; do not re-derive the substrate; do
   not ask the human to choose — proceed down the critical path.
5. **Stop and report only when:** a **tripwire** fires (§5); a required command/tool is
   missing; or a test fails **>3 times**. Never loop.

**Critical path:** P0 kernel → P1 contribution+catalog → P2 surface → P3 view → P4 facet →
P5 app+harness → P6 server registry → P7 rebuild apps.

---

## 0. Diagnosis — the mess, precisely

The UI works but is **not engineered**: it is a pile of parallel micro-frameworks that
each solve the same problem differently, so every new capability re-opens settled
questions. `ui/src/client` is **186 TS files**. The pathologies:

### 0.1 ~15 parallel descriptor/registry systems

| System | File | Kind | Re-implements |
|---|---|---|---|
| `Contribution` (base) | `core/contribution.ts` | interface | — (underused: nothing extends it) |
| `SurfaceDescriptor` | `core/surface-registry.ts` | runtime registry | id/label/icon/group/tag/a11y/capability |
| `OverlayDescriptor` | `core/overlay-registry.ts` | runtime registry | id/label/icon/group/tag/capability/window |
| `RendererDef` | `core/renderer-defs.ts` | const catalog | `d()`, `*_IDS`, `*Where` |
| `PanelDef` | `core/panel-defs.ts` | const catalog | `d()`, `*_KINDS`, `*Where` |
| `BlockDescriptor` | `core/block-descriptors.ts` | const catalog | `d()`, `*_KINDS`, `*Where` |
| `GraphLayerDef` | `core/graph-layer-defs.ts` | const catalog | `d()`, `*Where` |
| `ConversationLayoutDescriptor` | `core/conversation-layout.ts` | const catalog | `*_IDS`, `*Where` |
| `ReasoningLayoutDescriptor` | `core/reasoning-layout.ts` | const catalog | `*_IDS`, `*Where` |
| `LensSpec` | `shared/lens-schema.ts` | catalog | ids |
| `ComposerModeDescriptor` | `core/composer-modes.ts` | const catalog | `*_IDS`, `*Where` |
| `CapabilityDescriptor` | `core/capabilities.ts` | const catalog | `*_IDS`, `*descriptors` |
| `Command` | `core/commands.ts` | runtime registry | id/title/group/availability |
| `ViewAdapter` | `core/view-adapter.ts` | runtime registry | shape/tag/budgets/interactions |
| `EmbeddedView` | `core/embedded-views.ts` | const catalog | `*_IDS`, `*Where` |

**Consequences.** `SurfaceDescriptor` and `OverlayDescriptor` both spell out
`id, label, icon, group, tag, capability` and neither extends `Contribution`. Each const
catalog hand-rolls a `d()` defaults function, an `*_IDS`/`*_KINDS` array, and a `*Where`
selector. There is no single `get/all/where` shape a generic tool (palette, gallery,
codegen, docs, test harness) can consume — each caller learns a bespoke API.

### 0.2 The same concept, three names

A **surface**, an **overlay**, a **panel**, and a **renderer** are the same thing: a
mountable custom element with placement and presentation metadata. They differ only in
*placement* (viewport / panel / overlay / inline) and *presentation* (dock, size, order,
modal, window chrome). Today they are four interfaces, four registries, four mount paths.

### 0.3 A store that is two stores

`core/store.ts` (922 lines) mixes the **kernel** state (connection, chat, graph, workspace,
events, telemetry, control, config) with **chrome** state (lenses, layouts, panels, URL
state, selection, collapse). It imports the modulation engine, lens catalog, layouts and
panel defs — so importing any kernel atom transitively pulls the whole HUD.

### 0.4 A monolithic server

`ui/src/server/index.ts` (~1090 lines) handles every message in one `switch`
(`handleClientMessage`), serves static files, runs the projection, the derivation drain,
the run loop, LM status, config, scenarios and test endpoints. Adding a message means
editing the switch; there is no handler registry.

### 0.5 No app model

There is one app: `index.html` → `entry.ts` imports ~40 components and `connect()`s. There
is no `App` descriptor, no composition of surfaces, no way to build a second product
without copying `entry.ts`. (`bundles/` is an empty directory — the idea was parked.)

### 0.6 What this costs

Every new capability UI re-decides: which registry, which defaults helper, which placement
mechanism, which mount path, which state atoms, which server case. That is the "messy
confusion" this plan removes.

---

## 1. The target architecture

Five layers, each with **one** shape. Names below are the target; the code keeps working
through re-exports during migration.

```
kernel/            substrate — no DOM chrome, no HUD
  state.ts           Atom primitive + the kernel atoms
  domain.ts          WorkspaceGraph, projections, blocks
  transport.ts       ws-client + server-message binding
  backends.ts        ReasoningBackend, Nars/Metta, control channel
  events.ts          event bus + event catalog
  view/              ViewSpec, ViewHost, adapters, projection
  index.ts           the facade apps import

framework/         the normalized micro-framework (new)
  contribution.ts    Contribution<K> — the one base descriptor
  catalog.ts         defineCatalog / createRegistry — the one catalog shape
  surface.ts         Surface<K> — the one mountable concept (placement-parameterized)
  app.ts             defineApp — the one app descriptor + shell
  command.ts         the one command shape (extends Contribution)

apps/              products — thin compositions over kernel + framework
  ask/ notebook/ explore/ goals/ hud/
```

### 1.1 `Contribution<K>` — one base descriptor

Every registrable/catalogued thing extends this. No descriptor spells `id/label/icon`
again.

```ts
interface Contribution<K extends string = string> {
  readonly id: K;
  readonly title: string;
  readonly label?: string;
  readonly icon?: string;
  readonly group?: string;
  readonly capability?: Capability;
  readonly a11y?: A11y;
}
```

### 1.2 `Catalog<K, D>` — one catalog shape

One generic shape for **both** const catalogs (compile-time unions) and runtime registries.
`defineCatalog` infers `K` from the keys, so `keyof typeof defs` stays the union source and
`where` replaces every bespoke `*Where`.

```ts
interface Catalog<K extends string, D extends Contribution<K>> {
  readonly defs: Readonly<Record<K, D>>;
  readonly ids: readonly K[];
  get(id: K): D;
  has(id: K): boolean;
  where(facet: (d: D) => boolean): K[];
  readonly size: number;
}
declare function defineCatalog<K extends string, D extends Contribution<K>>(
  defs: Record<K, D>
): Catalog<K, D>;

// Mutable sibling for boot-time registration (surfaces, overlays, commands, adapters):
interface Registry<K extends string, D extends Contribution<K>> extends Catalog<K, D> {
  register(descriptor: D): void;
  reset(): void;
}
```

A `defaults` helper per domain stays **data, not code**: `defineCatalog` takes an optional
`defaults: (label) => Partial<D>` so a new entry names only what it is — the single `d()`
implementation, not eight.

### 1.3 `Surface<K>` — one mountable concept

Placement and presentation are **parameters**, so overlay/panel/renderer/viewport collapse
into one concept with one registry and one mount path.

```ts
type Placement = 'viewport' | 'panel' | 'overlay' | 'inline';

interface Presentation {
  readonly dock?: 'left' | 'right' | 'bottom' | 'float';
  readonly size?: number;
  readonly order?: number;
  readonly modal?: boolean;
  readonly autoFocus?: boolean;
  readonly hiddenInPalette?: boolean;
  readonly window?: { draggable?: boolean; resizable?: boolean; minimize?: boolean; persist?: boolean };
}

interface SurfaceDescriptor<K extends string = string> extends Contribution<K> {
  readonly tag?: string;
  readonly placement: Placement;
  readonly presentation?: Presentation;
  readonly bindings?: Readonly<Record<string, SurfaceBinding>>;
}
```

`defineSurface(descriptor, ctor)` registers into the one `surfaceRegistry` and derives the
tag, bindings, test API and (from `placement`) the mount path. The overlay manager, panel
dock and viewport host all read the same descriptor and branch on `placement` — one
mechanism, three presentations.

### 1.4 `ViewSpec` + adapter — one view system

Already close: unify the adapter registry into the one `Registry`, and make `Shape` a
catalog entry so a new shape is one entry + one adapter. `ViewHost` resolves the adapter
from the registry — no hand map.

### 1.5 `Facet` — one modulation model

Lenses, graph layers, graph filters, composer modes and capability filters are all
"select a projection of a dataset." Unify under one `Facet<K>` descriptor (a named
modulation + a gate), so a new lens/layer/filter is one catalog entry. The modulation AST
(`modulation/`) stays; only the *registration and selection* unify.

### 1.6 `App` — one app descriptor

```ts
interface AppDescriptor {
  readonly id: string;
  readonly title: string;
  readonly shell: string;                  // custom element (default `app-shell`)
  readonly surfaces: readonly string[];    // surface ids to mount, by placement
  readonly capabilities?: readonly Capability[];
  readonly defaultSurface?: string;        // viewport surface
}
declare function defineApp(descriptor: AppDescriptor): AppDescriptor;
```

`app-shell` is the one parameterized shell: it mounts the app's viewport/panel/overlay
surfaces from their descriptors and provides the shared services (overlay manager, palette,
commands, connection status). A product is a directory + a descriptor + its own surfaces.

### 1.7 Server command registry

`handleClientMessage`'s switch becomes a `Map<MsgType, Handler>` populated at module load.
Adding a message is registering a handler — the same "descriptor + body" discipline as the
client.

---

## 2. Unification map (before → after)

| Before | After |
|---|---|
| `SurfaceDescriptor`, `OverlayDescriptor`, `PanelDef`, `RendererDef` | `SurfaceDescriptor` with `placement` + `presentation` |
| `surfaceRegistry`, `overlayRegistry`, `viewAdapter` Map, `commands` Map | one `Catalog`/`Registry` shape (`defineCatalog` / `createRegistry`) |
| 8× `d()` defaults helpers | one `defineCatalog(defs, defaults)` |
| 8× `*_IDS`/`*_KINDS` + `*Where` | `catalog.ids` + `catalog.where` |
| `store.ts` (kernel + chrome) | `kernel/state.ts` + `framework` state; `core/store.ts` re-exports |
| `ConversationLayoutDescriptor` + `ReasoningLayoutDescriptor` | `LayoutDescriptor` parameterized by `scope` |
| lens/layer/filter/composerMode bespoke selection | `Facet` catalog |
| `handleClientMessage` switch | `registerHandler(type, fn)` |
| one `entry.ts` importing ~40 components | `defineApp` + `app-shell` |

---

## 3. Invariants the refactor must hold

1. **One source per fact.** A label/icon/placement exists once. `satisfies Record<K, D>`
   keeps unions derived from catalogs; a typo is a type error.
2. **No new parallel registry.** Any new catalogued thing extends `Contribution` and uses
   `defineCatalog`/`createRegistry`. A bespoke registry is a review-blocking defect.
3. **The kernel never imports chrome.** `kernel/**` imports no lens/layout/panel/HUD module;
   a lint/typecheck boundary enforces it.
4. **Every abstraction ships with a real consumer.** No unification slice lands without a
   migrated caller; an abstraction with one speculative consumer is a tripwire.
5. **The apps keep working.** The golden-path e2e and at least one `apps/*` e2e stay green
   at every commit.
6. **Delete by migration, not by hope.** A superseded module is removed only after its
   callers move and the gate is green; dead files archive to
   `docs/archive/ui-dead-artifacts/` + INDEX before deletion.

---

## 4. Execution plan (slices)

> Each slice: implement → guard (unit) → prove (real app + golden e2e) → commit + log.

- [ ] **P0 — Kernel extraction.**
Split `core/store.ts` into `kernel/state.ts` (Atom primitive + kernel atoms) with
`core/store.ts` re-exporting; create `kernel/{domain,transport,backends,events,view}` and
`kernel/index.ts`. Add the boundary invariant (§3.3) as a check.
**Guard:** a test asserting the kernel atoms exist and update; typecheck boundary.
**Prove:** the Ask app (`apps/ask`) runs on `kernel/index.js`; golden path green.

- [ ] **P1 — Contribution + Catalog unification.**
Add `framework/contribution.ts` + `framework/catalog.ts`. Migrate the const catalogs
(`RENDERER_DEFS`, `PANEL_DEFS`, `BLOCK_DESCRIPTORS`, `GRAPH_LAYER_DEFS`, layouts, composer
modes, capabilities, embedded views) onto `defineCatalog`. Delete the `d()` helpers and
`*Where` functions.
**Guard:** catalog tests (`get/ids/where/size`); a type test that the union derives from keys.
**Prove:** palette + graph toolbar + block rendering unchanged; golden path green.

- [ ] **P2 — Surface unification.**
One `SurfaceDescriptor` (`placement` + `presentation`) and one `surfaceRegistry`. Migrate
overlays, panels and renderers onto it; the overlay manager / panel dock / viewport host
read `placement`. One mount path.
**Guard:** surface tests (placement → mount path; presentation → window/dock); a test that
every registered surface has a valid placement.
**Prove:** overlay opens, panel docks, viewport renders; golden path + Ask green.

- [ ] **P3 — View system normalization.**
Move `ViewAdapter` onto the one `Registry`; make `Shape` a catalog entry; `ViewHost`
resolves by registry.
**Guard:** adapter resolution + `supportedShapes` tests.
**Prove:** every shape renders through `<s-view>`; visual cells green.

- [ ] **P4 — Facet unification.**
One `Facet<K>` descriptor for lenses, layers, filters and composer modes; the modulation AST
stays. Migrate the lens/layer/filter selection.
**Guard:** facet selection tests; a test that a lens and a layer are the same shape.
**Prove:** lens switch + layer filter behave; golden path green.

- [ ] **P5 — App model + harness.**
`framework/app.ts` + `app-shell`; `defineApp`. Migrate **Ask** onto it, then add a second
app (**Notebook** or **Explore**) to prove reuse.
**Guard:** app-composition test (surfaces mount by placement); an e2e per app.
**Prove:** both apps run at `/apps/<name>/`; the shell provides overlay/palette/connection.

- [ ] **P6 — Server command registry.**
Replace the `handleClientMessage` switch with `registerHandler`. No behavior change.
**Guard:** handler-registry test; the message union still exhaustive.
**Prove:** all apps + golden path green.

- [ ] **P7 — Rebuild the apps.**
Rebuild the useful apps on the normalized framework (Ask, Notebook, Explore, Goals,
Console), each a thin composition. Demote the HUD to `apps/hud/` (kept, not the default).
**Guard:** an e2e per app; the app-composition contract.
**Prove:** `/` is the primary app; the HUD is reachable but not default.

---

## 5. Tripwires (stop if any fires)

| Mistake | Tripwire |
|---|---|
| **Refactor with no consumer** | a slice lands an abstraction with no migrated caller → stop |
| **New parallel registry** | a new `*_IDS`/`*Where`/`d()` appears → stop; it is the thing we are deleting |
| **Chrome in the kernel** | `kernel/**` imports a lens/layout/panel/HUD module → stop |
| **Green gates as progress** | no real-app walkthrough for the slice → not done |
| **Deleting by hope** | a file is removed before its callers migrate → archive first |
| **Feature creep during the refactor** | a new feature is added to the old surface → park it; the refactor comes first |
| **Breaking the contract** | golden path or an `apps/*` e2e goes red without a migrated replacement → stop |

---

## 6. Definition of done

- **One contribution model, one catalog shape, one surface concept, one view system, one
  facet model, one app model, one kernel.** The §2 map is fully realized.
- **Adding a capability UI is a recipe, not a research task:**
  - *a new surface:* `defineSurface({ id, title, placement, bindings }, class { renderBody() })`.
  - *a new catalogued thing:* one `defineCatalog({ … })` entry.
  - *a new shape:* one catalog entry + one adapter.
  - *a new message:* one `registerHandler(type, fn)`.
  - *a new app:* a directory + `defineApp(...)` + its surfaces.
- **The type system catches drift:** every catalog is `satisfies Record<K, D>`; a missing
  row or a typo fails the build.
- **A second app exists and shares 100% of the substrate** — no copy of `entry.ts`.
- **`pnpm ui:gate` green**, including an e2e per app.

---

## 7. Risks

- **Scope.** This is a large refactor. Mitigation: slices small enough to walk end-to-end;
  the tripwires; every slice proven on a real app.
- **Migration churn.** Re-export during migration so callers move incrementally and the gate
  stays green. No big-bang rename.
- **Over-abstraction.** Guard: every abstraction ships with a migrated consumer; the
  `defineCatalog` shape must be *simpler* than what it replaces, or it is not kept.
- **Losing behavior.** The golden-path e2e + per-app e2e + visual cells are the regression
  net; a red gate blocks the slice.

---

## 8. Progress Log

> Append one entry per completed slice: what changed, the guard, the proof, remaining work,
> and new opportunities found. Keep it terse and factual.

### Baseline (before P0)
- `ui/src/client/kernel/index.ts` — the kernel facade exists (transport, state, domain,
  backends, events, view, blocks, capabilities, commands). It re-exports from `core/`; the
  physical split (`kernel/state.ts` etc., P0) is **not** done.
- Harness exists: vite `ask` entry + `serveStatic` serves a directory path at its
  `index.html`, so an app lives at `/apps/<name>/`.
- `ui/src/client/apps/ask/` — the first app, proven by
  `ui/tests/scenarios/prototypes/ask.spec.ts` (`@prototype`, chromium green). Built on
  `kernel/index.js`. Committed as `bbcadd4d`.
