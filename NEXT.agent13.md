# NEXT.agent13.md — The Unified Cognitive Organism (Final)

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
│  • Emits CognitiveEvent (UI Bridge consumes)                        │
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

The Metta module is a **working reasoning engine**. Only the redundant `metta/src/agent/` wrapper files are removed.

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
| `core/src/events/*` | New event system, unused by Agent | **DELETE** (Agent uses `CognitiveEvent`) |
| `AutonomyEngine` stub (`createAutonomyEngine` in `nar/src/agent/index.ts`) | Does nothing, bins pass it but never use it | **DELETE** |
| `core/src/backend/`, `core/src/capability/` | Already gone | ✅ |
| `ui/src/backend/VisualizationBackend.ts`, `ui/src/shared/protocol.ts` | Already gone | ✅ |
| `metta/src/agent/PolicyEngine.ts` | Already gone | ✅ |

---

## 3. Unification Work — Surgical, Complete

### Phase 0 — Prerequisites (Do First, 15 min)

**Move helpers to Core BEFORE rewriting `createAgent` so it compiles:**

```bash
# 1. createCortexFromLM → core
mkdir -p core/src/cortex
mv nar/src/agent/cortex.ts core/src/cortex/createCortexFromLM.ts
# Update imports: @senars/nar/lm/lm-service.js → @senars/nar/lm/lm-service.js (same)
# Update core/src/cortex/createCortexFromLM.ts imports to use @senars/core for ModelRunner, LLMCortex

# 2. JsonlSessionManager → core
mv nar/src/agent/session.ts core/src/memory/SessionManager.ts
# Update imports inside

# 3. buildAgentTools → core
mkdir -p core/src/motor
mv nar/src/agent/tools.ts core/src/motor/buildAgentTools.ts

# 4. isNarsese helper → core
# Extract from nar/src/agent/index.ts → core/src/helpers.ts (add export)

# 5. Fix mcp-server.ts import
sed -i "s|../../nar/src|@senars/nar|" src/bin/mcp-server.ts
```

**Verify:** `pnpm -r typecheck` — all clean.

---

### Phase 1 — Rewrite `createAgent` (Critical Path, 2-3 hrs)

**File:** `nar/src/agent/index.ts` → **rewrite completely**

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
  // 1. EventLog — created FIRST (engines may need it during init)
  const log = config.persistence
    ? new SqliteEventLog({ path: config.persistence.path })
    : new InMemoryEventLog();

  // 2. Cortex
  const cortex = config.lmService
    ? createCortexFromLM(config.lmService, config.promptBuilder)
    : undefined;

  // 3. Core Agent — constructor wires memory to log/engines/motor
  const agent = new Agent({
    log,
    cortex,
    commandParser: (text: string) => new MettaCommandParser().parse(text),
    builtinTools: true,
  });

  // 4. Engines — register BEFORE start()
  const narEngine = new NAREngine(config.nar);
  const mettaEngine = new MettaEngine();
  agent.registerEngine('nar', narEngine);
  agent.registerEngine('metta', mettaEngine);

  // 5. Session restore — BEFORE agent.start() so replayed events are in log
  if (config.sessionId) {
    const sessionManager = new JsonlSessionManager({ basePath: '.cache/sessions' });
    await sessionManager.restore();
    const events = sessionManager.getSession(config.sessionId)?.events ?? [];
    await agent.replaySession(events);  // NEW: proper replay
  }

  // 6. Initialize — THE MOMENT THE ORGANISM WAKES
  await agent.start();  // initializes engines, loads memory

  // 7. Attach NAR-specific API (mutate instance for test compat)
  attachNarApi(agent, config, narEngine);

  return agent;
}

function attachNarApi(agent: Agent, config: CreateAgentConfig, narEngine: NAREngine): void {
  const knowStore = new Map<string, string>();
  let throttle = Math.min(100, Math.max(0, config.throttle ?? 100));

  // Override chat to preserve Narsese-gate behavior (test compat)
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

    // NL path → Core Agent's cycle (cortex → parser → motor)
    return originalChat(trimmed, opts);
  };

  // NAR API methods
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
  (agent as any).getRecentDerivations = () => agent.getRecentDerivations();  // delegated

  // on/off delegate to Core Agent (already works)
}
```

**Core `Agent` additions** (`core/src/Agent.ts`):

```typescript
// Add to Agent class:

// NEW: For session replay
async replaySession(events: CognitiveEvent[]): Promise<void> {
  for (const evt of events) {
    await this.log.append(evt);  // idempotent if events have same IDs
    // MemoryService.queryEpisodic() reads from log — automatically rebuilt
    // Engines: semantic state rebuilt via their own persistence (engine.load())
  }
}

// NEW: For NAR API compat
getRecentDerivations(): Derivation[] {
  return this.memory.recent(50)
    .filter(e => e.type === 'derivation')
    .map(e => e.payload as Derivation);
}

// ENSURE: start() initializes engines
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

// ENSURE: stop() persists everything
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
```

**Verification:** `pnpm vitest run tests/unit/agent` — **ALL PASS** (no test changes).

---

### Phase 2 — Move Helpers to Core (1-2 hrs)

```bash
# 1. createCortexFromLM (already moved in Phase 0, verify)
# core/src/cortex/createCortexFromLM.ts — already done

# 2. JsonlSessionManager
mv nar/src/agent/session.ts core/src/memory/SessionManager.ts
# Update imports inside to use @senars/core

# 3. buildAgentTools
mkdir -p core/src/motor
mv nar/src/agent/tools.ts core/src/motor/buildAgentTools.ts

# 4. isNarsese helper
# Already in core/src/helpers.ts from Phase 0

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

# 7. Delete nar/src/agent/bridge.ts (moved to @senars/io)
rm nar/src/agent/bridge.ts

# 6. Delete cruft files
rm metta/src/agent/{MettaAgent,MettaChannelOps,MettaInputProcessor,MettaTypes,MettaPromptBuilder,MettaSkills}.ts
rm -rf core/src/events  # entire directory

# 7. Update metta/src/agent/index.ts to minimal
cat > metta/src/agent/index.ts <<'EOF'
export { MettaCommandParser, LLM_COMMANDS } from './MettaCommandParser.js';
export { MettaEngine } from '../engine/MettaEngine.js';
export type { ParsedCommand, LlmCommand } from './MettaCommandParser.js';
EOF

# 8. Remove AutonomyEngine stub from nar/src/agent/index.ts (if still there)
```

**Verification:** `pnpm -r typecheck` + `pnpm vitest run tests/unit/agent tests/unit/core`

---

### Phase 3 — Core `Agent` Enhancements (30 min)

```typescript
// core/src/Agent.ts — ensure these exist:

// Engine interface — REMOVE optional absorb/persist/load
export interface Engine {
  readonly id: EngineId;
  reason(stimulus: CognitiveStimulus, context: Context): Promise<Derivation[]>;
  query(pattern: string): Promise<unknown[]>;
  // REMOVE: absorb?(result: ToolResult): void;
  // REMOVE: persist?(): Promise<void>;
  // REMOVE: load?(): Promise<void>;
}

// NAREngine & MettaEngine already have initialize/shutdown — keep those
```

**Verification:** `pnpm vitest run tests/unit/core tests/e2e/agent-smoke`

---

### Phase 4 — Fix Bins (30 min)

| Bin | Change |
|-----|--------|
| `senars.ts` | Start UI: `const agent = createAgent({ nar }); await startAgentUI(agent, {port: 8765});` |
| `bot-ai.ts` | **Remove dummy `new Agent()` for UI** (lines 159-166); use main `agent` for `startAgentUI`; remove `autonomyEngine` |
| `repl.ts` | Use `createAgent`; remove `autonomyEngine`; session via `config.sessionId` |
| `multi-agent*.ts` | Use `createAgent`; no other changes |
| `mcp-server.ts` | Import fixed in Phase 0; use `createAgent({ nar })` |

**Verification:** Each bin runs without error.

---

### Phase 5 — `temporal` Lens (15 min)

**Two files, identical update:**

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

**Verification:** `pnpm vitest run tests/e2e/agent-smoke.test.ts` — lens.list returns 4 entries.

---

### Phase 6 — Memory Consolidation + Sqlite (1-2 hrs)

```typescript
// core/src/memory/MemoryService.ts
async consolidate(correlationId: string): Promise<void> {
  // 1. Working → Episodic: high-salience entries appended to EventLog
  const recent = this.#working.filter(e => e.correlationId === correlationId);
  for (const entry of recent) {
    const salience = (entry.payload as any).salience ?? 0.5;
    if (salience > 0.7 && this.#log) {
      await this.#log.append({
        type: 'memory.consolidated',
        payload: entry,
        correlationId,
      });
    }
  }
  // 2. Tool feedback → Procedural: ToolRegistry.getAllFeedback() already tracks
  // 3. Engine state → LTM
  for (const engine of this.#engines?.values() ?? []) {
    await engine.persist?.();
  }
}

// Agent.stop() already calls memory.persist() → engines persist
```

**SqliteEventLog:** Already exists. `createAgent` uses it when `config.persistence` provided.

**Verification:** Start agent, add beliefs, `agent.stop()`, restart with same persistence path → beliefs recovered.

---

### Phase 7 — Config Unification (30 min)

```typescript
// In createAgent:
import { appConfigSchema } from '@senars/config/schema';

export function createAgent(config: CreateAgentConfig = {}): Agent {
  // Validate and map AppConfig → CreateAgentConfig
  const validated = appConfigSchema.parse(config);
  const mapped: CreateAgentConfig = {
    nar: validated.nar,
    lmService: validated.lmService,
    episodicMemory: validated.episodicMemory,
    persistence: validated.persistence,
    sessionId: validated.sessionId,
    externalTools: validated.externalTools,
    throttle: validated.agent?.throttle,
    promptBuilder: validated.promptBuilder,
  };
  // ... rest of createAgent
}
```

**CLI:** `senars --config file.json` already works via `loadConfigFromEnv()`.

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
      const sorted = [...v].sort((a,b) => a-b);
      out[`${k}_count`] = sorted.length;
      out[`${k}_sum`] = sorted.reduce((a,b) => a+b, 0);
      out[`${k}_avg`] = sorted.length ? out[`${k}_sum`] / sorted.length : 0;
      out[`${k}_p50`] = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
      out[`${k}_p95`] = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
      out[`${k}_p99`] = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
    }
    return out;
  }
}
```

**Agent integration:**
```typescript
// core/src/Agent.ts
class Agent {
  readonly metrics = new Metrics();
  
  async cycle(stimulus: CognitiveStimulus): Promise<string> {
    const start = Date.now();
    const cid = crypto.randomUUID();
    try {
      // ... existing cycle logic ...
    } finally {
      this.metrics.record('cycleLatency', Date.now() - start);
      this.metrics.inc('cycleCount');
    }
  }
}
```

**Correlation IDs:** `cycle()` generates `cid`; propagate to `log.append()`, `bridge`, WS messages.

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
// Tool allowlist in ToolRegistry.execute()
async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const tool = this.#tools.get(name);
  if (!tool) return { success: false, content: null, error: `Unknown tool: ${name}` };
  
  if (name === 'shell' || name === 'read-file' || name === 'write-file') {
    const policy = this.#policy?.getConfig?.();
    if (policy?.allowedCommands && name === 'shell') {
      const cmd = args.args?.[0] as string;
      if (!policy.allowedCommands.some(c => cmd.startsWith(c))) {
        return { success: false, content: null, error: 'Command not allowed' };
      }
    }
    if (policy?.allowedPaths && (name === 'read-file' || name === 'write-file')) {
      const path = args.args?.[0] as string;
      if (!policy.allowedPaths.some(p => path.startsWith(p))) {
        return { success: false, content: null, error: 'Path not allowed' };
      }
    }
  }
  // ... rest of execute
}
```

**Auth:** Reuse `AuthManager` from `@senars/io`. Add `auth` config to transport factories.

**Graceful degradation:** In `createAgent` chat override: if LM unavailable → NAR-only; if NAR down → LM-only.

---

### Phase 10 — Sessions + REPL (45 min)

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

**REPL polish:** Add history file (`~/.senars/repl_history`), Tab completion (from `motor.list()` + NAR terms), ANSI colors in `repl.ts`.

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

### Phase 12 — Test Updates (15 min)

```typescript
// tests/integration/metta-transports.test.ts + metta-conversation.test.ts
// import { MettaAgent } from '@senars/metta/agent';
// → import { Agent } from '@senars/core';
// let agent: MettaAgent;
// → let agent: Agent;
// agent = new MettaAgent();
// → agent = new Agent();  // or createAgent({ nar: SeNARSFactory.createForTesting() })
```

---

### Phase 13 — Docs (30 min)

Create `ARCHITECTURE.md` documenting the unified design.

---

## Execution Order (Verifiable)

| Phase | Steps | Verification |
|-------|-------|--------------|
| **0** | Move helpers (cortex, session, tools, isNarsese) to Core; fix mcp-server import | `pnpm -r typecheck` |
| **1** | Rewrite `createAgent` → returns Core `Agent` | `pnpm vitest run tests/unit/agent` — **ALL PASS** |
| **2** | Move helpers to Core (createCortexFromLM, JsonlSessionManager, buildAgentTools); delete cruft | `pnpm -r typecheck` + all tests |
| **3** | Core `Agent` enhancements (`getRecentDerivations`, `replaySession`, `start`/`stop` wiring) | `pnpm vitest run tests/unit/core tests/e2e/agent-smoke` |
| **4** | Fix bins (`senars`, `bot-ai`, `repl`, `multi-agent*`, `mcp-server`) | Each bin runs |
| **5** | `temporal` lens | `pnpm vitest run tests/e2e/agent-smoke` |
| **6** | Memory `consolidate()` + SqliteEventLog wiring | Restart recovers beliefs |
| **7** | Config unification on `src/config` | `senars --config` works |
| **8** | `Metrics.ts` + correlation IDs | Structured logs + JSON metrics |
| **9** | Rate-limit + allowlist + auth + degradation | Failure injection tests |
| **10** | Sessions in `createAgent` + REPL polish | REPL session persists |
| **11** | Add `technical-analysis` to `LLM_COMMANDS` | `pnpm -r typecheck` |
| **12** | Update 2 tests: `metta-transports`, `metta-conversation` → use Core `Agent` | All tests green |
| **13** | `ARCHITECTURE.md` | Doc exists |

**Demo-ready after Phase 3** (unified agent + e2e tests pass).

---

## Success Criteria (Proven by Tests, No Mocks)

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

## Philosophy

> **A cognitive agent is not a class. It is a process.**
>
> We had two classes pretending to be one process. Now we have **one class** (`Agent`) that **is** the process, and **one factory** (`createAgent`) that configures it. The EventLog is its nervous system. MemoryService is its hippocampus. Engines are its reasoning organs. Cortex is its voice. Motor is its hands. Bridge is its eyes. Plugins are its microbiome.
>
> **No duality. No compatibility layers. No dead code. One living organism.**