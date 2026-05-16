/**
 * Phase 9: Agent - Feature Test
 * Tests Agent functionality
 */

import {Agent} from './Agent.js';
import {SeNARSFactory} from '../nar';
import {createSeNARSRegistry} from '../nar/lm/providers.js';

async function testAgentPersistence(): Promise<void> {
console.log('Testing Agent Persistence...');

const registry = createSeNARSRegistry();
const nar = SeNARSFactory.createDefault({
  core: {maxConcepts: 100, maxDerivationDepth: 10},
  enableLMRules: true,
  providerRegistry: registry,
});
const agent = new Agent(nar);

await nar.input('(cat --> animal).');
await nar.input('(dog --> animal).');

const state = await nar.getMemoryState();
console.log('✓ Memory state captured:', Object.keys(state).join(', '));

await agent.saveState('/tmp/test-agent-state.json');
console.log('✓ Agent state saved');

const nar2 = SeNARSFactory.createDefault({
  core: {maxConcepts: 100, maxDerivationDepth: 10},
  enableLMRules: true,
  providerRegistry: registry,
});
const agent2 = new Agent(nar2);
await agent2.loadState('/tmp/test-agent-state.json');
console.log('✓ Agent state loaded');
}

async function testAgentConnections(): Promise<void> {
console.log('\nTesting Agent Connections...');

const registry = createSeNARSRegistry();
const nar = SeNARSFactory.createDefault({
  core: {maxConcepts: 100, maxDerivationDepth: 10},
  enableLMRules: true,
  providerRegistry: registry,
});
const agent = new Agent(nar);

await agent.start();
console.log('✓ Agent started');

const connections = agent.getConnections();
console.log('✓ Initial connections:', connections.size);

await agent.stop();
console.log('✓ Agent stopped');
}

async function main(): Promise<void> {
console.log('=== Phase 9: Agent Tests ===\n');

try {
await testAgentPersistence();
await testAgentConnections();

console.log('\n=== All Phase 9 Tests Passed ===');
} catch (error) {
console.error('\nTest failed:', error);
process.exit(1);
}
}

main().catch(console.error);
