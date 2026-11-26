/**
 * `senars plugin dev` — Local development mode for plugin.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'plugin:dev' });

export const sections: HelpSection[] = [
  standardSections.usage('senars plugin dev', 'Local development mode for plugin'),
  {
    title: 'Arguments',
    lines: [
      '<name>                 Plugin name or path',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--watch                Watch for changes and reload',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars plugin dev ./my-plugin',
    'senars plugin dev my-plugin --watch',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const name = argv.positional[0];
  const watch = argv.has('--watch');

  if (!name) {
    console.error('Error: <name> argument required');
    process.exit(1);
  }

  const result = { name, watch, devMode: true, success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Starting dev mode for plugin: ${name}`);
    console.log(`  Watch: ${watch}`);
    console.log('\n[Plugin dev mode not yet implemented]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}