import type {
  ComponentContext,
  ComponentState,
  BaseComponent as UtilBaseComponent,
} from '@senars/util';
import { createLogger, type Logger as NarLogger } from '../logger';
import { MetricsCollector } from '../metrics';
import { EventBus as NarEventBus } from '../types/events.js';

export type { ComponentContext, ComponentState };

export class NarBaseComponent implements UtilBaseComponent {
  readonly id: string;
  state: ComponentState;

  private readonly _logger: NarLogger;
  private readonly _metrics: MetricsCollector;
  private readonly _eventBus: NarEventBus;

  get logger(): NarLogger {
    return this._logger;
  }

  get metrics(): MetricsCollector {
    return this._metrics;
  }

  get eventBus(): NarEventBus {
    return this._eventBus;
  }

  constructor(
    id: string,
    context?: Partial<
      ComponentContext & { logger?: NarLogger; metrics?: MetricsCollector; eventBus?: NarEventBus }
    >
  ) {
    this.id = id;
    this.state = context?.state ?? 'initializing';

    const logger: NarLogger = context?.logger ?? createLogger({ scope: 'Component' });
    const metrics: MetricsCollector = context?.metrics ?? new MetricsCollector();
    const eventBus: NarEventBus = context?.eventBus ?? new NarEventBus();

    this._logger = logger;
    this._metrics = metrics;
    this._eventBus = eventBus;
  }

  async initialize(): Promise<void> {
    this.state = 'initializing';
  }

  async start(): Promise<void> {
    this.state = 'running';
  }

  async stop(): Promise<void> {
    this.state = 'stopped';
  }

  async dispose(): Promise<void> {
    this.state = 'stopped';
  }

  getState(): ComponentState {
    return this.state;
  }
}
