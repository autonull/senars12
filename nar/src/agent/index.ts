import type {
  ChatOptions,
  ChatStreamEvent,
  CortexSynthesizeRequest,
  PromptBuilder,
} from '@senars/core';
import { Agent, InMemoryEventLog, SqliteEventLog } from '@senars/core';
import { createCortexFromLM } from '@senars/core/cortex';
import type { PersistableSessionManager } from '@senars/core/memory';
import { registerAgentTools } from '@senars/core/motor';
import type { ToolFeedbackObserver } from '@senars/util/feedback';
import { DefaultToolFeedbackObserver } from '@senars/util/feedback';
import { clamp, createLogger, deadline, errMsg, makeId } from '@senars/util';
import { NAREngine } from '../engine/NAREngine.js';
import type { EpisodicMemory, LMService, NAR } from '../index.js';
import { dispatchNarseseIntent, type NarseseIntent } from '../nl/narsese-intent.js';
import type { ThreadScope } from '../kernel/thread-scope.js';
import { createSystemOneBudget } from '../lm/system-one/types.js';
import { TrajectoryStore } from '../rlfp/trajectory-store.js';
import { CoreToolRegistryAdapter } from '../tools';
import { createCompactionPromptBuilder } from './compaction.js';
import type { CreateAgentConfig } from './config.js';
import { recallEpisodes } from './recall.js';
import { WSConnection } from '@senars/io/connections/ws';
import type { ConnectionConfig } from '@senars/util/types/transport';
import { handleDelegationMessage, createDelegation } from '../cooperation/delegation.js';
import type { DelegationPeer, CognitiveTaskDelegation, CognitiveTaskResult } from '../cooperation/delegation.js';
import { SOURCE_QUALITY_CONFIDENCE } from '@senars/core/schemas/truth';
import { Truth } from '../terms';
import { WebSocket } from 'ws';

const logger = createLogger({ scope: 'nar-agent', level: 'warn' });

/** How long a peer has to answer a delegated cognitive task before it is abandoned. */
const DELEGATION_TIMEOUT_MS = 30_000;

/** Delegation peer that executes LM rules using the local NAR's LM service. */
class NARDelegationPeer implements DelegationPeer {
  constructor(private readonly nar: NAR) {}

  async executeTask(delegation: CognitiveTaskDelegation): Promise<CognitiveTaskResult> {
    const { taskId, taskType, narseseContext } = delegation;
    
    try {
      // Execute the LM rule through the NAR's processor
      const processor = this.nar.getProcessor();
      const rule = processor.getModelRule(taskType);
      
      if (!rule) {
        return { taskId, resultNarsese: [], success: false, error: `Rule ${taskType} not found` };
      }
      
      // For the test, we'll use a simple KB lookup for questions
      if (taskType === 'lm-curiosity-question' && narseseContext.includes('?what')) {
        // Try to answer from KB
        const answer = await this.nar.ask(narseseContext);
        if (answer?.answer) {
          return {
            taskId,
            resultNarsese: [answer.answer.toString()],
            success: true,
          };
        }
      }
      
      // Parse the narsese context as a term
      const { termParser } = await import('../terms');
      const goalTerm = termParser.parse(narseseContext);
      
      // Fallback: apply the rule with empty premises (primary = goal term)
      const tasks = await rule.apply(goalTerm);
      
      if (tasks && tasks.length > 0) {
        // Extract the conclusion terms from the resulting tasks
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

  getRecentDerivations(): unknown;

  /** Delegate a cognitive task to another agent over WebSocket. */
  delegate(params: {
    target: string;           // ws://host:port
    task: { type: string; term: string };
    ruleId: string;
  }): Promise<{ truth?: Truth; confidence?: number; error?: string }>;

  // Bin layer extensions (narrow public accessors per REFACTOR.todo4 Phase C)
  start(): Promise<void>;

  stop(): Promise<void>;

  setMacroPipeline(phases: unknown[]): void;

  mount(transport: unknown): Promise<void>;
}

type ExtendedAgent = Agent & NarAgentApi;

/** Minimal agent API for bin layer consumers (excludes core internals). */
export type BinAgentApi = NarAgentApi;

type PromptReq = CortexSynthesizeRequest & { workingMemory: unknown[] };

/**
 * Chains prompt-builder fragments (user builder, persona, compaction) into one.
 */
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

/**
 * PromptBuilder fragment injecting the bot persona into the system prompt.
 */
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

/**
 * PromptBuilder fragment for composable skill packages — injects each enabled
 * skill's instructions into the system prompt.
 */
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

export async function createAgent(config: CreateAgentConfig = {}): Promise<ExtendedAgent> {
  const log = config.persistence
    ? new SqliteEventLog({ path: config.persistence.path })
    : new InMemoryEventLog();

  // Shared feedback observer for unified tool statistics across motor and nar registries
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
  // MeTTa is a tool, not a reasoning engine: it backs the `metta` builtin tool
  // and the command parser, and is never registered as an engine. Absent a
  // port the tool reports `metta engine not configured` and parsing is skipped.
  const metta = config.metta;

  // Create NAR with shared feedback observer if not provided
  let narInstance = config.nar;
  if (!narInstance) {
    const { NAR } = await import('../nar.js');
    const { DEFAULT_CONFIG } = await import('../types/index.js');
    narInstance = new NAR({ ...DEFAULT_CONFIG, feedbackObserver, metta });
  }

  // Wire System One groundedness gate + trace grader if available
  const groundednessGate = narInstance.getSystemOneGroundednessGate();
  const rawTraceGrader = narInstance.getSystemOneTraceGrader();

  // E4 follow-up (a): each graded cycle becomes a trajectory step; the two most
  // recent cycles pair into an implicit RLFP preference (grade-ordered).
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
        correlationId: trace.correlationId ?? '',
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
  });

  const narEngine = new NAREngine(narInstance, agent.emitCognitive.bind(agent));
  if (config.engines?.nar !== false) agent.registerEngine('nar', narEngine);

  const makeLogger = () => {
    const base = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };
    return {
      ...base,
      child: () => makeLogger(),
    };
  };

  await agent.start();

  // Mount WebSocket transport if configured
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
    const wsConn = new WSConnection(wsConfig, {
      emit: () => {},
      logger: makeLogger(),
      getSessionSpaceId: () => 'delegation',
    });
    await wsConn.connect();

    if (isServer) {
      // Server mode: set up custom handler for delegation messages
      const peer = new NARDelegationPeer(narInstance);
      const delegationHandler = async (message: { text: string; sender: string }) => {
        try {
          const parsed = JSON.parse(message.text);
          if (parsed.type === 'cognitive-delegation' && parsed.delegation) {
            await handleDelegationMessage(peer, message.text, (result) => {
              // Reply directly to the client that sent the request - send raw JSON
              const client = (wsConn as any).clients?.get(message.sender);
              if (client?.ws?.readyState === 1) { // WebSocket.OPEN
                client.ws.send(JSON.stringify({
                  type: 'cognitive-delegation-result',
                  result,
                }));
              }
            });
            return;
          }
        } catch {
          // Not a delegation message, ignore
        }
        // Fall through to default handler
        agent.submit(message.text, makeId());
      };
      wsConn.onMessage(delegationHandler);
      agent.mount(wsConn);
    } else {
      // Client mode: use default mount
      agent.mount(wsConn);
    }
  }

  attachNarApi(agent as ExtendedAgent, config, narEngine, pinStore);

  return agent as ExtendedAgent;
}

const MAX_DELEGATION_DEPTH = 2;
let delegationDepth = 0;

/**
 * Runs a prompt in a short-lived sub-agent (fresh in-memory session) and
 * returns its final text. Depth-limited to prevent runaway recursive delegation.
 */
const createDelegateRunner =
  (
    base: Pick<
      CreateAgentConfig,
      'nar' | 'lmService' | 'episodicMemory' | 'profile' | 'threadScope' | 'metta'
    >
  ): ((prompt: string) => Promise<string>) =>
  async (prompt: string) => {
    if (delegationDepth >= MAX_DELEGATION_DEPTH) {
      throw new Error(`delegation depth limit reached (${MAX_DELEGATION_DEPTH})`);
    }
    const worker = await createAgent({
      nar: base.nar,
      lmService: base.lmService,
      episodicMemory: base.episodicMemory,
      profile: base.profile,
      threadScope: base.threadScope,
      metta: base.metta,
    });
    delegationDepth++;
    try {
      let text = '';
      for await (const evt of worker.chat(prompt)) {
        if (evt.kind === 'text-delta' && evt.text) text += evt.text;
      }
      return text;
    } finally {
      delegationDepth--;
      await worker.stop();
    }
  };

/** The Narsese ingress answer: belief / goal acknowledgement, question plus manifold judgment. */
const answerNarsese = async (
  narEngine: NAREngine,
  intent: NarseseIntent,
  correlationId: string
): Promise<string> => {
  const { text } = intent;
  if (intent.kind === 'goal') {
    await narEngine.nar.goal(text, undefined, correlationId);
    await narEngine.nar.run(3, undefined, correlationId);
    return `+ ${text}`;
  }
  if (intent.kind === 'belief') {
    await narEngine.nar.believe(text, undefined, correlationId);
    await narEngine.nar.run(3, undefined, correlationId);
    const beliefs = narEngine.nar.getBeliefs();
    const last = beliefs[beliefs.length - 1];
    return last ? `+ ${last.term}.` : `+ ${text}`;
  }
  await narEngine.nar.question(text, correlationId);
  await narEngine.nar.run(5, undefined, correlationId);
  const answer = await narEngine.nar.ask(text);
  const narsTruth = answer?.answer
    ? `NARS: ${answer.answer} ${answer.truth ? `f=${answer.truth.f.toFixed(2)};c=${answer.truth.c.toFixed(2)}` : ''}`
    : 'No answer yet';
  const judgment = await judgeOnManifold(narEngine, text);
  return `${narsTruth}${judgment ? `\nManifold: ${judgment}` : ''}`;
};

/** The manifold's verdict on the query, or `null` when System One is off or silent. */
const judgeOnManifold = async (narEngine: NAREngine, text: string): Promise<string | null> => {
  if (!narEngine.nar.isSystemOneEnabled?.()) return null;
  const manifold = narEngine.nar.getSystemOneManifold?.();
  const embeddingCache = narEngine.nar.getSystemOneEmbeddingCache?.();
  if (!manifold || !embeddingCache) return null;
  try {
    const pointer = await embeddingCache.write(text);
    const queries = (['relevance', 'groundedness', 'plausibility'] as const).map((rubric) => ({
      kind: 'evaluate' as const,
      instruction: `Evaluate ${rubric}`,
      rubric,
      axis: 'epistemic' as const,
    }));
    const results = await manifold.judgeBatch(pointer, queries, createSystemOneBudget());
    return results
      .map((r, i) =>
        r.kind === 'evaluate' ? `${queries[i]!.rubric}=${r.score.toFixed(2)}` : `${queries[i]!.rubric}=abstained`
      )
      .join(' ');
  } catch {
    return 'manifold error';
  }
};

function attachNarApi(
  agent: ExtendedAgent,
  config: CreateAgentConfig,
  narEngine: NAREngine,
  pinStore: Map<string, string>
): void {
  const knowStore = pinStore;
  let throttle = clamp(config.throttle ?? 100, 0, 100);

  const originalChat = agent.chat.bind(agent);
  const chatOverride = async function* (
    this: ExtendedAgent,
    text: string,
    opts?: ChatOptions
  ): AsyncGenerator<ChatStreamEvent, string> {
    const trimmed = text.trim();
    if (!trimmed) return '';

    const intent = narEngine ? dispatchNarseseIntent(trimmed) : null;
    if (intent) {
      const correlationId = makeId();
      const result = await answerNarsese(narEngine, intent, correlationId).catch((e: unknown) => {
        // Narsese the term parser rejects falls through to the LM path rather than
        // faulting the turn — the router said Narsese, the parser disagreed, and the
        // sentence still deserves an answer.
        logger.warn('narsese ingress failed; falling through to the LM path', { error: errMsg(e) });
        return null;
      });
      if (result !== null) {
        yield { kind: 'text-delta', text: result };
        yield { kind: 'finish', text: result };
        return result;
      }
    }

    const originalResult = yield* originalChat(trimmed, opts);
    return originalResult;
  };
  agent.chat = chatOverride.bind(agent);

  agent.believe = async (text: string) => {
    const intent = narEngine ? dispatchNarseseIntent(text) : null;
    if (intent?.kind === 'belief' && narEngine) {
      await narEngine.nar.believe(intent.text);
      await narEngine.nar.run(3);
    }
  };

  const recall = (query?: string, limit?: number) => recallEpisodes(config, query, limit);
  agent.recall = recall;

  agent.know = (key: string, value: string) => {
    knowStore.set(key, value);
  };
  agent.knowGet = (key: string) => knowStore.get(key);
  agent.knowList = () => [...knowStore.entries()].map(([k, v]) => ({ key: k, value: v }));

  agent.motor &&
    registerAgentTools(agent.motor, {
      know: (k, v) => void knowStore.set(k, v),
      knowGet: (k) => knowStore.get(k),
      knowList: () => [...knowStore.entries()].map(([k, v]) => ({ key: k, value: v })),
      recall,
      delegate: createDelegateRunner(config),
    });

  // Single tool registry: make nar's ToolManager the authoritative registry
  // by setting it as the delegate of the core motor ToolRegistry.
  const nar = narEngine?.nar;
  if (nar) {
    const adapter = new CoreToolRegistryAdapter(nar.tools);
    agent.motor.setDelegate(adapter);
  }

  agent.setThrottle = (n: number) => {
    throttle = clamp(n, 0, 100);
  };
  agent.getThrottle = () => throttle;
  agent.getNAR = () => narEngine?.nar;
  agent.getEpisodicMemory = () => config.episodicMemory;

  // Delegate a cognitive task to another agent over WebSocket
  agent.delegate = async (params: {
    target: string;
    task: { type: string; term: string };
    ruleId: string;
  }): Promise<{ truth?: Truth; confidence?: number; error?: string }> => {
    const { target, task, ruleId } = params;
    
    // Parse target URL
    const url = new URL(target);
    const host = url.hostname;
    const port = parseInt(url.port) || 8765;
    const wsUrl = `ws://${host}:${port}`;
    
    // Create a raw WebSocket client connection
    const ws = new WebSocket(wsUrl);
    
    return new Promise((resolve) => {
      const disarmDeadline = deadline(DELEGATION_TIMEOUT_MS, () => {
        resolve({ error: 'Delegation timeout' });
        ws.close();
      });
      
      ws.on('open', () => {
        // Send delegation message
        const delegation = {
          type: 'cognitive-delegation',
          delegation: {
            taskId: makeId(),
            taskType: ruleId,
            narseseContext: task.term,
            callbackEndpoint: wsUrl, // For response
          },
        };
        ws.send(JSON.stringify(delegation));
      });
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'cognitive-delegation-result' && message.result) {
            disarmDeadline();
            ws.close();
            
            const result = message.result;
            if (result.success && result.resultNarsese?.length > 0) {
              // Admit the result through PerceptionGate with PEER_AGENT quality
              const nar = narEngine?.nar;
              if (nar) {
                for (const termStr of result.resultNarsese) {
                  await nar.input(termStr, 'belief', Truth.create(1.0, 0.5));
                }
                await nar.run(3);
                
                // Query the result
                const answer = await nar.ask(task.term);
                if (answer?.truth) {
                  resolve({
                    truth: answer.truth,
                    confidence: Truth.expectation(answer.truth),
                  });
                  return;
                }
              }
              // The fallback admits at the PEER_AGENT ceiling, so it says so as a
              // pair rather than a bare 0.5 that read like a measurement.
              resolve({ truth: Truth.create(1.0, SOURCE_QUALITY_CONFIDENCE.PEER_AGENT) });
            } else {
              resolve({ error: result.error ?? 'Delegation failed' });
            }
          }
        } catch {
          // Ignore parse errors
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
}

export type { Agent } from '@senars/core';
export { createCortexFromLM } from '@senars/core/cortex';
export type { JsonlSessionManagerConfig } from '@senars/core/memory';
export {
  abortSession,
  createSession,
  InMemorySessionManager,
  JsonlSessionManager,
} from '@senars/core/memory';
export { dispatchToolCalls, registerAgentTools } from '@senars/core/motor';
export type { CapabilitySpec, CapabilitySurface, WiredNAR } from './builder.js';
export { BuilderError, NARBuilder } from './builder.js';
export {
  type AnswerEnvelope,
  type CognitiveAgent,
  type CognitiveAgentConfig,
  type CognitiveAgentPreset,
  createCognitiveAgent,
} from './cognitive-agent.js';
export type { NARProfileName, NARProfileSpec } from './profiles.js';
export { NAR_PROFILES, resolveProfile } from './profiles.js';
export type { ExtendedAgent };
