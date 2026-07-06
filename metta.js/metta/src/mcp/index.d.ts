/**
 * TypeScript definitions for MeTTa MCP Integration
 * Provides type safety for MCP client management and tool operations
 */

import {EventEmitter} from 'events';

// ============================================================================
// Types
// ============================================================================

/**
 * MCP Client Manager options
 */
export interface McpClientManagerOptions {
    /** Timeout for tool calls in milliseconds (default: 30000) */
    timeout?: number;
    /** Maximum retry attempts (default: 3) */
    maxRetries?: number;
    /** Base delay between retries in milliseconds (default: 1000) */
    retryDelay?: number;
}

/**
 * Connection status for a server
 */
export interface ConnectionStatus {
    /** Whether currently connected */
    connected: boolean;
    /** Whether currently connecting */
    connecting?: boolean;
    /** Timestamp when connected */
    connectedAt?: number;
    /** Timestamp when disconnected */
    disconnectedAt?: number;
    /** Transport type used */
    transport?: 'stdio' | 'sse';
    /** Cached tools list */
    tools?: MCPTool[];
    /** Timestamp when tools were cached */
    toolsUpdatedAt?: number;
    /** Last error message if any */
    lastError?: string;
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
    /** Tool name */
    name: string;
    /** Tool description */
    description?: string;
    /** JSON Schema for input parameters */
    inputSchema?: Record<string, unknown>;
}

/**
 * MCP Tool call result
 */
export interface MCPToolResult {
    /** Result content */
    content: Array<{
        type: string;
        text?: string;
        json?: unknown;
    }>;
    /** Whether this is an error result */
    isError?: boolean;
}

/**
 * Event: Connection established
 */
export interface ConnectedEvent {
    key: string;
    transport: 'stdio' | 'sse';
}

/**
 * Event: Connection lost
 */
export interface DisconnectedEvent {
    key: string;
    reason?: string;
}

/**
 * Event: Error occurred
 */
export interface ErrorEvent {
    key: string;
    error: Error;
    source?: 'transport' | 'client';
}

/**
 * Event: Tool called successfully
 */
export interface ToolCalledEvent {
    key: string;
    toolName: string;
    params: Record<string, unknown>;
    result: MCPToolResult;
}

/**
 * Event: Tool call failed
 */
export interface ToolErrorEvent {
    key: string;
    toolName: string;
    params?: Record<string, unknown>;
    error: Error;
}

/**
 * Manager statistics
 */
export interface ManagerStats {
    /** Number of connected clients */
    connectedClients: number;
    /** List of connected server keys */
    servers: string[];
    /** Status for each server */
    status: Record<string, ConnectionStatus>;
    /** Uptime information */
    uptime: {
        oldest: number;
    };
}

// ============================================================================
// McpClientManager
// ============================================================================

/**
 * MCP Client Manager - Manages connections to MCP servers
 *
 * @example
 * ```typescript
 * const manager = new McpClientManager({ timeout: 30000 });
 *
 * // Connect to a server
 * await manager.connect('fs', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);
 *
 * // Call a tool
 * const result = await manager.callTool('fs', 'read_file', { path: '/tmp/data.txt' });
 *
 * // Listen for events
 * manager.on('connected', ({ key }) => console.log(`Connected to ${key}`));
 * ```
 */
export class McpClientManager extends EventEmitter {
    constructor(options?: McpClientManagerOptions);

    /**
     * Get connection status for a server
     */
    getStatus(key: string): ConnectionStatus | null;

    /**
     * Get all connected server keys
     */
    getConnectedServers(): string[];

    /**
     * Check if a server is connected
     */
    isConnected(key: string): boolean;

    /**
     * Connect to an MCP server
     * @param key - Server identifier
     * @param commandOrUrl - Command (stdio) or URL (SSE)
     * @param args - Arguments for stdio transport
     * @param transport - Transport type
     */
    connect(
        key: string,
        commandOrUrl: string,
        args?: string[],
        transport?: 'stdio' | 'sse'
    ): Promise<unknown>;

    /**
     * Call a tool with automatic retry
     * @param key - Server identifier
     * @param toolName - Tool name
     * @param params - Tool parameters
     * @param retries - Number of retry attempts
     */
    callTool(
        key: string,
        toolName: string,
        params?: Record<string, unknown>,
        retries?: number
    ): Promise<MCPToolResult>;

    /**
     * List available tools for a server
     */
    listTools(key: string): Promise<{ tools: MCPTool[] }>;

    /**
     * Get cached tools for a server
     */
    getCachedTools(key: string): MCPTool[] | null;

    /**
     * Disconnect from a server
     */
    disconnect(key: string): Promise<void>;

    /**
     * Disconnect from all servers
     */
    disconnectAll(): Promise<void>;

    /**
     * Get manager statistics
     */
    getStats(): ManagerStats;

    // Event methods (from EventEmitter)
    on(event: 'connected', listener: (event: ConnectedEvent) => void): this;
    on(event: 'disconnected', listener: (event: DisconnectedEvent) => void): this;
    on(event: 'error', listener: (event: ErrorEvent) => void): this;
    on(event: 'tool-called', listener: (event: ToolCalledEvent) => void): this;
    on(event: 'tool-error', listener: (event: ToolErrorEvent) => void): this;
    on(event: 'debug', listener: (message: string) => void): this;
    on(event: string, listener: (...args: unknown[]) => void): this;

    off(event: string, listener: (...args: unknown[]) => void): this;

    emit(event: string, ...args: unknown[]): boolean;
}

// ============================================================================
// MeTTaMCPManager
// ============================================================================

/**
 * MeTTa Interpreter interface (simplified)
 */
export interface MeTTaInterpreter {
    space: {
        add(atom: unknown): void;
        addRule(pattern: unknown, replacement: unknown): void;
    };

    load(code: string): void;

    run(code: string): unknown;

    query(pattern: string, template: string): unknown;
}

/**
 * MeTTaMCPManager options
 */
export interface MeTTaMCPManagerOptions extends McpClientManagerOptions {
    /** Whether to auto-load mcp-std.metta (default: true) */
    loadStdlib?: boolean;
}

/**
 * MeTTaMCPManager - High-level MCP manager for MeTTa
 *
 * @example
 * ```typescript
 * const mcp = new MeTTaMCPManager(interpreter);
 *
 * // Connect and auto-discover tools
 * await mcp.connect('fs', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);
 *
 * // Check connection status
 * if (mcp.isConnected('fs')) {
 *   console.log('Filesystem server connected');
 * }
 * ```
 */
export class MeTTaMCPManager {
    constructor(interpreter: MeTTaInterpreter, options?: MeTTaMCPManagerOptions);

    /**
     * Connect to an MCP server via stdio
     */
    connect(key: string, command: string, args?: string[]): Promise<void>;

    /**
     * Connect to an MCP server via SSE
     */
    connectSSE(key: string, url: string): Promise<void>;

    /**
     * Disconnect from a server or all servers
     */
    disconnect(key?: string | null): Promise<void>;

    /**
     * Check if a server is connected
     */
    isConnected(key: string): boolean;

    /**
     * Get connection status
     */
    getStatus(key: string): ConnectionStatus | null;

    /**
     * Get all connected servers
     */
    getConnectedServers(): string[];

    /**
     * Get cached tools for a server
     */
    getCachedTools(key: string): MCPTool[] | null;

    /**
     * Get manager statistics
     */
    getStats(): ManagerStats;

    /**
     * Call a tool directly
     */
    callTool(key: string, toolName: string, params?: Record<string, unknown>): Promise<MCPToolResult>;

    /**
     * List tools for a server
     */
    listTools(key: string): Promise<{ tools: MCPTool[] }>;

    /**
     * Add event listener
     */
    on(event: string, listener: (...args: unknown[]) => void): this;

    /**
     * Remove event listener
     */
    off(event: string, listener: (...args: unknown[]) => void): this;

    /**
     * Get the underlying McpClientManager
     */
    getManager(): McpClientManager;
}

/**
 * Create a MeTTaMCPManager instance
 */
export function createMCPManager(
    interpreter: MeTTaInterpreter,
    options?: MeTTaMCPManagerOptions
): MeTTaMCPManager;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Retry options
 */
export interface RetryOptions {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (info: { attempt: number; error: Error; delay: number }) => void;
}

/**
 * Cache options
 */
export interface CacheOptions {
    ttlMs?: number;
    keyFn?: (args: unknown[]) => string;
    cache?: Map<string, { result: unknown; timestamp: number }>;
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
    failureThreshold?: number;
    successThreshold?: number;
    timeout?: number;
}

/**
 * Logging options
 */
export interface LoggingOptions {
    name?: string;
    logger?: Console;
    logInput?: boolean;
    logOutput?: boolean;
}

/**
 * Wrap a function with retry logic
 */
export function withRetry<T extends (...args: unknown[]) => Promise<unknown>>(
    toolFn: T,
    options?: RetryOptions
): T;

/**
 * Wrap a function with timeout
 */
export function withTimeout<T extends (...args: unknown[]) => Promise<unknown>>(
    toolFn: T,
    timeoutMs?: number
): T;

/**
 * Wrap a function with caching
 */
export function withCache<T extends (...args: unknown[]) => Promise<unknown>>(
    toolFn: T,
    options?: CacheOptions
): T;

/**
 * Wrap a function with circuit breaker
 */
export function withCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
    toolFn: T,
    options?: CircuitBreakerOptions
): T;

/**
 * Compose multiple async functions into a pipeline
 */
export function pipeline<T>(...fns: Array<(input: T) => Promise<T>>): (input: T) => Promise<T>;

/**
 * Run multiple functions in parallel
 */
export function parallel<T, R>(
    ...fns: Array<(context: T) => Promise<R>>
): (context: T) => Promise<R[]>;

/**
 * Create a conditional executor
 */
export function conditional<T>(
    predicate: (...args: T[]) => Promise<boolean>,
    thenFn: (...args: T[]) => Promise<unknown>,
    elseFn?: (...args: T[]) => Promise<unknown>
): (...args: T[]) => Promise<unknown>;

/**
 * Wrap a function with logging
 */
export function withLogging<T extends (...args: unknown[]) => Promise<unknown>>(
    toolFn: T,
    options?: LoggingOptions
): T;

/**
 * Create a batch executor
 */
export function batch<T, R>(
    toolFn: (item: T) => Promise<R>,
    batchSize?: number,
    delayMs?: number
): (items: T[]) => Promise<R[]>;

/**
 * Create a rate-limited executor
 */
export function rateLimit<T extends (...args: unknown[]) => Promise<unknown>>(
    toolFn: T,
    limit?: number,
    windowMs?: number
): T;

/**
 * Transform tool result
 */
export function transformResult<T, R>(
    toolFn: (...args: unknown[]) => Promise<T>,
    transformer: (result: T) => R
): (...args: unknown[]) => Promise<R>;

/**
 * Create a fallback chain
 */
export function fallbackChain<T>(
    ...fns: Array<(...args: unknown[]) => Promise<T>>
): (...args: unknown[]) => Promise<T>;

/**
 * Wrap a function with validation
 */
export function withValidation<T extends (...args: unknown[]) => Promise<unknown>>(
    toolFn: T,
    validator: (...args: unknown[]) => boolean
): T;

/**
 * Create a memoized function
 */
export function memoize<T extends (...args: unknown[]) => Promise<unknown>>(
    toolFn: T,
    keyFn?: (...args: unknown[]) => string,
    cache?: Map<string, unknown>
): T;

/**
 * Tool execution context for maintaining state
 */
export class ToolContext {
    constructor(initialState?: Record<string, unknown>);

    get<T>(key: string): T | undefined;

    set(key: string, value: unknown): this;

    record(toolName: string, input: unknown, output: unknown, error?: Error): this;

    getHistory(limit?: number): Array<{
        tool: string;
        input: unknown;
        output: unknown;
        error: Error | null;
        timestamp: number;
    }>;

    clear(): this;
}

// ============================================================================
// Default exports
// ============================================================================

export default {
    McpClientManager,
    MeTTaMCPManager,
    createMCPManager,
    withRetry,
    withTimeout,
    withCache,
    withCircuitBreaker,
    pipeline,
    parallel,
    conditional,
    withLogging,
    batch,
    rateLimit,
    transformResult,
    fallbackChain,
    withValidation,
    memoize,
    ToolContext
};
