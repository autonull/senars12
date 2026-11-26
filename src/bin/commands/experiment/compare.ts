/**
 * `senars experiment compare` — Compare experiment runs.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'experiment:compare' });

export const sections: HelpSection[] = [
  standardSections.usage('senars experiment compare', 'Compare experiment runs'),
  {
    title: 'Arguments',
    lines: [
      '<run-id-a> <run-id-b>  Experiment run IDs to compare',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--metric <name>        Specific metric to compare (default: all)',
      '--output <path>        Output file path',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars experiment compare run1 run2',
    'senars experiment compare run1 run2 --metric successRate --json',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const runIdA = argv.positional[0];
  const runIdB = argv.positional[1];
  const metric = argv.str('--metric');
  const outputPath = argv.str('--output');

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
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}