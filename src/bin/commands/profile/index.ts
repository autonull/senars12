/**
 * `senars profile` — Profile management commands.
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { createStubCommand } from '../../lib/cli';

// Register profile subcommands as stubs for now
registerCommand('profile', createStubCommand('profile', 'https://github.com/senars/senars/issues/XXX'));

export const profileModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars profile [options]');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars profile [options]'],
    },
    {
      title: 'Options',
      lines: [
        '--help    Show help',
      ],
    },
  ],
};