export { NAR } from '../nar/src/index.js';
export type { NARConfig } from '../nar/src/index.js';
export {
  createAgent,
  createAgentPreset,
  agentConfigToOptions,
  validateAgentOptions,
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
export type { Connection, ConnectionState, ConnectionConfig, ConnectionDeps, ConnectionFactory, ConnectionError, IOMessage, Logger } from '@senars/io/types';
export type { ConnectionManager, MessageRouter, MessageContext, MessageMiddleware, AuthManager, CommandRegistry, CommandDefinition, CommandHandler, CommandContext, BaseConnection, CLIConnection, CLICommand, IRCConnection, IRCConnectionConfig, WSConnection, HTTPConnection, MCPConnection, MCPToolResult } from '@senars/io';
export { ConnectionManager, ConnectionError as ConnError, MessageRouter, AuthManager, CommandRegistry, BaseConnection, CLIConnection, QUIT_SENTINEL, IRCConnection, WSConnection, HTTPConnection, MCPConnection, resolveReplyTarget, connectionCommands, authCommands, startHttpServer, startWSServer, parseHttpBody, setCORSHeaders, ApiKeyManager, createWSClient, cleanupWSClient, sendHeartbeat, sendWSMessage, subscribeToEvents, unsubscribeFromEvents, broadcastToSubscribers } from '@senars/io';

export const VERSION = '1.0.0';
export const NAME = 'senars12';

export default { VERSION, NAME };
