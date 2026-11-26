#!/usr/bin/env tsx
/**
 * `pnpm senars` / `npx senars` — unified CLI entry point.
 *
 * Profiles as data: logic, coprocessor, agent, device (+ domain packs).
 * Device profile imports zero LM.
 *
 * All subcommands are registered in src/bin/lib/cli.ts via registerCommand().
 * This file is now a thin router that dispatches to the command registry.
 */

import { runEntrypoint } from './lib/fatal-error';
import { dispatch, registerCommand, createStubCommand, commandRegistry } from './lib/cli';
import { getProfileRegistry, profileHelpSection, standardSections, type HelpSection } from './lib/cli-utils';
import { startPlayground, startMCPServer, generateSchema, showSchema } from './lib/senars-commands';
import { listProfiles as listProfilesCmd, listPacks as listPacksCmd } from './lib/senars-commands';

/** Build help sections dynamically from profile registry (lazy). */
async function buildRootHelpSections(): Promise<HelpSection[]> {
  const registry = await getProfileRegistry();
  const profiles = registry.getAll();
  const profileInfos = profiles.map((p) => ({ kind: p.kind, name: p.name, description: p.description }));

  return [
    standardSections.usage('senars', 'SeNARS — The Fold: One deterministic fold over one log'),
    profileHelpSection(profileInfos),
    {
      title: 'Commands',
      lines: [
        '  run                   Run agent with profile (default)',
        '  serve mcp             Start MCP server',
        '  serve http            Start HTTP server',
        '  serve ws              Start WebSocket server',
        '  edge run              Run edge worker',
        '  logic                 Logic tool commands',
        '  demo playground       Start interactive playground',
        '  demo arcade           Start demo arcade',
        '  demo imagine          Run imagine demo',
        '  demo benchmark        Run benchmarks',
        '  doctor check          Run health checks',
        '  doctor status         Show system status',
        '  doctor report         Generate diagnostic report',
        '  doctor tune           Run tuning',
        '  doctor bench          Run benchmarks',
        '  config validate       Validate configuration',
        '  config get            Get config value',
        '  config set            Set config value',
        '  config list           List config',
        '  session start         Start session',
        '  session stop          Stop session',
        '  session list          List sessions',
        '  memory inspect        Inspect memory',
        '  memory export         Export memory',
        '  memory import         Import memory',
        '  model list            List models',
        '  model pull            Pull model',
        '  model remove          Remove model',
        '  experiment run        Run experiment',
        '  experiment list       List experiments',
        '  experiment show       Show experiment details',
        '  experiment compare    Compare experiments',
        '  experiment analyze    Analyze experiment results',
        '  experiment sweep      Parameter sweep experiment',
        '  experiment notebook   Export to Jupyter notebook',
        '  data import           Import data',
        '  data export           Export data',
        '  data transform        Transform data',
        '  data generate         Generate synthetic data',
        '  data validate         Validate data integrity',
        '  dev repl              Developer REPL',
        '  dev debug             Debug running agent',
        '  dev profile           CPU/memory profiling',
        '  dev trace             Trace execution',
        '  dev inspect           Inspect internal state',
        '  dev benchmark         Microbenchmarks',
        '  dev test              Run tests',
        '  dev lint              Lint code',
        '  dev typecheck         TypeScript check',
        '  dev generate          Generate code',
        '  plugin install        Install plugin',
        '  plugin remove         Remove plugin',
        '  plugin list           List plugins',
        '  plugin update         Update plugin',
        '  plugin info           Show plugin info',
        '  plugin dev            Plugin development mode',
        '  plugin create         Create plugin from template',
        '  plugin build          Build plugin for distribution',
        '  plugin publish        Publish plugin to registry',
        '  wasm-bundle           Generate WASM bundle',
        '  self-report           Print cognitive state',
        '  imagine               Run imagine pipeline',
        '  completion            Generate shell completions',
      ],
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
  const registry = await getProfileRegistry();
  const profile = registry.get(profileKind);

  if (!profile) {
    console.error(`Unknown profile: ${profileKind}`);
    process.exit(1);
  }

  console.log(`Starting SeNARS with profile: ${profile.name} (${profile.kind})`);

  if (profile.requiresLM) {
    const { readAppEnvConfig } = await import('./lib/env-config');
    const envConfig = readAppEnvConfig();
    if (!envConfig.enableWebUI) {
      console.warn('Warning: Profile requires LM but no LM configured. Set LM_API_KEY or LM_ENDPOINT.');
    }
  }

  const { createAgentFromEnv, runAgent } = await import('./lib/lifecycle');
  const { maybeStartWebUI } = await import('./lib/entrypoint-base');
  const { readAppEnvConfig } = await import('./lib/env-config');
  const { createLogger } = await import('@senars/util/logger');

  const logger = createLogger({ scope: 'senars' });
  const { agent } = await createAgentFromEnv({ narConfig: { maxConcepts: 100 } });
  await runAgent(agent);
  await maybeStartWebUI(agent, readAppEnvConfig().enableWebUI, undefined, logger);
}

/** Register all commands. */
async function registerAllCommands(): Promise<void> {
  // Import command modules lazily to avoid circular dependencies
  const [
    { runModule },
    { serveModule },
    { logicModule },
    { demoModule },
    { doctorModule },
    { configModule },
    { sessionModule },
    { memoryModule },
    { modelModule },
    { experimentModule },
    { dataModule },
    { devModule },
    { pluginModule },
    { edgeModule },
    { systemOneModule },
    { profileModule },
    { lmModule },
    { connectionModule },
    { dialogueModule },
    { diagnosticsModule },
    { runtimeModule },
  ] = await Promise.all([
    import('./commands/run'),
    import('./commands/serve'),
    import('./commands/logic'),
    import('./commands/demo'),
    import('./commands/doctor'),
    import('./commands/config/index'),
    import('./commands/session'),
    import('./commands/memory'),
    import('./commands/model'),
    import('./commands/experiment'),
    import('./commands/data'),
    import('./commands/dev'),
    import('./commands/plugin'),
    import('./commands/edge'),
    import('./commands/systemone'),
    import('./commands/profile'),
    import('./commands/lm'),
    import('./commands/connection'),
    import('./commands/dialogue'),
    import('./commands/diagnostics'),
    import('./commands/runtime'),
  ]);

  // Register top-level commands
  registerCommand('run', runModule);
  registerCommand('serve', serveModule);
  registerCommand('logic', logicModule);
  registerCommand('demo', demoModule);
  registerCommand('doctor', doctorModule);
  registerCommand('config', configModule);
  registerCommand('session', sessionModule);
  registerCommand('memory', memoryModule);
  registerCommand('model', modelModule);
  registerCommand('experiment', experimentModule);
  registerCommand('data', dataModule);
  registerCommand('dev', devModule);
  registerCommand('plugin', pluginModule);
  registerCommand('edge', edgeModule);
  registerCommand('systemone', systemOneModule);
  registerCommand('profile', profileModule);
  registerCommand('lm', lmModule);
  registerCommand('connection', connectionModule);
  registerCommand('dialogue', dialogueModule);
  registerCommand('diagnostics', diagnosticsModule);
  registerCommand('runtime', runtimeModule);

  // Stub commands (not yet implemented)
  registerCommand('wasm-bundle', createStubCommand('wasm-bundle', 'https://github.com/senars/senars/issues/XXX'));
  registerCommand('self-report', createStubCommand('self-report', 'https://github.com/senars/senars/issues/XXX'));
  registerCommand('imagine', createStubCommand('imagine', 'https://github.com/senars/senars/issues/XXX'));
  registerCommand('completion', createStubCommand('completion', 'https://github.com/senars/senars/issues/XXX'));
}

/** Main entry point. */
async function main(): Promise<void> {
  await registerAllCommands();
  const argv = process.argv.slice(2);
  // Skip `--` separator if present (from pnpm/npm)
  const cleanArgv = argv[0] === '--' ? argv.slice(1) : argv;
  // If no subcommand and no flags that imply default behavior, show help
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
      const { parseCommonFlags } = await import('./lib/cli-utils');
      const { parseFlags } = await import('@senars/util/cli');
      const flags = parseFlags(cleanArgv);
      const common = parseCommonFlags(flags);
      await startPlayground(common.profile);
      return;
    }
    // Default: run agent with profile
    const profileKind = customFlags.profile as string ?? 'agent';
    await runAgentMode(profileKind);
    return;
  }
  // Dispatch to registered command (handles subcommand --help/--version internally)
  await dispatch(cleanArgv);
}
runEntrypoint(main);