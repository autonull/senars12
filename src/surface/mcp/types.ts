/**
 * MCP Types — Model Context Protocol type definitions.
 *
 * Generated from genome schemas; verified by schema:drift gate.
 */

/** MCP server configuration. */
export interface MCPServerConfig {
  /** Server name. */
  name: string;
  /** Server version. */
  version: string;
  /** Protocol version. */
  protocolVersion: '2025-06-18' | '2026-07-28';
  /** Capabilities. */
  capabilities: MCPCapabilities;
  /** Transport config. */
  transport: MCPTransportConfig;
}

/** MCP server instance. */
export interface MCPServer {
  /** Server config. */
  config: MCPServerConfig;
  /** Registered tools. */
  tools: Map<string, MCPTool>;
  /** Registered resources. */
  resources: Map<string, MCPResource>;
  /** Registered prompts. */
  prompts: Map<string, MCPPrompt>;
  /** Task handles for long-running operations. */
  tasks: Map<string, MCPTask>;
}

/** MCP task handle. */
export interface MCPTask {
  /** Task ID. */
  id: string;
  /** Tool name. */
  tool: string;
  /** Arguments. */
  arguments: Record<string, unknown>;
  /** Status. */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Result. */
  result?: unknown;
  /** Error. */
  error?: string;
  /** Created at. */
  createdAt: number;
  /** Updated at. */
  updatedAt: number;
  /** TTL (ms). */
  ttlMs: number;
}

/** MCP capabilities. */
export interface MCPCapabilities {
  /** Tools support. */
  tools: boolean;
  /** Resources support. */
  resources: boolean;
  /** Prompts support. */
  prompts: boolean;
  /** Logging support. */
  logging: boolean;
  /** Completion support. */
  completions: boolean;
}

/** MCP transport configuration. */
export interface MCPTransportConfig {
  /** Transport type. */
  type: 'stdio' | 'http' | 'ws' | 'sse';
  /** Host (for http/ws). */
  host?: string;
  /** Port (for http/ws). */
  port?: number;
  /** Path (for http/sse). */
  path?: string;
  /** Server config. */
  serverConfig?: {
    name: string;
    version: string;
    protocolVersion: '2025-06-18' | '2026-07-28';
  };
  /** Transport mode. */
  mode?: 'stdio' | 'http' | 'ws';
  /** HTTP/WS config (if applicable). */
  httpConfig?: { host: string; port: number; path?: string };
}

/** MCP tool definition. */
export interface MCPTool {
  /** Tool name. */
  name: string;
  /** Tool description. */
  description: string;
  /** Input schema (JSON Schema). */
  inputSchema: {
    type: 'object';
    properties: Record<string, JSONSchemaProperty>;
    required: string[];
  };
  /** Tool handler. */
  handler: (args: Record<string, unknown>) => Promise<MCPToolResult>;
}

/** JSON Schema property. */
export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  enum?: unknown[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

/** MCP tool result. */
export interface MCPToolResult {
  /** Content. */
  content: MCPContent[];
  /** Is error. */
  isError?: boolean;
}

/** MCP content. */
export type MCPContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; resource: MCPResourceRef };

/** MCP resource reference. */
export interface MCPResourceRef {
  uri: string;
  text?: string;
  blob?: string;
}

/** MCP resource definition. */
export interface MCPResource {
  /** Resource URI. */
  uri: string;
  /** Resource name. */
  name: string;
  /** Description. */
  description?: string;
  /** MIME type. */
  mimeType?: string;
}

/** MCP prompt definition. */
export interface MCPPrompt {
  /** Prompt name. */
  name: string;
  /** Prompt description. */
  description?: string;
  /** Arguments. */
  arguments?: MCPPromptArgument[];
  /** Handler. */
  handler: (args: Record<string, unknown>) => Promise<MCPPromptResult>;
}

/** MCP prompt argument. */
export interface MCPPromptArgument {
  /** Argument name. */
  name: string;
  /** Description. */
  description?: string;
  /** Required. */
  required?: boolean;
}

/** MCP prompt result. */
export interface MCPPromptResult {
  /** Description. */
  description?: string;
  /** Messages. */
  messages: MCPPromptMessage[];
}

/** MCP prompt message. */
export interface MCPPromptMessage {
  /** Role. */
  role: 'user' | 'assistant' | 'system';
  /** Content. */
  content: MCPContent;
}

/** MCP request. */
export interface MCPRequest {
  /** JSON-RPC version. */
  jsonrpc: '2.0';
  /** Request ID. */
  id: string | number;
  /** Method. */
  method: string;
  /** Parameters. */
  params?: Record<string, unknown>;
}

/** MCP response. */
export interface MCPResponse {
  /** JSON-RPC version. */
  jsonrpc: '2.0';
  /** Request ID. */
  id: string | number;
  /** Result. */
  result?: unknown;
  /** Error. */
  error?: MCPError;
}

/** MCP error. */
export interface MCPError {
  /** Error code. */
  code: number;
  /** Error message. */
  message: string;
  /** Error data. */
  data?: unknown;
}

/** MCP notification. */
export interface MCPNotification {
  /** JSON-RPC version. */
  jsonrpc: '2.0';
  /** Method. */
  method: string;
  /** Parameters. */
  params?: Record<string, unknown>;
}

/** Initialize request params. */
export interface InitializeParams {
  /** Protocol version. */
  protocolVersion: string;
  /** Client capabilities. */
  capabilities: MCPCapabilities;
  /** Client info. */
  clientInfo: { name: string; version: string };
}

/** Initialize response. */
export interface InitializeResult {
  /** Protocol version. */
  protocolVersion: string;
  /** Server capabilities. */
  capabilities: MCPCapabilities;
  /** Server info. */
  serverInfo: { name: string; version: string };
}

/** List tools params. */
export interface ListToolsParams {
  /** Cursor for pagination. */
  cursor?: string;
}

/** List tools result. */
export interface ListToolsResult {
  /** Tools. */
  tools: MCPTool[];
  /** Next cursor. */
  nextCursor?: string;
}

/** Call tool params. */
export interface CallToolParams {
  /** Tool name. */
  name: string;
  /** Arguments. */
  arguments?: Record<string, unknown>;
}

/** List resources params. */
export interface ListResourcesParams {
  /** Cursor for pagination. */
  cursor?: string;
}

/** List resources result. */
export interface ListResourcesResult {
  /** Resources. */
  resources: MCPResource[];
  /** Next cursor. */
  nextCursor?: string;
}

/** Read resource params. */
export interface ReadResourceParams {
  /** Resource URI. */
  uri: string;
}

/** Read resource result. */
export interface ReadResourceResult {
  /** Contents. */
  contents: MCPResourceContent[];
}

/** Resource content. */
export interface MCPResourceContent {
  /** URI. */
  uri: string;
  /** MIME type. */
  mimeType?: string;
  /** Text content. */
  text?: string;
  /** Blob content (base64). */
  blob?: string;
}

/** List prompts params. */
export interface ListPromptsParams {
  /** Cursor for pagination. */
  cursor?: string;
}

/** List prompts result. */
export interface ListPromptsResult {
  /** Prompts. */
  prompts: MCPPrompt[];
  /** Next cursor. */
  nextCursor?: string;
}

/** Get prompt params. */
export interface GetPromptParams {
  /** Prompt name. */
  name: string;
  /** Arguments. */
  arguments?: Record<string, unknown>;
}