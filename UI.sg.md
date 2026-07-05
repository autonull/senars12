# SeNARS SpaceGraph UI Specification
## Form Follows Function — Foundational Layering

**Version:** `ui/UI.sg.md` — Experimental entry at `ui/src/client/spacegraph/`

---

## 0. Foundational Principle

**No aesthetic layer until the functional substrate is solid.**

Every visual decision must answer: *what cognitive operation does this enable?* If the answer is "it looks better," it waits.

---

## 1. Layer 0 — Substrate (Weeks 1-2)

*Must work before any cognitive features.*

### 1.1 SpaceGraph Instance + SeNARS State Bridge
- `spacegraph-viewport.ts` ←→ `$graphNodes` / `$graphEdges` / `$activeLens` / `$viewport` / `$selectedNodeId` / `$lensViewport` / `$graphFilter`
- **Sync contract**: SeNARS atoms are source of truth; SpaceGraph is projection
- **No local graph state** — all mutations via `applyServerMessage` → atoms → `syncGraph()`
- **Verify**: WS connect → snapshot → nodes appear → lens switch recolors → pan/zoom persists per lens

### 1.2 Node Type Mapping (Minimal Viable Set)
| SeNARS Node | SpaceGraph Type | Why |
|-------------|----------------|-----|
| Chat message | `HtmlNode` | Rich content, editable, LOD |
| Concept (belief/goal) | `ShapeNode` (sphere) | Fast, instanced, colorable |
| Config meta | `HtmlNode` | Form controls |
| Derivation edge | `Edge` (instanced) | High-volume, animated flow |
| Thread edge | `Wire` | Conversation backbone |

**No** `ChartNode`, `CodeEditorNode`, `VideoNode`, `GlobeNode`, `ProcessNode` yet.

### 1.3 Layout: Force-Directed + Thread Backbone
- `ForceLayout` for concept cloud (repulsion = semantic distance)
- `Wire` edges for conversation thread (manual vertical stack, Y = time)
- **No per-lens layout yet** — single layout, lens = visual projection only
- **Verify**: 500 nodes @ 60fps, lens switch <100ms, thread stays stable

### 1.4 Viewport Persistence
- `$lensViewport` (belief/goal/contradiction) → camera position + zoom
- `$viewport` → current
- **Save on camera change**, restore on lens switch
- **Verify**: Switch lens → camera flies to saved position → switch back → returns

### 1.5 Selection + Focus (Keyboard + Mouse)
- Click node → `$selectedNodeId` → center camera (`focusNode`)
- Shift-click → `$selectedNodeIds` (multi-select)
- Double-click / `focus.set` term → camera flies to node
- **No context menus, no tooltips yet**

### 1.6 HUD Overlay (Shared Components Only)
- `connection-banner` (top)
- `graph-toolbar` (zoom, fit, lens selector, layout dropdown, minimap toggle)
- `input-hud` (bottom)
- `contradiction-badge` (toolbar)
- **All existing Lit components, zero SpaceGraph-specific code**
- **Verify**: All toolbar actions work, input sends WS message, lens selector switches `$activeLens`

---

## 2. Layer 1 — Cognitive Primitives (Weeks 3-4)

*First features that make the graph "thinkable."*

### 2.1 HtmlNode Concept Inspectors (LOD)
**Core affordance**: *Same node = glyph at zoom 0.2, card at 1.0, full inspector at 2.0*

```typescript
// In syncGraph(), when adding concept node:
const html = buildConceptCard(nd);  // priority, confidence, term, evidence count
sg.addNode({
  id: nodeId,
  type: 'HtmlNode',
  position: [x, y, 0],
  data: {
    html,
    labelLod: [
      { distance: 0, scale: 2.0, style: 'full' },      // zoom ≥ 2.0
      { distance: 300, scale: 1.0, style: 'card' },    // zoom 1.0–2.0
      { distance: 800, scale: 0.3, style: 'glyph' },   // zoom ≤ 1.0
    ],
    contentScale: 1.0,
  },
});
```

- `labelLod` drives visibility + content scale automatically (built into `HtmlNode.updateLod`)
- **No custom LOD code** — use SpaceGraph's native system
- **Verify**: Zoom out → glyphs; zoom in → cards; zoom deeper → full inspector with editable fields

### 2.2 Lens as Visual Projection (Not Layout)
- `$activeLens` subscription → `forNodes(n => updateVisuals(n, lens))`
- **Belief**: cyan, size ∝ priority × confidence
- **Goal**: magenta, size ∝ urgency
- **Contradiction**: amber, size ∝ conflict intensity
- **Edges**: opacity = source node's lens score
- **No camera move, no relayout** — instant visual switch (<50ms)
- **Verify**: Lens switch with 200 nodes = instant recolor + resize, positions unchanged

### 2.3 Working Memory as Spatial Region
- `PanelNode` (docked to camera or fixed world position) titled "Working Memory"
- `GridNode` inside → auto-arranges active concepts (`$workingMemory` atom)
- Drag concept from cloud → panel → pins (priority boost, `pinned=true`)
- **Physics**: `PhysicsPlugin` (Verlet) on panel contents → concepts settle, cluster
- **Verify**: Drag 5 concepts to panel → they arrange in grid, stay pinned, survive lens switch

### 2.4 Derivation Flow Visualization
- `FlowEdge` for `derivesFrom` edges (animated particles = inference direction)
- Color = lens of source node
- Speed ∝ derivation confidence
- **Verify**: New derivation appears → edge animates from premise → conclusion

---

## 3. Layer 2 — Embodied Navigation (Weeks 5-6)

*Making the graph a place you move through.*

### 3.1 Lens Observation Decks (Camera Vantage Points)
Three fixed world positions — switching lens = camera flyTo(deck):

```typescript
const DECKS = {
  belief:      { position: [0, 800, 800], target: [0, 0, 0] },   // Overlooks belief plane
  goal:        { position: [0, 1200, 0], target: [0, 0, -400] }, // Elevated, sees hierarchy
  contradiction: { position: [0, 400, 0], target: [0, 0, 0] },   // Between conflict zones
};
```

- `cameraControls.flyTo(target, distance, 1.5)` + light color shift
- **Not a recolor** — physical relocation of viewpoint
- **Verify**: Press '1'/'2'/'3' → camera flies to deck → lens color matches deck lighting

### 3.2 Derivation Tunnels (Reasoning as Travel)
- Click `FlowEdge` → camera lerps along edge curve (Bezier) to target node
- Duration ∝ edge length (500–2000ms)
- Source node highlights during travel
- **Esc** cancels → return to origin
- **Verify**: Click derivation edge → smooth flight to conclusion → context preserved

### 3.3 Contradiction as Physical Tension
- `PhysicsPlugin` + spring forces on contradiction edges (`contradicts` type)
- Conflicting nodes repel (force ∝ contradiction intensity)
- User can **manually pull them together** — spring energy visualizes resolution effort
- On resolution (WS `config.set` or manual) → spring releases → particles burst
- **Verify**: Two contradictory beliefs push apart; drag one → feels resistance; release → oscillation

### 3.4 Conversation Thread as Spatial Backbone
- `Wire` edges: user → agent → user → agent (vertical Y = time, X = 0)
- `HtmlNode` messages: LOD = glyph (zoom out) → bubble (mid) → full markdown (deep)
- Scroll wheel on thread region → **time travel** (camera Y dolly)
- **Verify**: 50-message conversation = navigable vertical spine; zoom into any message

---

## 4. Layer 3 — Deep Cognitive Operations (Weeks 7-8)

*Features that require the substrate to be solid.*

### 4.1 Temporal Z-Axis (History as Archaeology)
- `TimelineLayout` on conversation thread: Z = timestamp
- Camera Z dolly = time travel (wheel + Shift = Z-axis)
- Belief revisions appear as **layers** at same X,Y, different Z
- **Verify**: Shift+wheel on concept → cycles through belief revisions at that position

### 4.2 Concept as Living Document (HtmlNode Superpowers)
At deep zoom (LOD 'full'), concept HtmlNode contains:
- **Editable term** (contentEditable div, debounced WS `concept.update`)
- **Truth value sparkline** (inline `ChartNode` — add when needed)
- **Evidence grid** (`VirtualGridNode` of observation nodes)
- **Derivation tree** (collapsible, `TreeLayout` inside HtmlNode)
- **Sub-goal spawner** (ButtonNode → WS `goal.create` + `Wire` to parent)
- **Sensorimotor grounding** (ImageNode/VideoNode for perceptual evidence)

**Implementation**: `HtmlNode` content = Lit template rendered to string. Sub-components = nested SpaceGraph nodes (not DOM) when interactive depth needed.

### 4.3 Narrative Camera Paths (Guided Explanation)
- Pre-recorded `gsap` timelines: `onboardingTour()`, `contradictionWalkthrough()`, `goalDecompositionDive()`
- Triggered from `input-hud` slash commands: `/tour onboarding`
- **Not hardcoded** — generated from current graph topology
- **Verify**: `/tour contradiction` → camera visits each conflict zone with pauses + annotations

### 4.4 Multi-Agent Federation (InterGraphEdge)
- Each agent = separate `SpaceGraph` instance (same container, different layer)
- `InterGraphEdge` links shared concepts across agents
- Tab key cycles active agent (camera + input focus)
- **Verify**: Two agents running → shared concept highlighted in both → edit in one → syncs to other

---

## 5. Layer 4 — Polish & Scale (Weeks 9+)

*Only after Layers 0-3 are reliable.*

### 5.1 Vision System Integration
- `VisionOverlayPlugin` → WCAG/overlap/Fitts reports in dev
- `AutoLayoutPlugin` → self-organizes when node count > threshold
- `AutoColorPlugin` → suggests lens palette adjustments
- **Verify**: CI runs vision assertions; auto-fix applies on build

### 5.2 Performance at Scale
- `InstancedNodeRenderer` for concept spheres (1000+ @ 60fps)
- `LODPlugin` hides HtmlNodes beyond distance threshold
- Web Worker layout (`ForceLayout` off main thread)
- **Verify**: 2000 nodes, 5000 edges, 3 lenses @ 60fps

### 5.3 Accessibility (WCAG 2.1 AA)
- Keyboard: all camera ops, selection, lens switch, panel focus
- Screen reader: `aria-live` announcements for lens change, new derivation, contradiction
- High contrast: semantic tokens only, forced-colors media query
- Reduced motion: `@media (prefers-reduced-motion)` disables animations

---

## 6. Implementation Checklist (Priority Order)

| # | Task | File | Depends On |
|---|------|------|------------|
| 0 | SpaceGraph boot + atom sync | `spacegraph-viewport.ts` | — |
| 1 | Node type mapping (HtmlNode/ShapeNode) | `spacegraph-viewport.ts` | 0 |
| 2 | ForceLayout + Wire thread | `spacegraph-viewport.ts` | 1 |
| 3 | Viewport persistence per lens | `spacegraph-viewport.ts` | 2 |
| 4 | Selection/focus/keyboard | `spacegraph-viewport.ts` | 3 |
| 5 | HUD overlay (shared components) | `spacegraph-app.ts` | 4 |
| 6 | HtmlNode LOD concept cards | `spacegraph-viewport.ts` | 5 |
| 7 | Lens visual projection | `spacegraph-viewport.ts` | 6 |
| 8 | Working memory PanelNode | `spacegraph-viewport.ts` | 7 |
| 9 | FlowEdge derivations | `spacegraph-viewport.ts` | 8 |
| 10 | Lens observation decks | `spacegraph-viewport.ts` | 9 |
| 11 | Derivation tunnel navigation | `spacegraph-viewport.ts` | 10 |
| 12 | Contradiction physics springs | `spacegraph-viewport.ts` | 11 |
| 13 | Conversation thread backbone | `spacegraph-viewport.ts` | 12 |
| 14 | Temporal Z-axis | `spacegraph-viewport.ts` | 13 |
| 15 | HtmlNode deep inspector | `spacegraph-viewport.ts` | 14 |
| 16 | Narrative camera paths | `spacegraph-viewport.ts` | 15 |
| 17 | Multi-agent federation | `spacegraph-viewport.ts` + new | 16 |

---

## 7. Non-Goals (Explicitly Deferred)

- Custom node types beyond HtmlNode/ShapeNode/Edge/Wire
- Custom layout algorithms (ForceLayout suffices)
- Collaborative editing (Yjs/Crdt) — Layer 4+
- Plugin marketplace / theming — never for core
- Mobile touch optimization — after desktop solid
- Offline/PWA — after multi-agent

---

## 8. Verification Gates

| Gate | Criteria |
|------|----------|
| **L0 Done** | WS connect → 500 nodes → lens switch <100ms → pan/zoom persists |
| **L1 Done** | Zoom LOD works (glyph→card→inspector), lens = instant recolor, WM panel functional |
| **L2 Done** | Lens = camera flyTo, derivation click = tunnel flight, contradiction = spring feel |
| **L3 Done** | Time travel on thread, concept = editable doc, tours play, 2 agents link |
| **Ship** | All gates pass + vision CI green + 2000 nodes @ 60fps |

---

## 9. Architecture Decision Log

| Decision | Rationale |
|----------|-----------|
| Single SpaceGraph instance (not per-lens) | Lens = visual projection, not topology change |
| HtmlNode for all rich content | CSS3D = native DOM, no WebGL text rendering needed |
| ForceLayout only (no per-lens layout) | Stable positions = spatial memory; lens = viewpoint |
| Shared Lit HUD components | Zero duplication; SpaceGraph is graph renderer only |
| No local graph state | SeNARS atoms = source of truth; avoids sync bugs |
| PhysicsPlugin for WM + contradictions | Verlet = felt weight/tension, not decoration |

---

*End of specification. Implement sequentially. Gate before advancing.*