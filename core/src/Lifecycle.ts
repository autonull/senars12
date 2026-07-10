export type ComponentState = 'created' | 'initialized' | 'started' | 'stopped' | 'disposed';

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  child(scope: string): Logger;
}

export interface Metrics {
  increment(name: string, value?: number, tags?: Record<string, unknown>): void;
  gauge(name: string, value: number, tags?: Record<string, unknown>): void;
  histogram(name: string, value: number, tags?: Record<string, unknown>): void;
}

export interface EventBus {
  emit(event: string, data: unknown): void;
  on(event: string, handler: (data: unknown) => void): () => void;
  off(event: string, handler: (data: unknown) => void): void;
}

export interface ComponentContext {
  readonly logger: Logger;
  readonly metrics: Metrics;
  readonly eventBus: EventBus;
}

const VALID_TRANSITIONS: Record<ComponentState, ComponentState[]> = {
  created: ['initialized', 'disposed'],
  initialized: ['started', 'disposed'],
  started: ['stopped', 'disposed'],
  stopped: ['started', 'disposed'],
  disposed: [],
};

export abstract class BaseComponent {
  private _state: ComponentState = 'created';
  private readonly _context?: ComponentContext;

  constructor(context?: ComponentContext) {
    this._context = context;
  }

  get state(): ComponentState {
    return this._state;
  }

  get logger(): Logger | undefined {
    return this._context?.logger;
  }

  get metrics(): Metrics | undefined {
    return this._context?.metrics;
  }

  get eventBus(): EventBus | undefined {
    return this._context?.eventBus;
  }

  async initialize(): Promise<void> {
    if (this._state !== 'created') {
      throw new Error(`Cannot initialize component in state: ${this._state}`);
    }
    this.setState('initialized');
  }

  async start(): Promise<void> {
    if (this._state !== 'initialized') {
      throw new Error(`Cannot start component in state: ${this._state}`);
    }
    this.setState('started');
  }

  async stop(): Promise<void> {
    if (this._state !== 'started') {
      throw new Error(`Cannot stop component in state: ${this._state}`);
    }
    this.setState('stopped');
  }

  async dispose(): Promise<void> {
    if (this._state === 'disposed') return;
    if (this._state === 'started') await this.stop();
    this.setState('disposed');
  }

  isRunning(): boolean {
    return this._state === 'started';
  }

  isInitialized(): boolean {
    return this._state === 'initialized' || this._state === 'started';
  }

  protected setState(state: ComponentState): void {
    const validTransitions = VALID_TRANSITIONS[this._state];
    if (!validTransitions.includes(state)) {
      throw new Error(
        `Invalid state transition from ${this._state} to ${state}. Valid transitions: ${validTransitions.join(', ')}`,
      );
    }
    this._state = state;
  }
}
