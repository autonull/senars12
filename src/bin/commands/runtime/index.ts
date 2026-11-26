/**
 * `senars runtime` — Runtime commands.
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { createStubCommand } from '../../lib/cli';

// Register runtime subcommands as stubs for now
registerCommand('runtime', createStubCommand('runtime', 'https://github.com/senars/senars/issues/XXX'));

export const runtimeModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars runtime [options]');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars runtime [options]'],
    },
    {
      title: 'Options',
      lines: [
        '--help    Show help',
      ],
    },
  ],
};