# TODO20.md — Code Quality & Robustification Plan

**Version:** 1.1 (2026-09-22; 1.0 + §5a retro + §1b review items; M4 delivered §5g) · follows TODO19.md (complete) · targets architecture debt surfaced by dpdm, test flakiness, and TODO19 retrospectives
**Philosophy:** *Fix the seams that TODO19 unified.* The builder, component library, and learning loops are in place; this plan hardens the substrate they run on — dependency graph, error taxonomy, observability, configuration, and public API surface.
**Core Principle:** *No new features. Every item reduces coupling, eliminates a failure mode, or makes a contract explicit.*

---

## 1. Phases & Items

### Phase 0 — Dependency Graph Hygiene (blocks modular testing, causes build brittleness)

- **D01. Interface layer for kernel↔drives↔nar cycle** — create `nar/src/kernel/interfaces.ts` exporting `IGateRegistry`, `IBudgetGate`, `IPerceptionGate`, `IActionGate`, `IRewardGate`, `IEventLog`; `nar/src/types/events-interfaces.ts` for `CognitiveEvent` variants. `drives/manager.ts` and `nar.ts` depend *only* on interfaces. `kernel/index.ts` implements. | anchor `dpdm` cycles 201-230 · **Delivered (revised per §5a):** `IEventLog` dropped (no consumer), `events-interfaces.ts` deleted (duplicated kernel schemas); interface configs structural, no concrete imports.
- **D02. Break `nl` → `lm` → `kernel` → `drives` → `nar` → `nl`** — `NLUnderstandingService` accepts `ILMService` (new interface in `lm/interfaces.ts`) instead of concrete `LMService`. `createLMService` returns implementation. `nl/understanding.ts` imports interface only. | anchor `dpdm` cycles 272-286
- **D03. Break `terms` → `utils` → `types` → `nl` → `lm` → `kernel` → `nar` → `terms`** — `terms/accessors.ts`, `term-edges.ts`, `validation.ts` have zero external deps; ensure they stay leaf. Move `circuit-breaker.ts` out of `utils/index.ts` barrel (it pulls `types` → `nl` → `lm`…). Create `utils/resilience.ts` barrel for circuit-breaker, retry, timeout. | anchor `dpdm` cycles 232-266
- **D04. `dpdm` gate in CI** — add `pnpm deps:check` to `test` script; fail on *new* cycles. Existing 200+ cycles documented in `docs/known-cycles.md` with justification (Phase 1-3 fixes will reduce). | anchor `.github/workflows/ci.yml` · **Delivered (revised per §5a):** `pnpm deps:gate` (`scripts/deps-gate.ts`, raw-count baseline 74) wired into CI; `pnpm test` stays plain; `docs/known-cycles.md` superseded by the baseline ledger in §5a.
- **D05. Barrel audit** — every `index.ts` barrel exports only *public* API. Internal symbols moved to `internal/` subfolders or prefixed `_`. `nar/src/index.ts` is the single public entry; `nar/src/nar.ts`, `nar/src/agent/*`, `nar/src/game/*` are public; `kernel/*`, `focus/*`, `reflex/*`, `lm/system-one/*` are internal unless explicitly re-exported. | anchor `nar/package.json` exports · **Delivered (revised per §5a):** bulk export pruning reverted (consumers exist); narrowing deferred to Phase 6 A1 with a consumer-aware grep-guard.

**Acceptance.** `pnpm deps:gate` green (raw cycles ≤ baseline 74; lower baseline as cycles are removed); `pnpm test:unit` green; no `import … from '@senars/nar/kernel/…'` in app code (only via `nar` barrel).

---

### Phase 1 — Monolith Decomposition (files >500 LOC impede review, testing, ownership)

| Target | Lines | Split Plan |
|--------|-------|------------|
| **M1. `external-tools.ts`** | 2,855 | 11 files under `tools/adapters/`: `web-search.ts`, `http-fetch.ts`, `code-exec.ts`, `filesystem.ts`, `rag-query.ts`, `coverage-concept.ts`, `human-approval.ts`, `test-gen.ts`, `test-runner.ts`, `scenario-gen.ts`, `codemod.ts`, `self-tools.ts` + `index.ts` barrel |
| **M2. `nar.ts`** | 1,265 | `NARCore` (kernel wiring), `NARAgent` (transport), `NARConfig` (options normalization), `nar-presets.ts` (factory fns) — keep `nar.ts` as facade re-exporting |
| **M3. `providers.ts`** | 1,024 | `providers/factory.ts`, `providers/llamacpp.ts`, `providers/ollama.ts`, `providers/transformers.ts`, `providers/embedded-llamacpp.ts`, `providers/mock.ts` + `providers/index.ts` |
| **M4. `lm-service.ts`** | 946 | `lm/LMService.ts` (core), `lm/admission.ts`, `lm/routing.ts`, `lm/circuit-breaker.ts`, `lm/charge-flow.ts` + `lm/index.ts` |
| **M5. `tool-registry.ts`** | 784 | `tools/ToolRegistry.ts`, `tools/decorator.ts`, `tools/execution.ts`, `tools/schemas.ts` + `tools/index.ts` |
| **M6. `perception-action-adapters.ts`** | 763 | `rl/adapters/perception.ts`, `rl/adapters/action.ts`, `rl/adapters/agent.ts`, `rl/adapters/index.ts` (reward logic already lived in `rl/reward-belief-adapter.ts`; cohesion split per §5i) |
| **M7. `LMRule.ts`** | 742 | `lm/rule/LMRule.ts` (class core), `lm/rule/response-parser.ts`, `lm/rule/{types,types-v2}.ts`, `lm/rule/index.ts` + `LMRule.ts` facade (rule-builders/rule-selectors/dynamic-rule already existed as separate files; cohesion split per §5j) |

**Acceptance.** Each split file <400 LOC; `pnpm typecheck` + `pnpm lint` + `pnpm test:unit` green; no circular deps introduced (D04 gate). *(All seven delivered — see §5c/§5d/§5e/§5g/§5h/§5i/§5j; class-core deviations recorded per split.)*

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

## 1b. Additional Architectural Items (Rev 1.1 codebase review, 2026-09-22)

Found during a targeted review of seams, boundaries, and state ownership. Each item lists
verifiable evidence; all follow the §5a binding rules (must delete a real edge, close a
failure mode, or make a contract explicit).

| # | Item | Evidence | Priority | Slot | Effort |
|---|------|----------|----------|------|--------|
| X1 | **nar imports app code** — package→app boundary violation (delivered §5b) | `nar/src/nar.ts:79`, `nar/src/agent/builder.ts:3`, `nar/src/agent/profiles.ts:1` all import `SystemOneConfig` from root `src/config/schema.js` | **High** | Before Phase 2 (trivial, unblocks packaging) | XS |
| X2 | **Kernel layering inversion** — trusted gate embeds untrusted proposer internals (**delivered §5k**) | `KernelPerceptionGate.ts` imported 6 `lm/system-one` modules: the epistemic firewall was compiled against the machinery it is supposed to be filtering | **High** | ~~Own item after Phase 2~~ | L |
| X3 | **Provider module-level mutable singletons** — parallel-unsafe, order-dependent (delivered §5b) | 11 module-level `let`/`Map` in `lm/providers.ts` (lines 55–955: `routing`, `demotions`, `circuitBreakers`, `healthProbeInterval`, `routingLog*`…) | **High** | Must land with/before Phase 2 T3 (`isolate:true` will surface these) | M |
| X4 | **Untyped event bus usage** — generic `EventBus<T>` defeated at call sites (delivered §5h) | `EventBus.on/emit` are already `<K extends keyof T>` (`util/src/events/event-bus.ts:33,58`); 14 `as never` casts in `nar/src` (mostly `tools/tool-registry.ts`, `nar.ts`) bypass them | Medium | Fold into Phase 1 M5/M2 | S |
| X5 | **Dual circuit-breaker implementations** | `nar/src/utils/circuit-breaker.ts` (generic) vs `lm/providers.ts` `ProviderHealth` machinery — independent state, semantics, and logging for the same concern | Medium | Fold into Phase 1 M4 → consolidate into `utils/resilience.ts` (per D03's original intent) | S |
| X6 | **Positional-arg constructor soup** | `NARExecution` constructor takes 13 positional params incl. a bare `undefined` slot (`nar-execution.ts:50-65`) | Medium | Fold into Phase 1 M2 (options object) | S |
| X7 | **Serialization triple-path** — three hand-rolled state codecs | `nar.ts` `saveState`/`loadState` (ad-hoc JSON files), `memory/state/serialization.ts`, `kernel/EventLogPersistence.ts` — no shared codec, no schema pinning on the snapshot path | Medium | Phase 5 (persistence hardening, alongside C1/C2) | M |
| X8 | **core↔io cycles** (5 non-nar cycles) | `Agent↔AgentBridge↔bridge/AgentBridge`, `io/bridge↔core/Agent`, `core/index↔cortex/createCortexFromLM` | Low (gated by `deps:gate`; no new cycles possible) | Phase 0 backlog, strangler-fig per Rev 1.1 rollback table | M |

**Item detail:**

- **X1** — Move `SystemOneConfigSchema` (type + zod schema) into `@senars/util/config` (or `nar/src/config`), have root `src/config/schema.ts` re-export. nar must never reach into `src/`; the dependency arrow points the wrong way for a library package. Acceptance: `grep -rn "from '\.\./\.\./src/" nar/src/` → empty; `pnpm deps:gate` unchanged.
- **X2** — Extract an `IngressJudge` interface (judge batch in → typed verdicts out); `KernelPerceptionGate` keeps only fail-closed plumbing and consumes the judge via `perceptionConfig`. All `lm/system-one` imports leave the kernel folder. This is the highest-value item in the plan: it makes the *epistemic firewall* structurally real (kernel cannot see proposer internals) instead of conventionally real. Acceptance: `grep -n "lm/system-one" nar/src/kernel/` → empty; ingress benches (15–28) unchanged; deps:gate unchanged or lower.
- **X3** — Introduce a `ProviderRuntime` instance holding routing/demotion/breaker/probe/log state; module-level default instance preserved for back-compat (`getProviderRuntime()`). Unblocks T3 `isolate:true`, enables hermetic provider tests. Acceptance: two NAR instances with different routing policies coexist in one process; `resetCircuitBreakers`-style globals replaced by scoped resets.
- **X4** — Type the bus: `ToolManager` and `nar.ts` emitters use `NarEventBus` keyed on `NAREventMap`; delete `as never`. Mechanical but makes every event contract compiler-checked. Acceptance (revised per §5h): zero `as never` casts adjacent to bus `on`/`emit` calls — the 7 surviving casts are branded-type/FFI/zod-schema workarounds unrelated to the bus.
- **X5** — One breaker abstraction under `utils/resilience.ts`; `providers.ts` health machinery wraps it. Two state machines for the same failure mode is a drift bug waiting to happen. Acceptance: single implementation file; provider circuit tests green.
- **X6** — `NARExecutionOptions` object; call sites in `nar.ts` (2) updated. Acceptance: no positional `undefined` arguments at call sites.
- **X7** — One `StateCodec` (schema-pinned, versioned) used by NAR snapshot, memory serialization, and event-log persistence consumers. Snapshot format gets a `version` field (prereq for C2 config migration's sibling: state migration). Acceptance: round-trip property test across all three paths; version mismatch fails loudly.
- **X8** — Same interface-extraction discipline as D01/D02 applied to core/io. Low urgency *because* `deps:gate` now makes the freeze enforceable.

**Phase 3 scope note (from this review):** only 2 `catch (e: any)` remain in the entire
workspace (`lm/system-one/distill.ts:117`, `nar.ts:878`). E4's acceptance is nearly met
already — Phase 3 effort should go to E2 (Result adoption) and E3 (Zod strict), not
error-type sweep.

---

## 2. Acceptance Benches (new files under `tests/nar/todo20-*.test.ts`)

| # | Bench | File | Obligation |
|---|-------|------|------------|
| 61 | **Dependency Hygiene** | `tests/nar/todo20-deps.test.ts` | `pnpm deps:gate` green (raw cycles ≤ baseline; §5a ledger); no internal imports in app code |
| 61b | **Kernel Layering** | `tests/nar/todo20-kernel-layering.test.ts` | `grep lm/system-one nar/src/kernel/` → empty; ingress benches (15–28) unchanged; `deps:gate` unchanged or lower |
| 62 | **Monolith Split** | `tests/nar/todo20-monoliths.test.ts` | Each split file <400 LOC; barrel exports only public API; typecheck+lint+tests green || 63 | **Determinism** | `tests/nar/todo20-determinism.test.ts` (delivered §5b) | seeded-RNG reproduction; RNG-free Negotiator; no bare `Math.random()` in T1 files; property tests pass; flaky file 0/20 reruns. Full 20× suite soak pending |
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
Phase 2 (moved up — DELIVERED 2026-09-22, see §5b): T1 rng  T2 flake-fix  T3 isolate  T4 prop-tests  T5 partial  (+X3 provider-runtime ✓, X1 boundary ✓)  → [x] Bench 63
Phase 1: M1 tools (DELIVERED, §5c)  M2 nar (+X6 options-obj) (DELIVERED, §5d)  M3 providers (DELIVERED, §5e)  M4 lm-service (+X5 resilience; extractors consolidated into @senars/util) (DELIVERED, §5g)  M5 tool-reg (+X4 typed-bus) (DELIVERED, §5h)  M6 rl-adapters (+T1 sweep rl/) (DELIVERED, §5i)  M7 lm-rule (+processor bus typed) (DELIVERED, §5j)  → [x] Bench 62 (19 assertions, M1–M7)   M3.5 provider unification ollama→openai-compatible (DELIVERED, §5f)  **PHASE 1 COMPLETE**

NEXT SESSION ENTRY POINT: Phase 8 — P1 bag-lcg, P2 cache metrics/LRU/FlatCache, P3 negotiator memoization, P4 param write coalescing (Bench 69 `tests/nar/todo20-perf.test.ts`; acceptance: `pnpm bench:fundamentals` ≤10% regression, Bag determinism property test, cache hit-rate >80% in arcade). Note: P1 must follow the §5i RNG-binding rule (bind a stateful RNG instance once, never construct inside the lambda). Phase 7 delivered (§5p): strict tool schemas (`z.strictObject` sweep + Registry unknown-key rejection), `code_exec` disabled-by-default + `SHELL_ALLOWLIST` + `AbortSignal` timeout + traversal-safe cwd containment, `code_exec_wasi` capability-gated sandbox tool, `LMOutputTooLargeError` size caps (`LM_MAX_OUTPUT_CHARS`), `docs/security.md` pen-test checklist, Bench 68 (`tests/nar/todo20-security.test.ts`, 14 tests).
Phase 0 (complete, revised — see §5a): D01-D05  (+X8 core/io backlog, gated)  → [x] Bench 61
Phase 2.5: X2 kernel IngressJudge (DELIVERED, §5k)  → [x] Bench 61b
Phase 3: E1 taxonomy  E2 Result  E3 zod-strict  E4 context (DELIVERED, §5l — E3 scoped to tool boundaries, see note)  → [x] Bench 64
Phase 4: O1 otel  O2 json-log  O3 health  O4 metrics (DELIVERED, §5m — see deviations: decision-level spans not GateRegistry.* spans; doctor not yet consuming health checks)  → [x] Bench 65
Phase 5: C1 schema  C2 migrate  C3 freeze  C4 secrets  (+X7 StateCodec) (DELIVERED, §5n)  → [x] Bench 66
Phase 6: A1 exports  A2 typedoc  A3 semver  A4 deprecation (DELIVERED, §5o — A2 as docs-api generator, TypeDoc blocked on TS7)  → [x] Bench 67
Phase 7: S1 validate  S2 shell  S3 wasi  S4 sanitize  (DELIVERED, §5p)  → [x] Bench 68
Phase 8: P1 bag-lcg  P2 cache  P3 negotiator  P4 param-batch  → [ ] Bench 69
Phase 9: K1 adr  K2 diagrams  K3 guides  K4 runbook  → [ ] Bench 70
```

---

## 5a. Plan Revision 1.1 (2026-09-22) — lessons from the Phase 0 retro

### What the Phase 0 retro found

An honest self-review of the first Phase 0 pass found four real defects, all fixed in the
follow-up commit:

1. **D05 was a regression, not an audit.** Removing 10 export paths from `nar/package.json`
   (`./lm/system-one`, `./reflex`, `./focus`, `./kernel`, `./tick/*`, `./capability`,
   `./stream/*`, `./gates`, `./otel`, `./config/parameter-table`) broke real consumers:
   `src/bin/status.ts` imports `@senars/nar/lm/system-one/head-specs.js`, and ~30 test
   files import the removed paths. Nothing failed because vitest/tsx resolve via tsconfig
   paths in-repo — the breakage would only surface for real package consumers.
   **All removed exports restored.** Export narrowing is deferred to Phase 6 A1 where it
   belongs, done with a grep-guard tool against actual consumers.
2. **D04 was decorative.** `dpdm` exits 0 even with cycles, so `deps:check` in CI (and the
   `deps:check &&` prefix added to `pnpm test`) gated nothing while slowing every run.
   Replaced with `pnpm deps:gate` (`scripts/deps-gate.ts`): counts raw cycles from dpdm's
   JSON report, fails only when the count exceeds the committed baseline (74 raw chains;
   the CLI's deduplicated human-readable view shows 10). `pnpm test` reverted to plain
   `vitest run`; CI's deps step now runs `deps:gate`.
3. **Type duplication.** The first pass defined `TaskBatch`/`Ambiguity` in both
   `types/events.ts` and `nl/understanding.ts`, added a speculative `events-interfaces.ts`
   duplicating `@senars/kernel/schemas` event types, and left `DEPTH_MAX` defined in both
   `types/depth.ts` and `types/primitives.ts`. All de-duplicated: single definitions,
   dead files deleted, `nl` re-exports from `types/events`.
4. **Cosmetic interfaces.** The first `kernel/interfaces.ts` type-imported the concrete
   `Kernel*Gate` classes for config shapes (so it wasn't a leaf), and `ILMService` had no
   runtime consumer of its own decoupling. Fixed: kernel interface configs are structural
   (no concrete imports), and the interface surface was trimmed to what is actually
   consumed (`IPerceptionGate` by `nar-io.ts`, `ILMService` by `nl/*`).

### What genuinely holds from Phase 0

- `types/primitives.ts` — `stamp.ts` no longer transitively pulls the whole `terms` graph.
- `utils/circuit-breaker.ts` → `@senars/util` — cuts the utils→types edge for real.
- `terms/index.ts` no longer imports the `memory` barrel (`trackTerm` re-export dropped;
  zero consumers).
- `types/events.ts` no longer imports the `nl` barrel — broke the
  `types → nl → lm → kernel → drives → types` cycle for real.
- Cycle count reduced (multiple deep chains shortened); raw count is baselined at 74.

### Binding rules added for the rest of the plan

- **Interfaces must delete a runtime import edge.** An interface whose only purpose is a
  type alias in front of a concrete class is rejected at review. Acceptance for any
  D-item: `dpdm` edge delta or grep proof that an import edge is gone.
- **No speculative exports.** Nothing is exported from a barrel without a named consumer
  (source file or documented public API).
- **One definition per type.** Where two modules need the same shape, one owns it and the
  other re-exports. Structural copies are drift bugs.
- **Gates must gate.** Any CI check added by this plan must demonstrably fail on its
  target violation (test by temporarily introducing the violation).

### Phase reorder: Phase 2 now precedes Phase 1

Justification: the flake (`todo17b-nal-arm.test.ts`, `property-based.test.ts`) was
observed twice during this session's verification runs. Monolith splits (M1–M7) are the
highest-churn items in the plan and need a trustworthy green baseline to verify against.
Fixing determinism first (T1 RNG injection, T2 flake fix) makes every later phase's
verification reliable. Bench 63 precedes Bench 62.

### Baseline ledger (update when lowering)

| Metric | Baseline | Source |
|--------|----------|--------|
| Raw dependency cycles | **72** (lowered by M3: two provider cycles deleted; gate BASELINE lowered to 72) | `pnpm deps:gate` / dpdm JSON `circulars` |
| Deduplicated cycle chains (human view) | 10 | `pnpm deps:check` stdout |

---

## 5b. Phase 2 delivery note (2026-09-22)

**Delivered:** T1, T2, T3, T4 (all four new domains), X1, X3; Bench 63 (`tests/nar/todo20-determinism.test.ts`).
**Partial:** T5 — the load-sensitive/PR CI split already exists (`test:unit` vs `test:load-sensitive` jobs in
ci.yml, plus the dedicated `systemone-benches`/`arcade-benches` jobs); explicit `@tag` test-name taxonomy is
deferred until the next bench authoring pass (file-based separation is functionally equivalent today).

### What landed, and where it diverged from the plan text

- **T1** — `RandomSource` type lives in `types/primitives.ts`; `BagOptions.rng` (default `Math.random`) feeds
  `sample()` + `evict('Random')`; `SchemaInductionConfig.rng` for schema ids. **`Negotiator.ts` contains no
  `Math.random` at all** (plan named it defensively) — veto resolution is pure; Bench 63 pins that with a grep.
- **T2** — the inline `vi.spyOn` LCG in `todo17b-nal-arm.test.ts` moved to the shared `tests/helpers/rng.ts`
  (`createLCG`/`pinDeterministicRNG`/`restoreRNG`/`withDeterministicRNG`). Falsified: 20 consecutive runs of the
  previously flaky file, 0 failures. The other flake named in §5a (`property-based.test.ts`) runs green in-suite.
- **T3** — `isolate: true` alone was insufficient: under the threads pool each worker re-imports
  `onnxruntime-node` per test file and the N-API binding fails to self-register twice in one process (4 suites
  died). **Pool switched to `forks`** — per-file processes, native modules load once, fully hermetic. Suite cost
  ~39s (was ~37s). `todo16c-cache` Bench 17 broke its own 200 ms threshold because `expect()` sat inside the
  10k-read hot loop; assertions hoisted out (miss-counter) — measurement now honest and cold-start-stable.
- **T4** — `tests/nar/property/{narsese-roundtrip,truth-algebra,parameters,games}.test.ts`. **Found a real bug on
  the first run**: the PEG parser rejected the serializer's own `(A & B)` / `(A | B)` infix output (it only knew
  `&&`, `||`, `,`, and prefix `&`/`|`). Fixed in `narsese.peggy` (added `&`/`|` to `InfixOperator` + kindMaps),
  regenerated `peggy-generated.cjs`; legacy syntaxes verified unchanged. fast-check gotchas for future authors:
  float bounds must be f32-exact (`Math.fround`, and `fround(0.999)` rounds *up* past the true max — see
  `f32Floor` in truth-algebra.test.ts); `Truth` fields are `f`/`c`; zero-confidence truth is degenerate (division
  by zero weight in revision) and excluded from algebra laws.
- **X1** — `systemOneDefaults`/`systemOneSchema`/`SystemOneConfig` moved to `@senars/util/config`
  (`util/src/config/system-one.ts`); root `src/config/schema.ts` re-exports (single definition, §5a rule).
  `nar/src/{nar,agent/builder,agent/profiles}.ts` now import from `@senars/util/config`.
  Acceptance met: `grep -rn "from '\.\./\.\./src/" nar/src/` → empty; deps:gate unchanged (73).
- **X3** — `nar/src/lm/provider-runtime.ts`: `ProviderRuntime` class owns routing policy, demotions, last
  routing decision, circuit breakers (+ trip/half-open/close with OTel + Prometheus emission), health-probe
  handle, and the routing telemetry log — plus the remaining providers.ts singletons (file settings, WebLLM
  runtime, builtin progress callback). `getProviderRuntime()` backs the unchanged module-level API; every
  provider function takes an optional trailing `runtime` param for scoping. `LMService` accepts a scoped
  runtime (3rd ctor arg / `createLMService({ providerRuntime })`). Two instances with different routing
  policies now coexist in one process (Bench 63 + routing tests falsify). **Type placement driven by cycle
  avoidance**: `LMProviderName` + the canonical `CircuitBreakerConfig` live in `env-config.ts` (the leaf);
  `WebLLMRuntime` in provider-runtime.ts; providers.ts re-exports all of them — no new cycles, raw count
  dropped 74 → 73.

### Remaining work / follow-ups

1. **Math.random sweep (T1 acceptance stretch).** Still bare in: `memory/links/LinkBag.ts`, `nl/generation.ts`,
   `rlfp/{PolicyOptimizer,RewardModel}.ts`, `strategies/derivation/SampledDerivation.ts`,
   `tools/adapters/self-tools.ts`, `tools/manager.ts` (`resolveConflict('random')`),
   `reflex/{TabularQReflex,EpsilonGreedyReflex}.ts`, `imagination/treadmill.ts`,
   `events/bridge.ts`, `lm/system-one/telemetry.ts`. Mechanical; do opportunistically during M4/M5/M6 splits.
2. **Full 20× `pnpm test:unit` soak** for the formal Bench 63 acceptance (single full runs green; the 20× was
   done on the known-flaky file only).
3. **T5 tags**: adopt `@load-sensitive`/`@deterministic` name tags when benches are next authored; wire the
   nightly job then.
4. **PEG grammar hygiene**: `kindMap` is duplicated across `AngleBracketStatement`/`ParenthesizedStatement`;
   consider hoisting to a shared rule during M2.

---

## 5c. Phase 1 delivery note — M1 (2026-09-22)

**Delivered:** M1 — `external-tools.ts` (2,855 LOC) decomposed into `tools/adapters/` modules; Bench 62 authored
(`tests/nar/todo20-monoliths.test.ts`, M1 assertions green). `pnpm test:unit` full suite green (1,791 tests);
`pnpm lint` clean; `pnpm typecheck` clean except the 10 pre-existing wasi/`__pb2` errors (verified identical on
HEAD via stash before starting); `pnpm deps:gate` **improved 73 → 72** (ledger updated).

### File map (all <400 LOC, verified by Bench 62)

- One file per tool family: `web-search.ts`, `http-fetch.ts`, `code-exec.ts`, `filesystem.ts`,
  `rag-query.ts`, `coverage-concept.ts`, `human-approval.ts`, `test-gen.ts`, `test-runner.ts`.
  The plan's "11 files" undercounted — `self-tools` and `scenario-gen` each needed a second cut:
- `codemod.ts` — `runCodemod` is now **exported** (self-tools consumes it; was file-private).
- `shadow-worktree.ts` — `ShadowWorktreeManager` extracted from self-tools.
- `self/context.ts` — `SelfToolsDeps` + `SelfToolsContext` (deps/shadowManager/worktreeId);
  `self/{register-rule,register-tool,scaffold-capability,apply-fix,tune-knob,switch-strategy,shadow-run}.ts`
  each export a `(ctx) => tool({...})` builder; `self-tools.ts` is a ~35-LOC composer.
- `scenario-gen.ts` (types + `createScenarioGenTools`) + `scenario-execute.ts` (validators, spec
  generation, `runScenario`, reward calc); `scenario-gen` re-exports the public scenario types so the
  barrel surface is unchanged.
- Dead code removed: `_resolveSemanticArgs` in self-tools was defined and never called anywhere.
- Only consumer-visible change: `nar/src/nar.ts` imports `createSelfTools` from
  `./tools/adapters/self-tools.js` (was `external-tools.js`). Barrel exports are byte-identical in
  symbol set — note `createHTTPFetchTools` was *never* barrel-exported (§5a rule) and still isn't.

### Lessons for the remaining splits (M2–M7)

- `biome check --write --unsafe` removed a non-null assertion that typecheck then rejected — after any
  unsafe autofix, re-run `pnpm typecheck` before trusting the diff.
- The original monolith's private helpers (e.g. `runCodemod`) may need exporting when consumers land in
  sibling files; prefer exporting a helper over duplicating it.
- tsconfig has no `noUnusedLocals`; rely on biome `noUnusedImports`/`noUnusedVariables` + the barrel
  guard to keep split files clean.
- Extract-then-fix-imports workflow (split → prepend old import block → typecheck → prune unused) took
  ~30 min for 2.9k LOC; budget similar per monolith.

### M1 follow-ups / improvement opportunities

- Bench 62 currently asserts only the M1 slice; extend it with per-split assertions (e.g. `nar.ts` facade
  LOC, `providers/*` file list) as M2–M7 land. *(M2 assertions added in §5d.)*
- The 8 `self/*` tool builders share a near-identical worktree acquire/validate/cleanup preamble —
  a `withShadowWorktree(ctx, suffix, fn)` helper would cut ~80 LOC; deferred to avoid behavior drift in
  this split.
- `scenario-execute.ts` (388 LOC) is close to the 400 ceiling; the validators array is the next
  extraction candidate if it grows.

---

## 5d. Phase 1 delivery note — M2 (2026-09-22)

**Delivered:** M2 (revised) + X6. `nar.ts` 1,267 → 839 LOC via extraction of three cohesive subsystems
into `nar/src/nar/`; public API unchanged (same class, same exports, `NARConfig` re-exported so
`agent/builder.ts` and `index.ts` imports are untouched). X6: `NARExecution` now takes a
`NARExecutionOptions` object; all 13 call sites (2 in `nar.ts`, 12 across `nar-execution.test.ts` /
`state-persistence.test.ts`) converted — no positional `undefined` slots remain (Bench 62 guards it).
**X4 (typed bus) deferred to M5** — its 14 `as never` casts live across 11 files with 4 in
`tool-registry.ts`; doing it here would have spread the diff without its natural anchor.

### What was extracted

- `nar/config.ts` (68) — `RLFPConfig`, `SystemOne*Config`, `NARConfig` types + `validateNarConfig` +
  `createAttentionModel` (both were NAR methods, now free functions).
- `nar/system-one.ts` (281) — `SystemOneRuntime`: the six `_systemOne*` fields, the 150-line init,
  `enabled`, `attachManifoldReflex`, `attachLMReflex` (with config-driven budgets preserved). NAR
  constructs it with an `onJudgmentResolved` callback; telemetry emitter + bus stay in NAR.
- `nar/games.ts` (96) — `GameManager`: `attachedGames`/`gameFocusBag`/`metaGame` state and
  `getFocusBag`/`attachGame`/`detachGame`/`getAttachedGames`/`getSelfMetaGame`.
- `nar/persistence.ts` (147) — `StatePersister`: `saveState`/`loadState` + task (de)hydration, driven by
  an explicit `StatePersisterDeps` (memory/query/processor/driveManager/attentionReport) instead of `this`.

### Honest deviations

- **`nar.ts` facade is 839 LOC, not <400.** The remainder is the `NAR` class itself: constructor wiring
  (~120), ~60 one-line accessors that are the public aggregate API, and query/report methods. Pushing
  below 400 means slicing the class into delegation-heavy segments — churn without a seam payoff.
  Bench 62 asserts `<900` for the facade and `<400` for extracted modules instead. Revisit if a real
  seam (e.g. query facade) emerges during later phases.
- **Cycle count drifted 72 → 74** during M2 (still ≤ baseline 74). Verified `dpdm` JSON: **zero cycles
  touch `nar/src/nar/`** — the drift is pre-existing chains re-linking as `nar.ts` imports moved, not new
  cycles from the split. Ledger stays at 74 until a phase lowers it; consider making deps-gate print the
  delta breakdown (files added/removed from cycles) to make this checkable at review.

### Verification

`pnpm typecheck` clean (0 new errors), `pnpm lint` clean, `pnpm test:unit` green (1,792 tests),
`deps:gate` ok, Bench 62 6/6.

### M2 follow-ups / improvement opportunities

- `nar-lm.ts` / `nar-io.ts` accessors could take the SystemOneRuntime directly instead of three getter
  closures in NARLM's options — small cleanup when M4 touches `lm-service`.
- `SystemOneRuntime.enabled` is defined as `dispatcher !== undefined`; NAR's `isSystemOneEnabled`
  delegates to it — keep that definition authoritative when X2 (IngressJudge) reworks the kernel seam.
- The two `new NARExecution` sites in `nar.ts` build identical options except `cognitiveController` —
  a private `buildExecutionOptions()` would DRY them.

### New improvement opportunities (§5b, from the Phase 2 pass)

- `serialize → parse` round-trip is now property-guarded — extend the generator to higher-order terms
  (variables, sets, images) when the grammar is next touched.
- `provider-runtime.ts` is the natural seam for M4's resilience consolidation (X5): provider health machinery
  already sits behind one class.
- vitest `forks` pool removed a whole class of native-module and module-order flakes — keep `isolate: true`
  non-negotiable in review; any test relying on module-load order is now a bug by construction.

---

---

## 5e. Phase 1 delivery note — M3 (2026-09-22)

**Delivered:** M3 — `providers.ts` (815 LOC) decomposed into `lm/providers/` modules, all <400 LOC;
`providers.ts` is now a facade barrel whose export surface is **verified symbol-identical** to the
original (script-checked against `git show HEAD:...`). **Two dependency cycles deleted: 74 → 72**;
`deps-gate` BASELINE lowered to 72 in the same commit (per the script's own rule). Verified: typecheck
0 new errors, lint clean, full `test:unit` green (1,795), Bench 62 extended to 8 assertions.

### File map

- `providers/settings.ts` (10) — `configureLM`/`getLMSettings`/`getLmProvider` (leaf).
- `providers/webllm.ts` (22) — `configureWebLLM`/`getWebLLMRuntime`/`detectDevice`.
- `providers/capabilities.ts` (~85) — `ModelCapability`, `MODEL_CAPABILITIES`, `latencyClassOf`.
- `providers/routing.ts` (~170) — routing policy/demotions, R4 scoring (`pickModel`/`pickBestModel`),
  offline ladder, routing-telemetry delegation.
- `providers/chains.ts` (~140) — `CHAINS`, `getModelChain`, `getModelForTask`, `hasCloudCredentials`.
- `providers/health.ts` (~185) — probes, circuit-breaker delegates, health-probe loop.
- `providers/model-factory.ts` (~250) — `createSeNARSRegistry` (the factory), model constructors
  (`localModel`/`mockModel`/`cloudApiKey`), builtin progress callback, **and `createMockLanguageModel`**
  (moved here from `lm-service.ts` — see cycles below).

### Cycle deletions (§5a binding rule satisfied — real edges gone)

1. **lm-service ↔ providers**: `createMockLanguageModel` lived in `lm-service.ts` but the factory
   needed it; `lm-service` also imports chains from `providers`. Moved the mock model into
   `model-factory.ts` with a self-contained `extractTextFromPrompt` (no `extractLastUserMessage`
   dependency); `lm-service` re-exports it so `lm/index.ts` consumers are unchanged.
2. **embedded-llamacpp → providers barrel**: `getLMSettings` now imported directly from
   `./settings.js` — the embedded provider no longer reaches through the facade that imports it.

Bench 62 grep-guards both edges so they cannot silently return.

### Gotchas for M4

- `biome check --unsafe` also deleted the `private progressCallback` field in `lm-service.ts` as
  "unused" (it's ctor/setter-assigned). Re-added. Same class of breakage as the non-null-assertion
  removals in §5c — re-run typecheck after every unsafe fix.
- The mock model's `extractTextFromPrompt` replacement extracts the last user text piece directly;
  `extractLastUserMessage` in `lm-service.ts` remains for LMService's own paths — two similar helpers
  now exist; consolidate into `@senars/util` during M4.
- The plan's original M3 filenames (`factory/llamacpp/ollama/transformers/embedded/mock`) didn't map
  to the real content (per-provider creation lives inside `createSeNARSRegistry`, llamacpp/embedded
  already had their own files). Split followed cohesion instead — record the same deviation when
  doing M4–M7.

---

## 5f. Provider unification — `ollama` → `openai-compatible` (2026-09-22, user-directed)

**Change:** the `ollama` provider is removed as a distinct lane; it was always
`createOpenAICompatible` pointed at `localhost:11434`. Per A4's deprecation lifecycle, `ollama`
survives as an **alias resolved at the settings boundary** (`LM_PROVIDER=ollama` and the `ollama`
profile both resolve to `openai-compatible` with `baseUrl = OLLAMA_HOST ?? :11434/v1` and default
model `llama3.2`). Nothing downstream sees `'ollama'` — grep-guarded by the type union.

### What was removed / changed

- `model-factory.ts`: the `local` registry lane (ollama slots) is gone; `openai-compatible` slots now
  register **without requiring an API key** (local daemons are the primary use) and default to
  `http://localhost:11434/v1` when no `baseUrl` is set. anthropic/openai keep the credential gate.
- `chains.ts`: `ollama` key and all `local:*` failover rungs removed (cloud lanes fall back
  cloud → builtin → mock).
- `capabilities.ts`: `local:*` entries removed (`localCap` kept — builtin spreads it).
- `health.ts`: `probeOllama` (ollama's `/api/tags`) replaced by **`probeOpenAICompatible`** — generic
  `/models` probe, auth header only when a key exists. `resolveActiveProvider` and the health-probe
  loop updated; `PROVIDER_CIRCUIT_DEFAULTS.ollama` folded into openai-compatible.
- `doctor.ts`: keeps the standalone local-daemon probe (diagnostic), relabelled
  "Ollama daemon (local OpenAI-compatible)"; `ollama` removed from the typed provider matrix.
- `.env.example`, `README.md`, `docs/lm-ladder.md`, conversational harness updated.
- `OLLAMA_MODEL`/`OLLAMA_HOST` env vars keep working through the alias.

### Follow-ups
- `senars.config.json` has `production.provider: "vercel"` — not a valid `LMProviderName`; it only
  passes because file providers are `z.string()`. Tighten to the enum during Phase 5 C1.
- The provider matrix now: transformers (builtin, default) · openai-compatible (any OpenAI-shaped
  server incl. local daemons) · llamacpp · llamacpp-embedded · anthropic · openai · webllm (browser) ·
  mock. All nine-lane capabilities preserved under eight lanes.

---

## 5g. Phase 1 delivery note — M4 (2026-09-22)

**Delivered:** M4 — `lm-service.ts` (901 LOC) decomposed into `lm/service/` modules; X5 resolved;
prompt-extraction helpers consolidated into `@senars/util` (§5e follow-up). `lm-service.ts` is now a
~20-LOC facade whose export surface is unchanged (lm/index.ts, rules, tests untouched).
Verified: typecheck 0 new errors, lint clean, full `test:unit` green (1,801), deps:gate 72 ok,
Bench 62 extended to 12 assertions.

### File map

- `service/errors.ts` (71) — `LMUnavailableError`, `withHint`/`LADDER_HINTS`, `isTransportError`, `withRetry`.
- `service/cache.ts` (68) — `buildCacheKey` + `ResponseCache` class (TTL sweep-on-write, D16 semantics preserved).
- `service/spend.ts` (62) — `ProviderSpend`, `SpendLedger` class (record/snapshot, LM_MAX_SPEND_USD hard cap).
- `service/mock.ts` (149) — `MockLMServiceImpl` + `createMockLMService` (mirror of M3's mock-model move).
- `service/structured.ts` (~60) — `generateObjectViaText` as a free function over a `generateText` seam.
- `service/LMService.ts` (498) — the core class; routing-decision logging consolidated into one
  `logRoutingDecision(task, start, success, provider)` helper (was 5 copies).
- `lm-service.ts` (20) — facade barrel.

### X5 (dual circuit breakers) — resolved by *placement*, not wrapping (deviation from X5 text)

The plan proposed wrapping `providers.ts` health machinery around the generic `CircuitBreaker`.
Reality: the two implementations serve different contracts. The generic one
(`nar/src/utils/circuit-breaker.ts`, sole consumer `LMRule.ts`) is a call-scoped
execute/retry breaker; `ProviderRuntime`'s per-provider health is state-scoped routing
infrastructure with metrics/OTel/demotion semantics that the generic class lacks. Forcing a
wrapper would be churn without an edge deleted (§5a binding rule). What landed instead:
`nar/src/utils/resilience.ts` is now the single home of the generic breaker (D03's intent),
`utils/index.ts` re-exports from it, and Bench 62 grep-guards the placement. The drift risk
X5 named is bounded by the domain split: call-scoped vs provider-scoped never share state.

### Consolidations

- `extractLastUserMessage` moved to `util/src/utils/prompt.ts` (`@senars/util`); the two near-duplicates
  `extractTextFromPrompt` (model-factory, embedded-llamacpp) deleted in favor of it (join-all-text
  semantics; equivalent for mock-key and llama-session use). Bench 62 guards: no local extractors in lm/.
- Bonus cycle fix surfaced by deps:gate: `agent/builder.ts` imported `CreateAgentConfig` from
  `agent/index.ts` (which imports builder) — moved the interface to `nar/src/agent/config.ts`,
  index re-exports. deps:gate initially failed at 73; config extraction restored 72.

### Honest deviation

`service/LMService.ts` is 498 LOC (>400). The generate/object/stream paths share dense stateful
context (cache, ledger, runtime, per-model stats); slicing further means delegation-heavy plumbing.
Bench 62 asserts <520 for the core, mirroring the M2 facade precedent. `runInGrammarScope` and the
stream retry loop are the next extraction candidates if it grows.

### Gotchas for M5+

- White-box tests reach into LMService internals (`tests/nar/todo17b-bounded.test.ts` D16 touches
  `svc.cache`) — when moving private state into helper classes, update those access paths (`svc.cache.set()`
  → inner map), not just the class.
- `withRetry` is now exported from the facade — no consumer outside service/ yet; prune if none appears
  (§5a no-speculative-exports rule) at the next touch.
- `agent/config.ts` is the pattern for breaking barrel-import cycles: shared types go in a leaf file,
  the barrel re-exports.

## 5h. Phase 1 delivery note — M5 (+X4) (2026-09-22)

**Delivered:** M5 — `tool-registry.ts` (784 LOC) decomposed into four cohesive modules with
`tool-registry.ts` as a facade barrel (export surface unchanged); **X4 typed bus landed** —
`ToolManager` now takes `EventBus<NAREventMap>` and all bus `as never` defeats are gone.
Verified: root `pnpm typecheck` 0 errors, lint clean, full `test:unit` green (1,803), deps:gate 72 ok,
Bench 62 extended to 14 assertions.

### File map

- `tools/registry.ts` (~230) — `Registry` (storage + arg/result validation) + `ToolDescriptor` type.
- `tools/manager.ts` (~340) — `ToolManager` (lifecycle, permissions, budgets, statistics, feedback,
  history, typed emit/on).
- `tools/goal.ts` (~190) — `executeToolGoal` + Narsese `^tool(args)` parsing, `extractArgsFromProduct`,
  `termToValue`, `resolveSemanticArgs`; operates on a minimal `ToolExecutor` interface instead of the
  whole manager (goal logic needs only `get`+`execute`).
- `tools/core-adapter.ts` (~85) — `CoreToolRegistryAdapter` (core's `ToolRegistryDelegate` bridge).
- `tool-registry.ts` (10) — facade barrel; consumers (`tools/index.ts`, tests) untouched.

### X4 — what landed, and the honest scope ruling

- **New leaf type**: `NarEventBus extends EventBus<NAREventMap>` lives in `nar/src/types/events.ts`
  (next to the map it keys on) and re-exports through `types/index.ts`. `nar.ts`, `nar-presets.ts`,
  `BaseComponent` now use it — the `EventBus as NarEventBus` aliasing pattern is deleted.
- **`ToolManager` typed**: ctor/setter take `EventBus<NAREventMap>`; private `emit<K>()` and public
  `on<K>()` are compiler-checked against `NAREventMap`. Zero casts in the four split modules.
- **Side fixes pulled in by the type change** (each deleted a cast or a loose type):
  `NAREventMap['tool:result'|'tool:error']` made optional-field-honest to match `ToolEvent`;
  `ReasoningTrajectoryLogger` typed on its own `TrajectoryEventMap` (extends `Record<string, unknown>`
  to satisfy the bus constraint); `ConsolidationOptions.type` tightened `string → EpisodeType`;
  `ExtendedAgent.chat` opts tightened `unknown → ChatOptions` (from `@senars/core`).
- **Scope ruling on the original "→ 0 casts" acceptance**: of the 14 casts, 4 were bus defeats in
  tool-registry (deleted) + 1 in ReasoningTrajectoryLogger + 1 in agent/index (typed away). The 7
  survivors are **not** bus casts: branded-type jumps (`createIsotonicCalibrator` rubric/version),
  FFI option objects (transformers.js embedding, llamacpp grammar), `z.toJSONSchema`, a structurally
  unavoidable `ParameterTable.set` never-return, and a merge-assign. Deleting them requires
  reworking the branding/FFI seams, not the bus — out of X4's contract. Bench 62 now greps for
  `as never` adjacent to bus `on`/`emit` instead of a raw count.

### Notes for M6/M7

- `ToolManager.on()` is now public typed API — consumers can subscribe with full inference; keep the
  `NarEventBus` subclass as the canonical injection type everywhere (deprecate bare `EventBus`
  injections opportunistically).
- The plan's original M5 filenames (`ToolRegistry/decorator/execution/schemas`) didn't map to the
  content — `decorator.ts` and `schemas.ts` already existed as separate files, and the registry/
  execution logic is one cohesive validation unit. Split followed cohesion (same deviation as M3/M4).
- `resolveConflict('random')` still uses `Math.random` (§5b sweep list should add `tools/manager.ts`).

## 5i. Phase 1 delivery note — M6 (+T1 rl sweep) (2026-09-22)

**Delivered:** M6 — `rl/perception-action-adapters.ts` (763 LOC) decomposed into `rl/adapters/`
modules; T1 `Math.random` sweep completed for the whole `rl/` family. `rl/adapters.ts` facade and
`rl/index.ts` unchanged (6 parity test files import `rl/adapters` untouched). Verified: root
typecheck 0 errors, lint clean, full `test:unit` green (1,806), deps:gate 72 ok, Bench 62 extended
to 17 assertions. RL parity suites re-run explicitly (parity-restoration 2×, parity/ + budgetgate).

### File map

- `adapters/perception.ts` (~90) — `BeliefPerceptionAdapter`, `RLObservation` (+config types).
- `adapters/action.ts` (~330) — `GoalActionAdapter`, `NativeActionSelector`, and the three
  selectors (`BanditSelector`, `GridWorldSelector`, `NonStationarySelector`).
- `adapters/agent.ts` (~330) — `NativeSenarsAgent` + `BanditNativeAgent`/`GridWorldNativeAgent`/
  `NonStationaryNativeAgent`; `gridStateId`/`armTools` helpers DRY the base-class boilerplate.
- `adapters/index.ts` — barrel; `rl/adapters.ts` (facade) re-exports it alongside
  `q-belief-store`/`reward-belief-adapter`/`parity-harness`.
- **Plan deviation (recorded):** no `rl/adapters/reward.ts` — reward logic already lived in
  `rl/reward-belief-adapter.ts` (127 LOC); duplicating it would violate one-definition-per-type.

### T1 sweep (rl/ family closed)

- Selectors take `rng?: RandomSource` (default `Math.random`) per the T1 convention;
  `GridWorldSelector`'s `seed: number | RandomSource` keeps its existing positional signature.
- `QBeliefStore(nar, rng?)` — `getBestAction` tie-breaking now injectable.
- `rl/` now has **zero bare `Math.random`** outside injected defaults (Bench 62 grep-guards it).

### Bug caught by the parity suites (lesson)

The first `GridWorldSelector` rng adapter wrote `() => new SeededRNG(seed).next()` — a fresh
instance per call, so the LCG state reset every draw and GridWorld parity collapsed (ratio
-0.32 vs ≥0.7 threshold). Fix: create the instance once, close over it. **Rule: when adapting a
stateful RNG to a `RandomSource` callback, bind the instance, never construct inside the lambda.**
The parity tests are the safety net that makes this refactor safe — run them before claiming M6 done.

### DRY additions in the split

- `topPendingGoal(nar, pattern)` — replaces 3 copies of pending-goal scan + priority sort.
- `armIndexOf(termStr)` — replaces 5 copies of the `pull_arm_(\d+)` parse.
- `gridStateId(env)` / `armTools(n)` — replace 2× duplicated base-class helpers.

### Notes for M7

- Same facade pattern: keep `LMRule.ts` as re-export barrel; `lm/index.ts` consumers untouched.
- White-box tests may reach into LMRule internals (§5g gotcha) — check `todo17b-*` tests first.
- The `NativeActionSelector` interface is the seam if arcade benches ever need a non-seeded
  policy — no action needed, just noting the shape.

## 5j. Phase 1 delivery note — M7 (2026-09-22) — PHASE 1 COMPLETE

**Delivered:** M7 — `LMRule.ts` (742 LOC) decomposed into `lm/rule/` modules with `LMRule.ts` as a
facade barrel (export surface unchanged: `lm/index.ts`, `dynamic-rule.ts`, `rule-builders.ts`,
`lm-rule-factory.ts`, `enrichment.ts`, `rule-selectors/*` all import `./LMRule.js` untouched).
Side fix: `RuleProcessor.eventBus` typed `NarEventBus` (was generic `EventBus`, failed to flow into
the now-typed `LMRule.setEventBus` — X4 ripple, in scope). Verified: root typecheck 0 errors, lint
clean, full `test:unit` green (1,808), deps:gate 72 ok, Bench 62 extended to 19 assertions.

### File map

- `rule/types.ts` (~18) — `LMContext`, `ValidationResult` (shared context shapes).
- `rule/types-v2.ts` (~22) — `LMRuleConfigV2` (leaf; imports `LMRuleConfig` from `@senars/util` via
  `lm-service` re-export).
- `rule/response-parser.ts` (~110) — `LMResponseParser`, `ParsedLMResponse`, `StructuredLMOutput`
  (pure functions, no LMRule dependency — inverse direction, so no cycle).
- `rule/LMRule.ts` (~630) — the class core.
- `LMRule.ts` (~12) — facade barrel.

### Honest deviation

`rule/LMRule.ts` is 628 LOC (>400). The class is one dense stateful unit (breaker + stats + bus
plumbing + prompt/response pipelines); slicing the private method cluster into a helper would need
~12 fields passed per call — churn without a seam payoff, same ruling as M2's facade and M4's core.
Bench 62 asserts <650 for the core.

### Plan deviation (recorded)

The plan's M7 filenames (`base/rule-builders/rule-selectors/dynamic-rule`) didn't map to reality —
`rule-builders.ts`, `rule-selectors/`, and `dynamic-rule.ts` already existed as separate modules
consuming `LMRule.ts`. The monolith's actual extractable units were the parser and the type
declarations. Split followed cohesion (same deviation as M3/M4/M6).

### X4 ripple

`RuleProcessor.setEventBus`/`registerLMRule` now require `NarEventBus`; `nar.ts` already passes one.
This closes the last untyped-bus injection point in the rule pipeline.

### Phase 1 wrap-up

All seven monoliths decomposed: M1 tools (§5c), M2 nar (§5d), M3 providers (§5e), M4 lm-service
(§5g), M5 tool-registry (§5h), M6 rl-adapters (§5i), M7 lm-rule (§5j) — plus M3.5 provider
unification (§5f). Cycle count 74 → 72 across the phase (M3 deletions, M4 config extraction).
Bench 62 is the per-split guard (19 assertions: LOC budgets, facade surfaces, cycle grep-guards,
typed-bus and RandomSource sweeps). Next: Phase 2.5 X2 (IngressJudge), then Phase 3.

## 5k. Phase 2.5 delivery note — X2 IngressJudge (2026-09-22)

**Delivered:** X2 — the epistemic firewall is now structural. `KernelPerceptionGate.ts` has **zero**
`lm/system-one` imports (grep-guarded by Bench 61b, `tests/nar/todo20-kernel-layering.test.ts`);
the six system-one touches (ingress queries, `ConfidenceRouter`, `seedTruth`, telemetry
emitter/sinks, manifold types, dead `createProvisionalStamp`) moved into
`lm/system-one/ingress-judge.ts` (`SystemOneIngressJudge`). Verified: typecheck clean, lint
clean, full `test:unit` green (1,811), deps:gate 72 ok; ingress/telemetry/fail-closed/enabled-path
suites green unchanged.

### Shape of the boundary

- `kernel/ingress.ts` (leaf) — `IngressJudge { judge(req) → IngressVerdict; setEventSink?(push) }`,
  `IngressJudgmentRequest { rawObservation, sourceQuality, baseConfidence, taskType }`,
  `IngressVerdict { vetoReason?, taskType?, ambiguityFlag?, sourceQuality?, confidence, truth }`.
  Contract: judge throws on internal fault → gate rejects fail-closed (D1 message + policy.violation
  telemetry preserved byte-for-byte).
- `KernelPerceptionGate` config: `systemOne: { enabled, judge? }` — manifold/embeddingCache/budget/
  provisional fields removed. Gate wires `judge.setEventSink` in its ctor so judgment.resolved
  telemetry still lands in the gate event log (todo16-telemetry behavior unchanged).
- `nar.ts` builds the judge from `SystemOneRuntime` (manifold + cache + budget) and injects via
  `gates.initialize({ perceptionConfig })`. `kernel/interfaces.ts` `PerceptionGateInitConfig`
  updated to match.

### Dead code found and removed

The old gate computed `illocution` and `occurrenceTime` from the judge results and stored
`systemOneProvisionalConfig` — **none had any consumer** (task payload never carried them;
`createProvisionalStamp` was imported and never called; provisional config only ever reached the
dispatcher via `SystemOneRuntime`, which is untouched). Dropped at the boundary, not migrated.

### Test migration (mechanical, 3 files)

`todo17b-failclosed` (D1), `todo16-enabled-path`, `todo16-telemetry` now construct
`new SystemOneIngressJudge({ manifold, embeddingCache, budget })` and pass it as
`systemOne.judge`. Rule of thumb for future kernel-boundary work: tests of the *plumbing* import
the kernel; tests of the *judgment* import the judge.

### Follow-ups / improvement opportunities

- Bench 61b's fault-injection case duplicates `todo17b-failclosed` D1 — if D1 is ever relaxed,
  both must move together (the grep-guard alone doesn't pin fail-closed semantics).
- `IngressVerdict` could later carry `illocution`/`occurrenceTime` *with consumers* (e.g. task
  payload enrichment) — do not re-add without a named consumer (§5a rule).
- The `as never` casts in `SystemOneIngressJudge` ctor call sites are test-side fake manifolds —
  the X4 bus-cast ruling does not apply; branded `EmbeddingPointer` cast lives in the judge now.
- `ingress.ts` + `interfaces.ts` are both kernel leaves; if more judge-like boundaries appear
  (egress groundedness is a candidate), consider one `kernel/boundaries/` folder before it accretes.

## 5l. Phase 3 delivery note — E1/E2/E3/E4 (2026-09-22)

**Delivered:** E1 taxonomy, E2 `Result`, E3 (scoped), E4; Bench 64 (`tests/nar/todo20-errors.test.ts`).
Verified: typecheck clean, lint clean, full `test:unit` green (1,826), deps:gate 72 ok.

### What landed

- **E1** — `nar/src/errors/index.ts` (public via nar barrel): `BuilderError {step}`,
  `GateError {gate, reason, operation}` + per-gate subclasses (`Perception/Action/Budget/RewardGateError`),
  `BoundaryValidationError {path, issues}` (+`fromZod`), `BudgetExceeded {scope, operation, limit, consumed}`,
  `DigestMismatch {expected, actual, artifact}`, `SchemaInductionError {phase}`.
  Base `SenarsError` (code + context + `toJSON`) already lived in `@senars/util/errors` — single
  definition honored; new `ErrorCode` literals (`BUILDER_ERROR`, `GATE_DENIED`, `BUDGET_EXCEEDED`,
  `DIGEST_MISMATCH`, `SCHEMA_INDUCTION`) and the **static `SenarsError.wrap(err, ctx, code?)`**
  (E4 context enrichment, cause-chain preserving) were added there. `CrossDomainError` stays in
  `learning/domain-learners.ts` (pre-existing; one definition).
- **E2** — `nar/src/utils/result.ts` is the canonical `Result<T, E>` (`ok/err`, `isOk/isErr`,
  `map/flatMap/getOrElse/unwrapOrThrow`, `attempt/attemptAsync`). The old `success/failure/`
  `isSuccess/isFailure` shapes in `types/core.ts` had exactly one consumer (a unit test) — replaced
  with a re-export from the canonical module; barrels (`types/index.ts`, `nar/src/index.ts`)
  updated. Adoption kept low-churn per the Phase 3 rollback trigger: `StatePersister.readJsonIfExists`
  now returns `Result<T | null, Error>` (ENOENT → `ok(null)`, IO faults → `SenarsError.wrap`); tool
  execution rethrows `SenarsError.wrap(error, { tool, operation }, 'TOOL_ERROR')`.
- **E1 rebase** — `agent/builder.ts` `BuilderError` and `kernel/KernelActionGate.ts` `NALVetoError`
  now extend `SenarsError` (`BUILDER_ERROR` / `GATE_DENIED`) instead of bare `Error`; message
  formats unchanged so existing tests are untouched.
- **E3** — `ToolSpecSchema` + `ConnectionConfigSchema` are `.strict()` (unknown keys rejected).
  **Deliberate scope cut:** `AgentOptionsSchema` parses programmatically-built option objects
  (not an external boundary — strict would break internal call sites for no adversarial gain), and
  app-config strictness is deferred to C1 (Phase 5) where the migration utility exists to absorb
  unknown-key failures. LM response strictness belongs to per-rule schemas (S4-adjacent).
- **E4** — both remaining `catch (e: any)` fixed (`nar/persistence.ts`, `lm/system-one/distill.ts`
  — `unknown` narrowing on `code === 'ENOENT'`); Bench 64 grep-guards zero `catch (e: any)` in
  `nar/src`.

### Follow-ups / improvement opportunities

- `unwrapOrThrow` migration of remaining `try/catch` sites (LM admission, schema store) is
  incremental — adopt per-subsystem when touched; do not mass-refactor (rollback trigger).
- `ErrorCode` union in `@senars/util/errors` is the single gate for new codes — keep it closed
  (grep-able runbook codes).
- `SenarsError.wrap` returns a *new* error (cause-chained); callers that rethrow inside `catch`
  should use it instead of re-throwing raw unknowns.
- Bench 64's persistence case only covers the ENOENT path; a corruption-path case (invalid JSON →
  wrapped error) would tighten it.

## 5m. Phase 4 delivery note — O1/O2/O3/O4 (2026-09-22)

**Delivered:** O1, O2, O3, O4; Bench 65 (`tests/nar/todo20-otel.test.ts`, 7 tests).
Verified: typecheck clean, lint clean, full `test:unit` green (1,833), deps:gate 72 ok.

### Audit-first findings (per the entry-point note)

- **Otel already had infrastructure**: `nar/src/otel/index.ts` (NodeTracerProvider + OTLP exporter,
  cognitive-stage middleware spans in `tick/`), and `lm/provider-runtime.ts` already spans circuit-breaker
  state changes + Prometheus counters for LM calls/spend/probes/circuit state, derivations, system-one
  judgments, memory episodes, uptime/errors. The audit added only the genuinely missing metrics.
- **`LMService.admit()` does not exist** (plan named it speculatively) — the closest admission seam is
  the routing decision + call path; instrumented there instead.

### What landed

- **O1 spans** — new helpers in `otel/index.ts`: `withSpan(name, attrs, fn)` (sync+async, error recording)
  and `decisionSpan(name, attrs)` (fire-and-forget for high-frequency verdicts). `OtelConfig.spanProcessors`
  accepts extra processors (test seam). Instrumented: `NARBuilder.build` (`nar.builder.build`: profile,
  capabilities, tier, gates, subsystems), per-gate decisions (see O4), `Negotiator.resolve`
  (`negotiator.resolve`: proposals/derivations/source/vetoed), `SchemaStore.promote`
  (`schema_store.promote`: scope/count), `LMService.generateText` (`lm.generate_text`: task, latency,
  output size; provider/model/success set in `logRoutingDecision` so all five call paths feed one span).
- **O2** — `core/src/Logger.ts` gained a pluggable **`registerLogEnricher`** (core stays OTel-free);
  `initOtel` registers an enricher injecting `traceId`/`spanId` from the active span. Propagation works
  via the AsyncLocalStorage context manager that `NodeTracerProvider.register()` installs by default
  (verified for SDK v2.11 — no manual context-manager registration needed).
- **O3** — `HealthReport`/`HealthCheckResult` types live in `@senars/util` (io cannot depend on nar);
  `nar/src/health/index.ts` exports `runHealthChecks({ lmReachable, schemaStore, gates, eventLog })`
  (exported as `@senars/nar/health`); `HTTPConnection` serves **`GET /health/ready`** (200/503 from
  `deps.health`, optional; `/health` liveness unchanged). `ConnectionDeps.health?` added in
  `util/src/types/transport.ts`.
- **O4** — new Prometheus metrics + helpers in `metrics/prometheus.ts` wired via `nar/src/telemetry/index.ts`:
  `gate_decisions_total{gate,decision}`, `gate_vetoes_total{gate,reason}`, `schema_promotions_total{scope}`,
  `handovers_total`, `bag_pressure{bag}`. Gates instrumented **inside the kernel gate classes**
  (`admitTask`/`check`/`authorize` bodies renamed to private `decide*` with thin recording wrappers) so every
  consumer path is covered, not just nar.ts's. Handover counter wired at the GameFocus E2 handover;
  bag pressure sampled per tick for the focus task/memory bags.

### Honest deviations

- **Decision-level spans, not `GateRegistry.*` spans.** GateRegistry is a passive registry (no operations);
  spans/metrics are emitted at the gate decision points inside `KernelPerception/Budget/ActionGate` —
  strictly more coverage than the plan's registry-level wording.
- **Doctor does not consume `runHealthChecks` yet** — `pnpm doctor` runs config/LM probes without a wired
  NAR, and the shared checks need NAR-scoped deps. Wire when doctor gains a `--deep` mode; acceptance
  partially deferred.
- **`pnpm status --json` traceId** not wired — status is a standalone report with no active span; traceId
  appears in JSON logs under any active span. Entry-point span wrapping (REPL/bot/MCP) remains open.
- **Token counts on the LM span** are delegated to the existing `recordCall`/spend metrics; the span carries
  latency/output-size only.

### Follow-ups / improvement opportunities

- Wire `health` into app deps (`src/bin/bot-ai.ts` constructs connections with `{emit, logger}` — add
  `health: () => runHealthChecks(...)` once the agent exposes nar-level deps).
- Remaining `Math.random` sweep sites from §5b unchanged; Logger sampling still uses `Math.random` (core).
- `bagPressure` covers focus bags only; concept/memory bags have no pressure() seam — add when memory
  exposes one.
- Gate veto reasons are free-form strings → high-cardinality `gate_vetoes_total{reason}`; consider
  normalizing reasons to enum codes if the series count grows.

## 5n. Phase 5 delivery note — C1/C2/C3/C4 (+X7) (2026-09-22)

**Delivered:** C1, C2, C3, C4, X7; Bench 66 (`tests/nar/todo20-config.test.ts`, 12 tests).
Verified: typecheck clean, lint clean, full `test:unit` green (1,845), deps:gate 72 ok,
`config:validate` + `config:check` run clean against the shipped config.

### What landed

- **C1** — `appConfigBase.strict()` (unknown top-level keys now a validation error); `name`/`version`
  added as documented passthrough fields (the config file carries package metadata). `production.provider`
  tightened to the provider enum via **`LM_PROVIDER_NAMES`** (new const tuple in `lm/env-config.ts`;
  `LMProviderName` is now derived from it — single definition). `senars.config.json` migrated:
  the invalid `"provider": "vercel"` → `openai-compatible` + `baseUrl: https://ai.gateway.dev/v1` +
  `apiKeyEnv: VERCEL_AI_GATEWAY_API_KEY` (§5f follow-up closed).
- **C2** — `src/utils/config-migrate.ts`: `MIGRATIONS` registry (v1→v2: flat `model`/`provider` folded
  under `lm`), `migrateConfig` walks the major-version chain, `migrateConfigFile` does read+write-back.
  `loadConfig` now auto-migrates on version mismatch, warns with the applied steps, and writes the
  migrated file back (best-effort; read-only locations stay in-memory). Older-than-major no longer
  blocks load — it migrates; newer-than-major still warns.
- **C3** — `deepFreeze` added to `@senars/util` (`utils/shared.ts`, export path `@senars/util/utils/shared`).
  `DEFAULT_COGNITIVE_PARAMETERS` + the three presets (FAST/LM_HEAVY/RESEARCH) frozen at module load.
  Bench 66 asserts nested mutation throws in strict mode.
  **Freeze immediately caught a real mutator**: `CognitiveController.setStrategy` mutated
  `currentParams.strategies[key].type` in place; the controller now `structuredClone`s its params at
  construction (it owns the graph). `mergeParameters` was already pure.
- **C4** — `config:check` extended: per-provider required-secret map (`anthropic`→ANTHROPIC_API_KEY,
  `openai`→OPENAI_API_KEY; missing → exit 1), hosted-endpoint warning for keyless `openai-compatible`,
  `LM_MAX_SPEND_USD` cap visibility (hard cap enforcement already in `lm/service/spend.ts`), embedded
  model-file existence check. `.env` already gitignored.
- **X7** — `nar/src/state/codec.ts` (`encodeState`/`decodeState`): `{format: 'senars.state', kind,
  version, payload}` envelope. StatePersister writes all six snapshot files envelope-wrapped
  (`NAR_STATE_VERSION = 1`, kinds `nar.beliefs`…`nar.lm-rules`); reads accept envelope **or legacy
  bare payload** (backward compatible), and fail loudly on kind or version mismatch.
  Memory serialization gains `encodeMemoryState`/`decodeMemoryState` (same envelope, kind
  `memory.state`, version `MEMORY_VERSION`); legacy bare dumps still load. Exported as
  `@senars/nar/state/codec`.

### Honest deviations

- **EventLogPersistence not envelope-wrapped** — it is line-delimited JSONL validated per-line by
  `CognitiveEventSchema` (schema-pinning with version semantics via the kernel schemas). An envelope
  would break tail-append/line-replay; documented as the third codec path with equivalent pinning.
- Strictness is **top-level only** — sub-objects stay lenient until a real typo incident justifies
  recursively strict sections (breaking-change surface per section).

### Follow-ups / improvement opportunities

- `deepFreeze` on `DEFAULT_APP_CONFIG`/`DEFAULT_BOT_CONFIG` (src/config/defaults.ts) — same treatment,
  but grep consumers for mutation first (CognitiveController lesson).
- `migrateConfigFile` in config-migrate.ts is currently unused by the loader (loader has its own
  inline read/migrate/write to preserve its error handling) — either route the loader through it or
  prune at the next touch (§5a no-speculative rule).
- Config version could move to `2.1` in a future migration to exercise the chain; only one link
  exists today (v1→v2) so the chain logic is tested synthetically in Bench 66.
- `readStateFile` legacy path means silent format drift is possible — consider logging a deprecation
  warning when a legacy (unwrapped) file is read after the next version bump.

## 5o. Phase 6 delivery note — A1/A2/A3/A4 (2026-09-22)

**Delivered:** A1, A2 (deviation), A3, A4; Bench 67 (`tests/nar/todo20-exports.test.ts`, 5 tests).
Verified: typecheck clean, lint clean, full `test:unit` green (1,850), `exports:audit` green,
`docs:api` renders 5 package docs (962 symbols).

### What landed

- **A1** — `scripts/exports-audit.ts`: consumer-aware gate. Every `exports` subpath in each
  `@senars/*` package must have an in-repo consumer importing that specifier (exact or path-prefix
  match — `./lm/system-one` is consumed by `@senars/nar/lm/system-one/head-specs.js` too) or be in
  the `PUBLIC_API` allowlist (package roots, declared in the script). Wired as `pnpm exports:audit`
  into the ci.yml gates job. **Result: 48 speculative exports pruned** from the five package.json
  exports maps (nar 9, util 7, core 14, io 12, metta 1) — including Phase 5's own unconsumed
  `./state/codec` (the §5a no-speculative rule applies to new work too; codec is still reachable
  via relative imports and re-enters the map when a package-specifier consumer appears).
  **Two audit bugs found by dogfooding, both fixed:** (1) consumer dirs must include `nar/src` —
  nar consumes util/core via package specifiers, and tsc (`moduleResolution: bundler`) resolves
  through the exports map, so a wrong prune is a typecheck failure (caught: `@senars/util/utils/shared`,
  `@senars/core/cognitive-event`); (2) subpath keys carry a leading `./` that must be stripped before
  prefix matching. Rule: every prune is verified by typecheck + full unit run (vitest resolves via
  the exports map, so a wrong prune breaks tests too).
- **A2 (deviation)** — TypeDoc 0.28 is incompatible with the repo's TypeScript 7 (`SyntaxKind`
  crash at module init). Installed `scripts/docs-api.ts` instead: dependency-light generator
  rendering `docs/api/<pkg>.md` from the exports maps — per subpath, exported symbols + first JSDoc
  summary line, one hop through re-export barrels. `pnpm docs:api`. Revisit TypeDoc when it gains
  TS7 support; the exports map remains the doc source of truth.
- **A3** — semver policy added to AGENTS.md (major=breaking, minor=new public export, patch=internal),
  with the export-surface rules: `exports:audit` is the gate, `exports:check` guards dangling
  targets, internal code imports relatively (exports map = declared public API, not an internal shortcut).
- **A4** — deprecation lifecycle in AGENTS.md: JSDoc `@deprecated since X.Y — <replacement>` →
  2 minors of parallel support → remove at next major. Live exemplar applied:
  `memory.derivationDepth` in `src/config/schema.ts` now carries the tag (`since 2.1`).
  Case studies recorded (SeNARSFactory TODO19 pre-policy; ollama alias §5f).

### Follow-ups / improvement opportunities

- Bench 67's CLI-parity test spawns `tsx scripts/exports-audit.ts` (subprocess) — it passed 3×/in-suite,
  but if it ever flakes under parallel load, the programmatic `auditPackages` assertion is the
  load-free primary; drop the CLI test rather than timing out CI.
- `docs/api/` is committed; if it starts drifting, add a CI step diffing `pnpm docs:api` output.
- The exports maps now contain only consumed subpaths — when adding a new export, add the entry
  *with* its first consumer in the same change, or `exports:audit` fails CI.
- TypeDoc revisit when TS7-compatible release lands; typedoc.json in git history has the config shape.

## 5p. Phase 7 delivery note — S1/S2/S3/S4 (2026-09-22)

**Delivered:** Phase 7 security hardening; Bench 68 (`tests/nar/todo20-security.test.ts`, 14 tests);
`docs/security.md` pen-test checklist. Verified: typecheck 0 new errors, lint clean, full `test:unit`
green (1,864), deps:gate 72 ok.

### What landed

- **S1** — all 32 AI-SDK tool `inputSchema`s converted `z.object` → `z.strictObject` (Bench 68
  grep-guards zero bare `inputSchema: z.object(` in `nar/src/tools/`). `Registry.validateArgs` now
  rejects unknown parameters with `Unknown parameter: <key>` (`ToolError`). **Schema-driven scope
  ruling**: rejection applies only when the tool declares non-empty `properties` — a tool with
  `properties: {}` is a documented passthrough (13 test files / 31 sites register passthrough
  mock tools; declaring params for all would be churn without a real boundary, and no production
  tool registers empty properties). Revisit if a passthrough tool ever ships in `nar/src`.
- **S2** — `code-exec.ts` rewritten: **disabled by default** (`createCodeExecTools()` → `{}`; opt-in
  `enabled: true`, per DQ6 the allow-list defaults to empty and denies everything);
  `SHELL_ALLOWLIST` env (comma-separated; exact-name or basename match); timeout via
  `AbortSignal.timeout` passed to `spawn` (kernel kills the child — was `setTimeout`+SIGTERM);
  cwd containment now uses `containsPath` (segment-aware — closes the `startsWith` sibling-dir
  traversal bug); `shell: false` preserved. Helper `shellAllowlistFromEnv` is unit-tested.
- **S3** — new `code_exec_wasi` tool: untrusted WASM through `createWasmModuleSandbox`
  (`@wasmer/wasi` + MemFS, already a prod dep); no host FS/network unless granted via capability
  tokens (`wasiAllowedPaths` → `sanitizePreopens`); `assertWasmPathContained` + `withTimeout`
  (`SandboxTimeoutError`); unknown module fails closed. `node:vm` sandbox stays deprecated
  (documented not-a-security-boundary).
- **S4** — `nar/src/lm/service/sanitize.ts`: `enforceLMOutputSize` + `LMOutputTooLargeError`
  (new `ErrorCode` `LM_OUTPUT_TOO_LARGE`), cap via `LM_MAX_OUTPUT_CHARS` (default 65,536).
  Enforced in `LMService.generateText` (covers cache hits) and the streaming loop (throw past cap
  mid-stream). `toolChoice` strip middleware documented (transformers.js never emits legacy
  `function_call` wire format — source-commented). Narsese grammar validation before admission was
  already structural (`LMResponseParser.valid` gate + kernel perception gate) — covered by Bench 68.

### Honest deviations

- **Wasmtime fuel/memory metering not available** through the `@wasmer` runtime — S3 limits are
  wall-clock + MemFS isolation + explicit preopen grants. Revisit when the wasmtime Node binding
  stabilizes (the root `wasmtime` dep is a v0.0.2 stub).
- **WASI tool does not capture module stdout/stderr** — `@wasmer` MemFS output wiring is not
  plumbed; the tool reports exit status/duration/errors. Capturing requires a custom stdout fd
  shim; deferred until a consumer needs it (§5a rule).
- **`createCodeExecTools` had zero consumers** before this change (only the barrel export), so the
  disabled-by-default change breaks nothing; any future registration site must opt in explicitly.

### Follow-ups / improvement opportunities

- `aisdk-adapter.ts:249` and `mcp-tools.ts:109` evaluate arithmetic expressions via `Function()`
  behind regex sanitizers — acceptable for constrained arithmetic, but a WASI math evaluator would
  remove the eval seam entirely (candidate for a Phase 8/9 pass).
- `Registry.validateArgs` passthrough ruling should be encoded in `tools/types.ts` `Schema` docs
  (`additionalProperties` semantics) when that type is next touched.
- `code_exec_wasi` output capture (custom fd shim) if a real consumer appears.
- `LM_MAX_OUTPUT_CHARS` could feed an `lm.output_truncated` OTel attribute on enforcement —
  currently the throw surfaces through existing failure metrics.

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
- **X2** (kernel `IngressJudge`) — makes the epistemic firewall structurally real; the plan's highest-value item (§1b)
- **D01/D02** (interface layers) — unblocks every subsequent refactor; pays compound interest on testability
- **E1/E2** (error taxonomy + Result) — eliminates entire class of "silent failure" bugs; enables exhaustive error handling
- **T1/T2** (RNG isolation) — fixes the known flake (also seen in `property-based.test.ts`, §5a); enables deterministic CI
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