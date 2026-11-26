/**
 * `senars plugin info` — Show plugin information.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'plugin:info' });

export const sections: HelpSection[] = [
  standardSections.usage('senars plugin info', 'Show plugin information'),
  {
    title: 'Arguments',
    lines: [
      '<name>                 Plugin name',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars plugin info my-plugin',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const name = argv.positional[0];

  if (!name) {
    console.error('Error: <name> argument required');
    process.exit(1);
  }

  const result = {
    name,
    version: '1.0.0',
    description: 'Example plugin',
    author: 'author',
    license: 'MIT',
    dependencies: [],
    installed: false,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Plugin: ${result.name}@${result.version}`);
    console.log(`  Description: ${result.description}`);
    console.log(`  Author: ${result.author}`);
    console.log(`  License: ${result.license}`);
    console.log(`  Installed: ${result.installed ? 'yes' : 'no'}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}