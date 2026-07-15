# NEXT.agent10.md — Single-Agent Architecture, Deep Unification

> **Theme:** *Three agent architectures masquerading as one. Two MeTTa runtimes. Five memory systems. Dead code, stubs, phantom modules. This plan collapses everything into a single coherent agent path, eliminates every redundancy, and makes the system actually work.*

---

## 0. Diagnosis: What Exists vs. What Imports

| Import | Resolves To | Notes |
|--------|-------------|-------|
| `@senars/nar/agent` → `createAgent()` | `nar/src/agent/` | **DIRECTORY DOES NOT EXIST** — TS2307 at build |
| `@senars/nar/backend` → `NarBackend` | `nar/src/backend/NarBackendV2.ts` | v2 exists, v1 at `NarBackend.ts` is dead |
| `@senars/metta/backend` → `MettaBackend` | `metta/src/backend/MettaBackendV2.ts` | v2 exists, v1 at `MettaBackend.ts` is dead |
| `@senars/core/kernel` → `Kernel` | `core/src/kernel/Kernel.ts` | Healthy |
| `@senars/core` → `Agent` | `core/src/index.ts` `(??)` | **NOT EXPORTED** — referenced in bins but absent |
| `metta/src/agent/` → `MettaAgent` | Standalone agent | **Third agent path**, parallel to old design |

**Three agent designs running simultaneously:**
1. **Old impl** (`@senars/nar/agent.createAgent`) — wraps NarBackend/MettaBackend in Kernel. Source is missing.
2. **Kernel backends** (NarBackendV2 / MettaBackendV2) — event-sourced engine wrappers.
3. **MettaAgent** (`metta/src/agent/`) — standalone MeTTa agent with its own loop, skills, memory.

**Two MeTTa runtimes:**
- `MettaAgent` creates one in its constructor
- `MettaBackendV2` creates one in `initialize()`

**Five memory systems (overlapping):**
- `MettaHistory` — in-memory ring
- `MettaEpisodicMemory` — MeTTa space atoms
- `MettaLTM` — persistent spaces
- `MettaKnowledge` — persistent spaces (duplicate)
- `@senars/nar` has its own `EpisodicMemory`

**Dead code:** `SessionOrchestrator` (exported, never imported), old `NarBackend.ts` v1, old `MettaBackend.ts` v1, `VisualizationBackend.#wsServer` (always null), `MettaAgent.#chatService` (never used by loop), 8 of 15 `MettaCommandParser` command types silently ignored.

---

## Phase 0: Foundation — Collapse Three Agents Into One

**Target:** A single `Agent` class (in `core/src`) that:
- Is the one class everyone imports
- Wraps a `Kernel` internally
- Owns one MeTTa runtime (if configured)
- Owns one NAR runtime (if configured)
- Provides `mount(transport)`, `submit(input)`, `on('cognitive', handler)` — unified API
- The old `MettaAgent` becomes a thin convenience constructor

### Step 0a: Create the unified Agent

**`core/src/Agent.ts`** — Single agent class:

```typescript
export class Agent {
  readonly kernel: Kernel;
  readonly id: string;
  
  #mettaRuntime: MeTTaRuntime | null = null;
  #narRuntime: NAR | null = null;
  #cognitiveListeners = new Set<(e: CognitiveEvent) => void>();
  #transports = new Map<string, Connection>();
  #skills: SkillRegistry;

  constructor(opts: AgentOptions) {
    this.kernel = new Kernel(opts.log);
    if (opts.metta) this.#mettaRuntime = createMeTTa(opts.metta);
    if (opts.nar) this.#narRuntime = createNAR(opts.nar);
    this.#skills = new SkillRegistry(this.kernel);
  }

  submit(input: string, correlationId: string): void;
  mount(transport: Connection): void;
  unmount(id: string): void;
  on(event: string | '*', handler: (e: CognitiveEvent) => void): void;
  capabilities(): AgentCapabilities;
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

### Step 0b: Delete redundant agent paths

| File | Action |
|------|--------|
| `nar/src/agent/` (entire dir) | Never existed — update `nar/package.json` to remove `./agent` export |
| `metta/src/agent/MettaAgent.ts` | Reduct to thin constructor: `new MettaAgent() = new Agent({ metta: true })` |
| `metta/src/agent/MettaLoop.ts` | Delete — loop logic moves into `core/src/Agent.ts` |
| `metta/src/agent/MettaHistory.ts` | Delete — unified into `MemoryService` |
| `metta/src/agent/MettaEpisodic.ts` | Delete — unified into `MemoryService` |
| `metta/src/agent/MettaLTM.ts` | Delete — unified into `MemoryService` |
| `metta/src/agent/MettaKnowledge.ts` | Delete — unified into `MemoryService` |
| `metta/src/agent/MettaPromptBuilder.ts` | Keep — useful prompt utility |
| `metta/src/agent/MettaCommandParser.ts` | Keep — useful parser utility |
| `metta/src/agent/MettaSkills.ts` | Keep — wraps SkillRegistry |
| `metta/src/agent/PolicyEngine.ts` | Move to `core/src/PolicyEngine.ts` |

### Step 0c: Fix `@senars/nar/agent` export

**`nar/package.json`** — Remove `./agent` export path. Everything that previously imported `createAgent` from `@senars/nar/agent` now imports `Agent` from `@senars/core`.

**Bins that change:**
- `src/bin/bot-ai.ts` — `import { Agent } from '@senars/core'` instead of `import { createAgent } from '@senars/nar/agent'`
- `src/bin/multi-agent.ts` — same
- `src/bin/multi-agent-demo.ts` — same
- `src/bin/repl.ts` — same
- `src/bin/mcp-server.ts` — same

### Step 0d: Fix `@senars/core` → `Agent` export

**`core/src/index.ts`** — Add:
```typescript
export { Agent } from './Agent.js';
```

**`core/package.json`** — Add:
```json
"./agent": {
  "types": "./src/Agent.ts",
  "import": "./src/Agent.ts"
}
```

### Verification

- `npx tsc --noEmit` passes (TS2307 for `@senars/nar/agent` gone)
- `import { Agent } from '@senars/core'` works in all bins
- All three old agent entry points converge on one class

---

## Phase 1: Single MeTTa Runtime

**Problem:** `MettaAgent` and `MettaBackendV2` each create their own `MeTTaRuntime`. They are in the same process but unaware of each other.

**Solution:** The unified `Agent` owns the MeTTa runtime once. The backend is the agent — there is no separate backend. Tools are registered on the agent, not on a separate backend class.

### Step 1a: Backend cleanup

| File | Action |
|------|--------|
| `metta/src/backend/MettaBackend.ts` (v1) | Delete — dead |
| `metta/src/backend/MettaBackendV2.ts` | Integrate into `Agent.ts` — Agent.initialize() creates runtime, Agent.process(event) handles events directly. Delete file. |
| `nar/src/backend/NarBackend.ts` (v1) | Delete — dead |
| `nar/src/backend/NarBackendV2.ts` | Integrate into `Agent.ts` — Agent creates NAR runtime, handles `input.user` events directly. Delete file. |

### Step 1b: What "backend" becomes

A backend is no longer a class — it's just a **capability flag** on the Agent:

```typescript
class Agent {
  readonly capabilities: Set<Capability> = new Set();
  
  // Instead of: kernel.register(new MettaBackend())
  // Agent already IS the MeTTa backend
  async initialize() {
    if (this.#mettaRuntime) {
      this.capabilities.add(Cap.PatternMatch);
      this.capabilities.add(Cap.Rewrite);
      // ...
    }
    if (this.#narRuntime) {
      this.capabilities.add(Cap.Inheritance);
      this.capabilities.add(Cap.TruthRevision);
      // ...
    }
  }
}
```

The `Kernel` no longer exists as a separate orchestration layer — it gets absorbed into `Agent`. The Agent IS the kernel.

### Step 1c: Tool execution becomes direct

```typescript
class Agent {
  async executeTool(name: string, args: unknown, cid?: string): Promise<ToolResult> {
    if (name.startsWith('metta-') && this.#mettaRuntime) {
      // execute directly — no backend indirection
    }
    if (this.#tools.has(name)) {
      return this.#tools.get(name)!.execute(args);
    }
    return { success: false, content: null, error: `Unknown tool: ${name}` };
  }
}
```

### Files deleted

- `metta/src/backend/MettaBackend.ts` (~252 lines)
- `metta/src/backend/MettaBackendV2.ts` (~110 lines)
- `nar/src/backend/NarBackend.ts` (~118 lines)
- `nar/src/backend/NarBackendV2.ts` (~90 lines)
- `core/src/backend/EventBackend.ts` (~50 lines)
- `core/src/backend/Backend.ts` (interface — absorbed)
- `core/src/capability/ToolProvider.ts` (interface — absorbed)

**Total lines removed:** ~620

---

## Phase 2: Unified Memory Service

**Problem:** Five overlapping memory constructs. Inconsistent APIs.

**Solution:** Replace with `MemoryService` containing clear tiered storage + a single persistence mechanism.

### Memory tiers

```
Tier 0: Working — in-memory ring buffer (last N conversations/skills)
Tier 1: Episodic — time-indexed, persisted via EventLog replay
Tier 2: Semantic — queryable atom space (MeTTa spaces or NAR memory)
Tier 3: Long-term — persisted atom space (PersistentSpace with storage dir)
```

### The unified API

```typescript
class MemoryService {
  // Tier 0
  append(entry: MemoryEntry): void;
  recent(limit: number, type?: string): MemoryEntry[];

  // Tier 1
  queryTimeRange(from: number, to: number): MemoryEntry[];
  queryAroundTime(ts: number, windowMs: number): MemoryEntry[];

  // Tier 2
  learn(atom: string, space?: string): Promise<void>;
  recall(pattern: string, limit?: number): Promise<MeTTaAtom[]>;

  // Tier 3
  persist(space?: string): Promise<void>;
  load(space?: string): Promise<void>;
}
```

### Files affected

| Action | File |
|--------|------|
| Create | `core/src/memory/MemoryService.ts` |
| Create | `core/src/memory/types.ts` |
| Create | `core/src/memory/MemoryEntry.ts` |
| Delete | `metta/src/agent/MettaHistory.ts` |
| Delete | `metta/src/agent/MettaEpisodic.ts` |
| Delete | `metta/src/agent/MettaLTM.ts` |
| Delete | `metta/src/agent/MettaKnowledge.ts` |
| Refactor | `MettaPromptBuilder.ts` — reads from MemoryService instead of separate history |

**Net lines:** ~−350 (5 files deleted) + ~+200 (2 files created)

---

## Phase 3: Protocol Deduplication + Wire Fix

### Step 3a: Protocol unification

**`ui/src/shared/protocol.ts`** — Delete. All UI code imports from `@senars/core`:

```typescript
// ui/src/shared/protocol.ts → becomes:
export { 
  ChatMessage, TruthValue, GraphNodeData, GraphOp, CognitiveDelta,
  IncomingFromClient, IncomingFromServer, Lens, ConfigField,
  LensSchema // ... everything
} from '@senars/core';
```

**`core/src/helpers.ts`** — Add `edgeKey`, `extractTerm`, `generateId` (moved from `ui/src/shared/utils.ts`).

**`ui/src/shared/utils.ts`** — Keep only pure UI utilities (color mixing, token formatting, etc.).

### Step 3b: Fix the VisualizationBackend

**Problem:** `VisualizationBackend.#wsServer` is initialized as `null` and never started. All clients lists are empty. The entire class is a no-op.

**Solution:** Delete `VisualizationBackend.ts` entirely. Replace with `AgentBridge` that lives in `core/src/`:

```typescript
class AgentBridge {
  constructor(agent: Agent) {
    agent.on('*', (event) => {
      const ops = projectGraph(event);
      const chat = projectChat(event);
      // broadcast to WS clients
    });
  }
}
```

The WS server itself is a simple `ws` listener in `ui/src/server/` that creates an `AgentBridge` for its agent. The bridge IS the visualization backend — no separate backend class needed.

### Step 3c: Router cleanup

**`io/src/router.ts`** — Check if it duplicates logic with `Agent.mount()`/`Agent.submit()`. If so, simplify so transports feed directly into `Agent.submit()` rather than through a separate router layer.

### Files

| Action | File |
|--------|------|
| Delete | `ui/src/backend/VisualizationBackend.ts` (~76 lines) |
| Create | `core/src/AgentBridge.ts` |
| Create | `ui/src/server/index.ts` (actually populate) |
| Delete | `ui/src/shared/protocol.ts` (~219 lines) |
| Refactor | `core/src/helpers.ts` (+3 functions) |
| Refactor | `ui/src/shared/utils.ts` (−3 functions) |

**Lines removed:** ~295

---

## Phase 4: Graph Renderer Unification

**Problem:** `graph-viewport.ts` (Cytoscape, 2D, 609 lines) and `spacegraph-viewport.ts` (SpaceGraphJS, 3D, 363 lines) duplicate sync logic, interaction handling, and event wiring.

### Solution: Single renderer abstraction

```typescript
// core/graph-renderer.ts
export interface GraphRenderer {
  init(container: HTMLElement): void;
  destroy(): void;
  addNode(id: string, data: GraphNodeData): void;
  removeNode(id: string): void;
  updateNode(id: string, data: Partial<GraphNodeData>): void;
  addEdge(id: string, source: string, target: string, data: unknown): void;
  removeEdge(source: string, target: string): void;
  applyDelta(delta: Delta): void;
  clearStyles(): void;
  layout(name: string, opts?: LayoutOpts): void;
  focusNode(id: string, duration?: number): void;
  getCamera(): { x: number; y: number; zoom: number };
  setCamera(vp: { x: number; y: number; zoom: number }): void;
  readonly onNodeClick: EventEmitter<string>;
  readonly onEdgeClick: EventEmitter<{ source: string; target: string }>;
  readonly onBackgroundClick: EventEmitter<void>;
  readonly onViewportChange: EventEmitter<{ x: number; y: number; zoom: number }>;
}
```

Two implementations: `CytoscapeRenderer` and `SpaceGraphRenderer`.

Both viewport components shrink to ~80 lines — create renderer, wire store subscriptions, delegate everything.

### Files affected

| Action | File |
|--------|------|
| Create | `ui/src/client/core/graph-renderer.ts` |
| Create | `ui/src/client/core/cytoscape-renderer.ts` |
| Create | `ui/src/client/core/spacegraph-renderer.ts` |
| Refactor | `graph-viewport.ts` (609 → ~80 lines) |
| Refactor | `spacegraph-viewport.ts` (363 → ~80 lines) |
| Refactor | `store-bindings.ts` — no `cy?: Core` parameter |

**Lines removed:** ~810 (before) → ~450 (after) = **−360 net**

The adapters (`adapter-2d.ts`, `adapter-3d.ts`) get absorbed into the renderer implementations. The diffing/sync logic is shared once.

---

## Phase 5: UI Component Simplification

### Step 5a: Panel system consolidation

`app-layout.ts` manually toggles 6 panels with inline conditional templates. Replace with a data-driven panel registry:

```typescript
const PANEL_DEFS = {
  config: { docked: 'right', size: 320, defaultOpen: false },
  telemetry: { docked: 'bottom', size: 200, defaultOpen: true },
  chat: { docked: 'right', size: 360, defaultOpen: false },
  search: { docked: 'left', size: 280, defaultOpen: false },
  'lens-designer': { docked: 'right', size: 400, defaultOpen: false },
};
```

Render loop in template: iterate `PANEL_DEFS`, render each if open. Removes ~80 lines of repeated template blocks.

### Step 5b: Delete duplicate lens-selector

`lens-selector.ts` duplicates `lens-controller.ts`. Delete. `lens-controller.ts` gains the dropdown UI.

### Step 5c: Store simplification

| Atom | Action | Reason |
|------|--------|--------|
| `$selectedNodeId` | Merge into `$selectedNodeIds` | Redundant: detail drawer derives from first selected |
| `$selectedEdgeId` | Merge into `$selectedNodeIds` | Selection is selection |
| `$configOpen` | Delete | Already an alias over `$panels` |
| `$workingMemory` | Delete | Populated but never consumed |
| `$selectedNodeIds` | Rename to `$selection` | Cleaner name |

### Step 5d: Keyboard accessibility pass

- `input-hud.ts`: Already mostly there — verify Ctrl+Enter, Escape, arrow keys
- `lens-controller.ts`: Add `role="tablist"` and keyboard arrow navigation
- `graph-viewport.ts` context menu: `tabindex`, `Enter` to activate, `Escape` to close
- `node-detail-drawer.ts`: Tab ordering should follow visual order

### Files

| Action | File |
|--------|------|
| Delete | `ui/src/client/components/lens-selector.ts` (~100 lines) |
| Refactor | `ui/src/client/core/store.ts` (−4 atoms) |
| Refactor | `ui/src/client/components/app-layout.ts` (−80 lines) |
| Refactor | Various for a11y |

---

## Phase 6: Modular Plugin Architecture

### The plugin interface

```typescript
// core/src/Plugin.ts
export interface SenarsPlugin {
  id: string;
  name: string;
  version: string;
  activate(ctx: PluginContext): void;
  deactivate(): void;
}

export interface PluginContext {
  registerSkill(name: string, fn: GroundedOp): void;
  registerLens(spec: LensSpec): void;
  registerPredicate(name: string, fn: PredicateFn): void;
  addTransport(name: string, factory: TransportFactory): void;
  onCognitive(handler: (e: CognitiveEvent) => void): () => void;
  addMemoryTier(name: string, impl: MemoryTier): void;
}
```

### Built-in plugins (previously hardcoded)

| Plugin | Source | What it provides |
|--------|--------|-----------------|
| `@senars/plugin-irc` | Current `io/src/connections/irc.ts` | IRC transport |
| `@senars/plugin-ws` | Current `io/src/connections/ws.ts` | WS transport |
| `@senars/plugin-http` | Current `io/src/connections/http.ts` | HTTP transport |
| `@senars/plugin-mcp` | Current `io/src/connections/mcp.ts` | MCP transport |
| `@senars/plugin-cli` | Current `io/src/connections/cli.ts` | CLI transport |
| `@senars/plugin-lenses` | Current lens builtins | belief/goal/contradiction lenses |
| `@senars/plugin-temporal` | Current `timeGate` | Temporal scrubber lens |

The `io/src/connections/` directory becomes `@senars/plugin-*` packages. The `ConnectionManager` and `ConnectionFactory` registry load from plugins instead of hardcoding.

### Files affected

| Action | File |
|--------|------|
| Create | `core/src/Plugin.ts` |
| Refactor | `ConnectionManager` — plugin-loaded instead of manually registered |
| Move | `io/src/connections/` → plugin packages |
| Keep | `MettaSkills.ts` — delegates to `PluginContext.registerSkill()` |

**Key principle:** No hardcoded transport types in the agent. All transports arrive via plugin.

---

## Phase 7: Delete Dead & Orphaned Code

| File | Lines | Reason |
|------|-------|--------|
| `core/src/SessionOrchestrator.ts` | 34 | Never imported outside its own export |
| `core/src/backend/EventBackend.ts` | ~50 | Absorbed into Agent |
| `core/src/backend/Backend.ts` | ~40 | Interface, absorbed |
| `core/src/capability/ToolProvider.ts` | ~25 | Interface, absorbed |
| `nar/src/backend/NarBackend.ts` (v1) | 118 | Replaced by v2, v2 absorbed into Agent |
| `nar/src/backend/NarBackendV2.ts` | 90 | Absorbed into Agent |
| `metta/src/backend/MettaBackend.ts` (v1) | 252 | Replaced by v2, v2 absorbed into Agent |
| `metta/src/backend/MettaBackendV2.ts` | 110 | Absorbed into Agent |
| `metta/src/agent/MettaHistory.ts` | 65 | → MemoryService |
| `metta/src/agent/MettaEpisodic.ts` | 112 | → MemoryService |
| `metta/src/agent/MettaLTM.ts` | 56 | → MemoryService |
| `metta/src/agent/MettaKnowledge.ts` | 83 | → MemoryService |
| `metta/src/agent/MettaLoop.ts` | 229 | → core Agent + MemoryService |
| `metta/src/agent/MettaAgent.ts` | 251 | → thin constructor or deleted |
| `ui/src/backend/VisualizationBackend.ts` | 76 | → AgentBridge |
| `ui/src/shared/protocol.ts` | 219 | → re-export facade |
| `ui/src/client/components/lens-selector.ts` | ~100 | → lens-controller |
| `ui/src/client/utils/adapter-2d.ts` | 121 | Absorbed into renderer |
| `ui/src/client/spacegraph/adapter-3d.ts` | 118 | Absorbed into renderer |

**Total deleted:** ~2,149 lines
**Total created:** ~700 lines (Agent, MemoryService, AgentBridge, GraphRenderer, Plugin.ts, thin viewports)
**Net reduction:** ~1,449 lines

---

## Phase 8: Fix the Loop — Real LLM Wire

Once the architecture is clean, wire the agent's cognitive loop to actual LLM inference:

```
Agent.submit("hello")
  → kernel.append({ type: 'input.user', payload: { text: "hello" } })
  → Agent.process(event)  [direct, not through backend]
  → MemoryService.append({ type: 'episode', payload: "hello" })
  → if LLM is configured:
      ModelRunner.run({ system: prompt, messages: [user] })
      → parse output via MettaCommandParser
      → execute commands (remember, query, send, shell, ...)
      → MemoryService.append({ type: 'skill_result', payload: result })
      → kernel.append({ type: 'derivation', term: result, confidence: 1.0 })
  → AgentBridge projects events → WS broadcast
```

This is the same as Phase 0 in the original plan, but now it operates on a clean single-runtime, single-memory, single-agent architecture instead of the tangled triple-agent mess.

---

## Migration Order

| Phase | Description | Est. Δ Lines | Risk |
|-------|-------------|-------------|------|
| **0** | Collapse 3 agents into 1 | −900 | **HIGH** — touches every bin and test |
| **1** | Single MeTTa runtime, delete v1/v2 backends | −620 | Medium — backends are wrappers with no unique state |
| **2** | Unified MemoryService | −150 | Medium — behavioral equivalence needed |
| **3** | Protocol dedup + VisualizationBackend → AgentBridge | −295 | Low — purely additive |
| **4** | Graph renderer abstraction | −360 | Medium — visual equivalence needed |
| **5** | UI component simplification | −200 | Low |
| **6** | Plugin architecture | +100 (initially) | Low — additive, no deletions |
| **7** | Delete dead code | −2,149 | Low — deletion only |
| **8** | Wire LLM to agent loop | +150 | Medium — core behavioral change |

**Total estimated:** ~3,900 lines deleted, ~1,000 created, ~2,900 net reduction

---

## What the Final Architecture Looks Like

```
core/src/
├── Agent.ts              # THE agent — owns kernel, runtimes, transports
├── AgentBridge.ts         # cognitive events → WS broadcast
├── MemoryService.ts       # single memory: working + episodic + semantic + LTM
├── Plugin.ts              # plugin interface + context
├── PolicyEngine.ts        # security policy (moved from metta)
├── Kernel.ts              # event log + config + health (internal to Agent)
├── CognitiveEvent.ts      # unified event types
├── Protocol.ts            # single source of truth
├── ModelRunner.ts         # LLM abstraction
├── ChatService.ts         # streaming chat
├── memory/                # MemoryService internals
├── helpers.ts             # edgeKey + extractTerm + generateId + existing
└── index.ts              # exports everything

metta/src/agent/ (kept as convenience)
├── MettaAgent.ts          # thin: `new MettaAgent() = new Agent({ metta: true })`
├── MettaPromptBuilder.ts  # prompt building utility
├── MettaCommandParser.ts  # LLM output parser
├── MettaSkills.ts         # skill registry wrapper
└── index.ts

ui/src/client/core/
├── graph-renderer.ts      # interface
├── cytoscape-renderer.ts  # 2D impl
├── spacegraph-renderer.ts # 3D impl
├── store.ts               # cleaned (−4 atoms)
├── store-bindings.ts      # no cy param
├── plugin-loader.ts       # loads UI plugins
└── ...
```

---

## Non-Goals

- ❌ Rewrite the NAR engine — it works, don't touch it
- ❌ Rewrite the MeTTa engine (metta.js) — it works, don't touch it
- ❌ Replace Lit/Cytoscape/SpaceGraphJS — leverage existing investments
- ❌ Full `pnpm` monorepo restructure — the packages are fine
- ❌ Comprehensive test suite rewrite — fix broken imports, add targeted tests
- ❌ Distributed/cloud agent — single-process is the right first target

## Success Criteria

| Metric | Before | After |
|--------|--------|-------|
| Agent classes | 3 (`AgentImpl`, `MettaAgent`, Kernel backends) | 1 (`Agent`) |
| MeTTa runtimes per process | Up to 2 | Exactly 1 |
| Memory systems | 5 overlapping | 1 unified |
| Dead code (defined but unused) | `SessionOrchestrator`, v1 backends, `VisualizationBackend.#wsServer`, 8/15 command types | 0 |
| Protocol source files | 2 (duplicated) | 1 |
| Graph viewport LOC | 609 + 363 = 972 | ~160 (abstraction + 2x thin) |
| Phantom module imports | 1 (`@senars/nar/agent`) | 0 |
| Agent → UI visibility | None (no bridge) | Real-time via AgentBridge |
| LLM integration | Stub (`#simulateLLMResponse`) | Real `ModelRunner.run()` |
| TS compile errors | TS2307 for `@senars/nar/agent` | 0 |
| Total package LOC | ~54,000 (all) | ~51,000 (net −2,900 in agent/ui/core) |
