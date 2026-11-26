/**
 * `senars connection` — Connection management commands.
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { createStubCommand } from '../../lib/cli';

// Register connection subcommands as stubs for now
registerCommand('connection', createStubCommand('connection', 'https://github.com/senars/senars/issues/XXX'));

export const connectionModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars connection [options]');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars connection [options]'],
    },
    {
      title: 'Options',
      lines: [
        '--help    Show help',
      ],
    },
  ],
};