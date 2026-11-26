/**
 * `senars lm` — LM management commands.
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { createStubCommand } from '../../lib/cli';

// Register lm subcommands as stubs for now
registerCommand('lm', createStubCommand('lm', 'https://github.com/senars/senars/issues/XXX'));

export const lmModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars lm [options]');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars lm [options]'],
    },
    {
      title: 'Options',
      lines: [
        '--help    Show help',
      ],
    },
  ],
};