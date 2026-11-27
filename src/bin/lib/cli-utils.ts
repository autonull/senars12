/**
 * Shared CLI utilities for entry points — argument parsing, help display, common patterns.
 */

import { parseFlags, type Flags } from '@senars/util/cli';
import { errMsg } from '@senars/util/error';

/** Format an error for CLI output. */
export function formatError(err: unknown, json: boolean, context?: string): string {
  const message = context ? `${context}: ${errMsg(err)}` : errMsg(err);
  return json ? JSON.stringify({ error: message }) : `Error: ${message}`;
}

/** Standard help section. */
export interface HelpSection {
  title: string;
  lines: string[];
}

/** Build help text from sections. */
export function buildHelp(sections: HelpSection[]): string {
  return sections
    .map((s) => (s.title ? `\n${s.title}:\n` : '') + s.lines.map((l) => `  ${l}`).join('\n'))
    .join('\n');
}

/** Common flag definitions for entry points. */
export interface CommonFlags {
  help: boolean;
  json: boolean;
  version: boolean;
  profile?: string;
  webUI: boolean;
  webUIPort?: number;
  verbose: boolean;
  quiet: boolean;
}

/** Parse common flags used by multiple entry points. */
export function parseCommonFlags(flags: Flags): CommonFlags {
  return {
    help: flags.has('--help', '-h'),
    json: flags.has('--json'),
    version: flags.has('--version', '-v'),
    profile: flags.str('--profile', flags.str('-p', '')) || undefined,
    webUI: flags.has('--web-ui', '--webui'),
    webUIPort: flags.num('--port', flags.num('-P', 0)) || undefined,
    verbose: flags.has('--verbose'),
    quiet: flags.has('--quiet'),
  };
}

/** Show help and exit. */
export function showHelpAndExit(sections: HelpSection[], code = 0): never {
  console.log(buildHelp(sections));
  process.exit(code);
}

/** Get package version from package.json. */
export function getVersion(): string {
  try {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/** Standard entry point sections. */
export const standardSections = {
  usage: (cmd: string, description: string) => ({
    title: 'Usage',
    lines: [`${cmd} [options]`, '', description],
  }),
  examples: (examples: string[]) => ({
    title: 'Examples',
    lines: examples,
  }),
};

/** Run a CLI command with standard error handling. */
export async function runCLI<T>(
  main: (flags: CommonFlags, positional: string[]) => Promise<T>,
  options: { sections: HelpSection[]; positionalName?: string; version?: string } = { sections: [] }
): Promise<T> {
  const flags = parseFlags();
  const common = parseCommonFlags(flags);

  if (common.version) {
    console.log(options.version ?? getVersion());
    process.exit(0);
  }

  if (common.help) {
    showHelpAndExit(options.sections);
  }

  try {
    return await main(common, flags.positional);
  } catch (err) {
    if (!common.quiet) {
      console.error(formatError(err, common.json));
    }
    process.exit(1);
  }
}

/** Start Web UI if enabled (shared across entry points). */
export async function maybeStartWebUI(
  agent: unknown,
  enabled: boolean,
  port?: number,
  logger?: { info: (msg: string) => void; error: (msg: string, err: Error) => void }
): Promise<void> {
  if (!enabled) return;
  try {
    const { startAgentUI } = await import('../../ui/src/server/index');
    await startAgentUI(agent as never, { port: port ?? 8765 });
    logger?.info(`Web UI at http://localhost:${port ?? 8765}`);
  } catch (err) {
    logger?.error('Web UI failed to start', err as Error);
  }
}

/** Create a standard profile selector help section. */
export function profileHelpSection(profiles: Array<{ kind: string; name: string; description: string }>): HelpSection {
  return {
    title: 'Profiles',
    lines: [
      `--profile <kind>    Select profile: ${profiles.map((p) => p.kind).join(' | ')}`,
      ...profiles.map((p) => `  ${p.kind.padEnd(12)} ${p.name} - ${p.description}`),
    ],
  };
}

/** Memoized registry accessors to avoid repeated instantiation. */
let _profileRegistry: ReturnType<typeof import('../../profiles/index').createProfileRegistry> | null = null;
let _genomeRegistry: ReturnType<typeof import('../../genome/index').createGenomeRegistry> | null = null;

export function getProfileRegistry() {
  if (!_profileRegistry) {
    _profileRegistry = import('../../profiles/index').then(m => m.createProfileRegistry());
  }
  return _profileRegistry;
}

export function getGenomeRegistry() {
  if (!_genomeRegistry) {
    _genomeRegistry = import('../../genome/index').then(m => m.createGenomeRegistry());
  }
  return _genomeRegistry;
}

/** Format a list of profiles for console output. */
export function formatProfileList(profiles: Array<{ kind: string; name: string; description: string; requiresLM: boolean; faculties: string[]; oracles: string[]; packs: string[] }>): string {
  return profiles.map(p =>
    `  ${p.kind.padEnd(12)} ${p.name}\n` +
    `    ${p.description}\n` +
    `    LM Required: ${p.requiresLM ? 'Yes' : 'No'}\n` +
    `    Faculties: ${p.faculties.join(', ')}\n` +
    `    Oracles: ${p.oracles.join(', ')}\n` +
    `    Packs: ${p.packs.join(', ')}`
  ).join('\n\n');
}

/** Format a list of domain packs for console output. */
export function formatPackList(packs: Record<string, { name: string; description: string; faculties: string[]; oracles: string[] }>): string {
  return Object.entries(packs).map(([key, pack]) =>
    `  ${key.padEnd(20)} ${pack.name}\n` +
    `    ${pack.description}\n` +
    `    Faculties: ${pack.faculties.join(', ')}\n` +
    `    Oracles: ${pack.oracles.join(', ')}`
  ).join('\n\n');
}

/** Shared schema registration for MCP server. */
export async function registerDefaultMCPSchemas(genome: Awaited<ReturnType<typeof getGenomeRegistry>>): Promise<void> {
  const { z } = await import('zod');
  const { intBetween, unitInterval } = await import('../../config/boundary');
  
  genome.register({
    id: 'task',
    name: 'Task',
    schema: z.object({
      id: z.string(),
      description: z.string(),
      priority: intBetween(0, 10),
      tags: z.array(z.string()).optional(),
    }),
    description: 'A task to execute',
    mcpTool: { name: 'task.create', description: 'Create a task', handler: 'handleTaskCreate' },
    elicitation: { title: 'Create Task', description: 'Enter task details' },
  });

  genome.register({
    id: 'belief',
    name: 'Belief',
    schema: z.object({
      term: z.string(),
      truth: z.object({ f: unitInterval, c: unitInterval }),
      tags: z.array(z.string()).optional(),
    }),
    description: 'A belief statement',
    mcpTool: { name: 'belief.add', description: 'Add a belief', handler: 'handleBeliefAdd' },
    elicitation: { title: 'Add Belief', description: 'Enter belief details' },
  });
}