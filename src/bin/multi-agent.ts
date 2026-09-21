#!/usr/bin/env tsx
/**
 * Multi-Agent SeNARS — NAR + MeTTa reasoning via one agent.
 * Uses createAgent() as the hub. Input routes to NAR (Narsese) or LM (NL).
 * `--testing` uses the deterministic testing factory (replaces multi-agent-demo).
 */

import { NARBuilder } from '@senars/nar/agent/builder';
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
  // TODO19 F1: single assembly path; testing trims the concept budget.
  createWired: async () =>
    NARBuilder.fromProfile('arcade')
      .withNarConfig({
        core: testing
          ? { maxConcepts: 100, activationDecayRate: 0, consolidationInterval: 1000, cpuThrottleMs: 0, maxDerivationDepth: 20 }
          : { maxConcepts: 100 },
        enableLMRules: true,
      })
      .build(),
}).catch((err) => {
  console.error('Demo failed', err);
  process.exit(1);
});
