/**
 * `senars plugin publish` — Publish a plugin to registry.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'plugin:publish' });

export const sections: HelpSection[] = [
  standardSections.usage('senars plugin publish', 'Publish a plugin to registry'),
  {
    title: 'Arguments',
    lines: [
      '<path>                 Built plugin directory or package file',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--registry <url>       Registry URL (default: official registry)',
      '--json                 Output machine-readable JSON',
      '--yes                  Skip confirmation',
    ],
  },
  standardSections.examples([
    'senars plugin publish ./dist/my-plugin',
    'senars plugin publish ./dist/my-plugin.tgz --registry https://registry.example.com',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const path = argv.positional[0];
  const registry = argv.str('--registry', 'https://registry.senars.dev');
  const yes = argv.has('--yes');

  if (!path) {
    console.error('Error: <path> argument required');
    process.exit(1);
  }

  if (!yes && !jsonOutput) {
    console.warn(`Warning: This will publish to ${registry}. Use --yes to confirm.`);
    process.exit(1);
  }

  const result = { path, registry, published: false, success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Publishing plugin: ${path}`);
    console.log(`  Registry: ${registry}`);
    console.log('\n[Plugin publish not yet implemented]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}