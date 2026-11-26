# TODO1: Entry Point Audit & CLI Restructure Plan

## Current State Audit

### Entry Points Inventory

| Command | Purpose | Issues |
|---------|---------|--------|
| `senars` | Main CLI with profiles, MCP, playground, schema gen | Kitchen sink; playground doesn't belong here |
| `bot` | Interactive REPL + `--status/--doctor/--tune/--arcade/--multiagent` | Grab bag of unrelated tools; arcade buried |
| `logic` | Standalone logic tool (prove/model/counterexample/check/convert) | Good separation, but not under main command |
| `mcp` | MCP server (stdio/SSE/HTTP) | Good separation, but not under main command |
| `edge-worker` | Zero-LM edge deployment | Good separation, but not under main command |
| `config-validate` | Config validation | Should be `senars config validate` |
| `wasm-bundle` | WASM bundle generator | Should be `senars build wasm` |
| `self-report` | Cognitive state summary | Diagnostic, belongs under `doctor` |
| `imagine` | Cognitive treadmill/scenario generation | Demo/analysis, belongs under `demo` |

### Problems Identified

1. **`bot` is a grab bag**: `--status`, `--doctor`, `--tune`, `--arcade`, `--multiagent` have nothing to do with interactive REPL
2. **`senars` has playground**: Interactive demo doesn't belong in main CLI
3. **`arcade` buried**: Demo capability hidden under `bot --arcade`
4. **`doctor` fragmented**: Health checks split across `bot --doctor`, `self-report`, `config-validate`, `status-report`
5. **No unified command vocabulary**: Users must know `pnpm run bot`, `pnpm exec tsx src/bin/imagine.ts`, etc.
6. **Demo capabilities scattered**: `playground` (senars), `arcade` (bot), `imagine` (standalone) — all demos
7. **Build tools exposed**: `wasm-bundle` should be under `build`

---

## Proposed CLI Structure (Granular Decomposition)

```
senars
├── run                 # Agent execution — primary user entry
│   ├── --profile <name>          # logic | coprocessor | agent | device | custom
│   ├── --mcp                     # Enable MCP server alongside agent
│   ├── --web-ui                  # Enable Web UI
│   ├── --config <path>           # Custom config file
│   ├── --session <id>            # Resume session
│   ├── --foreground              # Run in foreground (default)
│   ├── --background              # Daemonize
│   └── --watch                   # Hot-reload config/code
│
├── serve               # Long-running services
│   ├── mcp               # MCP server (stdio|SSE|HTTP)
│   │   ├── --transport stdio|sse|http
│   │   ├── --port <n>
│   │   ├── --host <addr>
│   │   ├── --api-key <key>
│   │   ├── --rate-limit <rpm>
│   │   └── --enable-tools <tool1,tool2>
│   ├── http              # REST API server
│   │   ├── --port <n>
│   │   ├── --host <addr>
│   │   └── --cors
│   ├── ws                # WebSocket server
│   │   ├── --port <n>
│   │   └── --path <path>
│   └── irc               # IRC bot
│       ├── --server <host>
│       ├── --port <n>
│       ├── --channel <#chan>
│       └── --nick <nick>
│
├── demo                # Unified demonstration subsystem
│   ├── playground        # Interactive REPL with tutorials
│   │   ├── --tutorial <name>       # guided: basics, logic, tools, self
│   │   ├── --scenario <file>       # load scenario
│   │   ├── --visualize             # live concept graph
│   │   ├── --explain               # narrate reasoning
│   │   ├── --profile <name>        # demo profile
│   │   └── --no-ai                 # logic-only mode
│   ├── arcade            # Cognitive games as stress tests
│   │   ├── --game <name>           # snake, tetris, 2048, tictactoe, bandit
│   │   ├── --arm <type>            # heuristic, random, manifold, lm, rl
│   │   ├── --episodes <n>
│   │   ├── --seeds <n>             # statistical runs
│   │   ├── --visualize             # live decision view
│   │   ├── --explain               # narrate agent "thoughts"
│   │   ├── --export <path>         # save results
│   │   └── --benchmark             # run standardized suite
│   ├── imagine           # Cognitive treadmill / scenario generation
│   │   ├── --profile <name>        # induction, transitive, contradiction_storm, overload, drift, narrative
│   │   ├── --seed <n>
│   │   ├── --multiplier <n>
│   │   ├── --steps <n>
│   │   ├── --count <n>
│   │   ├── --analyze               # architecture gap detection
│   │   ├── --live                  # real-time metrics dashboard
│   │   ├── --export <path>         # JSON results
│   │   └── --compare <path>        # compare with baseline
│   ├── benchmark         # Standardized performance benchmarks
│   │   ├── --suite <name>          # derivation, memory, throughput, latency
│   │   ├── --profile <name>
│   │   ├── --iterations <n>
│   │   ├── --output <path>
│   │   └── --compare <path>
│   ├── tutorial          # Guided learning paths
│   │   ├── list                    # available tutorials
│   │   ├── start <name>            # run tutorial
│   │   └── progress                # show completion
│   └── gallery           # Pre-recorded demonstrations
│       ├── list
│       ├── play <name>
│       └── export <name> <path>
│
├── doctor              # Health, diagnostics, optimization
│   ├── check             # Full health check (CI-friendly, exit codes)
│   │   ├── --config              # validate config
│   │   ├── --lm                  # probe LM connectivity
│   │   ├── --system-one          # check System One
│   │   ├── --persistence         # check state files
│   │   ├── --performance         # run quick benchmarks
│   │   ├── --json                # machine output
│   │   └── --fail-fast           # exit on first failure
│   ├── status            # System One runtime status (live)
│   │   ├── --watch               # continuous update
│   │   ├── --interval <ms>
│   │   ├── --json
│   │   └── --budget              # show AIKR budget
│   ├── report            # Cognitive state summary (detailed)
│   │   ├── --full                # include contradictions
│   │   ├── --drives
│   │   ├── --memory
│   │   ├── --rlfp
│   │   ├── --goals
│   │   ├── --beliefs
│   │   ├── --json
│   │   └── --output <path>
│   ├── tune              # Hyperparameter optimization
│   │   ├── --iterations <n>
│   │   ├── --baseline <ms>
│   │   ├── --threshold <pct>
│   │   ├── --output <path>
│   │   ├── --profile <name>
│   │   ├── --seed <n>
│   │   └── --resume <path>
│   ├── bench             # Derivation cost benchmarks
│   │   ├── --cycles <n>
│   │   ├── --limit <n>
│   │   ├── --json
│   │   └── --output <path>
│   ├── profile           # Profile system (CPU, memory, GC)
│   │   ├── --duration <s>
│   │   ├── --output <path>
│   │   └── --flamegraph
│   └── trace             # Distributed tracing
│       ├── --start
│       ├── --stop
│       ├── --output <path>
│       └── --format json|chrome
│
├── logic               # Logic tool (standalone, no agent)
│   ├── prove <program> <goal>      # SLD proof + certificate
│   ├── model <formula-json>        # Finite model
│   ├── counterexample <formula>    # Countermodel
│   ├── check <certificate>         # Verify certificate
│   ├── convert <input> --to <fmt>  # narsese|json|prolog|tptp
│   ├── parse <narsese>             # Parse to AST
│   ├── format <ast-json>           # Pretty print
│   └── validate <narsese>          # Syntax check
│
├── edge                # Edge/embedded deployment
│   ├── run               # Run edge worker
│   │   ├── --profile device|logic|coprocessor
│   │   ├── --web-ui
│   │   ├── --port <n>
│   │   └── --wasm-bundle <path>
│   ├── build             # Build edge artifacts
│   │   ├── wasm --output <path> --include <ids>
│   │   ├── docker --tag <tag> --profile <name>
│   │   └── binary --target <triple>
│   ├── test              # Test edge deployment
│   │   ├── --wasm-bundle <path>
│   │   └── --scenario <file>
│   └── deploy            # Deploy to target
│       ├── --target <name>
│       └── --config <path>
│
├── build               # Build & deployment
│   ├── wasm            # WASM bundle
│   │   ├── --output <path>
│   │   ├── --include <z3,clingo,minisat>
│   │   └── --minify
│   ├── docker          # Docker images
│   │   ├── --tag <tag>
│   │   ├── --profile <name>
│   │   ├── --target <stage>
│   │   └── --push
│   ├── binary          # Native binaries (via pkg/sea)
│   │   ├── --target <triple>
│   │   └── --output <path>
│   └── release         # Release automation
│       ├── --version <semver>
│       ├── --changelog
│       └── --dry-run
│
├── config              # Configuration management
│   ├── validate        # Validate config file
│   │   ├── --config <path>
│   │   ├── --json
│   │   └── --schema <version>
│   ├── show            # Show effective config (with env overrides)
│   │   ├── --config <path>
│   │   ├── --section <name>
│   │   ├── --json
│   │   └── --diff <other-config>
│   ├── init            # Generate starter config
│   │   ├── --profile <name>
│   │   ├── --output <path>
│   │   ├── --minimal
│   │   └── --interactive
│   ├── diff            # Compare two configs
│   │   ├── <config-a> <config-b>
│   │   └── --json
│   ├── set             # Set config value (CLI)
│   │   ├── <key> <value>
│   │   ├── --config <path>
│   │   └── --json
│   ├── get             # Get config value
│   │   ├── <key>
│   │   ├── --config <path>
│   │   └── --json
│   ├── schema          # Show config schema
│   │   ├── --version <v>
│   │   ├── --json
│   │   └── --markdown
│   └── migrate         # Migrate config between versions
│       ├── --from <version>
│       ├── --to <version>
│       ├── --config <path>
│       └── --dry-run
│
├── session             # Session & conversation management
│   ├── list            # List sessions
│   │   ├── --limit <n>
│   │   ├── --json
│   │   └── --format table|json
│   ├── show            # Show session details
│   │   ├── <session-id>
│   │   ├── --messages
│   │   ├── --metrics
│   │   └── --json
│   ├── resume          # Resume session
│   │   ├── <session-id>
│   │   ├── --fork      # create new branch
│   │   └── --replay    # replay from start
│   ├── delete          # Delete session(s)
│   │   ├── <session-id>...
│   │   ├── --all
│   │   ├── --before <date>
│   │   └── --force
│   ├── export          # Export session
│   │   ├── <session-id>
│   │   ├── --format json|markdown|html
│   │   ├── --output <path>
│   │   └── --include-metrics
│   ├── import          # Import session
│   │   ├── <path>
│   │   └── --merge
│   ├── snapshot        # Snapshot current state
│   │   ├── --label <name>
│   │   └── --output <path>
│   ├── replay          # Replay session with visualization
│   │   ├── <session-id>
│   │   ├── --speed <x>
│   │   ├── --pause-on <event>
│   │   └── --export <path>
│   └── stats           # Session statistics
│       ├── --since <date>
│       ├── --json
│       └── --output <path>
│
├── memory              # Memory & knowledge management
│   ├── concepts        # Concept inspection
│   │   ├── list --limit <n> --sort priority|age|truth
│   │   ├── get <term>
│   │   ├── search <query> --fuzzy
│   │   ├── stats
│   │   └── prune --threshold <pct> --dry-run
│   ├── beliefs         # Belief management
│   │   ├── list --limit <n>
│   │   ├── add <narsese> --truth <f,c>
│   │   ├── remove <term>
│   │   ├── contradict <term>
│   │   └── export --format json|narsese
│   ├── goals           # Goal management
│   │   ├── list
│   │   ├── add <narsese>
│   │   ├── remove <term>
│   │   └── suspend <term>
│   ├── episodes        # Episodic memory
│   │   ├── list --limit <n>
│   │   ├── get <id>
│   │   ├── search <query>
│   │   ├── consolidate --threshold <pct>
│   │   └── export --format json
│   ├── consolidate     # Run consolidation
│   │   ├── --limit <n>
│   │   ├── --relevance <pct>
│   │   └── --force
│   ├── backup          # Backup memory
│   │   ├── --output <path>
│   │   └── --compress
│   ├── restore         # Restore memory
│   │   ├── <path>
│   │   └── --merge
│   └── stats           # Memory statistics
│       ├── --json
│       └── --output <path>
│
├── model               # Model & skill management
│   ├── list            # List available models
│   │   ├── --type llm|embedding|head
│   │   └── --json
│   ├── pull            # Download model
│   │   ├── <model-id>
│   │   ├── --quantization <q4|q8|f16>
│   │   └── --force
│   ├── remove          # Remove model
│   │   ├── <model-id>
│   │   └── --force
│   ├── info            # Model info
│   │   ├── <model-id>
│   │   └── --json
│   ├── benchmark       # Benchmark models
│   │   ├── --task <name>
│   │   ├── --models <id1,id2>
│   │   └── --output <path>
│   ├── skills          # Skill management
│   │   ├── list
│   │   ├── install <skill-id>
│   │   ├── remove <skill-id>
│   │   ├── enable <skill-id>
│   │   ├── disable <skill-id>
│   │   └── create <name> --template <type>
│   └── registry        # Registry management
│       ├── add <url>
│       ├── remove <url>
│       ├── list
│       └── sync
│
├── experiment          # Research & experimentation
│   ├── run             # Run experiment
│   │   ├── --config <path>
│   │   ├── --name <name>
│   │   ├── --seed <n>
│   │   ├── --iterations <n>
│   │   ├── --output <dir>
│   │   └── --resume <run-id>
│   ├── list            # List experiments
│   │   ├── --status running|completed|failed
│   │   └── --json
│   ├── show            # Show experiment details
│   │   ├── <run-id>
│   │   └── --json
│   ├── compare         # Compare runs
│   │   ├── <run-id-a> <run-id-b>
│   │   ├── --metric <name>
│   │   └── --output <path>
│   ├── analyze         # Analyze results
│   │   ├── <run-id>
│   │   ├── --statistical
│   │   └── --output <path>
│   ├── sweep           # Parameter sweep
│   │   ├── --param <key>=<min,max,step>
│   │   ├── --objective <metric>
│   │   └── --output <path>
│   └── notebook        # Export to Jupyter notebook
│       ├── <run-id>
│       └── --output <path>
│
├── data                # Data import/export/transform
│   ├── import          # Import data
│   │   ├── --format narsese|json|csv|yaml
│   │   ├── --file <path>
│   │   ├── --batch-size <n>
│   │   └── --validate
│   ├── export          # Export data
│   │   ├── --format narsese|json|csv|yaml
│   │   ├── --output <path>
│   │   ├── --since <date>
│   │   └── --filter <query>
│   ├── transform       # Transform data
│   │   ├── --input <path>
│   │   ├── --output <path>
│   │   ├── --script <path>
│   │   └── --dry-run
│   ├── generate        # Generate synthetic data
│   │   ├── --type beliefs|goals|episodes
│   │   ├── --count <n>
│   │   ├── --domain <name>
│   │   └── --output <path>
│   └── validate        # Validate data integrity
│       ├── --input <path>
│       └── --fix
│
├── dev                 # Development & debugging
│   ├── repl            # Developer REPL with introspection
│   │   ├── --profile <name>
│   │   └── --inspect
│   ├── debug           # Debug running agent
│   │   ├── --pid <n>
│   │   ├── --port <n>
│   │   └── --attach
│   ├── profile         # CPU/memory profiling
│   │   ├── --duration <s>
│   │   ├── --output <path>
│   │   └── --flamegraph
│   ├── trace           # Trace execution
│   │   ├── --filter <pattern>
│   │   ├── --output <path>
│   │   └── --format json|chrome
│   ├── inspect         # Inspect internal state
│   │   ├── --component <name>
│   │   ├── --path <json-path>
│   │   └── --watch
│   ├── benchmark       # Microbenchmarks
│   │   ├── --suite <name>
│   │   └── --iterations <n>
│   ├── test            # Run tests
│   │   ├── --filter <pattern>
│   │   ├── --watch
│   │   └── --coverage
│   ├── lint            # Lint code
│   │   ├── --fix
│   │   └── --format
│   ├── typecheck       # TypeScript check
│   └── generate        # Code generation
│       ├── --template <name>
│       ├── --output <path>
│       └── --name <name>
│
├── completions         # Shell completions
│   ├── bash
│   ├── zsh
│   ├── fish
│   └── powershell
│
└── help                # Help system
    ├── <command>       # Command-specific help
    ├── --all           # All commands
    ├── --json          # Machine-readable
    ├── --markdown      # Markdown output
    └── --tutorial      # Interactive tutorial
```

---

## User Persona Command Matrix

| Persona | Primary Commands | Secondary Commands |
|---------|------------------|-------------------|
| **End User** | `run`, `demo playground`, `demo arcade`, `session` | `config show`, `memory concepts`, `help` |
| **Developer** | `dev repl`, `dev debug`, `dev test`, `build`, `config init` | `session replay`, `memory`, `model skills` |
| **Researcher** | `experiment run`, `experiment sweep`, `demo imagine`, `demo benchmark` | `data generate`, `model benchmark`, `doctor tune` |
| **Operator** | `serve mcp`, `serve http`, `edge run`, `doctor check`, `session list` | `session snapshot`, `memory backup`, `config validate` |
| **Agent/Automation** | `run --background`, `serve mcp`, `logic`, `memory`, `session` | `config get/set`, `model`, `data import/export` |

---

## Migration Mapping (Expanded)

| Old Command | New Command | Notes |
|-------------|-------------|-------|
| `senars --profile agent` | `senars run --profile agent` | Default profile = agent |
| `senars --profile logic` | `senars run --profile logic` | |
| `senars --profile device` | `senars run --profile device` | |
| `senars --mcp` | `senars run --mcp` or `senars serve mcp` | |
| `senars --playground` | `senars demo playground` | |
| `senars --generate <id>` | `senars schema generate <id>` | New: schema subcommand |
| `senars --schema <id>` | `senars schema show <id>` | |
| `pnpm run bot` | `senars run` | Interactive REPL |
| `pnpm run bot -- --status` | `senars doctor status` | |
| `pnpm run bot -- --doctor` | `senars doctor check` | Full health check |
| `pnpm run bot -- --tune` | `senars doctor tune` | |
| `pnpm run bot -- --arcade` | `senars demo arcade` | |
| `pnpm run bot -- --multiagent` | `senars demo multiagent` | New demo |
| `pnpm exec tsx src/bin/imagine.ts` | `senars demo imagine` | |
| `pnpm exec tsx src/bin/self-report.ts` | `senars doctor report` | |
| `pnpm exec tsx src/bin/config-validate.ts` | `senars config validate` | |
| `pnpm exec tsx src/bin/wasm-bundle.ts` | `senars build wasm` | |
| `pnpm exec tsx src/bin/edge-worker.ts` | `senars edge run` | |
| `pnpm run mcp` | `senars serve mcp` | |
| `pnpm run logic` | `senars logic` | |

---

## Implementation Phases

### Phase 1: Command Router & Core Structure (Week 1)
- [ ] Create `senars` main entry with subcommand routing (Cobra-style or custom)
- [ ] Implement command discovery from `src/bin/commands/**/index.ts`
- [ ] Move `run` logic from `senars` + `bot` → `senars run`
- [ ] Create `serve`, `demo`, `doctor`, `config`, `build`, `edge`, `logic`, `session`, `memory`, `model`, `experiment`, `data`, `dev`, `completions`, `help` stubs
- [ ] Shared flag parsing library (`src/bin/lib/cli.ts`)
- [ ] Help system with markdown/JSON output

### Phase 2: Core Execution Commands (Week 2)
- [ ] `senars run` — full agent lifecycle, profiles, MCP, WebUI, sessions
- [ ] `senars serve mcp` — extract from `mcp-server.ts`
- [ ] `senars serve http` — new REST API
- [ ] `senars serve ws` — new WebSocket server
- [ ] `senars edge run` — extract from `edge-worker.ts`
- [ ] `senars logic` — wrap existing `logic.ts`

### Phase 3: Demo Subsystem (Week 3)
- [ ] `senars demo playground` — extract from `senars --playground` + `bot`
- [ ] `senars demo arcade` — extract from `bot --arcade`
- [ ] `senars demo imagine` — extract from `imagine.ts`
- [ ] `senars demo benchmark` — extract from `doctor-report --benchmarks`
- [ ] `senars demo tutorial` — new guided tutorials
- [ ] `senars demo gallery` — pre-recorded demos
- [ ] Visualization flags: `--visualize`, `--explain`, `--live`
- [ ] Web dashboard integration

### Phase 4: Doctor & Diagnostics (Week 4)
- [ ] `senars doctor check` — merge config-validate + LM probe + System One + persistence + perf
- [ ] `senars doctor status` — extract from `status-report`
- [ ] `senars doctor report` — extract from `self-report`
- [ ] `senars doctor tune` — extract from `tune-runner`
- [ ] `senars doctor bench` — derivation benchmarks
- [ ] `senars doctor profile` — CPU/memory profiling
- [ ] `senars doctor trace` — distributed tracing

### Phase 5: Config & Session Management (Week 5)
- [ ] `senars config validate|show|init|diff|set|get|schema|migrate`
- [ ] `senars session list|show|resume|delete|export|import|snapshot|replay|stats`
- [ ] `senars memory concepts|beliefs|goals|episodes|consolidate|backup|restore|stats`
- [ ] `senars model list|pull|remove|info|benchmark|skills|registry`

### Phase 6: Advanced Features (Week 6)
- [ ] `senars experiment run|list|show|compare|analyze|sweep|notebook`
- [ ] `senars data import|export|transform|generate|validate`
- [ ] `senars dev repl|debug|profile|trace|inspect|benchmark|test|lint|typecheck|generate`
- [ ] `senars build wasm|docker|binary|release`

### Phase 7: Polish & Deprecation (Week 7)
- [ ] Shell completions (bash/zsh/fish/powershell)
- [ ] Help system with `--all`, `--json`, `--markdown`, `--tutorial`
- [ ] Deprecation warnings on old entry points
- [ ] Update package.json `bin` entries
- [ ] Update docs/README with new command reference
- [ ] Remove old entry point files
- [ ] Man pages generation

---

## File Structure After Restructure

```
src/bin/
├── senars.ts                 # Main entry: command router
├── commands/
│   ├── run.ts                # senars run
│   ├── serve/
│   │   ├── index.ts          # senars serve
│   │   ├── mcp.ts
│   │   ├── http.ts
│   │   ├── ws.ts
│   │   └── irc.ts
│   ├── demo/
│   │   ├── index.ts          # senars demo
│   │   ├── playground.ts
│   │   ├── arcade.ts
│   │   ├── imagine.ts
│   │   ├── benchmark.ts
│   │   ├── tutorial.ts
│   │   └── gallery.ts
│   ├── doctor/
│   │   ├── index.ts          # senars doctor
│   │   ├── check.ts
│   │   ├── status.ts
│   │   ├── report.ts
│   │   ├── tune.ts
│   │   ├── bench.ts
│   │   ├── profile.ts
│   │   └── trace.ts
│   ├── logic.ts              # senars logic
│   ├── edge/
│   │   ├── index.ts          # senars edge
│   │   ├── run.ts
│   │   ├── build.ts
│   │   ├── test.ts
│   │   └── deploy.ts
│   ├── build/
│   │   ├── index.ts          # senars build
│   │   ├── wasm.ts
│   │   ├── docker.ts
│   │   ├── binary.ts
│   │   └── release.ts
│   ├── config/
│   │   ├── index.ts          # senars config
│   │   ├── validate.ts
│   │   ├── show.ts
│   │   ├── init.ts
│   │   ├── diff.ts
│   │   ├── set.ts
│   │   ├── get.ts
│   │   ├── schema.ts
│   │   └── migrate.ts
│   ├── session/
│   │   ├── index.ts          # senars session
│   │   ├── list.ts
│   │   ├── show.ts
│   │   ├── resume.ts
│   │   ├── delete.ts
│   │   ├── export.ts
│   │   ├── import.ts
│   │   ├── snapshot.ts
│   │   ├── replay.ts
│   │   └── stats.ts
│   ├── memory/
│   │   ├── index.ts          # senars memory
│   │   ├── concepts.ts
│   │   ├── beliefs.ts
│   │   ├── goals.ts
│   │   ├── episodes.ts
│   │   ├── consolidate.ts
│   │   ├── backup.ts
│   │   ├── restore.ts
│   │   └── stats.ts
│   ├── model/
│   │   ├── index.ts          # senars model
│   │   ├── list.ts
│   │   ├── pull.ts
│   │   ├── remove.ts
│   │   ├── info.ts
│   │   ├── benchmark.ts
│   │   ├── skills.ts
│   │   └── registry.ts
│   ├── experiment/
│   │   ├── index.ts          # senars experiment
│   │   ├── run.ts
│   │   ├── list.ts
│   │   ├── show.ts
│   │   ├── compare.ts
│   │   ├── analyze.ts
│   │   ├── sweep.ts
│   │   └── notebook.ts
│   ├── data/
│   │   ├── index.ts          # senars data
│   │   ├── import.ts
│   │   ├── export.ts
│   │   ├── transform.ts
│   │   ├── generate.ts
│   │   └── validate.ts
│   ├── dev/
│   │   ├── index.ts          # senars dev
│   │   ├── repl.ts
│   │   ├── debug.ts
│   │   ├── profile.ts
│   │   ├── trace.ts
│   │   ├── inspect.ts
│   │   ├── benchmark.ts
│   │   ├── test.ts
│   │   ├── lint.ts
│   │   ├── typecheck.ts
│   │   └── generate.ts
│   ├── completions/
│   │   ├── bash.ts
│   │   ├── zsh.ts
│   │   ├── fish.ts
│   │   └── powershell.ts
│   └── help/
│       ├── index.ts
│       └── tutorial.ts
├── lib/
│   ├── cli.ts                # Command router, flag parsing, help
│   ├── shared-flags.ts       # Common flag definitions
│   ├── output.ts             # Output formatting (table, json, yaml, markdown)
│   ├── spinner.ts            # Progress indicators
│   ├── prompt.ts             # Interactive prompts
│   └── ...existing utilities...
└── lib/mcp/                  # Keep MCP transport code
```

---

## Backward Compatibility

### Deprecation Strategy
1. **Phases 1-6**: Old entry points work unchanged
2. **Phase 7**: Add deprecation warnings:
   ```bash
   $ pnpm run bot
   ⚠️  'pnpm run bot' is deprecated. Use 'senars run' instead.
   ```
3. **After 2 releases**: Remove old entry points from `package.json`

### Package.json Updates
```json
{
  "bin": {
    "senars": "./dist/bin/senars.js",
    "senars-serve": "./dist/bin/commands/serve/index.js",
    "senars-demo": "./dist/bin/commands/demo/index.js",
    "senars-doctor": "./dist/bin/commands/doctor/index.js",
    "senars-logic": "./dist/bin/commands/logic.js",
    "senars-edge": "./dist/bin/commands/edge/index.js",
    "senars-build": "./dist/bin/commands/build/index.js",
    "senars-config": "./dist/bin/commands/config/index.js",
    "senars-session": "./dist/bin/commands/session/index.js",
    "senars-memory": "./dist/bin/commands/memory/index.js",
    "senars-model": "./dist/bin/commands/model/index.js",
    "senars-experiment": "./dist/bin/commands/experiment/index.js",
    "senars-data": "./dist/bin/commands/data/index.js",
    "senars-dev": "./dist/bin/commands/dev/index.js"
  }
}
```
Old names (`bot`, `config-validate`, `wasm-bundle`, `self-report`, `imagine`) removed.

---

## Cross-Cutting Concerns & Advanced Capabilities

### Security, Compliance & Governance

| Area | Commands | Description |
|------|----------|-------------|
| **Auth & RBAC** | `senars auth login`, `senars auth whoami`, `senars auth roles`, `senars auth tokens` | OAuth/OIDC, API keys, role-based access |
| **Secrets** | `senars secrets set`, `senars secrets get`, `senars secrets rotate`, `senars secrets audit` | Vault integration, env injection, rotation |
| **Audit** | `senars audit log`, `senars audit trail <session>`, `senars audit export` | Immutable audit trail, compliance reports |
| **Policy** | `senars policy eval`, `senars policy test`, `senars policy list` | OPA/Rego policies for agent behavior |
| **Compliance** | `senars compliance check`, `senars compliance report`, `senars compliance evidence` | SOC2, GDPR, HIPAA evidence collection |
| **Sandboxing** | `senars sandbox run`, `senars sandbox inspect`, `senars sandbox limits` | Capability-based isolation, resource quotas |

### Observability & Monitoring

| Area | Commands | Description |
|------|----------|-------------|
| **Metrics** | `senars metrics query`, `senars metrics export`, `senars metrics push` | Prometheus/OpenTelemetry integration |
| **Logs** | `senars logs tail`, `senars logs query`, `senars logs export` | Structured logging, log aggregation |
| **Alerts** | `senars alerts list`, `senars alerts create`, `senars alerts silence` | Alert rules, notification channels |
| **Dashboards** | `senars dashboard list`, `senars dashboard import`, `senars dashboard export` | Grafana/JSON dashboards |
| **Tracing** | `senars trace query`, `senars trace compare`, `senars trace flamegraph` | Distributed tracing, latency analysis |
| **Profiling** | `senars profile cpu`, `senars profile memory`, `senars profile continuous` | Continuous profiling in production |

### Multi-Agent & Cluster Management

| Area | Commands | Description |
|------|----------|-------------|
| **Cluster** | `senars cluster create`, `senars cluster join`, `senars cluster status`, `senars cluster scale` | Multi-node agent clusters |
| **Fleet** | `senars fleet list`, `senars fleet deploy`, `senars fleet rollout`, `senars fleet canary` | Fleet management, progressive rollout |
| **Service Mesh** | `senars mesh install`, `senars mesh config`, `senars mesh mtls` | mTLS, service discovery, load balancing |
| **Coordination** | `senars coord lock`, `senars coord elect`, `senars coord broadcast` | Distributed coordination primitives |

### CI/CD & Automation Integration

| Area | Commands | Description |
|------|----------|-------------|
| **GitHub Actions** | `senars gh workflow generate`, `senars gh workflow validate`, `senars gh run` | Native GH Actions integration |
| **GitLab CI** | `senars gl pipeline generate`, `senars gl pipeline trigger` | GitLab CI/CD |
| **ArgoCD/Flux** | `senars gitops install`, `senars gitops sync`, `senars gitops diff` | GitOps deployment |
| **Tekton** | `senars tekton task generate`, `senars tekton pipeline run` | Tekton pipelines |
| **Custom Runners** | `senars runner register`, `senars runner status`, `senars runner scale` | Self-hosted runner management |

### Plugin & Extension System

```bash
# Plugin management
senars plugin install <name> [--version] [--source <url>]
senars plugin remove <name>
senars plugin list [--installed|--available]
senars plugin update <name>
senars plugin info <name>
senars plugin dev <name>        # Local development mode

# Plugin creation
senars plugin create <name> --template <type>
senars plugin build <path>
senars plugin publish <path> --registry <url>

# Hook system
senars hook list                 # Available hook points
senars hook add <point> <command>
senars hook remove <point> <id>
```

**Hook Points**: `pre-run`, `post-run`, `pre-session`, `post-session`, `pre-memory-write`, `post-memory-read`, `pre-tool-call`, `post-tool-call`, `on-error`, `on-checkpoint`

### Remote & Cloud Operations

| Area | Commands | Description |
|------|----------|-------------|
| **Cloud Deploy** | `senars cloud deploy`, `senars cloud status`, `senars cloud logs`, `senars cloud scale` | Managed cloud deployment |
| **Remote Exec** | `senars remote exec`, `senars remote shell`, `senars remote copy` | SSH-like remote operations |
| **Sync** | `senars sync push`, `senars sync pull`, `senars sync watch` | Bidirectional state sync |
| **Backup/DR** | `senars backup create`, `senars backup restore`, `senars backup schedule` | Disaster recovery |

### Developer Experience Enhancements

| Feature | Commands | Description |
|--------|----------|-------------|
| **Templates** | `senars template list`, `senars template use`, `senars template create` | Project scaffolding |
| **Snippets** | `senars snippet list`, `senars snippet insert`, `senars snippet create` | Code/Config snippets |
| **Debugging** | `senars debug attach`, `senars debug breakpoint`, `senars debug watch` | Advanced debugging |
| **Testing** | `senars test generate`, `senars test mutate`, `senars test property` | Property-based, mutation testing |
| **Refactoring** | `senars refactor rename`, `senars refactor extract`, `senars refactor inline` | Automated refactoring |

### Accessibility & Internationalization

```bash
# Accessibility
senars a11y mode on|off          # High contrast, screen reader mode
senars a11y theme <name>         # Color-blind safe themes
senars a11y font-size <size>     # Adjustable font
senars a11y reduce-motion        # Disable animations

# Internationalization
senars i18n lang <code>          # en, es, fr, de, ja, zh, ko
senars i18n translate <key>      # Translate CLI messages
senars i18n extract              # Extract strings for translation
```

### Offline & Air-Gapped Support

```bash
# Offline-first design
senars offline prepare           # Pre-fetch models, configs, deps
senars offline verify            # Verify offline readiness
senars offline bundle <path>     # Create air-gapped deployment bundle
senars offline serve             # Run local registry mirror
```

### Mobile & Edge-Specific

| Target | Commands | Description |
|--------|----------|-------------|
| **Mobile** | `senars mobile build`, `senars mobile install`, `senars mobile debug` | iOS/Android (React Native/Flutter) |
| **WASM** | `senars wasm optimize`, `senars wasm componentize`, `senars wasm test` | WebAssembly optimization |
| **Microcontroller** | `senars mcuboot flash`, `senars mcuboot dfu`, `senars mcuboot monitor` | Embedded deployment |
| **FPGA** | `senars fpga synthesize`, `senars fpga program`, `senars fpga verify` | Hardware acceleration |

### AI-Assisted CLI

```bash
# Natural language to commands
senars ai "run agent with logic profile and enable mcp on port 8080"
senars ai "show me memory pressure for last hour"
senars ai "create experiment to test overload profile"

# Command explanation
senars explain "senars doctor check --config --lm --fail-fast"
senars explain --interactive

# Smart suggestions
senars suggest --context "high memory pressure"
senars suggest --after-error
```

### Self-Management & Updates

```bash
# Self-update
senars self-update [--channel stable|beta|nightly] [--version]
senars self-update check
senars self-update rollback

# Migration
senars migrate config --from 1.x --to 2.x
senars migrate memory --format v1 --to v2
senars migrate sessions --merge

# Health
senars self-diagnose              # Full self-check
senars self-repair                # Attempt auto-repair
```

### Telemetry & Usage Analytics (Opt-In)

```bash
senars telemetry status           # Show what's collected
senars telemetry enable|disable
senars telemetry sample           # View sample payload
senars telemetry export           # Export your data
```

### Resource Management & Scheduling

```bash
# Quotas & Limits
senars quota set <resource> <limit>
senars quota list
senars quota usage

# Scheduling
senars schedule add "0 2 * * *" "senars run --profile device"
senars schedule list
senars schedule remove <id>

# Resource Pools
senars pool create <name> --cpu 4 --memory 8g --gpu 1
senars pool list
senars pool assign <agent> <pool>
```

### Workflow & Pipeline Automation

```bash
# Pipeline definition
senars workflow create <name> --from <file>
senars workflow run <name> [--param key=value]
senars workflow status <run-id>
senars workflow logs <run-id>
senars workflow cancel <run-id>

# Step templates
senars step template list
senars step template use <name>
```

### Knowledge & Documentation Integration

```bash
# Built-in documentation
senars docs open <topic>          # Open in browser
senars docs search <query>
senars docs offline               # Download for offline

# Examples & Recipes
senars recipe list                # Community recipes
senars recipe use <name>          # Apply recipe
senars recipe create <name>       # Share recipe

# API Reference
senars api reference <module>
senars api search <query>
```

---

## Domain-Specific Command Extensions

### Scientific Computing
```bash
senars science simulate <model> --params <file>
senars science analyze <data> --method <name>
senars science visualize <results> --type plot|3d|anim
senars science publish <experiment> --journal <name>
```

### Robotics & Control
```bash
senars robot connect <device> --protocol ros2|mqtt|modbus
senars robot teleop --joystick
senars robot plan <task> --constraints <file>
senars robot monitor --joint-states --tf
```

### Financial Modeling
```bash
senars finance portfolio optimize --risk <level>
senars finance backtest <strategy> --data <source>
senars finance risk var --confidence 0.99
senars finance report <portfolio> --format pdf
```

### Healthcare / Life Sciences
```bash
senars bio sequence align --ref <genome>
senars bio variant call --vcf <file>
senars bio pathway analyze --kegg <id>
senars clinical trial design --phase <n>
```

### Creative / Generative
```bash
senars gen story --prompt <text> --length <n>
senars gen code --spec <file> --lang <language>
senars gen art --prompt <text> --style <name>
senars gen music --mood <mood> --duration <s>
```

---

## Implementation Priority Matrix

| Priority | Area | Rationale |
|----------|------|-----------|
| **P0** | Core router, run, serve, demo, doctor, config | MVP for all users |
| **P1** | session, memory, model, logic, edge, build | Daily developer workflow |
| **P2** | experiment, data, dev, plugin, auth, secrets | Power users, teams |
| **P3** | cluster, fleet, cloud, observability, CI/CD | Production, enterprise |
| **P4** | accessibility, i18n, offline, mobile, AI-assist | Inclusivity, reach |
| **P5** | domain extensions (science, robotics, finance, bio) | Vertical markets |

---

## Updated Success Criteria

- [ ] Single `senars` command with intuitive subcommands (max 3 levels deep)
- [ ] `senars --help` shows clear command taxonomy with descriptions
- [ ] `senars demo` impresses new users in <30 seconds with `--visualize --explain`
- [ ] `senars doctor check` passes in CI for healthy configs (exit code 0/1)
- [ ] All old entry points mapped 1:1 to new commands
- [ ] Zero breaking changes during transition period (deprecation warnings only)
- [ ] Documentation auto-generated from help (`--markdown`, `--json`)
- [ ] Shell completions work for all subcommands, flags, and values
- [ ] Machine-readable output (`--json`) for all commands for agent integration
- [ ] Consistent flag patterns: `--output`, `--format`, `--profile`, `--config`, `--json`, `--quiet`, `--verbose` across all commands
- [ ] Plugin system enables third-party extensions without core changes
- [ ] Works fully offline/air-gapped with `senars offline prepare`
- [ ] Accessible: screen readers, color-blind themes, reduced motion
- [ ] Internationalized: CLI messages in 7+ languages
- [ ] Self-updates with rollback capability
- [ ] Opt-in telemetry with full transparency and export
- [ ] Domain-specific extensions loadable via plugins

---

## Testing Strategy

### Unit Tests (per command)
```bash
# Each command module has:
tests/unit/bin/commands/<subsystem>/<command>.test.ts
# - Flag parsing
# - Input validation
# - Output formatting (table, json, yaml, markdown)
# - Error handling
# - Help text generation
```

### Integration Tests
```bash
tests/integration/cli/
├── run.test.ts           # Full agent lifecycle
├── demo.test.ts          # Demo subsystem
├── doctor.test.ts        # Health checks
├── config.test.ts        # Config management
├── session.test.ts       # Session CRUD
├── memory.test.ts        # Memory operations
├── plugin.test.ts        # Plugin lifecycle
└── offline.test.ts       # Air-gapped operation
```

### Contract Tests
- **CLI Contract**: `--json` output schema validation (JSON Schema)
- **Help Contract**: `--help --markdown` produces valid markdown
- **Completion Contract**: Shell completions return valid options

### E2E Tests (Critical Paths)
```bash
tests/e2e/
├── new-user-journey.test.ts      # Install → demo playground → run agent
├── developer-journey.test.ts     # config init → dev repl → build
├── researcher-journey.test.ts    # experiment run → analyze → notebook
├── operator-journey.test.ts      # serve mcp → doctor check → session snapshot
├── ci-cd-journey.test.ts         # build → test → deploy
└── offline-journey.test.ts       # offline prepare → run → sync
```

### Performance Benchmarks
- CLI startup time < 200ms (cold), < 50ms (warm)
- Command dispatch < 10ms
- Help generation < 50ms
- Large output streaming (10k+ lines) without memory spike

### Accessibility Tests
- Screen reader compatibility (NVDA, JAWS, VoiceOver)
- Color contrast ratios (WCAG AA)
- Keyboard navigation
- Reduced motion respected

---

## Documentation Strategy

### Auto-Generated (Single Source of Truth)
```bash
# All docs generated from CLI help
senars help --all --markdown > docs/cli/reference.md
senars help --all --json > docs/cli/reference.json
senars <command> --help --markdown > docs/cli/<command>.md
```

### Manual Documentation
```
docs/
├── getting-started.md          # 5-min quickstart
├── concepts/
│   ├── architecture.md
│   ├── profiles.md
│   ├── memory-model.md
│   └── system-one.md
├── guides/
│   ├── running-agents.md
│   ├── demos.md
│   ├── health-checks.md
│   ├── sessions.md
│   ├── memory-management.md
│   ├── configuration.md
│   ├── edge-deployment.md
│   ├── plugins.md
│   ├── experiments.md
│   └── offline.md
├── reference/
│   ├── cli.md                  # Auto-generated
│   ├── config-schema.md        # Auto-generated
│   ├── api.md                  # Auto-generated
│   └── environment-variables.md
├── recipes/
│   ├── basic-reasoning.md
│   ├── multi-agent.md
│   ├── custom-tools.md
│   ├── custom-profiles.md
│   └── production-deployment.md
└── api/
    ├── typescript.md
    ├── python.md
    └── rest.md
```

### Interactive Tutorial System
```bash
senars help --tutorial           # Interactive guided tour
senars tutorial start basics     # Step-by-step
senars tutorial start demos      # Demo gallery
senars tutorial start dev        # Developer workflow
```

---

## Architecture Decision Records (ADR)

Create `docs/adr/` for key decisions:
```
docs/adr/
├── 0001-single-entry-point.md
├── 0002-subcommand-structure.md
├── 0003-plugin-architecture.md
├── 0004-offline-first-design.md
├── 0005-output-formats.md
├── 0006-configuration-precedence.md
├── 0007-session-persistence.md
├── 0008-plugin-hooks.md
├── 0009-telemetry-opt-in.md
└── 0010-domain-extensions.md
```

### ADR Template
```markdown
# ADR-NNN: Title

## Status
Proposed | Accepted | Superseded

## Context
What problem are we solving?

## Decision
What did we decide?

## Consequences
### Positive
### Negative
### Risks
```

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Command bloat / discoverability | High | High | Max 3 levels, `help --all`, tutorials, AI assist |
| Breaking existing scripts | Medium | High | Deprecation period, aliases, migration guide |
| Performance regression | Medium | Medium | Benchmarks in CI, startup time budgets |
| Plugin security | Low | High | Signed plugins, sandboxed execution, permissions |
| Configuration complexity | High | Medium | `config init --interactive`, `config show --diff` |
| Session data loss | Low | High | Auto-snapshot, `session snapshot`, backup/restore |
| Memory growth in long runs | Medium | High | `doctor profile`, quotas, GC tuning |
| Model download failures | Medium | Medium | Retry, resume, offline prepare, cache |
| Cross-platform issues | Medium | Medium | CI on Linux/macOS/Windows, path handling |

---

## Stub Implementation Guidelines

### For Each Command (Not Yet Implemented)
```typescript
// src/bin/commands/<subsystem>/<command>.ts
import { runCLI, type CommonFlags, type HelpSection } from '../../lib/cli';

const sections: HelpSection[] = [
  // ... standard sections
];

export async function main(flags: CommonFlags): Promise<void> {
  console.error(`⚠️  Command not yet implemented: <command>`);
  console.error(`   Track progress: https://github.com/senars/senars/issues/XXX`);
  process.exit(1);
}

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections }).catch(() => process.exit(1));
}
```

### Command Registry Pattern
```typescript
// src/bin/lib/cli.ts
interface CommandModule {
  main: (flags: CommonFlags) => Promise<void>;
  sections: HelpSection[];
}

const commandRegistry = new Map<string, CommandModule>();

export function registerCommand(path: string, module: CommandModule) {
  commandRegistry.set(path, module);
}

export async function dispatch(argv: string[]): Promise<void> {
  // Parse subcommand path: senars demo playground -> ['demo', 'playground']
  // Look up in registry, fallback to help
}
```

---

## Fresh Session Kickoff Checklist

### Before Starting
- [ ] Read this entire TODO1.md
- [ ] Run `pnpm test` — verify all 3778 tests pass
- [ ] Run `pnpm run senars -- --help` — verify current CLI works
- [ ] Review `src/bin/lib/cli-utils.ts` — understand shared utilities
- [ ] Review `src/bin/lib/entrypoint-base.ts` — understand entry point patterns

### Session 1: Command Router & Core Structure
- [x] Create `src/bin/lib/cli.ts` with command registry
- [x] Create `src/bin/senars.ts` as thin router
- [x] Implement `senars run` (merge senars default + bot)
- [x] Implement stubs for all 18 top-level commands
- [x] Verify `senars --help` shows full taxonomy

### Session 2: Core Execution
- [x] `senars serve mcp` (extract from mcp-server.ts)
- [x] `senars serve http` (new)
- [x] `senars serve ws` (new)
- [x] `senars edge run` (extract from edge-worker.ts)
- [x] `senars logic` (wrap existing)

### Session 3: Demo Subsystem
- [x] `senars demo playground` (extract)
- [x] `senars demo arcade` (extract)
- [x] `senars demo imagine` (extract)
- [x] `senars demo benchmark` (extract)
- [x] Add `--visualize`, `--explain`, `--live` flags (added to playground and imagine)

### Session 4: Doctor & Diagnostics
- [x] `senars doctor check` (merge)
- [x] `senars doctor status` (extract)
- [x] `senars doctor report` (extract)
- [x] `senars doctor tune` (extract)
- [x] `senars doctor bench` (extract)

### Session 5: Config, Session, Memory, Model
- [x] Config CRUD commands (validate, get, set, list)
- [x] Session lifecycle (start, stop, list)
- [x] Memory inspection (inspect, export, import)
- [x] Model management (list, pull, remove)

### Session 6: Advanced Features
- [x] Experiment framework (run, list, show, compare, analyze, sweep, notebook)
- [x] Data import/export (import, export, transform, generate, validate)
- [x] Dev tools (repl, debug, profile, trace, inspect, benchmark, test, lint, typecheck, generate)
- [x] Plugin system foundation (install, remove, list, update, info, dev, create, build, publish)

### Session 7: Polish
- [ ] Shell completions
- [ ] Help system
- [ ] Deprecation warnings
- [ ] Documentation generation
- [ ] Remove old entry points

---

## Definition of Done (Per Command)

A command is **done** when:
- [ ] Implemented in `src/bin/commands/<subsystem>/<command>.ts`
- [ ] Registered in command registry
- [ ] Unit tests pass (`pnpm test`)
- [ ] Integration tests pass
- [ ] `--help` shows accurate usage
- [ ] `--version` shows version
- [ ] `--json` outputs valid JSON
- [ ] `--quiet` suppresses non-error output
- [ ] `--verbose` adds debug info
- [ ] `--output <path>` writes to file
- [ ] `--format table|json|yaml|markdown` works
- [ ] Shell completions work
- [ ] Documentation auto-generated
- [ ] Deprecation warning added to old entry point (if applicable)

---

## Next Steps

1. **Approve this plan** — Review with stakeholders
2. **Create GitHub Project** — Track phases as milestones
3. **Set up CI** — Add benchmark, accessibility, contract tests
4. ~~**Begin Session 1** — Command router implementation~~ ✅ **DONE**
5. ~~**Begin Session 2** — Core Execution (`serve mcp`, `serve http`, `serve ws`, `edge run`, `logic`)~~ ✅ **DONE**
6. ~~**Begin Session 3** — Demo Subsystem (`demo playground`, `demo arcade`, `demo imagine`, `demo benchmark`)~~ ✅ **DONE**
7. ~~**Begin Session 4** — Doctor & Diagnostics (`doctor check`, `doctor status`, `doctor report`, `doctor tune`, `doctor bench`)~~ ✅ **DONE**
8. ~~**Begin Session 5** — Config, Session, Memory, Model (Config CRUD, Session lifecycle, Memory inspection, Model management)~~ ✅ **DONE**
9. ~~**Begin Session 6** — Advanced Features (Experiment framework, Data import/export, Dev tools, Plugin system foundation)~~ ✅ **DONE**
10. **Begin Session 7** — Polish (Shell completions, Help system, Deprecation warnings, Documentation generation, Remove old entry points)

---

*Plan version: 1.6 | Created: 2026-11-26 | Updated: 2026-11-26 | Session 1-6 Complete | Ready for Session 7*