# NEXT.agent13.md — The Unified Cognitive Organism

> **Context (verified 2026-07-16):** 1017 tests pass, 5/5 packages typecheck clean. **Architectural reality:** Two incompatible `Agent` implementations exist. Core `Agent` (`core/src/Agent.ts`) has the living `cycle()`, engines, cortex, EventLog, MemoryService — UI Server works ONLY with this. NAR `createAgent` (`nar/src/agent/index.ts`) is a plain object with `chat`/`believe`/`recall`/`know*` — ALL bins and NAR tests use this. It has NO `cycle()`, NO EventLog, NO cortex, emits `agent:*` events incompatible with UI Bridge. `bot-ai.ts` creates BOTH. **No backwards compatibility needed. Unify into ONE organism.**

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

## 1. Current Cruft — DELETE All of It

| File | Why | Action |
|------|-----|--------|
| `metta/src/agent/MettaAgent.ts` | Thin wrapper over Core Agent, only used by 2 integration tests | **DELETE** |
| `metta/src/agent/MettaChannelOps.ts` | Unused | **DELETE** |
| `metta/src/agent/MettaInputProcessor.ts` | Unused | **DELETE** |
| `metta/src/agent/MettaTypes.ts` | Only used by deleted files | **DELETE** |
| `metta/src/agent/MettaPromptBuilder.ts` | Never imported, dead | **DELETE** |
| `metta/src/agent/MettaSkills.ts` | Defined + exported, never used | **DELETE** |
| `metta/src/agent/MettaCommandParser.ts` | **KEEP** — used by `createAgent` |
| `metta/src/agent/MettaEngine.ts` | **KEEP** — used by `createAgent` |
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

## 2. Unification Work — Surgical, Complete

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
}

export function createAgent(config: CreateAgentConfig = {}): Agent {
  // 1. EventLog
  const log = config.persistence
    ? new SqliteEventLog({ path: config.persistence.path })
    : new InMemoryEventLog();

  // 2. Cortex
  const cortex = config.lmService ? createCortexFromLM(config.lmService) : undefined;

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

  // 5. Session restore
  if (config.sessionId) {
    const sessionManager = new JsonlSessionManager({ basePath: '.cache/sessions' });
    await sessionManager.restore();
    // TODO: replay session events into agent.log / agent.memory
  }

  // 6. Initialize
  await agent.start();

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
| `nar/src/agent/types.ts` | `core/src/Agent.ts` | Consolidate types |

**`nar/src/agent/index.ts` re-exports** (for test compatibility):
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
| `multi-agent*.ts` | Use `createAgent`; no other changes |
| `mcp-server.ts` | Fix import: `@senars/nar` not `../../nar/src`; use `createAgent({ nar })` |

---

## 3. Remaining Real Gaps (Post-Unification)

### P3 — Memory: `consolidate()` + SqliteEventLog Wiring

**`core/src/memory/MemoryService.ts`:**
```typescript
async consolidate(correlationId: string): Promise<void> {
  // 1. Promote high-salience working → episodic (append to EventLog)
  const recent = this.#working.filter(e => e.correlationId === correlationId);
  for (const entry of recent) {
    if ((entry as any).salience > 0.7) {
      await this.#log?.append({ type: 'memory.consolidated', payload: entry, correlationId });
    }
  }
  // 2. Tool patterns → procedural (ToolRegistry.getAllFeedback() already tracks)
  // 3. Engine state → LTM
  for (const engine of this.#engines?.values() ?? []) {
    await engine.persist?.();
  }
}
```

**`core/src/Agent.ts`:** `stop()` calls `memory.persist()` → calls `engine.persist()` for all engines.

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
  record(name: string, value: number) { const arr = this.#histograms.get(name) ?? []; arr.push(value); this.#histograms.set(name, arr); }
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
- Graceful degradation: in `createAgent` chat, if LM unavailable → NAR-only; if NAR down → LM-only

### P8 — Sessions + REPL Polish

- `createAgent({sessionId})` → `JsonlSessionManager.restore()` on start, `snapshot()` on stop
- REPL: history file (`~/.senars/repl_history`), Tab completion (from `motor.list()` + NAR terms), ANSI colors

### P9 — Fix Tool/Parser Mismatch

`core/src/motor/builtin-tools.ts` has 14 tools; `MettaCommandParser.LLM_COMMANDS` has 13. Add `'technical-analysis'` to `LLM_COMMANDS` array.

### P10 — Update Integration Tests (No Backwards Compat)

**`tests/integration/metta-transports.test.ts` + `metta-conversation.test.ts`:**
```typescript
// OLD: import { MettaAgent } from '@senars/metta/agent';
// NEW: import { Agent } from '@senars/core';
const agent = new Agent({ /* config */ });
```
These tests exercise Core Agent transport/chat functionality — they pass unchanged with `Agent`.

---

## 4. Execution Order (Each Step Verifiable)

| Phase | Steps | Verification |
|-------|-------|--------------|
| **0** | Delete all cruft files (Table 1) | `pnpm -r typecheck` |
| **1** | Rewrite `nar/src/agent/index.ts` as factory returning Core `Agent` | `pnpm vitest run tests/unit/agent` |
| **2** | Move helpers (cortex, session, tools, types) to Core | `pnpm -r typecheck` |
| **3** | Fix all 7 bins to use unified `createAgent` | Each bin runs without error |
| **4** | Update 2 integration tests to use `Agent` from `@senars/core` | `pnpm vitest run tests/integration/metta-*.test.ts` |
| **5** | Core `Agent` enhancements (`getRecentDerivations`, engine init/shutdown) | `pnpm vitest run tests/unit/core` |
| **6** | `temporal` lens | `pnpm vitest run tests/e2e/agent-smoke.test.ts` |
| **7** | Memory `consolidate()` + SqliteEventLog wiring | Restart recovers beliefs |
| **8** | Config unification on `src/config` schema | `senars --config` works |
| **9** | `Metrics.ts` + correlation IDs | Structured logs + JSON metrics |
| **10** | Rate-limit + allowlist + auth + degradation | Failure-path tests pass |
| **11** | Sessions in `createAgent` + REPL polish | REPL session persists |
| **12** | Fix `technical-analysis` in `LLM_COMMANDS` | `pnpm -r typecheck` |
| **13** | `ARCHITECTURE.md` documenting unified design | Doc exists |

**Demo-ready after Phase 6** — UI works with all bins.

---

## 5. Keep / Kill / Birth (Final)

| Verdict | Component | Note |
|---------|-----------|------|
| ✅ KEEP | Core `Agent` (`cycle`, engines, cortex, bridge) | **The organism** |
| ✅ KEEP | `createAgent` factory (`nar/src/agent/index.ts`) | **The only factory** |
| ✅ KEEP | `EventLog` (InMemory+Sqlite), `MemoryService`, `ModelRunner`, `LLMCortex` | Core internals |
| ✅ KEEP | `NAREngine`, `MettaEngine`, `MettaCommandParser`, `PolicyEngine`, `ToolRegistry` | Organs |
| ✅ KEEP | `AgentBridge`, `Plugin`, `MessageRouter`+connections, `NAR`/`MeTTaRuntime` | Senses/immune |
| ✅ KEEP | UI viewports/store/ws-client, `startAgentUI` | Eyes |
| ✅ KEEP | `errors/AgentError`, `Logger`, `src/config` schema | Infra |
| ❌ KILL | All files in Table 1 (cruft) | Dead code |
| 🌱 BIRTH | `createAgent` → Core `Agent` factory (P1) | Unification |
| 🌱 BIRTH | Core `Agent.getRecentDerivations()` + engine init/shutdown (P2) | NAR API support |
| 🌱 BIRTH | `temporal` lens spec (P4) | Missing lens |
| 🌱 BIRTH | `MemoryService.consolidate()` + Sqlite wiring (P3) | Persistence |
| 🌱 BIRTH | `observability/Metrics.ts` (P6) | Only missing file |
| 🌱 BIRTH | Session wiring in `createAgent` (P8) | Usability |
| 🌱 BIRTH | Rate-limit + allowlist + auth (P7) | Security basics |

---

## 6. Success Criteria

| Metric | Target |
|--------|--------|
| **Unified Agent** | `createAgent` returns Core `Agent`; UI works with all bins |
| All 7 bins run | `senars` (UI), `bot-ai` (IRC+UI), `multi-agent*`, `repl`, `mcp-server` |
| TypeScript | 0 errors, 5/5 packages |
| Tests | 1017+ green (2 integration tests updated, 0 other test changes) |
| Memory | 5 tiers, `consolidate()` real, persist across restart |
| Tools | 14/14 parser+tool aligned; policy-checked |
| UI | Real-time WS: `cognitive.delta`, `config.schema`, `lens.*` (4), `focus.*`, Narsese→graph |
| Config | One schema (`src/config`), consumed by `createAgent` |
| Observability | Structured logs + JSON metrics + correlation IDs |
| Security | Rate-limit + path/command allowlist + optional auth |
| Sessions | Persisted, restorable via `createAgent({sessionId})` |
| Dead code | 0 (all Table 1 files deleted) |
| Docs | `ARCHITECTURE.md` explaining unified design |

---

## 7. Philosophy

> **A cognitive agent is not a class. It is a process.**
>
> We had two processes pretending to be one. Now there is one: **Core `Agent` is the organism; `createAgent` is its NAR-specialized factory.** The UI, the bins, the tests — all touch the same living cycle, the same EventLog, the same memory. No duplicate agents. No event contract mismatches. No dummy UI agents. No backwards compatibility. Full-speed ahead.