/**
 * `senars config` — Configuration commands (validate, get, set, list).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { configValidateModule } from './validate';
import { configGetModule } from './get';
import { configSetModule } from './set';
import { configListModule } from './list';

// Register config subcommands
registerCommand('config validate', configValidateModule);
registerCommand('config get', configGetModule);
registerCommand('config set', configSetModule);
registerCommand('config list', configListModule);

export const configModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars config <validate|get|set|list>');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars config <validate|get|set|list> [options]'],
    },
    {
      title: 'Subcommands',
      lines: [
        '  validate    Validate configuration file',
        '  get         Get configuration value',
        '  set         Set configuration value',
        '  list        List effective configuration',
      ],
    },
  ],
  subcommands: new Map([
    ['validate', configValidateModule],
    ['get', configGetModule],
    ['set', configSetModule],
    ['list', configListModule],
  ]),
};