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

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createCapturePhase, DEFAULT_MACRO_PIPELINE, createBudget } from '../../budget/index';
import { AuthManager, bindAgentToConnection, CLIConnection, type Connection, ConnectionManager, createConnectionConfigsFromEnv } from '../../io/index';
import { createMeTTa, parseMeTTa } from '../../metta/index';
import { ParameterLedger, DEFAULT_LEDGER_PATH } from '../../config/parameter-ledger';
import { DialogueCapture, RetrospectiveAdapter } from '../../dialogue/index';
import { SourceReputation, DEFAULT_REPUTATION_PATH, providerKey } from '../../kernel/index';
import { resolveLMConfig, resolveLMSettings } from '../../lm/index';
import { evaluateQuery } from '../../lm/system-one/head-ontology';
import { computeEvidenceId } from '../../lm/system-one/distill';
import { createReasoningRoute, handleMetricsRequest, type ReasoningHttpEngine } from '../../metrics/index';
import { NLUnderstandingService, TranslationCache } from '../../nl/index';
import { MemoryQuery } from '../../query/index';
import { MettaProposer } from '../../reflex/index';
import type { LMTask } from '@senars/types/llm';
import { createLogger, ensureDir, errMsg, type Flags, makeId, parseFlags, setupGracefulShutdown, thaw, unique, envBool } from '../../util/index';
import { Effect } from 'effect';
import { buildCommands } from '../../cli/commands';
import { reflexesOf } from '../../cli/conversation-game';
import { assertValidEnv } from '../../util/env-validate';
import { buildBotCommands, type BotRuntime, type ConnectSpec, type GroundednessState, gpuSummary, runSessionRetrospective, type SystemOneBag, type TraceState } from '../commands/index';
import { readAppEnvConfig, readAuthConfig } from '../lib/env-config';
import { runEntrypoint } from '../lib/fatal-error';
import { createAgentFromEnv, runAgent } from '../lib/lifecycle';
import { isOneShot, readOneShot, runOneShot } from '../lib/oneshot';
import { createConnectionFactories, registerConnectionFactories, createBindTo, autoConnect } from './connections';
import { buildGroundednessState, buildTraceState, buildEnrich, buildDialogueCapture, attachConversationGame, captureDistillation, narrationKeys, systemOneOf } from './runtime';
import { collectChat } from './chat';

/* ============================================================================
 * Inlined from ../lib/remote-registry.ts
 * ==========================================================================*/
import { CommandRegistry, connectionCommands, createAuthCommands } from '../../io/index';
import { coreCommands, narCommands, memoryCommands, episodesCommands, lmCommands, rlfpCommands, selfCommands } from '../../commands/index';

const createRemoteRegistry = (auth: AuthManager): CommandRegistry => {
  const registry = new CommandRegistry();
  for (const command of [
    ...coreCommands,
    ...narCommands,
    ...memoryCommands,
    ...episodesCommands,
    ...lmCommands,
    ...rlfpCommands,
    ...selfCommands,
    ...connectionCommands,
    ...createAuthCommands(auth),
  ]) {
    registry.register(command);
  }
  return registry;
};

/* ============================================================================
 * Inlined from ../lib/multi-agent-runner.ts + ../lib/multi-agent-entry.ts
 * ==========================================================================*/
import type { WiredNAR } from '../../agent/index';
import { NARBuilder } from '../../agent/index';
import { mettaPort } from '../lib/metta';

interface MultiAgentRunnerOptions {
  scope: string;
  banner: string[];
  createWired: () => Promise<WiredNAR>;
}

const runMultiAgent = async (opts: MultiAgentRunnerOptions): Promise<void> => {
  const logger = createLogger({ scope: opts.scope });

  for (const line of opts.banner) {
    console.log(line);
  }

  console.log('[NAR] Initializing...');
  const wired = await opts.createWired();
  const { agent } = wired;

  console.log('[NAR] Ready — NAR + MeTTa reasoning via one agent');
  await agent.start();
  console.log('[Agent] Ready');

  const wsConfig = {
    id: 'ws-demo',
    enabled: true,
    type: 'websocket' as const,
    config: { name: 'Multi-Agent WS', host: 'localhost', port: 8766 },
  };

  const { WSConnection } = await import('../../io/index');
  const wsConn = new WSConnection(wsConfig, {
    emit: (event: string, data: unknown) => logger.debug(`[WS] ${event}`, data as Record<string, unknown>),
    logger,
    getSessionSpaceId: () => 'demo',
  });

  wsConn.onMessage(async (msg: { text: string }) => {
    let response = '';
    for await (const evt of agent.chat(msg.text)) {
      if (evt.kind === 'text-delta' && evt.text) wsConn.send('default', evt.text).catch(() => {});
      if (evt.kind === 'finish') response = evt.text ?? '';
    }
    if (response) wsConn.send('default', response).catch(() => {});
  });
  console.log('[WS] Server listening on ws://localhost:8766');

  const cliConfig = {
    id: 'cli-demo',
    enabled: true,
    type: 'cli' as const,
    config: { name: 'Multi-Agent CLI' },
  };

  const cliConn = new CLIConnection(cliConfig, { emit: () => {}, logger, getSessionSpaceId: () => 'demo' });

  cliConn.onMessage(async (msg: { text: string }) => {
    for await (const evt of agent.chat(msg.text)) {
      if ((evt.kind === 'text-delta' || evt.kind === 'finish') && evt.text) console.log(`[Agent] ${evt.text}`);
    }
  });
  console.log('[CLI] Ready for input\n');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Try sending messages via:');
  console.log('  - WebSocket: ws://localhost:8766');
  console.log('  - CLI: type in this terminal');
  console.log('Press Ctrl+C to exit');
  console.log('═══════════════════════════════════════════════════════════════\n');

  setupGracefulShutdown(
    async () => {
      await agent.stop();
      await wsConn.disconnect();
      await cliConn.disconnect();
    },
    { info: (msg) => console.log(msg) }
  );
};

const runMultiAgentEntry = async (): Promise<void> => {
  const testing = parseFlags().has('--testing');
  const banner = testing
    ? ['[NAR] Initializing...']
    : [
        '╔═══════════════════════════════════════════════════════════════╗',
        '║  SeNARS Multi-Agent Demo (NAR + MeTTa)                       ║',
        '╚═══════════════════════════════════════════════════════════════╝',
        '',
      ];

  await runMultiAgent({
    scope: testing ? 'multi-agent-testing' : 'multi-agent',
    banner,
    createWired: async () =>
      NARBuilder.fromProfile('arcade')
        .withNarConfig({
          maxConcepts: testing ? 100 : 100,
          activationDecayRate: testing ? 0 : undefined,
          consolidationInterval: testing ? 1000 : undefined,
          cpuThrottleMs: testing ? 0 : undefined,
          maxDerivationDepth: testing ? 20 : undefined,
        })
        .withMetta(mettaPort())
        .build(),
  });
};

assertValidEnv();

const logger = createLogger({ scope: 'bot' });

/** `--flag` → runner, in precedence order. `undefined` return falls through to the REPL. */
const NON_INTERACTIVE_MODES: Record<string, () => Promise<unknown>> = {
  '--status': () => import('../lib/status-report').then((m) => m.runStatus()),
  '--doctor': () => import('../lib/doctor-report').then((m) => m.runDoctor()),
  '--tune': () => import('../lib/tune-runner').then((m) => m.runTune()),
  '--arcade': () => import('../../scripts/arcade'),
  '--multiagent': () => runMultiAgentEntry(),
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
  const lmConfig = resolveLMConfig();
  const settings = resolveLMSettings();
  const { nar, lmService, episodicMemory } = wired;

  // Set httpKernel for reasoning route
  const httpKernel = nar as unknown as ReasoningHttpEngine;
  const reasoningRoute = createReasoningRoute(() => httpKernel);

  const auth = new AuthManager();
  const authCfg = readAuthConfig();
  if (authCfg.secret) for (const id of authCfg.connectionIds) auth.setSecret(id, authCfg.secret);

  const cm = new ConnectionManager();
  const factories = createConnectionFactories(logger);
  registerConnectionFactories(cm, factories);

  let currentSession = sessionManager.getOrCreate('default');
  let tier: LMTask = profile.narrateTier;
  const embeddingCache = nar.getSystemOneEmbeddingCache?.();
  const systemOne: SystemOneBag | undefined = (nar as unknown as { systemOne?: SystemOneBag }).systemOne;
  const systemOneGate = nar.getSystemOneGroundednessGate?.();
  const sourceReputation = new SourceReputation({ path: DEFAULT_REPUTATION_PATH });
  nar.setSourceReputation(sourceReputation);

  const ground: GroundednessState = buildGroundednessState(wired);
  const trace: TraceState = buildTraceState(wired);
  const routing: BotRuntime['routing'] = { auto: false, policy: 'balanced' };
  const provisional = { enabled: true };

  // Build enrich function
  let conversationGame: BotRuntime['conversationGame'] = null;
  const enrich = buildEnrich(wired, conversationGame, trace);

  // Build dialogue capture
  const dialogue = buildDialogueCapture(wired, enrich, conversationGame);

  // Macro pipeline with capture phase
  agent.setMacroPipeline([
    ...DEFAULT_MACRO_PIPELINE,
    createCapturePhase({ onExchange: (exchange) => dialogue.onExchange(exchange as never) }),
  ]);

  // Parameter ledger and strategy adapter
  const parameterLedger = new ParameterLedger({ path: DEFAULT_LEDGER_PATH });
  nar.setParameterLedger(parameterLedger);
  const narController = nar.getController?.();
  const strategyAdapter = narController
    ? new RetrospectiveAdapter(narController as never, { ledger: parameterLedger })
    : undefined;

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

  // Attach ConversationGameFocus
  conversationGame = await attachConversationGame(nar, wired);

  // Rebuild enrich with actual conversationGame
  const enrichWithGame = buildEnrich(wired, conversationGame, trace);
  const dialogueWithGame = buildDialogueCapture(wired, enrichWithGame, conversationGame);

  // Memory query
  const memoryQuery = new MemoryQuery({
    memory: nar.memory,
    episodic: episodicMemory,
    embed: embeddingCache
      ? async (text) => {
          const pointer = await embeddingCache.write(text).catch(() => undefined);
          return pointer ? embeddingCache.read(pointer) : undefined;
        }
      : undefined,
  });

  // Load config (thaw for runtime mutation)
  const appConfig = thaw(wired.appConfig);
  const registry = createRemoteRegistry(auth);
  const secretIds = new Set<string>();
  const bindTo = createBindTo(agent, auth, registry, sessionManager, episodicMemory, cm);

  const rt: BotRuntime = {
    wired,
    cm,
    auth,
    registry,
    dialogue: dialogueWithGame,
    memoryQuery,
    strategyAdapter,
    parameterLedger,
    conversationGame,
    ground,
    trace,
    routing,
    provisional,
    profile: appConfig.profile,
    tier,
    secretIds,
    appConfig,
    webuiHandle: null,
    attach: async (spec: ConnectSpec) => {
      const conn = await cm.addConnection({ ...spec, enabled: true }, { emit: () => undefined, logger });
      bindTo(conn);
      return `Connected ${spec.type} as ${spec.id}`;
    },
  };

  const core = buildCommands(
    nar,
    agent,
    lmService,
    sessionManager,
    () => currentSession,
    (s) => { currentSession = s; },
    {
      get: () => tier,
      set: (t) => { tier = t; },
    }
  );
  const commands = [...core.filter((c) => c.name !== 'help'), ...buildBotCommands(rt)];

  const cli = new CLIConnection(
    { id: 'cli-main', type: 'cli', enabled: true, config: { name: 'CLI', commands } } as never,
    { emit: () => undefined } as never
  );
  await cli.connect();
  cli.onMessage(async (message) => {
    await collectChat(rt, message.text, tier);
  });
  agent.mount(cli as never);

  cli.onStateChange((state) => {
    if (state === 'disconnected') {
      sessionManager
        .snapshot()
        .then(() => sessionManager.close())
        .then(() => agent.stop())
        .then(() => cm.shutdownAll())
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    }
  });

  await autoConnect(cm, bindTo, wired.appConfig, logger);

  await agent.start();
  const appEnvConfig = readAppEnvConfig();
  if (appEnvConfig.enableWebUI) {
    const { startAgentUI } = await import('../../ui/src/server/index');
    startAgentUI(agent as never).catch((err: unknown) => logger.error('Web UI failed to start', err as Error));
  }

  setupGracefulShutdown(async () => {
    logger.info('Shutting down...');
    if (wired.appConfig.dialogue?.autoRetrospect) {
      await runSessionRetrospective(rt, currentSession.id ?? 'default').catch((e) =>
        logger.warn('Auto-retrospect failed', { error: errMsg(e) })
      );
    }
    await sessionManager.snapshot();
    await sessionManager.close();
    await agent.stop();
    await cm.shutdownAll();
    logger.info('Bot stopped');
  }, logger);

  console.log(`\n${profile.name} — CLI-first bot. Type .help for commands, or just chat!`);
  console.log(
    `LM: ${lmConfig.provider} ${lmConfig.model}${settings.provider === 'llamacpp-embedded' ? ` (gpu=${settings.llamacppGpu ?? 'auto'}:${await gpuSummary()})` : ''}`
  );
  logger.info(`Bot ready: ${(await import('../../io/index')).createConnectionConfigsFromEnv({ irc: wired.appConfig.irc }).length} auto-connection(s)`);
}

export { main };
runEntrypoint(main);