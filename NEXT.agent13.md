# NEXT.agent13.md — The Unified Cognitive Organism

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
│               config?, sessionId?, externalTools? }                  │
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

### P0 — `createAgent` Returns Core `Agent` Instance

**File:** `nar/src/agent/index.ts` → **rewrite completely**

```typescript
// nar/src/agent/index.ts
import { Agent } from '@senars/core';
import { NAREngine } from '../engine/NAREngine.js';
import { MettaEngine } from '@senars/metta/engine/MettaEngine.js';
import { createCortexFromLM } from '@senars/core/cortex/createCortexFromLM.js';  // moved
import { SqliteEventLog, InMemoryEventLog } from '@senars/core';
import { JsonlSessionManager } from '@senars/core/memory/SessionManager.js';  // moved
import type { LMService, EpisodicMemory, NAR } from '@senars/nar';

export interface CreateAgentConfig {
  nar?: NAR;
  lmService?: LMService;
  episodicMemory?: EpisodicMemory;
  persistence?: { path: string };
  sessionId?: string;
  externalTools?: Record<string, unknown>;
  throttle?: number;
  promptBuilder?: import('@senars/core').PromptBuilder;  // optional custom prompt builder
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

  // 5. Session restore (if sessionId provided)
  if (config.sessionId) {
    const sessionManager = new JsonlSessionManager({ basePath: '.cache/sessions' });
    await sessionManager.restore();
    // Replay session events into agent.log / agent.memory
    const events = sessionManager.getSession(config.sessionId)?.events ?? [];
    for (const evt of events) {
      await agent.log.append(evt);
    }
  }

  // 6. Initialize
  await agent.start();  // initializes engines, loads memory

  // 7. Attach NAR-specific API (mutate instance)
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
  (agent as any).getRecentDerivations = () => agent.memory.recent(50).filter(e => e.type === 'derivation');

  // on/off delegate to Core Agent (already works)
}

function isNarsese(text: string): boolean { /* existing implementation */ }
```

**Core `Agent` changes** (`core/src/Agent.ts`):
- Add `getRecentDerivations()` reading from memory
- Ensure `start()` calls `engine.initialize()` for each engine
- Ensure `stop()` calls `engine.shutdown()` + `memory.persist()`
- `chat()` already returns `AsyncGenerator<ChatStreamEvent, string>` — works
- `cycle()` already calls `cortex.synthesize()` → parser → motor for NL path

### P1 — Move/Consolidate NAR Agent Helpers

| From | To | Action |
|------|-----|--------|
| `nar/src/agent/cortex.ts` | `core/src/cortex/createCortexFromLM.ts` | Move `createCortexFromLM` |
| `nar/src/agent/session.ts` | `core/src/memory/SessionManager.ts` | Move `JsonlSessionManager` |
| `nar/src/agent/tools.ts` | `core/src/motor/buildAgentTools.ts` | Move `buildAgentTools` |
| `nar/src/agent/bridge.ts` | `@senars/io` (keep) | Re-export from `nar/src/agent/index.ts` |
| `nar/src/agent/types.ts` | `core/src/Agent.ts` | Consolidate |

**`nar/src/agent/index.ts` re-exports (for test compatibility):**
```typescript
export { createAgent } from './index.js';
export { createCortexFromLM } from '@senars/core/cortex';
export { JsonlSessionManager, createSession } from '@senars/core/memory';
export { buildAgentTools } from '@senars/core/motor';
export { bindAgentToConnection, createAgentDispatch, ... } from '@senars/io';
```

### P2 — Fix Bins (Use Unified `createAgent`)

| Bin | Change |
|-----|--------|
| `senars.ts` | Start UI: `const agent = createAgent({ nar }); await startAgentUI(agent, {port: 8765});` |
| `bot-ai.ts` | Remove dummy `new Agent()` for UI; use main `agent` for `startAgentUI`; remove `autonomyEngine` |
| `repl.ts` | Use `createAgent`; remove `autonomyEngine`; session via `config.sessionId` |
| `multi-agent*.ts` | Use `createAgent`; no other changes needed |
| `mcp-server.ts` | Fix import: `@senars/nar` not `../../nar/src`; use `createAgent({ nar })` |

---

## 4. Remaining Real Gaps (Post-Unification)

### P3 — Memory: `consolidate()` + SqliteEventLog Wiring

**`core/src/memory/MemoryService.ts`:**
```typescript
async consolidate(correlationId: string): Promise<void> {
  // 1. Promote high-salience working → episodic (append to EventLog)
  const recent = this.#working.filter(e => e.correlationId === correlationId);
  for (const entry of recent) {
    if ((entry as any).salience > 0.7) {  // threshold
      await this.#log?.append({ type: 'memory.consolidated', payload: entry, correlationId });
    }
  }
  // 2. Successful tool patterns → procedural (ToolRegistry.getAllFeedback() already tracks)
  // 3. Engine state → LTM
  for (const engine of this.#engines?.values() ?? []) {
    await engine.persist?.();
  }
}
```

**`core/src/Agent.ts`:** `stop()` calls `memory.persist()` → engines persist.

**SqliteEventLog:** Already exists. `createAgent` uses it when `config.persistence` provided.

### P4 — UI: `temporal` Lens (Only Missing Lens)

**`core/src/lens-schema.ts` + `ui/src/shared/lens-schema.ts`:**
```typescript
export const BUILTIN_LENS_IDS = ['belief', 'goal', 'contradiction', 'temporal'] as const;

export function builtinLensSpecs(): LensSpec[] {
  return [
    // ... existing three ...
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
UI Server already handles `lens.list`/`lens.fields`/`lens.delta` — works automatically.

### P5 — Config Unification (Use Existing `src/config`)

**`src/config/schema.ts`** already has `appConfigSchema`, `botConfigSchema`, `narCoreSchema`, `lmSchema`.

**`createAgent` accepts `AppConfig` subset:**
```typescript
import { appConfigSchema } from '@senars/config/schema';
// validate and map to CreateAgentConfig
```

**CLI:** `senars --config file.json` loads via `loadConfigFromEnv()`.

### P6 — Observability: `Metrics.ts` + Correlation IDs

**New file:** `core/src/observability/Metrics.ts`
```typescript
export class Metrics {
  #counters = new Map<string, number>();
  #histograms = new Map<string, number[]>();

  inc(name: string, value = 1) { this.#counters.set(name, (this.#counters.get(name) ?? 0) + value); }
  record(name: string, value: number) {
    const arr = this.#histograms.get(name) ?? []; arr.push(value); this.#histograms.set(name, arr);
  }
  get(name: string) { return this.#counters.get(name) ?? 0; }
  getHistogram(name: string) { return this.#histograms.get(name) ?? []; }
  toJSON() { /* Prometheus-compatible output */ }
}
```

**Core `Agent`** gets `metrics: new Metrics()`; `cycle()` records `cycleLatency`, `toolExecMs`, etc.

**Correlation IDs:** `cycle()` generates `cid`; propagated to `log.append`, `bridge`, WS messages.

### P7 — Resilience + Security (Essential Only)

- `errors/AgentError.ts` — **already exists**, use in `cycle()` + `motor.execute()`
- Rate limiting: token bucket in `ConnectionManager` (per connection)
- Tool allowlist: `PolicyConfig.allowedPaths`/`allowedCommands` checked in `motor.execute()` before `shell`/`read-file`/`write-file`
- Auth: `auth: {type:'none'|'jwt'|'apikey'}` on WS/HTTP/MCP; reuse `AuthManager`
- Graceful degradation: in `createAgent` chat override: if LM unavailable → NAR-only; if NAR down → LM-only

### P8 — Sessions + REPL Polish

- `createAgent({sessionId})` → `JsonlSessionManager.restore()` on start, `snapshot()` on stop
- REPL: history file (`~/.senars/repl_history`), Tab completion (from `motor.list()` + NAR terms), ANSI colors

### P9 — Tool/Parser Alignment

**`metta/src/agent/MettaCommandParser.ts`:** Add `'technical-analysis'` to `LLM_COMMANDS` array (1 line).

---

## 5. Execution Order (Each Step Verifiable by Tests)

| Phase | Steps | Verification |
|-------|-------|--------------|
| **0** | Fix `mcp-server.ts` import; delete cruft files (Table 1) | `pnpm -r typecheck` |
| **1** | Rewrite `nar/src/agent/index.ts` `createAgent` → returns Core `Agent` | `pnpm vitest run tests/unit/agent` — **ALL PASS** |
| **2** | Core `Agent` enhancements (`getRecentDerivations`, `start`/`stop` wiring) | `pnpm vitest run tests/unit/core tests/e2e/agent-smoke` |
| **3** | Move helpers (`createCortexFromLM`, `JsonlSessionManager`, `buildAgentTools`) to Core | `pnpm -r typecheck` + all tests |
| **4** | Fix bins (`senars`, `bot-ai`, `repl`, `multi-agent*`, `mcp-server`) | Each bin runs |
| **5** | `temporal` lens | `pnpm vitest run tests/e2e/agent-smoke` |
| **6** | Memory `consolidate()` + SqliteEventLog wiring | Restart recovers beliefs |
| **7** | Config unification on `src/config` | `senars --config` works |
| **8** | `Metrics.ts` + correlation IDs | Structured logs + JSON metrics |
| **9** | Rate-limit + allowlist + auth + degradation | Failure injection tests |
| **10** | Sessions in `createAgent` + REPL polish | REPL session persists |
| **11** | Add `technical-analysis` to `LLM_COMMANDS` | `pnpm -r typecheck` |
| **12** | Update 2 tests: `metta-transports`, `metta-conversation` → use Core `Agent` | All tests green |
| **13** | `ARCHITECTURE.md` documenting unified design | Doc exists |

**Demo-ready after Phase 2** (unified agent + e2e tests pass).

---

## 6. E2E User Flow Simulation (Hot Paths Verified)

### Flow 1: `senars` → UI
```
$ senars
  → createAgent({ nar }) → Core Agent (NAREngine, MettaEngine, no cortex)
  → agent.start() → engines init
  → startAgentUI(agent) → WS server on :8765
  → Browser opens → WS handshake (config.schema, lens.list, lens.fields, cognitive.delta)
  → User types "<cat --> mammal>." → WS chat.user
    → agent.cycle({text, source:'ws'}) → perceive→recall→reason(NAREngine derives)→narrate(no cortex)→act(none)→consolidate
    → bridge projects cognitive.delta (new nodes) → WS sends → UI renders graph growth
```

### Flow 2: `bot-ai` (IRC + WS + HTTP + MCP)
```
$ bot-ai
  → loadConfigFromEnv() → createAgent({ nar, episodicMemory, lmService, ... })
    → Core Agent with ALL: NAREngine, MettaEngine, LLMCortex, EventLog, MemoryService
  → agent.start()
  → ConnectionManager mounts IRC, WS, HTTP, MCP
  → bindAgentToConnection for each → handlers call agent.chat() or agent.cycle()
  → IRC message → handler → agent.chat(text)
    → if Narsese: direct NAR fast-path (no cortex)
    → if NL: agent.cycle() → cortex → parser → motor → response
    → response sent back via IRC
  → WS UI works on SAME agent instance → shows live derivations from IRC
```

### Flow 3: `repl` (Interactive CLI)
```
$ repl
  → createAgent({ nar, lmService, episodicMemory, ... })
  → agent.start()
  → readline loop → agent.chat(text, { session })
    → Narsese fast-path OR full cycle
  → .commands call agent.know(), agent.recall(), agent.believe(), agent.getThrottle()
  → session persists via JsonlSessionManager on exit
```

### Flow 4: `mcp-server` (MCP stdio)
```
$ mcp-server
  → createAgent({ nar })
  → registerNARToolsAsMCP(nar, adapter)
  → registerAgentAPI(agent, adapter) → exposes agent.chat, agent.believe, agent.recall, agent.know
  → MCP client calls tools → handlers call agent methods
```

### Flow 5: `multi-agent` (Demo WS + CLI)
```
$ multi-agent
  → createAgent({ nar })
  → WS + CLI connections → onMessage → agent.chat(msg.text) → response sent back
```

**All paths converge on the SAME Core `Agent` instance.** NAR API override handles Narsese fast-path; NL goes through full cognitive cycle.

---

## 7. Keep / Kill / Birth (Final, Unambiguous)

| Verdict | Component | Note |
|---------|-----------|------|
| ✅ KEEP | **Core `Agent`** (`core/src/Agent.ts`) | **THE organism** |
| ✅ KEEP | `createAgent` factory (`nar/src/agent/index.ts`) | **THE only factory** |
| ✅ KEEP | `EventLog` (InMemory+Sqlite), `MemoryService`, `ModelRunner`, `LLMCortex` | Core internals |
| ✅ KEEP | `NAREngine`, `MettaEngine`, `MettaCommandParser`, `PolicyEngine`, `ToolRegistry` | Organs |
| ✅ KEEP | `AgentBridge`, `Plugin`, `MessageRouter`+connections, `NAR`/`MeTTaRuntime` | Senses/immune |
| ✅ KEEP | UI viewports/store/ws-client, `startAgentUI` | Eyes |
| ✅ KEEP | `errors/AgentError`, `Logger`, `src/config` schema | Infra |
| ✅ KEEP | **Metta substrate**: `engine/*`, `runtime/*`, `parser/*`, `core/*`, `stdlib/*`, `types/*`, `extensions/*`, `ipc/*`, `performance/*` | Reasoning engine |
| ✅ KEEP | `metta/src/agent/MettaCommandParser.ts`, `MettaEngine.ts` | Used by factory |
| 🟡 FIX | `technical-analysis` in `LLM_COMMANDS` | 1 line add |
| ❌ KILL | `metta/src/agent/MettaAgent.ts` | Redundant wrapper |
| ❌ KILL | `metta/src/agent/MettaChannelOps.ts` | Dead |
| ❌ KILL | `metta/src/agent/MettaInputProcessor.ts` | Dead |
| ❌ KILL | `metta/src/agent/MettaTypes.ts` | Dead |
| ❌ KILL | `metta/src/agent/MettaPromptBuilder.ts` | Dead |
| ❌ KILL | `metta/src/agent/MettaSkills.ts` | Dead |
| ❌ KILL | `nar/src/agent/bridge.ts` | Consolidate to `@senars/io` |
| ❌ KILL | `nar/src/agent/cortex.ts` | Move to Core |
| ❌ KILL | `nar/src/agent/session.ts` | Move to Core |
| ❌ KILL | `nar/src/agent/tools.ts` | Move to Core |
| ❌ KILL | `nar/src/agent/types.ts` | Consolidate |
| ❌ KILL | `AutonomyEngine` stub | Dead |
| ❌ KILL | `core/src/engine/Engine.ts` optional `absorb`/`persist`/`load` | Unused |
| ❌ KILL | `core/src/events/*` | Unused event system |
| 🌱 BIRTH | Unified `createAgent` → Core `Agent` factory | P1 |
| 🌱 BIRTH | Core `Agent.getRecentDerivations()` | P2 |
| 🌱 BIRTH | `temporal` lens spec | P4 |
| 🌱 BIRTH | `MemoryService.consolidate()` + Sqlite wiring | P5 |
| 🌱 BIRTH | `observability/Metrics.ts` | P6 |
| 🌱 BIRTH | Session wiring in `createAgent` | P8 |

---

## 8. Success Criteria (Proven by Tests, No Mocks)

| Metric | Target | Proven By |
|--------|--------|-----------|
| **Single Agent class** | Only `core/src/Agent.ts` exports `Agent` | `grep -r "export.*class Agent"` |
| **Single factory** | Only `nar/src/agent/index.ts` exports `createAgent` | `grep -r "export.*createAgent"` |
| All 7 bins run | `senars`, `bot-ai`, `multi-agent`, `multi-agent-demo`, `repl`, `mcp-server` | Manual + CI |
| TypeScript | 0 errors, 5/5 packages | `pnpm -r typecheck` |
| **E2E tests (no mocks)** | `agent-smoke`, `metta-smoke`, `webui-client-verify` pass | `pnpm vitest run tests/e2e` |
| **Integration tests (real components)** | `multi-agent`, `metta-conversation`, `metta-transports`, `irc-live` pass | `pnpm vitest run tests/integration` |
| **Unit tests (real objects)** | All 1017+ pass | `pnpm vitest run` |
| Memory persistence | Restart recovers beliefs/tools | Manual + `agent-smoke` |
| UI real-time | WS: `cognitive.delta`, `config.schema`, `lens.*` (4), `focus.*`, Narsese→graph | `agent-smoke.test.ts` |
| Config | One schema (`src/config`), consumed by `createAgent` | `senars --config` |
| Observability | Structured logs + JSON metrics + correlation IDs | Manual + `/metrics` |
| Security | Rate-limit + path/command allowlist + optional auth | Failure tests |
| Sessions | Persisted, restorable via `createAgent({sessionId})` | REPL test |
| Dead code | 0 lines (deleted files above) | `grep -r "MettaPromptBuilder\|MettaAgent\|MettaChannelOps\|AutonomyEngine"` |

---

## 9. Philosophy

> **A cognitive agent is not a class. It is a process.**
>
> We had two classes pretending to be one process. Now we have **one class** (`Agent`) that **is** the process, and **one factory** (`createAgent`) that configures it. The EventLog is its nervous system. MemoryService is its hippocampus. Engines are its reasoning organs. Cortex is its voice. Motor is its hands. Bridge is its eyes. Plugins are its microbiome.
>
> **No duality. No compatibility layers. No dead code. One living organism.**