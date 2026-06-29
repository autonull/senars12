/**
 * MCP Adapter Types
 * Aligned with Model Context Protocol specification
 */

import type {JSONSchema7} from 'json-schema';

// ---------------------------------------------------------------------------
// Shared MCP Tool types (used by both api/ and io/ layers)
// ---------------------------------------------------------------------------

export interface MCPToolResult {
    content: Array<{
        type: string;
        text: string;
    }>;
    isError?: boolean;
}

export interface MCPToolCall {
    name: string;
    arguments?: Record<string, unknown>;
}

/**
 * Abstract capability descriptor (aligned with MCP tool schema)
 */
export interface CapabilityDescriptor {
    /** Unique identifier for agent discovery */
    name: string;
    /** Human-readable guidance */
    description?: string;
    /** JSON Schema Draft 7 compliant input schema */
    inputSchema: JSONSchema7;
    /** Optional: enables structured response parsing */
    outputSchema?: JSONSchema7;
    /** Non-protocol hints for UX/tooling */
    metadata?: {
        category?: string;
        longRunning?: boolean;
        requiresContext?: boolean;
    };
}

/**
 * Validation result from schema transformer
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    data?: unknown;
}

/**
 * Abstract execution context (injected per request)
 */
export interface ExecutionContext {
    /** For cancellation propagation */
    signal?: AbortSignal;
    /** For long-running operations */
    reportProgress?: (p: ProgressUpdate) => void;
    /** For observability metadata */
    sendLog?: (entry: LogEntry) => void;
    /** Request-scoped context */
    metadata?: Record<string, unknown>;
}

/**
 * Progress update structure
 */
export interface ProgressUpdate {
    token: string | number;
    current: number;
    total?: number;
    message?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Log entry structure
 */
export interface LogEntry {
    level: 'debug' | 'info' | 'warn' | 'error';
    logger?: string;
    message: string;
    data?: Record<string, unknown>;
    timestamp?: number;
}

/**
 * Execution result wrapper
 */
export interface ExecutionResult {
    success: boolean;
    data?: unknown;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}

/**
 * MCP content types (per spec)
 */
export type MCPContent = TextContent | ImageContent | ResourceContent | EmbeddedResource;

export interface TextContent {
    type: 'text';
    text: string;
}

export interface ImageContent {
    type: 'image';
    data: string;
    mimeType: string;
}

export interface ResourceContent {
    type: 'resource';
    resource: {
        uri: string;
        mimeType?: string;
        text?: string;
        blob?: string;
    };
}

export interface EmbeddedResource {
    type: 'resource';
    resource: {
        uri: string;
        name: string;
        description?: string;
        mimeType?: string;
        text?: string;
        blob?: string;
    };
}

/**
 * Resource descriptor for MCP resource primitive
 */
export interface ResourceDescriptor {
    uriTemplate: string;
    name: string;
    description?: string;
    mimeType?: string;
    listable?: boolean;
}

/**
 * Prompt template for MCP prompt primitive
 */
export interface PromptTemplate {
    name: string;
    description?: string;
    arguments?: PromptArgument[];
}

/**
 * Prompt argument definition
 */
export interface PromptArgument {
    name: string;
    description?: string;
    required?: boolean;
    schema?: JSONSchema7;
}

/**
 * MCP message structure for prompts
 */
export interface MCPMessage {
    role: 'user' | 'assistant' | 'system';
    content: MCPContent[];
}
