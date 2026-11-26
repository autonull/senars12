/**
 * `senars dialogue` — Dialogue management commands.
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { createStubCommand } from '../../lib/cli';

// Register dialogue subcommands as stubs for now
registerCommand('dialogue', createStubCommand('dialogue', 'https://github.com/senars/senars/issues/XXX'));

export const dialogueModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars dialogue [options]');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars dialogue [options]'],
    },
    {
      title: 'Options',
      lines: [
        '--help    Show help',
      ],
    },
  ],
};