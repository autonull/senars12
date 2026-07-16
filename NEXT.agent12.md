# NEXT.agent12.md — The Cognitive Organism

> **Vision:** *Not "three agents merged." Not "fewer abstractions." A single living cognitive process — event-sourced, memory-tiered, engine-orchestrated, tool-empowered, UI-projected, plugin-extensible. The components we have are not "services to wire." They are organs of one mind. This plan vivifies them.*

---

## 0. Diagnosis: What We Actually Have (Post agent10/11)

| Component | State | It Wants To Be |
|-----------|-------|-----------------|
| `Agent` (core) | Thin facade over `Kernel` | **The cognitive hub** — owns cycle, memory, engines, tools |
| `Kernel` | EventLog + Backend registry | **Deleted.** It's a tax on simplicity |
| `EventLog` (InMemory, Sqlite) | Healthy, underused | **The nervous system** — single source of truth |
| `MemoryService` | Tier 0 ring only | **The hippocampus** — 5 living tiers |
| `AgentBridge` | Exists, unwired | **The optic nerve** — agent → UI projection |
| `Plugin` interface | Unused | **The immune system** — symbiotic extension |
| `PolicyEngine` | Moved to core, dormant | **The prefrontal cortex** — safety gate |
| `ModelRunner` / `ChatService` | Exists, uninvoked | **The cortex** — narrative synthesis |
| `NAR` engine | Powerful, isolated | **The reasoning organ** — one of many |
| `MeTTaRuntime` | Powerful, isolated | **The symbolic organ** — one of many |
| `MettaCommandParser` | 15 cmds, 8 ignored | **The motor cortex** — intent → action |
| `MettaSkills` | Feedback map | **The procedural memory** — grown capabilities |
| Connections (CLI/WS/HTTP/IRC/MCP) | Manual registry | **The senses** — plugin transports |
| Viewports (Cytoscape/SpaceGraphJS) | Duplicated sync | **The eyes** — one mind, many views |
| `VisualizationBackend` | Dead no-op | **Deleted.** AgentBridge is the eye |
| `protocol.ts` (UI) | Duplicate of core | **Deleted.** Core is the protocol |
| `MessageRouter` | Middleware layer | **Deleted.** Agent IS the router |
| `lens-selector` | Duplicate of `lens-controller` | **Deleted.** One controller |
| Tests (~50) | Broken `@senars/nar/agent` | **Repaired** via `nar/src/agent/` birth |

---

## 1. The Unified Architecture

```
                         ┌─────────────────────────────────────┐
                         │            AGENT (The Mind)          │
                         │                                     │
   SENSES ───────────▶ │  TransportHub (mount/submit)      │
   (transports)          │        │                            │
                         │        ▼                            │
                         │  working memory (Tier 0)        │
                         │        │                            │
                         │        ▼                            │
                         │  ┌─────────── cognitive cycle ──┐  │
                         │  │ 1. perceive (append)        │  │
                         │  │ 2. recall (Tier 1-2)       │  │
                         │  │ 3. reason (engines)         │  │
                         │  │ 4. narrate (cortex/LLM)     │  │
                         │  │ 5. act (motor/tools)        │  │
                         │  │ 6. consolidate (Tier 3-4)  │  │
                         │  └──────────────────────────────┘  │
                         │        │          │                 │
                         │        ▼          ▼                 │
                         │  Engines    Memory (all tiers)    │
                         │  (nar,      │                    │
                         │   metta,    ▼                    │
                         │   llm)    EventLog ◀── persistence │
                         │        │                            │
                         │        ▼                            │
   UI ◀───────────────│  AgentBridge (optic nerve)      │
   (living window)        └─────────────────────────────────────┘
                         │            ▲
                         │  PluginContext (symbiotes extend all of the above)
```

**One process. One event log. One memory. Many engines. Many tools. One UI window. Infinite plugins.**

---

## 2. The Cognitive Cycle — The Living Loop

This is the heart. Not "submit → backend → response." A **continuous, reactive cycle**:

```typescript
// core/src/Agent.ts
class Agent {
  readonly id: string;
  readonly log: EventLog;                 // nervous system
  readonly memory: MemoryService;          // hippocampus (all tiers)
  readonly cortex: LLMCortex;             // narrative synthesis
  readonly engines = new Map<EngineId, Engine>();  // reasoning organs
  readonly motor: ToolRegistry;            // grown capabilities
  readonly senses = new TransportHub(this); // mount/submit
  readonly policy: PolicyEngine;           // safety gate
  readonly bridge: AgentBridge;            // → UI

  // The living cycle — called on every stimulus
  async cycle(stimulus: CognitiveStimulus): Promise<void> {
    // 1. Perceive — append to working memory + event log
    const cid = this.memory.append({ type: 'stimulus', payload: stimulus });
    this.log.append({ type: 'input.user', payload: stimulus, correlationId: cid });

    // 2. Recall — pull relevant context from all tiers
    const context = await this.memory.recall(stimulus, { tiers: ['episodic', 'semantic'] });

    // 3. Reason — orchestrate engines (parallel where possible)
    const derivations = await this.reason(stimulus, context);

    // 4. Narrate — LLM synthesizes voice + intent
    const narrative = await this.cortex.synthesize({
      stimulus, context, derivations,
      systemPrompt: this.buildPrompt(),
    });

    // 5. Act — parse intent → execute tools/skills
    const actions = this.parser.parse(narrative);
    for (const action of actions) {
      const checked = this.policy.checkCommand(action.command);
      if (!checked.allowed) { this.log.warn(checked.reason); continue; }
      const result = await this.motor.execute(action, cid);
      this.memory.append({ type: 'skill_result', payload: result, correlationId: cid });
      // Engines absorb tool results back into their knowledge
      for (const engine of this.engines.values()) engine.absorb?.(result);
    }

    // 6. Consolidate — promote working → episodic → semantic → procedural
    await this.memory.consolidate(cid);

    // Project to UI — the mind becomes visible
    this.bridge.project(this.memory.recent(50));
  }

  private async reason(stimulus, context) {
    const results = await Promise.all([
      this.engines.get('nar')?.reason(stimulus, context) ?? [],
      this.engines.get('metta')?.evaluate(stimulus, context) ?? [],
    ]);
    return results.flat();
  }
}

// Transports feed the cycle directly — no router, no backend
class TransportHub {
  mount(conn: Connection): void {
    conn.onMessage(async (msg) => {
      await this.agent.cycle({ source: conn.type, text: msg.text });
    });
  }
}
```

**This kills:** Kernel, Backend, ToolProvider, EventBackend, MessageRouter, VisualizationBackend, protocol.ts duplication. All of them.

---

## 3. Memory as a Living, Tiered System

Not "a ring buffer + some spaces." A **hippocampus** that breathes:

```typescript
// core/src/memory/MemoryService.ts
class MemoryService {
  // Tier 0: Working — hot ring buffer (current context window)
  #working: RingBuffer<MemoryEntry>;

  // Tier 1: Episodic — time-indexed, replayable via EventLog
  async queryTimeRange(from, to): Promise<Episode[]> {
    return this.agent.log.query({ types: ['input.user', 'derivation', 'skill_result'], from, to });
  }

  // Tier 2: Semantic — queryable knowledge graph
  // (delegates to owned engine spaces: MeTTa ∪ NAR beliefs)
  async recall(pattern: string, opts?: { tiers?: Tier[] }): Promise<Atom[]> {
    const out: Atom[] = [];
    if (opts?.tiers?.includes('semantic')) {
      if (this.agent.engines.get('metta')) out.push(...await this.agent.engines.get('metta')!.query(pattern));
      if (this.agent.engines.get('nar')) out.push(...await this.agent.engines.get('nar')!.queryBeliefs(pattern));
    }
    return out;
  }

  // Tier 3: Procedural — feedback-weighted skill patterns
  #procedural = new SkillRegistry();  // was MettaSkills

  // Tier 4: Long-term — persisted atom spaces + belief stores
  async persist(space?: string): Promise<void> {
    for (const engine of this.agent.engines.values()) await engine.persist?.(space);
  }
  async load(space?: string): Promise<void> {
    for (const engine of this.agent.engines.values()) await engine.load?.(space);
  }

  // The consolidation cycle — working → episodic → semantic → procedural
  async consolidate(cid: string): Promise<void> {
    const entry = this.#working.get(cid);
    if (!entry) return;
    // Promote high-salience entries to semantic; successful tool patterns to procedural
    if (entry.salience > THRESHOLD) await this.promoteToSemantic(entry);
    if (entry.type === 'skill_result' && entry.success) this.#procedural.reinforce(entry);
  }
}
```

**This is the agent's memory of itself.** It remembers by replay. It learns what works. It persists across restarts.

---

## 4. Engines as First-Class Organs (Plugin)

No more "backend implements ToolProvider." An **Engine** is a reasoning organ the agent queries:

```typescript
// core/src/engine/Engine.ts
interface Engine {
  readonly id: EngineId;
  readonly provides: Set<Capability>;
  reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]>;
  evaluate(sexpr: string, context: Context): Promise<Atom[]>;  // symbolic engines
  query(pattern: string): Promise<Atom[]>;
  absorb?(result: ToolResult): void;        // learn from tool outputs
  persist?(space?: string): Promise<void>;
  load?(space?: string): Promise<void>;
}

// Concrete organs — each is a plugin
class NAREngine implements Engine { id = 'nar'; /* ... */ }
class MettaEngine implements Engine { id = 'metta'; /* wraps MeTTaRuntime */ }
// LLM is special: it's the cortex, not an engine (see §5)
```

The agent **orchestrates** engines. Each is registered via plugin. To add a new reasoning organ (e.g., a vector DB, a rule engine), you write one `Engine` and `agent.registerEngine(it)`.

---

## 5. The LLM as Narrative Cortex

Not "chat." The LLM is the agent's **voice + translator**:

- Takes symbolic reasoning (NAR derivations, MeTTa atoms) → **explains** it naturally
- Takes natural language → **translates** to symbolic intents via `MettaCommandParser`
- Maintains **narrative continuity** across the session (remembers the story)
- Uses `MettaPromptBuilder` to assemble context from all memory tiers

```typescript
// core/src/cortex/LLMCortex.ts
class LLMCortex {
  async synthesize(req: {
    stimulus: CognitiveStimulus;
    context: Context;
    derivations: Derivation[];
  }): Promise<string> {
    const prompt = this.promptBuilder.build({
      stimulus: req.stimulus,
      context: req.context,
      derivations: req.derivations,
      workingMemory: this.agent.memory.recent(20),
      skillResults: this.agent.memory.procedural.recentResults(5000),
    });
    const stream = this.runner.run({ system: prompt, messages: [{ role: 'user', content: req.stimulus.text }] });
    let text = '';
    for await (const ev of stream) if (ev.kind === 'text-delta') text += ev.text;
    return text;
  }
}
```

The cortex is the **bridge between neural (LLM) and symbolic (engines)**. It's why the agent can both *reason rigorously* and *speak naturally*.

---

## 6. Tools as Grown Capabilities

Not "registered functions." **Procedural memory** — the agent *learns what works*:

```typescript
// core/src/motor/ToolRegistry.ts (was MettaSkills)
class ToolRegistry {
  #tools = new Map<string, ToolFn>();
  #feedback = new Map<string, SkillFeedback>();  // success-weighted

  register(name: string, fn: ToolFn): void { this.#tools.set(name, fn); }
  async execute(cmd: ParsedCommand, cid: string): Promise<ToolResult> {
    const fn = this.#tools.get(cmd.command);
    if (!fn) return { success: false, error: `Unknown tool: ${cmd.command}` };
    const start = Date.now();
    const result = await fn(...cmd.args);
    this.#reinforce(cmd.command, result, Date.now() - start);  // learn
    return result;
  }
  #reinforce(name: string, result: ToolResult, ms: number): void {
    // Update success rate, latency, last result — procedural memory grows
  }
}
```

The 15 `MettaCommandParser` commands (send, remember, query, read-file, write-file, search, shell, metta, pin, tavily-search, technical-analysis, ...) become **first-class tools**. All 15 implemented, none ignored.

---

## 7. UI as a Living Window to Mind

Not "dashboard." A **real-time projection of a living mind**:

- `AgentBridge` projects cognitive events → `CognitiveDelta` (graph ops) + `ChatMessage` (chat)
- WS server in `ui/src/server` broadcasts to all connected clients
- Store consumes deltas → reactive UI updates *as the agent thinks*
- **Lenses** = different ways of *seeing the same mind*:
  - `belief` lens — current convictions
  - `goal` lens — active drives
  - `contradiction` lens — tensions
  - `temporal` lens — scrub through cognitive history (replay!)
- **GraphRenderer abstraction** = one mind, many eyes:
  - `CytoscapeRenderer` (2D)
  - `SpaceGraphRenderer` (3D)
  - Shared sync logic, single store subscription

```typescript
// ui/src/server/index.ts — the eye opens
export async function startAgentUI(agent: Agent, port = 8765): Promise<void> {
  const bridge = new AgentBridge(agent);  // optic nerve
  const wss = new WebSocketServer({ port });
  wss.on('connection', (ws) => {
    const off = bridge.onEvent((e) => ws.send(JSON.stringify(e)));
    ws.on('close', off);
  });
}
```

The UI is **alive** because the agent is alive. Every derivation, every belief, every tool result appears *the moment it happens*.

---

## 8. Plugin Ecosystem — Symbiotic Extension

The immune system. External code extends *any* part of the mind via one context:

```typescript
// core/src/Plugin.ts (the contract we already created — now LOADED)
interface AgentPlugin {
  id: string;
  name: string;
  version: string;
  activate(ctx: PluginContext): void;
  deactivate(): void;
}

interface PluginContext {
  agent: Agent;                         // full access to the mind
  registerEngine(id: EngineId, engine: Engine): void;
  registerTool(name: string, fn: ToolFn): void;
  registerLens(spec: LensSpec): void;
  registerTransport(factory: ConnectionFactory): void;
  addMemoryTier(name: string, impl: MemoryTier): void;
  onCognitive(handler: (e: CognitiveEvent) => void): () => void;
}

// Built-in symbiotes (ships as plugins, not hardcoded):
//   plugin-irc, plugin-ws, plugin-http, plugin-mcp, plugin-cli  (senses)
//   plugin-lenses  (belief/goal/contradiction/temporal views)
//   plugin-nar, plugin-metta  (reasoning organs)
```

**No hardcoded transport types. No hardcoded engines. No hardcoded lenses.** Everything arrives via plugin. The agent is a *platform*, not a product.

---

## 9. Migration From Current State — Concrete Steps

### Step A: Birth the Hub (flattens the tower)
1. **Delete** `core/src/kernel/Kernel.ts`, `core/src/backend/Backend.ts`, `core/src/backend/EventBackend.ts`, `core/src/capability/ToolProvider.ts`, `core/src/capability/CapabilityRegistry.ts`
2. **Rewrite** `core/src/Agent.ts` as the cognitive hub (§2) — owns `log`, `memory`, `cortex`, `engines`, `motor`, `senses`, `policy`, `bridge`
3. **Create** `core/src/engine/Engine.ts` (interface)
4. **Create** `core/src/cortex/LLMCortex.ts`
5. **Create** `core/src/motor/ToolRegistry.ts` (from `MettaSkills`)
6. **Create** `core/src/senses/TransportHub.ts`
7. **Enhance** `core/src/memory/MemoryService.ts` → 5 tiers (§3)

### Step B: Birth nar/agent (unblocks everything)
8. **Create** `nar/src/agent/index.ts` exporting `createAgent(opts)` → constructs `Agent` + `NAREngine` + `AutonomyEngine` + NL services
9. **Create** `nar/src/agent/AutonomyEngine.ts` (calls `agent.cycle()` on timers)
10. **Create** `nar/src/agent/bindAgentToConnection.ts` (→ `agent.senses.mount()`)
11. **Move** `JsonlSessionManager` into `nar/src/agent/`
12. **Re-export** NL services from `nar/src/agent/`

### Step C: Vivify Engines
13. **Create** `metta/src/engine/MettaEngine.ts` (wraps `MeTTaRuntime`, implements `Engine`)
14. **Create** `nar/src/engine/NAREngine.ts` (wraps `NAR`, implements `Engine`)
15. **Wire** both into `Agent.engines` via `createAgent()` / `createMettaAgent()`

### Step D: Wire the Living Loop
16. **Implement** all 15 `MettaCommandParser` commands as `ToolRegistry` tools
17. **Connect** `Agent.cycle()` → `cortex.synthesize()` → `parser.parse()` → `motor.execute()`
18. **Persist** via `MemoryService.persist()` on shutdown, `load()` on start

### Step E: Vivify UI
19. **Delete** `ui/src/backend/VisualizationBackend.ts`, `ui/src/shared/protocol.ts`, `ui/src/client/components/lens-selector.ts`, `io/src/router.ts`
20. **Create** `ui/src/client/core/graph-renderer.ts` + `cytoscape-renderer.ts` + `spacegraph-renderer.ts`
21. **Refactor** `graph-viewport.ts`, `spacegraph-viewport.ts` → ~80 lines each
22. **Create** `ui/src/server/index.ts` (WS + AgentBridge)
23. **Wire** lenses into store (belief/goal/contradiction/temporal)

### Step F: Plugin Loader
24. **Create** `core/src/PluginLoader.ts` — discovers + activates plugins
25. **Migrate** connections (irc/ws/http/mcp/cli) → `@senars/plugin-*` packages exporting `AgentPlugin`
26. **Migrate** lens builtins → `plugin-lenses`

---

## 10. What We Keep / Kill / Birth

| Verdict | Component | Reason |
|---------|-----------|--------|
| ✅ **KEEP** | `EventLog` (InMemory, Sqlite) | The nervous system — single source of truth |
| ✅ **KEEP** | `ModelRunner` / `ChatService` | The cortex foundation |
| ✅ **KEEP** | `MettaCommandParser` (all 15) | The motor cortex — implement all |
| ✅ **KEEP** | `MettaPromptBuilder` | Context assembly |
| ✅ **KEEP** | `PolicyEngine` (core) | Prefrontal safety |
| ✅ **KEEP** | `AgentBridge` | Optic nerve |
| ✅ **KEEP** | `Plugin` interface | Immune system contract |
| ✅ **KEEP** | Connections (CLI/WS/HTTP/IRC/MCP) | The senses |
| ✅ **KEEP** | Viewports (Cytoscape/SpaceGraphJS) | The eyes |
| ✅ **KEEP** | `NAR` / `MeTTaRuntime` | The reasoning organs |
| ❌ **KILL** | `Kernel` + `Backend` + `ToolProvider` + `EventBackend` + `CapabilityRegistry` | Tower of waste |
| ❌ **KILL** | `VisualizationBackend` | Dead no-op |
| ❌ **KILL** | `MessageRouter` (io) | Agent IS the router |
| ❌ **KILL** | `ui/src/shared/protocol.ts` | Core is the protocol |
| ❌ **KILL** | `lens-selector.ts` | Duplicate of controller |
| 🌱 **BIRTH** | `Agent` as cognitive hub (§2) | The mind |
| 🌱 **BIRTH** | `Engine` interface + `NAREngine` + `MettaEngine` | Organs |
| 🌱 **BIRTH** | `LLMCortex` | Narrative voice |
| 🌱 **BIRTH** | `ToolRegistry` (from MettaSkills) | Procedural memory |
| 🌱 **BIRTH** | `TransportHub` (from ConnectionManager) | Senses hub |
| 🌱 **BIRTH** | `MemoryService` 5 tiers | Hippocampus |
| 🌱 **BIRTH** | `nar/src/agent/` (createAgent) | Unblocks all |
| 🌱 **BIRTH** | `PluginLoader` | Immune activation |
| 🌱 **BIRTH** | `GraphRenderer` + 2 impls | One mind, many eyes |

---

## 11. Success Criteria — The Vibrant Ecosystem

| Metric | Before (lifeless) | After (alive) |
|--------|----------------------|--------------------|
| Agent architecture | 3 parallel, 1 broken | **1 living process** |
| MeTTa runtimes | up to 2, unaware | **1, owned by agent** |
| Memory | 5 overlapping, mostly dead | **5 living tiers, replayable** |
| Engines | isolated, backend-wrapped | **organs, orchestrated** |
| LLM | stub (`#simulateLLMResponse`) | **narrative cortex, wired** |
| Tools | 8/15 commands ignored | **15/15 implemented, feedback-weighted** |
| UI | static, no bridge | **real-time window to mind** |
| Lenses | hardcoded, duplicate | **plugin perspectives** |
| Transports | hardcoded registry | **plugin senses** |
| Plugins | interface only | **loaded symbiotes** |
| Dead code | ~2,500 lines | **0** |
| TS errors | broken `@senars/nar/agent` | **0** |
| Replayability | none | **full cognitive time-travel** |
| Persistence | none | **hippocampus survives restart** |

---

## 12. The Philosophy

> **A cognitive agent is not a class. It is a process.**
>
> It perceives. It remembers. It reasons. It speaks. It acts. It learns. It shows itself.
>
> Every component we built was an organ waiting for a body. `Kernel` was a spine that never moved. `Backend` was a limb that never reached. `VisualizationBackend` was an eye that never opened.
>
> This plan gives them a body. One `Agent`. One `cycle()`. One `EventLog` as the nervous system. Memory that breathes. Engines that reason. A cortex that speaks. Tools that grow. A UI that *sees*.
>
> The result is not "fewer abstractions." It is **life**.

---

## 13. Execution Order (Dependency-Aware)

1. **A** — Birth the Hub (flatten tower, write Agent/Engine/Cortex/Motor/Senses/Memory)
2. **B** — Birth `nar/src/agent/` (unblocks all bins + tests)
3. **C** — Vivify engines (NAR + MeTTa as `Engine`)
4. **D** — Wire the living loop (LLM → parse → tools → consolidate)
5. **E** — Vivify UI (bridge → WS → renderers → lenses)
6. **F** — Plugin loader (symbiotes activate)

Each step is independently verifiable: `pnpm -r typecheck` + bin compilation + a live `Agent.cycle("hello")` smoke test.
