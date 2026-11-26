/**
 * Shared CLI utilities for entry points — argument parsing, help display, common patterns.
 */

import { parseFlags, type Flags } from '@senars/util/cli';

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
  profile?: string;
  webUI: boolean;
  webUIPort?: number;
}

/** Parse common flags used by multiple entry points. */
export function parseCommonFlags(flags: Flags): CommonFlags {
  return {
    help: flags.has('--help', '-h'),
    json: flags.has('--json'),
    profile: flags.str('--profile', flags.str('-p', '')) || undefined,
    webUI: flags.has('--web-ui', '--webui'),
    webUIPort: flags.num('--port', flags.num('-P', 0)) || undefined,
  };
}

/** Show help and exit. */
export function showHelpAndExit(sections: HelpSection[], code = 0): never {
  console.log(buildHelp(sections));
  process.exit(code);
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
  options: { sections: HelpSection[]; positionalName?: string } = { sections: [] }
): Promise<T> {
  const flags = parseFlags();
  const common = parseCommonFlags(flags);

  if (common.help) {
    showHelpAndExit(options.sections);
  }

  try {
    return await main(common, flags.positional);
  } catch (err) {
    console.error(common.json ? JSON.stringify({ error: String(err) }) : `Error: ${err}`);
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