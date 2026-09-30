# @senars/util — public API

## `.`

- `CommandRegistry`

- `AgentOptionsValidationError`

- `agentOptionsSchema`

- `CACHE_DIR` — Root of the runtime cache/checkpoint tree (state snapshots, ledgers, datasets).

- `cachePath` — Absolute path to a file or directory inside the cache tree.

- `contextOptsSchema`

- `envBool`

- `envCsv`

- `envFirst` — First defined value among `keys`, or `undefined`.

- `envInt`

- `envNum` — Finite real number from the environment, else `fallback`. Unlike `envInt`

- `envPositive` — Positive finite number from the environment, else `fallback` — the guard for

- `envStr`

- `envStrOr`

- `isTruthy` — Canonical truthiness for env-sourced strings — every `=== 'true'` check funnels here.

- `parseEnvValue`

- `parseOrThrow`

- `readEnvOverrides`

- `SchemaValidationError`

- `SENARS_ENV_MAP`

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

- `PushQueue` — Single-writer push buffer exposed as an async iterator — the one bridge

- `Signal` — One subject, any number of listeners — the unnamed case {@link EventBus} generalises.

- `DefaultToolFeedbackObserver`

- `type ToolFeedback`

- `type ToolFeedbackObserver`

- `abortSession`

- `createSession`

- `InMemorySessionManager` — Sessions with no persistence layer.

- `SessionStore` — Bounded session map — the single runtime store behind every `SessionManager`,

- `dispatch` — Onion-style dispatch for a middleware chain.

- `passthrough` — Creates a passthrough middleware that emits an event and calls next.

- `isEventType`

- `isNarEvent`

- `createLogger`

- `defaultLogger`

- `Logger`

- `registerLogEnricher`

- `asBeliefTruth` — Belief-shaped truth from either truth representation; absent truth stays absent.

- `BeliefTruthSchema` — The runtime guard for {@link BeliefTruth}, and the one place a truth value's

- `formatNarseseTruth` — Narsese inline truth suffix ` :f:c` (empty when absent) — the single

- `formatTruth` — The single human/LLM-readable truth rendering — prompt text must not drift between call sites.

- `parseNarseseTruth` — Reads back what {@link formatNarseseTruth} writes. The suffix is a rendering,

- `parseTruthLiteral` — Reads back what {@link serializeTruth} writes, tolerating the whitespace a term's punctuation leaves.

- `serializeTruth` — Narsese `%f;c%` truth literal.

- `toConfidence`

- `toFrequency`

- `assertDefined`

- `invariant`

- `addToSet` — Add to a per-key set, creating the set on first use.

- `BoundedRing` — Drop-oldest bounded buffer — the single AIKR ring behind every bounded log

- `getOrInsert` — Lazily-created map entry — the single get-or-create primitive for nested maps.

- `incrementCount` — Accumulate a per-key count; returns the new total.

- `insertByScoreDesc` — Insert into a descending-sorted list in O(n) — no full re-sort, unlike

- `maxBy`

- `maxScore` — Highest `score` over `items`, floored at 0. Single pass over the iterable

- `minBy` — Extremum pick over a collection. `initial`/`initialScore` seed the running

- `pushCapped`

- `selectByPriority` — Greedy budget selection over `{ priority, id }` items: highest priority

- `selectTopN` — Top `n` items from an iterable ranked by `score`, descending. Single-pass with

- `sortBy` — Ascending copy sorted by a derived numeric key — never mutates the input.

- `sortByDesc`

- `trimCapped` — Keep the newest `capacity` entries of a plain array, dropping from the front.

- `bar` — Unicode progress bar for a 0–1 fraction.

- `divider` — Horizontal rule separating report sections.

- `pct` — Fraction → percentage string (`pct(0.6123)` → `'61.2%'`).

- `percentile` — Percentile of an unsorted sample at index `floor(p * n)`, clamped; 0 for an empty one.

- `section` — Section banner: rule, title, rule.

- `utcDate` — UTC calendar day as `YYYY-MM-DD` — the one date key for daily ledger files.

- `appendJsonl` — Append `rows` as one JSON object per line. Returns the number appended.

- `appendJsonlAsync`

- `containsPath` — True when `candidate` is `root` itself or lies beneath it. Separators are

- `ensureDir`

- `ensureDirSync` — `mkdir -p`, returning the directory.

- `ensureParentDir`

- `ensureParentDirSync` — `mkdir -p` for a file's parent directory.

- `iterateJsonl`

- `parseJsonOr` — Parse JSON text, yielding `fallback` on any syntax error.

- `readJsonFile` — Read and parse a JSON file. A missing or unreadable file yields `fallback`.

- `readJsonFileSync`

- `readJsonl` — Read a JSONL file, keeping rows that `parse` accepts and counting the rest.

- `readJsonlAsync`

- `writeJsonFile` — Write a JSON file, creating parent directories.

- `writeJsonFileSync`

- `writeJsonl` — Rewrite a JSONL file from `rows` (compaction path).

- `djb2` — djb2 over a string, with an optional per-character salt.

- `djb2Step` — One djb2 step — for folding non-string values (floats, salts) into a hash.

- `fnv1a` — FNV-1a over a string.

- `fnv1aCombine` — FNV-1a combine step for compound terms.

- `mul32` — 32-bit multiply — without it the accumulator escapes 2^53 and loses precision.

- `SHA256_PINNED` — Canonical pinned-digest shape (`sha256:<64 lowercase hex>`) — ModelDigest, lock files.

- `sha256Hex` — SHA-256 hex digest — the single hashing entry point for digests and provenance keys.

- `sha256HexParts` — Streaming SHA-256 hex digest over an ordered list of parts (no intermediate concat).

- `sha256Prefixed` — Algorithm-pinned digest form (`sha256:<hex>`) used by ModelDigest, lock files, and dialogue digests.

- `shortSha256Hex` — Truncated digest for compact identity keys (sidecars, consolidation ids).

- `generateId` — Monotonic, collision-resistant id. Pass an injectable `rng` (seeded runs,

- `installIdSource` — Install `source` as the process id source and return a restore function.

- `type IdSource`

- `makeId` — A fresh UUID, or the installed source's id when one is set.

- `sequentialIdSource` — Counter-derived UUIDs, for seeded runs: `00000000-0000-4000-8000-000000000001`

- `BoundedMap`

- `LruCache`

- `extractLastUserMessage` — Extract the concatenated text of the last user message in an AI-SDK prompt.

- `SlidingWindowRateLimiter`

- `withRetry` — Retry `fn` with exponential backoff; rethrows the last failure.

- `weightedMean` — The weighted running mean, in one place.

- `asSerializable` — Wraps an object that already fulfills the instance-side contract

- `factorySerializable`

- `inPlaceSerializable` — Bridges a class whose instance `serialize()` pairs with an *in-place*

- `boundedSignal` — Abort signal that fires after `timeoutMs`; call `done()` in a `finally` to release the timer.

- `CHARS_PER_TOKEN` — Characters per token in {@link estimateTokens} — its inverse, for budgeting characters from a token allowance.

- `chunk` — Fixed-size slices for batched work — the one chunking primitive.

- `clamp`

- `clamp01`

- `compact`

- `deepEqual` — Structural equality via {@link stableStringify} — order-insensitive for object keys.

- `deepFreeze` — Recursively freeze an object graph (TODO20 C3). Arrays and nested objects included.

- `deepMerge` — Recursively merge `override` onto `base`. Plain objects merge key-by-key;

- `edgeKey`

- `ensureArray`

- `errMsg`

- `estimateTokens` — Rough token count: ~4 characters per token. Single source for every budget.

- `extractTerm`

- `type Flags`

- `formatIssues` — The monorepo's one rendering of a schema failure. Four validators used to

- `getNested` — Dotted-path read; missing or non-object segments yield `undefined`.

- `isNarsese`

- `isNil`

- `isPlainObject` — Plain-object guard — the one object test behind config merging and tool schemas.

- `limitList`

- `mean` — Arithmetic mean of a projection; 0 for an empty collection (rates, scores, sums).

- `occupancy` — Occupancy of a bounded resource in `0..1` — the AIKR pressure signal every

- `parseFlags` — Parses `argv` once into flag lookups. `--flag value` consumes the next token

- `pearson` — Pearson correlation over the leading `min(xs, ys)` samples. The single

- `raceDeadline` — Cooperative deadline: resolves `{ timedOut: true }` when `timeoutMs` elapses,

- `roundTo` — Round to `digits` decimal places — the one float-noise guard for reported values.

- `safeDiv`

- `type SchemaIssue`

- `setNested` — Dotted-path write, creating missing intermediate objects.

- `sigmoid` — Logistic function; the single sigmoid used by scoring and gradient descent.

- `sleep`

- `softmax`

- `stableStringify` — Deterministic JSON with object keys emitted in sorted order — the single

- `stdDev` — Population standard deviation — `sqrt(variance)`.

- `TimeoutError` — Raised by {@link withTimeout} unless a domain error is supplied.

- `toError`

- `ucb1` — UCB1 exploration term: `c · sqrt(ln(total) / visits)`, with untried arms

- `tokenizeWords` — Lowercased word-token set — the tokenizer behind every text-similarity path.

- `truncate`

- `truncateBytes` — Byte-safe truncation for tool output — never splits a multi-byte character.

- `withTimeout` — Rejects with `error()` when `timeoutMs` elapses. The losing promise is not

- `wordOverlap`

- `variance` — Population variance of a projection; 0 for fewer than two samples.

- `setupGracefulShutdown` — Process lifecycle — the single signal → shutdown path for every SeNARS binary.

- `Unifier`

- `createThrottle`

- `Throttle`

- `throttleGenerator`

## `./commands`

- `CommandRegistry`

## `./config`

- `type CognitiveBoundCategory`

- `type CognitiveBoundKey`

- `type CognitiveBounds`

- `cognitiveBounds`

- `getAllCognitiveBounds`

- `getCognitiveBound`

- `type DialogueConfig`

- `dialogueDefaults`

- `dialogueSchema`

- `envBool`

- `envCsv`

- `envFirst` — First defined value among `keys`, or `undefined`.

- `envInt`

- `envNum` — Finite real number from the environment, else `fallback`. Unlike `envInt`

- `envNumOr` — Finite real number from the first defined alias, or `undefined` when the key is

- `envPositive` — Positive finite number from the environment, else `fallback` — the guard for

- `envStr`

- `envStrOr`

- `isBooleanSpelling` — True only for a spelling both halves accept — the acceptance test a validator wants.

- `isFalsy` — Exact complement of {@link isTruthy}. The two together are the whole boolean grammar.

- `isTruthy` — Canonical truthiness for env-sourced strings — every `=== 'true'` check funnels here.

- `parseEnvValue`

- `readEnvOverrides`

- `SENARS_ENV_MAP`

- `type LMSettingsShape`

- `lmSettingsSchema` — Canonical LM settings schema (composed from the raw shape).

- `lmSettingsShape` — Canonical field shape for LM settings — shared by @senars/nar/lm (LMSettings),

- `getBound`

- `type BoundProp`

- `type NarCoreBoundKey`

- `type NarCoreBounds`

- `narCoreBounds`

- `narCoreDefaultedNumber` — The same row as a zod number carrying its default.

- `narCoreNumber` — A zod number constrained by a `narCoreBounds` row — the schema never restates a limit.

- `CACHE_DIR` — Root of the runtime cache/checkpoint tree (state snapshots, ledgers, datasets).

- `cachePath` — Absolute path to a file or directory inside the cache tree.

- `type SystemOneConfig`

- `systemOneDefaults`

- `systemOneSchema`

- `type ValidatedAgentOptions`

- `AgentOptionsValidationError`

- `agentOptionsSchema`

- `contextOptsSchema`

- `parseOrThrow`

- `SchemaValidationError`

- `validateAgentOptions`

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

- `PushQueue` — Single-writer push buffer exposed as an async iterator — the one bridge

- `Signal` — One subject, any number of listeners — the unnamed case {@link EventBus} generalises.

## `./feedback`

- `ToolFeedback`

- `ToolFeedbackObserver`

- `DefaultToolFeedbackObserver`

## `./memory`

- `abortSession`

- `createSession`

- `DEFAULT_MAX_SESSIONS` — D15 (TODO17b): bounded runtime — sessions and per-session history are capped.

- `DEFAULT_MAX_HISTORY_PER_SESSION`

- `SessionStoreOptions`

- `SessionStore` — Bounded session map — the single runtime store behind every `SessionManager`,

- `InMemorySessionManager` — Sessions with no persistence layer.

## `./types/cognitive`

- `EngineOrigin`

- `CognitiveEventBase`

- `CognitiveEvent`

- `CognitiveStimulus`

- `Context`

- `Derivation`

- `ChatOptions`

- `ChatStreamEvent`

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

- `isNil`

- `ensureArray`

- `chunk` — Fixed-size slices for batched work — the one chunking primitive.

- `errMsg`

- `toError`

- `CHARS_PER_TOKEN` — Characters per token in {@link estimateTokens} — its inverse, for budgeting characters from a token allowance.

- `estimateTokens` — Rough token count: ~4 characters per token. Single source for every budget.

- `sleep`

- `boundedSignal` — Abort signal that fires after `timeoutMs`; call `done()` in a `finally` to release the timer.

- `TimeoutError` — Raised by {@link withTimeout} unless a domain error is supplied.

- `withTimeout` — Rejects with `error()` when `timeoutMs` elapses. The losing promise is not

- `raceDeadline` — Cooperative deadline: resolves `{ timedOut: true }` when `timeoutMs` elapses,

- `compact`

- `clamp`

- `clamp01`

- `occupancy` — Occupancy of a bounded resource in `0..1` — the AIKR pressure signal every

- `roundTo` — Round to `digits` decimal places — the one float-noise guard for reported values.

- `edgeKey`

- `isPlainObject` — Plain-object guard — the one object test behind config merging and tool schemas.

- `deepMerge` — Recursively merge `override` onto `base`. Plain objects merge key-by-key;

- `sigmoid` — Logistic function; the single sigmoid used by scoring and gradient descent.

- `softmax`

- `safeDiv`

- `mean` — Arithmetic mean of a projection; 0 for an empty collection (rates, scores, sums).

- `variance` — Population variance of a projection; 0 for fewer than two samples.

- `stdDev` — Population standard deviation — `sqrt(variance)`.

- `pearson` — Pearson correlation over the leading `min(xs, ys)` samples. The single

- `ucb1` — UCB1 exploration term: `c · sqrt(ln(total) / visits)`, with untried arms

- `stableStringify` — Deterministic JSON with object keys emitted in sorted order — the single

- `deepEqual` — Structural equality via {@link stableStringify} — order-insensitive for object keys.

- `tokenizeWords` — Lowercased word-token set — the tokenizer behind every text-similarity path.

- `wordOverlap`

- `getNested` — Dotted-path read; missing or non-object segments yield `undefined`.

- `setNested` — Dotted-path write, creating missing intermediate objects.

- `Flags` — Typed accessor over `--flag value` style argv arrays.

- `parseFlags` — Parses `argv` once into flag lookups. `--flag value` consumes the next token

- `extractTerm`

- `isNarsese`

- `truncate`

- `SchemaIssue` — One issue's worth of what a diagnostic can say; the shape every schema issue already has.

- `formatIssues` — The monorepo's one rendering of a schema failure. Four validators used to

- `truncateBytes` — Byte-safe truncation for tool output — never splits a multi-byte character.

- `limitList`

- `deepFreeze` — Recursively freeze an object graph (TODO20 C3). Arrays and nested objects included.

## `./utils/throttle`

- `ThrottleConfig`

- `Throttle`

- `createThrottle`

## `./ledger`

- `BaseLedgerEntrySchema` — Ledger entry schema — all entries carry a timestamp and correlation context.

- `BaseLedgerEntry`

- `RolloverPolicy` — Rotation/rollover policy — parameterized from EpisodicMemory's load-bearing behavior.

- `RolloverPolicyOptions` — Factory options for rollover policy (all optional, defaults applied).

- `LedgerQuery` — Query filter for ledger entries.

- `LedgerConfig` — Ledger configuration.

- `CreateLedgerOptions` — Factory options for createLedger (excludes basePath and schema which are separate params).

- `Ledger` — Generic append-only ledger with JSONL backing, rotation, retention, and in-memory hot cache.

- `createLedger` — Convenience factory for common ledger shapes.
