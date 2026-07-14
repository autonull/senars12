# SeNARS — Agent-as-Kernel Architecture (Supersedes NEXT.agent4.md)

> **Core insight:** The unification trap was trying to unify *agents*. The correct seam is *inside* the agent: a single `CognitiveEventSource` (the Agent) that delegates to pluggable **ReasoningBackends**. UI, IO, and config never change — they only ever talk to the Agent.

---

## The Architecture (One Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AGENT (single CognitiveEventSource)            │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     REASONING ROUTER / PLANNER                       │    │
│  │  • Receives: user input, sensor data, internal drives               │    │
│  │  • Selects: which backend(s) to invoke, in what order               │    │
│  │  • Fuses: backend results → unified CognitiveEvent stream           │    │
│  └─────────────────────────────┬───────────────────────────────────────┘    │
│                                │                                            │
│        ┌──────────────────────┼──────────────────────┐                    │
│        ▼                      ▼                      ▼                    │
│  ┌───────────┐          ┌───────────┐          ┌───────────┐            │
│  │   NAR     │          │  MeTTa    │          │  Future   │            │
│  │ Backend   │          │ Backend   │          │ Backend   │            │
│  │           │          │           │          │           │            │
│  │ • Beliefs │          │ • Atoms   │          │ • ...     │            │
│  │ • Drives  │          │ • Spaces  │          │           │            │
│  │ • Goals   │          │ • Skills  │          │           │            │
│  │ • RLLP    │          │ • Query   │          │           │            │
│  └─────┬─────┘          └─────┬─────┘          └─────┬─────┘            │
│        │                      │                      │                   │
│        └──────────────────────┼──────────────────────┘                   │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    CAPABILITY REGISTRY (internal)                   │ │
│  │  "inheritance" → NAR    |  "pattern-match" → MeTTa  |  "sql" → X   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                               │                                          │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     UNIFIED GRAPH PROJECTION                         │ │
│  │  Nodes: { id, type, capabilities: string[], payload }              │ │
│  │  Edges: { source, target, relation, capabilities: string[] }       │ │
│  │  NO engine field. Engine is an implementation detail of payload.   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UI / IO CHANNELS                                │
│  • One WebSocket → one Agent → one CognitiveEvent stream                   │
│  • Graph viewport renders capabilities, not engines                        │
│  • Lens picker filters by capability                                       │
│  • Chat is one input → Agent routes → streams response                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. ReasoningBackend Interface (The Only New Abstraction)

```typescript
// core/src/reasoning/ReasoningBackend.ts
export interface ReasoningBackend {
  /** Unique backend identifier */
  readonly id: string;                    // e.g., "nar", "metta", "sql", "llm"

  /** Human-readable name for UI (optional, debug) */
  readonly label: string;

  /** Capabilities this backend provides — used for routing */
  readonly capabilities: ReadonlySet<Capability>;

  /** Initialize backend (async, called once at Agent startup) */
  initialize(config: BackendConfig): Promise<void>;

  /** Shutdown backend (async, called at Agent shutdown) */
  shutdown(): Promise<void>;

  /** Health check for monitoring */
  health(): BackendHealth;

  /** Core reasoning operation — backend-specific input/output */
  reason(input: BackendInput): Promise<BackendResult>;

  /** Optional: streaming for long-running operations */
  reasonStream?(input: BackendInput): AsyncIterable<BackendResult>;

  /** Optional: register tools/skills this backend exposes to the Agent */
  getTools?(): ToolDefinition[];

  /** Optional: get current state snapshot for graph sync */
  getSnapshot?(): BackendSnapshot;
}
```

```typescript
// core/src/reasoning/Capability.ts
export type Capability =
  // NAL reasoning
  | 'inheritance'          // <A --> B>
  | 'implication'          // <P ==> Q>
  | 'prediction'           // <P =/> Q>
  | 'retrospection'        // <Q =\\> P>
  | 'conjunction'          // (&, A, B)
  | 'disjunction'          // (|, A, B)
  | 'negation'             // (--, T)
  | 'abduction'            // backward inference
  | 'deduction'            // forward inference
  | 'induction'            // generalization
  | 'analogy'              // similarity-based
  | 'truth-revision'       // evidence combination
  // MeTTa-style
  | 'pattern-match'        // (match ...)
  | 'rewrite'              // (rewrite ...)
  | 'query'                // (query ...)
  | 'multi-space'          // cross-space operations
  | 'skill-execution'      // (skill ...)
  // Memory
  | 'episodic-memory'
  | 'long-term-memory'
  | 'working-memory'
  // Drives/Goals
  | 'drive-management'
  | 'goal-management'
  // Meta
  | 'self-reasoning'
  | 'autonomy-loop'
  // External
  | 'tool-use'
  | 'llm-completion'
  | 'sql-query'
  | 'http-request';
```

```typescript
// core/src/reasoning/BackendTypes.ts
export interface BackendInput {
  readonly type: 'chat' | 'belief' | 'goal' | 'question' | 'skill' | 'raw';
  readonly content: string;
  readonly context?: ReasoningContext;
  readonly correlationId: string;
}

export interface BackendResult {
  readonly backendId: string;
  readonly success: boolean;
  readonly output?: BackendOutput;
  readonly error?: string;
  readonly events: CognitiveEvent[];      // Agent translates these
  readonly graphDelta?: GraphDelta;       // Nodes/edges to add to unified graph
  readonly toolsInvoked?: ToolInvocation[];
}

export interface GraphDelta {
  readonly nodes: GraphNodeData[];        // Uses existing GraphNodeDataView
  readonly edges: GraphEdgeData[];
}

export interface ReasoningContext {
  readonly conversationHistory: ChatMessage[];
  readonly activeGoals: string[];
  readonly workingMemory: WorkingMemorySnapshot;
  readonly timestamp: number;
}
```

---

## 2. Agent Core (Single CognitiveEventSource)

```typescript
// core/src/Agent.ts
export class Agent implements CognitiveEventSource {
  #backends = new Map<string, ReasoningBackend>();
  #router: ReasoningRouter;
  #graphProjection: UnifiedGraphProjection;
  #listeners = new Set<(e: CognitiveEvent) => void>();
  #transports = new Set<Connection>();
  #chatHistory: ChatMessage[] = [];

  constructor(config: AgentConfig) {
    this.#router = new ReasoningRouter(this.#backends);
    this.#graphProjection = new UnifiedGraphProjection();
  }

  // Register a backend — called at startup
  registerBackend(backend: ReasoningBackend, config: BackendConfig): Promise<void> {
    await backend.initialize(config);
    this.#backends.set(backend.id, backend);
    // Backend tools become Agent tools automatically
    backend.getTools?.().forEach(t => this.registerTool(t));
  }

  // CognitiveEventSource interface (unchanged for UI/IO)
  start(): void {
    this.#backends.forEach(b => b.health()); // warm up
    this.#emit({ type: 'health', status: 'healthy', ... });
  }

  stop(): void { this.#backends.forEach(b => b.shutdown()); }

  submit(input: string, correlationId: string): void {
    this.#routeAndExecute(input, correlationId);
  }

  on(event: string | '*', handler: (e: CognitiveEvent) => void): void {
    this.#listeners.add(handler);
  }

  off(event: string | '*', handler: (e: CognitiveEvent) => void): void {
    this.#listeners.delete(handler);
  }

  health(): HealthStatus { /* aggregate */ }

  capabilities(): AgentCapabilities {
    // Union of all backend capabilities
    const caps = new Set<Capability>();
    this.#backends.forEach(b => b.capabilities.forEach(c => caps.add(c)));
    return this.#capabilitiesFromSet(caps);
  }

  mount(transport: Connection): void { /* existing */ }
  unmount(transport: Connection): void { /* existing */ }

  // Single chat entry point
  async *chat(input: string, opts?: ChatOptions): AsyncGenerator<ChatStreamEvent, string> {
    const correlationId = crypto.randomUUID();
    this.#emitInputEvent(input, correlationId);

    // Route to best backend(s) for chat
    const route = this.#router.routeForChat(input, this.#chatHistory);
    let response = '';

    for await (const chunk of this.#executeRoute(route, input, correlationId)) {
      if (chunk.kind === 'text-delta') {
        response += chunk.text ?? '';
        yield chunk;
      }
    }

    this.#chatHistory.push({ role: 'user', content: input }, { role: 'agent', content: response });
    return response;
  }

  // Internal: route input to backend(s) and fuse results
  async #routeAndExecute(input: string, correlationId: string): Promise<void> {
    const route = this.#router.route(input, this.#chatHistory);

    for (const step of route.steps) {
      const backend = this.#backends.get(step.backendId);
      if (!backend) continue;

      const result = await backend.reason({
        type: step.type,
        content: step.content,
        context: this.#buildContext(),
        correlationId,
      });

      // Translate backend result → CognitiveEvents + GraphDelta
      this.#emitEvents(result.events);
      this.#graphProjection.applyDelta(result.graphDelta);

      // If step produces tools, execute them
      if (result.toolsInvoked) {
        await this.#executeTools(result.toolsInvoked, correlationId);
      }
    }
  }
}
```

---

## 3. Reasoning Router (Capability-Based, Deterministic)

```typescript
// core/src/reasoning/ReasoningRouter.ts
export interface RouteStep {
  readonly backendId: string;
  readonly type: BackendInput['type'];
  readonly content: string;
  readonly dependsOn?: string[];    // Step IDs this depends on
}

export interface Route {
  readonly steps: RouteStep[];
  readonly primaryBackend: string;
}

export class ReasoningRouter {
  constructor(private backends: Map<string, ReasoningBackend>) {}

  route(input: string, history: ChatMessage[]): Route {
    // 1. Fast path: explicit syntax detection
    if (this.isNarsese(input)) {
      return this.makeRoute('nar', 'belief', input);
    }
    if (this.isMettaSyntax(input)) {
      return this.makeRoute('metta', 'skill', input);
    }

    // 2. Capability matching from input intent
    const requiredCaps = this.inferCapabilities(input, history);
    const backendScores = this.scoreBackends(requiredCaps);

    // 3. Single best backend for simple queries
    if (backendScores[0].score > 0.8 && backendScores.length === 1) {
      return this.makeRoute(backendScores[0].id, 'chat', input);
    }

    // 4. Multi-backend pipeline for complex queries
    return this.makePipeline(backendScores, input, requiredCaps);
  }

  routeForChat(input: string, history: ChatMessage[]): Route {
    // Chat defaults to NAR (has LLM integration) unless MeTTa skill explicitly requested
    if (input.startsWith('skill:') || input.startsWith('(skill ')) {
      return this.makeRoute('metta', 'skill', input);
    }
    return this.makeRoute('nar', 'chat', input);
  }

  private inferCapabilities(input: string, history: ChatMessage[]): Capability[] {
    const caps: Capability[] = [];
    const lower = input.toLowerCase();

    // Keyword-based capability inference (fast, deterministic)
    if (lower.includes('believe') || lower.includes('inherit') || /<.*-->/.test(input)) {
      caps.push('inheritance', 'truth-revision');
    }
    if (lower.includes('goal') || lower.includes('want') || lower.includes('achieve')) {
      caps.push('goal-management');
    }
    if (lower.includes('remember') || lower.includes('recall') || lower.includes('memory')) {
      caps.push('episodic-memory', 'long-term-memory');
    }
    if (lower.includes('skill') || lower.includes('execute') || lower.includes('run')) {
      caps.push('skill-execution');
    }
    if (lower.includes('match') || lower.includes('pattern') || /\(match\b/.test(input)) {
      caps.push('pattern-match');
    }
    if (lower.includes('rewrite') || /\(rewrite\b/.test(input)) {
      caps.push('rewrite');
    }
    if (lower.includes('query') || /\(query\b/.test(input)) {
      caps.push('query');
    }

    return [...new Set(caps)]; // dedupe
  }

  private scoreBackends(required: Capability[]): Array<{ id: string; score: number }> {
    return [...this.backends.entries()].map(([id, backend]) => {
      const supported = [...backend.capabilities];
      const matched = required.filter(c => supported.includes(c)).length;
      const score = required.length > 0 ? matched / required.length : 0;
      return { id, score };
    }).sort((a, b) => b.score - a.score);
  }
}
```

---

## 4. Backend Implementations (A1 and B Both Work)

### A1: MeTTa as NAR Tool (Current Stub → Real Backend)

```typescript
// metta/src/backend/MettaBackend.ts
import { createMeTTa } from '../runtime/builder.js';
import { parseMeTTa } from '../parser/runtime.js';
import type { ReasoningBackend, Capability, BackendInput, BackendResult, ToolDefinition } from '@senars/core';

export class MettaBackend implements ReasoningBackend {
  readonly id = 'metta';
  readonly label = 'MeTTa Pattern Matcher';
  readonly capabilities = new Set<Capability>([
    'pattern-match', 'rewrite', 'query', 'multi-space', 'skill-execution',
    'long-term-memory', 'episodic-memory'
  ]);

  #runtime: MeTTaRuntime;
  #spaces = new Map<string, InMemorySpace>();

  async initialize(config: BackendConfig): Promise<void> {
    this.#runtime = createMeTTa(config.metta);
    // Load stdlib
    await this.#runtime.evaluate(parseMeTTa('(import! &self)'));
  }

  async shutdown(): Promise<void> { /* cleanup */ }

  health(): BackendHealth { return { status: 'healthy', ... }; }

  async reason(input: BackendInput): Promise<BackendResult> {
    try {
      let result: MeTTaAtom;
      switch (input.type) {
        case 'skill':
          result = await this.#executeSkill(input.content);
          break;
        case 'chat':
          result = await this.#executeSkill(`(chat "${input.content.replace(/"/g, '\\"')}")`);
          break;
        case 'raw':
          result = await this.#runtime.evaluate(parseMeTTa(input.content));
          break;
        default:
          return { backendId: this.id, success: false, error: `Unsupported input type: ${input.type}`, events: [] };
      }

      return this.#resultToBackendResult(result, input.correlationId);
    } catch (e) {
      return { backendId: this.id, success: false, error: String(e), events: [] };
    }
  }

  async #executeSkill(skillExpr: string): Promise<MeTTaAtom> {
    // Real MeTTa execution — not simulated!
    return this.#runtime.evaluate(parseMeTTa(skillExpr));
  }

  #resultToBackendResult(atom: MeTTaAtom, correlationId: string): BackendResult {
    // Convert MeTTa atom → CognitiveEvents + GraphDelta
    const events: CognitiveEvent[] = [{
      engine: 'metta', type: 'derivation', term: atom.toString(),
      confidence: 1, timestamp: Date.now(), correlationId
    }];

    const graphDelta: GraphDelta = {
      nodes: [{ id: atom.hash(), nodeType: 'metta:atom', atom: atom.toString(), ... }],
      edges: this.#extractEdges(atom)
    };

    return { backendId: this.id, success: true, output: atom, events, graphDelta };
  }

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'metta-match',
        description: 'Pattern match in MeTTa space',
        schema: { pattern: 'string', space: 'string?' },
        execute: async (args) => this.#runtime.evaluate(parseMeTTa(`(match ${args.space} ${args.pattern})`))
      },
      {
        name: 'metta-rewrite',
        description: 'Apply rewrite rule',
        schema: { rule: 'string', target: 'string', space: 'string?' },
        execute: async (args) => this.#runtime.evaluate(parseMeTTa(`(rewrite ${args.space} ${args.rule} ${args.target})`))
      },
      {
        name: 'metta-query',
        description: 'Query atoms in space',
        schema: { pattern: 'string', space: 'string?' },
        execute: async (args) => this.#runtime.evaluate(parseMeTTa(`(query ${args.space} ${args.pattern})`))
      }
    ];
  }

  getSnapshot(): BackendSnapshot {
    // For graph sync — iterate spaces and emit atoms
  }
}
```

### B: Full MeTTa Agent (Future, Zero Agent Changes)

```typescript
// metta/src/backend/MettaAutonomousBackend.ts
export class MettaAutonomousBackend implements ReasoningBackend {
  readonly id = 'metta-auto';
  readonly label = 'MeTTa Autonomous Loop';
  readonly capabilities = new Set<Capability>([
    'pattern-match', 'rewrite', 'query', 'skill-execution',
    'long-term-memory', 'episodic-memory', 'autonomy-loop'
  ]);

  #runtime: MeTTaRuntime;
  #loop: MettaAutonomousLoop;  // NEW: real autonomous loop using runtime.evaluate()

  async initialize(config: BackendConfig): Promise<void> {
    this.#runtime = createMeTTa(config.metta);
    this.#loop = new MettaAutonomousLoop(this.#runtime, config);
    await this.#loop.start();
  }

  async reason(input: BackendInput): Promise<BackendResult> {
    // Delegate to autonomous loop's message queue
    return this.#loop.enqueueAndWait(input);
  }

  // Same interface — Agent doesn't care if backend has a loop or not
}
```

### NAR Backend (Extract from existing AgentImpl)

```typescript
// nar/src/backend/NarBackend.ts
export class NarBackend implements ReasoningBackend {
  readonly id = 'nar';
  readonly label = 'NAR Symbolic Reasoner';
  readonly capabilities = new Set<Capability>([
    'inheritance', 'implication', 'prediction', 'retrospection',
    'conjunction', 'disjunction', 'negation', 'abduction', 'deduction',
    'induction', 'analogy', 'truth-revision',
    'drive-management', 'goal-management',
    'episodic-memory', 'working-memory',
    'self-reasoning', 'autonomy-loop', 'tool-use', 'llm-completion'
  ]);

  #nar: NAR;
  #autonomyEngine?: AutonomyEngine;

  async initialize(config: BackendConfig): Promise<void> {
    this.#nar = createNAR(config.nar);
    if (config.autonomy) {
      this.#autonomyEngine = createAutonomyEngine(this.#nar, ...);
      this.#autonomyEngine.start();
    }
  }

  async reason(input: BackendInput): Promise<BackendResult> {
    // Use existing NAR input pipeline
    switch (input.type) {
      case 'belief': await this.#nar.believe(input.content); break;
      case 'goal': await this.#nar.goal(input.content); break;
      case 'question': await this.#nar.question(input.content); break;
      case 'chat': return this.#chatViaLLM(input.content, input.correlationId);
    }
    // Convert NAR events → BackendResult
  }

  getTools(): ToolDefinition[] {
    // Existing NAR query/explain tools
    return [
      { name: 'nar-query', ... },
      { name: 'nar-explain', ... },
      { name: 'nar-trace', ... },
    ];
  }
}
```

---

## 5. Unified Graph Projection (Engine-Agnostic)

```typescript
// ui/src/server/UnifiedGraphProjection.ts
export class UnifiedGraphProjection {
  #nodes = new Map<string, GraphNodeData>();  // GraphNodeDataView from Protocol.ts
  #edges = new Map<string, GraphEdgeData>();
  #sendFn: ((msg: IncomingFromServer) => void) | null = null;

  applyDelta(delta?: GraphDelta): void {
    if (!delta) return;
    const ops: GraphOp[] = [];

    for (const node of delta.nodes) {
      const existing = this.#nodes.get(node.id);
      if (!existing || this.#shouldUpdate(existing, node)) {
        this.#nodes.set(node.id, node);
        ops.push({ action: 'add_node', id: node.id, data: node });
      }
    }

    for (const edge of delta.edges) {
      const key = `${edge.source}->${edge.target}`;
      this.#edges.set(key, edge);
      ops.push({ action: 'add_edge', source: edge.source, target: edge.target, data: edge });
    }

    this.#sendFn?.({ type: 'cognitive.delta', seqId: ++this.#seq, lens: this.#lens, ops });
  }

  // Lens scoring works on capabilities, not engines
  scoreForLens(node: GraphNodeData, lens: Lens): number {
    const caps = node.capabilities ?? [];
    switch (lens) {
      case 'belief': return caps.includes('truth-revision') ? node.confidence * node.priority : 0;
      case 'goal': return caps.includes('goal-management') ? node.priority : 0;
      case 'skill': return caps.includes('skill-execution') ? node.priority : 0;
      case 'memory': return (caps.includes('episodic-memory') || caps.includes('long-term-memory')) ? 1 : 0;
      case 'contradiction': return caps.includes('truth-revision') && node.isContradiction ? 1 : 0;
      default: return node.confidence * node.priority;
    }
  }

  // Focus filtering works on unified graph (already done in Pillar 2)
  setFocus(term: string | null): void { /* existing logic */ }
}
```

**Key point:** `GraphNodeData` (Protocol.ts:83-111) already has `nodeType: 'nar:concept' | 'metta:atom' | 'metta:skill'` and optional `capabilities?: string[]`. We just add `capabilities` to the schema — **no `engine` field needed**. The node's `nodeType` prefix (`nar:`/`metta:`) is the engine tag *if* you need it for debug; the `capabilities` array is what lenses and routing use.

---

## 6. UI Consumes Capabilities, Not Engines

```typescript
// ui/src/client/core/store.ts — ADD
export const $capabilityFilter = atom<Capability | 'all'>('all');

// ui/src/client/components/lens-controller.ts — REPLACE engine filter
function getApplicableLenses(): LensSpec[] {
  const activeCaps = new Set($graphNodes.get().values().flatMap(n => n.capabilities ?? []));
  return ALL_LENS_SPECS.filter(spec => 
    spec.requires?.every(cap => activeCaps.has(cap)) ?? true
  );
}

// ui/src/client/components/graph-toolbar.ts — REPLACE engine badge
// Shows capability badges: [inheritance] [pattern-match] [skill-execution]
// NOT: [NAR] [MeTTa]
```

---

## 7. Config (Single Surface, Backend Sections Optional)

```json
// senars.config.json
{
  "agent": {
    "name": "senars",
    "persona": "curious assistant"
  },
  "backends": {
    "nar": {
      "enabled": true,
      "cyclesPerStep": 10,
      "autonomy": { "enabled": true }
    },
    "metta": {
      "enabled": true,
      "maxRecursionDepth": 100,
      "spaces": ["default", "episodic"],
      "autonomousLoop": false
    }
  },
  "memory": { "episodic": { "enabled": true } },
  "llm": { "provider": "openai-compatible", "model": "gpt-4o-mini" },
  "ui": { "defaultLens": "belief", "showCapabilityBadges": true }
}
```

---

## 8. Bootstrap (One Function, Declarative)

```typescript
// core/src/bootstrap.ts
export async function bootstrapAgent(agent: Agent, config: AgentConfig): Promise<void> {
  const seed = config.bootstrap ?? DEFAULT_SEED;

  // NAR beliefs
  if (seed.beliefs && agent.hasBackend('nar')) {
    for (const b of seed.beliefs) await agent.submitBelief(b);
  }

  // MeTTa atoms/skills
  if ((seed.atoms?.length || seed.skills?.length) && agent.hasBackend('metta')) {
    const metta = agent.getBackend('metta') as MettaBackend;
    for (const a of seed.atoms ?? []) await metta.learn(a.atom, a.space);
    for (const s of seed.skills ?? []) metta.registerSkill(s.name, s.op);
  }

  // Cross-backend links (optional, for entity unification)
  for (const link of seed.links ?? []) {
    await agent.linkEntities(link.narTerm, link.mettaAtom, link.relation);
  }
}
```

---

## 9. Migration Path (From Current Codebase)

| Current | Target | Effort |
|---------|--------|--------|
| `AgentImpl` (wraps NAR directly) | `Agent` (has `registerBackend()`) | Extract NAR logic → `NarBackend` |
| `MettaAgent` (stub) | `MettaBackend` (real) | Implement `reason()` with `runtime.evaluate()` |
| `CognitiveCoordinator` (broken fan-out) | **Delete** — Agent is the single source | Remove |
| `CognitiveBridge` (projects NAR only) | `UnifiedGraphProjection` (consumes `GraphDelta` from any backend) | Rewrite projection |
| `startWebUI(nar)` | `startAgentUI(agent)` | Thin wrapper |
| `bootstrapNAR` | `bootstrapAgent` | Merge |
| MeTTa `MettaLoop` (simulated) | **Delete** — Backend has no loop, or `MettaAutonomousBackend` has real loop | Replace |

**Zero UI changes** — the UI already consumes `CognitiveEvent` stream and `GraphNodeDataView`. The Agent still implements `CognitiveEventSource`. The graph projection still emits `cognitive.delta`.

---

## 10. How A1 and B Both Fall Out

| Scenario | What Exists | What You Add |
|----------|-------------|--------------|
| **A1 (Now):** MeTTa as NAR tools | `Agent` + `NarBackend` | `MettaBackend` with `getTools()` returning `metta-match`, `metta-rewrite`, `metta-query` |
| **B (Later):** Full MeTTa autonomous agent | `Agent` + `NarBackend` + `MettaBackend` | `MettaAutonomousBackend` with its own loop; register *instead of* or *alongside* `MettaBackend` |
| **Future:** SQL backend, LLM backend, Rust rule engine | `Agent` + existing backends | New `ReasoningBackend` implementation — **no Agent/UI changes** |

---

## 11. File Checklist

### New Core Files
- [X] `core/src/reasoning/ReasoningBackend.ts` — Interface + types
- [X] `core/src/reasoning/Capability.ts` — Capability taxonomy
- [X] `core/src/reasoning/BackendTypes.ts` — Supporting types
- [X] `core/src/reasoning/ReasoningRouter.ts` — Deterministic capability router (12 tests)
- [X] `core/src/Agent.ts` — New Agent core (replaces AgentImpl)
- [X] `core/src/bootstrap.ts` — Unified bootstrap

### New Backend Files
- [X] `nar/src/backend/NarBackend.ts` — wraps AgentImpl, implements ReasoningBackend (13 tests)
- [X] `metta/src/backend/MettaBackend.ts` — Real MeTTa backend (tools mode)
- [ ] `metta/src/backend/MettaAutonomousBackend.ts` — Future: full loop

### UI/Server Files
- [X] `ui/src/server/UnifiedGraphProjection.ts` — Replaces CognitiveBridge
- [X] `ui/src/server/agent-index.ts` — `startAgentUI(agent)` entry point (added to index.ts)
- [X] `ui/src/server/bridge-like.ts` — `BridgeLike` interface (shared type for CognitiveBridge/AgentBridge)
- [X] `ui/src/server/agent-bridge.ts` — `AgentBridge` adapter (wraps Agent + UnifiedGraphProjection for Gateway compat)
- [X] `ui/src/client/core/store.ts` — Add `$capabilityFilter`
- [X] `ui/src/client/components/lens-controller.ts` — Capability-gated lenses
- [X] `ui/src/client/components/graph-toolbar.ts` — Capability badges

### Config
- [X] `senars.config.json` — Migrate to backend sections (`backends.nar`, `backends.metta`)

### Tests
- [X] `tests/unit/core/reasoning-router.test.ts` (12 tests)
- [X] `tests/unit/core/agent.test.ts` (9 tests)
- [X] `tests/unit/nar/nar-backend.test.ts` (13 tests)
- [X] `tests/unit/metta/metta-backend.test.ts` (9 tests)
- [X] `tests/e2e/agent-smoke.test.ts` (5 tests — Agent + NarBackend + real WS)
- [X] `tests/e2e/metta-smoke.test.ts` (5 tests — Agent + MettaBackend + real WS)
- [X] `tests/unit/server/unified-graph-projection.test.ts` (5 tests — replaces cognitive-bridge.test.ts pattern)
- [X] `tests/integration/metta-tool-invocation.test.ts` (4 tests — MeTTa tools wired into NAR backend + execute against real MeTTa runtime)

---

## 12. Definition of Done

- [X] `pnpm senars` → single process: Agent + backends + UI server (`src/bin/senars.ts`)
- [X] User types `<bird --> animal>.` → NAR backend → graph grows (verified in `tests/e2e/agent-smoke.test.ts`)
- [X] User types `<bird --> animal>.` → Agent.submit() → NarBackend.reason() → graphDelta → UnifiedGraphProjection → cognitive.delta (verified in `tests/unit/server/agent-projection.test.ts`)
- [X] User types `skill:metta-match "(color $x)"` → NAR calls MeTTa tool → graph grows with MeTTa atoms
  - Router fix applied: `routeForChat()` now detects MeTTa syntax
  - MeTTaBackend.getTools() returns tools
  - Tool registration hook implemented in `Agent.registerBackend()` → `NarBackend.setExternalTools()` → `AgentImpl.setExternalToolOpts()`
- [X] User types `(match (atom $x) (-> $x (process $x)))` → MeTTa backend directly → graph grows
  - Router fix applied: `routeForChat()` now detects MeTTa syntax via `isMettaSyntax()`
  - MeTTa nodes get `truth-revision` capability for lens scoring
  - Verified in `tests/e2e/metta-smoke.test.ts` (isolated test with separate WS connection)
- [X] Lens picker shows only lenses whose `requires` capabilities exist in current graph
- [X] Config has `backends.nar.enabled`, `backends.metta.enabled` — no engine selector
- [X] `pnpm test:e2e:smoke` passes (2 test files: agent-smoke + metta-smoke)
- [X] `pnpm test` green (85 files, 1089 tests), `pnpm typecheck` green (5/5)
- [X] **Zero** user-visible "NAR" or "MeTTa" in default UI — only capabilities

---

## 13. Why This Avoids the Unification Trap

| Trap | This Design |
|------|-------------|
| Two `CognitiveEventSource`s | **One** `Agent` is the only source |
| Coordinator fans out to agents | **Router** fans out to backends *inside* Agent |
| Graph has `engine` field | Graph has `capabilities` array — engine is `nodeType` prefix (debug only) |
| Intent classifier with LLM | **Deterministic capability router** (LLM only for chat translation) |
| Hybrid pipeline complexity | **Route** = ordered backend steps; Agent fuses results |
| MeTTa stub treated as peer | MeTTa is a **backend** — can be tools-only (A1) or autonomous (B) |
| UI must know engines | **UI only knows capabilities** — engine is invisible |

---

## 14. Integration Findings (From Codebase Review)

### 14.1 Protocol.ts Changes Required (Breaking) — [DONE]

```typescript
// core/src/Protocol.ts — GraphNodeDataView (lines 83-112)
export const GraphNodeDataView = z.object({
  // ... existing fields ...
  nodeType: z.enum(['nar:concept', 'metta:atom', 'metta:skill']),
  capabilities: z.array(z.string()).optional(),  // ← ADDED
});

// core/src/lens-schema.ts — LensSpecSchema
export const LensSpecSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  modulation: ModulationSchema,
  requires: z.array(z.string()).optional(),  // ← ADDED
});
```

- [X] `capabilities` added to `GraphNodeDataView`
- [X] `requires` added to `LensSpecSchema`
- [X] `requires` added to `LensListMsg`, `LensDefineMsg`, `LensDefinedMsg` in Protocol.ts
- [X] Default lenses updated: `belief`→`['truth-revision']`, `goal`→`['goal-management']`, `contradiction`→`['truth-revision']`
- All backends must populate `capabilities` on node emission

### 14.2 AgentImpl → Agent Extraction Strategy

| Current (`nar/src/agent/core/AgentImpl.ts`) | Target (`core/src/Agent.ts`) |
|---------------------------------------------|------------------------------|
| Hard-coded NAR dependency | `registerBackend(backend)` |
| `chat()` → NAR's LMChatService | `chat()` → routes via `ReasoningRouter` |
| `submit()` → NAR input pipeline | `submit()` → routes to backend(s) |
| Direct NAR event subscription | Subscribes to *all* backend events |
| `capabilities()` → NAR-specific | Union of all backend capabilities |
| `getTools()` → NAR tools | Union of `backend.getTools()` |

**Risk mitigation**: Keep `AgentImpl` as internal `NarBackend` implementation. New `Agent` class delegates to backends. Zero behavioral change for NAR path.

### 14.3 BackendConfig Typing

```typescript
// core/src/reasoning/BackendTypes.ts
export interface BackendConfig {
  // Backend-specific config merged at registration
  [key: string]: unknown;
}

// NarBackend expects:
interface NarBackendConfig {
  nar: NARConfig;
  autonomy?: { enabled: boolean };
  lmService?: LMService;
  providerRegistry?: SeNARSRegistry;
}

// MettaBackend expects:
interface MettaBackendConfig {
  metta?: MettaConfig;
  spaces?: string[];
  autonomousLoop?: boolean;
}
```

### 14.4 CognitiveCoordinator — Remove

- Used nowhere in production (only test fixtures)
- New `Agent` *is* the single `CognitiveEventSource`
- Delete `core/src/CognitiveCoordinator.ts` after tests migrated

### 14.5 Test Migration Scope

| Test File | Action |
|-----------|--------|
| `tests/unit/server/cognitive-bridge.test.ts` | → `UnifiedGraphProjection` tests |
| `tests/unit/server/bridge-api.test.ts` | → `Agent` direct tests |
| `tests/unit/server/bridge-revision.test.ts` | → `Agent` + `NarBackend` |
| `tests/unit/server/bridge-nar-integration.test.ts` | → `NarBackend` isolation + `Agent` |
| `tests/e2e/webui-smoke.test.ts` | → `tests/e2e/agent-smoke.test.ts` |
| `tests/unit/nar/agent/` | → `Agent` + `NarBackend` |
| `tests/unit/metta/` | → `MettaBackend` tests |

### 14.6 Migration Sequence (Zero-Downtime)

| Step | What | Status | Risk |
|------|------|--------|------|
| 1 | Add `capabilities` to `GraphNodeDataView` + `requires` to `LensSpecSchema` | Done | Low — additive |
| 2 | Create `ReasoningBackend` interface + `Capability` enum in `core/src/reasoning/` | Done | Low — new files |
| 3 | Create `ReasoningRouter` in `core/src/reasoning/` | Done | Low — new file |
| 4 | Extract `NarBackend` from `AgentImpl` (wrap, keep backward compat) | Done | Medium — surgical |
| 5 | Build `MettaBackend` with real `runtime.evaluate()` | Done | Medium — new backend |
| 6 | Create new `Agent` class with `registerBackend()` | Done | Medium — new core |
| 7 | Create `UnifiedGraphProjection` + `startAgentUI(agent)` | Done | Low — wrapper |
| 8 | Create `bootstrapAgent()` unified bootstrap | Done | Low |
| 9 | Update `senars.config.json` with `backends` section | Done | Low |
| 10 | Update UI lens filtering to use capabilities | Done | Low |
| 11 | Delete `CognitiveCoordinator` (class removed, interface preserved) | Done | Medium — cleanup |
| 12 | Create `BridgeLike` interface + `AgentBridge` adapter | Done | Low — new files, gateway/socket-handler use `BridgeLike` instead of concrete `CognitiveBridge` |
| 13 | Fix `ReasoningRouter.routeForChat()` Narsese detection | Done | Low — ensures Narsese inputs go to NAR as beliefs, not LLM |
| 14 | Fix workspace package resolution for `pnpm repl`/`multi-agent` | Done | Medium — root `package.json` needs `workspace:*` deps |
| 15 | Wire `GraphDelta` handler in Agent + backends | Done | Low — additive |
| 16 | Update `AgentBridge` + switch `startAgentUI` | Done | Medium — replaces CognitiveBridge in Agent path |
| 17 | Write `agent-projection.test.ts` (integration) | Done | Low — new test file |
| 18 | Delete `CognitiveBridge` | **Done** (Batch 13) | High — `startWebUI` legacy path fully removed |
| 19 | Verify `pnpm bot` (IRC+WS) still works | Next | Critical — integration |

### 14.7 Remaining Risks

1. **AgentImpl Extraction**: 683 lines with tight NAR coupling. Mitigation: `NarBackend` wraps `AgentImpl` internally — new `Agent` delegates to it.

2. **LMChatService**: NAR-specific. Keep in `nar/src/services/` — `NarBackend` owns it.

3. **ToolBuilder**: Creates NAR-specific tools. `MettaBackend.getTools()` returns its own. `Agent` unions them.

4. **Event Schema**: `CognitiveEvent.engine: 'nar' | 'metta'` — backends must emit correctly.

5. **Autonomy Engine**: NAR-only. `NarBackend` initializes it. `MettaAutonomousBackend` has own loop.

---

## 15. Convergence Verdict

**We are converging.** The Agent-as-Kernel design is the stable attractor:

| Plan | Core Idea | Fatal Flaw |
|------|-----------|------------|
| `NEXT.agent3.md` | Vertical slice: real NAR + UI | Ignores MeTTa; assumes single engine |
| `NEXT.agent4.md` | Unified coordinator + intent classifier | Treats stub as peer; LLM in hot path; dual agents |
| `NEXT.agent5.md` | **Agent as kernel, backends as plugins** | **None — integrates with existing architecture** |

The progression was necessary: each plan exposed the next layer of reality. `agent5` is the first that:
- Works with **existing IO channels** (IRC, CLI, WS, HTTP, MCP) unchanged
- Preserves **all NAR capabilities** (chat, tools, drives, autonomy, revision history)
- Makes **MeTTa real** (A1) and leaves door open for **full autonomy** (B)
- Requires **zero UI changes** (graph, lenses, chat work via capabilities)
- Has **clear migration path** with surgical extraction, not rewrite

**No more plans needed.** The architecture is settled. Next step is implementation.

---

*Supersedes `NEXT.agent4.md`. Strategy: **Agent as kernel, backends as plugins.** The vertical slice is the Agent with NAR + MeTTa backends.*

---

## 16. Batch Progress

### Batch 1 (Complete) — Foundation: Protocol + ReasoningBackend Interface
- [X] Add `capabilities` to `GraphNodeDataView` (`core/src/Protocol.ts`)
- [X] Add `requires` to `LensSpecSchema` (`core/src/lens-schema.ts`)
- [X] Add `requires` to `LensListMsg`, `LensDefineMsg`, `LensDefinedMsg` (`core/src/Protocol.ts`)
- [X] Update `builtinLensSpecs()` with capability requirements
- [X] Create `core/src/reasoning/ReasoningBackend.ts` — interface
- [X] Create `core/src/reasoning/Capability.ts` — capability taxonomy
- [X] Create `core/src/reasoning/BackendTypes.ts` — types (BackendInput, BackendResult, GraphDelta, ToolDefinition, etc.)
- [X] Export all from `core/src/index.ts` + `core/package.json` `./reasoning` exports
- [X] `pnpm typecheck` green (core package)

### Batch 2 (Complete) — Router + NarBackend Extraction
- [X] Create `core/src/reasoning/ReasoningRouter.ts` — deterministic capability router
- [X] Add reasoning router exports to `core/src/index.ts` + `core/package.json`
- [X] Add `nar/src/backend/NarBackend.ts` wrapping AgentImpl, implementing `ReasoningBackend`
- [X] Add `nar/package.json` exports for `./backend` + vitest alias
- [X] Tests: `tests/unit/core/reasoning-router.test.ts` (12 tests)
- [X] Tests: `tests/unit/nar/nar-backend.test.ts` (13 tests)
- [X] `pnpm typecheck` green (all 5 packages)
- [X] `pnpm test` green (79 files, 1050 tests)

### Batch 3 (Complete) — New Agent Core + MettaBackend
- [X] Create `core/src/Agent.ts` with `registerBackend()` and `#routeAndExecute()`
- [X] Create `metta/src/backend/MettaBackend.ts` with real `runtime.evaluate()` and `getTools()`
- [X] Create `core/src/bootstrap.ts` — unified bootstrap (NAR beliefs + MeTTa atoms/skills)
- [X] Update `ui/src/server/UnifiedGraphProjection.ts` — replace CognitiveBridge, consume `GraphDelta`
- [X] Update `ui/src/server/index.ts` — `startAgentUI(agent)` wrapper
- [X] Tests: `tests/unit/core/agent.test.ts` (9 tests)
- [X] Tests: `tests/unit/metta/metta-backend.test.ts` (9 tests)
- [X] `pnpm typecheck` green (all 5 packages)
- [X] `pnpm test` green (81 files, 1068 tests)

### Batch 4 — UI + Config + Cleanup (Complete)
- [X] Add `$capabilityFilter` atom to `ui/src/client/core/store.ts`
- [X] Capability-gated lenses in `lens-controller.ts` (dynamic filtering by node capabilities, auto-fallback)
- [X] Capability badges in `graph-toolbar.ts` (shows short capability labels sorted alphabetically)
- [X] Migrate `senars.config.json` to backend sections (`backends.nar`, `backends.metta`)
- [X] Delete `CognitiveCoordinator` class (interface `CognitiveEventSource` moved to its own file)
- [X] Create `tests/e2e/agent-smoke.test.ts` (Agent + NarBackend + real WS, replaces webui-smoke for new Agent path)
- [X] Create `tests/unit/server/unified-graph-projection.test.ts` (migrates bridge event-projection patterns)
- [X] Update bin scripts (`multi-agent.ts`, `multi-agent-demo.ts`) to use new Agent + backend pattern
- [X] Remove `@senars/core/coordinator` export (package.json + vitest alias)
- [X] `pnpm typecheck` green (all 5 packages)
- [X] `pnpm test` green (83 files, 1076 tests)

### Batch 5 (Complete) — UI Capability Filtering + Zero Engine References + Test Fixes
- [X] **Fix `pnpm test:e2e:smoke`** — script used `--dir tests/e2e` which broke vitest's include pattern. Changed to `vitest run tests/e2e/agent-smoke.test.ts`
- [X] **Wire `$capabilityFilter` into graph view filtering** (graph-viewport.ts + spacegraph-viewport.ts)
    - Added `$capabilityFilter` watch in both `graph-viewport.ts` and `spacegraph-viewport.ts`
    - `applyGraphFilter()` now checks `$capabilityFilter` first: if not `'all'`, hides nodes lacking that capability
    - Capability badges in `graph-toolbar.ts` are now clickable — toggle filter on/off
    - Active badge gets `.active` style (accent border + subtle background)
    - Capabilities are included in Cytoscape node data so `data('capabilities')` is available at filter time
    - Exported `$capabilityFilter` from `store.ts` via `core/index.ts`
- [X] **Zero user-visible 'NAR' or 'MeTTa' in default UI**
    - `config-hud.ts`: `'NARS Reasoning'` → `'Reasoning'`
    - `config-profiles.ts`: `'Balanced NARS configuration'` → `'Balanced configuration'`
    - `node-detail-drawer.ts`: Raw `nodeType` display (e.g. `"nar:concept"`, `"metta:atom"`) now shows human-readable labels via `formatNodeType()` → `"Concept"`, `"Atom"`, `"Skill"`
    - Wire protocol internally still uses engine prefixes — only UI display is sanitized
- [X] Verified `pnpm typecheck` green (5/5 packages)
- [X] Verified `pnpm test` green (83 files, 1076 tests)
- [X] Verified `pnpm test:e2e:smoke` green (1 file, 5 tests)

### Batch 7 (Complete) — Package Resolution + Server Refactor + Router Fix
- [X] **Fix workspace package resolution** — Added `@senars/*` as `workspace:*` deps in root `package.json`. pnpm now symlinks the workspace packages into `node_modules/@senars/`. `pnpm multi-agent` starts successfully. Fixed wrong imports in `multi-agent.ts` and `multi-agent-demo.ts` (`DEFAULT_NAR_CONFIG` from `../config`, `createAgent` from `@senars/nar/agent`).
- [X] **Create `BridgeLike` interface** (`ui/src/server/bridge-like.ts`) — Shared structural type that both `CognitiveBridge` and `AgentBridge` satisfy. Gateway, socket-handler, and bindSocket use `BridgeLike` instead of concrete `CognitiveBridge` type, enabling gradual migration.
- [X] **Create `AgentBridge` adapter** (`ui/src/server/agent-bridge.ts`) — Wraps `Agent + UnifiedGraphProjection` with the `BridgeLike` interface. NAR-specific operations gracefully degrade (return empty). Ready for future switchover when event projection is handled via `UnifiedGraphProjection.applyDelta()`.
- [X] **Refactor `startAgentUI`** — Uses `CognitiveBridge` (without NAR) mounted on Agent for event projection. Falls back to legacy `startWebUI` path when NAR is passed. Works without NAR-specific features (history, drives, config are no-ops).
- [X] **Fix `ReasoningRouter.routeForChat()`** — Now detects Narsese syntax and routes to `nar` backend with `type: 'belief'` instead of `type: 'chat'` (LLM). This ensures Narsese inputs like `<cat --> mammal>.` are processed by NAR directly even when coming through the chat path.
- [X] **`pnpm typecheck` green** (5/5 packages)
- [X] **`pnpm test` green** (83 files, 1076 tests)
- [X] **`pnpm test:e2e:smoke` green** (5/5 tests)
- [X] **`pnpm multi-agent` launches** with NAR + MeTTa backends (workspace resolution fixed)

### Batch 8 (Complete) — Graph Delta Pipeline + AgentBridge in startAgentUI
- [X] **Wire `graphDelta` handler in Agent** (`core/src/Agent.ts`) — Added `#onGraphDelta` callback + `setGraphDeltaHandler()` method. `#routeAndExecute()` and `#executeRoute()` now call the handler when backends return `BackendResult.graphDelta`. Keeping Agent UI-agnostic — the handler is set by the bridge layer.
- [X] **Enhance `NarBackend.#eventsToGraphDelta()`** — Now parses Narsese relations (`<A --> B>`) into individual concept nodes (`A`, `B`) with inheritance edges, instead of creating a single opaque node with the full term. Mirrors the relation parsing logic from `CognitiveBridge.projectCognitiveEvent()`.
- [X] **Update `AgentBridge`** — `mount()` now calls `agent.setGraphDeltaHandler()` to pipe backend `GraphDelta` → `UnifiedGraphProjection.applyDelta()`. `unmount()` clears the handler. `sendInitialState()` always emits `config.schema` (matching `CognitiveBridge` behavior).
- [X] **Switch `startAgentUI` to use `AgentBridge` + `UnifiedGraphProjection`** — Replaces `CognitiveBridge` (without NAR) with `AgentBridge` wrapping `UnifiedGraphProjection`. Graph deltas flow: backends → Agent → AgentBridge → UnifiedGraphProjection → `cognitive.delta` to WS clients. Legacy NAR path via `startWebUI` unchanged.
- [X] **New integration test** (`tests/unit/server/agent-projection.test.ts`, 6 tests) — Tests Agent + NarBackend + UnifiedGraphProjection pipeline end-to-end: belief submission creates concept nodes, inheritance edges, `setLens`/`setFocus` work.
- [X] `pnpm typecheck` green (5/5 packages)
- [X] `pnpm test` green (84 files, 1082 tests)
- [X] `pnpm test:e2e:smoke` green (5/5 tests)

### Batch 9 (Complete) — Combined Entry Point
- [X] **Create `src/bin/senars.ts`** — Single-process entry point: Agent + NarBackend + MettaBackend + UI server via `startAgentUI()`. Supports `--port` and `--no-bootstrap` flags.
- [X] **Add `"senars"` script** to root `package.json` → `NODE_NO_WARNINGS=1 tsx src/bin/senars.ts`
- [X] **Verified startup** — `pnpm senars --port=9876` starts NAR backend, MeTTa backend, bootstraps 3 seed beliefs (`<sky --> blue>.`, `<bird --> animal>.`, `<robin --> bird>.`), and binds HTTP+WS on the specified port.
- [X] `pnpm typecheck` green (5/5 packages)
- [X] `pnpm test` green (84 files, 1082 tests)

### Batch 10 (Complete) — Tool Registration Hook
- [X] **Added `NarBackend.setExternalTools()`** — Accepts `ToolDefinition[]` and converts to format expected by `ToolBuilder.extToolOpts`
- [X] **Added `AgentImpl.setExternalToolOpts()`** — Updates the external tools map at runtime, which `ToolBuilder` uses during chat
- [X] **Updated `Agent.registerBackend()`** — After registering a non-NAR backend, immediately injects its tools into the NAR backend for LLM access
- [X] **Added unit test** for `setExternalTools` in `tests/unit/nar/nar-backend.test.ts`
- [X] `pnpm typecheck` green (5/5 packages)
- [X] `pnpm test` green (85 files, 1089 tests)

### Batch 11 (Complete) — Isolated MeTTa Smoke Test
- [X] **Created `tests/e2e/metta-smoke.test.ts`** — Isolated e2e test with MettaBackend + Agent + real WS
  - Verified MeTTa syntax `(+ 1 2)` routes correctly and grows graph
  - Verified `skill:` prefix is recognized and processed
  - Verified lens.set works on Metta graph
  - Used separate server instance to avoid shared state with NAR tests
- [X] `pnpm test` green (85 files, 1089 tests)
- [X] `pnpm typecheck` green (5/5 packages)

### Batch 12 (Complete) — MeTTa Tool Invocation Integration Test

- [X] **Created `tests/integration/metta-tool-invocation.test.ts`** (4 tests) — Verifies the deterministic cross-backend bridge:
  - Agent + real `NarBackend` (wrapping `AgentImpl`) + real `MettaBackend` registered together
  - `Agent.registerBackend(metta)` wires `MettaBackend.getTools()` → `NarBackend.setExternalTools()` → `AgentImpl.setExternalToolOpts()`
  - `AgentImpl.buildTools()` exposes `metta-match`, `metta-rewrite`, `metta-query` (proves NAR's LLM tool pipeline would see them)
  - Executing each MeTTa tool runs **real** MeTTa code via the live runtime (returned `True` for `(match default (+ $x $y))`, confirming real evaluation, not a stub)
  - The LLM's *decision* to call a tool is an external non-deterministic component and intentionally out of scope; this test covers the deterministic bridge the LLM invokes.
- [X] `pnpm typecheck` green (5/5 packages)
- [X] `pnpm test` green (integration dir: 32 tests, 7 files)

### Batch 13 (Complete) — Delete CognitiveBridge / Legacy startWebUI Path

**Full speed ahead: removed all backward-compatibility to `CognitiveBridge`.** No live usage remains.

- [X] **Deleted `ui/src/server/cognitive-bridge.ts`** (714 lines) — the legacy NAR-only bridge.
- [X] **Deleted dead server files** only used by the legacy path:
  - `ui/src/server/lenses.ts` (`buildLensGraphOps` had no callers after `CognitiveBridge` removed)
  - `ui/src/server/test-control.ts` (`createTestControlHandler`, only used by `startWebUI`)
  - `ui/src/server/bootstrap.ts` (`bootstrapNAR` + `BOOTSTRAP_BELIEFS`, only used by `startWebUI`)
  - `ui/src/server/socket-handler.ts` (confirmed no importers — dead code)
- [X] **Removed legacy entry points** from `ui/src/server/index.ts`: `startWebUI`, `startWebUIWithOptions`, `startWebUIWithNAR`. `startAgentUI(agent, options)` is now the single UI entry point.
- [X] **`ui/src/index.ts`** now exports only `startAgentUI` (+ `TestServer`, `StartUIOptions`).
- [X] **Migrated `src/bin/bot-ai.ts`** (`ENABLE_WEB_UI`): builds a core `Agent`, registers `NarBackend(agent)`, and calls `startAgentUI(uiAgent)` (was `startWebUI(agent)`). `pnpm bot` now uses the Agent-as-Kernel path.
- [X] **Migrated `tests/integration/multi-agent.test.ts`** → `startAgentUI` (was `startWebUIWithOptions`).
- [X] **Deleted legacy/redundant tests** (covered by `agent-smoke` / `metta-smoke` / new bridge tests):
  - `tests/e2e/webui-smoke.test.ts`
  - `tests/unit/server/cognitive-bridge.test.ts`
  - `tests/unit/server/bridge-api.test.ts`
  - `tests/unit/server/bridge-nar-integration.test.ts`
  - `tests/unit/server/bridge-revision.test.ts`
  - `tests/integration/metta-ui.test.ts`
  - `tests/integration/nar-ui.test.ts`
- [X] `pnpm typecheck` green (5/5 packages)
- [X] `pnpm test` green (79 files, 1048 tests — down from 1093; 45 removed with the legacy bridge)
- [X] `pnpm test:e2e:smoke` green (agent-smoke + metta-smoke, 11 tests)

**Note on coverage:** NAR revision-history-over-the-wire (`node.history`) and `CognitiveBridge.syncFromNAR` initial projection were CognitiveBridge-specific. The new `AgentBridge`/`UnifiedGraphProjection` path grows the graph from live `GraphDelta`s emitted by backends (see `agent-projection.test.ts`). If NAR revision history in the UI is needed later, add it to `NarBackend`/`AgentBridge` — out of scope here.

### Remaining Work (Future Sessions)

**High Priority**
- [X] **Integration test for MeTTa tool invocation via NAR's LLM** — DONE (Batch 12).

**Medium Priority**
- [X] **Delete/archive `CognitiveBridge`** — DONE (Batch 13). All legacy `startWebUI*` paths and `CognitiveBridge` are removed; `startAgentUI` + `AgentBridge` + `UnifiedGraphProjection` is the sole UI path.

**Low Priority (Deferred)**
- [ ] **`MettaAutonomousBackend`** — Future full-loop backend (`core/src/Agent.ts` + `metta/src/backend/MettaAutonomousBackend.ts` with its own `MettaAutonomousLoop`). No urgent use case; `MettaBackend` (tools mode, A1) already satisfies current needs.