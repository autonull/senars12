export { NAR } from '@senars/nar';
export type { NARConfig } from '@senars/nar';
export {
  createAgent,
  createAgentPreset,
  agentConfigToOptions,
  buildAgentTools,
} from '@senars/nar/agent';
export type {
  Agent,
  AgentOptions,
  AgentPresetName,
  AgentPresetDeps,
  AgentPresetResult,
  ValidatedAgentOptions,
  AgentToolDeps,
  BridgeOptions,
  BridgeContext,
} from '@senars/nar/agent';
export {
  loadConfig,
  loadConfigFromEnv,
  makeDefaultBotConfig,
  DEFAULT_BOT_CONFIG,
  DEFAULT_PROFILE,
} from './config/index.js';
export type { AppConfig, BotProfile, AgentSectionConfig } from './config/index.js';
export type {
  Connection,
  ConnectionState,
  ConnectionConfig,
  ConnectionDeps,
  ConnectionFactory,
  IOMessage,
} from '@senars/core';
export {
  ConnectionManager,
  MessageRouter,
  AuthManager,
  CommandRegistry,
  BaseConnection,
  CLIConnection,
  IRCConnection,
  WSConnection,
  HTTPConnection,
  MCPConnection,
  resolveReplyTarget,
  connectionCommands,
  authCommands,
  startHttpServer,
  startWSServer,
  parseHttpBody,
  setCORSHeaders,
  ApiKeyManager,
  createWSClient,
  cleanupWSClient,
  sendHeartbeat,
  sendWSMessage,
  subscribeToEvents,
  unsubscribeFromEvents,
  broadcastToSubscribers,
  ConnectionError,
} from '@senars/io';
export type {
  MessageContext,
  MessageMiddleware,
  CLICommand,
  IRCConnectionConfig,
  MCPToolResult,
  CommandDefinition,
  CommandHandler,
  CommandContext,
} from '@senars/io';
export { ConnectionError as ConnError } from '@senars/core';

export const VERSION = '1.0.0';
export const NAME = 'senars12';

export default { VERSION, NAME };
