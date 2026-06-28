# SeNARS Cognitive Cockpit — Breakthrough Fusion Architecture & Development Plan

## 1. Vision: The Cognitive Cockpit

This is not a chat interface with a graph bolted on. This is a **unified cognitive workspace** where the conversation *is* the graph and the graph *is* the conversation. Every message is a node. Every reasoning chain is a thread. The user doesn't switch views — they navigate a single, living cognitive structure.

**Design Philosophy:** "Scientific HUD meets Conversational Intelligence"
- **Game-like fluidity:** 60fps, micro-interactions, spatial memory between views
- **Scientific density:** Every pixel carries meaning; monospace data fonts; precise metric readouts
- **Cognitive ergonomics:** The UI *thinks with you* — anticipating, contextualizing, revealing

| Conventional Agent UI | This UI |
|----------------------|---------|
| Chat + separate graph tab | **Fused**: chat *is* graph, graph *is* chat |
| Static configuration panels | **Lens system**: contextual, adaptive views |
| Post-hoc reasoning display | **Live derivation traces** as navigable objects |
| Passive monitoring | **Intent-driven**: user declares goal → system reconfigures |
| Single perspective | **Multi-lens**: belief/goal/question/contradiction/analogy... |
| Text-only interaction | **Spatial + temporal + conversational** unified |
| Debugging after the fact | **Time-travel scrubber** with ghost overlays |
| Contradictions = errors | **Contradictions = dialogue** with resolution strategies |
| Fixed layout | **Container queries + lens-specific layouts** |

---

## 2. Technology Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Runtime** | Node.js (≥20) | Single-language stack with SeNARS engine |
| **Server** | Fastify + `@fastify/static` + `@fastify/websocket` | High-perf single-port HTTP + WS |
| **Build (Server)** | `tsup` | Zero-config TS bundling for Node |
| **Build (Client)** | Vite | Fast HMR, native ESM |
| **UI Framework** | Lit (Web Components + Shadow DOM) | True modularity, zero virtual DOM, no framework lock-in |
| **Data Contract** | Zod | Runtime + compile-time type safety for WS protocol |
| **State Management** | NanoStores (tiny pub/sub) | Slice subscriptions, computed stores, decouples network from UI |
| **Graph Rendering** | Cytoscape.js | Industry standard for node-graph visualization |
| **Telemetry Rendering** | uPlot | 60fps canvas-based time-series for high-frequency data |
| **Markdown** | `marked` + `DOMPurify` + `highlight.js` | Secure, syntax-highlighted rendering |
| **Testing** | Playwright (E2E), `mock-socket` | Full QA coverage for real-time race conditions |

---

## 3. The Fusion Architecture: Unified Cognitive Substrate

### 3.1 Data Model — The Single Source of Truth

The key architectural insight: `chat-console`, `belief-graph`, and `concept-thread` are **three views into a single store**. One write populates all.

```typescript
// shared/protocol.ts — Extended for fusion
import { z } from 'zod';

// Each chat message carries full cognitive metadata
export const CognitiveMessage = z.object({
  id: z.string(),
  role: z.enum(['user', 'agent', 'system']),
  content: z.string(),
  timestamp: z.number(),
  // Graph layer
  term: z.string(),           // Narsese representation (e.g., "(bird --> fly)")
  truth: z.object({ frequency: z.number(), confidence: z.number() }),
  punctuation: z.enum(['.', '!', '?']),  // belief | goal | question
  // Reasoning layer
  derivationId: z.string().optional(),
  contradictionIds: z.array(z.string()).optional(),
  // Graph connections
  supports: z.array(z.string()),       // Message IDs this supports
  contradicts: z.array(z.string()),    // Message IDs this contradicts
  derivesFrom: z.array(z.string()),    // Parent messages in reasoning chain
  triggers: z.array(z.string()),       // Goals/questions spawned
  // Lens metadata (server computes per-lens rendering hints)
  lensData: z.record(z.object({
    score: z.number(),
    color: z.string(),
    size: z.number(),
  })).optional(),
});
export type CognitiveMessage = z.infer<typeof CognitiveMessage>;

// --- Delta protocol (graph ops) ---
export const GraphOp = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add_node'), id: z.string(), data: z.object({
    priority: z.number(), confidence: z.number(),
    term: z.string(), punctuation: z.enum(['.', '!', '?']),
  }) }),
  z.object({ action: z.literal('update_node'), id: z.string(), data: z.object({
    priority: z.number(), confidence: z.number()
  }).partial() }),
  z.object({ action: z.literal('remove_node'), id: z.string() }),
  z.object({ action: z.literal('add_edge'), source: z.string(), target: z.string(),
    data: z.object({ weight: z.number(), type: z.enum(['semantic','term','similarity','inference']) }).optional() }),
  z.object({ action: z.literal('remove_edge'), source: z.string(), target: z.string() }),
]);
export const GraphOp = z.array(GraphOp);

// --- Lens system ---
export const CognitiveLens = z.enum([
  'belief', 'goal', 'question', 'contradiction',
  'derivation', 'analogy', 'temporal', 'meta', 'neural', 'resource'
]);
export type CognitiveLens = z.infer<typeof CognitiveLens>;

// --- Cognitive Delta (lens-scoped) ---
export const CognitiveDelta = z.object({
  type: z.literal('cognitive.delta'),
  seqId: z.number(),
  lens: CognitiveLens,
  ops: z.array(GraphOp),
  derivations: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  contradictions: z.array(z.object({ id: z.string(), severity: z.number() })).optional(),
  meta: z.object({
    truncated: z.boolean().optional(),
    totalHidden: z.number().optional(),
    reasoningHz: z.number().optional(),
    timestamp: z.number(),
  }).optional(),
});

// --- Client commands ---
export const ClientCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chat.user'), content: z.string(), context: z.array(z.string()).optional() }),
  z.object({ type: z.literal('config.set'), key: z.string(), value: z.any() }),
  z.object({ type: z.literal('sync.request'), lastSeqId: z.number().nullable() }),
  z.object({ type: z.literal('lens.set'), lens: CognitiveLens }),
  z.object({ type: z.literal('focus.set'), term: z.string() }),
  z.object({ type: z.literal('intent.declare'), intent: z.object({
    type: z.enum(['understand','prove','plan','debug','explore','compare','verify','optimize']),
    target: z.string(),
    context: z.array(z.string()).optional(),
    constraints: z.any().optional(),
  }) }),
  z.object({ type: z.literal('contradiction.resolve'), id: z.string(), strategy: z.string() }),
  z.object({ type: z.literal('derivation.trace'), id: z.string() }),
  z.object({ type: z.literal('scrubber.set'), position: z.number() }),
  z.object({ type: z.literal('chat.user'), content: z.string() }),
]);

// Master unions for validation
export const IncomingFromClient = ClientCommand;
export const IncomingFromServer = z.discriminatedUnion('type', [
  CognitiveDelta,
  z.object({ type: z.literal('chat.agent.stream'), delta: z.string() }),
  z.object({ type: z.literal('chat.agent.complete'), content: z.string(), messageId: z.string() }),
  z.object({ type: z.literal('config.schema'), data: z.record(z.any()) }),
  z.object({ type: z.literal('state.snapshot'), seqId: z.number(), data: z.any() }),
  z.object({ type: z.literal('telemetry'), ts: z.number(), metrics: z.any() }),
]);
```

### 3.2 Store Architecture — Three Views, One Source

```typescript
// client/core/store.ts
import { atom, computed } from 'nanostores';
import type { CognitiveMessage, CognitiveLens } from '../../shared/protocol';

// === Primary stores (single source of truth) ===
export const $chatMessages = atom<CognitiveMessage[]>([]);
export const $streamingDelta = atom<string>('');
export const $graphNodes = atom<Map<string, GraphNode>>(new Map());
export const $graphEdges = atom<Map<string, GraphEdge>>(new Map());
export const $derivations = atom<Map<string, DerivationTrace>>(new Map());
export const $contradictions = atom<Map<string, Contradiction>>(new Map());
export const $config = atom<Record<string, any>>({});
export const $telemetry = atom<TelemetryWindow>({ ... });
export const $connectionState = atom<'connecting'|'connected'|'reconnecting'|'disconnected'>('connecting');
export const $lastSeqId = atom<number | null>(null);

// === Cross-cutting state (shared across views) ===
export const $activeLens = atom<CognitiveLens>('belief');
export const $focusTerm = atom<string | null>(null);
export const $selectedMessageId = atom<string | null>(null);
export const $intent = atom<Intent | null>(null);
export const $scrubPosition = atom<number>(0);  // 0 = now, negative = past

// === Computed views (reactive slices) ===
// Chat subscribes to the full message list (temporal)
export const $visibleMessages = computed($chatMessages, msgs => msgs);

// Graph subscribes to filtered + scored nodes (spatial)
export const $visibleNodes = computed(
  [$graphNodes, $activeLens, $focusTerm],
  (nodes, lens, focus) => {
    // Filter and score by current lens
    const entries = Array.from(nodes.entries());
    const scored = entries.map(([id, n]) => ({
      id, node: n,
      score: n.lensData?.[lens]?.score ?? 0
    }));
    scored.sort((a, b) => b.score - a.score);
    // Take top 300
    return new Map(scored.slice(0, 300).map(s => [s.id, s.node]));
  }
);

export const $visibleEdges = computed(
  [$graphEdges, $visibleNodes],
  (edges, nodes) => {
    const nodeIds = new Set(nodes.keys());
    const filtered = new Map<string, GraphEdge>();
    for (const [key, edge] of edges) {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        filtered.set(key, edge);
      }
    }
    return filtered;
  }
);

// Computed: messages for current focus concept
export const $conceptThread = computed(
  [$chatMessages, $focusTerm],
  (msgs, focus) => focus
    ? msgs.filter(m => m.term === focus || m.supports.includes(focus) || m.contradicts.includes(focus))
    : []
);
```

### 3.3 Store Bindings — Translating Server Messages

```typescript
// client/core/store-bindings.ts
import { IncomingFromServer, CognitiveMessage } from '../../shared/protocol';
import { $chatMessages, $streamingDelta, $graphNodes, $graphEdges, /* ... */ } from './store';

export function applyServerMessage(msg: IncomingFromServer) {
  switch (msg.type) {
    case 'chat.agent.stream':
      $streamingDelta.set($streamingDelta.get() + msg.delta);
      break;
      
    case 'chat.agent.complete': {
      // Build a CognitiveMessage — single write feeds both chat + graph
      const cogMsg: CognitiveMessage = {
        id: msg.messageId,
        role: 'agent',
        content: msg.content,
        timestamp: Date.now(),
        term: extractNarseseTerm(msg.content),   // Parse [concept] from markdown
        truth: { frequency: 1.0, confidence: 0.9 },
        punctuation: '.',
        supports: extractReferences(msg.content), // Parse [[concept]] links
        contradicts: [],
        derivesFrom: [],
        triggers: [],
      };
      // Write to chat store
      $chatMessages.set([...$chatMessages.get(), cogMsg]);
      // Graph store automatically syncs via its own subscription to $chatMessages
      $streamingDelta.set('');
      break;
    }
      
    case 'cognitive.delta': {
      if (msg.lens !== $activeLens.get()) {
        // Queue for when lens switches; don't discard
        queueForLens(msg.lens, msg.ops);
        return;
      }
      applyGraphOps(msg.ops);
      if (msg.meta) $graphMeta.set(msg.meta);
      if (msg.seqId) $lastSeqId.set(msg.seqId);
      break;
    }
      
    case 'config.schema':
      $config.set(msg.data);
      break;
      
    case 'state.snapshot':
      applyFullSnapshot(msg.data);
      break;
      
    case 'telemetry':
      appendTelemetry(msg);
      break;
  }
}
```

### 3.4 Chat ↔ Graph Synchronization — The Click Bridge

```typescript
// Components never talk directly — they broadcast through stores

// chat-console.ts — click handler
onMessageClick(id: string) {
  // Publish to shared store — graph + concept-thread react
  $selectedMessageId.set(id);
  $focusTerm.set(getMessage(id).term);
}

// belief-graph.ts — subscription for centering
$selectedMessageId.subscribe(id => {
  if (!id || !this.cy) return;
  const node = this.cy.getElementById(id);
  if (node.length) {
    this.cy.animate({
      center: { eles: node },
      zoom: 2,
      duration: 300,
    });
    node.style('border-color', 'var(--accent-cyan)');
    node.style('border-width', 4);
    // Pulse animation
    node.animate({
      style: { 'border-width': 2, 'border-color': '#00f3ff' },
      duration: 1000,
    });
  }
});

// belief-graph.ts — node tap handler
this.cy.on('tap', 'node', (evt) => {
  const id = evt.target.id();
  $selectedMessageId.set(id);
  $focusTerm.set(evt.target.data('term'));
});
```

---

## 4. The Cognitive Lens System

### 4.1 Lens Implementation — Pure Scoring Functions

```typescript
// server/lenses.ts
import type { NAR } from '../../../src/nar/nar';
import type { Concept } from '../../../src/nar/memory/concept';
import type { CognitiveLens } from '../../shared/protocol';

type LensScorer = (concept: Concept, nar: NAR, focusTerm?: string) => number;

/**
 * Each lens is a pure function mapping (Concept, NAR, focus?) → score.
 * The score determines node size, color intensity, and inclusion priority.
 * 
 * Visual encoding per lens:
 *   - belief:    color=#00f3ff(cyan)  size∝frequency×confidence
 *   - goal:      color=#ff0055(red)    size∝desire×(1-achievement)
 *   - question:  color=#ffb000(amber)  size∝priority×(1-answerConfidence)
 *   - contradiction: color=#ff00ff(magenta) size∝severity×(1-resolved)
 *   - derivation:color=#00ff88(green) size∝recentRuleFirings
 *   - analogy:   color=#8888ff(purple) size∝embeddingSimilarity
 *   - temporal:  color=#ff8800(orange) size∝predictionRecency
 *   - meta:      color=#ffffff(white)  size∝qualityImpact
 *   - neural:    color=#00ffaa(teal)   size∝lmServiceActivity
 *   - resource:  color=#888888(gray)   size∝cpu+memory
 */
const lensScorers: Record<CognitiveLens, LensScorer> = {
  belief: (c) => {
    return c.truth.frequency * c.truth.confidence;
  },

  goal: (c, nar) => {
    // Score by relevance to active goals × urgency
    const goals = nar.getTasks().filter(t => t.punctuation === '!');
    if (goals.length === 0) return 0;
    return Math.max(0, ...goals.map(g => {
      const sim = termSimilarity(c.term.toString(), g.term.toString());
      return sim * g.budget.priority * (1 - g.truth.confidence);
    }));
  },

  question: (c, nar) => {
    // Score by how many active questions reference this concept
    const questions = nar.getTasks().filter(t => t.punctuation === '?');
    if (questions.length === 0) return 0;
    return Math.max(0, ...questions.map(q => {
      const sim = termSimilarity(c.term.toString(), q.term.toString());
      return sim * q.budget.priority;
    }));
  },

  contradiction: (c, nar) => {
    // Score by severity of contradictions involving this concept
    const contradictions = nar.getContradictions();
    const relevant = contradictions.filter(ct =>
      ct.tasks.some(t => t.term.toString() === c.term.toString())
    );
    if (relevant.length === 0) return 0;
    const maxSeverity = Math.max(...relevant.map(ct => ct.severity));
    const avgUnresolved = relevant
      .filter(ct => ct.status !== 'resolved')
      .reduce((s, ct) => s + ct.severity, 0) / relevant.length;
    return Math.max(maxSeverity, avgUnresolved);
  },

  derivation: (c, nar) => {
    // Score by recent rule firings involving this concept
    const recent = nar.getRecentDerivations(100)
      .filter(d => {
        const termStr = c.term.toString();
        return d.premises.some(p => p.includes(termStr)) ||
               d.conclusion.includes(termStr);
      });
    if (recent.length === 0) return 0;
    return recent.reduce((s, d) => s + (d.rulePriority || 0.5), 0) / recent.length;
  },

  analogy: (c, nar, focus) => {
    // Score by embedding similarity to focus concept
    if (!focus) return 0;
    const sim = nar.getEmbeddingSimilarity?.(c.term, focus) ?? 0;
    // Bonus for cross-domain
    const focusDomain = nar.getDomain?.(focus);
    const cDomain = nar.getDomain?.(c.term.toString());
    const crossDomainBonus = focusDomain && cDomain && focusDomain !== cDomain ? 0.3 : 0;
    return sim + crossDomainBonus;
  },

  temporal: (c, nar) => {
    // Score by temporal prediction/retrospection involving this concept
    const temporal = nar.getTasks()
      .filter(t => t.term.type === 'PredictiveImplication' || t.term.type === 'RetrospectiveImplication');
    const relevant = temporal.filter(t => t.term.references(c.term.toString()));
    if (relevant.length === 0) return 0;
    return Math.max(...relevant.map(t => t.truth.confidence * t.budget.priority));
  },

  meta: (c, nar) => {
    // How much does this concept affect cognitive quality?
    const quality = nar.getCognitiveQuality?.() ?? 0.5;
    const impact = nar.getConceptQualityImpact?.(c.term) ?? 0;
    return impact * quality;
  },

  neural: (c, nar) => {
    // Score by recent LM service activity
    const recentCalls = nar.getRecentLMServiceCalls?.(50) ?? [];
    const relevant = recentCalls.filter(call => 
      call.concepts?.has(c.term.toString())
    );
    if (relevant.length === 0) return 0;
    return Math.max(...relevant.map(call => call.noveltyScore ?? 0.5));
  },

  resource: (c, nar) => {
    // Score by resource consumption
    const memPressure = nar.getMemoryPressure?.() ?? 0.5;
    const cpuAlloc = c.budget.priority;
    return cpuAlloc * memPressure;
  },
};

/**
 * Score all concepts by active lens, return top N with visual metadata.
 * Called by the projection engine on every cognitive cycle.
 */
export function scoreForLens(nar: NAR, lens: CognitiveLens, focus?: string, maxNodes = 300) {
  const concepts = nar.listConcepts();
  const scorer = lensScorers[lens];
  
  const scored = concepts.map(c => ({
    concept: c,
    score: scorer(c, nar, focus),
  }));
  
  scored.sort((a, b) => b.score - a.score);
  const topN = scored.slice(0, maxNodes);
  
  // Normalize scores to [0, 1] for visual encoding
  const maxScore = Math.max(...topN.map(s => s.score), 0.01);
  
  return topN.map(({ concept, score }) => ({
    id: concept.term.toString(),
    term: concept.term.toString(),
    priority: concept.budget.priority,
    truth: {
      frequency: (concept as any).truth?.frequency ?? 0.5,
      confidence: (concept as any).truth?.confidence ?? 0.5,
    },
    lensData: {
      [lens]: {
        score,
        color: getLensColor(lens, score / maxScore),
        size: 10 + 40 * (score / maxScore),
      },
    },
  }));
}

function getLensColor(lens: CognitiveLens, intensity: number): string {
  const baseColors: Record<CognitiveLens, [number, number, number]> = {
    belief: [0, 243, 255],      // cyan
    goal: [255, 0, 85],         // red
    question: [255, 176, 0],    // amber
    contradiction: [255, 0, 255], // magenta
    derivation: [0, 255, 136],  // green
    analogy: [136, 136, 255],   // purple
    temporal: [255, 136, 0],    // orange
    meta: [255, 255, 255],      // white
    neural: [0, 255, 170],      // teal
    resource: [136, 136, 136],  // gray
  };
  const [r, g, b] = baseColors[lens];
  const alpha = 0.3 + 0.7 * intensity;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

### 4.2 Lens Selector — Radial Dial

**Interaction model:** Right-click graph → radial menu appears centered on cursor. Move mouse toward segment → lens name + description appear. Release to select.

```
        [belief]
   [temporal]   [goal]
[neural]    ●    [question]
  [meta]          [contradiction]
   [analogy]   [derivation]
        [resource]
```

```typescript
// client/components/lens-selector.ts
@customElement('lens-selector')
export class LensSelector extends LitElement {
  @state() private open = false;
  @state() private hoveredLens: CognitiveLens | null = null;
  
  static styles = css`
    .radial-menu {
      position: fixed;
      pointer-events: none;
      z-index: 1000;
    }
    .radial-menu.open { pointer-events: all; }
    .segment {
      position: absolute;
      cursor: pointer;
      transition: all 0.1s;
    }
    .segment:hover {
      filter: brightness(1.5);
      transform: scale(1.1);
    }
  `;

  connectedCallback() {
    // Right-click on graph opens radial menu
    window.addEventListener('contextmenu', (e) => {
      const target = e.composedPath().find(el =>
        (el as HTMLElement).tagName === 'belief-graph'.toUpperCase()
      );
      if (!target) return;
      e.preventDefault();
      this.openAt(e.clientX, e.clientY);
    });

    // Keyboard shortcut: L opens lens search
    window.addEventListener('keydown', (e) => {
      if (e.key === 'l' && !e.ctrlKey && !e.metaKey) {
        this.openLensSearch();
      }
      // Ctrl+[1-0] for direct lens access
      const num = parseInt(e.key);
      if (e.ctrlKey && num >= 1 && num <= 10) {
        e.preventDefault();
        setLens(lenses[num - 1]);
      }
    });
  }

  private setLens(lens: CognitiveLens) {
    $activeLens.set(lens);
    send({ type: 'lens.set', lens });
    this.open = false;
  }

  render() {
    const lensAngles = this.computeAngles();
    return html`
      <div class="radial-menu ${this.open ? 'open' : ''}"
        style="left: ${this.x}px; top: ${this.y}px">
        ${lenses.map((lens, i) => {
          const angle = (i / lenses.length) * 2 * Math.PI - Math.PI / 2;
          const x = 80 * Math.cos(angle);
          const y = 80 * Math.sin(angle);
          return html`
            <div class="segment"
              style="transform: translate(${x}px, ${y}px)"
              @mouseenter=${() => this.hoveredLens = lens}
              @click=${() => this.setLens(lens)}>
              <span class="lens-icon">${lensIcons[lens]}</span>
              <span class="lens-label">${lens}</span>
            </div>
          `;
        })}
      </div>
    `;
  }
}
```

### 4.3 Lens Transition — Smooth Crossfade

When lens switches, graph elements animate color/size transitions:

```typescript
// In belief-graph.ts
$activeLens.subscribe((newLens, oldLens) => {
  this.cy.batch(() => {
    // Animate nodes from old lens encoding to new
    this.cy.nodes().forEach(node => {
      const data = node.data();
      const lensData = data.lensData?.[newLens];
      if (!lensData) {
        node.style('opacity', 0.15);  // Low relevance in this lens
      } else {
        node.style({
          'background-color': lensData.color,
          'width': lensData.size,
          'height': lensData.size,
          'opacity': 0.85 + 0.15 * (lensData.score > 0.8 ? 1 : 0),
          'transition-property': 'background-color, width, height, opacity',
          'transition-duration': '0.3s',
        });
      }
    });
    // Edge opacity follows source node relevance
    this.cy.edges().forEach(edge => {
      const src = edge.source().data('lensData')?.[newLens];
      edge.style('opacity', src ? 0.2 + 0.8 * src.score : 0.05);
    });
  });
});
```

---

## 5. Server Architecture

### 5.1 Projection Engine

```typescript
// server/projection.ts
import { NAR } from '../../../src/nar/nar';
import type { CognitiveLens } from '../shared/protocol';
import { scoreForLens } from './lenses';

export interface ProjectionRequest {
  lens: CognitiveLens;
  focus?: string;
  maxNodes: number;    // hard cap: 300
  maxEdges: number;    // hard cap: 600
  maxHops: number;     // BFS depth: 2
  includeDerivations: boolean;
  includeContradictions: boolean;
}

export function computeProjection(nar: NAR, req: ProjectionRequest) {
  // 1. Score concepts by lens
  const scored = scoreForLens(nar, req.lens, req.focus, req.maxNodes);
  const nodeSet = new Set(scored.map(n => n.id));

  // 2. BFS from focus + top-scored seeds for edges
  const seeds = req.focus && nodeSet.has(req.focus)
    ? [req.focus]
    : scored.slice(0, 50).map(n => n.id);

  const visited = new Set<string>();
  const queue = seeds.map(id => ({ id, depth: 0 }));
  const edgeCandidates: any[] = [];

  while (queue.length > 0 && edgeCandidates.length < req.maxEdges) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const concept = nar.getConcept(id);
    if (!concept || depth >= req.maxHops) continue;
    for (const link of concept.getLinks()) {
      const target = link.concept.term.toString();
      if (!nodeSet.has(target)) continue;
      edgeCandidates.push({
        source: id, target: target,
        weight: link.strength, type: link.type,
      });
      if (!visited.has(target)) queue.push({ id: target, depth: depth + 1 });
    }
  }

  const edges = edgeCandidates.slice(0, req.maxEdges);
  const truncated = nar.listConcepts().length > req.maxNodes;
  const totalHidden = nar.listConcepts().length - scored.length;

  return { nodes: scored, edges, truncated, totalHidden };
}
```

### 5.2 Gateway with Delta Encoding

```typescript
// server/gateway.ts
import { WebSocket } from 'ws';
import { z } from 'zod';
import { IncomingFromClient, CognitiveDelta } from '../shared/protocol';
import { computeProjection } from './projection';

const MAX_BUFFER_BYTES = 1_048_576; // 1 MB
const HEARTBEAT_INTERVAL = 30_000;

export function handleConnection(socket: WebSocket, nar: NAR, agent: Agent) {
  let activeLens = 'belief' as CognitiveLens;
  let focusTerm: string | null = null;
  let lastSeqId = 0;
  const eventBuffer: any[] = [];
  const MAX_BUFFER_SIZE = 1000;

  function send(msg: any) {
    if (socket.bufferedAmount > MAX_BUFFER_BYTES) {
      if (msg.type !== 'chat.agent.stream' && msg.type !== 'chat.agent.complete') return;
    }
    const payload = JSON.stringify(msg);
    socket.send(payload);
    if (msg.type === 'cognitive.delta' || msg.type === 'state.snapshot') {
      const seqMsg = { ...msg, seqId: ++lastSeqId };
      eventBuffer.push(seqMsg);
      if (eventBuffer.length > MAX_BUFFER_SIZE) eventBuffer.shift();
    }
  }

  // On connect: send config + initial projection
  send({ type: 'config.schema', data: buildConfigSchema(nar) });
  sendInitialProjection();

  // Subscribe to engine events
  const unsubs = [
    nar.getSystemEventBus().on('nar:derivation', () => {
      sendProjectionDelta();
    }),
    nar.getSystemEventBus().on('nar:concept:activated', (d) => {
      send({ type: 'cognitive.delta', module: 'working_memory', ops: [
        { action: 'update_node', id: d.term, data: { priority: d.priority } },
      ]});
    }),
    nar.getSystemEventBus().on('nar:reasoning:cycle', (d) => {
      // Derivation updates
    }),
    nar.getSystemEventBus().on('nar:drive:changed', (d) => {
      // Drive/goal updates
    }),
  ];

  function sendInitialProjection() {
    const proj = computeProjection(nar, {
      lens: activeLens, focus: focusTerm,
      maxNodes: 300, maxEdges: 600, maxHops: 2,
      includeDerivations: true, includeContradictions: true,
    });
    send({ type: 'state.snapshot', seqId: lastSeqId, data: proj });
  }

  function sendProjectionDelta() {
    const proj = computeProjection(nar, {
      lens: activeLens, focus: focusTerm,
      maxNodes: 300, maxEdges: 600, maxHops: 2,
      includeDerivations: false, includeContradictions: false,
    });
    // Compute ops by diffing against last sent state
    const ops = computeDeltaOps(lastSentState, proj);
    send({
      type: 'cognitive.delta',
      lens: activeLens,
      ops,
      meta: {
        truncated: proj.truncated,
        totalHidden: proj.totalHidden,
        timestamp: Date.now(),
      },
    });
    lastSentState = proj;
  }

  socket.on('message', async (raw) => {
    try {
      const parsed = IncomingFromClient.safeParse(JSON.parse(raw.toString()));
      if (!parsed.success) {
        send({ type: 'chat.agent.complete', content: `Error: ${parsed.error.message}` });
        return;
      }
      const msg = parsed.data;

      switch (msg.type) {
        case 'chat.user':
          handleChat(msg.content, agent, send);
          break;
        case 'config.set':
          handleConfig(msg.key, msg.value, nar);
          break;
        case 'lens.set':
          activeLens = msg.lens;
          sendInitialProjection();
          break;
        case 'focus.set':
          focusTerm = msg.term;
          sendInitialProjection();
          break;
        case 'intent.declare':
          handleIntent(msg.intent, nar, agent, send);
          break;
        case 'contradiction.resolve':
          handleContradictionResolution(msg.id, msg.strategy, nar);
          break;
        case 'derivation.trace':
          const trace = nar.getDerivationTrace(msg.id);
          send({ type: 'derivation.trace', data: trace });
          break;
        case 'sync.request':
          handleSync(msg.lastSeqId, eventBuffer, send);
          break;
      }
    } catch (e) {
      socket.send(JSON.stringify({ type: 'chat.agent.complete', content: `Error: ${e}` }));
    }
  });

  socket.on('close', () => { for (const u of unsubs) u(); });
}
```

### 5.3 Intent Handler — Reconfiguring the System

```typescript
// server/intent-handler.ts
import type { NAR } from '../../../src/nar/nar';
import type { Agent } from '../../../src/agent/agent';

interface Intent {
  type: 'understand' | 'prove' | 'plan' | 'debug' | 'explore' | 'compare' | 'verify' | 'optimize';
  target: string;
  context?: string[];
  constraints?: any;
}

/**
 * Each intent type reconfigures the NAR's cognitive parameters
 * and spawns appropriate tasks/goals. This is the bridge between
 * user intention and system attention.
 */
export function handleIntent(intent: Intent, nar: NAR, agent: Agent, send: (m: any) => void) {
  switch (intent.type) {
    case 'understand': {
      // 1. Focus attention on the target concept
      const term = nar.parseTerm(intent.target);
      // 2. Activate ProactiveEnricher to find connections
      nar.enableProactiveEnricher?.(true);
      // 3. Spawn questions about related concepts
      nar.inputTask({ term: `(${intent.target} --> ?)`, punctuation: '?' });
      // 4. Generate explanation via LM
      agent.chat(`Explain "${intent.target}" in the context of current knowledge.`, { stream: true });
      // 5. Suggest lens switch
      send({ type: 'lens.suggest', lens: 'belief', reason: `Understanding ${intent.target}` });
      break;
    }

    case 'prove': {
      // 1. Set as goal
      nar.inputTask({
        term: nar.parseTerm(intent.target),
        punctuation: '!',
        truth: { frequency: 1.0, confidence: 0.99 },
        priority: 0.9,
      });
      // 2. Activate focused derivation
      nar.configureStrategies?.({ derivation: { type: 'focused', maxDepth: 20 } });
      // 3. Switch lens to derivation
      send({ type: 'lens.suggest', lens: 'derivation', reason: `Proving ${intent.target}` });
      // 4. Subscribe to derivation events for live progress
      break;
    }

    case 'debug': {
      // 1. Search for contradictions involving target
      const contradictions = nar.getContradictions()
        .filter(c => c.tasks.some(t => t.term.toString().includes(intent.target)));
      if (contradictions.length > 0) {
        // 2. Show conflict map
        send({ type: 'contradiction.report', contradictions });
        // 3. Suggest resolution strategies
        send({
          type: 'chat.agent.complete',
          content: `Found ${contradictions.length} contradictions involving "${intent.target}". ${suggestStrategies(contradictions)}`,
        });
      }
      // 4. Activate BidirectionalFeedback loop
      nar.enableBidirectionalFeedback?.(true);
      break;
    }

    case 'explore': {
      // 1. Set focus
      // 2. Activate SemanticSimilarityEngine
      // 3. Spawn analogy-finding questions
      nar.inputTask({
        term: nar.parseTerm(`(&, ${intent.target}, ?similar)`),
        punctuation: '?',
        priority: 0.8,
      });
      break;
    }

    case 'compare': {
      const [a, b] = [intent.target, intent.context?.[0] ?? ''];
      // 1. Find common ancestors in inheritance hierarchy
      // 2. Compare truth values
      // 3. Generate structural mapping
      send({
        type: 'chat.agent.complete',
        content: `Comparing ${a} and ${b}...`,
        messageId: nanoid(),
      });
      break;
    }

    case 'verify': {
      // 1. Create question task
      nar.inputTask({ term: nar.parseTerm(intent.target), punctuation: '?' });
      // 2. Activate focused derivation
      break;
    }

    case 'optimize': {
      // 1. Set as high-priority goal
      // 2. Activate RLFP framework
      break;
    }
  }
}
```

### 5.4 Checkpointer — Temporal Scrubber Foundation

```typescript
// server/checkpointer.ts
import type { NAR } from '../../../src/nar/nar';

interface Checkpoint {
  cycle: number;
  timestamp: number;
  state: CompressedState;  // Just diffs: top concepts, active derivations, contradictions
  userMessages: number[];  // Message indices at sync points
}

class Checkpointer {
  private checkpoints: Checkpoint[] = [];
  private readonly INTERVAL = 10;  // Every 10 cognitive cycles
  private cycleCount = 0;

  onCognitiveCycle(nar: NAR) {
    this.cycleCount++;
    if (this.cycleCount % this.INTERVAL !== 0) return;

    this.checkpoints.push({
      cycle: this.cycleCount,
      timestamp: Date.now(),
      state: this.compress(nar),
      userMessages: [],
    });

    // Keep last 1000 checkpoints (10,000 cycles = ~28 hours at 10Hz)
    if (this.checkpoints.length > 1000) this.checkpoints.shift();
  }

  /**
   * Distance = 0 (now), -1 (1 interval ago), -10, etc.
   * Returns null if too far back.
   */
  getCheckpoint(distance: number): Checkpoint | null {
    const idx = this.checkpoints.length - 1 + distance;
    return this.checkpoints[idx] ?? null;
  }

  private compress(nar: NAR): CompressedState {
    const concepts = nar.listConcepts();
    const topN = concepts
      .sort((a, b) => b.budget.priority - a.budget.priority)
      .slice(0, 100);

    return {
      concepts: topN.map(c => ({
        term: c.term.toString(),
        priority: c.budget.priority,
        truth: c.truth,
      })),
      derivations: nar.getRecentDerivations(50).map(d => ({
        id: d.id,
        premiseTerms: d.premises,
        conclusionTerm: d.conclusion,
        ruleName: d.ruleName,
      })),
      contradictions: nar.getContradictions().map(c => ({
        id: c.id,
        severity: c.severity,
        status: c.status,
      })),
      cycle: this.cycleCount,
    };
  }
}
```

### 5.5 Temporal Scrubber — Client Ghost Overlay

```typescript
// client/components/temporal-scrub.ts
@customElement('temporal-scrubber')
export class TemporalScrubber extends LitElement {
  @state() private position = 0;  // 0 = now, -1 = 1 checkpoint ago
  @state() private ghostVisible = false;
  @state() private maxDistance = -100;

  private scrubTimeline: CanvasRenderingContext2D | null = null;

  connectedCallback() {
    // Listen for events from server
    wsClient.on('state.snapshot', (msg) => {
      this.updateTimeline(msg);
    });
  }

  private onScrub(position: number) {
    this.position = position;
    $scrubPosition.set(position);
    
    // Request ghost state from server
    send({ type: 'scrubber.set', position });
    
    // Apply ghost overlay to graph
    this.dispatchEvent(new CustomEvent('ghost-update', {
      detail: { position },
      bubbles: true,
    }));
  }

  render() {
    const canvasWidth = this.clientWidth;
    const markers = this.generateMarkers();

    return html`
      <div class="scrubber-bar">
        <button @click=${() => this.onScrub(this.position - 1)}>◀</button>
        <button @click=${() => this.onScrub(0)}>▶</button>
        <input type="range" 
          min=${this.maxDistance} max="0" step="1"
          .value=${this.position}
          @input=${(e) => this.onScrub(parseInt(e.target.value))} />
        <span>${this.position === 0 ? 'now' : `${this.position} cycles`}</span>
      </div>
      <div class="timeline-canvas">
        <canvas ref=${(el) => this.renderTimeline(el)}></canvas>
      </div>
    `;
  }

  private renderTimeline(canvas: HTMLCanvasElement) {
    if (!canvas || !this.timelineData) return;
    const ctx = canvas.getContext('2d')!;
    const data = this.timelineData;
    const w = canvas.width, h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    
    // Draw derivation activity spikes
    ctx.fillStyle = 'var(--accent-cyan)';
    for (let i = 0; i < data.length; i++) {
      const hz = data[i].reasoningHz ?? 0;
      const barH = (hz / 100) * h;
      ctx.fillRect(i, h - barH, 1, barH);
    }

    // User message markers
    ctx.fillStyle = 'var(--accent-amber)';
    for (const idx of this.userMessageIndices) {
      ctx.fillRect(idx, 0, 2, h);
    }

    // Contradiction markers
    ctx.fillStyle = 'var(--accent-magenta)';
    for (const idx of this.contradictionIndices) {
      ctx.beginPath();
      ctx.arc(idx, h / 2, 3, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Current position indicator
    const posX = ((this.position - this.maxDistance) / Math.abs(this.maxDistance)) * w;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(posX, 0);
    ctx.lineTo(posX, h);
    ctx.stroke();
  }
}
```

**Ghost overlay in belief-graph:**

```typescript
// belief-graph.ts — ghost state rendering
private applyGhost(ghostState: CompressedState) {
  if (!ghostState) {
    // Remove ghosts
    this.cy.getElementById('ghost-*').remove();
    return;
  }

  this.cy.batch(() => {
    // Remove previous ghosts
    this.cy.elements('.ghost').remove();

    // Add ghost layer: semi-transparent, slightly displaced, amber tint
    for (const gc of ghostState.concepts) {
      const current = this.cy.getElementById(gc.term);
      if (current.length) {
        // Ghost shadow — shows where the node WAS
        const ghost = this.cy.add({
          group: 'nodes',
          data: {
            id: `ghost-${gc.term}`,
            parent: gc.term,         // Links to current node
            label: '',
          },
          classes: 'ghost',
        });
        ghost.style({
          'background-color': 'rgba(255, 176, 0, 0.2)',
          'width': gc.priority * 40,
          'height': gc.priority * 40,
          'border-color': 'rgba(255, 176, 0, 0.4)',
          'border-width': 2,
          'opacity': 0.3 + 0.3 * Math.abs($scrubPosition.get()) / 100,
          'z-index': -1,
        });
        // Position: slightly offset from current position
        const currentPos = current.position();
        ghost.position({
          x: currentPos.x + 10 * Math.sign($scrubPosition.get()),
          y: currentPos.y + 10,
        });
      } else {
        // Node didn't exist in past but does now — "growing" animation
        this.cy.getElementById(gc.term).style('opacity', 0.2);
      }
    }

    // Ghost edges
    for (const gd of ghostState.derivations) {
      // Render as thin, amber dashed lines
      this.cy.add({
        group: 'edges',
        data: { source: gd.premiseTerms[0], target: gd.conclusionTerm, label: gd.ruleName },
        classes: 'ghost-edge',
      });
    }
  });
}
```

---

## 6. Contradiction Resolution Dialogue

When contradictions are detected, the UI becomes a **mediation interface**:

```typescript
// client/components/contradiction-dialogue.ts
@customElement('contradiction-dialogue')
export class ContradictionDialogue extends LitElement {
  @state() private contradictions: Contradiction[] = [];
  @state() private activeContradiction: Contradiction | null = null;
  @state() private resolutionProgress = '';

  connectedCallback() {
    // Subscribe to contradiction updates
    wsClient.on('contradiction.report', (msg) => {
      this.contradictions = msg.contradictions;
      if (this.contradictions.length > 0) this.activeContradiction = this.contradictions[0];
      this.requestUpdate();
    });
    // Also check periodic cognitive deltas
    wsClient.on('cognitive.delta', (msg) => {
      if (msg.contradictions) {
        for (const ct of msg.contradictions) {
          this.upsertContradiction(ct);
        }
        this.requestUpdate();
      }
    });
  }

  private resolve(strategy: string) {
    if (!this.activeContradiction) return;
    this.resolutionProgress = `Applying ${strategy}...`;
    send({
      type: 'contradiction.resolve',
      id: this.activeContradiction.id,
      strategy,
    });
  }

  render() {
    if (this.contradictions.length === 0) return html``;

    return html`
      <div class="dialog">
        <div class="header">
          <span class="icon">⚠</span>
          <span>${this.contradictions.length} Contradiction${this.contradictions.length > 1 ? 's' : ''}</span>
        </div>

        ${this.activeContradiction ? html`
          <div class="conflict-panel">
            <div class="belief-a">
              <div class="term">${this.activeContradiction.tasks[0]?.term}</div>
              <div class="truth">f:${this.activeContradiction.tasks[0]?.truth?.frequency?.toFixed(2)} 
                c:${this.activeContradiction.tasks[0]?.truth?.confidence?.toFixed(2)}</div>
            </div>
            <div class="vs">↔</div>
            <div class="belief-b">
              <div class="term">${this.activeContradiction.tasks[1]?.term}</div>
              <div class="truth">f:${this.activeContradiction.tasks[1]?.truth?.frequency?.toFixed(2)}
                c:${this.activeContradiction.tasks[1]?.truth?.confidence?.toFixed(2)}</div>
            </div>
          </div>

          <div class="strategies">
            <button @click=${() => this.resolve('bayesian')}>Bayesian Revision</button>
            <button @click=${() => this.resolve('contextual')}>Contextual</button>
            <button @click=${() => this.resolve('evidence-gathering')}>Gather Evidence</button>
            <button @click=${() => this.resolve('temporal')}>Temporal Analysis</button>
            <button @click=${() => this.resolve('priority')}>Priority-Based</button>
          </div>

          <div class="strategy-info">
            ${this.renderStrategyHelp()}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderStrategyHelp() {
    return html`
      <p><strong>Bayesian Revision:</strong> Statistically update truth values based on evidence strength.
      Recommended when both beliefs have comparable support.</p>
      <p><strong>Contextual:</strong> Resolve by identifying context boundaries where each belief holds.
      Use when beliefs are context-dependent.</p>
      <p><strong>Gather Evidence:</strong> Generate questions to collect more information.
      Use when insufficient evidence exists.</p>
    `;
  }
}
```

---

## 7. Complete Module Exposure Map

### 7.1 Memory System (Dual-Store Hypergraph)

| Module | UI Component | Control Surface | SeNARS API |
|--------|-------------|-----------------|------------|
| **Focus Set** | `attention-radar` — animated priority bubbles, top-50 concepts | Slider: capacity (50-500); Toggle: show decay trails | `nar.listConcepts()` sorted by priority |
| **Archive** | `knowledge-vault` — searchable, filterable, paginated | Button: force consolidation; Slider: archive threshold (0.1-0.9) | `nar.getArchiveConcepts()` |
| **Link Manager** | `link-inspector` — edge type filter (semantic/term/similarity) | Slider: link decay rate (0.001-0.1); Toggle: auto-prune | `concept.getLinks()` |
| **Forgetting Policy** | `memory-pressure` — gauge 0-100% with color coding | Dropdown: FIFO/Priority/LRU; Button: trigger compaction | `nar.getMemoryPressure()`, `nar.compact()` |
| **Consolidation** | `consolidation-log` — live feed of abstracted concepts | Slider: interval (5-100 cycles); Toggle: LM-assisted | `nar.consolidate()` |
| **Serialization** | `export-import` — format selector with scope picker | Format: JSON/MsgPack/GraphML; Scope: focus/archive/full | `nar.exportState()`, `nar.importState()` |

### 7.2 Reasoning Engine (50+ NAL Rules)

| Module | UI Component | Control Surface | SeNARS API |
|--------|-------------|-----------------|------------|
| **Rule Registry** | `inference-palette` — rule cards with live usage frequency | Toggle rules on/off; Drag to reorder priority | `nar.getAvailableRules()` |
| **Derivation Engine** | `reasoning-oscilloscope` — Hz gauge, depth counter, CPU gauge | Slider: max depth (1-20); Slider: deriv/step (100-10000) | `nar.getMetrics()` |
| **Truth Revision** | `belief-dynamics` — animated scatter plot (freq vs conf) | Toggle: Bayesian vs NARS revision | `nar.getBeliefs()` |
| **Circular Detection** | `loop-detector` — highlights cycles in derivation graph | Slider: sensitivity (0.1-1.0); Toggle: auto-break | `nar.getCircularDerivations()` |
| **Trace Collection** | `proof-explorer` — interactive derivation tree | Export: JSON/GraphViz/LaTeX; Filter by rule | `nar.getDerivationTrace(id)` |

### 7.3 Neuro-Symbolic Bridge (LM Services)

| Service | UI Component | Control Surface | SeNARS API |
|---------|-------------|-----------------|------------|
| **ProactiveEnricher** | `insight-feed` — live cards: "Discovered connection X↔Y" | Toggle: auto-enrich; Slider: threshold (0.3-0.9); Domain filter | `nar.getRecentEnrichments()` |
| **BidirectionalFeedback** | `validation-panel` — hypothesis ↔ symbolic verification | Button: validate selection; Slider: strictness (0-1) | `nar.validateHypothesis()` |
| **LMRule Services** | `rule-marketplace` — installed LM rules | Install/remove; Config per rule (model, temp, prompt) | `nar.getLMRules()`, `nar.configureLMRule()` |
| **HypothesisGenerator** | `hypothesis-button` — "Generate hypotheses" on any concept | Slider: count (1-10); Temp (0-2); Domain context | `nar.generateHypotheses(term, count)` |
| **PlanRepairer** | `plan-doctor` — appears on failed plans | Toggle: auto-repair; Slider: risk tolerance | `nar.repairPlan(planId, risk)` |
| **ExplanationGenerator** | `narrate-button` on any derivation | Audience: expert/layperson/child; Detail: brief/full | `nar.explain(trace, audience)` |
| **SemanticSimilarity** | `analogy-finder` — drag concept → similar concepts | Slider: threshold; Toggle: cross-domain | `nar.findAnalogies(term)` |
| **NLP Processor** | `narsese-translator` — bidirectional NL ↔ Narsese | Toggle: auto-translate; Language selector | `nar.parseNL(text)`, `nar.toNL(narsese)` |

### 7.4 Cognitive Cycle (7-Phase)

| Phase | UI Component | Control Surface | SeNARS API |
|-------|-------------|-----------------|------------|
| **1. Perception** | `input-stream` — live task ingestion with type badges | Pause/Step/Resume; Filter by punctuation | `cycle.getInputQueue()` |
| **2. Prioritization** | `attention-economy` — animated priority bars | Strategy: priority/novelty/goal-biased/diverse | `cycle.getPriorityDistribution()` |
| **3. Meta-Cognition** | `self-monitor` — contradiction alerts, quality metrics | Threshold sliders; Auto-repair toggle | `nar.getCognitiveQuality()` |
| **4. Symbolic Reasoning** | `inference-radar` — live rule firing events | Rule filter; Speed control; Focus concept | `cycle.getRecentFirings()` |
| **5. Neural Enrichment** | `lm-activity` — service calls with latency/cost | Budget slider; Provider selector | `cycle.getLMServiceActivity()` |
| **6. Planning** | `plan-canvas` — HTN decomposition tree | Planner: HTN/A*/Temporal; Step-through | `nar.getActivePlans()` |
| **7. Learning** | `integration-log` — revision/consolidation/RLFP | RLFP toggle; Learning rate slider | `cycle.getConsolidationEvents()` |

### 7.5 Meta-Cognition

| Module | UI Component | Control Surface | SeNARS API |
|--------|-------------|-----------------|------------|
| **Contradiction Detection** | `conflict-map` — graph of contradictions by severity | Detection layers toggle; Resolution strategy selector | `nar.getContradictions()` |
| **ReasoningAboutReasoning** | `cognitive-dashboard` — coherence/consistency/goal progress | Quality threshold; Self-correction sensitivity | `nar.getCognitiveMetrics()` |
| **CognitiveController** | `strategy-heatmap` — live strategy effectiveness | Auto-adapt toggle; Exploration vs exploitation | `nar.getStrategyEffectiveness()` |
| **RLFP** | `learning-curve` — reward model, policy loss, trajectory log | Enable RLFP; Reward weights (4 sliders); Trajectory export | `rlfp.getMetrics()` |

### 7.6 Agent Layer

| Capability | UI Component | Control Surface | SeNARS API |
|------------|-------------|-----------------|------------|
| **Transports** | `connection-matrix` — IRC/WS/HTTP/MCP/CLI status cards | Enable/disable per transport; Config popovers | `connectionManager.getStatus()` |
| **Sessions** | `conversation-manager` — session tree with context previews | Fork/merge sessions; Context window slider (1k-100k tokens) | `sessionManager.listSessions()` |
| **Autonomy** | `autonomy-dial` — perceive→reason→act→reflect loop visual | Drive editor (curiosity/competence/efficiency); Autonomy 0-100% | `autonomyEngine.getState()` |
| **Tools** | `tool-registry` — installed tools with approval chains | Approve/revoke; Rate limit slider; Sandbox toggle | `toolManager.listTools()` |
| **Observability** | `telemetry-wall` — structured logs, metrics, traces | Log level; Sampling rate; Export endpoint config | `nar.getLogs()`, `nar.getMetrics()` |

---

## 8. Migration Path from Current UI (Phased)

Every step is independently deployable and additive.

| Step | Change | Files | Verifiable Outcome |
|------|--------|-------|-------------------|
| **1** | Add `CognitiveMessage` type with graph metadata | `shared/protocol.ts` | Protocol backwards-compatible; existing components unchanged |
| **2** | Server: projection engine + lens scorers | New: `server/projection.ts`, `server/lenses.ts` | Server returns lens-scored projections; old clients ignore new fields |
| **3** | Server: gateway with delta encoding + sequence IDs | `server/gateway.ts` | Reduced bandwidth; reconnection handshake works |
| **4** | Server: checkpointer for temporal scrubber | New: `server/checkpointer.ts` | Time-travel queries return valid checkpoints |
| **5** | Server: intent handler | New: `server/intent-handler.ts` | Intent commands reconfigure NAR parameters |
| **6** | Client: computed stores for lens views | `client/core/store.ts` | Lens switching is a store write; components react |
| **7** | Client: concept-thread component | New: `client/components/concept-thread.ts` | Click node → see all messages referencing it |
| **8** | Client: lens-selector radial dial | New: `client/components/lens-selector.ts` | Right-click + flick switches lens; graph re-renders |
| **9** | Client: temporal-scrub component | New: `client/components/temporal-scrub.ts` | Scrub bar navigates past states; ghost overlay on graph |
| **10** | Client: contradiction-dialogue | New: `client/components/contradiction-dialogue.ts` | Contradiction detected → mediated resolution dialogue |
| **11** | Client: intent-composer | New: `client/components/intent-composer.ts` | NL intent → structured command → system reconfigures |
| **12** | Client: ghost overlay in belief-graph | `client/components/belief-graph.ts` | Temporal scrub shows semi-transparent past state |
| **13** | Client: wire chat-console click → `$selectedMessageId` | `client/components/chat-console.ts` | Click message → graph centers on it → concept thread opens |
| **14** | Update layout to fusion layout | `client/components/app-layout.ts` | Responsive grid: graph | concept-thread | config |
| **15** | E2E tests for fusion interactions | `tests/scenarios/cognitive/fusion.spec.ts` | Scenarios pass for message↔node, click↔center, lens switch |
| **16** | Module components (all 35+) | 35+ new component files | Every cognitive module has a UI face |

---

## 9. Key Type Definitions (Reference)

```typescript
// Core cognitive types (aligned with SeNARS engine)
interface Term { toString(): string; hash: string; type: TermType; }
interface TruthValue { frequency: number; confidence: number; }
interface Task { term: Term; punctuation: '.'|'!'|'?'; truth: TruthValue; budget: { priority: number; durability: number; }; }
interface Concept { term: Term; truth: TruthValue; budget: { priority: number; durability: number; }; links: ConceptLink[]; }
interface ConceptLink { target: Term; strength: number; type: 'semantic'|'term'|'similarity'; }
interface DerivationChain { id: string; premises: Term[]; conclusion: Task; ruleName: string; steps: DerivationStep[]; }
interface Contradiction { id: string; tasks: Task[]; severity: number; status: 'open'|'resolving'|'resolved'; timestamp: number; }
interface CognitiveMetrics { reasoningHz: number; quality: number; coherence: number; memoryPressure: number; }

// UI-specific
type CognitiveLens = 'belief'|'goal'|'question'|'contradiction'|'derivation'|'analogy'|'temporal'|'meta'|'neural'|'resource';

interface GraphNode {
  id: string;
  term: string;
  truth: { frequency: number; confidence: number; };
  priority: number;
  punctuation?: '.'|'!'|'?';
  lensData: Partial<Record<CognitiveLens, { score: number; color: string; size: number; }>>;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: 'semantic'|'term'|'similarity'|'inference';
  label?: string;
}

interface CognitiveMessage {
  id: string;
  role: 'user'|'agent'|'system';
  content: string;
  timestamp: number;
  term: string;
  truth?: { frequency: number; confidence: number; };
  punctuation?: '.'|'!'|'?';
  derivationId?: string;
  contradictionIds?: string[];
  supports: string[];
  contradicts: string[];
  derivesFrom: string[];
  triggers: string[];
  lensData?: Partial<Record<CognitiveLens, { score: number; }>>;
}

interface Intent {
  type: 'understand'|'prove'|'plan'|'debug'|'explore'|'compare'|'verify'|'optimize';
  target: string;
  context?: string[];
  constraints?: Record<string, any>;
}
```

---

## 10. Performance Budget

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Lens switch latency** | <300ms from user gesture to full re-render | `performance.now()` at lens.set → graph layout stable |
| **Graph frame rate** | 60fps during steady state; ≥30fps during 50 ops/sec storm | `requestAnimationFrame` delta tracking |
| **Chat latency** | <200ms from user Send to first stream token | WS round-trip |
| **WS throughput** | 1000 updates/sec per connection without backpressure drops | Server-side buffer monitoring |
| **Reconnection** | <5s from drop to consistent state (1000 event buffer) | E2E test |
| **Memory** | <100MB DOM growth over 1hr continuous use | DOM node count proxy |
| **Server CPU** | <80% at 100 concurrent WS connections | Process monitoring |
| **Initial load** | <2s to interactive (TTI) | Lighthouse |

---

## 11. Testing Strategy

| Layer | Tool | What It Tests |
|-------|------|--------------|
| **Contract** | Zod `safeParse` on generated payloads | Every WS message type validates correctly |
| **Unit** | Vitest | Lens scorers (pure functions), store bindings, delta computation |
| **E2E** | Playwright + `mock-socket` | Full user flows: message↔graph sync, lens switch, scrubber, contradiction resolution |
| **Performance** | Playwright perf monitor | Frame times, DOM growth, reconnection speed |
| **Load** | k6 | 1000 concurrent WS connections, sustained throughput |
| **Cross-browser** | Playwright (Chromium + Firefox + WebKit) | Consistent behavior across engines |

**Key E2E scenario:**
```
Given: the app is loaded and connected
When: I send a message "Why can't penguins fly?"
Then: the message appears as a chat bubble AND as a graph node
And: clicking the message centers the graph on its node
And: clicking the node opens the concept thread panel
And: switching to 'contradiction' lens shows conflicting beliefs about flight
And: clicking a contradiction opens the resolution dialogue
And: choosing "Evidence Gathering" spawns a new question task in the 'goal' lens
And: the temporal scrubber shows all these events on the timeline
When: I scrub to -50 cycles
Then: ghost overlay shows the belief state before the conversation
And: scrubbing back to 0 restores full color
```

---

**This document is the north star. Every implementation decision traces back here.**
**The fusion is not a feature — it's the architecture.**
**The cognitive modules are not exposed — they're *inhabited*.**
**The user doesn't use the system — they *think with* it.**
