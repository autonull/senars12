# SeNARS Component Index — Types, Implementations & Functions

A structured index of every component type in the system, its concrete implementations/variants, and its function. Organized by subsystem, following the architecture's own layering (kernel → reasoning → cognition → LM/System One → agent → ecosystem).

---

## 1. Control Flow Skeleton (the loops themselves)

| Component | Variants / Instances | Function |
|---|---|---|
| **Loop A — Agent Macro-Cycle** | 8 phases: `perceive → recall → reason → narrate → consolidate → act → record → announce` (`DEFAULT_MACRO_PIPELINE`, `phases.ts:321`) | Request-handling shell for one conversational turn. Middleware onion via `dispatch()` (`util/src/middleware.ts:13`); runs detached from stream drain. |
| **Opt-in macro phases** | `createCapturePhase` (`pipeline.ts:122`), `createReflectPhase` (`pipeline.ts:139`) | Capture wires in production (`bot.ts:352`); reflect is exported but unwired. |
| **Loop B — Kernel Micro-Tick** | 6 stages: `perceive → attend → reason → authorize → propose → learn` (`NARExecution.run()`, `nar-execution.ts:197`) | The actual reasoning cycle. Strictly serial `for`-loop; bounded by step count + `AbortSignal`. |
| **Dead vocabulary** | 11-stage list in `tick.ts:58-70` (`perceive, recall, attend, reason, propose, negotiate, authorize, act, validate, learn, consolidate`) | Not a loop — survives only as the `CycleStage` type and OTel span names. |
| **Loop C — Inference Cycle** | `InferenceController.cycle()` AsyncGenerator (`inference-controller.ts:111`) | Three nested loops inside the `reason` stage: sample concepts → select premises → fire derivations. |

---

## 2. Kernel Gates (the trusted boundary)

All four gates live in `GateRegistry` (`nar/src/kernel/GateRegistry.ts:14`); a process-global singleton exists at `:119`.

| Gate Type | Implementation | Function |
|---|---|---|
| **PerceptionGate** | `KernelPerceptionGate` (400 LOC) | Admits stimuli → belief/goal/question tasks. **Two paths with opposite semantics:** `admit()` (async ingress, fail-closed, System One judged) vs `admitTask()` (cycle path — *always admits*; an event emitter + budget deriver, not a filter). Emits `task.admitted`. |
| **ActionGate** | `KernelActionGate` (239 LOC) | Authorizes tool execution. Owns the **autonomy-ladder state machine** (5 modes). Scoped authorization for `game:<scopeId>:<action>` ops. |
| **RewardGate** | `KernelRewardGate` (159 LOC) | Epistemic firewall: rewards may mutate attention/policy only; throws if a reward touches `Truth.frequency`/`confidence`. Domain split (`external-reflex` direct; `self-*` → proposal). |
| **BudgetGate** | `KernelBudgetGate` (255 LOC) | Every grant/deny decision (`decideBudget` `:155`). Emits `budget.exhausted`. |

**Autonomy ladder (ActionGate states):**
`observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production` — escalation past sandbox requires `human`/`external-governance` authorization; `'system'` is refused.

---

## 3. Budget System (AIKR bounds)

### Two tiers

| Tier | Owner | Reset semantics | Function |
|---|---|---|---|
| **Main budget** | `KernelBudgetGate.budget` | Never (lifetime; `resetBudget()` only) | Global ceilings. |
| **Control scopes (6)** | `KernelBudgetGate.scopes` via `ControlBudgets` | `beginCycle()` reopens all six each cycle | Per-cycle bounds with open-once semantics. |

### Main limits (`NAR_BUDGET_LIMITS`, `KernelBudgetGate.ts:99`)
`maxCycles: 1000 · maxDepth: 100 · maxMemoryOps: 10000 · maxLMCalls: 50`

### The six declared scopes (`BUDGET_SCOPES`, `budget-scopes.ts:54`)

| Scope | Ceiling | Dimension | Charged by | Function |
|---|---|---|---|---|
| `derivations` | 100 | cycles | InferenceController | Bounds symbolic derivations per step. |
| `premises` | 64 | cycles | InferenceController | Bounds premise selections; exhaustion abandons all remaining concepts (exit E2). |
| `candidate-derivations` | 16384 | cycles | `RuleProcessor.applySyncRules` | Bounds rule-firing candidates. |
| `proposal-application` | 64 | memoryOps | `authorize` stage | Bounds draining of settled LM proposals; remainder stays queued. |
| `control-work` | 16 | cycles | meta-goal dedup, state summaries | Bounds O(N) observability/control reads. |
| `decision-derivations` | 8 | llmCalls | decision layer (`askSafely`) | Bounds veto/reorder LM calls; separate from `derivations`. |

### Core budget arithmetic (`@senars/core/budget`)
`budgetAffords` / `budgetRefusal` / `chargeBudget` — single table `BUDGET_RESOURCES` declares dimension names, ceiling keys, and `TerminationReason`s (`cycle-budget`, `depth-budget`, `llm-budget`, `deadline`, `backpressure`).

---

## 4. Memory Subsystem

| Type | Implementations / Variants | Function |
|---|---|---|
| **Memory** | `Memory` (`nar/src/memory/memory.ts`, 693 LOC) | Long-term concept memory: concepts, links, bags, `consolidate()` (decay, eviction, focus update). |
| **MemoryPorts** | 9 named contracts in `nar/src/memory/ports/`: `ConceptReader`/`ConceptWriter`, `TaskAdmission`, `BeliefTable`, `GoalEnumeration`, `LinkPort`, `StatisticsView`, `SymbolIndex`, `MemoryClock`, `AttentionOwner` | Ports-not-god-object: the cycle depends on these interfaces; `pnpm memory:ports` fails if a cycle module names `Memory` directly. |
| **MemoryView** | read surface | What strategy layers consume. |
| **EpisodicMemory** | `EpisodicMemory` | Experience recording; `record()` / `getEpisodes()`. |
| **Bag\<T\>** | universal AIKR priority queue | Capacity-bounded, probabilistic sampling, decay, LRU eviction. Used everywhere (working/episodic/semantic). |
| **Focus** | isolated reasoning vessel | Local `Bag<Task>` + `Bag<Concept>`; `step(budget)`; binds Gates/Games/Reflexes. |
| **FocusBag** | system-wide attention economy | Samples `Focus` by weight; `allocateBudget()`, `rebalanceWeights()`. |
| **AttentionModel** | `SimpleAttention` · `SpreadingActivation` · `GoalRelevanceAttention` · `CompositeAttention` | `prime()` + `tick()`; installed onto live memory via `CognitiveController.buildInferenceController()`. |
| **EmbeddingRuntime** | port in `memory/embedding.ts`; sole answerer `lm/embedding-runtime.ts` | Embedding-based similarity retrieval seam. |
| **Agent MemoryService** | `MemoryService` (`@senars/core`) | Working + episodic + sessions composition for Loop A. |
| **Session managers** | `InMemorySessionManager` · `JsonlSessionManager` | Conversation persistence. |
| **Event logs** | `InMemoryEventLog` · `SqliteEventLog` | Append-only cognitive audit trail (source of truth). |

---

## 5. Task & Proposal Lifecycles

| Type | Implementation | States / Variants | Function |
|---|---|---|---|
| **TaskManager** | `nar/src/task/manager.ts` (215 LOC) | `pending → running → completed/failed/expired`; `removePending` leaves no trace | Queues tasks, charges main `memory-op` budget, routes through PerceptionGate. Defaults: timeout 30s, `maxRetries: 3` (configured, **never read**). |
| **Proposal lifecycle** | `nar/src/proposal/lifecycle.ts` (299 LOC) | `submitted → admitted → committed/rejected` | Staged, lifecycle-judged candidates; revision = single monotonic counter; kinds diverge at commit (`rule` vs `content`). |
| **LM rule producer** | `lm-rule-producer.ts` (245 LOC) | `stage()` / `pump()` / `takeDerived()` | Detached pump; proposals admitted ≥1 cycle late (drained at next `authorize`). |
| **StreamReasoner** | `nar/src/stream` | pressure/flush/queue-full paths | Bounded LM-backed reasoning with backpressure; `runStream` now routes through the one InferenceController. |

---

## 6. Reasoning Core (System 2)

| Type | Implementation | Function |
|---|---|---|
| **InferenceController** | exactly one instance, one `.step()` site (CI-gated) | Drives Loop C; args: `timeoutMs=5000`, `maxResults=effectiveSteps×100`, signal. |
| **RuleProcessor** | `nar/src/rules` | Applies NAL rule matrix; hosts `DerivationRecorder`. |
| **Rule table** | 44 declarations in 20 dispatch cells (`BUILTIN_DECLARATIONS`, `registration.ts`); loaded data, versioned, revertable | Exact kind-pair dispatch; `pnpm dispatch:no-wildcard`, `pnpm rules:loaded-data`. |
| **Derivation ranking** | `rankDerivations` (`rules/impls/ranking.ts:22`) | Pressure valve: `score = confidence × |f−0.5|×2 − sizePenalty`; tautologies dropped; `maxAdmissions` truncation. Precedes decision reorder. |
| **Truth algebra** | `Truth`: `revision · deduction · induction · abduction · comparison · negation · expectation` | Non-axiomatic truth values (frequency + confidence). |
| **Term system** | `TermBuilder`, `termParser`, `TERM_REDUCERS` + `TASK_REDUCERS` (`terms/reduce.ts`) | Canonical interning; fixed-point normalization; negation moves into frequency. |
| **Term kinds** | atomic, variable, inheritance, similarity, implication, equivalence, conjunction, disjunction, negation, sequence, parallel | Full Narsese grammar. |
| **MeTTa** | `createMeTTa`, `parseMeTTa`, `EGraph`, `MeTTaRuntime`, multi-space | Exact computation substrate (equality saturation, pattern matching, dependent types). Invoked **as a tool** through ActionGate — never shares memory with NAR (Arbiter pattern). |

---

## 7. Strategy Slots & Catalogue

Resolved through `CognitiveController.buildInferenceController()` (`CognitiveController.ts:135`). Source of truth: `nar/src/cognitive/registrations.ts`.

| Slot | Interface | Registered variants | Function |
|---|---|---|---|
| **Sampling** | `SamplingStrategy` | `priority` · `top-n` · `novelty` · `goal-biased` · `diverse` · `windowed-roulette` | Picks which concepts enter the cycle. |
| **Premise formation** | `Strategy` | `default-formation` · `bag` · `resolution` · `goal-driven` · `analogical` · `sampled` · `exhaustive` · `semantic` · `decomposition` · `prolog-resolution` · `term-link` · `embedding-link` | Secondary premise retrieval (`selectSecondary`). |
| **Derivation** | `DerivationStrategy` | `default` · `anytime` · `focused` · `sampled` | The async rule-firing loop (`derive`). |
| **LM rule selection** | `ModelRuleSelector` | `all` · `priority` · `rotation` · `diverse` · `lm-graph` | Which model-backed rules may fire (proposal-time concern). |
| **Attention** | `AttentionModel` | `simple` · `spreading` · `goal-relevance` · `composite` | Priming + tick; installed onto live memory. |

⚠ Controller is rebuilt wholesale on any strategy change — loses `derivationCount` and circular-detector state; reconfigure mid-`step()` is unguarded.

---

## 8. Drives & Meta-Goals

| Type | Implementations | Function |
|---|---|---|
| **DriveManager** | `DriveManager.ts` (94 LOC) | Homeostasis: 10% error correction toward target, decay, clamped [0,1]; `isActive = intensity ≥ threshold`. |
| **Drives (4)** | `CuriosityDrive` · `CompetenceDrive` · `CoherenceDrive` · `SocialDrive` | Intrinsic motivation channels. |
| **Meta-goal injection** | `injectMetaGoals()` (`nar-execution.ts:641`) — budgeted `control-work` | Drive → goal mechanism #1: injects Narsese operations when threshold crossed. |
| **Drive-goal injection** | `injectDriveGoal()` (`DriveManager.ts:90`) | Mechanism #2: calls `nar.input()` directly, bypassing task queue. |

| Drive | Threshold | Meta-goal |
|---|---|---|
| competence | 0.3 | `switch_strategy((focused-->strategy),(derivation-->strategyType))` |
| curiosity | 0.3 | `run_scenario_shadow((induction-->profile))` |
| coherence / social | — | none |

---

## 9. Cognitive Control & Metacognition

| Type | Implementations | Function |
|---|---|---|
| **CognitiveController** | `CognitiveController.ts` (241 LOC) | Executive: `adapt()`, strategy switching, controller rebuild. |
| **Cognitive analyzers (8)** | `capabilities` · `corrections` · `performance` · `policy` · `quality` · `reasoning-patterns` · `resources` · `term-patterns` | Specialized monitors. |
| **ReasoningAboutReasoning** | `nar/src/self` | Metacognitive self-analysis: `performMetaCognitiveReasoning()`, `performSelfCorrection()`, `assessQuality()`, `analyzeReasoningGaps()`. |
| **SchemaInductor** | `createSchemaInductor` (`nar/src/learning`) | Induces reusable schemas from derivation chains (e.g., transitivity). Reached from construction/consolidation, **not** the tick. |
| **RLFPLearner** | `nar/src/rlfp` + `PreferenceCollector` · `RewardModel` · `PolicyOptimizer` | RL from reasoning feedback: trajectories, preference pairs, PPO/GRPO. Env-gated (`RLFP_ENABLED`), read once per `run()`. |

---

## 10. LM Layer (untrusted System 1 proposers)

The cycle path never imports `nar/src/lm/` (`pnpm core:no-lm`). Core names capability ports instead:

| Core declares | Replaces | Function |
|---|---|---|
| `ModelRule` | `LMRule` | Structural satisfaction checked at `registerModelRule`. |
| `TextGenerator` | `LMService` | One-method generation port. |
| `EmbeddingRuntime` | `getLMSettings()` | Injection seam for embeddings. |
| `ModelRuleSelector` | `LMRuleSelector` | Proposal-time selection. |

### LM rules (19 total)

| Category | Rules |
|---|---|
| **Belief (11)** | `lm-narsese-translation` · `lm-belief-revision` · `lm-hypothesis-generation` · `lm-explanation-generation` · `lm-analogical-reasoning` · `lm-meta-reasoning` · `lm-uncertainty-calibration` · `lm-schema-induction` · `lm-temporal-causal` · `lm-variable-grounding` · `lm-concept-elaboration` |
| **Goal (1)** | `lm-goal-decomposition` |
| **Question (2)** | `lm-curiosity-question` · `lm-interactive-clarification` |
| **Meta V2 (5)** | `lm-v2-hypothesis` · `lm-v2-explanation` · `lm-v2-analogy` · `lm-v2-causal` · `lm-v2-schema` |

### Supporting machinery

| Component | Function |
|---|---|
| `symbolicFallbacks` (`lm/rule-templates/fallbacks.ts`) | Every cognitive function has a pure-NAL fallback on LM failure. |
| `ShadowValidator` | Silently drops LLM Narsese conflicting with current beliefs. |
| `TraceAbstractor`, `attemptLMCorrection` | Bidirectional NAR↔LM correction loops. |
| GBNF grammars | Constrained decoding (`narsese-term` / `single-word`). |
| **LM profiles** | `auto` · `cloud-quality` · `local-private` · `openai-compatible`; providers: `openai` · `anthropic` · `openai-compatible` · `llamacpp` · transformers.js |

---

## 11. System One — Judgment Manifold

| Type | Implementations / Variants | Function |
|---|---|---|
| **JudgmentManifold** | `SystemOneManifold`; remote variant via `provider: 'http'` | Calibrated decision layer: one batched `judgeBatch` per context. Behind all four gates; disabled path byte-identical. |
| **Heads** | 19 heads from single `HEAD_SPECS` table; `plausibility` + `assertion` ship default | Judge task_type, illocution, injection, ambiguity, tense, source_quality, feasibility, risk, reflex_value, candidate_select, etc. Digest-pinned weights (`ModelDigest = SHA256(encoder ++ headWeights)`). |
| **EmbeddingCache** | O(1), alias-free, single layer | Context embedding cache. |
| **Calibrators** | isotonic, `calibration-lock.json` | Honest calibration; untrained heads report `fitted: false` and pass through. |
| **Policy utilities** | `truthProbability()` · `ConfidenceRouter` (act/review/block bands) · `compositeScore` · `judgeCascade` · wake gate | Score semantics: probability-weighted; routers may only restrict. |
| **TraceGrader** | grades cycles (groundedness/risk) | Feeds distillation dataset. |
| **Cortex ladder** | Tier 1 manifold → Tier 2 `LLMCortex` (GBNF) → Tier 3 symbolic stub | Graceful degradation. |
| **Distillation flywheel** | `JudgmentDataset` (hash-only JSONL + vector sidecar) → `train.ts` → `calibration-fit.ts` → bake-off → sandboxed head swap | Teacher→student loop. |

---

## 12. Reflexes, RL & Games

| Type | Implementations | Function |
|---|---|---|
| **Reflex** (System-1 policy engine) | `TabularQReflex` · `EpsilonGreedyReflex` · `UCBReflex` · `ManifoldReflex` · `ManifoldUCBReflex` · `LMReflex` | `propose(state)` / `learn(event)`; arbitrated by Negotiator. |
| **Negotiator** | single impl | Arbitrates Reflex proposals vs NAL derivations — **NAL retains veto**. |
| **Game** (only environment interface) | `snake` · `tetris` · `2048` · `tictactoe` · `gridworld` · `bandit` · `catch` · `arithmetic` · `rps` | `observe()` / `step(action)` / `legalActions(state)`; registered via `GameSpec`. |
| **Focus variants** | `GameFocus` · `MetaFocus` | Environment-bound vs self-game vessels. |
| **MetaGame / SelfMetaGame** | `^focus_weight`, `^knob_set` | Self-improvement game surface. |
| **RL adapters** (`@senars/nar/rl`) | `QBeliefStore` (Q/SARSA/TD via `Truth.revision`) · `RewardBeliefAdapter` · `BeliefPerceptionAdapter` · `GoalActionAdapter` · `RLParityHarness` · `ManifoldRLAgent` | NAL-native learners; manifold RL without NAL. |
| **LearnerRegistry domains** | `external-reflex` · `self-scheduler` · `self-explanation-rank` · `self-config-proposal` · `self-patch-score` | Reward domain split; unknown domain → `CrossDomainError` (fail-closed). |

---

## 13. Agent Layer (`@senars/core`)

| Type | Implementations | Function |
|---|---|---|
| **Agent** | `Agent` (`Agent.ts`, 308 LOC) | Central orchestrator; owns Loop A; `chat()` / `cycle()`; `setMacroPipeline()`. |
| **Engine** | `BaseEngine` · `NAREngine` (145 LOC) | Macro→micro bridge; owns `run(3)`/`run(5)` step counts. MeTTa is a tool, not an engine. |
| **Cortex** | `LLMCortex`, `createCortexFromLM` | Narrative synthesis (Loop A `narrate`). |
| **GroundednessGate** | optional host component | Per-narration verifier in Loop A (distinct from Loop B egress judging). |
| **PolicyEngine / PolicyRule** | guardrails | Command authorization in `act` phase. |
| **ApprovalService / ApprovalManager** | `PendingApproval` | Human-in-the-loop. |
| **CommandParser** | `MettaCommandParser.parse` | Parses commands from narration. |
| **ModelRunner** | `ToolCall`, `ModelEvent` | LLM orchestration. |
| **KnowledgeManager** | structured CRUD | Knowledge management. |
| **StatsManager** | telemetry | Agent stats. |
| **Lens/Protocol** | `Lens`, `GraphNodeData`, `GraphOp`, `CognitiveDelta` | UI projection types. |

---

## 14. Tools

| Type | Implementations | Function |
|---|---|---|
| **ToolManager** | `discoverTools`, `@Tool` decorator | Registration + execution. |
| **Built-in tools** | `fs` (`fs_read`/`fs_write`/`fs_append`, sandboxed) · `shell` (30s timeout) · web (`search` across Tavily→Brave→DuckDuckGo, `web_fetch`) · memory (`remember`/`query`/`episodes`) · `metta` · `explain` · `sleep` · `timer` · approval | Function-calling surface. |
| **SelfTools (8)** | `register_rule` · `register_tool` · `scaffold_capability` · `apply_fix` · `tune_knob` · `switch_strategy` · `run_tests_shadow` · `run_scenario_shadow` | Self-modification via shadow git worktrees + full CI. |
| **Result constructors** | `toolOk` / `toolError` (`@senars/util`) | Single constructor pair; a tool that reports failure must never fail while reporting. |

---

## 15. Governance & Self-Improvement

| Type | Implementations | Function |
|---|---|---|
| **Meta-rules (5)** | Strategy Select · Knob Tune · Test Repair · Schema Promote · Capability Scaffold | All AIKR-bounded: depth=2, budget=5/step. |
| **PatchRiskClassifier** | scores against guard-rail file list | Risk classification for self-patches. |
| **GovernancePolicyEngine** | risk × AutonomyMode → `AUTO_MERGE / CREATE_PR / REQUIRE_HUMAN_REVIEW / REJECT` | Governance decisions. |
| **ProposalRouter** | consumes `SelfRewardGate` proposals | Low-risk auto-applies; medium → sandbox; high → human. |
| **SandboxValidator** | auto-approves in-range knob-tunes | Range-checked vs `rlfp/knobSchema`. |

---

## 16. Natural Language Services

| Type | Implementation | Function |
|---|---|---|
| **NLUnderstandingService** | multi-candidate formalization | NL → `FormalizationCandidate[]` with `sourceSpans` + `ambiguityFlags`; `SingleFlight` dedup; `translateCached` path. |
| **NLGenerationService** | Narsese → NL | Answer generation with trace. |
| **ContextAssembler** | context assembly | Assembles context for generation. |

---

## 17. Observability

| Type | Implementations | Function |
|---|---|---|
| **CycleTrace** | `@senars/nar/proposal/cycle-trace`; `BoundedRing` depth 512 | Stage regions; one trace + one clock; `findStageOverlaps()` / `findInCycleProposals()`. |
| **PhaseTimer** | free-form timing (`trace/phase-timer.ts`, 85 LOC) | Second stack removed (mis-attribution bug). |
| **OTel** | `initOtel` · `shutdownOtel` · `emitEvent` · `getTracer` | OpenTelemetry export; batch span processor. |
| **EventBus** | `@senars/util` | `nar:reasoning:cycle` · `nar:derivation` · `contradiction` · `cognitive:state:summary` · `task.admitted` · `budget.exhausted` · `policy.violation`, etc. |
| **PushQueue** | unbounded (`util/src/events/push-queue.ts`) | Loop A streaming; silent drop after close; **no backpressure mechanism**. |
| **Prometheus** | `systemone_*` counters, `lm_spend_*` | `/metrics` + `/metrics.json` via Web UI server. |
| **DerivationRecorder** | opt-in, bounded (200 steps/record, 200 records) | Step-level provenance capture. |
| **Verifier** | `verifyRecord` (`@senars/core/verify-derivation`) + CLI script | Standalone proof checker; transcribed truth table; drift-pinned against engine. |

---

## 18. Sandbox & Capabilities

| Type | Implementation | Function |
|---|---|---|
| **CapabilitySpace** | composes sandboxes | Secure capability execution. |
| **WASI sandbox** | `createWasiSandbox` | Deny-by-default env/paths; explicit allowlist; timeouts. |
| **WASM module sandbox** | `createWasmModuleSandbox` | Loads `.wasm` with WASI imports; path containment checks. |
| **Node VM sandbox** | `createNodeVMSandbox` | **Deprecated** for untrusted code; trusted-but-faulty isolation only. |

---

## 19. IO & Transports

| Type | Implementations | Function |
|---|---|---|
| **ConnectionManager** | `@senars/io` | Multi-transport binding to one agent. |
| **Transports (5)** | `CLIConnection` · `IRCConnection` · `WSConnection` · `HTTPConnection` · `MCPConnection` | All share one agent instance; env-gated (`ENABLE_IRC`, etc.). |

---

## 20. Source Quality & Grounding

| Source Type | Quality | Confidence ceiling |
|---|---|---|
| Official/SEC/PubMed | PRIMARY | 0.9 |
| Major news (Reuters, AP) | SECONDARY | 0.7 |
| Wikipedia/News | GENERAL | 0.55 |
| Blog/Forum | TERTIARY | 0.4 |
| LLM Prior | LLM_PRIOR | 0.5 |

**Source reputation** (`source-reputation.ts`): multiplies ceiling only (floor 0.5); trust-not-truth.

---

## Key Structural Asymmetries (cross-cutting)

1. **PerceptionGate:** fail-closed on async ingress; *always admits* on cycle path (`admitTask` has no refusal branch).
2. **Two write paths, different bounds:** `processPending` charges lifetime main budget (10,000 ops); proposal path charges per-cycle scope (64).
3. **Veto vs admission:** egress veto is remove-only/fail-open; ingress is fail-closed.
4. **`derived` conflates** tasks-admitted + derivations-produced.
5. **`maxRetries`/`retryBackoffMs`** configured but never read — no retry path exists.
6. **`pending_tool_executions`** hard-coded `[]` in state summaries.
7. **`control-work` exhaustion** reports as `aikrPressure: 'low'` (health) — starvation indistinguishable from measurement absence.
