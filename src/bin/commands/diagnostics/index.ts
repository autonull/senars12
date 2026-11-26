/**
 * `senars diagnostics` — Diagnostics commands.
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { createStubCommand } from '../../lib/cli';

// Register diagnostics subcommands as stubs for now
registerCommand('diagnostics', createStubCommand('diagnostics', 'https://github.com/senars/senars/issues/XXX'));

export const diagnosticsModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars diagnostics [options]');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars diagnostics [options]'],
    },
    {
      title: 'Options',
      lines: [
        '--help    Show help',
      ],
    },
  ],
};