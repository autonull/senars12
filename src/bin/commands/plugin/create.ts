/**
 * `senars plugin create` — Create a new plugin from template.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'plugin:create' });

export const sections: HelpSection[] = [
  standardSections.usage('senars plugin create', 'Create a new plugin from template'),
  {
    title: 'Arguments',
    lines: [
      '<name>                 Plugin name',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--template <type>      Template type: command|skill|full (default: command)',
      '--output <path>        Output directory (default: ./plugins/<name>)',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars plugin create my-plugin --template command',
    'senars plugin create my-plugin --template full --output ./plugins/my-plugin',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const name = argv.positional[0];
  const template = argv.str('--template', 'command');
  const output = argv.str('--output', `./plugins/${name}`);

  if (!name) {
    console.error('Error: <name> argument required');
    process.exit(1);
  }

  const result = { name, template, output, created: false, success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Creating plugin: ${name} (template: ${template})`);
    console.log(`  Output: ${output}`);
    console.log('\n[Plugin creation not yet implemented]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}