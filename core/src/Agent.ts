import type { EpisodicMemory } from '@senars/nar';
import { AgentBridge } from './AgentBridge.js';
import type { ChatOptions, ChatStreamEvent } from './ChatService.js';
import type { CognitiveEvent } from './CognitiveEvent.js';
import type { CognitiveEvent as _CE } from './CognitiveEvent.js';
import { PolicyEngine } from './PolicyEngine.js';
import type { Connection } from './Transport.js';
import { type CycleHost, runCycle } from './agent/phases.js';
import type { HealthStatus, ParsedCommand, SkillDefinition } from './agent/types.js';
import type { AgentOptions } from './agent/types.js';
import type { LLMCortex } from './cortex/LLMCortex.js';
import type { Engine } from './engine/Engine.js';
import type { CognitiveStimulus, Derivation } from './engine/Engine.js';
import type { PersistableSessionManager } from './memory/types.js';
import type { EventLog } from './eventlog/EventLog.js';
import { InMemoryEventLog } from './eventlog/InMemoryEventLog.js';
import { generateId } from './helpers.js';
import { MemoryService } from './memory/MemoryService.js';
import { ToolRegistry } from './motor/ToolRegistry.js';
import { registerBuiltinTools } from './motor/builtin-tools.js';
import type { AgentCapabilities } from './protocol/index.js';

export type {
  ParsedCommand,
  AgentPresetName,
  AgentPresetDeps,
  AgentPresetResult,
  ValidatedAgentOptions,
  BridgeOptions,
  BridgeContext,
  AgentOptions,
  HealthStatus,
  SkillDefinition,
} from './agent/types.js';

export class Agent {
  readonly id: string;
  readonly log: EventLog;
  readonly memory: MemoryService;
  readonly engines: Map<string, Engine> = new Map();
  readonly policy: PolicyEngine;
  readonly bridge: AgentBridge;
  readonly motor: ToolRegistry;
  readonly cortex?: LLMCortex;
  readonly episodicMemory?: EpisodicMemory;
  readonly sessionManager?: PersistableSessionManager;

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
    this.sessionManager = opts.sessionManager;
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

  #cycleHost(): CycleHost {
    console.log('[Agent.#cycleHost] Engines:', Array.from(this.engines.keys()));
    return {
      log: this.log,
      memory: this.memory,
      engines: this.engines,
      policy: this.policy,
      motor: this.motor,
      cortex: this.cortex,
      episodicMemory: this.episodicMemory,
      commandParser: this.#commandParser,
      emit: (e) => this.#emitCognitive(e),
      getLastResponse: () => this.#lastResponse,
      setLastResponse: (v) => {
        this.#lastResponse = v;
      },
    };
  }

  async cycle(stimulus: CognitiveStimulus): Promise<string> {
    console.log('[Agent.cycle] Stimulus:', stimulus.text);
    console.log('[Agent.cycle] Engines:', Array.from(this.engines.keys()));
    this.#cycleCount++;
    this.#lastCycleTime = Date.now();
    const result = await runCycle(this.#cycleHost(), stimulus);
    console.log('[Agent.cycle] Result:', result);
    return result;
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

  emitCognitive(event: CognitiveEvent): void {
    console.log('[Agent.emitCognitive]', event.type, event.engine);
    this.#emitCognitive(event);
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
    await this.sessionManager?.restore();
  }

  async stop(): Promise<void> {
    if (!this.#started) return;
    this.#started = false;
    await this.sessionManager?.snapshot();
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
    console.log('[Agent.chat] Called with:', input);
    const correlationId = crypto.randomUUID();
    const stimulus: CognitiveStimulus = {
      text: input,
      source: 'chat',
      timestamp: Date.now(),
      correlationId,
    };

    const response = await this.cycle(stimulus);
    console.log('[Agent.chat] Cycle response:', response);
    if (response) {
      yield { kind: 'text-delta', text: response };
      return response;
    }

    const fallback = `[agent] ${input}`;
    console.log('[Agent.chat] Using fallback:', fallback);
    yield { kind: 'text-delta', text: fallback };
    return fallback;
  }

  async replaySession(events: _CE[]): Promise<void> {
    for (const evt of events) await this.log.append(evt);
  }

  getRecentDerivations(): Derivation[] {
    return this.memory
      .recent(50)
      .filter((e) => e.type === 'derivation')
      .map((e) => e.payload as Derivation);
  }

  #emitCognitive(event: CognitiveEvent): void {
    for (const listener of this.#cognitiveListeners) {
      try {
        listener(event);
      } catch {
        /* ignore listener errors */
      }
    }
  }
}
