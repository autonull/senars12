/**
 * `senars experiment sweep` — Parameter sweep experiment.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'experiment sweep',
  description: 'Run parameter sweep experiment',
  usage: 'senars experiment sweep [options]',
  sections: [
    { lines: ['--param <key=min,max,step>  Parameter to sweep (e.g., --param learningRate=0.01,0.1,0.01)', '--objective <metric>        Objective metric to optimize (default: successRate)', '--iterations <n>            Iterations per parameter value (default: 3)', '--output <path>             Output file path', '--json                      Output machine-readable JSON'] },
  ],
  examples: [
    'senars experiment sweep --param learningRate=0.01,0.1,0.01 --objective successRate',
    'senars experiment sweep --param batchSize=16,64,16 --iterations 5 --json',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const paramStr = flagHelpers.str(rawFlags, '--param', '');
    const objective = flagHelpers.str(rawFlags, '--objective', 'successRate');
    const iterations = flagHelpers.num(rawFlags, '--iterations', 3);
    const outputPath = flagHelpers.str(rawFlags, '--output', '');

    if (!paramStr) {
      console.error('Error: --param argument required (format: key=min,max,step)');
      process.exit(1);
    }

    const [key, range] = paramStr.split('=');
    const [min, max, step] = range.split(',').map(Number);

    if (!key || isNaN(min) || isNaN(max) || isNaN(step)) {
      console.error('Error: --param format: key=min,max,step (e.g., learningRate=0.01,0.1,0.01)');
      process.exit(1);
    }

    const values: number[] = [];
    for (let v = min; v <= max + 1e-9; v += step) {
      values.push(Math.round(v * 10000) / 10000);
    }

    const results = values.map((value) => ({
      [key]: value,
      [objective]: Math.random(), // Simulated
      iterations,
    }));

    const best = results.reduce((a, b) => (a[objective] > b[objective] ? a : b));

    const output = {
      param: key,
      objective,
      values: values.length,
      iterations,
      results,
      best,
    };

    if (jsonOutput) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(`Parameter sweep: ${key}=${min}..${max} step ${step}`);
      console.log(`  Objective: ${objective}`);
      console.log(`  Values tested: ${values.length}`);
      console.log(`  Iterations per value: ${iterations}`);
      console.log('\nResults:');
      for (const r of results) {
        console.log(`  ${key}=${r[key]}: ${objective}=${r[objective].toFixed(4)}`);
      }
      console.log(`\nBest: ${key}=${best[key]} (${objective}=${best[objective].toFixed(4)})`);
    }

    if (outputPath) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(outputPath, JSON.stringify(output, null, 2));
      if (!jsonOutput) console.log(`\nSweep results written to ${outputPath}`);
    }
  }, flags, 'experiment sweep');
});

export const experimentSweepModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}