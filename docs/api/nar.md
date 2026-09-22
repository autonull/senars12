# @senars/nar — public API

## `.`

- `PriorityBag`

- `runCounterfactual`

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

- `Container`

- `createLMService`

- `createMockLMService`

- `LMService`

- `EpisodicMemory`

- `Concept`

- `Memory`

- `NAR`

- `createBotNAR` — Bot kernel: no LM wired, default limits.

- `createMinimalNAR` — Minimal kernel: tiny budgets, no throttle.

- `createNAR`

- `createTestNAR` — Deterministic test kernel: decay off, small depth, optional LM.

- `BagStrategy`

- `ExhaustiveStrategy`

- `Reasoner`

- `createRulePattern`

- `NALExtendedRules`

- `NALRules`

- `RuleIndex`

- `RuleProcessor`

- `RuleRegistry`

- `TaskManager`

- `atom`

- `containsSubterm`

- `freeze`

- `getAntecedent`

- `getArgs`

- `getConsequent`

- `getPredicate`

- `getSubject`

- `getTermArg`

- `getTermArgs`

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

- `parseTermToEdges`

- `sameKind`

- `serializeTerm`

- `sharesSymbol`

- `TermBuilder`

- `type TermEdge`

- `TermParser`

- `termParser`

- `termsEqual`

- `visitTerms`

- `deserializeStamp`

- `observeStampId` — Advance the ID counter past a persisted ID so reloaded stamps never collide

- `Stamp`

- `serializeStamp`

- `isTruthEqual`

- `Truth`

- `ConfigurationError`

- `createBudget`

- `createSecondaryTask`

- `createTask`

- `DEFAULT_CONFIG`

- `err`

- `flatMap`

- `getOrElse`

- `isErr`

- `isOk`

- `map`

- `NARError`

- `ok`

- `OperationError`

- `ToolError`

- `unwrapOrThrow`

- `ValidationError`

- `ActionGateError`

- `BudgetExceeded` — E1: reasoning budget exhausted for a scope/operation.

- `BudgetGateError`

- `BuilderError` — E1 (TODO20 Phase 3): kernel-domain error taxonomy. The base `SenarsError`

- `BoundaryValidationError` — E1: boundary validation with Zod issues attached.

- `DigestMismatch` — E1: artifact digest verification failed.

- `GateError` — E1: per-gate denial, typed by gate and operation.

- `PerceptionGateError`

- `RewardGateError`

- `SchemaInductionError` — E1: schema induction phase failure with its cause attached.

- `SenarsError`

## `./agent`

- `createAgent`

- `createCortexFromLM`

- `abortSession`

- `createSession`

- `InMemorySessionManager`

- `JsonlSessionManager`

- `dispatchToolCalls`

- `registerAgentTools`

- `BuilderError` — Typed failure of an inconsistent assembly spec (TODO19 F1; E1: SenarsError-based).

- `NARBuilder` — P7: tier-0 sandboxed reflex-value head (zero-import WASM, digest-pinned). */

- `NAR_PROFILES`

- `resolveProfile`

## `./agent/*`

_Dynamic subpath (no single entry file)._

## `./bag`

- `PriorityBag`

## `./capability`

- `CapabilitySpace`

- `assertWasmPathContained`

- `containsPath`

- `createNodeVMSandbox` — `node:vm` does not isolate untrusted code (shared primordials, known escapes).

- `createWasiSandbox`

- `createWasmModuleSandbox`

- `DEFAULT_SANDBOX_TIMEOUT_MS`

- `SandboxTimeoutError`

- `sanitizePreopens`

- `withTimeout` — Rejects when `timeoutMs` elapses. The losing promise is not cancelled — it

## `./cognitive`

- `AllSelector`

- `AnytimeDerivation`

- `CompositeAttention`

- `DefaultDerivation`

- `DiverseSampling`

- `DiverseSelector`

- `FocusedDerivation`

- `GoalBiasedSampling`

- `GoalRelevanceAttention`

- `NoveltySampling`

- `PrioritySampling`

- `PrioritySelector`

- `RotationSelector`

- `SampledDerivation`

- `SimpleAttention`

- `SpreadingActivation`

- `TopNSampling`

- `toTask`

- `CognitiveController`

- `runCounterfactual`

- `CognitiveRegistry`

## `./cognitive/corrections`

- `attemptLMCorrection` — Issue identification and corrections - extracted from SelfAnalyzerService

- `identifyIssues`

- `applyCorrections`

## `./commands`

- `configCommands`

- `coreCommands`

- `episodesCommands`

- `lmCommands`

- `memoryCommands`

- `narCommands`

- `rlfpCommands`

- `selfCommands`

- `requireNar`

## `./config`

- `BUDGET_PRESETS`

- `BudgetTracker`

- `getBudget`

## `./config/cognitive-parameters`

- `CognitiveParameters` — Cognitive Architecture Parameters

- `PriorityConfig` — Priority Management */

- `LMConfig`

- `AttentionConfig`

- `InferenceConfig`

- `ModelRunnerConfig`

- `MemoryConfig`

- `DEFAULT_COGNITIVE_PARAMETERS` — selectionStrategy: 'all',

- `FAST_COGNITIVE_CONFIG`

- `LM_HEAVY_CONFIG` — LM-heavy configuration - maximum enhancement

- `RESEARCH_COGNITIVE_CONFIG` — Research configuration - all tracing enabled

- `PARAMETER_SPACE` — Parameter space for optimization

- `validateParameters` — Validate cognitive parameters

- `mergeParameters`

## `./engine`

- `NAREngine`

## `./engine/*`

_Dynamic subpath (no single entry file)._

## `./eval/*`

_Dynamic subpath (no single entry file)._

## `./focus`

- `actionRuleBelief` — Seed a per-action rule of the form `(<action> ==> <consequence>)`.

- `type SeededBelief`

- `seedBelief` — Narsese, e.g. `(up ==> wall_bump)`. The antecedent atom names the action. */

- `Focus`

- `createFocus`

- `FocusBag`

- `createFocusScheduler`

- `FocusScheduler`

- `type FocusSchedulerOptions`

- `type SchedulerTickResult`

- `createGameFocus`

- `GameFocus`

- `createMetaFocus`

- `MetaFocus`

- `induceEpisodeSchemas`

- `type PromotedSchema`

- `SchemaStore`

- `type StoredSchema`

- `runNalAB`

- `type NalABResult`

## `./game`

- `BanditGame` — Optional non-stationarity: means drift every `changeInterval` steps. */

- `createBanditGame`

- `ArithmeticGame`

- `createArithmeticGame`

- `CatchGame` — Catch: a target falls one row per step from a random column; the paddle

- `createCatchGame`

- `createRPSGame`

- `RPSGame` — Repeated rock-paper-scissors against a deterministic rotating opponent —

- `createGame2048`

- `Game2048`

- `createGridWorldGame`

- `GridWorldGame` — Gridworld as a plain `Game` — ASCII `grid` with `S` start, `G` goal, `#` walls.

- `SeededRNG` — Deterministic LCG RNG (Numerical Recipes parameters) for reproducible RL experiments.

- `createSnakeGame`

- `SnakeGame`

- `createTicTacToeGame`

- `minimax` — Opponent policy for O: random (default) or perfect minimax. */

- `TicTacToeGame`

- `createTetrisGame`

- `TetrisGame`

- `renderGame` — Render any game that exposes a `render()` method; falls back to the state key.

- `createArcadeRegistry` — The default arcade collection: every shipped game with its demo config.

- `GameRegistry` — Open registry of playable games — adding a game is implementing `Game` + one spec.

- `UnknownGameError` — Arcade identifier (snake, bandit, …). */

- `createMetaGame`

- `MetaGameClass`

- `createSelfMetaGame`

- `SelfMetaGameImpl`

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

## `./lm`

- `admitTasks`

- `topBeliefTasks`

- `createProactiveEnricher`

- `ProactiveEnricher`

- `builtinModels`

- `defaultModelFor` — Default per-provider model when none is configured.

- `detectCloudProvider` — First cloud provider with a credential present in the environment.

- `formatLMConfig`

- `LM_PROFILES` — LM_PROFILE presets. `production` is reserved (handled by lifecycle config merge).

- `resolveLMConfig`

- `resolveLMSettings` — Resolve LM settings from env + optional file config. Throws on invalid provider.

- `BidirectionalFeedbackLoop`

- `createBidirectionalFeedbackLoop`

- `type GrammarName`

- `loadGrammar` — Load a GBNF grammar by name (cached; grammars ship as sibling .gbnf files).

- `LMResponseParser`

- `LMRule`

- `type ConfiguredRuleSpec`

- `createConfiguredLMRules`

- `LMRules`

- `createLMService`

- `createMockLanguageModel`

- `createMockLMService`

- `LMService`

- `getProviderRuntime` — Session-level demotions: a demoted model sinks to the back of the chain. */

- `type ProviderHealth`

- `ProviderRuntime`

- `createLlamaCppFetch` — Native fetch for llama.cpp's OpenAI-compatible server: passes GBNF `grammar`

- `LLAMACPP_HOST_DEFAULT` — Default llama.cpp server (llama-server) address.

- `probeLlamaCpp` — Probe llama-server's native /health endpoint.

- `runWithGrammar`

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

- `createLMStats`

- `recordLMCall`

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

- `buildCacheKey`

- `ResponseCache` — Prompt-hash-keyed semantic cache with 60s TTL. Cleared on failure so retries

- `LMUnavailableError` — Typed error for provider/transport failures (offline fallbacks, re-probing).

- `withHint`

- `withRetry`

- `createLMService`

- `LMService`

- `createMockLMService`

- `SpendLedger` — Cumulative cost in milli-dollars (MODEL_CAPABILITIES.costPerMTok × tokens). */

## `./lm/providers/llamacpp`

- `LLAMACPP_HOST_DEFAULT` — Default llama.cpp server (llama-server) address.

- `grammarScope` — Request-scoped GBNF grammar for constrained decoding. The llamacpp fetch

- `runWithGrammar`

- `LlamaCppFetchOptions`

- `MODEL_PLACEHOLDER` — Inject chat_template_kwargs {thinking:false} (Qwen-family reasoning models). */

- `createLlamaCppFetch` — Native fetch for llama.cpp's OpenAI-compatible server: passes GBNF `grammar`

- `probeLlamaCpp` — Probe llama-server's native /health endpoint.

## `./lm/rule-builders`

- `LMRuleDefinition`

- `LMRuleFactoryConfig`

## `./lm/rule-templates`

- `ruleDefs`

- `prompts`

## `./lm/rule-templates/fallbacks`

- `SymbolicFallback` — Pure-NAL symbolic fallbacks for LM rules: zero LM dependency, safe on any model.

- `templateTranslation`

- `similarityFallback` — Structural match admitted as a NAL similarity belief.

- `abductionFallback` — NAL abduction stand-in: question the missing connector.

- `conjunctionDecomposition` — Template decomposition: split conjunction goals into subgoals.

- `curiosityQuestionFallback` — NAL question generation: ask for the missing variable.

- `symbolicFallbacks` — Universal rule matrix: one prompt + one symbolic fallback per rule.

## `./lm/shadow-validation`

- `BeliefLike` — Shadow validation (TODO13 3.3): LLM-generated Narsese tasks are checked

- `ShadowCheckOptions`

- `ShadowSystemOneDeps`

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

## `./logger`

- `createLogger`

- `defaultLogger`

- `Logger`

## `./memory`

- `Concept`

- `Focus`

- `Archive`

- `Forgetting`

- `getTermMeta`

- `structuralGC`

- `trackTerm`

- `untrackTerm`

- `updateAccessTime`

- `Memory`

- `MemoryIndex`

- `MemoryConsolidation`

- `PressureDetector`

- `MemoryScorer`

- `decodeMemoryState` — Inverse of encodeMemoryState; accepts legacy bare SerializedMemory files.

- `deserialize`

- `encodeMemoryState`

- `repair`

- `serialize`

- `validate`

- `calculateConceptStats`

## `./memory/embedding`

- `EmbeddingGenerator`

- `EmbeddingGeneratorConfig`

- `DEFAULT_EMBEDDING_MODEL_ID`

- `DEFAULT_EMBEDDING_DIMENSION`

- `TransformersEmbeddingGenerator`

- `MockEmbeddingGenerator`

- `isMockLM` — Transformers (`MiniLM`) is the only real embedder and only ships with the

- `createEmbeddingGenerator`

- `cosineSimilarity`

## `./memory/episodic`

- `EpisodicMemory`

## `./memory/retrieval-verified`

- `ConsolidationOptions`

- `ConsolidationResult` — Episodes considered per consolidation pass. */

- `ConsolidatorDeps`

- `consolidateEpisodes`

## `./nl`

- `TranslationCache`

- `ClarificationHandler`

- `generateClarificationWithLM`

- `classify`

- `ContextAssembler`

- `defaultFirewall`

- `SymbolicFirewall`

- `NLGenerationService`

- `detectAmbiguityFlags`

- `locateSpan`

- `NLUnderstandingService`

- `toFormalizationBatch`

## `./otel`

- `OtelConfig`

- `initOtel` — Additional span processors (tests use an in-memory collector). */

- `getTracer`

- `withSpan`

- `decisionSpan` — O1/O4 helper: fire-and-forget span for high-frequency decisions (gate verdicts).

- `createMiddlewareSpans`

- `wrapMiddlewareWithSpan`

- `instrumentPipeline`

- `createOtelTickHooks`

- `emitSpanEvent`

- `recordCognitiveEvents`

- `shutdownOtel`

## `./reflex`

- `forwardingReflex` — Forwards `prefetch` (all arguments) to the wrapped reflex.

- `type PrefetchingReflex`

- `type ReflexWrapper`

- `recordedProposals` — Recording wrapper handle: extract `lastProposals` from a chain built with `recordingReflex()`.

- `recordingReflex` — Records the top proposals of each `propose` call for external inspection.

- `vetoAwareReflex` — L1 veto-aware demotion: actions whose LearningEvent carries `overriddenBy`

- `wrapReflex` — Compose a wrapper chain around a base reflex: `wrapReflex(base, recordingReflex(), vetoAwareReflex())`.

- `EpsilonGreedyReflex`

- `Negotiator`

- `TabularQReflex`

- `UCBReflex`

## `./rlfp`

_Re-export barrel._

## `./rules`

- `buildMetaRules` — Build registered meta-rules with proper patterns

- `getMetaBudgetStatus` — Get meta-reasoning budget status

- `initializeMetaReasoning` — Initialize meta-reasoning beliefs

- `META_AIKR_BOUNDS` — AIKR bounds for meta-reasoning

- `META_REASONING_BELIEFS` — Initialize meta-reasoning beliefs into NAR

- `META_RULES_NARSESE` — Meta-rule definitions in Narsese format

- `registerMetaRules` — Register meta-rules into the RuleRegistry

- `shouldActivateMetaReasoning` — Check if meta-reasoning should activate based on drive intensities

- `RuleProcessor`

- `DerivationRecorder`

- `inferRuleCategory`

- `NALExtendedRules`

- `NALRules`

- `createRulePattern`

- `RuleIndex`

- `RuleRegistry`

## `./self`

- `ArchitectureDriver`

- `ReasoningAboutReasoning`

## `./stream`

- `backpressureAware`

- `CompositePremiseSource`

- `createPipeline`

- `derive`

- `FocusPremiseSource`

- `MemoryPremiseSource`

- `PremiseSourceBase`

- `throttled`

- `StreamReasoner`

## `./stream/*`

_Dynamic subpath (no single entry file)._

## `./tick`

- `emitSpanEvent`

- `getTracer`

- `initOtel` — Additional span processors (tests use an in-memory collector). */

- `instrumentPipeline`

- `recordCognitiveEvents`

- `shutdownOtel`

- `wrapMiddlewareWithSpan`

- `createDefaultHooks`

- `operationActionOf`

- `toCognitiveEvents`

- `createPipeline`

- `createTickContext`

- `DEFAULT_PIPELINE`

- `runTick`

## `./tools`

_Re-export barrel._

## `./tools/schemas`

- `ToolSpecSchema`

- `ToolSpec`

- `ConnectionConfigSchema`

- `ConnectionConfig`

- `AgentOptionsSchema`

- `AgentOptions`
