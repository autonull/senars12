/**
 * `senars dev` — Developer commands (repl, debug, profile, trace, inspect, benchmark, test, lint, typecheck, generate).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { createStubCommand } from '../../lib/cli';

// Register dev subcommands as stubs for now
registerCommand('dev repl', createStubCommand('dev repl', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('dev debug', createStubCommand('dev debug', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('dev profile', createStubCommand('dev profile', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('dev trace', createStubCommand('dev trace', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('dev inspect', createStubCommand('dev inspect', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('dev benchmark', createStubCommand('dev benchmark', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('dev test', createStubCommand('dev test', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('dev lint', createStubCommand('dev lint', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('dev typecheck', createStubCommand('dev typecheck', 'https://github.com/senars/senars/issues/XXX'));
registerCommand('dev generate', createStubCommand('dev generate', 'https://github.com/senars/senars/issues/XXX'));

export const devModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars dev <repl|debug|profile|trace|inspect|benchmark|test|lint|typecheck|generate>');
    process.exit(1);
  },
  sections: [
    {
      title: 'Usage',
      lines: ['senars dev <repl|debug|profile|trace|inspect|benchmark|test|lint|typecheck|generate> [options]'],
    },
    {
      title: 'Subcommands',
      lines: [
        '  repl        Developer REPL',
        '  debug       Debug running agent',
        '  profile     CPU/memory profiling',
        '  trace       Trace execution',
        '  inspect     Inspect internal state',
        '  benchmark   Microbenchmarks',
        '  test        Run tests',
        '  lint        Lint code',
        '  typecheck   TypeScript check',
        '  generate    Generate code',
      ],
    },
  ],
  subcommands: new Map([
    ['repl', createStubCommand('dev repl', 'https://github.com/senars/senars/issues/XXX')],
    ['debug', createStubCommand('dev debug', 'https://github.com/senars/senars/issues/XXX')],
    ['profile', createStubCommand('dev profile', 'https://github.com/senars/senars/issues/XXX')],
    ['trace', createStubCommand('dev trace', 'https://github.com/senars/senars/issues/XXX')],
    ['inspect', createStubCommand('dev inspect', 'https://github.com/senars/senars/issues/XXX')],
    ['benchmark', createStubCommand('dev benchmark', 'https://github.com/senars/senars/issues/XXX')],
    ['test', createStubCommand('dev test', 'https://github.com/senars/senars/issues/XXX')],
    ['lint', createStubCommand('dev lint', 'https://github.com/senars/senars/issues/XXX')],
    ['typecheck', createStubCommand('dev typecheck', 'https://github.com/senars/senars/issues/XXX')],
    ['generate', createStubCommand('dev generate', 'https://github.com/senars/senars/issues/XXX')],
  ]),
};