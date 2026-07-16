# NEXT.agent13.md — Complete the Cognitive Organism

> **Context:** Steps A–F from NEXT.agent12.md are largely complete. All 1017 tests pass. TypeScript compiles clean. The organism is alive but needs its remaining organs wired, bins fixed, and production hardening.

---

## 1. Current State Summary

| Area | Status | Notes |
|------|--------|-------|
| **Core Agent** | ✅ Done | `Agent` owns log/memory/engines/cortex/motor/policy/bridge; `cycle()` implemented |
| **Engines** | ✅ Done | `NAREngine` + `MettaEngine` implement `Engine` interface; registered via `createAgent` |
| **Memory** | 🟡 Partial | 5-tier scaffold exists (working/episodic/semantic/procedural/LTM); consolidation is a stub |
| **Tools** | 🟡 13/15 | 13 builtin tools match `MettaCommandParser` commands; 2 commands (`episodes`, `search`) need full impl |
| **Cortex** | ✅ Done | `LLMCortex` wraps `ModelRunner` + `PromptBuilder`; synthesis works |
| **UI Server** | ✅ Done | `startAgentUI` streams `IncomingFromServer` over WS; handshake + Narsese→graph works |
| **UI Client** | 🟡 Partial | Viewports + store + ws-client work; **GraphRenderer abstraction + lens wiring missing** |
| **Plugin System** | ✅ Done | `PluginLoader` + `Plugin` interface; builtin plugins scaffolded |
| **Bins** | 🟡 2/7 fixed | `senars.ts` ✅; `multi-agent*.ts` ✅; **`bot-ai.ts`, `repl.ts`, `mcp-server.ts` need fixes** |
| **Tests** | ✅ Green | 1017 pass, 1 skipped |
| **TypeScript** | ✅ Clean | 5/5 packages pass |

---

## 2. Remaining Work — Prioritized

### P0: Fix Broken Bins (unblocks CLI usage)
| Bin | Issue | Fix |
|-----|-------|-----|
| `bot-ai.ts` | Uses old `Agent` class + `registerBackend`; imports removed `Kernel` | Rewrite to use `createAgent` + `ConnectionManager` (like `multi-agent.ts`) |
| `repl.ts` | Uses `createAgent` but references `autonomyEngine` (stub) + missing `lmService` | Wire real `LLMCortex` + `LMService`; remove dead refs |
| `mcp-server.ts` | Uses `createNAR` from `../../nar/src` (not exported); references `SeNARSMCPServer`, `EnhancedMCPAdapter` | Use `@senars/nar/agent` exports; fix MCP adapter imports |

### P1: Complete Memory Tiers (§4 of agent12)
- **Tier 0 (working)** ✅ — ring buffer in `MemoryService`
- **Tier 1 (episodic)** ✅ — `queryEpisodic` reads `EventLog`
- **Tier 2 (semantic)** ✅ — `querySemantic` delegates to engines
- **Tier 3 (procedural)** 🟡 — `getProceduralFeedback` reads `ToolRegistry` feedback; **needs `SkillRegistry` promotion from `MettaSkills`**
- **Tier 4 (LTM)** 🟡 — `persist()`/`load()` delegate to engines; **needs SqliteEventLog wiring + MeTTa/NAR persistence**

**Action:** Flesh out `consolidate()` to promote high-salience working→episodic, successful tool patterns→procedural, engine state→LTM.

### P2: Wire Full Cognitive Loop (Agent.cycle → cortex → parser → motor → consolidate)
Current `Agent.cycle()` does:
1. Perceive (log) ✅
2. Recall (memory) ✅
3. Reason (engines) ✅
4. Narrate (cortex) ✅ — but **cortex not wired into `createAgent`**
5. Act (parse → motor) ✅ — but **parser not wired** (uses `#commandParser` optional)
6. Consolidate (memory) 🟡 — stub

**Actions:**
- `createAgent` must instantiate `LLMCortex(ModelRunner, MettaPromptBuilder)` and inject into `Agent`
- `Agent` needs `MettaCommandParser` as default `#commandParser`
- `Agent.cycle()` must call `cortex.synthesize()` when cortex exists
- Verify `chat()` → `cycle()` path works for both Narsese and NL

### P3: GraphRenderer Abstraction + Lens Wiring (UI)
- Extract `GraphRenderer` interface + `CytoscapeRenderer` + `SpaceGraphRenderer` from `ui/src/client`
- Refactor `graph-viewport.ts` / `spacegraph-viewport.ts` to ~80 lines each (thin adapters)
- Wire built-in lenses: `belief`, `goal`, `contradiction`, `temporal` → `lens.list` + `lens.fields` + `lens.delta`
- Ensure `focus.set` projects correctly via `AgentBridge`

### P4: MCP + IRC Transports as Plugins
- Move `WSConnection`, `CLIConnection`, `HTTPConnection`, `IRCConnection`, `MCPConnection` from `@senars/io` → `@senars/plugin-*` packages
- Each exports `AgentPlugin` registering its transport factory
- `createAgent` loads plugins via `PluginLoader` → `ConnectionManager` mounts them

### P5: REPL UX Polish
- History: persist to `~/.senars/repl_history`, Ctrl+R search
- Completion: Tab completes Narsese terms, tool names, lens names
- Colors: syntax highlight Narsese, tool output, errors
- Multiline: `\` continuation, Ctrl+Enter submit
- Meta-commands: `.help`, `.memory`, `.engines`, `.config`, `.quit`

### P6: Session Persistence + Restore
- `JsonlSessionManager` → persist to `~/.senars/sessions/{id}.jsonl`
- `createAgent({ sessionId })` → loads session, replays EventLog to rebuild memory tiers
- WS server broadcasts `state.snapshot` on connect; `command.replay {from,to}` streams `cognitive.delta`

### P7: Configuration System
- `core/src/config/Config.ts` — Zod schema for `AgentConfig` (name, nar, metta, llm, memory, senses, plugins, policy, ui)
- CLI: `senars --config file.json` / `SENARS_CONFIG` env / programmatic `createAgent({config})`
- Presets: `createAgentPreset('chat'\|'reasoning'\|'autonomous'\|'irc-bot')`
- `config.schema` WS message for UI

### P8: Observability (Logs + Metrics)
- `core/src/observability/Logger.ts` — pino-based, child loggers per component (`agent.nar`, `transport.ws`, …)
- `core/src/observability/Metrics.ts` — counters/histograms: cycle latency, tool exec time, LLM tokens, memory tier sizes, WS throughput
- Prometheus `/metrics` endpoint (via HTTP transport), JSONL file rotation
- Correlation IDs: every `cycle()` gets `cid` propagated through log/memory/bridge

### P9: Error Handling + Resilience
- `core/src/errors/AgentError.ts` — typed errors: `EngineError`, `ToolError`, `PolicyViolation`, `ConfigError`, `TransportError`
- `AgentBridge` projects errors → `chat.agent.error` WS message
- Per-tool retry policy (exponential backoff, max attempts)
- Per-engine circuit breaker (stop after N failures, auto-recover after timeout)
- Graceful degradation: LLM fails → symbolic-only; NAR fails → LM-only

### P10: Auth + Rate Limiting
- Transports (WS, HTTP, MCP) accept `auth: AuthConfig` — JWT, API key, or none
- `PolicyEngine` checks `principal.permissions` before tool execution
- Dev mode = no auth; prod mode = require `SENARS_AUTH_SECRET`
- Per-connection token bucket in `ConnectionManager`
- Per-tool quota in `PolicyConfig` (e.g., `shell: 10/min`, `tavily-search: 100/day`)
- Exposed via `config.schema` → UI shows remaining quota

### P11: Health Checks + Lifecycle
- `Agent.health()` → `{ status, checks: { nar, metta, llm, memory, transports } }`
- HTTP transport exposes `GET /health` (k8s-ready)
- `SIGTERM` → `agent.stop()` → `MemoryService.persist()` → `transport.close()` → `exit(0)`
- Startup order: config → log → memory → engines → cortex → motor → policy → bridge → senses → autonomy

### P12: Tool Sandboxing
- `ToolRegistry.execute()` runs in **vm2** sandbox (or `node:vm` with limited globals)
- Allowlist: `PolicyConfig.allowedPaths` for file tools; `PolicyConfig.allowedCommands` for shell
- Resource limits: CPU time, memory, output size per invocation
- Audit log: every tool execution logged with principal, args, result, duration

### P13: Multi-Agent Coordination
- Agent-to-agent: WS transport + `command.delegate { agentId, task }`
- Shared EventLog: `SqliteEventLog` with `agent_id` column — multiple agents write, all read
- Discovery: mDNS/bonjour for LAN; config for static peers
- Consensus: Raft-lite for shared memory writes (future)

### P14: Documentation + DX
- TypeDoc → `docs/api/`
- `ARCHITECTURE.md` (this plan + ADRs)
- ADRs in `docs/adr/NNN-title.md`
- Guides: `docs/guides/` (getting started, plugins, deployment, debugging)
- CLI help: `senars --help` + `senars <cmd> --help` (generated from command defs)

### P15: Build + Release Pipeline
- Bins: `esbuild` → single-file ESM bundles in `dist/bin/`
- UI: `vite build` → `dist/ui/`
- Packages: `tsc --project tsconfig.build.json` → `dist/` with `.d.ts` + `.js`
- Versioning: SemVer via `changesets` (monorepo-aware)
- Changelog: auto-generated from changesets
- Publish: `pnpm publish -r --access public` (GitHub Actions on tag)
- Docker: `Dockerfile` per bin + UI (multi-arch)

---

## 3. Execution Order (Dependency-Aware)

| Phase | Steps | Verification |
|-------|-------|--------------|
| **0. Unblock Bins** (Week 1) | Fix `bot-ai.ts`, `repl.ts`, `mcp-server.ts` | `pnpm -r typecheck` + bins run without error |
| **1. Memory + Loop** (Week 2) | Flesh `consolidate()`, wire cortex+parser in `createAgent`, verify `chat()` end-to-end | `vitest run tests/unit/agent` + manual `senars repl` |
| **2. UI Renderers + Lenses** (Week 2) | `GraphRenderer` abstraction, 2 impls, lens wiring | `vitest run tests/e2e/agent-smoke.test.ts` |
| **3. Plugin Transports** (Week 3) | Move connections to `@senars/plugin-*`, wire via `PluginLoader` | `bot-ai.ts` loads IRC/WS/HTTP/MCP via plugins |
| **4. REPL + Sessions** (Week 3) | History, completion, colors; session persist/restore | Manual REPL test + `repl.ts` works |
| **5. Config + Observability** (Week 4) | Zod config, presets, pino logger, Prometheus metrics | `senars --config` works; `/metrics` exposes data |
| **6. Resilience + Security** (Week 4) | Error hierarchy, retry/circuit-breaker, auth, rate-limits, sandbox | Integration tests for failure modes |
| **7. Multi-Agent + Docs** (Week 5) | Shared EventLog, delegate protocol, TypeDoc, ADRs, guides | `multi-agent-demo.ts` works; `docs/` populated |
| **8. Build + Release** (Week 5) | esbuild/vite, changesets, Docker, CI | `pnpm build` → `dist/`; `pnpm release` publishes |

**Hackathon demo ready after Phase 3** (text REPL via `senars repl` + live UI via `senars ui`).

---

## 4. What to Keep / Kill / Birth (Updated)

| Verdict | Component | Reason |
|---------|-----------|--------|
| ✅ KEEP | `EventLog` (InMemory, Sqlite) | Nervous system |
| ✅ KEEP | `ModelRunner`/`ChatService` | Cortex foundation |
| ✅ KEEP | `MettaCommandParser` (15 cmds) | Motor cortex |
| ✅ KEEP | `MettaPromptBuilder`, `MettaSkills` | Context + procedural memory |
| ✅ KEEP | `PolicyEngine` (core) | Prefrontal safety |
| ✅ KEEP | `AgentBridge` | Optic nerve |
| ✅ KEEP | `Plugin` interface | Immune contract |
| ✅ KEEP | `MessageRouter` + connections (io) | Senses (tests need them) |
| ✅ KEEP | `NAR` / `MeTTaRuntime` | Reasoning organs |
| ✅ KEEP | UI viewports + store + ws-client | Eyes |
| ❌ KILL | `core/src/backend/*` (stubs) | Dead after Step C |
| ❌ KILL | `core/src/capability/*` (stubs) | Dead after Step C |
| 🌱 BIRTH | `SkillRegistry` (from `MettaSkills`) | Tier 3 procedural memory |
| 🌱 BIRTH | `Config` system (Zod + presets) | Single source of truth |
| 🌱 BIRTH | `Observability` (Logger + Metrics) | Debuggability |
| 🌱 BIRTH | `Error` hierarchy + boundaries | Resilience |
| 🌱 BIRTH | `Auth` + `RateLimiter` integration | Security |
| 🌱 BIRTH | `Health` checks + lifecycle hooks | Operability |
| 🌱 BIRTH | `Sandbox` for tool execution | Safety |
| 🌱 BIRTH | `McpTransport` + `IrcTransport` plugins | Protocol bridges |
| 🌱 BIRTH | `GraphRenderer` + 2 impls | One mind, many eyes |
| 🌱 BIRTH | `Session` persist/restore | Hippocampus survives restart |

---

## 5. Success Criteria (Updated)

| Metric | Target |
|--------|--------|
| All 7 bins run | `senars`, `bot-ai`, `multi-agent`, `multi-agent-demo`, `repl`, `mcp-server` |
| TypeScript | 0 errors, 5/5 packages |
| Tests | 1017+ green (unit + integration + e2e) |
| Memory tiers | 5 living tiers, replayable, persistent |
| Tools | 15/15 commands implemented, feedback-weighted |
| UI | Real-time WS window: `cognitive.delta`, `config.schema`, `lens.*`, `focus.*`, Narsese→graph |
| Config | Unified, validated, preset-able, schema over WS |
| Observability | Structured logs + Prometheus metrics + correlation IDs |
| Security | Auth + rate limits + sandbox on all tools |
| Sessions | Persisted, restorable, multi-device sync |
| Multi-agent | Protocol + shared EventLog |
| Dead code | 0 lines |
| Documentation | TypeDoc + ARCHITECTURE.md + 5 guides |

---

## 6. Philosophy (Unchanged)

> **A cognitive agent is not a class. It is a process.**
>
> It perceives. It remembers. It reasons. It speaks. It acts. It learns. It shows itself.
>
> `Kernel` was a spine that never moved. `Backend` was a limb that never reached. `VisualizationBackend` was an eye that never opened. We have given them a body — one `Agent`, one `cycle()`, one `EventLog` as the nervous system, memory that breathes, engines that reason, a cortex that speaks, tools that grow, a UI that *sees*.
>
> **Now we harden it for production.**