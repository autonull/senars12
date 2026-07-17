#!/usr/bin/env tsx
/**
 * Multi-Agent SeNARS Demo — NAR + MeTTa reasoning via one agent.
 * Uses createAgent() as the hub.
 */

import { SeNARSFactory } from '@senars/nar';
import { runMultiAgent } from './lib/multi-agent-runner.js';

const banner = [
  '╔══════════════════════════════════════════════════════════════╗',
  '║  SeNARS Multi-Agent Demo (NAR + MeTTa)                       ║',
  '╚══════════════════════════════════════════════════════════════╝',
  '',
];

runMultiAgent({
  scope: 'multi-agent-demo',
  banner,
  createNAR: () => SeNARSFactory.createDefault({ core: { maxConcepts: 100 } }),
}).catch((err) => {
  console.error('Demo failed', err);
  process.exit(1);
});
