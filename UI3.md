# SeNARS Cognitive HUD — Final Development Specification

## 1. Executive Summary

This document specifies the complete architecture and development plan for the SeNARS Agent UI: a real-time cognitive telemetry dashboard for the SeNARS hybrid reasoning engine. The system is **single-authority** (the NARS engine is the sole writer of cognitive state), **pure TypeScript**, and **mock-free**. Every pixel is driven by live WebSocket state from the actual reasoning engine.

**Design Philosophy — "The Scientific HUD":**
- **Game-like:** Dark mode, neon accents (cyan/amber/magenta), glassmorphism panels, fluid dataflow animations.
- **Scientific/Industrial:** High information density, monospace data fonts, precise metric readouts, zero decorative flash that impedes readability.
- **Feels like:** A spacecraft telemetry console or quantitative trading terminal.

---

## 2. Technology Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Runtime** | Node.js (≥20) | Single-language stack with the SeNARS engine |
| **Server** | Fastify + `@fastify/static` + `@fastify/websocket` | High-perf single-port HTTP + WS |
| **Build (Server)** | `tsup` | Zero-config TS bundling for Node |
| **Build (Client)** | Vite | Fast HMR, native ESM |
| **UI Framework** | Lit (Web Components + Shadow DOM) | True modularity, zero virtual DOM, no framework lock-in |
| **Data Contract** | Zod | Runtime + compile-time type safety for WS protocol |
| **State Management** | NanoStores (or equivalent tiny pub/sub) | Decouples network from UI, slice subscriptions |
| **Graph Rendering** | Cytoscape.js | Industry standard for node-graph visualization |
| **Telemetry Rendering** | uPlot | 60fps canvas-based time-series for high-frequency data |
| **Markdown** | `marked` + `DOMPurify` + `highlight.js` | Secure, syntax-highlighted rendering |
| **Testing** | Playwright (E2E), `mock-socket`, `k6` (load) | Full QA coverage for real-time race conditions |

---

## 3. Project Structure

```
senars-ui/
├── src/
│   ├── shared/                    # Shared between server & client
│   │   └── protocol.ts            # Zod schemas for WS messages
│   ├── server/
│   │   ├── index.ts               # Fastify entry, WS routing
│   │   ├── gateway.ts             # Bridge to SeNARS engine
│   │   ├── projection.ts          # Active subgraph calculation
│   │   ├── validators.ts          # Server-side Zod validation
│   │   └── rate-limiter.ts        # Token bucket per connection
│   └── client/
│       ├── index.html
│       ├── core/
│       │   ├── theme.css          # Scientific HUD CSS variables
│       │   ├── ws-client.ts       # Dumb WS pipe + reconnect
│       │   ├── store.ts           # Centralized state (NanoStores)
│       │   └── events.ts          # Typed event bus
│       ├── components/
│       │   ├── app-layout.ts      # Responsive grid container
│       │   ├── chat-console.ts
│       │   ├── config-drawer.ts
│       │   ├── cognitive-hud.ts
│       │   ├── belief-graph.ts
│       │   ├── working-memory.ts
│       │   └── telemetry-panel.ts
│       └── workers/
│           └── graph-layout.ts    # Off-main-thread Cytoscape layout
├── tests/
│   ├── e2e/                       # Playwright
│   ├── contract/                  # Zod schema tests
│   └── load/                      # k6 scripts
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tsup.config.ts
```

---

## 4. Phase 1 — Foundation: Protocol, Store, and Server Skeleton

**Goal:** Establish the typed contract and state backbone. Everything else depends on this being flawless.

### 4.1 Define the Wire Protocol (`src/shared/protocol.ts`)

Every WebSocket message is a Zod schema. Both client and server import the same file.

```typescript
import { z } from 'zod';

// --- Chat ---
export const ChatUserMsg = z.object({
  type: z.literal('chat.user'),
  content: z.string().min(1).max(10000),
});
export const ChatAgentStream = z.object({
  type: z.literal('chat.agent.stream'),
  delta: z.string(),
});
export const ChatAgentComplete = z.object({
  type: z.literal('chat.agent.complete'),
  content: z.string(),
});

// --- Cognitive State (Delta-based) ---
export const GraphOp = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add_node'), id: z.string(), data: z.object({ priority: z.number(), confidence: z.number() }) }),
  z.object({ action: z.literal('update_node'), id: z.string(), data: z.object({ priority: z.number(), confidence: z.number() }).partial() }),
  z.object({ action: z.literal('remove_node'), id: z.string() }),
  z.object({ action: z.literal('add_edge'), source: z.string(), target: z.string(), data: z.object({ weight: z.number() }).optional() }),
  z.object({ action: z.literal('remove_edge'), source: z.string(), target: z.string() }),
]);

export const CognitiveDelta = z.object({
  type: z.literal('cognitive.delta'),
  module: z.enum(['belief_graph', 'working_memory', 'stream_reasoner']),
  ops: z.array(GraphOp),
  meta: z.object({
    truncated: z.boolean().optional(),
    total_hidden: z.number().optional(),
  }).optional(),
});

// --- Configuration (Schema-driven) ---
export const ConfigField = z.object({
  type: z.enum(['slider', 'dropdown', 'text', 'toggle']),
  label: z.string(),
  value: z.any(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
});
export const ConfigSchemaMsg = z.object({
  type: z.literal('config.schema'),
  data: z.record(z.string(), ConfigField),
});
export const ConfigSetMsg = z.object({
  type: z.literal('config.set'),
  key: z.string(),
  value: z.any(),
});

// --- Synchronization (Reconnection Handshake) ---
export const SyncRequest = z.object({
  type: z.literal('sync.request'),
  last_seq_id: z.number().nullable(),
});
export const StateSnapshot = z.object({
  type: z.literal('state.snapshot'),
  seq_id: z.number(),
  data: z.object({
    graph: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
    working_memory: z.array(z.any()),
    config: z.record(z.string(), ConfigField),
  }),
});
export const SeqAck = z.object({
  type: z.literal('seq.ack'),
  seq_id: z.number(),
});

// --- Telemetry ---
export const TelemetryMsg = z.object({
  type: z.literal('telemetry'),
  ts: z.number(),
  metrics: z.object({
    reasoning_hz: z.number(),
    tokens_per_sec: z.number(),
    memory_mb: z.number(),
    ws_latency_ms: z.number(),
  }),
});

// --- Master union for validation ---
export const IncomingFromClient = z.discriminatedUnion('type', [
  ChatUserMsg, ConfigSetMsg, SyncRequest,
]);
export const IncomingFromServer = z.discriminatedUnion('type', [
  ChatAgentStream, ChatAgentComplete, CognitiveDelta,
  ConfigSchemaMsg, StateSnapshot, SeqAck, TelemetryMsg,
]);

export type IncomingFromClient = z.infer<typeof IncomingFromClient>;
export type IncomingFromServer = z.infer<typeof IncomingFromServer>;
```

### 4.2 Centralized Client Store (`src/client/core/store.ts`)

Components never touch the WebSocket. They subscribe to slices of the store.

```typescript
import { createNanoStores } from 'nanostores'; // or equivalent

export const $chat = createNanoStores().atom<Array<{role: 'user'|'agent', content: string}>>([]);
export const $streamingDelta = createNanoStores().atom<string>('');
export const $graphNodes = createNanoStores().atom<Map<string, any>>(new Map());
export const $graphEdges = createNanoStores().atom<Map<string, any>>(new Map());
export const $graphMeta = createNanoStores().atom<{truncated: boolean, total_hidden: number}>({truncated: false, total_hidden: 0});
export const $workingMemory = createNanoStores().atom<any[]>([]);
export const $config = createNanoStores().atom<Record<string, any>>({});
export const $telemetry = createNanoStores().atom<{
  reasoning_hz: number[], tokens_per_sec: number[], memory_mb: number[], ws_latency_ms: number[]
}>({ reasoning_hz: [], tokens_per_sec: [], memory_mb: [], ws_latency_ms: [] });
export const $connectionState = createNanoStores().atom<'connecting'|'connected'|'reconnecting'|'disconnected'>('connecting');
export const $lastSeqId = createNanoStores().atom<number | null>(null);
```

### 4.3 Server Skeleton (`src/server/index.ts`)

Single-port Fastify serving static files and WebSocket on `/ws`.

```typescript
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebSocket from '@fastify/websocket';
import path from 'path';
import { handleConnection } from './gateway.js';

const fastify = Fastify({ logger: true, maxParamLength: 10000 });

await fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../dist/client'),
  prefix: '/',
});
await fastify.register(fastifyWebSocket);

fastify.get('/ws', { websocket: true }, (connection, req) => {
  handleConnection(connection.socket);
});

fastify.setNotFoundHandler((req, reply) => reply.sendFile('index.html'));

await fastify.listen({ port: 3000, host: '0.0.0.0' });
```

---

## 5. Phase 2 — Server Hardening

**Goal:** Make the server production-safe against crashes, abuse, and state explosion.

### 5.1 Gateway: Validation, Backpressure, Rate Limiting (`src/server/gateway.ts`)

```typescript
import { WebSocket } from 'ws';
import { IncomingFromClient } from '../shared/protocol.js';
import { RateLimiter } from './rate-limiter.js';
import { computeActiveSubgraph } from './projection.js';

const MAX_BUFFER_BYTES = 1_048_576; // 1 MB
const HEARTBEAT_INTERVAL_MS = 30_000;

export function handleConnection(socket: WebSocket) {
  const limiter = new RateLimiter({ chat: 5, config: 10 }); // per second
  let lastSeqId = 0;
  const eventBuffer: Array<{seq: number, msg: any}> = [];
  const MAX_BUFFER_SIZE = 1000; // keep last 1000 events for reconnection

  // Heartbeat to detect zombie connections
  let alive = true;
  socket.on('pong', () => { alive = true; });
  const heartbeat = setInterval(() => {
    if (!alive) return socket.terminate();
    alive = false;
    socket.ping();
  }, HEARTBEAT_INTERVAL_MS);

  function send(msg: any) {
    // Backpressure: drop non-critical updates if buffer is full
    if (socket.bufferedAmount > MAX_BUFFER_BYTES) {
      if (msg.type !== 'chat.agent.stream' && msg.type !== 'chat.agent.complete') return;
    }
    const payload = JSON.stringify(msg);
    socket.send(payload);
    // Track sequence for reconnection
    if (msg.type === 'cognitive.delta' || msg.type === 'state.snapshot') {
      eventBuffer.push({ seq: ++lastSeqId, msg: { ...msg, seq_id: lastSeqId } });
      if (eventBuffer.length > MAX_BUFFER_SIZE) eventBuffer.shift();
    }
  }

  // Subscribe to SeNARS engine events
  const unsubs = [
    nar.getSystemEventBus().on('nar:derivation', () => {
      const ops = computeDeltaOps(nar); // diff against last sent state
      const { nodes, edges, truncated, total_hidden } = computeActiveSubgraph(nar, focusTerm, { maxNodes: 300, maxEdges: 600 });
      send({
        type: 'cognitive.delta',
        module: 'belief_graph',
        ops,
        meta: truncated ? { truncated: true, total_hidden } : undefined,
      });
    }),
    // ... other event subscriptions
  ];

  socket.on('message', (raw) => {
    const parsed = IncomingFromClient.safeParse(JSON.parse(raw.toString()));
    if (!parsed.success) {
      send({ type: 'chat.agent.complete', content: `Error: ${parsed.error.message}` });
      return;
    }
    const msg = parsed.data;

    if (msg.type === 'chat.user') {
      if (!limiter.consume('chat')) return;
      handleChat(msg.content, send);
    }
    if (msg.type === 'config.set') {
      if (!limiter.consume('config')) return;
      handleConfig(msg.key, msg.value);
    }
    if (msg.type === 'sync.request') {
      handleSync(msg.last_seq_id, eventBuffer, send);
    }
  });

  socket.on('close', () => {
    clearInterval(heartbeat);
    for (const u of unsubs) u();
  });
}

function handleSync(lastSeqId: number | null, buffer: Array<{seq: number, msg: any}>, send: (m: any) => void) {
  if (lastSeqId === null || buffer.length === 0 || buffer[buffer.length - 1].seq - lastSeqId > buffer.length) {
    // Gap too large or first connect: send full snapshot
    send({
      type: 'state.snapshot',
      seq_id: buffer.length > 0 ? buffer[buffer.length - 1].seq : 0,
      data: buildFullSnapshot(nar),
    });
  } else {
    // Stream missed deltas
    for (const entry of buffer) {
      if (entry.seq > lastSeqId) send(entry.msg);
    }
  }
}
```

### 5.2 Active Subgraph Projection (`src/server/projection.ts`)

The server computes only what the UI needs to render. Never sends the full memory.

```typescript
export interface ProjectionOptions {
  maxNodes: number;   // hard cap, e.g., 300
  maxEdges: number;   // hard cap, e.g., 600
  maxHops: number;    // e.g., 2
}

export function computeActiveSubgraph(nar: NAR, focusTerm: string | null, opts: ProjectionOptions) {
  // 1. Seed: working memory concepts + focus term, sorted by priority desc
  const seeds = focusTerm
    ? [nar.getConcept(focusTerm)].filter(Boolean)
    : nar.listConcepts().sort((a, b) => b.budget.priority - a.budget.priority).slice(0, 50);

  const visited = new Set<string>();
  const queue: Array<{term: string, depth: number}> = seeds.map(c => ({ term: c.term, depth: 0 }));
  const candidates: Array<{term: string, priority: number, depth: number}> = [];

  // 2. BFS with hard cap
  while (queue.length > 0 && candidates.length < opts.maxNodes) {
    const { term, depth } = queue.shift()!;
    if (visited.has(term)) continue;
    visited.add(term);
    const concept = nar.getConcept(term);
    if (!concept) continue;
    candidates.push({ term, priority: concept.budget.priority, depth });
    if (depth < opts.maxHops) {
      for (const link of concept.getLinks()) {
        if (!visited.has(link.target)) queue.push({ term: link.target, depth: depth + 1 });
      }
    }
  }

  // 3. Sort by priority and truncate
  candidates.sort((a, b) => b.priority - a.priority);
  const nodes = candidates.slice(0, opts.maxNodes);
  const nodeSet = new Set(nodes.map(n => n.term));

  // 4. Build edges, also capped
  const edges: any[] = [];
  for (const node of nodes) {
    for (const link of nar.getConcept(node.term).getLinks()) {
      if (nodeSet.has(link.target) && edges.length < opts.maxEdges) {
        edges.push({ source: node.term, target: link.target, weight: link.strength });
      }
    }
  }

  const truncated = candidates.length > opts.maxNodes || /* total reachable */ true;
  const total_hidden = nar.listConcepts().length - nodes.length;

  return { nodes, edges, truncated, total_hidden };
}
```

### 5.3 Rate Limiter (`src/server/rate-limiter.ts`)

Token bucket per connection, per message category.

```typescript
export class RateLimiter {
  private buckets: Map<string, { tokens: number, lastRefill: number }>;
  constructor(private limits: Record<string, number>) {
    this.buckets = new Map();
    for (const key of Object.keys(limits)) this.buckets.set(key, { tokens: limits[key], lastRefill: Date.now() });
  }
  consume(key: string): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket) return false;
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(this.limits[key], bucket.tokens + elapsed * this.limits[key]);
    bucket.lastRefill = now;
    if (bucket.tokens >= 1) { bucket.tokens -= 1; return true; }
    return false;
  }
}
```

---

## 6. Phase 3 — Client Core: WS Client, Store Binding, Reconnection

### 6.1 WebSocket Client (`src/client/core/ws-client.ts`)

Dumb pipe. Validates with Zod, pushes to store, handles reconnection with handshake.

```typescript
import { IncomingFromServer, SyncRequest } from '../../shared/protocol.js';
import { $connectionState, $lastSeqId } from './store.js';
import { applyServerMessage } from './store-bindings.js';

const WS_URL = `ws://${location.host}/ws`;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10000;

let socket: WebSocket | null = null;
let reconnectAttempt = 0;
let reconnectTimer: number | null = null;
let pingInterval: number | null = null;

export function connect() {
  $connectionState.set(socket ? 'reconnecting' : 'connecting');
  socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    reconnectAttempt = 0;
    $connectionState.set('connected');
    // Reconnection handshake
    const req: z.infer<typeof SyncRequest> = {
      type: 'sync.request',
      last_seq_id: $lastSeqId.get(),
    };
    socket!.send(JSON.stringify(req));
    // Start ping for latency measurement
    pingInterval = window.setInterval(() => {
      const t0 = performance.now();
      socket!.send(JSON.stringify({ type: 'ping', t0 }));
    }, 5000);
  };

  socket.onmessage = (ev) => {
    if (ev.data === 'pong') return; // latency handled separately
    const raw = JSON.parse(ev.data);
    const parsed = IncomingFromServer.safeParse(raw);
    if (!parsed.success) {
      console.error('[WS] Malformed message dropped:', parsed.error, raw);
      return;
    }
    applyServerMessage(parsed.data);
  };

  socket.onclose = () => {
    $connectionState.set('reconnecting');
    if (pingInterval) clearInterval(pingInterval);
    scheduleReconnect();
  };

  socket.onerror = () => socket?.close();
}

function scheduleReconnect() {
  const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** reconnectAttempt++);
  reconnectTimer = window.setTimeout(connect, delay);
}

export function send(msg: any) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}
```

### 6.2 Store Bindings (`src/client/core/store-bindings.ts`)

Single place that translates server messages into store mutations. Components never parse messages.

```typescript
import { IncomingFromServer } from '../../shared/protocol.js';
import { $chat, $streamingDelta, $graphNodes, $graphEdges, $graphMeta, $config, $telemetry, $lastSeqId, $workingMemory } from './store.js';

const TELEMETRY_WINDOW = 300; // ring buffer size

export function applyServerMessage(msg: IncomingFromServer) {
  switch (msg.type) {
    case 'chat.agent.stream':
      $streamingDelta.set($streamingDelta.get() + msg.delta);
      break;
    case 'chat.agent.complete':
      $chat.set([...$chat.get(), { role: 'agent', content: msg.content }]);
      $streamingDelta.set('');
      break;
    case 'cognitive.delta':
      if (msg.module === 'belief_graph') applyGraphOps(msg.ops, msg.meta);
      break;
    case 'config.schema':
      $config.set(msg.data);
      break;
    case 'state.snapshot':
      $lastSeqId.set(msg.seq_id);
      applyFullSnapshot(msg.data);
      break;
    case 'seq.ack':
      $lastSeqId.set(msg.seq_id);
      break;
    case 'telemetry':
      appendTelemetry(msg);
      break;
  }
}

function applyGraphOps(ops: any[], meta?: any) {
  const nodes = new Map($graphNodes.get());
  const edges = new Map($graphEdges.get());
  for (const op of ops) {
    const edgeKey = (s: string, t: string) => `${s}→${t}`;
    switch (op.action) {
      case 'add_node': nodes.set(op.id, { id: op.id, ...op.data }); break;
      case 'update_node': nodes.set(op.id, { ...nodes.get(op.id), ...op.data }); break;
      case 'remove_node': nodes.delete(op.id); break;
      case 'add_edge': edges.set(edgeKey(op.source, op.target), { source: op.source, target: op.target, ...op.data }); break;
      case 'remove_edge': edges.delete(edgeKey(op.source, op.target)); break;
    }
  }
  $graphNodes.set(nodes);
  $graphEdges.set(edges);
  if (meta) $graphMeta.set(meta);
}

function appendTelemetry(msg: any) {
  const t = $telemetry.get();
  const push = (arr: number[], v: number) => {
    const next = [...arr, v];
    return next.length > TELEMETRY_WINDOW ? next.slice(next.length - TELEMETRY_WINDOW) : next;
  };
  $telemetry.set({
    reasoning_hz: push(t.reasoning_hz, msg.metrics.reasoning_hz),
    tokens_per_sec: push(t.tokens_per_sec, msg.metrics.tokens_per_sec),
    memory_mb: push(t.memory_mb, msg.metrics.memory_mb),
    ws_latency_ms: push(t.ws_latency_ms, msg.metrics.ws_latency_ms),
  });
}
```

---

## 7. Phase 4 — UI Components

All components are Lit Web Components. They subscribe to store slices and render. Zero business logic.

### 7.1 Chat Console (`src/client/components/chat-console.ts`)

```typescript
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $chat, $streamingDelta } from '../core/store.js';
import { send } from '../core/ws-client.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

marked.setOptions({ highlight: (code, lang) => hljs.highlightAuto(code, [lang]).value });

@customElement('chat-console')
export class ChatConsole extends LitElement {
  static styles = css`/* Scientific HUD styles */`;

  private unsubChat = $chat.subscribe(() => this.requestUpdate());
  private unsubStream = $streamingDelta.subscribe(() => this.requestUpdate());
  disconnectedCallback() { this.unsubChat(); this.unsubStream(); super.disconnectedCallback(); }

  private renderMd(text: string) {
    return html`<div class="md" .innerHTML=${DOMPurify.sanitize(marked.parse(text))}></div>`;
  }

  private sendMessage() {
    const input = this.shadowRoot!.querySelector('input')!;
    const content = input.value.trim();
    if (!content) return;
    $chat.set([...$chat.get(), { role: 'user', content }]);
    send({ type: 'chat.user', content });
    input.value = '';
  }

  render() {
    return html`
      <div class="messages">
        ${$chat.get().map(m => html`<div class="msg ${m.role}">${this.renderMd(m.content)}</div>`)}
        ${$streamingDelta.get() ? html`<div class="msg agent">${this.renderMd($streamingDelta.get())}<span class="cursor">▊</span></div>` : ''}
      </div>
      <div class="input-area">
        <input @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.sendMessage()} placeholder="Query the agent...">
        <button @click=${this.sendMessage}>SEND</button>
      </div>
    `;
  }
}
```

### 7.2 Schema-Driven Config Drawer (`src/client/components/config-drawer.ts`)

Renders whatever schema the server sends. Adding a new backend parameter requires zero frontend changes.

```typescript
@customElement('config-drawer')
export class ConfigDrawer extends LitElement {
  private unsub = $config.subscribe(() => this.requestUpdate());
  disconnectedCallback() { this.unsub(); super.disconnectedCallback(); }

  private update(key: string, value: any) {
    const cfg = { ...$config.get() };
    cfg[key] = { ...cfg[key], value };
    $config.set(cfg);
    send({ type: 'config.set', key, value });
  }

  render() {
    const cfg = $config.get();
    return html`
      <h2>System Config</h2>
      ${Object.entries(cfg).map(([key, field]: [string, any]) => html`
        <div class="field">
          <label>${field.label} <span class="val">${field.value}</span></label>
          ${field.type === 'slider' ? html`
            <input type="range" min=${field.min} max=${field.max} step=${field.step ?? 0.1}
              .value=${field.value} @input=${(e: Event) => this.update(key, parseFloat((e.target as HTMLInputElement).value))}>
          ` : ''}
          ${field.type === 'dropdown' ? html`
            <select @change=${(e: Event) => this.update(key, (e.target as HTMLSelectElement).value)}>
              ${field.options?.map((o: string) => html`<option ?selected=${o === field.value}>${o}</option>`)}
            </select>
          ` : ''}
          ${field.type === 'toggle' ? html`
            <input type="checkbox" .checked=${field.value} @change=${(e: Event) => this.update(key, (e.target as HTMLInputElement).checked)}>
          ` : ''}
        </div>
      `)}
    `;
  }
}
```

### 7.3 Cognitive HUD with Belief Graph (`src/client/components/belief-graph.ts`)

Uses Cytoscape with **delta application** (no full redraws). Layout runs in a Web Worker.

```typescript
@customElement('belief-graph')
export class BeliefGraph extends LitElement {
  private cy: any;
  private layoutWorker = new Worker(new URL('../workers/graph-layout.ts', import.meta.url));

  firstUpdated() {
    this.cy = cytoscape({
      container: this.shadowRoot!.getElementById('graph'),
      style: [/* node/edge styles using data(priority), data(confidence) */],
    });

    // Subscribe to graph state
    $graphNodes.subscribe(() => this.syncGraph());
    $graphEdges.subscribe(() => this.syncGraph());

    // Receive computed positions from worker
    this.layoutWorker.onmessage = (e) => {
      this.cy.batch(() => {
        for (const [id, pos] of Object.entries(e.data.positions)) {
          this.cy.getElementById(id).position(pos);
        }
      });
    };
  }

  private syncGraph() {
    const nodes = $graphNodes.get();
    const edges = $graphEdges.get();
    this.cy.batch(() => {
      // Delta apply: add missing, remove stale, update data
      const currentNodeIds = new Set(this.cy.nodes().map((n: any) => n.id()));
      for (const [id, data] of nodes) {
        if (currentNodeIds.has(id)) {
          this.cy.getElementById(id).data(data);
        } else {
          this.cy.add({ group: 'nodes', data: { id, ...data } });
        }
      }
      for (const id of currentNodeIds) if (!nodes.has(id)) this.cy.getElementById(id).remove();
      // Similar for edges
    });
    // Offload layout to worker
    this.layoutWorker.postMessage({
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
    });
  }

  render() {
    const meta = $graphMeta.get();
    return html`
      <div id="graph"></div>
      ${meta.truncated ? html`<div class="warning">Viewing top nodes by priority. ${meta.total_hidden} lower-priority concepts hidden.</div>` : ''}
    `;
  }
}
```

### 7.4 Web Worker for Graph Layout (`src/client/workers/graph-layout.ts`)

Keeps the main thread at 60fps during reasoning spikes.

```typescript
import cytoscape from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';
cytoscape.use(coseBilkent);

let cy: any = null;

self.onmessage = (e) => {
  const { nodes, edges } = e.data;
  if (!cy) {
    cy = cytoscape({ headless: true, elements: [] });
  }
  cy.batch(() => {
    cy.elements().remove();
    cy.add(nodes.map((n: any) => ({ group: 'nodes', data: n })));
    cy.add(edges.map((e: any) => ({ group: 'edges', data: e })));
  });
  const layout = cy.layout({ name: 'cose-bilkent', animate: false, randomize: false });
  layout.run();
  layout.one('layoutstop', () => {
    const positions: Record<string, {x: number, y: number}> = {};
    cy.nodes().forEach((n: any) => { positions[n.id()] = n.position(); });
    self.postMessage({ positions });
  });
};
```

### 7.5 Telemetry Panel (`src/client/components/telemetry-panel.ts`)

Uses **uPlot** with a ring buffer for 60fps oscilloscope rendering.

```typescript
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

@customElement('telemetry-panel')
export class TelemetryPanel extends LitElement {
  private plot: uPlot | null = null;

  firstUpdated() {
    this.plot = new uPlot({
      width: this.clientWidth,
      height: 200,
      series: [
        {}, // x-axis (timestamp)
        { label: 'Reasoning Hz', stroke: '#ffb000', scale: 'hz' },
        { label: 'Tokens/sec', stroke: '#00f3ff', scale: 'tps' },
        { label: 'Memory MB', stroke: '#ff0055', scale: 'mem' },
      ],
      scales: {
        hz: { auto: true }, tps: { auto: true }, mem: { auto: true },
      },
      axes: [/* ... */],
    }, [], this.shadowRoot!.getElementById('plot')!);

    $telemetry.subscribe(() => {
      const t = $telemetry.get();
      const n = t.reasoning_hz.length;
      const xs = Array.from({ length: n }, (_, i) => i);
      this.plot!.setData([xs, t.reasoning_hz, t.tokens_per_sec, t.memory_mb]);
    });
  }

  render() {
    return html`<div id="plot"></div>`;
  }
}
```

### 7.6 App Layout (`src/client/components/app-layout.ts`)

Responsive grid using CSS Container Queries.

```typescript
@customElement('app-layout')
export class AppLayout extends LitElement {
  static styles = css`
    :host { display: grid; height: 100vh; container-type: inline-size; }
    :host {
      grid-template-columns: 1fr 320px;
      grid-template-rows: 1fr auto;
      grid-template-areas: "main config" "telemetry telemetry";
    }
    @container (max-width: 900px) {
      :host {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr auto auto;
        grid-template-areas: "main" "telemetry" "config";
      }
    }
  `;
  render() {
    return html`
      <div style="grid-area: main; display: flex; flex-direction: column;">
        <cognitive-hud style="flex: 3;"></cognitive-hud>
        <chat-console style="flex: 2;"></chat-console>
      </div>
      <config-drawer style="grid-area: config;"></config-drawer>
      <telemetry-panel style="grid-area: telemetry;"></telemetry-panel>
    `;
  }
}
```

---

## 8. Phase 5 — Quality Assurance & CI/CD

Manual testing of real-time race conditions is impossible. Automate everything.

### 8.1 Contract Tests (`tests/contract/`)

Generate a valid payload for every Zod schema. Send to server. Assert no crash. If a backend dev changes the NARS engine output and the schema drifts, CI fails immediately.

### 8.2 E2E Tests (`tests/e2e/`, Playwright + `mock-socket`)

- Open the UI.
- Simulate a high-frequency NARS derivation stream (50 events/sec) via `mock-socket`.
- Assert: UI remains responsive, graph updates, no console errors, no memory growth over 60 seconds.
- Simulate a network drop and reconnect. Assert: reconnection handshake fires, state reconciles, no duplicated or missing nodes.

### 8.3 Load Tests (`tests/load/`, k6)

- 1,000 concurrent WebSocket connections.
- Each sends 5 `chat.user` messages/sec.
- Run for 1 hour.
- Assert: server CPU < 80%, memory stable (no leaks), p99 latency < 100ms.

### 8.4 CI Pipeline

1. `npm run typecheck` — strict TS across shared protocol.
2. `npm run test:contract` — Zod schema validation.
3. `npm run test:e2e` — Playwright suite.
4. `npm run build` — verify production build.
5. (Nightly) `npm run test:load` — k6 soak test.

---

## 9. Final Architecture Summary

| Concern | Solution |
| :--- | :--- |
| **Type safety across network** | Shared Zod schemas, single source of truth |
| **UI/Network decoupling** | Centralized NanoStores, components subscribe to slices |
| **Graph rendering perf** | Delta ops (not full redraws), server-side projection, Web Worker layout |
| **Hub-node explosion** | Hard cap (300 nodes / 600 edges), sorted by priority, truncation flag in UI |
| **Reconnection correctness** | Sequence IDs + event buffer on server, handshake on client |
| **Server stability** | Zod validation, token-bucket rate limiting, WS backpressure checks, heartbeat |
| **Telemetry perf** | uPlot (canvas) + ring buffer (300 samples), no Lit re-renders |
| **Backend extensibility** | Schema-driven config drawer, zero frontend changes for new params |
| **Modularity** | Lit Web Components with Shadow DOM, drop-in anywhere |
| **QA** | Contract tests, Playwright E2E with mock-socket, k6 load tests |

---

## 10. Execution Order

Build in this exact sequence. Each phase unblocks the next.

1. **Phase 1** — Protocol + Store + Server skeleton. (Foundation; nothing works without it.)
2. **Phase 3** — Client WS client + store bindings + reconnection handshake. (Now the pipe works end-to-end.)
3. **Phase 2** — Server hardening: validation, projection, rate limiting, backpressure, heartbeat. (Now it's production-safe.)
4. **Phase 4** — UI components: chat, config, graph, telemetry, layout. (Now it's usable.)
5. **Phase 5** — Web Worker layout + uPlot telemetry. (Now it's performant.)
6. **Phase 6** — QA and CI/CD. (Now it's maintainable.)

This is the complete, self-contained specification. Every decision is justified by the constraints: single-authority, pure TypeScript, mock-free, real-time, scalable. Execute in order.

