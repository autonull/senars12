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
  let demoPlaygroundMain: any, demoPlaygroundSections: any;
  let demoArcadeMain: any, demoArcadeSections: any;
  let demoImagineMain: any, demoImagineSections: any;
  let demoBenchmarkMain: any, demoBenchmarkSections: any;
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

  const demoPlaygroundMod = await import('./commands/demo/playground');
  demoPlaygroundMain = demoPlaygroundMod.main;
  demoPlaygroundSections = demoPlaygroundMod.sections;

  const demoArcadeMod = await import('./commands/demo/arcade');
  demoArcadeMain = demoArcadeMod.main;
  demoArcadeSections = demoArcadeMod.sections;

  const demoImagineMod = await import('./commands/demo/imagine');
  demoImagineMain = demoImagineMod.main;
  demoImagineSections = demoImagineMod.sections;

  const demoBenchmarkMod = await import('./commands/demo/benchmark');
  demoBenchmarkMain = demoBenchmarkMod.main;
  demoBenchmarkSections = demoBenchmarkMod.sections;

  const doctorCheckMod = await import('./commands/doctor/check');
  const doctorCheckMain = doctorCheckMod.main;
  const doctorCheckSections = doctorCheckMod.sections;

  const doctorStatusMod = await import('./commands/doctor/status');
  const doctorStatusMain = doctorStatusMod.main;
  const doctorStatusSections = doctorStatusMod.sections;

  const doctorReportMod = await import('./commands/doctor/report');
  const doctorReportMain = doctorReportMod.main;
  const doctorReportSections = doctorReportMod.sections;

  const doctorTuneMod = await import('./commands/doctor/tune');
  const doctorTuneMain = doctorTuneMod.main;
  const doctorTuneSections = doctorTuneMod.sections;

  const doctorBenchMod = await import('./commands/doctor/bench');
  const doctorBenchMain = doctorBenchMod.main;
  const doctorBenchSections = doctorBenchMod.sections;

  const configValidateMod = await import('./commands/config/validate');
  const configValidateMain = configValidateMod.main;
  const configValidateSections = configValidateMod.sections;

  const configGetMod = await import('./commands/config/get');
  const configGetMain = configGetMod.main;
  const configGetSections = configGetMod.sections;

  const configSetMod = await import('./commands/config/set');
  const configSetMain = configSetMod.main;
  const configSetSections = configSetMod.sections;

  const configListMod = await import('./commands/config/list');
  const configListMain = configListMod.main;
  const configListSections = configListMod.sections;

  const sessionStartMod = await import('./commands/session/start');
  const sessionStartMain = sessionStartMod.main;
  const sessionStartSections = sessionStartMod.sections;

  const sessionStopMod = await import('./commands/session/stop');
  const sessionStopMain = sessionStopMod.main;
  const sessionStopSections = sessionStopMod.sections;

  const sessionListMod = await import('./commands/session/list');
  const sessionListMain = sessionListMod.main;
  const sessionListSections = sessionListMod.sections;

  const memoryInspectMod = await import('./commands/memory/inspect');
  const memoryInspectMain = memoryInspectMod.main;
  const memoryInspectSections = memoryInspectMod.sections;

  const memoryExportMod = await import('./commands/memory/export');
  const memoryExportMain = memoryExportMod.main;
  const memoryExportSections = memoryExportMod.sections;

  const memoryImportMod = await import('./commands/memory/import');
  const memoryImportMain = memoryImportMod.main;
  const memoryImportSections = memoryImportMod.sections;

  const modelListMod = await import('./commands/model/list');
  const modelListMain = modelListMod.main;
  const modelListSections = modelListMod.sections;

  const modelPullMod = await import('./commands/model/pull');
  const modelPullMain = modelPullMod.main;
  const modelPullSections = modelPullMod.sections;

  const modelRemoveMod = await import('./commands/model/remove');
  const modelRemoveMain = modelRemoveMod.main;
  const modelRemoveSections = modelRemoveMod.sections;

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
  registerCommand('demo playground', { main: demoPlaygroundMain, sections: demoPlaygroundSections });

  // demo arcade
  registerCommand('demo arcade', { main: demoArcadeMain, sections: demoArcadeSections });

  // demo imagine
  registerCommand('demo imagine', { main: demoImagineMain, sections: demoImagineSections });

  // demo benchmark
  registerCommand('demo benchmark', { main: demoBenchmarkMain, sections: demoBenchmarkSections });

  // doctor check
  registerCommand('doctor check', { main: doctorCheckMain, sections: doctorCheckSections });

  // doctor status
  registerCommand('doctor status', { main: doctorStatusMain, sections: doctorStatusSections });

  // doctor report
  registerCommand('doctor report', { main: doctorReportMain, sections: doctorReportSections });

  // doctor tune
  registerCommand('doctor tune', { main: doctorTuneMain, sections: doctorTuneSections });

  // doctor bench
  registerCommand('doctor bench', { main: doctorBenchMain, sections: doctorBenchSections });

  // config validate
  registerCommand('config validate', { main: configValidateMain, sections: configValidateSections });

  // config get
  registerCommand('config get', { main: configGetMain, sections: configGetSections });

  // config set
  registerCommand('config set', { main: configSetMain, sections: configSetSections });

  // config list
  registerCommand('config list', { main: configListMain, sections: configListSections });

  // session start
  registerCommand('session start', { main: sessionStartMain, sections: sessionStartSections });

  // session stop
  registerCommand('session stop', { main: sessionStopMain, sections: sessionStopSections });

  // session list
  registerCommand('session list', { main: sessionListMain, sections: sessionListSections });

  // memory inspect
  registerCommand('memory inspect', { main: memoryInspectMain, sections: memoryInspectSections });

  // memory export
  registerCommand('memory export', { main: memoryExportMain, sections: memoryExportSections });

  // memory import
  registerCommand('memory import', { main: memoryImportMain, sections: memoryImportSections });

  // model list
  registerCommand('model list', { main: modelListMain, sections: modelListSections });

  // model pull
  registerCommand('model pull', { main: modelPullMain, sections: modelPullSections });

  // model remove
  registerCommand('model remove', { main: modelRemoveMain, sections: modelRemoveSections });

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