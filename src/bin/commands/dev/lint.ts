/**
 * `senars dev lint` — Lint code.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'dev:lint' });

export const sections: HelpSection[] = [
  standardSections.usage('senars dev lint', 'Lint code'),
  {
    title: 'Options',
    lines: [
      '--fix                  Auto-fix lint errors',
      '--format <fmt>         Output format: default|json|compact (default: default)',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars dev lint',
    'senars dev lint --fix',
    'senars dev lint --format json',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const fix = argv.has('--fix');
  const format = argv.str('--format', 'default');

  const result = { fix, format, success: true };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Linting code...`);
    console.log(`  Fix: ${fix}`);
    console.log(`  Format: ${format}`);
    console.log('\n[Linter not yet implemented - use pnpm lint]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}