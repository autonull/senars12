#!/usr/bin/env tsx
/**
 * Multi-Agent SeNARS — NAR + MeTTa reasoning via one agent.
 * Uses createAgent() as the hub. Input routes to NAR (Narsese) or LM (NL).
 * `--testing` uses the deterministic testing factory (replaces multi-agent-demo).
 */

import { NARBuilder } from '@senars/nar/agent/builder';
import { runMultiAgent } from './multi-agent-runner.js';

export const runMultiAgentEntry = async (): Promise<void> => {
  const testing = process.argv.includes('--testing');
  const banner = testing
    ? ['[NAR] Initializing...']
    : [
        '╔══════════════════════════════════════════════════════════════╗',
        '║  SeNARS Multi-Agent Demo (NAR + MeTTa)                       ║',
        '╚══════════════════════════════════════════════════════════════╝',
        '',
      ];

  await runMultiAgent({
    scope: testing ? 'multi-agent-testing' : 'multi-agent',
    banner,
    // TODO19 F1: single assembly path; testing trims the concept budget.
    createWired: async () =>
      NARBuilder.fromProfile('arcade')
        .withNarConfig({
          maxConcepts: testing ? 100 : 100,
          activationDecayRate: testing ? 0 : undefined,
          consolidationInterval: testing ? 1000 : undefined,
          cpuThrottleMs: testing ? 0 : undefined,
          maxDerivationDepth: testing ? 20 : undefined,
          enableLMRules: true,
        })
        .build(),
  });
};

if (process.argv[1]?.endsWith('multi-agent-entry.ts')) {
  runMultiAgentEntry().catch((err) => {
    console.error('Demo failed', err);
    process.exit(1);
  });
}
