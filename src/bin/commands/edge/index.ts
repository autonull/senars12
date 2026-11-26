/**
 * `senars edge` — Edge worker commands (run).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { createStubCommand } from '../../lib/cli';

// Register edge subcommands as stubs for now
registerCommand('edge run', createStubCommand('edge run', 'https://github.com/senars/senars/issues/XXX'));

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
    ['run', createStubCommand('edge run', 'https://github.com/senars/senars/issues/XXX')],
  ]),
};