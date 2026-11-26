/**
 * `senars session list` — List sessions.
 */

import type { CommonFlags, HelpSection } from '../../lib/cli-utils';
import { runCLI, standardSections } from '../../lib/cli-utils';
import { createLogger, parseFlags, jsonMode } from '@senars/util';

const logger = createLogger({ scope: 'session:list' });

export const sections: HelpSection[] = [
  standardSections.usage('senars session list', 'List sessions'),
  {
    title: 'Options',
    lines: [
      '--limit <n>            Maximum number of sessions to show (default: 20)',
      '--json                 Output machine-readable JSON',
      '--format <fmt>         Output format: table|json (default: table)',
    ],
  },
  standardSections.examples([
    'senars session list',
    'senars session list --json',
    'senars session list --limit 50',
  ]),
];

export async function main(flags: CommonFlags): Promise<void> {
  const argv = parseFlags();
  const jsonOutput = jsonMode(argv);
  const format = argv.str('--format', 'table');
  const limit = parseInt(argv.str('--limit', '20'), 10);

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
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(main, { sections, version: '0.0.0' });
}