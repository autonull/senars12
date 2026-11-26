/**
 * SeNARS Bot — unified interactive entry point.
 *
 * CLI-only by default: no IRC/WS/HTTP/MCP unless ENABLE_*=true or started
 * at runtime via `.connect`. Replaces bot-ai.ts, repl.ts, status.ts,
 * doctor.ts, multi-agent.ts, tune.ts (`--status/--doctor/--tune/--arcade/
 * --multiagent` delegate to `src/bin/lib/*` runners).
 *
 * This module owns wiring, lifecycle and chat capture. The `.command` surface
 * lives in `src/bin/commands/*`; non-interactive runners in `src/bin/lib/*`.
 */

import { parseFlags, type Flags } from '@senars/util/cli';
import { isOneShot, readOneShot, runOneShot } from '../lib/oneshot';
import { runEntrypoint } from '../lib/fatal-error';
import { createAgentFromEnv, runAgent } from '../lib/lifecycle';
import { readAppEnvConfig, readAuthConfig } from '../lib/env-config';
import { createLogger, setupGracefulShutdown, envBool } from '@senars/util/logger';
import { ensureDir } from '@senars/util/fs';
import { createConnectionFactories, registerConnectionFactories, createBindTo, autoConnect } from './connections';
import {
  createRemoteRegistry,
  buildRuntimeState,
  attachGameAndRebuild,
  createBotRuntime,
  setupCLIConnection,
  startAutoConnections,
  startAgentAndUI,
  setupShutdown,
  printBanner,
  serveHttpRoutes,
} from './wiring';
import { AuthManager, CLIConnection, ConnectionManager, type Connection } from '@senars/io';
import { runMultiAgentEntry } from './multi-agent';
import { runStatus } from '../lib/status-report';
import { runDoctor } from '../lib/doctor-report';
import { runTune } from '../lib/tune-runner';
// runArcade is dynamically imported to avoid circular dependencies
const runArcade = () => import('../../../scripts/arcade');

const logger = createLogger({ scope: 'bot' });

/** Non-interactive modes that delegate to lib runners. */
const NON_INTERACTIVE_MODES: Record<string, () => Promise<unknown>> = {
  '--status': runStatus,
  '--doctor': runDoctor,
  '--tune': runTune,
  '--arcade': runArcade,
  '--multiagent': runMultiAgentEntry,
};

async function runNonInteractive(flags: Flags): Promise<boolean> {
  if (flags.has('--help', '-h')) {
    console.log(
      [
        'Usage: pnpm run bot [-- --status|--doctor|--tune|--arcade|--multiagent] [--json]',
        '       pnpm run bot -- "(a-->b). (a-->c)?" [--steps N] [--json]',
        '',
        'One-shot: positional Narsese (one argument may hold several sentences). The punctuation is the task type — "." belief, "!" goal, "?" question — and questions print their answer with its derivation.',
        'No arguments: interactive CLI (senars> ). Connections are opt-in via .connect or ENABLE_IRC/WS/HTTP/MCP=true.',
      ].join('\n')
    );
    return true;
  }

  const mode = Object.keys(NON_INTERACTIVE_MODES).find((flag) => flags.has(flag));
  if (mode) {
    await NON_INTERACTIVE_MODES[mode]?.();
    return true;
  }

  if (isOneShot(flags)) {
    await runOneShot(readOneShot(flags));
    return true;
  }

  return false;
}

async function main(): Promise<void> {
  if (await runNonInteractive(parseFlags())) return;

  await ensureDir('.cache/sessions').catch(() => undefined);
  const wired = await createAgentFromEnv();
  const { agent, sessionManager, profile } = wired;
  const lmConfig = require('@senars/lm').resolveLMConfig();
  const settings = require('@senars/lm').resolveLMSettings();
  const { nar, lmService, episodicMemory } = wired;

  // Set httpKernel for reasoning route
  const httpKernel = nar as unknown as import('@senars/metrics').ReasoningHttpEngine;
  (await import('@senars/metrics')).createReasoningRoute(() => httpKernel);

  const auth = new AuthManager();
  const authCfg = readAuthConfig();
  if (authCfg.secret) for (const id of authCfg.connectionIds) auth.setSecret(id, authCfg.secret);

  const cm = new ConnectionManager();
  const factories = createConnectionFactories(logger);
  registerConnectionFactories(cm, factories);

  let currentSession = sessionManager.getOrCreate('default');
  let tier: import('@senars/cli').ChatTier = profile.narrateTier;

  // Build runtime state (groundedness, trace, enrich, dialogue, memory, strategy)
  const runtimeState = buildRuntimeState(wired);

  // Attach conversation game and rebuild enrich/dialogue
  const { conversationGame, enrich, dialogue } = await attachGameAndRebuild(wired, runtimeState);

  // Rebuild runtime state with actual conversationGame
  const runtimeStateWithGame = buildRuntimeState(wired);
  runtimeStateWithGame.conversationGame = conversationGame;
  const { enrich: enrichWithGame, dialogue: dialogueWithGame } = await attachGameAndRebuild(wired, runtimeStateWithGame);

  // Parameter ledger and strategy adapter (already in runtimeState)
  const { parameterLedger, strategyAdapter } = runtimeState;

  // Bot-only default profile: enable System One by default
  if (!wired.appConfig.systemOne?.enabled) {
    const { systemOneDefaults } = await import('../../config/index');
    wired.appConfig.systemOne = {
      ...systemOneDefaults,
      enabled: true,
      manifold: { ...systemOneDefaults.manifold, provider: 'wasi' },
      cortex: { ...systemOneDefaults.cortex, provider: 'llamacpp-embedded' },
      lmReflex: { ...systemOneDefaults.lmReflex, grammarActions: true, maxCandidates: 3 },
    };
  }

  // Create command registry and bind function
  const registry = createRemoteRegistry(auth);
  const secretIds = new Set<string>();
  const bindTo = createBindTo(agent, auth, registry, sessionManager, episodicMemory, cm);

  // Create BotRuntime
  const rt = createBotRuntime(wired, {
    cm,
    auth,
    registry,
    dialogue: dialogueWithGame,
    memoryQuery: runtimeState.memoryQuery,
    strategyAdapter,
    parameterLedger,
    conversationGame,
    ground: runtimeState.ground,
    trace: runtimeState.trace,
    profile: wired.appConfig.profile,
    tier,
    secretIds,
    appConfig: wired.appConfig,
  });

  // Set up CLI connection
  const cli = setupCLIConnection(rt, sessionManager);
  await cli.connect();
  agent.mount(cli as never);

  // Start auto-connections
  await startAutoConnections(cm, bindTo, wired.appConfig, logger);

  // Start agent and optional Web UI
  await startAgentAndUI(agent, wired.appConfig, logger);

  // Set up graceful shutdown
  setupShutdown(rt, currentSession, logger);

  // Print banner
  printBanner(rt, settings);
}

export { main };
runEntrypoint(main);