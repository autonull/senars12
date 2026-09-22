# TODO20.md — Code Quality & Robustification Plan

**Version:** 1.0 (2026-09-22) · follows TODO19.md (complete) · targets architecture debt surfaced by dpdm, test flakiness, and TODO19 retrospectives
**Philosophy:** *Fix the seams that TODO19 unified.* The builder, component library, and learning loops are in place; this plan hardens the substrate they run on — dependency graph, error taxonomy, observability, configuration, and public API surface.
**Core Principle:** *No new features. Every item reduces coupling, eliminates a failure mode, or makes a contract explicit.*

---

## 1. Phases & Items

### Phase 0 — Dependency Graph Hygiene (blocks modular testing, causes build brittleness)

- **D01. Interface layer for kernel↔drives↔nar cycle** — create `nar/src/kernel/interfaces.ts` exporting `IGateRegistry`, `IBudgetGate`, `IPerceptionGate`, `IActionGate`, `IRewardGate`, `IEventLog`; `nar/src/types/events-interfaces.ts` for `CognitiveEvent` variants. `drives/manager.ts` and `nar.ts` depend *only* on interfaces. `kernel/index.ts` implements. | anchor `dpdm` cycles 201-230
- **D02. Break `nl` → `lm` → `kernel` → `drives` → `nar` → `nl`** — `NLUnderstandingService` accepts `ILMService` (new interface in `lm/interfaces.ts`) instead of concrete `LMService`. `createLMService` returns implementation. `nl/understanding.ts` imports interface only. | anchor `dpdm` cycles 272-286
- **D03. Break `terms` → `utils` → `types` → `nl` → `lm` → `kernel` → `nar` → `terms`** — `terms/accessors.ts`, `term-edges.ts`, `validation.ts` have zero external deps; ensure they stay leaf. Move `circuit-breaker.ts` out of `utils/index.ts` barrel (it pulls `types` → `nl` → `lm`…). Create `utils/resilience.ts` barrel for circuit-breaker, retry, timeout. | anchor `dpdm` cycles 232-266
- **D04. `dpdm` gate in CI** — add `pnpm deps:check` to `test` script; fail on *new* cycles. Existing 200+ cycles documented in `docs/known-cycles.md` with justification (Phase 1-3 fixes will reduce). | anchor `.github/workflows/ci.yml`
- **D05. Barrel audit** — every `index.ts` barrel exports only *public* API. Internal symbols moved to `internal/` subfolders or prefixed `_`. `nar/src/index.ts` is the single public entry; `nar/src/nar.ts`, `nar/src/agent/*`, `nar/src/game/*` are public; `kernel/*`, `focus/*`, `reflex/*`, `lm/system-one/*` are internal unless explicitly re-exported. | anchor `nar/package.json` exports

**Acceptance.** `pnpm deps:check` reports ≤10 cycles (all documented); `pnpm test:unit` green; no `import … from '@senars/nar/kernel/…'` in app code (only via `nar` barrel).

---

### Phase 1 — Monolith Decomposition (files >500 LOC impede review, testing, ownership)

| Target | Lines | Split Plan |
|--------|-------|------------|
| **M1. `external-tools.ts`** | 2,855 | 11 files under `tools/adapters/`: `web-search.ts`, `http-fetch.ts`, `code-exec.ts`, `filesystem.ts`, `rag-query.ts`, `coverage-concept.ts`, `human-approval.ts`, `test-gen.ts`, `test-runner.ts`, `scenario-gen.ts`, `codemod.ts`, `self-tools.ts` + `index.ts` barrel |
| **M2. `nar.ts`** | 1,265 | `NARCore` (kernel wiring), `NARAgent` (transport), `NARConfig` (options normalization), `nar-presets.ts` (factory fns) — keep `nar.ts` as facade re-exporting |
| **M3. `providers.ts`** | 1,024 | `providers/factory.ts`, `providers/llamacpp.ts`, `providers/ollama.ts`, `providers/transformers.ts`, `providers/embedded-llamacpp.ts`, `providers/mock.ts` + `providers/index.ts` |
| **M4. `lm-service.ts`** | 946 | `lm/LMService.ts` (core), `lm/admission.ts`, `lm/routing.ts`, `lm/circuit-breaker.ts`, `lm/charge-flow.ts` + `lm/index.ts` |
| **M5. `tool-registry.ts`** | 784 | `tools/ToolRegistry.ts`, `tools/decorator.ts`, `tools/execution.ts`, `tools/schemas.ts` + `tools/index.ts` |
| **M6. `perception-action-adapters.ts`** | 763 | `rl/adapters/perception.ts`, `rl/adapters/action.ts`, `rl/adapters/reward.ts`, `rl/adapters/index.ts` |
| **M7. `LMRule.ts`** | 742 | `lm/LMRule.ts` (base), `lm/rule-builders.ts`, `lm/rule-selectors.ts`, `lm/dynamic-rule.ts` + `lm/index.ts` |

**Acceptance.** Each split file <400 LOC; `pnpm typecheck` + `pnpm lint` + `pnpm test:unit` green; no circular deps introduced (D04 gate).

---

### Phase 2 — Determinism & Test Reliability

- **T1. RNG isolation utility** — `tests/helpers/rng.ts` exporting `pinDeterministicRNG()`, `restoreRNG()`, `withDeterministicRNG(fn)`. Replace all `Math.random` in `Bag.ts`, `schema-induction.ts`, `negotiator.ts` with injected `RandomSource` (default `Math.random`). | anchor `nar/src/bag/Bag.ts`, `nar/src/focus/schema-induction.ts`, `nar/src/reflex/Negotiator.ts`
- **T2. Fix flaky `todo17b-nal-arm.test.ts`** — call `pinDeterministicRNG()` before schema-induction test (line 150). Add lint rule `require-deterministic-rng` flagging `Math.random` in non-test code. | anchor `tests/nar/todo17b-nal-arm.test.ts:150`
- **T3. `isolate:true` default for vitest** — flip `vitest.config.ts` `test.isolate = true`; migrate tests that rely on module-load order (already flagged in TODO19). | anchor `vitest.config.ts`
- **T4. Property-based test expansion** — add `fast-check` generators for: `Term` (narsese round-trip), `Truth` (algebra laws), `CognitiveParameters` (range clamping), `Game` spec (legalActions non-empty). | anchor `tests/nar/property/`
- **T5. Test taxonomy tags** — `@unit`, `@integration`, `@load-sensitive`, `@e2e`, `@deterministic` in vitest `test.name` patterns; CI runs `@deterministic` on every PR, `@load-sensitive` nightly. | anchor `vitest.config.ts`, `.github/workflows/ci.yml`

**Acceptance.** Zero flakes in 20 consecutive `pnpm test:unit` runs; all `Math.random` in src replaced with `RandomSource`; property tests cover 5+ core domains.

---

### Phase 3 — Structured Error Handling & Result Types

- **E1. Error taxonomy** — `nar/src/errors/` with:
  - `BuilderError` (assembly-time, typed by failed step)
  - `GateError { gate, reason, operation }` (per-gate subclasses)
  - `ValidationError { path, issues: ZodIssue[] }` (boundary schemas)
  - `BudgetExceeded { scope, operation, limit, consumed }`
  - `DigestMismatch { expected, actual, artifact }`
  - `CrossDomainError { fromDomain, toDomain, operation }`
  - `SchemaInductionError { phase, cause }`
  - Base `SenarsError` with `code: string`, `context: Record<string, unknown>`
- **E2. `Result<T, E>` type** — `nar/src/utils/result.ts` (discriminated union `{ ok: true, value } | { ok: false, error }`). Replace `try/catch` in: LM admission, tool execution, persistence, schema store, gate authorization. Helpers: `Result.map`, `Result.flatMap`, `Result.unwrapOrThrow`.
- **E3. Zod `strict: true` on all external boundaries** — config, tool schemas, LM responses, HTTP API, WebSocket messages. Unknown keys → `ValidationError`.
- **E4. Error context enrichment** — every `throw` wraps with `SenarsError.wrap(err, { operation, scopeId, ... })`; logs include full causal chain.

**Acceptance.** No `catch (e: any)` in src; `pnpm typecheck` enforces `Result` returns on fallible fns; error codes grep-able for runbooks.

---

### Phase 4 — Observability & Operations

- **O1. OpenTelemetry spans** — `nar/src/otel/instrumentation.ts` wrapping:
  - `NARBuilder.build()` — attributes: profile, capabilities, gates
  - `GateRegistry.*` — gate type, operation, granted/denied
  - `Negotiator.resolve()` — proposals, veto, fallback
  - `SchemaStore.*` — scope, id, schema count
  - `LMService.admit()` — provider, rule, tokens, latency
  - Exporters: OTLP HTTP (configurable), console (dev)
- **O2. Structured JSON logging** — `createLogger` outputs `{ timestamp, level, traceId, spanId, component, message, …context }`. `traceId` propagated via `AsyncLocalStorage` from entry points (REPL, bot, MCP, arcade).
- **O3. Health check endpoints** — `GET /health` (liveness), `GET /health/ready` (readiness) on HTTP transport; checks: LM provider reachable, SchemaStore writable, GateRegistry responsive, EventLog appendable. `pnpm doctor` consumes same checks.
- **O4. Metrics completeness audit** — verify Prometheus counters exist for: gate decisions (granted/denied/vetoed), LM spend (tokens/cost per provider), derivation counts, bag pressure, schema promotions, veto rates, handover rates. Add missing.

**Acceptance.** `pnpm status --json` includes traceId; `pnpm doctor` exits 0 iff all health checks pass; Grafana dashboard template in `docs/observability.md`.

---

### Phase 5 — Configuration Hardening

- **C1. Zod-validated config schema** — `src/config/schema.ts` defines `SenarsConfigSchema` (env → file → defaults precedence). `senars.config.json` migrated; unknown keys error. `config:validate` script asserts validity.
- **C2. Config migration utility** — `src/utils/config-migrate.ts` reads `version` field, applies transforms (v1→v2, v2→v3…), writes migrated file. Runs automatically on start if version mismatch.
- **C3. Freeze `DEFAULT_COGNITIVE_PARAMETERS`** — `Object.freeze` deep (via `deep-freeze` util) at module load; `mergeParameters` returns new object (already fixed in TODO19 session 5). Add test asserting mutation throws in strict mode.
- **C4. Secrets hygiene** — `.env` never committed; `config:check` verifies required secrets present for enabled providers; `LM_MAX_SPEND_USD` enforced at `LMService` level (hard cap).

**Acceptance.** `pnpm config:validate` passes on clean checkout; migration runs idempotently; zero runtime config surprises.

---

### Phase 6 — Public API Surface & Versioning

- **A1. Explicit exports** — `nar/package.json` `"exports"` map defines:
  - `.` → `./index.ts` (public API only)
  - `./agent` → `./agent/index.ts`
  - `./game` → `./game/index.ts`
  - `./config` → `./config/index.ts`
  - `./rl` → `./rl/index.ts`
  - No `./kernel`, `./focus`, `./reflex`, `./lm/system-one` (internal)
- **A2. TypeDoc generation** — `pnpm run docs:api` generates `docs/api/` from public exports; CI publishes on tag.
- **A3. Semver policy in `AGENTS.md`** — breaking changes: major; new public exports: minor; internal refactors: patch. `exports:check` script verifies no internal symbol leaked.
- **A4. Deprecation lifecycle** — `@deprecated` JSDoc + `since` version; removal after 2 minors. `SeNARSFactory` already deleted (TODO19 session 4) — document as case study.

**Acceptance.** `pnpm exports:check` green; `docs/api/` builds; no consumer imports internal paths (grep guard in CI).

---

### Phase 7 — Security Hardening

- **S1. Tool input validation** — all tool schemas `z.object(...).strict()`; `execute` handlers receive validated `z.infer<>`; reject unknown keys at boundary.
- **S2. `shell` tool hardening** — allow-list via `SHELL_ALLOWLIST` env (comma-separated commands); args validated against schema; timeout enforced via `AbortSignal`; no `shell:true`.
- **S3. `code-exec` sandbox** — WASI-only execution (wasmtime); resource limits (fuel, memory, wall-clock); no host FS/network unless explicitly granted via capability tokens.
- **S4. LM response sanitization** — strip `tool_choice`, `function_call` from transformers.js responses (already in `providers.ts`); validate Narsese grammar before admission; size limits on all LM outputs.

**Acceptance.** Pen-test checklist in `docs/security.md` passes; `shell`/`code-exec` tools disabled by default (opt-in via config).

---

### Phase 8 — Performance Hot Paths

- **P1. `Bag.ts` seeded LCG** — replace `Math.random` with `RandomSource` (T1); add `BagOptions.rng`; benchmarks show ≤5% overhead vs `Math.random`; deterministic replay enabled.
- **P2. `EmbeddingCache` metrics & eviction** — expose `hitRate`, `size`, `evictions`; LRU with `maxEntries` (default 10k); `FlatCache` prototype for 384-d vectors (Float32Array contiguous) — adopt if >2x throughput.
- **P3. `Negotiator.resolve` memoization** — cache `isVetoingAction` results per `(derivationKey, action)` within tick; invalidate on memory version change (same as derivation index).
- **P4. `ParameterTable` write coalescing** — batch knob writes from `RLFPLearner`/`SelfMetaGame` per tick; single `mergeParameters` call; reduces deep-copy churn.

**Acceptance.** `pnpm bench:fundamentals` shows ≤10% regression; `Bag` determinism verified by property test; cache hit-rate >80% in arcade runs.

---

### Phase 9 — Documentation & Knowledge Transfer

- **K1. ADR log** — `docs/adr/` with `YYYY-MM-DD-short-title.md` for: kernel gates, epistemic firewall, AIKR bounds, builder pattern, component library, reasoning-as-game, schema persistence, GPU offload. Template in `docs/adr/template.md`.
- **K2. Architecture diagrams** — `scripts/generate-architecture.ts` emits Mermaid from imports (filtered to public + kernel); checked into `docs/architecture/`.
- **K3. Contributor guides** — `docs/contributing/add-game.md`, `add-reflex.md`, `add-systemone-head.md`, `add-tool.md`, `add-lm-rule.md` — each <200 lines, runnable example.
- **K4. Runbook** — `docs/runbook/` for: LM provider failure, gate deadlock, schema store corruption, budget exhaustion, veto storm, config migration failure.

**Acceptance.** New contributor can add a Game/Reflex/Head in <30 min following guides; ADR log covers all "why" questions from TODO19 retrospectives.

---

## 2. Acceptance Benches (new files under `tests/nar/todo20-*.test.ts`)

| # | Bench | File | Obligation |
|---|-------|------|------------|
| 61 | **Dependency Hygiene** | `tests/nar/todo20-deps.test.ts` | `dpdm` reports ≤10 cycles; all cycles documented; no internal imports in app code |
| 62 | **Monolith Split** | `tests/nar/todo20-monoliths.test.ts` | Each split file <400 LOC; barrel exports only public API; typecheck+lint+tests green |
| 63 | **Determinism** | `tests/nar/todo20-determinism.test.ts` | 20× `test:unit` zero flakes; `Math.random` absent from src (grep); property tests pass |
| 64 | **Error Taxonomy** | `tests/nar/todo20-errors.test.ts` | Every throw is `SenarsError` subclass; `Result` returned on all fallible public fns; Zod strict on boundaries |
| 65 | **Observability** | `tests/nar/todo20-otel.test.ts` | Spans emitted for 7 operations; traceId propagated; health endpoints return 200/503 correctly |
| 66 | **Config Hardening** | `tests/nar/todo20-config.test.ts` | Schema validates env/file/defaults precedence; migration idempotent; defaults frozen |
| 67 | **API Surface** | `tests/nar/todo20-api.test.ts` | `exports:check` passes; TypeDoc builds; no internal leaks; deprecation policy documented |
| 68 | **Security** | `tests/nar/todo20-security.test.ts` | Tool schemas strict; shell allow-list enforced; code-exec WASI sandboxed; LM response sanitized |
| 69 | **Performance** | `tests/nar/todo20-perf.test.ts` | Bag LCG ≤5% overhead; EmbeddingCache hit-rate >80%; Negotiator memo hits >90% |
| 70 | **Documentation** | `tests/nar/todo20-docs.test.ts` | ADR log complete; diagrams generate; contributor guides runnable; runbook covers top 10 incidents |

---

## 3. Decision Points

| # | Question | Default Proposal |
|---|----------|------------------|
| DQ1 | Interface granularity — one `IKernelGates` vs per-gate interfaces | Per-gate (finer mocking, clearer contracts) |
| DQ2 | `Result<T,E>` vs `Promise<Result<T,E>>` for async ops | Sync `Result` for pure fns; `Promise<Result>` for I/O (gate, LM, persistence) |
| DQ3 | OTLP exporter default endpoint | `http://localhost:4318/v1/traces` (configurable via `OTEL_EXPORTER_OTLP_ENDPOINT`) |
| DQ4 | Config file format — JSON vs TOML vs YAML | JSON (already in use; Zod parses natively) |
| DQ5 | Public API versioning — separate `@senars/nar/v2` package or same package with `exports` conditions | Same package, `exports` conditions (`import`/`require`/`types`); major bump = new package |
| DQ6 | `shell` allow-list default — empty (opt-in) or common utils (`ls`, `cat`, `grep`) | Empty — force explicit opt-in per deployment |

---

## 4. Rollback Triggers

| Phase | Trigger | Action |
|-------|---------|--------|
| 0 | Interface extraction breaks >5 tests | Revert D01-D03; apply strangler fig per-module |
| 1 | Split introduces circular dep | Merge offending pair; re-plan split boundary |
| 2 | Determinism changes alter bench results | Pin RNG seeds per bench; accept new baselines |
| 3 | `Result` adoption >30% file churn | Apply incrementally per subsystem; shim `try/catch`→`Result` adapters |
| 4 | OTLP exporter adds >50ms latency | Batch spans; switch to console exporter in CI |
| 5 | Config migration loses user keys | Dry-run mode; backup `.bak`; manual review flag |
| 6 | Consumer breaks on internal symbol removal | Re-export deprecated path for 1 minor; communicate |
| 7 | Sandbox breaks legitimate tool use | Capability token model; document escape hatches |
| 8 | Memoization introduces stale veto | Invalidate on `memory.version` change (same as derivation index) |
| 9 | Docs drift from code | `pnpm docs:check` in CI (link check, example run) |

---
 
## 5. Master Checklist
 
```
Phase 0: D01 interfaces  D02 nl-lm  D03 terms-utils  D04 dpdm-gate  D05 barrels  → [x] Bench 61
Phase 1: M1 tools  M2 nar  M3 providers  M4 lm-service  M5 tool-reg  M6 rl-adapters  M7 lm-rule  → [ ] Bench 62
Phase 2: T1 rng  T2 flake-fix  T3 isolate  T4 prop-tests  T5 taxonomy  → [ ] Bench 63
Phase 3: E1 taxonomy  E2 Result  E3 zod-strict  E4 context  → [ ] Bench 64
Phase 4: O1 otel  O2 json-log  O3 health  O4 metrics  → [ ] Bench 65
Phase 5: C1 schema  C2 migrate  C3 freeze  C4 secrets  → [ ] Bench 66
Phase 6: A1 exports  A2 typedoc  A3 semver  A4 deprecation  → [ ] Bench 67
Phase 7: S1 validate  S2 shell  S3 wasi  S4 sanitize  → [ ] Bench 68
Phase 8: P1 bag-lcg  P2 cache  P3 negotiator  P4 param-batch  → [ ] Bench 69
Phase 9: K1 adr  K2 diagrams  K3 guides  K4 runbook  → [ ] Bench 70
```
 
---
 
## Phase 0 Progress Notes (2026-09-22)
 
### Completed Items
 
- **D01**: Created `nar/src/kernel/interfaces.ts` with `IGateRegistry`, `IPerceptionGate`, `IActionGate`, `IRewardGate`, `IBudgetGate`, `IEventLog`, `IDriveManager` interfaces. Updated `GateRegistry` to implement `IGateRegistry`. Created `nar/src/types/events-interfaces.ts` with typed event accessors. Updated `DriveManager` to accept `INarInput` interface instead of concrete `NAR` class.
 
- **D02**: Created `nar/src/lm/interfaces.ts` with `ILMService` interface. Updated `NLUnderstandingService` and `NLGenerationService` to depend on `ILMService` instead of concrete `LMService`. Exported `ILMService` from `nar/src/lm/index.ts`.
 
- **D03**: Broke `utils → types → terms` cycle by:
  - Moving `Timestamp`, `Duration`, `DEPTH_MAX` to new `nar/src/types/primitives.ts` (no external deps)
  - Updating `nar/src/terms/stamp.ts` to import from `primitives.ts` instead of `types`
  - Updating `nar/src/utils/circuit-breaker.ts` to import `OperationError` from `@senars/util` instead of `../types`
  - Removed `trackTerm` import from `nar/src/terms/index.ts` to break `terms → memory` cycle
 
- **D04**: Added `pnpm deps:check` to `test` script in root `package.json`. CI now runs dependency check before tests.
 
- **D05**: Audited barrel exports in `nar/package.json`:
  - Removed internal-only exports: `./gates`, `./focus`, `./reflex`, `./lm/system-one`, `./kernel`, `./tick`, `./otel`, `./capability`, `./stream`, `./config/parameter-table`
  - Kept public exports: `.`, `./agent`, `./game`, `./config`, `./rl`, `./lm`, `./tools`, `./rules`, `./memory`, `./cognitive`, `./nl`, `./self`, `./learning`, `./rlfp`, `./commands`, `./logger`, `./utils`, `./bag`, `./engine`
  - `exports:check` passes; no internal symbols leaked via public exports map
 
### Acceptance Status
 
- ✅ `pnpm deps:check` reports 10 cycles (5 in core/io, 5 in nar) — all ≤10
- ✅ `pnpm test:unit` green (1772 tests pass)
- ✅ `pnpm typecheck` clean
- ✅ `pnpm exports:check` passes
- ✅ No `import … from '@senars/nar/kernel/…'` in app code (kernel not in exports map)
 
### Remaining Cycles (Documented)
 
1. core: Agent → AgentBridge → bridge/AgentBridge (3 cycles)
2. core: index → cortex/createCortexFromLM
3. io: index → bridge → bridge/index → ConnectionBinder → core/index → Agent → agent/types (2 cycles)
4. io: index → bridge → bridge/index → MiddlewarePipeline
5. nar: memory/index → memory/concept → terms/index → terms/factory.ts
6. nar: terms/factory.ts → terms/serialize.ts → terms/parser-peggy.ts
7. nar: strategies → attention/CompositeAttention → memory/index → memory/focus.ts
8. nar: strategies → attention/CompositeAttention → memory/index → memory/lifecycle/forgetting.ts → memory/pressure/index.ts → memory/pressure/consolidation.ts → memory/memory.ts (2 cycles)
 
### Next Steps
 
Phase 1 (Monolith Decomposition) can now proceed. The interface boundaries established in Phase 0 will allow safe splitting of the 7 monolith files without introducing new circular dependencies.

## 6. Definition of Done

```text
Clean dependency graph        Explicit public API           Deterministic by default
────────────────────────      ──────────────────────        ────────────────────────
≤10 documented cycles         exports map + TypeDoc         seeded RNG everywhere
interface boundaries          no internal leaks             property tests on core
dpdm gate in CI               semver policy                 zero flakes

Structured errors             Observable by default         Config you can trust
────────────────────────      ──────────────────────        ────────────────────────
typed taxonomy + Result       OTel spans + traceId          Zod strict + migration
context on every throw        health/ready endpoints        frozen defaults + caps

Secure by default             Fast where it matters         Knowledge preserved
────────────────────────      ──────────────────────        ────────────────────────
strict schemas + sandbox      Bag LCG + cache metrics       ADR log + guides + runbook
allow-lists + sanitization    memoized hot paths            diagrams generated from code
```

---

## 7. Leverage Notes

**Highest-leverage single items:**
- **D01/D02** (interface layers) — unblocks every subsequent refactor; pays compound interest on testability
- **E1/E2** (error taxonomy + Result) — eliminates entire class of "silent failure" bugs; enables exhaustive error handling
- **T1/T2** (RNG isolation) — fixes the *only* current flake; enables deterministic CI
- **A1** (explicit exports) — draws the line between substrate and product; prevents architecture rot

**Decomposition ledger (nothing split twice):**
- `external-tools.ts` → 11 adapters (M1)
- `nar.ts` → Core/Agent/Config/Presets (M2)
- `providers.ts` → factory + 5 providers (M3)
- `lm-service.ts` → 5 focused modules (M4)
- `tool-registry.ts` → 4 modules (M5)
- `perception-action-adapters.ts` → 4 adapters (M6)
- `LMRule.ts` → 4 modules (M7)

**Non-binding improvement ideas (revisit at phase boundaries):**
- `Effect.ts` for error/async/stream unification (only if `Result` + `AsyncLocalStorage` proves insufficient)
- `ts-hybrid` for WASM-compiled hot paths (Bag, Truth algebra) — benchmark first
- `arktype` as Zod alternative (smaller bundle, faster validation) — evaluate when Zod v4 stabilizes
- `sql.js` for browser-compatible event log (archive/export use case) — defer to actual need

---

*This plan is executable: each item has a clear anchor, acceptance bench, and rollback. No item requires TODO19 rework — it builds on the completed foundation.*