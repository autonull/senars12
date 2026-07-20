#!/usr/bin/env tsx
/**
 * Multi-Agent SeNARS Demo — NAR + MeTTa reasoning via one agent.
 * Uses createAgent() as the hub. Input routes to NAR (Narsese) or LM (NL).
 */

import { SeNARSFactory } from '@senars/nar';
import { runMultiAgent } from './lib/multi-agent-runner.js';

const banner = ['[NAR] Initializing...'];

runMultiAgent({
  scope: 'multi-agent',
  banner,
  createNAR: () => SeNARSFactory.createForTesting({ core: { maxConcepts: 100 } }),
}).catch((err) => {
  console.error('Demo failed', err);
  process.exit(1);
});
