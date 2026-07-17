/** Transport-level connection error. @public */
export { ConnectionError } from './types.js';
/** Connection type definitions. @public */
export type { Connection, ConnectionConfig, ConnectionDeps, ConnectionState, ConnectionFactory, IOMessage } from './types.js';
/** Connection registry/lookup. @public */
export { ConnectionManager } from './connection-manager.js';
/** Message routing + middleware pipeline. @public */
export { MessageRouter } from './router.js';
export type { MessageContext, MessageMiddleware } from './router.js';
/** Authentication manager. @public */
export { AuthManager } from './auth.js';
/** Base connection implementation. @public */
export { BaseConnection } from './connections/base.js';
/** CLI/stdin connection. @public */
export { CLIConnection, QUIT_SENTINEL } from './connections/cli.js';
export type { CLICommand } from './connections/cli.js';
/** IRC connection. @public */
export { IRCConnection } from './connections/irc.js';
export type { IRCConnectionConfig } from './connections/irc.js';
/** WebSocket connection. @public */
export { WSConnection } from './connections/ws.js';
/** HTTP connection. @public */
export { HTTPConnection } from './connections/http.js';
/** Model-context-protocol connection. @public */
export { MCPConnection } from './connections/mcp.js';
export type { MCPToolResult } from './connections/mcp.js';
/** Reply-target resolution helper. @public */
export { resolveReplyTarget } from './connections/reply-target.js';
/** Command registry. @public */
export { CommandRegistry } from './commands/registry.js';
export type { CommandDefinition, CommandHandler, CommandContext } from './commands/registry.js';
/** Builtin connection-management commands. @public */
export { connectionCommands } from './commands/connection.js';
/** Builtin auth commands. @public */
export { authCommands } from './commands/auth.js';
/** Agent↔connection binding + middleware + env config. @public */
export {
  bindAgentToConnection,
  createAgentDispatch,
  originExtractor,
  resolveSessionKey,
  createAuthMiddleware,
  createCommandInterceptor,
  createSessionBinder,
  createRateLimiter,
  createConnectionConfigsFromEnv,
  createErrorBoundary,
} from './bridge.js';
/** HTTP/WS server helpers. @public */
export {
  startHttpServer,
  startWSServer,
  parseHttpBody,
  setCORSHeaders,
  ApiKeyManager,
} from './utils/http.js';
export type { ServerStartupOptions } from './utils/http.js';
export type { WSClient, WSClientOptions } from './utils/websocket.js';
/** WebSocket client helpers. @public */
export {
  createWSClient,
  cleanupWSClient,
  sendHeartbeat,
  sendWSMessage,
  subscribeToEvents,
  unsubscribeFromEvents,
  broadcastToSubscribers,
} from './utils/websocket.js';
