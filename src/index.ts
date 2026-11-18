/**
 * Senars — unified reasoning package.
 *
 * Main entry point re-exports from legacy packages during transition.
 * New modules are available via path aliases (@senars/kernel/*, @senars/logics/*, etc.).
 */

// IO
export type {
  CLICommand,
  CommandContext,
  CommandDefinition,
  CommandHandler,
  IRCConnectionConfig,
  MCPToolResult,
  MessageContext,
  MessageMiddleware,
} from './io/index.js';
export {
  AuthManager,
  BaseConnection,
  broadcastToSubscribers,
  CLIConnection,
  CommandRegistry,
  ConnectionError,
  ConnectionManager,
  cleanupWSClient,
  connectionCommands,
  createAuthCommands,
  createWSClient,
  HTTPConnection,
  IRCConnection,
  MCPConnection,
  MessageRouter,
  parseHttpBody,
  resolveReplyTarget,
  sendHeartbeat,
  sendWSMessage,
  setCORSHeaders,
  startHttpServer,
  startWSServer,
  subscribeToEvents,
  unsubscribeFromEvents,
  WSConnection,
  QUIT_SENTINEL,
} from './io/index.js';

// Agent
export type { NARConfig } from './agent/index.js';
export { NAR } from './agent/index.js';
export type { Agent } from './agent/index.js';
export { createAgent } from './agent/index.js';
export { NARBuilder } from './agent/index.js';
export type { ExtendedAgent } from './agent/index.js';
export type { WiredNAR } from './agent/index.js';
export { createNAR, DEFAULT_CONFIG } from './agent/index.js';
export type { ScenarioProfile } from './agent/index.js';
export { CognitiveTreadmill, ScenarioGenerator } from './agent/index.js';
export { ArchitectureDriver } from './agent/index.js';

// Config
export type { AgentSectionConfig, AppConfig, BotProfile } from './config/index.js';
export {
  DEFAULT_BOT_CONFIG,
  DEFAULT_PROFILE,
  loadConfig,
  loadConfigFromEnv,
  makeDefaultBotConfig,
} from './config/index.js';

// Kernel
export * from './kernel/index.js';

// LM
export * from './lm/index.js';

// Memory
export * from './memory/index.js';

// Dialogue
export * from './dialogue/index.js';

// Metrics
export * from './metrics/index.js';

// NL
export * from './nl/index.js';

// Query
export * from './query/index.js';

// Reflex
export * from './reflex/index.js';

// Rules
export * from './rules/index.js';

// Self
export * from './self/index.js';

// Terms
export * from './terms/index.js';

// Config/NAR
export * from './config/nar.js';

// OTEL
export * from './otel/index.js';

// Health
export * from './health/index.js';

// Metta
export * from './metta/index.js';

export const VERSION = '1.0.0';
export const NAME = 'senars';

export default { VERSION, NAME };