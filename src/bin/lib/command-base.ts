/**
 * Base command module utilities — eliminates boilerplate across all command modules.
 *
 * Provides a standard interface for commands with help sections, flag parsing, and error handling.
 */

import type { Flags } from '@senars/util/cli';
import { parseFlags } from '@senars/util/cli';
import type { CommonFlags, HelpSection } from './cli-utils';
import { parseCommonFlags, runCLI, standardSections, formatError } from './cli-utils';
import type { CommandModule } from './cli';
import { createStubCommand } from './cli';

/** Options for creating a command module. */
export interface CommandOptions {
  /** Command name (e.g., "config get", "serve mcp"). */
  name: string;
  /** Short description for help. */
  description: string;
  /** Usage string (e.g., "senars config get <key>"). */
  usage: string;
  /** Additional help sections. */
  sections?: Omit<HelpSection, 'title'>[];
  /** Examples for help display. */
  examples?: string[];
  /** Whether this command has subcommands. */
  hasSubcommands?: boolean;
  /** Subcommands map (if hasSubcommands). */
  subcommands?: Map<string, CommandModule>;
}

/** Create standard help sections from options. */
export function createHelpSections(options: CommandOptions): HelpSection[] {
  // Remove [options] from usage if present, as standardSections.usage adds it automatically
  const usage = options.usage.replace(/\s*\[options\]\s*$/, '');
  const sections: HelpSection[] = [
    standardSections.usage(usage, options.description),
  ];

  if (options.sections && options.sections.length > 0) {
    sections.push(...options.sections.map((s, i) => ({
      title: ['Arguments', 'Options', 'Transport', 'Authentication', 'Profile'][i] ?? `Section ${i + 1}`,
      lines: s.lines,
    })));
  }

  if (options.examples && options.examples.length > 0) {
    sections.push(standardSections.examples(options.examples));
  }

  return sections;
}

/** Create a command module with standard boilerplate. */
export function createCommandModule(
  options: CommandOptions,
  main: (flags: CommonFlags, positional: string[], rawFlags: Flags) => Promise<void>
): CommandModule {
  const sections = createHelpSections(options);

  const wrappedMain = async (flags: CommonFlags, positional: string[]): Promise<void> => {
    const rawFlags = parseFlags(); // For command-specific flags like --config, --json
    await main(flags, positional, rawFlags);
  };

  return {
    main: wrappedMain,
    sections,
    subcommands: options.subcommands,
  };
}

/** Create a stub command module (not yet implemented). */
export function createStubModule(name: string, issueUrl?: string): CommandModule {
  return createStubCommand(name, issueUrl);
}

/** Standard flag helpers for common patterns. */
export const flagHelpers = {
  /** Get string flag with fallback. */
  str: (flags: Flags, name: string, fallback: string): string =>
    flags.str(name, fallback),

  /** Get number flag with fallback. */
  num: (flags: Flags, name: string, fallback: number): number =>
    flags.num(name, fallback),

  /** Get boolean flag. */
  has: (flags: Flags, ...names: string[]): boolean =>
    flags.has(...names),

  /** Check if JSON output is requested. */
  jsonMode: (flags: Flags): boolean =>
    flags.has('--json'),

  /** Get positional arguments. */
  positional: (flags: Flags): string[] =>
    flags.positional,
};

/** Common error handling wrapper. */
export async function handleErrors<T>(
  fn: () => Promise<T>,
  flags: CommonFlags,
  context?: string
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!flags.quiet) {
      console.error(formatError(err, flags.json, context));
    }
    process.exit(1);
  }
}