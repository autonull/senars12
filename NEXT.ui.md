# SeNARS Cognitive Cockpit — Full-Screen Graph Workspace Architecture & MVP Plan

## 1. Vision: The Graph *Is* the Interface

A **full-screen graph workspace** where conversation, reasoning, and configuration all live as embedded HTML nodes within a single Cytoscape canvas. No split views, no side panels, no view switching. The graph *is* the workspace; HUD overlays provide transient controls.

**Design Philosophy:** *Infinite Canvas with Semantic Zoom*
- **Spatial continuity:** Everything has a place; zoom reveals detail, pan navigates context
- **Embedded richness:** Nodes are live as interactive HTML at zoom ≥1.0; collapse to glyphs at zoom <1.0
- **HUD overlays:** Lens selector, input, config — transient, contextual, never occluding content
- **Single mental model:** Conversation = thread of message-nodes; reasoning = derivation edges; config = meta-nodes

### MVP vs Post-MVP

```
┌─────────────────────────────────────────────────────────────────┐
│                         MVP (Ship Complete)                      │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │ Full-Screen  │  │ Embedded │  │ 3-Lens   │  │ HUD        │  │
│  │ Graph Canvas │  │ HTML     │  │ Semantic │  │ Overlays   │  │
│  │ + Deltas     │  │ Nodes    │  │ Zoom     │  │ (Lens/Input)│  │
│  └──────────────┘  └──────────┘  └──────────┘  └────────────┘  │
│                                                                   │
│  Deferred (Post-MVP)                                              │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Temporal   │  │ Intent       │  │ Full 35-Mod  │             │
│  │ Scrubber   │  │ System (8)   │  │ Meta-Nodes   │             │
│  │ + Ghost    │  │              │  │ + Tabs       │             │
│  └────────────┘  └──────────────┘  └──────────────┘             │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Telemetry  │  │ Contradiction│  │ Radial Dial  │             │
│  │ (uPlot)    │  │ Resolution   │  │ Lens Selector│             │
│  └────────────┘  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

### MVP Design Tenets

| Tenet | Implication |
|-------|-------------|
| **Graph is the workspace** | No split views; chat = embedded HTML nodes at zoom ≥1.0 |
| **Semantic zoom, not view switch** | Zoom in → chat bubbles expand; zoom out → thread becomes glyph |
| **HUD overlays only** | Lens selector, input bar, config — transient, anchor to viewport corners |
| **Single source, single render** | One store → Cytoscape nodes with HTML labels; no duplicate chat panel |
| **Spatial memory preserved** | Positions fixed across lens changes; only visual encoding mutates |
| **Thought-speed navigation** | Click node → center + zoom to detail; wheel → semantic zoom levels |

---

## 2. MVP Scope: Full-Screen Graph with Embedded Conversation

### ✅ MVP (Polished, Complete)

| Feature | Rationale | Exit Criteria |
|---------|-----------|---------------|
| **Full-Screen Graph Canvas** | Single workspace paradigm | Cytoscape fills viewport; no split panels |
| **Embedded HTML Nodes** | Chat lives in graph | Message nodes render as interactive HTML at zoom ≥1.0; collapse at zoom <1.0 |
| **Conversation Graph** | Thread = connected message-nodes | User/agent messages alternate vertically; edges show derivation/support |
| **3-Lens Semantic Zoom** | Beliefs/Goals/Conflicts at any zoom | Lens switch re-encodes color/size; positions frozen |
| **HUD Overlays** | Lens selector + input bar + status | Transient overlays at viewport corners; never occlude nodes |
| **Delta-Driven Updates** | Real-time push, no full redraws | Server sends `cognitive.delta` ops; client applies incrementally |
| **Schema-Driven Config Nodes** | Config as graph meta-nodes | Gear icon → focus config node; edit inline at zoom ≥1.5 |
| **Progressive Onboarding (2 levels)** | Simple → Full | First visit: minimal HUD, 50 nodes; after 5 messages: full lens+HUD |

### ❌ Deferred (Post-MVP)

| Feature | Why Deferred |
|---------|-------------|
| **Temporal Scrubber** | Requires checkpoint system + ghost overlay canvas |
| **Intent System** | 8 intent types × NAR reconfig = complex UX |
| **Contradiction Resolution Dialogue** | Deep mediation UX; highlights suffice for MVP |
| **Full 35-Module Meta-Nodes** | Screen density; config nodes cover MVP |
| **Radial Dial Lens Selector** | HUD dropdown simpler, always visible |
| **uPlot Telemetry Overlay** | Canvas overlay adds complexity; not core |
| **5+ Additional Lenses** | Value unclear without deep integration |
| **Ghost Overlay/Onion Skinning** | Requires temporal scrubber |

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Runtime** | Node.js ≥20 | Single-language stack with SeNARS engine |
| **Server** | Fastify + `@fastify/websocket` | High-perf single-port HTTP+WS |
| **Build (Server)** | `tsup` | Zero-config TS bundling |
| **Build (Client)** | Vite | Fast HMR, native ESM |
| **UI Framework** | Lit (Web Components) | Shadow DOM for embedded node isolation |
| **Graph Rendering** | Cytoscape.js + cytoscape-fcose | Industry standard; supports HTML labels via `label: 'data(html)'` |
| **Data Contract** | Zod | Runtime + compile-time WS protocol safety |
| **State Management** | NanoStores | Slice subscriptions, computed stores |
| **Markdown** | `marked` + `DOMPurify` + `highlight.js` | Secure rendering inside HTML nodes |
| **Testing** | Playwright (E2E) | Real-time race condition coverage |

---

## 4. MVP Data Model (Single Store → Graph Nodes)

**Core principle:** One store (`$chatMessages`) feeds Cytoscape directly. Each message = one graph node with HTML label. Conversation thread = vertical chain of message nodes.

```typescript
// shared/protocol.ts — MVP protocol
import { z } from 'zod';

// Chat message = graph node (with HTML rendering at zoom ≥1.0)
export const ChatMessage = z.object({
  id: z.string(),
  role: z.enum(['user', 'agent', 'system']),
  content: z.string(),              // Markdown source
  html: z.string().optional(),      // Pre-rendered HTML for embedding
  timestamp: z.number(),
  term: z.string().optional(),      // Narsese term if extracted
  truth: z.object({ frequency: z.number(), confidence: z.number() }).optional(),
  punctuation: z.enum(['.', '!', '?']).optional(),
  // Thread structure
  parentId: z.string().nullable(),  // Reply-to message
  threadRootId: z.string(),         // Conversation root
  // Reasoning links
  supports: z.array(z.string()),
  contradicts: z.array(z.string()),
  derivesFrom: z.array(z.string()),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

// Graph node (includes concepts, meta-nodes, etc.)
export const GraphNodeData = z.object({
  id: z.string(),
  label: z.string(),                // Short label for zoom <1.0
  html: z.string().optional(),      // Full HTML for zoom ≥1.0
  term: z.string().optional(),
  priority: z.number(),
  confidence: z.number(),
  punctuation: z.enum(['.', '!', '?']).optional(),
  nodeType: z.enum(['message', 'concept', 'derivation', 'goal', 'question', 'config', 'meta']),
  // Per-lens visual encoding (server-computed)
  lensData: z.object({ score: z.number(), color: z.string(), size: z.number() }).optional(),
  // Layout hints
  layout: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    threadIndex: z.number().optional(),  // For conversation vertical stacking
  }).optional(),
});
export type GraphNodeData = z.infer<typeof GraphNodeData>;

// Delta protocol
export const GraphOp = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add_node'), id: z.string(), data: GraphNodeData }),
  z.object({ action: z.literal('update_node'), id: z.string(), data: GraphNodeData.partial() }),
  z.object({ action: z.literal('remove_node'), id: z.string() }),
  z.object({ action: z.literal('add_edge'), source: z.string(), target: z.string(),
    data: z.object({ weight: z.number(), type: z.string(), directed: z.boolean() }).optional() }),
  z.object({ action: z.literal('remove_edge'), source: z.string(), target: z.string() }),
]);
export type GraphOp = z.infer<typeof GraphOp>;

// 3 primary lenses
export const Lens = z.enum(['belief', 'goal', 'contradiction']);
export type Lens = z.infer<typeof Lens>;

export const CognitiveDelta = z.object({
  type: z.literal('cognitive.delta'),
  seqId: z.number(),
  lens: Lens,
  ops: z.array(GraphOp),
  meta: z.object({ truncated: z.boolean().optional(), totalHidden: z.number().optional() }).optional(),
});

// Client commands
export const ClientCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chat.user'), content: z.string() }),
  z.object({ type: z.literal('config.set'), key: z.string(), value: z.any() }),
  z.object({ type: z.literal('sync.request'), lastSeqId: z.number().nullable() }),
  z.object({ type: z.literal('lens.set'), lens: Lens }),
  z.object({ type: z.literal('focus.set'), term: z.string() }),
  z.object({ type: z.literal('viewport.set'), x: z.number(), y: z.number(), zoom: z.number() }),  // Spatial sync
]);

export const IncomingFromClient = ClientCommand;
export const IncomingFromServer = z.discriminatedUnion('type', [
  CognitiveDelta,
  z.object({ type: z.literal('chat.agent.stream'), delta: z.string() }),
  z.object({ type: z.literal('chat.agent.complete'), content: z.string(), html: z.string(), messageId: z.string() }),
  z.object({ type: z.literal('config.schema'), data: z.record(z.any()) }),
  z.object({ type: z.literal('state.snapshot'), seqId: z.number(), data: z.any() }),
]);
```

### 4.2 Store Architecture (NanoStores → Cytoscape Direct)

```typescript
// client/core/store.ts
import { atom, computed } from 'nanostores';
import type { ChatMessage, Lens, GraphNodeData } from '../../shared/protocol';

// Primary stores
export const $chatMessages = atom<ChatMessage[]>([]);
export const $streamingDelta = atom<string>('');
export const $graphNodes = atom<Map<string, GraphNodeData>>(new Map());
export const $graphEdges = atom<Map<string, any>>(new Map());
export const $graphMeta = atom<{ truncated: boolean; totalHidden: number } | null>(null);
export const $config = atom<Record<string, any>>({});
export const $connectionState = atom<'connecting'|'connected'|'reconnecting'|'disconnected'>('connecting');
export const $lastSeqId = atom<number | null>(null);
export const $viewport = atom<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });

// Cross-cutting
export const $activeLens = atom<Lens>('belief');
export const $focusTerm = atom<string | null>(null);
export const $selectedNodeId = atom<string | null>(null);
export const $userLevel = atom<'simple'|'full'>('simple');
export const $hudVisible = atom<'lens'|'input'|'config'|null>(null);

// Computed: lens-filtered nodes (for edge filtering, not rendering — all nodes render, lensData drives style)
export const $lensScoredNodes = computed(
  [$graphNodes, $activeLens],
  (nodes, lens) => new Map(
    Array.from(nodes.entries())
      .map(([id, n]) => ({ id, node: n, score: n.lensData?.score ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .map(s => [s.id, s.node])
  )
);
```

### 4.3 Store Bindings (Single Write → Graph Nodes)

```typescript
// client/core/store-bindings.ts
import type { IncomingFromServer, ChatMessage, GraphNodeData } from '../../shared/protocol';
import { $chatMessages, $streamingDelta, $graphNodes, $graphEdges, $viewport } from './store';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

function renderMessageHtml(msg: ChatMessage): string {
  const roleClass = `msg-${msg.role}`;
  const content = DOMPurify.sanitize(marked.parse(msg.content));
  return `<div class="graph-message ${roleClass}" data-id="${msg.id}">${content}</div>`;
}

export function applyServerMessage(msg: IncomingFromServer, cy: cytoscape.Core) {
  switch (msg.type) {
    case 'chat.agent.stream':
      $streamingDelta.set($streamingDelta.get() + msg.delta);
      break;

    case 'chat.agent.complete': {
      // Single write → chat store + graph node with HTML
      const chatMsg: ChatMessage = {
        id: msg.messageId,
        role: 'agent',
        content: msg.content,
        html: renderMessageHtml({ ...msg, role: 'agent', content: msg.content } as ChatMessage),
        timestamp: Date.now(),
        parentId: null,
        threadRootId: msg.messageId,
        supports: [], contradicts: [], derivesFrom: [],
      };
      $chatMessages.set([...$chatMessages.get(), chatMsg]);
      
      // Add to graph as embedded HTML node
      if (cy) {
        cy.add({
          group: 'nodes',
          data: {
            id: msg.messageId,
            label: msg.content.slice(0, 40) + (msg.content.length > 40 ? '…' : ''),
            html: chatMsg.html,
            term: extractTerm(msg.content),
            priority: 0.8,
            confidence: 1.0,
            nodeType: 'message',
            layout: { threadIndex: $chatMessages.get().length },
          },
          classes: 'chat-message-node',
        });
      }
      $streamingDelta.set('');
      break;
    }

    case 'cognitive.delta':
      applyGraphOps(msg.ops, cy);
      if (msg.seqId) $lastSeqId.set(msg.seqId);
      break;

    case 'config.schema':
      $config.set(msg.data);
      // Add config as meta-node in graph
      if (cy) addConfigMetaNode(cy, msg.data);
      break;

    case 'state.snapshot':
      applyFullSnapshot(msg.data, cy);
      break;
  }
}

function applyGraphOps(ops: GraphOp[], cy: cytoscape.Core) {
  if (!cy) return;
  cy.batch(() => {
    for (const op of ops) {
      switch (op.action) {
        case 'add_node':
          cy.add({ group: 'nodes', data: op.data });
          break;
        case 'update_node': {
          const node = cy.getElementById(op.id);
          if (node.length) node.data({ ...node.data(), ...op.data });
          break;
        }
        case 'remove_node':
          cy.getElementById(op.id).remove();
          break;
        case 'add_edge':
          cy.add({ group: 'edges', data: { ...op.data, source: op.source, target: op.target } });
          break;
        case 'remove_edge':
          cy.edges(`[source="${op.source}"][target="${op.target}"]`).remove();
          break;
      }
    }
  });
}
```

### 4.4 Conversation Graph — Message Nodes as Vertical Thread

Messages render as embedded HTML at zoom ≥1.0, connected by `thread` edges forming a vertical conversation chain.

```typescript
// client/components/conversation-graph.ts — renders chat as graph thread
export function layoutConversationThread(cy: cytoscape.Core, messages: ChatMessage[]) {
  const threadNodes = cy.nodes('[nodeType="message"]').sort((a, b) => 
    a.data('layout')?.threadIndex - b.data('layout')?.threadIndex
  );
  
  const baseX = 0, baseY = -200, spacing = 180;
  threadNodes.forEach((node, i) => {
    node.position({ x: baseX, y: baseY + i * spacing });
    // Add thread edge to previous
    if (i > 0) {
      const prev = threadNodes[i - 1];
      if (cy.getElementById(`thread_${prev.id()}_${node.id()}`).empty()) {
        cy.add({
          group: 'edges',
          data: { id: `thread_${prev.id()}_${node.id()}`, source: prev.id(), target: node.id(), type: 'thread', directed: true },
          classes: 'thread-edge',
        });
      }
    }
  });
}

// CSS for embedded message HTML (scoped via Shadow DOM in Lit component)
const messageStyles = `
  .graph-message { 
    max-width: 320px; padding: 12px 16px; border-radius: 12px; 
    font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.5;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3); transition: transform 0.15s;
  }
  .graph-message.msg-user { background: #1a3a5c; color: #e8f4fd; margin-left: auto; border-bottom-right-radius: 4px; }
  .graph-message.msg-agent { background: #1a2a1a; color: #d4f5d4; margin-right: auto; border-bottom-left-radius: 4px; }
  .graph-message.msg-system { background: #3a2a1a; color: #f5e6d4; margin: 0 auto; border-radius: 8px; font-size: 12px; max-width: 280px; }
  .graph-message code { background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; }
  .graph-message pre { background: #0d1117; padding: 12px; border-radius: 8px; overflow: auto; margin: 8px -16px -8px; }
`;
```

### 4.5 Semantic Zoom — HTML Nodes at Detail, Glyphs at Overview

```typescript
// client/components/semantic-zoom.ts
export class SemanticZoomController {
  constructor(private cy: cytoscape.Core) {
    this.cy.on('zoom pan', this.onViewportChange.bind(this));
    this.currentLevel = 'overview';
  }

  private onViewportChange() {
    const zoom = this.cy.zoom();
    let newLevel = this.currentLevel;

    if (zoom < 0.6) newLevel = 'overview';
    else if (zoom < 1.4) newLevel = 'component';
    else newLevel = 'detail';

    if (newLevel !== this.currentLevel) {
      this.currentLevel = newLevel;
      this.applyLevel(newLevel);
    }
  }

  private applyLevel(level: string) {
    const nodes = this.cy.nodes();
    
    this.cy.batch(() => {
      if (level === 'overview') {
        // Hide HTML labels, show only short labels as glyphs
        nodes.forEach(n => {
          n.style('label', n.data('label'));
          n.style('width', Math.max(8, n.data('lensData')?.size * 0.3 || 12));
          n.style('height', Math.max(8, n.data('lensData')?.size * 0.3 || 12));
          n.style('shape', n.data('nodeType') === 'message' ? 'round-rectangle' : 'ellipse');
          n.style('background-color', n.data('lensData')?.color || '#666');
          n.removeClass('html-enabled');
        });
      } else if (level === 'component') {
        // Show labels + small HTML preview for messages
        nodes.forEach(n => {
          if (n.data('nodeType') === 'message' && n.data('html')) {
            n.style('label', '');  // HTML label via custom renderer
            n.addClass('html-enabled');
            n.style('width', Math.max(80, n.data('lensData')?.size || 120));
            n.style('height', 'label');
          }
        });
      } else { // detail
        // Full HTML rendering for messages, full labels for concepts
        nodes.forEach(n => {
          if (n.data('nodeType') === 'message' && n.data('html')) {
            n.addClass('html-enabled');
            n.style('width', Math.max(280, n.data('lensData')?.size || 320));
            n.style('height', 'label');
          } else {
            n.style('label', n.data('label'));
          }
        });
      }
    });
  }
}
```

---

## 5. MVP Lens System (3 Lenses, Position-Preserving)

### 5.1 Three Primary Lenses

| Lens | Color | Node Size Encoding | Edge Opacity |
|------|-------|-------------------|--------------|
| **Beliefs** | Cyan `#00f3ff` | frequency × confidence | source node score |
| **Goals** | Red `#ff0055` | desire × (1 − achievement) | source node score |
| **Conflicts** | Magenta `#ff00ff` | severity × unresolved | source node score |

**Position-preserving:** Lens switch only mutates `background-color`, `width`, `height`, `opacity` via CSS transitions. Layout never re-runs.

### 5.2 Lens Scorers (Server-Side)

```typescript
// server/lenses.ts
type LensScorer = (concept: Concept, nar: NAR) => number;

const lensScorers: Record<string, LensScorer> = {
  belief: (c) => c.truth?.frequency * c.truth?.confidence ?? 0,
  goal: (c, nar) => {
    const goals = nar.getTasks().filter(t => t.punctuation === '!');
    if (!goals.length) return 0;
    return Math.max(0, ...goals.map(g => 
      termSimilarity(c.term.toString(), g.term.toString()) * g.budget.priority * (1 - g.truth.confidence)
    ));
  },
  contradiction: (c, nar) => {
    const cts = nar.getContradictions().filter(ct =>
      ct.tasks.some(t => t.term.toString() === c.term.toString())
    );
    if (!cts.length) return 0;
    return Math.max(...cts.map(ct => ct.severity));
  },
};

export function scoreByLens(nar: NAR, lens: string, maxNodes = 300) {
  const scorer = lensScorers[lens];
  if (!scorer) return [];
  const concepts = nar.listConcepts();
  const scored = concepts
    .map(c => ({ concept: c, score: scorer(c, nar) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxNodes);
  const maxScore = Math.max(...scored.map(s => s.score), 0.01);
  return scored.map(({ concept, score }) => ({
    id: concept.term.toString(),
    label: concept.term.toString(),
    priority: concept.budget.priority,
    confidence: concept.truth?.confidence ?? 0.5,
    nodeType: 'concept',
    lensData: { score: score / maxScore, color: getLensColor(lens, score / maxScore), size: 10 + 50 * (score / maxScore) },
  }));
}
```

### 5.3 HUD Lens Selector (Viewport-Anchored)

```typescript
// client/components/lens-selector.ts
@customElement('lens-selector')
export class LensSelector extends LitElement {
  @state() private activeLens: Lens = 'belief';
  @state() private open = false;

  connectedCallback() {
    super.connectedCallback();
    $activeLens.subscribe(l => this.activeLens = l);
  }

  private setLens(lens: Lens) {
    $activeLens.set(lens);
    send({ type: 'lens.set', lens });
    this.open = false;
  }

  render() {
    return html`
      <div class="hud-overlay hud-lens" part="lens-selector">
        <button class="lens-trigger" @click=${() => this.open = !this.open}>
          <span class="lens-dot" style="background: ${lensColors[this.activeLens]}"></span>
          ${lensLabels[this.activeLens]}
          <span class="caret">${this.open ? '▲' : '▼'}</span>
        </button>
        ${this.open ? html`
          <div class="lens-dropdown">
            ${(['belief', 'goal', 'contradiction'] as Lens[]).map(lens => html`
              <button class="lens-option ${lens === this.activeLens ? 'active' : ''}"
                @click=${() => this.setLens(lens)}>
                <span class="lens-dot" style="background: ${lensColors[lens]}"></span>
                <span>${lensLabels[lens]}</span>
                <span class="desc">${lensDescriptions[lens]}</span>
              </button>
            `)}
          </div>
        ` : ''}
      </div>
    `;
  }
}
```

### 5.4 Position-Preserving Lens Switch

```typescript
// client/components/graph-viewport.ts
$activeLens.subscribe((newLens, oldLens) => {
  if (!this.cy) return;

  // 1. Snapshot positions
  const positions = new Map(this.cy.nodes().map(n => [n.id(), n.position()]));

  // 2. Apply visual encoding only — NO layout()
  this.cy.batch(() => {
    this.cy.nodes().forEach(node => {
      const ld = node.data('lensData');
      if (!ld) { node.style('opacity', 0.1); return; }
      node.style({
        'background-color': ld.color,
        'width': ld.size, 'height': ld.size,
        'opacity': 0.3 + 0.7 * ld.score,
        'transition': 'background-color 0.25s, width 0.25s, height 0.25s, opacity 0.25s',
      });
    });
    this.cy.edges().forEach(edge => {
      const srcScore = edge.source().data('lensData')?.score ?? 0;
      edge.style('opacity', 0.05 + 0.9 * srcScore);
    });
  });

  // 3. Restore positions (guaranteed by batch, but explicit for safety)
  this.cy.nodes().forEach(n => {
    const pos = positions.get(n.id());
    if (pos) n.position(pos);
  });
});
```

---

## 6. MVP Server Architecture

### 6.1 Projection Engine (Lens-Aware, Thread-Preserving)

```typescript
// server/projection.ts
export function computeProjection(nar: NAR, opts: { lens: string; viewport?: { x: number; y: number; zoom: number } }) {
  const { lens, viewport } = opts;
  const nodes = scoreByLens(nar, lens, 300);
  const nodeIds = new Set(nodes.map(n => n.id));

  // Preserve conversation thread positions from viewport
  const positions = new Map<string, { x: number; y: number }>();
  if (viewport) {
    // Project viewport to graph coordinates for stable layout
    nodes.forEach(n => {
      if (n.layout?.x && n.layout?.y) {
        positions.set(n.id, { x: n.layout.x, y: n.layout.y });
      }
    });
  }

  // BFS edges capped at 600
  const edges: any[] = [];
  const visited = new Set<string>();
  const queue = nodes.slice(0, 50).map(n => n.id);

  while (queue.length > 0 && edges.length < 600) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const concept = nar.getConcept(id);
    if (!concept) continue;
    for (const link of concept.getLinks()) {
      const target = link.concept.term.toString();
      if (nodeIds.has(target)) {
        edges.push({ source: id, target, weight: link.strength, type: link.type, directed: true });
        if (!visited.has(target)) queue.push(target);
      }
    }
  }

  // Add thread edges for conversation messages
  const threadEdges = buildThreadEdges(nodes);
  edges.push(...threadEdges);

  return { nodes, edges: edges.slice(0, 600), positions, truncated: nar.listConcepts().length > 300, totalHidden: nar.listConcepts().length - nodes.length };
}
```

### 6.2 Gateway (Delta + Viewport Sync)

```typescript
// server/gateway.ts
export function handleConnection(socket: WebSocket, nar: NAR, agent: Agent) {
  let activeLens = 'belief';
  let lastSeqId = 0;
  const eventBuffer: any[] = [];

  function send(msg: any) {
    if (socket.bufferedAmount > 1_048_576) return;
    const payload = JSON.stringify(msg);
    socket.send(payload);
    if (msg.type === 'cognitive.delta') {
      eventBuffer.push({ ...msg, seqId: ++lastSeqId });
      if (eventBuffer.length > 1000) eventBuffer.shift();
    }
  }

  send({ type: 'config.schema', data: buildConfigSchema(nar) });
  sendFullSnapshot();

  const unsubs = [
    nar.getEventBus().on('nar:derivation', () => sendDelta()),
    nar.getEventBus().on('nar:drive:changed', () => sendDelta()),
  ];

  function sendFullSnapshot() {
    const proj = computeProjection(nar, { lens: activeLens });
    send({ type: 'state.snapshot', seqId: lastSeqId, data: proj });
  }

  function sendDelta() {
    const proj = computeProjection(nar, { lens: activeLens });
    const ops = computeDeltaOps(lastSentState, proj);
    send({ type: 'cognitive.delta', lens: activeLens, ops, meta: { truncated: proj.truncated, totalHidden: proj.totalHidden } });
    lastSentState = proj;
  }

  socket.on('message', async (raw) => {
    try {
      const msg = IncomingFromClient.parse(JSON.parse(raw.toString()));
      switch (msg.type) {
        case 'chat.user': {
          // Add user message to graph immediately
          const userMsgId = nanoid();
          send({ type: 'chat.agent.stream', delta: '' }); // Placeholder for streaming
          
          const stream = agent.chat(msg.content, { stream: true });
          for await (const event of stream) {
            if (event.kind === 'text-delta') send({ type: 'chat.agent.stream', delta: event.text });
            if (event.kind === 'finish') send({ type: 'chat.agent.complete', content: event.text, html: renderHtml(event.text), messageId: nanoid() });
            if (event.kind === 'error') send({ type: 'chat.agent.complete', content: `Error: ${event.error}`, messageId: nanoid() });
          }
          break;
        }
        case 'lens.set':
          activeLens = msg.lens;
          sendFullSnapshot();
          break;
        case 'viewport.set':
          // Client viewport sync for spatial persistence
          lastViewport = msg;
          break;
        case 'config.set':
          applyConfig(nar, msg.key, msg.value);
          break;
        case 'sync.request':
          handleSync(msg.lastSeqId, eventBuffer);
          break;
      }
    } catch (e) { /* drop invalid */ }
  });

  socket.on('close', () => unsubs.forEach(u => u()));
}
```

---

## 7. MVP Components (Lit Web Components)

### 7.1 Layout — Full-Screen Graph + HUD Overlays

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    FULL-SCREEN GRAPH CANVAS                     │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  [Lens: Beliefs ▾]                    [⚡ 0] [⬤] [⚙]   │  │  ← Status HUD (top)
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│    ┌─────────────┐                                            │
│    │  █ █ █ █ █  │  ← Concept cluster (zoom <1.0: glyphs)     │
│    │   █   █     │                                            │
│    └──────┬──────┘                                            │
│           │                                                    │
│    ┌──────▼──────┐                                            │
│    │  ┌───────┐  │  ← Thread edge (derivation/support)        │
│    │  └───────┘  │                                            │
│    └────────────┘                                            │
│           │                                                    │
│    ┌──────▼──────────────────────────────────────────────┐   │
│    │ ┌────────────────────────────────────────────────┐  │   │  ← Message node (zoom ≥1.0: HTML)
│    │ │ "Why can't penguins fly?"                      │  │   │
│    │ │ User • 2:34 PM                                 │  │   │
│    │ └────────────────────────────────────────────────┘  │   │
│    └────────────────────────────────────────────────────┘   │
│           │                                                    │
│    ┌──────▼──────────────────────────────────────────────┐   │
│    │ ┌────────────────────────────────────────────────┐  │   │
│    │ │ "Penguins evolved for swimming, not flight..." │  │   │
│    │ │ Agent • 2:34 PM                                │  │   │
│    │ └────────────────────────────────────────────────┘  │   │
│    └────────────────────────────────────────────────────┘   │
│                                                                 │
│                              ┌─────────────┐                   │
│   [═════════════════════════│  Input Bar  │═══════════════]   │  ← Input HUD (bottom)
│                              └─────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

**Layout rules:**
- **Graph canvas** = 100vw × 100vh (Cytoscape container)
- **Status HUD** = fixed top bar (48px): lens selector, contradiction badge, connection, config gear
- **Input HUD** = fixed bottom bar (60px): chat input, send, model indicator — slides up on focus
- **Config HUD** = right-side slide panel (triggered by gear) — renders as focused meta-node at zoom ≥1.5
- **No other overlays** — concept detail appears by zooming into node

### 7.2 Graph Viewport (Core Component)

```typescript
// client/components/graph-viewport.ts
@customElement('graph-viewport')
export class GraphViewport extends LitElement {
  private cy: cytoscape.Core;
  private semanticZoom: SemanticZoomController;
  private mounted = false;

  connectedCallback() {
    super.connectedCallback();
    this.initCytoscape();
    this.bindStores();
    this.setupHUD();
  }

  private initCytoscape() {
    const container = this.renderRoot.querySelector('#cy-container')!;
    this.cy = cytoscape({
      container,
      style: this.getBaseStyle(),
      layout: { name: 'preset', fit: false }, // Positions from server
      minZoom: 0.1, maxZoom: 10,
      wheelSensitivity: 0.15,
      boxSelectionEnabled: false,
      renderer: { name: 'canvas' },
    });

    // Enable HTML labels for message nodes at detail zoom
    this.cy.on('render', () => this.renderHtmlLabels());
    
    this.semanticZoom = new SemanticZoomController(this.cy);
    this.setupInteraction();
  }

  private getBaseStyle(): cytoscape.Stylesheet[] {
    return [
      { selector: 'node', style: {
        'label': 'data(label)', 'text-valign': 'center', 'text-halign': 'center',
        'color': '#fff', 'text-outline-width': 2, 'text-outline-color': '#000',
        'font-size': '11px', 'font-family': 'JetBrains Mono, monospace',
      }},
      { selector: 'node.html-enabled', style: { 'label': '' }}, // HTML rendered separately
      { selector: 'edge', style: {
        'width': 1.5, 'line-color': '#444', 'target-arrow-color': '#444',
        'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'opacity': 0.3,
      }},
      { selector: 'edge.thread-edge', style: {
        'line-color': '#00f3ff', 'width': 2, 'line-style': 'dotted',
        'target-arrow-shape': 'none', 'opacity': 0.6,
      }},
      { selector: 'edge[type="derivation"]', style: {
        'line-color': '#FFaa00', 'line-style': 'dashed', 'width': 2,
        'target-arrow-shape': 'vee', 'curve-style': 'unbundled-bezier',
      }},
      { selector: '.focused', style: {
        'border-width': 3, 'border-color': '#00f3ff', 'z-index': 999,
      }},
    ];
  }

  // Render embedded HTML for message nodes at zoom ≥1.0
  private renderHtmlLabels() {
    if (this.cy.zoom() < 1.0) return;
    this.cy.nodes('.html-enabled').forEach(node => {
      const html = node.data('html');
      if (!html) return;
      const pos = node.renderedPosition();
      const w = node.renderedOuterWidth();
      const h = node.renderedOuterHeight();
      // Position HTML overlay via transform (handled by CSS in Lit template)
      this.dispatchEvent(new CustomEvent('html-label', { 
        detail: { id: node.id(), html, x: pos.x, y: pos.y, width: w, height: h } 
      }));
    });
  }

  private bindStores() {
    // Delta application
    $visibleNodes.subscribe(nodes => this.applyNodeDeltas(nodes));
    $visibleEdges.subscribe(edges => this.applyEdgeDeltas(edges));
    
    // Lens switch (position-preserving)
    $activeLens.subscribe(() => this.applyLensStyles());
    
    // Viewport sync (for server spatial persistence)
    this.cy.on('viewport', throttle(() => {
      $viewport.set({ x: this.cy.pan().x, y: this.cy.pan().y, zoom: this.cy.zoom() });
    }, 100));
  }

  private applyLensStyles() {
    // See 5.4 — position-preserving lens switch
  }
}
```

### 7.3 Input HUD (Bottom Bar)

```typescript
// client/components/input-hud.ts
@customElement('input-hud')
export class InputHUD extends LitElement {
  @state() private composing = false;
  @state() private model = 'WebLLM';

  render() {
    return html`
      <div class="hud-overlay hud-input" part="input-bar">
        <div class="input-wrapper">
          <select class="model-select" .value=${this.model} @change=${e => this.model = e.target.value}>
            <option value="WebLLM">🧠 WebLLM</option>
            <option value="Ollama">🦙 Ollama</option>
            <option value="OpenAI">🔗 OpenAI</option>
          </select>
          <textarea 
            class="chat-input" 
            placeholder="Ask SeNARS…" 
            @keydown=${this.onKeydown}
            @focus=${() => this.composing = true}
            @blur=${() => this.composing = false}
            style="height: ${this.composing ? '120px' : '44px'}"
          ></textarea>
        </div>
        <button class="send-btn" @click=${this.send}>Send</button>
      </div>
    `;
  }

  private onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
  }

  private send() {
    const input = this.renderRoot.querySelector('textarea')!;
    const content = input.value.trim();
    if (!content) return;
    input.value = '';
    send({ type: 'chat.user', content });
    
    // Add user message optimistically to graph
    const tempId = `temp_${Date.now()}`;
    this.cy?.add({
      group: 'nodes',
      data: {
        id: tempId, label: content.slice(0, 40), html: renderMessageHtml({ role: 'user', content }),
        nodeType: 'message', priority: 0.9, confidence: 1.0,
        layout: { threadIndex: $chatMessages.get().length + 1 },
      },
      classes: 'chat-message-node html-enabled',
    });
  }
}
```

### 7.4 Config HUD (Gear → Meta-Node Focus)

```typescript
// client/components/config-hud.ts
@customElement('config-hud')
export class ConfigHUD extends LitElement {
  @state() private open = false;
  @state() private schema: Record<string, any> = {};

  connectedCallback() {
    super.connectedCallback();
    $config.subscribe(s => this.schema = s);
  }

  render() {
    if (!this.open) return html`
      <div class="hud-overlay hud-config-trigger" @click=${() => this.openConfig()}>
        <button class="icon-btn" title="Configuration">⚙</button>
      </div>
    `;

    return html`
      <div class="hud-overlay hud-config-panel" part="config-panel">
        <div class="config-header">
          <h3>SeNARS Configuration</h3>
          <button class="icon-btn" @click=${() => this.open = false}>✕</button>
        </div>
        <div class="config-grid">
          ${Object.entries(this.schema).map(([key, def]) => html`
            <config-field .key=${key} .def=${def}></config-field>
          `)}
        </div>
      </div>
    `;
  }

  private openConfig() {
    this.open = true;
    // Focus config meta-node in graph (zoom to detail)
    const configNode = this.cy?.getElementById('meta:config');
    if (configNode?.length) {
      this.cy.animate({ center: { eles: configNode }, zoom: 1.8, duration: 500 });
    }
  }
}
```

### 7.5 Progressive Onboarding (HUD-Aware)

```
Simple mode (first visit):
  - Graph: 50 nodes max, no lens data (all gray)
  - HUD: Only input bar visible; lens selector hidden
  - After 1st message: "Zoom into a message to read it"
  - After 3 messages: "Click lens badge to change perspective"
  - After 5 messages: Auto-unlock Full mode

Full mode:
  - Graph: 300 nodes with full lens scoring
  - HUD: Lens selector, contradiction badge, config gear all visible
  - Semantic zoom: HTML messages at zoom ≥1.0
  - Config: Gear opens panel + focuses config meta-node
```

```typescript
// client/core/onboarding.ts
$chatMessages.subscribe(msgs => {
  if (msgs.length >= 5) $userLevel.set('full');
});

// Components check $userLevel:
// - lens-selector: renders only in 'full'
// - contradiction-badge: renders only in 'full' 
// - config-hud trigger: renders only in 'full'
// - graph: lensData only sent to client in 'full'
```

---

## 8. Deferred Features (Architecture Preserved)

| Feature | Preserved In MVP Arch | Missing for MVP |
|---------|----------------------|-----------------|
| **Temporal Scrubber** | Seq IDs + event buffer on server | Checkpointer, timeline canvas, ghost nodes |
| **Intent System** | `ClientCommand` union extensible | Intent handler, toast/undo, 8 intent types |
| **Contradiction Resolution** | Conflicts flow via `cognitive.delta` | Strategy engine, dialogue UI |
| **35-Module Meta-Nodes** | Config meta-node pattern exists | Module registry, tabbed HUD |
| **Radial Dial** | Lens system pluggable | Radial menu component, right-click bind |
| **uPlot Telemetry** | Overlay HUD pattern exists | Ring buffers, canvas chart component |
| **Ghost Overlay** | Requires temporal scrubber | Scrubber infrastructure |

---

## 9. Key Types (Reference)

```typescript
interface Term { toString(): string; hash: string; }
interface TruthValue { frequency: number; confidence: number; }
interface Task { term: Term; punctuation: '.'|'!'|'?'; truth: TruthValue; budget: { priority: number; durability: number; }; }
interface Concept { term: Term; truth?: TruthValue; budget: { priority: number; durability: number; }; links: ConceptLink[]; }
interface ConceptLink { target: Term; strength: number; type: 'semantic'|'term'|'similarity'; }

type Lens = 'belief' | 'goal' | 'contradiction';
interface ChatMessage { 
  id: string; role: 'user'|'agent'|'system'; content: string; html: string; 
  timestamp: number; term?: string; truth?: TruthValue; punctuation?: '.'|'!'|'?';
  parentId: string|null; threadRootId: string;
  supports: string[]; contradicts: string[]; derivesFrom: string[];
}
interface GraphNodeData { 
  id: string; label: string; html?: string; term?: string; 
  priority: number; confidence: number; punctuation?: '.'|'!'|'?';
  nodeType: 'message'|'concept'|'derivation'|'goal'|'question'|'config'|'meta';
  lensData?: { score: number; color: string; size: number };
  layout?: { x: number; y: number; threadIndex: number };
}
type GraphOp = { action: 'add_node'|'update_node'|'remove_node'|'add_edge'|'remove_edge'; ... }
```

---

## 10. Performance Budget

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Lens switch** | <300ms | `perf.now()` at `lens.set` → styles stable |
| **Graph FPS** | 60fps steady; ≥30fps @ 50 ops/sec | `requestAnimationFrame` delta |
| **Chat latency** | <200ms Send → first token | WS round-trip |
| **HTML label render** | <16ms/frame at 300 nodes | Chrome DevTools Performance |
| **Reconnection** | <5s drop → consistent state | E2E test |
| **Initial load** | <2s TTI | Lighthouse |
| **Memory** | <50MB DOM growth/hr | Node count proxy |

---

## 11. Testing Strategy

| Layer | Tool | Coverage |
|-------|------|----------|
| **Contract** | Zod `safeParse` | All WS messages validate |
| **Unit** | Vitest | Lens scorers, store bindings, delta ops, semantic zoom thresholds |
| **E2E** | Playwright | Full flows: message→graph embed, zoom→HTML, lens switch, viewport persist |
| **Cross-browser** | Playwright (Chromium + Firefox) | Consistent rendering |

**Key E2E Scenario:**
```
Given: app loaded, connected, Simple mode
When: I type "What is truth?" and press Send
Then: user message appears as HTML node in graph thread (bottom)
And: agent response streams → appears as HTML node above user message
When: I scroll wheel to zoom ≥1.0
Then: message nodes render full HTML (markdown, code blocks)
When: I click lens badge → switch to Conflicts
Then: node colors/sizes change; positions identical; thread edges preserved
When: I pan/zoom, then refresh page
Then: viewport restores to same position (server viewport sync)
```

---

## 12. Migration Path (Each Step Deployable)

| Step | Change | Files | MVP? |
|------|--------|-------|------|
| **1** | Protocol: `ChatMessage` with `html`, `layout.threadIndex` | `shared/protocol.ts` | ✅ |
| **2** | Server: projection with thread edges + positions | `server/projection.ts`, `server/lenses.ts` | ✅ |
| **3** | Server: gateway with delta + viewport sync | `server/gateway.ts` | ✅ |
| **4** | Client: stores + semantic zoom computed | `client/core/store.ts` | ✅ |
| **5** | Client: graph viewport with HTML label rendering | `client/components/graph-viewport.ts` | ✅ |
| **6** | Client: conversation thread layout (vertical) | `client/components/conversation-graph.ts` | ✅ |
| **7** | Client: HUD overlays (lens, input, config) | `client/components/*.ts` | ✅ |
| **8** | Client: position-preserving lens switch | `client/components/graph-viewport.ts` | ✅ |
| **9** | Client: progressive onboarding (HUD visibility) | `client/core/onboarding.ts` | ✅ |
| **10** | E2E: conversation graph + semantic zoom + HUD | `tests/scenarios/cognitive/graph-workspace.spec.ts` | ✅ |

---

The MVP is a **complete full-screen graph workspace**. Conversation *is* the graph — embedded HTML nodes at detail zoom, glyphs at overview. HUD overlays provide transient controls without ever leaving the canvas. Spatial memory persists across sessions. The core loop — **type → message node appears → zoom to read → lens to reframe → pan to explore** — works instantly, seamlessly, completely.