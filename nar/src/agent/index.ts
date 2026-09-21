import type { ChatStreamEvent, CortexSynthesizeRequest, PromptBuilder } from '@senars/core';
import { Agent, InMemoryEventLog, SqliteEventLog } from '@senars/core';
import { createCortexFromLM } from '@senars/core/cortex';
import { isNarsese } from '@senars/core/helpers';
import type { PersistableSessionManager } from '@senars/core/memory';
import { registerAgentTools } from '@senars/core/motor';
import { MettaEngine } from '@senars/metta/agent';
import type { EpisodicMemory, LMService, NAR } from '@senars/nar';
import type { ToolFeedbackObserver } from '@senars/util/feedback';
import { DefaultToolFeedbackObserver } from '@senars/util/feedback';
import { NAREngine } from '../engine/NAREngine.js';
import { TrajectoryStore } from '../rlfp/trajectory-store.js';
import { CoreToolRegistryAdapter } from '../tools';
import { createCompactionPromptBuilder } from './compaction.js';

export interface CreateAgentConfig {
  nar?: NAR;
  lmService?: LMService;
  episodicMemory?: EpisodicMemory;
  persistence?: { path: string };
  sessionId?: string;
  externalTools?: Record<string, unknown>;
  /** Engine enable flags (config-file `backends` block). */
  engines?: { nar?: boolean };
  throttle?: number;
  promptBuilder?: import('@senars/core').PromptBuilder;
  /** Bot identity — persona injected into the chat system prompt. */
  profile?: {
    name?: string;
    personality?: string;
    narrateTier?: 'quality' | 'fast' | 'structured';
  };
  /** Composable skill package: instructions injected into the system prompt. */
  skills?: Array<{ id: string; description?: string; instructions: string; enabled?: boolean }>;
  /** Conversation compaction thresholds (`bot.conversation` config block). */
  conversation?: { maxHistory?: number; summaryThreshold?: number };
  /** E4 follow-up (a): JSONL path persisting per-cycle trajectories for implicit preference pairing. */
  trajectoryStorePath?: string;
  sessionManager?: PersistableSessionManager;
}

interface NarAgentApi {
  chat(text: string, opts?: unknown): AsyncGenerator<ChatStreamEvent, string>;

  believe(text: string): Promise<void>;

  recall(query?: string, limit?: number): Promise<Array<{ content: string }>>;

  know(key: string, value: string): void;

  knowGet(key: string): string | undefined;

  knowList(): Array<{ key: string; value: string }>;

  setThrottle(n: number): void;

  getThrottle(): number;

  getNAR(): NAR | undefined;

  getEpisodicMemory(): EpisodicMemory | undefined;

  getRecentDerivations(): unknown;
}

type ExtendedAgent = Agent & NarAgentApi;

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
  const { MettaCommandParser, MettaEngine } = await import('@senars/metta/agent');
  // MeTTa is a tool, not a reasoning engine: instantiated only to back
  // the `metta` builtin tool via mettaExecutor. Never registered as an engine.
  const mettaEngine = new MettaEngine();

  // Create NAR with shared feedback observer if not provided
  let narInstance = config.nar;
  if (!narInstance) {
    const { NAR } = await import('../nar.js');
    const { DEFAULT_CONFIG } = await import('../types/index.js');
    narInstance = new NAR({ ...DEFAULT_CONFIG, feedbackObserver });
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
    commandParser: (text: string) => new MettaCommandParser().parse(text),
    builtinTools: true,
    episodicMemory: config.episodicMemory,
    mettaExecutor: (expr) => mettaEngine.query(expr),
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
  });

  const narEngine = new NAREngine(narInstance, agent.emitCognitive.bind(agent));
  if (config.engines?.nar !== false) agent.registerEngine('nar', narEngine);

  await agent.start();
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
    base: Pick<CreateAgentConfig, 'nar' | 'lmService' | 'episodicMemory' | 'profile'>
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

function attachNarApi(
  agent: ExtendedAgent,
  config: CreateAgentConfig,
  narEngine: NAREngine,
  pinStore: Map<string, string>
): void {
  const knowStore = pinStore;
  let throttle = Math.min(100, Math.max(0, config.throttle ?? 100));

  const originalChat = agent.chat.bind(agent);
  const chatOverride = async function* (
    this: ExtendedAgent,
    text: string,
    opts?: unknown
  ): AsyncGenerator<ChatStreamEvent, string> {
    const trimmed = text.trim();
    if (!trimmed) return '';

    if (isNarsese(trimmed) && narEngine) {
      let result = '';
      if (trimmed.endsWith('?') || trimmed.endsWith('？')) {
        await narEngine.nar.question(trimmed);
        await narEngine.nar.run(5);
        result = `Question queued: ${trimmed}`;
      } else if (trimmed.endsWith('!')) {
        await narEngine.nar.goal(trimmed);
        await narEngine.nar.run(3);
        result = `+ ${trimmed}`;
      } else {
        await narEngine.nar.believe(trimmed);
        await narEngine.nar.run(3);
        const beliefs = narEngine.nar.getBeliefs();
        const last = beliefs[beliefs.length - 1];
        result = last ? `+ ${last.term}.` : `+ ${trimmed}`;
      }
      yield { kind: 'text-delta', text: result };
      yield { kind: 'finish', text: result };
      return result;
    }

    const originalResult = yield* originalChat(trimmed, opts as never);
    return originalResult;
  };
  agent.chat = chatOverride.bind(agent);

  agent.believe = async (text: string) => {
    if (isNarsese(text) && narEngine) {
      await narEngine.nar.believe(text);
      await narEngine.nar.run(3);
    }
  };

  agent.recall = async (query?: string, limit?: number) => {
    if (!config.episodicMemory) return [];
    const episodes = await config.episodicMemory.getEpisodes({ limit: limit ?? 50 });
    return episodes.filter(
      (e: { content: string }) => !query || e.content.toLowerCase().includes(query.toLowerCase())
    );
  };

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
      recall: async (query?: string, limit?: number) => {
        if (!config.episodicMemory) return [];
        const episodes = await config.episodicMemory.getEpisodes({ limit: limit ?? 50 });
        return episodes.filter(
          (e: { content: string }) =>
            !query || e.content.toLowerCase().includes(query.toLowerCase())
        );
      },
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
    throttle = Math.min(100, Math.max(0, n));
  };
  agent.getThrottle = () => throttle;
  agent.getNAR = () => narEngine?.nar;
  agent.getEpisodicMemory = () => config.episodicMemory;
  const getRecentDerivations = agent.getRecentDerivations.bind(agent);
  agent.getRecentDerivations = () => getRecentDerivations();
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
export type { ExtendedAgent };
