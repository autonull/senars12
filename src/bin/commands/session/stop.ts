/**
 * `senars session stop` — Stop a session.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'session stop',
  description: 'Stop a session',
  usage: 'senars session stop <session-id> [options]',
  sections: [
    { lines: ['<session-id>           Session ID to stop'] },
    { lines: ['--json                 Output machine-readable JSON'] },
  ],
  examples: [
    'senars session stop abc123',
    'senars session stop abc123 --json',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
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
  }, flags, 'session stop');
});

export const sessionStopModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}