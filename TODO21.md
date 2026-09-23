# TODO21: Unified CLI Bot — `pnpm run bot` as Primary Interactive Interface

## Implementation Status (2026-09-23)

**Done:**
- `src/bin/bot.ts` (new) — CLI-first entry: `CLIConnection` always on, `ConnectionManager`
  with all 5 factories registered lazy, core REPL via `buildCommands` + 40 extra CLI commands
  (connect/disconnect/connections, profile, skills, consolidate/memory-*, lm-*, routing,
  circuit-breakers, systemone/manifold/calibrate/distill/selftune, doctor/health/routing-log/
  spend/gates, webui, arcade, multiagent, config-*, auth-*).
- Non-interactive aliases: `--status/--doctor/--tune/--arcade/--help` delegate to existing modules.
- CLI-only default: `ConfigFromEnv` IRC/WS now `=== 'true'` opt-in; `readWSConfig` default false;
  `BOT_CLI_ONLY=true` force flag; `.env.example` documents opt-ins.
- LM: `.env.example` defaults `LM_PROVIDER=llamacpp-embedded` + `LM_LLAMACPP_GPU` flag;
  startup logs `LLM: llamacpp-embedded (gpu=auto:<backends>)` via cheap `getLlamaGpuTypes` probe.
  Code fallback in `defaultLocalProvider()` unchanged (embedded → transformers) — see note below.
- Scripts: `bot` → `bot.ts`; `repl`/`status`/`doctor`/`tune`/`arcade` are `bot -- --*` aliases;
  `bot:irc|ws|http|mcp` convenience scripts; `bin.senars` → `dist/bin/bot.js`.
- Deleted `src/bin/bot-ai.ts`, `src/bin/repl.ts` (fully subsumed).
- Tests: `tests/e2e/bot-cli.test.ts` (3 tests: CLI-only boot+help+quit, lm/health/doctor/config,
  `ENABLE_WS=true` auto-connect) — green. `bin-lifecycle` labels `bot-ai`→`bot`;
  D19 surface test now asserts on `bot.ts`.
- Verified live: `tsc` clean, `biome` clean, piped-stdin boot/`.help`/`.connections`/`.quit`
  exit 0, `.connect ws` + `.connections` listing, `ENABLE_WS=true` auto-connect.

**Deliberately deferred (improvement opportunities):**
1. `status.ts`/`doctor.ts`/`tune.ts`/`multi-agent.ts` kept as delegated modules (`--status` etc.
   dynamic-import them). Full deletion per §Phase 6 wants them inlined into `src/bin/lib/`
   (status→`lib/status-report.ts`, doctor→`lib/doctor-report.ts` shared by `.doctor`).
2. `src/cli/commands.ts` kept as the core-command builder imported by `bot.ts` (plan suggested
   merging; the shared-builder shape is DRYer — `bot.ts` owns only the extra groups).
3. `.disconnect <id>` by timestamped id is awkward — add stable ids or `.disconnect ws` (first
   match by type). Same for `.connections <id>` detail (works, just needs the full id).
4. `defaultLocalProvider()` still falls back to `transformers` (never-default would break
   `tests/cognitive/lm-config.test.ts` + `todo16c-model-override.test.ts`, which assert the
   transformers default). True removal needs those tests migrated to `mock` first.
5. `.benchmarks` serves NAR stats only (no per-derivation costs wired); `.routing-set`,
   `.lm-rule-enable/disable`, `.skill-edit`, `.memory-clear`, `.config-reset` from the plan
   are not yet implemented — `.help` lists the implemented set (no phantom commands).
6. `.webui stop` closes only UI handles started from this session; pre-existing servers unaffected.
7. `README.md` Bot section still documents old auto-connect behavior — needs rewrite to CLI-first.

## Problem Statement

Current `pnpm run bot` (`src/bin/bot-ai.ts`) auto-connects to IRC (irc.libera.chat#senars) and WebSocket (port 8765) by default. User wants:
- **CLI-only mode by default** — no auto IRC/WS/HTTP connections
- **REPL merged in** — full command set available interactively
- **IRC/WS/HTTP/MCP enabled via commands** — configure at runtime
- **llamacpp-embedded as default provider** — fastest local LM (CUDA/metal/vulkan)
- **No transformers.js** — suboptimal, remove from default path
- **Complete codebase capability exposure** — every bin, every feature, every diagnostic accessible via CLI

---

## Architecture

```
pnpm run bot
    │
    ├──► Single entry: src/bin/bot.ts (replaces bot-ai.ts + repl.ts + status.ts + doctor.ts + multi-agent.ts + tune.ts)
    │
    ├──► CLIConnection (always) — primary interface, readline + tab completion
    │
    ├──► ConnectionManager (lazy) — IRC/WS/HTTP/MCP factories registered
    │       │
    │       └──► Started on-demand via CLI commands:
    │               .connect irc [config]
    │               .connect ws [port]
    │               .connect http [port] [--api-key]
    │               .connect mcp [stdio|http|sse] [--approval]
    │
    ├──► CommandRegistry — ALL capabilities:
    │       ├── Connection mgmt: connect, disconnect, connections
    │       ├── Core REPL: help, quit, stats, beliefs, concepts, attention, episodes, know, recall, sessions, session, throttle, tier, status, clear
    │       ├── Profile: profile, personality, joinmsg, capabilities
    │       ├── Skills: skills, skill-enable, skill-disable, skill-add, skill-remove
    │       ├── Memory: consolidate, memory-stats, memory-export, memory-import
    │       ├── LM: lm-config, lm-provider, lm-model, lm-rules, routing, circuit-breakers
    │       ├── System One: systemone, manifold, calibrate, distill, selftune
    │       ├── Diagnostics: doctor, benchmarks, health, routing-log, spend
    │       ├── Web UI: webui (start/stop)
    │       ├── Arcade: arcade (snake/tetris/2048/tictactoe/gridworld/bandit)
    │       ├── Multi-agent: multiagent (enable/disable)
    │       ├── Config: config-show, config-set, config-save, config-reload
    │       └── Auth: auth-add, auth-remove, auth-list
    │
    └──► LM Service — defaults to llamacpp-embedded (CUDA if available)
```

---

## Implementation Plan

### Phase 1: New Unified Entry Point (`src/bin/bot.ts`)

**1.1 Create `src/bin/bot.ts`** (replaces `bot-ai.ts`, `repl.ts`, `status.ts`, `doctor.ts`, `multi-agent.ts`, `tune.ts`)
- Always create `CLIConnection` as primary interface
- Register `ConnectionManager` with all factories (IRC, WS, HTTP, MCP) but **don't auto-connect**
- Populate `CommandRegistry` with **ALL** command groups (see Phase 2-5)

**1.2 Connection Commands**
```typescript
// .connect irc [server] [port] [nick] [channels...] [--tls] [--no-tls]
// .connect ws [port] [--greeting "msg"]
// .connect http [port] [--api-key <key>] [--cors]
// .connect mcp [stdio|http|sse] [--approval] [--api-key <key>] [--rate-limit <n>]
// .disconnect <connection-id> [--force]
// .connections — list all (status, config, uptime, message counts)
// .connections <id> — show details for one connection
```

**1.3 Default LM Provider Resolution** (env wins, no transformers.js default)
```typescript
// Priority:
// 1. LM_PROVIDER=llamacpp-embedded (default if model exists at LM_LLAMACPP_MODEL)
// 2. LM_PROVIDER=llamacpp (external llama-server at LM_LLAMACPP_HOST)
// 3. LM_PROVIDER=mock (tests only)
// 4. LM_PROVIDER=openai-compatible (Ollama, vLLM, etc - explicit opt-in)
// NEVER default to transformers.js
```

---

### Phase 2: LM Provider Hardening

**2.1 Ensure llamacpp-embedded is default when available**
- `nar/src/lm/env-config.ts`: Default to `llamacpp-embedded` if `embeddedLlamaConfigured()`
- Add `LM_PROVIDER=llamacpp-embedded` to `.env.example` as default
- Document GPU flags: `LM_LLAMACPP_GPU=cuda|metal|vulkan|auto`, `LM_LLAMACPP_GPU_LAYERS=max`

**2.2 Remove transformers.js from default path**
- Keep as optional fallback only (explicit opt-in via `LM_PROVIDER=transformers`)
- Remove `@browser-ai/transformers-js` from default install if not used elsewhere

**2.3 Validate CUDA/Metal/Vulkan detection**
- `nar/src/lm/providers/embedded-llamacpp.ts`: Ensure `gpu: 'auto'` detects CUDA correctly
- Add startup log: `LLM: llamacpp-embedded (CUDA: 32 layers)` or similar

---

### Phase 3: Config & Env Cleanup

**3.1 Update `io/src/bridge/ConfigFromEnv.ts`** — All connections **opt-in only**
```typescript
// Change defaults:
ENABLE_IRC  → 'false' (was implicit true)
ENABLE_WS   → 'false' (was implicit true)
ENABLE_HTTP → 'false' (unchanged)
ENABLE_MCP  → 'false' (unchanged)
```

**3.2 Add CLI-specific env vars**
- `BOT_CLI_ONLY=true` — skip all auto-connections (legacy compat)
- Default behavior becomes CLI-only; env vars only for headless/server mode

---

### Phase 4: Package.json Scripts

**4.1 Update `package.json`**
```json
"scripts": {
  "bot": "NODE_NO_WARNINGS=1 tsx --env-file=.env src/bin/bot.ts",
  "repl": "pnpm run bot",                    // alias, deprecated
  "status": "pnpm run bot -- --status",      // alias, runs doctor --json internally
  "doctor": "pnpm run bot -- --doctor",      // alias
  "bot:irc": "ENABLE_IRC=true pnpm run bot", // convenience
  "bot:ws": "ENABLE_WS=true pnpm run bot",   // convenience
  "bot:http": "ENABLE_HTTP=true pnpm run bot",
  "bot:mcp": "ENABLE_MCP=true pnpm run bot",
  "tune": "pnpm run bot -- --tune",          // alias
  "arcade": "pnpm run bot -- --arcade",      // alias
}
```

**4.2 Update `bin` field**
```json
"bin": {
  "senars": "./dist/bin/bot.js",
  "senars-mcp": "./dist/bin/mcp-server.js"
}
```

---

### Phase 5: Comprehensive CLI Commands

#### 5.1 Core REPL (from repl.ts + cli/commands.ts)
```bash
.help                    # Show all commands (categorized)
.quit                    # Exit
.stats                   # NAR + LM statistics
.beliefs                 # List NAR beliefs with truth values
.concepts                # List NAR concepts with priority
.attention               # Attention focus report
.episodes [n]            # Recent episodes (default 10)
.know [key] [value]      # Get/set/list knowledge
.recall [query]          # Search episodic memory
.sessions                # List saved sessions
.session [name]          # Switch/create session
.throttle [0-100]        # Get/set reasoning throttle
.tier [q|f|s]            # Get/set model tier (quality/fast/structured)
.status                  # Agent + NAR + LM status
.clear                   # Clear screen
```

#### 5.2 Connection Management
```bash
.connect irc [server] [port] [nick] [#chan1,#chan2...] [--tls|--no-tls] [--password <pwd>]
.connect ws [port] [--greeting "msg"]
.connect http [port] [--api-key <key>] [--cors]
.connect mcp [stdio|http|sse] [--approval] [--api-key <key>] [--rate-limit <n>]
.disconnect <id> [--force]
.connections             # List all with status
.connections <id>        # Detail view
```

#### 5.3 Profile & Personality
```bash
.profile                 # Show current profile
.profile name <name>     # Set bot name
.profile personality <text>  # Set personality
.profile joinmsg <text>  # Set join message
.profile tier <q|f|s>    # Set default narrate tier
.profile transparency <none|summary|full>
.profile caps <cap1,cap2>  # Set capabilities list
.profile guide <text>    # Set interaction guide
```

#### 5.4 Skills Management
```bash
.skills                  # List all skills (enabled/disabled)
.skill-enable <id>       # Enable skill
.skill-disable <id>      # Disable skill
.skill-add <id> <description> <instructions>  # Add new skill
.skill-remove <id>       # Remove skill
.skill-edit <id> [field] [value]  # Edit skill
```

#### 5.5 Memory Management
```bash
.consolidate [limit] [relevance] [dedupe]  # Run memory consolidation
.memory-stats            # Episodic memory stats
.memory-export <path>    # Export episodes to JSONL
.memory-import <path>    # Import episodes from JSONL
.memory-clear            # Clear episodic memory (with confirmation)
```

#### 5.6 LM Configuration
```bash
.lm-config               # Show resolved LM config (provider, model, tiers, baseURL)
.lm-provider <name>      # Switch provider (llamacpp-embedded|llamacpp|openai-compatible|mock)
.lm-model <task> <model> # Set model for tier (quality/fast/structured/compact)
.lm-rules                # List LM rules
.lm-rule-enable <id>     # Enable LM rule
.lm-rule-disable <id>    # Disable LM rule
.routing                 # Show routing matrix
.routing-set <task> <chain...>  # Set routing chain for task
.routing-offline <ladder...>    # Set offline failsafe ladder
.circuit-breakers        # Show all circuit breaker states
.circuit-reset <provider> # Reset circuit breaker
```

#### 5.7 System One (Self-Improving Reasoning)
```bash
.systemone               # Show System One status
.systemone on|off        # Enable/disable
.manifold                # Show manifold health + heads (ECE, abstain thresholds)
.calibrate [head]        # Run calibration (all heads or specific)
.distill                 # Run distillation step
.selftune                # Run self-tune demo
.systemone-dataset       # Show dataset stats
.systemone-lock          # Show calibration lock status
```

#### 5.8 Diagnostics & Debugging
```bash
.doctor [--json] [--degradation] [--routing-log] [--benchmarks] [--deep]
.health                  # Quick health check (gates + LM reachable)
.benchmarks              # Show top-N costly derivations
.routing-log             # Show routing telemetry buffer
.spend                   # Show LM spend (calls, tokens, cost)
.gates                   # Show all gate states
```

#### 5.9 Web UI
```bash
.webui [port]            # Start web UI (default 3001)
.webui stop              # Stop web UI
```

#### 5.10 Arcade / Benchmarks
```bash
.arcade [games] [arms] [episodes] [seed]  # Run arcade games
# games: snake,tetris,2048,tictactoe,gridworld,bandit
# arms: heuristic,random,manifold,lm
```

#### 5.11 Multi-Agent Mode
```bash
.multiagent on|off       # Enable/disable MeTTa reasoning
.multiagent status       # Show MeTTa status
```

#### 5.12 Config Persistence
```bash
.config-show             # Show effective config (merged env + file)
.config-set <path> <value>  # Set config value (dot notation: bot.skills.0.enabled=true)
.config-save             # Save current config to file (senars.config.json)
.config-reload           # Reload config from file
.config-reset            # Reset to defaults
```

#### 5.13 Auth Management
```bash
.auth-list               # List auth secrets per connection
.auth-add <conn-id> <secret>  # Add secret for connection
.auth-remove <conn-id>   # Remove secret
```

---

### Phase 6: Deprecate & Remove Old Files

**6.1 Delete**
- `src/bin/bot-ai.ts`
- `src/bin/repl.ts`
- `src/bin/status.ts` → merged into `.status` + `.doctor`
- `src/bin/doctor.ts` → merged into `.doctor`
- `src/bin/multi-agent.ts` → merged into `.multiagent`
- `src/bin/tune.ts` → merged into `.selftune`
- `src/cli/commands.ts` → merge into `bot.ts` or new `src/bin/cli-commands.ts`

**6.2 Update** any imports referencing deleted files

---

### Phase 7: Testing & Verification

**7.1 Manual verification checklist**
- [ ] `pnpm run bot` → starts CLI prompt `senars> `, no network connections
- [ ] `.help` shows all commands including `.connect`
- [ ] `.connect irc irc.libera.chat 6697 senars-bot #senars` → connects IRC
- [ ] `.connect ws 8765` → starts WS server
- [ ] `.connect http 3000 --api-key test` → starts HTTP server
- [ ] `.connect mcp stdio --approval` → starts MCP stdio
- [ ] `.connections` lists all with status
- [ ] `.disconnect irc-main` → cleanly closes IRC
- [ ] LM defaults to llamacpp-embedded (check log: `LLM: llamacpp-embedded ...`)
- [ ] GPU detection works: `LM_LLAMACPP_GPU=cuda` shows CUDA layers
- [ ] `.tier quality|fast|structured` works
- [ ] `.stats`, `.beliefs`, `.episodes`, `.know`, `.recall` all work
- [ ] `.profile`, `.skills`, `.consolidate`, `.lm-config`, `.routing` work
- [ ] `.doctor --json` outputs valid JSON
- [ ] `.webui` starts web UI on port 3001
- [ ] `.arcade` runs games
- [ ] `.multiagent on` enables MeTTa
- [ ] `.config-save` writes senars.config.json
- [ ] Graceful shutdown on `.quit` or Ctrl+C cleans up all connections

**7.2 Automated tests**
- Add test: `tests/e2e/bot-cli.test.ts` — spawns bot, sends commands, asserts responses
- Test LM provider resolution with various env combinations
- Test connection lifecycle (connect/disconnect/reconnect)
- Test config persistence round-trip

---

## File Changes Summary

| File | Action |
|------|--------|
| `src/bin/bot.ts` | **NEW** — unified entry point (replaces 6 files) |
| `src/bin/bot-ai.ts` | **DELETE** |
| `src/bin/repl.ts` | **DELETE** |
| `src/bin/status.ts` | **DELETE** |
| `src/bin/doctor.ts` | **DELETE** |
| `src/bin/multi-agent.ts` | **DELETE** |
| `src/bin/tune.ts` | **DELETE** |
| `src/cli/commands.ts` | **DELETE** (merge into bot.ts) |
| `io/src/bridge/ConfigFromEnv.ts` | **MODIFY** — all connections opt-in |
| `nar/src/lm/env-config.ts` | **MODIFY** — llamacpp-embedded default |
| `package.json` | **MODIFY** — scripts, bin |
| `.env.example` | **MODIFY** — document defaults |
| `tests/e2e/bot-cli.test.ts` | **NEW** — e2e test |

---

## Acceptance Criteria

1. **`pnpm run bot`** starts interactive CLI immediately (`senars> ` prompt)
2. **Zero auto-connections** — no IRC, WS, HTTP, MCP unless explicitly requested
3. **All REPL commands work** — `.help`, `.stats`, `.beliefs`, `.know`, `.recall`, `.tier`, `.status`, etc.
4. **Connection management via CLI** — `.connect`, `.disconnect`, `.connections`
5. **llamacpp-embedded default** — CUDA/Metal/Vulkan auto-detected, logged
6. **No transformers.js** in default path — only explicit opt-in
7. **Graceful shutdown** — `.quit` or Ctrl+C cleans up all connections
8. **Back-compat scripts** — `pnpm run bot:irc`, `bot:ws`, `bot:http`, `bot:mcp` work for server mode
9. **Complete capability exposure** — every feature from status, doctor, multi-agent, tune, arcade accessible via CLI commands
10. **Config persistence** — runtime changes savable to config file

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing server deployments | Provide `bot:irc`, `bot:ws`, `bot:http`, `bot:mcp` convenience scripts |
| LM provider resolution regression | Add e2e test matrix for all provider/env combos |
| Command registry conflicts | Namespace connection commands (`.connect irc` vs `.irc`) |
| GPU detection failure | Fallback to CPU with clear log warning |
| Command bloat | Categorize `.help` output; use subcommands (`.config show` vs `.config-set`) |
| Migration of existing configs | `config-reload` and `config-save` handle migration; `configVersion` in schema |

---

## Timeline Estimate

- Phase 1 (core entry + connection commands): 3-4 hours
- Phase 2 (LM hardening): 1 hour
- Phase 3-4 (config/scripts): 30 min
- Phase 5 (all command groups): 4-5 hours
- Phase 6 (cleanup): 30 min
- Phase 7 (testing): 2-3 hours
- **Total: ~11-14 hours**

---

## Dependency Graph

```
bot.ts (entry)
    ├── CLIConnection (always)
    ├── ConnectionManager (lazy)
    │   ├── IRCConnection
    │   ├── WSConnection
    │   ├── HTTPConnection
    │   └── MCPConnection
    ├── CommandRegistry
    │   ├── coreCommands (help, quit, clear)
    │   ├── narCommands (stats, beliefs, concepts, attention)
    │   ├── memoryCommands (episodes, know, recall, sessions, session, consolidate)
    │   ├── configCommands (config-show, config-set, config-save, config-reload, profile, skills)
    │   ├── lmCommands (lm-config, lm-provider, lm-model, lm-rules, routing, circuit-breakers)
    │   ├── systemOneCommands (systemone, manifold, calibrate, distill, selftune)
    │   ├── diagnosticCommands (doctor, health, benchmarks, routing-log, spend, gates)
    │   ├── webUICommands (webui)
    │   ├── arcadeCommands (arcade)
    │   ├── multiAgentCommands (multiagent)
    │   ├── authCommands (auth-list, auth-add, auth-remove)
    │   └── connectionCommands (connect, disconnect, connections)
    └── LM Service (llamacpp-embedded default)
```

---

## Notes for Implementation

1. **Command Registration Pattern**: Use the existing `cmd(name, desc, execute)` factory from `cli/commands.ts` for consistency
2. **Tab Completion**: `CLIConnection` already supports completer — extend for all new commands
3. **Async Commands**: All command executors can be `async` — `CLIConnection` handles promises
4. **Error Handling**: Use existing `errMsg` helper + try/catch in command executors
5. **Output Formatting**: Reuse `formatCombinedStats`, `formatBeliefs`, etc. from `cli/stats-format.ts`
6. **Config Persistence**: Use `loadConfig()` + write to `senars.config.json` via `fs.writeFile`
7. **Web UI**: Import `startAgentUI` from `ui/src/server/index.ts` dynamically (lazy load)
8. **Arcade**: Reuse `scripts/arcade.ts` logic, expose as command
9. **Multi-Agent**: Reuse `src/bin/lib/multi-agent-runner.ts`
10. **Self-Tune**: Reuse `scripts/self-tune-demo.ts` logic