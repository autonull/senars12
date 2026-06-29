# SeNARS Cognitive Cockpit — Full-Screen Graph Workspace Implementation Status

## 1. Vision: The Graph *Is* the Interface ✅ COMPLETE

A **full-screen graph workspace** where conversation, reasoning, and configuration all live as embedded HTML nodes
within a single Cytoscape canvas. No split views, no side panels, no view switching. The graph *is* the workspace; HUD
overlays provide transient controls.

**Design Philosophy:** *Infinite Canvas with Semantic Zoom*

- **Spatial continuity:** Everything has a place; zoom reveals detail, pan navigates context
- **Embedded richness:** Nodes are live as interactive HTML at zoom ≥1.0; collapse to glyphs at zoom <1.0
- **HUD overlays:** Lens selector, input, config — transient, contextual, never occluding content
- **Single mental model:** Conversation = thread of message-nodes; reasoning = derivation edges; config = meta-nodes

---

## 2. MVP Scope Status

| Feature                        | Status      | Notes                                                          |
|--------------------------------|-------------|----------------------------------------------------------------|
| **Full-Screen Graph Canvas**   | ✅ Complete | Graph fills viewport via grid layout; no split panels          |
| **Embedded HTML Nodes**        | ✅ Complete | Message nodes render as HTML at zoom ≥1.0 in graph-viewport.ts |
| **Conversation Graph**         | ✅ Complete | Vertical thread layout with thread edges in graph-viewport.ts  |
| **3-Lens Semantic Zoom**       | ✅ Complete | Lens system with position-preserving transitions               |
| **HUD Overlays**               | ✅ Complete | Top status bar + bottom input bar + right config panel         |
| **Delta-Driven Updates**       | ✅ Complete | Server sends `cognitive.delta` ops via WebSocket               |
| **Schema-Driven Config Nodes** | ✅ Complete | Gear button opens config-hud panel                             |
| **Progressive Onboarding**     | ❌ Removed  | Simplified to always-full mode for MVP                         |

---

## 3. Technology Stack ✅ COMPLETE

| Layer                | Technology                   | Implementation            |
|----------------------|------------------------------|---------------------------|
| **Runtime**          | Node.js ≥20                  | ✅                        |
| **Server**           | Native HTTP + `ws`           | ✅                        |
| **Build**            | tsup (server), Vite (client) | ✅                        |
| **UI Framework**     | Lit (Web Components)         | ✅                        |
| **Graph Rendering**  | Cytoscape.js                 | ✅                        |
| **Data Contract**    | Zod                          | ✅ `shared/protocol.ts`   |
| **State Management** | Custom Atom implementation   | ✅ `client/core/store.ts` |
| **Markdown**         | marked + DOMPurify           | ✅                        |
| **Testing**          | Playwright (E2E)             | ✅ Smoke test passing     |

---

## 4. Files Implemented

### Server (`/ui/src/server/`)

| File               | Purpose                                    | Status |
|--------------------|--------------------------------------------|--------|
| `protocol.ts`      | Zod schemas for all messages               | ✅     |
| `index.ts`         | Server entry point                         | ✅     |
| `gateway.ts`       | WebSocket connection handling              | ✅     |
| `connection.ts`    | WS messaging & subscriptions               | ✅     |
| `lenses.ts`        | 3-lens scorers (belief/goal/contradiction) | ✅     |
| `projection.ts`    | Graph projection for viewport              | ✅     |
| `graph-factory.ts` | Node/edge op factories                     | ✅     |
| `chat.ts`          | Chat message streaming                     | ✅     |
| `config.ts`        | Default projection config                  | ✅     |

### Client (`/ui/src/client/`)

| File                                | Purpose                                         | Status |
|-------------------------------------|-------------------------------------------------|--------|
| `entry.ts`                          | App entry point                                 | ✅     |
| `constants.ts`                      | Lens colors/labels                              | ✅     |
| `core/store.ts`                     | State stores ($chatMessages, $graphNodes, etc.) | ✅     |
| `core/store-bindings.ts`            | Message handlers + graph sync                   | ✅     |
| `core/ws-client.ts`                 | WebSocket client                                | ✅     |
| `core/base-component.ts`            | Lit base class                                  | ✅     |
| `components/app-layout.ts`          | Full-screen grid layout                         | ✅     |
| `components/graph-viewport.ts`      | Cytoscape canvas + semantic zoom                | ✅     |
| `components/input-hud.ts`           | Bottom input bar                                | ✅     |
| `components/config-hud.ts`          | Right-side config panel                         | ✅     |
| `components/lens-selector.ts`       | Lens dropdown in status bar                     | ✅     |
| `components/contradiction-badge.ts` | Conflict indicator                              | ✅     |
| `components/telemetry-panel.ts`     | Bottom telemetry strip                          | ✅     |

---

## 5. Remaining Work (Post-MVP)

### Deferred Features

| Feature                               | Future Work                                |
|---------------------------------------|--------------------------------------------|
| **Temporal Scrubber**                 | Add event buffer persistence + timeline UI |
| **Intent System**                     | 8 intent types + undo toasts               |
| **Contradiction Resolution Dialogue** | Strategy engine + mediation UI             |
| **Full 35-Module Meta-Nodes**         | Module registry + tabbed HUD               |
| **Radial Dial Lens Selector**         | Radial menu component                      |
| **uPlot Telemetry Overlay**           | Canvas chart component                     |
| **Ghost Overlay**                     | Requires temporal scrubber infrastructure  |

---

## 6. Testing Status

- **Smoke test**: ✅ Passing (`tests/scenarios/smoke/app-loads.spec.ts`)
- **All E2E tests**: ✅ Passing (15 tests)
- **Typecheck**: ✅ Passing
- **Build**: ✅ Passing

---

## 7. Key Implementation Notes

1. **No nano-stores**: Using custom Atom implementation (simpler for current needs)
2. **No progressive onboarding**: Always starts in full mode for simplicity
3. **HTML rendering**: Uses Lit template rendering of node HTML at zoom ≥1.0
4. **Lens colors**: Cyan (#00f3ff), Red (#ff0055), Magenta (#ff00ff)
5. **Conversation layout**: Vertical stack with y-spacing of 180px, x=0

---

## 8. Core Loop

The fundamental interaction pattern works:

1. Type message in input-hud → `chat.user` sent
2. Agent response → `chat.agent.stream`/`complete` → adds HTML node to graph
3. Zoom to ≥1.0 → message nodes show full HTML content
4. Click lens selector → nodes re-color/size preserving positions
5. Pan/zoom → viewport sync for spatial memory