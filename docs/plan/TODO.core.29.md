# TODO.core.29 — Deferred Architecture Workstreams

**Status:** 🟡 **In Progress** — follows TODO.core.28 (complete)
**Parent:** Deferred from TODO.core.28 §7 (Out of Scope)
**Principle:** *Consolidate proven patterns; eliminate structural drift; harden seams; never lose behavior.*

---

## 1. Workstreams

| ID | Workstream | Target | Impact | Effort | Dependencies |
|----|------------|--------|--------|--------|--------------|
| **W1** | **Builder Unification** | Consolidate `NARBuilder` / `BookBuilder` / `MeTTaBuilder` | ★★★★☆ | M | — | ✅ **DONE** |
| **W2** | **Event Taxonomy** | Standardize `emitDomainEvent` names/payloads | ★★★★☆ | M | — | ✅ **DONE** |
| **W3** | **Serialization Helpers** | CBOR/msgpack codecs, schema migration | ★★★★☆ | L | W1 | ✅ **DONE** |
| **W4** | **RL Baseline Extensions** | Extend RLFP framework | ★★★☆☆ | M | — |
| **W5** | **Custom Metrics** | Prometheus/OpenTelemetry metrics | ★★★☆☆ | M | W2 |
| **W6** | **UI-Contract Registry Unification** | Single registry factory | ★★★☆☆ | S | — |

---

## 2. Success Criteria

| Metric | Target |
|--------|--------|
| Builder classes using shared mixin | 100% (3/3) |
| Event emission sites standardized | 100% |
| Codec backends (JSON, CBOR, msgpack) | 3 |
| Schema migration tooling | Versioned migrations |
| RL baseline metrics tracked | Win rate, Brier, regret |
| Custom metrics exported | ≥10 metrics |
| UI-Contract registry factories | 1 unified |

---

## 3. Workstream Details

### W1: Builder Unification

**Problem:** Three builder classes use `FluentBuilderMixin` but have duplicated patterns:
- `NARBuilder` (agent/builder.ts) — assembles NAR + Agent + Gates
- `BookBuilder` (admit/book.ts) — constructs immutable artifact books
- `MeTTaBuilder` (metta/runtime/builder.ts) — builds MeTTa programs

**Unification Target:**
```
src/util/
  fluent-builder.ts          → enhanced base (already exists)
  builder/
    index.ts                 → barrel
    base.ts                  → shared Builder<T> class
    steps.ts                 → typed step recording
    validation.ts            → step validation helpers
    lifecycle.ts             → build/validate/rollback hooks
```

**Migration:**
1. Extract common logic to `src/util/builder/base.ts`
2. Update `NARBuilder`, `BookBuilder`, `MeTTaBuilder` to extend shared base
3. Add compile-time step validation
4. Ensure all existing tests pass

---

### W2: Event Taxonomy

**Problem:** Event emission scattered with inconsistent names/payloads:
- `kernel/gate-base.ts` → `emitEvent(CognitiveEvent)`
- `loop/events.ts` → `emit(LoopEventType, data)`
- `mining/schema-mining.ts` → `emitEvent(MiningEvent)`
- `agent/phases.ts` → `host.emit(mintCognitiveEvent(...))`
- `faculties/judgment/telemetry.ts` → `emit(TelemetryEvent)`

**Standardization:**
```
src/events/
  index.ts                   → barrel
  taxonomy.ts                → canonical event names, payload shapes
  emitter.ts                 → unified EventEmitter<T>
  cognitive.ts               → CognitiveEvent + factory
  loop.ts                    → LoopEvent + factory
  mining.ts                  → MiningEvent + factory
  telemetry.ts               → TelemetryEvent + factory
```

**Migration:**
1. Define canonical event taxonomy in `src/events/taxonomy.ts`
2. Create unified `EventEmitter<T>` with typed emission
3. Replace all ad-hoc emission sites
4. Add event catalog generation for documentation

---

### W3: Serialization Helpers

**Problem:** Only JSON codec exists (`src/codec/Codec.ts`); no CBOR/msgpack backends; no schema migration tooling.

**Target:**
```
src/codec/
  index.ts                   → barrel
  Codec.ts                   → existing (JSON)
  CborCodec.ts               → CBOR backend
  MsgpackCodec.ts            → msgpack backend
  registry.ts                → codec registry by type
  migration/
    index.ts
    Migration.ts             → versioned migration
    migrations/              → per-version migrations
```

**Migration:**
1. Add `@msgpack/msgpack` and `cbor` dependencies
2. Implement `CborCodec` and `MsgpackCodec` matching `Codec` interface
3. Create migration framework with versioned migrations
4. Add benchmarks comparing codec performance

---

### W4: RL Baseline Extensions

**Problem:** RLFP framework exists but lacks baseline tracking, comparison, and standard metrics.

**Target:**
```
src/rl/
  baseline/
    index.ts
    Metrics.ts               → win rate, Brier score, regret, calibration
    Tracker.ts               → persistent baseline tracking
    Comparator.ts            → A/B strategy comparison
    Reporter.ts              → baseline reports
```

**Migration:**
1. Define standard RL metrics in `Metrics.ts`
2. Implement `Tracker` for persistent storage
3. Add `Comparator` for strategy A/B testing
4. Integrate with existing `PreferenceCollector`

---

### W5: Custom Metrics

**Problem:** No Prometheus/OpenTelemetry metrics exported for observability.

**Target:**
```
src/observability/
  index.ts
  metrics/
    index.ts
    prometheus.ts            → Prometheus metrics
    otel.ts                  → OpenTelemetry metrics
    registry.ts              → metric registry
  instruments/
    nar.ts                   → NAR-specific metrics
    memory.ts                → memory metrics
    kernel.ts                → kernel/gate metrics
    rl.ts                    → RL metrics
```

**Key Metrics (≥10):**
- `senars_nar_cycles_total` — inference cycles
- `senars_nar_cycle_duration_seconds` — cycle latency
- `senars_memory_concepts_total` — concept count
- `senars_memory_tasks_total` — task count
- `senars_kernel_gate_latency_seconds` — gate latency
- `senars_rl_episode_reward` — episode reward
- `senars_rl_brier_score` — Brier score
- `senars_rl_win_rate` — win rate
- `senars_codec_encode_duration_seconds` — encoding latency
- `senars_codec_decode_duration_seconds` — decoding latency

---

### W6: UI-Contract Registry Unification

**Problem:** Multiple registry factories across UI contracts.

**Target:**
```
src/ui-contract/
  registry/
    index.ts                 → unified factory
    ShapeRegistry.ts         → consolidated
    ViewSpecRegistry.ts      → consolidated
    ChannelRegistry.ts       → consolidated
```

---

## 4. Execution Order

```
Week 1: W1 (Builder Unification) + W6 (UI-Contract Registry)
Week 2: W2 (Event Taxonomy) + W3 (Serialization Helpers)
Week 3: W4 (RL Baseline) + W5 (Custom Metrics)
Week 4: Integration testing, gate validation, parity checks
```

---

## 5. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Builder unification breaks existing APIs | Medium | High | Keep old classes as thin wrappers during transition |
| Event taxonomy changes break consumers | Medium | High | Versioned event schemas; migration period |
| New codec backends differ from JSON | Low | Medium | Round-trip tests for all codecs |
| Metrics cardinality explosion | Low | Medium | Label bounds; pre-defined label sets |
| RL baseline storage grows unbounded | Medium | Low | Retention policies; aggregation |

---

## 6. Out of Scope

- Full OpenTelemetry tracing (separate workstream)
- Distributed metrics collection
- Advanced RL algorithms (PPO, SAC)
- Schema registry service