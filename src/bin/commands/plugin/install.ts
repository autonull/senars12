/**
 * `senars plugin install` — Install a plugin.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'plugin:install' });

export const sections: HelpSection[] = [
  standardSections.usage('senars plugin install', 'Install a plugin'),
  {
    title: 'Arguments',
    lines: [
      '<name>                 Plugin name or URL',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--version <ver>        Plugin version (default: latest)',
      '--source <url>         Custom registry/source URL',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars plugin install my-plugin',
    'senars plugin install my-plugin --version 1.0.0',
    'senars plugin install https://github.com/user/plugin.git',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const name = argv.positional[0];
  const version = argv.str('--version', 'latest');
  const source = argv.str('--source');

  if (!name) {
    console.error('Error: <name> argument required');
    process.exit(1);
  }

  const result = { name, version, source, installed: false, success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Installing plugin: ${name}@${version}`);
    if (source) console.log(`  Source: ${source}`);
    console.log('\n[Plugin system not yet implemented]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}