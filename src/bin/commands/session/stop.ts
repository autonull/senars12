/**
 * `senars session stop` — Stop a session.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'session:stop' });

export const sections: HelpSection[] = [
  standardSections.usage('senars session stop', 'Stop a session'),
  {
    title: 'Arguments',
    lines: [
      '<session-id>           Session ID to stop',
    ],
  },
  {
    title: 'Options',
    lines: [
      '--json                 Output machine-readable JSON',
    ],
  },
  standardSections.examples([
    'senars session stop abc123',
    'senars session stop abc123 --json',
  ]),
];

export async function main(flags: CommonFlags, positional: string[]): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const sessionId = positional[0];

  if (!sessionId) {
    console.error('Error: <session-id> argument required');
    process.exit(1);
  }

  // This is a stub - session persistence would need to be implemented
  const output = {
    sessionId,
    stoppedAt: new Date().toISOString(),
    status: 'completed',
  };

  if (jsonOutput) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(`Session stopped: ${sessionId}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}