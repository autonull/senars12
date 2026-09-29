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

- `Ledger` — Generic append-only ledger with JSONL backing, rotation, retention, and in-memory hot cache.

- `createLedger` — Convenience factory for common ledger shapes.

- `BaseLedgerEntrySchema` — Ledger entry schema — all entries carry a timestamp and correlation context.

- `type BaseLedgerEntry`

- `type LedgerConfig`

- `type LedgerQuery`

- `type RolloverPolicy`

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

## `./ledger`

- `BaseLedgerEntrySchema` — Ledger entry schema — all entries carry a timestamp and correlation context.

- `BaseLedgerEntry`

- `RolloverPolicy` — Rotation/rollover policy — parameterized from EpisodicMemory's load-bearing behavior.

- `RolloverPolicyOptions` — Factory options for rollover policy (all optional, defaults applied).

- `LedgerQuery` — Query filter for ledger entries.

- `LedgerConfig` — Ledger configuration.

- `CreateLedgerOptions` — Factory options for createLedger (excludes basePath and schema which are separate params).

- `Ledger` — Generic append-only ledger with JSONL backing, rotation, retention, and in-memory hot cache.

- `createLedger` — Convenience factory for common ledger shapes.
