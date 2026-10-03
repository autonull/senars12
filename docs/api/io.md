# @senars/io — public API

## `.`

- `AuthManager`

- `bindAgentToConnection` — The single message path: auth, `/`-commands, session binding, and agent

- `createAgentDispatch`

- `createAuthMiddleware`

- `createCommandInterceptor`

- `createConnectionConfigsFromEnv`

- `createErrorBoundary`

- `createRateLimiter` — Sliding one-second window, at most `maxPerWindow` messages across the transport.

- `createSessionBinder`

- `originExtractor`

- `resolveSessionKey`

- `createAuthCommands` — D19 (TODO17b): /auth actually binds the sender via the AuthManager —

- `connectionCommands`

- `CommandRegistry`

- `ConnectionManager`

- `BaseConnection`

- `CLIConnection`

- `QUIT_SENTINEL`

- `HTTPConnection`

- `IRCConnection`

- `MCPConnection`

- `resolveReplyTarget`

- `WSConnection`

- `MessageRouter`

- `ConnectionError`

- `ApiKeyManager`

- `parseHttpBody`

- `setCORSHeaders`

- `startHttpServer`

- `startWSServer`

- `broadcastToSubscribers`

- `cleanupWSClient`

- `createWSClient`

- `sendHeartbeat`

- `sendWSMessage`

- `subscribeToEvents`

- `unsubscribeFromEvents`

## `./connections/cli`

- `CLICommand`

- `CLIConnection`

## `./connections/ws`

- `WSConnection`

## `./connections/reply-target`

- `resolveReplyTarget`

## `./utils/http`

- `ServerStartupOptions`

- `parseHttpBody`

- `setCORSHeaders`

- `startHttpServer`

- `startWSServer`

- `ApiKeyManager`
