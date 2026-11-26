/**
 * `senars session start` — Start a new session.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { ulid } from 'ulid';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'session start',
  description: 'Start a new session',
  usage: 'senars session start [options]',
  sections: [
    { lines: ['--profile <kind>       Profile to use (default: agent)', '--fork <session-id>    Fork from existing session', '--replay               Replay session from start', '--label <name>         Human-readable label', '--json                 Output machine-readable JSON'] },
  ],
  examples: [
    'senars session start',
    'senars session start --profile logic',
    'senars session start --fork abc123 --label "experiment branch"',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const profile = flagHelpers.str(rawFlags, '--profile', 'agent');
    const fork = flagHelpers.str(rawFlags, '--fork', '');
    const replay = flagHelpers.has(rawFlags, '--replay');
    const label = flagHelpers.str(rawFlags, '--label', '');

    // This is a stub - session persistence would need to be implemented
    const sessionId = ulid();
    const output = {
      sessionId,
      profile,
      label,
      forkedFrom: fork,
      replay,
      startedAt: new Date().toISOString(),
      status: 'active',
    };

    if (jsonOutput) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(`Session started: ${sessionId}`);
      console.log(`  Profile: ${profile}`);
      if (label) console.log(`  Label: ${label}`);
      if (fork) console.log(`  Forked from: ${fork}`);
      if (replay) console.log(`  Replay mode: true`);
    }
  }, flags, 'session start');
});

export const sessionStartModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}