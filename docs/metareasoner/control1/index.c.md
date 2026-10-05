# SeNARS Component Index

A taxonomy of every component type, its implementations/variants, and its function — organized by functional layer from outermost to innermost.

---

## 1. Control Loops

| Type | Variants | Function |
|---|---|---|
| **Agent Macro-Cycle** (Loop A) | `DEFAULT_MACRO_PIPELINE` (8 phases) | Conversational turn shell: perceive → recall → reason → narrate → consolidate → act → record → announce |
| **Kernel Micro-Tick** (Loop B) | `NARExecution.run()` (6 stages) | The actual reasoning cycle: perceive → attend → reason → authorize → propose → learn |
| **Inference Cycle** (Loop C) | `InferenceController.cycle()` (AsyncGenerator) | Symbolic derivation iteration inside `reason` |
| **Dead vocabulary** | `tick.ts` 11-stage list | Unused pipeline; source of `CycleStage` type + OTel span names only |

---

## 2. Kernel Gates (4)

The trusted boundary — every state mutation passes through these.

| Gate | Implementation | Function | Failure Policy |
|---|---|---|---|
| **PerceptionGate** | `KernelPerceptionGate` | Admits external stimuli → belief/goal/question tasks; stamps budgets | Ingress: **fail-closed**; Cycle path (`admitTask`): always admits |
| **BudgetGate** | `KernelBudgetGate` | Accounts CPU/derivation/LM/memory budgets; 4 dimensions | Grants or raises `TerminationReason` |
| **RewardGate** | `KernelRewardGate` | Accepts reward signals → mutates attention/policy only | **Epistemic firewall**: rejects Truth mutation |
| **ActionGate** | `KernelActionGate` | Authorizes tool execution via autonomy ladder | 5-rung state machine; human approval for escalation |

---

## 3. Strategy System (5 Slots)

Resolved via `CognitiveController.buildInferenceController()`. Each slot is pluggable.

### 3.1 SamplingStrategy
*Picks which concepts enter the inference cycle.*

| Variant | Function |
|---|---|
| `priority` | Priority-weighted sampling |
| `top-n` | Highest-priority N concepts |
| `novelty` | Novel/recently-created concepts |
| `goal-biased` | Biased toward active goals |
| `diverse` | Maximizes conceptual diversity |
| `windowed-roulette` | Windowed random with recency bias |

### 3.2 Premise Formation (Strategy)
*Selects secondary premises for a primary task.*

| Variant | Function |
|---|---|
| `default-formation` | Standard premise retrieval |
| `bag` | Priority-bag based selection |
| `resolution` | Logic-resolution style matching |
| `goal-driven` | Goal-relevance weighted |
| `analogical` | Analogy-based premise search |
| `sampled` | Probabilistic sampling |
| `exhaustive` | All available premises |
| `semantic` | Embedding-similarity based |
| `decomposition` | Compound-term decomposition |
| `prolog-resolution` | Prolog-style unification |
| `term-link` | Structural term-link traversal |
| `embedding-link` | Embedding-linked retrieval |

### 3.3 DerivationStrategy
*The async rule-firing loop.*

| Variant | Function |
|---|---|
| `default` | Standard derivation |
| `anytime` | Interruptible, yields partial results |
| `focused` | Narrow, depth-first focus |
| `sampled` | Probabilistic rule firing |

### 3.4 LM Rule Selection (ModelRuleSelector)
*Which model-backed rules may fire (proposal-time concern).*

| Variant | Function |
|---|---|
| `all` | Fire all applicable LM rules |
| `priority` | Priority-ranked selection |
| `rotation` | Round-robin cycling |
| `diverse` | Category-diversity selection |
| `lm-graph` | Rule-graph traversal |

### 3.5 AttentionModel
*Primes concepts and decays over time; installed onto live memory.*

| Variant | Function |
|---|---|
| `simple` | Direct priority boost |
| `spreading` | Spreading activation to linked concepts |
| `goal-relevance` | Goal-driven attention weighting |
| `composite` | Weighted combination of models |

---

## 4. Memory Subsystems

### 4.1 Core Memory
| Component | Function |
|---|---|
| `Memory` | Long-term concept memory with priority bags, links, decay |
| `EpisodicMemory` | Experience recording; queryable episodes |
| `MemoryService` | Agent-level: working + episodic + semantic composition |

### 4.2 Memory Ports (9 contracts)
The reasoning cycle depends on these named interfaces, not the concrete `Memory`:

| Port | Function |
|---|---|
| `ConceptReader` / `ConceptWriter` | Read/write concept access |
| `TaskAdmission` | Task intake |
| `BeliefTable` | Belief storage |
| `GoalEnumeration` | Goal listing |
| `LinkPort` | Concept-link access |
| `StatisticsView` | Memory stats/pressure |
| `SymbolIndex` | Symbol lookup |
| `MemoryClock` | Temporal operations |
| `AttentionOwner` | Attention model ownership |

`MemoryView` = the read surface strategies consume.

---

## 5. Drives (Homeostatic, 4)

| Drive | Goal Narsese | Decay/cycle | Replenished By |
|---|---|---|---|
| `curiosity` | `(self --> curious)!` | 0.02 | `generate_scenarios`, coverage expansion |
| `competence` | `(self --> competent)!` | 0.015 | Green tests, reward ↑ |
| `coherence` | `(self --> coherent)!` | 0.01 | Contradiction resolution, schema promotion |
| `social` | `(self --> social)!` | 0.05 | Human interaction (CLI/IRC) |

Mechanism: `DriveManager.updateCycle()` moves intensity 10% toward target, decays, clamps `[0,1]`; activates meta-goal injection below threshold.

---

## 6. Cognitive Analyzers (8)

| Analyzer | Function |
|---|---|
| `capabilities` | Tracks reasoning capability metrics |
| `corrections` | Detects/logs reasoning errors |
| `performance` | Throughput, latency, resource usage |
| `policy` | Validates actions against guardrails |
| `quality` | Coherence, relevance, completeness |
| `reasoning-patterns` | Recurring derivation structures |
| `resources` | Memory/CPU pressure, bag utilization |
| `term-patterns` | Term usage, concept relationships |

---

## 7. Budgets

### 7.1 Main Budget (lifetime, never resets)
| Limit | Value |
|---|---|
| `maxCycles` | 1000 |
| `maxDepth` | 100 |
| `maxMemoryOps` | 10000 |
| `maxLMCalls` | 50 |

### 7.2 Control Scopes (6, per-cycle via `beginCycle()`)
| Scope | Operation | Ceiling | Dimension |
|---|---|---|---|
| `derivations` | derivation | 100 | cycles |
| `premises` | premise-selection | 64 | cycles |
| `candidate-derivations` | candidate-derivation | 16384 | cycles |
| `proposal-application` | proposal-application | 64 | memoryOps |
| `control-work` | control-work | 16 | cycles |
| `decision-derivations` | decision-derivation | 8 | llmCalls |

---

## 8. Reinforcement Learning Substrate (Focus-Game-Reflex)

### 8.1 Core Primitives
| Primitive | Function |
|---|---|
| `Bag<T>` | Universal AIKR priority queue (bounded, probabilistic sampling, decay) |
| `Focus` | Isolated reasoning vessel with local bags |
| `FocusBag` | System-wide attention economy; samples Focus by weight |
| `Game` | Environment interface (the only one): `observe()` / `step(action)` |
| `Reflex` | Fast System-1 policy/value engine: `propose(state)` / `learn(event)` |
| `Negotiator` | Arbitrates Reflex proposals vs NAL derivations (NAL retains veto) |

### 8.2 Reflex Implementations
| Variant | Function |
|---|---|
| `TabularQReflex` | Tabular Q-learning |
| `EpsilonGreedyReflex` | ε-greedy exploration |
| `UCBReflex` | Upper Confidence Bound |
| `ManifoldReflex` | Judgment Manifold–driven |
| `ManifoldUCBReflex` | Manifold + UCB |
| `LMReflex` | LM-backed proposals (Arcade `lm` arm) |

### 8.3 Games (environment registry)
`snake`, `tetris`, `2048`, `tictactoe`, `gridworld`, `bandit`, `catch`, `arithmetic`, `rps`

### 8.4 Learner Domains (reward split)
| Learner | Domain | Mutates | Risk |
|---|---|---|---|
| `ReflexLearner` | external-reflex | Reflex Q-table/weights | Low |
| `SchedulerAdapter` | self-scheduler | FocusBag weights | Low |
| `PreferenceRanker` | self-explanation-rank | Explanation scores | Low |
| `ConfigOptimizer` | self-config-proposal | knob-tune proposals | Medium |
| `PatchSelector` | self-patch-score | patch-apply proposals | High |

---

## 9. LM Rules (Neuro-Symbolic Proposers)

All are **untrusted System 1 proposers**; outputs judged before state influence.

### 9.1 Belief Rules (10)
`lm-narsese-translation`, `lm-belief-revision`, `lm-hypothesis-generation`, `lm-explanation-generation`, `lm-analogical-reasoning`, `lm-meta-reasoning`, `lm-uncertainty-calibration`, `lm-schema-induction`, `lm-temporal-causal`, `lm-variable-grounding`, `lm-concept-elaboration`

### 9.2 Goal Rules (1)
`lm-goal-decomposition`

### 9.3 Question Rules (2)
`lm-curiosity-question`, `lm-interactive-clarification`

### 9.4 Meta V2 Rules (5)
`lm-v2-hypothesis`, `lm-v2-explanation`, `lm-v2-analogy`, `lm-v2-causal`, `lm-v2-schema`

---

## 10. System One — Judgment Manifold

The calibrated decision layer. All judgments sit behind the four kernel gates.

### 10.1 Cortex Ladder (3 tiers)
| Tier | Engine | Role |
|---|---|---|
| 1 | Judgment Manifold (local heads) | Judge everything, admit with calibrated truth |
| 2 | `LMServiceCortex` (GBNF-constrained LM) | Synthesize Narsese candidates (`proposeAndJudge`) |
| 3 | Symbolic stub | Degrade gracefully on LM failure |

### 10.2 Heads (19, from `HEAD_SPECS`)
Generated declaratively; include `plausibility`, `assertion`, `task_type`, `illocution`, `injection`, `ambiguity`, `tense`, `source_quality`, `feasibility`, `risk`, `reflex_value`, etc.

### 10.3 Policy Utilities
`truthProbability()`, `ConfidenceRouter`, `compositeScore`, `judgeCascade`, wake gate.

---

## 11. Engines & Computation

| Component | Role | Integration |
|---|---|---|
| `NAREngine` | Uncertain symbolic inference (System 2) | Registered as agent engine |
| MeTTa (`createMeTTa`, `EGraph`, `MeTTaRuntime`) | Exact algebraic rewriting, e-graphs, dependent types | **Tool only** (via ActionGate), not an engine |

**Arbiter Pattern**: NAR and MeTTa never share memory directly; both emit `EngineResult` proposals to the Kernel.

---

## 12. Agent Subsystems (`@senars/core`)

| Subsystem | Exports | Function |
|---|---|---|
| `Agent` | `Agent`, `createAgent` | Central orchestrator |
| Engines | `BaseEngine`, `NAREngine` | Reasoning backends |
| Cortex | `LLMCortex`, `createCortexFromLM` | LLM narrative synthesis |
| Memory | `MemoryService`, session managers | Working + episodic + sessions |
| Event Log | `InMemoryEventLog`, `SqliteEventLog` | Persistent audit trail |
| Tools | `ToolRegistry`, `BUILTIN_TOOLS` | Function calling + skills |
| Policy | `PolicyEngine`, `PolicyRule` | Guardrails / HITL |
| Approval | `ApprovalService`, `PendingApproval` | Human-in-the-loop |
| Model Runner | `ModelRunner`, `ToolCall`, `ModelEvent` | LLM orchestration |
| Knowledge | `KnowledgeManager` | Structured knowledge CRUD |

---

## 13. Transports (Multi-Transport Bot)

| Transport | Protocol | Use Case |
|---|---|---|
| CLI | stdin/stdout | Local REPL, scripting |
| IRC | IRC | Chat rooms, multi-user |
| WebSocket | WS | Real-time web clients |
| HTTP | REST | API integration |
| MCP | Model Context Protocol | AI assistant integration |

All share one agent instance via `ConnectionManager`.

---

## 14. State Machines

| Machine | States | Function |
|---|---|---|
| **Task lifecycle** | pending → running → completed/failed/expired | Tracks task admission |
| **Proposal lifecycle** | submitted → admitted → committed/rejected | Staged, lifecycle-judged candidates |
| **Component lifecycle** | created → initialized → started ⇄ stopped → disposed | Component lifecycle |
| **Autonomy mode** | observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production | ActionGate escalation ladder |

---

## 15. Meta-Rules (Self-Improvement, 5)

| Rule | Trigger | Action |
|---|---|---|
| Strategy Select | drive:competence low | `switch_strategy($s)!` |
| Knob Tune | reward below threshold | `^tune_knob($k,$v)!` |
| Test Repair | test_failed + error pattern | `apply_fix($fix)!` |
| Schema Promote | confidence > 0.9 & freq > 10 | `^promote_rule($s)!` |
| Capability Scaffold | capability + template | `^scaffold($tmpl,$c)!` |

---

## 16. Self-Tools (8, Shadow Execution)

`register_rule`, `register_tool`, `scaffold_capability`, `apply_fix`, `tune_knob`, `switch_strategy`, `run_tests_shadow`, `run_scenario_shadow`

All self-modification runs in a git worktree shadow with full CI validation before approval.

---

## 17. Observability & Tracing

| Component | Function |
|---|---|
| `CycleTrace` | Records 6 stage regions + auxiliary regions (BoundedRing depth 512) |
| `PhaseTimer` | Free-form phase timing (single clock) |
| `DerivationRecorder` | Step-level derivation records (opt-in, bounded) |
| `verifyRecord` | Standalone NAL proof checker (zero engine deps) |
| OpenTelemetry | `initOtel`, `getTracer` — per-stage spans with OTLP export |

---

## 18. Sandbox & Security

| Component | Function |
|---|---|
| `CapabilitySpace` | Secure capability execution |
| `createWasiSandbox` | WASI sandbox (deny-by-default, explicit env/paths) |
| `createWasmModuleSandbox` | WASM module with WASI imports |
| `createNodeVMSandbox` | JS isolation (deprecated for untrusted code) |

---

## Key Architectural Relationships

```
External Stimulus
    │
    ▼
┌─────────────────────────────────────────┐
│  LOOP A: Agent Macro-Cycle (8 phases)   │
│  perceive→recall→reason→narrate→...     │
│              │                          │
│              ▼                          │
│  ┌────────────────────────────────┐     │
│  │  LOOP B: Kernel Micro-Tick     │     │
│  │  (6 stages)                    │     │
│  │  perceive→attend→reason→       │     │
│  │  authorize→propose→learn       │     │
│  │         │                      │     │
│  │         ▼                      │     │
│  │  ┌──────────────────────┐      │     │
│  │  │ LOOP C: Inference    │      │     │
│  │  │ Cycle (derive loop)  │      │     │
│  │  └──────────────────────┘      │     │
│  └────────────────────────────────┘     │
└─────────────────────────────────────────┘
         │
         ▼
   4 KERNEL GATES
   (Perception · Budget · Reward · Action)
         │
         ▼
   EVENT LOG (append-only source of truth)
```

**Core invariant**: `authorize` (Loop B, stage 4) is the **only write path** into NAR memory. Everything else observes, proposes, or gates.
