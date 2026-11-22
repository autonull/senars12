/** Transport-level connection error. @public */

/** Authentication manager. @public */
export { AuthManager } from './auth';
/** Agent↔connection binding + middleware + env config. @public */
export {
  bindAgentToConnection,
  createAgentDispatch,
  createAuthMiddleware,
  createCommandInterceptor,
  createConnectionConfigsFromEnv,
  createErrorBoundary,
  createRateLimiter,
  createSessionBinder,
  originExtractor,
  resolveSessionKey,
} from './bridge/index';
/** Builtin auth commands. @public */
export { createAuthCommands } from './commands/auth';
/** Builtin connection-management commands. @public */
export { connectionCommands } from './commands/connection';
export type { CommandContext, CommandDefinition, CommandHandler } from '../commands/types';
/** Command registry. @public */
export { CommandRegistry } from './commands/registry';
/** Connection registry/lookup. @public */
export { ConnectionManager } from './connection-manager';
/** Base connection implementation. @public */
export { BaseConnection } from './connections/base';
export type { CLICommand } from './connections/cli';
/** CLI/stdin connection. @public */
export { CLIConnection, QUIT_SENTINEL } from './connections/cli';
/** HTTP connection. @public */
export { HTTPConnection } from './connections/http';
export type { IRCConnectionConfig } from './connections/irc';
/** IRC connection. @public */
export { IRCConnection } from './connections/irc';
export type { MCPToolResult } from './connections/mcp';
/** Model-context-protocol connection. @public */
export { MCPConnection } from './connections/mcp';
/** Reply-target resolution helper. @public */
export { resolveReplyTarget } from './connections/reply-target';
/** WebSocket connection. @public */
export { WSConnection } from './connections/ws';
export type { MessageContext, MessageMiddleware } from './router';
/** Message routing + middleware pipeline. @public */
export { MessageRouter } from './router';
/** Connection type definitions. @public */
export type {
  Connection,
  ConnectionConfig,
  ConnectionDeps,
  ConnectionFactory,
  ConnectionState,
  IOMessage,
} from './types';
export type { ConnectionError } from './types';
export type { ServerStartupOptions } from './utils/http';
/** HTTP/WS server helpers. @public */
export {
  parseHttpBody,
  setCORSHeaders,
  startHttpServer,
  startWSServer,
} from './utils/http';
export type { WSClient, WSClientOptions } from './utils/websocket';
/** WebSocket client helpers. @public */
export {
  broadcastToSubscribers,
  cleanupWSClient,
  createWSClient,
  sendHeartbeat,
  sendWSMessage,
  subscribeToEvents,
  unsubscribeFromEvents,
} from './utils/websocket';
