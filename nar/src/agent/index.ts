import type { ChatStreamEvent } from '@senars/core';
import { Agent, InMemoryEventLog, SqliteEventLog } from '@senars/core';
import { createCortexFromLM } from '@senars/core/cortex';
import { isNarsese } from '@senars/core/helpers';
import type { PersistableSessionManager } from '@senars/core/memory';
import { registerAgentTools } from '@senars/core/motor';
import { MettaEngine } from '@senars/metta/agent';
import type { EpisodicMemory, LMService, NAR } from '@senars/nar';
import { NAREngine } from '../engine/NAREngine.js';

export interface CreateAgentConfig {
  nar?: NAR;
  lmService?: LMService;
  episodicMemory?: EpisodicMemory;
  persistence?: { path: string };
  sessionId?: string;
  externalTools?: Record<string, unknown>;
  throttle?: number;
  promptBuilder?: import('@senars/core').PromptBuilder;
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

export async function createAgent(config: CreateAgentConfig = {}): Promise<ExtendedAgent> {
  const log = config.persistence
    ? new SqliteEventLog({ path: config.persistence.path })
    : new InMemoryEventLog();

  const cortex = config.lmService
    ? createCortexFromLM(config.lmService, config.promptBuilder)
    : undefined;

  const { MettaCommandParser } = await import('@senars/metta/agent');
  const agent = new Agent({
    log,
    cortex,
    commandParser: (text: string) => new MettaCommandParser().parse(text),
    builtinTools: true,
    episodicMemory: config.episodicMemory,
    sessionManager: config.sessionManager,
  });

  const narEngine = new NAREngine(config.nar, agent.emitCognitive.bind(agent));
  const mettaEngine = new MettaEngine();
  agent.registerEngine('nar', narEngine);
  agent.registerEngine('metta', mettaEngine);

  await agent.start();
  attachNarApi(agent as ExtendedAgent, config, narEngine);

  return agent as ExtendedAgent;
}

function attachNarApi(agent: ExtendedAgent, config: CreateAgentConfig, narEngine: NAREngine): void {
  const knowStore = new Map<string, string>();
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
    });

  agent.setThrottle = (n: number) => {
    throttle = Math.min(100, Math.max(0, n));
  };
  agent.getThrottle = () => throttle;
  agent.getNAR = () => narEngine?.nar;
  agent.getEpisodicMemory = () => config.episodicMemory;
  agent.getRecentDerivations = () => agent.getRecentDerivations();
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
export { buildAgentTools, dispatchToolCalls, registerAgentTools } from '@senars/core/motor';
