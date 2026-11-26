/**
 * `senars model` — Model management commands (list, pull, remove).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { modelListModule } from './list';
import { modelPullModule } from './pull';
import { modelRemoveModule } from './remove';

// Register model subcommands
registerCommand('model list', modelListModule);
registerCommand('model pull', modelPullModule);
registerCommand('model remove', modelRemoveModule);

export const modelModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars model <list|pull|remove>');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars model <list|pull|remove> [options]'],
    },
    {
      title: 'Subcommands',
      lines: [
        '  list     List available models',
        '  pull     Pull/download a model',
        '  remove   Remove a model',
      ],
    },
  ],
  subcommands: new Map([
    ['list', modelListModule],
    ['pull', modelPullModule],
    ['remove', modelRemoveModule],
  ]),
};