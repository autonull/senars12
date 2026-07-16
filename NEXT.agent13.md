# NEXT.agent13.md — Complete the Cognitive Organism

> **Context:** Steps A–F from NEXT.agent12.md are largely complete. All 1017 tests pass. TypeScript compiles clean. The organism is alive — `Agent` owns the cognitive cycle, engines are registered, cortex synthesizes, tools execute, UI streams WS. Remaining: wire the last organs, fix 3 bins, add production essentials.

---

## 1. Current State

| Area | Status |
|------|--------|
| Core Agent (`Agent`, `cycle()`) | ✅ Done |
| Engines (`NAREngine`, `MettaEngine`) | ✅ Done |
| Cortex (`LLMCortex` + `ModelRunner`) | ✅ Done |
| Tools (13/15 builtin) | 🟡 Partial |
| Memory (5-tier scaffold) | 🟡 Partial — `consolidate()` is a stub |
| UI Server (`startAgentUI`) | ✅ Done |
| UI Client (viewports, store, ws-client) | 🟡 Partial — needs `GraphRenderer` + lens wiring |
| Plugin System (`PluginLoader`, `Plugin`) | ✅ Done |
| Bins (7 total) | 🟡 2/7 fixed — `bot-ai.ts`, `repl.ts`, `mcp-server.ts` broken |
| Tests / TypeScript | ✅ 1017 pass / 5 packages clean |

---

## 2. Remaining Work — Ordered by Dependency

### P0 — Fix Broken Bins (unblocks all CLI usage)
| Bin | Fix |
|-----|-----|
| `bot-ai.ts` | Rewrite to use `createAgent` + `ConnectionManager` (pattern from `multi-agent.ts`). Drop old `Agent` class, `registerBackend`, `Kernel` imports. |
| `repl.ts` | Wire real `LLMCortex` + `LMService`; remove `autonomyEngine` stub references; keep REPL commands working. |
| `mcp-server.ts` | Use `@senars/nar/agent` exports only; fix `SeNARSMCPServer`/`EnhancedMCPAdapter` imports from `@senars/api`; drop `createNAR` from `../../nar/src`. |

**Verify:** `pnpm -r typecheck` + each bin runs without error.

---

### P1 — Complete the Cognitive Loop in `createAgent`
The loop exists in `Agent.cycle()` but `createAgent` doesn't wire the cortex/parser.

1. **Instantiate `LLMCortex(ModelRunner, MettaPromptBuilder)`** inside `createAgent` when `lmService` provided.
2. **Set `MettaCommandParser` as default `#commandParser`** on `Agent`.
3. **Ensure `Agent.cycle()` calls `cortex.synthesize()`** when cortex exists (it does — just not injected).
4. **Verify both paths:** Narsese → NAR → `+ (cat --> animal).` and NL → LM → tools → response.

**Verify:** `vitest run tests/unit/agent` + manual `senars repl` chat.

---

### P2 — Memory: Flesh Out Tier 3–4 + Consolidation
| Tier | Current | Needed |
|------|---------|--------|
| 0 Working | ✅ Ring buffer | — |
| 1 Episodic | ✅ `EventLog` replay | — |
| 2 Semantic | ✅ Engine `query()` delegation | — |
| 3 Procedural | 🟡 `ToolRegistry` feedback only | Promote `MettaSkills` → `SkillRegistry` (feedback-weighted tool selection) |
| 4 LTM | 🟡 Engine `persist()` stubs | Wire `SqliteEventLog` + MeTTa/NAR persistence; `load()` on startup |

**Actions:**
- Create `core/src/motor/SkillRegistry.ts` from `MettaSkills` — tracks success rates, enables tool selection by confidence.
- Implement `MemoryService.consolidate(cid)`: promote high-salience working→episodic, successful tool patterns→procedural (via `SkillRegistry`), engine state→LTM (via `persist()`).
- Wire `SqliteEventLog` in `createAgent` when `config.persistence` set; auto-load on `agent.start()`.

**Verify:** Restart agent → beliefs/tools survive; `agent.recall()` works across sessions.

---

### P3 — UI Client: GraphRenderer + Lenses
1. **Extract `GraphRenderer` interface** + `CytoscapeRenderer` + `SpaceGraphRenderer` from `ui/src/client/core/`.
2. **Refactor `graph-viewport.ts` / `spacegraph-viewport.ts`** to thin adapters (~80 lines each).
3. **Wire 4 built-in lenses** via `AgentBridge` → WS: `belief`, `goal`, `contradiction`, `temporal`.
   - `lens.list` → `[{id, label, description}]`
   - `lens.fields` → field descriptors per lens
   - `lens.delta` / `focus.delta` → UI updates
4. **Ensure `focus.set {term}`** centers graph on term via `AgentBridge.projectFromMessage()`.

**Verify:** `vitest run tests/e2e/agent-smoke.test.ts` — Narsese over WS grows graph, lens/focus work.

---

### P4 — Configuration System (Single Source of Truth)
Create `core/src/config/Config.ts`:
- **Zod schema** for `AgentConfig`: `{ name, nar?, metta?, llm?, memory, senses, plugins, policy, ui }`
- **CLI**: `senars --config file.json` / `SENARS_CONFIG` env / `createAgent({config})`
- **Presets**: `createAgentPreset('chat'|'reasoning'|'autonomous'|'irc-bot')` → `Partial<AgentConfig>`
- **WS**: `config.schema` message for UI (generated from Zod)

**Verify:** `senars --config` works; UI renders config panel from schema.

---

### P5 — Observability (Logs + Metrics)
| Component | Purpose |
|-----------|---------|
| `core/src/observability/Logger.ts` | Pino-based; child loggers per component (`agent.nar`, `transport.ws`, `tool.shell`, …) |
| `core/src/observability/Metrics.ts` | Counters/histograms: cycle latency, tool exec time, LLM tokens, memory tier sizes, WS throughput |
| HTTP `/metrics` | Prometheus exposition (via HTTP transport) |
| JSONL file rotation | Structured logs to `~/.senars/logs/` |
| Correlation IDs | Every `cycle()` gets `cid` propagated through log/memory/bridge/WS |

**Verify:** `senars repl` shows structured logs; `curl /metrics` returns Prometheus format.

---

### P6 — Resilience + Security (Essential Only)
| Feature | Implementation |
|---------|----------------|
| **Typed errors** | `core/src/errors/AgentError.ts` — `EngineError`, `ToolError`, `PolicyViolation`, `ConfigError`, `TransportError` |
| **Error projection** | `AgentBridge` → `chat.agent.error` WS message (UI shows toast) |
| **Retry policy** | Per-tool config: exponential backoff, max attempts (in `PolicyConfig`) |
| **Circuit breaker** | Per-engine: stop after N failures, auto-recover after timeout |
| **Graceful degradation** | LLM fails → symbolic-only; NAR fails → LM-only |
| **Auth** | Transports accept `auth: {type: 'none'|'jwt'|'apikey'}`; dev mode = none; prod = `SENARS_AUTH_SECRET` |
| **Rate limiting** | Token bucket per connection in `ConnectionManager`; per-tool quota in `PolicyConfig` |
| **Tool sandbox** | `node:vm` with limited globals (no `vm2` dep); allowlist paths/commands from `PolicyConfig` |

**No:** mDNS, Raft, complex consensus — not needed for single-process agent.

---

### P7 — Sessions + REPL Polish
| Feature | Implementation |
|---------|----------------|
| **Session persist** | `JsonlSessionManager` → `~/.senars/sessions/{id}.jsonl` |
| **Session restore** | `createAgent({sessionId})` → loads session, replays EventLog to rebuild memory |
| **WS replay** | `command.replay {from, to}` → streams `cognitive.delta` for range |
| **REPL history** | `~/.senars/repl_history` (persisted, Ctrl+R search) |
| **REPL completion** | Tab: Narsese terms, tool names, lens names |
| **REPL colors** | Syntax highlight Narsese, tool output, errors |
| **REPL multiline** | `\` continuation, Ctrl+Enter submit |
| **REPL meta-commands** | `.help`, `.memory`, `.engines`, `.config`, `.quit` |

---

### P8 — MCP + IRC as Plugins (Not Core)
- Move `WSConnection`, `CLIConnection`, `HTTPConnection`, `IRCConnection`, `MCPConnection` from `@senars/io` → `@senars/plugin-*` (one pkg each).
- Each exports `AgentPlugin` registering its transport factory.
- `createAgent` loads plugins via `PluginLoader` → `ConnectionManager` mounts them.
- **Keep `@senars/io`** for `MessageRouter`, `Connection`, `AuthManager`, `CommandRegistry` (tests depend on these).

---

### P9 — Build + Release (Minimal, Standard)
| Target | Tool |
|--------|------|
| Bins | `esbuild` → single-file ESM in `dist/bin/` |
| UI | `vite build` → `dist/ui/` |
| Packages | `tsc --project tsconfig.build.json` → `dist/` with `.d.ts` + `.js` |
| Versioning | `changesets` (monorepo-aware) |
| Changelog | Auto-generated from changesets |
| Publish | `pnpm publish -r --access public` (GitHub Actions on tag) |
| Docker | One `Dockerfile` per bin + UI (multi-arch) |

---

### P10 — Documentation (Just What's Needed)
- **TypeDoc** → `docs/api/` (auto from JSDoc)
- **ARCHITECTURE.md** — this plan + key ADRs (inline, not separate files)
- **Guides** (3 max): Getting Started, Plugins, Deployment
- **CLI help** — `senars --help` + `senars <cmd> --help` (generated from command defs)

---

## 3. Execution Order (Dependency-Aware, Verifiable Per Step)

| Phase | Steps | Verification |
|-------|-------|--------------|
| **0** | Fix 3 bins (`bot-ai.ts`, `repl.ts`, `mcp-server.ts`) | `pnpm -r typecheck` + bins run |
| **1** | Wire cortex/parser in `createAgent`; verify NL + Narsese paths | `vitest run tests/unit/agent` + manual REPL |
| **2** | Memory Tier 3–4 + `consolidate()` + `SqliteEventLog` wire | Restart survives; `recall()` works |
| **3** | UI `GraphRenderer` + 4 lenses + focus | `vitest run tests/e2e/agent-smoke.test.ts` |
| **4** | Config system (Zod, presets, WS schema) | `senars --config` works; UI renders config |
| **5** | Observability (Logger, Metrics, `/metrics`, correlation IDs) | Logs structured; `/metrics` returns data |
| **6** | Resilience + Security (errors, retry, circuit-breaker, auth, rate-limit, sandbox) | Failure injection tests pass |
| **7** | Sessions + REPL polish | REPL history/completion/colors work; session restore |
| **8** | MCP/IRC plugins + PluginLoader wire | `bot-ai.ts` loads transports via plugins |
| **9** | Build + Release pipeline | `pnpm build` → `dist/`; `pnpm release` publishes |
| **10** | Documentation (TypeDoc, ARCHITECTURE.md, 3 guides) | `docs/` populated |

**Demo-ready after Phase 3** (text REPL + live UI).

---

## 4. Keep / Kill / Birth (Final)

| Verdict | Component |
|---------|-----------|
| ✅ KEEP | `EventLog` (InMemory, Sqlite), `ModelRunner`/`ChatService`, `MettaCommandParser` (15), `MettaPromptBuilder`, `MettaSkills`, `PolicyEngine`, `AgentBridge`, `Plugin`, `MessageRouter` + connections, `NAR`/`MeTTaRuntime`, UI viewports/store/ws-client |
| ❌ KILL | `core/src/backend/*` (stubs), `core/src/capability/*` (stubs) |
| 🌱 BIRTH | `SkillRegistry` (from `MettaSkills`), `Config` (Zod+presets), `Logger`/`Metrics`, `AgentError` hierarchy, `Auth`/`RateLimiter` integration, `Health` checks, `Sandbox` (vm), `GraphRenderer`+2 impls, `Session` persist/restore, MCP/IRC plugins |

---

## 5. Success Criteria

| Metric | Target |
|--------|--------|
| All 7 bins run | `senars`, `bot-ai`, `multi-agent`, `multi-agent-demo`, `repl`, `mcp-server` |
| TypeScript | 0 errors, 5/5 packages |
| Tests | 1017+ green |
| Memory | 5 tiers, replayable, persistent across restarts |
| Tools | 15/15 commands, feedback-weighted |
| UI | Real-time WS: `cognitive.delta`, `config.schema`, `lens.*`, `focus.*`, Narsese→graph |
| Config | Unified, validated, preset-able, schema over WS |
| Observability | Structured logs + Prometheus metrics + correlation IDs |
| Security | Auth + rate limits + sandbox on tools |
| Sessions | Persisted, restorable, WS replay |
| Dead code | 0 lines |
| Documentation | TypeDoc + ARCHITECTURE.md + 3 guides |

---

## 6. Philosophy

> **A cognitive agent is not a class. It is a process.**
>
> It perceives. It remembers. It reasons. It speaks. It acts. It learns. It shows itself.
>
> We have given it a body — one `Agent`, one `cycle()`, one `EventLog` as nervous system, memory that breathes, engines that reason, cortex that speaks, tools that grow, UI that *sees*.
>
> **Now we make it production-usable: configurable, observable, resilient, secure — without over-engineering.**