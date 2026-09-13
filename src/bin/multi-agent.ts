#!/usr/bin/env tsx
/**
 * Multi-Agent SeNARS — NAR + MeTTa reasoning via one agent.
 * Uses createAgent() as the hub. Input routes to NAR (Narsese) or LM (NL).
 * `--testing` uses the deterministic testing factory (replaces multi-agent-demo).
 */

import { SeNARSFactory } from '@senars/nar';
import { runMultiAgent } from './lib/multi-agent-runner.js';

const testing = process.argv.includes('--testing');
const banner = testing
  ? ['[NAR] Initializing...']
  : [
      '╔══════════════════════════════════════════════════════════════╗',
      '║  SeNARS Multi-Agent Demo (NAR + MeTTa)                       ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
    ];

runMultiAgent({
  scope: testing ? 'multi-agent-testing' : 'multi-agent',
  banner,
  createNAR: () =>
    testing
      ? SeNARSFactory.createForTesting({ core: { maxConcepts: 100 } })
      : SeNARSFactory.createDefault({ core: { maxConcepts: 100 } }),
}).catch((err) => {
  console.error('Demo failed', err);
  process.exit(1);
});
