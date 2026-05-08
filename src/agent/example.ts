/**
 * SeNARS Agent Example
 * Demonstrates the Agent layer with multiple embodiments
 */

import { Agent } from './Agent.js';
import { WebSocketEmbodiment } from './websocket-server.js';
import { HTTPServer } from './http-server.js';
import { SeNARSFactory } from '../nar/factory.js';
import { runAllDemos } from './demos.js';

async function runAgentExample(): Promise<void> {
  console.log('Starting SeNARS Agent Example...\n');

  const nar = SeNARSFactory.createDefault();

  const wsEmbodiment = new WebSocketEmbodiment(8765);
  const httpServer = new HTTPServer(8080);

  const agent = new Agent(nar, [wsEmbodiment, httpServer as any]);

  try {
    await agent.start();
    console.log('Agent started with embodiments:\n');
    console.log('  - WebSocket server on ws://localhost:8765');
    console.log('  - HTTP API on http://localhost:8080\n');

    console.log('Example usage:');
    console.log('  POST http://localhost:8080/beliefs');
    console.log('  { "term": "(cat --> animal)" }');
    console.log('\n  GET http://localhost:8080/stats');
    console.log('\n  WebSocket: Connect to ws://localhost:8765\n');

    console.log('Running for 10 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    await agent.stop();
    console.log('\nAgent stopped.');
  } catch (error) {
    console.error('Agent error:', error);
    await agent.stop();
    process.exit(1);
  }
}

async function runDemosExample(): Promise<void> {
  console.log('Running SeNARS Demos...\n');
  await runAllDemos();
}

const mode = process.argv[2] || 'agent';

if (mode === 'agent') {
  runAgentExample().catch(console.error);
} else if (mode === 'demos') {
  runDemosExample().catch(console.error);
} else {
  console.log('Usage: node example.js [agent|demos]');
  console.log('  agent - Run agent with WebSocket and HTTP servers');
  console.log('  demos - Run demo scenarios');
}
