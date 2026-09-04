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
  ApiKeyManager,
  AuthManager,
  authCommands,
  BaseConnection,
  broadcastToSubscribers,
  CLIConnection,
  CommandRegistry,
  ConnectionError,
  ConnectionManager,
  cleanupWSClient,
  connectionCommands,
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
export type {
  Agent,
  AgentOptions,
  AgentPresetDeps,
  AgentPresetName,
  AgentPresetResult,
  AgentToolDeps,
  BridgeContext,
  BridgeOptions,
  ValidatedAgentOptions,
} from '@senars/nar/agent';
export {
  agentConfigToOptions,
  buildAgentTools,
  createAgent,
  createAgentPreset,
} from '@senars/nar/agent';
export type {
  Connection,
  ConnectionConfig,
  ConnectionDeps,
  ConnectionFactory,
  ConnectionState,
  IOMessage,
} from '@senars/util';
export { ConnectionError as ConnError } from '@senars/util';
export type { AgentSectionConfig, AppConfig, BotProfile } from './config/index.js';
export {
  DEFAULT_BOT_CONFIG,
  DEFAULT_PROFILE,
  loadConfig,
  loadConfigFromEnv,
  makeDefaultBotConfig,
} from './config/index.js';

export const VERSION = '1.0.0';
export const NAME = 'senars12';

export default { VERSION, NAME };
