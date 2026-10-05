# The Universal Reasoner Control Model

## §0 — Premise

Any reasoner — SeNARS, a Bayesian network, a Prolog engine, a transformer, a human brain — is a **controlled dynamical system over a knowledge state**. It observes some portion of its state, selects an operation, applies it within resource and trust constraints, and repeats. The differences between architectures are not differences in kind but differences in **parameter settings** along a small number of irreducible control dimensions.

This document defines those dimensions, specifies the design space they generate, positions SeNARS as one point within it, and proposes movements through the space that yield more power, flexibility, and elegance.

---

## §1 — The Formal Tuple

A reasoner is a 7-tuple:

$$\mathcal{R} = \langle\, \mathcal{K},\; \Omega,\; \mathcal{V},\; \pi,\; \beta,\; \varepsilon,\; \mu \,\rangle$$

| Symbol | Name | Question it answers |
|--------|------|---------------------|
| $\mathcal{K}$ | **Ontology** | What *exists* in the system? |
| $\Omega$ | **Dynamics** | How does state *change*? |
| $\mathcal{V}$ | **Valuation** | How is state *scored*? |
| $\pi$ | **Scheduling** | What changes *next*? |
| $\beta$ | **Bounding** | What *limits* change? |
| $\varepsilon$ | **Trust** | What *gates* change? |
| $\mu$ | **Reflexivity** | Can the system change *its own rules for changing*? |

The control loop at each tick $t$:

```
observe:    o(t)    = O(K(t))                          ← sensor
decide:     a(t)    = π(o(t), history, β, ε)         ← controller
act:        K(t+1)  = T(K(t), a(t), Ω, β, ε)         ← plant + actuator
meta:       π′, β′  = μ(π, β, o(t), a(t), K(t))     ← meta-controller
```

Each component is itself a structured object with its own design space. The seven dimensions are **irreducible**: no dimension can be derived from the others, and together they fully determine the reasoner's behavior.

---

## §2 — The Seven Irreducible Dimensions

### §2.1 Ontology $\mathcal{K}$ — What Exists

$$\mathcal{K} = \langle\, \mathcal{T},\; \Sigma,\; \mathcal{M},\; \mathcal{H} \,\rangle$$

| Sub-component | Design space | SeNARS position |
|---|---|---|
| **Term algebra** $\mathcal{T}$ | Flat atoms → typed terms → dependent types → continuous embeddings | Narsese: 11 term kinds, discriminated unions, canonical interning. MeTTa adds dependent types. No continuous embeddings in the term algebra itself. |
| **State container** $\Sigma$ | Flat table → priority queue → graph → hypergraph → e-graph | Bounded `Bag<T>` priority queues + concept-link graph. E-graphs exist but only inside MeTTa (tool, not state). |
| **Memory architecture** $\mathcal{M}$ | Single store → working/episodic/semantic split → procedural + declarative → hierarchical consolidation | Working + episodic + semantic, all bounded bags. No explicit procedural memory (skills are tools, not learned motor schemas). |
| **Provenance** $\mathcal{H}$ | None → last-write-wins → version log → event sourcing → cryptographic chain | Append-only event log (JSONL/SQLite). Deterministic replay. Derivation traces with lineage DAGs. |

**Design space spectrum:**

```
Minimal                                          Maximal
  │                                                │
  Flat atoms    Typed terms    Dependent types    Continuous+symbolic hybrid
  Single store  Bag+graph      Hypergraph+egraph  Unified algebraic state
  No memory     Episodic       Ep+Sem+Proc        Full hippocampal model
  No history    Snapshots      Event sourcing     Cryptographically sealed
```

**SeNARS sits at roughly 65% on this axis.** It has rich term structure and event sourcing but lacks a unified algebraic state (Narsese and MeTTa are separate) and has no procedural memory.

---

### §2.2 Dynamics $\Omega$ — How State Changes

$$\Omega = \langle\, \Omega_{\text{sync}},\; \Omega_{\text{async}},\; \Omega_{\text{meta}},\; \Omega_{\text{ext}} \,\rangle$$

| Sub-component | Design space | SeNARS position |
|---|---|---|
| **Synchronous rules** $\Omega_{\text{sync}}$ | Fixed axiom system → rewriting → uncertain inference → gradient steps | 44 NAL rule declarations in 20 dispatch cells. Exact kind-pair dispatch, no wildcards. Truth algebra: revision, deduction, induction, abduction, comparison. |
| **Asynchronous proposers** $\Omega_{\text{async}}$ | None → template-based → neural → multi-agent debate | 19 LM rules (belief, goal, question, meta). Symbolic fallbacks for every cognitive function. Detached, fire-and-forget. |
| **Meta-rules** $\Omega_{\text{meta}}$ | None → parameter tuning → strategy switching → rule addition → architecture mutation | 5 meta-rules (strategy select, knob tune, test repair, schema promote, capability scaffold). 8 self-tools with shadow execution. |
| **External tools** $\Omega_{\text{ext}}$ | None → calculator → file I/O → arbitrary computation | MeTTa (exact rewriting), shell, web search, file system. All gated by ActionGate autonomy ladder. |

**Key structural property:** In SeNARS, $\Omega_{\text{sync}}$ is the **trusted core**. $\Omega_{\text{async}}$ is untrusted and judged before admission. $\Omega_{\text{meta}}$ operates on the system itself. $\Omega_{\text{ext}}$ is capability-sandboxed. This four-tier trust ordering is a design choice, not a necessity.

**Design space spectrum:**

```
Minimal                                          Maximal
  │                                                │
  Fixed axioms   Rewriting    Uncertain rules     Continuous+discrete hybrid
  No async       Templates    Neural proposers    Adversarial multi-agent
  No meta        Param tune   Strategy switch     Architecture evolution
  No tools       Calculator   Sandboxed compute   Arbitrary side-effects
```

**SeNARS sits at roughly 75%.** It has rich rule systems and meta-rules but lacks continuous-time dynamics and adversarial multi-agent reasoning.

---

### §2.3 Valuation $\mathcal{V}$ — How State Is Scored

$$\mathcal{V} = \langle\, \Phi_{\text{truth}},\; \Phi_{\text{priority}},\; \Phi_{\text{desire}},\; \Phi_{\text{rank}} \,\rangle$$

| Sub-component | Design space | SeNARS position |
|---|---|---|
| **Truth valuation** $\Phi_{\text{truth}}$ | Boolean → probability → (frequency, confidence) → evidential → sheaf-theoretic | NAL: $(f, c)$ pairs. Frequency = proportion of positive evidence. Confidence = amount of evidence. Not Bayesian (no prior/posterior), not Dempster-Shafer (no belief/plausibility). |
| **Priority** $\Phi_{\text{priority}}$ | FIFO → LRU → priority scalar → multi-dimensional attention | Priority scalar in bags, boosted by attention models (simple, spreading, goal-relevance, composite). Decays by LRU/access. |
| **Desire** $\Phi_{\text{desire}}$ | None → utility scalar → (desire, confidence) → multi-objective Pareto | Goals: $(d, c)$ pairs. Strict type-level separation from beliefs. RewardGate prevents desire from mutating truth. |
| **Ranking** $\Phi_{\text{rank}}$ | No ranking → score-sort → learned ranking → market-based | `rankDerivations`: $\text{score} = c \times |f - 0.5| \times 2 - \text{sizePenalty}$. Tautologies auto-dropped. Decision layer can reorder but never widen. |

**The epistemic firewall** is the defining structural constraint on $\mathcal{V}$: $\Phi_{\text{truth}}$ and $\Phi_{\text{desire}}$ occupy disjoint type spaces. Reward signals can modulate $\Phi_{\text{priority}}$ but never $\Phi_{\text{truth}}$. This is not a policy — it is enforced at the type level.

**Design space spectrum:**

```
Minimal                                          Maximal
  │                                                │
  Boolean       Probability   (f,c) pairs         Full evidential calculus
  FIFO          Priority      Multi-dim attention  Learned attention policies
  No goals      Utility       (d,c) + firewall    Multi-objective Pareto
  No ranking    Score-sort    Learned ranking      Market-based pricing
```

**SeNARS sits at roughly 70%.** The belief/goal firewall is strong. But ranking is hand-scored, not learned, and there is no formal information-theoretic question valuation.

---

### §2.4 Scheduling $\pi$ — What Changes Next

$$\pi = \langle\, \sigma,\; \alpha,\; \delta,\; \lambda \,\rangle$$

| Sub-component | Design space | SeNARS position |
|---|---|---|
| **Stage sequence** $\sigma$ | Fixed pipeline → conditional DAG → dynamic graph → market-based | **Fixed 6-stage sequence**: perceive→attend→reason→authorize→propose→learn. No conditional edges, no stage skipping. The only branch is `abort`. |
| **Attention model** $\alpha$ | Round-robin → priority → spreading activation → learned → goal-driven | 4 pluggable models. Resolved by `CognitiveController.buildInferenceController()`. Installed onto live memory. Rebuilt wholesale on strategy change. |
| **Dispatch policy** $\delta$ | Serial → parallel → pipeline → event-driven | Strictly serial within a tick. No parallel reasoning paths. No locks (concurrent `run()` calls would interleave). |
| **Learning policy** $\lambda$ | Fixed → periodic adaptation → online RL → evolutionary | RLFP (Reinforcement Learning from Reasoning Feedback): periodic optimization every 100 cycles. Strategy priority and exploration rate. Env-gated, not config-gated. |

**This is SeNARS's most constrained dimension.** The 6-stage sequence is hard-coded. The document itself identifies this as "the one open design item blocking the most architectural flexibility" (§13.3). Loop A solved the dispatch primitive (middleware onion); Loop B has not adopted it.

**Design space spectrum:**

```
Minimal                                          Maximal
  │                                                │
  Fixed pipe    Conditional    Dynamic graph       Market-based scheduling
  Round-robin   Priority       Learned attention   Goal-driven + curiosity
  Serial        Parallel       Event-driven        Fully concurrent foci
  Fixed         Periodic       Online RL           Evolutionary architecture
```

**SeNARS sits at roughly 40%.** This is the dimension with the most room for growth.

---

### §2.5 Bounding $\beta$ — What Limits Change

$$\beta = \langle\, B_{\text{main}},\; B_{\text{scopes}},\; B_{\text{decay}},\; B_{\text{back}} \,\rangle$$

| Sub-component | Design space | SeNARS position |
|---|---|---|
| **Lifetime budget** $B_{\text{main}}$ | None → step count → time → multi-dimensional | 4 dimensions: cycles (1000), depth (100), memory ops (10000), LM calls (50). Never resets. One arithmetic, one table (`BUDGET_RESOURCES`). |
| **Per-cycle scopes** $B_{\text{scopes}}$ | None → single counter → multi-scope → market | 6 declared scopes: derivations (100), premises (64), candidate-derivations (16384), proposal-application (64), control-work (16), decision-derivations (8). Open-once semantics. `beginCycle()` reopens all six. |
| **Decay/eviction** $B_{\text{decay}}$ | None → TTL → LRU → pressure-driven | Truth-value decay on temporal invalidation. Attention decay by LRU/access. Bag pressure triggers consolidation. |
| **Backpressure** $B_{\text{back}}$ | None → drop → queue → adaptive | CPU throttling via `sleep(paceMs)`. Cooperative yielding via `AbortSignal`. Bag pressure monitoring. Unbounded `PushQueue` (a known gap). |

**The AIKR principle** (Assumption of Insufficient Knowledge and Resources) is the philosophical foundation. The system is designed to degrade gracefully, not to assume infinite resources. This is what makes it suitable for edge deployment.

**Design space spectrum:**

```
Minimal                                          Maximal
  │                                                │
  Unbounded     Step limit     Multi-dim budget    Market-based allocation
  No decay      TTL            LRU + pressure      Learned eviction policies
  No backpress  Drop oldest    Queue + throttle    Adaptive rate control
```

**SeNARS sits at roughly 80%.** The budget system is sophisticated and well-designed. The main gap is that budget allocation is static (declared ceilings), not dynamic (market-based).

---

### §2.6 Trust $\varepsilon$ — What Gates Change

$$\varepsilon = \langle\, G,\; F,\; S,\; R \,\rangle$$

| Sub-component | Design space | SeNARS position |
|---|---|---|
| **Gates** $G$ | None → validation → admission control → full kernel boundary | 4 kernel gates: Perception, Action, Reward, Budget. Every state mutation passes through them. GateRegistry is a process-global singleton. |
| **Firewall** $F$ | None → naming convention → type-level → cryptographic | Type-level belief/goal separation. `CognitiveAxis = 'epistemic' | 'teleological'`. RewardGate rejects any reward that touches truth. |
| **Source quality** $S$ | None → binary trust → graduated quality → per-source reputation | 5-tier table: PRIMARY (0.9) → SECONDARY (0.7) → GENERAL (0.55) → TERTIARY (0.4) → LLM_PRIOR (0.5). Per-source reputation multiplier (floor 0.5). |
| **Judgment** $R$ | None → heuristic → calibrated → distillation flywheel | System One Judgment Manifold: 19 heads, isotonic calibration, Brier-scored, digest-pinned weights. Fail-closed ingress, fail-open egress. |

**The fail-closed/fail-open asymmetry** is the defining trust property:
- **Ingress** (untrusted → memory): fail-closed. An unjudged stimulus must not enter.
- **Egress** (derived → memory): fail-open. A provider fault must not halt cognition.
- **Internal** (cycle derivations): always admitted. The gate stamps budgets but has no refusal branch.

**Design space spectrum:**

```
Minimal                                          Maximal
  │                                                │
  No gates      Validation     4-gate boundary     Formal proof-carrying code
  No firewall   Convention     Type-level          Cryptographic sealing
  Binary trust  5-tier table   Per-source rep      Continuous trust calculus
  No judgment   Heuristic      Calibrated heads    Distillation flywheel
```

**SeNARS sits at roughly 85%.** This is its strongest dimension. The trust architecture is rigorous and well-enforced. The main gap is that trust is per-source, not per-claim (a single source's claims all share one reputation).

---

### §2.7 Reflexivity $\mu$ — Can the System Change Itself?

$$\mu = \langle\, O_\mu,\; A_\mu,\; L_\mu,\; G_\mu \,\rangle$$

| Sub-component | Design space | SeNARS position |
|---|---|---|
| **Self-observation** $O_\mu$ | None → logging → structured state → analyzers | 8 cognitive analyzers. State summary every 10 cycles. CycleTrace with stage regions. |
| **Self-action** $A_\mu$ | None → parameter tuning → tool registration → rule addition → architecture mutation | 8 self-tools. Shadow execution in git worktrees. Full CI validation before merge. |
| **Self-learning** $L_\mu$ | None → feedback → preference learning → schema induction → architecture search | RLFP (trajectory logging, preference collection, reward model, policy optimization). Schema induction from derivation chains. |
| **Self-governance** $G_\mu$ | None → approval → risk classification → external governance | PatchRiskClassifier → GovernancePolicyEngine → ProposalRouter → SandboxValidator. 5-rung autonomy ladder. External governance required for production. |

**Design space spectrum:**

```
Minimal                                          Maximal
  │                                                │
  Fixed         Param tune     Strategy switch     Architecture evolution
  No self-obs   Logging        8 analyzers         Continuous self-model
  No self-learn Feedback       RLFP + schemas      Architecture search
  No governance Approval       Risk classification  Formal verification of patches
```

**SeNARS sits at roughly 70%.** The self-improvement loop is well-designed but external (git worktrees, CI). A more integrated design would have internal formal verification.

---

## §3 — SeNARS as a Point

| Dimension | SeNARS Score | Key Strength | Key Limitation |
|---|---|---|---|
| Ontology $\mathcal{K}$ | 65% | Event sourcing, canonical terms | No unified algebraic state, no procedural memory |
| Dynamics $\Omega$ | 75% | 4-tier trust ordering, symbolic fallbacks | No continuous-time dynamics, no adversarial reasoning |
| Valuation $\mathcal{V}$ | 70% | Belief/goal firewall, type-level enforcement | Hand-scored ranking, no information-theoretic question value |
| Scheduling $\pi$ | **40%** | Pluggable attention, RLFP adaptation | **Fixed 6-stage sequence, serial execution, no conditional edges** |
| Bounding $\beta$ | 80% | 4-dim AIKR budget, 6 scopes, open-once | Static allocation, unbounded PushQueue |
| Trust $\varepsilon$ | **85%** | 4 gates, fail-closed/open asymmetry, judgment manifold | Per-source trust, not per-claim |
| Reflexivity $\mu$ | 70% | Shadow execution, governance pipeline, RLFP | External self-modification, no internal formal verification |

**SeNARS is a trust-maximal, schedule-minimal architecture.** It has invested heavily in epistemic safety and resource governance, but its control flow is the most constrained dimension. The natural direction for growth is **§2.4 (Scheduling)** and **§2.1 (Ontology)**.

---

## §4 — Proposed Extensions

### Extension 1: Data-Driven Stage Graph (Scheduling → 70%)

Replace the fixed 6-stage sequence with a **conditional stage graph**:

```
type StageSpec = {
  id: CycleStage;
  precondition: (ctx: TickContext) => boolean;    // guard
  postcondition: (ctx: TickContext) => boolean;    // assertion
  edges: Array<{ to: CycleStage; when: (ctx: TickContext) => boolean }>;
  budget: BudgetScopeId;                           // which scope pays
  failure: 'skip' | 'abort' | 'degrade';          // on precondition failure
};
```

The stage graph becomes **data**, loaded like the rule table. The `stage()` wrapper becomes a graph traversal. Conditional edges enable:

- Skip `propose` when no LM service is bound (currently it runs and does nothing).
- Skip `attend` when no drives are configured.
- Add a `negotiate` stage between `reason` and `authorize` when multiple foci exist.
- Insert a `validate` stage before `learn` when derivation recording is enabled.

This is the single highest-leverage change identified in flow.md §13.3.

### Extension 2: Parallel Foci with Synchronization (Scheduling → 80%)

Allow multiple `Focus` instances to reason in parallel, each with its own budget slice:

```
type FocusScheduler = {
  foci: Map<FocusId, Focus>;
  budget: FocusBag;                    // allocates by weight
  sync: 'barrier' | 'lockstep' | 'eventual';
  merge: (results: FocusResult[]) => AdmitBatch;
};
```

Each focus runs its own micro-tick. Results are merged at `authorize` via the existing `admit()` path. The `FocusBag` allocates budget by weight, and the `Negotiator` arbitrates conflicts. This preserves the "authorize is the only write path" invariant while enabling parallelism.

### Extension 3: Information-Theoretic Question Valuation (Valuation → 85%)

Add a formal **expected information gain** to question selection:

$$\text{EIG}(q) = \sum_{a \in \text{answers}(q)} P(a) \cdot D_{\text{KL}}\bigl(\mathcal{K} \cup \{a\} \;\|\; \mathcal{K}\bigr)$$

Questions with high EIG are prioritized for reasoning. This replaces the current heuristic question generation with a principled objective. The valuation function becomes:

$$\Phi_{\text{rank}}(t) = c \times |f - 0.5| \times 2 - \text{sizePenalty} + \gamma \cdot \text{EIG}(t)$$

where $\gamma$ is a tunable curiosity weight tied to the curiosity drive.

### Extension 4: Market-Based Budget Allocation (Bounding → 90%)

Replace static scope ceilings with an **internal market**:

```
type BudgetMarket = {
  scopes: Map<BudgetScopeId, BudgetBid>;
  auction: 'first-price' | 'second-price' | 'proportional';
  clearing: (bids: BudgetBid[]) => Allocation;
};
```

Each stage bids for budget based on its expected marginal value. The market clears at the start of each cycle. High-value derivations outbid low-priority observability. This replaces the current "exhaustion → silent drop" with "exhaustion → outbid by higher-value work."

### Extension 5: Correlation-ID Threading (Ontology → 75%)

Thread a `correlationId` through every layer:

```
Agent.chat(input, correlationId)
  → runCycleStream(ctx, correlationId)
    → NAREngine.reason(input, correlationId)
      → NARExecution.run(steps, signal, correlationId)
        → CycleTrace.begin(cycle, stage, correlationId)
        → PerceptionGate.admitTask(term, ..., correlationId)
        → EventLog.push({..., correlationId})
```

This makes the trace joinable to the stimulus, the event log, and the gate events. It answers "which cycle admitted this?" for a given conversational turn. Currently impossible.

### Extension 6: Per-Claim Trust (Trust → 95%)

Extend source reputation to **per-claim trust**:

$$\text{trust}(\text{claim}) = \text{sourceRep}(\text{sourceId}) \times \text{claimSpecificity}(\text{term}) \times \text{corroboration}(\text{claim})$$

A claim from a high-reputation source that is highly specific and corroborated by independent evidence gets higher trust than a vague claim from the same source. This moves trust from per-source to per-claim, enabling finer-grained epistemic control.

### Extension 7: Internal Formal Verification (Reflexivity → 85%)

Replace external git-worktree validation with **internal proof-carrying patches**:

```
type VerifiedPatch = {
  patch: CodePatch;
  proof: DerivationRecord;           // formal proof that the patch preserves invariants
  verifier: StandaloneVerifier;      // the same verify-derivation checker
  invariants: InvariantSpec[];       // which invariants are preserved
};
```

The system generates a formal proof that its proposed patch preserves all declared invariants. The proof is checked by the standalone verifier (zero engine dependencies). If the proof checks, the patch is auto-approved. If not, it falls back to the existing shadow execution + CI path.

---

## §5 — The Design Space Map

The seven dimensions generate a space in which known architectures are points:

| Architecture | $\mathcal{K}$ | $\Omega$ | $\mathcal{V}$ | $\pi$ | $\beta$ | $\varepsilon$ | $\mu$ |
|---|---|---|---|---|---|---|---|
| **Prolog** | Typed terms, flat table | Fixed resolution | Boolean | Depth-first, fixed | Unbounded (or depth limit) | None | None |
| **Bayesian Network** | Probability distribution | Conditional propagation | Probability | Fixed graph order | Unbounded | None | None |
| **Transformer** | Continuous embeddings | Gradient descent | Loss scalar | Fixed layer order | Compute budget | None | None (frozen weights) |
| **Soar** | Working + long-term memory | Production rules | Utility | Impasse-driven | None | None | Chunking (rule learning) |
| **ACT-R** | Declarative + procedural | Production rules | Activation + utility | Conflict resolution | None | None | Production compilation |
| **NAL/NARS** | Narsese terms, bags | NAL rules | (f,c) pairs | Priority bags | AIKR budget | None | None |
| **SeNARS** | Narsese + event log | NAL + LM + meta | (f,c) + (d,c) + firewall | 6-stage + attention + RLFP | 4-dim AIKR + 6 scopes | 4 gates + manifold | Shadow exec + governance |
| **Hypothetical Max** | Unified algebraic state | Continuous + discrete + adversarial | Full evidential + information-theoretic | Market-based, parallel foci | Dynamic market allocation | Per-claim, proof-carrying | Architecture evolution with formal verification |

SeNARS is roughly **2× more constrained** than the hypothetical maximum on scheduling, **1.5× on ontology and reflexivity**, and **1.1× on trust and bounding**. The trust dimension is nearest its ceiling.

---

## §6 — A More General Architecture

Combining all seven extensions yields a next-generation architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    UNIFIED ALGEBRAIC STATE                          │
│  Narsese terms ⊕ MeTTa e-graphs ⊕ procedural schemas ⊕ embeddings  │
│  Single event-sourced provenance chain                              │
│  Correlation-ID threaded through every layer                        │
├─────────────────────────────────────────────────────────────────────┤
│                    CONDITIONAL STAGE GRAPH                          │
│  Data-driven, loaded like the rule table                            │
│  Parallel foci with budget market allocation                        │
│  Synchronous barrier at authorize                                   │
├════════════════════════════════════════════════════════════════════╡
│  GATES: Perception │ Action │ Reward │ Budget │ Proof               │
├════════════════════════════════════════════════════════════════════╡
│                    TRUSTED COGNITIVE KERNEL                         │
│  Per-claim trust × source reputation × corroboration               │
│  Information-theoretic question valuation                           │
│  Epistemic firewall (belief/goal/procedural)                        │
├─────────────────────────────────────────────────────────────────────┤
│                    REFLEXIVE LAYER                                  │
│  Internal formal verification of patches                            │
│  Architecture search with proof-carrying constraints                │
│  Distillation flywheel (teacher→student)                            │
└─────────────────────────────────────────────────────────────────────┘
```

The key structural changes:

1. **State is unified.** Narsese, MeTTa, procedural schemas, and embeddings live in one algebraic state with one event log. No more "MeTTa is a tool, not an engine" — MeTTa is a *view* of the state.

2. **Control is data.** The stage graph is loaded, versioned, and revertable, just like the rule table. Conditional edges enable stage skipping, parallel foci, and dynamic reconfiguration without code changes.

3. **Budget is a market.** Stages bid for resources based on expected marginal value. The market clears each cycle. Exhaustion is replaced by outbidding.

4. **Trust is per-claim.** Source reputation is a prior, not a ceiling. Corroboration and specificity modulate trust per claim. Proof-carrying patches can bypass human approval for formally verified changes.

5. **Questions have value.** Expected information gain drives question selection, tied to the curiosity drive. The system reasons about what it should ask, not just what it can derive.

6. **Correlation is universal.** Every event, derivation, gate decision, and trace region carries a correlation ID. The system can answer "which stimulus caused this belief?" at any depth.

This architecture preserves everything SeNARS does well — the epistemic firewall, the fail-closed/fail-open asymmetry, the event-sourced provenance, the AIKR bounding — while opening the scheduling, ontology, and reflexivity dimensions that are currently most constrained. The result is a system that is simultaneously more powerful (parallel foci, information-theoretic questions), more flexible (data-driven stage graph, market budgets), and more elegant (unified state, correlation threading, per-claim trust).