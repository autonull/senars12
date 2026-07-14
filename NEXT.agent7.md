# NEXT.agent7.md — Architectural Unification & Simplification

> **Goal**: Simplify the event-sourced kernel without losing functionality. Remove duplication, extract shared primitives, reduce NAR surface area.

---

## 1. Extract `EventBackend` Base Class

**File**: `core/src/backend/EventBackend.ts` (new)

```typescript
export abstract class EventBackend implements Backend {
  abstract readonly id: string;
  abstract readonly manifest: BackendManifest;
  #log?: EventLog;

  async initialize(log: EventLog, config: ConfigView): Promise<void> {
    this.#log = log;
    this.#startEventLoop();
    await this.#onInitialize(config);
  }

  #startEventLoop(): void {
    (async () => {
      for await (const event of this.#log!.subscribe({ types: [...this.manifest.handles] })) {
        try {
          await this.#onEvent(event);
        } catch (e) { this.#logError(e); }
      }
    })();
  }

  protected abstract #onEvent(event: CognitiveEvent): Promise<void>;
  protected abstract #onInitialize(config: ConfigView): Promise<void>;
  protected #applyConfig(path: string, value: unknown): void { /* override */ }
}
```

**Replace in**: `NarBackendV2`, `MettaBackendV2`, `VisualizationBackend`

---

## 2. Unified Tool Protocol

**File**: `core/src/backend/ToolProvider.ts` (new)

```typescript
export interface ToolProvider {
  getTools(): ToolDefinition[];
  executeTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}
```

**Kernel auto-registration**:
```typescript
async register(backend: Backend): Promise<void> {
  // ...
  if (isToolProvider(backend)) {
    for (const tool of backend.getTools()) {
      this.#toolRegistry.register(tool.name, backend);
    }
  }
}
```

---

## 3. Shared ConfigView in Kernel

**File**: `core/src/kernel/Kernel.ts`

```typescript
class Kernel {
  #log: EventLog;
  #backends = new Map<string, Backend>();
  #registry: CapabilityRegistryImpl;
  #configView: ConfigViewImpl; // SINGLE shared instance

  constructor(log: EventLog = new InMemoryEventLog()) {
    this.#log = log;
    this.#registry = new CapabilityRegistryImpl(log);
    this.#configView = new ConfigViewImpl(log);
  }

  async register(backend: Backend): Promise<void> {
    await this.#log.append({ type: 'backend.registered', payload: { manifest: backend.manifest }, correlationId: randomUUID() });
    await backend.initialize(this.#log, this.#configView);
    this.#backends.set(backend.id, backend);
  }
}
```

---

## 4. Auto-Emit Config Schema from Manifest

```typescript
async start(configPath?: string): Promise<void> {
  for (const backend of this.#backends.values()) {
    await this.#log.append({ type: 'config.schema', payload: { schema: backend.manifest.configSchema }, correlationId: randomUUID() });
    // ... emit config values
  }
}
```

---

## 5. Bootstrap as Individual Events

```typescript
async #emitBootstrap(bootstrap: BootstrapSeed): Promise<void> {
  for (const belief of bootstrap.beliefs ?? []) {
    await this.#log.append({ type: 'belief.added', payload: { term: belief, truth: DEFAULT_TRUTH }, correlationId: randomUUID() });
  }
  for (const atom of bootstrap.atoms ?? []) {
    await this.#log.append({ type: 'atom.derived', payload: { atom: atom.atom, space: atom.space ?? 'default' }, correlationId: randomUUID() });
  }
}
```

---

## 6. Minimal NAR Surface

**Reduce `nar/src/index.ts` from 109 lines to ~20**:

```typescript
// Core types only
export type { Term, Truth, TruthType, Task, Budget, CoreConfig, Stamp } from './types/core.js';
export { Truth, isTruthEqual, termParser } from './terms/index.js';
export { NAR, createNAR, type NARConfig } from './nar.js';

// Backend
export { NarBackend } from './backend/NarBackendV2.js';
```

**Create `nar/src/nar-minimal.ts`** with only:
- `input()`, `getBeliefs()`, `setConfig()`, `start()`, `stop()`

---

## 7. Auto-Derive Event Types

Instead of manual `eventTypes` in manifest, wrap `#log.append()` to track emitted types:
```typescript
protected async #emit(type: string, payload: unknown): Promise<void> {
  this.#emittedTypes.add(type);
  await this.#log.append({ type, payload, correlationId: randomUUID() });
}
```

---

## Migration Checklist

| Step | Change | Files |
|------|--------|-------|
| 1 | Create `EventBackend` base class | `core/src/backend/EventBackend.ts` |
| 2 | Refactor `NarBackendV2` to extend `EventBackend` | `nar/src/backend/NarBackendV2.ts` |
| 3 | Refactor `MettaBackendV2` to extend `EventBackend` | `metta/src/backend/MettaBackendV2.ts` |
| 4 | Refactor `VisualizationBackend` to extend `EventBackend` | `ui/src/backend/VisualizationBackend.ts` |
| 5 | Create `ToolProvider` interface & kernel registration | `core/src/backend/ToolProvider.ts`, `Kernel.ts` |
| 5 | Single shared `ConfigView` in Kernel | `Kernel.ts` |
| 6 | Auto-emit config schema from manifest | `Kernel.ts` |
| 7 | Bootstrap as individual events | `Kernel.ts` |
| 8 | Minimal NAR exports | `nar/src/index.ts`, `nar/src/nar-minimal.ts` |
| 9 | Remove unused NAR exports | `nar/package.json` exports |
| 10 | Run typecheck + test | `pnpm typecheck && pnpm test` |

---

## Validation

```bash
pnpm run typecheck  # all 5 packages pass
pnpm run senars      # kernel starts, processes belief
pnpm test            # existing tests pass (update if needed)
```

---

## Non-Goals

- **No behavioral changes** — event log remains source of truth
- **No new dependencies** — only refactoring
- **No breaking changes** to event schema
- **No UI/client changes** — only backend/server