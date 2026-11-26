/**
 * Bot wiring — extracts the monolithic setup from bot/index.ts into focused, testable pieces.
 */

import type { AuthManager, CommandRegistry, Connection, ConnectionManager } from '@senars/io';
import { AuthManager as AuthManagerImpl, bindAgentToConnection, CLIConnection, ConnectionManager as ConnectionManagerImpl, createConnectionConfigsFromEnv } from '@senars/io';
import { createReasoningRoute, handleMetricsRequest, type ReasoningHttpEngine } from '@senars/metrics';
import { createLogger, type Logger } from '@senars/util/logger';
import type { AgentFromEnvResult } from '../lib/lifecycle';
import type { DialogueCapture } from '@senars/dialogue';
import type { MemoryQuery } from '@senars/query';
import type { RetrospectiveAdapter } from '@senars/dialogue';
import type { ParameterLedger } from '@senars/config';
import type { AttachedGame } from '@senars/cli/conversation-game';
import type { AppConfig, BotProfile } from '@senars/config';
import type { ChatTier } from '@senars/cli';
import { createConnectionFactories, registerConnectionFactories, createBindTo, autoConnect } from './connections';
import { buildGroundednessState, buildTraceState, buildEnrich, buildDialogueCapture, attachConversationGame, systemOneOf } from './runtime';
import { collectChat } from './chat';
import { buildCommands } from '@senars/cli';
import { buildBotCommands } from '../commands/index';
import { resolveLMSettings, providerKey } from '@senars/lm';
import { SourceReputation, DEFAULT_REPUTATION_PATH } from '@senars/kernel';
import { DEFAULT_MACRO_PIPELINE, createBudget, createCapturePhase } from '@senars/budget';
import { DEFAULT_LEDGER_PATH } from '@senars/config/parameter-ledger';
import { runSessionRetrospective } from '../commands/dialogue';
import { gpuSummary } from '../commands/lm';
import { setupGracefulShutdown } from '@senars/util/shutdown';
import { readAppEnvConfig, readAuthConfig } from '../lib/env-config';
import type { SystemOneBag, GroundednessState, TraceState, ConnectSpec, BotRuntime, RoutingState, ProvisionalState } from '../commands/context';

/** HTTP routes served ahead of auth. */
let httpKernel: ReasoningHttpEngine | undefined;
const reasoningRoute = createReasoningRoute(() => httpKernel);

export const serveHttpRoutes = async (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): Promise<boolean> =>
  (await handleMetricsRequest(req, res)) || reasoningRoute(req, res);

/** Build the command registry for remote connections. */
export function createRemoteRegistry(auth: AuthManager): CommandRegistry {
  const { CommandRegistry, connectionCommands, createAuthCommands, coreCommands, narCommands, memoryCommands, episodesCommands, lmCommands, rlfpCommands, selfCommands } = require('@senars/io');
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
}

/** Build the groundedness, trace, and dialogue capture state. */
export function buildRuntimeState(wired: AgentFromEnvResult): {
  ground: GroundednessState;
  trace: TraceState;
  enrich: ((input: { utterance: string; at?: number }) => Promise<unknown>) | undefined;
  dialogue: DialogueCapture;
  conversationGame: AttachedGame | null;
  memoryQuery: MemoryQuery;
  strategyAdapter: RetrospectiveAdapter | undefined;
  parameterLedger: ParameterLedger;
  sourceReputation: SourceReputation;
} {
  const { nar, episodicMemory, appConfig, lmService } = wired;

  // Groundedness gate
  const ground = buildGroundednessState(wired);

  // Trace state
  const trace = buildTraceState(wired);

  // Source reputation
  const sourceReputation = new SourceReputation({ path: DEFAULT_REPUTATION_PATH });
  nar.setSourceReputation(sourceReputation);

  // Conversation game (attached later, but we need a placeholder for enrich)
  let conversationGame: AttachedGame | null = null;
  const enrich = buildEnrich(wired, conversationGame, trace);

  // Dialogue capture
  const dialogue = buildDialogueCapture(wired, enrich, conversationGame);

  // Memory query
  const embeddingCache = nar.getSystemOneEmbeddingCache?.();
  const memoryQuery = new (require('@senars/query').MemoryQuery)({
    memory: nar.memory,
    episodic: episodicMemory,
    embed: embeddingCache
      ? async (text) => {
          const pointer = await embeddingCache.write(text).catch(() => undefined);
          return pointer ? embeddingCache.read(pointer) : undefined;
        }
      : undefined,
  });

  // Parameter ledger and strategy adapter
  const parameterLedger = new (require('@senars/config/parameter-ledger').ParameterLedger)({ path: DEFAULT_LEDGER_PATH });
  nar.setParameterLedger(parameterLedger);
  const narController = nar.getController?.();
  const strategyAdapter = narController
    ? new (require('@senars/dialogue').RetrospectiveAdapter)(narController as never, { ledger: parameterLedger })
    : undefined;

  return { ground, trace, enrich, dialogue, conversationGame, memoryQuery, strategyAdapter, parameterLedger, sourceReputation };
}

/** Attach conversation game and rebuild enrich/dialogue with it. */
export async function attachGameAndRebuild(
  wired: AgentFromEnvResult,
  runtimeState: ReturnType<typeof buildRuntimeState>
): Promise<{ conversationGame: AttachedGame | null; enrich: ReturnType<typeof buildEnrich>; dialogue: DialogueCapture }> {
  const conversationGame = await attachConversationGame(wired.nar, wired);
  const enrich = buildEnrich(wired, conversationGame, runtimeState.trace);
  const dialogue = buildDialogueCapture(wired, enrich, conversationGame);
  return { conversationGame, enrich, dialogue };
}

/** Create the BotRuntime object with all wired dependencies. */
export function createBotRuntime(
  wired: AgentFromEnvResult,
  deps: {
    cm: ConnectionManager;
    auth: AuthManager;
    registry: CommandRegistry;
    dialogue: DialogueCapture;
    memoryQuery: MemoryQuery;
    strategyAdapter: RetrospectiveAdapter | undefined;
    parameterLedger: ParameterLedger;
    conversationGame: AttachedGame | null;
    ground: GroundednessState;
    trace: TraceState;
    profile: BotProfile;
    tier: ChatTier;
    secretIds: Set<string>;
    appConfig: AppConfig;
  }
): BotRuntime {
  const routing: RoutingState = { auto: false, policy: 'balanced' };
  const provisional: ProvisionalState = { enabled: true };

  return {
    wired,
    cm: deps.cm,
    auth: deps.auth,
    registry: deps.registry,
    dialogue: deps.dialogue,
    memoryQuery: deps.memoryQuery,
    strategyAdapter: deps.strategyAdapter,
    parameterLedger: deps.parameterLedger,
    conversationGame: deps.conversationGame,
    ground: deps.ground,
    trace: deps.trace,
    routing,
    provisional,
    profile: deps.profile,
    tier: deps.tier,
    secretIds: deps.secretIds,
    appConfig: deps.appConfig,
    webuiHandle: null,
    attach: async (spec: ConnectSpec) => {
      const conn = await deps.cm.addConnection({ ...spec, enabled: true }, { emit: () => undefined, logger: createLogger({ scope: 'bot-attach' }) });
      bindAgentToConnection(
        deps.wired.agent as never,
        conn as never,
        { auth: deps.auth, commandRegistry: deps.registry, sessionManager: deps.wired.sessionManager, episodicMemory: deps.wired.episodicMemory, manager: deps.cm } as never
      );
      return `Connected ${spec.type} as ${spec.id}`;
    },
  };
}

/** Set up CLI connection with commands. */
export function setupCLIConnection(rt: BotRuntime, sessionManager: AgentFromEnvResult['sessionManager']): CLIConnection {
  let currentSession = sessionManager.getOrCreate('default');

  const core = buildCommands(
    rt.wired.nar,
    rt.wired.agent,
    rt.wired.lmService,
    sessionManager,
    () => currentSession,
    (s) => { currentSession = s; },
    {
      get: () => rt.tier,
      set: (t) => { rt.tier = t; },
    }
  );

  const commands = [...core.filter((c) => c.name !== 'help'), ...buildBotCommands(rt)];

  const cli = new CLIConnection(
    { id: 'cli-main', type: 'cli', enabled: true, config: { name: 'CLI', commands } } as never,
    { emit: () => undefined } as never
  );

  cli.onMessage(async (message) => {
    await collectChat(rt, message.text, rt.tier);
  });

  cli.onStateChange((state) => {
    if (state === 'disconnected') {
      sessionManager
        .snapshot()
        .then(() => sessionManager.close())
        .then(() => rt.wired.agent.stop())
        .then(() => rt.cm.shutdownAll())
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    }
  });

  return cli;
}

/** Start auto-connections from environment. */
export async function startAutoConnections(
  cm: ConnectionManager,
  bindTo: (conn: Connection) => void,
  appConfig: AppConfig,
  logger: Logger
): Promise<void> {
  await autoConnect(cm, bindTo, appConfig, logger);
}

/** Start agent and optional Web UI. */
export async function startAgentAndUI(
  agent: AgentFromEnvResult['agent'],
  appConfig: AppConfig,
  logger: Logger
): Promise<void> {
  await agent.start();
  const appEnvConfig = readAppEnvConfig();
  if (appEnvConfig.enableWebUI) {
    const { startAgentUI } = await import('../../ui/src/server/index');
    startAgentUI(agent as never).catch((err: unknown) => logger.error('Web UI failed to start', err as Error));
  }
}

/** Set up graceful shutdown with auto-retrospect. */
export function setupShutdown(
  rt: BotRuntime,
  currentSession: { id?: string },
  logger: Logger
): void {
  setupGracefulShutdown(async () => {
    logger.info('Shutting down...');
    if (rt.appConfig.dialogue?.autoRetrospect) {
      await runSessionRetrospective(rt, currentSession.id ?? 'default').catch((e) =>
        logger.warn('Auto-retrospect failed', { error: (e as Error).message })
      );
    }
    await rt.wired.sessionManager.snapshot();
    await rt.wired.sessionManager.close();
    await rt.wired.agent.stop();
    await rt.cm.shutdownAll();
    logger.info('Bot stopped');
  }, logger);
}

/** Print startup banner. */
export function printBanner(rt: BotRuntime, lmConfig: ReturnType<typeof resolveLMSettings>): void {
  console.log(`\n${rt.profile.name} — CLI-first bot. Type .help for commands, or just chat!`);
  console.log(
    `LM: ${lmConfig.provider} ${lmConfig.model}${
      lmConfig.provider === 'llamacpp-embedded'
        ? ` (gpu=${lmConfig.llamacppGpu ?? 'auto'}:${gpuSummary()})`
        : ''
    }`
  );
  const { createConnectionConfigsFromEnv: createConfigs } = require('@senars/io');
  const autoConns = createConfigs({ irc: rt.appConfig.connections?.irc });
  createLogger({ scope: 'bot' }).info(`Bot ready: ${autoConns.length} auto-connection(s)`);
}