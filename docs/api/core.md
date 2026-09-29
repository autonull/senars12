# @senars/core — public API

## `.`

- `isEventType`

- `isNarEvent`

- `Agent`

- `AgentBridge`

- `type BridgeDelta`

- `type BridgeEvent`

- `ApprovalService`

- `InMemoryApprovalManager` — In-memory pending-approval registry: the default `ApprovalManager` implementation.

- `createChatService`

- `type BudgetAllocation`

- `CognitiveThread`

- `type CognitiveThreadOptions`

- `createCognitiveThread` — Create a cognitive thread with default options.

- `createRootBudget` — Create a root budget slice for the main thread.

- `type JoinResult`

- `type SpawnResult`

- `type ThreadMessage`

- `ThreadPool` — Thread pool for managing multiple threads.

- `type ThreadScope`

- `type ThreadStatus`

- `type CoActivationEdge`

- `ConceptGraph`

- `type ConceptGraphOptions`

- `ConfigViewImpl`

- `CONNECTION_COLORS` — Color coding for WebSocket connection states.

- `EDGE_LABELS` — Human-readable labels for edge types (aliased from EDGE_TYPES for convenience).

- `EDGE_TYPES` — NAR-native edge types and their UI labels.

- `edgeTypeLabel` — Returns the UI label for an edge type, falling back to the raw type string.

- `LENS_COLORS_HEX` — Hex color codes for each cognitive lens.

- `LENS_DESCRIPTIONS` — Short descriptions for each cognitive lens shown in the UI.

- `LENS_FIELDS` — Available fields for lens mapping, shared between server schema and designer.

- `LENS_LABELS` — Human-readable labels for each cognitive lens.

- `type LensFieldDescriptor`

- `createCortexFromLM` — LMService satisfies ModelProvider structurally (LMTask ≡ ModelTier) — one LM execution path.

- `type CortexSynthesizeRequest`

- `type CortexSynthesizeResponse`

- `LLMCortex`

- `type PromptBuilder`

- `BaseEngine`

- `InMemoryEventLog`

- `SqliteEventLog`

- `type FeedbackEntry`

- `FeedbackRegistry`

- `clamp`

- `clamp01`

- `compact`

- `edgeKey`

- `ensureArray`

- `errMsg`

- `estimateTokens`

- `extractTerm`

- `generateId`

- `isNarsese`

- `isNil`

- `makeId`

- `sleep`

- `toError`

- `KnowledgeManager`

- `BaseComponent`

- `createLogger`

- `defaultLogger`

- `Logger`

- `registerLogEnricher`

- `BUILTIN_LENS_IDS` — Built-in lens IDs shipped with the system.

- `builtinLensSpecs` — Build the built-in lens specs with capability requirements.

- `isBuiltinLens` — Returns true if a lens ID is a built-in.

- `LensSpecSchema` — Zod schema for a full Lens definition.

- `lensSpecToJsonSchema` — Generate a simple JSON Schema representation from LensSpecSchema (for editor validation).

- `ModulationSchema` — Recursive Zod schema for ModulationSpec.

- `ModelRunner`

- `MemoryService`

- `abortSession`

- `createSession`

- `InMemorySessionManager`

- `JsonlSessionManager` — Bounded in-memory sessions with a JSONL ledger snapshot on close.

- `registerAgentTools`

- `BUILTIN_TOOLS`

- `type BuiltinDeps`

- `type CmdArgSet`

- `createBuiltinTools`

- `type PinStore`

- `registerBuiltinTools`

- `type DispatchArtifact`

- `type DispatchCall`

- `type DispatchContext`

- `type DispatchError`

- `dispatchToolCalls`

- `type SkillFeedback`

- `type ToolFn`

- `ToolRegistry`

- `type ToolSpec`

- `WORKSPACE_ROOT` — Workspace root for motor tool sandboxing (defaults to process cwd).

- `withinWorkspace` — True when an absolute path resolves inside the workspace root.

- `AgentOptionsValidationError`

- `agentOptionsSchema`

- `contextOptsSchema`

- `validateAgentOptions`

- `PluginLoadError`

- `PluginLoader` — Discovers and activates plugins, giving each a view of the whole mind.

- `type TransportRegistry`

- `PolicyEngine`

- `type PolicyRule`

- `builtinLensPlugins` — All built-in lens plugins shipped with the system.

- `createLensPlugin` — Builds a lens plugin from a `LensSpec`.

- `createToolPlugin` — Builds a tool plugin from a `ToolSpec`.

- `createTransportPlugin` — Wraps a connection constructor into a `TransportFactory` plugin organ.

- `AgentCapabilities`

- `ChatMessage`

- `CognitiveDelta`

- `ConfigField`

- `GraphNodeData`

- `GraphNodeDataStrict`

- `GraphOp`

- `IncomingFromClient`

- `IncomingFromServer`

- `Lens`

- `MettaAtomNode`

- `MettaSkillNode`

- `NarConceptNode`

- `StatsManager`

- `ConnectionError`

## `./eventlog`

- `EventLogError`

- `InMemoryEventLog`

- `SqliteEventLog`

## `./cognitive-event`

- `isEventType`

- `isNarEvent`

## `./protocol`

- `AgentCapabilities`

- `ChatAgentComplete`

- `ChatAgentStream`

- `ChatMessage`

- `ChatUserMsg`

- `TruthValue` — The shared `0..1` truth pair, under this protocol's name.

- `ConfigField`

- `ConfigSchemaMsg`

- `ConfigSetMsg`

- `GraphNodeDataStrict`

- `MettaAtomNode`

- `MettaSkillNode`

- `NarConceptNode`

- `CognitiveDelta`

- `GraphOp`

- `GraphNodeData`

- `GraphNodeDataView`

- `Lens`

- `NodeHistoryMsg`

- `NodeHistoryRequestMsg`

- `LensDefinedMsg`

- `LensDefineMsg`

- `LensFieldsMsg`

- `LensListMsg`

- `NodeSetMsg`

- `ObjectSetMsg`

- `CognitiveMetrics`

- `FocusSet`

- `LensSet`

- `StateSnapshot`

- `SyncRequest`

- `TelemetryMsg`

- `ViewportSet`

- `IncomingFromClient`

- `IncomingFromServer`

- `CONNECTION_COLORS` — Color coding for WebSocket connection states.

- `EDGE_LABELS` — Human-readable labels for edge types (aliased from EDGE_TYPES for convenience).

- `EDGE_TYPES` — NAR-native edge types and their UI labels.

- `edgeTypeLabel` — Returns the UI label for an edge type, falling back to the raw type string.

- `LENS_COLORS_HEX` — Hex color codes for each cognitive lens.

- `LENS_DESCRIPTIONS` — Short descriptions for each cognitive lens shown in the UI.

- `LENS_FIELDS` — Available fields for lens mapping, shared between server schema and designer.

- `LENS_LABELS` — Human-readable labels for each cognitive lens.

- `type LensFieldDescriptor`

## `./logger`

- `createLogger`

- `defaultLogger`

- `Logger`

- `registerLogEnricher`

## `./helpers`

- `assertDefined`

- `clamp`

- `clamp01`

- `compact`

- `edgeKey`

- `ensureArray`

- `errMsg`

- `estimateTokens`

- `extractTerm`

- `fnv1a`

- `fnv1aCombine`

- `generateId`

- `invariant`

- `isNarsese`

- `isNil`

- `limitList`

- `type LruCacheOptions`

- `LruCache`

- `makeId`

- `mean`

- `mul32`

- `sleep`

- `toError`

- `truncate`

## `./command-types`

_Re-export barrel._

## `./lens-schema`

- `ModulationSpec` — JSON-serializable form of a Modulation AST node. Defined manually to avoid circular type inference.

- `ModulationSchema` — Recursive Zod schema for ModulationSpec.

- `LensSpecSchema` — Zod schema for a full Lens definition.

- `LensSpec`

- `BUILTIN_LENS_IDS` — Built-in lens IDs shipped with the system.

- `BuiltinLens`

- `isBuiltinLens` — Returns true if a lens ID is a built-in.

- `builtinLensSpecs` — Build the built-in lens specs with capability requirements.

- `lensSpecToJsonSchema` — Generate a simple JSON Schema representation from LensSpecSchema (for editor validation).

## `./agent`

- `Agent`

- `InMemorySessionManager`

- `JsonlSessionManager` — Bounded in-memory sessions with a JSONL ledger snapshot on close.

- `createSession`

- `abortSession`

- `createCognitiveAgent`

- `type CognitiveAgent`

- `type CognitiveAgentConfig`

- `type CognitiveAgentPreset`

- `type AnswerEnvelope`

## `./agent/*`

_Dynamic subpath (no single entry file)._

## `./agent/phases`

- `DEFAULT_MACRO_PIPELINE`

- `runCycle`

- `createCapturePhase`

- `createReflectPhase` — Opt-in phase: metacognitive reflection over the completed cycle.

## `./agent/pipeline`

- `CycleHost` — Shared macro-cycle pipeline (REFACTOR.todo1 Phase A).

- `NarrationTier`

- `MacroCycleState`

- `MacroContext`

- `MacroPhase`

- `dispatchMacro` — Onion dispatch — delegated to shared primitive in `@senars/util`.

- `createMacroContext`

- `motorTools`

- `ExchangeCapture` — Opt-in phase: promotes an exchange to dialogue capture (replaces fire-and-forget bot hooks).

- `createCapturePhase`

- `createReflectPhase` — Opt-in phase: metacognitive reflection over the completed cycle.

## `./agent/types`

- `CorrelationScopeStore` — Per-correlationId scope store (Phase A) — the contract that keeps one user's

- `AgentOptions`

- `ParsedCommand`

- `AgentPresetName`

- `AgentPresetDeps`

- `AgentPresetResult`

- `ValidatedAgentOptions`

- `BridgeOptions` — Refines the canonical util contract with core-owned memory typing; the auth/commandRegistry

- `BridgeContext`

## `./engine`

_Re-export barrel._

## `./engine/base`

_Re-export barrel._

## `./bridge/chat-stream-handler`

- `aggregateChatResponse`

## `./memory`

- `MemoryService`

- `abortSession`

- `createSession`

- `InMemorySessionManager`

- `JsonlSessionManager` — Bounded in-memory sessions with a JSONL ledger snapshot on close.

## `./motor`

- `type FeedbackEntry`

- `FeedbackRegistry`

- `registerAgentTools`

- `BUILTIN_TOOLS`

- `type BuiltinDeps`

- `type CmdArgSet`

- `createBuiltinTools`

- `type PinStore`

- `registerBuiltinTools`

- `type DispatchArtifact`

- `type DispatchCall`

- `type DispatchContext`

- `type DispatchError`

- `dispatchToolCalls`

- `type SkillFeedback`

- `type ToolFn`

- `ToolRegistry`

- `type ToolSpec`

- `motorToToolSet`

- `WORKSPACE_ROOT` — Workspace root for motor tool sandboxing (defaults to process cwd).

- `withinWorkspace` — True when an absolute path resolves inside the workspace root.

- `braveApiKey` — Brave's key, or the generic web-search alias.

- `braveSearch`

- `duckDuckGoSearch`

- `SEARCH_PROVIDERS` — Every backend, in failover order. Keyed providers first (better ranking,

- `type SearchProvider`

- `searchWeb` — Run the provider chain and return the first successful answer. A provider

- `tavilySearch`

- `webFetch`

- `type WebSearchOutcome`

- `type WebSearchResult`

## `./cortex`

- `createCortexFromLM` — LMService satisfies ModelProvider structurally (LMTask ≡ ModelTier) — one LM execution path.

- `type CortexSynthesizeRequest`

- `type CortexSynthesizeResponse`

- `LLMCortex`

- `type PromptBuilder`

## `./concept-graph`

- `CoActivationEdge`

- `ConceptGraphOptions`

- `ConceptGraph`

- `SerializedConceptGraph`

## `./derivation-schemas`

- `TruthValueSchema` — The `0..1` truth pair every event payload, derivation record, and formalization

- `EngineOriginSchema` — ============================================================================

- `CognitiveEventBaseSchema`

- `TaskAdmittedEventSchema`

- `DerivationAcceptedEventSchema`

- `BeliefRevisedEventSchema`

- `ConceptActivatedEventSchema`

- `BudgetExhaustedEventSchema`

- `PolicyViolationEventSchema`

- `AutonomyModeChangedEventSchema`

- `PatchProposalSchema`

- `SelfModProposalEventSchema`

- `JudgmentResolvedEventSchema`

- `JudgmentResolvedEvent`

- `EgressGateRejectedEventSchema`

- `ShadowValidationDropEventSchema`

- `CognitiveEventSchema`

- `CognitiveEvent`

- `EgressGateRejectedEvent`

- `ShadowValidationDropEvent`

- `TaskAdmittedEvent`

- `DerivationAcceptedEvent`

- `BeliefRevisedEvent`

- `ConceptActivatedEvent`

- `BudgetExhaustedEvent`

- `PolicyViolationEvent`

- `AutonomyModeChangedEvent`

- `SelfModProposalEvent`

- `TerminationReasonSchema` — ============================================================================

- `ReasoningBudgetSchema`

- `ReasoningBudget`

- `TerminationReason`

- `DerivationStepSchema` — ============================================================================

- `DerivationRecordSchema`

- `DerivationRecord`

- `DerivationStep`

- `TruthValue`

- `AmbiguityFlagSchema` — ============================================================================

- `SourceSpanSchema`

- `FormalizationCandidateSchema`

- `FormalizationBatchSchema`

- `FormalizationCandidate`

- `AmbiguityFlag`

- `SourceSpan`

- `FormalizationBatch`

- `AutonomyModeSchema` — ============================================================================

- `AutonomyMode`

- `SourceQualitySchema`

- `SourceQuality`

- `SOURCE_QUALITY_CONFIDENCE` — Confidence ceiling by source quality — single source of truth.

- `GameDomainSchema`

- `GameDomain`

- `RewardDomainSchema`

- `RewardDomain`

- `SelfImprovementProposalSchema`

- `SelfImprovementProposal`

- `PatchProposal`

- `RiskLevelSchema`

- `RiskLevel`

- `RiskAssessmentSchema`

- `RiskAssessment`

- `GovernanceDecisionSchema`

- `GovernanceDecision`

- `GovernanceEventSchema`

- `GovernanceEvent`

- `PerceptionGateInputSchema`

- `PerceptionGateOutputSchema`

- `ActionGateInputSchema`

- `ActionGateOutputSchema`

- `RewardGateInputSchema`

- `RewardGateOutputSchema`

- `BudgetGateInputSchema`

- `BudgetGateOutputSchema`

- `PerceptionGateInput` — ============================================================================

- `PerceptionGateOutput`

- `ActionGateInput`

- `ActionGateOutput`

- `RewardGateInput`

- `RewardGateOutput`

- `BudgetGateInput`

- `BudgetGateOutput`

- `validateCognitiveEvent`

- `validateReasoningBudget`

- `validateDerivationRecord`

- `validateFormalizationCandidate`

- `validateFormalizationBatch`

## `./budget`

- `ConsumedBudget` — Budget slice consumed resources.

- `BudgetSliceTotal` — Budget slice total resources.

- `AIKRBudget` — The remaining-cycles view the bag and the tick pipeline both consume.

- `BudgetEventMap` — Every `budget:slice:*` payload, so a bus can be typed against this alone.

- `BudgetEventBus` — The one bus method `BudgetSlice` needs — a NAR `NarEventBus` satisfies it.

- `BudgetSlice`

- `BudgetSliceOptions`

- `createBudgetSlice`

- `sliceBudget`

- `BudgetAllocation` — A partial budget request across the four AIKR dimensions.

- `consumeCycles`

- `consumeDepth`

- `consumeMemoryOps`

- `consumeLMCalls`

- `checkDeadline`

- `checkAbort`

- `remainingCycles`

- `remainingDepth`

- `remainingMemoryOps`

- `remainingLMCalls`

- `remainingAll` — All four remaining dimensions in one snapshot — the shape budget consumers hand around.

- `resolveAllocation` — Resolve a requested child allocation against the parent's unconsumed capacity

- `chargeAllocation` — Charge a resolved allocation against a parent slice across all four

- `toAIKRBudget`

- `mergeConsumed` — Fold a child's consumed totals into a parent's. `depth` is a high-water mark

- `mergeConsumption`

- `isExhausted`

- `pressure` — Worst per-dimension pressure — the slice's overall load.

- `collectBudgetSlices` — Collect all budget slices in a tree starting from root.

- `formatBudgetSliceTree` — Format budget slice tree for CLI output.

## `./event-sink`

- `DomainEventPayload` — The domain-event sink: the one place a lower layer can announce something

- `DomainEventSink`

- `setDomainEventSink`

- `hasDomainEventSink`

- `emitDomainEvent`

## `./verify-derivation`

- `VerificationFinding` — One defect, tagged with the check that caught it.

- `StepVerificationResult` — Per-step verdict. `computedTruth` is absent when no truth function applies.

- `VerificationResult`

- `VerifyOptions`

- `VERIFIER_TRUTH_TABLE` — The transcribed table, exported so the drift test can compare it against the

- `formatFinding`

- `verifyRecord` — Verify a derivation record end to end. Shape is checked against the schema

## `./cognitive-thread`

- `ThreadStatus`

- `ThreadMessage`

- `CognitiveThreadOptions`

- `SpawnResult`

- `JoinResult`

- `ThreadMailbox`

- `CognitiveThread`

- `ThreadPool` — Thread pool for managing multiple threads.

- `ThreadScope` — Deprecated alias for backward compatibility.

- `ThreadScope` — Deprecated alias for backward compatibility.

- `createRootBudget` — Create a root budget slice for the main thread.

- `createCognitiveThread` — Create a cognitive thread with default options.
