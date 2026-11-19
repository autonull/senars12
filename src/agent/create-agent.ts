import type { ChatOptions, ChatStreamEvent } from './chat.js';
import type { CortexSynthesizeRequest, PromptBuilder } from '@senars/cortex';
import type { Derivation } from '@senars/types';
import { Agent } from './Agent.js';
import { createLogStore, LogStoreEventLog } from '@senars/log';
import { createCortexFromLM } from '@senars/cortex';
import type { PersistableSessionManager } from '@senars/memory';
import { registerAgentTools } from '@senars/motor';
import type { ToolFeedbackObserver } from '@senars/util/feedback';
import { DefaultToolFeedbackObserver } from '@senars/util/feedback';
import { clamp } from '@senars/util/numeric';
import { createLogger, silentLogger } from '@senars/util/logger';
import { deadline } from '@senars/util/async';
import { errMsg } from '@senars/errors';
import { makeId } from '@senars/util/id';
import { parseJsonOr } from '@senars/util/fs';
import { serializeTruth } from '@senars/util/truth-schema';
import { NAREngine } from '../engine/NAREngine.js';
import type { EpisodicMemory, LMService, NAR } from '../index.js';
import { dispatchNarseseIntent, type NarseseIntent } from '../nl/narsese-intent.js';
import type { ThreadScope } from '../kernel/thread-scope.js';
import { evaluateQuery } from '../lm/system-one/head-ontology.js';
import { createSystemOneBudget } from '../lm/system-one/types.js';
import { TrajectoryStore } from '../rlfp/trajectory-store.js';
import { CoreToolRegistryAdapter } from '../tools';
import { createCompactionPromptBuilder } from './compaction.js';
import type { CreateAgentConfig } from './config.js';
import { recallEpisodes } from './recall.js';
import { WSConnection } from '@senars/io/connections/ws';
import type { ConnectionConfig } from '@senars/util/types/transport';
import { handleDelegationMessage, createDelegation } from '../cooperation/delegation.js';
import type {
  DelegationPeer,
  CognitiveTaskDelegation,
  CognitiveTaskResult,
} from '../cooperation/delegation.js';
import { SOURCE_QUALITY_CONFIDENCE } from '@senars/schemas';
import { Truth } from '../terms';
import { WebSocket } from 'ws';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const logger = createLogger({ scope: 'nar-agent', level: 'warn' });

/** How long a peer has to answer a delegated cognitive task before it is abandoned. */
const DELEGATION_TIMEOUT_MS = 30_000;

/** Delegation peer that executes LM rules using the local NAR's LM service. */
class NARDelegationPeer implements DelegationPeer {
  constructor(private readonly nar: NAR) {}

  async executeTask(delegation: CognitiveTaskDelegation): Promise<CognitiveTaskResult> {
    const { taskId, taskType, narseseContext } = delegation;

    try {
      const processor = this.nar.getProcessor();
      const rule = processor.getModelRule(taskType);

      if (!rule) {
        return { taskId, resultNarsese: [], success: false, error: `Rule ${taskType} not found` };
      }

      if (taskType === 'lm-curiosity-question' && narseseContext.includes('?what')) {
        const answer = await this.nar.ask(narseseContext);
        if (answer?.answer) {
          return {
            taskId,
            resultNarsese: [answer.answer.toString()],
            success: true,
          };
        }
      }

      const { termParser } = await import('../terms');
      const goalTerm = termParser.parse(narseseContext);

      const tasks = await rule.apply(goalTerm);

      if (tasks && tasks.length > 0) {
        const resultTerms = tasks.map((t) => t.term.toString());
        return {
          taskId,
          resultNarsese: resultTerms,
          success: true,
        };
      }

      return { taskId, resultNarsese: [], success: false, error: 'No candidates generated' };
    } catch (error) {
      return {
        taskId,
        resultNarsese: [],
        success: false,
        error: errMsg(error),
      };
    }
  }
}

export type { CreateAgentConfig };

interface NarAgentApi {
  chat(text: string, opts?: ChatOptions): AsyncGenerator<ChatStreamEvent, string>;

  believe(text: string): Promise<void>;

  recall(query?: string, limit?: number): Promise<Array<{ content: string; type?: string }>>;

  know(key: string, value: string): void;

  knowGet(key: string): string | undefined;

  knowList(): Array<{ key: string; value: string }>;

  setThrottle(n: number): void;

  getThrottle(): number;

  getNAR(): NAR | undefined;

  getEpisodicMemory(): EpisodicMemory | undefined;

  getRecentDerivations(): Derivation[];

  delegate(params: {
    target: string;
    task: { type: string; term: string };
    ruleId: string;
  }): Promise<{ truth?: Truth; confidence?: number; error?: string }>;

  start(): Promise<void>;

  stop(): Promise<void>;

  setMacroPipeline(phases: unknown[]): void;

  mount(transport: unknown): Promise<void>;
}

type ExtendedAgent = Agent & NarAgentApi;

/** Minimal agent API for bin layer consumers (excludes core internals). */
export type BinAgentApi = NarAgentApi;

/** Extended agent with NAR-specific methods. */
export type { ExtendedAgent };

type PromptReq = CortexSynthesizeRequest & { workingMemory: unknown[] };

const chainPromptBuilders = (builders: PromptBuilder[]): PromptBuilder | undefined =>
  builders.length === 0
    ? undefined
    : builders.length === 1
      ? builders[0]
      : {
          build: (req: PromptReq) =>
            builders
              .map((b) => b.build(req))
              .filter(Boolean)
              .join('\n'),
        };

const createPersonaPromptBuilder = (
  profile: NonNullable<CreateAgentConfig['profile']>
): PromptBuilder => ({
  build: (req: PromptReq) => {
    void req;
    return [
      'You are a cognitive agent with access to symbolic reasoning engines.',
      `Your name is ${profile.name ?? 'SeNARS'}.`,
      profile.personality ? `Personality: ${profile.personality}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  },
});

const createSkillsPromptBuilder = (
  skills: NonNullable<CreateAgentConfig['skills']>
): PromptBuilder => ({
  build: (req: PromptReq) => {
    void req;
    const blocks = skills
      .filter((s) => s.enabled !== false)
      .map(
        (s) => `## Skill: ${s.id}${s.description ? ` — ${s.description}` : ''}\n${s.instructions}`
      );
    return blocksToPrompt('Available skills (apply when relevant):', blocks);
  },
});

const blocksToPrompt = (header: string, blocks: string[]): string =>
  blocks.length > 0 ? [header, ...blocks].join('\n\n') : '';

function extendAgent(agent: Agent, config: CreateAgentConfig, narInstance: NAR, narEngine: NAREngine): ExtendedAgent {
  let throttle = config.throttle ?? 0;

  const know = new Map<string, string>();
  (agent as ExtendedAgent).know = (key: string, value: string) => void know.set(key, value);
  (agent as ExtendedAgent).knowGet = (key: string) => know.get(key);
  (agent as ExtendedAgent).knowList = () => Array.from(know.entries()).map(([key, value]) => ({ key, value }));

  const believe = async (text: string): Promise<void> => {
    await narInstance.believe(text);
  };
  (agent as ExtendedAgent).believe = believe;

  (agent as ExtendedAgent).recall = (query?: string, limit?: number) => recallEpisodes(config as any, query, limit);
  (agent as ExtendedAgent).setThrottle = (n: number) => {
    throttle = clamp(n, 0, 100);
  };
  (agent as ExtendedAgent).getThrottle = () => throttle;
  (agent as ExtendedAgent).getNAR = () => narEngine?.nar;
  (agent as ExtendedAgent).getEpisodicMemory = () => config.episodicMemory;

  (agent as ExtendedAgent).delegate = async (params: {
    target: string;
    task: { type: string; term: string };
    ruleId: string;
  }): Promise<{ truth?: Truth; confidence?: number; error?: string }> => {
    const { target, task, ruleId } = params;
    const url = new URL(target);
    const host = url.hostname;
    const port = parseInt(url.port) || 8765;
    const wsUrl = `ws://${host}:${port}`;
    const ws = new WebSocket(wsUrl);
    return new Promise((resolve) => {
      const disarmDeadline = deadline(DELEGATION_TIMEOUT_MS, () => {
        resolve({ error: 'Delegation timeout' });
        ws.close();
      });
      ws.on('open', () => {
        const delegation = {
          type: 'cognitive-delegation',
          delegation: {
            taskId: makeId(),
            taskType: ruleId,
            narseseContext: task.term,
            callbackEndpoint: wsUrl,
          },
        };
        ws.send(JSON.stringify(delegation));
      });
      ws.on('message', async (data) => {
        const message = parseJsonOr<{ type?: string; result?: any }>(data.toString(), {});
        if (message.type === 'cognitive-delegation-result' && message.result) {
          disarmDeadline();
          ws.close();
          const result = message.result;
          if (result.success && result.resultNarsese?.length > 0) {
            const nar = narEngine?.nar;
            if (nar) {
              for (const termStr of result.resultNarsese) {
                await nar.input(termStr, 'belief', Truth.create(1.0, 0.5));
              }
              await nar.run(3);
              const answer = await nar.ask(task.term);
              if (answer?.truth) {
                resolve({
                  truth: answer.truth,
                  confidence: Truth.expectation(answer.truth),
                });
                return;
              }
            }
            resolve({ truth: Truth.create(1.0, SOURCE_QUALITY_CONFIDENCE.PEER_AGENT) });
          } else {
            resolve({ error: result.error ?? 'Delegation failed' });
          }
        }
      });
      ws.on('error', (err) => {
        disarmDeadline();
        resolve({ error: `WebSocket error: ${err.message}` });
      });
      ws.on('close', () => {
        disarmDeadline();
      });
    });
  };

  return agent as ExtendedAgent;
}

/**
 * Create a cognitive agent with the given configuration.
 * This is the main factory function for creating NAR-backed agents.
 */
export async function createAgent(config: CreateAgentConfig = {}): Promise<ExtendedAgent> {
  let log: LogStoreEventLog;
  let logStore: any;
  let logDir: string;
  if (config.persistence) {
    logDir = config.persistence.path;
    logStore = createLogStore({ dir: logDir });
  } else {
    logDir = mkdtempSync(join(tmpdir(), 'senars-agent-log-'));
    logStore = createLogStore({ dir: logDir });
  }
  await logStore.open();
  log = new LogStoreEventLog(logStore);

  const feedbackObserver = new DefaultToolFeedbackObserver();

  const personaBuilder = config.profile ? createPersonaPromptBuilder(config.profile) : undefined;
  const compactionBuilder = config.lmService
    ? createCompactionPromptBuilder(config.lmService, config.conversation)
    : undefined;
  const skillsBuilder = config.skills?.length
    ? createSkillsPromptBuilder(config.skills)
    : undefined;
  const promptBuilder = chainPromptBuilders(
    [config.promptBuilder, personaBuilder, skillsBuilder, compactionBuilder].filter(
      (b): b is NonNullable<typeof b> => Boolean(b)
    )
  );

  const cortex = config.lmService ? createCortexFromLM(config.lmService, promptBuilder) : undefined;

  const pinStore = new Map<string, string>();
  const metta = config.metta;

  let narInstance = config.nar;
  if (!narInstance) {
    const { NAR } = await import('../nar.js');
    const { DEFAULT_CONFIG } = await import('../types/index.js');
    narInstance = new NAR({ ...DEFAULT_CONFIG, feedbackObserver, metta, logStore });
  }

  const groundednessGate = narInstance.getSystemOneGroundednessGate();
  const rawTraceGrader = narInstance.getSystemOneTraceGrader();

  let traceGrader = rawTraceGrader;
  if (rawTraceGrader) {
    const trajectoryStore = new TrajectoryStore(config.trajectoryStorePath);
    await trajectoryStore.load();
    traceGrader = async (trace) => {
      const result = (await rawTraceGrader(trace)) as {
        groundedness?: { score: number; abstained: boolean };
        risks: { command: string; score: number; abstained: boolean }[];
      };
      await trajectoryStore.recordCycle({
        correlationId: trace.correlationId,
        timestamp: Date.now(),
        steps: [
          { timestamp: Date.now(), type: 'narrative', data: trace.narration },
          ...trace.toolCalls.map((c) => ({
            timestamp: Date.now(),
            type: 'tool_call',
            data: { name: c.command, success: c.success },
          })),
        ],
        grades: { groundedness: result.groundedness, risks: result.risks, egress: trace.egress },
      });
      const pair = trajectoryStore.pairForPreference();
      const rlfp = narInstance.getRLFP();
      if (pair && pair.preference !== 'SKIP' && rlfp) {
        const preferred = pair.preference === 'A' ? pair.trajectoryA : pair.trajectoryB;
        const rejected = pair.preference === 'A' ? pair.trajectoryB : pair.trajectoryA;
        const narrationOf = (c: { steps: { type: string; data?: unknown }[] }) =>
          (c.steps.find((s) => s.type === 'narrative')?.data as string | undefined) ?? '';
        const preferredNarration = narrationOf(preferred);
        const rejectedNarration = narrationOf(rejected);
        if (preferredNarration && rejectedNarration) {
          rlfp.addPreference(preferredNarration, rejectedNarration);
        }
      }
      return result;
    };
  }

  const agent = new Agent({
    log,
    cortex,
    commandParser: metta && ((text: string) => metta.parseCommands(text)),
    builtinTools: true,
    episodicMemory: config.episodicMemory,
    mettaExecutor: metta && ((expr: string) => metta.query(expr)),
    pinStore: {
      pin: (key: string, value: string) => void pinStore.set(key, value),
      unpin: (key?: string) => {
        if (key) pinStore.delete(key);
        else pinStore.clear();
      },
      recallAll: () => new Map(pinStore),
    },
    sessionManager: config.sessionManager,
    feedbackObserver,
    groundednessGate,
    traceGrader,
    narrateTier: config.profile?.narrateTier,
    consolidateLearning: (options) => narInstance.consolidateLearning(options),
    consolidation: config.consolidation,
    threadScope: config.threadScope,
    capabilities: {
      drives: !!narInstance.getConfig().driveMetaGoals,
      rlfp: !!narInstance.getRLFP(),
      selfReasoning: !!narInstance.getSelfAnalyzer(),
      autonomyLoop: narInstance.isAutonomyEnabled(),
    },
  });

  const narEngine = new NAREngine(narInstance, agent.emitCognitive.bind(agent));
  if (config.engines?.nar !== false) agent.registerEngine('nar', narEngine);

  await agent.start();

  if (config.transport?.ws) {
    const isServer = config.transport.ws.port != null;
    const wsConfig: ConnectionConfig = {
      id: `ws-${makeId()}`,
      enabled: true,
      type: 'websocket',
      config: {
        name: isServer ? 'Agent WS Server' : 'Agent WS Client',
        host: config.transport.ws.host ?? 'localhost',
        port: config.transport.ws.port ?? 8765,
      },
    };
    const wsLogger = createLogger({ scope: 'agent:ws' });
    const ws = new WSConnection(wsConfig, { emit: () => undefined, logger: wsLogger } as any);
    await agent.mount(ws);
  }

  // Wrap agent.stop to close logStore and clean up temp directory
  const originalStop = agent.stop.bind(agent);
  const isTempDir = !config.persistence;
  agent.stop = async () => {
    await originalStop();
    await logStore.close();
    if (isTempDir) {
      await rm(logDir, { recursive: true, force: true }).catch(() => {});
    }
  };

  return extendAgent(agent, config, narInstance, narEngine);
}