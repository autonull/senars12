/**
 * `senars memory` — Memory management commands (inspect, export, import).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { memoryInspectModule } from './inspect';
import { memoryExportModule } from './export';
import { memoryImportModule } from './import';

// Register memory subcommands
registerCommand('memory inspect', memoryInspectModule);
registerCommand('memory export', memoryExportModule);
registerCommand('memory import', memoryImportModule);

export const memoryModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars memory <inspect|export|import>');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars memory <inspect|export|import> [options]'],
    },
    {
      title: 'Subcommands',
      lines: [
        '  inspect    Inspect memory (concepts, beliefs, episodes)',
        '  export     Export memory to file',
        '  import     Import memory from file',
      ],
    },
  ],
  subcommands: new Map([
    ['inspect', memoryInspectModule],
    ['export', memoryExportModule],
    ['import', memoryImportModule],
  ]),
};