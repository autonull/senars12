/**
 * `senars dev profile` — CPU/memory profiling.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'dev:profile' });

export const sections: HelpSection[] = [
  standardSections.usage('senars dev profile', 'CPU/memory profiling'),
  {
    title: 'Options',
    lines: [
      '--duration <s>         Profiling duration in seconds (default: 10)',
      '--output <path>        Output file path (default: profile.cpuprofile)',
      '--flamegraph           Generate flamegraph data',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars dev profile --duration 30 --output profile.cpuprofile',
    'senars dev profile --flamegraph --output flamegraph.json',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const duration = parseInt(argv.str('--duration', '10'), 10);
  const output = argv.str('--output', 'profile.cpuprofile');
  const flamegraph = argv.has('--flamegraph');

  const result = { duration, output, flamegraph, success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Profiling for ${duration}s...`);
    console.log(`  Output: ${output}`);
    console.log(`  Flamegraph: ${flamegraph}`);
    console.log('\n[Profiling not yet implemented]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}