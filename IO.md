# IO.md — Unified I/O Architecture

## Vision

Every I/O channel is a first-class **Connection** managed by a **ConnectionManager**, routed through a **MessageRouter**, and driven by an **Agent** that can dynamically enable, disable, and respond to any number of simultaneous connections.

---

## Architecture

```
┌───────────────────────────────────────────┐
│                   Agent                    │
│  ┌─────────────────────────────────────┐  │
│  │            ConnectionManager         │  │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐        │  │
│  │  │CLI │ │IRC │ │ WS │ │HTTP│ ...    │  │
│  │  └─┬──┘ └─┬──┘ └─┬──┘ └─┬──┘        │  │
│  │    └──────┴──────┴──────┘            │  │
│  │               │                       │  │
│  │        ┌──────▼──────┐               │  │
│  │        │MessageRouter│               │  │
│  │        └──────┬──────┘               │  │
│  │               │                       │  │
│  │        ┌──────▼──────┐               │  │
│  │        │CommandReg.  │               │  │
│  │        └──────┬──────┘               │  │
│  └───────────────┼─────────────────────┘  │
│                  │                         │
│          ┌───────▼───────┐                │
│          │     NAR       │                │
│          └───────────────┘                │
└───────────────────────────────────────────┘
```

### Principles

- Every I/O channel is a `Connection` — uniform lifecycle, messaging
- Connections are dynamic — enable/disable at runtime
- Router is pluggable — middleware chain
- Handlers are shared — one implementation, all connections
- No singletons — instance-scoped
- Delete `src/bot/` entirely — replaced by `src/io/`

---

## Core

### `src/io/types.ts`

```typescript
export type ConnectionState =
    | 'idle' | 'connecting' | 'connected'
    | 'disconnecting' | 'disconnected' | 'error';

export interface IOMessage {
    readonly id: string;
    readonly source: string;          // Connection ID
    readonly sender: string;          // User/channel identity
    readonly text: string;
    readonly timestamp: number;
    readonly metadata?: Record<string, unknown>;
}

export type MessageClassification =
    | 'command' | 'belief' | 'question'
    | 'goal' | 'natural-language' | 'unknown';

export interface Connection {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly state: ConnectionState;

    connect(): Promise<void>;
    disconnect(reason?: string): Promise<void>;
    reconnect(): Promise<void>;

    send(target: string, text: string): Promise<void>;
    onMessage(handler: (message: IOMessage) => Promise<void>): void;

    onStateChange(handler: (state: ConnectionState, prev: ConnectionState) => void): void;
    onError(handler: (error: ConnectionError) => void): void;

    getStatus(): { state: ConnectionState; messageCount: number; errorCount: number };
    reconfigure(config: Record<string, unknown>): Promise<void>;
}

export class ConnectionError extends Error {
    constructor(
        message: string,
        readonly connectionId: string,
        readonly code: string,
        readonly recoverable: boolean,
        readonly cause?: Error,
    ) { super(message); this.name = 'ConnectionError'; }
}

export interface ConnectionFactory {
    readonly type: string;
    create(config: ConnectionConfig, deps: ConnectionDeps): Connection;
}

export interface ConnectionConfig {
    readonly id: string;
    readonly enabled: boolean;
    readonly type: string;
    readonly config: Record<string, unknown>;
}

export interface ConnectionDeps {
    readonly nar: NAR;
    readonly emit: (event: string, data: unknown) => void;
    readonly logger: Logger;
}
```

**Key decisions:**
- `ConnectionDeps` does NOT include `Agent` — avoids circular dependency. Uses `emit()` callback instead.
- `Connection` is minimal — no capabilities negotiation, no health checks, no broadcast. Add when needed.
- `ConnectionError` is simple string code, not enum. Extend when patterns emerge.

### `src/io/connection-manager.ts`

```typescript
export class ConnectionManager {
    private connections: Map<string, Connection> = new Map();
    private factories: Map<string, ConnectionFactory> = new Map();

    registerFactory(factory: ConnectionFactory): void;
    addConnection(config: ConnectionConfig): Promise<Connection>;
    removeConnection(id: string): Promise<void>;
    enableConnection(id: string): Promise<void>;
    disableConnection(id: string): Promise<void>;
    reconnectConnection(id: string): Promise<void>;
    shutdownAll(): Promise<void>;

    getConnection(id: string): Connection | undefined;
    getConnections(): ReadonlyMap<string, Connection>;
    getConnectionsByType(type: string): Connection[];
}
```

No health checks, no metrics, no bulk-by-type operations. The manager creates, tracks, and destroys connections. That's it.

### `src/io/router.ts`

```typescript
export interface MessageContext {
    readonly connection: Connection;
    readonly nar: NAR;
    readonly respond: (text: string) => Promise<void>;  // Send back to source
}

export type MessageMiddleware = (
    message: IOMessage,
    context: MessageContext,
    next: () => Promise<void>,
) => Promise<void>;

export class MessageRouter {
    private middleware: MessageMiddleware[] = [];

    use(middleware: MessageMiddleware): void;
    route(message: IOMessage, context: MessageContext): Promise<void>;
}
```

**Key decisions:**
- `respond()` in context — middleware can send output back to the originating connection without knowing its type.
- No backpressure controller, no named middleware insertion, no priority. Simple array, simple chain.
- No `MessageSession` — if per-connection state is needed, store it in `connection.metadata`.

### Default Middleware Pipeline

```
Input → [1. URL Filter]        — skip URLs
         [2. Classifier]        — command vs belief vs question vs NL
         [3. Command Dispatcher] — route .commands (short-circuits)
         [4. NAR Handler]       — beliefs/questions/goals → NAR
         [5. Error Handler]     — catch and format
         → Output via respond()
```

### `src/io/commands/registry.ts`

```typescript
export interface CommandHandler {
    readonly name: string;
    readonly description: string;
    readonly usage: string;
    execute(args: string[], context: CommandContext): Promise<string>;
}

export interface CommandContext {
    readonly nar: NAR;
    readonly connection: Connection;
    readonly manager: ConnectionManager;
}

export class CommandRegistry {
    private commands: Map<string, CommandHandler> = new Map();

    register(cmd: CommandHandler): void;
    execute(name: string, args: string[], context: CommandContext): Promise<string>;
    list(): ReadonlyMap<string, CommandHandler>;
}
```

### Connection Commands

| Command | Description |
|---------|-------------|
| `.connect <id> <type> [config...]` | Create and connect |
| `.disconnect <id>` | Disconnect and remove |
| `.enable <id>` | Resume |
| `.disable <id>` | Suspend |
| `.reconnect <id>` | Force reconnect |
| `.connections` | Show all |
| `.connect-template <name>` | From preset |

---

## Connections

### `src/io/connections/base.ts`

```typescript
export abstract class BaseConnection implements Connection {
    protected state: ConnectionState = 'idle';
    protected messageHandler?: (message: IOMessage) => Promise<void>;
    protected readonly emit: (event: string, data: unknown) => void;
    protected readonly logger: Logger;
    protected readonly config: ConnectionConfig;

    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly type: string;
    abstract connect(): Promise<void>;
    abstract disconnect(reason?: string): Promise<void>;
    abstract send(target: string, text: string): Promise<void>;

    // Provided: reconnect, onMessage, onStateChange, onError, getStatus, reconfigure, setState
    protected withRetry<T>(fn: () => Promise<T>): Promise<T>;
}
```

Simple abstract base: retry logic, state management, event emission. No circuit breaker, no rate limiter.

### Implementations

| File | Type | Notes |
|------|------|-------|
| `cli.ts` | `cli` | Readline wrapper, banner, history |
| `irc.ts` | `irc` | Wraps RealIRCClient or EmbeddedIRCServer, 512 char limit |
| `ws.ts` | `websocket` | Server mode, per-client connection |
| `http.ts` | `http` | REST + SSE |
| `mcp.ts` | `mcp` | stdio or SSE transport |

Each implements `Connection`. Future types (Discord, Slack, Matrix, Telegram, etc.) follow the same pattern.

---

## Agent

### `src/agent/Agent.ts`

```typescript
export class Agent {
    private readonly nar: NAR;
    private readonly manager: ConnectionManager;
    private readonly router: MessageRouter;
    private readonly commands: CommandRegistry;
    private readonly emitter: EventEmitter;
    private running = false;

    constructor(nar: NAR) {
        this.nar = nar;
        this.emitter = new EventEmitter();
        this.manager = new ConnectionManager();
        this.router = new MessageRouter();
        this.commands = new CommandRegistry();
        this.setupMiddleware();
        this.setupCommands();
    }

    // Connection management
    addConnection(config: ConnectionConfig): Promise<Connection>;
    removeConnection(id: string): Promise<void>;
    enableConnection(id: string): Promise<void>;
    disableConnection(id: string): Promise<void>;
    getConnection(id: string): Connection | undefined;
    getConnections(): ReadonlyMap<string, Connection>;

    // Lifecycle
    start(): Promise<void>;
    stop(): Promise<void>;

    // Messaging
    sendTo(connectionId: string, target: string, text: string): Promise<void>;
    broadcast(text: string, exclude?: string[]): Promise<void>;

    // Autonomous: agent can manage connections via beliefs/events
    requestConnection(type: string, config: Record<string, unknown>): Promise<void>;

    // State
    saveState(path?: string): Promise<void>;
    loadState(path?: string): Promise<void>;

    // Events (for autonomous connector, monitoring, etc.)
    on(event: string, handler: (...args: unknown[]) => void): void;
}
```

**Key decisions:**
- Uses Node.js `EventEmitter` — no custom EventBus. Good enough.
- `requestConnection()` — agent can autonomously add connections. The autonomous connector listens to this.
- No `Embodiment` — deleted, replaced by `Connection`.

### Response Routing

When NAR derives beliefs from a message, output goes back to the **originating connection** by default via `respond()` in `MessageContext`. Commands can override with `broadcast: true` to send to all connections.

### Slow NAR Behavior

If NAR is processing a question and a new message arrives: the new message is queued in the middleware chain (async, non-blocking). NAR processes sequentially. No priority queue needed — JavaScript's event loop handles ordering.

---

## File Structure

```
src/
├── io/
│   ├── index.ts                     # Public API
│   ├── types.ts                     # Connection, IOMessage, errors, factories
│   ├── connection-manager.ts        # Dynamic lifecycle
│   ├── router.ts                    # Middleware chain
│   │
│   ├── commands/
│   │   ├── registry.ts
│   │   ├── core.ts                  # .help .run .stats .clear .quit
│   │   ├── connection.ts            # .connect .disconnect .enable .disable
│   │   ├── memory.ts                # .list .concepts .save .load
│   │   ├── nar.ts                   # .query .trace .explain
│   │   ├── self.ts                  # .self .meta .constitution
│   │   ├── lm.ts                    # .lm-status .lm-switch
│   │   └── rlfp.ts                  # .prefer .reward
│   │
│   └── connections/
│       ├── base.ts                  # Abstract: retry, state management
│       ├── cli.ts
│       ├── irc.ts
│       ├── ws.ts
│       ├── http.ts
│       └── mcp.ts
│
├── agent/
│   ├── Agent.ts                     # Uses ConnectionManager + MessageRouter
│   └── index.ts
│
├── api/                             # Refactored: no singletons
│   ├── registry.ts
│   ├── base-adapter.ts
│   ├── http-adapter.ts
│   ├── websocket-adapter.ts
│   └── mcp/
│
├── cli/
│   ├── repl.ts                      # Thin: creates Agent + CLIConnection
│   └── display.ts                   # Rendering utilities
│
└── bin/
    ├── senars.ts                    # CLI entry
    └── bot.ts                       # Bot entry
```

### Deleted

- `src/bot/` — entire directory
- `src/cli/command-handlers.ts`
- `src/cli/pipeline.ts`
- `src/cli/commands/` — entire directory
- `src/agent/http-server.ts`
- `src/agent/websocket-server.ts`
- `Embodiment` interface

---

## Implementation Order

1. `src/io/types.ts` — Core interfaces
2. `src/io/connection-manager.ts` — Lifecycle
3. `src/io/router.ts` — Middleware chain
4. `src/io/commands/registry.ts` — Command system
5. `src/io/connections/base.ts` — Abstract base
6. `src/io/connections/irc.ts` — First concrete (proves the pattern)
7. `src/io/connections/cli.ts` — CLI
8. `src/io/connections/ws.ts` — WebSocket
9. `src/io/connections/http.ts` — HTTP
10. `src/io/connections/mcp.ts` — MCP
11. `src/io/commands/*.ts` — All commands
12. `src/agent/Agent.ts` — Wire it together
13. `src/cli/repl.ts` — Thin wrapper
14. `src/bin/bot.ts` — Bot entry
15. Delete old files, refactor `src/api/registry.ts`, update `src/index.ts`

---

## Future

These are deferred until there's an actual need:

### EventBus (Enhanced)
Replace Node `EventEmitter` with typed event bus with history replay, pattern matching, and cross-connection event relay.

### Observability
- `IOMetrics` — per-connection message counts, latency percentiles, export to Prometheus/statsd
- `HealthMonitor` — periodic health checks, degraded/restored events
- `AuditLog` — queryable event log
- Connection-aware tracing (extend existing `nar/trace`)

### Security
- `AuthProvider` — API key, token, certificate auth
- `Permission` system — message:send, command:execute, connection:manage, admin
- Per-connection rate limiter with sliding windows
- Input validator with pattern blocking

### Resilience
- `CircuitBreaker` — failure threshold, half-open recovery
- Priority queue backpressure controller
- Graceful degradation modes

### Configuration
- `ConfigManager` with hot-reload, file watching, env overrides
- Connection templates with full retry/rate-limit/circuit-breaker configs
- Schema validation via Zod

### Connection Capabilities
- `ConnectionCapabilities` — streaming, rich text, files, reactions, max length
- `ResponseFormatter` — format output per connection capabilities
- `BroadcastOptions` — filter by capability, exclude connections

### Middleware Additions
- `context-enricher` — add sender identity, connection metadata
- `correlation-tracker` — request-response pair tracking
- `streaming-handler` — chunked responses for long operations
- `rate-limiter` — per-connection message rate limiting

### Advanced Routing
- Cross-connection relay policies (IRC → WS, but not WS → IRC)
- Per-sender routing rules
- Message transformation pipelines

### Connection Types
- Discord, Slack, Matrix, Telegram, Email, Webhook, RSS, gRPC, ActivityPub, stdio
