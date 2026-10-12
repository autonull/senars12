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

## ▶ START HERE (fresh session)

**Baseline.** Nothing in P0–P12 is done. `ui/src/client/framework/` does **not** exist.
The last commits are the pivot foundation this plan builds on:
- `bbcadd4d` — kernel facade (`ui/src/client/kernel/index.ts`, re-exporting from `core/`),
  harness (vite `ask` entry + server directory-index), and `apps/ask/` proven by
  `ui/tests/scenarios/prototypes/ask.spec.ts`.
- `4af9e781`, `cf02b3bf` — this plan.
The committed `ui/src/client/core/` is the **un-normalized** substrate (see §0).

**First slice: P0 — Kernel extraction** (§4). First action: split `core/store.ts` (922
lines) into `kernel/state.ts` (the `Atom` primitive + the kernel atoms) with
`core/store.ts` re-exporting, then add `kernel/{domain,transport,backends,events,view}.ts`
and point `kernel/index.ts` at them. Guard with a kernel-state test; prove by running the
Ask app + the golden path.

**Commands** (repo root unless noted):
- typecheck: `pnpm --dir ui typecheck`
- unit: `pnpm --dir ui test:unit`
- golden e2e (real HUD): `cd ui && pnpm exec playwright test --config tests/playwright.config.ts tests/scenarios/golden-path/operate-reasoner.spec.ts --project=chromium --workers=1`
- Ask prototype e2e: `cd ui && pnpm build:client:test && pnpm exec playwright test --config tests/playwright.config.ts tests/scenarios/prototypes/ask.spec.ts --project=chromium --workers=1`
- full contract: `pnpm ui:gate` (= typecheck + unit + golden e2e)
- build the client: `pnpm --dir ui build:client:test`

**Record progress** in §8 — append one entry per slice (what changed, guard, proof,
remaining work, new opportunities).

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
P5 app+harness → P6 server registry → P7 rebuild apps → P8 intent → P9 protocol → P10
projection+derived → P11 bundle/app → P12 domain catalogs.

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

### 0.7 More duplication (found while normalizing)

The same disease appears outside the descriptor layer:

- **Two hand-coded protocol dispatchers.** `core/src/protocol/unions.ts` defines the zod
  discriminated unions, but the server (`handleClientMessage`, a 30-case `switch`) and the
  client (`applyServerMessage`, a 15-case `switch`) both hand-write dispatch, and neither
  validates the wire payload with the schema it already has. One message shape, three
  places (schema, two switches).
- **An intent bus *and* a command registry.** `core/events.ts` (`UiSignals`, e.g.
  `graph:fit`, `overlay:open`, `composer:focus`) and `core/commands.ts` (e.g. `view.fit`,
  `overlay.*`) express the same thing — a named intent — through two dispatch paths. Some
  actions exist as both.
- **A hardcoded projection pipeline.** `projectWorkspace` (`workspace-projection.ts:542`)
  hardcodes its producers (`projectChat`, `projectReasoning` per backend,
  `projectCognitiveEvents`, `projectDerivationRecords`) and merges fragments by hand. A new
  capability adds a producer by editing this function.
- **231 lines of per-registry validators.** `contribution-validator.ts` re-implements
  "title required / tag required / unique id" once per registry. With one `Contribution`
  and one catalog, validation is generic.
- **A plugin system that is an app system.** `plugins.ts` (`PluginContribution`) gathers
  surfaces, overlays, adapters, renderers, commands, lenses and layouts, then
  `applyPlugins()` fans them out — the same shape as the target `App`/bundle. `bundles/` is
  an empty directory with the same intent.
- **A reading model split three ways.** `sections.ts`, `navigation.ts` and `toc.ts` each
  traverse the workspace graph for reading/outline/breadcrumbs. One `outline` projection
  would serve all three.
- **Config fields duplicated across the wire.** `ui/src/server/config-schema.ts` (119) and
  `ui/src/client/core/config-schema.ts` (287) both describe the same config; the
  `config-change-producer`/`config-log` add a third view.
- **Backends and providers hardcoded.** `nars-backend`/`metta-backend` are fixed exports;
  LM providers live in `lm-provider.ts`. A new engine or provider needs an edit, not a
  registration.
- **Derived state by side-effect.** `$selectedNodeIds`, `$viewSelection` and
  `workspaceGraph.timeCursor` are kept in sync by ad-hoc `subscribe` callbacks that mutate
  a second atom — easy to churn or desync.
- **Rendering split by surface.** `components/renderers/*` (graph, notebook, graph3d) and
  `components/views/*` (table, tree, series…) and `node-body`/`render-block` are three
  paths; a block should render through the view system regardless of surface.

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

### 1.8 `Protocol` — one message shape, both ends

A protocol registry keyed by message `type`, carrying the zod schema, the direction, and the
handler. The server validates inbound frames with the schema it already has; the client
routes inbound frames the same way. One definition, two dispatchers derived.

```ts
interface Message<K extends string> extends Contribution<K> {
  readonly direction: 'toServer' | 'toClient';
  readonly schema: ZodType;
  readonly handle: (ctx: HandlerContext, msg: unknown) => void | Promise<void>;
}
declare function defineMessage<K extends string, S extends ZodType>(spec: {
  type: K; direction: 'toServer' | 'toClient'; schema: S;
  handle: (ctx: HandlerContext, msg: z.infer<S>) => void | Promise<void>;
}): Message<K>;
```

### 1.9 `Intent` — signals and commands are one thing

One `Intent` catalog replaces `UiSignals` + `Command`: a named action with an optional
`run`, `available`, `args` schema and palette metadata. `dispatch(intent, args)` is the one
entry; the event bus becomes the intent dispatcher, and the palette is a filtered view of
the same catalog.

### 1.10 `Projector` — one projection pipeline

A registry of `Projector { id, project(state) → WorkspaceFragment }`; `projectWorkspace`
merges the registered projectors. A new capability adds a projector instead of editing the
merge.

### 1.11 `derived` — one selector primitive

`derived(source, fn, equal?)` builds a read-only atom from one or more sources, with value
equality to prevent churn. `$selectedNodeIds`, `$viewSelection`, `timeCursor` and
`$runTerminations` become derived, not side-effect-synced.

### 1.12 `Bundle`/`App` — one composition descriptor

`defineBundle({ id, contributions: { surfaces, overlays, adapters, intents, facets, projectors, backends } })`
absorbs `PluginContribution` and `bundles/`. `defineApp` is a bundle plus a shell and a
default surface. The shell's regions are data (`Layout`), so an app composes regions.

### 1.13 Catalogs for config, backends, providers, design

Config fields, reasoning backends, LM providers and design primitives each become a catalog
of `Contribution` — so the settings UI, the change log, the docs and the gallery derive from
one source per domain, and a new backend/provider/field is one entry.

### 1.14 One `outline` projection

`sections`, `toc` and `navigation` derive from a single `outline(graph)` projection
(sections, pages, breadcrumbs, ToC rows) — computed once, read everywhere.

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
| `UiSignals` event bus **+** `Command` registry | one `Intent` catalog |
| server switch **+** client `applyServerMessage` switch | one `Protocol` registry (schema + handler) |
| hardcoded `projectWorkspace` producers | `Projector` registry |
| `contribution-validator.ts` (per-registry) | one generic validator over `Contribution` |
| `PluginContribution` + empty `bundles/` | `Bundle`/`App` |
| `sections` + `toc` + `navigation` | one `outline` projection |
| `$selectedNodeIds`/`$viewSelection`/`timeCursor` side-effects | `derived(...)` |
| client config-schema **+** server config-schema | one config catalog |
| hardcoded backends/providers | backend/provider catalogs |

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

- [x] **P0 — Kernel extraction.**
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

- [ ] **P8 — Intent unification.**
One `Intent` catalog replaces `UiSignals` (`core/events.ts`) and the `Command` registry
(`core/commands.ts`); `dispatch(intent, args)` is the one entry; the palette is a filtered
view of the catalog.
**Guard:** an intent test (dispatch + availability + palette projection); a test that an
action is not reachable through two paths.
**Prove:** every existing palette command and `eventBus` signal still fires; golden path green.

- [ ] **P9 — Protocol registry.**
One `Protocol` registry keyed by message `type` (schema + direction + handler). The server
validates inbound frames with the schema; the client routes inbound frames through the same
registry. Delete both hand-written switches.
**Guard:** a protocol test (every union member has a handler; an invalid frame is rejected).
**Prove:** all apps + golden path green; a malformed frame returns an error frame.

- [ ] **P10 — Projection pipeline + derived state.**
A `Projector` registry; `projectWorkspace` merges registered projectors. One `outline`
projection for sections/ToC/navigation. `derived(source, fn, equal?)` for
`$selectedNodeIds`, `$viewSelection`, `timeCursor`, `$runTerminations`.
**Guard:** projector merge tests; `derived` equality tests (no churn on equal value).
**Prove:** the graph, ToC and breadcrumbs unchanged; golden path green.

- [ ] **P11 — Bundle/App composition.**
`defineBundle` absorbs `PluginContribution` and `bundles/`; `defineApp` = bundle + shell +
default surface; the shell's regions are a `Layout` descriptor.
**Guard:** a bundle test (contributions land in the right catalogs); an app-composition test.
**Prove:** an app built as a bundle runs; the shell composes regions from data.

- [ ] **P12 — Domain catalogs + generic validation.**
Config fields, reasoning backends, LM providers and design primitives become catalogs of
`Contribution`; the one config schema is shared across the wire. Replace
`contribution-validator.ts` with one generic validator over `Contribution` + catalog
uniqueness.
**Guard:** a config-catalog test (client/server agree); a generic-validator test (missing
title/tag/duplicate id rejected uniformly).
**Prove:** settings UI + change log derive from the catalog; a new backend registers without
an edit.

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
  - *a new message:* one `defineMessage({ type, direction, schema, handle })`.
  - *a new intent:* one `Intent` catalog entry (palette + shortcut + agent-dispatchable at once).
  - *a new producer:* one `Projector` entry; *a derived value:* one `derived(...)`.
  - *a new backend/provider/field:* one catalog entry.
  - *a new app:* a directory + `defineApp(...)` (a bundle + a shell) + its surfaces.
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

### P0 — Kernel extraction (done)
- **What changed:** Split `core/store.ts` (922 lines) into `kernel/state.ts` (Atom primitive +
  kernel atoms: chat, graph, workspace, connection, config, telemetry, cognitive events,
  backends control, renderer) + `kernel/{domain,transport,backends,events,view}.ts` for
  kernel subsystems. `kernel/index.ts` now re-exports from these modules. `core/store.ts`
  re-exports kernel atoms and retains chrome atoms (lenses, layouts, panels, URL state,
  selections, view system).
- **Guard:** `pnpm --dir ui typecheck` ✓, `pnpm --dir ui test:unit` ✓ (769 tests)
- **Proof:** Ask prototype e2e ✓, golden-path e2e (chromium) ✓
- **Remaining:** Boundary invariant (§3.3) lint check not yet added; chrome atoms still in
  `core/store.ts` (by design for P0)
- **Opportunities:** `derived()` primitive (P10) will replace the manual
  `$selectedNodeIds`/`$viewSelection`/`timeCursor` sync subscriptions; `Projector` registry
  (P10) will replace hand-coded `projectWorkspace` merge.

---

## 9. Appendix — repo facts for a fresh session

### Layout
- `ui/src/client/kernel/index.ts` — the kernel facade (the only import surface an app needs).
- `ui/src/client/core/` — the **un-normalized** substrate + HUD chrome (~70 files, 10.8k lines).
- `ui/src/client/components/` — HUD chrome (~30 files, 17k lines) + `overlays/` (18 files).
- `ui/src/client/apps/ask/` — the first app (`index.html`, `main.ts`, `ask-app.ts`).
- `ui/src/client/{modulation,styles,utils,spacegraph,plugins,bundles}/` — HUD subsystems.
- `ui/src/server/index.ts` — the monolithic server (~1090 lines; `handleClientMessage` switch).
- `ui/src/shared/` — client/server shared bits (lens-schema, constants).
- `core/src/protocol/` — the zod protocol; `unions.ts` holds `IncomingFromClient/Server`.

### Key files per slice (starting points, not exhaustive)
- **P0:** `core/store.ts`; new `kernel/{state,domain,transport,backends,events,view}.ts`; `kernel/index.ts`.
- **P1:** new `framework/{contribution,catalog}.ts`; migrate `core/{block-descriptors,panel-defs,renderer-defs,graph-layer-defs,conversation-layout,reasoning-layout,composer-modes,capabilities,embedded-views}.ts`.
- **P2:** `core/{surface,surface-registry,overlay-registry,panel-defs,renderer-defs}.ts`, `core/{overlay-manager,overlay-host}.ts`.
- **P3:** `core/{view-adapter,view-host,view-spec}.ts`.
- **P4:** `core/store.ts` (lens/layer/filter state), `modulation/`, `core/composer-modes.ts`.
- **P5:** new `framework/app.ts`; `components/app-layout.ts`, `apps/ask/`.
- **P6:** `ui/src/server/index.ts` (`handleClientMessage`).
- **P7:** `apps/*`; move `components/` → `apps/hud/`.
- **P8:** `core/{events,commands}.ts`.
- **P9:** `core/src/protocol/`, `ui/src/server/index.ts`, `core/store-bindings.ts`.
- **P10:** `core/workspace-projection.ts`, `core/{sections,toc,navigation}.ts`, `core/store.ts`.
- **P11:** `core/plugins.ts`, `bundles/`, `framework/app.ts`.
- **P12:** `core/{config-schema,capabilities,lm-provider}.ts`, `ui/src/server/config-schema.ts`, `core/contribution-validator.ts`.

### The slice loop (repeat verbatim)
implement (substrate + ≥1 real consumer) → guard (unit, no mocks) → prove (run an app +
golden e2e) → `pnpm --dir ui typecheck && pnpm --dir ui test:unit` → commit + §8 entry.

### Guards that must stay green
- `ui/tests/scenarios/golden-path/operate-reasoner.spec.ts` (`@golden`) — the real HUD loop.
- `ui/tests/scenarios/prototypes/ask.spec.ts` (`@prototype`) — the first app.
- `ui/tests/components/*` (facade-honesty, reasoning-control-protocol, …).
- `ui/tests/visual/` cells — the presentation contract.

### Conventions (from `AGENTS.md`)
- Terse, self-documenting code; no comments beyond essential JSDoc.
- `pnpm`/`pnpx`, never `npm`/`npx`. No `pkill`. Do not edit `README.md` (generated).
- Unit tests: no mocks; test objects directly; deterministic; behavior over implementation.
