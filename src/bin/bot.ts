#!/usr/bin/env tsx
/**
 * SeNARS Bot — unified interactive entry point (TODO21).
 *
 * CLI-only by default: no IRC/WS/HTTP/MCP unless ENABLE_*=true or started
 * at runtime via `.connect`. Replaces bot-ai.ts, repl.ts, status.ts,
 * doctor.ts, multi-agent.ts, tune.ts (`--status/--doctor/--tune/--arcade/
 * --multiagent` delegate to `src/bin/lib/*` runners).
 *
 * This module owns wiring, lifecycle and chat capture. The `.command` surface
 * lives in `src/bin/commands/*`; non-interactive runners in `src/bin/lib/*`.
 */

import { createCapturePhase, DEFAULT_MACRO_PIPELINE } from '@senars/core/agent/phases';
import {
  AuthManager,
  bindAgentToConnection,
  CLIConnection,
  type Connection,
  ConnectionManager,
  createConnectionConfigsFromEnv,
  HTTPConnection,
  IRCConnection,
  MCPConnection,
  WSConnection,
} from '@senars/io';
import { createMeTTa, parseMeTTa } from '@senars/metta';
import { DEFAULT_LEDGER_PATH, ParameterLedger } from '@senars/nar/config';
import { DialogueCapture, RetrospectiveAdapter } from '@senars/nar/dialogue';
import { DEFAULT_REPUTATION_PATH, providerKey, SourceReputation } from '@senars/nar/kernel';
import { resolveLMConfig, resolveLMSettings } from '@senars/nar/lm';
import { computeEvidenceId } from '@senars/nar/lm/system-one';
import { NLUnderstandingService, TranslationCache } from '@senars/nar/nl';
import { MemoryQuery } from '@senars/nar/query';
import { MettaProposer } from '@senars/nar/reflex';
import type { LMTask } from '@senars/util';
import {
  createLogger,
  ensureDir,
  errMsg,
  type Flags,
  makeId,
  parseFlags,
  setupGracefulShutdown,
  unique,
} from '@senars/util';
import { envBool } from '@senars/util/config';
import { Effect } from 'effect';
import { buildCommands } from '../cli/commands.js';
import { reflexesOf } from '../cli/conversation-game.js';
import { assertValidEnv } from '../utils/env-validate.js';
import {
  type BotRuntime,
  buildBotCommands,
  type ConnectSpec,
  type GroundednessState,
  gpuSummary,
  runSessionRetrospective,
  type SystemOneBag,
  type TraceState,
} from './commands/index.js';
import { readAppEnvConfig, readAuthConfig } from './lib/env-config.js';
import { runEntrypoint } from './lib/fatal-error.js';
import { createAgentFromEnv } from './lib/lifecycle.js';
import { createRemoteRegistry } from './lib/remote-registry.js';

assertValidEnv();

const logger = createLogger({ scope: 'bot' });

/** Min grade score for a conversation to be auto-captured into the distillation dataset. */
const DISTILL_CAPTURE_THRESHOLD = 0.7;

/** Connection types the bot can construct, keyed by the id used in `ConnectionConfig.type`. */
const CONNECTION_FACTORIES = {
  cli: (cfg: never) => new CLIConnection(cfg, { emit: () => undefined, logger } as never),
  irc: (cfg: never) => new IRCConnection(cfg, { emit: () => undefined, logger } as never),
  websocket: (cfg: never) => new WSConnection(cfg, { emit: () => undefined, logger } as never),
  http: (cfg: never) => new HTTPConnection(cfg, { emit: () => undefined, logger } as never),
  mcp: (cfg: never) => new MCPConnection(cfg, { emit: () => undefined, logger } as never),
} as const;

/** `--flag` → runner, in precedence order. `undefined` return falls through to the REPL. */
const NON_INTERACTIVE_MODES: Record<string, () => Promise<unknown>> = {
  '--status': () => import('./lib/status-report.js').then((m) => m.runStatus()),
  '--doctor': () => import('./lib/doctor-report.js').then((m) => m.runDoctor()),
  '--tune': () => import('./lib/tune-runner.js').then((m) => m.runTune()),
  '--arcade': () => import('../../scripts/arcade.js'),
  '--multiagent': () => import('./lib/multi-agent-entry.js').then((m) => m.runMultiAgentEntry()),
};

/** Auto-capture a high-quality graded conversation into the distillation dataset. */
const captureDistillation = async (
  trace: TraceState,
  input: string,
  response: string,
  score: number,
  domain?: 'in-domain' | 'ood'
): Promise<void> => {
  const { dataset, embeddingCache } = trace;
  if (!dataset || !embeddingCache || !response.trim()) return;
  try {
    const evidenceId = computeEvidenceId(input, response);
    const pointer = await embeddingCache.write(response);
    dataset.record(
      {
        evidenceId,
        rubric: 'groundedness',
        axis: 'epistemic',
        label: 'accepted',
        score,
        source: 'conversation',
        // TODO23: a groundedness-head abstain marks an out-of-domain turn, feeding
        // the frozen-set OOD slice rather than in-domain evaluation.
        ...(domain ? { domain } : {}),
      },
      embeddingCache.read(pointer)
    );
  } catch {
    // Distillation capture is best-effort; never disrupt chat
  }
};

async function collectChat(rt: BotRuntime, input: string, tier: LMTask): Promise<void> {
  const { agent } = rt.wired;
  const { ground, trace } = rt;
  const ctl = new AbortController();
  const onSigint = () => ctl.abort();
  process.once('SIGINT', onSigint);
  try {
    let response = '';
    for await (const evt of agent.chat(input, { signal: ctl.signal, tier } as never)) {
      if (evt.kind === 'text-delta' && evt.text) {
        response += evt.text;
        if (ground.enabled && ground.gate) {
          const ok = await ground.gate(evt.text);
          process.stdout.write(ok ? evt.text : '[filtered]');
        } else {
          process.stdout.write(evt.text);
        }
      } else if (evt.kind === 'tool-call') process.stdout.write(`\n[tool:${evt.toolName}]\n`);
      else if (evt.kind === 'error' || evt.kind === 'aborted') break;
    }
    // REFACTOR.todo1 Phase A: dialogue capture is a Capture phase inside the
    // macro pipeline (installed at startup); no fire-and-forget hook here.
    if (trace.enabled && trace.grader && Math.random() < trace.sampleRate) {
      try {
        const grade = await trace.grader({ narration: response || input, toolCalls: [] });
        const abstained = grade.groundedness?.abstained ?? false;
        const score = abstained ? grade.contrastiveQuality : grade.groundedness?.score;
        if (score !== undefined && score >= DISTILL_CAPTURE_THRESHOLD) {
          await captureDistillation(trace, input, response, score, abstained ? 'ood' : 'in-domain');
        }
      } catch {
        // Ignore trace grading errors
      }
    }
  } finally {
    process.removeListener('SIGINT', onSigint);
    process.stdout.write('\n');
  }
}

async function runNonInteractive(flags: Flags): Promise<boolean> {
  if (flags.has('--help', '-h')) {
    console.log(
      'Usage: pnpm run bot [-- --status|--doctor|--tune|--arcade|--multiagent] [--json]\n\nNo flags: interactive CLI (senars> ). Connections are opt-in via .connect or ENABLE_IRC/WS/HTTP/MCP=true.'
    );
    return true;
  }
  const mode = Object.keys(NON_INTERACTIVE_MODES).find((flag) => flags.has(flag));
  if (!mode) return false;
  await NON_INTERACTIVE_MODES[mode]?.();
  return true;
}

async function main(): Promise<void> {
  if (await runNonInteractive(parseFlags())) return;

  await ensureDir('.cache/sessions').catch(() => undefined);
  const wired = await createAgentFromEnv();
  const { agent, sessionManager, profile } = wired;
  const lmConfig = resolveLMConfig();
  const settings = resolveLMSettings();
  const { nar, lmService, episodicMemory } = wired;

  const auth = new AuthManager();
  const authCfg = readAuthConfig();
  if (authCfg.secret) for (const id of authCfg.connectionIds) auth.setSecret(id, authCfg.secret);

  const cm = new ConnectionManager();
  for (const [type, create] of Object.entries(CONNECTION_FACTORIES)) {
    cm.registerFactory({ type, create: create as never });
  }

  let currentSession = sessionManager.getOrCreate('default');
  let tier: LMTask = profile.narrateTier;
  const embeddingCache = nar.getSystemOneEmbeddingCache?.();
  const systemOne: SystemOneBag | undefined = (nar as unknown as { systemOne?: SystemOneBag })
    .systemOne;
  const systemOneGate = nar.getSystemOneGroundednessGate?.();
  // Phase E: egress-gate verdicts are verification signals for the narration channel.
  // Phase F (audit M2): record under the fine provider:<name> key the ingress
  // judge reads — legacy llm-narration key kept alongside during transition.
  const narrationKeys = (): string[] => {
    let provider: string | undefined;
    try {
      provider = resolveLMSettings().provider;
    } catch {
      provider = undefined;
    }
    const key = providerKey(provider);
    return key ? ['llm-naration', key] : ['llm-naration'];
  };
  const sourceReputation = new SourceReputation({ path: DEFAULT_REPUTATION_PATH });
  nar.setSourceReputation(sourceReputation);
  const ground: GroundednessState = {
    enabled: wired.appConfig.systemOne?.enabled === true,
    threshold: 0.7,
    gate: systemOneGate
      ? async (text: string) => {
          const ok = await systemOneGate(text, makeId());
          for (const key of narrationKeys()) {
            sourceReputation.record(key, ok ? 'confirmed' : 'contradicted');
          }
          return ok;
        }
      : undefined,
  };
  const trace: TraceState = {
    enabled: false,
    sampleRate: 0.1,
    grader: nar.getSystemOneTraceGrader?.(),
    dataset: systemOne?.dataset,
    embeddingCache,
  };
  const routing: BotRuntime['routing'] = { auto: false, policy: 'balanced' };
  const provisional = { enabled: true };

  // TODO24 Dialogue Flywheel: one instance per bot; every sink guarded by
  // dialogue.enabled (I5 default false ⇒ byte-identical disabled path).
  // Phase-B enrichment: decider bands + provenance, LM formalizations, reflex
  // readout — all best-effort with graceful degradation.
  const decider = nar.getSystemOneDecider?.();
  // An LM call per turn, so gated on `dialogue.captureAll` — explicit opt-in to
  // full-fidelity turns (cost gate).
  const understanding =
    wired.appConfig.dialogue?.captureAll === true
      ? new NLUnderstandingService(lmService, new TranslationCache(), { structuredOnly: true })
      : undefined;
  // REFACTOR.todo2 Phase C: cross-memory facade — concept + episodic legs; the
  // semantic leg wires System One's encoder cache when available.
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
  let conversationGame: BotRuntime['conversationGame'] = null;
  const enrich =
    decider || understanding
      ? async (input: { utterance: string; at?: number }) => {
          const [result, batch] = await Promise.all([
            decider && embeddingCache
              ? decider.decide({
                  context: input.utterance,
                  queries: [
                    {
                      kind: 'evaluate' as const,
                      instruction: 'Evaluate groundedness of the dialogue turn',
                      rubric: 'groundedness' as never,
                      axis: 'epistemic' as const,
                    },
                  ],
                  budget: {
                    maxCycles: 10,
                    maxDepth: 2,
                    maxMemoryOps: 100,
                    maxLMCalls: 0,
                    consumed: { cycles: 0, depth: 0, memoryOps: 0, llmCalls: 0 },
                  },
                })
              : null,
            understanding?.understandCandidates(input.utterance).catch(() => null) ?? null,
          ]);
          // Per-message attribution (I7): join reflex decisions by the message's
          // wall-clock span — the kernel mints correlationIds inside agent.chat(),
          // so the span is the honest join available without threading ids
          // through the Focus cycle. Vetoes stay cumulative (running counter).
          const since = input.at ?? 0;
          const windowed = reflexesOf(conversationGame).flatMap(
            (r) =>
              (
                r as {
                  decisionsSince?(t: number): Array<{ proposed: string[]; selected?: unknown }>;
                }
              ).decisionsSince?.(since) ?? []
          );
          const selected = windowed.at(-1)?.selected;
          const vetoes =
            reflexesOf(conversationGame).find((r) => r.id === 'lm-reflex')?.contrastiveVetoes ?? 0;
          return {
            ...(result
              ? {
                  judgment: { abstained: result.abstained, band: result.band },
                  provenance: result.provenance,
                }
              : {}),
            ...(batch?.candidates?.length ? { formalizations: batch.candidates } : {}),
            ...(windowed.length && selected
              ? {
                  reflex: {
                    proposed: unique(windowed.flatMap((d) => d.proposed)),
                    selected,
                    vetoes,
                  },
                }
              : {}),
          };
        }
      : undefined;
  const dialogue = new DialogueCapture({
    episodic: episodicMemory,
    dataset: systemOne?.dataset,
    embeddingCache,
    contrastive: nar.getSystemOneContrastive?.(),
    // Phase F (audit M3): episodes join the reputation table by channel —
    // narration-source provider key, resolved live (provider switches apply).
    sourceKey: () => {
      try {
        const p = resolveLMSettings().provider;
        return p ? (providerKey(p) ?? 'user') : 'user';
      } catch {
        return 'user';
      }
    },
    ...(enrich ? { enrich: enrich as never } : {}),
    // DQ6: formalize corrections into Narsese lessons when an LM-bound
    // understanding service is available (same captureAll cost gate).
    ...(understanding
      ? {
          formalize: (text: string) =>
            understanding
              .understandCandidates(text)
              .then((b) =>
                (b?.candidates ?? []).map((c) => ({ narsese: c.narsese, confidence: c.confidence }))
              ),
        }
      : {}),
    config: wired.appConfig.dialogue,
  });

  // REFACTOR.todo1 Phase A: promote dialogue capture from the per-message
  // fire-and-forget hook to a Capture phase appended to the macro pipeline —
  // same onExchange call, joined on the cycle's correlationId (I7).
  agent.setMacroPipeline([
    ...DEFAULT_MACRO_PIPELINE,
    createCapturePhase({ onExchange: (exchange) => dialogue.onExchange(exchange as never) }),
  ]);

  // TODO25 Phase A: retrospective-driven strategy adaptation (clamped +
  // digest one-shot + restorable; see nar/src/dialogue/consumers/adapt.ts).
  // Phase B (REFACTOR.todo1): shared parameter ledger (C2 — observe, never
  // decide) wired into every writer; off until this attach point.
  const parameterLedger = new ParameterLedger({ path: DEFAULT_LEDGER_PATH });
  nar.setParameterLedger(parameterLedger);
  const narController = nar.getController?.();
  const strategyAdapter = narController
    ? new RetrospectiveAdapter(narController as never, { ledger: parameterLedger })
    : undefined;

  // Bot-only default profile: enable System One by default (opt-out via config)
  // This only affects the bot; non-Bot NAR consumers are unaffected.
  if (!wired.appConfig.systemOne?.enabled) {
    const { systemOneDefaults } = await import('@senars/util/config');
    wired.appConfig.systemOne = {
      ...systemOneDefaults,
      enabled: true,
      manifold: { ...systemOneDefaults.manifold, provider: 'wasi' },
      cortex: { ...systemOneDefaults.cortex, provider: 'llamacpp-embedded' },
      lmReflex: { ...systemOneDefaults.lmReflex, grammarActions: true, maxCandidates: 3 },
    };
  }

  // Phase C (REFACTOR.todo3): MettaProposer live wiring — the agent layer
  // injects the createMeTTa() + Effect.runSync evaluator; the fact source
  // (soundness table) stays the integrator seam and abstains until populated.
  const mettaRuntime = createMeTTa();
  const evaluateMetta = (expression: string): boolean | null => {
    try {
      const atom = Effect.runSync(mettaRuntime.evaluate(parseMeTTa(expression)));
      return atom.kind === 0
        ? atom.value === 'True'
          ? true
          : atom.value === 'False'
            ? false
            : null
        : null;
    } catch {
      return null;
    }
  };

  // Attach ConversationGameFocus for System One reflexes (Phase 3)
  if (nar.isSystemOneEnabled?.()) {
    try {
      conversationGame = nar.attachConversationGame({
        id: 'conversation',
        lmReflex: true,
        proposers: [new MettaProposer(evaluateMetta, { toExpression: () => undefined })],
      });
      if (conversationGame) logger.info('ConversationGameFocus attached (not stepped)');
    } catch (e) {
      logger.warn('Failed to attach ConversationGameFocus', { error: errMsg(e) });
    }
    // Seed CLM contrastive exemplars from live state (hard negatives + calibration).
    nar
      .refreshSystemOneContrastive?.(episodicMemory)
      .catch((e) => logger.warn('Contrastive refresh failed at startup', { error: errMsg(e) }));
  }

  // loadConfig() returns a deeply frozen object — clone for runtime mutation.
  const appConfig = structuredClone(wired.appConfig);
  const registry = createRemoteRegistry(auth);
  const secretIds = new Set<string>();
  const bindTo = (conn: Connection): void => {
    bindAgentToConnection(
      agent as never,
      conn as never,
      {
        auth,
        commandRegistry: registry,
        sessionManager,
        episodicMemory,
        manager: cm,
      } as never
    );
  };
  const rt: BotRuntime = {
    wired,
    cm,
    auth,
    registry,
    dialogue,
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
      const conn = await cm.addConnection(
        { ...spec, enabled: true },
        { emit: () => undefined, logger }
      );
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
    (s) => {
      currentSession = s;
    },
    {
      get: () => tier,
      set: (t) => {
        tier = t;
      },
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

  const autoConnect = envBool('BOT_CLI_ONLY')
    ? []
    : createConnectionConfigsFromEnv({ irc: wired.appConfig.irc });
  for (const cfg of autoConnect) {
    if (cfg.type === 'irc' || cfg.type === 'websocket') {
      cfg.config.greeting ??= profile.joinMessage;
    }
  }
  for (const cfg of autoConnect) {
    try {
      const conn = await cm.addConnection(cfg, { emit: () => undefined, logger });
      bindTo(conn);
      logger.info(`Bound bridge to: ${conn.name} (${conn.type})`);
    } catch (e) {
      logger.error(`Failed to add ${cfg.type}: ${errMsg(e)}`);
    }
  }

  await agent.start();
  if (readAppEnvConfig().enableWebUI) {
    const { startAgentUI } = await import('../../ui/src/server/index.js');
    startAgentUI(agent as never).catch((err: unknown) => {
      logger.error('Web UI failed to start', err as Error);
    });
  }

  setupGracefulShutdown(async () => {
    logger.info('Shutting down...');
    // TODO24 (DQ3, opt-in): auto-retrospect the session on close.
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
  logger.info(`Bot ready: ${autoConnect.length} auto-connection(s)`);
}

runEntrypoint(main);
