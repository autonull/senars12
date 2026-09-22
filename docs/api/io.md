# @senars/io — public API

## `.`

- `AuthManager`

- `bindAgentToConnection`

- `createAgentDispatch`

- `createAuthMiddleware`

- `createCommandInterceptor`

- `createConnectionConfigsFromEnv`

- `createErrorBoundary`

- `createRateLimiter`

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

- `QUIT_SENTINEL`

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
