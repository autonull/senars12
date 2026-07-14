import type { ChatOptions, ChatStreamEvent, CognitiveEvent } from './CognitiveEvent.js';
import type { AgentCapabilities, ChatMessage } from './Protocol.js';
import type { Connection, IOMessage } from './Transport.js';
import type { BackendConfig, GraphDelta, ToolDefinition } from './reasoning/BackendTypes.js';
import type { Capability } from './reasoning/Capability.js';
import type { ReasoningBackend } from './reasoning/ReasoningBackend.js';
import { ReasoningRouter, type Route } from './reasoning/ReasoningRouter.js';

export interface AgentConfig {
  name?: string;
  persona?: string;
}

export interface AgentHealth {
  status: 'healthy' | 'degraded' | 'stuck' | 'crashed';
  lastCycle: number;
  cycleCount: number;
  errorRate: number;
}

export interface BackendRegistration {
  backend: ReasoningBackend;
  config: BackendConfig;
}

type Listener = (event: CognitiveEvent) => void;

export class Agent {
  #backends = new Map<string, ReasoningBackend>();
  #router: ReasoningRouter;
  #listeners = new Set<Listener>();
  #transportCleanups = new Map<string, () => void>();
  #chatHistory: ChatMessage[] = [];
  #config: AgentConfig;
  #started = false;
  #onGraphDelta: ((delta: GraphDelta) => void) | null = null;

  constructor(config: AgentConfig = {}) {
    this.#config = config;
    this.#router = new ReasoningRouter(this.#backends);
  }

  get name(): string {
    return this.#config.name ?? 'senars';
  }

  get persona(): string {
    return this.#config.persona ?? '';
  }

  async registerBackend(backend: ReasoningBackend, config: BackendConfig = {}): Promise<void> {
    await backend.initialize(config);
    this.#backends.set(backend.id, backend);

    // Wire backend tools into NarBackend for LLM tool access
    // This allows MeTTa tools to be called via NAR's LLM chat
    if (backend.getTools && backend.id !== 'nar') {
      const narBackend = this.#backends.get('nar');
      const narBackendWithTools = narBackend as ReasoningBackend & { setExternalTools?: (tools: ToolDefinition[]) => void };
      if (narBackendWithTools?.setExternalTools) {
        narBackendWithTools.setExternalTools(backend.getTools());
      }
    }
  }

  hasBackend(id: string): boolean {
    return this.#backends.has(id);
  }

  getBackend(id: string): ReasoningBackend | undefined {
    return this.#backends.get(id);
  }

  getBackendIds(): string[] {
    return [...this.#backends.keys()];
  }

  /** Register a handler for graph deltas produced by backends. */
  setGraphDeltaHandler(handler: ((delta: GraphDelta) => void) | null): void {
    this.#onGraphDelta = handler;
  }

  // CognitiveEventSource interface

  start(): void {
    this.#started = true;
  }

  stop(): void {
    this.#started = false;
    for (const backend of this.#backends.values()) {
      backend.shutdown().catch(() => {});
    }
    this.#listeners.clear();
  }

  submit(input: string, correlationId: string): void {
    this.#routeAndExecute(input, correlationId).catch(() => {});
  }

  on(_event: string | '*', handler: Listener): void {
    this.#listeners.add(handler);
  }

  off(_event: string | '*', handler: Listener): void {
    this.#listeners.delete(handler);
  }

  health(): AgentHealth {
    const statuses: AgentHealth['status'][] = [];
    for (const backend of this.#backends.values()) {
      const h = backend.health();
      statuses.push(h.status);
    }
    if (statuses.some((s) => s === 'crashed'))
      return { status: 'crashed', lastCycle: 0, cycleCount: 0, errorRate: 1 };
    if (statuses.some((s) => s === 'stuck'))
      return { status: 'stuck', lastCycle: 0, cycleCount: 0, errorRate: 0.5 };
    if (statuses.some((s) => s === 'degraded'))
      return { status: 'degraded', lastCycle: 0, cycleCount: 0, errorRate: 0.1 };
    return {
      status: 'healthy',
      lastCycle: Date.now(),
      cycleCount: this.#backends.size,
      errorRate: 0,
    };
  }

  capabilities(): AgentCapabilities[] {
    const caps = new Set<Capability>();
    for (const backend of this.#backends.values()) {
      for (const cap of backend.capabilities) {
        caps.add(cap);
      }
    }
    return [
      {
        engine: 'metta',
        supports: {
          chat: caps.has('llm-completion'),
          beliefs: caps.has('inheritance'),
          drives: caps.has('drive-management'),
          skills: caps.has('skill-execution'),
          ltm: caps.has('long-term-memory'),
          rlfp: false,
          selfReasoning: caps.has('self-reasoning'),
          autonomyLoop: caps.has('autonomy-loop'),
        },
      },
    ];
  }

  mount(transport: Connection): void {
    const handler = (message: IOMessage): Promise<void> => {
      const correlationId = crypto.randomUUID();
      this.submit(message.text, correlationId);
      return Promise.resolve();
    };
    transport.onMessage(handler);
    this.#transportCleanups.set(transport.id, () => {
      transport.removeMessageHandler(handler);
    });
  }

  unmount(transport: Connection): void {
    const cleanup = this.#transportCleanups.get(transport.id);
    if (cleanup) {
      cleanup();
      this.#transportCleanups.delete(transport.id);
    }
  }

  // Streaming chat entry point

  async chat(input: string, opts?: ChatOptions & { stream?: false }): Promise<string>;
  async chat(input: string, opts: ChatOptions & { stream: true }): Promise<string>;
  async chat(input: string, _opts?: ChatOptions): Promise<string> {
    const correlationId = crypto.randomUUID();
    this.#emitEvent({
      engine: 'metta',
      type: 'input',
      term: input,
      source: 'chat',
      timestamp: Date.now(),
      correlationId,
    });

    const route = this.#router.routeForChat(input, this.#chatHistory);
    let response = '';

    for await (const chunk of this.#executeRoute(route, input, correlationId)) {
      if (chunk.kind === 'text-delta') {
        response += chunk.text ?? '';
      }
    }

    this.#chatHistory.push(
      { id: crypto.randomUUID(), role: 'user', content: input, timestamp: Date.now(), parentId: null, threadRootId: '', supports: [], contradicts: [], derivesFrom: [] },
      { id: crypto.randomUUID(), role: 'agent', content: response, timestamp: Date.now(), parentId: null, threadRootId: '', supports: [], contradicts: [], derivesFrom: [] }
    );

    return response;
  }

  async *chatStream(input: string, _opts?: ChatOptions): AsyncGenerator<ChatStreamEvent, string> {
    const correlationId = crypto.randomUUID();
    this.#emitEvent({
      engine: 'metta',
      type: 'input',
      term: input,
      source: 'chat',
      timestamp: Date.now(),
      correlationId,
    });

    const route = this.#router.routeForChat(input, this.#chatHistory);
    let response = '';

    for await (const chunk of this.#executeRoute(route, input, correlationId)) {
      if (chunk.kind === 'text-delta') {
        response += chunk.text ?? '';
      }
      yield chunk;
    }

    this.#chatHistory.push(
      { id: crypto.randomUUID(), role: 'user', content: input, timestamp: Date.now(), parentId: null, threadRootId: '', supports: [], contradicts: [], derivesFrom: [] },
      { id: crypto.randomUUID(), role: 'agent', content: response, timestamp: Date.now(), parentId: null, threadRootId: '', supports: [], contradicts: [], derivesFrom: [] }
    );

    return response;
  }

  // Internal routing + execution

  async #routeAndExecute(input: string, correlationId: string): Promise<void> {
    const route = this.#router.route(input, this.#chatHistory);

    for (const step of route.steps) {
      const backend = this.#backends.get(step.backendId);
      if (!backend) continue;

      try {
        const result = await backend.reason({
          type: step.type,
          content: step.content,
          correlationId,
        });

        for (const event of result.events) {
          this.#emitEvent(event);
        }

        if (result.graphDelta && this.#onGraphDelta) {
          this.#onGraphDelta(result.graphDelta);
        }
      } catch (e) {
        this.#emitEvent({
          engine: 'metta',
          type: 'derivation',
          term: `Error: ${String(e)}`,
          confidence: 0,
          timestamp: Date.now(),
          correlationId,
        });
      }
    }
  }

  async *#executeRoute(route: Route, input: string, correlationId: string): AsyncGenerator<ChatStreamEvent> {
    for (const step of route.steps) {
      const backend = this.#backends.get(step.backendId);
      if (!backend) {
        yield { kind: 'error', error: `Backend '${step.backendId}' not found` };
        return;
      }

      try {
        const result = await backend.reason({
          type: step.type,
          content: step.content,
          correlationId,
        });

        for (const event of result.events) {
          this.#emitEvent(event);
        }

        if (result.graphDelta && this.#onGraphDelta) {
          this.#onGraphDelta(result.graphDelta);
        }

        if (result.success && result.output?.value) {
          yield { kind: 'text-delta', text: String(result.output.value) };
        }
      } catch (e) {
        yield { kind: 'error', error: String(e) };
        return;
      }
    }

    yield { kind: 'finish', text: '' };
  }

  #emitEvent(event: CognitiveEvent): void {
    for (const listener of this.#listeners) {
      try {
        listener(event);
      } catch {
        // listener error is non-fatal
      }
    }
  }
}
