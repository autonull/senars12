/**
 * `senars dev test` — Run tests.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'dev:test' });

export const sections: HelpSection[] = [
  standardSections.usage('senars dev test', 'Run tests'),
  {
    title: 'Options',
    lines: [
      '--filter <pattern>     Test filter pattern',
      '--watch                Watch mode',
      '--coverage             Generate coverage report',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars dev test --filter "nar/*"',
    'senars dev test --watch',
    'senars dev test --coverage',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const filter = argv.str('--filter');
  const watch = argv.has('--watch');
  const coverage = argv.has('--coverage');

  const result = { filter, watch, coverage, success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Running tests:');
    if (filter) console.log(`  Filter: ${filter}`);
    console.log(`  Watch: ${watch}`);
    console.log(`  Coverage: ${coverage}`);
    console.log('\n[Test runner not yet implemented - use pnpm test]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}