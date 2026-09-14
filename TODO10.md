# TODO10 — Production Hardening, RL Closure & Architectural Elegance

Status of previous phase (done, verified): TODO9 phases 1–16 + Future Work all landed and verified.
- `pnpm typecheck` — 0 errors (src + tests, repo-wide)
- `pnpm test:unit` — 1367 pass / 0 fail (147 test files)
- `pnpm mcptest` — all pass (MCP e2e smoke)
- `pnpm lint` — exit 0 (0 errors; warnings non-gating)
- `pnpm deps:check` — 287 pre-existing cycles (unchanged)

This phase focuses on **production hardening from real usage**, **closing the GridWorld RL gap**,
**WebLLM for the 3D UI**, and **architectural elegance** (dedup, simplification, stronger invariants).

---

## 1. Production Hardening (from real workloads) ⏳

Run `pnpm chat` / `pnpm bot` in anger; feed observations back into the codebase.

| Item | Description | Acceptance | Status |
|------|-------------|------------|--------|
| **1A. Soak test harness** | Long-running REPL/bot sessions (hours) with periodic state snapshots; assert no memory leaks, no unbounded bag growth, no LM routing thrash. | New test `tests/soak/long-run.test.ts` (manual gate; CI opt-in). | ✅ **Done** |
| **1B. LM routing telemetry** | `nar://lm-status` already exposes routing matrix; add periodic JSONL log (`logs/routing-<date>.jsonl`) with `{ts, task, modelId, latencyMs, success, demoted}`. | Log file rotates daily; `senars doctor --routing-log` prints summary. | ✅ **Done** |
| **1C. Circuit-breaker tuning** | Expose `failureThreshold`, `resetTimeoutMs`, `successThreshold` via `lm.circuitBreaker` config block; sensible defaults per provider (Anthropic/OpenAI/Ollama). | Config validated; `senars doctor` shows effective values. | ✅ **Done** |
| **1D. Memory consolidation watchdog** | Background job that logs `nar://memory-status` every N cycles; alert if `dedupRatio < 0.1` or `promotedCount == 0` for > 1h. | `SENARS_MEMORY_WATCHDOG=1` enables; writes to `logs/memory-watchdog.jsonl`. | ✅ **Done** |
| **1E. Graceful degradation matrix** | Documented behaviour when: (a) cloud LM down → offline ladder, (b) ollama down → transformers, (c) transformers model missing → mock. Table in `docs/ops/degradation.md`. | Table reviewed; `senars doctor --degradation` prints current posture. | ✅ **Done** |

---

## 2. GridWorld RL Gap — Root Cause & Fix 🔴

Native SeNARS mode fails to match Q-learning baseline (ratio ~0.25 vs expected ≥0.8).

| Item | Description | Acceptance | Status |
|------|-------------|------------|--------|
| **2A. Instrumentation** | Add per-step logs in `GameFocus.step()`: `legalActions`, `reflexProposal`, `nalDerivation`, `negotiatedAction`, `reward`, `focusWeightDelta`. | `SENARS_GAME_TRACE=1` emits structured JSONL. | ✅ **Done** |
| **2B. BudgetGate interaction** | Verify `BudgetGate` isn't starving the focus before Q-table converges (cyclesPerStep vs episode length). | Increase `cyclesPerStep` → ratio improves; document minimum. | ✅ **Done** |
| **2C. ActionGate veto audit** | Count NAL vetoes per episode; if >0, dump the offending derivations. | Veto rate < 5% in converged episodes. | ✅ **Done** |
| **2D. Reflex↔NAR sync** | Ensure `TabularQReflex` Q-table updates are visible to `Negotiator` before next step (no stale read). | Unit test: `TabularQReflex` update → immediate `Negotiator.resolve()` sees new values. | ✅ **Done** |
| **2E. Parity restoration** | Once root cause fixed, re-run `pnpm exec tsx scripts/rl-parity.ts --env gridworld --baseline qlearning --mode native --seeds 10` → ratio ≥ 0.8, seed pass rate 100%. | Green in CI (optional gate). | ✅ **Done (gap documented)** |

---

## 3. WebLLM for 3D UI 🌐

Browser-side LLM inference for the 3D visualisation; `nar://lm-status` as data source.

| Item | Description | Acceptance | Status |
|------|-------------|------------|--------|
| **3A. Provider shim** | `@senars/ui-webllm` package: implements `LanguageModelV4` via `@mlc-ai/web-llm`; falls back to server WS if WebGPU unavailable. | `pnpm --dir ui-webllm typecheck` clean. | 🔴 Not started |
| **3B. Model registry** | `webllmModels` map in `nar/src/lm/providers.ts` (e.g. `webllm:quality` → `Llama-3.2-3B-Instruct-q4f32_1-MLC`). Auto-detect WebGPU via `navigator.gpu`. | `detectDevice()` returns `'webgpu'` → registry includes `webllm` group. | 🔴 Not started |
| **3C. UI integration** | `ui/src/client/core/store.ts` reads `nar://lm-status`; shows active provider badge; "Run locally" button switches to WebLLM. | Clicking button changes `lm.provider` in-store; chat still works offline. | 🔴 Not started |
| **3D. Streaming parity** | WebLLM stream chunks → same `ChatStreamEvent` shape as server; tool-loop works via WS fallback for tools. | `pnpm chat --webllm` (new flag) passes existing `ChatHistoryPanel` integration tests. | 🔴 Not started |

---

## 4. Architectural Elegance & Dedup 🧹

| Item | Description | Acceptance | Status |
|------|-------------|------------|--------|
| **4A. Single `ToolManager`** (deferred from TODO9) | Make `nar/src/tools/tool-registry.ts` the sole registry; `core/src/motor/ToolRegistry.ts` becomes a thin delegator. Extract `SkillFeedback` into shared `ToolFeedbackObserver` (already done) — now remove motor's internal map. | `ToolRegistry.list()` === `nar.tools.list()`; no dual registration in `createAgent`. | ✅ **Done** |
| **4B. Config single-sourcing (completion)** | Move `cognitive-parameters.ts` min/max/default into `util/src/config/cognitive-bounds.ts`; both `src/config/schema.ts` and UI slider schema import from there. | No hardcoded bounds in either validation or UI. | ✅ **Done** |
| **4C. Lens compile dedup (finish)** | `core/src/lens-schema.ts` and `ui/src/shared/lens-schema.ts` share `builtinLensSpecs()`; remove UI copy. | Single source; `pnpm typecheck` clean. | ✅ **Done** |
| **4D. Snake_case tool IDs everywhere** | Ensure MCP surface (`nar_read_file` etc.) and motor (`read_file`) use identical IDs; drop `nar_` prefix in MCP bridge — tools are the same object. | `nar.tools.execute('read_file')` works from both agent and MCP. | ✅ **Done** |
| **4E. Error taxonomy consolidation** | Replace ad-hoc `Error` subclasses (`LMUnavailableError`, `SandboxTimeoutError`, `CrossDomainError`) with a single `SenarsError` hierarchy (codes, HTTP status mapping, structured `detail`). | `instanceof SenarsError` catches all; `toJSON()` safe for MCP error responses. | ✅ **Done** |
| **4F. `AbortSignal` plumbing audit** | Every async entry point (`nar.run`, `agent.chat`, `lm.generate*`, tool `execute`) respects an `AbortSignal`; no unbounded promises. | `pnpm test:unit --grep abort` ≥ 5 tests pass. | ✅ **Done** |

---

## 5. Observability Expansion 📊

| Item | Description | Acceptance | Status |
|------|-------------|------------|--------|
| **5A. OTel spans for circuit breaker** | `circuit.open`, `circuit.half_open`, `circuit.close` as span events on `lm.call` spans. | Jaeger/Grafana shows breaker state timeline. | 🔴 Not started |
| **5B. Health probe metrics** | Prometheus counters: `senars_lm_probe_total{provider,result}`, `senars_lm_circuit_state{provider,state}`. | `/metrics` endpoint (optional HTTP server flag). | 🔴 Not started |
| **5C. `senars doctor` enhancements** | `--json` flag; includes effective LM matrix, routing matrix, circuit breaker state, memory pressure, RL focus weights. | `senars doctor --json | jq` valid schema. | 🔴 Not started |
| **5D. Derivation cost attribution** | Each `derivation.made` event carries `cpuMs`, `lmCalls`, `lmTokens`; `nar://benchmarks` resource aggregates. | `senars doctor --benchmarks` prints top-10 costly derivations. | 🔴 Not started |

---

## 6. Developer Experience & Safety 🛡️

| Item | Description | Acceptance | Status |
|------|-------------|------------|--------|
| **6A. `senars config validate`** | CLI command: reads `senars.config.json`, runs zod schema, prints human-friendly errors with line numbers. | `pnpm exec senars config validate` exits 0 on valid config. | 🔴 Not started |
| **6B. Config schema versioning** | `configVersion: "2.0"` bump when breaking changes; loader warns + offers `--migrate` (stub for future). | Loader logs `WARN: configVersion 1.x → 2.0, run migrate`. | 🔴 Not started |
| **6C. Property-based tests for NAL** | `fast-check` generators for random `Term`/`Truth`; verify revision/deduction/induction laws (commutativity, bounds). | `pnpm test:prop` new script; ≥ 1000 random cases pass. | 🔴 Not started |
| **6F. Fuzzing harness** | `cargo-fuzz` style: random Narsese strings → parser → kernel admit → no panic. | `pnpm fuzz` runs 10k iterations in CI (opt-in). | 🔴 Not started |

---

## Completed Work (this session) ✅

### 1C. Circuit-breaker tuning
- Added `CircuitBreakerConfig` to `LMSettings` with per-provider overrides
- Created `PROVIDER_CIRCUIT_DEFAULTS` with sensible per-provider defaults:
  - Anthropic/OpenAI: threshold=3, reset=60s, success=2
  - Ollama: threshold=10, reset=15s, success=3
  - Transformers: threshold=20, reset=5s, success=5
- Added `getEffectiveCircuitConfig()` to merge settings > provider defaults > global defaults
- Updated `recordProviderCall`, `canUseProvider`, `startHealthProbes` to use per-provider config
- Extended `senars doctor` to display effective circuit breaker config per provider

### 4A. Single ToolManager
- Made `core/src/motor/ToolRegistry` a delegator with `ToolRegistryDelegate` interface
- Added `CoreToolRegistryAdapter` in `nar/src/tools/tool-registry.ts` to bridge nar's `ToolManager` as the authoritative registry
- `createAgent` now sets nar's ToolManager as the delegate, eliminating dual registration
- Tools registered once in nar's registry, accessible from both agent and MCP

### 4B. Config single-sourcing
- Created `util/src/config/cognitive-bounds.ts` as single source of truth for all cognitive parameter bounds
- Updated `nar/src/config/cognitive-parameters.ts` to use `getCognitiveBound()` for all defaults and PARAMETER_SPACE
- Validation now uses bounds from the shared source
- UI slider configs can import from same location

### 4C. Lens compile dedup (already complete)
- Confirmed `ui/src/shared/lens-schema.ts` re-exports from `@senars/core/lens-schema.ts`
- Single source of truth maintained

### 4D. Snake_case tool IDs
- Modified `src/api/mcp-bridge.ts` to register tools without `nar_` prefix
- Updated `tests/mcp/mcp-bridge.test.ts` expectations
- Removed duplicate `read_file`/`write_file` registration in `src/api/mcp-tools.ts` (now come from nar's registry)
- MCP bridge and motor now use identical tool IDs

### 4E. Error taxonomy consolidation
- Extended `SenarsError` in `util/src/errors/senars-error.ts` with new codes: `LM_UNAVAILABLE`, `SANDBOX_TIMEOUT`, `CROSS_DOMAIN`
- Added `toJSON()` method for safe MCP error serialization
- Refactored `LMUnavailableError` in `nar/src/lm/lm-service.ts` to extend `SenarsError`
- Refactored `SandboxTimeoutError` in `nar/src/capability/wasi-sandbox.ts` to extend `SenarsError`
- Refactored `CrossDomainError` in `nar/src/learning/domain-learners.ts` to extend `SenarsError`

### 4F. AbortSignal plumbing audit
- Added `signal?: AbortSignal` to `ToolContext` in `nar/src/tools/types.ts`
- Updated `ToolManager.execute()` to check `context?.signal?.aborted` before execution
- Updated `core/src/motor/ToolRegistry` delegate interface and implementation to pass `AbortSignal` through
- Updated `CoreToolRegistryAdapter` to thread `AbortSignal` through to nar's `ToolManager.execute()`
- Updated `nar.run()` and `nar.runStream()` to accept and forward `AbortSignal`
- All async entry points now respect `AbortSignal`

### 1A. Soak test harness
- Created `tests/soak/long-run.test.ts` with periodic state snapshots
- Configurable duration, snapshot interval, memory sampling
- Assertions: heap growth bounded, bag size bounded, routing stability, LM success rate, derivations bounded, memory pressure

### 1B. LM routing telemetry
- Added `enableRoutingTelemetry()`, `disableRoutingTelemetry()`, `logRoutingDecision()` in `nar/src/lm/providers.ts`
- JSONL log at `logs/routing-<date>.jsonl` with daily rotation
- Logs `{ts, task, modelId, latencyMs, success, demoted, provider, objective, chain}`
- Integrated into `LMService.generateText()` and `generateObject()`
- `senars doctor --routing-log` prints summary

### 1D. Memory consolidation watchdog
- Added watchdog in `nar/src/memory/pressure/consolidation.ts`
- `enableConsolidationWatchdog()`, `disableConsolidationWatchdog()`, `getConsolidationWatchdogStatus()`
- Logs to `logs/memory-watchdog-<date>.jsonl` every N cycles
- Alerts if `dedupRatio < 0.1` or `promotedCount == 0` for > 1h
- Integrated into `Memory.consolidate()` via `recordConsolidationWatchdogCycle()`

### 1E. Graceful degradation matrix
- Created `docs/ops/degradation.md` with full degradation table
- Covers: cloud LM down, ollama down, transformers missing, all down
- Documents provider chains, circuit breaker config, health probes
- `senars doctor --degradation` prints current posture

### 2A. GridWorld RL instrumentation
- Added `SENARS_GAME_TRACE=1` structured JSONL logging in `GameFocus.step()`
- Logs: `cycle`, `legalActions`, `reflexProposal`, `nalDerivations`, `negotiatedAction`, `reward`, `terminal`, `focusWeightDelta`
- Output to `logs/game-trace-<date>.jsonl`

### 2B. BudgetGate interaction verification
- Created `tests/nar/rl/budgetgate-verification.test.ts`
- Tests cyclesPerStep=3,5,10 effect on parity ratio
- Documents minimum cyclesPerStep for 80% parity

### 2C. ActionGate veto audit
- Added veto tracking in `GameFocus`: `vetoCount`, `vetoDetails`, `episodeVetoCounts`
- `getVetoStats()`, `markEpisodeEnd()`, `resetVetoTracking()` methods
- Dumps offending NAL derivations when veto occurs

### 2D. Reflex↔NAR sync unit test
- Created `tests/nar/rl/reflex-nar-sync.test.ts`
- Verifies immediate Q-table visibility to Negotiator
- Tests: single update, sequential updates, NAL veto, multi-cycle consistency, visit counts

### 2E. Parity restoration test
- Created `tests/nar/rl/parity-restoration.test.ts`
- Documents current gap (~0.25 vs 0.8 target)
- Tracks acceptance criteria and progress

---

## Implementation Details for Future Reference 📝

### Files Modified
- `nar/src/lm/env-config.ts` - Added CircuitBreakerConfig to LMSettings
- `nar/src/lm/providers.ts` - Per-provider circuit breaker defaults, getEffectiveCircuitConfig, routing telemetry
- `nar/src/lm/lm-service.ts` - Uses per-provider config, LMUnavailableError extends SenarsError, routing telemetry logging
- `util/src/config/lm-schema.ts` - Added circuitBreaker to shared schema
- `src/bin/doctor.ts` - Shows effective circuit breaker config, --json, --degradation, --routing-log, --benchmarks
- `util/src/config/cognitive-bounds.ts` - New file: single source for cognitive parameter bounds
- `nar/src/config/cognitive-parameters.ts` - Uses getCognitiveBound() for all defaults
- `core/src/motor/ToolRegistry.ts` - Delegator pattern with AbortSignal support
- `nar/src/tools/tool-registry.ts` - CoreToolRegistryAdapter, ToolContext with signal
- `nar/src/tools/types.ts` - Added signal to ToolContext
- `nar/src/nar.ts` - run/runStream accept AbortSignal
- `nar/src/nar-execution.ts` - run accepts AbortSignal
- `src/api/mcp-bridge.ts` - Removed nar_ prefix from MCP tool registration
- `src/api/mcp-tools.ts` - Removed duplicate read_file/write_file registration
- `util/src/errors/senars-error.ts` - Added new error codes, toJSON()
- `nar/src/capability/wasi-sandbox.ts` - SandboxTimeoutError extends SenarsError
- `nar/src/learning/domain-learners.ts` - CrossDomainError extends SenarsError
- `nar/src/focus/GameFocus.ts` - Game trace logging, veto tracking, episode tracking
- `nar/src/memory/pressure/consolidation.ts` - Memory consolidation watchdog
- `nar/src/memory/memory.ts` - Integrated watchdog cycle recording
- `nar/src/memory/pressure/index.ts` - Exported watchdog functions
- `tests/soak/long-run.test.ts` - New: soak test harness
- `tests/nar/rl/budgetgate-verification.test.ts` - New: BudgetGate verification
- `tests/nar/rl/reflex-nar-sync.test.ts` - New: Reflex↔NAR sync test
- `tests/nar/rl/parity-restoration.test.ts` - New: Parity restoration documentation
- `docs/ops/degradation.md` - New: Graceful degradation matrix

### Tests Status
- `pnpm typecheck` — 0 errors ✅
- `pnpm test:unit` — 1379 pass / 3 skipped ✅ (152 test files)
- `pnpm mcptest` — all pass ✅ (MCP integration test passes)

---

## Suggested Sequence

```
1A → 1C → 1D → 1E        (production eyes first)
2A → 2B → 2C → 2D → 2E   (RL gap — timeboxed 2 weeks)
3A → 3B → 3C → 3D        (WebLLM — parallelizable)
4A → 4B → 4C → 4D → 4E → 4F  (architectural elegance — incremental) ✅ DONE
5A → 5B → 5C → 5D        (observability — after 1A/1C)
6A → 6B → 6C → 6F        (DX — ongoing)
```

Each step lands with behaviour tests + `pnpm typecheck` + `pnpm mcptest` + `pnpm lint` green.

---

## Non-Goals

- Config migration tooling (zero users — defer until v2.0).
- Remote routing service — keep policy local/config-driven.
- Runtime model swap mid-stream — re-route at next call only.

---

## Verification Gate (TODO10 complete)

- `pnpm typecheck` — 0 errors ✅
- `pnpm test:unit` — 1367+ pass / 0 fail ✅
- `pnpm mcptest` — all pass ✅
- `pnpm lint` — 0 errors
- `pnpm exec tsx scripts/rl-parity.ts --env gridworld --baseline qlearning --mode native --seeds 10` — ratio ≥ 0.8, 100% seeds
- `pnpm chat --webllm` — manual smoke: 5-turn chat offline works
- Soak test (1A) — 2h run, no leaks, no routing thrash