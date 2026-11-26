/**
 * `senars session` — Session management commands (start, stop, list).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { sessionStartModule } from './start';
import { sessionStopModule } from './stop';
import { sessionListModule } from './list';

// Register session subcommands
registerCommand('session start', sessionStartModule);
registerCommand('session stop', sessionStopModule);
registerCommand('session list', sessionListModule);

export const sessionModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars session <start|stop|list>');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars session <start|stop|list> [options]'],
    },
    {
      title: 'Subcommands',
      lines: [
        '  start    Start a new session',
        '  stop     Stop a session',
        '  list     List sessions',
      ],
    },
  ],
  subcommands: new Map([
    ['start', sessionStartModule],
    ['stop', sessionStopModule],
    ['list', sessionListModule],
  ]),
};