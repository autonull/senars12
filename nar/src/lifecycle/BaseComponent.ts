import type {
  ComponentContext,
  ComponentState,
  BaseComponent as UtilBaseComponent,
} from '@senars/util';
import { type Logger as NarLogger, createLogger } from '../logger';
import { MetricsCollector } from '../metrics';
import { EventBus as NarEventBus } from '../types/events.js';

export type { ComponentState, ComponentContext };

export abstract class NarBaseComponent implements UtilBaseComponent {
  readonly id: string;
  readonly state: ComponentState;

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

  abstract initialize(): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract getState(): ComponentState;
}
