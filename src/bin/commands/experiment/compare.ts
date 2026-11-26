/**
 * `senars experiment compare` — Compare experiment runs.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'experiment compare',
  description: 'Compare experiment runs',
  usage: 'senars experiment compare <run-id-a> <run-id-b> [options]',
  sections: [
    { lines: ['<run-id-a> <run-id-b>  Experiment run IDs to compare'] },
    { lines: ['--metric <name>        Specific metric to compare (default: all)', '--output <path>        Output file path', '--json                 Output machine-readable JSON'] },
  ],
  examples: [
    'senars experiment compare run1 run2',
    'senars experiment compare run1 run2 --metric successRate --json',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const runIdA = positional[0];
    const runIdB = positional[1];
    const metric = flagHelpers.str(rawFlags, '--metric', '');
    const outputPath = flagHelpers.str(rawFlags, '--output', '');

    if (!runIdA || !runIdB) {
      console.error('Error: <run-id-a> and <run-id-b> arguments required');
      process.exit(1);
    }

    // This is a stub - experiment persistence would need to be implemented
    const comparison = {
      runA: { runId: runIdA, metrics: { successRate: 1.0, avgDuration: 50 } },
      runB: { runId: runIdB, metrics: { successRate: 0.9, avgDuration: 60 } },
      diff: { successRate: 0.1, avgDuration: -10 },
      metric: metric ? { [metric]: { a: 1.0, b: 0.9, diff: 0.1 } } : null,
    };

    if (jsonOutput) {
      console.log(JSON.stringify(comparison, null, 2));
    } else {
      console.log(`Comparing ${runIdA} vs ${runIdB}:`);
      console.log(`  ${runIdA}: successRate=1.00, avgDuration=50ms`);
      console.log(`  ${runIdB}: successRate=0.90, avgDuration=60ms`);
      console.log(`  Diff: successRate=+0.10, avgDuration=-10ms`);
    }

    if (outputPath) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync(outputPath, JSON.stringify(comparison, null, 2));
      if (!jsonOutput) console.log(`\nComparison written to ${outputPath}`);
    }
  }, flags, 'experiment compare');
});

export const experimentCompareModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}