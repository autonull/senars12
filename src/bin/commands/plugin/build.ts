/**
 * `senars plugin build` — Build a plugin for distribution.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'plugin:build' });

export const sections: HelpSection[] = [
  standardSections.usage('senars plugin build', 'Build a plugin for distribution'),
  {
    title: 'Arguments',
    lines: [
      '<path>                 Plugin source directory',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--output <path>        Output directory (default: ./dist)',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars plugin build ./my-plugin',
    'senars plugin build ./my-plugin --output ./dist/plugins',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const path = argv.positional[0];
  const output = argv.str('--output', './dist');

  if (!path) {
    console.error('Error: <path> argument required');
    process.exit(1);
  }

  const result = { path, output, built: false, success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Building plugin: ${path}`);
    console.log(`  Output: ${output}`);
    console.log('\n[Plugin build not yet implemented]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}