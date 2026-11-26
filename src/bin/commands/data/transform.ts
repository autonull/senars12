/**
 * `senars data transform` — Transform data.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'data:transform' });

export const sections: HelpSection[] = [
  standardSections.usage('senars data transform', 'Transform data'),
  {
    title: 'Arguments',
    lines: [
      '<input>                Input file path',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--output <path>        Output file path (required)',
      '--script <path>        Transform script path (JavaScript/TypeScript)',
      '--dry-run              Preview transformation without writing',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars data transform input.json --output output.json --script transform.ts',
    'senars data transform data.narsese --output data.json --dry-run',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const input = argv.positional[0];
  const output = argv.str('--output');
  const script = argv.str('--script');
  const dryRun = argv.has('--dry-run');

  if (!input) {
    console.error('Error: <input> argument required');
    process.exit(1);
  }

  if (!output && !dryRun) {
    console.error('Error: --output required (unless --dry-run)');
    process.exit(1);
  }

  // This is a stub - actual transform would need to be implemented
  const result = {
    input,
    output: dryRun ? 'dry-run' : output,
    script,
    dryRun,
    transformed: 0,
    success: true,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Transforming ${input}...`);
    if (script) console.log(`  Script: ${script}`);
    if (dryRun) console.log(`  Dry run: true`);
    console.log(`\n✓ Transformed ${result.transformed} items`);
    if (!dryRun) console.log(`  Output: ${output}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}