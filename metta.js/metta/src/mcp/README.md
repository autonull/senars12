# MeTTa MCP Integration

Complete implementation of the [MeTTa MCP Integration Plan](../../metta/MCP.md).

## Architecture

This implementation supports **two distinct use cases**:

| Use Case                | Direction                       | Description                                                |
|-------------------------|---------------------------------|------------------------------------------------------------|
| **MeTTa consumes MCPs** | External tools → MeTTa          | MeTTa's reduction rules decide which tools to invoke       |
| **SeNARS provides MCP** | MeTTa/NAR → external AI clients | Claude, Cursor, and any MCP host can call SeNARS reasoning |

## Files

```
metta/src/mcp/
├── McpClientManager.js   # Enhanced client with events, status tracking, retry
├── mcp-std.metta         # MeTTa standard library for tool discovery & calling
├── index.js              # MeTTaMCPManager unified entry point
├── utils.js              # Utility helpers (retry, cache, circuit breaker, etc.)
├── index.d.ts            # TypeScript definitions
├── README.md             # This file
└── IMPLEMENTATION_SUMMARY.md  # Implementation details

metta/tests/mcp/
└── mcp.test.js           # Comprehensive unit tests

agent/src/mcp/
├── Server.js             # SeNARS as MCP provider (includes metta-eval)
├── Client.js             # Basic MCP client (Stdio)
├── Safety.js             # PII scrubbing (Narsese-safe)
├── index.js              # MCPManager + convenience exports
└── start-server.js       # Entry point for Claude Desktop etc.
```

## Installation

```bash
npm install @modelcontextprotocol/sdk
```

## Use Case A: MeTTa Consuming MCP Tools

### Quick Start

```javascript
import { MeTTaInterpreter } from '@senars/metta';
import { MeTTaMCPManager } from '@senars/metta/mcp';

const interp = new MeTTaInterpreter();
const mcp = new MeTTaMCPManager(interp);

// Connect to MCP servers
await mcp.connect('fs', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);
await mcp.connect('search', 'npx', ['-y', '@modelcontextprotocol/server-brave-search']);

// Check connection status
console.log('Connected servers:', mcp.getConnectedServers());

// MeTTa reasoning uses the generic mcp-call wrapper natively
interp.run(`
  (= (research $topic)
     (let* (($web    (mcp-call "search" "brave_search" (object (: query $topic))))
            ($cached (mcp-call "fs" "read_file" (object (: path (cache-path $topic)))))
       (if (cache-fresh? $topic) $cached $web)))
`);
```

### Event Handling

```javascript
// Listen for MCP events
mcp.on('connected', ({ key, transport }) => {
  console.log(`Connected to ${key} via ${transport}`);
});

mcp.on('tool-called', ({ key, toolName, result }) => {
  console.log(`Tool ${toolName} called on ${key}:`, result);
});

mcp.on('tool-error', ({ key, toolName, error }) => {
  console.error(`Tool ${toolName} failed:`, error.message);
});
```

### Using Utility Wrappers

```javascript
import { withRetry, withTimeout, withCache, withCircuitBreaker } from '@senars/metta/mcp/utils';

// Get the underlying manager
const manager = mcp.getManager();

// Wrap tool calls with retry logic
const safeCall = withRetry(
  (params) => manager.callTool('fs', 'read_file', params),
  { maxRetries: 3, baseDelay: 1000 }
);

// Wrap with caching
const cachedCall = withCache(safeCall, { ttlMs: 60000 });

// Wrap with circuit breaker
const resilientCall = withCircuitBreaker(cachedCall, {
  failureThreshold: 5,
  timeout: 60000
});
```

### MeTTa Standard Library (`mcp-std.metta`)

The standard library provides these operations:

#### Connection Management

- `(mcp-manager)` - Get the JS McpClientManager instance
- `(mcp-connect $server $cmd $args)` - Connect to an MCP server via stdio
- `(mcp-connect-sse $server $url)` - Connect via SSE
- `(mcp-disconnect $server)` - Disconnect from a server
- `(mcp-disconnect-all)` - Disconnect from all servers

#### Tool Discovery

- `(mcp-discover $server)` - Discover tools and assert them into the space
- `(populate-tools $server $toolsArray)` - Internal: populate tool facts

#### Tool Invocation

- `(mcp-call $server $toolName $params)` - Call a tool with parameters
- `(parse-mcp-result $result)` - Parse MCP result structure
- `(safe-mcp-call $server $toolName $params $fallback)` - Call with fallback on error

#### Tool Reasoning

- `(tool-available? $name)` - Check if a tool is available
- `(get-tool-description $name)` - Get tool description
- `(get-tool-server $name)` - Get tool's server
- `(tool-matches-task $toolName $taskDesc)` - Check if tool matches task
- `(best-tool-for $taskDesc)` - Find best tool for task
- `(query-all-tools)` - Get all available tools

#### Reliability Tracking

- `(record-tool-success $toolName)` - Record successful call
- `(record-tool-failure $toolName)` - Record failed call
- `(tool-reliability $toolName)` - Get reliability score

#### High-Level Orchestration

- `(when-tool-available $toolName $then $else)` - Conditional execution
- `(try-tool $server $toolName $params $default)` - Try tool or use default

### Tool Reasoning Patterns

MeTTa can reason about which tools to use:

```metta
;; Tool availability facts (auto-populated by mcp-discover)
(tool-available read_file)
(tool-description read_file "Read the contents of a file")
(tool-server read_file "fs_server")
(tool-success-rate read_file 0.95)
(tool-call-count read_file 42)

;; Conditional execution
(= (safe-search $q)
   (if (tool-available? "brave_search")
       (mcp-call "search" "brave_search" (object (: query $q)))
       (fallback-search $q)))

;; Tool composition
(= (summarize-file $path)
   (let* (($content (mcp-call "fs" "read_file" (object (: path $path))))
          ($summary (summarize (object (: text $content)))))
     $summary))

;; Reliability-based selection
(= (prefer-reliable-tool $task)
   (let* (($tools (query-all-tools))
          ($reliable (filter (λ ($t) (> (tool-reliability $t) 0.8)) $tools)))
     (if (empty? $reliable)
         (fallback $task)
         (head $reliable))))
```

## Use Case B: SeNARS Providing MCP Services

### Starting the Server

```bash
node agent/src/mcp/start-server.js
```

### Available Tools

| Tool           | Description                                                  |
|----------------|--------------------------------------------------------------|
| `ping`         | Health check                                                 |
| `reason`       | Feed premises into NAL, run N cycles, return derived beliefs |
| `memory-query` | Query the concept memory by term string                      |
| `get-focus`    | Return top-N tasks from the attention focus buffer           |
| `execute-tool` | Invoke a registered NAR tool                                 |
| `evaluate_js`  | Sandboxed JS execution (1s timeout, vm context)              |
| `sync-beliefs` | Bidirectional belief delta reconciliation                    |
| `metta-eval`   | **NEW!** Evaluate MeTTa expressions                          |

### Using with MeTTa Interpreter

```javascript
import { Server } from '@senars/agent/mcp';
import { MeTTaInterpreter } from '@senars/metta';

const mettaInterpreter = new MeTTaInterpreter();

const server = new Server({
  nar: narInstance,  // Optional: NAR instance for reasoning
  mettaInterpreter: mettaInterpreter  // Optional: for metta-eval tool
});

await server.start();
```

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "senars": {
      "command": "node",
      "args": ["/absolute/path/to/senars10/agent/src/mcp/start-server.js"]
    }
  }
}
```

### Using metta-eval

The `metta-eval` tool allows AI clients to evaluate MeTTa expressions:

```json
{
  "tool": "metta-eval",
  "arguments": {
    "code": "(= (add a b) (* 2 (+ a b))) !(add 3 4)",
    "mode": "run"
  }
}
```

Modes:

- `run` (default) - Evaluate and return results
- `load` - Load code into space without evaluating
- `query` - Query the space for patterns (use `pattern` and `template` params)

```json
{
  "tool": "metta-eval",
  "arguments": {
    "code": "(tool-available $name)",
    "mode": "query",
    "pattern": "(tool-available $name)",
    "template": "(tool-available $name)"
  }
}
```

## Examples

See the `examples/` directory:

- `examples/mcp-consumer-example.mjs` - MeTTa consuming MCP tools
- `examples/mcp-provider-example.mjs` - SeNARS providing MCP services

## Testing

```bash
# Run integration test
node test-mcp-integration.mjs

# Run unit tests (requires Jest)
npm test -- metta/tests/mcp/mcp.test.js

# Run consumer example
node examples/mcp-consumer-example.mjs

# Run provider example
node examples/mcp-provider-example.mjs
```

## API Reference

### McpClientManager

```typescript
class McpClientManager extends EventEmitter {
  constructor(options?: { timeout?: number; maxRetries?: number; retryDelay?: number });
  
  // Connection management
  connect(key: string, command: string, args?: string[], transport?: 'stdio'|'sse'): Promise<void>;
  disconnect(key: string): Promise<void>;
  disconnectAll(): Promise<void>;
  isConnected(key: string): boolean;
  getStatus(key: string): ConnectionStatus | null;
  getConnectedServers(): string[];
  
  // Tool operations
  callTool(key: string, toolName: string, params?: object, retries?: number): Promise<object>;
  listTools(key: string): Promise<{ tools: Tool[] }>;
  getCachedTools(key: string): Tool[] | null;
  
  // Statistics
  getStats(): ManagerStats;
  
  // Events
  on(event: 'connected'|'disconnected'|'error'|'tool-called'|'tool-error', handler: Function): this;
}
```

### MeTTaMCPManager

```typescript
class MeTTaMCPManager {
  constructor(interpreter: MeTTaInterpreter, options?: object);
  
  connect(key: string, command: string, args?: string[]): Promise<void>;
  connectSSE(key: string, url: string): Promise<void>;
  disconnect(key?: string): Promise<void>;
  isConnected(key: string): boolean;
  getStatus(key: string): ConnectionStatus | null;
  getConnectedServers(): string[];
  getCachedTools(key: string): Tool[] | null;
  getStats(): ManagerStats;
  callTool(key: string, toolName: string, params?: object): Promise<object>;
  listTools(key: string): Promise<{ tools: Tool[] }>;
  getManager(): McpClientManager;
  on(event: string, handler: Function): this;
  off(event: string, handler: Function): this;
}
```

### Utility Functions

```typescript
// Retry wrapper
withRetry(fn, { maxRetries?: number; baseDelay?: number; maxDelay?: number }): fn;

// Timeout wrapper
withTimeout(fn, timeoutMs: number): fn;

// Cache wrapper
withCache(fn, { ttlMs?: number; keyFn?: Function }): fn;

// Circuit breaker wrapper
withCircuitBreaker(fn, { failureThreshold?: number; successThreshold?: number; timeout?: number }): fn;

// Pipeline composition
pipeline(...fns: Function[]): fn;

// Parallel execution
parallel(...fns: Function[]): fn;

// Conditional execution
conditional(predicate: Function, thenFn: Function, elseFn?: Function): fn;

// Logging wrapper
withLogging(fn, { name?: string; logger?: Console; logInput?: boolean; logOutput?: boolean }): fn;

// Batch execution
batch(fn, batchSize?: number, delayMs?: number): fn;

// Rate limiting
rateLimit(fn, limit?: number, windowMs?: number): fn;

// Result transformation
transformResult(fn, transformer: Function): fn;

// Fallback chain
fallbackChain(...fns: Function[]): fn;

// Validation wrapper
withValidation(fn, validator: Function): fn;

// Memoization
memoize(fn, keyFn?: Function, cache?: Map): fn;

// Tool context for state management
class ToolContext {
  constructor(initialState?: object);
  get(key: string): any;
  set(key: string, value: any): this;
  record(tool: string, input: any, output: any, error?: Error): this;
  getHistory(limit?: number): Array<object>;
  clear(): this;
}
```

## Safety

### Consumer Mode (MeTTa calling tools)

- Timeout enforcement on external tool requests (default: 30s, configurable)
- Automatic retry with exponential backoff
- Circuit breaker pattern to prevent cascade failures
- Connection status tracking for reactive programming

### Provider Mode (SeNARS as server)

- PII scrubbing is opt-in (disabled by default)
- `<` and `>` are never HTML-escaped — Narsese syntax survives unchanged
- Sandboxed JS: `evaluate_js` runs in a `vm.createContext` with 1s timeout
- `metta-eval` has no direct filesystem or network access

## Transport Reference

| Transport | Status           | When to Use                                   |
|-----------|------------------|-----------------------------------------------|
| Stdio     | ✅ Working        | Local servers; Claude Desktop; subprocesses   |
| SSE/HTTP  | ✅ Working        | Multi-client web servers; remote services     |
| WebSocket | 🔧 SDK-dependent | Real-time streaming (future)                  |
| REST APIs | ✅ Via `fetch`    | Arbitrary REST APIs via `&js-global` in MeTTa |

## TypeScript Support

Full TypeScript definitions are provided in `index.d.ts`:

```typescript
import { MeTTaMCPManager, McpClientManager } from '@senars/metta/mcp';
import { withRetry, withTimeout } from '@senars/metta/mcp/utils';

// Type-safe usage
const mcp: MeTTaMCPManager = new MeTTaMCPManager(interpreter);
await mcp.connect('fs', 'npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp']);
```

## Troubleshooting

### Connection Issues

```javascript
// Enable debug logging
mcp.on('debug', (msg) => console.log('[MCP Debug]', msg));

// Check connection status
console.log(mcp.getStatus('fs'));
console.log(mcp.getConnectedServers());
```

### Tool Discovery

```javascript
// Manually trigger discovery
await mcp.connect('fs', 'npx', ['...']);
await mcp.listTools('fs');  // Force refresh

// Check cached tools
console.log(mcp.getCachedTools('fs'));
```

### Error Handling

```javascript
// Listen for errors
mcp.on('error', ({ key, error }) => {
  console.error(`Server ${key} error:`, error.message);
});

mcp.on('tool-error', ({ key, toolName, error }) => {
  console.error(`Tool ${toolName} on ${key} failed:`, error.message);
});
```

## References

- [MCP Specification](https://modelcontextprotocol.io/specification)
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk)
- [MeTTa MCP Plan](../../metta/MCP.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
