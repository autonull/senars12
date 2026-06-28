# SeNARS Cognitive Cockpit — Fusion Architecture & MVP Development Plan

## 1. Vision: The Cognitive Cockpit

A **unified cognitive workspace** where conversation *is* the graph and the graph *is* the conversation. Every message is a node; every reasoning chain is a thread. No view switching — single living cognitive structure with spatial memory.

**Design Philosophy:** *Scientific HUD meets Conversational Intelligence*
- **Game-like fluidity:** 60fps, micro-interactions, spatial memory
- **Scientific density:** Every pixel carries meaning; monospace data fonts
- **Cognitive ergonomics:** UI thinks with you — anticipates, contextualizes, reveals
- **Seamless completeness:** Every shipped feature feels polished; no grayed-out buttons

### MVP vs Post-MVP Scope

```
┌─────────────────────────────────────────────────────────────────┐
│                    MVP (Ship Complete)                           │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ Chat↔   │  │ 3 Lens   │  │Position  │  │ Schema-Driven   │  │
│  │ Graph   │  │ System   │  │Preserving│  │ Config + Status │  │
│  │ Fusion  │  │          │  │ Layout   │  │ Bar + Onboard   │  │
│  └─────────┘  └──────────┘  └──────────┘  └─────────────────┘  │
│                                                                   │
│  Deferred (Post-MVP)                                              │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Temporal   │  │ Intent       │  │ Full 35-Mod  │             │
│  │ Scrubber   │  │ System (8)   │  │ Exposure Map │             │
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
| **Complete features only** | No grayed buttons, no placeholders — if not ready, it doesn't exist |
| **Zero awkward transitions** | No spinners, no layout shifts, no FOUC |
| **No micromanagement** | No refresh/sync buttons, no confirmations on normal actions |
| **Self-evident navigation** | Click message → graph centers; click node → thread opens |
| **One primary action/view** | Chat input, node click, lens switch — one thing per view |
| **Thought-speed information** | Stable graph positions, natural chat scroll, no unexpected reflows |

| Conventional Agent UI | This MVP |
|----------------------|----------|
| Chat + separate graph tab | **Fused**: click message → graph centers, click node → concept thread opens |
| Static config panels | **3 lenses**: Beliefs, Goals, Conflicts — instant switch, no layout change |
| Post-hoc reasoning display | **Live reasoning nodes** appear in graph as derived |
| Manual refresh | **Real-time push**: server sends deltas, UI never polls |
| Fixed layout | **Two-zone responsive**: graph dominant, contextual panels slide in |
| Separate debug panels | **Spatial memory**: position-preserving lens switch, no disorientation |

---

## 2. MVP Scope: Ship Complete, Defer Rest

### ✅ MVP (Polished, Complete)

| Feature | Rationale | Exit Criteria |
|---------|-----------|---------------|
| **Chat↔Graph Fusion** | Core UX innovation | Message appears as chat bubble + graph node; click syncs both |
| **Click Bridge** | Makes fusion useful | Click message → graph centers; click node → concept thread opens |
| **3 Primary Lenses** | Beliefs, Goals, Conflicts — top cognitive perspectives | Lens switch changes visual encoding without moving nodes |
| **Position-Preserving Layout** | Prevents disorientation | Nodes keep (x,y) across lens changes; only visual encoding changes |
| **Schema-Driven Config** | Foundation for engine control | Config drawer renders whatever schema server sends |
| **Status Bar** | Always-visible orientation | Shows lens, connection, cycle count; click lens badge opens selector |
| **Progressive Onboarding** | Simple → Full mode | New user sees clean interface; power users unlock more |
| **Chat Console** | Streaming markdown, syntax highlight, secure | Already implemented in current UI |

### ❌ Deferred (Post-MVP)

| Feature | Why Deferred | Risk of Half-Implementation |
|---------|-------------|----------------------------|
| **Temporal Scrubber** | Adds timeline canvas, ghost overlay, checkpoint system | Broken scrubber worse than none |
| **Intent System** | 8 intent types × NAR reconfiguration = complex UX | Silent failures destroy trust |
| **Contradiction Resolution Dialogue** | Deep mediation UX | Buttons that don't resolve = worse than highlights |
| **Full 35-Module Exposure** | Screen density overload | Cluttered UI with rarely-used panels |
| **Radial Dial Lens Selector** | Right-click discoverability problem | Status bar dropdown simpler, always visible |
| **uPlot Telemetry** | Canvas + ring buffers; not core to fusion | Empty charts look unprofessional |
| **Lens Search (Ctrl+L)** | Keyboard shortcut discoverability; 3 lenses don't need search | Feature no one discovers |
| **5+ Additional Lenses** | Value unclear without deep SeNARS integration | Lenses with no data look broken |
| **3-Tier Expert Mode** | 2 levels (Simple/Full) sufficient | Users stuck in wrong tier |
| **Ghost Overlay/Onion Skinning** | Requires temporal scrubber | Same as scrubber |

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Runtime** | Node.js ≥20 | Single-language stack with SeNARS engine |
| **Server** | Fastify + `@fastify/static` + `@fastify/websocket` | High-perf single-port HTTP+WS |
| **Build (Server)** | `tsup` | Zero-config TS bundling for Node |
| **Build (Client)** | Vite | Fast HMR, native ESM |
| **UI Framework** | Lit (Web Components + Shadow DOM) | True modularity, zero virtual DOM, no framework lock-in |
| **Data Contract** | Zod | Runtime + compile-time type safety for WS protocol |
| **State Management** | NanoStores (tiny pub/sub) | Slice subscriptions, computed stores, decouples network from UI |
| **Graph Rendering** | Cytoscape.js + cytoscape-fcose | Industry standard for node-graph visualization |
| **Markdown** | `marked` + `DOMPurify` + `highlight.js` | Secure, syntax-highlighted rendering |
| **Testing** | Playwright (E2E) | Full QA coverage for real-time race conditions |
| **Storybook** | Storybook + HTML Vite | Component-driven development |

---

## 4. MVP Data Model (Single Source of Truth)

**Key insight:** `chat-console`, `belief-graph`, `concept-thread` are **three views into one store**. One write populates all.

```typescript
// shared/protocol.ts — MVP protocol (Zod schemas)
import { z } from 'zod';

// Chat messages ARE graph nodes
export const ChatMessage = z.object({
  id: z.string(),
  role: z.enum(['user', 'agent', 'system']),
  content: z.string(),
  timestamp: z.number(),
  term: z.string().optional(),           // Narsese if extracted
  truth: z.object({ frequency: z.number(), confidence: z.number() }).optional(),
  punctuation: z.enum(['.', '!', '?']).optional(),
  supports: z.array(z.string()),         // Message IDs this supports
  contradicts: z.array(z.string()),      // Message IDs this contradicts
  derivesFrom: z.array(z.string()),      // Parent messages in derivation chain
});
export type ChatMessage = z.infer<typeof ChatMessage>;

// Graph nodes (includes non-chat concepts)
export const GraphNodeData = z.object({
  id: z.string(),
  label: z.string(),
  term: z.string().optional(),
  priority: z.number(),
  confidence: z.number(),
  punctuation: z.enum(['.', '!', '?']).optional(),
  nodeType: z.enum(['concept', 'message', 'derivation', 'goal', 'question']),
  lensData: z.object({ score: z.number(), color: z.string(), size: z.number() }).optional(),
});

// Delta protocol for graph updates
export const GraphOp = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add_node'), id: z.string(), data: GraphNodeData }),
  z.object({ action: z.literal('update_node'), id: z.string(), data: GraphNodeData.partial() }),
  z.object({ action: z.literal('remove_node'), id: z.string() }),
  z.object({ action: z.literal('add_edge'), source: z.string(), target: z.string(),
    data: z.object({ weight: z.number(), type: z.string() }).optional() }),
  z.object({ action: z.literal('remove_edge'), source: z.string(), target: z.string() }),
]);
export type GraphOp = z.infer<typeof GraphOp>;

// 3 primary lenses for MVP
export const Lens = z.enum(['belief', 'goal', 'contradiction']);
export type Lens = z.infer<typeof Lens>;

export const CognitiveDelta = z.object({
  type: z.literal('cognitive.delta'),
  seqId: z.number(),
  lens: Lens,
  ops: z.array(GraphOp),
  meta: z.object({ truncated: z.boolean().optional(), totalHidden: z.number().optional() }).optional(),
});

// Client commands (MVP)
export const ClientCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chat.user'), content: z.string() }),
  z.object({ type: z.literal('config.set'), key: z.string(), value: z.any() }),
  z.object({ type: z.literal('sync.request'), lastSeqId: z.number().nullable() }),
  z.object({ type: z.literal('lens.set'), lens: Lens }),
  z.object({ type: z.literal('focus.set'), term: z.string() }),
]);

export const IncomingFromClient = ClientCommand;
export const IncomingFromServer = z.discriminatedUnion('type', [
  CognitiveDelta,
  z.object({ type: z.literal('chat.agent.stream'), delta: z.string() }),
  z.object({ type: z.literal('chat.agent.complete'), content: z.string(), messageId: z.string() }),
  z.object({ type: z.literal('config.schema'), data: z.record(z.any()) }),
  z.object({ type: z.literal('state.snapshot'), seqId: z.number(), data: z.any() }),
]);
```

### 4.2 Store Architecture (NanoStores)

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

// Cross-cutting state
export const $activeLens = atom<Lens>('belief');
export const $focusTerm = atom<string | null>(null);
export const $selectedMessageId = atom<string | null>(null);
export const $userLevel = atom<'simple'|'full'>('simple');

// Computed: nodes filtered + scored by active lens
export const $visibleNodes = computed(
  [$graphNodes, $activeLens],
  (nodes, lens) => new Map(
    Array.from(nodes.entries())
      .map(([id, n]) => ({ id, node: n, score: n.lensData?.score ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .map(s => [s.id, s.node])
  )
);

// Computed: edges filtered to visible nodes only
export const $visibleEdges = computed(
  [$graphEdges, $visibleNodes],
  (edges, nodes) => {
    const nodeIds = new Set(nodes.keys());
    return new Map(
      Array.from(entries(entries))
        .filter(([, e]) => nodeIds.has(e.source) && nodeIds.has(e.target))
    );
  }
);
```

### 4.3 Store Bindings (Single Write → All Views)

```typescript
// client/core/store-bindings.ts
import type { IncomingFromServer, ChatMessage } from '../../shared/protocol';
import { $chatMessages, $streamingDelta, $graphNodes, /* ... */ } from './store';

export function applyServerMessage(msg: IncomingFromServer) {
  switch (msg.type) {
    case 'chat.agent.stream':
      $streamingDelta.set($streamingDelta.get() + msg.delta);
      break;

    case 'chat.agent.complete': {
      // Single write feeds chat + graph
      const chatMsg: ChatMessage = {
        id: msg.messageId, role: 'agent', content: msg.content,
        timestamp: Date.now(), supports: [], contradicts: [], derivesFrom: [],
      };
      $chatMessages.set([...$chatMessages.get(), chatMsg]);
      $streamingDelta.set('');
      break;
    }

    case 'cognitive.delta':
      applyGraphOps(msg.ops);
      if (msg.seqId) $lastSeqId.set(msg.seqId);
      break;

    case 'config.schema':
      $config.set(msg.data);
      break;

    case 'state.snapshot':
      applyFullSnapshot(msg.data);
      break;
  }
}

function applyGraphOps(ops: GraphOp[]) {
  const nodes = $graphNodes.get(), edges = $graphEdges.get();
  for (const op of ops) {
    switch (op.action) {
      case 'add_node': nodes.set(op.id, op.data); break;
      case 'update_node': nodes.set(op.id, { ...nodes.get(op.id), ...op.data }); break;
      case 'remove_node': nodes.delete(op.id); break;
      case 'add_edge': edges.set(`${op.source}→${op.target}`, op.data); break;
      case 'remove_edge': edges.delete(`${op.source}→${op.target}`); break;
    }
  }
  $graphNodes.set(new Map(nodes));
  $graphEdges.set(new Map(edges));
}
```

### 4.4 Click Bridge — Chat ↔ Graph Synchronization

Components never talk directly — they broadcast through shared stores.

```typescript
// chat-console.ts — user clicks a message
onMessageClick(id: string) {
  const msg = this.messages.find(m => m.id === id);
  if (msg) {
    $selectedMessageId.set(id);
    $focusTerm.set(extractTerm(msg.content));
  }
}

// belief-graph.ts — subscribes to selection
$selectedMessageId.subscribe(id => {
  if (!id || !this.cy) return;
  const node = this.cy.getElementById(id);
  if (!node.length) return;
  this.cy.animate({ center: { eles: node }, zoom: 2, duration: 300 });
  node.style('border-color', '#00f3ff').style('border-width', 4);
  setTimeout(() => node.style({ 'border-width': 2, 'border-color': '#00f3ff' }), 1000);
});

// belief-graph.ts — user clicks graph node
this.cy.on('tap', 'node', (evt) => {
  const id = evt.target.id();
  const term = evt.target.data('term');
  $selectedMessageId.set(id);
  $focusTerm.set(term);
  // If node has matching message ID → scroll chat to that message
});
```

### 4.5 Chat Messages as Graph Nodes — Visual Integration

```typescript
// belief-graph.ts — subscription to chat message store
$chatMessages.subscribe((msgs) => {
  if (!this.cy) return;
  const existingIds = new Set(this.cy.nodes().map(n => n.id()));
  
  this.cy.batch(() => {
    for (const msg of msgs) {
      if (!existingIds.has(msg.id)) {
        this.cy.add({
          group: 'nodes',
          data: {
            id: msg.id,
            label: msg.content.slice(0, 40) + (msg.content.length > 40 ? '…' : ''),
            term: msg.term,
            priority: 0.8, confidence: 1.0, nodeType: 'message',
          },
          classes: 'chat-message-node',
        });
        existingIds.add(msg.id);
      }
    }
  });
});
```

---

## 5. MVP Lens System (3 Lenses, Position-Preserving)

### 5.1 Three Primary Lenses

| Lens | Color | Visual Encoding | Purpose |
|------|-------|----------------|---------|
| **Beliefs** | Cyan `#00f3ff` | Size ∝ frequency × confidence | Default: what system knows & certainty |
| **Goals** | Red `#ff0055` | Size ∝ desire × (1 − achievement) | What system tries to achieve & progress |
| **Conflicts** | Magenta `#ff00ff` | Size ∝ severity × unresolved | Find contradictions in knowledge base |

**All 3 lenses use position-preserving layout — nodes stay in place, only visual encoding changes.**

### 5.2 Lens Scorers (Server-Side)

```typescript
// server/lenses.ts
import type { NAR } from '../../../src/nar/nar';
import type { Concept } from '../../../src/nar/memory/concept';

type LensScorer = (concept: Concept, nar: NAR) => number;

const lensScorers: Record<string, LensScorer> = {
  belief: (c) => (c as any).truth?.frequency * (c as any).truth?.confidence ?? 0,

  goal: (c, nar) => {
    const goals = nar.getTasks().filter(t => t.punctuation === '!');
    if (goals.length === 0) return 0;
    return Math.max(0, ...goals.map(g => {
      const sim = termSimilarity(c.term.toString(), g.term.toString());
      return sim * g.budget.priority * (1 - g.truth.confidence);
    }));
  },

  contradiction: (c, nar) => {
    const cts = nar.getContradictions().filter(ct =>
      ct.tasks.some(t => t.term.toString() === c.term.toString())
    );
    if (cts.length === 0) return 0;
    const maxSeverity = Math.max(...cts.map(ct => ct.severity));
    const avgUnresolved = cts
      .filter(ct => ct.status !== 'resolved')
      .reduce((s, ct) => s + ct.severity, 0) / cts.length;
    return Math.max(maxSeverity, avgUnresolved);
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
    confidence: (concept as any).truth?.confidence ?? 0.5,
    nodeType: 'concept',
    lensData: { score: score / maxScore, color: getLensColor(lens, score / maxScore), size: 10 + 40 * (score / maxScore) },
  }));
}

function getLensColor(lens: string, intensity: number): string {
  const colors: Record<string, [number, number, number]> = {
    belief: [0, 243, 255], goal: [255, 0, 85], contradiction: [255, 0, 255],
  };
  const [r, g, b] = colors[lens] ?? [100, 100, 100];
  return `rgba(${r}, ${g}, ${b}, ${0.3 + 0.7 * intensity})`;
}
```

### 5.3 Lens Selector — Status Bar Dropdown (MVP)

No radial dial — simple dropdown always visible, zero discoverability problem.

```typescript
// client/components/lens-selector.ts
@customElement('lens-selector')
export class LensSelector extends LitElement {
  @state() private activeLens: Lens = 'belief';
  @state() private open = false;

  private setLens(lens: Lens) {
    this.activeLens = lens;
    $activeLens.set(lens);
    send({ type: 'lens.set', lens });
    this.open = false;
  }

  render() {
    return html`
      <div class="lens-selector">
        <button class="lens-badge" @click=${() => this.open = !this.open}>
          <span class="lens-dot" style="background: ${lensColors[this.activeLens]}"></span>
          ${lensLabels[this.activeLens]} <span class="arrow">▼</span>
        </button>
        ${this.open ? html`
          <div class="lens-dropdown">
            ${(['belief', 'goal', 'contradiction'] as Lens[]).map(lens => html`
              <button class="lens-option ${lens === this.activeLens ? 'active' : ''}"
                @click=${() => this.setLens(lens)}>
                <span class="lens-dot" style="background: ${lensColors[lens]}"></span>
                <span class="lens-label">${lensLabels[lens]}</span>
                <span class="lens-desc">${lensDescriptions[lens]}</span>
              </button>
            `)}
          </div>
        ` : ''}
      </div>
    `;
  }
}

const lensLabels: Record<Lens, string> = { belief: 'Beliefs', goal: 'Goals', contradiction: 'Conflicts' };
const lensDescriptions: Record<Lens, string> = {
  belief: 'What the system knows', goal: 'What the system wants', contradiction: 'Where beliefs conflict',
};
const lensColors: Record<Lens, string> = { belief: '#00f3ff', goal: '#ff0055', contradiction: '#ff00ff' };
```

### 5.4 Position-Preserving Lens Switch (Critical for Ergonomics)

```typescript
// belief-graph.ts — lens change handler
$activeLens.subscribe((newLens, oldLens) => {
  if (!this.cy) return;

  // 1. Record current positions
  const positions = new Map<string, { x: number; y: number }>();
  this.cy.nodes().forEach(n => positions.set(n.id(), n.position()));

  // 2. Apply new visual encoding — NO LAYOUT RE-RUN
  this.cy.batch(() => {
    this.cy.nodes().forEach(node => {
      const ld = node.data('lensData');
      if (!ld) { node.style('opacity', 0.15); return; }
      node.style({
        'background-color': ld.color,
        'width': ld.size, 'height': ld.size,
        'opacity': 0.5 + 0.5 * Math.min(1, ld.score),
        'transition-property': 'background-color, width, height, opacity',
        'transition-duration': '0.25s',
      });
    });
    this.cy.edges().forEach(edge => {
      const srcData = edge.source().data('lensData');
      edge.style('opacity', srcData ? 0.1 + 0.9 * srcData.score : 0.02);
    });
  });

  // 3. Guarantee positions preserved
  this.cy.nodes().forEach(n => {
    const pos = positions.get(n.id());
    if (pos) n.position(pos);
  });
});
```

---

## 6. MVP Server Architecture

### 6.1 Projection Engine

```typescript
// server/projection.ts
import type { NAR } from '../../../src/nar/nar';
import { scoreByLens } from './lenses';

export function computeProjection(nar: NAR, opts: { lens: string; maxNodes?: number; maxEdges?: number }) {
  const { maxNodes = 300, maxEdges = 600, lens } = opts;
  const nodes = scoreByLens(nar, lens, maxNodes);
  const nodeIds = new Set(nodes.map(n => n.id));

  // BFS for edges, capped
  const edges: any[] = [];
  const visited = new Set<string>();
  const queue = nodes.slice(0, 50).map(n => n.id);

  while (queue.length > 0 && edges.length < maxEdges) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const concept = nar.getConcept(id);
    if (!concept) continue;
    for (const link of concept.getLinks()) {
      const target = link.concept.term.toString();
      if (nodeIds.has(target)) {
        edges.push({ source: id, target, weight: link.strength, type: link.type });
        if (!visited.has(target)) queue.push(target);
      }
    }
  }

  return { nodes, edges: edges.slice(0, maxEdges), truncated: nar.listConcepts().length > maxNodes, totalHidden: nar.listConcepts().length - nodes.length };
}
```

### 6.2 Gateway (WebSocket Handler)

```typescript
// server/gateway.ts
import { WebSocket } from 'ws';
import { IncomingFromClient } from '../shared/protocol';
import { computeProjection } from './projection';

export function handleConnection(socket: WebSocket, nar: NAR, agent: Agent) {
  let activeLens = 'belief';
  let lastSeqId = 0;
  const eventBuffer: any[] = [];
  const MAX_BUFFER_SIZE = 1000, MAX_BUFFER_BYTES = 1_048_576;

  function send(msg: any) {
    if (socket.bufferedAmount > MAX_BUFFER_BYTES) return;
    const payload = JSON.stringify(msg);
    socket.send(payload);
    if (msg.type === 'cognitive.delta') {
      eventBuffer.push({ ...msg, seqId: ++lastSeqId });
      if (eventBuffer.length > MAX_BUFFER_SIZE) eventBuffer.shift();
    }
  }

  // On connect: config + state snapshot
  send({ type: 'config.schema', data: buildConfigSchema(nar) });
  sendFullSnapshot();

  // Subscribe to engine events
  const unsubs = [
    nar.getSystemEventBus().on('nar:derivation', () => sendDelta()),
    nar.getSystemEventBus().on('nar:drive:changed', () => sendDelta()),
  ];

  function sendFullSnapshot() {
    const proj = computeProjection(nar, { lens: activeLens });
    send({ type: 'state.snapshot', seqId: lastSeqId, data: proj });
  }

  function sendDelta() {
    const proj = computeProjection(nar, { lens: activeLens });
    const ops = computeDeltaOps(lastSentState, proj); // Diff-based
    send({ type: 'cognitive.delta', lens: activeLens, ops,
      meta: { truncated: proj.truncated, totalHidden: proj.totalHidden } });
    lastSentState = proj;
  }

  socket.on('message', async (raw) => {
    try {
      const msg = IncomingFromClient.parse(JSON.parse(raw.toString()));
      switch (msg.type) {
        case 'chat.user': {
          const stream = agent.chat(msg.content, { stream: true });
          for await (const event of stream) {
            if (event.kind === 'text-delta') send({ type: 'chat.agent.stream', delta: event.text });
            if (event.kind === 'finish') send({ type: 'chat.agent.complete', content: event.text, messageId: nanoid() });
            if (event.kind === 'error') send({ type: 'chat.agent.complete', content: `Error: ${event.error}`, messageId: nanoid() });
          }
          break;
        }
        case 'lens.set':
          activeLens = msg.lens;
          sendFullSnapshot();
          break;
        case 'config.set':
          // Apply config (specific handlers per key)
          break;
        case 'sync.request':
          handleSync(msg.lastSeqId, eventBuffer);
          break;
      }
    } catch (e) {
      // Zod error — drop silently, log server-side
    }
  });

  socket.on('close', () => { for (const u of unsubs) u(); });
}
```

---

## 7. MVP Components (Lit Web Components)

### 7.1 Layout — Two Zones, No Clutter

```
┌──────────────────────────────────────────────────────────────┐
│ STATUS BAR: [Lens: Beliefs ▾] [⚡ 0 conflicts] [⬤ Connected]  │
├──────────────────────────────────────┬───────────────────────┤
│                                      │                       │
│        PRIMARY ZONE (80%)            │  SECONDARY ZONE       │
│                                      │  (hidden by default,  │
│   ┌─────────┐  ┌─────────────────┐   │   slides in)          │
│   │  Chat   │  │                 │   │                       │
│   │ (fold-  │  │   Belief Graph  │   │  [Concept Thread]     │
│   │  able)  │  │   (dominant)    │   │  (click node → opens) │
│   │         │  │                 │   │                       │
│   │         │  │                 │   │  [Config Drawer]      │
│   └─────────┘  │                 │   │  (gear icon → opens)  │
│                └─────────────────┘   │                       │
│                                      │                       │
└──────────────────────────────────────┴───────────────────────┘
```

**Layout rules:**
- **Status bar** (always visible, 32px): Lens dropdown, contradiction badge, connection dot
- **Primary zone** (fills remaining): Chat panel (left, 300px, foldable) + Belief graph (center, dominant)
- **Secondary zone** (slides in from right, 300px): Concept thread OR config drawer — only one visible
- **No modals, no floating panels, no telemetry bar, no scrubber**

### 7.2 Chat Console

Extends current implementation — streaming markdown, syntax highlighting. Extended with:
- Click bubble → publish `$selectedMessageId` (graph reacts)
- Messages render as rounded rectangles in graph (not circles)

### 7.3 Belief Graph

Extends current `cognitive-hud.ts` patterns with:
- Delta application (not full redraws)
- Position-preserving lens switching
- Chat-message nodes as rounded rectangles
- Click node → publish `$selectedMessageId` (chat scrolls to message)
- Contradiction nodes flash magenta

```typescript
// GraphSystem wrapper (adapted from existing GraphSystem.js)
class GraphViewport extends GraphSystem {
  // ... existing Cytoscape init, event setup, viewport controls
  // Delta application via $visibleNodes/$visibleEdges subscriptions
  // Lens switch handler (position-preserving)
  // Chat-message node styling (rounded rectangles via CSS classes)
}
```

### 7.4 Concept Thread (MVP)

Slides in from right on node/message click — shows all messages referencing that concept.

```typescript
@customElement('concept-thread')
export class ConceptThread extends LitElement {
  @state() private focusTerm: string | null = null;
  @state() private relatedMessages: ChatMessage[] = [];

  connectedCallback() {
    super.connectedCallback();
    $focusTerm.subscribe(term => {
      this.focusTerm = term;
      if (!term) { this.relatedMessages = []; return; }
      this.relatedMessages = $chatMessages.get()
        .filter(m => m.term === term || m.content.includes(term));
      this.requestUpdate();
    });
  }

  render() {
    if (!this.focusTerm) return html``;
    return html`
      <div class="thread-panel">
        <div class="thread-header">
          <span class="term">${this.focusTerm}</span>
          <button @click=${() => $focusTerm.set(null)}>✕</button>
        </div>
        <div class="messages">
          ${this.relatedMessages.map(m => html`
            <div class="msg ${m.role}">${this.renderContent(m.content)}</div>
          `)}
        </div>
      </div>
    `;
  }
}
```

### 7.5 Contradiction Badge (MVP — Ambient Only)

No resolution dialogue. Floating count badge near graph that pulses on new contradictions. Click → highlights contradiction nodes in current lens.

```typescript
@customElement('contradiction-badge')
export class ContradictionBadge extends LitElement {
  @state() private count = 0;

  connectedCallback() {
    super.connectedCallback();
    wsClient.on('cognitive.delta', (msg) => {
      const ctCount = msg.ops?.filter(op =>
        op.action === 'update_node' && op.data?.nodeType === 'contradiction'
      ).length ?? 0;
      if (ctCount > 0) { this.count += ctCount; this.doPulse(); this.requestUpdate(); }
    });
  }

  render() {
    if (this.count === 0) return html``;
    return html`
      <div class="badge" @click=${() => this.highlightContradictions()}>
        <span>⚡ ${this.count}</span>
      </div>
    `;
  }
}
```

### 7.6 Progressive Onboarding (2 Levels)

```
Simple mode (first visit):
  - Chat console + Belief graph, no lens controls visible
  - Graph shows max 50 nodes, no lens data
  - Status bar: minimal
  - After 3 messages: "Try clicking a message to see it in the graph"
  - After 5 messages: auto-upgrade to Full mode

Full mode:
  - Lens dropdown appears in status bar (3 lenses)
  - Concept thread slides in on node click
  - Graph shows up to 300 nodes with lens scoring
  - Contradiction badge appears
  - Config drawer accessible via gear icon
```

```typescript
// client/core/onboarding.ts
$chatMessages.subscribe(msgs => { if (msgs.length >= 5) $userLevel.set('full'); });

// Components check $userLevel to show/hide:
// - lens-selector: only visible in 'full'
// - concept-thread: only visible in 'full'
// - contradiction-badge: only visible in 'full'
// - graph node labels + lensData: only sent to client in 'full'
```

---

## 8. Deferred Features (Post-MVP) — Architecture Preserved

| Feature | Architecture Preserved | Missing for MVP | Effort to Add Later |
|---------|----------------------|-----------------|---------------------|
| **Temporal Scrubber** | Seq IDs + event buffer on server | No checkpointer, no timeline canvas, no ghost overlay | Add `checkpointer.ts`, `temporal-scrub.ts`, extend gateway |
| **Intent System** | `ClientCommand` union includes `intent.declare` | No `intent-handler.ts`, no intent UI, no toast/undo | Add handler, `intent-composer.ts`, toast system |
| **Contradiction Resolution** | Contradictions flow via `cognitive.delta` ops | No resolution strategies, no dialogue UI | Add `contradiction-dialogue.ts`, server strategies |
| **5+ Additional Lenses** | Lens type is Zod enum — extendable | Only 3 lenses (belief, goal, contradiction) | Add scorers in `lenses.ts`, extend enum, add to dropdown |
| **Radial Dial Selector** | Lens system architected as pluggable | Status bar dropdown only | Add `radial-menu.ts`, wire right-click |
| **uPlot Telemetry** | Server already collects metrics | No client telemetry store, no canvas rendering | Add `telemetry-panel.ts`, `$telemetry` store, server push |
| **35-Module Exposure Map** | Module tabs as Essentials/Power/Expert | Config drawer + graph + lenses cover MVP | Add tab container, module components, new WS messages |
| **Full Graph Metadata on ChatMessage** | `ChatMessage` has optional `term`, `truth`, `supports`, `contradicts`, `derivesFrom` | Server doesn't populate yet | Extend `gateway.ts` to extract terms, link messages |
| **Ghost Overlay/Onion Skinning** | Requires temporal scrubber | No scrubber → no ghost | Ship with scrubber |

---

## 9. Key Type Definitions (Reference)

```typescript
// Core cognitive types (aligned with SeNARS engine)
interface Term { toString(): string; hash: string; }
interface TruthValue { frequency: number; confidence: number; }
interface Task { term: Term; punctuation: '.'|'!'|'?'; truth: TruthValue; budget: { priority: number; durability: number; }; }
interface Concept { term: Term; truth?: TruthValue; budget: { priority: number; durability: number; }; links: ConceptLink[]; }
interface ConceptLink { target: Term; strength: number; type: 'semantic'|'term'|'similarity'; }

// Protocol types
type Lens = 'belief' | 'goal' | 'contradiction';
interface ChatMessage { id: string; role: 'user'|'agent'|'system'; content: string; timestamp: number; supports: string[]; contradicts: string[]; derivesFrom: string[]; }
interface GraphNodeData { id: string; label: string; priority: number; confidence: number; nodeType: string; lensData?: { score: number; color: string; size: number; }; }
type GraphOp = { action: 'add_node'|'update_node'|'remove_node'|'add_edge'|'remove_edge'; /* ... */ }
```

---

## 10. Performance Budget

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Lens switch latency** | <300ms gesture → full re-render | `performance.now()` at `lens.set` → graph stable |
| **Graph frame rate** | 60fps steady; ≥30fps at 50 ops/sec | `requestAnimationFrame` delta tracking |
| **Chat latency** | <200ms Send → first stream token | WS round-trip timing |
| **Reconnection** | <5s drop → consistent state | E2E test |
| **Initial load** | <2s TTI | Lighthouse |
| **Memory** | <50MB DOM growth over 1hr | DOM node count proxy |

---

## 11. Testing Strategy

| Layer | Tool | What It Tests |
|-------|------|---------------|
| **Contract** | Zod `safeParse` on generated payloads | Every WS message validates correctly |
| **Unit** | Vitest | Lens scorers (pure functions), store bindings, delta computation |
| **E2E** | Playwright | Full user flows: message→graph sync, lens switch, reconnection |
| **Cross-browser** | Playwright (Chromium + Firefox) | Consistent behavior |

**Key E2E Scenario:**
```
Given: app loaded and connected
When: I type "Why can't penguins fly?" and press Send
Then: message appears as chat bubble AND as graph node
And: clicking the message centers graph on its node
And: clicking the node opens concept thread panel
When: I switch from Beliefs lens to Conflicts lens
Then: graph color/size changes but node positions stay the same
When: I click the contradiction badge
Then: contradiction nodes highlight in the graph
```

---

## 12. Migration Path from Current UI

| Step | Change | Files | MVP? |
|------|--------|-------|------|
| **1** | Add `ChatMessage` type with graph metadata | `shared/protocol.ts` | ✅ |
| **2** | Server: projection engine + lens scorers (3 lenses) | `server/projection.ts`, `server/lenses.ts` | ✅ |
| **3** | Server: gateway with delta encoding | `server/gateway.ts` | ✅ |
| **4** | Client: computed stores + `$activeLens` | `client/core/store.ts` | ✅ |
| **5** | Client: click bridge (message ↔ graph) | `client/components/chat-console.ts`, `belief-graph.ts` | ✅ |
| **6** | Client: position-preserving lens switch | `client/components/belief-graph.ts` | ✅ |
| **7** | Client: status bar lens dropdown | `client/components/lens-selector.ts` | ✅ |
| **8** | Client: concept thread (slides on node click) | `client/components/concept-thread.ts` | ✅ |
| **9** | Client: contradiction badge (ambient count) | `client/components/contradiction-badge.ts` | ✅ |
| **10** | Client: progressive onboarding (2 levels) | `client/core/onboarding.ts` | ✅ |
| **11** | Client: foldable chat panel, responsive layout | `client/components/app-layout.ts` | ✅ |
| **12** | E2E tests for fusion interactions | `tests/scenarios/cognitive/fusion.spec.ts` | ✅ |

**Each step independently deployable.** App functional and usable after every single step.

---

The MVP is not a prototype — it's a **complete, polished product with deliberately constrained scope**. Everything that ships is seamless. Everything deferred is invisible. The user doesn't miss what they don't see. The core loop — **chat → graph → click → explore** — just works, instantly.