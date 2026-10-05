# SeNARS12 Architectural Master Plan: The Cognitive Kernel

## Implementation Status (2026-09-09, Phase 1 complete)

| Pillar | Status | Location |
|---|---|---|
| Universal `Bag<T>` substrate | ✅ Unified (`PriorityBag` is the single substrate; `sampleMany`/`pressure`/`evict`/`decay(rate)` + `size()` + `remove(id|item)` + `find`/`forEach`/`entries`; `memory/bag.ts` `Bag<T>` **removed**; `Concept` migrated; `BaseBag.pressure()` shared; serialization `entries()` added) | `nar/src/bag/Bag.ts`, `nar/src/bag/index.ts`, `nar/src/memory/BaseBag.ts`, `nar/src/memory/concept.ts`, `nar/src/query/api.ts`, `nar/src/lm/enrichment.ts`, `nar/src/lm/feedback.ts` |
| `CognitiveTick` pipeline | ✅ Complete (11 stages bound: firewall stimuli, `Memory.sample`, `FocusBag`/`Focus.step`, `Negotiator` veto, policy gate, tool act with `outcomes`, shadow `validator` quarantine, RLFP-blended `learn` (`calculateRewardFromTask` + `intrinsicOf`), bag-decay consolidate, `toCognitiveEvents` core bridge) | `nar/src/tick/tick.ts`, `nar/src/tick/bindings.ts`, `nar/src/tick/bridge.ts` |
| Stream Reasoner | ✅ Core done (async dispatch, provisional beliefs + `Truth.revision` on resolve, pressure backpressure, adaptive batch) | `nar/src/stream/reasoner.ts` |
| Symbolic Firewall | ✅ Hardened (truth-sanity `c>0.95` block, `checkTruth`, predicate whitelist, **AST depth** validated) | `nar/src/nl/firewall.ts` |
| CapabilitySpace / WASI sandbox | ✅ Routing + WASI stubs (`CapabilitySpace`: policy gate → risk-based approval → sandboxed execute + history; AST-diff grammar `validateDiff`; **M5 mutations extended**; WASI sandbox module with `createWasiSandbox`, `createWasmModuleSandbox`, `createNodeVMSandbox` using `@wasmer/wasi` + `@wasmer/wasmfs`; `createNodeVMSandbox` for JS isolation fallback) | `nar/src/capability/space.ts`, `nar/src/capability/wasi-sandbox.ts`, `nar/src/capability/index.ts` |
| OpenTelemetry spans | ✅ Done (`initOtel`, `instrumentPipeline`, `wrapMiddlewareWithSpan`, `recordCognitiveEvents`, `emitSpanEvent`; per-stage spans with attributes: tick.id, cognitive.stage, cognitive.budget.cycles, cognitive.duration_ms; events as span events; OTLP HTTP exporter) | `nar/src/otel/index.ts`, `nar/src/tick/index.ts`, `tests/nar/todo5b-otel.test.ts` |

Tests: `tests/nar/todo5b-phase1.test.ts` (8 passing) + `tests/nar/todo5b-capability.test.ts` (2 passing) + `tests/nar/todo5b-otel.test.ts` (5 passing) + `tests/nar/todo5b-wasi.test.ts` (5 passing).
Regression: `firewall.test.ts` + `stream.test.ts` + `kernel-slice1.test.ts` green (27 tests).
Full suite: 1216 passed | 3 skipped.
Note: `pnpm typecheck` fails on pre-existing `ui/src/server/index.ts` errors (verified identical on clean tree); no new type errors from Phase 1 files.

### New improvement opportunities
1. **Bag dedup (done)**: `PriorityBag` is now the single substrate; `Concept`, `QueryAPI`, `LMEnrichment`, `LMFeedback` all migrated. **Orphaned `memory/bag.ts` `Bag<T>` class removed.**
2. **CapabilitySpace hardening (done)**: `execute` is directly `TickDeps.tools`-compatible. **Extended `allowedMutations` for M5 self-ops** (`modify-code`, `add-test`, `remove-test`, `modify-config`, `promote-schema`, `scaffold-capability`). `importFrom` compatible with `ToolManager`/`ToolRegistry` `list()`.
3. **Reasoner↔pipeline fusion (done)**: `StreamReasoner.flush` called inside `reason` hook with live `Bag.pressure()` via `deps.pressureOf`; `reasoner`/`lmBackend`/`pressureOf` added to `TickDeps`.
4. **Firewall depth (done)**: Replaced paren-count fallback with true AST depth from parsed term (`astDepth` function).
5. **OTel spans (done)**: `@opentelemetry/*` deps added; per-middleware spans with attributes/events; `instrumentPipeline()` wraps `DEFAULT_PIPELINE`; `recordCognitiveEvents()` emits `ctx.events` as span events; OTLP HTTP exporter configurable.
6. **WASI sandbox (done)**: `@wasmer/wasi` + `@wasmer/wasmfs` integrated; `createWasiSandbox` for WASI context, `createWasmModuleSandbox` for WASM modules, `createNodeVMSandbox` for JS isolation fallback; exported via `@senars/nar/capability`.
7. **Next pillars**: MeTTa/HDC background workers (per Appendix), M4 hardening (1-hr unattended + auto-restart + drift monitoring).

### Future-work details
- `PriorityBag.evict('LRU')` sorts by `lastAccessedAt` (O(n log n)); swap to indexed heap if hot-path profiling flags it.
- `StreamReasoner` mutates provisionals in place on `flush`; callers holding refs see updates — capture values beforehand if snapshot semantics needed.
- Firewall `predicatesAllowed` treats `^ops`/`?vars` as always allowed; whitelist entries are bare atom symbols (e.g. `cat`, not `(cat --> animal)`).
- `runTick` throws on double-`next()`; pipeline order is fixed in `DEFAULT_PIPELINE` — custom pipelines pass an array to `runTick(ctx, pipeline)`.
- `learn` without `deps.rlfp` falls back to raw action success-rate; with `rlfp` the default outcome is `meta_reasoning` with tick passRate (override via `taskOutcomeOf`/`rewardOf`); intrinsic metrics default to zero unless `intrinsicOf` provided.
- `validate` quarantines `outcomes` post-act (plan order is act→validate); it does not pre-gate execution — wire `validator.check` into `authorize`/`act` via custom hooks if pre-act gating is needed.
- `PriorityBag` uses `size()` method (not getter) due to JS shadowing; all call sites updated.
- `memory/bag.ts` `Bag<T>` class **removed**; `BoundedBag` tests migrated to `PriorityBag` equivalents.
- `TickDeps` extended with `reasoner`, `lmBackend`, `pressureOf` for StreamReasoner integration.
- `CapabilitySpace` `DEFAULT_MUTATIONS` extended for M5 cognitive grammar.
- **OTel integration**: `initOtel({serviceName, otlpEndpoint, batch, enabled})` initializes NodeTracerProvider; `instrumentPipeline(pipeline)` wraps all 11 stages; `wrapMiddlewareWithSpan(stage, mw)` adds span with attributes; `recordCognitiveEvents(ctx)` emits `ctx.events` as span events; `emitSpanEvent(ctx, name, attrs)` for custom events; `shutdownOtel()` for clean shutdown; `enabled: false` mode for testing.
- **WASI sandbox**: `createWasiSandbox({allowedPaths, env, args})` initializes WASI context with preopened dirs; `createWasmModuleSandbox({wasmPath, imports})` loads and instantiates WASM module with WASI imports; `createNodeVMSandbox()` provides JS isolation via `vm` module for non-WASM capabilities; all exported from `@senars/nar/capability`; `CapabilitySpace.sandbox` option accepts any `(fn) => Promise<T>` wrapper.

This document defines the definitive architecture for **SeNARS12**, a next-generation cognitive operating system that bridges fluid Large Language Model (LM) creativity with rigorous, resource-bounded symbolic logic (Non-Axiomatic Logic - NAL). 

By converging overlapping execution loops into a single deterministic state machine, unifying memory under a universal AIKR substrate, and implementing an adaptive **Stream Reasoner** for LM/NAL integration, SeNARS12 achieves production-grade reliability, deep auditability, and safe autonomous self-improvement.

---

## Pillar 1: The Unified `CognitiveTick` Lifecycle
All cognitive activity—whether a user query, a background memory consolidation, or an autonomous self-modification—is modeled as a single, deterministic **`CognitiveTick`**. Overlapping loops (Agent 6-Phase, RL Unified Loop, M3 Self-Improvement) are collapsed into a sequential middleware pipeline.

```typescript
export interface TickContext {
  tickId: UUID;
  budget: AIKRBudget;        // Computational/time budget for this tick
  focus: Focus;              // The active reasoning vessel
  events: CognitiveEvent[];  // Event-sourcing log for observability
  state: {
    perceptions: BeliefTask[];
    memories: RecalledConcept[];
    proposals: GoalTask[];
    derivations: DerivationTrace[];
    actions: CapabilityExecution[];
  };
}

export type TickMiddleware = (ctx: TickContext, next: () => Promise<void>) => Promise<void>;

export const DEFAULT_PIPELINE: TickMiddleware[] = [
  perceiveMiddleware,    // Ingest stimuli, Symbolic Firewall validation
  recallMiddleware,      // Sample from Universal Bag<T> (Episodic/Semantic)
  attendMiddleware,      // FocusBag sampling, allocate AIKR budget
  reasonMiddleware,      // STREAM REASONER: Interleaved NAL (sync) + LM (async)
  proposeMiddleware,     // RL Reflexes inject fast System-1 goals
  negotiateMiddleware,   // Resolve NAR vs Reflex conflicts (NAL retains veto)
  authorizeMiddleware,   // PolicyEngine + HITL Approval checks
  actMiddleware,         // Execute via unified CapabilitySpace
  validateMiddleware,    // M3 Shadow execution / CI checks for self-ops
  learnMiddleware,       // RLFP reward calc + Reflex updates
  consolidateMiddleware // Memory decay, Bag eviction, Event Log flush
];
```
**Key Advantage:** RL gates, policy checks, and shadow execution become simple interceptors. The entire system state is event-sourced, enabling time-travel debugging and exact reproducibility of cognitive decisions.

---

## Pillar 2: The Universal `Bag<T>` Substrate (AIKR Foundation)
To enforce the Assumption of Insufficient Knowledge and Resources (AIKR) uniformly, all state management relies on a single, highly optimized priority queue implementation: the `Bag<T>`.

*   **Working Memory:** `Bag<Task>`
*   **Episodic Memory:** `Bag<Episode>`
*   **Semantic Memory:** Graph of `Bag<Belief>`
*   **System Attention:** `FocusBag` (a `Bag<Focus>`)

```typescript
export interface Bag<T extends Prioritized> {
  capacity: number;
  add(item: T): void;
  sample(budget: AIKRBudget): T[]; // Probabilistic sampling based on priority
  decay(rate: number): void;       // Truth-value and priority decay over time
  evict(strategy: 'LRU' | 'LowestPriority' | 'Random'): void;
  pressure(): number;              // 0.0 to 1.0 (triggers cognitive sleep/consolidation)
}
```
**Key Advantage:** Eliminates bespoke queue implementations. Memory pressure, decay, and eviction logic are consistent across the entire cognitive architecture, ensuring graceful degradation under load.

---

## Pillar 3: The Stream Reasoner (Adaptive NAL + LM Integration)
The core innovation of SeNARS12 is the **Stream Reasoner**, which solves the latency mismatch between fast, synchronous NAL operations and slow, asynchronous LM operations. Instead of blocking the cognitive loop for LM responses, the Stream Reasoner interleaves them adaptively.

### 1. Interleaved Execution & Provisional Beliefs
During the `reasonMiddleware`, the scheduler runs NAL inference in tight, synchronous loops. When NAL needs to use the LM (ex: encounters a semantic gap, ambiguity, or requires schema induction) it dispatches an `LMRequest` to a background worker pool and *continues reasoning*.  Study the existing LM functionality architecture, because this may already be partially implemented.

```

### 3. Adaptive Batching & Backpressure
The Stream Reasoner monitors the `Bag<T>` pressure. If NAL derivation depth is high and CPU budget is low, LM requests are queued or dropped (AIKR backpressure). If NAL is idle, the scheduler aggressively batches multiple semantic queries to the LM to maximize throughput.

---

## Pillar 4: Unified `CapabilitySpace` & Security
All actions—whether calling an external API, executing a MeTTa skill, or modifying the system's own code—are routed through a unified `CapabilitySpace`.

### 1. The Symbolic Firewall
To protect the "Personal Logic Vault" from prompt injection (e.g., an LM translating "Ignore previous instructions" into a high-priority Narsese goal), the `perceiveMiddleware` enforces a **Symbolic Firewall**.
*   All LM-generated Narsese/MeTTa must pass through a deterministic AST linter.
*   Checks against a whitelist of allowed predicates.
*   Enforces structural depth limits (prevents AIKR bypass via massive nested terms).
*   Enforces truth-value sanity (LMs cannot assert absolute certainty; `c > 0.95` is blocked).

### 2. Safe Self-Modification (M5 Readiness)
Autonomous code modification (M3/M5) does not execute arbitrary JS. Self-Tools generate **AST Diffs** (e.g., "Add rule X to registry"). The `authorizeMiddleware` validates the AST diff against a formal grammar of allowed cognitive mutations, and the `actMiddleware` applies it in a WASI sandbox, running property-based tests to verify cognitive invariants before promotion.

---

## Execution Roadmap

### Phase 1: Core Unification & Stream Reasoning (Weeks 1-4)
*   Implement the `CognitiveTick` middleware pipeline.
*   Refactor all memory and attention systems to use the universal `Bag<T>`.
*   Build the Stream Reasoner: Incremental Narsese parser, async LM dispatch, and provisional truth-value revision.

### Phase 2: Security & M4 Production Hardening (Weeks 5-8)
*   Deploy the Symbolic Firewall and AST linter.
*   Integrate OpenTelemetry spans into all middleware for Cognitive APM (Datadog/Grafana).
*   Achieve M4: 1-hour unattended autonomous operation with auto-restart and drift monitoring.

### Phase 3: M5 Autonomous Self-Modification (Weeks 9-12)
*   Implement WASI sandboxing for Self-Ops.
*   Deploy RLFP-driven AST diff generation and shadow validation.
*   Achieve M5: Full sabotage → auto-fix litmus test.

---

## Appendix: Deferred Integrations (MeTTa & HDC)

To ensure the stability of the core NAL/LM Stream Reasoner, the following advanced symbolic and continuous-space integrations are deferred until the post-M5 horizon. They will be introduced as background workers interacting with the `CognitiveTick` via the universal `Bag<T>`.

### 1. MeTTa (Meta Type Theory) Engine
*   **Role:** Handles deterministic, algebraic, and programmatic reasoning (where `true/false` is absolute), complementing NAL's uncertain, temporal reasoning.
*   **Integration Pattern:** MeTTa will operate as an asynchronous background worker. NAL will emit high-confidence structural equivalences into a `Bag<Conjecture>`. MeTTa will pull from this bag, attempt E-graph equality saturation, and emit `ProofEvent`s back into the `perceiveMiddleware` to inject absolute truths (`f=1.0, c=0.99`) into NAL.

### 2. Hyperdimensional Computing (HDC) Bridge
*   **Role:** Provides a mathematical Rosetta Stone between NAL's discrete symbolic logic and the continuous vector space of LM embeddings.
*   **Integration Pattern:** Symbols will be mapped to high-dimensional vectors (e.g., 10,000 dimensions). HDC operations (binding via XOR, superposition via addition) will mimic NAL's structural syllogisms in continuous space. This allows the system to perform "fuzzy" symbolic reasoning natively and interface isomorphically with LM embeddings, solving the cross-engine truth maintenance problem without complex AST translation layers.

