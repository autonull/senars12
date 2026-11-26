/**
 * `senars plugin` — Plugin management commands (install, remove, list, update, info, dev, create, build, publish).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { createStubCommand } from '../../lib/cli';

// Register plugin subcommands as stubs for now
registerCommand('plugin install', createStubCommand('plugin install', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('plugin remove', createStubCommand('plugin remove', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('plugin list', createStubCommand('plugin list', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('plugin update', createStubCommand('plugin update', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('plugin info', createStubCommand('plugin info', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('plugin dev', createStubCommand('plugin dev', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('plugin create', createStubCommand('plugin create', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('plugin build', createStubCommand('plugin build', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('plugin publish', createStubCommand('plugin publish', 'https://github.com/senars/senars/issues/XXX'));

export const pluginModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars plugin <install|remove|list|update|info|dev|create|build|publish>');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars plugin <install|remove|list|update|info|dev|create|build|publish> [options]'],
    },
    {
      title: 'Subcommands',
      lines: [
        '  install     Install plugin',
        '  remove      Remove plugin',
        '  list        List plugins',
        '  update      Update plugin',
        '  info        Show plugin info',
        '  dev         Plugin development mode',
        '  create      Create plugin from template',
        '  build       Build plugin for distribution',
        '  publish     Publish plugin to registry',
      ],
    },
  ],
  subcommands: new Map([
    ['install', createStubCommand('plugin install', 'https://github.com/senars/senars/issues/XXX')],
    ['remove', createStubCommand('plugin remove', 'https://github.com/senars/senars/issues/XXX')],
    ['list', createStubCommand('plugin list', 'https://github.com/senars/senars/issues/XXX')],
    ['update', createStubCommand('plugin update', 'https://github.com/senars/senars/issues/XXX')],
    ['info', createStubCommand('plugin info', 'https://github.com/senars/senars/issues/XXX')],
    ['dev', createStubCommand('plugin dev', 'https://github.com/senars/senars/issues/XXX')],
    ['create', createStubCommand('plugin create', 'https://github.com/senars/senars/issues/XXX')],
    ['build', createStubCommand('plugin build', 'https://github.com/senars/senars/issues/XXX')],
    ['publish', createStubCommand('plugin publish', 'https://github.com/senars/senars/issues/XXX')],
  ]),
};