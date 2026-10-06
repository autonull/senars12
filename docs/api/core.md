# @senars/core — public API

## `.`

- `clamp`

- `clamp01`

- `compact`

- `createLogger`

- `defaultLogger`

- `edgeKey`

- `ensureArray`

- `errMsg`

- `estimateTokens`

- `extractTerm`

- `generateId`

- `isNarsese`

- `isNil`

- `Logger`

- `makeId`

- `registerLogEnricher`

- `sleep`

- `toError`

- `agentOptionsSchema`

- `contextOptsSchema`

- `Agent`

- `ApprovalService`

- `InMemoryApprovalManager` — In-memory pending-approval registry: the default `ApprovalManager` implementation.

- `type BudgetAllocation`

- `CognitiveThread`

- `type CognitiveThreadOptions`

- `createCognitiveThread` — Create a cognitive thread with default options.

- `createRootBudget` — Create a root budget slice for the main thread.

- `type JoinResult`

- `type SpawnResult`

- `type ThreadMessage`

- `ThreadPool` — Thread pool for managing multiple threads.

- `type ThreadStatus`

- `createCortexFromLM` — LMService satisfies ModelProvider structurally (LMTask ≡ ModelTier) — one LM execution path.

- `type CortexSynthesizeRequest`

- `type CortexSynthesizeResponse`

- `LLMCortex`

- `type PromptBuilder`

- `BaseEngine`

- `InMemoryEventLog`

- `SqliteEventLog` — Every statement this log issues is compiled once and kept: `better-sqlite3`'s

- `BaseComponent`

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

- `type JsonlSessionManagerConfig`

- `registerAgentTools`

- `BUILTIN_TOOLS`

- `type BuiltinDeps`

- `type CmdArgSet`

- `createBuiltinTools`

- `type PinStore`

- `registerBuiltinTools`

- `type DispatchArtifact`

- `type DispatchContext`

- `type DispatchError`

- `dispatchToolCalls`

- `type SkillFeedback`

- `type ToolFn`

- `ToolRegistry`

- `type ToolSpec`

- `WORKSPACE_ROOT` — Workspace root for motor tool sandboxing (defaults to process cwd).

- `withinWorkspace` — True when an absolute path resolves inside the workspace root.

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

- `CONNECTION_COLORS` — Color coding for connection states.

- `CognitiveDelta`

- `ConfigField`

- `EDGE_LABELS` — Human-readable labels for edge types (aliased from EDGE_TYPES for convenience).

- `EDGE_TYPES` — NAR-native edge types and their UI labels.

- `edgeTypeLabel` — Returns the UI label for an edge type, falling back to the raw type string.

- `GraphNodeData`

- `GraphNodeDataStrict`

- `GraphOp`

- `IncomingFromClient`

- `IncomingFromServer`

- `LENS_COLORS_HEX` — Hex color codes for each cognitive lens.

- `LENS_DESCRIPTIONS` — Short descriptions for each cognitive lens shown in the UI.

- `LENS_FIELDS` — Available fields for lens mapping, shared between server schema and designer.

- `LENS_LABELS` — Human-readable labels for each cognitive lens.

- `Lens`

- `type LensFieldDescriptor`

- `MettaAtomNode`

- `MettaSkillNode`

- `NarConceptNode`

- `isEventType`

- `isNarEvent`

- `ConnectionError`

## `./eventlog`

- `EventLogError`

- `InMemoryEventLog`

- `SqliteEventLog` — Every statement this log issues is compiled once and kept: `better-sqlite3`'s

## `./protocol`

- `CONNECTION_COLORS` — Color coding for connection states.

- `EDGE_LABELS` — Human-readable labels for edge types (aliased from EDGE_TYPES for convenience).

- `EDGE_TYPES` — NAR-native edge types and their UI labels.

- `edgeTypeLabel` — Returns the UI label for an edge type, falling back to the raw type string.

- `LENS_COLORS_HEX` — Hex color codes for each cognitive lens.

- `LENS_DESCRIPTIONS` — Short descriptions for each cognitive lens shown in the UI.

- `LENS_FIELDS` — Available fields for lens mapping, shared between server schema and designer.

- `LENS_LABELS` — Human-readable labels for each cognitive lens.

- `type LensFieldDescriptor`

- `AgentCapabilities`

- `ChatAgentComplete`

- `ChatAgentStream`

- `ChatMessage`

- `ChatUserMsg`

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

- `abortSession`

- `createSession`

- `InMemorySessionManager`

- `JsonlSessionManager` — Bounded in-memory sessions with a JSONL ledger snapshot on close.

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

- `createMacroContext`

- `motorTools`

- `ExchangeCapture` — Opt-in phase: promotes an exchange to dialogue capture (replaces fire-and-forget bot hooks).

- `createCapturePhase`

- `createReflectPhase` — Opt-in phase: metacognitive reflection over the completed cycle.

## `./agent/types`

- `CorrelationScopeStore` — Per-correlationId scope store (Phase A) — the contract that keeps one user's

- `AgentOptions`

- `ResolvedAgentOptions` — Options once the cortex has been resolved from a service. `util`'s

- `BridgeOptions` — Refines the canonical util contract with core-owned memory typing; the auth/commandRegistry

## `./engine`

_Re-export barrel._

## `./engine/base`

_Re-export barrel._

## `./bridge/chat-stream-handler`

- `aggregateChatResponse`

## `./metta-port`

- `MettaPort`

## `./memory`

- `MemoryService`

- `abortSession`

- `createSession`

- `InMemorySessionManager`

- `JsonlSessionManager` — Bounded in-memory sessions with a JSONL ledger snapshot on close.

- `RECALL_WINDOW` — How much recent context an utterance is given. One window for both tiers it is

- `WORKING_MEMORY_CAPACITY` — Hard ceiling on the working tier; the oldest entry is evicted past it.

## `./motor`

- `registerAgentTools`

- `BUILTIN_TOOLS`

- `type BuiltinDeps`

- `type CmdArgSet`

- `createBuiltinTools`

- `type PinStore`

- `registerBuiltinTools`

- `type DispatchArtifact`

- `type DispatchContext`

- `type DispatchError`

- `dispatchToolCalls`

- `type SkillFeedback`

- `type ToolContext`

- `type ToolFn`

- `ToolRegistry`

- `type ToolRegistryDelegate`

- `type ToolSpec`

- `motorToToolSet`

- `braveApiKey` — Brave's key, or the generic web-search alias.

- `braveSearch`

- `duckDuckGoSearch`

- `SEARCH_PROVIDERS` — Every backend, in failover order. Keyed providers first (better ranking,

- `type SearchProvider`

- `searchWeb` — Run the provider chain and return the first successful answer. A provider

- `tavilySearch`

- `type WebSearchOutcome`

- `type WebSearchResult`

- `webFetch`

- `WORKSPACE_ROOT` — Workspace root for motor tool sandboxing (defaults to process cwd).

- `withinWorkspace` — True when an absolute path resolves inside the workspace root.

## `./cortex`

- `createCortexFromLM` — LMService satisfies ModelProvider structurally (LMTask ≡ ModelTier) — one LM execution path.

- `type CortexSynthesizeRequest`

- `type CortexSynthesizeResponse`

- `LLMCortex`

- `type PromptBuilder`

## `./schemas`

- `AutonomyModeChangedEventSchema`

- `BeliefRevisedEventSchema`

- `BudgetExhaustedEventSchema`

- `CognitiveEventSchema` — Every event the log admits: the kernel's own families, the two the proposal

- `ConceptActivatedEventSchema`

- `DerivationAcceptedEventSchema`

- `EgressGateRejectedEventSchema`

- `isEventType`

- `isNarEvent`

- `JudgmentResolvedEventSchema`

- `mintCognitiveEvent` — Construct an event from the schema, not from a hand-written literal.

- `PolicyViolationEventSchema`

- `SelfModProposalEventSchema`

- `ShadowValidationDropEventSchema`

- `STIMULUS_SOURCES` — Where an admitted claim came from. Named rather than inlined because the

- `StimulusSourceSchema`

- `TaskAdmittedEventSchema`

- `validateCognitiveEvent`

- `BudgetSchema` — The task budget — the five numbers that cross every boundary. The zod form

- `HistoryEntrySchema`

- `INDEPENDENCE` — Whether a derivation's premises are independent of the conclusion they support.

- `IndependenceSchema`

- `RulePatternSchema` — A rule pattern as data: both kinds are required, because a wildcard

- `RulePatternSideSchema` — One side of a rule pattern: the term kind the dispatch cell keys on.

- `DerivationRecordSchema`

- `DerivationStepSchema`

- `validateDerivationRecord`

- `CognitiveEventBaseSchema`

- `EngineOriginSchema`

- `PROPOSER_ORIGIN` — The one origin permitted to append proposal events.

- `AMBIGUITY_SEVERITIES` — The severity ladder an ambiguity is costed on. Deliberately a different

- `AMBIGUITY_SEVERITY` — How much an ambiguity of each kind should cost the parse that carries it.

- `AMBIGUITY_TYPES` — What can be ambiguous about a parse. The LM's ambiguity schema and the kernel's

- `AmbiguityFlagSchema` — The flag as the kernel weighs it — the report plus the severity its kind carries.

- `AmbiguityReportSchema` — The flag as a proposer reports it: *what* is ambiguous, not how much it costs.

- `ambiguitySeverityOf` — The severity an ambiguity of this kind carries.

- `DETECTED_INTENTS` — What the translator decided an utterance was *for*. The rule-template generator

- `DetectedIntentSchema`

- `FormalizationBatchSchema`

- `FormalizationCandidateSchema`

- `SourceSpanSchema`

- `validateFormalizationBatch`

- `validateFormalizationCandidate`

- `ActionGateInputSchema`

- `ActionGateOutputSchema`

- `BUDGET_OPERATIONS` — The operation vocabulary as a value, for the readers that must enumerate it.

- `BudgetGateInputSchema`

- `BudgetGateOutputSchema`

- `BudgetOperationSchema` — Every operation the budget gate accounts. The five A7 control scopes are the

- `PerceptionGateInputSchema`

- `PerceptionGateOutputSchema`

- `RewardGateInputSchema`

- `RewardGateOutputSchema`

- `AUTONOMITY_AUTHORITIES` — Who may move the autonomy mode. The action gate's port spelled this union out

- `AutonomyAuthoritySchema`

- `AutonomyModeSchema`

- `GameDomainSchema`

- `GovernanceDecisionSchema`

- `GovernanceEventSchema`

- `PatchProposalSchema`

- `PROPOSAL_RISK` — What kind of change each proposal kind makes, and therefore what governance it

- `permitsExecution`

- `proposalRisk` — The tier a proposal of this kind carries.

- `RewardDomainSchema`

- `RISK_LEVELS`

- `RiskAssessmentSchema`

- `RiskLevelSchema`

- `riskLevelOf` — The caps spelling of a risk tier — the only conversion between the two vocabularies.

- `SelfImprovementProposalSchema`

- `NarEventSchemas`

- `ContentProposalSchema` — A formalized claim about a term. It is **not** a truth value to be written: it

- `PROPOSAL_KINDS` — What a proposal is about. The two kinds have separate payloads, not a flag.

- `PROPOSAL_REJECTIONS` — Why a proposal did not land. Every value is an operator-visible outcome.

- `PROPOSAL_SCHEMA_VERSION` — The wire version of the proposal contract. A run recorded against one version

- `ProposalAdmittedEventSchema`

- `ProposalRejectedEventSchema`

- `ProposalSchema`

- `RuleProposalSchema` — A reaction: pattern, truth function, priority. It lands in the rule table, so

- `validateProposal`

- `BUDGET_SCOPE_IDS` — The five declared budget scopes (TODO29.a §5.7).

- `BUDGET_TYPES` — Each consumed key's event-level name, declared beside the schema that defines

- `BudgetTypeSchema`

- `ConsumedBudgetSchema`

- `ReasoningBudgetSchema`

- `TerminationReasonSchema`

- `validateReasoningBudget`

- `zeroConsumed` — A zeroed consumption record.

- `BUILTIN_RULE_ARTIFACT_VERSION` — The shipped built-in table's own version, independent of the schema shape.

- `RULE_TABLE_REJECTIONS` — Why a table could not be loaded. Each is a loud failure, never a coercion.

- `RULE_TABLE_SCHEMA_VERSION` — The wire version of the rule-table artifact. A table recorded against one

- `RuleArtifactEntrySchema` — One entry of a table at one revision. The identity fields are what make

- `RuleDeclarationSchema` — One rule, as data. The pattern's `op` is a term kind, required on both sides:

- `RuleProvenanceSchema` — How an entry came to exist. The three kinds have different revert stories.

- `RuleTableSchema` — A whole table at a revision: the unit that is loaded, recorded and restored.

- `validateRuleTable`

- `TASK_BAG_KINDS` — The kinds a concept's bags can hold. `command` is admitted and rendered but never

- `TASK_PUNCTUATION` — The sentence mark a task of each kind is written with — the one place the grammar's

- `TASK_PUNCTUATIONS` — The marks, deduplicated from the table above rather than restated.

- `TASK_TYPES` — Every kind of task the kernel admits. Order is the bag order, not a ranking.

- `TaskBagKindSchema`

- `TaskPunctuationSchema`

- `TaskTypeSchema`

- `TOLERANT_PUNCTUATIONS` — The order a string observation is re-parsed in when it arrived with no sentence mark:

- `taskTypeForPunctuation` — Task kind named by its Narsese sentence mark; `null` when it is not one.

- `confidenceCeiling` — The confidence a claim from `quality` may carry: the table, lowered by the

- `SOURCE_QUALITY_CONFIDENCE` — Confidence ceiling by source quality — single source of truth.

- `SourceQualitySchema` — Where a claim came from. Provenance is what bounds its confidence.

- `TruthValueSchema` — The `0..1` truth pair every event payload, derivation record, and formalization

## `./schemas/*`

_Dynamic subpath (no single entry file)._

## `./budget`

- `ConsumedBudget` — Budget slice consumed resources.

- `snapshotBudget` — A budget copied, consumption included.

- `freshBudget` — The same ceilings over unspent consumption — the counters at zero and no

- `BudgetLimits` — The four AIKR dimensions a budget is limited in — its whole ceiling.

- `AIKRBudget` — The remaining-cycles view the bag and the tick pipeline both consume.

- `BudgetEventMap` — Every `budget:slice:*` payload, so a bus can be typed against this alone.

- `BudgetEventBus` — The one bus method `BudgetSlice` needs — a NAR `NarEventBus` satisfies it.

- `BudgetSlice` — A budget plus the slice identity that threads and focus nodes are keyed by.

- `BudgetSliceOptions`

- `createBudget` — The one budget constructor. Every ceiling in the system — the gate's default,

- `createBudgetSlice`

- `sliceBudget`

- `BUDGET_RESOURCES` — The four AIKR dimensions, each with its consumed key, total key, and exhaustion reason.

- `BudgetResource`

- `ALL_RESOURCES`

- `budgetLimitsOf` — The four dimensions with their ceilings in one snapshot — the shape every

- `budgetLimit` — One dimension's ceiling.

- `budgetRemaining` — Unconsumed capacity in one dimension; negative once a charge over-spent it.

- `budgetAffords` — Whether `amount` fits in what is left of one dimension — the single grant test.

- `budgetPressure` — Fraction of one dimension consumed, in `0..1`. An unlimited dimension is unpressured.

- `budgetRefusal` — The reason a refused charge on `resource` raises: the dimension's own when it is

- `chargeBudget` — The one accumulation. Refusal is the caller's decision — a slice and a gate

- `BudgetAllocation` — A partial budget request across the four AIKR dimensions.

- `consumeCycles`

- `consumeDepth`

- `consumeMemoryOps`

- `consumeLMCalls`

- `remainingCycles`

- `remainingAll` — All four remaining dimensions in one snapshot — the shape budget consumers hand around.

- `resolveAllocation` — Resolve a requested child allocation against the parent's unconsumed capacity

- `chargeAllocation` — Charge a resolved allocation against a parent slice across all four

- `mergeConsumed` — Fold a child's consumed totals into a parent's. `depth` is a high-water mark

- `mergeConsumption`

- `isCapacityExhausted` — Whether any dimension has nothing left. The one capacity test, so a gate and a

- `isExhausted`

- `pressure` — Worst per-dimension pressure — the slice's overall load.

- `BUDGET_TYPES` — Each consumed key's event-level name, declared beside the schema that defines

- `BudgetTypeSchema`

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

- `resolveTruthFn` — The truth function a step was derived with: the operation its rule declared,

- `formatFinding`

- `verifyRecord` — Verify a derivation record end to end. Shape is checked against the schema

## `./cognitive-thread`

- `BackpressureReason` — Why a send was admitted or refused — and the pairing is exact: `allowed ⇔ reason !== refusal`.

- `ThreadStatus`

- `ThreadMessage`

- `CognitiveThreadOptions`

- `SpawnResult`

- `JoinResult`

- `ThreadMailbox` — A bounded FIFO of messages. A mailbox is a bounded ring that *refuses* rather

- `CognitiveThread`

- `ThreadPool` — Thread pool for managing multiple threads.

- `createRootBudget` — Create a root budget slice for the main thread.

- `createCognitiveThread` — Create a cognitive thread with default options.
