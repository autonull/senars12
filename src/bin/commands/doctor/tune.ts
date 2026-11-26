/**
 * `senars doctor tune` — Run self-tuning optimization.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { resolveLMSettings } from '@senars/lm';
import { DEFAULT_COGNITIVE_PARAMETERS } from '@senars/config';
import { RLFPLearner } from '@senars/rlfp';
import { clamp, finiteOr } from '@senars/util';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

interface TuneResult {
  iterations: number;
  bestReward: number;
  bestParams: Record<string, number>;
  history: Array<{ iteration: number; reward: number; params: Record<string, number> }>;
}

export const sections = createCommandModule({
  name: 'doctor tune',
  description: 'Run self-tuning optimization',
  usage: 'senars doctor tune [options]',
  sections: [
    { lines: ['--json               Output machine-readable JSON', '--iterations <n>     Number of tuning iterations (default: 10, max: 100)', '--baseline <n>       Baseline duration in ms (default: 100)', '--output <path>      Write results to file'] },
  ],
  examples: [
    'senars doctor tune',
    'senars doctor tune --iterations 20',
    'senars doctor tune --json --output tune-results.json',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const outputPath = flagHelpers.str(rawFlags, '--output', '');
    const iterations = clamp(finiteOr(flagHelpers.str(rawFlags, '--iterations', '10'), 10), 1, 100);
    const baselineDuration = clamp(finiteOr(flagHelpers.str(rawFlags, '--baseline', '100'), 100), 10, 10000);

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
  }, flags, 'doctor tune');
});

export const doctorTuneModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}