/**
 * `senars plugin list` — List plugins.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'plugin:list' });

export const sections: HelpSection[] = [
  standardSections.usage('senars plugin list', 'List plugins'),
  {
    title: 'Options',
    lines: [
      '--installed            Show only installed plugins',
      '--available            Show only available plugins',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars plugin list',
    'senars plugin list --installed',
    'senars plugin list --available',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const installed = argv.has('--installed');
  const available = argv.has('--available');

  const result = {
    installed: [] as Array<{ name: string; version: string; enabled: boolean }>,
    available: [] as Array<{ name: string; version: string; description: string }>,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Installed plugins:');
    if (result.installed.length === 0) console.log('  (none)');
    else for (const p of result.installed) console.log(`  ${p.name}@${p.version} [${p.enabled ? 'enabled' : 'disabled'}]`);

    console.log('\nAvailable plugins:');
    if (result.available.length === 0) console.log('  (none)');
    else for (const p of result.available) console.log(`  ${p.name}@${p.version} - ${p.description}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}