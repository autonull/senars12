/**
 * `senars plugin update` — Update a plugin.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'plugin:update' });

export const sections: HelpSection[] = [
  standardSections.usage('senars plugin update', 'Update a plugin'),
  {
    title: 'Arguments',
    lines: [
      '<name>                 Plugin name to update',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--version <ver>        Target version (default: latest)',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars plugin update my-plugin',
    'senars plugin update my-plugin --version 2.0.0',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const name = argv.positional[0];
  const version = argv.str('--version', 'latest');

  if (!name) {
    console.error('Error: <name> argument required');
    process.exit(1);
  }

  const result = { name, version, updated: false, success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Updating plugin: ${name} to ${version}`);
    console.log('\n[Plugin system not yet implemented]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}