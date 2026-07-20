import type { ChatOptions, ChatStreamEvent, CognitiveEvent } from './CognitiveEvent.js';
import type { Connection } from './Transport.js';
import type { AgentCapabilities } from './protocol/index.js';

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
