/**
 * `senars doctor tune` — Run self-tuning optimization.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode, clamp, finiteOr } from '@senars/util';
import { resolveLMSettings } from '@senars/lm';
import { DEFAULT_COGNITIVE_PARAMETERS } from '@senars/config';
import { RLFPLearner } from '@senars/rlfp';

const logger = createLogger({ scope: 'doctor:tune' });

export const sections: HelpSection[] = [
  standardSections.usage('senars doctor tune', 'Run self-tuning optimization'),
  {
    title: 'Options',
    lines: [
      '--json               Output machine-readable JSON',
      '--iterations <n>     Number of tuning iterations (default: 10, max: 100)',
      '--baseline <n>       Baseline duration in ms (default: 100)',
      '--output <path>      Write results to file',
    ],
  },
  standardSections.examples([
    'senars doctor tune',
    'senars doctor tune --iterations 20',
    'senars doctor tune --json --output tune-results.json',
  ]),
];

interface TuneResult {
  iterations: number;
  bestReward: number;
  bestParams: Record<string, number>;
  history: Array<{ iteration: number; reward: number; params: Record<string, number> }>;
}

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const outputPath = argv.str('--output');
  const iterations = clamp(finiteOr(argv.str('--iterations', '10'), 10), 1, 100);
  const baselineDuration = clamp(finiteOr(argv.str('--baseline', '100'), 100), 10, 10000);

  if (!jsonOutput) console.log('=== SeNARS Self-Tune ===\n');

  const settings = resolveLMSettings();
  const rlfp = new RLFPLearner({ currentParams: { ...DEFAULT_COGNITIVE_PARAMETERS } });

  let best = -Infinity;
  let bestParams: Record<string, number> = {};
  const history: Array<{ iteration: number; reward: number; params: Record<string, number> }> = [];

  for (let i = 0; i < iterations; i++) {
    const reward = rlfp.calculateReward({
      passRate: 0.8,
      avgTestDuration: 90,
      coverageDelta: 0.01,
      memoryOverage: 0.05,
      cpuThrottleTime: 2,
      baselineDuration,
    });

    const currentParams = { ...rlfp.currentParams };
    history.push({ iteration: i + 1, reward, params: currentParams });

    if (reward > best) {
      best = reward;
      bestParams = currentParams;
    }

    if (!jsonOutput) {
      console.log(`  Iteration ${i + 1}/${iterations}: reward = ${reward.toFixed(4)}`);
    }
  }

  const result: TuneResult = {
    iterations,
    bestReward: best,
    bestParams,
    history,
  };

  if (jsonOutput) {
    const json = JSON.stringify(result, null, 2);
    if (outputPath) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(outputPath, json);
    } else {
      console.log(json);
    }
  } else {
    console.log(`\nBest reward: ${best.toFixed(4)}`);
    console.log('Best parameters:');
    for (const [k, v] of Object.entries(bestParams)) {
      console.log(`  ${k}: ${v}`);
    }
    console.log('\nFull run: pnpm self-tune-demo');
  }
}

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}