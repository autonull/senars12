import { MemoryService } from './memory/MemoryService.js';
import { InMemoryEventLog } from './eventlog/InMemoryEventLog.js';
import type { EventLog } from './eventlog/EventLog.js';
import type { CognitiveEvent } from './CognitiveEvent.js';
import type { ChatOptions, ChatStreamEvent } from './ChatService.js';
import type { Connection } from './Transport.js';
import type { AgentCapabilities } from './Protocol.js';
import { generateId } from './helpers.js';
import type { Engine } from './engine/Engine.js';
import type { CognitiveStimulus, Context, Derivation, ToolResult } from './engine/Engine.js';
import { AgentBridge } from './AgentBridge.js';
import { PolicyEngine } from './PolicyEngine.js';
import { ToolRegistry } from './motor/ToolRegistry.js';
import type { LLMCortex } from './cortex/LLMCortex.js';
import { registerBuiltinTools } from './motor/builtin-tools.js';
import type { NAR } from '@senars/nar';
import type { LMService } from '@senars/nar';
import type { EpisodicMemory } from '@senars/nar';
import type { AuthManager, CommandRegistry } from '@senars/io';
import type { SessionManager, ConversationSession } from './memory/types.js';

export interface ParsedCommand {
  command: string;
  args: string[];
  raw: string;
}

export type AgentPresetName = 'chat' | 'reasoning' | 'autonomous' | 'irc-bot';

export interface AgentPresetDeps {
  nar?: NAR;
  lmService?: LMService;
  episodicMemory?: EpisodicMemory;
  logger?: { debug: (msg: string, ...args: unknown[]) => void; info: (msg: string, ...args: unknown[]) => void; warn: (msg: string, ...args: unknown[]) => void; error: (msg: string, ...args: unknown[]) => void };
  externalTools?: Record<string, unknown>;
  workspaceRoot?: string;
}

export interface AgentPresetResult {
  agent: Agent;
  config: Partial<AgentOptions>;
}

export type ValidatedAgentOptions = Required<Pick<AgentOptions, 'cortex'>> & AgentOptions;

export interface BridgeOptions {
  auth?: AuthManager;
  commandRegistry?: CommandRegistry;
  sessionManager?: SessionManager;
  episodicMemory?: EpisodicMemory;
  generationService?: unknown;
  understandingService?: unknown;
  manager?: unknown;
  enableNarseseHumanization?: boolean;
  enableNarsTrace?: boolean;
}

export interface BridgeContext {
  connection: Connection;
  nar: NAR;
  respond: (text: string) => Promise<void>;
  session?: ConversationSession;
}

export interface AgentOptions {
  log?: EventLog;
  id?: string;
  cortex?: LLMCortex;
  commandParser?: (text: string) => ParsedCommand[];
  builtinTools?: boolean;
  episodicMemory?: import('@senars/nar').EpisodicMemory;
}

export interface HealthStatus {
  readonly status: 'healthy' | 'degraded' | 'stuck' | 'crashed';
  readonly lastCycle: number;
  readonly cycleCount: number;
  readonly errorRate: number;
}

export interface SkillDefinition {
  readonly name: string;
  readonly description?: string;
  execute(...args: unknown[]): unknown;
}

export class Agent {
  readonly id: string;
  readonly log: EventLog;
  readonly memory: MemoryService;
  readonly engines: Map<string, Engine> = new Map();
  readonly policy: PolicyEngine;
  readonly bridge: AgentBridge;
  readonly motor: ToolRegistry;
  readonly cortex?: LLMCortex;
  readonly episodicMemory?: import('@senars/nar').EpisodicMemory;

  #cognitiveListeners = new Set<(e: CognitiveEvent) => void>();
  #transports = new Map<string, Connection>();
  #transportHandlers = new Map<string, (msg: { text: string }) => Promise<void>>();
  #skills = new Map<string, SkillDefinition>();
  #commandParser?: (text: string) => ParsedCommand[];
  #started = false;
  #cycleCount = 0;
  #lastCycleTime = 0;
  #lastResponse = '';

  constructor(opts: AgentOptions = {}) {
    this.id = opts.id ?? generateId('agent');
    this.log = opts.log ?? new InMemoryEventLog();
    this.memory = new MemoryService();
    this.policy = new PolicyEngine();
    this.bridge = new AgentBridge(this);
    this.motor = new ToolRegistry();
    this.cortex = opts.cortex;
    this.episodicMemory = opts.episodicMemory;
    this.#commandParser = opts.commandParser;

    this.memory.connectLog(this.log);
    this.memory.connectEngines(this.engines);
    this.memory.connectMotor(this.motor);

    if (opts.builtinTools !== false) {
      registerBuiltinTools(this.motor);
    }
  }

  registerEngine(id: string, engine: Engine): void {
    this.engines.set(id, engine);
    this.memory.connectEngines(this.engines);
  }

  async cycle(stimulus: CognitiveStimulus): Promise<string> {
    this.#cycleCount++;
    this.#lastCycleTime = Date.now();
    this.#lastResponse = '';

this.#emitCognitive({
      engine: 'metta',
      type: 'input.user',
      timestamp: Date.now(),
      correlationId: stimulus.correlationId,
      payload: { text: stimulus.text, source: 'cycle' },
    });
    const cid = await this.log.append({
      engine: 'metta',
      type: 'input.user',
      payload: { text: stimulus.text, source: stimulus.source },
      correlationId: stimulus.correlationId,
      causationId: '',
    });

    const working = this.memory.recent(50);
    const episodic = await this.memory.queryEpisodic();
    const semantic = await this.memory.querySemantic(stimulus.text);
    const context: Context = { working, episodic, semantic };

    const derivations: Derivation[] = [];
    for (const engine of this.engines.values()) {
      try {
        const result = await engine.reason(stimulus, context);
        derivations.push(...result);
      } catch {
        // engine unavailable, continue
      }
    }

    let narrativeText = '';
    if (this.cortex) {
      const narrative = await this.cortex.synthesize({ stimulus, context, derivations });
      narrativeText = narrative.text;
      this.memory.append({
        type: 'narrative',
        payload: narrativeText,
        correlationId: stimulus.correlationId,
      });
    } else {
      for (const d of derivations) {
        this.memory.append({
          type: 'derivation',
          payload: d,
          correlationId: stimulus.correlationId,
        });
      }
    }

    // Log to episodic memory if available
    if (this.episodicMemory && narrativeText) {
      await this.episodicMemory.log('response', narrativeText, { correlationId: stimulus.correlationId });
    }
    if (this.episodicMemory && stimulus.source === 'chat') {
      await this.episodicMemory.log('input', stimulus.text, { correlationId: stimulus.correlationId });
    }

    const toolResults: Array<{ command: string; result: ToolResult }> = [];
    if (this.#commandParser && narrativeText) {
      const commands = this.#commandParser(narrativeText);
      for (const cmd of commands) {
        if (cmd.command === 'send') {
          this.#lastResponse = cmd.args[0] ?? '';
          continue;
        }

        const policyCheck = this.policy.checkCommand(cmd.command);
        if (!policyCheck.allowed) {
          const result: ToolResult = { success: false, content: null, error: policyCheck.reason ?? 'Blocked by policy' };
          toolResults.push({ command: cmd.command, result });
          continue;
        }

        const toolArgs: Record<string, unknown> = { args: cmd.args, raw: cmd.raw, command: cmd.command };
        const result = await this.motor.execute(cmd.command, toolArgs, stimulus.correlationId);
        toolResults.push({ command: cmd.command, result });
        await this.log.append({
          engine: 'nar',
          type: 'tool.request',
          payload: { toolName: cmd.command, args: { args: cmd.args }, timeoutMs: 30000 },
          correlationId: stimulus.correlationId,
          causationId: cid.id,
        });
        for (const engine of this.engines.values()) {
          try { engine.absorb?.(result); } catch { /* ignore */ }
        }
      }
    }

await this.memory.consolidate(cid.id ?? '');
    for (const tr of toolResults) {
      this.memory.append({
        type: 'tool_result',
        payload: tr,
        correlationId: stimulus.correlationId,
      });
    }

    for (const d of derivations) {
      this.#emitCognitive({
        engine: 'nar',
        type: 'derivation.made',
        timestamp: Date.now(),
        correlationId: stimulus.correlationId,
        payload: { rule: '', premises: [], conclusion: d.term },
      });
    }
    for (const tr of toolResults) {
      this.#emitCognitive({
        engine: 'nar',
        type: 'skill.executed',
        timestamp: Date.now(),
        correlationId: stimulus.correlationId,
        payload: { skill: tr.command, args: [], result: tr.result.success ? 'success' : tr.result.error ?? 'error', durationMs: 0 },
      });
    }

    return this.#lastResponse || narrativeText;
  }

  submit(input: string, correlationId: string): void {
    this.#emitCognitive({
      engine: 'metta',
      type: 'input.user',
      timestamp: Date.now(),
      correlationId,
      payload: { text: input, source: 'transport' },
    });
  }

  mount(transport: Connection): void {
    const handler = async (message: { text: string }) => {
      const correlationId = crypto.randomUUID();
      this.submit(message.text, correlationId);
    };
    transport.onMessage(handler);
    this.#transportHandlers.set(transport.id, handler);
    this.#transports.set(transport.id, transport);
  }

  unmount(idOrTransport: string | Connection): void {
    const id = typeof idOrTransport === 'string' ? idOrTransport : idOrTransport.id;
    const transport = this.#transports.get(id);
    if (!transport) return;
    const handler = this.#transportHandlers.get(id);
    if (handler) {
      transport.removeMessageHandler(handler);
      this.#transportHandlers.delete(id);
    }
    this.#transports.delete(id);
  }

  on(_event: string | '*', handler: (e: CognitiveEvent) => void): void {
    this.#cognitiveListeners.add(handler);
  }

  off(_event: string | '*', handler: (e: CognitiveEvent) => void): void {
    this.#cognitiveListeners.delete(handler);
  }

  registerSkill(name: string, def: { execute(...args: unknown[]): unknown }): void {
    this.#skills.set(name, { name, ...def });
  }

  capabilities(): AgentCapabilities {
    return {
      engine: 'metta',
      supports: {
        chat: true,
        beliefs: true,
        drives: false,
        skills: true,
        ltm: true,
        rlfp: false,
        selfReasoning: false,
        autonomyLoop: true,
      },
    };
  }

  health(): HealthStatus {
    return {
      status: this.#started ? 'healthy' : 'stuck',
      lastCycle: this.#lastCycleTime,
      cycleCount: this.#cycleCount,
      errorRate: 0,
    };
  }

  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    for (const engine of this.engines.values()) {
      try {
        if ('initialize' in engine && typeof engine.initialize === 'function') {
          await engine.initialize();
        }
      } catch {
        // engine init failed, continue
      }
    }
    await this.memory.load();
  }

  async stop(): Promise<void> {
    if (!this.#started) return;
    this.#started = false;
    await this.memory.persist();
    for (const transport of this.#transports.values()) {
      await transport.disconnect('agent stopping');
    }
    for (const engine of this.engines.values()) {
      try {
        if ('shutdown' in engine && typeof engine.shutdown === 'function') {
          await engine.shutdown();
        }
      } catch {
        // ignore
      }
    }
  }

  async *chat(input: string, _opts?: ChatOptions): AsyncGenerator<ChatStreamEvent, string> {
    const correlationId = crypto.randomUUID();
    const stimulus: CognitiveStimulus = {
      text: input,
      source: 'chat',
      timestamp: Date.now(),
      correlationId,
    };

    const response = await this.cycle(stimulus);
    if (response) {
      yield { kind: 'text-delta', text: response };
      return response;
    }

    const fallback = `[agent] ${input}`;
    yield { kind: 'text-delta', text: fallback };
    return fallback;
  }

  async replaySession(events: import('./CognitiveEvent.js').CognitiveEvent[]): Promise<void> {
    for (const evt of events) await this.log.append(evt);
  }

  getRecentDerivations(): Derivation[] {
    return this.memory.recent(50).filter(e => e.type === 'derivation').map(e => e.payload as Derivation);
  }

    #emitCognitive(event: CognitiveEvent): void {
    for (const listener of this.#cognitiveListeners) {
      try { listener(event); } catch { /* ignore listener errors */ }
    }
  }
}