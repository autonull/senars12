# @senars/core — public API

## `.`

- `isEventType`

- `isNarEvent`

- `Agent`

- `AgentBridge`

- `type BridgeDelta`

- `type BridgeEvent`

- `ApprovalService`

- `createChatService`

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

- `extractTerm`

- `generateId`

- `isNarsese`

- `isNil`

- `makeId`

- `sleep`

- `toError`

- `KnowledgeManager`

- `BaseComponent`

- `registerLogEnricher`

- `createLogger`

- `defaultLogger`

- `Logger`

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

- `JsonlSessionManager`

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

- `EngineOrigin`

- `CognitiveEventBase`

- `CognitiveEvent`

- `isNarEvent`

- `isEventType`

- `ChatOptions`

- `ChatStreamEvent`

## `./protocol`

- `AgentCapabilities`

- `ChatAgentComplete`

- `ChatAgentStream`

- `ChatMessage`

- `ChatUserMsg`

- `TruthValue`

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

## `./logger`

- `LogLevel`

- `LogEntry`

- `LoggerConfig` — Injected by the registered log enricher (see registerLogEnricher). */

- `LoggerInterface`

- `registerLogEnricher`

- `Logger`

- `createLogger`

- `defaultLogger`

## `./helpers`

- `assertDefined`

- `clamp`

- `clamp01`

- `compact`

- `edgeKey`

- `ensureArray`

- `errMsg`

- `extractTerm`

- `generateId`

- `invariant`

- `isNarsese`

- `isNil`

- `limitList`

- `makeId`

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

## `./agent/phases`

- `CycleHost` — Agent reasoning cycle phases, extracted from Agent.cycle for modularity.

- `runCycle`

## `./engine`

- `EngineId`

- `CognitiveStimulus`

- `Context`

- `Derivation`

- `ToolResult`

- `Engine`

## `./engine/base`

_Re-export barrel._

## `./bridge/chat-stream-handler`

- `aggregateChatResponse`

## `./memory`

- `MemoryService`

- `abortSession`

- `createSession`

- `InMemorySessionManager`

- `JsonlSessionManager`

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

## `./cortex`

- `createCortexFromLM` — LMService satisfies ModelProvider structurally (LMTask ≡ ModelTier) — one LM execution path.

- `type CortexSynthesizeRequest`

- `type CortexSynthesizeResponse`

- `LLMCortex`

- `type PromptBuilder`
