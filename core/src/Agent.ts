import { Kernel } from './kernel/Kernel.js';
import { MemoryService } from './memory/MemoryService.js';
import { InMemoryEventLog } from './eventlog/InMemoryEventLog.js';
import type { CognitiveEvent } from './CognitiveEvent.js';
import type { ChatOptions, ChatStreamEvent } from './ChatService.js';
import type { Connection, Logger } from './Transport.js';
import type { AgentCapabilities } from './Protocol.js';
import { generateId } from './helpers.js';

export interface AgentOptions {
  log?: Logger;
  metta?: unknown;
  nar?: unknown;
  id?: string;
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
  readonly kernel: Kernel;
  readonly id: string;
  readonly memory: MemoryService;

  #cognitiveListeners = new Set<(e: CognitiveEvent) => void>();
  #transports = new Map<string, Connection>();
  #transportHandlers = new Map<string, (msg: { text: string }) => Promise<void>>();
  #skills = new Map<string, SkillDefinition>();
  #started = false;

  constructor(opts: AgentOptions = {}) {
    this.id = opts.id ?? generateId('agent');
    this.kernel = new Kernel(new InMemoryEventLog());
    this.memory = new MemoryService();
  }

  submit(input: string, correlationId: string): void {
    this.#emitCognitive({
      engine: 'metta',
      type: 'input',
      term: input,
      source: 'transport',
      timestamp: Date.now(),
      correlationId,
    });
    this.kernel.submit(input, correlationId);
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
      lastCycle: Date.now(),
      cycleCount: 0,
      errorRate: 0,
    };
  }

  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    await this.kernel.start();
  }

  async stop(): Promise<void> {
    if (!this.#started) return;
    this.#started = false;
    for (const transport of this.#transports.values()) {
      await transport.disconnect('agent stopping');
    }
    await this.kernel.stop();
  }

  async *chat(input: string, _opts?: ChatOptions): AsyncGenerator<ChatStreamEvent, string> {
    const correlationId = crypto.randomUUID();
    this.#emitCognitive({
      engine: 'metta',
      type: 'input',
      term: input,
      source: 'chat',
      timestamp: Date.now(),
      correlationId,
    });
    const response = `[agent] ${input}`;
    yield { kind: 'text-delta', text: response };
    return response;
  }

  #emitCognitive(event: CognitiveEvent): void {
    for (const listener of this.#cognitiveListeners) {
      try { listener(event); } catch { /* ignore listener errors */ }
    }
  }
}
