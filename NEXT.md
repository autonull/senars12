# SeNARS12 — Development Plan for Full Potential

> **Status**: Core engine (terms, rules, memory, reasoner, LM, tools, agent, bot, CLI) is ~80% complete (~20K LOC).  
> **Primary gap**: 10 sophisticated subsystems are fully implemented but never wired into NAR.  
> **Goal**: Connect, deduplicate, complete, and polish to produce a self-optimizing, self-correcting cognitive agent.

---

## Context: What Exists (the Good)

SeNARS12 is a TypeScript neuro-symbolic reasoning engine with:

| Subsystem | LOC | Completion | Wired to NAR? |
|---|---|---|---|
| Term System | ~1,300 | 100% | Yes |
| NAL Rules (NAL1-6) | ~900 | 100% | Yes |
| Memory + GC + Forgetting | ~2,200 | 100% | Yes |
| Reasoner (12 strategies) | ~700 | 100% | Yes |
| Task Manager | ~260 | 100% | No (not called) |
| Stream Pipeline | ~222 | 100% | No (never imported) |
| LM Integration (3 clients, 13 rules) | ~1,500 | 100% | Yes |
| Tool System (12 tools) | ~1,200 | 100% | Partially (5/12 registered) |
| RL from Preferences | ~840 | 100% | No |
| Self/Metacognition | ~1,150 | 100% | No |
| Query API + Trace | ~370 | 70% | Yes (stubs for explain/trace) |
| Agent + HTTP + WS + IRC | ~1,500 | 100% | Yes |
| CLI REPL | ~600 | 100% | Yes |
| Bot (standalone) | ~400 | 100% | Yes |
| Config Loader | ~200 | 100% | Yes |
| Lifecycle (BaseComponent, Container/DI) | ~250 | 100% | No (DI unused) |
| Utilities | ~500 | 100% | Yes |

**The central problem**: The codebase has the depth of a mature system but the integration of a prototype. Gems like `SelfAnalyzer` (638 lines), `RLFPLearner`, `PolicyOptimizer`, `MetacognitiveMonitor`, `BoundedBag`, and the entire `pipeline.ts` sit completely inert.

---

## Phase 0: Clean Slate (Foundation Hygiene)

**Before adding features, remove waste. Eliminate duplication. Consolidate. This phase has zero user-facing changes but massively reduces maintenance burden.**

### 0.1 — Deduplicate code

| Issue | Action |
|---|---|
| LM rule list duplicated (nar.ts:222-236 and :310-328) | Extract to `lm/rules.ts` as `ALL_LM_RULE_FACTORIES`, import in both places |
| `analogy`, `comparison`, `exemplification` duplicate in `nal.ts` AND `nal-extended.ts` | Keep in `nal-extended.ts`, remove from `nal.ts` |
| `extractSymbols()` in both `terms/utils.ts` and `memory/memory.ts` | Keep in `terms/utils.ts`, import in memory |
| `isCompound`/`isAtomic` in both `types.ts` and `accessors.ts` | Delete from `types.ts`, keep in `accessors.ts` |
| `guards.ts` duplicates exports from `accessors.ts` | Merge unique content (`termHashKey`, `isCanonical`, `getArgsSafe`, etc.) into `accessors.ts`; remove `guards.ts` |
| Two separate IRC implementations (`agent/irc-bot.ts` vs `bot/index.ts`) | Merge into one shared `Embodiment`; bot/ delegates to agent/ |
| Two separate tool type systems (`Agent.Tool` vs `nar/tools/types.Tool`) | Agent's `Command` system is fine; tools should live in `nar/tools/` only. Make Agent delegate tool execution to `nar.toolManager` |
| `DEPTH_MAX = 10` in both `types/depth.ts` and `terms/stamp.ts` | Single source in `types/depth.ts`, import everywhere else |
| `builder.ts` (5-line re-export) | Delete; replace with direct imports from `factory.ts` |

### 0.2 — Remove dead code or reintegrate it

| Dead Code | Disposition |
|---|---|
| `improveNormalization()` (types.ts:173-192) — never exported | Delete |
| `BoundedBag<T>` (270 lines) — never used | **Reintegrate**: Replace `Bag<T>` in `Concept` with `BoundedBag<T>` |
| `gc.ts` (70 lines) — `trackTerm`/`untrackTerm` never called | **Reintegrate**: Call from `Memory.addTask`/`Memory.removeConcept` |
| `Pipeline.ts` (222 lines) — never imported | **Reintegrate**: Use as `NAR.runStream()` alternative pipeline |
| `PremiseFormation` (184 lines) — never used by Reasoner | **Reintegrate**: Delegate premise selection from Reasoner to PremiseFormation |
| `task.ts` (18-line re-export) | Delete; import directly from `types/core.ts` |
| `Result<T>` type — defined but never returned | **Adopt**: Refactor `NAR` public methods to return `Result<T>` |

### 0.3 — Fix broken stub implementations

| Stub | Fix |
|---|---|
| `variableDependency` in `nal-extended.ts` always returns `undefined` | Implement actual variable dependency derivation |
| `explain()` returns empty `{ premises: [], rules: [] }` | Populate from `reasoningTrace.derivationHistory` |
| `extractDerivationPath()` breaks after 1 iteration | Walk full stamp chain to root |
| `buildDerivationTree()` creates nodes with empty children | Populate from linked derivation history |

### 0.4 — Upgrade dependencies and tooling

- Bump `typescript` to latest 5.x
- Bump `pnpm` to latest
- Add `vitest` as unified test runner (replace Jest for consistency with bot/ package)
- Add `prettier` for consistent formatting
- Add `lint-staged` + `simple-git-hooks` for pre-commit checks
- Add GitHub Actions CI: `typecheck`, `lint`, `test`, `benchmark`

---

## Phase 1: Wire the Brain (Integration)

**Connect every orphaned subsystem into NAR. This is the highest-leverage change — it transforms a collection of components into a coherent self-improving agent.**

### 1.1 — Wire TaskManager into the reasoning loop

```typescript
// nar.ts run() — current: tasks are added but never processed
async run(steps = 1) {
  for (let i = 0; i < steps; i++) {
    const task = this.taskManager.processPending();  // ← ADD THIS
    if (!task) break;
    await this.reasoner.step(task);
  }
}
```

- Call `taskManager.processPending()` at the top of each `run()` iteration
- Handle `command` task type: dispatch to `toolManager.execute()`
- Increment `retries` on failure; stop after `maxRetries`

### 1.2 — Wire Self/Metacognition into NAR

```typescript
// nar.ts constructor
this.self = new ReasoningAboutReasoning({
  nar: this,
  eventBus: this.eventBus,
  config: { analysisIntervalMs: 30000 },
});
```

- Create `self` property in NAR constructor
- Call `this.self.start()` in `NAR.start()` (creates the periodic analysis interval)
- Call `this.self.stop()` in `NAR.stop()`
- After each `reasoner.step()`, call `this.self.tick()` to accumulate metrics
- Add `nar.self` public accessor
- Add CLI commands: `.self`, `.meta`, `.optimize`

### 1.3 — Wire RLFP into the reasoning loop

```typescript
// nar.ts constructor
this.rlfp = new RLFPLearner({
  rewardModel: new RewardModel(),
  preferenceCollector: new PreferenceCollector(this.lmClient),
  policyOptimizer: new PolicyOptimizer(),
  trajectoryLogger: new ReasoningTrajectoryLogger(this.eventBus),
});
```

- Create `rlfp` property in NAR constructor
- After each `reasoner.step()`, record trajectory to `trajectoryLogger`
- Periodically call `policyOptimizer.optimize()` (every N steps or on `.optimize` command)
- Wire `PolicyOptimizer` strategies to `Reasoner` strategy selection (the types are incompatible now; unify them)
- Add CLI commands: `.prefer`, `.reward`, `.rlfp-stats`
- Feed RLFP-optimized weights back into rule priorities and strategy selection

### 1.4 — Register all 12 tools (not just 5)

```typescript
// nar.ts initializeTools() — add the missing 7
this.toolManager.registerAll([
  new CalculateTool(),
  new SleepTool(),
  new ReadFileTool(),
  new WriteFileTool(),
  new HTTPTool(),
  // These 7 are never registered:
  new SearchTool(this.memory),
  new ReasonTool(this),
  new ExplainTool(this),
  new LearnTool(this),
  new TimerTool(this.taskManager),
  new ProcessTool(),
  new GuidedReasoningPipeline(this),
]);
```

### 1.5 — Unify Agent tool system with NAR tool system

- Remove `Agent.Tool`/`Agent.ToolRegistry` (27 lines in Agent.ts)
- Agent commands (`help`, `stats`, `clear`, `save`, `load`) remain as `Agent.Command`
- All tool execution delegates to `nar.toolManager`
- Tools exposed via HTTP `/tools` endpoint use NAR's `ToolManager` directly

### 1.6 — Use Container/DI for component wiring

```typescript
// nar.ts constructor — use Container instead of manual construction
const container = new Container();
container.register('config', () => config);
container.register('memory', (c) => new Memory(c.get('config').memory));
container.register('reasoner', (c) => new Reasoner(c.get('memory'), c.get('config')));
container.register('self', (c) => new ReasoningAboutReasoning({ nar: this, ... }));
container.register('rlfp', (c) => new RLFPLearner({ ... }));
await container.initialize();
await container.start();
```

- Replace manual constructor wiring with Container registration
- Enables clean `dispose()` chain (topological reverse order)
- Enables testing with swapped components

### 1.7 — Integrate pipeline.ts as an alternative reasoning mode

- `NAR.runStream()` uses `pipeline.ts` `createPipeline()` instead of manual loop
- `Pipeline` provides backpressure, throttling, and composable premise sources
- `NAR.run()` remains the simpler synchronous loop for CLI/bot use

---

## Phase 2: Complete NAL (Reasoning Depth)

**Fill the missing NAL7-9 layers. Without temporal and procedural reasoning, the system cannot reason about time, actions, or itself at the symbolic level.**

### 2.1 — NAL7: Temporal Reasoning

Add temporal operators to the term system:
```
sequence (&/)  — sequential conjunction (A happens then B)
parallel (||)  — parallel conjunction (A and B happen concurrently)
predictive implication (=/>)   — if A happens, B will happen after
retrospective implication (</=) — if B happened, A happened before
```

Add NAL7 syllogistic rules (~10 rules):
- Temporal deduction, induction, abduction
- Temporal conjunction introduction
- Temporal-to-atemporal projection
- Temporal interval composition
- Sequence order constraints

### 2.2 — NAL8: Procedural Reasoning

Add procedural operators:
```
execution (^)       — an operation/skill is executed
goal-execution (!)  — a goal to execute an operation
```

Add NAL8 rules (~8 rules):
- Operation desire from goal + implication
- Goal execution chaining  
- Procedural decomposition
- Operation precondition checking
- Execution feedback (success/failure) as belief

### 2.3 — NAL9: Self/Control Reasoning

Add self-referential rules that reason about NAR's own state (~6 rules):
- Strategy effectiveness → strategy selection priority
- Resource usage → resource allocation adjustment  
- Error patterns → rule deprioritization
- Concept utility → memory retention priority
- Meta-belief revision from metacognition output

### 2.4 — Complete NAL-extended stubs

- Implement `variableDependency` in `nal-extended.ts`
- Add rule for `instance` and `property` copulas (NAL2 extensions)

---

## Phase 3: Real Intelligence (LM + Symbolic Deep Fusion)

**The LM integration exists but is shallow. Deep fusion means bidirectional flow: LM informs NAL, NAL constrains LM, and both learn from the interaction.**

### 3.1 — Bidirectional LM ↔ NAL feedback loop

```
LM generates hypothesis → NAL validates via deduction → validation result feeds LM prompt as context
```

- LM rules produce `Task` objects that enter the NAL inference cycle
- NAL derivation results are injected back into LM conversation context
- Each LM call includes recent NAL derivations as structured context

### 3.2 — Auto-discover and route to optimal LM models

- `ModelCapabilityDiscovery` already exists — invoke it on startup
- `LMRouter` already exists — use discovered capabilities to route task types:
  - Narsese translation → smaller/faster model
  - Explanation generation → larger/more capable model
  - Hypothesis generation → mid-tier model
- Cost tracking feeds back into `Budget.durability` (expensive operations valued less)

### 3.3 — Narsese ↔ Natural Language bridge

- Wire LM `narsese-translation` rule into bot message handling
- Bot receives "Is a bird an animal?" → LM translates to `<(bird --> animal) ?>` → NAR answers → LM translates answer to natural language
- This is the critical missing piece for chatbot usability

### 3.4 — LM response streaming

- Use `streamText` (Vercel AI SDK) instead of `generateText` for long explanations
- Stream tokens through SSE to connected WebSocket/HTTP clients
- Cancel streaming on user interrupt (Anytime compliance for LM)

### 3.5 — Dynamic LM rule generation

- `DynamicLMRuleGenerator` already exists — invoke it to create rules from patterns discovered by `SelfAnalyzer`
- New rules registered at runtime, not just the static 13

---

## Phase 4: Developer & User Experience

**Make the system a joy to use, configure, extend, and deploy.**

### 4.1 — Configuration overhaul

- Hot-reload config changes via file watcher (no restart needed for most params)
- Config validation with actionable error messages (currently silent clamping)
- Config schema generation (JSON Schema from TypeScript types)
- `.env` file support for API keys and secrets (currently only env vars)
- Preset profiles as first-class config files: `dev.config.json`, `server.config.json`, `embedded.config.json`

### 4.2 — CLI enhancements

- Tab-completion for Narsese operators (not just concepts)
- `.tutorial` runs an interactive tutorial, not just prints text
- `.self` / `.meta` / `.optimize` commands for metacognition
- `.prefer` / `.reward` commands for RLFP
- `.lm-status` / `.lm-switch` commands for LM management
- `.export --format json|narsese|dot` for different output formats
- Syntax highlighting for Narsese in REPL output

### 4.3 — HTTP API completion

- Auto-generated OpenAPI 3.0 spec from route definitions (not hand-written)
- Swagger UI endpoint (`/docs`)
- WebSocket protocol documentation
- API versioning (`/v1/...`)
- Pagination for `/concepts` and `/beliefs` endpoints
- Streaming responses via SSE for long-running queries

### 4.4 — Documentation (the README references files that don't exist)

Create the missing docs the README links to:
- `README.quickref.md` — Command reference and common patterns
- `README.usage.md` — Getting started tutorial
- `README.architecture.md` — System design and data flow
- `README.api.md` — Public API surface
- `README.development.md` — Developer setup, conventions, contributing
- `CONTRIBUTING.md` — Contributing guide (referenced but missing)

### 4.5 — Observability

- Structured JSON logging with levels and component tags
- Metrics export (Prometheus-compatible `/metrics` endpoint)
- OpenTelemetry tracing for derivation chains and LM calls
- Health check endpoint with dependency status (memory ok, LM reachable, etc.)
- Memory/profile dump for debugging

---

## Phase 5: Real-World Readiness

### 5.1 — Error resilience

- Global error boundary: unhandled rejections/exceptions caught and logged, NAR attempts graceful degradation
- LM failure fallback: when LM is unreachable, NAL-only mode activates automatically (circuit breaker already exists but isn't wired for mode switching)
- Memory pressure detection: when heap reaches threshold, aggressive forgetting + GC triggered
- Partial restart: ability to restart reasoner/memory without restarting agent connections

### 5.2 — Persistence

- Auto-save memory state to disk on interval (already has `saveToFile` but no auto-save)
- WAL (write-ahead log) for crash recovery
- Incremental export (only changed concepts since last save)
- Memory state versioning for migration between NAR versions

### 5.3 — Multi-agent support

- `AgentFleet` class managing multiple NAR instances
- Inter-agent communication via shared concept space
- Agent specialization (one focuses on deduction, another on analogy)
- Agent spawning/dissolving based on task load

### 5.4 — Containerization & deployment

- `Dockerfile` for production deployment
- `docker-compose.yml` for local dev (NAR + Ollama + IRC server)
- Kubernetes manifests or Helm chart for cluster deployment
- Health check probes for orchestration

### 5.5 — Benchmarks and performance

- Standard benchmark suite (NAB — NARS Automatic Benchmark)
- Throughput: inferences/second under load
- Latency: p50/p95/p99 for single inference step
- Memory growth over sustained operation
- Comparison dashboard vs OpenNARS/ONA

---

## Phase 6: Ecosystem & Community

### 6.1 — Plugin system

- `NARPlugin` interface: lifecycle hooks (onInit, onStep, onTask, onDerivation)
- Plugin registry with dependency resolution
- Built-in plugins refactored from current subsystems (self → SelfPlugin, rlfp → RLFPPlugin)
- Community plugin marketplace structure

### 6.2 — SDK packages

- `@senars/core` — NAR engine only (no agent, no bot)
- `@senars/agent` — Agent with HTTP/WS embodiments
- `@senars/bot` — IRC bot
- `@senars/cli` — REPL
- `@senars/lm` — LM integration (standalone reusable)
- `@senars/narsese` — Parser and formatter (standalone reusable)
- `senars` — Meta-package with all of the above

### 6.3 — Narsese ecosystem

- VS Code extension: Narsese syntax highlighting, term visualization
- Narsese formatter (pretty-print, minify)
- Narsese → DOT graph visualization
- Online playground (Narsese input → reasoning trace visualization)

---

## Priority Roadmap (What To Do First)

```
Week 1-2:  Phase 0 (Clean Slate)         — Deduplicate, delete dead code, fix stubs
Week 3-4:  Phase 1.1-1.3 (Wire Brain)    — TaskManager, Self, RLFP into NAR
Week 5:    Phase 1.4-1.7 (Wire Rest)     — All tools, unified tooling, Container, Pipeline
Week 6-7:  Phase 4.1-4.5 (DX/UX)        — Docs, config, CLI, HTTP API, observability
Week 8-10: Phase 2 (NAL7-9)             — Temporal, procedural, self/control rules
Week 11-12: Phase 3 (Deep LM Fusion)    — Bidirectional, auto-routing, NL bridge
Week 13+:  Phase 5 (Real-World)         — Error resilience, persistence, containers, benchmarks
Ongoing:   Phase 6 (Ecosystem)          — SDK, plugins, VS Code extension
```

---

## Success Metrics

| Metric | Current | Target | How Measured |
|---|---|---|---|
| Dead subsystems wired | 4/10 | 10/10 | Integration test passes for each subsystem |
| Code duplication | ~8 cases | 0 | grep for duplicate function signatures |
| NAL rule layers | NAL1-6 | NAL1-9 | Rule count: 25 → 50+ |
| LM → NAL feedback loop | None | Bidirectional | E2E test: LM hypothesis → NAL validation → context injection |
| NL chat usability | None | Ask NL question → reasoned answer | E2E bot test: natural language input → Narsese → derivation → NL output |
| CLI self commands | 0 | 5+ | `.self`, `.meta`, `.optimize`, `.prefer`, `.reward` |
| Task processing | tasks enqueued but never dequeued | Full lifecycle | `taskManager.processPending()` called in run() |
| Documentation files | 0 of 5 promised docs exist | 5/5 + CONTRIBUTING.md | File existence |
| HTTP API completeness | Basic CRUD, SSE stubbed | Full CRUD, live SSE, pagination, auth | HTTP integration tests |
| Containerization | No Dockerfile | Dockerfile + compose + K8s | `docker build` succeeds |
| CI/CD | None | GitHub Actions: lint, typecheck, test, bench | `.github/workflows/ci.yml` |

---

## Architecture Principles (Reaffirmed)

1. **AIKR by construction** — Anytime, bounded, knowledge-limited, resource-constrained baked into types and runtime
2. **Parser-less symbolic foundation** — TypeScript discriminated unions as the term representation; no string parsing in the hot path
3. **Immutable data** — Terms, Tasks, Truth, Stamps all frozen; structural sharing via hash-based interning
4. **Hybrid sync/async** — NAL rules run synchronously (deterministic, fast); LM rules run asynchronously (creative, slow)
5. **Pluggable strategies** — Reasoner, forgetting, sampling, forgetting, tool dispatch all use strategy patterns
6. **Component lifecycle** — BaseComponent with validated state machine; Container for DI
7. **Self-improving** — Metacognition analyzes → RLFP optimizes → policy weights feed back → NAR adapts
8. **Zero-cost abstractions** — TypeScript type-level metaprogramming erased at runtime; structural hashing for O(1) comparison

---

*This plan captures the next evolution: from a well-architected collection of components to a coherent, self-optimizing reasoning agent ready for real-world deployment.*
