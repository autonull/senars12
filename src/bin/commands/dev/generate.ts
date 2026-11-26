/**
 * `senars dev generate` — Code generation.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'dev:generate' });

export const sections: HelpSection[] = [
  standardSections.usage('senars dev generate', 'Generate code'),
  {
    title: 'Options',
    lines: [
      '--template <name>      Template: command|skill|plugin|test (required)',
      '--output <path>        Output directory (required)',
      '--name <name>          Name for generated code (required)',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars dev generate --template command --output ./src/bin/commands/custom --name mycmd',
    'senars dev generate --template skill --output ./skills --name my-skill',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const template = argv.str('--template');
  const output = argv.str('--output');
  const name = argv.str('--name');

  if (!template || !output || !name) {
    console.error('Error: --template, --output, and --name are required');
    process.exit(1);
  }

  const result = { template, output, name, success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Generating ${template}: ${name}`);
    console.log(`  Output: ${output}`);
    console.log('\n[Code generator not yet implemented]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}