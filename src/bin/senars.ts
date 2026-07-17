#!/usr/bin/env tsx
import { createAgent } from '@senars/nar/agent';
import { SeNARSFactory } from '@senars/nar';

const nar = SeNARSFactory.createForTesting({ maxConcepts: 100 });
const agent = await createAgent({ nar });

await agent.start();

console.log('SeNARS running.');
console.log('UI at http://localhost:8765');

process.on('SIGINT', async () => {
  console.log('\n\nShutting down...');
  await agent.stop();
  process.exit(0);
});
