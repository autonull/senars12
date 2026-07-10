import type { ChatOptions, ChatStreamEvent, CognitiveEvent } from './CognitiveEvent.js';
import type { AgentCapabilities } from './Protocol.js';
import type { Connection, IOMessage } from './Transport.js';

export interface ChatCapable {
  chat(
    input: string,
    opts?: ChatOptions
  ): Promise<string> | AsyncGenerator<ChatStreamEvent, string>;
}

export interface CognitiveEventSource {
  readonly start: () => void;
  readonly stop: () => void;
  readonly submit: (input: string, correlationId: string) => void;
  readonly on: (event: string | '*', handler: (event: CognitiveEvent) => void) => void;
  readonly off: (event: string | '*', handler: (event: CognitiveEvent) => void) => void;
  readonly health: () => {
    status: 'healthy' | 'degraded' | 'stuck' | 'crashed';
    lastCycle: number;
    cycleCount: number;
    errorRate: number;
  };
  readonly capabilities: () => AgentCapabilities | AgentCapabilities[];
  readonly mount: (transport: Connection) => void;
  readonly unmount: (transport: Connection) => void;
  readonly chat?: ChatCapable['chat'];
}

export class CognitiveCoordinator implements CognitiveEventSource {
  #agents: CognitiveEventSource[];
  #listeners = new Set<(event: CognitiveEvent) => void>();
  #transports = new Set<Connection>();

  constructor(agents: CognitiveEventSource[]) {
    this.#agents = agents;
  }

  start(): void {
    for (const a of this.#agents) a.start();
  }
  stop(): void {
    for (const a of this.#agents) a.stop();
  }

  submit(input: string, correlationId: string): void {
    for (const a of this.#agents) a.submit(input, correlationId);
  }

  on(_event: string | '*', handler: (event: CognitiveEvent) => void): void {
    this.#listeners.add(handler);
  }

  off(_event: string | '*', handler: (event: CognitiveEvent) => void): void {
    this.#listeners.delete(handler);
  }

  health() {
    const statuses = this.#agents.map((a) => a.health().status);
    if (statuses.some((s) => s === 'crashed'))
      return { status: 'crashed' as const, lastCycle: 0, cycleCount: 0, errorRate: 1 };
    if (statuses.some((s) => s === 'stuck'))
      return { status: 'stuck' as const, lastCycle: 0, cycleCount: 0, errorRate: 0.5 };
    if (statuses.some((s) => s === 'degraded'))
      return { status: 'degraded' as const, lastCycle: 0, cycleCount: 0, errorRate: 0.1 };
    return {
      status: 'healthy' as const,
      lastCycle: Date.now(),
      cycleCount: this.#agents.reduce((n, a) => n + a.health().cycleCount, 0),
      errorRate: 0,
    };
  }

  capabilities() {
    return this.#agents.map((a) => a.capabilities()) as AgentCapabilities[];
  }

  mount(transport: Connection): void {
    this.#transports.add(transport);
    for (const a of this.#agents) a.mount(transport);

    transport.onMessage(async (msg: IOMessage) => {
      const correlationId = crypto.randomUUID();
      for (const a of this.#agents) a.submit(msg.text, correlationId);
    });
  }

  unmount(transport: Connection): void {
    this.#transports.delete(transport);
    for (const a of this.#agents) a.unmount(transport);
    transport.removeMessageHandler(async () => {});
  }
}
