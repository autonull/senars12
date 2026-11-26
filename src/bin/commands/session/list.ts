/**
 * `senars session list` — List sessions.
 */

import type { CommonFlags } from '../../lib/cli-utils';
import type { CommandModule } from '../../lib/cli';
import { createCommandModule, flagHelpers, handleErrors } from '../../lib/command-base';

export const sections = createCommandModule({
  name: 'session list',
  description: 'List sessions',
  usage: 'senars session list [options]',
  sections: [
    { lines: ['--limit <n>            Maximum number of sessions to show (default: 20)', '--json                 Output machine-readable JSON', '--format <fmt>         Output format: table|json (default: table)'] },
  ],
  examples: [
    'senars session list',
    'senars session list --json',
    'senars session list --limit 50',
  ],
}, async (flags: CommonFlags, positional: string[], rawFlags): Promise<void> => {
  await handleErrors(async () => {
    const jsonOutput = flagHelpers.jsonMode(rawFlags);
    const format = flagHelpers.str(rawFlags, '--format', 'table');
    const limit = flagHelpers.num(rawFlags, '--limit', 20);

    // This is a stub - session persistence would need to be implemented
    const sessions: Array<{
      id: string;
      startedAt: string;
      status: 'active' | 'completed' | 'failed';
      profile: string;
      messageCount: number;
    }> = [];

    const output = { sessions, total: sessions.length };

    if (jsonOutput || format === 'json') {
      console.log(JSON.stringify(output, null, 2));
    } else {
      if (sessions.length === 0) {
        console.log('No sessions found');
        return;
      }
      console.log('ID                                    Started              Status      Profile    Messages');
      console.log('--------------------------------------------------------------------------------');
      for (const s of sessions.slice(0, limit)) {
        console.log(
          `${s.id.padEnd(36)} ${s.startedAt.padEnd(19)} ${s.status.padEnd(10)} ${s.profile.padEnd(8)} ${s.messageCount}`
        );
      }
    }
  }, flags, 'session list');
});

export const sessionListModule: CommandModule = { main: sections.main, sections: sections.sections };

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(sections.main, { sections: sections.sections, version: '0.0.0' });
}