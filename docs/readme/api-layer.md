### API Layer

**REST API (HTTP Adapter):**

```bash
POST /api/v1/nar/believe     # Input belief
POST /api/v1/nar/goal        # Input goal
POST /api/v1/nar/question    # Input question
POST /api/v1/nar/run         # Run inference steps
GET  /api/v1/nar/beliefs     # Query beliefs
GET  /api/v1/nar/concepts    # List concepts
GET  /api/v1/nar/stats       # Statistics
```

**WebSocket API:**

```json
{ "type": "nar.input", "data": { "input": "(cat --> animal).", "type": "belief" } }
{ "type": "nar.run", "data": { "steps": 5 } }
{ "type": "nar.query", "data": { "term": "(whiskers --> ?what)?" } }
```

**MCP (Model Context Protocol):**

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerNARTools, registerAgentAPI } from 'senars/api';

const server = new McpServer({ name: 'senars', version: '1.0.0' });
registerNARTools(server, nar, agent);
registerAgentAPI(server, agent);
// Exposes tools: calculate, read_file, write_file, search_memory, run_reasoning, 
// learn_belief, explain_belief, agent_chat, agent_believe, agent_recall, 
// agent_know, get_beliefs, get_attention, and more
```
