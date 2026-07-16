# NEXT.agent12.md — The Cognitive Organism (revised, codebase-grounded)

> **Vision:** *One living cognitive process — event-sourced, memory-tiered, engine-orchestrated, tool-empowered, UI-projected, plugin-extensible.* The components are not "services to wire." They are organs of one mind.
>
> **Reality check (this revision):** the previous draft invented APIs (`registerBackend`, `mount`, a brand-new `Engine`/`TransportHub`/`LLMCortex` rewrite) that *contradict the tests and the existing code*. This revision keeps the organism vision but grounds every step in what the codebase actually requires today — especially the `createAgent` contract the tests already pin down, the WS protocol the UI client already consumes, and the `ui/src/server` module the e2e test already imports. **The plan is now executable, not aspirational.**

---

## 0. Diagnosis: What We Actually Have (Post agent10/11)

| Component | State | Role in the Organism |
|-----------|-------|----------------------|
| `core/src/Agent.ts` | Facade over `Kernel` | The cognitive hub — must own cycle/memory/engines/tools |
| `core/src/kernel/Kernel.ts` | EventLog + Backend registry | **Delete.** A spine that never moved |
| `core/src/backend/*`, `core/src/capability/*` | `Backend`/`EventBackend`/`ToolProvider`/`CapabilityRegistry` | **Delete.** The tower of waste |
| `core/src/EventLog/*` | InMemory + Sqlite, healthy | **Nervous system** — single source of truth |
| `core/src/memory/MemoryService.ts` | Tier 0 ring only | **Hippocampus** — needs tiers |
| `core/src/AgentBridge.ts` | Exists, *legitimately unused* | **Optic nerve** — agent → UI projection |
| `core/src/Plugin.ts` | Interface, unused | **Immune system** contract |
| `core/src/PolicyEngine.ts` | Moved to core (metta dup remains) | **Prefrontal cortex** — safety gate |
| `core/src/ModelRunner.ts`, `core/src/ChatService.ts` | Exist, uninvoked | **Cortex** — narrative synthesis |
| `nar/src/agent/*` | **MISSING** (tests import it) | **The birth** — `createAgent` etc. |
| `nar/src/backend/NarBackendV2.ts` | Real engine, `EventBackend`+`ToolProvider` | **Reasoning organ** — absorb into Engine |
| `metta/src/backend/MettaBackendV2.ts` | Real engine, `EventBackend`+`ToolProvider` | **Symbolic organ** — absorb into Engine |
| `metta/src/runtime/builder.ts` | `MeTTaRuntime`/`createMeTTa` (Effect) | **Symbolic substrate** |
| `metta/src/agent/MettaAgent.ts` | 84-line thin wrapper → core Agent | **Keep** as a class |
| `metta/src/agent/MettaCommandParser.ts` | 15 cmds, 8 ignored | **Motor cortex** — implement all 15 |
| `metta/src/agent/MettaPromptBuilder.ts`, `MettaSkills.ts` | Prompt + feedback map | **Context + procedural memory** |
| `nar/src/index.ts`, `nar/src/factory.ts` | `createNAR`, `SeNARSFactory` | Engine factory foundation |
| `src/bin/*` (7 bins) | Import `@senars/nar/agent` + fictional `Agent.registerBackend` | **All broken** until `nar/agent` exists |
| `io/src/*` | ConnectionManager + cli/ws/http/irc/mcp + `MessageRouter` | **Senses** + `MessageRouter` (KEEP — tests use it) |
| `ui/src/client/*` | store/ws-client/entry + cytoscape/spacegraph viewports | **The eyes** — consume `IncomingFromServer` |
| `ui/src/server/*` | **MISSING** (e2e imports `@senars/ui/server`) | **Must create** the WS eye |
| `ui/src/backend/VisualizationBackend.ts` | Dead no-op | **Delete.** AgentBridge is the eye |
| `ui/src/shared/protocol.ts` | Duplicate of core Protocol | **Delete.** Core is the protocol |
| Tests (~50) | Broken on `@senars/nar/agent` / fictional API | **Repaired** via `nar/src/agent` birth |

---

## 1. The Real Contract (from the tests — this is the spec)

We do NOT get to invent the API. The tests already pin it:

### `createAgent(opts)` — `nar/src/agent/index.ts`
Returned object (`tests/unit/agent/AgentV6.test.ts`, `tests/conversational/framework.ts`):
```
chat(text) : Promise<string>            // returns '+ (cat --> animal).' or 'Hi there!' or 'Question queued: ...'
chatStream(text, opts) : AsyncIterable<ChatEvent>   // {kind:'tool-call'|'text'|'error', ...}
believe(text) : Promise<void>
recall(query?) : Promise<Episode[]>
know(text) : Promise<void>  /  knowList()  /  knowGet()
setThrottle(n) / getThrottle()          // clamp 0..100
getNAR() / getEpisodicMemory()
start() : () => void                    // returns idempotent stop fn
stop()
getRecentDerivations() : Derivation[]
```

### `nar/src/agent` must re-export (from `tests/unit/agent/IOBridge.test.ts`)
```
createAgent, createAgentDispatch, bindAgentToConnection, createSession,
createSessionBinder, createAuthMiddleware, createCommandInterceptor,
createConnectionConfigsFromEnv, createErrorBoundary, createRateLimiter,
originExtractor, resolveSessionKey,
AuthManager, CommandRegistry, MessageRouter   // (from @senars/io)
```
→ `nar/src/agent/index.ts` re-exports the I/O glue from `@senars/io` and `@senars/core`; it does **not** define a new router.

### `ui/src/server` — `startAgentUI(agent, opts)` (`tests/e2e/agent-smoke.test.ts`)
```
startAgentUI(agent, { port: 0, bootstrap: false }) : Promise<TestServer>
TestServer.address() -> { port: number }
TestServer.close() : Promise<void>
```
It opens a WebSocket server on `/ws` that streams `IncomingFromServer` messages.

### WS protocol the UI client expects (`ui/src/client/core/ws-client.ts`, `IncomingFromServer`)
```
server → client:  cognitive.delta, chat.agent.stream, chat.agent.complete,
                  state.snapshot, config.schema, telemetry, lens.fields, lens.list,
                  lens.delta, focus.delta
client → server:  chat.user, lens.set, focus.set, command.*
```
`cognitive.delta.ops` uses `action: 'add_node' | 'add_edge' | 'update_node' | 'remove_node'`, `op.id`, `op.lens`.

**Conclusion:** the previous draft's "kill MessageRouter / AgentBridge / lenses" is wrong *for the prototype*. `MessageRouter` is required by tests; `AgentBridge` is the real optic nerve; lenses are real UI features. We **keep** these and only delete genuinely dead code (`VisualizationBackend`, `ui/src/shared/protocol.ts`).

---

## 2. The Unified Architecture

```
                          ┌─────────────────────────────────────┐
                          │            AGENT (The Mind)          │
                          │                                     │
    SENSES ───────────▶   │  ConnectionManager (mount/submit)    │
    (cli/ws/http/        │        │                            │
     irc/mcp)            │        ▼                            │
                          │  working memory (Tier 0)        │
                          │        │                            │
                          │        ▼                            │
                          │  ┌─────────── cognitive cycle ──┐  │
                          │  │ 1. perceive (append EventLog)│  │
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
    UI ◀───────────────  │  AgentBridge → ui/src/server (WS) │
    (living window)        └─────────────────────────────────────┘
                          │            ▲
                          │  PluginContext (symbiotes extend all of the above)
```

**One process. One event log. One memory. Many engines. Many tools. One UI window. Infinite plugins.**

---

## 3. The Cognitive Cycle

The agent already has a working `chat`/`believe` parser path (Narsese gate → NAR, else LM). We **extend** it into the 6-phase cycle rather than rewriting from scratch. The existing `NarBackendV2.process()` / `MettaBackendV2.process()` already implement the perceive→derive→event-emit pattern; we promote them to `Engine` and let `Agent.cycle()` orchestrate.

```typescript
// core/src/Agent.ts (evolution, not revolution)
class Agent {
  readonly id: string;
  readonly log: EventLog;                  // nervous system
  readonly memory: MemoryService;           // hippocampus (tiers)
  readonly cortex: LLMCortex;              // narrative synthesis (wraps ModelRunner/ChatService)
  readonly engines = new Map<EngineId, Engine>();   // reasoning organs
  readonly motor: ToolRegistry;            // grown capabilities (from MettaSkills)
  readonly policy: PolicyEngine;           // safety gate
  readonly bridge: AgentBridge;            // → UI

  // The living cycle — every stimulus passes through it
  async cycle(stimulus: CognitiveStimulus): Promise<void> {
    const cid = this.log.append({ type: 'input.user', payload: stimulus });
    const context = await this.memory.recall(stimulus, { tiers: ['episodic', 'semantic'] });
    const derivations = await this.reason(stimulus, context);
    const narrative = await this.cortex.synthesize({ stimulus, context, derivations });
    const actions = this.parser.parse(narrative);
    for (const action of actions) {
      if (!this.policy.checkCommand(action.command).allowed) continue;
      const result = await this.motor.execute(action, cid);
      this.memory.append({ type: 'skill_result', payload: result, correlationId: cid });
      for (const engine of this.engines.values()) engine.absorb?.(result);
    }
    await this.memory.consolidate(cid);
    this.bridge.project(this.memory.recent(50));
  }
}
```

**Kills:** `Kernel`, `Backend`, `EventBackend`, `ToolProvider`, `CapabilityRegistry` (the tower). Everything else is absorbed, not deleted.

---

## 4. Memory as a Living, Tiered System

`MemoryService` today is Tier 0 only. The organism needs 5 tiers. The semantic tier delegates to the engines' own stores (NAR beliefs, MeTTa spaces) — no separate store needed.

```typescript
class MemoryService {
  #working: RingBuffer<MemoryEntry>;                 // Tier 0: working
  async queryTimeRange(from, to) {                  // Tier 1: episodic (EventLog replay)
    return this.log.query({ types: ['input.user','derivation','skill_result'], from, to });
  }
  async recall(pattern, opts?) {                    // Tier 2: semantic (delegates to engines)
    const out = [];
    if (this.engines.get('metta')) out.push(...await this.engines.get('metta')!.query(pattern));
    if (this.engines.get('nar'))   out.push(...await this.engines.get('nar')!.queryBeliefs(pattern));
    return out;
  }
  #procedural = new SkillRegistry();                // Tier 3: procedural (was MettaSkills)
  async persist() { for (const e of this.engines.values()) await e.persist?.(); }  // Tier 4: LTM
  async consolidate(cid) { /* promote high-salience → semantic; success patterns → procedural */ }
}
```

**Self-remembering:** it remembers by replay; it learns what works; it persists across restarts.

---

## 5. Engines as First-Class Organs

The existing `NarBackendV2` / `MettaBackendV2` already implement `EventBackend` + `ToolProvider` with a `process()` method that appends to an EventLog and emits deltas. We promote that shape to a clean `Engine` interface and let `Agent` own the EventLog (instead of each backend owning its own). This **removes the duplicate EventLog-per-backend** problem cleanly.

```typescript
// core/src/engine/Engine.ts
interface Engine {
  readonly id: EngineId;
  readonly provides: Set<Capability>;
  reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]>;
  evaluate(sexpr: string, context: Context): Promise<Atom[]>;   // symbolic engines
  query(pattern: string): Promise<Atom[]>;
  absorb?(result: ToolResult): void;
  persist?(): Promise<void>;
  load?(): Promise<void>;
}

class NAREngine  implements Engine { id = 'nar';   /* wraps NAR, was NarBackendV2 */ }
class MettaEngine implements Engine { id = 'metta'; /* wraps MeTTaRuntime, was MettaBackendV2 */ }
// LLM is the cortex (§6), not an engine.
```

Adding a new reasoning organ (vector DB, rule engine) = one `Engine` + `agent.registerEngine(it)`.

---

## 6. The LLM as Narrative Cortex

The LLM is the **voice + translator**: symbolic derivations → natural explanation; natural language → symbolic intents via `MettaCommandParser`. `ModelRunner`/`ChatService` already exist as the foundation — `LLMCortex` wraps them. `MettaPromptBuilder` assembles context from all memory tiers.

```typescript
class LLMCortex {
  async synthesize(req: { stimulus; context; derivations }) {
    const prompt = this.promptBuilder.build({ ...req, workingMemory: this.agent.memory.recent(20) });
    const stream = this.runner.run({ system: prompt, messages: [{ role:'user', content: req.stimulus.text }] });
    let text = ''; for await (const ev of stream) if (ev.kind === 'text-delta') text += ev.text;
    return text;
  }
}
```

The cortex is the **bridge between neural (LLM) and symbolic (engines)** — why the agent reasons rigorously *and* speaks naturally.

---

## 7. Tools as Grown Capabilities

`MettaSkills` is already feedback-weighted procedural memory. Promote it to `ToolRegistry`. The 15 `MettaCommandParser` commands (send, remember, query, read-file, write-file, search, shell, metta, pin, tavily-search, technical-analysis, …) become **first-class tools** — all 15 implemented, none ignored.

```typescript
class ToolRegistry {
  #tools = new Map<string, ToolFn>();
  #feedback = new Map<string, SkillFeedback>();   // success-weighted
  register(name, fn) { this.#tools.set(name, fn); }
  async execute(cmd, cid) { /* run + reinforce into procedural memory */ }
}
```

---

## 8. UI as a Living Window to Mind

`AgentBridge` already exists and is the optic nerve. We build `ui/src/server` (missing) to host the WS server that streams `IncomingFromServer`. The UI store already consumes these. **Lenses** = different ways of *seeing the same mind* (belief/goal/contradiction/temporal). **GraphRenderer abstraction** = one mind, many eyes (Cytoscape 2D + SpaceGraph 3D), sharing one store subscription.

```typescript
// ui/src/server/index.ts — the eye opens
export async function startAgentUI(agent: Agent, opts: { port?: number; bootstrap?: boolean }) {
  const bridge = new AgentBridge(agent);
  const wss = new WebSocketServer({ port: opts.port ?? 8765 });
  wss.on('connection', (ws) => {
    const off = bridge.onEvent((e) => ws.send(JSON.stringify(e)));
    ws.on('close', off);
  });
  return { address: () => ({ port: (wss.address() as any).port }), close: () => wss.close() };
}
```

The UI is **alive** because the agent is alive: every derivation, belief, tool result appears *the moment it happens*.

---

## 9. Plugin Ecosystem — Symbiotic Extension

`Plugin` interface (core) is the immune-system contract. `PluginContext` exposes the whole mind:

```typescript
interface PluginContext {
  agent: Agent;
  registerEngine(id, engine): void;
  registerTool(name, fn): void;
  registerLens(spec): void;
  registerTransport(factory): void;
  addMemoryTier(name, impl): void;
  onCognitive(handler): () => void;
}
```

No hardcoded transport types, engines, or lenses — everything arrives via plugin. The agent is a *platform*, not a product.

---

## 10. Migration — Concrete, Test-Aligned Steps

### Step A — Birth `nar/src/agent` (unblocks ALL bins + tests) — DO FIRST
1. **Create** `nar/src/agent/index.ts` exporting `createAgent(opts)` (the exact contract in §1) — builds `Agent` + `NAREngine` + NL services + `EpisodicMemory`; returns the object with `.chat/.chatStream/.believe/.recall/.know/.knowList/.knowGet/.setThrottle/.getThrottle/.getNAR/.getEpisodicMemory/.start/.stop/.getRecentDerivations`.
2. **Re-export** from `nar/src/agent/index.ts`: `createAgentDispatch`, `bindAgentToConnection`, `createSession`, `createSessionBinder`, `createAuthMiddleware`, `createCommandInterceptor`, `createConnectionConfigsFromEnv`, `createErrorBoundary`, `createRateLimiter`, `originExtractor`, `resolveSessionKey` (re-export from `@senars/io` + `@senars/core` — do NOT redefine a router).
3. **Add** `./agent` back to `nar/package.json` exports (it was removed in agent10/11 — that broke everything).
4. **Repair** `src/bin/*` (7 bins) to use the real `createAgent` signature instead of the fictional `new Agent({name}).registerBackend(...)`.
5. **Verify:** `pnpm -r typecheck` + `vitest run tests/unit/agent/AgentV6.test.ts tests/conversational` pass.

### Step B — Flatten the tower (Agent becomes the hub)
6. **Delete** `core/src/kernel/Kernel.ts`, `core/src/backend/Backend.ts`, `core/src/backend/EventBackend.ts`, `core/src/capability/ToolProvider.ts`, `core/src/capability/CapabilityRegistry.ts`.
7. **Rewrite** `core/src/Agent.ts` to own `log`, `memory`, `cortex`, `engines`, `motor`, `policy`, `bridge` (§3). Keep the existing `chat`/`believe` parser behavior so tests stay green.
8. **Create** `core/src/engine/Engine.ts` (interface).
9. **Enhance** `core/src/memory/MemoryService.ts` → 5 tiers (§4).
10. **Create** `core/src/cortex/LLMCortex.ts` (wraps `ModelRunner`/`ChatService` + `MettaPromptBuilder`).
11. **Create** `core/src/motor/ToolRegistry.ts` (from `MettaSkills`).
12. **Verify:** `pnpm -r typecheck`.

### Step C — Vivify engines
13. **Create** `nar/src/engine/NAREngine.ts` (absorb `NarBackendV2.process()` logic; Agent owns the EventLog).
14. **Create** `metta/src/engine/MettaEngine.ts` (absorb `MettaBackendV2`; wrap `MeTTaRuntime`).
15. **Wire** both into `Agent.engines` via `createAgent()` / `createMettaAgent()`.
16. **Verify:** engines register; `agent.reason()` returns derivations.

### Step D — Wire the living loop
17. **Implement all 15** `MettaCommandParser` commands as `ToolRegistry` tools.
18. **Connect** `Agent.cycle()` → `cortex.synthesize()` → `parser.parse()` → `motor.execute()` → `memory.consolidate()`.
19. **Persist** via `MemoryService.persist()` on shutdown, `load()` on start.
20. **Verify:** `agent.chat('(cat --> animal).')` still returns `'+ (cat --> animal).'`; NL path still hits LM.

### Step E — Vivify UI
21. **Delete** `ui/src/backend/VisualizationBackend.ts`, `ui/src/shared/protocol.ts` (use core `Protocol`).
22. **Create** `ui/src/server/index.ts` (`startAgentUI`) — the missing module the e2e test imports. Bridge `AgentBridge` → `IncomingFromServer` over `/ws`.
23. **Extract** `ui/src/client/core/graph-renderer.ts` + `cytoscape-renderer.ts` + `spacegraph-renderer.ts`; refactor `graph-viewport.ts` / `spacegraph-viewport.ts` to ~80 lines each.
24. **Wire** lenses into store (belief/goal/contradiction/temporal).
25. **Verify:** `vitest run tests/e2e/agent-smoke.test.ts` passes (WS boot, `cognitive.delta`, `config.schema`, `lens.*`, Narsese over WS grows graph).

### Step F — Plugin loader
26. **Create** `core/src/PluginLoader.ts` — discovers + activates plugins.
27. **Migrate** connections (irc/ws/http/mcp/cli) and lens builtins → `@senars/plugin-*` packages exporting `AgentPlugin`.
28. **Verify:** `pnpm -r typecheck` + full `vitest run`.

---

## 11. What We Keep / Kill / Birth

| Verdict | Component | Reason |
|---------|-----------|--------|
| ✅ KEEP | `EventLog` (InMemory, Sqlite) | Nervous system — single source of truth |
| ✅ KEEP | `ModelRunner`/`ChatService` | Cortex foundation |
| ✅ KEEP | `MettaCommandParser` (all 15) | Motor cortex — implement all |
| ✅ KEEP | `MettaPromptBuilder`, `MettaSkills` | Context + procedural memory |
| ✅ KEEP | `PolicyEngine` (core) — delete metta dup | Prefrontal safety |
| ✅ KEEP | `AgentBridge` | Optic nerve (real, required) |
| ✅ KEEP | `Plugin` interface | Immune-system contract |
| ✅ KEEP | `MessageRouter` + connections (io) | **Required by tests** — the senses |
| ✅ KEEP | `NAR` / `MeTTaRuntime` | Reasoning organs |
| ✅ KEEP | UI viewports + store + ws-client | The eyes |
| ❌ KILL | `Kernel` + `Backend` + `ToolProvider` + `EventBackend` + `CapabilityRegistry` | Tower of waste |
| ❌ KILL | `VisualizationBackend` | Dead no-op |
| ❌ KILL | `ui/src/shared/protocol.ts` | Core is the protocol |
| ❌ KILL | `metta/src/agent/PolicyEngine.ts` | Duplicate of core |
| 🌱 BIRTH | `nar/src/agent/` (`createAgent` + contract) | Unblocks all — **Step A, first** |
| 🌱 BIRTH | `Engine` interface + `NAREngine` + `MettaEngine` | Organs |
| 🌱 BIRTH | `LLMCortex` | Narrative voice |
| 🌱 BIRTH | `ToolRegistry` (from MettaSkills) | Procedural memory |
| 🌱 BIRTH | `MemoryService` 5 tiers | Hippocampus |
| 🌱 BIRTH | `ui/src/server` (`startAgentUI`) | The WS eye |
| 🌱 BIRTH | `PluginLoader` | Immune activation |
| 🌱 BIRTH | `GraphRenderer` + 2 impls | One mind, many eyes |

---

## 12. Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| Agent architecture | 3 parallel, 1 broken | **1 living process** |
| Engines | isolated, backend-wrapped | **organs, orchestrated** |
| Memory | Tier 0 only | **5 living tiers, replayable** |
| Tools | 8/15 ignored | **15/15, feedback-weighted** |
| UI | no server, no bridge | **real-time window to mind** |
| `nar/agent` | missing (all bins/tests broken) | **exists, contract-matched** |
| `ui/server` | missing (e2e imports it) | **exists, WS streaming** |
| Dead code | ~2,500 lines | **0** |
| TS errors | broken `@senars/nar/agent` | **0** |
| Tests | ~50 broken | **green** |
| Persistence | none | **hippocampus survives restart** |

---

## 13. Philosophy

> **A cognitive agent is not a class. It is a process.**
>
> It perceives. It remembers. It reasons. It speaks. It acts. It learns. It shows itself.
>
> `Kernel` was a spine that never moved. `Backend` was a limb that never reached. `VisualizationBackend` was an eye that never opened. This plan gives them a body — one `Agent`, one `cycle()`, one `EventLog` as the nervous system, memory that breathes, engines that reason, a cortex that speaks, tools that grow, a UI that *sees*.
>
> **But unlike the previous draft, this body is built from the parts we already have and tested — not from APIs we invent.** The organism is real; we are only waking it.

---

## 10. Migration — Concrete, Test-Aligned Steps

### Step A — Birth `nar/src/agent` (unblocks ALL bins + tests) — DO FIRST
1. **Create** `nar/src/agent/index.ts` exporting `createAgent(opts)` (the exact contract in §1) — builds `Agent` + `NAREngine` + NL services + `EpisodicMemory`; returns the object with `.chat/.chatStream/.believe/.recall/.know/.knowList/.knowGet/.setThrottle/.getThrottle/.getNAR/.getEpisodicMemory/.start/.stop/.getRecentDerivations`.
2. **Re-export** from `nar/src/agent/index.ts`: `createAgentDispatch`, `bindAgentToConnection`, `createSession`, `createSessionBinder`, `createAuthMiddleware`, `createCommandInterceptor`, `createConnectionConfigsFromEnv`, `createErrorBoundary`, `createRateLimiter`, `originExtractor`, `resolveSessionKey` (re-export from `@senars/io` + `@senars/core` — do NOT redefine a router).
3. **Add** `./agent` back to `nar/package.json` exports (it was removed in agent10/11 — that broke everything).
4. **Repair** `src/bin/*` (7 bins) to use the real `createAgent` signature instead of the fictional `new Agent({name}).registerBackend(...)`.
5. **Verify:** `pnpm -r typecheck` + `vitest run tests/unit/agent/AgentV6.test.ts tests/conversational` pass.

### Step B — Flatten the tower (Agent becomes the hub)
6. **Delete** `core/src/kernel/Kernel.ts`, `core/src/backend/Backend.ts`, `core/src/backend/EventBackend.ts`, `core/src/capability/ToolProvider.ts`, `core/src/capability/CapabilityRegistry.ts`.
7. **Rewrite** `core/src/Agent.ts` to own `log`, `memory`, `cortex`, `engines`, `motor`, `policy`, `bridge` (§3). Keep the existing `chat`/`believe` parser behavior so tests stay green.
8. **Create** `core/src/engine/Engine.ts` (interface).
9. **Enhance** `core/src/memory/MemoryService.ts` → 5 tiers (§4).
10. **Create** `core/src/cortex/LLMCortex.ts` (wraps `ModelRunner`/`ChatService` + `MettaPromptBuilder`).
11. **Create** `core/src/motor/ToolRegistry.ts` (from `MettaSkills`).
12. **Verify:** `pnpm -r typecheck`.

### Step C — Vivify engines
13. **Create** `nar/src/engine/NAREngine.ts` (absorb `NarBackendV2.process()` logic; Agent owns the EventLog).
14. **Create** `metta/src/engine/MettaEngine.ts` (absorb `MettaBackendV2`; wrap `MeTTaRuntime`).
15. **Wire** both into `Agent.engines` via `createAgent()` / `createMettaAgent()`.
16. **Verify:** engines register; `agent.reason()` returns derivations.

### Step D — Wire the living loop
17. **Implement all 15** `MettaCommandParser` commands as `ToolRegistry` tools.
18. **Connect** `Agent.cycle()` → `cortex.synthesize()` → `parser.parse()` → `motor.execute()` → `memory.consolidate()`.
19. **Persist** via `MemoryService.persist()` on shutdown, `load()` on start.
20. **Verify:** `agent.chat('(cat --> animal).')` still returns `'+ (cat --> animal).'`; NL path still hits LM.

### Step E — Vivify UI
21. **Delete** `ui/src/backend/VisualizationBackend.ts`, `ui/src/shared/protocol.ts` (use core `Protocol`).
22. **Create** `ui/src/server/index.ts` (`startAgentUI`) — the missing module the e2e test imports. Bridge `AgentBridge` → `IncomingFromServer` over `/ws`.
23. **Extract** `ui/src/client/core/graph-renderer.ts` + `cytoscape-renderer.ts` + `spacegraph-renderer.ts`; refactor `graph-viewport.ts` / `spacegraph-viewport.ts` to ~80 lines each.
24. **Wire** lenses into store (belief/goal/contradiction/temporal).
25. **Verify:** `vitest run tests/e2e/agent-smoke.test.ts` passes (WS boot, `cognitive.delta`, `config.schema`, `lens.*`, Narsese over WS grows graph).

### Step F — Plugin loader
26. **Create** `core/src/PluginLoader.ts` — discovers + activates plugins.
27. **Migrate** connections (irc/ws/http/mcp/cli) and lens builtins → `@senars/plugin-*` packages exporting `AgentPlugin`.
28. **Verify:** `pnpm -r typecheck` + full `vitest run`.

---

## 11. Missing Functionality & Integrations (Complete Usability)

### 11.1 Configuration System
**Gap:** No unified config — bins use ad-hoc CLI args, env vars, hardcoded defaults.
**Solution:** `core/src/config/Config.ts` — single source of truth.
```typescript
interface AgentConfig {
  name: string;
  nar?: NARConfig;
  metta?: MettaConfig;
  llm?: LLMConfig;
  memory: MemoryConfig;        // tiers, persistence dir, retention
  senses: SenseConfig[];       // transports to mount (ws, cli, irc, mcp, http)
  plugins: string[];           // plugin package names to load
  policy: PolicyConfig;        // allowed/denied commands, rate limits
  ui?: { port: number; bootstrap: boolean };
}
```
- **CLI**: `senars --config file.json` / env `SENARS_CONFIG` / programmatic `createAgent({config})`
- **Validation**: Zod schema → `config.schema` WS message for UI
- **Presets**: `createAgentPreset('chat'|'reasoning'|'autonomous'|'irc-bot')` returns `Partial<AgentConfig>`

### 11.2 Logging & Observability
**Gap:** Only `telemetry` WS message; no structured logs, no metrics export.
**Solution:**
- `core/src/observability/Logger.ts` — pino-based, child loggers per component (`agent.nar`, `agent.metta`, `agent.llm`, `transport.ws`, etc.)
- `core/src/observability/Metrics.ts` — counters/histograms for: cycle latency, tool exec time, LLM tokens, memory tier sizes, WS msg throughput
- **Export**: Prometheus `/metrics` endpoint (via HTTP transport), JSONL file rotation
- **Correlation IDs**: Every `cycle()` gets `cid` propagated through log/memory/bridge

### 11.3 Error Handling & Recovery
**Gap:** No error boundaries, no user-facing error reporting, no recovery strategy.
**Solution:**
- `core/src/errors/AgentError.ts` — typed errors: `EngineError`, `ToolError`, `PolicyViolation`, `ConfigError`, `TransportError`
- `AgentBridge` projects errors → `chat.agent.error` WS message (UI shows toast)
- **Retry policy**: per-tool configurable (exponential backoff, max attempts)
- **Circuit breaker**: per-engine (stop calling after N failures, auto-recover after timeout)
- **Graceful degradation**: if LLM fails → fall back to symbolic-only; if NAR fails → LM-only

### 11.4 Session Management & Persistence
**Gap:** `createSession` exists but no persistence, no restore, no multi-device sync.
**Solution:**
- `JsonlSessionManager` (already in `nar/agent`) → persist to `~/.senars/sessions/{sessionId}.jsonl`
- **Restore**: `createAgent({ sessionId })` → loads session, replays EventLog to rebuild memory tiers
- **Multi-device**: WS server broadcasts `state.snapshot` on connect; clients can request full replay via `command.replay { from, to }`

### 11.5 Authentication & Authorization
**Gap:** `AuthManager` re-exported but not integrated.
**Solution:**
- **Transports** (WS, HTTP, MCP) accept `auth: AuthConfig` — JWT, API key, or none
- `PolicyEngine` checks `principal.permissions` before tool execution
- **Default**: dev mode = no auth; prod mode = require `SENARS_AUTH_SECRET`

### 11.6 Rate Limiting & Quotas
**Gap:** `createRateLimiter` re-exported but not wired.
**Solution:**
- Per-connection rate limiter (token bucket) in `ConnectionManager`
- Per-tool quota in `PolicyConfig` (e.g., `shell: 10/min`, `tavily-search: 100/day`)
- Exposed via `config.schema` → UI shows remaining quota

### 11.7 Health Checks & Lifecycle
**Gap:** No `/health`, no startup/shutdown hooks, no readiness probe.
**Solution:**
- `Agent.health()` → `{ status: 'healthy'|'degraded'|'unhealthy', checks: { nar: bool, metta: bool, llm: bool, memory: bool, transports: Record<string,bool> } }`
- HTTP transport exposes `GET /health` (k8s-ready)
- **Signals**: `SIGTERM` → `agent.stop()` → `MemoryService.persist()` → `transport.close()` → `process.exit(0)`
- **Startup order**: config → log → memory → engines → cortex → motor → policy → bridge → senses → autonomy

### 11.8 Security & Sandboxing
**Gap:** `shell`, `read-file`, `write-file` tools run unrestricted.
**Solution:**
- `ToolRegistry` executes tools in **vm2** sandbox (or `node:vm` with limited globals)
- **Allowlist**: `PolicyConfig.allowedPaths` for file tools; `PolicyConfig.allowedCommands` for shell
- **Resource limits**: CPU time, memory, output size per tool invocation
- **Audit log**: every tool execution logged with principal, args, result, duration

### 11.9 Multi-Agent Coordination
**Gap:** `multi-agent.ts`, `multi-agent-demo.ts` bins exist but no coordination protocol.
**Solution:**
- **Agent-to-agent**: WS transport + `command.delegate { agentId, task }` message
- **Shared EventLog**: SqliteEventLog with `agent_id` column — multiple agents write, all read
- **Discovery**: mDNS/bonjour for LAN; config for static peers
- **Consensus**: Raft-lite for shared memory writes (future)

### 11.10 MCP Integration
**Gap:** `mcp-server.ts` bin + `io/src/connections/mcp.ts` exist but not integrated into Agent.
**Solution:**
- `McpTransport` implements `Connection` — speaks MCP protocol over stdio/WS
- **Tools exposed as MCP tools**: `agent.chat`, `agent.believe`, `agent.recall`, `agent.know`
- **Resources exposed**: `memory://working`, `memory://episodic`, `engine://nar/beliefs`, `engine://metta/space`
- **Prompts exposed**: `agent://system-prompt`, `agent://task-template`

### 11.11 IRC Bot Integration
**Gap:** `bot-ai.ts` bin + `irc.ts` connection — standalone, not using Agent.
**Solution:**
- `IrcTransport` mounts like any sense — `agent.senses.mount(new IrcTransport(config))`
- **Channel mapping**: `#channel` → `sessionId` — each channel gets independent session
- **Commands**: `!senars <input>` → `agent.chat()` → reply in channel
- **Personality**: per-channel `AgentConfig` (different prompts, memory isolation)

### 11.12 REPL UX
**Gap:** `repl.ts` bin — basic readline, no history, completion, colors.
**Solution:**
- **History**: `~/.senars/repl_history` (persisted, searchable with Ctrl+R)
- **Completion**: Tab completes Narsese terms, tool names, lens names
- **Colors**: Syntax highlight for Narsese, tool output, errors
- **Multiline**: `\` continuation, Ctrl+Enter to submit
- **Commands**: `.help`, `.memory`, `.engines`, `.config`, `.quit`

### 11.13 Agent Capabilities Negotiation
**Gap:** `AgentCapabilities` in protocol but not implemented.
**Solution:**
- `Agent.capabilities()` → `{ engines: ['nar','metta'], tools: ['remember','query',...], lenses: ['belief','goal',...], maxContextTokens: 8192 }`
- UI calls on connect → renders only available panels/lenses/tools
- **Versioned**: `capabilities.v2` for future extensions

### 11.14 Lens System — Detailed
**Gap:** Lenses mentioned but no API spec.
**Solution:**
```typescript
interface LensSpec {
  id: string;              // 'belief' | 'goal' | 'contradiction' | 'temporal' | 'custom'
  label: string;
  description: string;
  query: (memory: MemoryService, focus?: string) => Promise<GraphDelta>;
  refreshMs?: number;      // auto-refresh interval
  controls?: LensControl[]; // UI controls (slider, dropdown, input)
}
```
- **Built-in**: `belief` (current NAR convictions), `goal` (active drives), `contradiction` (tension pairs), `temporal` (time-slider replay)
- **Custom**: plugins register via `PluginContext.registerLens(spec)`

### 11.15 Focus System
**Gap:** `focus.set` in protocol, no implementation.
**Solution:**
- `AgentBridge` tracks `focus: { term: string; lens: string; timestamp: number }`
- `focus.set { term }` → `AgentBridge` emits `focus.delta` → UI centers graph on term
- **Persisted**: focus state in session → restored on reconnect

### 11.16 Command Protocol
**Gap:** `command.*` from client — no router.
**Solution:**
- `AgentBridge` handles `command.*`:
  - `command.replay { from, to }` → streams `cognitive.delta` for range
  - `command.export { format: 'jsonl'|'graphml' }` → returns download URL
  - `command.lens { id, params }` → switches lens, emits `lens.delta`
  - `command.config { key, value }` → updates runtime config (throttle, etc.)

### 11.17 State Snapshot Format
**Gap:** `state.snapshot` message — no schema.
**Solution:**
```typescript
interface StateSnapshot {
  agent: { id: string; name: string; uptimeMs: number; health: HealthStatus };
  memory: { working: number; episodic: number; semantic: number; procedural: number };
  engines: Record<string, { status: 'ready'|'busy'|'error'; stats: EngineStats }>;
  tools: Record<string, { calls: number; errors: number; avgMs: number }>;
  transports: Record<string, { connected: boolean; msgIn: number; msgOut: number }>;
  focus: { term?: string; lens?: string } | null;
}
```

### 11.18 Chat Message Types
**Gap:** `chat.agent.stream`, `chat.agent.complete` — no format spec.
**Solution:**
```typescript
// stream (per token/delta)
{ type: 'chat.agent.stream', delta: string, kind: 'text'|'tool-call'|'tool-result', toolName?: string, toolArgs?: unknown, toolResult?: ToolResult }

// complete (final)
{ type: 'chat.agent.complete', text: string, tools: Array<{name, args, result}>, derivations: Derivation[], cid: string }
```

### 11.19 Cognitive Delta Ops
**Gap:** `cognitive.delta.ops` structure — partial spec only.
**Solution:**
```typescript
type GraphOp =
  | { action: 'add_node'; id: string; data: GraphNodeData; lens: string }
  | { action: 'add_edge'; id: string; source: string; target: string; data: GraphEdgeData; lens: string }
  | { action: 'update_node'; id: string; data: Partial<GraphNodeData>; lens: string }
  | { action: 'remove_node'; id: string; lens: string }
  | { action: 'remove_edge'; source: string; target: string; lens: string };

interface CognitiveDelta {
  ops: GraphOp[];
  lens: string;
  timestamp: number;
  correlationId: string;
}
```

### 11.20 Graph Node/Edge Data Models
**Gap:** `GraphNodeData`, `GraphEdgeData` in protocol — not defined in plan.
**Solution:**
```typescript
interface GraphNodeData {
  id: string;
  label: string;
  type: 'concept'|'belief'|'goal'|'question'|'skill'|'episode';
  truth?: TruthValue;           // NAR: {frequency, confidence}
  metadata?: Record<string, unknown>; // engine-specific (metta: space, atoms; nar: term)
  position?: { x: number; y: number; z?: number }; // for layout persistence
}

interface GraphEdgeData {
  source: string;
  target: string;
  type: 'inheritance'|'implication'|'similarity'|'temporal'|'causal'|'skill_result';
  strength?: number;
  metadata?: Record<string, unknown>;
}
```

---

## 12. Developer Experience (DX) — Consistent, Intuitive

### 12.1 TypeScript Configuration
- **Strict mode** everywhere: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- **Path aliases**: `@senars/core`, `@senars/nar`, `@senars/metta`, `@senars/io`, `@senars/ui` (already in tsconfig)
- **Declaration maps**: `declarationMap: true` → debuggable node_modules
- **No emit**: `noEmit: true` for typecheck; separate `build` script for dist

### 12.2 Build Pipeline
- **Bins**: `esbuild` → single-file ESM bundles in `dist/bin/` (fast, no bundler config)
- **UI**: `vite build` → `dist/ui/` (static assets + `index.html`)
- **Packages**: `tsc --project tsconfig.build.json` → `dist/` with `.d.ts` + `.js` (for plugin consumers)

### 12.3 Testing Strategy
| Layer | Tool | Scope | Fixtures |
|-------|------|-------|----------|
| Unit | vitest | Pure functions (parser, memory, policy) | Inline data |
| Integration | vitest | `createAgent` + engines + memory | `SeNARSFactory.createForTesting()` |
| Contract | vitest | WS protocol (client↔server) | `TestServer` + `WebSocket` |
| E2E | playwright | Full UI + agent (headed) | Dedicated test agent |
| Property | fast-check | Narsese parser, MemoryService tiers | Generators |

- **No mocks** — test real objects (per AGENTS.md)
- **Deterministic**: `createForTesting()` seeds, no timers (use `vi.useFakeTimers()`)
- **Parallel**: `vitest --pool=forks`

### 12.4 Documentation
- **API**: TypeDoc → `docs/api/` (auto-generated from JSDoc)
- **Architecture**: `ARCHITECTURE.md` (this plan + ADRs)
- **ADRs**: `docs/adr/NNN-title.md` (one per major decision)
- **Guides**: `docs/guides/` — getting started, plugins, deployment, debugging
- **CLI help**: `senars --help` + `senars <cmd> --help` (generated from command definitions)

### 12.5 Release Process
- **Versioning**: SemVer via `changesets` (monorepo-aware)
- **Changelog**: Auto-generated from changesets
- **Publish**: `pnpm publish -r --access public` (GitHub Actions on tag)
- **Docker**: `Dockerfile` per bin + UI (multi-arch)

---

## 13. Accessibility & Internationalization

### 13.1 UI Accessibility (WCAG 2.1 AA)
- **Keyboard**: All interactive elements reachable; `Tab` order matches visual; `Escape` closes modals; `Enter`/`Space` activates
- **Screen reader**: ARIA labels on graph nodes (via `role="img" aria-label`), live regions for chat stream, `aria-live="polite"` for telemetry
- **Color**: 4.5:1 contrast; not color-only for state (icons + text); high-contrast theme
- **Focus**: Visible focus outline (`:focus-visible`); skip link to main content
- **Motion**: `prefers-reduced-motion` disables graph animations

### 13.2 Internationalization (i18n)
- **Core**: English only (technical terms: Narsese, MeTTa, cognitive delta)
- **UI**: `i18next` with JSON locales — `en.json` (default), extensible for plugins
- **CLI**: English only; plugins can add locales

---

## 14. Performance & Profiling

### 14.1 Benchmarks
- **Cycle latency**: P50/P95/P99 for `agent.cycle()` with varying context sizes
- **Memory tiers**: Query latency vs. tier size (working/episodic/semantic)
- **WS throughput**: Messages/sec with 10/100/1000 concurrent clients
- **Engine reasoning**: NAR derivations/sec; MeTTa query latency

### 14.2 Profiling Hooks
- `--inspect` support in all bins
- `agent.profile()` → `{ cpu: Profile, heap: HeapSnapshot }` (programmatic)
- `PERF=1` env → console.time stamps in cycle phases

---

## 15. Backup, Restore & Disaster Recovery

### 15.1 What Gets Backed Up
| Artifact | Location | Frequency |
|----------|----------|-----------|
| EventLog (Sqlite) | `~/.senars/eventlog.db` | Continuous (WAL) |
| MeTTa spaces | `~/.senars/metta/` | On `persist()` + shutdown |
| NAR memory | `~/.senars/nar/` | On `persist()` + shutdown |
| Sessions | `~/.senars/sessions/` | Per-session |
| Config | `~/.senars/config.json` | On change |

### 15.2 Restore Procedure
1. Install same version
2. Copy `~/.senars/` from backup
3. `senars --restore` (validates schema, replays EventLog if needed)
4. Start agent — memory tiers rebuild from EventLog

---

## 16. What We Keep / Kill / Birth (Updated)

| Verdict | Component | Reason |
|---------|-----------|--------|
| ✅ KEEP | `EventLog` (InMemory, Sqlite) | Nervous system — single source of truth |
| ✅ KEEP | `ModelRunner`/`ChatService` | Cortex foundation |
| ✅ KEEP | `MettaCommandParser` (all 15) | Motor cortex — implement all |
| ✅ KEEP | `MettaPromptBuilder`, `MettaSkills` | Context + procedural memory |
| ✅ KEEP | `PolicyEngine` (core) — delete metta dup | Prefrontal safety |
| ✅ KEEP | `AgentBridge` | Optic nerve (real, required) |
| ✅ KEEP | `Plugin` interface | Immune-system contract |
| ✅ KEEP | `MessageRouter` + connections (io) | **Required by tests** — the senses |
| ✅ KEEP | `NAR` / `MeTTaRuntime` | Reasoning organs |
| ✅ KEEP | UI viewports + store + ws-client | The eyes |
| ❌ KILL | `Kernel` + `Backend` + `ToolProvider` + `EventBackend` + `CapabilityRegistry` | Tower of waste |
| ❌ KILL | `VisualizationBackend` | Dead no-op |
| ❌ KILL | `ui/src/shared/protocol.ts` | Core is the protocol |
| ❌ KILL | `metta/src/agent/PolicyEngine.ts` | Duplicate of core |
| 🌱 BIRTH | `nar/src/agent/` (`createAgent` + contract) | Unblocks all — **Step A, first** |
| 🌱 BIRTH | `Engine` interface + `NAREngine` + `MettaEngine` | Organs |
| 🌱 BIRTH | `LLMCortex` | Narrative voice |
| 🌱 BIRTH | `ToolRegistry` (from MettaSkills) | Procedural memory |
| 🌱 BIRTH | `MemoryService` 5 tiers | Hippocampus |
| 🌱 BIRTH | `ui/src/server` (`startAgentUI`) | The WS eye |
| 🌱 BIRTH | `PluginLoader` | Immune activation |
| 🌱 BIRTH | `GraphRenderer` + 2 impls | One mind, many eyes |
| 🌱 BIRTH | `Config` system (Zod + presets) | Single source of truth |
| 🌱 BIRTH | `Observability` (Logger + Metrics) | Debuggability |
| 🌱 BIRTH | `Error` hierarchy + boundaries | Resilience |
| 🌱 BIRTH | `Auth` + `RateLimiter` integration | Security |
| 🌱 BIRTH | `Health` checks + lifecycle hooks | Operability |
| 🌱 BIRTH | `Sandbox` for tool execution | Safety |
| 🌱 BIRTH | `McpTransport` + `IrcTransport` | Protocol bridges |
| 🌱 BIRTH | `LensSpec` + `Focus` system | UI semantics |
| 🌱 BIRTH | `Command` protocol handler | Extensibility |
| 🌱 BIRTH | `REPL` UX (history, completion, colors) | Developer joy |

---

## 17. Success Criteria (Updated)

| Metric | Before | After |
|--------|--------|-------|
| Agent architecture | 3 parallel, 1 broken | **1 living process** |
| Engines | isolated, backend-wrapped | **organs, orchestrated** |
| Memory | Tier 0 only | **5 living tiers, replayable** |
| Tools | 8/15 ignored | **15/15, feedback-weighted** |
| UI | no server, no bridge | **real-time window to mind** |
| `nar/agent` | missing (all bins/tests broken) | **exists, contract-matched** |
| `ui/server` | missing (e2e imports it) | **exists, WS streaming** |
| Config | ad-hoc, inconsistent | **unified, validated, preset-able** |
| Observability | telemetry only | **logs + metrics + traces** |
| Security | none | **auth + rate limits + sandbox** |
| Sessions | ephemeral | **persisted, restorable** |
| Multi-agent | bins only | **protocol + shared log** |
| MCP/IRC | standalone bins | **integrated transports** |
| REPL | basic readline | **history, completion, colors** |
| Dead code | ~2,500 lines | **0** |
| TS errors | broken `@senars/nar/agent` | **0** |
| Tests | ~50 broken | **green (unit + int + e2e)** |
| Persistence | none | **hippocampus survives restart** |
| DX | fragmented | **consistent, documented, typed** |

---

## 18. Philosophy

> **A cognitive agent is not a class. It is a process.**
>
> It perceives. It remembers. It reasons. It speaks. It acts. It learns. It shows itself.
>
> `Kernel` was a spine that never moved. `Backend` was a limb that never reached. `VisualizationBackend` was an eye that never opened. This plan gives them a body — one `Agent`, one `cycle()`, one `EventLog` as the nervous system, memory that breathes, engines that reason, a cortex that speaks, tools that grow, a UI that *sees*.
>
> **But unlike the previous draft, this body is built from the parts we already have and tested — not from APIs we invent.** The organism is real; we are only waking it.

---

## 19. Execution Order (Dependency-Aware, Verifiable Per Step)

### Phase 0: Unblock (Week 1)
1. **A** — Birth `nar/src/agent` + restore `./agent` export + repair bins (unblocks typecheck + unit/conversational tests). **Do this first.**
2. **Config** — Create `core/src/config/Config.ts` + Zod schema + presets (bins need it).
3. **Observability** — Create `core/src/observability/Logger.ts` + `Metrics.ts` (all code needs it).

### Phase 1: Core Organism (Week 2)
4. **B** — Flatten tower; rewrite `Agent` as hub; create `Engine`/`LLMCortex`/`ToolRegistry`; enhance `MemoryService`.
5. **Errors** — Create `core/src/errors/AgentError.ts` + error boundary in `AgentBridge`.
6. **Health** — Add `Agent.health()` + `SIGTERM` handler + startup order.

### Phase 2: Engines & Loop (Week 3)
7. **C** — Vivify engines (`NAREngine`, `MettaEngine`).
8. **D** — Wire living loop (LLM → parse → tools → consolidate → persist).
9. **Sandbox** — Wrap `ToolRegistry.execute()` in vm2 sandbox.
10. **Auth/RateLimit** — Integrate `AuthManager` + `createRateLimiter` in transports.

### Phase 3: UI & Protocols (Week 4)
11. **E** — Vivify UI (`ui/src/server`, GraphRenderer, lenses, focus, commands) → e2e green.
12. **MCP/IRC** — Create `McpTransport`, `IrcTransport`; wire into `createAgent` senses.
13. **REPL** — Polish `repl.ts` (history, completion, colors).
14. **Sessions** — Wire `JsonlSessionManager` persistence + restore.

### Phase 4: Platform (Week 5)
15. **F** — Plugin loader (symbiotes activate).
16. **Multi-agent** — Shared SqliteEventLog + delegate protocol.
17. **Docs** — TypeDoc + ARCHITECTURE.md + ADRs + guides.
18. **Build/Release** — esbuild bins, vite UI, changesets, Docker.

---

**Each step independently verifiable:** `pnpm -r typecheck` + targeted `vitest run` subset.  
**Hackathon prototype demonstrable after Phase 3, Step 11** (text REPL via `senars repl` + live UI via `senars ui`).
