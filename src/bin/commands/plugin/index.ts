/**
 * `senars plugin` — Plugin management commands (install, remove, list, update, info, dev, create, build, publish).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { createStubModule } from '../../lib/command-base';
import { standardSections, type HelpSection } from '../../lib/cli-utils';

// Register plugin subcommands as stubs for now
const pluginSubcommands = [
  'install', 'remove', 'list', 'update', 'info',
  'dev', 'create', 'build', 'publish'
] as const;

for (const cmd of pluginSubcommands) {
  registerCommand(`plugin ${cmd}`, createStubModule(`plugin ${cmd}`, 'https://github.com/senars/senars/issues/XXX'));
}

const subcommandLines = pluginSubcommands.map(cmd => {
  const descriptions: Record<string, string> = {
    install: 'Install plugin',
    remove: 'Remove plugin',
    list: 'List plugins',
    update: 'Update plugin',
    info: 'Show plugin info',
    dev: 'Plugin development mode',
    create: 'Create plugin from template',
    build: 'Build plugin for distribution',
    publish: 'Publish plugin to registry',
  };
  return `  ${cmd.padEnd(12)} ${descriptions[cmd]}`;
});

export const sections: HelpSection[] = [
  standardSections.usage('senars plugin', 'Plugin management commands'),
  {
    title: 'Subcommands',
    lines: subcommandLines,
  },
];

export const pluginModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars plugin <install|remove|list|update|info|dev|create|build|publish>');
    process.exit(1);
  },
  sections,
  subcommands: new Map(
    pluginSubcommands.map(cmd => [cmd, createStubModule(`plugin ${cmd}`, 'https://github.com/senars/senars/issues/XXX')])
  ),
};

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(pluginModule.main, { sections: pluginModule.sections, version: '0.0.0' });
}