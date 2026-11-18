/**
 * Senars — unified reasoning package.
 *
 * Main entry point re-exports from legacy packages during transition.
 * New modules are available via path aliases (@senars/kernel/*, @senars/logics/*, etc.).
 */

export * from './log/index.js';

export type {
  CLICommand,
  CommandContext,
  CommandDefinition,
  CommandHandler,
  IRCConnectionConfig,
  MCPToolResult,
  MessageContext,
  MessageMiddleware,
} from '@senars/io';
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
} from '@senars/io';
export type { NARConfig } from '@senars/nar';
export { NAR } from '@senars/nar';
export type { Agent } from '@senars/nar/agent';
export { createAgent } from '@senars/nar/agent';
export type {
  Connection,
  ConnectionConfig,
  ConnectionDeps,
  ConnectionFactory,
  ConnectionState,
  IOMessage,
} from '@senars/util';
export type { AgentSectionConfig, AppConfig, BotProfile } from './config/index.js';
export {
  DEFAULT_BOT_CONFIG,
  DEFAULT_PROFILE,
  loadConfig,
  loadConfigFromEnv,
  makeDefaultBotConfig,
} from './config/index.js';

export const VERSION = '1.0.0';
export const NAME = 'senars';

export default { VERSION, NAME };