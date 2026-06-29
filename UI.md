# SeNARS UI/UX Development Plan

## Executive Summary

The SeNARS UI is a Lit + Cytoscape.js SPA with WebSocket backend. Current architecture is clean but UX has significant
gaps: no responsive layout, limited graph interaction, poor accessibility, no deep linking, and cognitive lenses are
undiscoverable. This plan consolidates features into coherent architectural layers, eliminates redundancies, and
establishes extensible foundations.

---

## 0. Architectural Foundations (Do First)

These cross-cutting concerns enable everything else. Implement before feature work.

### 0.1 Design Token System

**Single source of truth** for colors, spacing, typography, motion, z-index.

```
design-tokens.json (source)
├── colors: { primitive, semantic, cognitive-lens, status }
├── spacing: { scale, component }
├── typography: { font-families, scale, line-heights }
├── motion: { durations, easings, reduced-motion }
├── z-index: { layers }
├── breakpoints: { mobile, tablet, desktop, wide }
└── border-radius: { scale }
```

**Outputs**: CSS custom properties (`:root`), TS constants (`tokens.ts`), Tailwind-compatible config (optional). Use
`@layer` cascade: `reset`, `tokens`, `base`, `components`, `utilities`.

### 0.2 Unified State Architecture

Extend `store.ts` with a **panel registry** and **URL sync** as first-class concerns. Shortcuts registry deferred to
Phase 2.

```ts
// store.ts additions
interface PanelState { id: string; open: boolean; docked: 'left'|'right'|'bottom'|'float'; size: number; order: number; }
const $panels = atom<Map<string, PanelState>>(new Map([
  ['config', { id: 'config', open: false, docked: 'right', size: 320, order: 0 }],
  ['telemetry', { id: 'telemetry', open: true, docked: 'bottom', size: 120, order: 0 }],
  ['chat', { id: 'chat', open: false, docked: 'right', size: 360, order: 1 }],
  ['search', { id: 'search', open: false, docked: 'left', size: 280, order: 0 }],
]));

// URL synchronization (hash-based, no router dependency)
const $urlState = atom<{
  lens: Lens;
  focus?: string;
  viewport?: { x: number; y: number; zoom: number };
  search?: string;
  panels?: string[]; // open panel IDs
}>({ lens: 'belief' });

// Phase 2: Keyboard shortcut registry (deferred)
const $shortcuts = atom<Map<string, () => void>>(new Map());
```

**Benefits**: Single panel system replaces ad-hoc `$configOpen` + telemetry visibility + future chat/search panels. URL
state enables deep linking without a router. Shortcuts registry (Phase 2) enables command palette + help overlay.

### 0.3 Component Primitives Library

Build once, use everywhere. **No feature component should write raw CSS for these patterns.**

| Primitive    | Variants                                       | Use Cases                       |
|--------------|------------------------------------------------|---------------------------------|
| `Button`     | primary, secondary, ghost, danger, icon        | All actions                     |
| `Input`      | text, search, textarea, select, slider, toggle | Forms, search, config           |
| `Panel`      | drawer, sidebar, bottom-sheet, modal, popover  | Config, chat, search, detail    |
| `Toolbar`    | floating, pinned, overflow                     | Graph toolbar, status bar       |
| `Tooltip`    | hover, focus, delayed                          | Node hover, lens legend         |
| `Badge`      | count, status, lens                            | Contradiction badge, lens pills |
| `EmptyState` | illustrated, action                            | No graph, no chat, no results   |
| `Banner`     | info, warning, error, success                  | Connection, offline, errors     |
| `Spinner`    | inline, overlay                                | Loading states                  |
| `Divider`    | horizontal, vertical                           | Panel sections                  |

**Implementation**: Lit base classes + CSS custom properties for theming. All feature components compose primitives.

### 0.4 CSS Architecture

```css
/* theme.css - single entry point */
@layer reset, tokens, base, primitives, components, utilities;

@layer tokens { @import './tokens.css'; }        /* generated from design-tokens.json */
@layer base { @import './base.css'; }            /* body, scrollbar, focus-visible */
@layer primitives { @import './primitives.css'; } /* shared component styles */
@layer components { /* feature components import their own */ }
@layer utilities { @import './utilities.css'; }  /* .sr-only, .visually-hidden, .flex-center */
```

**Container queries** for panel responsiveness (not viewport media queries). Panels own their breakpoints.

### 0.5 Accessibility Foundation

- **Focus management**: `FocusTrap` utility for drawers/modals, `restoreFocus` on close
- **Live regions**: `Announcer` service for `aria-live` messages (lens changed, connection status, errors)
- **Keyboard (Phase 2)**: `useKeyboardShortcut` composable for consistent `Cmd/Ctrl+K`, `Escape`, arrow handling
- **Color**: Semantic tokens only (`--color-status-connected`, not `--accent-cyan` directly). High-contrast mode via
  `@media (prefers-contrast: high)` override layer.

---

## 1. Layout & Navigation System

### 1.1 Responsive App Shell (`app-layout`)

```
┌─────────────────────────────────────────────────────┐
│ StatusBar (48px)  ─── Lens │ Search │ Connection ───►│
├──────────────┬──────────────────────┬────────────────┤
│              │                      │                │
│   Search     │      Graph           │   Config/Chat  │
│   (collapsible)  (flex: 1)          │   (dockable)   │
│   Panel      │                      │                │
│              │                      │                │
├──────────────┴──────────────────────┴────────────────┤
│ InputHUD (bottom, auto-height, max 40vh)             │
└─────────────────────────────────────────────────────┘
```

**Breakpoints** (container queries on `#app-root`):

- `< 640px`: All panels → bottom sheets; search inline in status bar
- `640-1024px`: Config/chat → drawers; search → left drawer; telemetry → bottom drawer
- `> 1024px`: All panels docked; search optional left sidebar

**State**: `$panels` atom drives everything. No component-specific open/close state.

### 1.2 Command Palette (`command-palette`) — Phase 2

**Single source of truth for all keyboard-driven actions.** Deferred until design settles.

```ts
interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;      // "Cmd+K", "1", "G F"
  category: 'lens'|'navigation'|'config'|'graph'|'chat'|'help';
  action: () => void;
  when?: () => boolean;   // conditional visibility
  keywords: string[];     // fuzzy search terms
}
```

**Built-in commands** (auto-registered from shortcuts registry in Phase 2):

- Lens: `1` Belief, `2` Goal, `3` Contradiction
- Navigation: `G F` Focus search, `G V` Focus graph, `G I` Focus input
- Panels: `Cmd+\` Config, `Cmd+T` Telemetry, `Cmd+Shift+C` Chat
- Graph: `0` Reset zoom, `F` Fit, `M` Toggle minimap
- Help: `?` Show shortcuts overlay

**Implementation**: `command-palette.ts` consumes `$shortcuts` + static commands. Opens via `Cmd/Ctrl+K` or status bar
button. **Phase 2 work**.

### 1.3 URL State Synchronization

Hash-based (no server routing needed):

```
#lens=belief&focus=term&viewport=x,y,zoom&search=query&panels=config,chat
```

**Sync strategy**: Bidirectional. `$urlState` atom ↔ `window.location.hash`. Debounced writes (300ms). On load, parse
hash → hydrate atoms.

---

## 2. Graph Interaction Layer

### 2.1 Graph Toolbar (`graph-toolbar`) — Floating, Pinned, or Overflow

**Consolidates**: zoom controls, fit, search, **lens selector** (segmented control), layout selector, minimap toggle.
Lens legend moved to `lens-controller` popover.

```
[Zoom -] [Zoom %] [Zoom +] [Fit] │ [Search 🔍__________] │ [Belief] [Goal] [Conflict] │ [Layout: Cose ▼] [Minimap]
```

**Search**: Debounced (150ms), fuzzy (Fuse.js), filters nodes in-place (dim non-matches), shows match count. **URL
sync**: `?search=...`.

**Lens Selector**: Segmented control (3 buttons) — always visible. Hover → `lens-controller` popover with description +
node count. Click to switch lens.

**Layout Selector**: Per-lens persistence. Options: `cose`, `concentric`, `breadthfirst`, `preset` (manual positions).

### 2.2 Node Interaction Model (Unified)

| Gesture       | Action                                              | Feedback           |
|---------------|-----------------------------------------------------|--------------------|
| Click         | Select + center + open detail drawer                | Highlight, animate |
| Shift+Click   | Toggle multi-select                                 | Checkmark badge    |
| Drag (canvas) | Pan                                                 | Grab cursor        |
| Drag (node)   | Move node (preset layout)                           | Ghost preview      |
| Wheel         | Zoom (centered on cursor)                           | Smooth             |
| Pinch         | Zoom (touch)                                        | Native             |
| Right-click   | Context menu                                        | Anchored to node   |
| Hover (500ms) | Tooltip (priority, confidence, lens scores, degree) | Fade in            |
| Double-click  | Focus term (send `focus.set`)                       | Pulse animation    |

**Detail Drawer** (`node-detail-drawer`): Right-docked panel (replaces config/chat when open). Tabs: **Overview** (term,
type, priority, confidence, lens scores), **Links** (in/out, filter by type), **History** (belief revisions),
**Actions** (Focus, Pin, Hide, Copy term, Export subgraph).

**Multi-select**: Shift-click adds to selection. Toolbar shows count + bulk actions: Focus group, Hide, Export, Delete
(if permitted).

### 2.3 Viewport & Minimap

- **Viewport state** synced to `$viewport` atom + URL hash
- **Minimap** (`graph-minimap`): Bottom-right toggle. Shows full graph, viewport rectangle, click to jump. Canvas-based
  for performance.
- **Keyboard**: `0` = reset zoom, `-`/`=` zoom out/in, `F` fit, `Arrow keys` pan (when graph focused).

### 2.4 Graph Virtualization & Performance

**Thresholds**:

- `< 100 nodes`: Full HTML labels, Cose animated
- `100-500`: Canvas labels, Cose animated, edge thinning
- `> 500`: Canvas only, no edge labels, layout in Web Worker, LOD (hide labels < 0.5 zoom)

**Implementation**: `GraphRenderer` class encapsulates Cytoscape instance. `GraphViewport` component delegates. Layout
worker uses `cose-bilkent` WASM build.

---

## 3. Cognitive Lens System

### 3.1 Lens Controller (Unified)

**Single component** provides lens definitions + segmented control (in toolbar) + legend popover. Keyboard shortcuts
(`1`/`2`/`3`) added in Phase 2.

```ts
// Lens definition (source of truth)
interface LensDef {
  id: Lens;
  label: string;
  description: string;
  icon: string;           // SVG symbol id
  colorToken: string;     // semantic token reference (e.g., 'lens.belief')
  shortcut: '1'|'2'|'3';  // Phase 2
  defaultLayout: LayoutName;
  scorer: string;         // server-side scorer name
}
```

**UI**:

- **Toolbar**: Segmented control (3 buttons, always visible) — rendered by `graph-toolbar` consuming `LensDef[]`
- **Popover**: Hover any lens button → shows description + node count + color swatch (from `lens-controller`)
- **Phase 2**: Keyboard `1`/`2`/`3` switches instantly; `Cmd+K` palette includes lens commands

### 3.2 Lens Transitions

**Cross-fade, don't relayout**:

1. Request new lens ops from server
2. Compute color/size deltas
3. Animate node/edge style transitions (300ms)
4. Only relayout if topology changed significantly (new nodes > 20%)

**Per-lens layout persistence**: `$viewport` namespaced by lens: `viewport.belief`, `viewport.goal`, etc.

### 3.3 Lens-Specific Layouts (Configurable)

| Lens          | Default Layout               | Rationale            |
|---------------|------------------------------|----------------------|
| Belief        | `cose` (force-directed)      | Semantic clusters    |
| Goal          | `concentric` (goals center)  | Hierarchical urgency |
| Contradiction | `bipartite` (conflict pairs) | Visual opposition    |

**Extensible**: Layout plugins registered via `LayoutRegistry`.

---

## 4. Chat & Input System

### 4.1 Input HUD (`input-hud`) — Enhanced

```
┌─────────────────────────────────────────────────────┐
│ [@concept] Ask SeNARS…              [Send] │ ▲ History │
│ ─────────────────────────────────────────────────── │
│ Slash: /lens /focus /config /clear /export /help    │
│ Tokens: ~120/4096                                   │
└─────────────────────────────────────────────────────┘
```

**Features**:

- Auto-resize (44px → 200px max)
- `ArrowUp`/`ArrowDown` in empty input → history navigation
- `/` slash command palette (subset of main command palette)
- `@` mention autocomplete from graph nodes (fuzzy)
- Token estimate (client-side heuristic)
- Streaming indicator per message

### 4.2 Chat History Panel (`chat-history-panel`) — Dockable Panel

**Replaces**: Agent messages only appearing in graph nodes.

```
┌────────────────────────────┐
│ Chat History          [✕]  │
├────────────────────────────┤
│ 👤 You: "What is belief?"  │
│ 🤖 Agent: [streaming...]   │
│    ┌────────────────────┐  │
│    │ Belief is...       │  │  ← markdown, syntax highlight, copy btn
│    └────────────────────┘  │
│ ────────────────────────── │
│ 👤 You: "Show goals"       │
│ 🤖 Agent: ...              │
└────────────────────────────┘
```

**Message actions** (right-click or hover toolbar): Copy, Copy as Markdown, Regenerate, Delete, Focus term, Open in
graph.

### 4.3 Message Rendering

- **User**: Plain text, right-aligned
- **Agent**: Markdown → HTML (marked + highlight.js), sanitized (DOMPurify)
- **Streaming**: Typewriter effect (configurable speed)
- **System**: Compact, monospace, timestamp

---

## 5. Configuration System

### 5.1 Config Panel (`config-hud`) — Redesigned

**Schema-driven** from server (`ConfigField` extended with `description`, `category`, `validation`).

```ts
interface ConfigFieldExt extends ConfigField {
  description?: string;
  category: 'llm' | 'nars' | 'system' | 'advanced';
  validation?: { pattern?: string; min?: number; max?: number; custom?: (v) => string|true };
}
```

**UI**: Collapsible categories. Inline validation (debounced). Dirty tracking. "Reset category" + "Reset all". Persist
to localStorage (opt-in). Profile selector (Default, Research, Creative, Custom).

### 5.2 Config Profiles

```ts
interface ConfigProfile {
  name: string;
  description: string;
  values: Record<string, unknown>;
  builtin?: boolean;
}
```

**Storage**: `localStorage['senars:profiles']` + `senars:activeProfile`. Export/Import JSON.

---

## 6. Telemetry & Observability

### 6.1 Telemetry Panel (`telemetry-panel`) — Interactive

```
┌────────────────────────────────────────────────────┐
│ Telemetry                    [1m] [5m] [15m] [1h]  │
│ ┌────────────────────────────────────────────────┐ │
│ │  ████▁▂▃▅▇█▇▅▃▂▁  47.2 Hz  │  ▁▂▃▅▇█▇▅▃▂▁  1.2k TPS │ │
│ │  ▁▂▃▅▇█▇▅▃▂▁▂▃▅▇  89 MB   │  ▂▃▅▇█▇▅▃▂▁▂▃▅  12ms    │ │
│ └────────────────────────────────────────────────┘ │
│ [Hz] [TPS] [Mem] [Lat]  [Export CSV] [Fullscreen]  │
└────────────────────────────────────────────────────┘
```

**Features**: Hover tooltip (exact value + timestamp), time range selector, metric toggles, CSV/JSON export, fullscreen
modal with synchronized cursors.

### 6.2 Cognitive Metrics (Server-Provided)

Extend `TelemetryMsg` with:

```ts
cognitive: {
  activeConcepts: number;
  totalConcepts: number;
  derivationsPerSec: number;
  contradictionCount: number;
  workingMemorySize: number;
  goalUrgencyDistribution: Record<string, number>;
}
```

Client renders as additional sparklines or numeric cards.

---

## 7. State, Error & Empty Handling

### 7.1 Connection Banner (`connection-banner`)

**Replaces** status bar dot. Top banner (dismissible, auto-hide when connected):

- **Connecting**: "Connecting to SeNARS…" + spinner
- **Reconnecting**: "Connection lost. Reconnecting in 3s…" + countdown
- **Disconnected**: "Offline. Queuing messages. [Retry]" + queue count
- **Connected**: Hidden (or minimal pill in status bar)

### 7.2 Empty States (`empty-state` primitive)

| Context           | Illustration     | Primary Action            |
|-------------------|------------------|---------------------------|
| No concepts       | Brain + nodes    | "Send a message to start" |
| No chat history   | Speech bubble    | "Ask a question"          |
| No search results | Magnifying glass | "Clear search"            |
| No contradictions | Warning + check  | —                         |

### 7.3 Error Boundary (`error-boundary`)

**Lit pattern**: `window.addEventListener('error')` + `unhandledrejection` → dispatch `app-error` event →
`ErrorBoundary` component catches → modal with:

- Friendly message ("Something went wrong")
- Technical details (collapsible)
- Actions: **Retry** (re-init WS), **Report** (GitHub issue template), **Reload**

---

## 8. Accessibility (WCAG 2.1 AA) — Comprehensive

| Requirement       | Implementation                                                                                                                                                                                   |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Keyboard**      | Full tab order; `Tab`/`Shift+Tab`; `Escape` closes; arrow keys in composite widgets; `Cmd+K` palette                                                                                             |
| **Focus**         | `:focus-visible` rings (3px, `--color-focus`); focus trap in drawers/modals; restore on close                                                                                                    |
| **Screen Reader** | `aria-live="polite"` for streaming; `aria-live="assertive"` for errors; graph `role="img"` + `aria-label` + hidden table fallback; semantic landmarks (`<nav>`, `<main>`, `<aside>`, `<footer>`) |
| **Color**         | Semantic tokens only; icons + text for status; high-contrast media query; colorblind-safe palette (Cyan/Magenta/Amber OK for deuteranopia; patterns for edges)                                   |
| **Motion**        | `@media (prefers-reduced-motion: reduce)` disables: cytoscape animation, panel transitions, telemetry RAF, typewriter effect                                                                     |
| **Zoom**          | Layout works at 200% zoom; container queries prevent horizontal scroll                                                                                                                           |

---

## 9. Performance & Scale

### 9.1 Bundle Optimization

| Strategy             | Target                                                                               |
|----------------------|--------------------------------------------------------------------------------------|
| Code-split panels    | `config-hud`, `telemetry-panel`, `chat-history-panel`, `command-palette` lazy-loaded |
| Cytoscape tree-shake | Only `core`, `cose`, `canvas` renderer                                               |
| Dynamic import       | Graph viewport → `import('./graph-viewport.js')` on demand                           |
| Compression          | Brotli + gzip; target < 200KB gzipped                                                |

### 9.2 Runtime Performance

- **Graph**: Canvas renderer for >100 nodes; Web Worker layout; LOD (hide labels < 0.5 zoom, thin edges < 0.3)
- **Telemetry**: Decouple data (1Hz) from render (rAF); downsample >300 points
- **HTML labels**: Virtualized — only render labels in viewport + 50px margin
- **Store**: Batched updates (already via `cy.batch()`); derived atoms for filtered views

### 9.3 Monitoring

- `performance.mark` at: app boot, WS connect, first graph render, first chat response
- Expose via `testApi` for CI regression detection

---

## 10. Developer Experience & Quality

### 10.1 Storybook

Stories for all primitives + feature components with graph fixtures (mock Cytoscape + store). Addon: a11y, viewport,
controls.

### 10.2 Visual Regression

Playwright snapshots for: all primitives, panel states, graph states (empty, small, large, each lens), chat streaming,
config validation.

### 10.3 Testing Strategy

| Layer     | Tool                             | Coverage Target                                                     |
|-----------|----------------------------------|---------------------------------------------------------------------|
| Unit      | Vitest                           | Store atoms, utils, lens scorers, validators (≥80%)                 |
| Component | @open-wc/testing + Playwright CT | Primitives, panel interactions, input HUD                           |
| E2E       | Playwright                       | Critical paths: load → connect → chat → lens switch → config change |
| A11y      | axe-core                         | Zero violations in CI                                               |

### 10.4 Design Token Pipeline

```
design-tokens.json → (build script) → tokens.css + tokens.ts + tailwind.config.js
```

Single source. CI validates no hardcoded colors in components.

---

## 11. Architecture Extensibility

### 11.1 Plugin/Extension Points

| Extension Point       | Interface                       | Use Cases               |
|-----------------------|---------------------------------|-------------------------|
| `LensScorer`          | `(concept, all) => number`      | Custom cognitive lenses |
| `LayoutEngine`        | `(nodes, edges) => positions`   | Domain-specific layouts |
| `ConfigFieldRenderer` | `(field) => TemplateResult`     | Custom input types      |
| `TelemetryMetric`     | `{ id, label, color, fetch() }` | Custom dashboards       |
| `Command`             | `Command` interface             | User scripts, macros    |
| `GraphDecorator`      | `(cy, node) => void`            | Overlays, annotations   |

**Registration**: `extensionRegistry.register('lensScorer', 'myLens', scorerFn)`.

### 11.2 PWA / Offline (Future)

- Service Worker: Cache-first for static assets; network-first for API
- Background sync: Queue outgoing `chat.user` messages; replay on reconnect
- `manifest.json`: Installable, standalone display

### 11.3 SSE Fallback

Same protocol over `EventSource`. Auto-negotiate: WS first, fallback to SSE on `close` code 1006/1015.

---

## 12. Consolidated Component Map

```
src/client/components/
├── primitives/                    # 0.3 - Design system primitives (Phase 0)
│   ├── button.ts
│   ├── input.ts
│   ├── panel.ts
│   ├── toolbar.ts
│   ├── tooltip.ts
│   ├── badge.ts
│   ├── empty-state.ts
│   ├── banner.ts
│   ├── spinner.ts
│   └── divider.ts
│
├── app-layout.ts                  # 1.1 - Root shell (responsive grid) — Phase 1
├── connection-banner.ts           # 7.1 - Connection status — Phase 1
├── error-boundary.ts              # 7.3 - Global error UI — Phase 1
│
├── graph-viewport.ts              # 2.0 - Graph canvas host — Phase 2
├── graph-toolbar.ts               # 2.1 - Zoom/search/lens-selector/layout/minimap — Phase 1
├── graph-minimap.ts               # 2.3 - Overview map — Phase 2
├── node-detail-drawer.ts          # 2.2 - Right-docked detail panel — Phase 2
│
├── lens-controller.ts             # 3.0 - Lens defs + popover legend — Phase 2 (shortcuts Phase 2)
│
├── input-hud.ts                   # 4.1 - Enhanced input (auto-resize, history, slash, @) — Phase 3
├── chat-history-panel.ts          # 4.2 - Dockable conversation panel — Phase 3
│
├── config-hud.ts                  # 5.1 - Schema-driven config drawer — Phase 3
├── config-profiles.ts             # 5.2 - Profile manager (sub-component) — Phase 3
│
├── telemetry-panel.ts             # 6.1 - Interactive sparklines + export — Phase 4
├── cognitive-metrics.ts           # 6.2 - Cognitive metric cards (sub-component) — Phase 4
│
├── contradiction-badge.ts         # Existing - enhanced with click→filter — Phase 2
├── command-palette.ts             # 1.2 - Cmd+K action center — Phase 2 (deferred)
└── index.ts                       # Barrel export
```

**Removed/Consolidated**:

- `lens-selector.ts` → `lens-controller.ts` (provides defs + popover; toolbar renders segmented control)
- `config-hud.ts` (slide panel) → `config-hud.ts` (dockable panel via `Panel` primitive)
- Status bar connection dot → `connection-banner.ts` + minimal pill in toolbar
- Ad-hoc panel state (`$configOpen`) → `$panels` registry
- Keyboard shortcuts → Phase 2 (`$shortcuts`, `useKeyboardShortcut`, `command-palette`)

---

## 13. Prioritization & Sequencing (Phased)

### Phase 0: Foundations (Week 1) — **Prerequisite for all**

1. Design token system + CSS `@layer` architecture
2. Component primitives library (Button, Input, Panel, Toolbar, Tooltip, Badge, EmptyState, Banner, Spinner)
3. Store extensions: `$panels`, `$urlState` (no `$shortcuts` yet)
4. Accessibility primitives: `FocusTrap`, `Announcer`, `LiveRegion`
5. Generate `tokens.css` + `tokens.ts`; replace hardcoded colors in existing components

### Phase 1: Shell & Core Navigation (Week 2)

6. `app-layout` responsive grid + container + `$panels` integration
7. `graph-toolbar` (zoom, fit, search, **lens segmented control**, layout, minimap toggle)
8. URL state sync (hash parse/hydrate/serialize; debounced 300ms)
9. `connection-banner` + `error-boundary` + `empty-state` integration

### Phase 2: Graph Interaction (Weeks 3-4)

10. `graph-viewport` virtualization + canvas labels + worker layout (prototype)
11. Node interaction model (click, shift-click, drag, hover, right-click, dbl-click)
12. `node-detail-drawer` (Overview, Links, History, Actions tabs)
13. `graph-minimap`
14. Multi-select + bulk actions in toolbar
15. `lens-controller` (definitions + popover legend; **no keyboard shortcuts yet**)
16. `contradiction-badge` enhancement (click → filter graph)

### Phase 3: Lens System Polish (Week 5)

17. Lens transition animation (cross-fade styles, conditional relayout)
18. Per-lens layout persistence (`viewport.belief`, `viewport.goal`, `viewport.conflict`)
19. Lens-specific default layouts (cose/concentric/bipartite) + `LayoutRegistry`

### Phase 4: Chat & Config (Weeks 6-7)

20. `input-hud` enhancements (auto-resize, history arrows, `/` slash, `@` mention, token estimate)
21. `chat-history-panel` (dockable, markdown, streaming, message actions)
22. `config-hud` redesign (schema-driven, categories, validation, dirty tracking)
23. `config-profiles` (localStorage, export/import, builtin profiles)

### Phase 5: Observability & Polish (Week 8)

24. `telemetry-panel` interactive (hover, range, toggles, export, fullscreen)
25. Cognitive metrics integration (server protocol extension)
26. Reduced motion + high contrast media queries
27. Performance audit: bundle split, Cytoscape tree-shake, LOD thresholds

### Phase 6: Power User & Extensibility (Weeks 9+)

28. **Keyboard shortcuts system**: `$shortcuts`, `useKeyboardShortcut`, `FocusManager`
29. `command-palette` (Cmd+K) + shortcuts overlay (`?`)
30. Extension registry (lens scorers, layouts, config renderers, metrics, commands)
31. Bundle optimization + code-splitting
32. Storybook + visual regression suite
33. PWA + SSE fallback

---

### Server-Side Dependencies (Parallel Track)

| Client Feature                   | Server Change                                                     |
|----------------------------------|-------------------------------------------------------------------|
| Config validation + descriptions | Extend `ConfigField` with `description`, `category`, `validation` |
| Cognitive metrics telemetry      | Extend `TelemetryMsg` with `cognitive` object                     |
| Lens scorer registration         | `LensScorer` plugin interface + registration API                  |
| Config profiles persistence      | Optional: profile CRUD endpoints                                  |
| SSE fallback                     | `EventSource` endpoint mirroring WS protocol                      |

---

## 14. Success Metrics (Measurable)

| Metric                       | Target             | Measurement                                 |
|------------------------------|--------------------|---------------------------------------------|
| **Time to Interactive**      | < 2s               | `performance.now()` at first `connected` WS |
| **Graph render (100 nodes)** | < 100ms            | `performance.mark` in `syncGraph`           |
| **Graph render (500 nodes)** | < 300ms            | Same, with virtualization                   |
| **Bundle size (gzipped)**    | < 200KB            | `vite build --mode production`              |
| **Keyboard accessibility**   | 100% axe (Phase 6) | `axe-core` in CI                            |
| **Color contrast**           | ≥ 4.5:1            | `axe-core` + manual audit                   |
| **Mobile usability**         | ≥ 90               | Lighthouse CI                               |
| **Test coverage (core)**     | ≥ 80%              | `vitest --coverage`                         |
| **Visual regression**        | 0 flaky            | Playwright snapshots                        |
| **Panel open/close latency** | < 50ms             | `performance.measure`                       |

---

## 15. Migration Strategy (Non-Breaking)

| Current                   | Target                       | Migration                                                    |
|---------------------------|------------------------------|--------------------------------------------------------------|
| `app-layout` fixed grid   | Responsive grid + `$panels`  | Incremental: add panel registry, migrate one panel at a time |
| `$configOpen` atom        | `$panels.get('config').open` | Alias getter during transition                               |
| `lens-selector` dropdown  | `lens-controller` segmented  | Feature flag; run both, switch via config                    |
| Status bar connection dot | `connection-banner` + pill   | Add banner, keep dot, remove dot after validation            |
| Hardcoded colors in CSS   | Design tokens                | Generate `tokens.css`, replace references file-by-file       |
| Inline component CSS      | Primitive composition        | Refactor component-by-component                              |

**Branch strategy**: `feat/ui-foundation` → `feat/ui-shell` → `feat/ui-graph` → `feat/ui-lens` → `feat/ui-chat-config` →
`feat/ui-polish`. Each phase merges to `main` behind feature flag.

---

## 16. Risk Mitigation

| Risk                                  | Likelihood | Impact | Mitigation                                            |
|---------------------------------------|------------|--------|-------------------------------------------------------|
| Cytoscape canvas renderer limitations | Medium     | High   | Prototype early; fallback to HTML labels              |
| Web Worker layout complexity          | Medium     | Medium | Start with main-thread; move to worker in Phase 6     |
| Design token migration scope          | High       | Low    | Automated codemod for color replacements              |
| Panel registry over-engineering       | Low        | Medium | Start minimal (open/docked/size); extend as needed    |
| URL state conflicts with WS sync      | Low        | High   | Hash-only; WS state is source of truth for graph data |

---

## Appendix B: Server-Side Dependencies

The following UI features require backend changes. Coordinate with NAR/agent teams.

| UI Feature                          | Server Change                                                | Location                                   |
|-------------------------------------|--------------------------------------------------------------|--------------------------------------------|
| Cognitive metrics (Sec 6.2)         | Extend `TelemetryMsg` with `cognitive` field                 | `nar-adapter.ts`, `createTelemetryEmitter` |
| Config schema extensions (Sec 5.1)  | Add `description`, `category`, `validation` to `ConfigField` | `protocol.ts`, `nar-adapter.ts`            |
| Lens scorer registration (Sec 11.1) | `LensScorer` plugin interface + registry                     | `lenses.ts`, `gateway.ts`                  |
| Layout engine plugins (Sec 11.1)    | `LayoutEngine` interface + per-lens config                   | `projection.ts`, `config.ts`               |
| SSE fallback (Sec 11.3)             | `EventSource` endpoint with same protocol                    | New `sse-handler.ts`                       |
| Graph sync optimization             | Delta compression, batched cognitive deltas                  | `gateway.ts`, `socket-handler.ts`          |

**Priority**: Cognitive metrics + config schema extensions needed by Phase 3-4. Others Phase 6+.

```ts
// store.ts - Panel Registry
interface PanelState {
  id: string;
  open: boolean;
  docked: 'left' | 'right' | 'bottom' | 'float';
  size: number; // px or %
  order: number; // z-index within dock
}

// store.ts - URL State
interface UrlState {
  lens: Lens;
  focus?: string;
  viewport?: { x: number; y: number; zoom: number };
  search?: string;
  panels?: string[];
}

// types.ts - Lens Definition
interface LensDef {
  id: Lens;
  label: string;
  description: string;
  icon: string;
  colorToken: string; // e.g., 'lens.belief'
  shortcut: string;
  defaultLayout: LayoutName;
}

// types.ts - Command
interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  category: CommandCategory;
  action: () => void | Promise<void>;
  when?: () => boolean;
  keywords: string[];
}

// types.ts - Config Field Extension
interface ConfigFieldExt extends ConfigField {
  description?: string;
  category: ConfigCategory;
  validation?: ValidationRules;
}
```