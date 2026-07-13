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
- [ ] `core/src/reasoning/ReasoningBackend.ts` — Interface + types
- [ ] `core/src/reasoning/Capability.ts` — Capability taxonomy
- [ ] `core/src/reasoning/ReasoningRouter.ts` — Deterministic capability router
- [ ] `core/src/Agent.ts` — New Agent core (replaces AgentImpl)
- [ ] `core/src/bootstrap.ts` — Unified bootstrap

### New Backend Files
- [ ] `nar/src/backend/NarBackend.ts` — Extract from AgentImpl
- [ ] `metta/src/backend/MettaBackend.ts` — Real MeTTa backend (tools mode)
- [ ] `metta/src/backend/MettaAutonomousBackend.ts` — Future: full loop

### UI/Server Files
- [ ] `ui/src/server/UnifiedGraphProjection.ts` — Replaces CognitiveBridge
- [ ] `ui/src/server/agent-index.ts` — `startAgentUI(agent)` entry point
- [ ] `ui/src/client/core/store.ts` — Add `$capabilityFilter`
- [ ] `ui/src/client/components/lens-controller.ts` — Capability-gated lenses

### Config
- [ ] `senars.config.json` — Migrate to backend sections

### Tests
- [ ] `tests/unit/core/reasoning-router.test.ts`
- [ ] `tests/unit/core/agent.test.ts`
- [ ] `tests/unit/nar/nar-backend.test.ts`
- [ ] `tests/unit/metta/metta-backend.test.ts`
- [ ] `tests/e2e/agent-smoke.test.ts` — Replaces unified-smoke

---

## 12. Definition of Done

- [ ] `pnpm senars` → single process: Agent + backends + UI server
- [ ] User types `<bird --> animal>.` → NAR backend → graph grows
- [ ] User types `skill:metta-match "(color $x)"` → NAR calls MeTTa tool → graph grows with MeTTa atoms
- [ ] User types `(match (atom $x) (-> $x (process $x)))` → MeTTa backend directly → graph grows
- [ ] Lens picker shows only lenses whose `requires` capabilities exist in current graph
- [ ] Config has `backends.nar.enabled`, `backends.metta.enabled` — no engine selector
- [ ] `pnpm test:e2e:smoke` passes (single test file, no engine-specific assertions)
- [ ] `pnpm test` green, `pnpm typecheck` green
- [ ] **Zero** user-visible "NAR" or "MeTTa" in default UI — only capabilities

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

*Supersedes `NEXT.agent4.md`. Strategy: **Agent as kernel, backends as plugins.** The vertical slice is the Agent with NAR + MeTTa backends.*