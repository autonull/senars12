#!/usr/bin/env tsx
import { createAgentFromEnv, runAgent } from './lib/lifecycle.js';

const { agent } = await createAgentFromEnv({
  narConfig: { maxConcepts: 100 },
});

await runAgent(agent);

console.log('SeNARS running.');
console.log('UI at http://localhost:8765');
