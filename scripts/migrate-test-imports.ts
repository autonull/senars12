#!/usr/bin/env tsx
/**
 * Migration script to update test imports from legacy @senars/* packages
 * to new src/ path aliases.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const TEST_DIR = '/home/me/senars12/tests';

// Mapping from legacy import paths to new import paths
const IMPORT_MAP: Record<string, string> = {
  // @senars/nar -> @senars/agent, @senars/terms, @senars/lm, etc.
  "@senars/nar": "@senars/agent",
  "@senars/nar/agent": "@senars/agent",
  "@senars/nar/bag": "@senars/agent", // Bag not in new barrels yet
  "@senars/nar/capability": "@senars/agent",
  "@senars/nar/cognitive": "@senars/agent",
  "@senars/nar/config": "@senars/agent",
  "@senars/nar/config/cognitive-parameters": "@senars/reflex", // CognitiveParameters in reflex
  "@senars/nar/constants": "@senars/agent",
  "@senars/nar/decision": "@senars/agent",
  "@senars/nar/dialogue": "@senars/dialogue",
  "@senars/nar/engine/NAREngine": "@senars/agent", // NAREngine not exported yet
  "@senars/nar/eval/brier-harness": "@senars/agent",
  "@senars/nar/eval/session-state": "@senars/agent",
  "@senars/nar/events/bridge": "@senars/agent",
  "@senars/nar/facade/config.js": "@senars/agent",
  "@senars/nar/focus": "@senars/focus",
  "@senars/nar/game": "@senars/focus",
  "@senars/nar/health": "@senars/health",
  "@senars/nar/index.js": "@senars/agent",
  "@senars/nar/kernel": "@senars/kernel",
  "@senars/nar/learning": "@senars/lm",
  "@senars/nar/lm": "@senars/lm",
  "@senars/nar/lm/system-one": "@senars/lm",
  "@senars/nar/memory": "@senars/memory",
  "@senars/nar/meta": "@senars/agent",
  "@senars/nar/metrics": "@senars/metrics",
  "@senars/nar/nar.js": "@senars/agent",
  "@senars/nar/nl": "@senars/nl",
  "@senars/nar/otel": "@senars/otel",
  "@senars/nar/proposal/cycle-trace.js": "@senars/agent",
  "@senars/nar/query/api.js": "@senars/query",
  "@senars/nar/query/memory-query.js": "@senars/query",
  "@senars/nar/reason/strategy-algebra.js": "@senars/agent",
  "@senars/nar/reflex": "@senars/reflex",
  "@senars/nar/resources/index.js": "@senars/agent",
  "@senars/nar/rlfp": "@senars/reflex",
  "@senars/nar/rules": "@senars/rules",
  "@senars/nar/self": "@senars/self",
  "@senars/nar/strategies/registration": "@senars/agent",
  "@senars/nar/strategies/registration.js": "@senars/agent",
  "@senars/nar/stream": "@senars/agent",
  "@senars/nar/terms": "@senars/terms",
  "@senars/nar/terms/index.js": "@senars/terms",
  "@senars/nar/tools": "@senars/self",
  "@senars/nar/trace": "@senars/agent",
  "@senars/nar/types": "@senars/agent",
  "@senars/nar/types/events.js": "@senars/agent",
  "@senars/nar/types/index.js": "@senars/agent",
  "@senars/nar/types/core.js": "@senars/agent",

  // @senars/core -> various new barrels
  "@senars/core": "@senars/agent", // Agent class not in new barrels, but createAgent is
  "@senars/core/agent/phases": "@senars/budget",
  "@senars/core/bridge/chat-stream-handler": "@senars/agent",
  "@senars/core/budget": "@senars/budget",
  "@senars/core/eventlog": "@senars/agent", // LogStoreEventLog not in new barrels
  "@senars/core/event-sink": "@senars/agent",
  "@senars/core/lens-schema": "@senars/agent",
  "@senars/core/memory": "@senars/memory",
  "@senars/core/motor": "@senars/agent",
  "@senars/core/PolicyEngine.js": "@senars/agent",
  "@senars/core/protocol": "@senars/agent",
  "@senars/core/schemas": "@senars/agent",
  "@senars/core/schemas/cognitive-events": "@senars/agent",
  "@senars/core/schemas/derivation-records": "@senars/agent",
  "@senars/core/schemas/governance": "@senars/agent",
  "@senars/core/schemas/reasoning-budget": "@senars/agent",
  "@senars/core/schemas/truth": "@senars/agent",
  "@senars/core/verify-derivation": "@senars/agent",
  "@senars/core/metta-port": "@senars/metta-runtime",

  // @senars/util -> @senars/utils
  "@senars/util": "@senars/utils",
  "@senars/util/commands": "@senars/utils",
  "@senars/util/config": "@senars/utils",
  "@senars/util/errors": "@senars/utils",
  "@senars/util/events": "@senars/utils",
  "@senars/util/ledger": "@senars/utils",
  "@senars/util/memory": "@senars/utils",
  "@senars/util/types/memory": "@senars/utils",
  "@senars/util/types/transport": "@senars/utils",
  "@senars/util/utils/assert": "@senars/utils",
  "@senars/util/utils/eval": "@senars/utils",

  // @senars/io -> @senars/transport
  "@senars/io": "@senars/transport",
  "@senars/io/connections/cli": "@senars/transport",
  "@senars/io/connections/ws": "@senars/transport",
  "@senars/io/connections/reply-target": "@senars/transport",

  // @senars/metta -> @senars/metta-runtime
  "@senars/metta": "@senars/metta-runtime",
  "@senars/metta/agent": "@senars/metta-runtime",
  "@senars/metta/engine/MettaEngine": "@senars/metta-runtime",

  // @senars/kernel -> @senars/kernel (new)
  "@senars/kernel": "@senars/kernel",
  "@senars/kernel/bag": "@senars/kernel",
  "@senars/kernel/gate": "@senars/kernel",
  "@senars/kernel/stamp": "@senars/kernel",
  "@senars/kernel/step": "@senars/kernel",
  "@senars/kernel/terms/canonical": "@senars/kernel",
  "@senars/kernel/terms/intern": "@senars/kernel",
  "@senars/kernel/truth": "@senars/kernel",

  // @senars/lm -> @senars/lm (new)
  "@senars/lm": "@senars/lm",

  // @senars/utils/config -> @senars/utils (already covered)
  "@senars/utils/config": "@senars/utils",

  // @senars/ui/* -> keep as is (ui package not being consolidated yet)
};

// Specific named import mappings (for cases where the export name differs)
const NAMED_IMPORT_MAP: Record<string, Record<string, string>> = {
  // @senars/nar -> @senars/agent
  "@senars/nar": {
    "NAR": "NAR",
    "createTestNAR": "createTestNAR",
    "createNAR": "createNAR",
    "createBotNAR": "createBotNAR",
    "createMinimalNAR": "createMinimalNAR",
    "DEFAULT_CONFIG": "DEFAULT_CONFIG",
    "NARConfig": "NARConfig",
    "createLMService": "createLMService",
    "createSeNARSRegistry": "createSeNARSRegistry",
    "NAREventMap": "NAREventMap",
    "coreCommands": "coreCommands",
    "episodesCommands": "episodesCommands",
    "lmCommands": "lmCommands",
    "memoryCommands": "memoryCommands",
    "narCommands": "narCommands",
    "rlfpCommands": "rlfpCommands",
    "selfCommands": "selfCommands",
    "CognitiveTreadmill": "CognitiveTreadmill",
    "ScenarioGenerator": "ScenarioGenerator",
    "ArchitectureDriver": "ArchitectureDriver",
    "DEFAULT_NAR_STATE_PATH": "DEFAULT_NAR_STATE_PATH",
    "readPersistedBoundary": "readPersistedBoundary",
  },
  // @senars/nar/terms -> @senars/terms
  "@senars/nar/terms": {
    "Truth": "Truth",
    "operationNameOf": "operationNameOf",
    "PUNCTUATION_BY_TASK_TYPE": "PUNCTUATION_BY_TASK_TYPE",
    "taskTypeForPunctuation": "taskTypeForPunctuation",
  },
  "@senars/nar/terms/index.js": {
    "Truth": "Truth",
    "operationNameOf": "operationNameOf",
  },
  // @senars/nar/lm -> @senars/lm
  "@senars/nar/lm": {
    "createLMService": "createLMService",
    "createSeNARSRegistry": "createSeNARSRegistry",
    "loadGrammar": "loadGrammar",
    "createLlamaCppFetch": "createLlamaCppFetch",
    "runWithGrammar": "runWithGrammar",
  },
  // @senars/core -> @senars/agent (for createAgent) or @senars/memory (for JsonlSessionManager)
  "@senars/core": {
    "createAgent": "createAgent", // from @senars/agent
    "Agent": "Agent", // type from @senars/agent (BinAgentApi as Agent)
    "InMemoryEventLog": "InMemoryEventLog", // NOT in new barrels
    "LogStoreEventLog": "LogStoreEventLog", // NOT in new barrels
    "JsonlSessionManager": "JsonlSessionManager", // from @senars/memory
    "InMemorySessionManager": "InMemorySessionManager", // from @senars/memory
    "MemoryService": "MemoryService", // NOT in new barrels
    "EventLog": "EventLog", // NOT in new barrels
    "BaseEngine": "BaseEngine", // NOT in new barrels
    "Engine": "Engine", // NOT in new barrels
    "CognitiveEvent": "CognitiveEvent", // NOT in new barrels
    "IncomingFromServer": "IncomingFromServer", // NOT in new barrels
    "GraphNodeData": "GraphNodeData", // NOT in new barrels
  },
  // @senars/core/memory -> @senars/memory
  "@senars/core/memory": {
    "JsonlSessionManager": "JsonlSessionManager",
    "InMemorySessionManager": "InMemorySessionManager",
  },
  // @senars/util -> @senars/utils
  "@senars/util": {
    "silentLogger": "silentLogger",
    "createLogger": "createLogger",
    "generateId": "generateId",
    "makeId": "makeId",
    "errMsg": "errMsg",
    "clamp": "clamp",
    "clamp01": "clamp01",
    "compact": "compact",
    "estimateTokens": "estimateTokens",
    "extractTerm": "extractTerm",
    "isNarsese": "isNarsese",
    "isNil": "isNil",
    "Logger": "Logger",
    "registerLogEnricher": "registerLogEnricher",
    "sleep": "sleep",
    "toError": "toError",
    "SeededRNG": "SeededRNG",
    "fixedClock": "fixedClock",
    "sequentialIdSource": "sequentialIdSource",
    "systemClock": "systemClock",
    "installIdSource": "installIdSource",
    "withinWorkspace": "withinWorkspace", // NOT in @senars/utils, but in @senars/agent
    "fnv1aCombine": "fnv1aCombine",
    "positiveInt": "positiveInt",
    "ConfigurationError": "ConfigurationError",
    "deepMerge": "deepMerge",
  },
  // @senars/utils -> @senars/utils (same)
  "@senars/utils": {
    "silentLogger": "silentLogger",
    "createLogger": "createLogger",
    "generateId": "generateId",
    "makeId": "makeId",
    "errMsg": "errMsg",
    "clamp": "clamp",
    "clamp01": "clamp01",
    "compact": "compact",
    "estimateTokens": "estimateTokens",
    "extractTerm": "extractTerm",
    "isNarsese": "isNarsese",
    "isNil": "isNil",
    "Logger": "Logger",
    "registerLogEnricher": "registerLogEnricher",
    "sleep": "sleep",
    "toError": "toError",
    "SeededRNG": "SeededRNG",
    "fixedClock": "fixedClock",
    "sequentialIdSource": "sequentialIdSource",
    "systemClock": "systemClock",
    "installIdSource": "installIdSource",
    "fnv1aCombine": "fnv1aCombine",
    "positiveInt": "positiveInt",
    "ConfigurationError": "ConfigurationError",
    "deepMerge": "deepMerge",
    "parseFlags": "parseFlags",
  },
  // @senars/io -> @senars/transport
  "@senars/io": {
    "HTTPConnection": "HTTPConnection",
    "CLIConnection": "CLIConnection",
    "WSConnection": "WSConnection",
    "MCPConnection": "MCPConnection",
    "IRCConnection": "IRCConnection",
    "BaseConnection": "BaseConnection",
    "ConnectionManager": "ConnectionManager",
    "CommandRegistry": "CommandRegistry",
    "bindAgentToConnection": "bindAgentToConnection",
    "createWSClient": "createWSClient",
    "cleanupWSClient": "cleanupWSClient",
    "startHttpServer": "startHttpServer",
    "startWSServer": "startWSServer",
    "sendWSMessage": "sendWSMessage",
    "sendHeartbeat": "sendHeartbeat",
    "broadcastToSubscribers": "broadcastToSubscribers",
    "subscribeToEvents": "subscribeToEvents",
    "unsubscribeFromEvents": "unsubscribeFromEvents",
    "parseHttpBody": "parseHttpBody",
    "resolveReplyTarget": "resolveReplyTarget",
    "setCORSHeaders": "setCORSHeaders",
    "AuthManager": "AuthManager",
    "ConnectionError": "ConnectionError",
    "MessageRouter": "MessageRouter",
    "QUIT_SENTINEL": "QUIT_SENTINEL",
  },
  "@senars/io/connections/cli": {
    "CLIConnection": "CLIConnection",
    "IRCConnection": "IRCConnection",
    "QUIT_SENTINEL": "QUIT_SENTINEL",
  },
  "@senars/io/connections/ws": {
    "WSConnection": "WSConnection",
  },
  "@senars/metta": {
    "createMeTTa": "createMeTTa",
    "parseMeTTa": "parseMeTTa",
    "MeTTaReason": "MeTTaReason",
  },
  "@senars/metta/agent": {
    "createMettaPort": "createMettaPort",
  },
  "@senars/kernel": {
    "ThreadScope": "ThreadScope",
    "Truth": "Truth",
    "Stamp": "Stamp",
    "createRootStamp": "createRootStamp",
    "createDerivedStamp": "createDerivedStamp",
  },
  "@senars/nar/bag": {
    "PriorityBag": "PriorityBag",
    "Bag": "Bag",
  },
  "@senars/nar/bag/Bag.js": {
    "PriorityBag": "PriorityBag",
    "Bag": "Bag",
  },
  "@senars/nar/config/cognitive-parameters": {
    "DEFAULT_COGNITIVE_PARAMETERS": "DEFAULT_COGNITIVE_PARAMETERS",
    "CognitiveParameters": "CognitiveParameters",
  },
  "@senars/nar/focus": {
    "Focus": "Focus",
    "FocusBag": "FocusBag",
    "createFocus": "createFocus",
    "FocusTree": "FocusTree",
    "GameFocus": "GameFocus",
    "createGameFocus": "createGameFocus",
    "MetaFocus": "MetaFocus",
    "createMetaFocus": "createMetaFocus",
    "SchemaStore": "SchemaStore",
    "FocusScheduler": "FocusScheduler",
    "FocusConcept": "FocusConcept",
    "Reflex": "Reflex",
  },
  "@senars/nar/health": {
    "runHealthChecks": "runHealthChecks",
    "DEFAULT_NAR_STATE_PATH": "DEFAULT_NAR_STATE_PATH",
    "readPersistedBoundary": "readPersistedBoundary",
    "createBotNAR": "createBotNAR",
  },
  "@senars/nar/metrics": {
    "createReasoningRoute": "createReasoningRoute",
    "handleMetricsRequest": "handleMetricsRequest",
    "ReasoningHttpEngine": "ReasoningHttpEngine",
  },
  "@senars/nar/reflex": {
    "MettaProposer": "MettaProposer",
    "RLFPLearner": "RLFPLearner",
    "createKnobSet": "createKnobSet",
    "TaskRewardMetrics": "TaskRewardMetrics",
  },
  "@senars/nar/rules": {
    "initializeMetaReasoning": "initializeMetaReasoning",
    "registerMetaRules": "registerMetaRules",
  },
  "@senars/nar/self": {
    "ArchitectureDriver": "ArchitectureDriver",
    "initializeSelfConcept": "initializeSelfConcept",
  },
  "@senars/nar/tools": {
    "initializeSelfConcept": "initializeSelfConcept",
    "operationNameOf": "operationNameOf",
    "ToolManager": "ToolManager",
  },
  "@senars/nar/agent": {
    "createAgent": "createAgent",
    "createTestNAR": "createTestNAR",
  },
  "@senars/nar/engine/NAREngine": {
    "NAREngine": "NAREngine", // Not exported from new barrels
  },
  "@senars/nar/agent/builder": {
    "NARBuilder": "NARBuilder",
  },
  "@senars/nar/commands": {
    "coreCommands": "coreCommands",
    "episodesCommands": "episodesCommands",
    "lmCommands": "lmCommands",
    "memoryCommands": "memoryCommands",
    "narCommands": "narCommands",
    "rlfpCommands": "rlfpCommands",
    "selfCommands": "selfCommands",
  },
  "@senars/nar/lm/system-one": {
    "createSystemOneBudget": "createSystemOneBudget",
    "JudgmentQuery": "JudgmentQuery",
  },
  "@senars/nar/lm/system-one/types": {
    "createSystemOneBudget": "createSystemOneBudget",
    "JudgmentQuery": "JudgmentQuery",
  },
  "@senars/nar/lm/system-one/decide.js": {
    "DecideResult": "DecideResult",
  },
  "@senars/nar/lm/system-one/resource-gate.js": {
    "JudgmentBudgetVerdict": "JudgmentBudgetVerdict",
  },
  "@senars/nar/nl/firewall.js": {
    "FirewallVerdict": "FirewallVerdict",
  },
  "@senars/nar/cognitive/impls/CognitiveRegistry.js": {
    "CognitiveRegistry": "CognitiveRegistry",
  },
  "@senars/nar/imagination": {
    "ScenarioProfile": "ScenarioProfile",
    "CognitiveTreadmill": "CognitiveTreadmill",
    "ScenarioGenerator": "ScenarioGenerator",
  },
  "@senars/nar/types/events.js": {
    "NAREventMap": "NAREventMap",
    "NarEventBus": "NarEventBus",
  },
  "@senars/nar/types/core.js": {
    "Task": "Task",
    "StrategyRegistry": "StrategyRegistry",
  },
  "@senars/nar/nl": {
    "NLUnderstandingService": "NLUnderstandingService",
    "TranslationCache": "TranslationCache",
  },
  "@senars/nar/query": {
    "MemoryQuery": "MemoryQuery",
    "episodeQualitySurface": "episodeQualitySurface",
  },
  "@senars/nar/dialogue": {
    "DialogueCapture": "DialogueCapture",
    "RetrospectiveAdapter": "RetrospectiveAdapter",
    "retrospect": "retrospect",
    "persistRetrospective": "persistRetrospective",
    "loadRetrospectives": "loadRetrospectives",
    "extractLessons": "extractLessons",
    "Reconsolidator": "Reconsolidator",
    "selectProbes": "selectProbes",
    "mineHardNegatives": "mineHardNegatives",
  },
  "@senars/config/nar": {
    "DEFAULT_BOT_CONFIG": "DEFAULT_BOT_CONFIG",
    "DEFAULT_PROFILE": "DEFAULT_PROFILE",
  },
  "@senars/nar/kernel": {
    "DEFAULT_REPUTATION_PATH": "DEFAULT_REPUTATION_PATH",
    "providerKey": "providerKey",
    "SourceReputation": "SourceReputation",
    "threadScope": "threadScope",
  },
  "@senars/nar/kernel/index.js": {
    "DEFAULT_REPUTATION_PATH": "DEFAULT_REPUTATION_PATH",
    "providerKey": "providerKey",
    "SourceReputation": "SourceReputation",
    "threadScope": "threadScope",
  },
  "@senars/nar/otel": {
    "initOtel": "initOtel",
    "shutdownOtel": "shutdownOtel",
    "withSpan": "withSpan",
  },
};

// Function to get all test files
function getTestFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getTestFiles(fullPath));
    } else if (extname(entry) === '.ts') {
      files.push(fullPath);
    }
  }
  return files;
}

// Function to migrate a single file
function migrateFile(filePath: string): boolean {
  let content = readFileSync(filePath, 'utf-8');
  let changed = false;

  // Replace import paths
  for (const [legacyPath, newPath] of Object.entries(IMPORT_MAP)) {
    const legacyEscaped = legacyPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`from\\s+['"]${legacyEscaped}['"]`, 'g');
    if (regex.test(content)) {
      content = content.replace(regex, `from '${newPath}'`);
      changed = true;
    }
  }

  // For named imports, we need more careful handling
  // This is a simplified approach - in practice we'd need a proper TS parser
  // For now, just do the path replacements

  if (changed) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`Migrated: ${filePath}`);
  }

  return changed;
}

// Main
const testFiles = getTestFiles(TEST_DIR);
console.log(`Found ${testFiles.length} test files`);

let migratedCount = 0;
for (const file of testFiles) {
  if (migrateFile(file)) {
    migratedCount++;
  }
}

console.log(`Migrated ${migratedCount} files`);