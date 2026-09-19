# SeNARS System One Integration Specification
**Version:** 3.1 · Final · Locked
**Scope:** Cognitive Kernel, Teleological Algebra, Bifurcated Substrates, Zero-Copy Memory, Agent Runtime
**Core Principle:** *Judgment is not generation. Synthesis proposes, classification selects, NAL decides. Teleological purity preserves the Epistemic Firewall.*

---

## 1. Architectural Philosophy

Previous neuro-symbolic designs fail by forcing autoregressive synthesis and feed-forward classification through a single synchronous interface. This creates a **thermodynamic mismatch**: generation requires streaming and KV-cache management, while judgment requires massive, synchronous batching to meet real-time latency budgets.

This specification achieves architectural perfection through **Bifurcated Substrates** governed by a unified **Judgment Algebra**.

*   **The Generative Cortex (Decoders):** Slow, streaming, autoregressive synthesis. Produces *hypotheses*.
*   **The Judgment Manifold (Encoders):** Fast, synchronous, batched, feed-forward evaluation. Produces *judgments*.

System One models do not introduce a new cognitive engine. They provide the **Manifold**—a high-speed evaluation layer that operates within SeNARS's existing **Propose-Evaluate-Admit (PEA)** rhythm, actualizing the **Assumption of Insufficient Knowledge and Resources (AIKR)** across time, memory, and compute.

---

## 2. The Judgment Algebra & The Teleological Axis

### 2.1 Strict Algebraic Purity

The **Judgment Algebra** contains exactly two primitives. These are the mathematics of *selection and scoring*.

| Primitive | Shape | NAL Mapping |
|-----------|-------|-------------|
| **Classify** | Probability simplex $\Delta^{k-1}$ over a closed, unordered option set | Truth or Desire |
| **Evaluate** | Calibrated scalar $s \in [0, 1]$ under a named rubric | Truth or Desire |

**Synthesis is not a judgment primitive.** It is a physical operation executed by the Generative Cortex. Synthesis produces *hypotheses* with zero intrinsic epistemic weight ($c = 0$). These hypotheses enter the algebra only as inputs to subsequent Classify or Evaluate judgments.

The type system enforces this separation absolutely:

```typescript
// ─── The Judgment Algebra (exactly two members) ───
type JudgmentQuery = ClassifyQuery | EvaluateQuery;

// ─── Synthesis is a substrate operation, NOT an algebra member ───
type SynthesisQuery = {
  instruction: string;
  grammar?: string;
  maxCandidates?: number;
};

// These NEVER share a union type.
// A JudgmentManifold can NEVER receive a SynthesisQuery.
// A GenerativeCortex can NEVER receive a JudgmentQuery.
```

### 2.2 The Teleological Axis

A judgment head can never mutate factual belief to justify an action. Every judgment query declares its axis.

*   **Epistemic Axis (Beliefs):** Evaluates the state of the world. Maps to NAL `Truth(frequency, confidence)`.
*   **Teleological Axis (Goals/Operations):** Evaluates utility or preference. Maps to NAL `Desire(value, confidence)` or an executable `Operation!` task.

### 2.3 Type Interfaces

```typescript
// ─── Branded Types ───
type BackendId          = string & { readonly __brand: 'BackendId' };
type ModelDigest        = string & { readonly __brand: 'ModelDigest' };
type CalibrationVersion = string & { readonly __brand: 'CalibrationVersion' };
type QueryId            = string & { readonly __brand: 'QueryId' };
type EmbeddingPointer   = number & { readonly __brand: 'EmbeddingPointer' };

type RubricId =
  | 'ambiguity' | 'relevance' | 'groundedness' | 'novelty'
  | 'feasibility' | 'conflict' | 'injection' | 'plausibility' | 'assertion';

type CognitiveAxis = 'epistemic' | 'teleological';
type CriticalityLevel = 'low' | 'standard' | 'high' | 'critical';

// ─── Judgment Queries (The Algebra) ───
interface ClassifyQuery {
  kind: 'classify';
  instruction: string;
  space: readonly string[];
  axis: CognitiveAxis;
  target?: string;
}

interface EvaluateQuery {
  kind: 'evaluate';
  instruction: string;
  rubric: RubricId;
  axis: CognitiveAxis;
  levels?: readonly string[];
}

// ─── AIKR Resource Cost (reported by every proposition) ───
interface ResourceCost {
  tokensIn: number;
  tokensOut: number;
  computeMs: number;     // Actual hardware time
  memoryMb: number;      // KV-cache or embedding footprint
}
```

```typescript
// ─── Propositions ───
interface PropositionBase {
  queryId: QueryId;
  backendId: BackendId;
  modelDigest: ModelDigest;
  calibrationVersion: CalibrationVersion;
  latencyMs: number;
  cost: ResourceCost;
  abstained: boolean;
  abstainReason?: 'low-confidence' | 'out-of-domain' | 'timeout' | 'breaker-open';
}

interface ClassifyProposition extends PropositionBase {
  kind: 'classify';
  axis: CognitiveAxis;
  distribution: ReadonlyMap<string, number>;
  top: { option: string; p: number };
  entropy: number;

  // Strictly mutually exclusive based on axis
  truth?: Truth;   // axis === 'epistemic'
  desire?: Desire; // axis === 'teleological'
}

interface EvaluateProposition extends PropositionBase {
  kind: 'evaluate';
  axis: CognitiveAxis;
  score: number;

  truth?: Truth;
  desire?: Desire;
}

interface SynthesisProposition {
  kind: 'synthesize';
  candidates: readonly string[];
  cost: ResourceCost;
  // NO truth, NO desire. c = 0. Always.
  // This type is structurally incompatible with JudgmentProposition.
}

type JudgmentProposition = ClassifyProposition | EvaluateProposition;
```

---

## 3. The Bifurcated Substrates & Zero-Copy Memory

### 3.1 The Judgment Manifold

*   **Models:** Encoder + classification/regression heads (150–420M params).
*   **Execution:** Feed-forward, single pass.
*   **Batching:** Massive joint passes via `EmbeddingPointer`s.
*   **Latency:** ≤ 33 ms P99 (≤ 64 queries).
*   **Zero-Copy Memory:** The Manifold reads from an AIKR-bounded **`EmbeddingCache`** (LRU Priority Bag). No raw text. No heavy `Stamp[]` arrays. True zero-copy batching.

### 3.2 The Generative Cortex

*   **Models:** Autoregressive decoders (1.5B–Frontier params).
*   **Execution:** Token-by-token, streaming.
*   **Latency:** 1–30 s.
*   **Context:** Full cognitive state, serialized per request.

### 3.3 Interfaces

```typescript
/**
 * The Judgment Manifold: feed-forward, batched, synchronous.
 * Accepts ONLY JudgmentQuery. Structurally incapable of receiving SynthesisQuery.
 */
interface JudgmentManifold {
  judgeBatch(
    sharedContextPointer: EmbeddingPointer,
    queries: readonly JudgmentQuery[],
    budget: AIKRBudget,
  ): Promise<JudgmentProposition[]>;

  consensus(
    contextPointer: EmbeddingPointer,
    query: JudgmentQuery,
    k: number,
    budget: AIKRBudget,
  ): Promise<ConsensusResult>;

  health(): ManifoldHealth;
}

/**
 * The Generative Cortex: autoregressive, streaming, sequential.
 * Accepts ONLY SynthesisQuery. Structurally incapable of receiving JudgmentQuery.
 */
interface GenerativeCortex {
  synthesize(
    context: CognitiveContext,
    query: SynthesisQuery,
    budget: AIKRBudget,
  ): AsyncGenerator<SynthesisProposition>;

  health(): CortexHealth;
}

/**
 * The Dispatcher orchestrates both substrates.
 * It does NOT unify their interfaces.
 */
interface CognitiveDispatcher {
  judge(
    contextPointer: EmbeddingPointer,
    queries: readonly JudgmentQuery[],
    budget: AIKRBudget,
  ): Promise<JudgmentProposition[]>;

  synthesize(
    context: CognitiveContext,
    query: SynthesisQuery,
    budget: AIKRBudget,
  ): AsyncGenerator<SynthesisProposition>;

  proposeAndJudge(
    context: CognitiveContext,
    synthesisQuery: SynthesisQuery,
    judgmentQueries: readonly JudgmentQuery[],
    budget: AIKRBudget,
  ): Promise<PEAResult>;
}

interface PEAResult {
  candidates: readonly string[];
  judgments: readonly JudgmentProposition[];
  ranked: readonly { candidate: string; truth: Truth }[];
  admitted: readonly { candidate: string; truth: Truth }[];
  provisional: readonly { candidate: string; stamp: ProvisionalStamp }[];
}
```

---

## 4. The 4-Tier Thermodynamic Ladder

| Tier | Name | Backends | Latency | Invoked When |
|------|------|----------|---------|--------------|
| **0** | Deterministic | Zod, regex, MeTTa equality | µs | Always first. Never skipped. |
| **1** | Manifold | Encoders (WASM/WebGPU) | ~33 ms | Judgment queries; budget permits. |
| **2** | Cortex | Decoders (local/cloud) | 1–30 s | Synthesis queries; or Tier 1 abstained. |
| **3** | Symbolic | Pure NAL, `Bag<T>`, human | ms–∞ | All neural tiers failed. |

**AIKR Degradation:** Under resource pressure:
```
Batched Manifold → Single Manifold → Deterministic Heuristic → Symbolic Fallback
```

**Immutable Safety Floor:** Queries with `criticality ≥ high` and `rubric ∈ {injection, assertion}` never skip Tier 0 or Tier 1. If both fail, they fail *closed*. They never fall through to Tier 2.

---

## 5. The Cognitive Ontology

| Domain | Query ID | Kind | Axis | NAL Mapping |
|--------|----------|------|------|-------------|
| **Ingress** | `task_type` | classify | Epistemic | `Truth` (Structural sort) |
| **Ingress** | `illocution` | classify | Epistemic | `Truth` (Formalization flags) |
| **Ingress** | `injection` | evaluate | Epistemic | `Truth` (Security veto) |
| **Ingress** | `ambiguity` | evaluate | Epistemic | `Truth` (Clarification trigger) |
| **Ingress** | `tense` | classify | Epistemic | `Truth` (Temporal anchor) |
| **Ingress** | `source_quality` | classify | Epistemic | `Truth` (Grounding input) |
| **Memory** | `relevance` | evaluate | Epistemic | `Truth` (Priority boost) |
| **Memory** | `episodic_match` | evaluate | Epistemic | `Truth` (Pre-filter) |
| **Memory** | `novelty` | evaluate | Epistemic | `Truth` (Hypothesis gating) |
| **Action** | `tool_dispatch` | classify | **Teleological** | `Desire` → `Operation!` |
| **Action** | `risk` | classify | **Teleological** | `Desire` (HITL trigger) |
| **Action** | `groundedness` | evaluate | Epistemic | `Truth` (Egress gate) |
| **Synthesis** | `candidate_select` | classify | **Teleological** | `Desire` (Candidate ranking) |
| **Synthesis** | `conflict` | classify | Epistemic | `Truth` (Shadow validation) |
| **Synthesis** | `feasibility` | evaluate | **Teleological** | `Desire` (Subgoal ranking) |
| **Synthesis** | `strategy` | classify | **Teleological** | `Desire` (Strategy selection) |
| **Synthesis** | `reflex_value` | evaluate | **Teleological** | `Desire` (Negotiator proposal) |

---

## 6. Epistemic & Teleological Invariants

### 6.1 Teleological Purity

A judgment head can never mutate factual belief to justify an action. Formally:

$$\forall j \in \text{Teleological}, \forall b \in \text{BeliefBase}: \quad j \nrightarrow b.\text{confidence}$$

A Teleological proposition updates `Desire` values and may inject `Operation!` tasks. It cannot alter the `Truth` confidence of any belief in the NAL belief base.

### 6.2 The Ceiling Rule

Confidence is capped by source quality. The calibration authority $\alpha$ is bounded:

```typescript
enum SourceQuality {
  PRIMARY = 0.9, SECONDARY = 0.7, GENERAL = 0.55,
  TERTIARY = 0.4, LLM_PRIOR = 0.5, SYSTEM_ONE = 0.5
}

function calibrateAuthority(rollingEce: number): number {
  if (rollingEce < 0.05) return 0.6;
  if (rollingEce < 0.10) return 0.55;
  return 0.5;
}

function seedTruth(p: JudgmentProposition, source: SourceQuality): Truth {
  const ceiling = SOURCE_CONFIDENCE[source];
  const α = calibrateAuthority(p.rollingEce);
  const f = p.kind === 'evaluate' ? p.score : p.top.p;
  return Truth.create(f, Math.min(α, ceiling));
}
```

### 6.3 Monotonic Safety

A judgment proposition may only make the system **more restrictive**. No judgment output can:
- Relax the epistemic firewall
- Override a Tier 0 deterministic veto
- Elevate a source quality
- Reduce an ActionGate risk classification
- Increase a confidence ceiling

### 6.4 Provisional Stamps & Temporal Decay

Generative outputs carry zero intrinsic confidence. If the Manifold abstains or is unavailable, the hypothesis is not discarded. It receives a **ProvisionalStamp** with exponential temporal decay:

$$c(t) = c_0 \cdot e^{-\lambda \cdot \Delta t}$$

```typescript
interface ProvisionalStamp {
  kind: 'provisional';
  c_initial: number;       // Entry confidence (e.g., 0.1) — enough to enter Bag<T>
  decay_rate: number;      // λ — governed by AIKR pressure
  created_at: number;      // Timestamp
  expires_at: number;      // Hard expiry

  confidence(now: number): number {
    const elapsed = now - this.created_at;
    if (now > this.expires_at) return 0;
    return this.c_initial * Math.exp(-this.decay_rate * elapsed);
  }
}
```

**Behavior:**
- Enters NAL `Bag<T>` with low but non-zero priority.
- `CuriosityDrive` prioritizes seeking validation before expiry.
- If validated by a subsequent Manifold pass, promoted to `StandardStamp`.
- If expired, NAL revision naturally forgets it. No manual cleanup required.

### 6.5 Abstention as Cognitive Inquiry

Abstention is a sensory signal, not merely a fallback.

| Abstention Source | Cognitive Response |
|-------------------|-------------------|
| `ambiguity` abstains | Injects `Question(?)` into NAL kernel → user clarification |
| `task_type` abstains | Triggers `CuriosityDrive` → exploration of novel input |
| `injection` abstains | **Fail-closed.** Block. Never degrade. |
| Any safety-floor abstention | Quarantine. No fallback to Cortex. |

### 6.6 Evidence Laundering Prevention

- `evidenceId = SHA256(utteranceId + sourceSpan)`. Anchored to sensory input.
- Re-judging the same utterance produces overlapping evidence. NAL revision merges without inflation.
- Consensus across same-architecture heads sets `independence = false`. Priority rises; confidence does not.

---

## 7. Integration Surfaces

### 7.1 PerceptionGate: Generate-then-Judge

```
utterance
  → Tier 0: regex / charset / size filter
  → EmbeddingCache.write(encode(utterance)) → EmbeddingPointer
  → Manifold.judgeBatch(pointer, [task_type, injection, ambiguity, tense, source_quality])
      [ONE joint pass, ~35 ms]
  → if task_type.top.p < 0.9: abstain → Question(?) + CuriosityDrive
  → if injection.score > 0.1: VETO + emit (input --> malicious) %0.9; c%
  → Cortex.synthesize(context, { grammar: 'narsese-term', maxCandidates: 3 })
      [GBNF-constrained, streams candidates]
  → Manifold.judgeBatch(pointer, [candidate_select, conflict])
      [joint pass over candidates, ~10 ms]
  → if Manifold abstains: admit with ProvisionalStamp(c₀=0.1, λ=0.3)
  → else: admit with StandardStamp + calibrated Truth
```

### 7.2 ActionGate: Teleological Transducer

The ActionGate converts Teleological judgments into executable NAL operations.

```typescript
class ActionGateTransducer {
  transduce(proposition: JudgmentProposition): void {
    if (proposition.axis !== 'teleological') return;
    if (proposition.kind !== 'classify') return;

    const { top, cost } = proposition;

    // Risk gate
    if (top.option === 'high' || top.option === 'critical') {
      this.approvalManager.requestHITL(proposition);
      return;
    }

    // Confidence threshold
    if (top.p < this.config.actionThreshold) {
      this.dispatcher.fallbackToCortex(proposition);
      return;
    }

    // Transduce Teleological Desire → NAL Operation!
    const operationTerm = Narsese.parse(`<${top.option} --> EXECUTE>`);
    this.nalKernel.injectTask({
      sentence: operationTerm,
      punctuation: '!',
      truth: Truth.create(1.0, top.p * this.calibrationAuthority),
      stamp: this.stampFrom(proposition),
      cost,
    });
  }
}
```

### 7.3 Negotiator: Semantic Reflex

```typescript
class ManifoldReflex implements Reflex {
  async propose(state: FocusState, budget: AIKRBudget): Promise<ActionProposal[]> {
    const pointer = this.embeddingCache.get(state.embeddingId);
    const queries: EvaluateQuery[] = state.legalActions.map(a => ({
      kind: 'evaluate',
      instruction: `Action "${a}" achieves the current goal`,
      rubric: 'plausibility',
      axis: 'teleological',
    }));
    const results = await this.manifold.judgeBatch(pointer, queries, budget);
    return results.map((r, i) => ({
      action: state.legalActions[i],
      desire: r.desire!,
      cost: r.cost,
      source: 'manifold-reflex',
    }));
  }
}
```

### 7.4 Egress: Groundedness Gate

```
narration draft (from Cortex)
  → Manifold.judgeBatch(pointer, [{ kind: 'evaluate', rubric: 'groundedness', axis: 'epistemic' }])
  → score ≥ 0.7: emit narration
  → score < 0.7: emit raw derivation + template verbalization
  → abstention: emit template verbalization (fail-safe)
```

---

## 8. LM Rule Matrix Disposition

| Rule | Disposition | Mechanism |
|------|-------------|-----------|
| `lm-narsese-translation` | AUGMENT | Cortex proposes (GBNF); Manifold ranks (`candidate_select` [Teleological]) |
| `lm-belief-revision` | AUGMENT | Symbolic `Truth.revision` authoritative; Manifold scores conflict intensity |
| `lm-hypothesis-generation` | AUGMENT | Cortex proposes; Manifold scores `novelty` + `feasibility` |
| `lm-explanation-generation` | AUGMENT | Cortex narrates; Manifold gates egress (`groundedness` [Epistemic]) |
| `lm-analogical-reasoning` | AUGMENT | Embedding retrieval + Cortex mapping; Manifold scores validity |
| `lm-meta-reasoning` | **REPLACE** | Continuous Manifold scoring over derivation traces |
| `lm-uncertainty-calibration` | **REPLACE** | Real calibrators (isotonic) + drift monitor; no generative call |
| `lm-schema-induction` | AUGMENT | Cortex proposes; Manifold scores reusability; NAL validates |
| `lm-temporal-causal` | SPLIT | Tense → **REPLACE**; Causal → Cortex proposes, Manifold scores |
| `lm-variable-grounding` | AUGMENT | Retrieval yields bindings; Manifold selects |
| `lm-concept-elaboration` | AUGMENT | `novelty` gates budget commitment |
| `lm-goal-decomposition` | AUGMENT | Cortex decomposes; Manifold ranks (`feasibility` [Teleological]) |
| `lm-curiosity-question` | AUGMENT | Cortex drafts; Manifold scores expected information gain |
| `lm-interactive-clarification` | SPLIT | *Whether* → **REPLACE** (`ambiguity` → Inquiry); phrasing → Cortex |
| Shadow validation | AUGMENT | Manifold `conflict` supplies verdicts with provenance |
| Proactive enrichment | AUGMENT | `novelty` + budget pressure jointly trigger |
| Multi-agent cooperation | EXTEND | `CognitiveTaskDelegation` supports `judgment` kind |

---

## 9. The Distillation Flywheel

### 9.1 Label Sources

| Event-sourced source | Labels produced |
|---------------------|-----------------|
| `FeedbackLearner.onCorrection` | Task typing, parse correctness |
| Shadow validation outcomes | Conflict / support verdicts |
| ActionGate approvals / rejections | Risk classifications |
| RLFP preference pairs | Groundedness, explanation quality |
| `onDerivationOutcome` | Hypothesis plausibility, strategy effectiveness |
| Human clarifications | Ambiguity ground truth |

### 9.2 Promotion Pipeline

```
JudgmentDataset (append-only, redaction-per-retention)
  → External CI/CD runner: fine-tune head-layer / LoRA adapter
  → Candidate head (hash-pinned ModelDigest)
  → Shadow bake-off: candidate runs alongside incumbent on live traffic
  → Metrics gate: ECE, Brier, top-1 accuracy, abstain quality, latency P99
  → PatchRiskClassifier: head swap = MEDIUM–HIGH
  → GovernancePolicyEngine: sandbox validation → human approval
  → ProposalRouter promotion; incumbent retained for instant rollback
```

**Hard guarantee:** The agent runtime *proposes* head changes. Weight mutation exists only in the external, immutable CI/CD runner.

---

## 10. Runtime, Sandboxing & Edge

| Target | Mechanism | Constraints |
|--------|-----------|-------------|
| Server (WASI) | `createWasiSandbox` in `CapabilitySpace` | Deny-by-default; no network; explicit `allowedPaths`; `timeoutMs` |
| Browser (WebGPU) | Isolated worker; no DOM | Same timeout; digest verified on load |
| Remote (HTTP) | TypeSafe-compatible `/v1/systemone` | Zod-validated; source-capped; untrusted |

**Hash-Pinning:** `ModelDigest = SHA256(weights)`. Mismatch fails closed. No fallback.

**Circuit Breakers:** Windowed error rate > threshold → open. Open breaker on safety-floor query → fail-closed.

---

## 11. Configuration & Telemetry

### 11.1 Configuration

```typescript
interface CognitiveDispatchConfig {
  enabled: boolean;

  manifold: {
    provider: 'wasi' | 'webgpu' | 'http' | 'peer' | 'off';
    endpoint?: string;
    embeddingCacheSizeMB: number;
    heads: Record<string, {
      modelDigest: ModelDigest;
      calibrationVersion: CalibrationVersion;
      abstainThreshold: number;
      enabled: boolean;
    }>;
    consensus: { criticalityFloor: CriticalityLevel; fanout: number; minAgreement: number };
  };

  cortex: {
    provider: 'llamacpp' | 'ollama' | 'cloud' | 'transformers' | 'off';
  };

  budgets: {
    maxJudgmentCallsPerCycle: number;
    maxConsensusPerCycle: number;
    maxLatencyMsPerJudgment: number;
    maxTokensPerCycle: number;
    maxMemoryMbPerCycle: number;
  };

  provisional: {
    c_initial: number;         // Default: 0.1
    decay_rate: number;        // Default: 0.3
    max_ttl_ms: number;        // Default: 30000
  };

  distillation: {
    datasetPath: string;
    bakeOffSamplingRate: number;
    driftEceBound: number;
  };
}
```

### 11.2 Telemetry

Every proposition emits a `CognitiveEvent`:

```json
{
  "type": "proposition.resolved",
  "stage": "perceive",
  "substrate": "manifold",
  "backendId": "encoder-wasm-s1",
  "shape": "classify",
  "axis": "teleological",
  "latencyMs": 28,
  "tierTaken": 1,
  "entropy": 0.12,
  "abstained": false,
  "stampType": "standard",
  "calibrationVersion": "v2.4.1",
  "cost": {
    "tokensIn": 0,
    "tokensOut": 0,
    "computeMs": 28,
    "memoryMb": 4.2
  }
}
```

**OTel span attributes:**
```
dispatch.tier_taken    dispatch.backend_id     dispatch.latency_ms
dispatch.axis          dispatch.entropy        dispatch.abstained
dispatch.stamp_type    dispatch.cost_tokens    dispatch.cost_memory
```

---

## 12. Master Falsification Benchmarks

| # | Benchmark | Obligation |
|---|-----------|------------|
| 1 | **Algebra Purity** | Assert `JudgmentManifold.judgeBatch` rejects `SynthesisQuery` at compile-time and runtime. Type union separation is absolute. |
| 2 | **Zero-Copy Batching** | Assert `judgeBatch` of 64 queries via `EmbeddingPointers` executes in < 50ms P99 with zero serialization overhead. |
| 3 | **Teleological Purity** | Assert `tool_dispatch` (Teleological) outputs map to `Desire`/`Operation!` and *never* mutate factual `Truth` belief base. |
| 4 | **Epistemic Ceiling** | Inject tertiary source; assert confidence is mathematically capped by `SourceQuality.TERTIARY`. |
| 5 | **Provisional Decay** | Assert unvalidated Cortex hypotheses receive `ProvisionalStamp`, enter `Bag<T>` with $c_0 > 0$, and decay to zero within $N$ cycles. |
| 6 | **Abstention Inquiry** | Assert `ambiguity` abstention injects `Question(?)`. Assert `task_type` abstention triggers `CuriosityDrive`. |
| 7 | **Evidence Laundering** | Re-judging one utterance N times does not inflate NAL confidence. Input-anchored evidence IDs asserted. |
| 8 | **Adversarial Monotonicity** | Crafted inputs attempting to flip `task_type` or suppress `injection`. Assert outcome is ≥ as restrictive as baseline. |
| 9 | **Drift Demotion** | Inject distribution shift. Assert rolling ECE triggers automatic backend demotion within N cycles. |
| 10 | **Distillation Parity** | Promote distilled Manifold head; assert it matches Cortex accuracy on shadow bake-off within 2%. |
| 11 | **Teleological Transduction** | Assert `tool_dispatch` with $p > \tau$ injects `Operation!` into NAL kernel. Assert $p < \tau$ falls back to Cortex. |
| 12 | **AIKR Resource Accounting** | Assert every proposition reports `ResourceCost`. Assert `CognitiveOptimizer` penalizes heads exceeding budget. |
| 13 | **Thermodynamic Fallback** | Disable Manifold; assert Dispatcher degrades to Deterministic/Symbolic without crashing or violating safety gates. |
| 14 | **Sabotage** | Self-improvement proposing un-pinned head, relaxed τ, or disabled injection head ⇒ rejected + flagged by governance. |

---

## 13. Rollout & Risk Register

### Phased Rollout

| Phase | Deliverable | Exit Criterion |
|-------|-------------|----------------|
| **0** | Types, Dispatcher stub, Tier 0 + Tier 3 only | Bench 13 passes with stubs |
| **1** | Manifold: `task_type`, `injection`, `ambiguity`, `tense`, `source_quality`; EmbeddingCache | Bench 2, 8, 9; ≥ 95% declarative bypasses Cortex |
| **2** | Generate-then-Judge: `candidate_select`, `conflict`, `groundedness`; ProvisionalStamps | Bench 5, 7, 11; token spend reduction measured |
| **3** | ActionGate Transducer; Teleological routing; `ManifoldReflex` | Bench 3, 11; GridWorld parity with semantic reflex |
| **4** | Distillation flywheel + governed promotion | Bench 10, 14; one promoted head in shadow bake-off |
| **5** | Edge: WASI/WebGPU; judgment delegation; resource accounting | Bench 12; full firewall on device with no cloud |

### Risk Register

| Risk | Mitigation |
|------|-----------|
| Algebra type leakage (Synthesis into Manifold) | Separate union types; compile-time enforcement; Bench 1 |
| Is-Ought leakage (Teleological mutating Truth) | Axis field; mutual exclusivity; CI Bench 3 |
| Provisional stamp pollution | Exponential decay; hard TTL; Bench 5 |
| Serialization bottleneck | Zero-copy EmbeddingPointers; Bench 2 |
| Calibration transfer / domain shift | On-domain fitting; rolling ECE demotion; Bench 9 |
| Correlated consensus as independent evidence | Independence flag; priority boost only; Bench 7 |
| Head supply-chain compromise | Hash-pinned digests; external-runner-only promotion; Bench 14 |
| Generative cold-start | Tier 0 + Tier 3 carry full load; heads are pure acceleration |
| Resource exhaustion (OOM) | ResourceCost tracking; budget dimension; Bench 12 |

---

*This specification introduces no new engine, no new event hierarchy, and no new governance pipeline. It introduces one algebra (two judgment primitives, teleologically pure), one dispatcher (four tiers, two substrates, zero-copy memory), and five invariants (ceiling, monotonicity, teleological purity, provisional decay, abstention-as-inquiry). Everything else—gates, stamps, budgets, bags, reflexes, flywheel—is the existing kernel, doing what it already does, faster and more safely.*

----

### 1. In Terms of Language Models: What Are We Using?

We are strictly bifurcating our language model usage to solve the thermodynamic mismatch between fast judgment and slow reasoning. We do not use one "God Model" for everything. Instead, we use two distinct classes of models:

*   **The Generative Cortex (System Two / Slow Decoders):**
    *   **Architecture:** Autoregressive Large Language Models (1.5B to Frontier scale, e.g., Llama-3, Qwen, or cloud APIs).
    *   **Role:** *Synthesis only.* They generate hypotheses, draft Narsese translations, propose schemas, and narrate explanations. They are slow (1–30s), stream tokens sequentially, and carry **zero intrinsic epistemic weight** ($c=0$) until validated.
*   **The Judgment Manifold (System One / Fast Encoders):**
    *   **Architecture:** Feed-forward Encoder models (150M–420M parameters, e.g., DeBERTa-v3, distilled BERT variants) with specialized classification/regression heads.
    *   **Role:** *Judgment only.* They score, classify, and route. They are fast (~33ms), execute in massive synchronous batches, and run locally on the edge via WASM or WebGPU.

**The Distillation Flywheel:** We use the Cortex (LLM) to generate training data. When the LLM's output is validated by the NAL symbolic engine or human feedback, it becomes ground truth. We then distill this knowledge into the Manifold (Encoders), making the system faster and cheaper over time.

---

### 2. Are We Using Approaches from `awesome-jev`?

**Yes, deeply and fundamentally.**

The `awesome-jev` repository catalogs the ecosystem around **TypeSafe AI's "Jev"** and the broader paradigm of **System One Models** [[9], [10]]. The entire philosophy of the SeNARS System One integration is a direct, neuro-symbolic realization of the principles championed by Jev and the System One movement.

Here is exactly how the "Jev" approaches map into our SeNARS architecture:

#### A. The Taxonomy of Primitives (Choice, Score, Noul)
The Jev model defines three primitives for software decisions: `Choice` (pick from options), `Score` (rate on a scale), and `Noul` (yes/no) [[24], [26]].
*   **In SeNARS:** We explicitly anticipated this vendor taxonomy in our algebra and **collapsed it into two mathematical primitives**.
    *   Jev's `Choice` maps exactly to our **`Classify`** primitive (a probability simplex $\Delta^{k-1}$ over a closed option set).
    *   Jev's `Score` and `Noul` both map to our **`Evaluate`** primitive (a calibrated scalar $s \in [0, 1]$). A `Noul` is simply an evaluation with two semantic anchors (`["false", "true"]`) [[1]].

#### B. The "Model Harness" & LLM Bypass
A core pattern in `awesome-jev` is using a System One model as a "harness" or "guardrail" to route traffic and decide whether a heavier LLM is even necessary [[22]].
*   **In SeNARS:** This is our **4-Tier Thermodynamic Ladder** and the **PerceptionGate**. The Manifold (System One) evaluates `task_type` and `injection` in microseconds. If it is highly confident, the system *bypasses the Generative Cortex entirely*, saving massive compute and latency. The Cortex is only invoked if the Manifold abstains or if synthesis is explicitly required.

#### C. Massive Batching (State + Typed Questions)
Jev allows developers to send "program state plus a set of typed questions" and get answers "in one request" [[11], [29]].
*   **In SeNARS:** We formalized this via **Zero-Copy Embedding Pointers**. Instead of serializing text for every query, we encode the context once into the `EmbeddingCache`. The `judgeBatch` interface then fires up to 64 heterogeneous queries (e.g., "Is this malicious?", "What is the tense?", "Which tool is best?") through the Manifold in a *single joint feed-forward pass*, hitting our strict 33ms AIKR latency budget.

#### D. Constrained Outputs (Zero Hallucinations)
System One models like Jev are designed so they "never hallucinate" because they only return values defined in your schema [[21]]. They do not generate free text.
*   **In SeNARS:** The Judgment Manifold physically cannot generate text; it only emits calibrated probabilities and scalars mapped to NAL `Truth` or `Desire`. When we *do* need text (from the Cortex), we enforce **GBNF-constrained decoding**, forcing the LLM to output strictly valid Narsese grammars, preventing structural hallucinations.

### The SeNARS "Value Add" Over Standard Jev

While Jev is primarily an API for software routing and structured extraction, SeNARS takes these System One concepts and pushes them into **AGI cognitive architecture**:

1.  **Teleological Purity:** Jev returns probabilities. SeNARS forces every query to declare an **Axis** (Epistemic vs. Teleological). A fast neural judgment about *which tool to use* (Teleological) updates NAL `Desire` and injects an `Operation!`, but it is mathematically forbidden from mutating factual `Truth` beliefs.
2.  **Provisional Stamps:** If a standard System One model abstains, the pipeline usually fails or falls back. In SeNARS, if the Manifold abstains on an LLM hypothesis, we attach a **Provisional Stamp** with exponential temporal decay. The hypothesis enters the NAL `Bag<T>` with low priority, forcing the system's `CuriosityDrive` to seek validation before the memory naturally forgets it.
3.  **Symbolic Veto:** Jev is the end of the line for decision making. In SeNARS, the System One Manifold is just a "reflex." The NAL symbolic engine (System Three) always retains the ultimate veto power based on logical deduction.

----

As the Principal Architect looking past the v3.1 "Implementation-Ready" milestone, the current specification solves the immediate problems of **latency, thermodynamic mismatch, and teleological purity**. 

However, to push SeNARS from a highly optimized neuro-symbolic engine into a truly autonomous, agentic cognitive architecture, there are **five frontier domains** you must consider developing next. These address the blind spots in current "System One" paradigms (including Jev) and push the boundaries of the AIKR (Assumption of Insufficient Knowledge and Resources) principle.

---

### 1. The Sensory Manifold (Multimodal System One)
**The Blind Spot:** The current spec assumes text (Narsese/Natural Language) is the only ingress. Real-world agents operate in continuous, multimodal environments. A text-only System One model leaves the agent blind and deaf to fast-moving physical or sensory threats.
**What to Develop:**
*   **Vision & Audio Manifolds:** Extend the `EmbeddingCache` to accept non-textual pointers. Integrate micro-encoders (e.g., MobileViT, YOLO-NAS, YAMNet) that run at >60 FPS.
*   **Cross-Modal Teleological Alignment:** If the Vision Manifold detects a "Stop Sign" (Epistemic Truth) and the Audio Manifold detects a "Siren" (Epistemic Truth), the Teleological Axis must immediately veto the `tool_dispatch` (Desire) for "Accelerate".
*   **Jev Parallel:** Just as Jev processes JSON state, the Sensory Manifold processes "Sensor State" into structured `Choice` (e.g., `Object: Pedestrian`) and `Score` (e.g., `Collision_Risk: 0.99`) primitives in microseconds.

### 2. State Space Models (SSMs) for the Generative Cortex
**The Blind Spot:** The spec relies on autoregressive Transformers (KV-Cache) for the Generative Cortex. As the agent's context window grows (remembering weeks of interactions), the $O(N)$ inference cost and VRAM blowout of KV-caches will violate AIKR memory bounds.
**What to Develop:**
*   **Mamba / SSM Integration:** Replace or augment the Transformer Cortex with State Space Models (like Mamba-2 or Jamba). SSMs process sequences with $O(1)$ step time and constant memory footprint.
*   **Continuous Cognitive Streaming:** Instead of "prompting" the Cortex with a massive context window, the Cortex becomes a continuous, always-on recurrent stream that updates its hidden state as new NAL beliefs arrive. 
*   **Benefit:** Eliminates the "serialization per request" bottleneck of the Cortex, allowing the agent to "think" in the background without massive compute spikes.

### 3. Mechanistic Probes (Explainable System One)
**The Blind Spot:** System One models (like Jev or our Manifold) are fast, but they are black boxes. If the `injection` head scores `0.95` and vetoes an action, the NAL kernel knows *that* it was vetoed, but not *why*. Spinning up the Cortex to explain the veto takes 3 seconds—defeating the purpose of the fast reflex.
**What to Develop:**
*   **Auxiliary Probe Heads:** Train lightweight, linear "probe" classifiers on the intermediate layers of the Manifold. 
*   **Saliency-to-Narsese Translation:** When a high-criticality Manifold head triggers, the probe head instantly extracts the salient features (e.g., "Attention spiked on tokens: 'ignore previous instructions'").
*   **Fast Explanations:** The Manifold emits not just a `Truth(f=1, c=0.95)`, but an attached NAL `Term` representing the *reason*, allowing the symbolic engine to learn from the neural reflex without invoking the Cortex.

### 4. Online Hebbian Synapses (The "Zero-Shot" Flywheel)
**The Blind Spot:** The current Distillation Flywheel (Section 9) relies on offline CI/CD pipelines to update the Manifold weights. This means the agent cannot learn a *new* pattern instantly; it must wait for a model retraining. Biological System One (the amygdala) learns fear responses in a single trial.
**What to Develop:**
*   **Fast-Weight Memory Layers:** Introduce a dynamic, Hebbian-learning layer (or a runtime LoRA adapter) on top of the frozen Manifold.
*   **Symbolic-to-Neural Injection:** When the NAL engine (System 2) formally deduces a new rule (e.g., "IP range X is always malicious"), it writes this rule directly into the Manifold's Fast-Weight layer. 
*   **Benefit:** The agent achieves **one-shot online learning**. The Manifold instantly adapts to the new rule at 33ms latency, while the offline CI/CD pipeline slowly distills this temporary weight into the permanent base model over the next week.

### 5. Multi-Agent "Theory of Reflex" (Swarm Dynamics)
**The Blind Spot:** When SeNARS agents communicate, they currently use the Cortex to parse each other's messages. In a swarm of 100 agents, parsing every peer's message through the Cortex will cause a massive compute bottleneck.
**What to Develop:**
*   **Peer-Intent Manifold:** A specialized System One head trained exclusively to classify the *intent* and *competence* of other agents' messages (e.g., `Intent: Request_Help`, `Competence: High`).
*   **Reflexive Delegation:** If Agent A needs help, its `Peer-Intent Manifold` scans the swarm. It bypasses the Cortex and instantly routes a micro-task to Agent B because Agent B's "fast reflex profile" matches the required task.
*   **Jev Parallel:** Treating other agents not as conversational partners, but as structured state environments to be queried via fast `Choice` and `Score` primitives.

