export type {
  Connection,
  ConnectionState,
  ConnectionConfig,
  ConnectionFactory,
  ConnectionDeps,
  ConnectionError,
  IOMessage,
  Logger,
} from './types.js';
export { ConnectionError as ConnError } from './types.js';
export { ConnectionManager } from './connection-manager.js';
export { MessageRouter, type MessageContext, type MessageMiddleware } from './router.js';
export { AuthManager } from './auth.js';
export { BaseConnection } from './connections/base.js';
export { CLIConnection, QUIT_SENTINEL, type CLICommand } from './connections/cli.js';
export { IRCConnection, type IRCConnectionConfig } from './connections/irc.js';
export { WSConnection } from './connections/ws.js';
export { HTTPConnection } from './connections/http.js';
export { MCPConnection, type MCPToolResult } from './connections/mcp.js';
export { resolveReplyTarget } from './connections/reply-target.js';
export { CommandRegistry, type CommandDefinition, type CommandHandler, type CommandContext } from './commands/registry.js';
export { connectionCommands } from './commands/connection.js';
export { authCommands } from './commands/auth.js';
export { startHttpServer, startWSServer, parseHttpBody, setCORSHeaders, ApiKeyManager } from './utils/http.js';
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
