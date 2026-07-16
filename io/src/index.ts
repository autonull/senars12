export { ConnectionError } from './types.js';
export type { Connection, ConnectionConfig, ConnectionDeps, ConnectionState, ConnectionFactory, IOMessage } from './types.js';
export { ConnectionManager } from './connection-manager.js';
export { MessageRouter } from './router.js';
export type { MessageContext, MessageMiddleware } from './router.js';
export { AuthManager } from './auth.js';
export { BaseConnection } from './connections/base.js';
export { CLIConnection, QUIT_SENTINEL } from './connections/cli.js';
export type { CLICommand } from './connections/cli.js';
export { IRCConnection } from './connections/irc.js';
export type { IRCConnectionConfig } from './connections/irc.js';
export { WSConnection } from './connections/ws.js';
export { HTTPConnection } from './connections/http.js';
export { MCPConnection } from './connections/mcp.js';
export type { MCPToolResult } from './connections/mcp.js';
export { resolveReplyTarget } from './connections/reply-target.js';
export { CommandRegistry } from './commands/registry.js';
export type { CommandDefinition, CommandHandler, CommandContext } from './commands/registry.js';
export { connectionCommands } from './commands/connection.js';
export { authCommands } from './commands/auth.js';
export {
  startHttpServer,
  startWSServer,
  parseHttpBody,
  setCORSHeaders,
  ApiKeyManager,
} from './utils/http.js';
export type { ServerStartupOptions } from './utils/http.js';
export type { WSClient, WSClientOptions } from './utils/websocket.js';
export {
  createWSClient,
  cleanupWSClient,
  sendHeartbeat,
  sendWSMessage,
  subscribeToEvents,
  unsubscribeFromEvents,
  broadcastToSubscribers,
} from './utils/websocket.js';
