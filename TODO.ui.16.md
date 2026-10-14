# UI.16 — Graph Workspace: One Parametric App, Configurable Surfaces

**Goal:** Ship a usable Graph Workspace **this week** by reusing the Lab composer as the parametric core. The graph is the substrate; surfaces (chat, goals, console, notebook) are composable inputs. "Apps" = saved preset URLs.

---

## Optimized Strategy: C → A (parallel) + Reuse Lab Composer

| Phase | What | Time | Deliverable |
|-------|------|------|-------------|
| **0** | Extract primitives from Lab | 0.5 day | `ComposerControls`, `SurfaceRegistry`, `LayoutEngine`, `ConfigSync` → `shared/` |
| **1** | **GraphWorkspace** = Lab composer + preset defaults | 1 day | Working `chat-graph` URL (parametric) |
| **1-2** | Refactor **Ask only** → `BaseAppSurface` | 0.5 day | Ask uses shared shell (only app needing it) |
| **2** | Add presets + verify 4 configs | 0.5 day | `chat-graph`, `reasoning-desk`, `graph-3d`, `dashboard` working |

**Total: ~2.5 days** (vs 4.5 sequential). Lab composer *is* the GraphWorkspace — just extract it.

---

## Key Insight

```
Lab (catalogue + composer)     GraphWorkspace (presets only)
│                                    │
├─ Menu (index)                     ├─ Default: chat-graph
├─ Presets (?v=...)                 ├─ Presets (?preset=...)
└─ Composer (?compose=1&...)   →    └─ Composer (same component)
```

**The Lab's composer mode (`?compose=1&...`) IS the GraphWorkspace.** Just extract it.

---

## Phase 0: Extract Primitives from Lab (Today, 0.5 day)

Move to `ui/src/client/apps/shared/`:

| Primitive | From | To |
|-----------|------|----|
| `ComposerControls` (toolbar selects + surface chips) | `lab-app.ts` | `shared/composer-controls.ts` |
| `SurfaceRegistry` (`SURFACE_TAGS`: `chat`→`ask-surface`, etc.) | `variants.ts`/`compose.ts` | `shared/surface-registry.ts` |
| `LayoutEngine` (`layoutTemplate`, `specToVariant`) | `compose.ts` | `shared/layout-engine.ts` (re-export) |
| `ConfigSync` (URL ↔ Spec ↔ atoms) | `lab-app.ts` | `shared/config-sync.ts` |

**No new logic** — just factoring out what already works.

---

## Phase 1: GraphWorkspace App (Day 1)

### Single entry: `apps/graph-workspace/`

```
src/client/apps/graph-workspace/
├── index.html
├── main.ts              # Boot, connect, mount GraphWorkspace
├── graph-workspace.ts   # Thin: BaseAppSurface + ComposerControls
├── presets.ts           # 4 preset configs (see below)
└── surfaces/            # Re-export existing surface tags
```

### GraphWorkspace = BaseAppSurface + ComposerControls

```ts
@customElement('graph-workspace')
export class GraphWorkspace extends BaseAppSurface {
  // URL-driven config (synced to atoms via ConfigSync)
  private config = ConfigSync.fromURL() ?? PRESETS['chat-graph'];

  protected override get appTitle() { return 'Graph Workspace'; }
  protected override get appTagline() { return this.config.presetName; }

  protected override renderToolbar() {
    return html`<composer-controls
      .config=${this.config}
      @config-change=${this.onConfigChange}
    ></composer-controls>`;
  }

  protected override renderViewportContent() {
    const { columns, rows, areas } = layoutTemplate(this.config.layout, this.config.surfaces.length);
    const regions = specToVariant(this.config).regions;
    return html`
      <div class="grid" style="grid-template-columns:${columns}; grid-template-rows:${rows}; grid-template-areas:${areas}">
        ${Object.entries(regions).map(([area, tags]) => html`
          <section data-area=${area} style="grid-area:${area}">
            ${tags.map(tag => document.createElement(tag))}
          </section>
        `)}
      </div>
    `;
  }
}
```

### Presets (4, sufficient for dogfooding)

| Preset | Surfaces | Layout | Lens | Mode | Shape | Fit | Use Case |
|--------|----------|--------|------|------|-------|-----|----------|
| `chat-graph` | `['chat','graph']` | `h` | belief | 2d | graph | fit | Daily reasoning |
| `reasoning-desk` | `['chat','notebook','inspector']` | `h` | belief | 2d | graph | fit | Read/ask/inspect |
| `graph-3d` | `['graph']` | `auto` | temporal | 3d | graph | legible | Spatial exploration |
| `dashboard` | `['metrics','graph','chat']` | `grid` | belief | 2d | graph | fit | Observability |

**URL schema:** `?preset=chat-graph` or `?surfaces=chat,graph&layout=h&lens=belief&mode=2d&shape=graph&fit=fit`

---

## Phase 1.5: Ask → BaseAppSurface (Parallel, Day 1-2)

Only Ask benefits fully from `BaseAppSurface` + `GraphToolbar`:
- Header, toolbar, connection status, empty state = identical
- Graph viewport integration = identical
- Unique: `ask-surface` (chat input) — keep as-is

Notebook/Console/HUD have unique UIs; minimal header update only if needed.

---

## Phase 2: Verify Presets (Day 2)

| Preset | Test |
|--------|------|
| `chat-graph` | Assert ask-surface + graph-surface mount, graph renders |
| `reasoning-desk` | 3 panes, inspector shows node detail |
| `graph-3d` | 3D mode renders, temporal lens works |
| `dashboard` | 3-pane grid, metrics + graph + chat |

Add e2e tests in `tests/scenarios/apps/graph-workspace.spec.ts`.

---

## What NOT to Do (Deliberate Cuts)

| Skip | Reason |
|------|--------|
| Full HUD refactor | Panel grid ≠ app shell; keep as-is |
| Notebook breadcrumb standardization | Unique to Notebook; don't force |
| Console full shell swap | Terminal UI is different; header/status only if needed |
| Separate app bundles for presets | One Vite entry; presets = query params |
| localStorage persistence | URL-only = bookmarkable, shareable, stateless |
| Panel system unification | Layout engine handles grid; panels stay HUD-specific |

---

## Files to Create/Modify

### New (Phase 0)
- `ui/src/client/apps/shared/composer-controls.ts` — extracted from Lab
- `ui/src/client/apps/shared/surface-registry.ts` — `SURFACE_TAGS` map
- `ui/src/client/apps/shared/config-sync.ts` — URL ↔ Spec ↔ atoms

### New (Phase 1)
- `ui/src/client/apps/graph-workspace/` — entire app (4 files)

### Modify (Phase 1.5)
- `ui/src/client/apps/ask/ask-app-v2.ts` → `BaseAppSurface` + `GraphToolbar`

### Delete (After)
- Per-app header/toolbar CSS in Ask (~150 lines)

---

## Success Criteria (End of Week)

- [ ] `GraphWorkspace` at `/apps/graph-workspace/` loads with `?preset=chat-graph`
- [ ] Toolbar controls (lens, layer, shape, mode, fit, layout, surfaces) all functional
- [ ] 4 presets work as shareable URLs
- [ ] Ask refactored to shared shell
- [ ] Typecheck + unit + golden + app e2e all green
- [ ] Can dogfood `chat-graph` for daily reasoning

---

## Timeline

| Day | Focus |
|-----|-------|
| **Today** | Extract primitives → scaffold GraphWorkspace → `chat-graph` works |
| **+1** | Add 3 more presets; refactor Ask → BaseAppSurface |
| **+2** | E2e verify all presets; dogfood `chat-graph` |

---

## Dependencies (Already Done ✅)

- `BaseAppSurface`, `GraphToolbar`, `createGraphProjector` exist in `shared/`
- `GraphFit` policy (`legible`/`fit`) works
- `settleZoom` density-factor fix in place
- Lab composer URL schema (`?compose=1&...`) proven
- All atoms exported via kernel/index
- `layoutTemplate`, `specToVariant`, `parseSpec`, `specToSearch` in `compose.ts`

---

## References

- `ui/src/client/apps/shared/` — shared components
- `ui/src/client/apps/lab/compose.ts` — layoutTemplate, Spec, URL schema
- `ui/src/client/apps/lab/variants.ts` — 21 preset definitions
- `ui/src/client/kernel/index.ts` — atoms ($activeLens, $graphLayer, $graphFit, etc.)
- `ui/src/client/apps/lab/lab-app.ts` — ComposerControls logic to extract