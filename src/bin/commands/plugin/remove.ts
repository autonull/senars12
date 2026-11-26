/**
 * `senars plugin remove` — Remove a plugin.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'plugin:remove' });

export const sections: HelpSection[] = [
  standardSections.usage('senars plugin remove', 'Remove a plugin'),
  {
    title: 'Arguments',
    lines: [
      '<name>                 Plugin name to remove',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--json                 Output machine-readable JSON',
      '--yes                  Skip confirmation',
    ],
  },
  standardSections.examples([
    'senars plugin remove my-plugin',
    'senars plugin remove my-plugin --yes',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const name = argv.positional[0];
  const yes = argv.has('--yes');

  if (!name) {
    console.error('Error: <name> argument required');
    process.exit(1);
  }

  if (!yes && !jsonOutput) {
    console.warn('Warning: This will remove the plugin. Use --yes to confirm.');
    process.exit(1);
  }

  const result = { name, removed: false, success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Removing plugin: ${name}`);
    console.log('\n[Plugin system not yet implemented]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}