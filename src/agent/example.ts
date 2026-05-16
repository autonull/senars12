/**
 * SeNARS Agent Example
 * Demonstrates the Agent layer with multiple connections
 */

import {Agent} from './Agent.js';
import {SeNARSFactory} from '../nar';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import type {ConnectionConfig} from '../io/types.js';

async function runAgentExample(): Promise<void> {
console.log('Starting SeNARS Agent Example...\n');

const registry = createSeNARSRegistry();
const nar = SeNARSFactory.createDefault({
  core: {maxConcepts: 100, maxDerivationDepth: 10},
  enableLMRules: true,
  providerRegistry: registry,
});

const agent = new Agent(nar);

try {
await agent.start();

const wsConfig: ConnectionConfig = {
  id: 'ws-example',
  type: 'websocket',
  enabled: true,
  config: {port: 8765},
};

const httpConfig: ConnectionConfig = {
  id: 'http-example',
  type: 'http',
  enabled: true,
  config: {port: 8080},
};

await agent.addConnection(wsConfig);
await agent.addConnection(httpConfig);

console.log('Agent started with connections:\n');
console.log(' - WebSocket server on ws://localhost:8765');
console.log(' - HTTP API on http://localhost:8080\n');

console.log('Example usage:');
console.log(' POST http://localhost:8080/beliefs');
console.log(' { "term": "(cat --> animal)" }');
console.log('\n GET http://localhost:8080/stats');
console.log('\n WebSocket: Connect to ws://localhost:8765\n');

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

const mode = process.argv[2] || 'agent';

if (mode === 'agent') {
runAgentExample().catch(console.error);
} else {
console.log('Usage: node example.js [agent]');
console.log(' agent - Run agent with WebSocket and HTTP connections');
}
