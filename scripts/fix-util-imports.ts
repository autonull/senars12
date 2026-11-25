#!/usr/bin/env node
/**
 * Automated script to migrate @senars/util barrel imports to specific path aliases.
 * Run with: npx tsx scripts/fix-util-imports.ts
 */

import fs from 'node:fs';
import path from 'node:path';

// Mapping from import name to specific path alias
const importToAlias: Record<string, string> = {
  // @senars/util/id
  'makeId': '@senars/util/id',
  'generateId': '@senars/util/id',
  'currentIdCount': '@senars/util/id',
  'primeIdCount': '@senars/util/id',
  'sequentialIdSource': '@senars/util/id',
  'sortableIdSource': '@senars/util/id',
  'installIdSource': '@senars/util/id',
  'IdSource': '@senars/util/id',

  // @senars/util/numeric
  'safeRatio': '@senars/util/numeric',
  'clamp01': '@senars/util/numeric',
  'clamp': '@senars/util/numeric',
  'clampSigned': '@senars/util/numeric',
  'occupancy': '@senars/util/numeric',
  'flooredRatio': '@senars/util/numeric',
  'perSecond': '@senars/util/numeric',
  'sumBy': '@senars/util/numeric',
  'softFalloff': '@senars/util/numeric',
  'decayCurve': '@senars/util/numeric',
  'finiteOr': '@senars/util/numeric',
  'lerp': '@senars/util/numeric',
  'nearlyEqual': '@senars/util/numeric',
  'normalizeToSum': '@senars/util/numeric',
  'pearson': '@senars/util/numeric',
  'renormalize': '@senars/util/numeric',
  'roundTo': '@senars/util/numeric',
  'safeDiv': '@senars/util/numeric',
  'saturationRamp': '@senars/util/numeric',
  'sigmoid': '@senars/util/numeric',
  'softmax': '@senars/util/numeric',
  'softSquash': '@senars/util/numeric',
  'stdDev': '@senars/util/numeric',
  'toFiniteNumber': '@senars/util/numeric',
  'ucb1': '@senars/util/numeric',
  'variance': '@senars/util/numeric',
  'mean': '@senars/util/numeric',
  'meanOf': '@senars/util/numeric',
  'retain': '@senars/util/numeric',
  'forget': '@senars/util/numeric',
  'anneal': '@senars/util/numeric',
  'estimateTokens': '@senars/util/numeric',
  'CHARS_PER_TOKEN': '@senars/util/numeric',
  'maxScore': '@senars/util/numeric',
  'minScore': '@senars/util/numeric',
  'pct': '@senars/util/numeric',

  // @senars/util/clock
  'Clock': '@senars/util/clock',
  'systemClock': '@senars/util/clock',
  'fixedClock': '@senars/util/clock',

  // @senars/util/collections
  'BoundedMap': '@senars/util/bounded-map',
  'BoundedRing': '@senars/util/collections',
  'keyedBy': '@senars/util/collections',
  'indexBy': '@senars/util/collections',
  'groupBy': '@senars/util/collections',
  'selectTopN': '@senars/util/collections',
  'rankBy': '@senars/util/collections',
  'sortBy': '@senars/util/collections',
  'unique': '@senars/util/collections',
  'uniqueBy': '@senars/util/collections',
  'getOrInsert': '@senars/util/collections',
  'collectUpTo': '@senars/util/collections',
  'takeFirst': '@senars/util/collections',
  'takeLast': '@senars/util/collections',
  'pushCapped': '@senars/util/collections',
  'perPart': '@senars/util/collections',
  'shareOf': '@senars/util/collections',
  'mapToRecord': '@senars/util/collections',
  'maxBy': '@senars/util/collections',
  'minBy': '@senars/util/collections',
  'incrementCount': '@senars/util/collections',
  'removeBy': '@senars/util/collections',
  'flatUnique': '@senars/util/collections',
  'chunk': '@senars/util/collections',
  'buckets': '@senars/util/collections',
  'edgeKey': '@senars/util/collections',
  'entryKey': '@senars/util/collections',
  'joinKey': '@senars/util/collections',
  'splitKey': '@senars/util/collections',
  'victimBy': '@senars/util/collections',
  'insertByScoreDesc': '@senars/util/collections',
  'lastByKey': '@senars/util/collections',
  'removeFromSet': '@senars/util/collections',
  'removeLastBy': '@senars/util/collections',
  'selectByPriority': '@senars/util/collections',
  'trimCapped': '@senars/util/collections',
  'addToSet': '@senars/util/collections',
  'accumulate': '@senars/util/collections',
  'containerStats': '@senars/util/collections',
  'BoundedContainer': '@senars/util/collections',
  'ContainerStats': '@senars/util/collections',
  'EvictByScore': '@senars/util/collections',
  'OverflowPolicy': '@senars/util/collections',
  'ReadOnlyLookup': '@senars/util/collections',
  'KEY_SEPARATOR': '@senars/util/collections',

  // @senars/util/lru-cache
  'LruCache': '@senars/util/lru-cache',
  'LruCacheOptions': '@senars/util/lru-cache',

  // @senars/util/random
  'ambientRng': '@senars/util/random',
  'SeededRNG': '@senars/util/random',
  'weightedSample': '@senars/util/random',
  'weightedPick': '@senars/util/random',
  'shuffleInPlace': '@senars/util/random',
  'randomSourceOf': '@senars/util/random',
  'mulberry32': '@senars/util/random',
  'nextInt': '@senars/util/random',
  'createLCG': '@senars/util/random',
  'rngFrom': '@senars/util/random',
  'choice': '@senars/util/random',
  'fillSeededUnitRange': '@senars/util/random',
  'holdoutSplit': '@senars/util/random',
  'seededStream': '@senars/util/random',
  'isStatefulRandomSource': '@senars/util/random',
  'StatefulRandomSource': '@senars/util/random',
  'SeededStream': '@senars/util/random',
  'Weighted': '@senars/util/random',
  'weightedSampleBy': '@senars/util/random',
  'RandomSource': '@senars/util/random',

  // @senars/util/logger
  'createLogger': '@senars/util/logger',
  'defaultLogger': '@senars/util/logger',
  'Logger': '@senars/util/logger',
  'silentLogger': '@senars/util/logger',
  'registerLogEnricher': '@senars/util/logger',

  // @senars/errors
  'errMsg': '@senars/errors',
  'degrade': '@senars/errors',
  'toError': '@senars/errors',
  'OperationError': '@senars/errors',
  'SenarsError': '@senars/errors',
  'ConfigurationError': '@senars/errors',
  'ConnectionError': '@senars/errors',
  'EngineError': '@senars/errors',
  'PolicyViolation': '@senars/errors',
  'ToolError': '@senars/errors',
  'TransportError': '@senars/errors',
  'ValidationError': '@senars/errors',
  'CircuitState': '@senars/errors',
  'CIRCUIT_STATES': '@senars/errors',

  // @senars/util/config
  'cachePath': '@senars/util/config',
  'envBool': '@senars/util/config',
  'envStr': '@senars/util/config',
  'envNum': '@senars/util/config',
  'envInt': '@senars/util/config',
  'envPositive': '@senars/util/config',
  'envCsv': '@senars/util/config',
  'envFirst': '@senars/util/config',
  'envSet': '@senars/util/config',
  'envStrOr': '@senars/util/config',
  'parseEnvValue': '@senars/util/config',
  'parseOrThrow': '@senars/util/config',
  'readEnvOverrides': '@senars/util/config',
  'SENARS_ENV_MAP': '@senars/util/config',
  'PRESSURE': '@senars/util/config',
  'isTruthy': '@senars/util/config',
  'ZodValidationError': '@senars/util/config',
  'agentOptionsSchema': '@senars/util/config',
  'contextOptsSchema': '@senars/util/config',
  'CACHE_DIR': '@senars/util/config',

  // @senars/util/truth-schema
  'asBeliefTruth': '@senars/util/truth-schema',
  'formatTruth': '@senars/util/truth-schema',
  'serializeTruth': '@senars/util/truth-schema',
  'parseTruthLiteral': '@senars/util/truth-schema',
  'formatNarseseTruth': '@senars/util/truth-schema',
  'parseNarseseTruth': '@senars/util/truth-schema',
  'stripTruthSuffix': '@senars/util/truth-schema',
  'toConfidence': '@senars/util/truth-schema',
  'toFrequency': '@senars/util/truth-schema',
  'toTermTruth': '@senars/util/truth-schema',
  'BeliefTruthSchema': '@senars/util/truth-schema',
  'TermTruthSchema': '@senars/util/truth-schema',

  // @senars/util/truth-algebra
  'confidenceToWeight': '@senars/util/truth-algebra',
  'weightToConfidence': '@senars/util/truth-algebra',
  'weakenConfidence': '@senars/util/truth-algebra',
  'WEIGHT_AT_CERTAINTY': '@senars/util/truth-algebra',

  // @senars/util/types/cognitive (for truth types)
  'BeliefTruth': '@senars/util/types/cognitive',
  'TermTruth': '@senars/util/types/cognitive',
  'Confidence': '@senars/util/types/cognitive',
  'Frequency': '@senars/util/types/cognitive',
  'TruthLike': '@senars/util/types/cognitive',

  // @senars/util/diagnostics
  'formatIssues': '@senars/util/diagnostics',
  'SchemaIssue': '@senars/util/diagnostics',

  // @senars/util/guards
  'ensureArray': '@senars/util/guards',
  'isNil': '@senars/util/guards',
  'isPlainObject': '@senars/util/guards',
  'compact': '@senars/util/guards',

  // @senars/util/hash
  'sha256Hex': '@senars/util/hash',
  'sha256HexParts': '@senars/util/hash',
  'djb2': '@senars/util/hash',
  'fnv1a': '@senars/util/hash',
  'mul32': '@senars/util/hash',
  'seededStringHash': '@senars/util/hash',
  'SHA256_PINNED': '@senars/util/hash',
  'shortSha256Hex': '@senars/util/hash',
  'sha256Prefixed': '@senars/util/hash',
  'fnv1aCombine': '@senars/util/hash',
  'djb2Step': '@senars/util/hash',
  'DigestInput': '@senars/util/hash',

  // @senars/util/json
  'stableStringify': '@senars/util/json',
  'stableKeyOf': '@senars/util/json',
  'parseJsonObject': '@senars/util/json',
  'extractJsonObject': '@senars/util/json',

  // @senars/util/keyed-collection
  'KeyedCollection': '@senars/util/keyed-collection',
  'KeyedRegistry': '@senars/util/keyed-collection',
  'KeyedRegistryOptions': '@senars/util/keyed-collection',

  // @senars/util/async
  'sleep': '@senars/util/async',
  'deadline': '@senars/util/async',
  'withDeadline': '@senars/util/async',
  'raceDeadline': '@senars/util/async',
  'withTimeout': '@senars/util/async',
  'boundedDeadline': '@senars/util/async',
  'boundedFetch': '@senars/util/async',
  'debounce': '@senars/util/async',
  'deferred': '@senars/util/async',
  'drain': '@senars/util/async',
  'monotonicNow': '@senars/util/async',
  'periodic': '@senars/util/async',
  'SerialLanes': '@senars/util/async',
  'SerialQueue': '@senars/util/async',
  'stopwatch': '@senars/util/async',
  'TimeoutError': '@senars/util/async',
  'TRUNCATION_MARKER': '@senars/util/async',
  'readBodyBounded': '@senars/util/async',
  'readBytesBounded': '@senars/util/async',
  'Deadline': '@senars/util/async',
  'Debounced': '@senars/util/async',
  'Deferred': '@senars/util/async',

  // @senars/util/bandit
  'QTable': '@senars/util/bandit',
  'greedy': '@senars/util/bandit',
  'ucb': '@senars/util/bandit',
  'visitConfidence': '@senars/util/bandit',
  'isYoung': '@senars/util/bandit',
  'meanUpdate': '@senars/util/bandit',
  'lerpUpdate': '@senars/util/bandit',
  'rampConfidence': '@senars/util/bandit',
  'UNVISITED': '@senars/util/bandit',
  'QEntry': '@senars/util/bandit',
  'QUpdate': '@senars/util/bandit',
  'ConfidenceCurve': '@senars/util/bandit',
  'Exploration': '@senars/util/bandit',

  // @senars/util/cli
  'parseFlags': '@senars/util/cli',
  'Flags': '@senars/util/cli',

  // @senars/util/format
  'formatDuration': '@senars/util/format',
  'bar': '@senars/util/format',
  'divider': '@senars/util/format',
  'formatBytes': '@senars/util/format',
  'percentile': '@senars/util/format',
  'percentiles': '@senars/util/format',
  'section': '@senars/util/format',
  'utcDate': '@senars/util/format',

  // @senars/util/fs
  'appendJsonl': '@senars/util/fs',
  'appendJsonlAsync': '@senars/util/fs',
  'appendJsonlRow': '@senars/util/fs',
  'appendJsonlRowAsync': '@senars/util/fs',
  'containsPath': '@senars/util/fs',
  'ensureDir': '@senars/util/fs',
  'ensureDirSync': '@senars/util/fs',
  'ensureParentDir': '@senars/util/fs',
  'ensureParentDirSync': '@senars/util/fs',
  'iterateJsonl': '@senars/util/fs',
  'jsonlPayload': '@senars/util/fs',
  'parseJsonOr': '@senars/util/fs',
  'readJsonFile': '@senars/util/fs',
  'readJsonFileSync': '@senars/util/fs',
  'readJsonl': '@senars/util/fs',
  'readJsonlAsync': '@senars/util/fs',
  'readJsonlWith': '@senars/util/fs',
  'writeJsonFile': '@senars/util/fs',
  'writeJsonFileSync': '@senars/util/fs',
  'writeJsonl': '@senars/util/fs',
  'JsonlLoadResult': '@senars/util/fs',

  // @senars/util/retry
  'withRetry': '@senars/util/retry',
  'RetryOptions': '@senars/util/retry',

  // @senars/util/shutdown
  'setupGracefulShutdown': '@senars/util/shutdown',

  // @senars/util/tally
  'CallTally': '@senars/util/tally',
  'CallTallySeriesOptions': '@senars/util/tally',
  'CallTallySeries': '@senars/util/tally',
  'createCallTally': '@senars/util/tally',
  'recordCall': '@senars/util/tally',

  // @senars/util/text
  'appendTextDelta': '@senars/util/text',
  'collectText': '@senars/util/text',
  'containsFolded': '@senars/util/text',
  'escapeRegExp': '@senars/util/text',
  'extractTerm': '@senars/util/text',
  'filterFolded': '@senars/util/text',
  'foldNeedle': '@senars/util/text',
  'isNarsese': '@senars/util/text',
  'limitList': '@senars/util/text',
  'overlapCount': '@senars/util/text',
  'splitLines': '@senars/util/text',
  'splitWords': '@senars/util/text',
  'TERM_SEPARATORS': '@senars/util/text',
  'tokenizeWords': '@senars/util/text',
  'truncate': '@senars/util/text',
  'truncateBytes': '@senars/util/text',
  'wordOverlap': '@senars/util/text',

  // @senars/util/alphabet
  'NARSESE_ATOM_CHARS': '@senars/util/alphabet',

  // @senars/util/unify
  'structuralEqual': '@senars/util/unify',
  'Unifier': '@senars/util/unify',
  'EqualityDialect': '@senars/util/unify',
  'Substitution': '@senars/util/unify',
  'UnifierDialect': '@senars/util/unify',
  'UnifyOptions': '@senars/util/unify',
  'VariablePolicy': '@senars/util/unify',

  // @senars/util/witness
  'formatWitness': '@senars/util/witness',
  'Witness': '@senars/util/witness',
  'WitnessList': '@senars/util/witness',
  'witnessFiles': '@senars/util/witness',
  'witnessHolds': '@senars/util/witness',

  // @senars/commands
  'CommandRegistry': '@senars/commands',
  'CommandContext': '@senars/commands',
  'CommandDefinition': '@senars/commands',
  'CommandHandler': '@senars/commands',
  'isQuitResult': '@senars/commands',
  'QUIT_SENTINEL': '@senars/commands',

  // @senars/events
  'EventBus': '@senars/events',
  'EventReceiver': '@senars/events',
  'EventUnsubscribe': '@senars/events',
  'ListenerBag': '@senars/events',
  'PushQueue': '@senars/events',
  'Signal': '@senars/events',

  // @senars/feedback
  'DefaultToolFeedbackObserver': '@senars/feedback',
  'SkillFeedback': '@senars/feedback',
  'ToolFeedback': '@senars/feedback',
  'ToolFeedbackObserver': '@senars/feedback',
  'toSkillFeedback': '@senars/feedback',

  // @senars/memory
  'SessionStoreOptions': '@senars/memory',
  'abortSession': '@senars/memory',
  'createSession': '@senars/memory',
  'InMemorySessionManager': '@senars/memory',
  'SessionStore': '@senars/memory',

  // @senars/util/middleware
  'Middleware': '@senars/util/middleware',
  'dispatch': '@senars/util/middleware',

  // @senars/types/agent
  'AgentOptions': '@senars/types/agent',
  'AuthDecision': '@senars/types/agent',
  'BridgeOptions': '@senars/types/agent',
  'HealthStatus': '@senars/types/agent',
  'ParsedCommand': '@senars/types/agent',
  'SkillDefinition': '@senars/types/agent',

  // @senars/util/health-status
  'HEALTH_STATUSES': '@senars/util/health-status',
  'HealthLevel': '@senars/util/health-status',

  // @senars/util/capability-risk
  'CAPABILITY_RISKS': '@senars/util/capability-risk',
  'CapabilityRiskSchema': '@senars/util/capability-risk',
  'CapabilityRisk': '@senars/util/capability-risk',

  // @senars/util/cognitive-schemas
  'BANDS': '@senars/util/cognitive-schemas',
  'BandDecisionSchema': '@senars/util/cognitive-schemas',
  'bandOrdinal': '@senars/util/cognitive-schemas',
  'COGNITIVE_AXES': '@senars/util/cognitive-schemas',
  'CognitiveAxisSchema': '@senars/util/cognitive-schemas',
  'egressVerdict': '@senars/util/cognitive-schemas',
  'JUDGMENT_SHAPES': '@senars/util/cognitive-schemas',
  'JudgmentShapeSchema': '@senars/util/cognitive-schemas',

  // @senars/util/origins
  'ENGINE_ORIGINS': '@senars/util/origins',
  'EngineOrigin': '@senars/util/origins',
  'PROPOSER_ORIGIN': '@senars/util/origins',
  'NAR_ORIGIN': '@senars/util/origins',

  // @senars/types/engine
  'Engine': '@senars/types/engine',
  'EngineId': '@senars/types/engine',
  'toolAttempt': '@senars/types/engine',
  'toolError': '@senars/types/engine',
  'toolOk': '@senars/types/engine',

  // @senars/types/episodic-memory
  'Episode': '@senars/types/episodic-memory',
  'EpisodeFilter': '@senars/types/episodic-memory',
  'EpisodeType': '@senars/types/episodic-memory',
  'EpisodicMemory': '@senars/types/episodic-memory',
  'EpisodicMemoryConfig': '@senars/types/episodic-memory',
  'EPISODE_TYPES': '@senars/types/episodic-memory',

  // @senars/types/health
  'HealthCheckResult': '@senars/types/health',
  'HealthReport': '@senars/types/health',

  // @senars/types/lifecycle
  'BaseComponent': '@senars/types/lifecycle',
  'ComponentContext': '@senars/types/lifecycle',
  'ComponentState': '@senars/types/lifecycle',
  'EventPublisher': '@senars/types/lifecycle',
  'LogEntry': '@senars/types/lifecycle',
  'LoggerConfig': '@senars/types/lifecycle',
  'LogLevel': '@senars/types/lifecycle',
  'ScopedLogger': '@senars/types/lifecycle',

  // @senars/types/llm
  'LMService': '@senars/types/llm',
  'LMTask': '@senars/types/llm',
  'LMTaskGenerator': '@senars/types/llm',
  'LMGenerateOptions': '@senars/types/llm',
  'LMPromptGenerator': '@senars/types/llm',
  'LMResponseProcessor': '@senars/types/llm',
  'LMRuleConfig': '@senars/types/llm',
  'MockLMConfig': '@senars/types/llm',
  'ModelRuleStats': '@senars/types/llm',
  'LMExecutionStats': '@senars/types/llm',
  'createLMStats': '@senars/types/llm',
  'recordLMCall': '@senars/types/llm',
  'LM_TASKS': '@senars/types/llm',

  // @senars/types/memory
  'ConversationSession': '@senars/types/memory',
  'HistoryEntry': '@senars/types/memory',
  'MessageRole': '@senars/types/memory',
  'SessionManager': '@senars/types/memory',
  'HistoryEntrySchema': '@senars/types/memory',
  'MESSAGE_ROLES': '@senars/types/memory',
  'MessageRoleSchema': '@senars/types/memory',

  // @senars/types/tools
  'ToolBudget': '@senars/types/tools',
  'ToolCall': '@senars/types/tools',
  'ToolCapabilities': '@senars/types/tools',
  'ToolContext': '@senars/types/tools',
  'ToolDescriptor': '@senars/types/tools',
  'ToolFn': '@senars/types/tools',
  'ToolResult': '@senars/types/tools',
  'ToolSchema': '@senars/types/tools',
  'ToolSchemaProperty': '@senars/types/tools',
  'ToolSpec': '@senars/types/tools',
  'objectSpec': '@senars/types/tools',

  // @senars/types/transport
  'Connection': '@senars/types/transport',
  'ConnectionConfig': '@senars/types/transport',
  'ConnectionDeps': '@senars/types/transport',
  'ConnectionFactory': '@senars/types/transport',
  'ConnectionState': '@senars/types/transport',
  'IOMessage': '@senars/types/transport',
  'MessageClassification': '@senars/types/transport',
  'TransportDeps': '@senars/types/transport',

  // @senars/bag
  'Bag': '@senars/bag',
  'BagItem': '@senars/bag',
  'BagOptions': '@senars/bag',
  'CyclesBudget': '@senars/bag',
  'EvictStrategy': '@senars/bag',
  'Histogram': '@senars/bag',
  'HistogramImpl': '@senars/bag',
  'InternalEntry': '@senars/bag',
  'PressureListener': '@senars/bag',
  'PressureLevel': '@senars/bag',
  'PressureTransition': '@senars/bag',
  'PriorityBag': '@senars/bag',

  // @senars/util/rate-limit
  'RateLimiterOptions': '@senars/util/rate-limit',
  'SlidingWindowRateLimiter': '@senars/util/rate-limit',

  // @senars/util/eval
  'ExpressionError': '@senars/util/eval',
  'evaluateExpression': '@senars/util/eval',

  // @senars/util/disposal
  'Teardown': '@senars/util/disposal',
  'DisposalRegistry': '@senars/util/disposal',

  // @senars/util/error
  // errMsg, toError, degrade already mapped to @senars/errors

  // @senars/util/ledger
  'BaseLedgerEntrySchema': '@senars/util/ledger',
  'BaseLedgerEntry': '@senars/util/ledger',
  'RolloverPolicy': '@senars/util/ledger',
  'DEFAULT_ROLLOVER': '@senars/util/ledger',
  'LedgerQuery': '@senars/util/ledger',
  'LedgerConfig': '@senars/util/ledger',
  'CreateLedgerOptions': '@senars/util/ledger',
  'LedgerInput': '@senars/util/ledger',
  'DEFAULT_MIRROR_SIZE': '@senars/util/ledger',
  'Ledger': '@senars/util/ledger',
  'createLedger': '@senars/util/ledger',

  // @senars/util/object
  'deepEqual': '@senars/util/object',
  'deepFreeze': '@senars/util/object',
  'deepMerge': '@senars/util/object',
  'getNested': '@senars/util/object',
  'setNested': '@senars/util/object',
  'thaw': '@senars/util/object',

  // @senars/util/stats
  'weightedMean': '@senars/util/stats',

  // @senars/util/prompt
  'extractLastUserMessage': '@senars/util/prompt',
};

// Reverse mapping: alias -> Set of import names
const aliasToImports: Record<string, Set<string>> = {};
for (const [importName, alias] of Object.entries(importToAlias)) {
  if (!aliasToImports[alias]) aliasToImports[alias] = new Set();
  aliasToImports[alias].add(importName);
}

// Special handling for types (type imports)
const typeOnlyImports = new Set([
  'Clock', 'BoundedMap', 'BoundedRing', 'BoundedContainer', 'ContainerStats',
  'EvictByScore', 'OverflowPolicy', 'ReadOnlyLookup', 'KeyedRegistryOptions',
  'LruCacheOptions', 'Flags', 'SchemaIssue', 'DigestInput', 'JsonlLoadResult',
  'RetryOptions', 'RateLimiterOptions', 'IdSource', 'Deadline', 'Debounced', 'Deferred',
  'QEntry', 'QUpdate', 'ConfidenceCurve', 'Exploration', 'SeededStream', 'StatefulRandomSource', 'Weighted',
  'RandomSource', 'Middleware', 'Teardown', 'Engine', 'EngineId', 'Episode', 'EpisodeFilter',
  'EpisodeType', 'EpisodicMemory', 'EpisodicMemoryConfig', 'HealthCheckResult', 'HealthReport',
  'BaseComponent', 'ComponentContext', 'ComponentState', 'EventPublisher', 'LogEntry', 'LoggerConfig',
  'LogLevel', 'ScopedLogger', 'LMService', 'LMTask', 'LMTaskGenerator', 'LMGenerateOptions',
  'LMPromptGenerator', 'LMResponseProcessor', 'LMRuleConfig', 'MockLMConfig', 'ModelRuleStats',
  'LMExecutionStats', 'ConversationSession', 'HistoryEntry', 'MessageRole', 'SessionManager',
  'ToolBudget', 'ToolCall', 'ToolCapabilities', 'ToolContext', 'ToolDescriptor', 'ToolFn',
  'ToolResult', 'ToolSchema', 'ToolSchemaProperty', 'ToolSpec', 'Connection', 'ConnectionConfig',
  'ConnectionDeps', 'ConnectionFactory', 'ConnectionState', 'IOMessage', 'MessageClassification',
  'TransportDeps', 'Bag', 'BagItem', 'BagOptions', 'CyclesBudget', 'EvictStrategy', 'Histogram',
  'HistogramImpl', 'InternalEntry', 'PressureListener', 'PressureLevel', 'PressureTransition',
  'PriorityBag', 'AgentOptions', 'AuthDecision', 'BridgeOptions', 'HealthStatus', 'ParsedCommand',
  'SkillDefinition', 'CapabilityRisk', 'EngineOrigin', 'UnifyOptions', 'VariablePolicy',
  'UnifierDialect', 'EqualityDialect', 'UnifierSubstitution', 'Witness', 'WitnessList',
  'CommandContext', 'CommandDefinition', 'CommandHandler', 'EventReceiver', 'EventUnsubscribe',
  'SkillFeedback', 'ToolFeedback', 'ToolFeedbackObserver', 'SessionStoreOptions',
  'BeliefTruth', 'TermTruth', 'Confidence', 'Frequency', 'TruthLike',
  'CircuitState', 'CIRCUIT_STATES', 'OperationError', 'SenarsError', 'ConfigurationError',
  'ConnectionError', 'EngineError', 'PolicyViolation', 'ToolError', 'TransportError', 'ValidationError',
  'KeyedRegistryOptions', 'BoundedMapOptions', 'EvictionOrder',
  'TraceGrader', 'GroundednessGate', 'EgressVerdict', 'ChatOptions', 'ToolCall',
  'EventUnsubscribe', 'ParsedCommand', 'HealthCheckResult', 'HealthReport', 'Witness',
  'IdSource', 'indexMap', 'mapValues', 'assertDefined', 'Logger', 'Weighted', 'RandomSource',
  'Episode', 'ReadOnlyLookup', 'BeliefTruth', 'CommandDefinition', 'Flags', 'EpisodicMemory',
  'LMTask', 'TermTruth', 'TruthLike', 'CapabilityRisk',
]);

// Additional imports found during first pass
const additionalImports: Record<string, string> = {
  'EpisodicMemory': '@senars/types/episodic-memory',
  'EventUnsubscribe': '@senars/events',
  'LMTask': '@senars/types/llm',
  'TraceGrader': '@senars/types/cognitive',
  'CapabilityRisk': '@senars/util/capability-risk',
  'ChatOptions': '@senars/types/cognitive',
  'TermTruth': '@senars/util/types/cognitive',
  'EgressVerdict': '@senars/util/cognitive-schemas',
  'GroundednessGate': '@senars/types/cognitive',
  'Middleware': '@senars/util/middleware',
  'ParsedCommand': '@senars/types/agent',
  'Flags': '@senars/util/cli',
  'mapValues': '@senars/util/collections',
  'CommandDefinition': '@senars/commands',
  'Episode': '@senars/types/episodic-memory',
  'ReadOnlyLookup': '@senars/util/collections',
  'BeliefTruth': '@senars/util/types/cognitive',
  'RandomSource': '@senars/util/random',
  'Weighted': '@senars/util/random',
  'HealthCheckResult': '@senars/types/health',
  'HealthReport': '@senars/types/health',
  'Witness': '@senars/util/witness',
  'TruthLike': '@senars/util/types/cognitive',
  'IdSource': '@senars/util/id',
  'indexMap': '@senars/util/collections',
  // Additional from re-exports
  'SeededRNG': '@senars/util/random',
  'sequentialIdSource': '@senars/util/id',
  'fixedClock': '@senars/util/clock',
  'edgeKey': '@senars/util/collections',
  'estimateTokens': '@senars/util/numeric',
  'extractTerm': '@senars/util/text',
  'generateId': '@senars/util/id',
  'clamp': '@senars/util/numeric',
  'unique': '@senars/util/collections',
  'truncate': '@senars/util/text',
  'debounce': '@senars/util/async',
  'EventBus': '@senars/events',
  'asBeliefTruth': '@senars/util/truth-schema',
  'envBool': '@senars/util/config',
  'envPositive': '@senars/util/config',
  'makeId': '@senars/util/id',
  'deepMerge': '@senars/util/object',
  'toError': '@senars/errors',
  'HistoryEntry': '@senars/types/memory',
  'EpisodicMemoryConfig': '@senars/types/episodic-memory',
  'EPISODE_TYPES': '@senars/types/episodic-memory',
  'EpisodeFilter': '@senars/types/episodic-memory',
  'EpisodeType': '@senars/types/episodic-memory',
  'QEntry': '@senars/util/bandit',
  'LMExecutionStats': '@senars/types/llm',
  'ConversationSession': '@senars/types/memory',
  'SessionManager': '@senars/types/memory',
  'Teardown': '@senars/util/disposal',
  'SlidingWindowRateLimiter': '@senars/util/rate-limit',
  'keyedBy': '@senars/util/collections',
  'LM_TASKS': '@senars/types/llm',
  'BoundedMap': '@senars/util/bounded-map',
  'mean': '@senars/util/numeric',
  'selectTopN': '@senars/util/collections',
  'entryKey': '@senars/util/collections',
  'sumBy': '@senars/util/numeric',
  'filterFolded': '@senars/util/text',
  // Missing from metta and io
  'CognitiveStimulus': '@senars/types/cognitive',
  'Context': '@senars/types/cognitive',
  'Derivation': '@senars/types/cognitive',
  'parseJsonOr': '@senars/util/fs',
  'readBytesBounded': '@senars/util/async',
  // Re-exports from io/types.ts
};

// Merge additional imports into main mapping
for (const [name, alias] of Object.entries(additionalImports)) {
  importToAlias[name] = alias;
}

// Additional metta/core mappings
const mettaCoreImports: Record<string, string> = {};
for (const [name, alias] of Object.entries(mettaCoreImports)) {
  importToAlias[name] = alias;
}

function isTypeImport(name: string): boolean {
  return typeOnlyImports.has(name);
}

function processFile(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find all imports from @senars/util
  const utilImportRegex = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]@senars\/util['"];?/g;
  // Find all re-exports from @senars/util
  const utilExportRegex = /export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]@senars\/util['"];?/g;
  const importsToReplace: Array<{match: string; start: number; end: number; imports: string[]; isExport: boolean; isType: boolean}> = [];
  
  let match: RegExpExecArray | null = utilImportRegex.exec(content);
  while (match !== null) {
    const importList = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    importsToReplace.push({
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
      imports: importList,
      isExport: false,
      isType: match[0].includes('import type')
    });
    match = utilImportRegex.exec(content);
  }
  
  match = utilExportRegex.exec(content);
  while (match !== null) {
    const exportList = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    const isTypeExport = match[0].includes('export type');
    importsToReplace.push({
      match: match[0],
      start: match.index,
      end: match.index + match[0].length,
      imports: exportList,
      isExport: true,
      isType: isTypeExport
    });
    match = utilExportRegex.exec(content);
  }
  
  if (importsToReplace.length === 0) return false;
  
  let newContent = content;
  let offset = 0;
  
  for (const imp of importsToReplace) {
    // Group imports by alias
    const aliasGroups: Record<string, {values: string[], isType: boolean[]}> = {};
    
    for (const importName of imp.imports) {
      const alias = importToAlias[importName];
      if (!alias) {
        console.warn(`  Unknown import: ${importName} in ${filePath}`);
        continue;
      }
      if (!aliasGroups[alias]) aliasGroups[alias] = {values: [], isType: []};
      aliasGroups[alias].values.push(importName);
      aliasGroups[alias].isType.push(isTypeImport(importName));
    }
    
    // Build replacement imports/exports
    const newStatements: string[] = [];
    for (const [alias, group] of Object.entries(aliasGroups)) {
      const hasType = group.isType.some(t => t);
      const typeKeyword = (imp.isType || hasType) ? 'type ' : '';
      if (imp.isExport) {
        newStatements.push(`export ${typeKeyword}{ ${group.values.join(', ')} } from '${alias}';`);
      } else {
        newStatements.push(`import ${typeKeyword}{ ${group.values.join(', ')} } from '${alias}';`);
      }
    }
    
    const replacement = newStatements.join('\n');
    const start = imp.start + offset;
    const end = imp.end + offset;
    newContent = newContent.slice(0, start) + replacement + newContent.slice(end);
    offset += replacement.length - (imp.end - imp.start);
  }
  
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent);
    return true;
  }
  return false;
}

// Find all TypeScript files
function findTsFiles(dir: string, excludeDirs: string[] = []): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
        files.push(...findTsFiles(fullPath, excludeDirs));
      }
    } else if ((entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const excludeDirs = ['node_modules', 'dist', '.git', 'nar', 'util'];
const allFiles = [
  ...findTsFiles('/home/me/senars12/src', excludeDirs),
  ...findTsFiles('/home/me/senars12/scripts', excludeDirs),
  ...findTsFiles('/home/me/senars12/tests', excludeDirs),
  ...findTsFiles('/home/me/senars12/benchmarks', excludeDirs),
  ...findTsFiles('/home/me/senars12/examples', excludeDirs),
];

console.log(`Scanning ${allFiles.length} files...`);

let modified = 0;
for (const file of allFiles) {
  try {
    if (processFile(file)) {
      modified++;
      console.log(`Modified: ${file.replace('/home/me/senars12/', '')}`);
    }
  } catch (e) {
    console.error(`Error processing ${file}:`, e);
  }
}

console.log(`\nDone! Modified ${modified} files.`);