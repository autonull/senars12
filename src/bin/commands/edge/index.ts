/**
 * `senars edge` — Edge worker commands (run).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { edgeRunModule } from './run';

// Register edge subcommands
registerCommand('edge run', edgeRunModule);

export const edgeModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars edge <run>');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars edge <run> [options]'],
    },
    {
      title: 'Subcommands',
      lines: [
        '  run    Run edge worker',
      ],
    },
  ],
  subcommands: new Map([
    ['run', edgeRunModule],
  ]),
};