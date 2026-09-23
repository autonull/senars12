# @senars/util — public API

## `.`

- `CommandRegistry`

- `AgentOptionsValidationError`

- `agentOptionsSchema`

- `contextOptsSchema`

- `parseEnvValue`

- `readEnvOverrides`

- `SENARS_ENV_MAP` — Standardized `SENARS_*` environment variable → config path mapping.

- `validateAgentOptions`

- `ConfigError`

- `ConfigurationError`

- `ConnectionError`

- `EngineError`

- `OperationError`

- `PolicyViolation`

- `SenarsError`

- `ToolError`

- `TransportError`

- `ValidationError`

- `EventBus`

- `abortSession`

- `createSession`

- `InMemorySessionManager`

- `isEventType`

- `isNarEvent`

- `toConfidence`

- `toFrequency`

- `assertDefined`

- `invariant`

- `generateId`

- `asSerializable` — Wraps an object that already fulfills the instance-side contract

- `factorySerializable`

- `inPlaceSerializable` — Bridges a class whose instance `serialize()` pairs with an *in-place*

- `DefaultToolFeedbackObserver`

- `type ToolFeedback`

- `type ToolFeedbackObserver`

- `clamp`

- `clamp01`

- `compact`

- `edgeKey`

- `deepFreeze` — Recursively freeze an object graph (TODO20 C3). Arrays and nested objects included.

- `ensureArray`

- `errMsg`

- `extractTerm`

- `generatePrefixedId`

- `isNarsese`

- `isNil`

- `limitList`

- `makeId`

- `safeDiv`

- `sleep`

- `toError`

- `truncate`

- `wordOverlap`

- `extractLastUserMessage` — Extract the concatenated text of the last user message in an AI-SDK prompt.

- `createThrottle`

- `Throttle`

- `throttleGenerator`

## `./commands`

- `CommandRegistry`

## `./config`

- `parseEnvValue`

- `readEnvOverrides`

- `SENARS_ENV_MAP` — Standardized `SENARS_*` environment variable → config path mapping.

- `type LMSettingsShape`

- `lmSettingsSchema` — Named preset: auto | cloud-quality | local-private | ollama. */

- `lmSettingsShape` — Canonical field shape for LM settings — shared by @senars/nar/lm (LMSettings),

- `narCoreBounds` — Shared min/max/default bounds for NAR core config — single source of truth for

- `type NarCoreBounds`

- `type NarCoreBoundKey`

- `getBound`

- `cognitiveBounds` — Shared min/max/default bounds for cognitive parameters — single source of truth for

- `type CognitiveBounds`

- `type CognitiveBoundCategory`

- `type CognitiveBoundKey`

- `getCognitiveBound`

- `getAllCognitiveBounds`

- `AgentOptionsValidationError`

- `agentOptionsSchema`

- `contextOptsSchema`

- `validateAgentOptions`

- `systemOneDefaults`

- `systemOneSchema`

- `type SystemOneConfig`

## `./errors`

- `ConfigError`

- `EngineError`

- `ConfigurationError`

- `OperationError`

- `ValidationError`

- `PolicyViolation`

- `SenarsError`

- `ToolError`

- `ConnectionError`

- `TransportError`

## `./events`

- `EventBus`

## `./feedback`

- `ToolFeedback`

- `ToolFeedbackObserver`

- `DefaultToolFeedbackObserver`

## `./memory`

- `abortSession`

- `createSession`

- `DEFAULT_MAX_SESSIONS` — D15 (TODO17b): bounded runtime — sessions and per-session history are capped.

- `DEFAULT_MAX_HISTORY_PER_SESSION`

- `InMemorySessionManagerOptions`

- `InMemorySessionManager`

## `./types/cognitive`

- `EngineOrigin`

- `CognitiveEventBase`

- `CognitiveEvent`

- `CognitiveStimulus`

- `Context`

- `Derivation`

- `isNarEvent`

- `isEventType`

## `./types/memory`

- `ConversationSession`

- `SessionManager`

## `./types/transport`

- `ConnectionState`

- `IOMessage`

- `MessageClassification`

- `Connection`

- `ConnectionConfig`

- `ConnectionFactory`

- `ConnectionDeps`

- `TransportDeps`

## `./utils/assert`

- `invariant`

- `assertDefined`

## `./utils/eval`

- `ExpressionError` — Safe arithmetic expression evaluator — a non-eval replacement for `new Function()` math.

- `evaluateExpression` — Evaluate an arithmetic expression; throws `ExpressionError` on malformed input.

## `./utils/serialization`

- `Serializable`

- `Versioned`

- `asSerializable` — Wraps an object that already fulfills the instance-side contract

- `inPlaceSerializable` — Bridges a class whose instance `serialize()` pairs with an *in-place*

- `FactorySerializable` — Bridges a class whose instance `serialize()` pairs with a *static factory*

- `factorySerializable`

## `./utils/shared`

- `makeId`

- `isNil`

- `ensureArray`

- `errMsg`

- `toError`

- `sleep`

- `compact`

- `clamp`

- `clamp01`

- `edgeKey`

- `safeDiv`

- `wordOverlap`

- `generateId`

- `extractTerm`

- `isNarsese`

- `truncate`

- `limitList`

- `deepFreeze` — Recursively freeze an object graph (TODO20 C3). Arrays and nested objects included.

## `./utils/throttle`

- `ThrottleConfig`

- `Throttle`

- `createThrottle`
