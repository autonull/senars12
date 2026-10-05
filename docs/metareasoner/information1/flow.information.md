# SeNARS — Information Flow Graph

> Technical reference. Captures every component and the information that flows between them.
> Notation: `→` transfer · `⇄` loop · `⊣` gate/veto/filter · `⊗` fusion/join · `≡` replay/reconstruction · `◊` bounded resource (AIKR).

---

## 0. Vocabulary

**Payloads**

| Type | Meaning | Canonical home |
|---|---|---|
| `NL` | natural-language utterance | `util/types` |
| `Term` | Narsese term (atom, var, inheritance, similarity, implication, equivalence, conjunction, disjunction, negation, sequence, parallel, set, operation) + `Stamp` | `nar/terms` |
| `Truth{f,c}` | belief truth; `BeliefTruth` (branded, `0..1`) | `util/types/truth`, `Truth` impl `nar/terms/impls/Truth` |
| `Desire{d,c}` | goal desire; teleological twin of `Truth` | `nar/lm/system-one/desire` |
| `Task` | `{term, type: belief\|goal\|question, truth, stamp, budget, priority}` | `nar/types/core`, zod `core/schemas/task` |
| `Operation` | `operation(name, args)` — an action request inside the term language | `nar/terms/operation-term` |
| `Derivation` | `{premises, ruleId, conclusion, truth, premiseTruths, independence}` | `nar/rules/impls/recorder` |
| `DerivationRecord` | bounded derivation trace (200 steps × 200 records) | `core/schemas/derivation-records` |
| `Judgment` | head → `ScoreDistribution` + calibration + `modelDigest` + `ResourceCost` | `nar/decision/types` |
| `Proposition` | `JudgmentProposition` (band, abstain, provenance) / `Candidate` / `Synthesis` | `nar/decision/types` |
| `CognitiveEvent` | append-only kernel event union | `core/schemas/cognitive-events` |
| `Reward` | `{domain, signal, scope}` — never carries truth | `nar/game/rewards`, `rlfp` |
| `Proposal` | `ContentProposal` \| `RuleProposal` \| `SelfImprovementProposal` | `nar/proposal`, `nar/meta/proposal-bag` |
| `Patch` | shadow-worktree diff + risk classification | `nar/governance/pipeline` |
| `Episode` / `DialogueTurn` / `Retrospective` / `Lesson` | experience records (hash-only at rest) | `nar/memory`, `nar/dialogue` |
| `FocusState` | `NARState` (working/episodic/semantic/decisions) | `nar/game/types` |

**Axes / vocabularies that must not blur**

| Axis | Values | Enforced by |
|---|---|---|
| `CognitiveAxis` / `DecisionAxis` | `epistemic` \| `teleological` (synthesis: `none`) | one type, two names, `nar/decision/types` + `ports/decision` |
| belief vs goal | `Statement(f,c)` vs `Goal(d,c)` | structural type split + `RewardGate` firewall |
| `ConfidenceRouter` band | `act` \| `review` \| `block` | `system-one/policy` |
| `AutonomyMode` | `observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production` | `kernel/KernelActionGate` |
| `CapabilityTier` | `0 reflex` \| `1 manifold` \| `2 cortex` \| `3 NAL-governed` | `agent/profiles` |
| `TerminationReason` | `cycle-budget` \| `depth-budget` \| `llm-budget` \| `deadline` \| `backpressure` | `core/budget`, `kernel/budget-scopes` |
| `RewardDomain` | `external-reflex` \| `self-scheduler` \| `self-explanation-rank` \| `self-config-proposal` \| `self-patch-score` | `learning/domain-learners` |

---

## 1. Topology

```
┌─ senars (root app) ──────────────────────────────────────────────┐
│ src/bin/{bot,senars,mcp-server,replay,imagine,self-report,       │
│           config-validate}.ts · src/config · src/cli · src/index │
└───────────────┬──────────────────────────────────────────────────┘
                │ composes everything
   ┌────────────┼────────────┬────────────┬────────────┬─────────────┐
   ▼            ▼            ▼            ▼            ▼             ▼
 @senars/     @senars/     @senars/    @senars/     @senars/     (deps)
   util         core         io          nar         metta
  (leaf)    (agent rt)  (transports) (kernel)  (exact calc)
                │            │            │            │
                └────────────┴──────┬─────┴────────────┘
                                     ▼
                             @senars/ui (console)
```

| Package | Role | Notable internals |
|---|---|---|
| `util` | Leaf vocabulary, zero workspace deps | `SenarsError`+25 codes · `EventBus`/`Signal`/`ListenerBag`/`PushQueue` · `Middleware.dispatch` (one onion dispatcher) · `Ledger<T>` append-only JSONL · `CommandRegistry` + `QUIT_SENTINEL` · `Logger` · `InMemorySessionManager` · zod-bound tables (`nar-core-bounds`, `cognitive-bounds`, `system-one`, `dialogue`, `lm-schema`) · `CACHE_DIR`/`cachePath` |
| `core` | Agent runtime + invariants boundary | `Agent` · `Lifecycle` · `ModelRunner` (AI-SDK) · `PolicyEngine` · macro `pipeline`/`phases` · `LLMCortex` · `motor` (`ToolRegistry`, `dispatchToolCalls`, `BUILTIN_TOOLS`, `web-search`, `workspace`) · `eventlog` (InMemory/Sqlite) · `zod schema stack` (truth/task/event-base → common/budget/governance/rule-table/proposal/formalization/derivation-records/nar-events → gate-io → cognitive-events) · `budget`+`budget-otel` · `cognitive-thread` (CognitiveThread/ThreadPool, hard budget inheritance) · `ApprovalService` · `Plugin(Loader)` · `lens-schema` · `metta-port` · `verify-derivation` (the one proof checker) |
| `io` | Transports + routing | `MessageRouter` · `ConnectionManager` (factories) · `AuthManager` · `BaseConnection` + `cli/http/ws/irc/mcp/reply-target` · `ConnectionBinder` (`bindAgentToConnection`, `originExtractor`) · `MiddlewarePipeline` (auth, command-intercept, session-bind, rate-limit, error-boundary) · `ConfigFromEnv` · `startHttpServer`/`startWS*`/`ApiKeyManager` |
| `nar` | Cognitive kernel (74 modules) | see §3–§9 |
| `metta` | Exact computation | `core` (`Space`/`InMemorySpace`, `ops` registry, `Stamp`, `hash`, `pattern-match` fail-closed) · `engine` (`EGraph`, `MeTTaInterpreter` Effect-based, `PatternMatcher`, `unify`, `reduce`, `MettaEngine`) · `parser` · `runtime` (`createMeTTa`, `MeTTaContext`, `DEFAULT_MEMORY_LIMIT`) · `stdlib` (~260L grounded ops) · `extensions/persistent-space` · `ipc` (valibot protocol + SharedArrayBuffer SPSC ring) · `agent` (`createMettaPort`, `MettaCommandParser`) · `performance` (JIT, `parallelMap/Reduce`) · `types` (AST, Π/Σ typechecker) |
| `ui` | Web console | `server` (http+ws, `UnifiedGraphProjection` → `GraphDelta`, `buildConfigSchema` from bounds) · `client/core` (~35 `$` signals, ws-client, Cytoscape renderer, Lit base) · `client/modulation` (`const/field/channel/when/union`, `evaluateModulation`, `diffDelta`, memo) · `client/spacegraph` (SpaceGraphJS 3D host) · 17 components + primitives · `webllm` (in-browser model) |
| root `scripts/` | Gates, benches, demos, servers, S1 ops | see §11 |

> Migration residue (deprecated aliases, re-export shims, barrel gaps, stray files) is
> out of scope here — see `legacy.md`.

**Dependency invariants (structural, CI-enforced)**

| Invariant | Mechanism |
|---|---|
| Cycle path never imports `nar/src/lm` | core declares `ModelRule` (`rules/types`), `TextGenerator` (`ports`), `EmbeddingRuntime` (`memory/embedding`), `ModelRuleSelector` (`strategies/types`); `lm/` satisfies them at the composition root (`facade/`, `nl/`, `agent/`, `system-one-wiring.ts`) |
| One inference path | `gates:one-cycle-path`; `stream` no longer owns a pipeline |
| One gate registry per instance | `createGateRegistry()`; two agents never share autonomy/allowlist/veto state |
| `device` profile never imports LM | tier-0 profile; `cycle:no-provider` |
| Package direction | `deps:direction` / `deps:gate` / `exports:{check,barrels,audit}` |

---

## 2. Boot & Macro Flow

### 2.1 Bot boot order (`src/bin/bot.ts`, `bin.senars`)

```
parseFlags → non-interactive: --help | --status | --doctor | --tune | --arcade | --multiagent
 → ensureDir(.cache/sessions)
 → createAgentFromEnv():
     loadConfig(appConfigSchema) → configureLM(resolveLMSettings/resolveLMConfig)
     → provider registry + lmService → routing policy
     → EpisodicMemory · JsonlSessionManager
     → NARBuilder.fromProfile('tool-use')
          .withLM · .withSystemOne{tier,params} · .withCapabilities{self,lmRules,rlfp,nar}
          .withDeviceHead (tier-0 WASM head, digest-pinned) · .withParameters · .withGates
          .withPersistence · .withMemory · .withMetta · .withSessionManager · .withSkills
          .withConversation · .withTrajectoryStorePath · .withConsolidation · .withThreadScope
        → build(): validate LM requirements → compose NARConfig → CognitiveRegistry
                 → createGateRegistry().initialize → new NAR(...) → dynamic import createAgent
                 → optional loadHeadBundle / CapabilityOntology → WiredNAR{agent,nar,gates,describe}
     → initializeLMRules (binds bus, toolDispatcher, SystemOne rule adapter for
        lm-narsese-translation | lm-meta-reasoning | lm-uncertainty-calibration)
     → initializeTools (discoverTools + metta + self-tools when enableSelf)
 → AuthManager + ConnectionManager{cli,irc,ws,http,mcp} + session
 → SourceReputation · GroundednessGate · trace/dataset · DialogueCapture + RetrospectiveAdapter
 → MettaProposer · decider/NLUnderstandingService · MemoryQuery · ParameterLedger
 → buildCommands() + buildBotCommands(rt) → CLIConnection.connect → agent.mount(cli)
 → auto-connect from ENABLE_IRC|WS|HTTP|MCP (skipped when BOT_CLI_ONLY) + bind bridges
 → agent.start() → optional startAgentUI (ENABLE_WEB_UI) → graceful shutdown
     (snapshot → close → stop → shutdownAll)
```

Other entries: `senars.ts` (headless, `maxConcepts:100`) · `mcp-server.ts` (McpServer + JobManager + NAR tools/resources/prompts + conditional dialogue tools; stdio or sse/http behind `HttpGuard`) · `replay.ts` (gate-events.jsonl → `replayIntoMemory` → state hash → `--verify`) · `imagine.ts` (treadmill/scenario sweep) · `self-report.ts` (self-concept + meta-rules) · `config-validate.ts` (schema + effective LM matrix) · `src/index.ts` (library barrel, no boot).

### 2.2 Two cycles, nested

| Cycle | Phases | Where |
|---|---|---|
| **Kernel micro-tick** | `CYCLE_STAGES = [authorize, perceive, attend, reason, propose, learn]` | `nar-execution.ts` `NARExecution.run()`; each stage a `CycleTrace` region |
| **Agent macro-cycle** | `Perceive → Recall → Reason → Narrate → Consolidate → Act → Record → Announce` (`DEFAULT_MACRO_PIPELINE`) | `core/agent/phases`; micro-tick lives inside **Reason** |
| **Focus tick (RL)** | `observe → negotiate → decide → act → reward` | `focus/GameFocus.ts` |
| **Self loop** | `Perceive → Recall → Reason(meta-rules+drives) → Act(tools) → Record → Consolidate` | `ReasoningAboutReasoning` + self-tools |

`AUXILIARY_REGIONS` = `cycle, rlfp.optimize, self.assess, self.correct, memory.consolidate`.

### 2.3 Micro-tick sequence (exact)

```
run(steps, signal, correlationId)
 cycleTrace.setCorrelationId; rlfpEnabled = RLFP_ENABLED && policyOptimizer
 per iteration:
   cycleCount++ ; region('cycle') ; budgets.beginCycle() ; reset cycleSignals
   perceive : dispatchToolGoals()               # operation goals → toolGoalExecutor (removed from pending)
              taskManager.processPending()      # → admit() → perception gate
   attend   : driveManager.updateCycle() ; injectMetaGoals(charge 'control-work', dedupe)
              cognitiveController.adapt()
   [RLFP shaping: strategyPriority = bestStrategy; effectiveSteps 1..5 ∝ explorationRate]
   reason   : inferenceController.step(5000, effectiveSteps*100, signal) → nar:reasoning:cycle
   authorize: derived = proposals.takeDerived()
              for task of rankForAdmission(await vetoAtEgress(results)) → admit(task)
              settled proposals charged 'proposal-application' (memoryOps) then admit
              [decision port: admission-order (classify) ; egress-veto (evaluate)]
   [drive stimulation from cycleSignals]
   propose  : pumpProposals(signal)   # NOT awaited
   learn    : RLFP optimize/updateModel on interval
              self.assessQuality every 10 cycles (self.correct if overall < 0.4)
              emitCognitiveStateSummary() every 10
   onCycleEnd
 after loop: region('memory.consolidate', memory.consolidate)
```

`admit()` = **the single write path**: `memory.addTask` → emit `nar:derivation` → `classifyTask` signals (`testPassed`/`testFailed`/`contradictionDetected` + typed `contradiction` event).
`stage(name, work) = region(name, work)` with `finally` → trace is correctness record *and* measurement (`getPhaseSummary` → `summarizeRegions`).

### 2.4 Where each gate is actually invoked

| Gate | Invocation site | Consequence |
|---|---|---|
| Perception | `admit()` (derived tasks) and `NARIO` (ingress `input/believe/goal/question/reward/inputTask`) | only place a refusal policy can land |
| Budget | **only** `ControlBudgets.charge(scopeId)` + `StreamReasoner.flush` pre-check `{operation:'lm-call'}` | one arithmetic path |
| Decision | **only** `authorize` (2 registered call sites) | fail-soft: `null` ⇒ declared symbolic path |
| Action | `focus/GameFocus.actStage` before `game.step`; also `ToolManager`/tool dispatch | authorization before effect |
| Reward | `GameFocus.actStage` after step; `ExternalRewardGate` / `SelfRewardGate` | firewall on truth |

---

## 3. Ingress Flows

| # | Source | Path | Out |
|---|---|---|---|
| **I1** | `NL utterance` (CLI/IRC/WS/HTTP/MCP) | `MessageRouter` → middleware (rate-limit → auth → session → command-intercept) → `Agent` → **System One ingress before parsing** → `NLUnderstandingService.understand` → `FormalizationBatch{candidates, sourceSpans, ambiguityFlags}` → `KernelPerceptionGate.admit / admitFormalization` | provisional `Task[]`, `occurrenceTime`, truth ceiling |
| **I2** | Narsese direct (`believe/goal/question`, REST `/api/v1/nar/*`, WS `nar.input`) | Tier-0 Narsese heuristic parse → `NARIO` → `admitTask` | `Task` |
| **I3** | `Game.observe()` | `BeliefPerceptionAdapter` / `focusTask`/`perceptionTasks` → perception gate | `Task` |
| **I4** | Peer delegation (`CognitiveTaskDelegation`) | WS/MCP → `handleDelegationMessage` / `JudgmentDelegationPeer` → PerceptionGate @ `PEER_AGENT` → shadow-validation | `Task` or drop |
| **I5** | Recall | `MemoryPorts{ConceptReader, BeliefTable, GoalEnumeration, LinkPort, SymbolIndex, StatisticsView, MemoryClock}` → `MemoryView` / `MemoryQuery` | context beliefs, episodes |
| **I6** | Bootstrap | `BOOTSTRAP_GOALS` / `createBootstrapTasks`; `SELF_CONCEPT_BELIEFS`; `seedBelief`; arcade `--mode cognitive` seeds game rules | `Task` |
| **I7** | Tools/ops | fs/shell/web/memory results, `reward`, `stateTerm/actionTerm/rewardTerm` | `Task` / `Reward` |
| **I8** | Retrospective lessons / `.reconsolidate` | `nar.input` (Narsese self-beliefs) | `Task` |

**Ingress judgments (System One, one joint `judgeBatch` over one embedding)**

```
raw utterance → PerceptionGate.admit(raw)
  ├─ Tier-0 parse (Narsese heuristic, unchanged)
  ├─ EmbeddingCache (O(1), alias-free, single caching layer)
  └─ judgeBatch: task_type · illocution · injection · ambiguity · tense · source_quality
        ├─ ambiguity abstain → inject clarification Question + curiosity drive
        ├─ tense             → occurrenceTime anchor
        ├─ injection         → refuse
        └─ source_quality    → seedTruth ceiling (LLM_PRIOR default)
IngressJudge → IngressVerdict(accept|reject|flag)  ·  judgments are ADOPTED, not discarded
```

**Truth seeding**: `SOURCE_QUALITY_CONFIDENCE` — PRIMARY .9 / SECONDARY .7 / GENERAL .55 / TERTIARY .4 / LLM_PRIOR .5 → × `SourceReputation` multiplier (floor .5, neutral 1.0) → `effectiveCeiling`; `seedTruth`/`seedDesire`/`calibrateAuthority`. Reputation keys = `domainKey`/`providerKey`; persisted `.cache/parameters/source-reputation.jsonl` (append-only). Trust-not-truth: multiplier moves the **ceiling**, never a `Truth` value.

---

## 4. Kernel Gates

```mermaid
flowchart LR
  P[UNTRUSTED PROPOSERS<br/>LM(S1) · NAL · Reflexes · Games · Peers] -->|proposal / tool request| PG[PerceptionGate]
  PG -->|Task| F[Focus / FocusBag]
  F --> R[reason: NAL + S1 + Manifold]
  R -->|derived| AG[ActionGate ⊣ Negotiator veto]
  AG --> EX[execute: Tools / MeTTa / Game.step]
  EX --> RW[RewardGate]
  RW -->|attention + policy only| L[Learners]
  PG & AG & RW -.-> BG[BudgetGate]
  BG -.->|affords / refusal| ALL
  PG & AG & RW & BG --> LOG[(Event Log: SQLite / JSONL)]
  LOG === RP[replayCognitiveState]
```

| Gate | In → Out | Rules |
|---|---|---|
| `KernelPerceptionGate` | stimuli → `Task` | quality→confidence map; lossless `admitTask(term,type,truth,source,stampId)`; provisional multi-candidate (`admitFormalization`); source-reputation ceiling; derived tasks stamped `'derivation'` and admitted; `admitTask` always admits (the refusal branch is unreachable) |
| `KernelActionGate` | `Operation`/tool call → authorized | `AutonomyMode` FSM · operation allow-list · **NAL veto registry** (`NALVetoError`) · scope/tier gating via `ParameterTable` |
| `KernelRewardGate` | `Reward` → attention/policy | `ExternalRewardGate` (direct, low risk) vs `SelfRewardGate` (→ proposals); `EpistemicFirewallViolation` on any `Truth.frequency`/`confidence` mutation |
| `KernelBudgetGate` | any op → charge / refuse | `BUDGET_RESOURCES` (4 dimensions) is the single table; `budgetAffords` / `chargeBudget` / `budgetRefusal`; refusal names a dimension only once that dimension is spent, else `backpressure`; undeclared op (cast-only, `BudgetOperation` closed enum) granted, charged nothing |

**Control-scope budget table** (`BUDGET_SCOPES`, `kernel/budget-scopes.ts`) — each row declares *which dimension* it spends; `scopeLimitKey` and `scopeTerminationReason` derive:

| Scope | Purpose | Spends |
|---|---|---|
| `derivations` | per-cycle derivation count | derivations |
| `premises` | premise sampling | derivations/memoryOps |
| `candidate-derivations` | candidate derivations before ranking | derivations |
| `proposal-application` | applying settled proposals | memoryOps |
| `control-work` | meta-goal injection, control bookkeeping | derivations |
| `decision-derivations` | decision-port queries | decision |

`ControlBudgets.charge(scopeId)` · `beginCycle()` · `getSpendSummary()` · `UNBUDGETED` escape · per-`scopeId` (per-focus) ceilings from `NARConfig.controlBudgets`.

**Gate outcome plumbing**: `kernel/gate-base.ts` → `recordGateDecision(gate, operation, {granted, reason})` → Prometheus `gateDecisionsTotal` / `gateVetoesTotal` + `decisionSpan` (correlation on span, thunk memoized) → `gateLog<T>()` bounded drop-oldest ring (`GATE_LOG_CAPACITY = 1000`) → `persistGateLogs` / `loadGateEvents` / `replayTaskAdmissions`.

---

## 5. Reason Flows

### 5.1 NAL inference (System 2)

```
Focus.step(budget) → stepFocusUnderDeadline (AbortSignal + wall-clock)
 → sample premises: priority · top-n · novelty · goal-biased · diverse · windowed-roulette
      (composite weights; PREMISE_SCORER_REGISTRY / PREMISE_FILTER_REGISTRY)
 → form pairs: default-formation · bag · resolution · goal-driven · analogical · sampled
      · exhaustive · semantic · decomposition · prolog-resolution · term-link · embedding-link
 → InferenceController.step(5000, budget, signal) → RuleProcessor → RuleIndex
      table = BUILTIN_DECLARATIONS (44 rules / 20 exact kind-pair cells, artifactVersion builtin/1)
      bodies resolve at load; unimplemented name is refused loudly; DISABLED_RULES honoured
      revision/provenance stamped at admission; empty table is runnable
 → truth algebra: revision · deduction · induction · abduction · comparison · negation
      · expectation · structural/transductive extensions
 → rankDerivations: score = c·|f−0.5|·2 − min(0.3, len/2000); cap = ranking.maxAdmissions
      (tautologies score ≤ 0 → auto-dropped)
 → admit (perception gate) + DerivationRecorder (200×200) → ProofStreamRing
 → verifyRecord (standalone; re-computes truth algebra, checks grounding, lineage DAG, independence)
```

- **Term canonicality**: `TERM_REDUCERS`/`TASK_REDUCERS` registry → `canonicalTerm`/`canonicalTask`; interning + stable hash dedup; `(a & b) ≡ (b & a) ≡ (a & b & c)`; negation folds into frequency (`(--x).f = 1 − f_x`).
- **Meta-rules**: `META_RULES_NARSESE` / `buildMetaRules` / `initializeMetaReasoning` — 5 rules (strategy-select, knob-tune, test-repair, schema-promote, capability-scaffold), each AIKR-bounded.
- **Strategies**: registry-built, schema-validated, memoized; `stateful` strategies reject config; `AdaptiveStrategy` exported but unreachable from config; strategy algebra (`composeStrategy`, derivation expressions) + `nal-ab` A/B over variants.
- **Circular/depth**: `createCircularDetector`, `exceedsDepthLimit`, `DEPTH_MAX`.
- **Counterfactual**: `reason/counterfactual` → `CounterfactualReport`; `cognitive/counterfactual.runCounterfactual`.

### 5.2 MeTTa (exact substrate — invoked, never parallel)

```
Operation goal ⊣ ActionGate → metta tool {program} → MettaPort → MeTTaRuntime
 → Space(s): facts, types, signatures          (fork / merge / clone / persist)
 → pattern-match (fail-closed) · unify (occurs check) · type inference (Π/Σ)
 → reduction: rewrite rules (= lhs rhs) with guards · EGraph equality saturation
   · stdlib grounded ops · JIT (hot path) · parallelMap/Reduce
 → EngineResult → proposal → kernel
```

**Arbiter invariants**: NAR and MeTTa never share memory; e-graph never unions on NAR similarity; `definitional-equality` ≠ `uncertain-equivalence`; interpreter step cap `DEFAULT_MAX_STEPS = 10000`; `DEFAULT_MEMORY_LIMIT`; IPC via valibot protocol + shared-memory ring; `MettaCommandParser` for chat commands; `ProofMettaProposer` derives MeTTa rules from proof streams (`meta/`).

### 5.3 Untrusted proposers (System 1)

| Proposer | Produces | Judged by |
|---|---|---|
| `LMRule` ×19 (11 belief, 1 goal, 2 question, 5 meta-V2) | Narsese candidates, decompositions, explanations, schemas, analogies, causal/temporal models, clarifications, curiosity questions | System One adapter (fast path for 3 rules) → else prompt+GBNF → structured/text; per-rule `CircuitBreaker` + timeout; `ShadowValidator` drops belief-conflicting output; `constitution` check; `applyFallback` on failure |
| `Reflex` family (`TabularQ`, `Bandit`, `EpsilonGreedy`, `UCB`, `LMReflex`, `ManifoldReflex`, `PlacementCascadeReflex`, `MettaProposer`, heuristic/random/replica arms) | `propose(state) → ActionProposal` | `Negotiator.resolve` — NAL veto **action-matched**, falls back to best non-vetoed (never stalls); `WeightedQuorum` / `NalVetoArbitration`; `agreeByExactAlgebra` |
| `LLMCortex` / `LMServiceCortex` | NL narration, term synthesis | re-judged (synthesis axis `none`); egress `GroundednessGate` (`egress.gate.rejected` visible, never silently swapped) |
| `Peer agent` | `CognitiveTaskResult` | `PEER_AGENT` ceiling + shadow validation |
| `Remote manifold` | `JudgmentProposition` | capped at `LLM_PRIOR`; malformed/dead ⇒ fail closed |
| `Rule table` (data) | rules at runtime revision | `rule-table` store: admit at boundary, diff artifacts, revert; empty = runnable |

**Failure escalation (universal)**: attempt → retry at temp +0.2 → `null` → symbolic fallback (`rule-templates/fallbacks.ts`: template translation, causal, abduction, similarity, grounding, elaboration, clarification, curiosity, conjunction decomposition, `noSymbolicEquivalent`). Every cognitive function has a symbolic path.

### 5.4 LM service — the one call protocol

```
LMRule.apply | LLMCortex | dispatcher | trace-grader | compaction
  → LMService.generateText | tryGenerateText (temp ladder) | generateObject (zod → JSON-mode fallback) | stream
      → open(task, modelOverride)   # fail closed: no model ⇒ LMUnavailableError
      → getModelForTask: override → chain reordered by stats (pickModel objective weights)
                          → registry slot (cloud | llamacpp | llamacpp-embedded | webllm | builtin | mock)
      → CallAccounting.execute(spec, gate):
           gate()   breaker fail-fast (per-provider, PROVIDER_CIRCUIT_DEFAULTS)
           lookup() ResponseCache (60 s TTL LRU, djb2 key: prompt|task|temp|maxTokens|grammar|model)
           transport: AI-SDK generateText/generateObject/streamText
                      wrapped in runWithGrammar(AsyncLocalStorage) + withRetry(withHint ladder)
                      output size capped (LM_MAX_OUTPUT_CHARS, 64 KiB)
           bill()   SpendLedger: tokensIn/Out/calls/costMilli per provider; throws past LM_MAX_SPEND_USD
           settle() cache write, stats fold, routing telemetry, demote on transport error, one re-probe
      → LMResponseParser.parse/validate → Term+Truth → Task[] (lmTaskWeight) → admitTasks (gates + shadow)
```

Emitted: `lm.prompt`, `lm.response`, `lm.failure`, `lm.fallback`, `lm.tool-error`, `system:lm.rule:{skipped,structured,applied,constitution-violation}`, `recordLmSpend`, `recordLMCall`, `recordCircuitBreakerState`, `recordLmProbe`, `lm.provider/model/success/latency_ms` span attrs.
Providers: OpenAI · Anthropic · openai-compatible · llama.cpp (fetch, alias resolution, `chat_template_kwargs` thinking modes) · embedded node-llama-cpp · WebLLM (webgpu|cpu) · transformers.js · mock. Routing: `RoutingPolicy` (objectives quality|fast|structured), `offlineLadder` self-upgrading, demotions, health probes, `LM_PROFILE = auto|cloud-quality|local-private|ollama|production`.

### 5.5 Judgment Manifold (System One) + Decision Port

```
embedding (1× per context, 384-d pooled, LRU + free-list)
 → HEAD_SPECS (19 heads, groups; specToQuery/evaluateQuery/headRubrics)
 → heads (plausibility, assertion = safety floor; classify heads judge over the query's declared space)
 → isotonic calibrators (calibration-lock.json) + RollingECEMonitor + DriftDemotionManager
 → unfitted ⇒ calibration.fitted=false ⇒ mask/floor pass through
 → JudgmentPipeline (confidence | cascade | consensus) + ConfidenceRouter bands
 → JudgmentProposition{bands, abstain(8 reasons), provenance, calibrationDigest, modelDigest, ResourceCost}
 → chargeJudgment / resource-gate (judgments cost LM-equivalent units)
```

| Decision surface | Path |
|---|---|
| Ingress | `SystemOneIngressJudge` + `WakeGate` (`wake|not_yet|unrelated`) |
| Cycle admission | `DECISION_CALL_SITES.authorize.admission-order` — `classify`, axis `epistemic`, budget `decision-derivations`, `DECISION_ASK_TIMEOUT_MS=500`; `null` ⇒ symbolic order; weights restricted to shown terms (reorder, never create) |
| Cycle egress | `authorize.egress-veto` — `evaluate` per candidate (≤ `egress.maxCandidates`), `score ≥ vetoThreshold` ⇒ removed before ranking; absence/fault/abstain = no veto (logged) |
| Proposer re-judge | `Dispatcher.proposeAndJudge` (budget-gated, provisional params) |
| Reflex | `PrefetchTable` (attend-stage prefetch → propose-time consume) · `ManifoldRLAgent` (`reflex_value+feasibility+risk`, ε-greedy/UCB) · `ActionGateTransducer` (proposal → desire/capability → action) |
| Egress NL | `GroundednessGate` (decider + `ContrastiveMemory`) |
| Traces | `TraceAbstractor` → `CriticalPath` · `TraceGrader` → groundedness/risk grades + labels |
| Remote | `createHttpManifold` (`POST /v1/systemone`, zod) · `createOpenSystemOneManifold` (replica, wire interop kev/von/simple-jev) · `handleSystemOneRequest` + `admitRemotePropositions` |

Integrity: `ModelDigest = SHA256(encoderDigest ++ headWeightsDigest)`; `verifyModelDigest`; mismatch ⇒ `DigestMismatchError`; trained heads load only via `SandboxedHeadRuntime` / `loadHeadBundle` (hand-emitted WASM, deny-by-default imports, zero-import). Fallbacks: `ConstantManifold`, `DeterministicManifold`, `Tier3SymbolicManifold`.

**DecisionPort** (`ports/decision.ts`): one method `ask(request) → DecisionResult|null`; `null` = absent/refusal/fault/timeout; `askSafely` = deadline + catch; `NO_DECISION_PORT`; `DECISION_POSITIONS = ['cycle','boundary']`; `SynthesisQuery` type-incompatible with `position:'cycle'`; binding via `NARConfig.decision` (configuration, not wiring); `config:model-matrix` gate fails on an unregistered call site.

### 5.6 Policy utilities

`truthProbability` (boolean eval) · `compositeScore` · `judgeCascade` (two-stage hierarchical) · `ConfidenceRouter` (act/review/block; monotonic — a router may only restrict) · `isRestrictive` · `createWakeGate` · `createTraceGrader` · per-level `legend` (triangular kernel over anchors, normalized) so weighted position ≈ calibrated scalar · sampled self-consistency for stability under seeded perturbation (single-shot stays deterministic) · `SAFETY_FLOOR_VETO_SCORE` · `AlgebraPurityError` (validation of batch queries; fail-closed).

---

## 6. Memory Flows

| Store | Structure | Write | Read |
|---|---|---|---|
| Working / Semantic | `Bag<T>` (capacity-bounded, `FenwickTree` O(log n) priority ops, LRU + `evictUnderPressure`, `BagSlot` names) over `Concept` / `Task` | `admit()`, `Consolidate`, consolidation | `MemoryPorts` reads |
| `ConceptGraph` / `CausalIndex` | co-activation + causal edges | activation propagation | link formation, `similarity` |
| Associative | `LinkLayerMemory` / `GraphMemory` / `AssociativeRegistry` / `EmbeddingLayer` | embeddings + links | `TermLinkStrategy`, `EmbeddingLinkStrategy`, `selectSimilar` |
| Episodic | `EpisodicMemory` JSONL ledger, `episode-consolidator` (priority + `symbolicSummary`), `retrieval-verified` promotion, `lifecycle/{Archive,Forgetting}` | `record()`, `DialogueCapture` | `query`/`episodes` tools, `recallEpisodes`, curriculum probes |
| Revision history | per-concept truth evolution | `Truth.revision` | `explain`, `trace`, `derivation` |
| `MemoryIndex` / `SymbolIndex` / `term-filter` | symbol + term matching | — | query surface |
| `MemoryView` | read surface for strategies | — | strategy layer |
| State | `MemoryState` serialize/validate/repair + `state/codec` (`senars.state` envelope, strict kind/version) | `StatePersister` (v1) | fast boot |
| Ports (9) | `ConceptReader/Writer`, `TaskAdmission`, `BeliefTable`, `GoalEnumeration`, `LinkPort`, `StatisticsView`, `SymbolIndex`, `MemoryClock`, `AttentionOwner` → `MemoryPorts` | `Memory` composes and satisfies | `pnpm memory:ports` gate |
| Resource policy | `RESOURCE_CONTRACTS`/`RESOURCE_IDS` — declared lifecycle of every unbounded container | `resource:policy` gate | retention/capacity audit |
| Attention | `SimpleAttention` · `SpreadingActivation` · `GoalRelevanceAttention` · `CompositeAttention` · `NullAttentionModel`; `attention:write-surface` gate | priority writes | slot reads |

Decay discipline: truth decays only on temporal invalidation or contradiction; attention decays by LRU/access time. Pressure → backpressure → consolidation → sleep → schema induction.

---

## 7. Act & Egress Flows

### 7.1 Action

```
Operation goal / tool call / reflex action
 → ActionGate.authorize (autonomy mode, allow-list, NAL veto, scope/tier, ParameterTable)
 → policy check (core PolicyEngine: command/file/shell allow-deny → PolicyDecision)
 → ApprovalService (HITL pending) if required
 → sandbox (WASI | wasm-module | node-vm[deprecated]) with path containment, env {}, timeout 30s
 → execute: ToolRegistry / ToolManager / motor dispatch / metta port / Game.step / shell / fs
 → ToolResult via toolOk | toolError (unknown coerced; partial/metadata second arg)
 → telemetry + ToolFeedbackObserver (tool/skill stats) → event log
 → egress: response to originating connection (reply-target resolution)
```

**Tool surface**: `fs_read/fs_write/fs_append` (workspace-sandboxed) · `shell` (30 s async) · `web` (`search` via Tavily→Brave→DuckDuckGo, `tavily_search`, `brave_search`, read-only `web_fetch`) · `memory` (`remember`, `query`, `episodes`) · `metta` (honest error when port absent) · `explain` · `sleep` · `timer` · approval utilities · self-tools (8: `register_rule`, `register_tool`, `scaffold_capability`, `apply_fix`, `tune_knob`, `switch_strategy`, `run_tests_shadow`, `run_scenario_shadow`) · adapters (`aisdk`, `code-exec`, `codemod`, `proc`, `rag-query`, `test-gen`, `test-runner`, `vitest-run/json`, `scenario-execute/gen/profiles`, `shadow-worktree`, `coverage-concept`) · agent-facing set (`registerAgentTools`, `motorToToolSet`).
Goal dispatch is native AST: `readOperationTerm(goalTerm)` → `{name,args}` → `resolveSemanticArgs` → `execute` (no `metta:`-style string routing).

### 7.2 Egress

| Surface | Carrier | Content |
|---|---|---|
| CLI REPL | `CLIConnection` | `senars>` prompt; NAR/memory/LM/SystemOne/diagnostics commands; `.connect/.connections/.disconnect`; `:judge/:health/:spend`; `.react/.turns/.retrospect/.retrospectives/.lessons/.adaptations[.restore]/.probes/.schemas-induce/.reconsolidate`; bounded backlog + `QUIT_SENTINEL` |
| IRC | `IRCConnection` | flood protection, reg handshake timeout, Libera defaults |
| WebSocket | `WSConnection` | `nar.input/run/query`; protocol messages; heartbeat |
| HTTP | `HTTPConnection` | `/api/v1/nar/{believe,goal,question,run,beliefs,concepts,stats}`; CORS; `ApiKeyManager`; bounded in-flight + abandoned-handler timeout; `/metrics`, `/metrics.json` |
| MCP | `MCPConnection` + `src/bin/lib/mcp/*` | `registerNARTools`, `registerAgentAPI`, resources, prompts, `JobManager`, `dialogue_react/turns/retrospect/probes` |
| Web UI | `startAgentUI` | `UnifiedGraphProjection → GraphDelta`; `cognitive.delta` graph ops; `config.schema/set`; `lens.list/define`; `sync.request/state.snapshot`; `viewport.set/focus.set`; `history.request`; `chat.*`; telemetry; 3D graph (SpaceGraphJS) + 2D Cytoscape; Lens designer; node drawer; timeline scrubber |
| Peer | `cooperation/delegation` | `CognitiveTaskDelegation` / `CognitiveTaskResult` |
| Process | event log, snapshot, `.reports/`, trace export (JSON-LD / GraphML / Mermaid), Prometheus, OTel OTLP | audit + analytics |

**Lens** (declarative UI projections): `LensSpec` AST (`const/field/channel/when/union`) → `compile` → `Modulation` → `evaluate/diffDelta` → channels (color, size, opacity, stroke); builtins: `belief` (color=f, opacity=c), `goal` (size=priority, cyan), `contradiction` (orange dashed). Node types: `NarConceptNode`, `MettaAtomNode`, `MettaSkillNode`.

---

## 8. Learn Flows

### 8.1 One substrate, five reward domains

```
Game.step / task outcome / human reaction / derivation outcome / MC-return
 → Reward → RewardGate (firewall) → LearnerRegistry.dispatch(event.domain)
     ├─ external-reflex       → ReflexLearner      → Reflex Q-table / policy weights
     ├─ self-scheduler        → SchedulerAdapter   → FocusBag weights
     ├─ self-explanation-rank → PreferenceRanker   → explanation ranking scores
     ├─ self-config-proposal  → ConfigOptimizer    → knob-tune proposals (never direct)
     └─ self-patch-score      → PatchSelector      → patch-apply proposals → governance
   unknown domain → CrossDomainError (fail-closed)
```

`self-*` never mutates `Truth` → `SelfImprovementProposal` → `ProposalRouter` → `SelfMetaGame.applyProposal` (only low-risk `focus-weight` auto-applies). Reward composition: `composeReward(GROUNDEDNESS_REWARD, VETO_PENALTY, DEFAULT_REWARDS)`; RLF: `reward = clamp(extrinsic + 0.3·intrinsic, −1, 1)`.

### 8.2 RL substrate

| Primitive | Role |
|---|---|
| `Bag<T>` | bounded priority queue (universal AIKR) |
| `Focus` / `GameFocus` / `MetaFocus` | isolated reasoning vessel: local bags + bound gates + bound games/reflexes; `FocusStepReport` |
| `FocusBag` / `FocusTree` | system-wide attention economy; `allocateFocusBudget`, `rebalanceWeights`, hierarchical rollup |
| `Game` (+`MetaGame`, `SelfMetaGame`) | the only environment interface: `observe/step/legalActions`; registry `createArcadeRegistry()` with 12 impls + `ReasoningGame` + `ConversationGame`; seeded deterministic episodes |
| `Reflex` | System-1 policy/value: `propose(state)`, `learn(event)`; Q-learning/UCB/ε-greedy/bandit/heuristic/LM/manifold |
| `Negotiator` | arbitration: NAL veto + `LearningEvent` feedback, action-matched fallback |
| `FocusScheduler` | tick orchestration; sensors (`BagPressure`, `TaskTypeMix`, `DerivationBacklog`, `VetoHandoverRate`, `HeadHealth`, `Spend`, `GovernanceQueue`) fail-closed; `ComponentRegistry`/`SensorRegistry`/`ActionRegistry`/`RewardRegistry` |
| `AIKRProcessor` | samplers: `BagPriority`, `PowerLaw`, `Fairness`, `TopK`, `PriorityProportional`; `AikrShell` |
| NAL-native RL | `QBeliefStore` (Q as Narsese beliefs through `Truth.revision`), `RewardBeliefAdapter`, `GoalActionAdapter`, `BeliefPerceptionAdapter`, `RLParityHarness`, `parity-acceptance`, env variants (bandit/gridworld/nonstationary) |
| Games shipped | snake · tetris · 2048 · tictactoe (+minimax) · gridworld · bandit · catch · arithmetic · rps · conversation · reasoning · meta/self-meta |

### 8.3 RLFP (learning from reasoning)

```
ReasoningTrajectoryLogger → TrajectoryStore (CycleTrajectory, TrajectoryPair)
 + PreferenceCollector (human pairs) + derivation outcomes + MC-returns (γ-discounted)
 → RewardModel / extractTrajectoryFeatures / findCommonFeatures
 → PolicyOptimizer (PPO/GRPO) → strategy priority + knob updates (KNOB_SPECS, rlfp/knobSchema)
 → applies: derivation strategy, LM-rule selector, FocusBag weights, parameter ledger
```

`ParameterLedger` + `OutcomeLinker` + `ParameterTable` (per-scope knobs, `ParameterScopeError`) — every knob change linked to an outcome.

### 8.4 Distillation flywheel

```
play / reason / chat → JudgmentDataset (hash-only JSONL + 384-d vector sidecar, auto-flush, compact)
   label sources: corrections · derivation outcomes · approvals · shadow verdicts · clarification pairs
                  · agent-trace grades (groundedness/risk per cycle) · reflex outcomes · MC-returns · reactions
 → train.ts (Brier loss; ridge/logistic linear heads) → digest-pinned artifacts
 → calibration-fit.ts → isotonic + abstain thresholds → calibration-lock.json (assertLockMatches)
 → eval-set (frozen; reaction-sourced rows excluded) → bake-off parity (Brier/ECE vs incumbent)
 → wasi-head-bundle (WASM) → governed head swap
 auxiliary: hard-negative mining (+margins) · contrastive memory (InfoNCE) · promoteProvisional
            · validateHeadCandidate · buildHeadSwapProposal · buildSabotageFlag
 ops: system-one-train · system-one-fit-thresholds · system-one-compact-dataset · system-one-bakeoff
```

### 8.5 Dialogue flywheel

```
every chat turn → DialogueTurn (sha256 digests + embedding; no raw text at rest)
 + injectable enrichers: decider bands/JudgmentProvenance · formalizations (captureAll) · reflex lastDecision
 + join on kernel-minted correlationId (ChatStreamEvent.finish)
reaction binding: explicit .react accept|correct|reject|clarify|redirect|abandon [correction] | bindReaction()
                 | attribution:'cues' (heuristic from next utterance, Bench-76 precision gate)
 → labels: correct → embedding preference pair (+contrastive hard negative)
           accept → positive · reject/abandon → negative
 → .retrospect → Retrospective{turn summary, reaction distribution, correction analysis,
                   strategy audit ⨝ real trace grades, contradiction mining,
                   focus-weight proposals} → RetrospectiveAdapter (derivation→focused,
                   lm-rule→priority) one-shot per digest + AdaptationRecord ledger (.restore)
 → .lessons → Narsese self-beliefs via nar.input → .reconsolidate (one-shot per digest, persisted ledger)
 → .probes → curriculum (corrected turns → low trace grades → retrospective lessons)
 → .schemas-induce → SchemaInductor over bounded derivation-chain ring
 → MCP: dialogue_react / dialogue_turns / dialogue_retrospect / dialogue_probes
```

### 8.6 Learning & consolidation

`SchemaInductor` / `induceFromDerivations` / `induceEpisodeSchemas` / `PromotedSchema` / `SchemaStore` (persistent) / `PromotionRecord` · `ReasoningAboutReasoning` (meta-cognition, gap analysis, self-correction, quality) · `SelfOptimizer` · `ArchitectureDriver` · `CognitiveTreadmill` (degradation sweep vs load) · `ScenarioGenerator` (induction, transitive, contradiction-storm, overload, drift) · `HiddenModelOracle` (held-out truth) · `EpisodeConsolidator` · `consolidateLearning` (decay + pressure-gated: schema→governance, contrastive, episodes, mining bag→contrastive seed, proof→MeTTa rules) · `CognitiveController.adapt()` + `MetacognitiveMonitor` + 8 analyzers (capabilities, corrections, performance, policy, quality, reasoning-patterns, resources, term-patterns) · `MetaGame`/`SelfMetaGame` (`^focus_weight`, `^knob_set`) · `ProofMettaProposer` + `adoptLearnedMettaRules`.

---

## 9. Self-Improvement & Governance

```
self-beliefs / self-goals / self-questions (SELF_CONCEPT_BELIEFS, FIX_PATTERN_MAPPINGS)
 → meta-rules (5, AIKR-bounded) + drives (curiosity/competence/coherence/social) + analyzers + RnR
 → operation goal → ActionGate → self-tool
 → shadow worktree (.shadow/<id>): codemod → full CI (test + typecheck + lint)
 → PatchRiskClassifier (guard-rail files: approval, sandbox, reward fns, autonomy, gates, schemas, budget)
 → GovernancePolicyEngine(risk × AutonomyMode) → {AUTO_MERGE | CREATE_PR | REQUIRE_HUMAN_REVIEW | REJECT}
 → SandboxValidator (knob range) · ApprovalService · external immutable CI/CD runner
 → merge → cleanup (git worktree remove)
```

Invariants: the agent cannot edit its own sandbox config, approval policy, reward functions, gates, schemas, or budget limits; only `focus-weight` auto-applies; medium → sandbox validation; high → human; `ProposalLifecycle` + `AdaptationRecord` + `ProposalBag` (AIKR-scoped) give audit and rollback. `SelfHost` gives analyzers a narrow view of NAR.

---

## 10. Imagination, Evaluation, Diagnostics

| Subsystem | Purpose |
|---|---|
| `CognitiveTreadmill` | load sweep → `DegradationCurve`/`StressMetrics`/`ArchitectureGap` |
| `ScenarioGenerator` + `HiddenModelOracle` | synthetic scenarios with hidden rules; oracle scores |
| `BrierHarness` | per-arm calibration scoring; `arcade-trace` per-tick spans; `eval/session-state` resume |
| Arcade | arms `heuristic|random|manifold|lm|replica|nal`; `--mode cognitive` (rules as Narsese beliefs, thought-stream, recorder-verified veto justifications) · `--distill` teacher→student · `--resume` per (arm,game) checkpoint · reports `.reports/arcade.{json,md}` |
| `Health` | `runHealthChecks` (credentials, LM probe, effective LM/routing matrix) · `MemoryHealth` · `emitCognitiveStateSummary` every 10 cycles · `self-report` |
| Commands | `nar/commands/{nar,memory,lm,self,rlfp,episodes,core,utils}` + `src/cli/*` formatters (`stats-format`, `systemone-format`, `conversation-game`) |
| Benchmarks | `benchmarks/rule-dispatch` (min < 10 µs) · `system-one-bench`, `cycle-bench`, `manifold-bench`, `fundamentals-bench`, `bench-similarity`, `bench-topk`, `rl-parity`, `arcade(-replay)`, `analyze-profile`, `profile-scenario` |

---

## 11. Cross-Cutting

| Concern | Flow |
|---|---|
| **Provenance** | step → `DerivationRecord` (premiseTruths, lineage, independence) → `prove.$(rule).`? no: → event log; `verifyRecord` (table transcribed, `core` depends only on `util`+schemas) + `verify-derivation` CLI + drift test; `TraceAbstractor` → narration; export JSON-LD/GraphML/Mermaid |
| **Replay** | gate events (JSONL ring → persisted) → `replayCognitiveState` (gate-level) · `replayIntoMemory` → `computeReplayStateHash` / `verifyReplayStateHash` · `replayTaskAdmissions` · `replayProposalStream` + `staleAdmissions` · `hydrateRecord` · `proposal/lifecycle.fromEvents`; `persistence:replay` + `test:determinism` gates |
| **Events** | `NarEventBus` (typed EventMap) → `events/bridge` mapping to `CognitiveEvent` (`cycle:start→cycle`, `rule:applied→derivation.made`, `concept:created→concept.activated`, `concept:removed→belief.retracted`, `cognitive:state-change→drive.changed`, `tool:call→tool.request`, `tool:result|error→tool.response`, `lm:start→skill.executed`), all `engine:'nar'`; ring capacities: gate 1000 · proposal log 1000 · CycleTrace 512 |
| **Telemetry** | `recordGateDecision` · `recordSchemaPromotion` · `recordBagPressure` · `recordHandover` · `recordLmSpend/Circuit/Probe/Call` · `JudgmentResolvedEvent` + judgment metrics · Prometheus `gate_*`, `systemone_*`, `lm_spend_{tokens,cost_milli}`; `/metrics`, `/metrics.json` |
| **Tracing** | `CycleTrace` regions → `initOtel`/`withSpan`/`decisionSpan`/`emitEvent` (OTLP, batch) · `budget-otel` snake_case projection · `trace/phase-timer` → `summarizeRegions`/`formatFlameChart` |
| **Config** | `.env` → `SENARS_ENV_MAP` overrides → `appConfigSchema` (zod, strict) → `senars.config.json` (configVersion 2.0: agent/backends.nar/lm/routing/memory/inference/production/irc) → `NARConfig` → `CognitiveParameters` (validated ranges) + `PARAMETER_SPACE` + bound tables → live: `config.schema/set`, `.status/.doctor/.tune`, `config:model-matrix`, `config:validate`; System One config-file-only (`SENARS_SYSTEMONE_*` never read) |
| **Budgets** | `controlBudgets[scopeId]` → `BudgetSlice` → `chargeBudget`; per-focus `Focus.allocateBudget`; `StreamReasoner.flush` `lm-call` pre-check; `TerminationReason`; `LM_MAX_SPEND_USD`; pressure → backpressure |
| **Concurrency** | `SerialQueue` in `StreamReasoner.pump`; `REASONER_QUEUE_CAPACITY=256` drop-newest; `maxDerived=256`; `derivedTasks` drain at next cycle; `ChatStreamHandler` aggregation; `parallelMap/Reduce` (MeTTa); shared-memory SPSC (MeTTa IPC); bounded HTTP in-flight |
| **Threading** | `CognitiveThread`/`ThreadPool` (hard budget inheritance) · `threadScope` per-thread System One/contrastive |
| **Plugins** | `Plugin`/`PluginLoader` (`core`) — extension seam |
| **Errors** | `SenarsError` + 25 codes (`.wrap`, `.toJSON`); gate-specific `PerceptionGateError`, `ActionGateError`, `BudgetGateError`, `RewardGateError`, `NALVetoError`, `EpistemicFirewallViolation`, `BuilderError`, `DigestMismatchError`, `CrossDomainError`, `ParameterScopeError`, `SandboxTimeoutError`, `LMUnavailableError`, `LMOutputTooLargeError`, `EvalRegressionError`, `AlgebraPurityError`, `ProposalReplayError`, `RuleTableError`, `TransportError`/`ConnectionError`, `PolicyViolation`, `ToolError`, `MeTTaError` |
| **Utilities** | `util/utils` (clamp, sleep, ids), `nar/utils` (cosine/jaccard/l2Normalize, `CircuitBreaker`, divergence), `results` (`ok/err/attempt`) |

**Structural gates (the code is a dataflow; these are its type-checks)** — `scripts/gates.ts` runner over `scripts/lib/*` (24 gate libs):

| Group | Gates |
|---|---|
| Layering | `core:no-lm` · `cycle:no-provider` · `deps:direction` · `deps:gate` · `exports:check` · `exports:barrels` · `exports:audit` · `gates:one-cycle-path` |
| Semantics | `terms:canonical` · `terms:no-bool-task` · `narsese:literals` · `induction:inventory` · `rule:has-fallback` · `rule:matrix` (generator) · `dispatch:no-wildcard` · `rules:loaded-data` · `env:grammar` · `primitives:grammar` · `relevance:measured` · `answer:no-fabrication` |
| Runtime contracts | `control-budgets` · `resource:policy` · `memory:ports` · `attention:write-surface` · `proposal:protocol` · `replay:proposal` · `complexity:budget` · `config:model-matrix` |
| End-to-end | `e2e:pipeline` · `persistence:replay` · `derivation:verifiable` · `derivation:clean` · `reward:policy-only` · `egress:invariant` |
| Slow | `test:determinism` · `test:hermetic` · `test:load-sensitive` |
| Docs | `docs:drift` (`docs:api` + `docs:architecture` + `rule:matrix` + clean `git diff`) |
| Fuzz | `fuzz:ci` (`fuzz-narsese`) |

---

## 12. Entry Points & Command Surface

| Entry | Boots |
|---|---|
| `pnpm bot` / `senars` bin | full bot: REPL + transports + System One + dialogue + reputation (CLI-only by default) |
| `senars.ts` | headless agent (no network) |
| `senars-mcp` / `pnpm mcp` | MCP stdio/sse/http server |
| `pnpm status` / `doctor` / `tune` / `arcade` / `--multiagent` | non-interactive reports, LM matrix, tuner, arcade tournament, multi-agent |
| `replay.ts` | deterministic state replay + hash verify |
| `imagine.ts` | degradation/scenario sweeps |
| `self-report.ts` | cognitive state report (drives, meta-goals, pressure, RLFP reward, quality) |
| `config-validate.ts` | config/effective-LM verdict |
| Library | `createNAR` · `createAgent` · `NARBuilder` (single assembly path; unbuilt step ⇒ subsystem absent) · `SeNARS` embed pattern |
| `examples/` | `hello-world` · `systemone-ingress` · `rl-gridworld` · `custom-head` · `external-env` |
| `scripts/` | 31 gates · 12 benchmarks · 4 demos · 4 servers/fixtures · 3 System One data ops · model fetch/probe · `verify-derivation` |

`NAR` public surface: IO `input/believe/goal/question/reward/inputTask` · loop `run/runStream` · query `ask/askWithDerivation/askNaturalLanguage/getBeliefs/getGoals/getQuestions/queryTerm/traceTerm/explain/getDerivationHistory` · config `getConfig/setConfig/reconfigure/getState/getCycleCount/rng` · System One accessors (dispatcher, manifold, embeddingCache, decider, groundednessGate, traceGrader, contrastive, `attachManifoldReflex`, `attachLMReflex`, `refreshSystemOneContrastive`) · games (focusBag, attach/detach, conversation, selfMetaGame) · learning (schemaInductor, derivationChains, proofStream, episodeConsolidator, miningBag, proofMettaProposer, governanceResolver) · persistence (`export/import/saveToFile/loadFromFile/getMemoryState/loadMemoryState`) · constitution (`setConstitution/checkConstitutionViolation`) · source reputation / parameter ledger · metrics.

---

## 13. Integration Map

| External system | Direction | Coupling point | Notes |
|---|---|---|---|
| LLM providers (OpenAI, Anthropic, openai-compatible, llama.cpp, node-llama-cpp, WebLLM, transformers.js, mock) | in (propose) / out (narrate) | `LMService` + `TextGenerator` port, GBNF grammars, spend cap | untrusted; every path has symbolic fallback |
| Web search (Tavily→Brave→DuckDuckGo) + `web_fetch` | in | `web` tools ⊣ ActionGate | read-only fetch, size-capped |
| Filesystem / shell workspace | both | `fs_*` (workspace sandbox), `shell` (30 s) ⊣ ActionGate | shadow worktrees for self-mod |
| IRC (Libera), WS clients, HTTP REST, MCP hosts | both | `@senars/io` transports + `bindAgentToConnection` | middleware chain; auth; rate limits |
| Peer SeNARS instances | both | `cooperation/delegation` over WS/MCP | `PEER_AGENT` ceiling + shadow validation |
| System One HTTP endpoint (`/v1/systemone`) / replica fixture | both | `http-manifold`, `open-systemone-manifold`, `system-one-server` | re-enters untrusted; fail-closed |
| SQLite / JSONL (`.cache/`) | both | `SqliteEventLog`, gate-event JSONL, snapshot, ledgers, calibration lock, datasets | event log is truth; snapshot is cache |
| `.sbook` knowledge books; RDF/OWL/JSON-LD/Narsese importers | both | `KnowledgeManager`, trace export | portable knowledge |
| OTel collector (OTLP 4318) | out | `nar/otel` | batch spans; correlation ids |
| Prometheus scraper | out | `/metrics`, `/metrics.json` | spend + gate + judgment counters |
| WASM/WASI modules and bundles | in (exec / judge) | `CapabilitySpace`, `SandboxedHeadRuntime` | deny-by-default, digest-pinned |
| Browser (Web UI), SpaceGraphJS, WebLLM | both | UI server protocol, Lens, `webllm.ts` | WebLLM not in ui exports map |
| CI/CD runner (external governor) | out (propose) / in (merge verdict) | shadow worktree + `ApprovalService` | agent cannot self-approve |
| Git | both | `ShadowWorktreeManager` (add/remove) | validation sandbox |
| CI gates | in | `scripts/gates.ts` + turbo | structural invariants as red build steps |

---

## 14. Design Axes (open alternatives)

| Axis | Current | Alternatives visible in the code |
|---|---|---|
| Reasoning substrate | NAL uncertain + MeTTa exact, MeTTa as gated tool | MeTTa as registered engine; WASM head bundles; per-head runtimes |
| Decision layer | single `DecisionPort`, 2 call sites, `position: cycle\|boundary` | more call sites (5 of 7 candidate stages unclaimed); per-thread deciders |
| LM role | proposer + narrator, never decider | replaceable per-rule by manifold judgments (already: 3 rules) |
| Refusal policy | PerceptionGate ingress-only (derived tasks always admitted) | derived-task refusal branch (declared unreachable) |
| Budgets | one gate, one table, per-scope rows | per-thread budgets, `UNBUDGETED` escape |
| Consolidation | pressure-gated single pass | multi-pass / tiered (working→semantic→schema) |
| Memory impl | 9 ports, `Memory` composes | alternate backends (array-backed, no index) already proven by test |
| Governance | in-repo prototype + external CI required | policy-as-data, multi-signer |
| Egress | transports + UI + MCP | streaming protocols, lens-as-plugin |
| Knowledge | Narsese-first | `.sbook`, RDF/OWL, JSON-LD |
| Ambient LM | none in `device` profile | browser WebLLM; embedded llama.cpp |
| Cross-agent | request/response delegation | shared manifold digest, collective calibration |
| Failure mode | fail-closed on gates, fail-soft on decisions | inverted split for boundary decisions |
| Temporal | priority decay + LRU + derivation lineage caps | forgetting policies (`lifecycle/Forgetting`), archival tiers |

---

## 15. One-Page Summary

```
INPUT ──▶ [PerceptionGate ⊣ source quality × reputation] ──▶ Task
                 ▲ System One ingress (19 heads, 1 embedding, 1 batch)
                 ▲ NL understand / Narsese parse / Game.observe / peer / recall
                 │
                 ▼
FOCUS (FocusBag → Focus: bags, attention, premises) ◀── budget ◊
                 ▼
REASON ◀── NAL rule table (44 decls) · MeTTa (exact, gated) · LM rules (19) · Reflexes
         └─ DecisionPort: admission-order, egress-veto (epistemic axis only)
                 ▼
AUTHORIZE ── ActionGate (autonomy, allow-list, NAL veto, sandbox) ──▶ ACT
                 │                                              tools · metta · game.step
                 ▼                                              │
LEARN ◀── RewardGate (firewall: no truth) ── reward ────────────┘
   ├─ learners (5 domains) · RLFP · schema induction · drives
   ├─ JudgmentDataset ──▶ train ──▶ calibration ──▶ governed head swap
   └─ Dialogue turns ──▶ reactions ──▶ labels · retrospectives · lessons · probes
                 ▼
EVENT LOG (SQLite/JSONL) ≡ replay · snapshot · traces · OTel · Prometheus
                 ▼
EGRESS: CLI · IRC · WS · HTTP · MCP · Web UI (graph, lens, config HUD) · peer · reports
```

Everything untrusted proposes; everything state-changing passes a gate; everything learned is bounded, recorded, and reversible.
