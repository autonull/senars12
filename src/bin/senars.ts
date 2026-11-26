#!/usr/bin/env tsx
/**
 * `pnpm senars` / `npx senars` — unified CLI entry point.
 *
 * Profiles as data: logic, coprocessor, agent, device (+ domain packs).
 * Device profile imports zero LM.
 *
 * All subcommands are registered via command manifest.
 * This file is a thin router that dispatches to the command registry.
 */

import { runEntrypoint } from './lib/fatal-error';
import { dispatch, registerCommand, getCommand, listCommands } from './lib/cli';
import { getProfileRegistry, profileHelpSection, standardSections, type HelpSection, parseCommonFlags, runCLI } from './lib/cli-utils';
import { startPlayground, startMCPServer, generateSchema, showSchema } from './lib/senars-commands';
import { listProfiles as listProfilesCmd, listPacks as listPacksCmd } from './lib/senars-commands';
import { commandManifest } from './commands/manifest';

/** Build help sections dynamically from profile registry and command manifest. */
async function buildRootHelpSections(): Promise<HelpSection[]> {
  const registry = await getProfileRegistry();
  const profiles = registry.getAll();
  const profileInfos = profiles.map((p) => ({ kind: p.kind, name: p.name, description: p.description }));

  // Build command lines from manifest + registered subcommands
  const commandLines: string[] = [];
  for (const entry of commandManifest) {
    const mod = getCommand(entry.name);
    const desc = mod?.sections[0]?.lines[0]?.replace(/^  /, '') ?? entry.description;
    commandLines.push(`  ${entry.name.padEnd(20)} ${desc}`);
  }

  // Add subcommands for known groups
  const subcommandGroups = ['serve', 'doctor', 'config', 'session', 'memory', 'model', 'experiment', 'data', 'dev', 'plugin', 'demo'];
  for (const group of subcommandGroups) {
    const mod = getCommand(group);
    if (mod?.subcommands) {
      for (const [name, subMod] of mod.subcommands) {
        const desc = subMod.sections[0]?.lines[0]?.replace(/^  /, '') ?? '';
        commandLines.push(`  ${group} ${name.padEnd(18)} ${desc}`);
      }
    }
  }

  return [
    standardSections.usage('senars', 'SeNARS — The Fold: One deterministic fold over one log'),
    profileHelpSection(profileInfos),
    {
      title: 'Commands',
      lines: commandLines.length > 0 ? commandLines : ['  (no commands registered)'],
    },
    standardSections.examples([
      'senars run --profile agent',
      'senars run --profile logic',
      'senars serve mcp --port 3000',
      'senars logic prove "<program>" "<goal>"',
      'senars demo playground',
      'senars doctor check',
      'senars config validate',
    ]),
  ];
}

/** Parse custom flags (kebab-case to camelCase for Zod schema). */
function parseCustomFlags(argv: string[]): Record<string, unknown> {
  const customArgs: Record<string, unknown> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      let key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        customArgs[key] = nextArg;
        i++;
      } else {
        customArgs[key] = true;
      }
    }
  }

  if (customArgs.mcpPort) customArgs.mcpPort = parseInt(String(customArgs.mcpPort), 10);
  if (customArgs.generate) customArgs.generate = String(customArgs.generate);
  if (customArgs.schema) customArgs.schema = String(customArgs.schema);

  return customArgs;
}

/** Run agent with profile (default mode). */
async function runAgentMode(profileKind: string): Promise<void> {
  const { runModule } = await import('./commands/run');
  const flags = {
    help: false,
    json: false,
    version: false,
    profile: profileKind,
    webUI: false,
    webUIPort: undefined,
    verbose: false,
    quiet: false,
  };
  await runModule.main(flags);
}

/** Register all commands from manifest. */
async function registerAllCommands(): Promise<void> {
  // Resolve module paths relative to this file's directory
  const baseDir = import.meta.dirname;
  const resolvedManifest = commandManifest.map((entry) => ({
    ...entry,
    resolvedPath: new URL(entry.modulePath, `file://${baseDir}/`).href,
  }));

  // Import all command modules in parallel
  const imports: any[] = [];
  for (const entry of resolvedManifest) {
    const mod = await import(entry.resolvedPath);
    imports.push(mod);
  }

  // Register top-level commands
  for (let i = 0; i < resolvedManifest.length; i++) {
    const entry = resolvedManifest[i];
    const module = imports[i];
    // Find the exported CommandModule (usually named *Module)
    const moduleKey = Object.keys(module).find((k) => k.endsWith('Module')) ?? 'default';
    const commandModule = module[moduleKey];
    if (commandModule) {
      registerCommand(entry.name, commandModule);
    }
  }
}

/** Main entry point. */
async function main(): Promise<void> {
  await registerAllCommands();

  const argv = process.argv.slice(2);
  const cleanArgv = argv[0] === '--' ? argv.slice(1) : argv;

  const hasSubcommand = cleanArgv.length > 0 && !cleanArgv[0].startsWith('--');
  const hasProfileFlag = cleanArgv.includes('--profile') || cleanArgv.includes('-p');
  const hasMCPFlag = cleanArgv.includes('--mcp');
  const hasPlaygroundFlag = cleanArgv.includes('--playground');
  const hasListProfiles = cleanArgv.includes('--list-profiles');
  const hasListPacks = cleanArgv.includes('--list-packs');
  const hasGenerate = cleanArgv.some((a) => a.startsWith('--generate'));
  const hasSchema = cleanArgv.some((a) => a.startsWith('--schema'));

  // Handle global --help and --version ONLY when no subcommand
  if (!hasSubcommand && (cleanArgv.includes('--help') || cleanArgv.includes('-h'))) {
    const sections = await buildRootHelpSections();
    const { showHelpAndExit } = await import('./lib/cli-utils');
    showHelpAndExit(sections);
  }
  if (!hasSubcommand && (cleanArgv.includes('--version') || cleanArgv.includes('-v'))) {
    const { getVersion } = await import('./lib/cli-utils');
    console.log(getVersion());
    process.exit(0);
  }
  if (!hasSubcommand && !hasProfileFlag && !hasMCPFlag && !hasPlaygroundFlag && !hasListProfiles && !hasListPacks && !hasGenerate && !hasSchema) {
    const sections = await buildRootHelpSections();
    const { showHelpAndExit } = await import('./lib/cli-utils');
    showHelpAndExit(sections);
  }

  // Handle legacy flags for backward compatibility (only when no subcommand)
  if (!hasSubcommand) {
    const customFlags = parseCustomFlags(cleanArgv);
    if (customFlags.listProfiles) {
      await listProfilesCmd();
      return;
    }
    if (customFlags.listPacks) {
      listPacksCmd();
      return;
    }
    if (customFlags.generate) {
      await generateSchema(String(customFlags.generate));
      return;
    }
    if (customFlags.schema) {
      await showSchema(String(customFlags.schema));
      return;
    }
    if (customFlags.mcp) {
      await startMCPServer(typeof customFlags.mcpPort === 'number' ? customFlags.mcpPort : undefined);
      return;
    }
    if (customFlags.playground) {
      const { parseFlags } = await import('@senars/util/cli');
      const flags = parseFlags(cleanArgv);
      const common = parseCommonFlags(flags);
      await startPlayground(common.profile);
      return;
    }
    // Default: run agent with profile
    const profileKind = (customFlags.profile as string) ?? 'agent';
    await runAgentMode(profileKind);
    return;
  }

  // Dispatch to registered command (handles subcommand --help/--version internally)
  await dispatch(cleanArgv);
}

runEntrypoint(main);