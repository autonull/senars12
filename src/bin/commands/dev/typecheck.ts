/**
 * `senars dev typecheck` — TypeScript type check.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'dev:typecheck' });

export const sections: HelpSection[] = [
  standardSections.usage('senars dev typecheck', 'TypeScript type check'),
  {
    title: 'Options',
    lines: [
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars dev typecheck',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);

  const result = { success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('Type checking...');
    console.log('\n[Type checker not yet implemented - use pnpm tsc --noEmit]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}