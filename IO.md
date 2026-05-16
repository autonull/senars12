# IO.md — Unified I/O Architecture

## Vision

Every I/O channel — CLI, IRC, WebSocket, HTTP, MCP, and any future protocol — is a first-class **Connection** managed by a **ConnectionManager**, routed through a pluggable **MessageRouter**, and driven by an **Agent** that can dynamically enable, disable, monitor, and reason about any number of simultaneous connections.

The Bot is autonomous: it observes its connections, detects failures, adapts its topology, and makes decisions about when and how to communicate — all through the same reasoning machinery it applies to any other domain.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          Agent                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  ConnectionManager                     │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │  │
│  │  │ CLI  │ │ IRC  │ │  WS  │ │ HTTP │ │ MCP  │ ...    │  │
│  │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘        │  │
│  │     └────────┴────────┴────────┴────────┘             │  │
│  │                      │                                 │  │
│  │              ┌───────▼────────┐                        │  │
│  │              │    EventBus    │ ← cross-connection     │  │
│  │              └───────┬────────┘   events, monitoring   │  │
│  │                      │                                 │  │
│  │              ┌───────▼────────┐                        │  │
│  │              │ MessageRouter  │ ← middleware chain     │  │
│  │              │ + backpressure │   classify, transform  │  │
│  │              └───────┬────────┘                        │  │
│  │                      │                                 │  │
│  │              ┌───────▼────────┐                        │  │
│  │              │CommandRegistry │ ← shared commands      │  │
│  │              │+ NAR handlers  │   beliefs, questions   │  │
│  │              └───────┬────────┘                        │  │
│  └──────────────────────┼────────────────────────────────┘  │
│                         │                                   │
│                 ┌───────▼───────┐                           │
│                 │     NAR       │ ← reasoning engine        │
│                 └───────────────┘                           │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Observability                             │  │
│  │  Metrics │ Tracing │ Health │ Audit Log               │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Principles

- **Every I/O channel is a `Connection`** — uniform lifecycle, messaging, observability
- **Connections are dynamic** — enable/disable/reconfigure at runtime
- **Router is pluggable** — middleware chain for classification, filtering, transformation
- **Handlers are shared** — one implementation, all connections use it
- **Per-connection context** — identity, session state, preferences tracked per connection
- **No singletons** — instance-scoped for testability and multi-agent support
- **Event-driven** — async event bus for monitoring, alerts, cross-connection relay
- **Observable** — metrics, tracing, health checks built in
- **Resilient** — circuit breakers, retry, graceful degradation

---

## Core Abstractions

### `src/io/types.ts`

```typescript
// ─── Connection Lifecycle ───────────────────────────────────────

export type ConnectionState =
    | 'idle' | 'connecting' | 'connected' | 'degraded'
    | 'disconnecting' | 'disconnected' | 'error' | 'blocked';

// ─── Message Flow ───────────────────────────────────────────────

export interface IOMessage {
    readonly id: string;
    readonly source: string;          // Connection ID
    readonly sender: string;          // User/channel identity
    readonly text: string;
    readonly timestamp: number;
    readonly metadata?: Record<string, unknown>;
    readonly priority?: MessagePriority;
    readonly correlationId?: string;
}

export type MessagePriority = 'low' | 'normal' | 'high' | 'critical';

export type MessageClassification =
    | 'command' | 'belief' | 'question' | 'goal'
    | 'natural-language' | 'system-event' | 'unknown';

// ─── Connection Interface ───────────────────────────────────────

export interface Connection {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly state: ConnectionState;
    readonly capabilities: ConnectionCapabilities;

    connect(): Promise<void>;
    disconnect(reason?: string): Promise<void>;
    reconnect(): Promise<void>;

    send(target: string, text: string, options?: SendOptions): Promise<void>;
    broadcast(text: string, options?: BroadcastOptions): Promise<void>;
    onMessage(handler: (message: IOMessage) => Promise<void>): void;

    onStateChange(handler: (state: ConnectionState, prev: ConnectionState) => void): void;
    onError(handler: (error: ConnectionError) => void): void;

    getStatus(): ConnectionStatus;
    healthCheck(): Promise<HealthCheckResult>;
    reconfigure(config: Record<string, unknown>): Promise<void>;
}

export interface ConnectionCapabilities {
    readonly supportsStreaming: boolean;
    readonly supportsRichText: boolean;
    readonly supportsFiles: boolean;
    readonly supportsReactions: boolean;
    readonly maxMessageLength: number;
    readonly supportedChannels: string[];
}

export interface ConnectionStatus {
    readonly state: ConnectionState;
    readonly connectedSince?: number;
    readonly messageCount: { inbound: number; outbound: number };
    readonly errorCount: number;
    readonly latency: { avg: number; p95: number; p99: number };
    readonly lastActivity: number;
    readonly metadata: Record<string, unknown>;
}

export interface HealthCheckResult {
    readonly healthy: boolean;
    readonly latency: number;
    readonly details: Record<string, unknown>;
}

export interface SendOptions {
    readonly priority?: MessagePriority;
    readonly correlationId?: string;
    readonly metadata?: Record<string, unknown>;
    readonly timeout?: number;
}

export interface BroadcastOptions {
    readonly exclude?: string[];
    readonly filter?: (conn: Connection) => boolean;
    readonly priority?: MessagePriority;
}

// ─── Errors ─────────────────────────────────────────────────────

export class ConnectionError extends Error {
    constructor(
        message: string,
        readonly connectionId: string,
        readonly code: ConnectionErrorCode,
        readonly recoverable: boolean,
        readonly cause?: Error,
    ) { super(message); this.name = 'ConnectionError'; }
}

export type ConnectionErrorCode =
    | 'CONNECTION_FAILED' | 'AUTH_FAILED' | 'RATE_LIMITED'
    | 'TIMEOUT' | 'PROTOCOL_ERROR' | 'MESSAGE_TOO_LARGE'
    | 'DISCONNECTED' | 'CIRCUIT_OPEN';

// ─── Factory Pattern ────────────────────────────────────────────

export interface ConnectionFactory {
    readonly type: string;
    readonly description: string;
    readonly schema: ZodSchema;
    create(config: ConnectionConfig, deps: ConnectionDeps): Connection;
}

export interface ConnectionConfig {
    readonly id: string;
    readonly enabled: boolean;
    readonly type: string;
    readonly config: Record<string, unknown>;
    readonly retry?: RetryPolicy;
    readonly rateLimit?: RateLimitConfig;
    readonly circuitBreaker?: CircuitBreakerConfig;
}

export interface ConnectionDeps {
    readonly agent: Agent;
    readonly nar: NAR;
    readonly eventBus: EventBus;
    readonly logger: Logger;
}

// ─── Retry & Resilience ─────────────────────────────────────────

export interface RetryPolicy {
    readonly maxAttempts: number;
    readonly baseDelay: number;
    readonly maxDelay: number;
    readonly backoffFactor: number;
    readonly jitter: boolean;
}

export interface CircuitBreakerConfig {
    readonly failureThreshold: number;
    readonly recoveryTimeout: number;
    readonly halfOpenMaxAttempts: number;
}

export interface RateLimitConfig {
    readonly windowMs: number;
    readonly maxMessages: number;
    readonly strategy: 'drop' | 'queue' | 'backpressure';
}
```

### `src/io/connection-manager.ts`

```typescript
export class ConnectionManager {
    private connections: Map<string, Connection> = new Map();
    private factories: Map<string, ConnectionFactory> = new Map();
    private readonly eventBus: EventBus;
    private readonly logger: Logger;

    registerFactory(factory: ConnectionFactory): void;
    unregisterFactory(type: string): void;
    getFactory(type: string): ConnectionFactory | undefined;
    listFactories(): ReadonlyMap<string, ConnectionFactory>;

    addConnection(config: ConnectionConfig): Promise<Connection>;
    removeConnection(id: string, reason?: string): Promise<void>;
    disableConnection(id: string): Promise<void>;
    enableConnection(id: string): Promise<void>;
    reconnectConnection(id: string, config?: Partial<ConnectionConfig>): Promise<void>;

    disableByType(type: string): Promise<void>;
    enableByType(type: string): Promise<void>;
    shutdownAll(reason?: string): Promise<void>;

    getConnection(id: string): Connection | undefined;
    getConnections(): ReadonlyMap<string, Connection>;
    getConnectionsByType(type: string): Connection[];
    getConnectionsByState(state: ConnectionState): Connection[];
    getEnabledConnections(): Connection[];

    healthCheckAll(): Promise<Map<string, HealthCheckResult>>;
    getMetrics(): ConnectionManagerMetrics;
}

export interface ConnectionManagerMetrics {
    readonly totalConnections: number;
    readonly activeConnections: number;
    readonly errors: { connectionId: string; error: ConnectionError; timestamp: number }[];
    readonly uptime: number;
}
```

---

## Event Bus

### `src/io/event-bus.ts`

```typescript
export type IOEventType =
    | 'connection:created' | 'connection:connected' | 'connection:disconnected'
    | 'connection:error' | 'connection:reconnecting'
    | 'connection:health:degraded' | 'connection:health:restored'
    | 'message:received' | 'message:sent' | 'message:classified'
    | 'message:error' | 'message:dropped'
    | 'agent:started' | 'agent:stopping'
    | 'agent:decision' | 'agent:connection:requested'
    | 'system:backpressure' | 'system:rate-limit'
    | 'system:circuit-breaker:open' | 'system:circuit-breaker:closed';

export interface IOEvent<T = unknown> {
    readonly type: IOEventType;
    readonly timestamp: number;
    readonly source: string;
    readonly data: T;
    readonly correlationId?: string;
}

export class EventBus {
    private listeners: Map<IOEventType, Set<EventHandler>> = new Map();
    private history: IOEvent[] = [];
    private readonly maxHistory: number;

    on<T>(type: IOEventType, handler: EventHandler<T>): void;
    once<T>(type: IOEventType, handler: EventHandler<T>): void;
    off<T>(type: IOEventType, handler: EventHandler<T>): void;
    emit<T>(event: IOEvent<T>): void;
    getHistory(filter?: { type?: IOEventType; source?: string; since?: number }): IOEvent[];
    onPattern(pattern: EventPattern, handler: EventHandler): void;
}

export type EventHandler<T = unknown> = (event: IOEvent<T>) => void | Promise<void>;

export interface EventPattern {
    readonly type?: IOEventType | IOEventType[];
    readonly source?: string | RegExp;
    readonly data?: Record<string, unknown>;
}
```

### Built-in Event Handlers

| Handler | Purpose |
|---------|---------|
| `connection-monitor` | Watches health, triggers reconnection |
| `cross-connection-relay` | Relay messages between connections |
| `audit-logger` | Logs significant events |
| `autonomous-connector` | Creates connections from agent decisions |

---

## Message Router

### `src/io/router.ts`

```typescript
export interface MessageContext {
    readonly connection: Connection;
    readonly agent: Agent;
    readonly nar: NAR;
    readonly session: ConnectionSession;
    readonly eventBus: EventBus;
}

export interface ConnectionSession {
    readonly id: string;
    readonly connectionId: string;
    readonly createdAt: number;
    metadata: Map<string, unknown>;
    messageCount: { inbound: number; outbound: number };
    lastActivity: number;
}

export type MessageMiddleware = (
    message: IOMessage,
    context: MessageContext,
    next: () => Promise<void>,
) => Promise<void>;

export class MessageRouter {
    private middleware: MessageMiddleware[] = [];
    private readonly backpressure: BackpressureController;

    use(middleware: MessageMiddleware): void;
    useBefore(name: string, middleware: MessageMiddleware): void;
    useAfter(name: string, middleware: MessageMiddleware): void;
    route(message: IOMessage, context: MessageContext): Promise<void>;

    isBackpressured(): boolean;
    setBackpressure(active: boolean): void;
}

export class BackpressureController {
    private active = false;
    private readonly queue: PriorityQueue<IOMessage>;
    private readonly maxQueueSize: number;

    enqueue(message: IOMessage): boolean;
    dequeue(): IOMessage | undefined;
    size(): number;
    activate(): void;
    deactivate(): void;
}
```

### Middleware Pipeline

```
Input → [1. Input Validator]
         [2. Rate Limiter]
         [3. URL Filter]
         [4. Context Enricher]
         [5. Classifier]
         [6. Command Dispatcher] ← short-circuits if command
         [7. NAR Handler]        ← handles beliefs/questions/goals
         [8. Response Formatter]
         [9. Error Handler]
         → Output
```

### Built-in Middleware

| Middleware | Purpose |
|------------|---------|
| `classifier` | Narsese vs command vs NL |
| `command-dispatcher` | Route `.commands` to registry |
| `nar-handler` | Beliefs, questions, goals → NAR |
| `url-filter` | Skip/sanitize URLs |
| `response-formatter` | Format output per connection capabilities |
| `rate-limiter` | Per-connection rate limiting |
| `input-validator` | Validate length, encoding, content |
| `streaming-handler` | Long-running ops with chunked responses |
| `error-handler` | Catch and format errors |
| `context-enricher` | Add sender identity, metadata |
| `correlation-tracker` | Track request-response pairs |

---

## Command Registry

### `src/io/commands/registry.ts`

```typescript
export interface CommandHandler {
    readonly name: string;
    readonly description: string;
    readonly usage: string;
    readonly category: CommandCategory;
    readonly requiresAuth?: boolean;
    execute(args: string[], context: CommandContext): Promise<CommandResult>;
}

export type CommandCategory =
    | 'core' | 'connection' | 'memory' | 'nar'
    | 'self' | 'lm' | 'rlfp' | 'admin';

export interface CommandContext {
    readonly agent: Agent;
    readonly nar: NAR;
    readonly connection: Connection;
    readonly session: ConnectionSession;
    readonly eventBus: EventBus;
}

export interface CommandResult {
    readonly text: string;
    readonly metadata?: Record<string, unknown>;
    readonly broadcast?: boolean;
    readonly priority?: MessagePriority;
}

export class CommandRegistry {
    private commands: Map<string, CommandHandler> = new Map();
    private categories: Map<CommandCategory, Set<string>> = new Map();

    register(cmd: CommandHandler): void;
    unregister(name: string): void;
    get(name: string): CommandHandler | undefined;
    list(category?: CommandCategory): ReadonlyMap<string, CommandHandler>;
    execute(name: string, args: string[], context: CommandContext): Promise<CommandResult>;
}
```

### Connection Commands

| Command | Description |
|---------|-------------|
| `.connect <id> <type> [config...]` | Create and connect |
| `.disconnect <id>` | Disconnect and remove |
| `.enable <id>` | Resume suspended connection |
| `.disable <id>` | Suspend without removing |
| `.reconnect <id>` | Force reconnection |
| `.connections [list\|status\|health]` | Show all connections |
| `.connection <id> [config]` | Show or update config |
| `.connect-template <name>` | Create from preset template |

---

## Connection Adapters

### `src/io/connections/base-connection.ts`

```typescript
export abstract class BaseConnection implements Connection {
    protected state: ConnectionState = 'idle';
    protected messageHandler?: (message: IOMessage) => Promise<void>;
    protected stateChangeHandlers: Set<(state: ConnectionState, prev: ConnectionState) => void> = new Set();
    protected errorHandlers: Set<(error: ConnectionError) => void> = new Set();
    protected readonly eventBus: EventBus;
    protected readonly logger: Logger;
    protected readonly config: ConnectionConfig;
    protected readonly retryPolicy: RetryPolicy;
    protected readonly circuitBreaker: CircuitBreaker;
    protected readonly rateLimiter: RateLimiter;

    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly type: string;
    abstract readonly capabilities: ConnectionCapabilities;

    constructor(config: ConnectionConfig, deps: ConnectionDeps);

    abstract connect(): Promise<void>;
    abstract disconnect(reason?: string): Promise<void>;
    abstract send(target: string, text: string, options?: SendOptions): Promise<void>;

    // Provided: reconnect, broadcast, onMessage, onStateChange, onError,
    // getStatus, healthCheck, reconfigure, setState, emitMessage, emitError, withRetry
}
```

### Connection Implementations

| Connection | Type | Key Characteristics |
|------------|------|---------------------|
| `CLIConnection` | `cli` | Readline, banner, history save |
| `IRCConnection` | `irc` | Real IRC or embedded, 512 char limit, flood protection |
| `WSConnection` | `websocket` | Server mode, per-client connection, subscriptions, heartbeat |
| `HTTPConnection` | `http` | REST + SSE, auth, CORS, OpenAPI spec |
| `MCPConnection` | `mcp` | stdio or SSE transport, tool/resource/prompt mapping |

### Future Connections (plug in via factory)

Discord, Slack, Matrix, Telegram, Email, Webhook, RSS, gRPC, ActivityPub, stdio — each implements `Connection` and registers via `ConnectionFactory`.

---

## Agent

### `src/agent/Agent.ts`

```typescript
export class Agent {
    private readonly nar: NAR;
    private readonly connectionManager: ConnectionManager;
    private readonly messageRouter: MessageRouter;
    private readonly commandRegistry: CommandRegistry;
    private readonly eventBus: EventBus;
    private readonly logger: Logger;
    private running = false;

    constructor(nar: NAR);

    // Connection management
    addConnection(config: ConnectionConfig): Promise<Connection>;
    removeConnection(id: string, reason?: string): Promise<void>;
    enableConnection(id: string): Promise<void>;
    disableConnection(id: string): Promise<void>;
    reconnectConnection(id: string): Promise<void>;
    getConnection(id: string): Connection | undefined;
    getConnections(): ReadonlyMap<string, Connection>;

    // Lifecycle
    start(): Promise<void>;
    stop(reason?: string): Promise<void>;

    // Messaging
    sendTo(connectionId: string, target: string, text: string): Promise<void>;
    broadcast(text: string, options?: BroadcastOptions): Promise<void>;

    // Autonomous behavior
    requestConnection(type: string, config: Record<string, unknown>): Promise<void>;
    suggestDisconnection(connectionId: string, reason: string): Promise<void>;

    // State
    saveState(path?: string): Promise<void>;
    loadState(path?: string): Promise<void>;
}
```

### Autonomous Connection Management

The Agent manages connections through:

1. **Event-driven triggers** — EventBus events trigger connection decisions
2. **Belief-based reasoning** — NAR derives beliefs about connection health → action
3. **Goal pursuit** — Agent pursues goals requiring specific connections
4. **Self-monitoring** — Agent observes its connection topology and adapts

```
// Agent derives: (needs-connection irc-freenode).  → autonomous connector creates it
// Agent derives: (connection-health irc-freenode degraded). → monitor triggers reconnect
// Agent derives: (disconnect irc-freenode). → connector gracefully disconnects
```

---

## Observability

### `src/io/observability/metrics.ts`

```typescript
export class IOMetrics {
    connections: { total: number; active: number; errors: number };
    messages: {
        received: number; sent: number; dropped: number; errors: number;
        byClassification: Record<MessageClassification, number>;
        byConnection: Record<string, { received: number; sent: number }>;
    };
    latency: { avg: number; p50: number; p95: number; p99: number };
    backpressure: { active: boolean; queueSize: number; dropped: number };
    export(format: 'json' | 'prometheus' | 'statsd'): string;
}
```

### `src/io/observability/tracing.ts`

Integrates with existing `nar/trace` system. Adds connection-aware tracing with `ConnectionTrace` containing traceId, connectionId, messageId, and spans.

### `src/io/observability/health-monitor.ts`

Periodic health checks at configurable interval. Emits `connection:health:degraded` / `connection:health:restored` events.

### `src/io/observability/audit-log.ts`

Logs all significant events: connection lifecycle, commands executed, errors. Queryable and exportable.

---

## Security

### `src/io/security/auth.ts`

```typescript
export interface AuthProvider {
    readonly type: string;
    authenticate(credentials: AuthCredentials): Promise<AuthResult>;
    validate(token: string): Promise<AuthResult>;
}

export type Permission = 'message:send' | 'message:receive'
    | 'command:execute' | 'connection:manage' | 'admin';
```

### `src/io/security/rate-limiter.ts`

Sliding window rate limiter per identity. Returns `allowed`, `remaining`, `resetAt`, `retryAfter`.

### `src/io/security/input-validator.ts`

Validates message length, encoding, blocks patterns, optional sanitization.

---

## Configuration

### `src/io/config.ts`

```typescript
export interface IOConfig {
    connections: Record<string, ConnectionConfig>;
    router: RouterConfig;
    commands: CommandConfig;
    security: SecurityConfig;
    observability: ObservabilityConfig;
    resilience: ResilienceConfig;
}

export class ConfigManager {
    static load(source?: ConfigSource): Promise<ConfigManager>;
    get(): IOConfig;
    update(patch: Partial<IOConfig>): Promise<void>;     // triggers hot-reload
    onChange(handler: ConfigChangeHandler): void;
    validate(): ValidationResult;
}
```

### Connection Templates

```typescript
export const TEMPLATES: Record<string, ConnectionTemplate> = {
    'irc-minimal': { type: 'irc', config: { server: '127.0.0.1', port: 6667, channel: '#test' } },
    'irc-standard': { type: 'irc', config: { server: 'irc.libera.chat', port: 6697, channel: '#senars', tls: true } },
    'ws-api': { type: 'websocket', config: { port: 8765, maxClients: 100 } },
    'http-api': { type: 'http', config: { port: 8080, enableCors: true } },
    'mcp-stdio': { type: 'mcp', config: { transport: 'stdio' } },
};
```

---

## File Structure

```
src/
├── io/
│   ├── index.ts                     # Public API
│   ├── types.ts                     # Connection, IOMessage, errors, factories
│   ├── connection-manager.ts        # Dynamic lifecycle
│   ├── router.ts                    # Middleware chain + backpressure
│   ├── event-bus.ts                 # Async events
│   ├── config.ts                    # Config + hot-reload + templates
│   ├── factory.ts                   # createAgent() entry point
│   │
│   ├── middleware/
│   │   ├── classifier.ts
│   │   ├── command-dispatcher.ts
│   │   ├── nar-handler.ts
│   │   ├── url-filter.ts
│   │   ├── response-formatter.ts
│   │   ├── rate-limiter.ts
│   │   ├── input-validator.ts
│   │   ├── streaming-handler.ts
│   │   ├── error-handler.ts
│   │   ├── context-enricher.ts
│   │   └── correlation-tracker.ts
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
│   ├── connections/
│   │   ├── base-connection.ts       # Abstract: retry, circuit breaker, rate limit
│   │   ├── cli-connection.ts
│   │   ├── irc-connection.ts
│   │   ├── ws-connection.ts
│   │   ├── http-connection.ts
│   │   └── mcp-connection.ts
│   │
│   ├── handlers/
│   │   ├── connection-monitor.ts
│   │   ├── cross-connection-relay.ts
│   │   ├── audit-logger.ts
│   │   └── autonomous-connector.ts
│   │
│   ├── observability/
│   │   ├── metrics.ts
│   │   ├── tracing.ts
│   │   ├── health-monitor.ts
│   │   └── audit-log.ts
│   │
│   └── security/
│       ├── auth.ts
│       ├── rate-limiter.ts
│       └── input-validator.ts
│
├── agent/
│   ├── Agent.ts                     # Uses ConnectionManager, MessageRouter, EventBus
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

### Deleted (replaced by `src/io/`)

- `src/bot/` — entire directory
- `src/cli/command-handlers.ts`
- `src/cli/pipeline.ts`
- `src/cli/commands/` — entire directory
- `src/agent/http-server.ts`
- `src/agent/websocket-server.ts`
- `Embodiment` interface — replaced by `Connection`

---

## Implementation Order

1. **`src/io/types.ts`** — Core interfaces
2. **`src/io/event-bus.ts`** — Event system
3. **`src/io/connection-manager.ts`** — Connection lifecycle
4. **`src/io/router.ts`** — Message router + backpressure
5. **`src/io/commands/registry.ts`** — Command system
6. **`src/io/connections/base-connection.ts`** — Abstract base
7. **`src/io/connections/irc-connection.ts`** — First concrete connection
8. **`src/io/connections/cli-connection.ts`** — CLI connection
9. **`src/io/connections/ws-connection.ts`** — WebSocket
10. **`src/io/connections/http-connection.ts`** — HTTP
11. **`src/io/connections/mcp-connection.ts`** — MCP
12. **`src/io/middleware/*.ts`** — All middleware
13. **`src/io/commands/*.ts`** — All command implementations
14. **`src/io/handlers/*.ts`** — Event handlers
15. **`src/io/observability/*.ts`** — Metrics, tracing, health, audit
16. **`src/io/security/*.ts`** — Auth, rate limiting, validation
17. **`src/io/config.ts`** — Configuration + templates
18. **`src/io/factory.ts`** — `createAgent()` entry point
19. **`src/agent/Agent.ts`** — Update to use new IO layer
20. **`src/cli/repl.ts`** — Thin wrapper
21. **`src/bin/bot.ts`** — Bot entry point
22. **Delete** — `src/bot/`, old CLI commands, old agent servers
23. **Refactor** — `src/api/registry.ts` remove singleton
24. **Update** — `src/index.ts` exports

---

## Testing

| Scope | What |
|-------|------|
| Unit | ConnectionManager, MessageRouter, EventBus, Classifier, each Connection lifecycle, CommandRegistry, RateLimiter, CircuitBreaker, BackpressureController |
| Integration | Agent with multiple connections, message routing, cross-connection relay, autonomous management, hot-reload config, health monitoring |
| E2E | CLI session, IRC session, WebSocket session, HTTP session, multi-connection relay |
| Performance | 100+ connections, 10k msg/sec, backpressure under load, memory over time |
