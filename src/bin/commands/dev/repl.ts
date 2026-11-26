/**
 * `senars dev repl` — Developer REPL with introspection.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'dev:repl' });

export const sections: HelpSection[] = [
  standardSections.usage('senars dev repl', 'Start developer REPL'),
  {
    title: 'Options',
    lines: [
      '--profile <name>       Profile to use (default: agent)',
      '--inspect              Enable introspection mode',
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars dev repl',
    'senars dev repl --profile logic --inspect',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const profile = argv.str('--profile', 'agent');
  const inspect = argv.has('--inspect');

  if (jsonOutput) {
    console.log(JSON.stringify({ profile, inspect, started: true }, null, 2));
  } else {
    console.log(`Starting developer REPL (profile: ${profile})`);
    if (inspect) console.log('Introspection mode: enabled');
    console.log('Type ".help" for commands, ".exit" to quit');
    // REPL would be implemented here
    console.log('\n[REPL not yet implemented]');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}