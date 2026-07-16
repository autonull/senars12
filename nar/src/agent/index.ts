import type { NAR } from '../nar.js';
import type { LMService } from '../lm/lm-service.js';
import type { EpisodicMemory, Episode } from '../memory/EpisodicMemory.js';
import type { ChatOptions, ChatStreamEvent } from '@senars/core';
import { MettaCommandParser, MettaEngine, type ParsedCommand as MettaParsedCommand } from '@senars/metta/agent';
import { NAREngine } from '../engine/NAREngine.js';
import { ToolRegistry, registerBuiltinTools } from '@senars/core';

export type { Agent, AgentOptions, AgentToolDeps, AgentPresetName, AgentPresetDeps, AgentPresetResult, ValidatedAgentOptions, BridgeOptions, BridgeContext, ConversationSession, SessionManager } from './types.js';
export { InMemorySessionManager, JsonlSessionManager, createSession, abortSession } from './session.js';
export type { JsonlSessionManagerConfig } from './session.js';
export { buildAgentTools } from './tools.js';
export { createCortexFromLM } from './cortex.js';
export {
  bindAgentToConnection,
  createAgentDispatch,
  createAuthMiddleware,
  createCommandInterceptor,
  createSessionBinder,
  createConnectionConfigsFromEnv,
  createErrorBoundary,
  createRateLimiter,
  originExtractor,
  resolveSessionKey,
  agentConfigToOptions,
  registerAllCommands,
} from './bridge.js';

export interface CreateAgentOpts {
  nar?: NAR;
  lmService?: LMService;
  episodicMemory?: EpisodicMemory;
  logger?: { debug: (msg: string, ...args: unknown[]) => void; info: (msg: string, ...args: unknown[]) => void; warn: (msg: string, ...args: unknown[]) => void; error: (msg: string, ...args: unknown[]) => void };
  autonomyEngine?: { start: () => void; stop: () => void; setNotifyHandler: (h: (msg: string) => void) => void };
  externalTools?: Record<string, unknown>;
  workspaceRoot?: string;
  throttle?: number;
  knowStore?: Map<string, string>;
  enableNarseseHumanization?: boolean;
  enableNarsTrace?: boolean;
  /** Custom command parser for the LM-path output. Defaults to MettaCommandParser. */
  commandParser?: (text: string) => MettaParsedCommand[];
  /** Register engines as organs. NAREngine + MettaEngine are added when not provided explicitly. */
  engines?: Array<{ id: string; reason: (stimulus: { text: string }, ctx: unknown) => Promise<unknown[]>; query?: (pattern: string) => Promise<unknown[]> }>;
  /** Disable auto-registration of builtin tools (default: false). */
  disableBuiltinTools?: boolean;
}

function isNarsese(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('(') || trimmed.startsWith('<') || trimmed.startsWith('{') || trimmed.startsWith('[')) return true;
  if (trimmed.includes('-->') || trimmed.includes('<->') || trimmed.includes('==>') || trimmed.includes('<=>')) return true;
  if (trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?')) {
    const body = trimmed.slice(0, -1).trim();
    if (body.startsWith('(') || body.startsWith('<')) return true;
  }
  return false;
}

export function createAgent(opts: CreateAgentOpts = {}) {
  const nar = opts.nar;
  const lmService = opts.lmService;
  const episodicMemory = opts.episodicMemory;
  const knowStore: Map<string, string> = opts.knowStore ?? new Map();
  const recentDerivations: unknown[] = [];
  let throttleValue = Math.min(100, Math.max(0, opts.throttle ?? 100));
  let started = false;
  let stopped = false;
  let stopFns: Array<() => void> = [];
  const eventBus = new EventBus();
  let totalChats = 0;
  let successfulChats = 0;
  let totalDurationMs = 0;

  // Engines (reasoning organs) — default to NAREngine + MettaEngine
  const engines: Array<{ id: string; reason: (stimulus: { text: string }, ctx: unknown) => Promise<unknown[]>; query?: (pattern: string) => Promise<unknown[]> }> =
    opts.engines ?? [
      { id: 'nar', reason: async (s) => new NAREngine(nar).reason({ text: s.text, source: 'chat', timestamp: Date.now(), correlationId: '' }, { working: [], episodic: [], semantic: [] }), query: async (p) => new NAREngine(nar).query(p) },
      { id: 'metta', reason: async (s) => new MettaEngine().reason({ text: s.text, source: 'chat', timestamp: Date.now(), correlationId: '' }, { working: [], episodic: [], semantic: [] }), query: async (p) => new MettaEngine().query(p) },
    ];

  // Tools (motor cortex) — builtin registry
  const motor = new ToolRegistry();
  if (!opts.disableBuiltinTools) registerBuiltinTools(motor);

  // Command parser (default: MettaCommandParser)
  const commandParser = opts.commandParser ?? ((text: string) => new MettaCommandParser().parse(text));

  const agent = {
    on(event: string, handler: (data: unknown) => void): void {
      if (event === '*' || event.startsWith('agent:')) {
        eventBus.on(event, handler);
      }
    },

    off(event: string, handler: (data: unknown) => void): void {
      eventBus.off(event, handler);
    },

    getStats(): { totalChats: number; successfulChats: number; totalDurationMs: number } {
      return { totalChats, successfulChats, totalDurationMs };
    },

    async chat(text: string, chatOpts?: { stream?: boolean; session?: import('./types.js').ConversationSession; signal?: AbortSignal }): Promise<string> {
      const trimmed = text.trim();
      if (!trimmed) return '';
      eventBus.emit('agent:process:start', { input: trimmed });
      const startTime = Date.now();
      totalChats++;

      // Narsese path
      if (nar && isNarsese(trimmed)) {
        try {
          if (trimmed.endsWith('?') || trimmed.endsWith('？')) {
            await nar.question(trimmed);
            await nar.run(5);
            totalDurationMs += Date.now() - startTime;
            successfulChats++;
            eventBus.emit('agent:process:complete', { output: `Question queued: ${trimmed}`, durationMs: Date.now() - startTime });
            return `Question queued: ${trimmed}`;
          }
          if (trimmed.endsWith('!')) {
            await nar.goal(trimmed);
            await nar.run(3);
            totalDurationMs += Date.now() - startTime;
            successfulChats++;
            eventBus.emit('agent:process:complete', { output: `+ ${trimmed}`, durationMs: Date.now() - startTime });
            return `+ ${trimmed}`;
          }
          // Belief
          await nar.believe(trimmed);
          await nar.run(3);
          const beliefs = nar.getBeliefs();
          const last = beliefs[beliefs.length - 1];
          if (last) {
            const termStr = last.term?.toString() ?? String(last.term);
            recentDerivations.push(last);
            totalDurationMs += Date.now() - startTime;
            successfulChats++;
            eventBus.emit('agent:process:complete', { output: `+ ${termStr}.`, durationMs: Date.now() - startTime });
            return `+ ${termStr}.`;
          }
          totalDurationMs += Date.now() - startTime;
          successfulChats++;
          eventBus.emit('agent:process:complete', { output: `+ ${trimmed}`, durationMs: Date.now() - startTime });
          return `+ ${trimmed}`;
        } catch {
          // Fall through to LM
        }
      }

      // LM path
      if (lmService?.available) {
        try {
          let response = await lmService.generateText(trimmed, { signal: chatOpts?.signal });
          if (episodicMemory) {
            await episodicMemory.log('input', trimmed);
            await episodicMemory.log('response', response);
          }
          // Parse cortex output into commands; capture `send` as the response
          const commands = commandParser(response);
          let captured = '';
          for (const cmd of commands) {
            if (cmd.command === 'send') {
              const sent = (cmd.args[0] ?? '').replace(/^"|"$/g, '');
              if (sent) { captured = captured ? `${captured}\n${sent}` : sent; }
              continue;
            }
            if (cmd.command === 'remember') {
              const content = (cmd.args[0] ?? '').replace(/^"|"$/g, '');
              if (content && episodicMemory) await episodicMemory.log('belief_added', content);
              continue;
            }
            await motor.execute(cmd.command, { args: cmd.args, raw: cmd.raw, command: cmd.command });
          }
          if (captured) response = captured;
          totalDurationMs += Date.now() - startTime;
          successfulChats++;
          eventBus.emit('agent:process:complete', { output: response, durationMs: Date.now() - startTime });
          return response;
        } catch (e) {
          totalDurationMs += Date.now() - startTime;
          eventBus.emit('agent:process:error', { error: (e as Error).message });
          return 'I encountered an error processing your request.';
        }
      }

      if (nar && isNarsese(trimmed)) {
        totalDurationMs += Date.now() - startTime;
        successfulChats++;
        return `+ ${trimmed}`;
      }

      totalDurationMs += Date.now() - startTime;
      successfulChats++;
      eventBus.emit('agent:process:complete', { output: `[agent] ${trimmed}`, durationMs: Date.now() - startTime });
      return `[agent] ${trimmed}`;
    },

    async *chatStream(text: string, streamOpts?: ChatOptions & { session?: import('./types.js').ConversationSession }): AsyncGenerator<ChatStreamEvent, string> {
      const result = await agent.chat(text, { signal: streamOpts?.signal });
      yield { kind: 'text-delta', text: result };
      return result;
    },

    async believe(text: string): Promise<void> {
      if (!nar) return;
      if (isNarsese(text)) {
        await nar.believe(text);
        await nar.run(3);
      }
    },

    async recall(query?: string, limit?: number): Promise<Episode[]> {
      if (!episodicMemory) return [];
      if (query) {
        const all = await episodicMemory.getEpisodes({ limit: limit ?? 50 });
        const lower = query.toLowerCase();
        return all.filter((e: Episode) => e.content.toLowerCase().includes(lower));
      }
      return episodicMemory.getEpisodes({ limit: limit ?? 50 });
    },

    know(key: string, value: string): void {
      knowStore.set(key, value);
    },

    knowGet(key: string): string | undefined {
      return knowStore.get(key);
    },

    knowList(): Array<{ key: string; value: string }> {
      return [...knowStore.entries()].map(([key, value]) => ({ key, value }));
    },

    setThrottle(n: number): void {
      throttleValue = Math.min(100, Math.max(0, n));
    },

    getThrottle(): number {
      return throttleValue;
    },

    getNAR(): NAR | undefined {
      return nar;
    },

    getEpisodicMemory(): EpisodicMemory | undefined {
      return episodicMemory;
    },

    getEngines(): Array<{ id: string; reason: (stimulus: { text: string }, ctx: unknown) => Promise<unknown[]>; query?: (pattern: string) => Promise<unknown[]> }> {
      return engines;
    },

    getMotor(): ToolRegistry {
      return motor;
    },

    getRecentDerivations(): unknown[] {
      return [...recentDerivations];
    },

    start(): () => void {
      if (started) return () => {};
      started = true;
      stopped = false;

      if (opts.autonomyEngine) {
        opts.autonomyEngine.start();
      }

      eventBus.emit('agent:resume', { timestamp: Date.now() });

      return () => {
        agent.stop();
      };
    },

    stop(): void {
      if (stopped) return;
      eventBus.emit('agent:suspend', { timestamp: Date.now() });
      stopped = true;
      started = false;

      if (opts.autonomyEngine) {
        opts.autonomyEngine.stop();
      }

      for (const fn of stopFns) {
        try { fn(); } catch { /* ignore */ }
      }
      stopFns = [];
    },
  };

  return agent;
}

// Presets
export function createAgentPreset(name: import('./types.js').AgentPresetName, deps: import('./types.js').AgentPresetDeps = {}): import('./types.js').AgentPresetResult {
  const config: Partial<CreateAgentOpts> = { ...deps };
  return { agent: createAgent(config) as import('./types.js').Agent, config };
}

// Autonomy engine (stub for now)
export function createAutonomyEngine(_nar: NAR, _eventBus: unknown): { start: () => void; stop: () => void; setNotifyHandler: (h: (msg: string) => void) => void } {
  return {
    start: () => {},
    stop: () => {},
    setNotifyHandler: (_h: (msg: string) => void) => {},
  };
}

// EventBus for observability
export class EventBus<Events extends Record<string, unknown> = Record<string, unknown>> {
  #listeners = new Map<string, Set<(data: unknown) => void>>();

  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    const handlers = this.#listeners.get(event);
    if (handlers) handlers.add(handler);
    return () => { this.#listeners.get(event)?.delete(handler); };
  }

  off(event: string, handler: (data: unknown) => void): void {
    this.#listeners.get(event)?.delete(handler);
  }

  emit(event: string, data: unknown): void {
    for (const handler of this.#listeners.get(event) ?? []) {
      try { handler(data); } catch { /* isolate listener errors */ }
    }
  }
}

// Dispatch tool calls for ToolDispatcher
export interface DispatchToolResult {
  artifacts: Array<{ type: string; content?: string; metadata?: Record<string, unknown> }>;
  errors: Array<Error>;
}

export async function dispatchToolCalls(
  calls: Array<{ toolName: string; toolCallId: string; args: Record<string, unknown> }>,
  context: { tools: Record<string, { execute: (args: Record<string, unknown>) => unknown | Promise<unknown> }> }
): Promise<DispatchToolResult> {
  const artifacts: DispatchToolResult['artifacts'] = [];
  const errors: Error[] = [];

  for (const call of calls) {
    const tool = context.tools[call.toolName];
    if (!tool) {
      errors.push(new Error(`Tool not found: ${call.toolName}`));
      continue;
    }
    try {
      const result = await tool.execute(call.args);
      artifacts.push({ type: 'tool_result', metadata: { toolName: call.toolName, toolCallId: call.toolCallId } });
      const resultObj = result as Record<string, unknown>;
      if (call.toolName === 'nar_believe' && typeof result === 'object' && result !== null && resultObj.success === true) {
        artifacts.push({ type: 'belief_added', content: typeof resultObj.statement === 'string' ? resultObj.statement : undefined });
      }
    } catch (e) {
      errors.push(e instanceof Error ? e : new Error(String(e)));
    }
  }

  return { artifacts, errors };
}

// createStreamingAgentDispatch
export function createStreamingAgentDispatch(
  agent: ReturnType<typeof createAgent>,
  logger: { debug: (msg: string, ...args: unknown[]) => void; info: (msg: string, ...args: unknown[]) => void; warn: (msg: string, ...args: unknown[]) => void; error: (msg: string, ...args: unknown[]) => void },
  opts?: { humanizeTools?: boolean }
): (msg: { text: string; origin: string }, ctx: Record<string, unknown>, next: () => Promise<void>) => Promise<void> {
  return async (msg, ctx, next) => {
    const respond = ctx.respond as ((text: string) => Promise<void>) | undefined;
    try {
      const result = await agent.chat(msg.text);
      if (result && respond) await respond(result);
    } catch (e) {
      logger.error('dispatch error', e as Error);
      if (respond) await respond(`Error: ${(e as Error).message}`);
    }
  };
}

// Re-export types from core that are needed by consumers
export type { NAR } from '../nar.js';
export type { Episode } from '../memory/EpisodicMemory.js';
export { ModelRunner } from '@senars/core';
