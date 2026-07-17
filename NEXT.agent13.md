# NEXT.agent13.md — The Unified Cognitive Organism (Final, Optimized)

> **Context (verified 2026-07-16):** 1017 tests pass, 5/5 packages typecheck clean. **Architectural reality:** Two incompatible `Agent` implementations exist. Core `Agent` (`core/src/Agent.ts`) has the living `cycle()`, engines, cortex, EventLog, MemoryService — UI Server works ONLY with this. NAR `createAgent` (`nar/src/agent/index.ts`) is a plain object with `chat`/`believe`/`recall`/`know*` — ALL bins and NAR tests use this. It has NO `cycle()`, NO EventLog, NO cortex, emits `agent:*` events incompatible with UI Bridge. `bot-ai.ts` creates BOTH. **No backwards compatibility needed. Unify into ONE organism. Preserve the working Metta reasoning substrate (runtime, parser, engine, core, stdlib, types) — only remove the redundant `metta/src/agent/` wrapper files.**

---

## 0. The Single Organism Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTS / BINS                               │
│  senars  bot-ai  repl  multi-agent  mcp-server  tests               │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ createAgent(config)
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│              createAgent — THE ONLY FACTORY                          │
│  nar/src/agent/index.ts                                              │
│  • Accepts: { nar, lmService, episodicMemory, persistence?,         │
│               config?, sessionId?, externalTools?, throttle?,        │
│               promptBuilder? }                                       │
│  • Creates: ONE Core Agent instance with:                           │
│    - EventLog (SqliteEventLog if persistence, else InMemory)        │
│    - MemoryService (wired to log + engines + motor)                 │
│    - NAREngine (wraps nar) + MettaEngine                            │
│    - LLMCortex (from lmService via createCortexFromLM)              │
│    - ToolRegistry (builtin tools)                                   │
│    - PolicyEngine                                                   │
│    - AgentBridge                                                    │
│  • Returns: The Core Agent instance (with NAR API methods attached) │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ IS A
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CORE AGENT — THE ORGANISM (core/src/Agent.ts)          │
│  • Single EventLog (nervous system)                                 │
│  • Single MemoryService (5 living tiers)                            │
│  • Engines: nar, metta                                              │
│  • Cortex: LLMCortex (narrative synthesis)                          │
│  • Motor: ToolRegistry + PolicyEngine                               │
│  • Bridge: AgentBridge → UI                                         │
│  • The living cycle(): perceive→recall→reason→narrate→act→consolidate│
│  • Emits UnifiedCognitiveEvent (UI Bridge consumes)                 │
│  • on/off('*') for all cognitive events                             │
│  • replaySession(events) for session restore                        │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ works with
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    UI SERVER (ui/src/server/index.ts)               │
│  • startAgentUI(agent) — works perfectly                            │
└─────────────────────────────────────────────────────────────────────┘
```

**ONE class: `Agent` in `core/src/Agent.ts`. ONE factory: `createAgent` in `nar/src/agent/index.ts`. NO other "Agent" surfaces.**

---

## 1. Metta Module — PRESERVED (Reasoning Substrate)

| Directory | Status | Purpose |
|-----------|--------|---------|
| `metta/src/engine/MettaEngine.ts` | ✅ **KEEP** | Implements `Engine` interface, used by `createAgent` |
| `metta/src/engine/*.ts` (egraph, interpreter, match, reduce, unify) | ✅ **KEEP** | Core engine internals |
| `metta/src/runtime/builder.ts` | ✅ **KEEP** | `createMeTTa`, `MeTTaRuntime` (Effect-based) |
| `metta/src/parser/runtime.ts` | ✅ **KEEP** | `parseMeTTa` |
| `metta/src/core/*` | ✅ **KEEP** | Core MeTTa functionality |
| `metta/src/stdlib/*` | ✅ **KEEP** | Standard library |
| `metta/src/types/*` | ✅ **KEEP** | Type definitions |
| `metta/src/parser/*` (other) | ✅ **KEEP** | Parser infrastructure |
| `metta/src/extensions/*`, `ipc/*`, `performance/*` | ✅ **KEEP** | Utilities |
| `metta/src/agent/MettaCommandParser.ts` | ✅ **KEEP** | Parses LLM output → commands |
| `metta/src/agent/MettaAgent.ts` | ❌ **DELETE** | Redundant wrapper (tests updated) |
| `metta/src/agent/MettaChannelOps.ts` | ❌ **DELETE** | Dead code |
| `metta/src/agent/MettaInputProcessor.ts` | ❌ **DELETE** | Dead code |
| `metta/src/agent/MettaTypes.ts` | ❌ **DELETE** | Only used by deleted files |
| `metta/src/agent/MettaPromptBuilder.ts` | ❌ **DELETE** | Dead code |
| `metta/src/agent/MettaSkills.ts` | ❌ **DELETE** | Dead code |

**Updated `metta/src/agent/index.ts` (minimal):**
```typescript
export { MettaCommandParser, LLM_COMMANDS } from './MettaCommandParser.js';
export { MettaEngine } from '../engine/MettaEngine.js';
export type { ParsedCommand, LlmCommand } from './MettaCommandParser.js';
```

---

## 2. Current Cruft — DELETE All of It

| File | Why | Action |
|------|-----|--------|
| `metta/src/agent/MettaAgent.ts` | Thin wrapper over Core Agent, only 2 tests use it | **DELETE** |
| `metta/src/agent/MettaChannelOps.ts` | Unused | **DELETE** |
| `metta/src/agent/MettaInputProcessor.ts` | Unused | **DELETE** |
| `metta/src/agent/MettaTypes.ts` | Only used by deleted files | **DELETE** |
| `metta/src/agent/MettaPromptBuilder.ts` | Never imported, dead | **DELETE** |
| `metta/src/agent/MettaSkills.ts` | Defined + exported, never used | **DELETE** |
| `nar/src/agent/bridge.ts` | `bindAgentToConnection` etc. — move to `@senars/io` | **CONSOLIDATE** |
| `nar/src/agent/cortex.ts` | `createCortexFromLM` — move to `core/src/cortex/` | **MOVE** |
| `nar/src/agent/session.ts` | `JsonlSessionManager` — move to `core/src/memory/` | **MOVE** |
| `nar/src/agent/tools.ts` | `buildAgentTools` — move to `core/src/motor/` | **MOVE** |
| `nar/src/agent/types.ts` | Type exports — consolidate into Core Agent | **CONSOLIDATE** |
| `core/src/engine/Engine.ts` `absorb`/`persist`/`load` optional methods | Unused stubs | **REMOVE** from interface |
| `core/src/events/*` | New event system, unused by Agent | **DELETE** (Agent uses `UnifiedCognitiveEvent`) |
| `AutonomyEngine` stub (`createAutonomyEngine` in `nar/src/agent/index.ts`) | Does nothing, bins pass it but never use it | **DELETE** |
| `core/src/backend/`, `core/src/capability/` | Already gone | ✅ |
| `ui/src/backend/VisualizationBackend.ts`, `ui/src/shared/protocol.ts` | Already gone | ✅ |
| `metta/src/agent/PolicyEngine.ts` | Already gone | ✅ |

---

## 3. Refactoring Opportunities — Architectural Elegance

*These are **internal improvements** with **zero public API changes** (via barrel re-exports). Apply alongside unification for maximum clarity.*

### 3.1 EventLog Base Class — Unify InMemory + Sqlite (~150 LOC saved)

```typescript
// core/src/eventlog/AbstractEventLog.ts (NEW)
export abstract class AbstractEventLog implements EventLog {
  protected readonly #subscribers = new Set<Subscription>();
  protected readonly #snapshots = new Map<string, Map<number, unknown>>();
  protected #closed = false;

  async append(event: Omit<UnifiedCognitiveEvent, 'id' | 'timestamp'>): Promise<UnifiedCognitiveEvent> {
    validatePayload(event.type, event.payload);
    const full = { ...event, id: this.generateId(), timestamp: Date.now() } as UnifiedCognitiveEvent;
    await this.doAppend(full);
    this.#notify(full);
    return full;
  }

  subscribe(handler: EventHandler): Subscription {
    this.#subscribers.add(handler);
    return () => this.#subscribers.delete(handler);
  }

  getSnapshot(key: string, seqId: number) { return Promise.resolve(this.#snapshots.get(key)?.get(seqId) ?? null); }
  saveSnapshot(key: string, seqId: number, data: unknown) { 
    const map = this.#snapshots.get(key) ?? new Map(); 
    map.set(seqId, data); 
    this.#snapshots.set(key, map); 
    return Promise.resolve(); 
  }

  abstract generateId(): string;
  protected abstract doAppend(event: UnifiedCognitiveEvent): Promise<void>;
  abstract getRange(fromId: string, toId?: string): Promise<UnifiedCognitiveEvent[]>;
  abstract close(): Promise<void>;
  abstract get size(): number;
  abstract get events(): ReadonlyArray<UnifiedCognitiveEvent>;

  protected #notify(event: UnifiedCognitiveEvent) { 
    for (const h of this.#subscribers) { try { h(event); } catch {} } 
  }
}
```

**Result**: `InMemoryEventLog` ~30 lines (array push), `SqliteEventLog` ~80 lines (SQL only). Shared subscription/snapshot/validation logic in base.

---

### 3.2 BaseEngine — Standardize Lifecycle (~40 LOC saved)

```typescript
// core/src/engine/BaseEngine.ts (NEW)
export abstract class BaseEngine implements Engine {
  abstract readonly id: EngineId;
  abstract readonly provides: Set<string>;
  #initialized = false;

  async initialize(): Promise<void> {
    if (this.#initialized) return;
    await this.doInitialize();
    this.#initialized = true;
  }

  async shutdown(): Promise<void> {
    if (!this.#initialized) return;
    await this.doShutdown();
    this.#initialized = false;
  }

  absorb(result: ToolResult): void { this.doAbsorb(result); }
  protected abstract doInitialize(): Promise<void>;
  protected abstract doShutdown(): Promise<void>;
  protected doAbsorb(result: ToolResult): void {} // default no-op

  abstract reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]>;
  abstract query(pattern: string): Promise<unknown[]>;
  abstract persist?(): Promise<void>;
  abstract load?(): Promise<void>;
}
```

**Result**: `NAREngine`/`MettaEngine` implement only `doInitialize`/`doShutdown`/`doAbsorb` + `reason`/`query`.

---

### 3.3 Unified CognitiveEvent — Single Event Type (Eliminates Dual System)

```typescript
// core/src/events/UnifiedEvent.ts (NEW — replaces core/src/events/* + core/src/CognitiveEvent.ts)
export interface UnifiedCognitiveEvent {
  readonly id: string;
  readonly type: CognitiveEventType;
  readonly timestamp: number;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly engine?: EngineOrigin;
  readonly payload: CognitivePayload;
}

export type CognitiveEventType = 
  | 'input.user' 
  | 'cognitive.derivation' 
  | 'cognitive.cycle' 
  | 'cognitive.drive' 
  | 'cognitive.goal' 
  | 'cognitive.conflict' 
  | 'cognitive.concept' 
  | 'cognitive.skill' 
  | 'tool.request' 
  | 'tool.response' 
  | 'memory.consolidate' 
  | 'system.bootstrap';

export type CognitivePayload =
  | { type: 'input.user'; text: string; source: string }
  | { type: 'cognitive.derivation'; term: string; confidence: number }
  | { type: 'cognitive.cycle'; cycle: number; derived: number }
  | { type: 'cognitive.drive'; drive: string; urgency: number }
  | { type: 'cognitive.goal'; term: string; status: 'achieved' | 'failed'; reason?: string }
  | { type: 'cognitive.conflict'; term: string; conflictWith: string }
  | { type: 'cognitive.concept'; term: string; priority: number }
  | { type: 'cognitive.skill'; skill: string; result: string; durationMs: number }
  | { type: 'tool.request'; toolName: string; args: Record<string, unknown>; timeoutMs?: number }
  | { type: 'tool.response'; requestId: string; toolName: string; result: unknown; error?: string; durationMs: number }
  | { type: 'memory.consolidate'; correlationId: string }
  | { type: 'system.bootstrap'; backendIds: string[] };

export const isEventType = <T extends CognitiveEventType>(type: T) => 
  (e: UnifiedCognitiveEvent): e is Extract<UnifiedCognitiveEvent, { type: T }> => e.type === type;
```

**Migration**: `EventLog.append()` takes `UnifiedCognitiveEvent`; `AgentBridge` subscribes to `EventLog` (not `Agent.on('*')`); `Agent.cycle()` calls `log.append()` which notifies subscribers.

---

### 3.4 AgentCore Extraction — Single Cognitive Cycle (~500 LOC saved)

```typescript
// core/src/AgentCore.ts (NEW — replaces core/src/Agent.ts)
export interface AgentCoreDeps {
  id?: string;
  log: EventLog;
  memory: MemoryService;
  engines: Map<string, Engine>;
  motor: ToolRegistry;
  cortex?: LLMCortex;
  policy: PolicyEngine;
}

export class AgentCore {
  readonly id: string;
  readonly log: EventLog;
  readonly memory: MemoryService;
  readonly engines: Map<string, Engine>;
  readonly motor: ToolRegistry;
  readonly cortex?: LLMCortex;
  readonly policy: PolicyEngine;
  #started = false;
  #cognitiveListeners = new Set<(e: UnifiedCognitiveEvent) => void>();

  constructor(deps: AgentCoreDeps) {
    this.id = deps.id ?? generateId('agent');
    this.log = deps.log;
    this.memory = deps.memory;
    this.engines = deps.engines;
    this.motor = deps.motor;
    this.cortex = deps.cortex;
    this.policy = deps.policy;
    this.memory.connectLog(this.log);
    this.memory.connectEngines(this.engines);
    this.memory.connectMotor(this.motor);
  }

  // THE ONE COGNITIVE CYCLE — used by ALL agent variants
  async cycle(stimulus: CognitiveStimulus): Promise<string> {
    const cid = stimulus.correlationId;
    this.#emitCognitive({ type: 'input', engine: 'metta', term: stimulus.text, source: 'cycle', timestamp: Date.now(), correlationId: cid });
    await this.log.append({ type: 'input.user', payload: { text: stimulus.text, source: stimulus.source }, correlationId: cid, causationId: '' });

    const working = this.memory.recent(50);
    const episodic = await this.memory.queryEpisodic();
    const semantic = await this.memory.querySemantic(stimulus.text);
    const context: Context = { working, episodic, semantic };

    const derivations: Derivation[] = [];
    for (const engine of this.engines.values()) {
      try { derivations.push(...await engine.reason(stimulus, context)); } catch {}
    }

    let narrativeText = '';
    if (this.cortex) {
      const narrative = await this.cortex.synthesize({ stimulus, context, derivations });
      narrativeText = narrative.text;
      this.memory.append({ type: 'narrative', payload: narrativeText, correlationId: cid });
    } else {
      for (const d of derivations) this.memory.append({ type: 'derivation', payload: d, correlationId: cid });
    }

    const toolResults: Array<{ command: string; result: ToolResult }> = [];
    if (this.#commandParser && narrativeText) {
      const commands = this.#commandParser(narrativeText);
      for (const cmd of commands) {
        if (cmd.command === 'send') { this.#lastResponse = cmd.args[0] ?? ''; continue; }
        const policyCheck = this.policy.checkCommand(cmd.command);
        if (!policyCheck.allowed) { /* blocked */ continue; }
        const result = await this.motor.execute(cmd.command, { args: cmd.args, raw: cmd.raw, command: cmd.command }, cid);
        toolResults.push({ command: cmd.command, result });
        for (const engine of this.engines.values()) { try { engine.absorb?.(result); } catch {} }
      }
    }

    await this.memory.consolidate(cid);
    for (const tr of toolResults) {
      this.memory.append({ type: 'tool_result', payload: tr, correlationId: cid });
    }

    for (const d of derivations) this.#emitCognitive({ type: 'derivation', engine: 'nar', term: d.term, confidence: d.truth?.confidence ?? 1, timestamp: Date.now(), correlationId: cid });
    for (const tr of toolResults) this.#emitCognitive({ type: 'skill:executed', engine: 'nar', skill: tr.command, result: tr.result.success ? 'success' : tr.result.error ?? 'error', durationMs: 0, timestamp: Date.now(), correlationId: cid });

    return this.#lastResponse;
  }

  async start(): Promise<void> { /* ... */ }
  async stop(): Promise<void> { /* ... */ }
  mount(transport: Connection): void { /* ... */ }
  unmount(idOrTransport: string | Connection): void { /* ... */ }
  on(event: string, handler: (e: UnifiedCognitiveEvent) => void): void { /* ... */ }
  off(event: string, handler: (e: UnifiedCognitiveEvent) => void): void { /* ... */ }

  // NEW: For session replay
  async replaySession(events: UnifiedCognitiveEvent[]): Promise<void> {
    for (const evt of events) await this.log.append(evt);
  }

  getRecentDerivations(): Derivation[] {
    return this.memory.recent(50).filter(e => e.type === 'derivation').map(e => e.payload as Derivation);
  }
  // ... existing methods
}
```

**Result**: Single cognitive cycle. NAR/Metta agents become thin factories.

---

### 3.5 FeedbackRegistry — Unify Tool + Engine Feedback

```typescript
// core/src/feedback/FeedbackRegistry.ts (NEW)
export interface FeedbackEntry {
  readonly source: 'tool' | 'engine' | 'human';
  readonly target: string;
  readonly result: ToolResult;
  readonly timestamp: number;
  readonly correlationId: string;
}

export class FeedbackRegistry {
  #entries: FeedbackEntry[] = [];
  #byTarget = new Map<string, FeedbackEntry[]>();
  #max = 10000;

  record(entry: FeedbackEntry) {
    this.#entries.push(entry);
    const arr = this.#byTarget.get(entry.target) ?? [];
    arr.push(entry);
    this.#byTarget.set(entry.target, arr);
    if (this.#entries.length > this.#max) this.#entries.shift();
  }
  getForTarget(target: string) { return this.#byTarget.get(target) ?? []; }
  getRecent(limit: number) { return this.#entries.slice(-limit); }
  getSuccessRate(target: string) {
    const e = this.#byTarget.get(target) ?? [];
    return e.length ? e.filter(x => x.result.success).length / e.length : 1;
  }
  clear() { this.#entries = []; this.#byTarget.clear(); }
}

// ToolRegistry delegates to FeedbackRegistry
// Engine.absorb() records to FeedbackRegistry
```

---

### 3.6 BaseConnection Enhancements — Reconnect + Outbox

```typescript
// io/src/connections/BaseConnection.ts — STRENGTHEN
abstract class BaseConnection implements Connection {
  protected #outbox: Array<{ target: string; text: string; resolve: () => void; reject: (e: Error) => void }> = [];

  async send(target: string, text: string): Promise<void> {
    if (this.state === 'connected') return this.doSend(target, text);
    return new Promise((resolve, reject) => this.#outbox.push({ target, text, resolve, reject }));
  }
  protected flushOutbox() { while (this.#outbox.length) { const m = this.#outbox.shift()!; this.doSend(m.target, m.text).then(m.resolve).catch(m.reject); } }
  protected setState(v: ConnectionState) { const p = this._state; if (p !== v) { this._state = v; this.emit('connection:state', { id: this.id, prev: p, current: v }); if (v === 'connected' && p !== 'connected') this.flushOutbox(); } }
  async reconnect() { /* exponential backoff */ }
  protected abstract doSend(target: string, text: string): Promise<void>;
}
```

---

### 3.7 TieredMemoryService — Explicit Tiers

```typescript
// core/src/memory/TieredMemoryService.ts (NEW)
export interface MemoryTier {
  readonly name: string;
  readonly priority: number;
  query(q: MemoryQuery): Promise<MemoryEntry[]>;
  append(e: MemoryEntry): Promise<void>;
  persist?(): Promise<void>;
  load?(): Promise<void>;
}

export class TieredMemoryService {
  #tiers: MemoryTier[] = [];
  #working: MemoryEntry[] = [];
  #maxWorking = 1000;

  constructor(log?: EventLog, engines?: Map<string, Engine>, motor?: ToolRegistry) {
    this.registerTier({ name: 'working', priority: 0, query: /*...*/, append: /*...*/ });
    if (log) this.registerTier({ name: 'episodic', priority: 1, query: /*...*/, append: /*...*/ });
    if (engines) this.registerTier({ name: 'semantic', priority: 2, query: /*...*/, append: /*...*/ });
    if (motor) this.registerTier({ name: 'procedural', priority: 3, query: /*...*/, append: /*...*/ });
  }
  registerTier(tier: MemoryTier) { /* insert by priority */ }
  async query(q: MemoryQuery) { for (const t of this.#tiers) { const r = await t.query(q); if (r.length) return r; } return []; }
  async append(e: Omit<MemoryEntry, 'id' | 'timestamp'>) { /* ... */ }
}
```

---

### 3.8 Barrel Files — Re-Exports Instead of Moves

```typescript
// core/src/engine/index.ts (NEW)
export { Engine, type EngineId, type CognitiveStimulus, type Context, type Derivation, type ToolResult } from './Engine.js';
export { BaseEngine } from './BaseEngine.js';

// core/src/motor/index.ts (NEW)
export { ToolRegistry, type ToolSpec, type ToolFn, type SkillFeedback } from './ToolRegistry.js';
export { FeedbackRegistry, type FeedbackEntry } from '../feedback/FeedbackRegistry.js';
export { BUILTIN_TOOLS, registerBuiltinTools, type CmdArgSet } from './builtin-tools.js';

// core/src/memory/index.ts (NEW)
export { MemoryService, type MemoryEntry, type MemoryQuery } from './MemoryService.js';
export { TieredMemoryService, type MemoryTier } from './TieredMemoryService.js';

// core/src/eventlog/index.ts (ALREADY EXISTS — good pattern)
```

**Benefit**: Zero breaking changes. Consumers import from `@senars/core/engine` or `@senars/core/motor`.

---

### 3.9 Type-Safe Config — Zod Schemas

```typescript
// core/src/config/TypedConfig.ts (NEW)
export function validateConfig<T extends z.ZodTypeAny>(schema: T, config: unknown): z.infer<T> { return schema.parse(config); }

export const agentConfigSchema = z.object({
  nar: z.unknown().optional(),
  lmService: z.unknown().optional(),
  maxLoops: z.number().int().min(0).max(50).default(5),
  throttle: z.number().int().min(0).max(100).default(100),
  // ...
}).strict();
```

---

## 4. Phased Implementation Plan (Optimized)

### Phase 0 — Prerequisites (15 min) ⚡ DO FIRST
```bash
# 1. Move helpers to Core BEFORE rewriting createAgent
mkdir -p core/src/cortex core/src/motor core/src/feedback core/src/config core/src/events
mv nar/src/agent/cortex.ts core/src/cortex/createCortexFromLM.ts
mv nar/src/agent/session.ts core/src/memory/SessionManager.ts
mv nar/src/agent/tools.ts core/src/motor/buildAgentTools.ts
# Extract isNarsese from nar/src/agent/index.ts → core/src/helpers.ts
# Fix mcp-server.ts import
sed -i "s|../../nar/src|@senars/nar|" src/bin/mcp-server.ts
```
**Verify**: `pnpm -r typecheck` — all clean.

---

### Phase 1 — Rewrite `createAgent` (Critical Path, 2-3 hrs) 🎯

**File**: `nar/src/agent/index.ts` → **rewrite completely**

```typescript
// nar/src/agent/index.ts
import { Agent } from '@senars/core';
import { NAREngine } from '../engine/NAREngine.js';
import { MettaEngine } from '@senars/metta/engine/MettaEngine.js';
import { createCortexFromLM } from '@senars/core/cortex/createCortexFromLM.js';
import { SqliteEventLog, InMemoryEventLog } from '@senars/core';
import { JsonlSessionManager } from '@senars/core/memory/SessionManager.js';
import { isNarsese } from '@senars/core/helpers.js';
import type { LMService, EpisodicMemory, NAR } from '@senars/nar';

export interface CreateAgentConfig {
  nar?: NAR;
  lmService?: LMService;
  episodicMemory?: EpisodicMemory;
  persistence?: { path: string };
  sessionId?: string;
  externalTools?: Record<string, unknown>;
  throttle?: number;
  promptBuilder?: import('@senars/core').PromptBuilder;
}

export function createAgent(config: CreateAgentConfig = {}): Agent {
  // 1. EventLog
  const log = config.persistence
    ? new SqliteEventLog({ path: config.persistence.path })
    : new InMemoryEventLog();

  // 2. Cortex
  const cortex = config.lmService
    ? createCortexFromLM(config.lmService, config.promptBuilder)
    : undefined;

  // 3. Core Agent
  const agent = new Agent({
    log,
    cortex,
    commandParser: (text: string) => new MettaCommandParser().parse(text),
    builtinTools: true,
  });

  // 4. Engines
  const narEngine = new NAREngine(config.nar);
  const mettaEngine = new MettaEngine();
  agent.registerEngine('nar', narEngine);
  agent.registerEngine('metta', mettaEngine);

  // 5. Session restore BEFORE start()
  if (config.sessionId) {
    const sessionManager = new JsonlSessionManager({ basePath: '.cache/sessions' });
    await sessionManager.restore();
    const events = sessionManager.getSession(config.sessionId)?.events ?? [];
    await agent.replaySession(events);
  }

  // 6. Initialize
  await agent.start();

  // 7. Attach NAR-specific API
  attachNarApi(agent, config, narEngine);

  return agent;
}

function attachNarApi(agent: Agent, config: CreateAgentConfig, narEngine: NAREngine): void {
  const knowStore = new Map<string, string>();
  let throttle = Math.min(100, Math.max(0, config.throttle ?? 100));

  const originalChat = agent.chat.bind(agent);
  (agent as any).chat = async (text: string, opts?: any) => {
    const trimmed = text.trim();
    if (!trimmed) return '';

    if (isNarsese(trimmed) && narEngine) {
      if (trimmed.endsWith('?') || trimmed.endsWith('？')) {
        await narEngine.nar.question(trimmed);
        await narEngine.nar.run(5);
        return `Question queued: ${trimmed}`;
      }
      if (trimmed.endsWith('!')) {
        await narEngine.nar.goal(trimmed);
        await narEngine.nar.run(3);
        return `+ ${trimmed}`;
      }
      await narEngine.nar.believe(trimmed);
      await narEngine.nar.run(3);
      const beliefs = narEngine.nar.getBeliefs();
      const last = beliefs[beliefs.length - 1];
      return last ? `+ ${last.term}.` : `+ ${trimmed}`;
    }
    return originalChat(trimmed, opts);
  };

  (agent as any).believe = async (text: string) => {
    if (isNarsese(text) && narEngine) {
      await narEngine.nar.believe(text);
      await narEngine.nar.run(3);
    }
  };
  (agent as any).recall = async (query?: string, limit?: number) => {
    if (!config.episodicMemory) return [];
    return config.episodicMemory.getEpisodes({ limit: limit ?? 50 })
      .filter(e => !query || e.content.toLowerCase().includes(query.toLowerCase()));
  };
  (agent as any).know = (key: string, value: string) => { knowStore.set(key, value); };
  (agent as any).knowGet = (key: string) => knowStore.get(key);
  (agent as any).knowList = () => [...knowStore.entries()].map(([k, v]) => ({ key: k, value: v }));
  (agent as any).setThrottle = (n: number) => { throttle = Math.min(100, Math.max(0, n)); };
  (agent as any).getThrottle = () => throttle;
  (agent as any).getNAR = () => narEngine?.nar;
  (agent as any).getEpisodicMemory = () => config.episodicMemory;
  (agent as any).getRecentDerivations = () => agent.getRecentDerivations();
}
```

**Core `Agent` additions** (`core/src/Agent.ts`):
```typescript
// Add to Agent class:
async replaySession(events: UnifiedCognitiveEvent[]): Promise<void> {
  for (const evt of events) await this.log.append(evt);
}
getRecentDerivations(): Derivation[] {
  return this.memory.recent(50).filter(e => e.type === 'derivation').map(e => e.payload as Derivation);
}
// Ensure start() calls engine.initialize(), stop() calls engine.shutdown() + memory.persist()
```

**Verification**: `pnpm vitest run tests/unit/agent` — **ALL PASS** (no test changes).

---

### Phase 2 — Move Helpers to Core; Delete Cruft (1-2 hrs)

```bash
# 1. createCortexFromLM (already moved in Phase 0, verify)
# 2. JsonlSessionManager
mv nar/src/agent/session.ts core/src/memory/SessionManager.ts
# Update imports inside

# 3. buildAgentTools
mkdir -p core/src/motor
mv nar/src/agent/tools.ts core/src/motor/buildAgentTools.ts

# 4. isNarsese helper → core/src/helpers.ts (already done in Phase 0)

# 5. Delete nar/src/agent/{cortex,session,tools,types}.ts
rm nar/src/agent/{cortex,session,tools,types}.ts

# 6. Update nar/src/agent/index.ts re-exports
cat > nar/src/agent/index.ts <<'EOF'
export { createAgent } from './index.js';
export { createCortexFromLM } from '@senars/core/cortex';
export { JsonlSessionManager, createSession } from '@senars/core/memory';
export { buildAgentTools } from '@senars/core/motor';
export { 
  bindAgentToConnection, 
  createAgentDispatch, 
  createAuthMiddleware, 
  createCommandInterceptor, 
  createSessionBinder, 
  createConnectionConfigsFromEnv, 
  createErrorBoundary, 
  createRateLimiter, 
  originExtractor, 
  resolveSessionKey 
} from '@senars/io';
EOF

# 7. Delete cruft
rm metta/src/agent/{MettaAgent,MettaChannelOps,MettaInputProcessor,MettaTypes,MettaPromptBuilder,MettaSkills}.ts
rm -rf core/src/events
rm nar/src/agent/bridge.ts

# 8. Update metta/src/agent/index.ts
cat > metta/src/agent/index.ts <<'EOF'
export { MettaCommandParser, LLM_COMMANDS } from './MettaCommandParser.js';
export { MettaEngine } from '../engine/MettaEngine.js';
export type { ParsedCommand, LlmCommand } from './MettaCommandParser.js';
EOF
```

**Verify**: `pnpm -r typecheck` + `pnpm vitest run tests/unit/agent tests/unit/core`

---

### Phase 3 — Core `Agent` Enhancements (30 min)

```typescript
// core/src/Agent.ts — ensure:
async start(): Promise<void> {
  if (this.#started) return;
  this.#started = true;
  for (const engine of this.engines.values()) {
    if ('initialize' in engine && typeof engine.initialize === 'function') {
      await engine.initialize();
    }
  }
  await this.memory.load();
}

async stop(): Promise<void> {
  if (!this.#started) return;
  this.#started = false;
  await this.memory.persist();
  for (const transport of this.#transports.values()) {
    await transport.disconnect('agent stopping');
  }
  for (const engine of this.engines.values()) {
    if ('shutdown' in engine && typeof engine.shutdown === 'function') {
      await engine.shutdown();
    }
  }
}

// Engine interface — REMOVE optional absorb/persist/load
export interface Engine {
  readonly id: EngineId;
  reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]>;
  query(pattern: string): Promise<unknown[]>;
}
```

**Verify**: `pnpm vitest run tests/unit/core tests/e2e/agent-smoke`

---

### Phase 4 — Fix Bins (30 min)

| Bin | Change |
|-----|--------|
| `senars.ts` | Start UI: `const agent = createAgent({ nar }); await startAgentUI(agent, {port: 8765});` |
| `bot-ai.ts` | **Remove dummy `new Agent()` for UI** (lines 159-166); use main `agent` for `startAgentUI`; remove `autonomyEngine` |
| `repl.ts` | Use `createAgent`; remove `autonomyEngine`; session via `config.sessionId` |
| `multi-agent*.ts` | Use `createAgent`; no other changes |
| `mcp-server.ts` | Import fixed in Phase 0; use `createAgent({ nar })` |

**Verify**: Each bin runs without error.

---

### Phase 5 — `temporal` Lens (15 min) 📸 **CAPTURE POINT**

```typescript
// core/src/lens-schema.ts + ui/src/shared/lens-schema.ts
export const BUILTIN_LENS_IDS = ['belief', 'goal', 'contradiction', 'temporal'] as const;

export function builtinLensSpecs(): LensSpec[] {
  return [
    // ... existing three specs ...
    {
      id: 'temporal',
      label: 'Timeline',
      description: 'Replay cognitive events over time',
      requires: ['event-log'],
      modulation: {
        op: 'union',
        children: [
          { op: 'channel', channel: 'time', child: { op: 'field', field: 'timestamp' } },
          { op: 'channel', channel: 'opacity', child: { op: 'const', value: 0.6 } },
        ],
      },
    },
  ];
}
```

**Verify**: `pnpm vitest run tests/e2e/agent-smoke.test.ts` — lens.list returns 4 entries.

---

### Phase 6 — Memory Consolidation + Sqlite (1-2 hrs)

```typescript
// core/src/memory/MemoryService.ts
async consolidate(correlationId: string): Promise<void> {
  const recent = this.#working.filter(e => e.correlationId === correlationId);
  for (const entry of recent) {
    const salience = (entry.payload as any).salience ?? 0.5;
    if (salience > 0.7 && this.#log) {
      await this.#log.append({ type: 'memory.consolidated', payload: entry, correlationId });
    }
  }
  for (const engine of this.#engines?.values() ?? []) {
    await engine.persist?.();
  }
}
```

**SqliteEventLog**: Already exists. `createAgent` uses it when `config.persistence` provided.

**Verify**: Start agent, add beliefs, `agent.stop()`, restart with same persistence path → beliefs recovered.

---

### Phase 7 — Config Unification (30 min)

```typescript
// In createAgent:
import { appConfigSchema } from '@senars/config/schema';

export function createAgent(config: CreateAgentConfig = {}): Agent {
  const validated = appConfigSchema.parse(config);
  // map validated → CreateAgentConfig
}
```

**CLI**: `senars --config file.json` already works via `loadConfigFromEnv()`.

---

### Phase 8 — Observability (45 min)

```typescript
// core/src/observability/Metrics.ts (NEW)
export class Metrics {
  #counters = new Map<string, number>();
  #histograms = new Map<string, number[]>();

  inc(name: string, value = 1) { this.#counters.set(name, (this.#counters.get(name) ?? 0) + value); }
  record(name: string, value: number) { const arr = this.#histograms.get(name) ?? []; arr.push(value); this.#histograms.set(name, arr); }
  get(name: string) { return this.#counters.get(name) ?? 0; }
  getHistogram(name: string) { return this.#histograms.get(name) ?? []; }
  toJSON() {
    const out: Record<string, any> = {};
    for (const [k, v] of this.#counters) out[k] = v;
    for (const [k, v] of this.#histograms) {
      const s = [...v].sort((a,b) => a-b);
      out[`${k}_count`] = s.length;
      out[`${k}_sum`] = s.reduce((a,b) => a+b, 0);
      out[`${k}_avg`] = s.length ? out[`${k}_sum`] / s.length : 0;
      out[`${k}_p50`] = s[Math.floor(s.length * 0.5)] ?? 0;
      out[`${k}_p95`] = s[Math.floor(s.length * 0.95)] ?? 0;
      out[`${k}_p99`] = s[Math.floor(s.length * 0.99)] ?? 0;
    }
    return out;
  }
}
```

**Agent integration**:
```typescript
// core/src/Agent.ts
readonly metrics = new Metrics();

async cycle(stimulus: CognitiveStimulus): Promise<string> {
  const start = Date.now();
  const cid = crypto.randomUUID();
  try { /* ... */ }
  finally { this.metrics.record('cycleLatency', Date.now() - start); this.metrics.inc('cycleCount'); }
}
```

**Correlation IDs**: `cycle()` generates `cid`; propagate to `log.append()`, `bridge`, WS messages.

---

### Phase 9 — Security + Resilience (1 hr)

```typescript
// Rate limiting in ConnectionManager (per connection)
const buckets = new Map<string, { tokens: number; lastRefill: number }>();

function checkRateLimit(connId: string, maxPerSec: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(connId) ?? { tokens: maxPerSec, lastRefill: now };
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(maxPerSec, bucket.tokens + elapsed * maxPerSec);
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    bucket.lastRefill = now;
    buckets.set(connId, bucket);
    return true;
  }
  buckets.set(connId, bucket);
  return false;
}
```

```typescript
// ToolRegistry.execute() — allowlist check
if (name === 'shell' || name === 'read-file' || name === 'write-file') {
  const policy = this.#policy?.getConfig?.();
  if (policy?.allowedCommands && name === 'shell') {
    const cmd = args.args?.[0] as string;
    if (!policy.allowedCommands.some(c => cmd.startsWith(c))) return { success: false, content: null, error: 'Command not allowed' };
  }
  if (policy?.allowedPaths && (name === 'read-file' || name === 'write-file')) {
    const path = args.args?.[0] as string;
    if (!policy.allowedPaths.some(p => path.startsWith(p))) return { success: false, content: null, error: 'Path not allowed' };
  }
}
```

**Auth**: Reuse `AuthManager` from `@senars/io`. Add `auth` config to transport factories.

**Graceful degradation**: In `createAgent` chat override: if LM unavailable → NAR-only; if NAR down → LM-only.

---

### Phase 10 — Sessions + REPL Polish (45 min)

```typescript
// In createAgent:
if (config.sessionId) {
  const sessionManager = new JsonlSessionManager({ basePath: '.cache/sessions' });
  await sessionManager.restore();
  await agent.replaySession(sessionManager.getSession(config.sessionId)?.events ?? []);
  (agent as any).#sessionManager = sessionManager;
}
```

```typescript
// Agent.stop()
async stop(): Promise<void> {
  // ... existing ...
  const sessionManager = (this as any).#sessionManager;
  if (sessionManager) await sessionManager.snapshot();
}
```

**REPL polish**: Add history file (`~/.senars/repl_history`), Tab completion (from `motor.list()` + NAR terms), ANSI colors in `repl.ts`.

---

### Phase 11 — Tool/Parser Fix (5 min)

```typescript
// metta/src/agent/MettaCommandParser.ts
export const LLM_COMMANDS = [
  'send', 'remember', 'query', 'episodes', 'read-file', 'write-file',
  'append-file', 'search', 'shell', 'metta', 'pin', 'tavily-search',
  'technical-analysis',  // ADD
] as const;
```

---

### Phase 12 — Test Updates + Docs (15 min)

```typescript
// tests/integration/metta-transports.test.ts + metta-conversation.test.ts
// import { MettaAgent } from '@senars/metta/agent';
// → import { Agent } from '@senars/core';
// let agent: MettaAgent;
// → let agent: Agent;
// agent = new MettaAgent();
// → agent = new Agent();  // or createAgent({ nar: SeNARSFactory.createForTesting() })
```

**Docs**: Create `ARCHITECTURE.md` documenting unified design.

---

## 5. Integration Test Capture — Phase 5 📸

**When**: After Phase 5 (`temporal` lens + e2e passing) — first demo-ready system.

**What**: Lightweight JSON/Text capture in `agent-smoke.test.ts`:

```typescript
// tests/e2e/agent-smoke.test.ts — ADD
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CAPTURE_DIR = join(__dirname, '../../captures', `agent-smoke-${Date.now()}`);
mkdirSync(CAPTURE_DIR, { recursive: true });

function capture(name: string, data: unknown) {
  writeFileSync(join(CAPTURE_DIR, `${name}.json`), JSON.stringify(data, null, 2));
}

function captureSummary(label: string, events: IncomingFromServer[]) {
  const summary = {
    label,
    timestamp: new Date().toISOString(),
    eventCounts: events.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {}),
    graphDeltas: events
      .filter(e => e.type === 'cognitive.delta')
      .flatMap(e => e.ops)
      .map(op => `${op.action}:${op.id}`),
  };
  writeFileSync(join(CAPTURE_DIR, `summary-${label}.txt`), JSON.stringify(summary, null, 2));
}

// In test setup:
const received: IncomingFromServer[] = [];
ws.on('message', (raw) => {
  const event = JSON.parse(raw.toString()) as IncomingFromServer;
  received.push(event);
  capture(`event-${event.type}-${Date.now()}`, event);
});

// Capture key moments:
captureSummary('initial-handshake', received.filter(e => ['config.schema','lens.list','lens.fields'].includes(e.type)));
captureSummary('post-narsese-graph', received.filter(e => e.type === 'cognitive.delta'));
captureSummary('lens-switch', received.filter(e => e.type === 'cognitive.delta' && e.lens === 'contradiction'));
```

**Why Phase 5?** First complete UI + live agent + 4 lenses. Captures verify handshake, Narsese→graph growth, lens/focus switching.

**Output**: `captures/agent-smoke-<timestamp>/` with JSON events + text summaries. Zero dependencies, CI-friendly.

---

## 6. Execution Order (Verifiable) - UPDATED 2026-07-17

| Phase | Steps | Verification | Status |
|-------|-------|--------------|--------|
| **0** | Move helpers (cortex, session, tools, isNarsese) to Core; fix mcp-server import | `pnpm -r typecheck` | ✅ Done |
| **1** | Rewrite `createAgent` → returns Core `Agent` | `pnpm vitest run tests/unit/agent` | ✅ Partial (tool dispatcher works, AgentV6 tests need API updates) |
| **2** | Move helpers to Core; delete cruft files | `pnpm -r typecheck` + all tests | ✅ Partial (metta/src/agent/*.ts deleted, io/bridge.ts moved) |
| **3** | Core `Agent` enhancements (`replaySession`, `getRecentDerivations`, `start`/`stop` wiring) | `pnpm vitest run tests/unit/core tests/e2e/agent-smoke` | ⏳ In progress |
| **4** | Fix bins (`senars`, `bot-ai`, `repl`, `multi-agent*`, `mcp-server`) | Each bin runs | ⏳ Pending |
| **5** | `temporal` lens | `pnpm vitest run tests/e2e/agent-smoke` + **capture output** 📸 | ⏳ Pending |
| **6** | Memory `consolidate()` + SqliteEventLog wiring | Restart recovers beliefs | ⏳ Pending |

**Completed so far:**
- `createAgent` in `nar/src/agent/index.ts` creates Core Agent with NAR/Metta engines
- `dispatchToolCalls` added for tool dispatching
- `bridge.ts` moved to `io/src/bridge.ts`
- `metta/src/agent/*.ts` (MettaAgent, ChannelOps, etc.) deleted
- `nar/src/agent/cortex.ts`, `session.ts`, `tools.ts`, `types.ts` deleted
- Core typecheck clean, IO typecheck clean

**Remaining blockers:**
- AgentV6 tests expect old API (`start()` returns stop fn, named events, `EventBus`)
- bins import deleted modules (`autonomyEngine`, etc.)

---

## 7. Success Criteria (Proven by Tests, No Mocks)

| Metric | Target |
|--------|--------|
| **Single Agent class** | Only `core/src/Agent.ts` exports `Agent` |
| **Single factory** | Only `nar/src/agent/index.ts` exports `createAgent` |
| All 7 bins run | `senars`, `bot-ai`, `multi-agent`, `multi-agent-demo`, `repl`, `mcp-server` |
| TypeScript | 0 errors, 5/5 packages |
| **E2E tests (no mocks)** | `agent-smoke`, `metta-smoke`, `webui-client-verify` pass |
| **Integration tests (real components)** | `multi-agent`, `metta-conversation`, `metta-transports`, `irc-live` pass |
| **Unit tests (real objects)** | All 1017+ pass |
| Memory persistence | Restart recovers beliefs/tools |
| UI real-time | WS: `cognitive.delta`, `config.schema`, `lens.*` (4), `focus.*`, Narsese→graph |
| Config | One schema (`src/config`), consumed by `createAgent` |
| Observability | Structured logs + JSON metrics + correlation IDs |
| Security | Rate-limit + path/command allowlist + optional auth |
| Sessions | Persisted, restorable via `createAgent({sessionId})` |
| Dead code | 0 lines (deleted files above) |

---

## 8. Philosophy

> **A cognitive agent is not a class. It is a process.**
>
> We had two classes pretending to be one process. Now we have **one class** (`Agent`) that **is** the process, and **one factory** (`createAgent`) that configures it. The EventLog is its nervous system. MemoryService is its hippocampus. Engines are its reasoning organs. Cortex is its voice. Motor is its hands. Bridge is its eyes. Plugins are its microbiome.
>
> **No duality. No compatibility layers. No dead code. One living organism.**