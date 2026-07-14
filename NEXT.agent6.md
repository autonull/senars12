# SeNARS — Event-Sourced Capability Kernel (Supersedes NEXT.agent5.md)

> **Core insight**: The unification trap was trying to unify *agents*, then *backends*. The correct seam is *inside the kernel*: a single **EventLog** that everything projects from. Backends, UI, config, bootstrap — all are equal consumers/producers of events. No router, no bridge, no special cases.

---

## The Architecture (One Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EVENT LOG (Source of Truth)                    │
│  Events: { id, type, payload, capabilities[], timestamp, correlationId }   │
│  - Append-only, time-ordered (ULID)                                         │
│  - In-memory (dev) / Redis/Kafka (prod)                                     │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  NAR Backend  │          │ MeTTa Backend │          │  UI Backend   │
│  (consumer)   │          │  (consumer)   │          │  (consumer)   │
│               │          │               │          │               │
│ Projects to:  │          │ Projects to:  │          │ Projects to:  │
│ - Beliefs     │          │ - Atomspace   │          │ - Cytoscape   │
│ - Drives      │          │ - Skills      │          │ - Chat log    │
│ - Goals       │          │ - Queries     │          │ - Lens views  │
└───────┬───────┘          └───────┬───────┘          └───────┬───────┘
        │                          │                          │
        └──────────────────────────┼──────────────────────────┘
                                   ▼
                    ┌───────────────────────────────┐
                    │     CAPABILITY REGISTRY       │
                    │  (derived from event log)     │
                    │  "truth-revision" → [nar]     │
                    │  "pattern-match" → [metta]    │
                    │  "graph-projection" → [ui]    │
                    └───────────────────────────────┘
```

---

## 1. Event Log = Single Source of Truth

```typescript
// core/src/eventlog/EventLog.ts
export interface CognitiveEvent {
  readonly id: string;                    // ULID (time-sortable)
  readonly type: string;                  // "belief.added", "atom.derived", "chat.user", "config.changed"
  readonly payload: unknown;              // Type inferred from type
  readonly capabilities: ReadonlyArray<Capability>;  // NOT engine
  readonly timestamp: number;             // Server time
  readonly correlationId: string;         // Causation chain
  readonly causationId?: string;          // Event that caused this
}

export interface EventLog {
  append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent>;
  subscribe(fromId?: string): AsyncIterable<CognitiveEvent>;
  getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]>;
  getSnapshot(projection: string, version: number): Promise<unknown>;
}

// In-memory implementation for dev; Redis/Kafka for prod
export class InMemoryEventLog implements EventLog { ... }
```

**No `GraphDelta`, no `GraphSync`, no `BackendResult`.** Just events. Graph is a *projection*.

---

## 2. Backends = Pure Event Processors

```typescript
// core/src/backend/Backend.ts
export interface Backend {
  readonly id: string;
  readonly capabilities: ReadonlySet<Capability>;
  
  // Called once at startup with the event log
  initialize(log: EventLog, config: ConfigView): Promise<void>;
  
  // Optional: called on shutdown
  shutdown?(): Promise<void>;
}

// Backends self-select by subscribing to event types they handle.
// If multiple backends handle the same event, they ALL process it (fan-out).
// Composition is explicit in the capability registry.
```

---

## 3. Capability Registry = Derived Projection

```typescript
// core/src/capability/CapabilityRegistry.ts
export interface CapabilityRegistry {
  // Who provides what
  providers(cap: Capability): ReadonlySet<string>;  // backend IDs
  
  // What a backend provides
  capabilitiesOf(backendId: string): ReadonlySet<Capability>;
  
  // Compose: which backends together satisfy these caps?
  compose(required: Capability[]): BackendComposition[];
  
  // Subscribe to changes
  subscribe(): AsyncIterable<CapabilityRegistry>;
}
```

**No router.** Backends subscribe to event types they handle. Registry is a projection of `BackendManifest` events.

---

## 4. Config = Events Too

```typescript
// core/src/config/Config.ts
export interface ConfigEvent {
  type: 'config.set' | 'config.delete' | 'config.schema';
  payload: {
    path: string;           // "nar.cyclesPerStep"
    value?: unknown;
    schema?: ConfigSchema;  // Only on 'config.schema'
  };
}

// Backends declare schema via capability
export interface ConfigCapability {
  readonly schema: ConfigSchema;  // Zod schema for this backend's config
  readonly onChange(path: string, value: unknown): void;  // Hot-reload callback
}

// ConfigView = read-only projection of config events
export interface ConfigView {
  get<T>(path: string): T | undefined;
  getAll(prefix: string): Record<string, unknown>;
  subscribe(prefix: string): AsyncIterable<ConfigEvent>;
}
```

**Bootstrap = config events with `type: 'bootstrap'`.** Versioned, auditable, replayable.

---

## 5. UI = Visualization Backend

```typescript
// ui/src/backend/VisualizationBackend.ts
export class VisualizationBackend implements Backend {
  readonly id = 'visualization';
  readonly capabilities = new Set<Capability>(['graph-projection', 'chat-render', 'lens-render']);
  
  #log: EventLog;
  #wsServer: WebSocketServer;
  
  async initialize(log: EventLog, config: ConfigView): Promise<void> {
    this.#log = log;
    this.#wsServer = new WebSocketServer({ port: config.get('ui.port') ?? 8765 });
    
    // Subscribe to ALL events, project to graph
    for await (const event of log.subscribe()) {
      this.#projectEvent(event);
    }
  }
  
  #projectEvent(event: CognitiveEvent): void {
    const ops = this.#eventToGraphOps(event);
    this.#broadcast({ type: 'cognitive.delta', ops });
  }
  
  // Also handles: lens.set, focus.set, config.set from UI → appends to event log
}
```

**UI is a peer backend.** No special `startAgentUI`, no `AgentBridge`, no `UnifiedGraphProjection` as separate class. Just another projection.

---

## 6. The Kernel = 3 Classes

```typescript
// core/src/kernel/Kernel.ts
export class Kernel {
  #log: EventLog;
  #backends: Map<string, Backend> = new Map();
  #registry: CapabilityRegistry;
  
  constructor(log: EventLog = new InMemoryEventLog()) {
    this.#log = log;
    this.#registry = new CapabilityRegistryImpl(log);
  }
  
  async register(backend: Backend, config?: ConfigView): Promise<void> {
    await backend.initialize(this.#log, config ?? new ConfigView(this.#log));
    this.#backends.set(backend.id, backend);
    this.#registry.register(backend);
  }
  
  async start(): Promise<void> {
    // Append bootstrap events from config
    const bootstrap = this.#loadBootstrap();
    for (const event of bootstrap) {
      await this.#log.append(event);
    }
  }
  
  async stop(): Promise<void> {
    for (const backend of this.#backends.values()) {
      await backend.shutdown?.();
    }
  }
  
  // Convenience: append user input as event
  async submit(input: string, correlationId: string): Promise<void> {
    await this.#log.append({
      type: 'input.user',
      payload: { text: input },
      capabilities: ['input'],
      correlationId,
    });
  }
}

// Usage:
const kernel = new Kernel();
await kernel.register(new NarBackend());
await kernel.register(new MettaBackend());
await kernel.register(new VisualizationBackend());
await kernel.start();
// kernel.submit('<bird --> animal>.', crypto.randomUUID());
```

---

## 7. NAR Backend (Simplified)

```typescript
// nar/src/backend/NarBackend.ts
export class NarBackend implements Backend {
  readonly id = 'nar';
  readonly capabilities = NAR_CAPABILITIES;
  
  #nar: NAR;
  #log: EventLog;
  
  async initialize(log: EventLog, config: ConfigView): Promise<void> {
    this.#log = log;
    this.#nar = createNAR(config.get('nar') ?? DEFAULT_NAR_CONFIG);
    
    // Subscribe to events we handle
    for await (const event of log.subscribe()) {
      if (this.#handles(event)) {
        await this.#process(event);
      }
    }
  }
  
  #handles(event: CognitiveEvent): boolean {
    return event.type === 'input.user' && this.#isNarsese(event.payload.text) ||
           event.type === 'config.set' && event.payload.path.startsWith('nar.');
  }
  
  async #process(event: CognitiveEvent): Promise<void> {
    switch (event.type) {
      case 'input.user': {
        const result = await this.#nar.processInput(event.payload.text);
        for (const belief of result.newBeliefs) {
          await this.#log.append({
            type: 'belief.added',
            payload: { term: belief.term, truth: belief.truth },
            capabilities: ['truth-revision', 'inheritance'],
            correlationId: event.correlationId,
            causationId: event.id,
          });
        }
        break;
      }
      case 'config.set': {
        this.#applyConfig(event.payload.path, event.payload.value);
        break;
      }
    }
  }
  
  getTools(): ToolDefinition[] { ... }
}
```

**Eliminates `AgentImpl` entirely.** `NarBackend` *owns* NAR directly.

---

## 8. Capability = First-Class Composable Resource

```typescript
// core/src/capability/Capability.ts
export type Capability = 
  // Reasoning
  | 'truth-revision' | 'inheritance' | 'implication' | 'abduction' | 'deduction'
  | 'pattern-match' | 'rewrite' | 'query' | 'multi-space'
  // Memory
  | 'episodic-memory' | 'long-term-memory' | 'working-memory'
  // Agency
  | 'drive-management' | 'goal-management' | 'autonomy-loop'
  // Meta
  | 'self-reasoning' | 'tool-use' | 'llm-completion'
  // IO
  | 'graph-projection' | 'chat-render' | 'lens-render'
  // Config
  | 'config.schema' | 'config.hot-reload';

// Capability composition = algebraic
export interface CapabilityAlgebra {
  all(...caps: Capability[]): CapabilityExpr;    // All required
  any(...caps: Capability[]): CapabilityExpr;    // Any sufficient
  seq(first: Capability, then: Capability): CapabilityExpr;  // Sequence
  par(...caps: Capability[]): CapabilityExpr;    // Parallel
}

// Backend declares what it provides + what it needs
export interface BackendManifest {
  readonly id: string;
  readonly provides: CapabilityExpr;
  readonly requires: CapabilityExpr;  // For composition
  readonly configSchema: ConfigSchema;
}
```

**Composition is explicit, not implicit routing.**

---

## 9. Unified Event Types (NO Engine Field)

```typescript
// core/src/events/EventTypes.ts
export interface BaseEvent {
  readonly id: string;
  readonly type: string;
  readonly capabilities: ReadonlyArray<Capability>;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly causationId?: string;
}

export type CognitiveEvent =
  | (BaseEvent & { readonly type: 'belief.added'; readonly payload: { term: string; truth: TruthValue } })
  | (BaseEvent & { readonly type: 'atom.derived'; readonly payload: { atom: string; space: string } })
  | (BaseEvent & { readonly type: 'skill.executed'; readonly payload: { skill: string; result: string } })
  | (BaseEvent & { readonly type: 'drive.changed'; readonly payload: { drive: string; urgency: number } })
  | (BaseEvent & { readonly type: 'goal.achieved'; readonly payload: { goal: string } })
  | (BaseEvent & { readonly type: 'input.user'; readonly payload: { text: string } })
  | (BaseEvent & { readonly type: 'chat.assistant'; readonly payload: { text: string } })
  | (BaseEvent & { readonly type: 'config.set'; readonly payload: { path: string; value: unknown } })
  | (BaseEvent & { readonly type: 'config.schema'; readonly payload: { schema: ConfigSchema } })
  | (BaseEvent & { readonly type: 'bootstrap'; readonly payload: BootstrapSeed });

// Pure projection functions (testable, no side effects)
export function projectGraph(event: CognitiveEvent): GraphOp[] { ... }
export function projectChat(event: CognitiveEvent): ChatMessage | null { ... }
export function projectLens(event: CognitiveEvent, lens: Lens): GraphOp[] { ... }
```

---

## 10. File Structure (Radically Simplified)

```
core/
├── kernel/
│   ├── Kernel.ts           # ~80 lines
│   └── EventLog.ts         # Interface + in-memory impl
├── backend/
│   ├── Backend.ts          # Interface
│   └── CapabilityRegistry.ts
├── capability/
│   ├── Capability.ts       # Enum + algebra
│   └── BackendManifest.ts
├── config/
│   ├── Config.ts           # Config events + view
│   └── ConfigSchema.ts
├── events/
│   ├── EventTypes.ts       # All event types (Zod)
│   └── Projections.ts      # Pure projection functions
└── index.ts                # Public exports

nar/
├── backend/
│   └── NarBackend.ts       # Owns NAR directly
├── config/
│   └── NarConfigSchema.ts
└── index.ts

metta/
├── backend/
│   └── MettaBackend.ts     # Owns MeTTa runtime directly
├── config/
│   └── MettaConfigSchema.ts
└── index.ts

ui/
├── backend/
│   └── VisualizationBackend.ts  # Cytoscape + WS + projections
├── client/                 # Lit components (unchanged)
└── index.ts

bin/
└── senars.ts               # ~30 lines
```

---

## 11. What Disappears (Deleted)

| Current File/Concept | Lines | Replaced By |
|---------------------|-------|-------------|
| `core/src/Agent.ts` | 314 | `Kernel.ts` (~80) |
| `nar/src/agent/core/AgentImpl.ts` | 683 | **Deleted** — NAR backend owns NAR |
| `core/src/reasoning/ReasoningRouter.ts` | ~350 | **Deleted** — backends self-select |
| `core/src/reasoning/BackendTypes.ts` (GraphDelta, GraphSync) | ~80 | **Deleted** — graph is projection |
| `ui/src/server/AgentBridge.ts` | 138 | **Deleted** — UI is a backend |
| `ui/src/server/UnifiedGraphProjection.ts` | 180 | **Deleted** — projection is pure function |
| `core/src/reasoning/BackendTypes.ts` (BackendConfig) | ~80 | `ConfigView` (typed, projected) |
| `CognitiveEvent.engine` field | — | **Removed** — capabilities only |
| `core/src/bootstrap.ts` (imperative) | 61 | Bootstrap events in config |
| `ui/src/server/index.ts` (startAgentUI) | 173 | **Deleted** — `VisualizationBackend` registers |
| `startWebUI*` legacy paths | ~700 | **Deleted** (already done in Batch 13) |

---

## 12. Migration Path (Each Step Shippable)

| Step | Change | Tests |
|------|--------|-------|
| 1 | Add `EventLog` interface + in-memory impl | New tests |
| 2 | Make `NarBackend` consume `EventLog` directly (parallel) | Dual-run tests |
| 3 | Make `MettaBackend` consume `EventLog` directly | Dual-run tests |
| 4 | Create `VisualizationBackend` (UI as backend) | E2E tests |
| 5 | Create `Kernel` + `CapabilityRegistry` | Integration tests |
| 6 | Switch `bin/senars.ts` to new kernel | Smoke tests |
| 7 | Delete `Agent`, `AgentImpl`, `ReasoningRouter`, `AgentBridge`, `UnifiedGraphProjection` | All tests pass |
| 8 | Remove `engine` from events, add `capabilities[]` | All tests pass |
| 9 | Convert config to events, add hot-reload | Config tests |
| 10 | Convert bootstrap to events | Bootstrap tests |

**Rollback at any step:** Old code remains until new code passes all tests.

---

## 13. Usability Wins

| Before | After |
|--------|-------|
| `pnpm senars` → opaque process | `pnpm senars` → kernel + backends visible in logs |
| Config = JSON file, no validation | Config = events, Zod-validated, hot-reload |
| Bootstrap = imperative code | Bootstrap = declarative events, versioned, replayable |
| Router = keyword matching | Routing = capability subscription (deterministic) |
| Graph sync = push-only, fragile | Graph = projection of event log (rebuildable, time-travel) |
| UI = special snowflake | UI = peer backend (testable, replaceable, scriptable) |
| Backends = isolated | Backends = composable via capability algebra |
| Debug = guesswork | Debug = event log replay + projections |

---

## 14. The Final `bin/senars.ts`

```typescript
#!/usr/bin/env tsx
import { Kernel } from '@senars/core';
import { NarBackend } from '@senars/nar/backend';
import { MettaBackend } from '@senars/metta/backend';
import { VisualizationBackend } from '@senars/ui/backend';
import { InMemoryEventLog } from '@senars/core/eventlog';
import { DEFAULT_NAR_CONFIG } from '../config';

const log = new InMemoryEventLog();
const kernel = new Kernel(log);

await kernel.register(new NarBackend(), { nar: DEFAULT_NAR_CONFIG });
await kernel.register(new MettaBackend());
await kernel.register(new VisualizationBackend());

await kernel.start();

console.log('SeNARS running. Event log:', log);
console.log('UI at http://localhost:8765');

process.on('SIGINT', async () => {
  await kernel.stop();
  process.exit(0);
});
```

---

## 15. Why This Is the End State

1. **One abstraction** (event log) explains everything
2. **Zero special cases** — UI, config, bootstrap, backends all use the same protocol
3. **Maximal decoupling** — backends know only `EventLog` and `ConfigView`
4. **Maximal composability** — capability algebra enables new combinations without code changes
5. **Maximal observability** — every state change is an event; time-travel is free
6. **Minimal code** — ~500 lines kernel vs ~2000 current
7. **Testable** — pure projections, deterministic event log, pure backend processors

This is the architecture that was trying to emerge all along. The previous iterations were necessary scaffolding; this is the essence.

---

## 16. Validation Checklist

- [ ] EventLog interface + InMemoryEventLog implementation
- [ ] Backend interface + CapabilityRegistry
- [ ] Capability enum + algebra
- [ ] Config events + ConfigView
- [ ] Unified CognitiveEvent types (Zod) + pure projections
- [ ] NarBackend owning NAR directly
- [ ] MettaBackend owning MeTTa runtime directly
- [ ] VisualizationBackend as peer backend
- [ ] Kernel class
- [ ] bin/senars.ts entry point
- [ ] Migration steps 1-10 with tests at each step
- [ ] Deletion of obsolete files (Agent, AgentImpl, Router, Bridge, Projection, etc.)
- [ ] All existing tests pass (1048+ tests)
- [ ] Typecheck clean (5/5 packages)
- [ ] E2E smoke tests pass

---

*Supersedes `NEXT.agent5.md`. Strategy: **Event-sourced capability kernel.** The vertical slice is the Kernel with NAR + MeTTa + Visualization backends.*