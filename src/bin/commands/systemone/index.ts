/**
 * `senars systemone` — System One commands.
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { createStubCommand } from '../../lib/cli';

// Register systemone subcommands as stubs for now
registerCommand('systemone', createStubCommand('systemone', 'https://github.com/senars/senars/issues/XXX'));

export const systemOneModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars systemone [options]');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars systemone [options]'],
    },
    {
      title: 'Options',
      lines: [
        '--help    Show help',
      ],
    },
  ],
};