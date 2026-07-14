# NEXT.agent8.md — Radical Architectural Unification

> **Goal**: Push beyond incremental refactoring. Question every abstraction. Remove what isn't pulling weight.

---

## 1. Eliminate the NAR Package Boundary

**Problem**: NAR package = 700+ lines in `nar.ts` + 50+ modules. Backend uses ~5%.

**Action**: Inline only what the kernel needs into `nar/backend/MinimalNAR.ts` (~200 lines).

```typescript
// nar/backend/MinimalNAR.ts — ALL the NAR the kernel needs
export class MinimalNAR {
  private memory: Map<string, Belief> = new Map();
  
  async input(text: string): Promise<void> { /* parse → derive → store */ }
  getBeliefs(): Belief[] { return [...this.memory.values()]; }
  setConfig(cfg: Partial<NARConfig>): void { /* update params */ }
  async start(): Promise<void> { /* no-op for minimal */ }
  async stop(): Promise<void> { }
}
```

**Delete**: `nar/src/nar.ts`, `nar/src/nar-execution.ts`, `nar/src/nar-io.ts`, `nar/src/nar-lm.ts`, `nar/src/agent/`, `nar/src/cognitive/`, `nar/src/lm/`, `nar/src/drives/`, `nar/src/rlfp/`, `nar/src/self/`, `nar/src/stream/`, `nar/src/nl/`, `nar/src/learning/`, `nar/src/orchestration.ts`, `nar/src/commands/`, `nar/src/schemas/`

**Keep**: `terms/`, `memory/`, `rules/`, `task/`, `reason/`, `types/` (core logic only)

---

## 2. Unify NAR + MeTTa Event Schema

**Current**: `belief.added` (NAR) vs `atom.derived` (MeTTa) — different payloads.

**Unified**: Single `fact.added` event:

```typescript
type FactAdded = {
  type: 'fact.added';
  payload: {
    engine: 'nar' | 'metta';
    term: string;           // NAR term or MeTTa atom string
    truth?: { f: number; c: number };  // optional for MeTTa
    space?: string;         // MeTTa space
    source: 'input' | 'derivation' | 'tool';
  };
};
```

**Benefit**: Single projection function, single UI renderer, single query language.

---

## 3. Capability = Tool Router

**Current**: Tools registered manually, correlation IDs managed manually.

**New**: Capabilities declare what tools they provide. Kernel routes automatically.

```typescript
// In BackendManifest
provides: new Set(['truth-revision', 'tool:nar-query', 'tool:nar-explain']),
// or
provides: new Set(['pattern-match', 'tool:metta-match', 'tool:metta-rewrite']);

// Kernel auto-registers:
const toolProviders = registry.providers('tool:*');
for (const provider of toolProviders) {
  const tools = provider.getTools();
  for (const tool of tools) router.register(tool.name, provider.id);
}

// Tool request becomes:
await log.append({ type: 'tool.request', payload: { tool: 'nar-query', args: { term: 'bird' }}});
```

**No more manual correlation IDs** — kernel correlates by `causationId`.

---

## 4. Event Store Abstraction

```typescript
// core/src/eventlog/EventStore.ts
export interface EventStore {
  append(event: Omit<CognitiveEvent, 'id' | 'timestamp'>): Promise<CognitiveEvent>;
  subscribe(filter: EventFilter): AsyncIterable<CognitiveEvent>;
  getRange(fromId: string, toId?: string): Promise<CognitiveEvent[]>;
  snapshot(projection: string, version: number): Promise<unknown>;
  compact(beforeId: string): Promise<void>;
}

export class InMemoryEventStore implements EventStore { ... }
export class RedisEventStore implements EventStore { ... }
export class FileEventStore implements EventStore { ... }
```

**Kernel uses**: `new Kernel(new InMemoryEventStore())` or `new Kernel(new RedisEventStore({ url: ... }))`

---

## 5. Unified Fact Projection

```typescript
// core/src/events/FactProjection.ts
export function projectFact(event: CognitiveEvent): Fact[] {
  if (event.type === 'fact.added') {
    return [{ id: hash(event.payload.term), term: event.payload.term, engine: event.payload.engine, truth: event.payload.truth, space: event.payload.space }];
  }
  if (event.type === 'fact.retracted') {
    return [{ id: hash(event.payload.term), deleted: true }];
  }
  return [];
}

// UI subscribes to 'fact' projection, not engine-specific projections.
```

---

## 6. Configuration as Event Sourcing

```typescript
// config events ARE the config
type ConfigEvent = 
  | { type: 'config.set'; payload: { path: string; value: unknown } }
  | { type: 'config.delete'; payload: { path: string } }
  | { type: 'config.snapshot'; payload: { version: number; data: Record<string, unknown> } };

// Rollback = replay up to version N
// Audit = filter by path prefix
// Distributed = replicate event log
```

---

## 7. Structured Tracing

Every event carries `correlationId` + `causationId`. Add:

```typescript
type TraceContext = {
  traceId: string;        // root correlationId
  spanId: string;         // this event's id
  parentSpanId?: string;  // causationId
  baggage?: Record<string, string>;
}

// Emitted as 'trace.span' events for external collectors (Jaeger, Zipkin)
```

---

## 8. Health + Observability Built-In

```typescript
interface Backend {
  // ...
  health(): BackendHealth;  // synchronous, fast
  metrics(): BackendMetrics; // counters, histograms
}

// Kernel exposes:
kernel.onHealthChange((health) => ...);
kernel.onMetrics((metrics) => ...);
```

---

## 9. Minimal Kernel API

```typescript
class Kernel {
  constructor(store: EventStore = new InMemoryEventStore());
  
  register(backend: Backend): Promise<void>;
  start(config?: Config): Promise<void>;
  stop(): Promise<void>;
  
  // Event-driven API
  submit(input: string): Promise<void>;        // appends input.user
  query<T>(projection: string): AsyncIterable<T>;  // live query
  
  // Observability
  onEvent(filter: EventFilter, handler: (e: CognitiveEvent) => void): () => void;
  onHealthChange(handler: (health: KernelHealth) => void): () => void;
  replay(fromId: string, toId?: string): Promise<CognitiveEvent[]>;
}
```

---

## Migration Path (Aggressive)

| Phase | Delete | Add | Verify |
|-------|--------|-----|--------|
| 1 | NAR legacy modules | MinimalNAR | `pnpm test` |
| 2 | Unify fact events | FactProjection | projection tests |
| 3 | Capability→Tool routing | ToolRouter | tool tests |
| 4 | EventStore abstraction | RedisEventStore | integration test |
| 5 | Kernel health/metrics | /health endpoint | curl /health |
| 6 | Delete old NAR modules | — | `pnpm typecheck` |

---

## Result: ~80% Less Code

| Metric | Before | After |
|--------|--------|-------|
| NAR package lines | ~15,000 | ~2,000 |
| Core package lines | ~2,500 | ~1,500 |
| Backend boilerplate | ~150/each | ~30/each |
| Event types | 18 engine-specific | 5 unified |
| Tool registration | Manual | Auto |
| Config handling | Per-backend | Unified |

**Risk**: High — but each phase is independently testable. Event log remains source of truth throughout.

---

## Non-Goals

- No breaking changes to event schema
- No new external dependencies
- No UI/client changes
- No distributed systems complexity (single-process first)