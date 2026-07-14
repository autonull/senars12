# SeNARS — Event-Sourced Capability Kernel (Supersedes NEXT.agent5.md)

> **Core insight**: The unification trap was trying to unify *agents*, then *backends*. The correct seam is *inside the kernel*: a single **EventLog** that everything projects from. Backends, UI, config, bootstrap — all are equal consumers/producers of events. No router, no bridge, no special cases.

---

## The Architecture (One Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EVENT LOG (Source of Truth)                    │
│  Events: { id, type, payload, timestamp, correlationId, causationId }      │
│  - Append-only, time-ordered (ULID)                                         │
│  - In-memory (dev) / Redis/Kafka (prod)                                     │
│  - Schema-validated payloads (Zod per event type)                          │
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
                    │  (derived from BackendManifest)│
                    │  "truth-revision" → [nar]     │
                    │  "pattern-match" → [metta]    │
                    │  "graph-projection" → [ui]    │
                    └───────────────────────────────┘
```

---

## 1. Event Log = Single Source of Truth

```typescript
// core/src/eventlog/EventLog.ts
import type { CognitiveEvent } from '../events/EventTypes.js';

export interface EventLog {
  /** Append a validated event. Returns the event with id/timestamp filled. */
  append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent>;

  /** Subscribe to events matching filter, starting from cursor (exclusive). */
  subscribe(options?: {
    filter?: (event: CognitiveEvent) => boolean;
    fromId?: string;                    // ULID cursor (exclusive)
    types?: string[];                   // Fast-path: exact type match
  }): AsyncIterable<CognitiveEvent>;

  /** Get a contiguous range of events by ID. */
  getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]>;

  /** Get a materialized projection snapshot (if registered). */
  getSnapshot<T>(projectionName: string, version: number): Promise<T | null>;
}

/** Errors that can occur when appending. */
export class EventLogError extends Error {
  constructor(
    public readonly code: 'FULL' | 'UNAVAILABLE' | 'INVALID_EVENT' | 'SERIALIZATION_FAILED',
    message: string,
    public readonly cause?: Error
  ) { super(message); }
}

/** In-memory implementation for dev; Redis/Kafka for prod. */
export class InMemoryEventLog implements EventLog { ... }
```

**Key changes from draft:**
- `subscribe()` accepts **filter + type array + cursor** — no full-scan fan-out
- **No `capabilities[]` on events** — derived from emitting backend's manifest
- **Schema-validated payloads** — Zod per event type (see §9)
- **Explicit error types** — backpressure, dead-letter, retry semantics

---

## 2. Backends = Pure Event Processors

```typescript
// core/src/backend/Backend.ts
import type { EventLog } from '../eventlog/EventLog.js';
import type { ConfigView } from '../config/Config.js';
import type { Capability } from '../capability/Capability.js';

export interface Backend {
  readonly id: string;
  readonly manifest: BackendManifest;

  /** Called once at startup. Backend subscribes to log, builds internal state. */
  initialize(log: EventLog, config: ConfigView): Promise<void>;

  /** Optional: graceful shutdown. */
  shutdown?(): Promise<void>;
}

export interface BackendManifest {
  readonly id: string;
  readonly provides: ReadonlySet<Capability>;
  readonly requires: ReadonlySet<Capability>;        // For composition hints
  readonly configSchema: ConfigSchema;               // Zod schema
  readonly eventTypes: ReadonlySet<string>;          // Types this backend EMITS
  readonly handles: ReadonlySet<string>;             // Types this backend CONSUMES
}
```

**Key changes:**
- **Manifest declares `handles` + `eventTypes`** — registry knows who consumes/produces what
- **No `capabilities` on events** — registry derives it from `BackendManifest.provides`
- **Backends self-select** by subscribing with `types: backend.manifest.handles`

---

## 3. Capability Registry = Derived Projection (No Algebra)

```typescript
// core/src/capability/CapabilityRegistry.ts
import type { BackendManifest, Capability } from './BackendManifest.js';
import type { EventLog } from '../eventlog/EventLog.js';

export interface CapabilityRegistry {
  /** Backends that PROVIDE this capability. */
  providers(cap: Capability): ReadonlySet<string>;

  /** Capabilities a backend provides. */
  capabilitiesOf(backendId: string): ReadonlySet<Capability>;

  /** Which backends together cover all required capabilities? (Greedy set cover) */
  compose(required: ReadonlySet<Capability>): string[][];

  /** Live updates when backends register/unregister. */
  subscribe(): AsyncIterable<CapabilityRegistry>;
}

/** Implementation: subscribes to `backend.registered` events, builds index. */
export class CapabilityRegistryImpl implements CapabilityRegistry { ... }
```

**Removed:** `CapabilityAlgebra` (`all/any/seq/par`) — no concrete use case.  
**Kept:** `compose()` — greedy set cover for "which backends satisfy these caps?" Used by tool wiring (§7).

---

## 4. Config = Events Too (With Load Order)

```typescript
// core/src/config/Config.ts
import type { ConfigSchema } from './ConfigSchema.js';

export interface ConfigEvent {
  type: 'config.set' | 'config.delete' | 'config.schema';
  payload: {
    path: string;           // "nar.cyclesPerStep"
    value?: unknown;
    schema?: ConfigSchema;  // Only on 'config.schema'
  };
}

export interface ConfigCapability {
  readonly schema: ConfigSchema;
  readonly onChange(path: string, value: unknown): void;  // Hot-reload
}

export interface ConfigView {
  get<T>(path: string): T | undefined;
  getAll(prefix: string): Record<string, unknown>;
  subscribe(prefix: string): AsyncIterable<ConfigEvent>;
}

/** Implementation: projects config events from event log. */
export class ConfigViewImpl implements ConfigView { ... }
```

**Load order (enforced by `Kernel.start()`):**
1. Load `senars.config.json` (or env) → parse Zod schema
2. Append `config.schema` events for each backend
3. Append `config.set` events for each value
4. Append `bootstrap` events (beliefs, atoms, skills)
5. **Then** call `backend.initialize()` — config is already in log

No race: backends see their config schema/values on first subscribe.

---

## 5. UI = Visualization Backend (Cursor-Aware)

```typescript
// ui/src/backend/VisualizationBackend.ts
import type { Backend, BackendManifest } from '@senars/core/backend/Backend.js';
import type { EventLog } from '@senars/core/eventlog/EventLog.js';
import type { ConfigView } from '@senars/core/config/Config.js';
import { WebSocketServer } from 'ws';

export class VisualizationBackend implements Backend {
  readonly id = 'visualization';
  readonly manifest: BackendManifest = {
    id: 'visualization',
    provides: new Set(['graph-projection', 'chat-render', 'lens-render']),
    requires: new Set(),
    configSchema: VisualizationConfigSchema,
    eventTypes: new Set(['graph.op', 'chat.message', 'lens.set', 'focus.set']),
    handles: new Set(['*']),  // Consumes all for projection
  };

  #log: EventLog;
  #wsServer: WebSocketServer;
  #lastEventId: string | null = null;  // Cursor for reconnect

  async initialize(log: EventLog, config: ConfigView): Promise<void> {
    this.#log = log;
    this.#wsServer = new WebSocketServer({ port: config.get('ui.port') ?? 8765 });

    // Initial full sync on startup
    await this.#fullSync();

    // Incremental from cursor
    for await (const event of log.subscribe({
      fromId: this.#lastEventId,
      // filter: (e) => e.type !== 'telemetry',  // Optional: skip high-volume
    })) {
      this.#projectEvent(event);
      this.#lastEventId = event.id;
    }
  }

  async #fullSync(): Promise<void> {
    const events = await this.#log.getRange('0');  // From beginning
    for (const event of events) {
      this.#projectEvent(event);
      this.#lastEventId = event.id;
    }
  }

  #projectEvent(event: CognitiveEvent): void {
    const ops = projectGraph(event);
    if (ops.length) this.#broadcast({ type: 'cognitive.delta', ops });
    // Also: projectChat, projectLens, etc.
  }

  /** Also handles: lens.set, focus.set, config.set from UI → appends to log */
}
```

**Key changes:**
- Uses `subscribe({ fromId })` — **no replay + `#lastEventId` cursor** — no full replay on reconnect
- `#fullSync()` only at startup; incremental thereafter
- UI-origin actions (lens.set, config.set) → append to log (same protocol)

---

## 6. Kernel = 3 Classes (~120 lines)

```typescript
// core/src/kernel/Kernel.ts
import type { EventLog } from '../eventlog/EventLog.js';
import type { Backend } from '../backend/Backend.js';
import type { ConfigView } from '../config/Config.js';
import { CapabilityRegistryImpl } from '../capability/CapabilityRegistry.js';
import { InMemoryEventLog } from '../eventlog/InMemoryEventLog.js';

export class Kernel {
  #log: EventLog;
  #backends: Map<string, Backend> = new Map();
  #registry: CapabilityRegistryImpl;

  constructor(log: EventLog = new InMemoryEventLog()) {
    this.#log = log;
    this.#registry = new CapabilityRegistryImpl(log);
  }

  /** Register a backend. Config is optional; if absent, loads from log. */
  async register(backend: Backend, config?: ConfigView): Promise<void> {
    // 1. Emit backend registration event (for registry)
    await this.#log.append({
      type: 'backend.registered',
      payload: { manifest: backend.manifest },
      correlationId: crypto.randomUUID(),
    });

    // 2. Initialize backend (it subscribes to log)
    await backend.initialize(this.#log, config ?? new ConfigViewImpl(this.#log));

    this.#backends.set(backend.id, backend);
  }

  /** Start kernel: load initial config + bootstrap from file/env, then signal ready. */
  async start(configPath?: string): Promise<void> {
    // 1. Load external config file if provided
    const externalConfig = configPath ? await loadConfigFile(configPath) : {};

    // 2. Emit config.schema + config.set events for all registered backends
    for (const backend of this.#backends.values()) {
      await this.#emitConfigSchema(backend.manifest.configSchema);
      const backendConfig = externalConfig[backend.id] ?? {};
      for (const [path, value] of Object.entries(backendConfig)) {
        await this.#emitConfigSet(backend.id, path, value);
      }
    }

    // 3. Emit bootstrap events (beliefs, atoms, skills)
    await this.#emitBootstrap(externalConfig.bootstrap ?? DEFAULT_BOOTSTRAP);

    // 4. Kernel ready
    await this.#log.append({
      type: 'kernel.ready',
      payload: { backendIds: [...this.#backends.keys()] },
      correlationId: crypto.randomUUID(),
    });
  }

  async stop(): Promise<void> {
    for (const backend of this.#backends.values()) {
      await backend.shutdown?.();
    }
  }

  /** Convenience: submit user input as event. */
  async submit(input: string, correlationId: string): Promise<void> {
    await this.#log.append({
      type: 'input.user',
      payload: { text: input },
      correlationId,
    });
  }

  // Private helpers for config/bootstrap emission...
}
```

---

## 7. Cross-Backend Tool Calls = Request/Response over Log

```typescript
// core/src/events/ToolEvents.ts
import type { CognitiveEvent } from './EventTypes.js';

// NAR (or any backend) requests a tool execution
export interface ToolRequestEvent extends CognitiveEvent {
  readonly type: 'tool.request';
  readonly payload: {
    readonly toolName: string;           // e.g., 'metta-match'
    readonly args: Record<string, unknown>;
    readonly timeoutMs?: number;
  };
}

// Target backend responds
export interface ToolResponseEvent extends CognitiveEvent {
  readonly type: 'tool.response';
  readonly payload: {
    readonly requestId: string;          // = tool.request causationId
    readonly toolName: string;
    readonly result?: unknown;
    readonly error?: string;
    readonly durationMs: number;
  };
}

// Backends declare tools in manifest
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly schema: Record<string, unknown>;  // JSON Schema
  readonly backendId: string;                // Which backend provides it
}
```

**Protocol:**
1. NAR needs `metta-match` → appends `tool.request` with `correlationId`
2. MeTTa backend subscribes to `tool.request` where `toolName` matches its tools
3. MeTTa executes, appends `tool.response` with `causationId = request.id`
4. NAR correlates by `requestId` (stored during request)

**Tool wiring at startup:**
```typescript
// In Kernel.start() or separate wiring phase:
const registry = kernel.getCapabilityRegistry();
const toolProviders = registry.providers('tool-use');
for (const providerId of toolProviders) {
  const backend = kernel.getBackend(providerId);
  const tools = backend.getTools?.() ?? [];
  // Register each tool in registry so requesters can discover
}
```

**This replaces `Agent.registerBackend()` tool injection** with explicit, observable, replayable protocol.

---

## 8. NAR Backend (Owns NAR Directly)

```typescript
// nar/src/backend/NarBackend.ts
import type { Backend, BackendManifest } from '@senars/core/backend/Backend.js';
import type { EventLog } from '@senars/core/eventlog/EventLog.js';
import type { ConfigView } from '@senars/core/config/Config.js';
import { createNAR, type NAR } from '../index.js';
import { DEFAULT_NAR_CONFIG } from '../../config/index.js';
import { NAR_CAPABILITIES } from './NarCapabilities.js';
import { NarConfigSchema } from '../config/NarConfigSchema.js';

export class NarBackend implements Backend {
  readonly id = 'nar';
  readonly manifest: BackendManifest = {
    id: 'nar',
    provides: NAR_CAPABILITIES,
    requires: new Set(['tool-use']),  // Can consume tools from other backends
    configSchema: NarConfigSchema,
    eventTypes: new Set([
      'belief.added', 'belief.retracted', 'belief.revised',
      'drive.changed', 'goal.achieved', 'goal.failed',
      'concept.activated', 'derivation.made',
    ]),
    handles: new Set(['input.user', 'config.set', 'tool.response']),
  };

  #nar: NAR;
  #log: EventLog;
  #pendingTools = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  async initialize(log: EventLog, config: ConfigView): Promise<void> {
    this.#log = log;
    this.#nar = createNAR(config.get('nar') ?? DEFAULT_NAR_CONFIG);

    // Subscribe ONLY to events we handle
    for await (const event of log.subscribe({
      types: [...this.manifest.handles],
    })) {
      await this.#process(event);
    }
  }

  async #process(event: CognitiveEvent): Promise<void> {
    switch (event.type) {
      case 'input.user': {
        if (!this.#isNarsese(event.payload.text)) break;
        const result = await this.#nar.processInput(event.payload.text);
        for (const belief of result.newBeliefs) {
          await this.#log.append({
            type: 'belief.added',
            payload: { term: belief.term.toString(), truth: belief.truth },
            correlationId: event.correlationId,
            causationId: event.id,
          });
        }
        for (const retracted of result.retractedBeliefs) {
          await this.#log.append({
            type: 'belief.retracted',
            payload: { term: retracted.term.toString() },
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
      case 'tool.response': {
        const pending = this.#pendingTools.get(event.payload.requestId);
        if (pending) {
          if (event.payload.error) pending.reject(new Error(event.payload.error));
          else pending.resolve(event.payload.result);
          this.#pendingTools.delete(event.payload.requestId);
        }
        break;
      }
    }
  }

  /** Request a tool from another backend via log. */
  async requestTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const correlationId = crypto.randomUUID();
    const promise = new Promise<unknown>((resolve, reject) => {
      this.#pendingTools.set(correlationId, { resolve, reject });
    });
    await this.#log.append({
      type: 'tool.request',
      payload: { toolName, args, timeoutMs: 30000 },
      correlationId,
    });
    return promise;
  }

  getTools(): ToolDefinition[] {
    // NAR's own tools + dynamically discovered external tools
    return [
      { name: 'nar-query', ... },
      { name: 'nar-explain', ... },
    ];
  }
}
```

**Key points:**
- `handles` in manifest → `subscribe({ types })` — **no full scan**
- `belief.retracted` event exists — **graph can shrink**
- Tool requests via log with correlation — **observable, replayable**
- `#pendingTools` map — **async await over event log**

---

## 9. Unified Event Types (Zod-Validated, No Engine Field)

```typescript
// core/src/events/EventTypes.ts
import { z } from 'zod';
import type { Capability } from '../capability/Capability.js';

// Base schema
const BaseEventSchema = z.object({
  id: z.string().ulid(),
  type: z.string(),
  timestamp: z.number().int().nonnegative(),
  correlationId: z.string().uuid(),
  causationId: z.string().uuid().optional(),
});

export const CognitiveEventSchema = BaseEventSchema.extend({
  type: z.union([
    // User input
    z.literal('input.user'),
    // NAR events
    z.literal('belief.added'), z.literal('belief.retracted'), z.literal('belief.revised'),
    z.literal('drive.changed'), z.literal('goal.achieved'), z.literal('goal.failed'),
    z.literal('concept.activated'), z.literal('derivation.made'),
    // MeTTa events
    z.literal('atom.derived'), z.literal('atom.retracted'),
    z.literal('skill.executed'), z.literal('query.result'),
    // Tool protocol
    z.literal('tool.request'), z.literal('tool.response'),
    // Config
    z.literal('config.set'), z.literal('config.delete'), z.literal('config.schema'),
    // System
    z.literal('kernel.ready'), z.literal('backend.registered'),
    z.literal('bootstrap'),
  ]),
  payload: z.unknown(),  // Validated by per-type schema below
});

export type CognitiveEvent = z.infer<typeof CognitiveEventSchema>;

// Per-type payload schemas (used at append time)
export const PayloadSchemas = {
  'input.user': z.object({ text: z.string().max(10000) }),
  'belief.added': z.object({ term: z.string(), truth: TruthValueSchema }),
  'belief.retracted': z.object({ term: z.string() }),
  'belief.revised': z.object({ term: z.string(), oldTruth: TruthValueSchema, newTruth: TruthValueSchema }),
  'drive.changed': z.object({ drive: z.string(), urgency: z.number().min(0).max(1) }),
  'goal.achieved': z.object({ goal: z.string() }),
  'goal.failed': z.object({ goal: z.string(), reason: z.string() }),
  'concept.activated': z.object({ term: z.string(), priority: z.number().min(0).max(1) }),
  'derivation.made': z.object({ rule: z.string(), premises: z.array(z.string()), conclusion: z.string() }),
  'atom.derived': z.object({ atom: z.string(), space: z.string() }),
  'atom.retracted': z.object({ atom: z.string(), space: z.string() }),
  'skill.executed': z.object({ skill: z.string(), args: z.array(z.string()), result: z.string(), durationMs: z.number() }),
  'query.result': z.object({ pattern: z.string(), results: z.array(z.string()), space: z.string() }),
  'tool.request': z.object({ toolName: z.string(), args: z.record(z.unknown()), timeoutMs: z.number().optional() }),
  'tool.response': z.object({ requestId: z.string().uuid(), toolName: z.string(), result: z.unknown().optional(), error: z.string().optional(), durationMs: z.number() }),
  'config.set': z.object({ path: z.string(), value: z.unknown() }),
  'config.delete': z.object({ path: z.string() }),
  'config.schema': z.object({ schema: ConfigSchemaSchema }),
  'kernel.ready': z.object({ backendIds: z.array(z.string()) }),
  'backend.registered': z.object({ manifest: BackendManifestSchema }),
  'bootstrap': z.object({ beliefs: z.array(z.string()).optional(), atoms: z.array(z.object({ atom: z.string(), space: z.string().optional() })).optional(), skills: z.array(z.object({ name: z.string(), code: z.string() })).optional() }),
} as const;

const TruthValueSchema = z.object({ frequency: z.number().min(0).max(1), confidence: z.number().min(0).max(1) });

/** Validate payload at append time. */
export function validatePayload(type: string, payload: unknown): void {
  const schema = PayloadSchemas[type as keyof typeof PayloadSchemas];
  if (schema) schema.parse(payload);
}
```

**Every event payload is Zod-validated on append.** No `unknown` at runtime.

---

## 10. Pure Projection Functions (Testable, No Side Effects)

```typescript
// core/src/events/Projections.ts
import type { CognitiveEvent } from './EventTypes.js';
import type { GraphOp, GraphNodeData, GraphEdgeData } from '../protocol/Protocol.js';

/** Convert any cognitive event to graph operations. Pure. */
export function projectGraph(event: CognitiveEvent): GraphOp[] {
  switch (event.type) {
    case 'belief.added':
      return [{ action: 'add_node', id: `nar:${hashTerm(event.payload.term)}`, data: { ... } }];
    case 'belief.retracted':
      return [{ action: 'remove_node', id: `nar:${hashTerm(event.payload.term)}` }];
    case 'atom.derived':
      return [{ action: 'add_node', id: `metta:${hashAtom(event.payload.atom)}`, data: { ... } }];
    case 'derivation.made':
      return event.payload.premises.map(p => ({
        action: 'add_edge',
        source: `nar:${hashTerm(p)}`,
        target: `nar:${hashTerm(event.payload.conclusion)}`,
        data: { type: 'inference', rule: event.payload.rule },
      }));
    default:
      return [];
  }
}

/** Convert to chat message if applicable. */
export function projectChat(event: CognitiveEvent): ChatMessage | null {
  if (event.type === 'input.user') return { role: 'user', content: event.payload.text };
  if (event.type === 'tool.response' && !event.payload.error) return { role: 'assistant', content: String(event.payload.result) };
  return null;
}

/** Lens-specific projection. */
export function projectLens(event: CognitiveEvent, lens: Lens): GraphOp[] {
  const base = projectGraph(event);
  return base.filter(op => lensFilter(op, lens));
}
```

**All projections are pure functions.** Test with `event → ops` tables. No EventLog, no WS, no backend.

---

## 11. File Structure (Final)

```
core/
├── kernel/
│   ├── Kernel.ts           # ~120 lines
│   └── index.ts
├── eventlog/
│   ├── EventLog.ts         # Interface + errors
│   ├── InMemoryEventLog.ts # Dev impl
│   └── index.ts
├── backend/
│   ├── Backend.ts          # Interface + Manifest
│   └── index.ts
├── capability/
│   ├── Capability.ts       # Enum (26 caps)
│   ├── CapabilityRegistry.ts
│   └── index.ts
├── config/
│   ├── Config.ts           # Events + ConfigView
│   ├── ConfigSchema.ts
│   └── index.ts
├── events/
│   ├── EventTypes.ts       # All event types + Zod schemas
│   ├── Projections.ts      # Pure projections
│   ├── ToolEvents.ts       # Tool request/response
│   └── index.ts
├── protocol/
│   └── Protocol.ts         # GraphNodeData, GraphOp, etc. (shared with UI)
└── index.ts                # Public exports

nar/
├── backend/
│   ├── NarBackend.ts       # Owns NAR directly
│   └── NarCapabilities.ts  # Capability set
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

## 12. What Disappears (Deleted)

| Current File/Concept | Lines | Replaced By |
|---------------------|-------|-------------|
| `core/src/Agent.ts` | 314 | `Kernel.ts` (~120) |
| `nar/src/agent/core/AgentImpl.ts` | 683 | **Deleted** — `NarBackend` owns NAR |
| `core/src/reasoning/ReasoningRouter.ts` | ~350 | **Deleted** — backends self-select via `subscribe({ types })` |
| `core/src/reasoning/BackendTypes.ts` (GraphDelta, GraphSync, BackendResult) | ~80 | **Deleted** — graph is pure projection |
| `ui/src/server/AgentBridge.ts` | 138 | **Deleted** — UI is a backend |
| `ui/src/server/UnifiedGraphProjection.ts` | 180 | **Deleted** — projection is pure function |
| `core/src/reasoning/BackendTypes.ts` (BackendConfig) | ~80 | `ConfigView` (typed, projected) |
| `CognitiveEvent.engine` field | — | **Removed** — capabilities from manifest |
| `core/src/bootstrap.ts` (imperative) | 61 | Bootstrap events in config |
| `ui/src/server/index.ts` (startAgentUI) | 173 | **Deleted** — `VisualizationBackend` registers |
| `startWebUI*` legacy paths | ~700 | **Deleted** (already done in Batch 13) |
| `core/src/CognitiveCoordinator.ts` | — | **Deleted** (already done) |

---

## 13. Migration Path (Each Step Shippable)

| Step | Change | Tests |
|------|--------|-------|
| 1 | Add `EventLog` interface + `InMemoryEventLog` + Zod payload validation | New unit tests |
| 2 | Add `Backend` interface + `BackendManifest` + `CapabilityRegistry` | New unit tests |
| 3 | Create `NarBackendV2` consuming `EventLog` directly (parallel to current `NarBackend`) | Dual-run: old + new NarBackend both process events |
| 4 | Create `MettaBackendV2` consuming `EventLog` directly | Dual-run tests |
| 5 | Create `VisualizationBackend` (UI as backend) with cursor-based sync | E2E tests |
| 6 | Create `Kernel` + `ConfigView` + config-load order | Integration tests |
| 7 | Switch `bin/senars.ts` to new kernel + V2 backends | Smoke tests |
| 8 | Delete `Agent`, `AgentImpl`, `ReasoningRouter`, `AgentBridge`, `UnifiedGraphProjection` | All tests pass |
| 9 | Remove `engine` from events, add `backend.registered` events | All tests pass |
| 10 | Convert config to events, add hot-reload via `config.set` | Config tests |
| 11 | Convert bootstrap to events, add `belief.retracted`/`atom.retracted` | Bootstrap tests |
| 12 | Implement tool request/response protocol between backends | Integration tests |

**Rollback at any step:** Old code remains until new code passes all tests. V2 backends run alongside V1 in steps 3-4.

---

## 14. Usability Wins

| Before | After |
|--------|-------|
| `pnpm senars` → opaque process | `pnpm senars` → kernel + backends visible in logs |
| Config = JSON file, no validation | Config = events, Zod-validated, hot-reload via `config.set` |
| Bootstrap = imperative code | Bootstrap = declarative events, versioned, replayable |
| Router = keyword matching | Routing = `subscribe({ types: backend.manifest.handles })` |
| Graph sync = push-only, fragile | Graph = pure projection of event log (rebuildable, time-travel) |
| UI = special snowflake | UI = peer backend (testable, replaceable, scriptable) |
| Backends = isolated | Backends = composable via `CapabilityRegistry.compose()` + tool protocol |
| Debug = guesswork | Debug = event log replay + pure projections |
| Tool calls = hidden injection | Tool calls = observable `tool.request`/`tool.response` events |

---

## 15. The Final `bin/senars.ts`

```typescript
#!/usr/bin/env tsx
import { Kernel } from '@senars/core';
import { NarBackend } from '@senars/nar/backend';
import { MettaBackend } from '@senars/metta/backend';
import { VisualizationBackend } from '@senars/ui/backend';
import { InMemoryEventLog } from '@senars/core/eventlog';
import { DEFAULT_NAR_CONFIG } from '../config';
import { loadConfigFile } from '../config/loadConfigFile.js';

const log = new InMemoryEventLog();
const kernel = new Kernel(log);

await kernel.register(new NarBackend());
await kernel.register(new MettaBackend());
await kernel.register(new VisualizationBackend());

// Load config from file (or env), emit as config events, then bootstrap
await kernel.start('./senars.config.json');

console.log('SeNARS running. Event log:', log);
console.log('UI at http://localhost:8765');

process.on('SIGINT', async () => {
  await kernel.stop();
  process.exit(0);
});
```

---

## 16. Why This Is the End State

1. **One abstraction** (event log) explains everything
2. **Zero special cases** — UI, config, bootstrap, backends all use the same protocol
3. **Maximal decoupling** — backends know only `EventLog` and `ConfigView`
4. **Maximal composability** — `CapabilityRegistry.compose()` + tool protocol enables new combinations without code changes
5. **Maximal observability** — every state change is an event; time-travel is free
6. **Minimal code** — ~600 lines kernel vs ~2000 current
7. **Testable** — pure projections, deterministic event log, pure backend processors
8. **Production-ready** — Redis/Kafka swap for `EventLog`, cursor-based sync, explicit error types

This is the architecture that was trying to emerge all along. The previous iterations were necessary scaffolding; this is the essence.

---

## 17. Validation Checklist

- [ ] EventLog interface + InMemoryEventLog implementation + error types
- [ ] Backend interface + BackendManifest + CapabilityRegistry
- [ ] Capability enum (26 caps, no algebra)
- [ ] Config events + ConfigView + load order in Kernel.start()
- [ ] Unified CognitiveEvent types (Zod) + per-type payload schemas + validatePayload()
- [ ] Tool request/response protocol + correlation-based async
- [ ] NarBackend owning NAR directly + `handles` + `eventTypes` + `belief.retracted`
- [ ] MettaBackend owning MeTTa runtime directly
- [ ] VisualizationBackend as peer backend with cursor-based sync
- [ ] Kernel class with config-file loading + bootstrap emission
- [ ] Pure projection functions (graph, chat, lens) in `core/src/events/Projections.ts`
- [ ] bin/senars.ts entry point
- [ ] Migration steps 1-12 with tests at each step
- [ ] Deletion of obsolete files (Agent, AgentImpl, Router, Bridge, Projection, etc.)
- [ ] All existing tests pass (1048+ tests)
- [ ] Typecheck clean (5/5 packages)
- [ ] E2E smoke tests pass

---

*Supersedes `NEXT.agent5.md`. Strategy: **Event-sourced capability kernel with pure projections.** The vertical slice is the Kernel with NAR + MeTTa + Visualization backends.*