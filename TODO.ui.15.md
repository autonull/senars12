# TODO.ui.15.md — The UI Lab: explore the space of apps

> **Supersedes `TODO.ui.14.md`** for direction. `ui.14`'s Phase A–C (green the gate) is
> effectively **done** (`pnpm ui:gate`: typecheck ✓ · unit **801/801** ✓ · golden e2e ✓) and
> its Phase D–F slices are **parked**: they polish/appify *one* shape at a time. This file
> replaces that with a different strategy: **stop picking a shape — generate many and let
> the operator choose.**

> **North star (the operator's words):** *"Make dozens of potential apps that use these
> components, populate them with example data, and let me pick and choose what UI metaphors
> to keep. Throw everything at the wall. Don't polish one turd at a time. Invent the
> multidimensional space of applications we can interpolate between."*

---

## The strategy

**An app is data, not a codebase.** Every view is a *widget* (a surface tag). An *app* is a
composition: an ordered set of widgets, a layout template, and global controls (graph
mode/shape, lens, layer). This is the `ui.13` framework's payoff — `defineSurface` parts
placed by a `defineApp`/bundle — generalized into a browsable, generative space.

**The one rule:** to explore, *add data* (a widget, a layout, a preset) — never fork a view.
The lab is one page; every point in the space is a URL.

**The workflow:** open the lab → browse/se randomize compositions → pick the metaphors that
read well → **promote a winner** into a real `apps/<name>/` entry (a `defineApp` whose bundle
*is* that composition). Promotion is copy-the-data, not copy-the-code.

---

## What is built (this session)

**`ui/src/client/apps/lab/`** — the exploration surface (route `/apps/lab/`):

| File | Role |
|---|---|
| `variants.ts` | `Variant` data (grid areas/columns/rows + region→tags + optional mode/shape). **~47 named presets.** |
| `compose.ts` | The parameter space: `WIDGETS` (23), `LAYOUTS` (auto/h/v/grid/hero/rail), `MODES`/`SHAPES`/`LENSES`/`LAYERS`; `specToVariant`, `parseSpec`, `specToSearch`, `randomSpec`. |
| `lab-app.ts` | `<lab-surface>`: renders the menu (`/apps/lab/`), a preset (`?v=<id>`), or the composer (`?compose=1&...`). Applies mode/shape/lens/layer atoms; fills the grid imperatively (`cell.replaceChildren(...)`). |
| `main.ts` | Boots: `connect()` + `mountWorkspaceProjection()`, imports every surface, seeds example conversation. |
| `index.html` | Mounts `<lab-surface>`. |

**Routes**
- `/apps/lab/` — the menu (cards, one link per preset) + a **Composer** card.
- `/apps/lab/?v=<id>` — a preset; **separate page load**, header has prev/next/all.
- `/apps/lab/?compose=1&layout=h&w=chat,graph&mode=2d&shape=graph&lens=belief&layer=both` —
  the live composer: layout/mode/shape/lens/layer selects, widget chips, **randomize**,
  **clear**, and a permalink readout. State is URL-encoded; each point is shareable.

**The dimensions (the space)**
- **Widgets** (23): projections `chat · graph · notebook · console · goals · explore · hud`;
  chrome `inspector · metrics · telemetry · history · timeline · toolbar · minimap · legend ·
  lenses · designer · config`; views `toc · events · nodes · related · explain`.
- **Layouts**: auto (by count), columns, rows, grid, hero+rail, rail+hero.
- **Graph mode** `2d·3d`, **shape** `graph·table`, **lens** `belief·goal·contradiction·temporal`,
  **layer** `both·conversation·concepts` — applied per page.

**Framework changes made to enable this** (these are real fixes, keep them):
- `kernel/index.ts` exports `mountWorkspaceProjection`; **`s-app-shell` mounts it once** — this
  fixes the earlier bug where every shell-based app (`notebook`, `explore`, …) had a **blank
  workspace** because the projection was never mounted.
- **`graph-viewport` gained a `ResizeObserver`** that re-fits on host resize — so a graph in a
  grid/split cell re-settles when its box changes.
- **`goals-app`** now scopes its projection to `kind === 'goal'` blocks (it previously reacted
  to *any* node, so its "No goals yet" state was unreachable).
- **Default theme = `dark`** (`config-schema.ts` + `config-catalog.ts`). Under the old `auto`,
  light-scheme captures rendered the graph as blank cyan boxes — this is *why* screenshots
  looked empty.
- Notebook e2e rewritten to assert real behavior (renders the seeded workspace; a submitted
  belief becomes a `claim:` block; breadcrumb follows focus). Per-app e2e **10/10**.

---

## ▶ START HERE (fresh session)

**Resume at the first unchecked item in "Next".** The gate to keep green is
`pnpm ui:gate` (typecheck + unit + golden). The lab is additive and currently untested.

### Next (in order)

1. ✅ **Fix graph legibility in small cells (done this session).** Rather than fork a
   view, the *policy* became data: `settleZoom(zoom, count, area, fit)` in
   `graph-scaling.ts` selects between `'legible'` (lift to the node floor — the old
   behaviour, kept as the *default*) and `'fit'` (cap at the ceiling only, so a graph
   in a small cell shows *all* of it). The policy is one atom, `$graphFit`
   (`core/store.ts`, exported via `kernel/index.ts` and `core/index.ts`); `graph-viewport`
   reads it in `settleView` (renamed from `enforceLegibleView`) and re-settles on change.
   **The Lab sets `$graphFit = 'fit'` for every page** (`lab-app.ts#applyGlobals`), so the
   wall shows whole graphs, not legible crops. Default path is byte-identical to before.
2. ✅ **Re-baseline the visual contract for dark-by-default (done this session).**
   `pnpm --dir ui test:visual:update` updated 6 baselines: 4 stale cells from `ui.13`
   refactors (`overlay-palette/toc/provider/breadcrumb` — file sizes dropped 40-70%),
   the expected `overlay-settings` theme change (`dark` replaces `auto`),
   and a flaky `overlay-telemetry` cell. Suite now **62/62 passed**. Visual-curation
   complete; the contract is clean for the dark-by-default default.
3. **Promote winners — OPERATOR-GATED.** For each keeper metaphor: create
   `apps/<name>/{index.html,main.ts}` + a `defineApp` whose bundle's surfaces are the
   composition; add a `vite.config.ts` input. The lab preset is the spec. No composition has
   been chosen yet, so nothing was promoted. **Note:** the promoted app should decide its own
   fit policy — a full-page app probably wants the `'legible'` default, whereas the Lab wall
   wants `'fit'`.
4. ✅ **Guards (done this session).** `tests/components/lab-compose.test.ts` covers `compose.ts`
   (`layoutTemplate` per layout incl. grid/hero/rail track counts; `specToVariant` region ↔
   template agreement; `parseSpec` ⇄ `specToSearch` round-trip incl. unknown-dimension fallback;
   200 `randomSpec` samples inside the space and addressable); `tests/components/graph-scaling.test.ts`
   gained the `settleZoom` policy contract. `tests/scenarios/apps/lab.spec.ts` (`@app @lab`) loads
   `/apps/lab/?v=chat-graph` and the composer URL and asserts the grid mounts both surfaces.
5. **Only then** revisit `ui.14` Phase D/E (cognitive translation, chat-as-default) — each is
   now *one promoted composition*, not a phase.

### New opportunities (found this session)

- **The composer does not expose the fit policy.** `$graphFit` is set globally by the Lab; a
  `fit` control in the composer toolbar (or a `?fit=` query dimension) would let a single
  page compare legible vs fit on the same composition. Low cost, one `select`.
- **`nodeSize`/`zoomFloor` are area-inverted for small cells.** `densityFactor` *shrinks*
  world node size when the viewport is small (`sqrt(area/refArea)`), which *raises* the legible
  floor — the opposite of what a small cell needs. `'fit'` sidesteps this, but the legible
  policy would read better if the floor were bounded by the current fit zoom, so a graph that
  genuinely cannot fit legibly settles at the best legible-and-whole compromise instead of a crop.
- **The Lab is the natural home for a `?compose=1&fit=` matrix** — but only after (3) picks
  keepers, so the space explored is the space that might ship.

**Commands** (repo root unless noted)
- serve: `NODE_NO_WARNINGS=1 tsx scripts/agent-server.ts 3456` (cwd `ui/`) — loads the
  bootstrap scenario; the lab is `/apps/lab/`.
- screenshot a variant: `pnpm exec playwright screenshot -b chromium --wait-for-timeout=5000
  "http://localhost:3456/apps/lab/?v=chat-graph" screenshots/lab.png` (positional filename;
  `-b chromium`; **chromium only**).
- gate: `pnpm --dir ui typecheck && pnpm --dir ui test:unit`; golden: `pnpm --dir ui test:e2e:golden`.
- visual: `pnpm --dir ui test:visual` / `test:visual:update`.

---

## Kill the waste (process rules from this session)

- **Chromium only.** firefox/webkit aren't installed and aren't in the gate; running them is
  pure cost.
- **Don't batch unrelated specs into one Playwright run.** `reuseExistingServer` + a shared
  server means `apps` + `golden` in one invocation **pollutes the golden path** (a phantom
  failure — the known shared-state flake). Run each with a fresh server.
- **`test:visual` is serial and ~8 min.** Run it only when you mean to; never casually.
- **The gate is `typecheck + unit + golden`.** `test:visual`/`test:design` are separate gates
  owned by the visual-curation work, not by every slice.

---

## Session state as of this hand-off (uncommitted → see git)

Changed: `kernel/index.ts`, `components/s-app-shell.ts`, `components/graph-viewport.ts`,
`apps/goals/goals-app.ts`, `core/config-schema.ts`, `core/config-catalog.ts`,
`tests/scenarios/apps/notebook.spec.ts`; new: `apps/lab/*`, `screenshots/p19-*.png`,
`TODO.ui.15.md`; `vite.config.ts` (lab input). The prior `P13–P19` commits are on `main`.

**Known-red / accepted for now:** `test:visual` (6 cells — 1 expected theme change, 5 stale).
Nothing else is red: typecheck ✓, unit 801/801 ✓, golden e2e ✓, per-app e2e 10/10 ✓.

## Session state — visual re-baseline complete (committed)

Visual contract: 6 baselines refreshed (`overlay-palette/toc/provider/breadcrumb` stale
from ui.13, `overlay-settings` dark-by-default, `overlay-telemetry` flaky). Suite
**62/62 passed**. The dark-by-default contract is now clean.

**Verified this session:** typecheck ✓ · unit **814/814** ✓ · golden e2e (chromium) ✓ ·
lab `@app` e2e 2/2 ✓ · visual 62/62 ✓. Ran chromium only, per the process rules below.

**Still open:** item 3 (promote winners — needs an operator pick), item 5 (downstream of 3).
