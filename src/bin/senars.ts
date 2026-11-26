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
import { dispatch, registerCommand, createStubCommand } from './lib/cli';
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
        '  wasm-bundle           Generate WASM bundle',
        '  self-report           Print cognitive state',
        '  imagine               Run imagine pipeline',
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
  let stdSections: any;
  let serveMcpMain: any, serveMcpSections: any;
  let serveHttpMain: any, serveHttpSections: any;
  let serveWsMain: any, serveWsSections: any;
  let edgeRunMain: any, edgeRunSections: any;
  let logicMain: any, logicSections: any;
  let logger: any;
  
  const { createAgentFromEnv, runAgent } = await import('./lib/lifecycle');
  const { maybeStartWebUI } = await import('./lib/entrypoint-base');
  const { readAppEnvConfig } = await import('./lib/env-config');
  const { createLogger } = await import('@senars/util/logger');
  const cliUtils = await import('./lib/cli-utils');
  stdSections = cliUtils.standardSections;
  
  const mcpMod = await import('./commands/serve/mcp');
  serveMcpMain = mcpMod.main;
  serveMcpSections = mcpMod.sections;
  
  const httpMod = await import('./commands/serve/http');
  serveHttpMain = httpMod.main;
  serveHttpSections = httpMod.sections;

  const wsMod = await import('./commands/serve/ws');
  serveWsMain = wsMod.main;
  serveWsSections = wsMod.sections;

  const edgeMod = await import('./commands/edge/run');
  edgeRunMain = edgeMod.main;
  edgeRunSections = edgeMod.sections;

  const logicMod = await import('./commands/logic');
  logicMain = logicMod.main;
  logicSections = logicMod.sections;

  logger = createLogger({ scope: 'senars' });

  registerCommand('run', {
    main: async (flags) => {
      const profileKind = flags.profile ?? 'agent';
      await runAgentMode(profileKind);
    },
    sections: [
      stdSections.usage('senars run', 'Run agent with profile (default command)'),
      {
        title: 'Options',
        lines: [
          '-p, --profile <kind>     Select profile: logic | coprocessor | agent | device (default: agent)',
          '--web-ui                 Enable Web UI',
          '--port <number>          Web UI port (default: 8765)',
          '-v, --version            Show version',
          '--verbose                Verbose output',
          '--quiet                  Suppress non-error output',
          '-h, --help               Show this help',
        ],
      },
      stdSections.examples([
        'senars run',
        'senars run --profile logic',
        'senars run --profile agent --web-ui --port 3000',
      ]),
    ],
  });

  // serve mcp
  registerCommand('serve mcp', { main: serveMcpMain, sections: serveMcpSections });

  // serve http
  registerCommand('serve http', { main: serveHttpMain, sections: serveHttpSections });

  // serve ws
  registerCommand('serve ws', { main: serveWsMain, sections: serveWsSections });

  // edge run
  registerCommand('edge run', { main: edgeRunMain, sections: edgeRunSections });

  // logic
  registerCommand('logic', { main: logicMain, sections: logicSections });

  // demo playground
  registerCommand('demo playground', {
    main: async (flags) => {
      await startPlayground(flags.profile);
    },
    sections: [
      stdSections.usage('senars demo playground', 'Start interactive playground'),
      {
        title: 'Options',
        lines: [
          '-p, --profile <kind>     Select profile (default: device)',
          '--web-ui                 Enable Web UI',
          '--port <number>          Web UI port (default: 8765)',
          '-v, --version            Show version',
          '--verbose                Verbose output',
          '--quiet                  Suppress non-error output',
          '-h, --help               Show this help',
        ],
      },
      stdSections.examples([
        'senars demo playground',
        'senars demo playground --profile logic --web-ui',
      ]),
    ],
  });

  // demo arcade
  registerCommand('demo arcade', createStubCommand('demo arcade', 'https://github.com/senars/senars/issues/XXX'));

  // demo imagine
  registerCommand('demo imagine', createStubCommand('demo imagine', 'https://github.com/senars/senars/issues/XXX'));

  // demo benchmark
  registerCommand('demo benchmark', createStubCommand('demo benchmark', 'https://github.com/senars/senars/issues/XXX'));

  // doctor check
  registerCommand('doctor check', createStubCommand('doctor check', 'https://github.com/senars/senars/issues/XXX'));

  // doctor status
  registerCommand('doctor status', createStubCommand('doctor status', 'https://github.com/senars/senars/issues/XXX'));

  // doctor report
  registerCommand('doctor report', createStubCommand('doctor report', 'https://github.com/senars/senars/issues/XXX'));

  // doctor tune
  registerCommand('doctor tune', createStubCommand('doctor tune', 'https://github.com/senars/senars/issues/XXX'));

  // doctor bench
  registerCommand('doctor bench', createStubCommand('doctor bench', 'https://github.com/senars/senars/issues/XXX'));

  // config validate
  registerCommand('config validate', createStubCommand('config validate', 'https://github.com/senars/senars/issues/XXX'));

  // config get
  registerCommand('config get', createStubCommand('config get', 'https://github.com/senars/senars/issues/XXX'));

  // config set
  registerCommand('config set', createStubCommand('config set', 'https://github.com/senars/senars/issues/XXX'));

  // config list
  registerCommand('config list', createStubCommand('config list', 'https://github.com/senars/senars/issues/XXX'));

  // session start
  registerCommand('session start', createStubCommand('session start', 'https://github.com/senars/senars/issues/XXX'));

  // session stop
  registerCommand('session stop', createStubCommand('session stop', 'https://github.com/senars/senars/issues/XXX'));

  // session list
  registerCommand('session list', createStubCommand('session list', 'https://github.com/senars/senars/issues/XXX'));

  // memory inspect
  registerCommand('memory inspect', createStubCommand('memory inspect', 'https://github.com/senars/senars/issues/XXX'));

  // memory export
  registerCommand('memory export', createStubCommand('memory export', 'https://github.com/senars/senars/issues/XXX'));

  // memory import
  registerCommand('memory import', createStubCommand('memory import', 'https://github.com/senars/senars/issues/XXX'));

  // model list
  registerCommand('model list', createStubCommand('model list', 'https://github.com/senars/senars/issues/XXX'));

  // model pull
  registerCommand('model pull', createStubCommand('model pull', 'https://github.com/senars/senars/issues/XXX'));

  // model remove
  registerCommand('model remove', createStubCommand('model remove', 'https://github.com/senars/senars/issues/XXX'));

  // wasm-bundle
  registerCommand('wasm-bundle', createStubCommand('wasm-bundle', 'https://github.com/senars/senars/issues/XXX'));

  // self-report
  registerCommand('self-report', createStubCommand('self-report', 'https://github.com/senars/senars/issues/XXX'));

  // imagine
  registerCommand('imagine', createStubCommand('imagine', 'https://github.com/senars/senars/issues/XXX'));
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