# REFACTOR.todo7.md

Continuation of REFACTOR.todo6.md. All 27 ADOPT items from TODO6 shipped with ≥1 falsifying test and ≥1 wired consumer (C24). This sprint tackles the **improvement opportunities** (N1–N9) surfaced during TODO6 close-out plus new high-value targets.

---

## 0. Philosophy & North Star

Same ideal: **bounded, auditable, self-improving cognitive runtime** — truth-maintenance over a time-sliced knowledge graph, bounded by AIKR, with every selection, derivation, and adaptation provable, replayable, and consistent with KCM (Competitive. Temporal. Consistency.).

TODO7 dials:
- **A** — **Premise primitives completion**: wire `linear` scorer, `concepts` source, embeddings; collapse `SemanticStrategy` to composition
- **B** — **RuleGraph closure**: real `LMRule` condition terms; co-activation edges key on real terms, not rule names
- **C** — **Replay fidelity**: hash Memory contents; event IDs for identity-addressed ranges
- **D** — **Observability maturity**: scheduled/micro-soak CI; bag perf at scale (10k/100k); dpdm `--transform` for type-only cycles
- **E** — **Self-model depth**: capability provenance chains; Metta↔NAL arbiter loop closure; governance-gated schema evolution
- **F** — **Architecture hygiene**: deep subpath exports to break accepted cycles; manual directory renames (post-merge)

---

## 1. Premise Primitives Completion (N1, N2)

### 1.1 Current Gap
- `PREMISE_SCORERS_EXTENDED.linear` is tested but **no registered consumer**
- `semantic` remains a bespoke class (`strategies/premise/semantic.ts`) instead of a composition
- `embeddingSim` hardcoded to `0` — weight reserved but unused

### 1.2 Target State
```typescript
// primitives.ts additions
export const PREMISE_SOURCES = {
  // ...existing
  concepts: (task, mem) => mem.enumerateConcepts(),  // O(n) sweep — NOT a sample
} as const;

export const PREMISE_SCORERS_EXTENDED = {
  linear: (weights: { link: number; embed: number; pri: number }) =>
    (memory: Memory) => (task: Task, concept: Concept): number => {
      const linkStrength = getLinkStrength(memory, task.term, concept.term);
      const embeddingSim = memory.getEmbeddingIndex?.similarity(task.term, concept.term) ?? 0;
      return weights.link * linkStrength + weights.embed * embeddingSim + weights.pri * concept.priority;
    },
} as const;
```

```typescript
// selection-strategies.ts — SemanticStrategy becomes composition
export const SemanticStrategy: Strategy = withMeta(
  createStrategy({
    name: 'semantic',
    source: 'concepts',          // enumerate all, not sample
    scorer: { linear: { link: 0.5, embed: 0.3, pri: 0.2 } },
    minScore: 0.6,
    limit: 10,
  }),
  'Semantic similarity via linear(link, embed, priority)'
);
```

### 1.3 Falsifier
- `tests/nar/premise-primitives.test.ts`: `semantic` produces identical results before/after composition
- Embedding similarity non-zero when index populated; affects ranking

---

## 2. RuleGraph Closure (N4)

### 2.1 Current Gap
- `RuleGraph.select()` activates `{ kind: 'atom', symbol: rule.name }` — rule names, not real terms
- `learnFromDerivation()` writes real derived terms → edges never match rules
- ADR-007 "Known limitation": half the co-activation loop is inert

### 2.2 Target State
```typescript
// lm/LMRule.ts — add condition term
export interface LMRule {
  id: string;
  name: string;
  condition: Term;              // NEW: real term for graph matching
  // ...existing fields
}

// RuleGraph.ts — ruleMatchesEdge uses real terms
private ruleMatchesEdge(rule: LMRule, edge: CoActivationEdge): boolean {
  return termsEqual(rule.condition, edge.targetTerm);
}

// Activation uses condition term
this.graph.activate(focusTerm, rule.condition);  // not rule.name
```

### 2.3 Migration
- Existing rules: synthesize `condition` from `name` (backward-compat)
- New rules: require explicit `condition` at registration
- Falsifier: `tests/nar/rulegraph-wiring.test.ts` — co-activations key on real terms; selection shifts with derivation rewards

---

## 3. Replay Fidelity (N6, N8)

### 3.1 Current Gap
- `computeReplayStateHash` hashes counters + gateSnapshot only
- Memory divergence preserving counts is invisible
- `--from/--to` address log ordinals (positional), not event IDs

### 3.2 Target State
```typescript
// replay.ts
export function computeReplayStateHash(result: ReplayResult): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({
    counters: pick(result, HASHED_FIELDS),
    memory: serializeMemoryForReplay(result.memory),  // canonicalized
  }));
  return hash.digest('hex');
}

// CognitiveEvent gains monotonic id
interface CognitiveEvent {
  id: string;           // ULID or monotonic counter
  // ...existing
}
```

### 3.3 CLI Changes
- `--from/--to` accept event IDs (with ordinal fallback for old logs)
- `replayIntoMemory` filters by `id` range when IDs present

### 3.4 Falsifier
- `tests/nar/todo6-production.test.ts`: tampered memory → hash mismatch; `--from ID` survives log compaction

---

## 4. Observability Maturity (N3, N7, N9)

### 4.1 Bag Perf at Scale (N9)
- Extend `tests/benchmark/bag-perf.test.ts` to N ∈ {1k, 10k, 100k}
- Two mixes: insert-heavy (60/30/10), sample-heavy (20/70/10)
- ADR-006 rule explicitly: "sample-heavy p99 speedup ≥ 3× at 10k+ with fidelity intact → flip"

### 4.2 Dpdm Type-Only Cycles (N3)
- Two of four accepted cycles are type-only edges dpdm counts without `--transform`
- Add `--transform` flag to dpdm invocation in `scripts/deps-gate.ts`
- Re-measure baseline; lower if type edges drop

### 4.3 Soak CI Triggers (N7)
```yaml
# .github/workflows/soak.yml additions
on:
  workflow_dispatch: { ...existing... }
  schedule:
    - cron: '0 3 * * 0'   # weekly full soak (Sunday 03:00 UTC)
  pull_request:
    types: [opened, synchronize, reopened]
    paths:
      - 'nar/src/**'
      - 'core/src/**'
      - 'tests/soak/**'
```
- **PR/micro-soak only**: `SOAK_SCALE=fast` (60s max) — **no 24h full soak in CI**
- Weekly full soak runs manually/scheduled separately
- Both upload artifacts + comment on PR

### 4.4 Falsifiers
- `bag-perf.test.ts`: N=10k/100k benches pass, numbers recorded
- `deps:gate` baseline drops by ≥2 (type edges removed)
- Soak workflow triggers on PR + schedule; artifacts visible

---

## 5. Self-Model Depth (New High-Value)

### 5.1 Capability Provenance Chains
```typescript
// capability/ontology.ts — extend Provenance
export interface Provenance {
  source: 'builtin' | 'learned' | 'delegated' | 'scaffolded';
  digest: string;
  proofRef?: string;
  /** NEW: chain of adaptations that produced this capability */
  derivationChain?: string[];  // adaptationIds from GovernanceResolver
  /** NEW: parent capability from which this was derived */
  parentId?: string;
}
```
- `GovernanceResolver.resolve()` appends `adaptationId` to `derivationChain` on `auto-apply`
- `CapabilityOntology.register()` validates chain integrity (no orphan adaptations)
- Falsifier: `tests/nar/todo6-capability.test.ts` — provenance chain traces to resolver audit trail

### 5.2 Metta↔NAL Arbiter Loop Closure
- `ProofMettaProposer` learns from `ProofStream` (derivation records) ✅ TODO6 E1
- **Missing**: `metta` tool inlines learned rules back into NAL rule set
- **Target**: `consolidateLearning()` → `ProofMettaProposer.learnFromProofStream()` → `metta` tool rewrites → `GovernanceResolver` adopts via `auto-apply` (low-risk)
- Falsifier: end-to-end test — derivation pattern → MeTTa rule → inlined → fires in subsequent cycle

### 5.3 Governance-Gated Schema Evolution
- `GovernanceResolver` + `SchemaInductor` wired ✅ TODO6 E2
- **Missing**: schema migration runner that applies approved patches via `ProposalActuators`
- **Target**: `drainAwaitingApproval()` → human review → `applySchemaPatch()` → `CapabilityOntology` registers new tool/rule
- Falsifier: schema proposal → approval → migration runs → new capability registered with provenance

---

## 6. Architecture Hygiene (N3, Post-TODO6 Renames)

### 6.1 Deep Subpath Exports (Breaks 2 Cycles)
```json
// core/package.json — add subpath exports
"exports": {
  ".": "./src/index.ts",
  "./agent": "./src/agent/index.ts",      // NEW: Agent, SessionManager
  "./agent/*": "./src/agent/*.ts",
  "./memory": "./src/memory/index.ts",
  "./cognitive-thread": "./src/cognitive-thread.ts"
}
```
- `io/bridge/ConnectionBinder.ts` imports `@senars/core/agent` instead of `@senars/core` barrel
- Eliminates 2 of 4 accepted cycles
- Minor semver (new export subpath)

### 6.2 Post-Merge Manual Renames (WebStorm)
| Current | Target | Rationale |
|---------|--------|-----------|
| `nar/src/cognition` | `nar/src/game` | Game component library (Sensor/Action/Reward) |
| `nar/src/rl` | `nar/src/rlfp` | RLFP-specific; disambiguate from future generic RL |

- Breaking export renames — **do not attempt via agent**
- Use WebStorm "Rename Directory + Update References"
- `nar/src/cognitive` stays (metacognitive control plane)

---

## 7. Budget & Scope

| Metric | Target |
|--------|--------|
| New ADOPT items | 12 (4 from N1–N9, 8 new high-value) |
| New benches | 3 (bag-perf@scale, replay-hash, soak-triggers) |
| Package count | Net zero (new files in existing homes) |
| Exports | +4 subpaths (core, nar, capability, governance) |
| Breaking changes | 2 manual renames (post-merge, semver major) |

---

## 8. Phases

| Phase | Scope | Key Files | Bench | Falsifies |
|-------|-------|-----------|-------|-----------|
| **A** | Premise primitives completion | `strategies/premise/primitives.ts`, `selection-strategies.ts`, `semantic.ts`, `memory.ts` (enumerateConcepts) | 112 | `semantic` = composition; embedding non-zero |
| **B** | RuleGraph closure | `lm/LMRule.ts`, `strategies/lm-graph/RuleGraph.ts`, `cognitive/controller.ts` | 113 | Co-activations on real terms; selection shifts |
| **C** | Replay fidelity | `nar/src/kernel/replay.ts`, `src/bin/replay.ts`, `schemas/cognitive-event.ts` | 114 | Memory hash mismatch; ID-based ranges |
| **D** | Observability maturity | `tests/benchmark/bag-perf.test.ts`, `scripts/deps-gate.ts`, `.github/workflows/soak.yml` | 115 | N=10k/100k benches; dpdm `--transform`; PR soak runs |
| **E** | Self-model depth | `capability/ontology.ts`, `governance/pipeline.ts`, `meta/metta-proposer.ts`, `learning/schema-induction.ts` | 116 | Provenance chains; Metta→NAL→Governance loop; schema migration |
| **F** | Architecture hygiene | `core/package.json`, `io/src/bridge/ConnectionBinder.ts` | 117 | Deps gate drops 2 cycles; exports check passes |

Order: **A → B → C** (A enables B's premise registration; C independent). **D/E/F** interleave after A.

---

## 9. Invariants (Carried + New)

1. **C11 PARITY**: byte-identical single-thread core cycle (default config)
2. **C12**: Everything bounded via factory + degradation ladder + recovery + defense layering
3. **C13**: One definition per concept (no duplicate names)
4. **C14**: Event-sourced replay reducer coverage — pure reducers reconstruct all state **(now includes Memory)**
5. **C15**: Every new abstraction earns its keep — debt-negative or capability-positive
6. **C16**: Open-loop → closed-loop; knowledge as E-signal; adaptive modulation
7. **C17**: No regressions — including silent degradation
8. **C18**: Config density 100% — a knob with no consumer is a defect
9. **C19**: Alternate implementations behind existing seam; default switch requires bench evidence + ADR
10. **C20**: One home per strategy type — all under `strategies/`
11. **C21**: Cycle budget non-increasing — deps-gate baseline only decreases or justified + recorded
12. **C22**: AIKR observability — every budget slice, pressure signal, backpressure decision measurable
13. **C23**: Governance-gated self-modification — no capability/schema/strategy change bypasses resolver
14. **C24**: No orphan deliverables — every ADOPT item ships with ≥1 falsifying test AND ≥1 wired consumer
15. **C25**: **Replay verification covers Memory state** — hash is the C14 token
16. **C26**: **RuleGraph co-activations key on real terms** — not rule-name atoms

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| `semantic` composition changes O(n) enumeration → O(sample) | `source: 'concepts'` enumerates all; `sampleSize` ignored for this source; test asserts enumeration |
| RuleGraph condition term breaks existing rule registration | Synthesize `condition` from `name` for legacy rules; new rules require explicit term |
| Replay Memory hashing adds serialization overhead | `serializeMemoryForReplay` is canonicalized + incremental; only for replay, not hot path |
| Soak PR runs slow CI | Micro-soak = 60s; gate in `soak-gate.ts` is pure (unit-tested); full soak stays weekly |
| Deep subpath exports require semver minor | Acceptable — new export, no removal; consumers opt-in |
| Manual renames break downstream | Post-merge; WebStorm refactor; publish major semver |

---

## 11. Progress

| # | Phase | Deliverable | Falsifier | Status |
|---|-------|-------------|-----------|--------|
| 1 | A | Premise primitives: `concepts` source, `linear` scorer with embedding, `SemanticStrategy` as composition | `tests/nar/premise-primitives.test.ts` — semantic = composition; embedding non-zero affects ranking | ✅ |
| 2 | B | RuleGraph closure: `LMRule.condition` term, co-activations key on real terms | `tests/nar/rulegraph-wiring.test.ts` — co-activations on real terms; selection shifts with derivation rewards | ✅ |
| — | C | Replay fidelity | `tests/nar/todo6-production.test.ts` | 📝 |
| — | D | Observability maturity | `tests/benchmark/bag-perf.test.ts`, deps-gate, soak.yml | 📝 |
| — | E | Self-model depth | `tests/nar/todo6-capability.test.ts` | 📝 |
| — | F | Architecture hygiene | deps-gate drops 2 cycles; exports check passes | 📝 |

---

## 12. Architecture Decision Records (Planned)

| ADR | Trigger | Status |
|-----|---------|--------|
| ADR-011 | Premise primitives `concepts` source + `linear` embedding (A) | **Done** |
| ADR-012 | RuleGraph `LMRule.condition` term (B) | **Done** |
| ADR-013 | Replay Memory hashing + event IDs (C) | Pending |
| ADR-014 | Bag perf at 10k/100k + ADR-006 revisit (D) | Pending |
| ADR-015 | Capability provenance chains (E) | Pending |
| ADR-016 | Deep subpath exports for cycle reduction (F) | Pending |

---

## 13. Notes for Remaining Work

- **Phase A complete**: `PREMISE_SOURCES.concepts` (O(n) enumeration), `PREMISE_SCORERS_EXTENDED.linear` with embedding support, `SemanticStrategy` as composition via `createStrategy`. Dead code removed: `nar/src/strategies/premise/semantic.ts`, `nar/src/reason/strategies/semantic.ts`.
- **Phase B complete**: `LMRule.condition` term added with backward-compat synthesis from `name`. `RuleGraph.ruleMatchesEdge` and activation now use `condition` term. Co-activation loop closed — edges key on real terms, not rule names.
- **C11 parity holds**: `default-formation` unchanged; only `semantic` moves to composition
- **`concepts` source is O(n)**: distinct from `bag` (sample). Any future sampled semantic strategy needs separate name (e.g., `semantic-sampled`)
- **Soak gate contract**: thresholds in `SoakLimits` (env-driven), harness only samples
- **Single replay hash**: `computeReplayStateHash` in `replay.ts` only — no duplicate in CLI
- **`Memory.sampleWindow`** remains the positional-sampler seam (A7 from TODO6)
- **RuleGraph `LMRule.condition`** is the key to closing the co-activation loop — do not defer

---

## 14. Post-REFACTOR.todo7 Rename Notes (Manual, WebStorm)

| Current Path | Target Path | Rationale |
|--------------|-------------|-----------|
| `nar/src/cognition` | `nar/src/game` | Game component library (Sensor/Action/Reward contracts for arcade/self-play) |
| `nar/src/rl` | `nar/src/rlfp` | RLFP-specific learner integration; disambiguates from future generic RL infra |

> These are breaking export renames — do **not** attempt via agent. Use WebStorm's "Rename Directory + Update References" after todo7 completes. `nar/src/cognitive` stays as-is (metacognitive control plane).

---

## 15. Cross-Cutting High-Value Improvements (Accomplish During Phases)

These improvements span multiple phases and compound value when done together:

### 15.1 Unified Kernel Event Schema (Phase C → D)
**Problem**: `CognitiveEvent`, `GateEvent`, `DerivationRecord`, `TaskAdmittedEvent` are separate types with overlapping fields.
**Target**: Single `KernelEvent` discriminated union with `kind` tag; all loggers/ledgers/replay consume one type.
```typescript
type KernelEvent =
  | { kind: 'perception'; ... }
  | { kind: 'gate'; gate: 'budget'|'action'|'reward'; granted: boolean; ... }
  | { kind: 'derivation'; steps: DerivationStep[]; ... }
  | { kind: 'task-admitted'; taskType: ConceptTaskType; ... }
  | { kind: 'belief-revised'; ... }
  | { kind: 'concept-activated'; ... };
```
**Falsifier**: `tests/nar/kernel-event.test.ts` — single replay pipeline handles all event kinds; OTel spans auto-populate from `kind`.

### 15.2 Strategy Effectiveness Telemetry (Phase A → B)
**Problem**: `AdaptiveStrategy` tracks effectiveness in-memory only; lost on restart; no cross-session learning.
**Target**: Persist `StrategyStats` to `ParameterLedger` per strategy/task-type; `AdaptiveStrategy` hydrates on init.
```typescript
// governance/pipeline.ts — add to ProposalActuators
applyStrategyWeight?: (strategy: string, taskType: string, weight: number) => void;
```
**Falsifier**: Restart NAR → `AdaptiveStrategy` prefers strategies that worked for task types in prior session.

### 15.3 ConceptGraph Persistence (Phase B → E)
**Problem**: `ConceptGraph` (co-activation edges) is in-memory only; lost on restart → RuleGraph cold-start.
**Target**: `ConceptGraph` implements `Ledger`-backed persistence; `RuleGraph` hydrates graph on init.
```typescript
// strategies/lm-graph/RuleGraph.ts
constructor(options: RuleGraphOptions & { ledger?: Ledger<GraphEdge> } = {}) {
  this.graph = new ConceptGraph({ ...options, ledger: options.ledger });
}
```
**Falsifier**: Restart → `RuleGraph.select()` uses pre-restart co-activations immediately (no warmup).

### 15.4 Governance Policy as Code (Phase E)
**Problem**: Guardrail fragments (`GUARDRAIL_FRAGMENTS`, `CRITICAL_COMPONENTS`) hardcoded in `governance/pipeline.ts`.
**Target**: Declarative policy file (`governance/policy.yaml`) loaded at startup; `PatchRiskClassifier` drives from config.
```yaml
# governance/policy.yaml
guardrails:
  - pattern: "nar/src/kernel/**"
    severity: HIGH
  - pattern: "capability/wasi/**"
    severity: HIGH
critical_components:
  - approval-logic
  - sandbox-config
```
**Falsifier**: Add new guardrail pattern to YAML → risk classification changes without code deploy.

### 15.5 MeTTa Rule Validation (Phase E)
**Problem**: `ProofMettaProposer` learns patterns but no validation; malformed rules can crash `metta` tool.
**Target**: `metta-proposer.ts` validates patterns against MeTTa grammar at `addRule()`; invalid rules rejected.
```typescript
private addRule(pattern: string, ...): void {
  if (!this.mettaValidator?.(pattern)) {
    logger.warn(`Rejected invalid MeTTa pattern: ${pattern}`);
    return;
  }
  // ...existing
}
```
**Falsifier**: Inject malformed pattern → rejected; valid pattern → accepted and exported.

### 15.6 Distributed Tracing Context Propagation (Phase D)
**Problem**: OTel context lost across `CognitiveThread` boundaries; mailbox sends don't propagate traceparent.
**Target**: `ThreadMessage` carries `traceId`/`spanId`; `send()` injects, `receive()` extracts.
```typescript
// core/src/cognitive-thread.ts
interface ThreadMessage {
  // ...existing
  traceId?: string;
  spanId?: string;
}
send(message) {
  const span = trace.getActiveSpan();
  message.traceId = span?.spanContext().traceId;
  message.spanId = span?.spanContext().spanId;
}
```
**Falsifier**: `tests/nar/todo6-production.test.ts` — trace spans connect parent→child thread across mailbox.

### 15.7 CognitiveEvent Compaction (Phase C)
**Problem**: Long-running soak generates unbounded event logs; replay slows; disk pressure.
**Target**: `EventLogPersistence.compact(olderThanMs)` — merges adjacent same-kind events, drops intermediate snapshots.
```typescript
// kernel/EventLogPersistence.ts
export function compactGateEvents(path: string, olderThanMs: number): { compacted: number } {
  // Merge sequential gate events; keep first + last + count
}
```
**Falsifier**: 1M events → compact to <10k; `pnpm replay --verify` passes on compacted log.

### 15.8 Dynamic Knob Discovery (Phase E)
**Problem**: `findKnobSpec()` only knows hardcoded knobs; new tunables require code changes.
**Target**: `@senars/rlfp/knobs.ts` scans `CognitiveParameters` shape at build; generates `knob-manifest.json`; `SandboxValidator` loads manifest.
**Falsifier**: Add new knob to `CognitiveParameters` → `pnpm build` → `knob-manifest.json` updated → `GovernanceResolver` validates without code change.

### 15.9 Memory Pressure Gradient (Phase D)
**Problem**: `pressure()` returns 0–1 but transitions only at 0.7/0.9; no gradient for adaptive behavior.
**Target**: `Bag.pressureGradient()` returns `{ level: 'normal'|'elevated'|'high'|'critical', slope: number }`; `MemoryConsolidation` uses slope for proactive decay.
```typescript
// bag/Bag.ts
pressureGradient(): { level: PressureLevel; slope: number } {
  const p = this.pressure();
  const history = this.pressureHistory.slice(-10);
  const slope = computeSlope(history.map(h => h.pressure));
  return { level: p >= 0.9 ? 'critical' : p >= 0.7 ? 'high' : p >= 0.5 ? 'elevated' : 'normal', slope };
}
```
**Falsifier**: `tests/nar/bag-fidelity.test.ts` — slope detects pressure rise before threshold; consolidation triggers earlier.

### 15.10 Cross-Phase Budget Accounting (Phase D)
**Problem**: Budget tracked per-phase but not end-to-end; can't answer "how much of perception budget went to reasoning?"
**Target**: `TickContext.budget` carries `phaseAllocations: Map<CognitiveStage, number>`; `instrumentPipeline` auto-records.
```typescript
// otel/index.ts — in wrapMiddlewareWithSpan
span.setAttribute('cognitive.budget.perception', ctx.budget.phaseAllocations.get('perceive') ?? 0);
```
**Falsifier**: `pnpm status --budget` shows per-phase breakdown; sums to total.

### 15.11 Derivation Proof Objects (Phase C → E)
**Problem**: `DerivationRecord` has steps but no first-class proof term; can't verify independently.
**Target**: Each derivation produces `Proof { steps: Step[]; rootHash: string; verify(): boolean }`; stored in ledger.
```typescript
// kernel/schemas.ts
export interface Proof {
  derivationId: string;
  steps: DerivationStep[];
  rootHash: string;  // merkle root of step hashes
}
```
**Falsifier**: `GovernanceResolver` can verify proof independently of derivation engine; tampered step → `verify()` fails.

### 15.12 Self-Documenting API Generation (Phase F)
**Problem**: API docs drift from code; no single source of truth for external consumers.
**Target**: `scripts/generate-api.ts` extracts JSDoc + type signatures from `exports` map → `docs/api/` (markdown + OpenAPI).
```bash
pnpm docs:api  # generates docs/api/{core,nar,io,...}.md
```
**Falsifier**: `pnpm exports:check` passes ↔ generated docs match actual exports.

---

## 16. Suggested Phase Assignments

| Improvement | Best Phase | Reason |
|-------------|------------|--------|
| Unified Kernel Event Schema | C (with replay) | Replay is the consumer |
| Strategy Effectiveness Telemetry | A (with primitives) | Uses same ledger infra |
| ConceptGraph Persistence | B (with RuleGraph) | Same graph, same ledger |
| Governance Policy as Code | E (with resolver) | Same file, same validation |
| MeTTa Rule Validation | E (with MettaProposer) | Same proposer |
| Distributed Tracing | D (with OTel) | Extends existing spans |
| CognitiveEvent Compaction | C (with replay) | Replay reads compacted logs |
| Dynamic Knob Discovery | E (with governance) | Validator needs manifest |
| Memory Pressure Gradient | D (with bag perf) | Uses bag pressure history |
| Cross-Phase Budget | D (with budget obs) | Extends BudgetSlice events |
| Derivation Proof Objects | C+E (replay + governance) | Proof = replay unit + governance artifact |
| Self-Documenting API | F (with exports) | Exports map is the source |

---

## 17. Budget Impact

| Category | Additional Items | Est. Effort |
|----------|------------------|-------------|
| Core ADOPT (Phases A-F) | 12 | baseline |
| Cross-cutting (15.1–15.12) | 12 | +40% (shared infra reduces marginal cost) |
| **Total** | **24** | **~1.4× baseline** |

Most cross-cutting items reuse primitives/ledger/OTel infrastructure already being built in Phases A–F. Marginal cost is low because the seams exist.