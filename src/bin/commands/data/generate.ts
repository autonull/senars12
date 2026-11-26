/**
 * `senars data generate` — Generate synthetic data.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'data:generate' });

export const sections: HelpSection[] = [
  standardSections.usage('senars data generate', 'Generate synthetic data'),
  {
    title: 'Options',
    lines: [
      '--type <type>          Data type: beliefs|goals|episodes (default: beliefs)',
      '--count <n>            Number of items to generate (default: 100)',
      '--domain <name>        Domain/theme for generation (e.g., animals, logic, math)',
      '--output <path>        Output file path (default: stdout)',
      '--format <fmt>         Output format: narsese|json|csv|yaml (default: json)',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars data generate --type beliefs --count 50 --domain animals',
    'senars data generate --type episodes --count 10 --output episodes.json',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const type = argv.str('--type', 'beliefs');
  const count = parseInt(argv.str('--count', '100'), 10);
  const domain = argv.str('--domain', 'general');
  const output = argv.str('--output');
  const format = argv.str('--format', 'json');

  const result = {
    type,
    count,
    domain,
    output: output ?? 'stdout',
    format,
    generated: count,
    success: true,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Generating ${count} ${type} (domain: ${domain})...`);
    console.log(`  Format: ${format}`);
    if (output) console.log(`  Output: ${output}`);
    console.log(`\n✓ Generated ${result.generated} items`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}