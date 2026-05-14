# Unified API Layer

This directory contains the unified API layer that provides a common interface for HTTP, WebSocket, and MCP protocols
through metaprogramming and reflection.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Registry                              │
│  (Central handler registration with Zod validation)         │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  HTTP Adapter   │  │ WebSocket Adapter│  │   MCP Adapter   │
│                 │  │                  │  │                 │
│ - REST API      │  │ - Real-time WS  │  │ - MCP Protocol  │
│ - OpenAPI spec  │  │ - Subscriptions │  │ - Tool definitions
│ - Rate limiting │  │ - Heartbeat     │  │ - JSON Schema   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Components

### `registry.ts`

- Central handler registration
- Zod schema validation
- OpenAPI spec generation
- Decorator support (`@apiMethod`)

### `agent-api.ts`

- All agent API method definitions
- Input/output schemas
- Handler implementations

### `http-adapter.ts`

- HTTP request handling
- API key authentication
- Rate limiting
- CORS support

### `websocket-adapter.ts`

- WebSocket message handling
- Client management
- Event subscriptions
- Heartbeat/idle detection

### `mcp-adapter.ts` & `mcp-server.ts`

- MCP protocol adapter
- Tool definitions from registry
- JSON Schema conversion

## Usage

### Basic Example

```typescript
import { Agent } from './agent/Agent.js';
import { registerAgentAPI } from './api/agent-api.js';
import { HTTPAdapter, WebSocketAdapter, MCPServer } from './api/index.js';

const agent = new Agent();
await agent.initialize();

// Register all API handlers
registerAgentAPI(agent);

// Start adapters
const http = new HTTPAdapter();
const ws = new WebSocketAdapter();
const mcp = new MCPServer();

// All three protocols now share the same handlers!
```

### Custom Handler Registration

```typescript
import { APIRegistry } from './api/registry.js';
import { z } from 'zod';

const registry = APIRegistry.getInstance();

registry.register('customOp', {
  description: 'Perform custom operation',
  params: z.object({
    input: z.string(),
    options: z.object({
      flag: z.boolean().optional()
    }).optional()
  }),
  returns: z.object({
    result: z.string()
  }),
  handler: async ({ input, options }) => {
    // Implementation
    return { result: `Processed: ${input}` };
  }
});
```

### Decorator Style

```typescript
import { apiMethod } from './api/registry.js';
import { z } from 'zod';

class AgentAPI {
  @apiMethod({
    description: 'Add a belief',
    params: z.object({
      term: z.string(),
      truth: z.object({
        f: z.number(),
        c: z.number()
      }).optional()
    }),
    returns: z.object({ success: z.boolean() })
  })
  async addBelief({ term, truth }) {
    // Implementation
  }
}
```

## Benefits

| Aspect              | Before                 | After             |
|---------------------|------------------------|-------------------|
| Handler duplication | 3x (HTTP + WS + MCP)   | 1x (registry)     |
| Schema validation   | Manual per-protocol    | Centralized (Zod) |
| OpenAPI/MCP spec    | Manual sync            | Auto-generated    |
| Error handling      | Per-protocol           | Unified           |
| Adding new protocol | Implement all handlers | One adapter       |

## API Methods

All registered methods are available across all protocols:

- `addBelief` - Add a belief
- `addGoal` - Add a goal
- `addQuestion` - Add a question
- `getBeliefs` - List beliefs
- `getGoals` - List goals
- `getQuestions` - List questions
- `query` - Query knowledge base
- `ask` - Ask a question
- `getStats` - Get statistics
- `getHealth` - Health check
- `run` - Run inference
- `getConfig` - Get configuration
- `getAttention` - Get attention snapshot
- `getHistory` - Get task history
