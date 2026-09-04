/** Transport-level connection error. @public */

/** Authentication manager. @public */
export { AuthManager } from './auth.js';
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
} from './bridge.js';
/** Builtin auth commands. @public */
export { authCommands } from './commands/auth.js';
/** Builtin connection-management commands. @public */
export { connectionCommands } from './commands/connection.js';
export type { CommandContext, CommandDefinition, CommandHandler } from './commands/registry.js';
/** Command registry. @public */
export { CommandRegistry } from './commands/registry.js';
/** Connection registry/lookup. @public */
export { ConnectionManager } from './connection-manager.js';
/** Base connection implementation. @public */
export { BaseConnection } from './connections/base.js';
export type { CLICommand } from './connections/cli.js';
/** CLI/stdin connection. @public */
export { CLIConnection, QUIT_SENTINEL } from './connections/cli.js';
/** HTTP connection. @public */
export { HTTPConnection } from './connections/http.js';
export type { IRCConnectionConfig } from './connections/irc.js';
/** IRC connection. @public */
export { IRCConnection } from './connections/irc.js';
export type { MCPToolResult } from './connections/mcp.js';
/** Model-context-protocol connection. @public */
export { MCPConnection } from './connections/mcp.js';
/** Reply-target resolution helper. @public */
export { resolveReplyTarget } from './connections/reply-target.js';
/** WebSocket connection. @public */
export { WSConnection } from './connections/ws.js';
export type { MessageContext, MessageMiddleware } from './router.js';
/** Message routing + middleware pipeline. @public */
export { MessageRouter } from './router.js';
/** Connection type definitions. @public */
export type {
  Connection,
  ConnectionConfig,
  ConnectionDeps,
  ConnectionFactory,
  ConnectionState,
  IOMessage,
} from './types.js';
export { ConnectionError } from './types.js';
export type { ServerStartupOptions } from './utils/http.js';
/** HTTP/WS server helpers. @public */
export {
  ApiKeyManager,
  parseHttpBody,
  setCORSHeaders,
  startHttpServer,
  startWSServer,
} from './utils/http.js';
export type { WSClient, WSClientOptions } from './utils/websocket.js';
/** WebSocket client helpers. @public */
export {
  broadcastToSubscribers,
  cleanupWSClient,
  createWSClient,
  sendHeartbeat,
  sendWSMessage,
  subscribeToEvents,
  unsubscribeFromEvents,
} from './utils/websocket.js';
