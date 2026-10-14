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

1. **Fix graph legibility in small cells (the top blocker).** `graph-viewport`
   `enforceLegibleView` fits, then `clampZoom` **raises** zoom to a legibility floor
   (`zoomFloor`, `graph-scaling.ts:64`) — so a graph in a cell shows only a few nodes, or a
   single edge spans the viewport (`?v=graph` misleadingly looks empty). Decide the policy:
   either (a) a **"fit-all" mode** the lab/composer can request (fit to all nodes, accept
   small nodes), or (b) make the floor **viewport-relative** so small cells still fit. This is
   what makes the wall *look* compelling; do it first.
2. **Re-baseline the visual contract for dark-by-default.** `pnpm --dir ui test:visual` is
   **red** on `overlay-settings` (theme select now shows `dark`, was `auto`) plus 5 stale
   overlay cells (`overlay-palette/toc/provider/artifact/breadcrumb`) — the latter are
   pre-existing drift from the `ui.13` refactors, not this work. Run `test:visual:update` once
   the legibility fix lands, then inspect the git diff of baselines for unintended changes.
3. **Promote winners.** For each keeper metaphor: create `apps/<name>/{index.html,main.ts}`
   + a `defineApp` whose bundle's surfaces are the composition; add a `vite.config.ts` input.
   The lab preset is the spec.
4. **Guards.** A unit test over `compose.ts` (`specToVariant`: region/template correctness;
   `parseSpec` round-trips `specToSearch`) and a `@app` e2e that loads `/apps/lab/?v=chat-graph`
   and asserts the grid mounts both surfaces.
5. **Only then** revisit `ui.14` Phase D/E (cognitive translation, chat-as-default) — each is
   now *one promoted composition*, not a phase.

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
