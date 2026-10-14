# UI.16 — Graph Workspace: One Parametric App, Configurable Surfaces

**Goal:** Ship a usable Graph Workspace *this week* by unifying all apps under one parametric core. The graph is the substrate; surfaces (chat, goals, console, notebook) are composable inputs. "Apps" become saved configs (URLs).

---

## Strategy: A → C → B

| Phase | What | Time | Deliverable |
|-------|------|------|-------------|
| **A** | Refactor shells → `BaseAppSurface` | 1 day | 4 apps share one shell; ~600 lines deleted |
| **C** | Build **one** `GraphWorkspace` app | 2 days | Parametric: lens/layer/shape/mode/fit/layout + composable surfaces |
| **B** | Presets = saved configs (URLs) | 0 days | `chat-graph`, `reasoning-desk`, `graph-3d`, `dashboard` = bookmarks |

---

## Phase A: Shell Consolidation (1 day)

Refactor 4 apps to `BaseAppSurface` + `GraphToolbar` + `createGraphProjector`:

| App | Current | Refactored |
|-----|---------|------------|
| Ask | custom header, inline selects | `BaseAppSurface` + `GraphToolbar` + `ask-surface` |
| Notebook | custom header, breadcrumb | `BaseAppSurface` + `GraphToolbar` (for embedded graphs) |
| Console | custom header, status | `BaseAppSurface` (header/status only) |
| HUD | custom header, panel grid | `BaseAppSurface` (standardized) |

**Shared components already exist:** `ui/src/client/apps/shared/` — `BaseAppSurface`, `GraphToolbar`, `createGraphProjector`, `GraphViewportWrapper`.

**Done:** Goals, Explore (already use shared). Lab (composer uses shared).

---

## Phase C: GraphWorkspace — The One App (2 days)

### Single entry point: `apps/graph-workspace/`

```
src/client/apps/graph-workspace/
├── index.html           # Vite entry
├── main.ts              # Boot: connect, mount GraphWorkspace
├── graph-workspace.ts   # The parametric app component
├── config.ts            # Default configs for presets
└── surfaces/            # Composable surface tags (already exist)
    ├── ask-surface
    ├── graph-surface
    ├── goals-surface
    ├── console-surface
    ├── notebook-surface
    ├── explore-surface
    ├── hud-surface
    └── panels/...
```

### GraphWorkspace component (pseudocode)

```ts
@customElement('graph-workspace')
export class GraphWorkspace extends BaseAppSurface {
  // URL-driven config (synced to atoms)
  @state() config: WorkspaceConfig = parseURL();

  // Parametric graph controls (from URL or toolbar)
  @state() lens = $activeLens.get();
  @state() layer = $graphLayer.get();
  @state() shape = $graphShape.get();
  @state() mode = $viewportMode.get();
  @state() fit = $graphFit.get();
  @state() filter = $graphFilter.get();
  @state() layout = 'h'; // or 'chat-graph', 'reasoning-desk', etc.

  // Composable surfaces — which ones are mounted
  @state() surfaces: SurfaceId[] = ['chat', 'graph'];

  protected renderToolbar() {
    return html`<graph-toolbar
      .showLens=${true} .showLayer=${true} .showShape=${true}
      .showMode=${true} .showFit=${true} .showFilter=${true}
      .showLayout=${true} .showSurfaces=${true}
    ></graph-toolbar>`;
  }

  protected renderViewportContent() {
    return html`
      <div class="grid" style="grid-template-columns:${this.layoutColumns}; grid-template-areas:${this.layoutAreas}">
        ${this.surfaces.map(s => html`<section data-area=${s}>${this.renderSurface(s)}</section>`)}
      </div>
    `;
  }

  private renderSurface(id: SurfaceId) {
    const tags = SURFACE_TAGS[id]; // e.g. 'chat' → ['ask-surface']
    return tags.map(tag => document.createElement(tag));
  }
}
```

### Config presets (URL params)

| Preset | URL | Surfaces | Layout | Lens | Mode | Shape | Fit |
|--------|-----|----------|--------|------|------|-------|-----|
| `chat-graph` | `?preset=chat-graph` | `['chat','graph']` | `h` | belief | 2d | graph | fit |
| `reasoning-desk` | `?preset=reasoning-desk` | `['chat','notebook','inspector']` | `h` | belief | 2d | graph | fit |
| `graph-3d` | `?preset=graph-3d` | `['graph']` | `auto` | temporal | 3d | graph | legible |
| `dashboard` | `?preset=dashboard` | `['metrics','graph','chat']` | `grid` | belief | 2d | graph | fit |
| `command-deck` | `?preset=command-deck` | `['console','goals','graph']` | `h` | goal | 2d | graph | fit |
| `study` | `?preset=study` | `['chat','notebook','graph','explore','metrics','timeline']` | `grid` | temporal | 2d | graph | fit |

**URL schema:**
```
?preset=chat-graph
?surfaces=chat,graph&layout=h&lens=belief&mode=2d&shape=graph&fit=fit
```

---

## Phase B: "Promotion" = Bookmarks (0 days)

No new code. Just:
1. Add preset configs to `config.ts`
2. Add links in Lab index / landing page
3. Each preset is a shareable URL — `https://app/graph-workspace/?preset=chat-graph`

---

## Immediate Next Steps (Today)

1. **Refactor Ask → BaseAppSurface** (largest app, biggest win)
2. **Scaffold GraphWorkspace** with:
   - `BaseAppSurface` shell
   - `GraphToolbar` (all controls)
   - Surface registry + layout engine
   - URL ↔ config sync
3. **Verify** `chat-graph` preset works end-to-end

---

## Files to Create/Modify

### New
- `ui/src/client/apps/graph-workspace/` (entire app)
- `ui/src/client/apps/shared/surface-registry.ts` (surface tag map)
- `ui/src/client/apps/shared/layout-engine.ts` (CSS grid from layout spec)

### Modify
- `ui/src/client/apps/ask/ask-app-v2.ts` → `BaseAppSurface`
- `ui/src/client/apps/notebook/notebook-app.ts` → `BaseAppSurface`
- `ui/src/client/apps/console/console-app.ts` → `BaseAppSurface`
- `ui/src/client/apps/hud/hud-app.ts` → `BaseAppSurface`
- `ui/src/client/apps/lab/lab-app.ts` → thin wrapper around GraphWorkspace composer mode

### Delete (after refactor)
- Per-app header/toolbar/viewport CSS (~600 lines total)

---

## Success Criteria

- [ ] All 6 standalone apps use `BaseAppSurface` + `GraphToolbar`
- [ ] `GraphWorkspace` mounts any surface combination via URL
- [ ] 6 presets work as shareable URLs
- [ ] Typecheck + unit + golden + app e2e all green
- [ ] Can dogfood `chat-graph` for daily reasoning tasks

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| GraphWorkspace too complex | Start minimal: 2 surfaces (chat+graph), 1 layout (h). Add incrementally. |
| URL sync fragility | Use existing atom watch pattern; test with Lab composer first. |
| Layout engine scope | Reuse `layoutTemplate` from `compose.ts` — already handles h/v/grid/hero/rail. |
| Surface registration | Explicit `SURFACE_TAGS` map; no magic. |

---

## Dependencies on Existing Work

- ✅ `BaseAppSurface`, `GraphToolbar`, `createGraphProjector` exist
- ✅ `GraphFit` policy (`legible`/`fit`) works
- ✅ `settleZoom` density-factor fix in place
- ✅ Lab composer URL schema (`?compose=1&...`) proven
- ✅ All atoms exported via kernel/index

---

## Timeline

| Day | Focus |
|-----|-------|
| **Today** | Ask → BaseAppSurface; scaffold GraphWorkspace |
| **+1** | GraphWorkspace: toolbar + surface registry + layout |
| **+2** | Presets + URL sync + e2e verify `chat-graph` |
| **+3** | Refactor Notebook, Console, HUD |
| **+4** | Dogfood `chat-graph`; iterate |

---

## Open Questions

1. **State persistence** — should WorkspaceConfig persist to localStorage, or always URL-only? (Lean: URL-only, bookmarkable)
2. **Panel system** — keep HUD's panel grid, or unify under layout engine? (Lean: layout engine handles both grid areas and panels)
3. **Graph surface vs GraphViewportWrapper** — which is the primitive? (Lean: `graph-viewport` is primitive; `graph-surface` adds shape/mode logic)
4. **Notebook breadcrumb** — keep as Notebook-specific, or generalize? (Lean: keep specific; not a shared pattern)

---

## References

- `ui/src/client/apps/shared/` — shared components
- `ui/src/client/apps/lab/compose.ts` — layoutTemplate, Spec, URL schema
- `ui/src/client/apps/lab/variants.ts` — 21 preset definitions
- `ui/src/client/kernel/index.ts` — atoms ($activeLens, $graphLayer, $graphFit, etc.)