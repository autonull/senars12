### Multi-Transport Agent (The "Bot")

A single SeNARS agent, accessible via multiple transports simultaneously:

| Transport | Protocol | Use Case |
|-----------|----------|----------|
| **CLI** | stdin/stdout | Local REPL, scripting |
| **IRC** | IRC | Chat rooms, multi-user |
| **WebSocket** | WS | Real-time web clients |
| **HTTP** | REST | API integration |
| **MCP** | Model Context Protocol | AI assistant integration |

```typescript
import { ConnectionManager, CLIConnection, IRCConnection, WSConnection, HTTPConnection, MCPConnection } from '@senars/io';

const cm = new ConnectionManager();
cm.registerFactory({ type: 'cli', create: ... });
cm.registerFactory({ type: 'irc', create: ... });
cm.registerFactory({ type: 'websocket', create: ... });
cm.registerFactory({ type: 'http', create: ... });
cm.registerFactory({ type: 'mcp', create: ... });

// All connections share one agent instance
for (const cfg of configs) {
  const conn = await cm.addConnection(cfg);
  bindAgentToConnection(agent, conn, { auth, commandRegistry, sessionManager });
}
```
