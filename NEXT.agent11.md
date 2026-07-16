# NEXT.agent11.md — Unified Agent Architecture, Minimal Viable Stack

> **Theme:** *One Agent class. One MeTTa runtime. One NAR runtime. One memory service. Kill the abstraction tower. Create the missing entry points. Wire the LLM loop. Everything else is a seam, not a tower.*

---

## The 3-Move Plan

### Move 1: Flatten the Tower (Delete 7 files, modify Agent)

**Delete:**
- `core/src/kernel/Kernel.ts`
- `core/src/backend/Backend.ts`
- `core/src/backend/EventBackend.ts`
- `core/src/capability/ToolProvider.ts`
- `core/src/capability/CapabilityRegistry.ts` (if exists)
- `metta/src/backend/MettaBackendV2.ts`
- `nar/src/backend/NarBackendV2.ts`

**Modify `core/src/Agent.ts`** to directly own:
```typescript
class Agent {
  readonly log: EventLog;                    // was Kernel.log
  readonly tools: Map<string, ToolFn>;       // was Kernel.tools + ToolProvider
  readonly metta?: MeTTaRuntime;             // was MettaBackendV2.#runtime
  readonly nar?: NAR;                        // was NarBackendV2.#nar
  readonly memory: MemoryService;            // was separate class
  readonly bridge?: AgentBridge;             // was separate class
  
  // Direct methods — no backend indirection
  async submit(input: string, cid: string) { 
    this.log.append({type: 'input.user', payload: {text: input}, correlationId: cid})
  }
  registerTool(name: string, fn: ToolFn) { this.tools.set(name, fn) }
  async executeTool(name: string, args: unknown, cid?: string): Promise<ToolResult> {
    return this.tools.get(name)?.(args) ?? {success: false, error: `Unknown tool: ${name}`}
  }
}
```

**Delete `core/src/SessionOrchestrator.ts`** (already done) and remove its export from `core/src/index.ts` + `core/package.json`.

---

### Move 2: Create `nar/src/agent/` + Wire LLM Loop + Memory Tiers

**Create `nar/src/agent/index.ts`** — the missing entry point that fixes 15+ broken imports:
```typescript
import { Agent, type ToolFn } from '@senars/core';
import { createNAR, type NAR } from '../index.js';
import { EpisodicMemory } from '../memory/episodic.js';
import { JsonlSessionManager } from './JsonlSessionManager.js';
import { createAutonomyEngine } from './AutonomyEngine.js';
import { bindAgentToConnection } from './bindAgentToConnection.js';
import { NLGenerationService, NLUnderstandingService, TranslationCache } from '../nl/index.js';

export function createAgent(opts: {
  nar: NAR;
  episodicMemory: EpisodicMemory;
  autonomyEngine: ReturnType<typeof createAutonomyEngine>;
  externalTools: Record<string, ToolFn>;
  workspaceRoot: string;
  // ...other opts
}) {
  const agent = new Agent({ nar: opts.nar, metta: false });
  agent.nar = opts.nar;
  for (const [name, fn] of Object.entries(opts.externalTools)) {
    agent.registerTool(name, fn);
  }
  opts.autonomyEngine.setAgent(agent);
  return agent;
}

export { bindAgentToConnection, createAutonomyEngine, JsonlSessionManager, EpisodicMemory };
export { NLGenerationService, NLUnderstandingService, TranslationCache } from '../nl/index.js';
```

**Create 2 supporting files in `nar/src/agent/`:**
- `AutonomyEngine.ts` — thin wrapper, calls `agent.submit()` on cycles
- `bindAgentToConnection.ts` — uses `agent.mount()` + message handlers
- `JsonlSessionManager.ts` — move from wherever it lives

**Enhance `core/src/Agent.ts`** — wire the LLM loop:
```typescript
// Add to Agent class
#llmRunner?: ModelRunner;

configureLLM(provider: ModelProvider) { this.#llmRunner = new ModelRunner({modelProvider: provider}) }

async *chat(input: string, opts?: ChatOptions) {
  const cid = crypto.randomUUID();
  this.emit({type:'input', term:input, source:'chat', correlationId:cid, engine:'metta'});
  
  if (this.#llmRunner) {
    const prompt = this.buildPrompt(input);  // uses this.memory.recent(20)
    for await (const event of this.#llmRunner.run(prompt)) {
      if (event.kind === 'tool-call') {
        const result = await this.executeTool(event.call.toolName, event.call.args, cid);
        this.memory.append({type: 'skill_result', payload: result, correlationId: cid});
        yield {kind:'tool-result', toolName: event.call.toolName, toolArgs: event.call.args, toolResult: result};
      }
      if (event.kind === 'text-delta') yield event;
    }
  } else {
    yield {kind: 'text-delta', text: `[agent] ${input}`};
  }
}
```

**Enhance `core/src/memory/MemoryService.ts`** — Tier 1-2:
```typescript
// Tier 1: Episodic via EventLog
queryTimeRange(from: number, to: number): MemoryEntry[] { /* filter this.#working */ }
queryAroundTime(ts: number, windowMs: number): MemoryEntry[] { /* filter this.#working */ }

// Tier 2: Semantic queries (delegates to owned runtimes)
async recall(pattern: string, limit?: number): Promise<MeTTaAtom[]> {
  if (this.#agent?.metta) return this.#agent.metta.space.query(parseMeTTa(pattern)).slice(0, limit);
  if (this.#agent?.nar) return this.#agent.nar.queryBeliefs(pattern).slice(0, limit);
  return [];
}
```

**Wire `AgentBridge` in `ui/src/server/index.ts`:**
```typescript
const bridge = new AgentBridge(agent);
const wss = new WebSocketServer({port: 8765});
wss.on('connection', ws => {
  const off = bridge.onEvent(e => ws.send(JSON.stringify(e)));
  ws.on('close', off);
});
```

---

### Move 3: Extract GraphRenderer + Protocol Dedup + Delete VisualizationBackend

**Extract `ui/src/client/core/graph-renderer.ts`** (interface) from existing `graph-viewport.ts` + `spacegraph-viewport.ts`:
```typescript
export interface GraphRenderer {
  init(container: HTMLElement): void;
  destroy(): void;
  addNode(id: string, data: GraphNodeData): void;
  removeNode(id: string): void;
  updateNode(id: string, data: Partial<GraphNodeData>): void;
  addEdge(id: string, source: string, target: string, data: unknown): void;
  removeEdge(source: string, target: string): void;
  applyDelta(delta: CognitiveDelta): void;
  layout(name: string, opts?: LayoutOpts): void;
  focusNode(id: string, duration?: number): void;
  getCamera(): {x:number; y:number; zoom:number};
  setCamera(vp: {x:number; y:number; zoom:number}): void;
  readonly onNodeClick: EventEmitter<string>;
  readonly onEdgeClick: EventEmitter<{source:string; target:string}>;
  readonly onBackgroundClick: EventEmitter<void>;
  readonly onViewportChange: EventEmitter<{x:number; y:number; zoom:number}>;
}
```

**Create 2 implementations** (move code from existing viewports):
- `ui/src/client/core/cytoscape-renderer.ts`
- `ui/src/client/core/spacegraph-renderer.ts`

**Refactor `graph-viewport.ts` + `spacegraph-viewport.ts`** to ~80 lines each — instantiate renderer, wire store, delegate.

**Fix `ui/src/shared/protocol.ts`** — replace all definitions with re-exports:
```typescript
export { 
  ChatMessage, TruthValue, GraphNodeData, GraphOp, CognitiveDelta,
  IncomingFromClient, IncomingFromServer, Lens, ConfigField,
  LensSchema, AgentCapabilities, /* ...everything */
} from '@senars/core';
```

**Delete `ui/src/backend/VisualizationBackend.ts`** — `AgentBridge` in `ui/src/server` replaces it.

---

## Abstractions Retained (High ROI)

| Abstraction | Location | Purpose |
|-------------|----------|---------|
| `Plugin` interface | `core/src/Plugin.ts` | External extensibility contract (MCP, transports, lenses) |
| `GraphRenderer` interface | `ui/src/client/core/graph-renderer.ts` | Shared sync logic for 2D/3D renderers |
| `AgentBridge` class | `core/src/AgentBridge.ts` | Testable seam: agent events → UI transport |
| `MemoryService` (Tiers 0-3) | `core/src/memory/` | Single memory API across all engines |
| `MettaAgent` class | `metta/src/agent/MettaAgent.ts` | Composable, extensible convenience wrapper |
| Protocol types | `core/src/Protocol.ts` | Single source of truth for wire format |

---

## Abstractions Killed (Pure Waste)

| Abstraction | Files | Reason |
|-------------|-------|--------|
| Kernel → Backend → ToolProvider tower | 7 files | Exists for pluggable engines; plan mandates exactly 1 MeTTa + 1 NAR |
| Plugin registry/loader | 0 files | Interface is the contract; registry is infrastructure without consumers |
| Panel system consolidation | 0 files | UI works; data-driven panels save ~80 lines at hours of cost |
| `VisualizationBackend` class | 1 file | `AgentBridge` IS the visualization backend |

---

## All Plan Goals Achieved

| Plan Phase | Goal | How |
|------------|------|-----|
| 0 | Single `Agent` class | Core Agent + `nar/src/agent/createAgent()` |
| 0 | `nar/agent` export fixed | Directory created with 3 files |
| 0 | `MettaAgent` thin wrapper | 84 lines, delegates to core Agent |
| 1 | One MeTTa runtime | `agent.metta` owned by Agent |
| 1 | One NAR runtime | `agent.nar` via `createAgent()` |
| 2 | Unified MemoryService | Tier 0 (ring), Tier 1 (EventLog), Tier 2 (space queries) |
| 3 | Protocol dedup | `ui/shared/protocol.ts` → re-exports from core |
| 3 | Agent→UI visibility | `AgentBridge` + WS in `ui/src/server` |
| 3 | `VisualizationBackend` deleted | Replaced by AgentBridge |
| 4 | GraphRenderer abstraction | Extracted from working viewports |
| 5 | UI simplification | Deferred (not blocking) |
| 6 | Plugin interface | Done in Move 1 |
| 7 | Dead code deleted | Tower + metta memory + SessionOrchestrator + VisualizationBackend |
| 8 | LLM wire | `Agent.chat()` → `ModelRunner` → `MettaCommandParser` → tools |

---

## File Delta

| Action | Files | Est. Lines |
|--------|-------|------------|
| Delete (tower + dead + VisualizationBackend) | -10 | -750 |
| Create (`nar/agent/` + GraphRenderer + server) | +7 | +300 |
| Modify (Agent, Memory, viewports, protocol) | +6 | +250 |
| **Net** | **-3** | **-200** |

---

## Verification Checklist

- [ ] `pnpm -r typecheck` passes (core, metta, nar, io, ui)
- [ ] All bins compile (`bot-ai`, `repl`, `mcp-server`, `multi-agent`, `multi-agent-demo`, `senars`)
- [ ] All tests compile (no `@senars/nar/agent` TS2307)
- [ ] `new Agent({metta:true}).chat("hello")` yields tokens via ModelRunner
- [ ] `createAgent({nar, ...})` returns Agent with NAR runtime wired
- [ ] WS server broadcasts `cognitive.delta` + `chat.message` via AgentBridge
- [ ] 2D/3D viewports use GraphRenderer interface (shared sync logic)

---

## Non-Goals (Explicitly Deferred)

- ❌ Plugin registry/loader — build when first external plugin lands
- ❌ Panel system consolidation — build when adding 7th panel
- ❌ MemoryService Tier 3 (persistent LTM) — add when session restore needed
- ❌ Distributed/cloud agent — single-process is correct first target
- ❌ Full test rewrite — fix broken imports, add targeted tests

---

## Execution Order

1. **Move 1** — Flatten tower (deletes + Agent.ts modification) — enables everything else
2. **Move 2** — `nar/src/agent/` + LLM loop + Memory tiers — unblocks bins + delivers value
3. **Move 3** — GraphRenderer + Protocol dedup + VisualizationBackend delete — UI polish

Each move is independently verifiable via `pnpm typecheck` and bin compilation.