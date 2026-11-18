/**
 * IO — transport connections (migrated from @senars/io).
 */

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
export type {
  CLICommand,
  CommandContext,
  CommandDefinition,
  CommandHandler,
  IRCConnectionConfig,
  MCPToolResult,
  MessageContext,
  MessageMiddleware,
  Connection,
  ConnectionConfig,
  ConnectionDeps,
  ConnectionFactory,
  ConnectionState,
  IOMessage,
} from '@senars/io';
export { QUIT_SENTINEL } from '@senars/io/connections/cli';