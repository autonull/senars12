/**
 * Unified API Example Usage
 * Demonstrates how to use the unified API layer with HTTP, WebSocket, and MCP
 */

import { Agent } from './agent/Agent.js';
import { HTTPServer } from './agent/http-server.js';
import { WebSocketServer } from './agent/websocket-server.js';
import { MCPServer } from './api/index.js';
import { registerAgentAPI } from './api/agent-api.js';

async function main() {
  const agent = new Agent();
  await agent.initialize();

  // Register all agent API handlers with the unified registry
  registerAgentAPI(agent);

  // Start HTTP server (uses unified registry internally)
  const httpServer = new HTTPServer({ port: 8080 });
  await httpServer.start(agent);

  // Start WebSocket server (uses unified registry internally)
  const wsServer = new WebSocketServer({ port: 8765 });
  await wsServer.start(agent);

  // Start MCP server (uses unified registry internally)
  const mcpServer = new MCPServer(undefined, { port: 8766 });
  await mcpServer.start();

  console.log('All servers started:');
  console.log('  - HTTP:     http://localhost:8080');
  console.log('  - WebSocket: ws://localhost:8765');
  console.log('  - MCP:      localhost:8766');

  // List available API methods
  console.log('\nAvailable API methods:');
  console.log(mcpServer.listTools());

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await httpServer.stop();
    await wsServer.stop();
    await mcpServer.stop();
    await agent.shutdown();
    process.exit(0);
  });
}

main().catch(console.error);
