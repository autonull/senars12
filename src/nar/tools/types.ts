export interface Tool {
    readonly name: string;
    readonly description: string;
    readonly parameters: Schema;
    capabilities?: ToolCapabilities;

    execute(args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult>;
}

export interface ToolCapabilities {
    pure?: boolean;
    idempotent?: boolean;
    readOnly?: boolean;
    requiresPermissions?: string[];
    timeout?: number;
    maxConcurrency?: number;
}

export interface ToolContext {
    permissions?: Set<string>;
    budget?: ToolBudget;
    parent?: ToolContext;
    chainId?: string;
}

export interface ToolBudget {
    maxExecutions?: number;
    maxTotalDuration?: number;
    executions?: number;
    totalDuration?: number;
}

export interface ToolRegistry {
    register(tool: Tool): void;

    unregister(name: string): void;

    get(name: string): Tool | undefined;

    list(filter?: ToolFilter): Tool[];

    execute(name: string, args: Record<string, unknown>, context?: ToolContext): Promise<ToolResult>;

    executeChain(chain: ToolChainStep[]): Promise<ToolChainResult>;

    getCapabilities(name: string): ToolCapabilities | undefined;
}

export interface ToolFilter {
    tags?: string[];
    permissions?: string[];
    readOnly?: boolean;
}

export interface ToolChainStep {
    tool: string;
    args: Record<string, unknown>;
    outputAs?: string;
}

export interface ToolChainResult {
    success: boolean;
    results: ToolResult[];
    finalContent?: unknown;
    error?: string;
}

export interface ToolResult {
    success: boolean;
    content: unknown;
    error?: string;
    partial?: boolean;
    metadata?: Record<string, unknown>;
}

export interface Schema {
    type: 'object';
    properties: Record<string, SchemaProperty>;
    required?: string[];
}

export interface SchemaProperty {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description?: string;
    items?: SchemaProperty;
    properties?: Record<string, SchemaProperty>;
    minimum?: number;
    maximum?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    enum?: unknown[];
}

export interface ToolEvent {
    type: 'tool_call' | 'tool_result' | 'tool_error';
    name: string;
    args?: Record<string, unknown>;
    result?: ToolResult;
    timestamp: number;
    duration?: number;
    context?: ToolContext;
}

export interface ToolStatistics {
    name: string;
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    totalDuration: number;
    averageDuration: number;
    lastCalled?: number;
}

export const errorResult = (error: unknown): ToolResult => ({
    success: false,
    content: null,
    error: error instanceof Error ? error.message : String(error)
});

export const createToolEvent = (
    type: ToolEvent['type'],
    name: string,
    startTime: number,
    duration: number,
    extras?: Partial<ToolEvent>
): ToolEvent => ({
    type, name, timestamp: startTime, duration, ...extras
});
