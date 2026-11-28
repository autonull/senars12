---
---

# TODO3: Unified Web UI Architecture + Remaining Work

**Status**: Draft — consolidates Web UI migration + all open threads from TODO1/2

---

## 🎯 Unified Web UI Architecture

### Current Assets (Leverage Heavily)

| Package | Capability | Reuse Target |
|---------|------------|--------------|
| `@senars/ui` | Vite + SSR, WebLLM, graph projection, server | **Core shell, SSR, auth, WebSocket** |
| `spacegraphjs7` (30+ packages) | Graph viz, Cytoscape/Three.js/SVG renderers, layouts, toolbar, inspector, overlays | **Graph dashboards, arcade game boards, REPL viz** |
| `@senars/ui-contract` | Shared types, Zod schemas | **Type-safe IPC, component props** |
| `@senars/ui-shell` | Window manager, toolbar, navigation | **Multi-window REPL, demo shell** |
| `src/bin/commands/demo/*` | arcade, playground, benchmark, imagine | **Demo entry points → Web UI routes** |

### Unified Architecture: `@senars/web-ui`

```
packages/web-ui/
├── apps/
│   ├── shell/              # Main entry: Vite + SSR, routing, auth, WebSocket
│   ├── demo/               # /demo/* — arcade, playground, benchmark, imagine
│   ├── repl/               # /repl — interactive REPL with graph viz
│   ├── dashboard/          # /dashboard/* — system, performance, governance
│   └── observe/            # /observe/* — run viewer, tour, drift, diff
├── packages/
│   ├── core/               # Shared React primitives, hooks, context
│   ├── components/         # Composable UI primitives (see below)
│   ├── graph/              # Graph viz wrapper (spacegraphjs7 adapter)
│   ├── canvas/             # Game canvas renderers (arcade, repl viz)
│   ├── websocket/          # Typed WS client + server (MCP bridge)
│   ├── repl/               # REPL-specific: terminal, history, autocomplete
│   ├── dashboard/          # Dashboard widgets: charts, tables, realtime
│   └── observe/            # Observe viewers: tour, drift, diff, replay
└── tools/
    ├── storybook/          # Component gallery
    ├── visual-tests/       # Playwright visual regression
    └── build/              # Vite config, WASM build, bundle analysis
```

---

## 🧩 Shared Component Library (`packages/components`)

### Layout & Shell
| Component | Purpose | Used By |
|-----------|---------|---------|
| `AppShell` | Top bar, sidebar, panel resize, keyboard shortcuts | All apps |
| `PanelGrid` | Resizable split panes (Golden Layout style) | REPL, Dashboard, Demo |
| `TabStrip` | Tabbed panels with drag-reorder | REPL tabs, Demo games |
| `CommandPalette` | `Cmd+K` global actions | All apps |
| `StatusBar` | Bottom bar: connection, mode, sync status | All apps |

### Data Display
| Component | Purpose | Used By |
|-----------|---------|---------|
| `DataTable` | Virtualized, sortable, filterable, column resize | Dashboard, Observe tours |
| `MetricCard` | KPI with sparkline, threshold coloring | Dashboard, Arcade leaderboard |
| `TimeSeriesChart` | Chart.js wrapper, real-time streaming | Dashboard, Drift gate |
| `LogViewer` | ANSI-color aware, search, tail/follow | REPL, Observe replay |
| `TreeView` | Expandable, drag-drop, checkboxes | REPL filesystem, Graph nav |

### Cognitive Domain
| Component | Purpose | Used By |
|-----------|---------|---------|
| `GraphCanvas` | spacegraphjs7 wrapper, Cytoscape/Three.js/SVG | Dashboard, REPL belief graph, Arcade tetris board |
| `DecisionOverlay` | LM prompt → manifold score → action | Arcade, REPL, Observe review |
| `BeliefGraph` | NAR belief visualization, truth values | REPL, Dashboard |
| `DerivationTree` | Step-by-step derivation viz | REPL, Observe tour |
| `ArmSelector` | Dropdown: manifold/lm/replica/nal/heuristic | Arcade, REPL config |

### Arcade/Game Specific
| Component | Purpose | Used By |
|-----------|---------|---------|
| `GameCanvas` | Base class: render loop, input, state sync | Snake, Tetris, 2048, etc. |
| `PiecePreview` | Next/hold queue for Tetris | Arcade tetris |
| `Leaderboard` | Real-time table, sparklines, statistical sig | Arcade tournament |
| `EpisodeScrubber` | Timeline with mini-frames, bookmarks | Arcade, Observe replay |

### REPL/IDE Specific
| Component | Purpose | Used By |
|-----------|---------|---------|
| `Terminal` | xterm.js wrapper, ANSI, links, blocks | REPL |
| `Autocomplete` | Narsese + natural language, LSP-style | REPL |
| `HistoryPanel` | Searchable, filterable, replayable | REPL |
| `VariableInspector` | Live watch expressions, belief values | REPL |
| `ProfileBar` | Agent profile switcher, throttle, tier | REPL |

---

## 🔌 Unified State & Communication

### WebSocket Protocol (Typed via `@senars/ui-contract`)
```typescript
// Client → Server
type ClientMessage =
  | { type: 'demo/arcade/start'; payload: ArcadeConfig }
  | { type: 'demo/arcade/frame'; payload: GameFrame }
  | { type: 'repl/execute'; payload: { input: string; mode: 'narsese'|'nl' } }
  | { type: 'observe/run'; payload: ObserveRunConfig }
  | { type: 'observe/replay'; payload: { runId: string; speed: number } }
  | { type: 'dashboard/subscribe'; payload: { metrics: string[] } }

// Server → Client
type ServerMessage =
  | { type: 'demo/arcade/state'; payload: GameState }
  | { type: 'demo/arcade/leaderboard'; payload: LeaderboardEntry[] }
  | { type: 'repl/output'; payload: TerminalOutput }
  | { type: 'repl/graph/update'; payload: BeliefGraphDelta }
  | { type: 'observe/tour/step'; payload: TourStep }
  | { type: 'dashboard/metric'; payload: MetricPoint }
```

### Client State (Zustand + React Query)
```typescript
// Global stores
useDemoStore      // arcade config, running state, leaderboard
useReplStore      // history, current session, autocomplete cache
useObserveStore   // runs, tours, drift results, current viewer
useDashboardStore // subscribed metrics, time range, widgets
useGraphStore     // belief graph, layout, selection (shared REPL+Dashboard)
useConnectionStore // WS status, reconnection, latency
```

---

## 🎮 Demo/Arcade Web UI (`apps/demo`)

### Routes
```
/demo/arcade          # Tournament config → live leaderboard + game canvases
/demo/arcade/:game    # Single game view with arm comparison
/demo/playground      # Interactive tutorial + REPL + graph viz
/demo/benchmark       # Config → run → charts + statistical report
/demo/imagine         # Scenario generator + analysis + comparison
```

### Arcade Tournament View
```
┌─────────────────────────────────────────────────────────────┐
│ AppShell: [Logo] Demo ▾  [Arcade] [Playground] [Benchmark]  │
├─────────────┬───────────────────────┬───────────────────────┤
│ Config      │ Game Canvas (tetris)  │ Leaderboard           │
│ ──────────  │ ┌─────────────────┐   │ ┌───────────────────┐ │
│ Games: [☑]  │ │  ████  ██       │   │ │ Arm      Score   │ │
│ Arms: [☑]   │ │  ██  ██  ███    │   │ │ ───────────────  │ │
│ Episodes: 3 │ │  ████████       │   │ │ 🏆 lm      5240  │ │
│ Seeds: 5    │ │  ███████████    │   │ │ 🥈 mfld    4180  │ │
│ [Start]     │ └─────────────────┘   │ │ 🥉 replica 3750  │ │
│             │ Decision Overlay      │ │ 🏴 nal      2890  │ │
│ Arm Details │ ┌─────────────────┐   │ │ ───────────────  │ │
│ [lm] ▼      │ │ LM: "T-piece..."  │   │ │ ████████████    │ │
│   Model:    │ │ Judge: 0.923      │   │ │ ██████████      │ │
│   llama-3.1 │ │ Action: T-spin    │   │ └─────────────────┘ │
│ [manifold]  │ └─────────────────┘   │ │ Episode Scrubber    │
│   Head: v3.2│                       │ │ ░░░░░████░░░░░░░░░░ │
│ [replica]   │ Episode Scrubber      │ └─────────────────────┘
│   Latency:  │ ░░░░░████░░░░░░░░░░   │
└─────────────┴───────────────────────┴───────────────────────┘
```

---

## 💻 REPL/IDE Web UI (`apps/repl`)

### Routes
```
/repl                    # Main REPL with terminal + graph
/repl/sessions/:id       # Resume session with full history
/repl/profile/:name      # Profile-specific config
```

### Layout (Resizable Panels)
```
┌──────────────────────────────────────────────────────────────────┐
│ [Senars] REPL ▾  Profile: [agent ▼]  Throttle: [50%]  Tier: [q] │
├──────────────────┬──────────────────────┬────────────────────────┤
│ Belief Graph     │ Terminal             │ Inspector              │
│ ┌──────────────┐ │ $ > (sensor_A →     │ ┌────────────────────┐ │
│ │  🔴 sensor_A │ │  sensor_B). %0.9;0.9%│ │ Variable: sensor_A │ │
│ │  🟢 sensor_B │ │ > Derived: ...     │ │  Truth: %0.9;0.9%  │ │
│ │  🟡 belief_C │ │ > ^query(...)      │ │  Priority: 0.72    │ │
│ │  🔵 derived_D│ │                     │ │  Sources: 3        │ │
│ └──────────────┘ │                     │ ├────────────────────┤ │
│ Layout: [force▼] │ History Panel       │ │ Derivation Tree    │ │
│ Filter: [truth▼] │ ┌────────────────┐  │ │ 1. (A→B) %0.9      │ │
│                  │ │ 1. believe...  │  │ │ 2. (B→C) %0.8      │ │
│                  │ │ 2. question... │  │ │ 3. derived (A→C)   │ │
│                  │ │ 3. derived...  │  │ └────────────────────┘ │
│                  │ └────────────────┘  │                         │
├──────────────────┴──────────────────────┴────────────────────────┤
│ Command Palette (Cmd+K)  |  Status: Connected  |  Latency: 12ms  │
└──────────────────────────────────────────────────────────────────┘
```

### REPL Components
- **Terminal**: xterm.js + custom Narsese syntax highlighting, block output (tables, graphs)
- **GraphCanvas**: Live belief graph with force layout, truth-value color coding, click→inspect
- **HistoryPanel**: Searchable, filterable, "replay from here" for any past turn
- **Inspector**: Live variable watch, derivation tree, provenance trace
- **ProfileBar**: One-click profile switch, throttle slider, tier selector

---

## 📊 Dashboard Web UI (`apps/dashboard`)

### Routes
```
/dashboard/system        # System health, kernel, memory, budget
/dashboard/performance   # Latency, throughput, derivations/sec
/dashboard/governance    # Proposals, approvals, risk, autonomy
/dashboard/observe       # Recent runs, drift trends, tour gallery
```

### Widgets (Composable, Draggable)
| Widget | Data Source | Refresh |
|--------|-------------|---------|
| `SystemHealth` | `/api/health` | 5s |
| `BudgetGauge` | BudgetExhaustedEvent stream | 1s |
| `DerivationRate` | DerivationAcceptedEvent | 1s |
| `BeliefCount` | BeliefAdded/RevisedEvent | 5s |
| `ProposalQueue` | Governance events | 10s |
| `ObserveTrend` | Drift gate results over time | 1m |
| `TourGallery` | Recent tours with thumbnails | Manual |

---

## 🔍 Observe Web UI (`apps/observe`)

### Routes
```
/observe/runs              # List with filters, status badges
/observe/runs/:id          # Full run viewer: report, cast, video, graph
/observe/runs/:id/tour     # Narrative tour (stepper + evidence)
/observe/runs/:id/diff     # Side-by-side vs baseline
/observe/drift             # Drift gate dashboard
/observe/tours             # Gallery of generated tours
```

### Run Viewer
```
┌─────────────────────────────────────────────────────────────┐
│ Run: 01JQZ3X7K9M2N4P5Q6R7S8T9V0  [FAIL]  [Export] [Replay]  │
├─────────────┬───────────────────────┬───────────────────────┤
│ Report      │ Console Cast          │ Belief Graph          │
│ ──────────  │ ┌─────────────────┐   │ ┌─────────────────┐   │
│ Verdict:    │ │ $ > believe...  │   │ │  🔴 sensor_A    │   │
│   FAIL      │ │ > Derived...    │   │ │  🟢 sensor_B    │   │
│ Findings: 3 │ │ > ^query...     │   │ │  🟡 derived_C   │   │
│ ──────────  │ └─────────────────┘   │ └─────────────────┘   │
│ Findings    │ Video (webm)          │ Tour Stepper          │
│ ──────────  │ ┌─────────────────┐   │ ┌─────────────────┐   │
│ 1. wrong-...│ │ ████████████████│   │ │ Step 3/5        │   │
│ 2. loop...  │ │ ██  ██  ███     │   │ │ ████████░░░░░░░░ │   │
│ 3. broken-ui│ └─────────────────┘   │ │ Evidence: 3 refs  │   │
│             │                       │ └─────────────────┘   │
├─────────────┴───────────────────────┴───────────────────────┤
│ Evidence Panel: [Event] [Frame] [Cast] [Mark] — click to jump│
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠 Implementation Phases

### Phase W1: Foundation (Week 1-2)
- [ ] **Create `packages/web-ui`** with Vite monorepo (apps + packages)
- [ ] **Extract `@senars/ui` server** → `apps/shell/server.ts` (SSR, auth, WS)
- [ ] **Port `spacegraphjs7` components** → `packages/graph` (React wrappers)
- [ ] **Build `AppShell`, `PanelGrid`, `CommandPalette`** in `packages/components`
- [ ] **WebSocket bridge** with typed protocol (`@senars/ui-contract`)

### Phase W2: Demo/Arcade (Week 2-3)
- [ ] **Arcade routes** + config panel + leaderboard + game canvas
- [ ] **GameCanvas base** + Snake/Tetris/2048 renderers (Canvas 2D)
- [ ] **DecisionOverlay** + ArmSelector + EpisodeScrubber
- [ ] **Playground** → REPL + GraphCanvas side-by-side

### Phase W3: REPL + Dashboard (Week 3-4)
- [ ] **REPL app**: Terminal (xterm.js) + GraphCanvas + History + Inspector
- [ ] **Dashboard**: Metric widgets, real-time subscriptions, drag-drop layout
- [ ] **Shared GraphStore** (Zustand) syncs REPL + Dashboard belief graph

### Phase W4: Observe + Polish (Week 4-5)
- [ ] **Observe viewer**: Report, cast, video, graph, tour stepper
- [ ] **Tour generator** → HTML export + gallery
- [ ] **Drift dashboard** + tour gallery
- [ ] **Visual regression tests** (Playwright) for all game renderers
- [ ] **WASM manifold** build + browser integration

---

## 📦 Package Reorganization Target

```
senars/
├── packages/
│   ├── web-ui/              # NEW: Unified Web UI monorepo
│   │   ├── apps/
│   │   │   ├── shell/       # SSR entry, routing, auth
│   │   │   ├── demo/        # /demo/*
│   │   │   ├── repl/        # /repl
│   │   │   ├── dashboard/   # /dashboard/*
│   │   │   └── observe/     # /observe/*
│   │   ├── packages/
│   │   │   ├── components/  # Shared UI primitives
│   │   │   ├── graph/       # spacegraphjs7 React adapter
│   │   │   ├── canvas/      # Game/REPL canvas renderers
│   │   │   ├── websocket/   # Typed WS client/server
│   │   │   ├── repl/        # REPL-specific components
│   │   │   ├── dashboard/   # Dashboard widgets
│   │   │   └── observe/     # Observe viewers
│   │   └── tools/
│   ├── observe/             # ✅ Phase 1-3 done
│   ├── arcade-core/         # NEW: shared arcade logic (from scripts/arcade.ts)
│   ├── manifold-wasm/       # NEW: WASM System One
│   └── web-ui-legacy/       # DEPRECATE: ui/, ui/spacegraphjs7/ → migrate
├── src/
│   ├── bin/commands/
│   │   └── demo/            # Thin CLI → launches web-ui apps
└── scripts/
    └── arcade.ts            # → packages/arcade-core/
```

---

## 🔗 Related TODOs

- **TODO1.md** — CLI restructure (mostly done)
- **TODO2.md** — Observe package (Phase 1-3 ✅)
- **This (TODO3.md)** — Unified Web UI + remaining infra

---

*Generated from audit of existing `@senars/ui`, `spacegraphjs7`, `demo/*` commands, and Observe package.*