# @senars/nar — public API

## `.`

- `PriorityBag` — The AIKR priority bag: a priority-descending entry store with a Fenwick tree

- `runCounterfactual`

- `ActionGateError`

- `BudgetGateError`

- `BuilderError` — E1: assembly-time failure, typed by the builder step that failed.

- `GateError` — E1: per-gate denial, typed by gate and operation.

- `PerceptionGateError`

- `RewardGateError`

- `SenarsError`

- `CognitiveTreadmill`

- `type DegradationCurve`

- `type DegradationPoint`

- `type GeneratorConfig`

- `HiddenModelOracle`

- `type HiddenRule`

- `type OracleExpectation`

- `type Scenario`

- `ScenarioGenerator`

- `type ScenarioProfile`

- `type StressMetrics`

- `type TreadmillConfig`

- `BaseComponent`

- `createLMService`

- `createMockLMService`

- `LMService`

- `MiningBag`

- `EpisodicMemory`

- `EpisodeConsolidator`

- `symbolicSummary` — Symbolic fallback summary: deterministic, bounded, no LM. Rendered by the

- `Concept`

- `Memory`

- `ProposalBag` — Governance routing is a per-call concern rather than a constructor-wired

- `NAR`

- `createBotNAR` — Bot kernel: no LM wired, default limits.

- `createMinimalNAR` — Minimal kernel: tiny budgets, no throttle.

- `createNAR` — Default kernel: LM rules on, isolated provider registry/event bus.

- `createTestNAR` — Deterministic test kernel: decay off, small depth, optional LM.

- `createRulePattern`

- `loadBuiltinTable` — Load the shipped table. The one place the built-ins enter the system.

- `NALExtendedRules`

- `NALRules`

- `RuleIndex` — Dispatch, as an `InferenceTable`. One bucket per declared kind pair.

- `RuleProcessor`

- `RuleTableStore` — The loaded table: an artifact, a revision, and the index it projects into.

- `TaskManager`

- `deserializeStamp`

- `observeStampId` — Advance the ID counter past a persisted ID so reloaded stamps never collide

- `Stamp`

- `serializeStamp`

- `isTruthEqual` — The one epsilon-tolerant truth comparison; `Truth.equals` is the member form.

- `Truth`

- `atom`

- `atomicSymbols` — Every atomic symbol mentioned anywhere in the term.

- `atomKey` — An atom's key without building the term — the read side of `termKey` for callers holding a symbol.

- `bareInheritancePair` — The first bare inheritance pair mentioned anywhere in the term — `(bird --> animal)`

- `containsSubterm`

- `foldTerm` — Depth-first pre-order fold in visit order.

- `getAntecedent`

- `getArgs` — A term's arguments, for a term that is not known to be a compound.

- `getConsequent`

- `getPredicate`

- `getSubject`

- `hasVariable` — Whether any atom anywhere in the term is a variable — structural, not a spelling test.

- `isAtomic`

- `isCompound`

- `isConjunction`

- `isDisjunction`

- `isEquivalence`

- `isImplication`

- `isInheritance`

- `isNegation`

- `isSimilarity`

- `isVariableSymbol`

- `mentionsSymbol`

- `operationNameOf` — The operation a term names, or `undefined` when it names none.

- `operationTerm` — `(move^(dir-->left,steps-->3))`. Keys are read in insertion order, so the

- `parseTermToEdges`

- `readOperationTerm` — The name and arguments a term calls, or `undefined` when it calls nothing.

- `sameKind`

- `serializeTerm`

- `sharesInheritanceEnd` — True when the two terms mention a bare inheritance pair sharing an end.

- `sharesSymbol`

- `TermBuilder`

- `TermCollection`

- `type TermEdge`

- `TermMap`

- `type TermMapEntry`

- `TermParser`

- `TermSet`

- `termDepth` — Deepest nesting below the root; a bare atom has depth 0.

- `termKey` — Canonical structural key for a term — the single identity used for maps, memoization, and link ids.

- `termParser`

- `termSize` — Node count including the root.

- `termsEqual` — Structural term equality. `undefined` is accepted so optional-arg probes need no guard.

- `visitTerms`

- `walkTerms` — The single term-tree walk. `fn` receives depth from the root and may return

- `ConfigurationError`

- `createTaskWeight`

- `createSecondaryTask`

- `createTask`

- `DEFAULT_CONFIG`

- `err`

- `flatMap`

- `getOrElse`

- `isErr`

- `isOk`

- `map`

- `OperationError`

- `ok`

- `ToolError`

- `unwrapOrThrow`

- `ValidationError`

## `./agent`

- `BinAgentApi` — Minimal agent API for bin layer consumers (excludes core internals).

- `createAgent`

- `createCortexFromLM`

- `abortSession`

- `createSession`

- `InMemorySessionManager`

- `JsonlSessionManager`

- `dispatchToolCalls`

- `registerAgentTools`

- `BuilderError`

- `NARBuilder` — TODO19 F1: the single assembly path for NAR-backed agents. Fluent steps

- `type AnswerEnvelope`

- `type CognitiveAgent`

- `type CognitiveAgentConfig`

- `type CognitiveAgentPreset`

- `createCognitiveAgent`

- `NAR_PROFILES`

- `resolveProfile`

## `./agent/*`

_Dynamic subpath (no single entry file)._

## `./bag`

- `createBag` — The one construction path for an AIKR bag: capacity is the caller's bound, the rest is knobs.

- `PriorityBag` — The AIKR priority bag: a priority-descending entry store with a Fenwick tree

- `bagSlotErrors` — Every error a `strategies.bag` slot can carry, phrased for `validateParameters`.

- `resolveBagSlot` — The single read path for the slot: validated decay/forget knobs plus the memory's stream.

## `./capability`

- `CapabilitySpace`

- `CapabilityOntology`

- `createCapabilityOntology`

- `type CapabilityOntologyEntry`

- `type CapabilitySchema`

- `type CapabilityType`

- `assertWasmPathContained`

- `containsPath`

- `createNodeVMSandbox` — `node:vm` does not isolate untrusted code (shared primordials, known escapes).

- `createWasiSandbox`

- `createWasmModuleSandbox`

- `DEFAULT_SANDBOX_TIMEOUT_MS`

- `SandboxTimeoutError`

- `sanitizePreopens`

- `withSandboxTimeout` — Rejects with {@link SandboxTimeoutError} when the sandbox deadline elapses.

## `./cognitive`

- `AllSelector`

- `AnytimeDerivation`

- `CompositeAttention` — A weighted *mean* of its members, not a sum.

- `DefaultDerivation`

- `DiverseSampling`

- `DiverseSelector`

- `FocusedDerivation`

- `GoalBiasedSampling`

- `GoalRelevanceAttention`

- `NullAttentionModel` — The absence of attention, not a registered strategy.

- `NoveltySampling`

- `PrioritySampling`

- `PrioritySelector`

- `RotationSelector`

- `SampledDerivation`

- `SimpleAttention`

- `SpreadingActivation`

- `CognitiveController`

- `runCounterfactual`

- `CognitiveRegistry`

- `createDefaultRegistry` — A registry with every built-in registration loaded.

- `resolveSlot` — Resolve one slot of a parameter graph to its instance. The single read path

## `./commands`

- `coreCommands`

- `episodesCommands`

- `lmCommands`

- `memoryCommands`

- `narCommands`

- `rlfpCommands`

- `selfCommands`

- `NAR_UNCONFIGURED`

- `narOf` — Typed view of the NAR handle carried on the command context.

## `./config`

- `DEFAULT_LEDGER_PATH`

- `OutcomeLinker` — Joins ledger changes against an outcome series (trace grades, Brier scores,

- `ParameterLedger` — ParameterLedger — now backed by the generic `Ledger<T>` primitive from `@senars/io`.

## `./config/cognitive-parameters`

- `CognitiveParameters` — Cognitive Architecture Parameters

- `StrategySlotParams` — A strategy slot names a strategy and its configuration; the registry turns

- `STRATEGY_SLOTS` — Every strategy slot, as the pair that the two sides of the system spell

- `STRATEGY_SLOTS_BY_KEY` — The same slots read from the config side, for a caller holding a slot key.

- `PriorityConfig`

- `LMConfig`

- `AttentionConfig`

- `InferenceConfig`

- `ModelRunnerConfig`

- `MemoryParams` — The tunable half of memory. Named `...Params`, not `MemoryConfig`, because

- `buildDefaults` — Build default parameters from the shared cognitive bounds.

- `DEFAULT_COGNITIVE_PARAMETERS`

- `FAST_COGNITIVE_CONFIG` — Fast inference configuration - minimal LM usage

- `PARAMETER_SPACE` — Parameter space for optimization — the tunable subset of `cognitiveBounds`,

- `validateParameters` — Validate cognitive parameters.

- `mergeParameters` — Partial parameters over the frozen defaults.

- `sameStrategies` — Per-slot strategy change detection — avoids serializing the whole strategy graph to compare it.

- `readCognitiveParams` — Parse a run's parameter file, the way `tune-runner` writes one.

## `./engine`

- `NAREngine`

## `./engine/*`

_Dynamic subpath (no single entry file)._

## `./eval/*`

_Dynamic subpath (no single entry file)._

## `./focus`

- `actionRuleBelief` — Seed a per-action rule of the form `(<action> ==> <consequence>)`.

- `type SeededBelief`

- `seedBelief` — Inject a Narsese rule belief into the focus's task bag (E7 Self-Concept-Vocabulary pattern).

- `induceEpisodeSchemas`

- `type PromotedSchema`

- `Focus`

- `featureTerm` — `[score_3]` — a named feature observed at a value.

- `focusTask`

- `outcomeTasks` — An outcome as a reward-sign belief, plus a terminal flag when the episode ended.

- `perceptionTasks` — A game observation as the state belief plus one belief per numeric feature.

- `proposalTasks` — Reflex proposals as executable goals, ranked by the caller but weighted as `value × confidence`.

- `rewardTerm` — `[reward_positive]` — the sign of an outcome.

- `stateTerm` — `snake` — the game state as a plain belief.

- `createFocus`

- `FocusBag`

- `createFocusScheduler`

- `FocusScheduler` — Production multi-focus drive loop (TODO17 A1): per tick, weighted-sample a

- `type FocusSchedulerOptions`

- `type SchedulerTickResult`

- `createFocusTree`

- `FocusTree`

- `type FocusTreeOptions`

- `type FocusTreeRollup`

- `createGameFocus`

- `GameFocus`

- `createMetaFocus`

- `MetaFocus`

- `type NalABResult`

- `runNalAB`

- `SchemaStore`

- `type StoredSchema`

## `./game`

- `SeededRNG`

- `ASK_LM`

- `actionsForTier` — Tier filtering: a tier-N context only offers actions with tier ≤ N.

- `CLARIFY`

- `CONSOLIDATE`

- `CYCLE` — C3: seed actions. `cycle`/`revise`/`rest` are tier-0 reflex; manifold

- `DEFAULT_ACTIONS`

- `REST`

- `REVISE`

- `SPAWN_SUBGOAL`

- `tuneAction`

- `perceptionKey` — The text a perception is embedded under — the features when a game reports

- `ArithmeticGame` — Arithmetic quiz: answer `a+b` or `a−b` by picking among shuffled candidates

- `createArithmeticGame`

- `BanditGame` — Multi-armed bandit as a `Game` (DQ2: no Environment layer). Bernoulli rewards;

- `createBanditGame`

- `CatchGame` — Catch: a target falls one row per step from a random column; the paddle

- `createCatchGame`

- `ConversationGame`

- `createGame2048`

- `Game2048`

- `createGridWorldGame`

- `GridWorldGame` — Gridworld as a plain `Game` — ASCII `grid` with `S` start, `G` goal, `#` walls.

- `createMetaGame`

- `MetaGameClass`

- `createReasoningGame` — Assemble a spec: absent sensor/action/reward lists default to the library seeds.

- `REASONING_SPECS` — Domain presets (R1): per-domain spec data.

- `ReasoningGame`

- `ReasoningMetaGame` — R3: the per-game MetaGame (TODO18 §1e) — reward-weight/difficulty tuning for

- `createRPSGame`

- `RPSGame` — Repeated rock-paper-scissors against a deterministic rotating opponent —

- `createSelfMetaGame`

- `SelfMetaGameImpl`

- `createSnakeGame`

- `SnakeGame`

- `createTetrisGame`

- `TetrisGame`

- `createTicTacToeGame`

- `minimax` — Perfect-play minimax (the game-theoretic parity anchor). Scores from X's perspective.

- `TicTacToeGame`

- `describeMetaGameActions` — Operation strings are domain-tagged for kernel ActionGate enforcement.

- `FOCUS_WEIGHT_STEPS` — C5: the per-game MetaGame as a thin spec over the component library —

- `KNOB_SET_VALUES`

- `ActionRegistry`

- `ComponentRegistry` — C1: component registries. Named, seeded, addressable; games compose specs

- `createCognitionRegistries`

- `RewardRegistry`

- `SensorRegistry`

- `createArcadeRegistry` — The default arcade collection: every shipped game with its demo config.

- `GameRegistry` — Open registry of playable games — adding a game is implementing `Game` + one spec.

- `UnknownGameError` — Thrown for an unknown game name; callers fail loudly, never silently skip.

- `renderGame` — Render any game that exposes a `render()` method; falls back to the state key.

- `AMBIGUITY_REDUCTION_REWARD`

- `CONSOLIDATION_REWARD`

- `composeReward` — Weighted reward composition; weights are game parameters.

- `DEFAULT_REWARDS`

- `GROUNDEDNESS_REWARD` — C4: seed rewards, firewall-classified. `extrinsic` rewards flow to

- `SPEND_EFFICIENCY_REWARD`

- `TASK_SETTLED_REWARD`

- `VETO_PENALTY`

- `BagPressureSensor` — C2-S1: capacity pressure + utilization from memory statistics.

- `DEFAULT_SENSORS`

- `DerivationBacklogSensor` — C2-S3: derivation backlog from the focus step report.

- `GovernanceQueueSensor` — C2-S7: governance queue depth (validation + approval).

- `HeadHealthSensor` — C2-S5: head health via status-report adapter.

- `SpendSensor` — C2-S6: token spend from the step outcome.

- `TaskTypeMixSensor` — C2-S2: task/demographic mix from aggregate statistics (low/medium/high priority).

- `VetoHandoverRateSensor` — C2-S4: veto + handover telemetry.

- `failClosed`

## `./health`

- `HealthCheckDeps` — O3 (TODO20): shared readiness checks. Consumed by the HTTP `/health/ready`

- `runHealthChecks`

## `./learning`

- `ConfigOptimizer`

- `CrossDomainError`

- `DomainLearner`

- `LearnerRegistry`

- `PatchSelector`

- `PreferenceRanker`

- `ReflexLearner`

- `SchedulerAdapter`

- `createSchemaInductor`

- `SchemaInductor`

## `./dialogue`

- `inferReactionFromUtterance` — Infer the reaction the utterance implies toward the previous turn, or

- `RetrospectiveAdapter`

- `selectProbes`

- `Reconsolidator`

- `DialogueCapture` — TODO24: the single fan-out point of the Dialogue Flywheel. One instance per

- `sha256`

- `DialogueTextStore` — I6 relaxation sidecar (TODO24): raw exchange text for opted-in sessions.

- `digestPin`

- `extractLessons` — Lesson extraction (DQ4): a lesson requires ≥2 supporting turns, a

- `loadRetrospectives`

- `persistRetrospective` — Digest-pinned JSONL persistence; load is fail-closed (cf. FrozenEvalSet).

- `retrospect` — TODO24 Phase C: session-level diagnostic aggregation over captured dialogue

- `emptyReactionDistribution`

- `REACTION_KINDS`

## `./lm`

- `admitTasks`

- `topBeliefTasks`

- `attemptLMCorrection` — Returns null on model failure (escalation exhausted) — caller keeps the symbolic side.

- `embeddingRuntime`

- `createProactiveEnricher`

- `ProactiveEnricher`

- `builtinModels`

- `cloudApiKey` — The cloud credential: the env var named by `apiKeyEnv` (if any), then the

- `defaultModelFor` — Default per-provider model when none is configured.

- `detectCloudProvider` — First cloud provider with a credential present in the environment.

- `formatLMConfig`

- `LM_PROFILES` — LM_PROFILE presets. `production` is reserved (handled by lifecycle config merge).

- `LM_PROVIDER_NAMES`

- `resolveLMConfig`

- `resolveLMSettings` — Resolve LM settings from env + optional file config. Throws on invalid provider.

- `BidirectionalFeedbackLoop`

- `createBidirectionalFeedbackLoop`

- `type GrammarName`

- `loadGrammar` — Load a GBNF grammar by name (cached; grammars ship as sibling .gbnf files).

- `CYCLE_PATH_PREFIXES` — The cycle path, by directory. Everything outside it is assembly or agent-side

- `IN_CYCLE_EDGE_ATTRIBUTIONS` — Which declared behaviour owns each cycle-path file's imports of the layer.

- `IN_CYCLE_INVENTORY`

- `type InCycleBehaviour`

- `type InCycleDisposition`

- `isGpuBackend` — Whether a native capability probe named a backend this runtime implements.

- `LMResponseParser`

- `LMRule`

- `type ConfiguredRuleSpec`

- `createConfiguredLMRules` — Builds LM rules from validated config entries (senars.config.json `bot.lmRules.rules`).

- `LMRules`

- `createLMService`

- `createMockLanguageModel`

- `createMockLMService`

- `LMService`

- `getProviderRuntime` — Process-wide default instance backing the module-level provider API.

- `type ProviderHealth`

- `ProviderRuntime`

- `PROVIDER_SEAMS`

- `type ProviderSeam`

- `probeEmbeddedLlama`

- `resetCircuitBreakers` — Close all breakers and clear failure counts (test/bench isolation between independent scenarios).

- `createLlamaCppFetch` — Native fetch for llama.cpp's OpenAI-compatible server: passes GBNF `grammar`

- `LLAMACPP_HOST_DEFAULT` — Default llama.cpp server (llama-server) address.

- `probeLlamaCpp` — Probe llama-server's native /health endpoint.

- `runWithGrammar`

- `fetchBounded` — `GET url` bounded by `timeoutMs`; returns `null` on any transport failure.

- `probeModelsEndpoint` — Probe an OpenAI-compatible `/models` endpoint; auth sent only when a key is available.

- `configureLM`

- `createSeNARSRegistry`

- `demoteModel`

- `disableRoutingTelemetry`

- `enableRoutingTelemetry`

- `getCircuitBreaker`

- `getEffectiveCircuitConfig` — Effective circuit breaker config for a provider (settings > provider defaults > global defaults).

- `getLMSettings` — Active settings, lazily resolved from env (+ anything installed via configureLM).

- `getLmProvider`

- `getModelCapability`

- `getModelChain`

- `getModelForTask`

- `getQualityModel`

- `getRouting`

- `getRoutingLogStatus`

- `getRoutingStatus`

- `hasCloudCredentials`

- `logRoutingDecision`

- `MODEL_CAPABILITIES`

- `pickBestModel`

- `pickModel` — Ranks candidate model ids against an objective; hard constraints (offlineOnly, maxLatencyMs) filter first.

- `probeOpenAICompatible` — Probe an OpenAI-compatible endpoint (/models); auth header sent only when a key is available.

- `recordProviderCall`

- `resetDemotions`

- `resolveActiveProvider`

- `resolveOfflineModel` — Largest ladder rung already cached under cacheDir (ladder ordered smallest → most capable).

- `resolveOfflineTier` — LM_LOCAL_MODEL wins, else the largest cached offline-ladder rung, else undefined (config default).

- `setRouting`

- `ShadowValidator`

- `shadowValidator`

## `./lm/context/trace-abstractor`

- `CriticalPathStep`

- `CriticalPath`

- `TraceAbstractor` — Extracts the minimal structural skeleton from a NAL derivation:

- `traceAbstractor`

## `./lm/grammars`

- `GrammarName`

- `loadGrammar` — Load a GBNF grammar by name (cached; grammars ship as sibling .gbnf files).

## `./lm/lm-service`

- `createMockLanguageModel`

- `buildCacheKey` — The key covers every field that can change a completion, in a fixed order.

- `ResponseCache` — Prompt-hash-keyed semantic cache with 60s TTL. Cleared on failure so retries

- `LMUnavailableError` — Typed error for provider/transport failures (offline fallbacks, re-probing).

- `withHint`

- `withRetry`

- `createLMService`

- `LMService`

- `createMockLMService`

- `SpendLedger` — H3: per-provider spend ledger (token totals from AI-SDK usage + capability table).

## `./lm/providers/llamacpp`

- `LLAMACPP_HOST_DEFAULT` — Default llama.cpp server (llama-server) address.

- `grammarScope` — Request-scoped GBNF grammar for constrained decoding. The llamacpp fetch

- `runWithGrammar`

- `LlamaCppFetchOptions`

- `MODEL_PLACEHOLDER` — Placeholder model id; substituted with the server's loaded alias on first request.

- `createLlamaCppFetch` — Native fetch for llama.cpp's OpenAI-compatible server: passes GBNF `grammar`

- `probeLlamaCpp` — Probe llama-server's native /health endpoint.

## `./lm/rule-builders`

- `LMRuleFactoryConfig`

## `./lm/rule-templates`

- `ruleDefs`

- `getRuleDef`

## `./lm/shadow-validation`

- `BeliefLike`

- `ShadowCheckOptions`

- `ShadowSystemOneDeps` — F5: conflict-head consumer — semantic conflict verdict alongside the frequency check.

- `ShadowValidationResult` — Result of shadow validation with details for decision-path recording.

- `ShadowValidator`

- `shadowValidator`

## `./lm/system-one`

- `actionGrammar` — Generate a GBNF grammar enumerating the legal-action set. Generated text is

- `createEmbeddingCache`

- `EmbeddingCache`

- `type EmbeddingCacheConfig`

- `SystemOneIngressJudge` — X2 (TODO20): System One ingress judge — the proposer-side half of the epistemic

- `createProvisionalStamp`

- `isProvisionalStamp`

## `./memory`

- `ConceptGraph`

- `Concept`

- `taskFromBagItem` — A `Task` read back out of a bag entry — the read side of

- `Focus` — The concepts attention is currently spent on, bounded by priority.

- `Archive`

- `Forgetting`

- `Memory`

- `MemoryIndex` — Two lookup families over the concept store, and nothing else.

- `evictUnderPressure` — The archive/forget policy — the only place concepts leave the live store

- `calculateConceptStats` — Totals and the priority distribution from one sweep. Both come out of a single

- `decodeMemoryState` — Inverse of encodeMemoryState; accepts legacy bare SerializedMemory files.

- `deserialize`

- `encodeMemoryState` — Schema-pinned, versioned persistence format for the memory dump (StateCodec, TODO20 X7).

- `repair`

- `serialize`

- `validate`

## `./memory/embedding`

- `EmbeddingGenerator`

- `EmbeddingGeneratorConfig`

- `EmbeddingRuntime` — What the embedding runtime is allowed to know about its host, in core

- `EmbeddingRuntimeSource`

- `DEFAULT_EMBEDDING_RUNTIME` — What the core can know with no composition root bound: no provider is

- `DEFAULT_EMBEDDING_MODEL_ID`

- `DEFAULT_EMBEDDING_DIMENSION`

- `TransformersEmbeddingGenerator`

- `MockEmbeddingGenerator`

- `isMockLM` — Transformers (`MiniLM`) is the only real embedder and only ships with the

- `createEmbeddingGenerator`

- `cosineSimilarity`

## `./memory/episodic`

- `EpisodeSchema` — Episode schema for Ledger-backed EpisodicMemory.

- `LedgerEpisode`

- `EpisodicMemory`

## `./memory/retrieval-verified`

- `ConsolidationOptions`

- `PromotionResult` — What one retrieval-verified pass promoted. Named for what it reports: the

- `ConsolidatorDeps`

- `consolidateEpisodes` — Retrieval-verified long-term memory consolidation:

## `./nl`

- `TranslationCache`

- `ClarificationHandler`

- `generateClarificationWithLM`

- `classify`

- `ContextAssembler`

- `defaultFirewall`

- `SymbolicFirewall`

- `NLGenerationService`

- `dispatchNarseseIntent` — The intent of `input`, or `null` when it is prose — or unparseable Narsese — and belongs to the LM path.

- `AmbiguitySchema`

- `AnalogySchema`

- `BeliefRevisionSchema`

- `ClarificationSchema`

- `ConceptElaborationSchema`

- `CoreferenceSchema`

- `ExplanationSchema`

- `GenerationOutputSchema`

- `GoalDecompositionSchema`

- `HypothesisSchema`

- `MetaReasoningSchema`

- `NarseseBeliefSchema`

- `QuestionGenerationSchema`

- `SchemaInductionSchema`

- `TaskBatchSchema`

- `TemporalCausalSchema`

- `TranslationSchema`

- `UncertaintySchema`

- `VariableGroundingSchema`

- `detectAmbiguityFlags` — One flag per pattern the input matches, its severity read from the kernel's

- `locateSpan`

- `NLUnderstandingService`

- `toFormalizationBatch`

## `./otel`

- `OtelConfig`

- `initOtel`

- `getTracer` — The tracer this module traces through.

- `withSpan` — O1 helper: run `fn` inside an active span; attributes settable via the handle.

- `tracingEnabled` — Whether anything will collect a span. A high-frequency caller checks this *before*

- `decisionSpan` — O1/O4 helper: fire-and-forget span for high-frequency decisions (gate verdicts).

- `emitEvent` — The one event emitter. A nested payload is flattened into dotted attribute

- `shutdownOtel`

## `./reflex`

- `forwardingReflex` — Forwards `prefetch` (all arguments) to the wrapped reflex.

- `type PrefetchingReflex`

- `type ReflexWrapper`

- `recordedProposals` — Recording wrapper handle: extract `lastProposals` from a chain built with `recordingReflex()`.

- `recordingReflex` — Records the top proposals of each `propose` call for external inspection.

- `vetoAwareReflex` — L1 veto-aware demotion: actions whose LearningEvent carries `overriddenBy`

- `wrapReflex` — Compose a wrapper chain around a base reflex: `wrapReflex(base, recordingReflex(), vetoAwareReflex())`.

- `agreeByExactAlgebra` — The one MeTTa-agreement vote: re-propose every reflex action the exact engine

- `EpsilonGreedyReflex` — ε-greedy: the mean estimate, with bounded random exploration of young arms.

- `MettaProposer`

- `Negotiator`

- `TabularQReflex`

- `UCBReflex` — UCB1: optimistic untried arms, confidence-scaled exploration thereafter.

- `NalVetoArbitration` — Extracted Negotiator default: reflex best-of with the NAL trap veto (Bench-15).

- `WeightedQuorum` — Consensus arbitration (opt-in): NAL derivations vote on proposed actions

## `./rlfp`

_Re-export barrel._

## `./rules`

- `buildMetaRules` — Build registered meta-rules with proper patterns

- `getMetaBudgetStatus` — Get meta-reasoning budget status

- `initializeMetaReasoning` — Initialize meta-reasoning beliefs

- `META_AIKR_BOUNDS` — AIKR bounds for meta-reasoning

- `META_REASONING_BELIEFS` — Initialize meta-reasoning beliefs into NAR

- `META_RULES_NARSESE` — Meta-rule definitions in Narsese format

- `registerMetaRules` — Register the meta-rules into a dispatch table.

- `shouldActivateMetaReasoning` — Check if meta-reasoning should activate based on drive intensities

- `RuleProcessor`

- `DerivationRecorder`

- `inferRuleCategory`

- `RuleIndex` — Dispatch, as an `InferenceTable`. One bucket per declared kind pair.

- `loadBuiltinTable` — Load the shipped table. The one place the built-ins enter the system.

- `builtinEntries` — Build the shipped table from its declarations, as *entries at revision 0*.

- `diffArtifacts`

- `resolveTable` — Validate an artifact and resolve every body.

- `RuleTableError` — A table that could not be loaded. Every fault is enumerable, never swallowed.

- `RuleTableStore` — The loaded table: an artifact, a revision, and the index it projects into.

- `tableArtifact`

- `BUILTIN_DECLARATIONS` — The shipped table. Every declaration at revision 0 with `builtin` provenance —

- `NALExtendedRules`

- `NALRules`

- `DISABLED_RULES` — Why a rule is not shipped — for a gate, a status report, or the next attempt.

- `NAL_EXTENDED_RULES`

- `RULE_BODIES`

- `createRulePattern`

## `./self`

- `ArchitectureDriver`

- `ReasoningAboutReasoning`

## `./proposal/*`

_Dynamic subpath (no single entry file)._

## `./stream`

- `StreamReasoner`

## `./stream/*`

_Dynamic subpath (no single entry file)._

## `./metrics`

- `SystemStats` — What the kernel counts about itself. Every field is bumped in place.

- `MetricsSummary`

- `MetricsCollector` — What the kernel counts about itself — the counters it bumps as it runs.

- `handleMetricsRequest` — Answer `/metrics` (`text`) or `/metrics.json`, or return `false` for any other

- `getMetricsAsJson`

- `getMetricsAsText`

- `prometheusRegistry`

- `recordCircuitBreakerState`

- `recordDerivation`

- `recordLmProbe`

- `recordLmSpend`

## `./terms`

- `atomicSymbols` — Every atomic symbol mentioned anywhere in the term.

- `atomKey` — An atom's key without building the term — the read side of `termKey` for callers holding a symbol.

- `bareInheritancePair` — The first bare inheritance pair mentioned anywhere in the term — `(bird --> animal)`

- `binaryOf` — A binary term's own argument list as a pair, or `undefined` when `term` is not

- `containsSubterm`

- `foldTerm` — Depth-first pre-order fold in visit order.

- `getAntecedent`

- `getArgs` — A term's arguments, for a term that is not known to be a compound.

- `getConsequent`

- `getPredicate`

- `getSubject`

- `hasVariable` — Whether any atom anywhere in the term is a variable — structural, not a spelling test.

- `isConjunction`

- `isDisjunction`

- `isEquivalence`

- `isImplication`

- `isInheritance`

- `isNegation`

- `isOperation`

- `isPredictive`

- `isSequence`

- `isSetExt`

- `isSetInt`

- `isSimilarity`

- `mentionsSymbol`

- `rolePair` — `term`'s subject and predicate together — the pair form of {@link getSubject}

- `sameKind`

- `sharesInheritanceEnd` — True when the two terms mention a bare inheritance pair sharing an end.

- `sharesSymbol`

- `hasNegatedPair` — Whether `term`'s arguments contain both `a` and `--a`.

- `hasRepeatedArgs` — Whether any two of `term`'s arguments are the same term.

- `termDepth` — Deepest nesting below the root; a bare atom has depth 0.

- `termKey` — Canonical structural key for a term — the single identity used for maps, memoization, and link ids.

- `termSize` — Node count including the root.

- `unaryOf` — A unary term's own argument, or `undefined` when `term` is not `kind`.

- `termsEqual` — Structural term equality. `undefined` is accepted so optional-arg probes need no guard.

- `visitTerms`

- `walkTerms` — The single term-tree walk. `fn` receives depth from the root and may return

- `getTermComplexity`

- `atom`

- `TermBuilder`

- `TermFactory`

- `canonicalTerm`

- `type TermReducer`

- `TERM_REDUCERS`

- `canonicalTask` — Canonicalisation at task construction, so a claim cannot reach memory in two

- `type TaskReducer`

- `TASK_REDUCERS`

- `operationNameOf` — The operation a term names, or `undefined` when it names none.

- `operationTerm` — `(move^(dir-->left,steps-->3))`. Keys are read in insertion order, so the

- `readOperationTerm` — The name and arguments a term calls, or `undefined` when it calls nothing.

- `deserializeTerm`

- `fromNarsese` — Canonical Narsese string → Term API. Delegates to {@link deserializeTerm}.

- `parseTaskTolerant` — Parse `text` as a task under any punctuation the grammar admits, or `null` if

- `ParseError`

- `PUNCTUATION_BY_TASK_TYPE`

- `TermParser`

- `taskTypeForPunctuation`

- `termParser`

- `deserializeStamp`

- `observeStampId` — Advance the ID counter past a persisted ID so reloaded stamps never collide

- `Stamp`

- `serializeStamp`

- `serializeTerm`

- `toNarsese` — Canonical term → Narsese string API. Delegates to {@link serializeTerm}.

- `isTruthEqual` — The one epsilon-tolerant truth comparison; `Truth.equals` is the member form.

- `Truth`

- `TermCollection`

- `parseTermToEdges`

- `type TermEdge`

- `TermMap`

- `TermSet`

- `applySubstitution` — Substitute through `term` until no bound variable remains. Idempotent.

- `unify` — Unify two terms, extending `subst`. Returns the extended substitution, or

- `calculateSimilarity` — Symbol-bag similarity. The bags are memoized per term, so neither side is

- `INVALID_ATOM_CHARS_REGEX`

- `isValidAtomSymbol`

- `toAtomSymbol` — Coerce arbitrary text into a valid atom symbol: invalid runs collapse to '_'.

- `VALID_ATOM_CHARS`

- `isInvalidTaskTerm`

- `isTautology`

- `validateTaskTerm`

- `COPULA_SYMBOLS` — The infix binary operators — a statement's copulas, longest symbol first so a

- `hasCopula` — Whether `text` contains any copula — the one "is this a statement?" test.

- `isAtomic`

- `isCompound`

- `isVariableSymbol`

- `OPERATORS` — Operator definitions - standalone to avoid circular dependencies

## `./tools`

_Re-export barrel._

## `./tools/schemas`

- `ConnectionConfigSchema` — The zod twin, pinned to the transport type so a widened field is a compile error here.

- `AgentOptionsSchema`

- `AgentOptions`

## `./kernel`

- `BUDGET_SCOPE_IDS`

- `BUDGET_SCOPES`

- `type BudgetDimension`

- `type BudgetScopeId`

- `type BudgetScopeSpec`

- `scopeBudget` — Resolve a scope's ceilings over a base budget: the dimension the scope spends

- `scopeLimit` — The declared limit for one scope, or the override configuration supplies.

- `scopeSpec`

- `type ControlBudgetOverrides`

- `type ControlBudgetPort`

- `UNBUDGETED` — The port a component holds when no budget wiring was bound — every declared

- `ControlBudgets`

- `loadGateEvents`

- `persistGateLogs`

- `replayCognitiveState`

- `replayTaskAdmissions`

- `createGateRegistry` — The only way to obtain gates (TODO19 F2, TODO33 §5.P2.7). There is no process-global registry: a singleton with a `reset()` that existed solely for test isolation let a NAR with an isolated registry share the global's budget and autonomy mode with any separately-built `Focus`. Every consumer is handed one.

- `GateRegistry`

- `KernelGate`

- `KernelActionGate`

- `NALVetoError` — Typed NAL-veto error for callers that convert a gate veto result

- `createDefaultReasoningBudget`

- `KernelBudgetGate`

- `KernelPerceptionGate`

- `EpistemicFirewallViolation`

- `ExternalRewardGate`

- `KernelRewardGate`

- `SelfRewardGate`

- `computeReplayStateHash` — Deterministic content hash of a replay outcome — the C14 replay verification token.

- `type FullReplayOptions`

- `persistDerivationRecords`

- `type ReplayResult`

- `type ReplaySnapshotFile`

- `type ReplayTally`

- `replayIntoMemory`

- `serializeReplayResult`

- `verifyReplayStateHash`

- `domainKey` — Derive a `domain:<host>` key from a URL-bearing source id, else undefined.

- `providerKey` — Derive a `provider:<name>` key for an LM provider, else undefined.

- `DEFAULT_REPUTATION_CAPACITY`

- `DEFAULT_REPUTATION_PATH`

- `type ReputationDeltaEntry`

- `type ReputationEntry`

- `SourceReputation` — SourceReputation — now backed by the generic `Ledger<T>` primitive.

- `type SourceReputationOptions`

- `ThreadScope`

- `threadScope` — Singleton instance for the process.
