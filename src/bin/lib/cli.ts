/**
 * Command Registry & Dispatch — Unified CLI routing for SeNARS.
 *
 * Replaces ad-hoc entry points with a single registry and dispatcher.
 * All commands register themselves; senars.ts becomes a thin router.
 */

import type { HelpSection, CommonFlags } from './cli-utils';

/** Module interface for a command implementation. */
export interface CommandModule {
  /** Main handler — receives common flags and positional arguments. */
  main: (flags: CommonFlags, positional: string[]) => Promise<void>;
  /** Help sections for --help display. */
  sections: HelpSection[];
  /** Optional: subcommands this command owns (for nested dispatch). */
  subcommands?: Map<string, CommandModule>;
}

/** Global command registry. */
export const commandRegistry = new Map<string, CommandModule>();

/** Register a top-level command. */
export function registerCommand(path: string, module: CommandModule): void {
  commandRegistry.set(path, module);
}

/** Register a subcommand under a parent command. */
export function registerSubcommand(parentPath: string, name: string, module: CommandModule): void {
  const parent = commandRegistry.get(parentPath);
  if (!parent) {
    throw new Error(`Parent command not registered: ${parentPath}`);
  }
  if (!parent.subcommands) {
    parent.subcommands = new Map();
  }
  parent.subcommands.set(name, module);
}

/** Get a command module by path (e.g., "serve" or "serve mcp"). */
export function getCommand(path: string): CommandModule | undefined {
  const parts = path.split(' ');
  let current: CommandModule | undefined = commandRegistry.get(parts[0]);

  for (let i = 1; i < parts.length && current; i++) {
    current = current.subcommands?.get(parts[i]);
  }

  return current;
}

/** List all registered top-level commands. */
export function listCommands(): string[] {
  return Array.from(commandRegistry.keys()).sort();
}

/** Dispatch to a command based on argv. */
export async function dispatch(argv: string[]): Promise<void> {
  if (argv.length === 0) {
    // No subcommand — show root help
    await showRootHelp();
    return;
  }

  // Use getCommand to properly resolve nested subcommands
  const module = getCommand(argv.join(' '));
  if (!module) {
    const subcommand = argv[0];
    console.error(`Unknown command: ${subcommand}`);
    console.error(`Run 'senars --help' for available commands.`);
    process.exit(1);
  }

  // Parse flags for the subcommand (all args after the matched command)
  // We need to figure out how many parts were consumed by the command
  const parts = argv.join(' ').split(' ');
  let matchedParts = 0;
  for (let i = parts.length; i > 0; i--) {
    if (getCommand(parts.slice(0, i).join(' '))) {
      matchedParts = i;
      break;
    }
  }
  const rest = argv.slice(matchedParts);

  const { parseFlags } = await import('@senars/util/cli');
  const flags = parseFlags(rest);
  const { parseCommonFlags } = await import('./cli-utils');
  const commonFlags = parseCommonFlags(flags);

  // Handle --help at subcommand level
  if (commonFlags.help) {
    const { showHelpAndExit } = await import('./cli-utils');
    showHelpAndExit(module.sections);
  }

  // Handle --version at subcommand level
  if (commonFlags.version) {
    const { getVersion } = await import('./lib/cli-utils');
    console.log(getVersion());
    process.exit(0);
  }

  try {
    await module.main(commonFlags, flags.positional);
  } catch (err) {
    if (!commonFlags.quiet) {
      console.error(commonFlags.json ? JSON.stringify({ error: String(err) }) : `Error: ${err}`);
    }
    process.exit(1);
  }
}

/** Show root-level help with all commands. */
async function showRootHelp(): Promise<void> {
  const { showHelpAndExit, getVersion, standardSections } = await import('./cli-utils');
  const version = getVersion();

  const commands = listCommands();
  const commandLines = commands.map((cmd) => {
    const mod = commandRegistry.get(cmd);
    const desc = mod?.sections[0]?.lines[0]?.replace(/^  /, '') ?? '';
    return `  ${cmd.padEnd(20)} ${desc}`;
  });

  const sections: HelpSection[] = [
    standardSections.usage('senars', 'SeNARS — The Fold: One deterministic fold over one log'),
    {
      title: 'Commands',
      lines: commandLines.length > 0 ? commandLines : ['  (no commands registered)'],
    },
    standardSections.examples([
      'senars run --profile agent',
      'senars serve mcp --port 3000',
      'senars logic prove "<program>" "<goal>"',
      'senars demo playground',
      'senars doctor check',
      'senars config validate',
    ]),
    {
      title: 'Global Options',
      lines: [
        '-h, --help               Show help',
        '-v, --version            Show version',
        '--json                   Output JSON',
        '--quiet                  Suppress non-error output',
        '--verbose                Verbose output',
        '-p, --profile <kind>     Select profile (logic | coprocessor | agent | device)',
        '--web-ui                 Enable Web UI',
        '--port <number>          Web UI port (default: 8765)',
      ],
    },
  ];

  showHelpAndExit(sections);
}

/** Create a stub command module for not-yet-implemented commands. */
export function createStubCommand(commandName: string, issueUrl?: string): CommandModule {
  const sections: HelpSection[] = [
    {
      title: 'Usage',
      lines: [`senars ${commandName} [options]`, '', `⚠️  Command not yet implemented: ${commandName}`],
    },
    {
      title: 'Tracking',
      lines: issueUrl ? [`  Track progress: ${issueUrl}`] : ['  No issue URL configured'],
    },
  ];

  return {
    main: async () => {
      console.error(`⚠️  Command not yet implemented: ${commandName}`);
      if (issueUrl) {
        console.error(`   Track progress: ${issueUrl}`);
      }
      process.exit(1);
    },
    sections,
  };
}