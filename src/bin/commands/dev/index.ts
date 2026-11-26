/**
 * `senars dev` — Developer commands (repl, debug, profile, trace, inspect, benchmark, test, lint, typecheck, generate).
 */

import type { CommandModule } from '../../lib/cli';
import { registerCommand } from '../../lib/cli';
import { createStubModule } from '../../lib/command-base';
import { standardSections, type HelpSection } from '../../lib/cli-utils';

// Register dev subcommands as stubs for now
const devSubcommands = [
  'repl', 'debug', 'profile', 'trace', 'inspect',
  'benchmark', 'test', 'lint', 'typecheck', 'generate'
] as const;

for (const cmd of devSubcommands) {
  registerCommand(`dev ${cmd}`, createStubModule(`dev ${cmd}`, 'https://github.com/senars/senars/issues/XXX'));
}

const subcommandLines = devSubcommands.map(cmd => {
  const descriptions: Record<string, string> = {
    repl: 'Developer REPL',
    debug: 'Debug running agent',
    profile: 'CPU/memory profiling',
    trace: 'Trace execution',
    inspect: 'Inspect internal state',
    benchmark: 'Microbenchmarks',
    test: 'Run tests',
    lint: 'Lint code',
    typecheck: 'TypeScript check',
    generate: 'Generate code',
  };
  return `  ${cmd.padEnd(12)} ${descriptions[cmd]}`;
});

export const sections: HelpSection[] = [
  standardSections.usage('senars dev', 'Developer commands'),
  {
    title: 'Subcommands',
    lines: subcommandLines,
  },
];

export const devModule: CommandModule = {
  main: async () => {
    console.error('Usage: senars dev <repl|debug|profile|trace|inspect|benchmark|test|lint|typecheck|generate>');
    process.exit(1);
  },
  sections,
  subcommands: new Map(
    devSubcommands.map(cmd => [cmd, createStubModule(`dev ${cmd}`, 'https://github.com/senars/senars/issues/XXX')])
  ),
};

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCLI } = await import('../../lib/cli-utils');
  runCLI(devModule.main, { sections: devModule.sections, version: '0.0.0' });
}